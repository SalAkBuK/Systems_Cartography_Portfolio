/**
 * useLiveGitHubInventory
 *
 * Progressive-enhancement hook that keeps the rendered project inventory in
 * sync with the CURRENT public GitHub repository membership of the configured
 * owner, WITHOUT ever blocking first paint on the network and WITHOUT ever
 * replacing good committed-snapshot state with bad live state.
 *
 * Lifecycle:
 *   mount ->  projects initialise SYNCHRONOUSLY from the committed snapshot
 *         ->  a single `/api/github-live` request starts after mount
 *   success (complete)   ->  reconcile: overlay metadata, add new public repos,
 *                            drop repos that are no longer public
 *   success (incomplete) ->  reconcile: overlay + add only (never drop)
 *   failure / malformed  ->  keep the snapshot projects untouched
 *
 * The hook owns the `projects` array so `App.tsx` stays a thin consumer. It
 * writes nothing to browser storage, and tolerates a reconciled project having
 * zero capability relationships.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ProjectData } from '../types';
import { applyProjectLinkOverrides } from '../utils/portfolioUtils';
import {
  reconcileLiveRepositories,
  type ReconcileStats,
} from '../utils/reconcileLiveRepositories';
import { fetchLiveGitHubInventory } from '../services/githubLiveClient';
import type { LiveInventoryResponse } from '../services/githubLiveTypes';

export type LiveInventoryStatus = 'snapshot' | 'syncing' | 'live' | 'cached' | 'fallback';

/**
 * The RAW live repository count to surface in telemetry, given the previously
 * tracked value and the latest live fetch attempt.
 *
 *  - A successful (applied) live/cached payload publishes ITS OWN
 *    `repositoryCount` — the number of repositories GitHub's inventory returned
 *    after the server's live inventory rules. This is never derived from how
 *    many projects ended up rendered.
 *  - Any other outcome (snapshot before first response, owner-mismatch
 *    fallback, network failure, malformed payload) keeps the last known-good
 *    value — `null` if a live payload has never succeeded. Telemetry must not
 *    invent a live count in those states.
 */
export function resolveLiveRepositoryCount(
  previous: number | null,
  applied: boolean,
  response: Pick<LiveInventoryResponse, 'repositoryCount'> | null,
): number | null {
  if (applied && response) return response.repositoryCount;
  return previous;
}

export interface UseLiveGitHubInventoryParams {
  /** RAW committed-snapshot projects (before link overrides). */
  snapshotProjects: ProjectData[];
  /** PORTFOLIO_CONFIG.projectLinks — applied AFTER reconciliation. */
  projectLinks?: Record<string, string>;
  /** PORTFOLIO_CONFIG.githubTarget — the owner the live inventory must match. */
  configuredGithubTarget: string;
  /** Live sync only runs when the owner-scoped snapshot is present. */
  enabled: boolean;
  /** Test seam. */
  fetchImpl?: typeof fetch;
}

export interface UseLiveGitHubInventoryResult {
  projects: ProjectData[];
  status: LiveInventoryStatus;
  /** ISO timestamp of the last successful live payload (fresh or cached). */
  lastRefreshedAt: string | null;
  /**
   * RAW count of public repositories the last successful live inventory
   * returned (after the server's live inventory rules) — NOT the rendered
   * project count. `null` until a live/cached payload has succeeded; a
   * snapshot/fallback state never fabricates this.
   */
  liveRepositoryCount: number | null;
  /**
   * Projects currently rendered in the topology after reconciliation /
   * filtering — always `projects.length`.
   */
  renderedProjectCount: number;
  stats: ReconcileStats | null;
  isRefreshing: boolean;
  /** Manual re-request of the live inventory; preserves topology state. */
  refresh: () => void;
}

export function useLiveGitHubInventory(
  params: UseLiveGitHubInventoryParams,
): UseLiveGitHubInventoryResult {
  const { snapshotProjects, projectLinks, configuredGithubTarget, enabled, fetchImpl } = params;

  const snapshotWithLinks = useMemo(
    () => applyProjectLinkOverrides(snapshotProjects, projectLinks),
    [snapshotProjects, projectLinks],
  );

  const [projects, setProjects] = useState<ProjectData[]>(snapshotWithLinks);
  const [status, setStatus] = useState<LiveInventoryStatus>(enabled ? 'syncing' : 'snapshot');
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  // RAW live repository count from the last successful live payload. Starts
  // null (no live payload yet) and only ever advances on an applied response —
  // a fallback keeps the last known-good value rather than reverting to null.
  const [liveRepositoryCount, setLiveRepositoryCount] = useState<number | null>(null);
  const [stats, setStats] = useState<ReconcileStats | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Bumped on unmount and on each new request so a slow in-flight response
  // that resolves late is ignored.
  const requestSeqRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  // If the snapshot base changes (owner reconfigured, HMR), re-seed from it.
  useEffect(() => {
    setProjects(snapshotWithLinks);
  }, [snapshotWithLinks]);

  const runSync = useCallback(
    (mode: 'initial' | 'manual') => {
      if (!enabled) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const seq = ++requestSeqRef.current;

      if (mode === 'manual') setIsRefreshing(true);
      setStatus((prev) => (prev === 'snapshot' ? 'syncing' : mode === 'initial' ? 'syncing' : prev));

      void fetchLiveGitHubInventory({
        signal: controller.signal,
        fetchImpl,
        bustBrowserCache: mode === 'manual',
      })
        .then((result) => {
          if (!mountedRef.current || seq !== requestSeqRef.current) return;

          if (!result.response) {
            setStatus('fallback');
            setStats({
              applied: false,
              fallbackReason: 'not_ok',
              matched: 0,
              overlaid: 0,
              added: 0,
              removed: 0,
              retainedOnIncomplete: 0,
              complete: false,
              truncated: false,
            });
            return;
          }

          const response = result.response;
          const reconciled = reconcileLiveRepositories(snapshotProjects, response, {
            configuredGithubTarget,
          });
          setStats(reconciled.stats);

          if (reconciled.stats.applied) {
            setStatus(result.transport === 'cached' ? 'cached' : 'live');
            setLastRefreshedAt(response.fetchedAt);
            setLiveRepositoryCount((prev) =>
              resolveLiveRepositoryCount(prev, reconciled.stats.applied, response),
            );
            if (reconciled.changed) {
              setProjects(applyProjectLinkOverrides(reconciled.projects, projectLinks));
            }
          } else {
            // Live payload arrived but reconciliation declined to apply it
            // (owner mismatch, not ok, or would empty the topology).
            setStatus('fallback');
          }
        })
        .catch(() => {
          if (!mountedRef.current || seq !== requestSeqRef.current) return;
          setStatus('fallback');
        })
        .finally(() => {
          if (!mountedRef.current || seq !== requestSeqRef.current) return;
          if (mode === 'manual') setIsRefreshing(false);
        });
    },
    [enabled, fetchImpl, snapshotProjects, projectLinks, configuredGithubTarget],
  );

  useEffect(() => {
    mountedRef.current = true;
    runSync('initial');
    return () => {
      mountedRef.current = false;
      requestSeqRef.current++;
      abortRef.current?.abort();
    };
  }, [runSync]);

  const refresh = useCallback(() => {
    runSync('manual');
  }, [runSync]);

  return {
    projects,
    status,
    lastRefreshedAt,
    liveRepositoryCount,
    renderedProjectCount: projects.length,
    stats,
    isRefreshing,
    refresh,
  };
}
