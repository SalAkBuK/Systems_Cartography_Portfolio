/**
 * SHARED TYPES for the runtime live-GitHub-inventory feature.
 *
 * This module is TYPE-ONLY (no runtime code, no imports) so it can be safely
 * referenced from BOTH the server-side endpoint core
 * (`githubLiveInventory.ts`, Node-only) and the browser client
 * (`githubLiveClient.ts`). Neither side should import the other's module.
 */

/**
 * The bounded, sanitized subset of a GitHub repository the portfolio frontend
 * actually needs at runtime. Deliberately much smaller than the deep-inspection
 * `GitHubRepoRaw` in `githubService.ts` -- a normal visitor never triggers
 * per-repository inspection.
 */
export interface LiveRepository {
  /** GitHub's numeric repository id -- the stable identity across renames. */
  id: number;
  name: string;
  fullName: string;
  htmlUrl: string;
  homepage: string | null;
  description: string | null;
  language: string | null;
  topics: string[];
  stars: number;
  forks: number;
  openIssues: number;
  /** Repository size in KB, used only to mirror the snapshot's non-empty filter. */
  sizeKb: number;
  archived: boolean;
  fork: boolean;
  defaultBranch: string;
  createdAt: string;
  updatedAt: string;
  pushedAt: string | null;
  ownerLogin: string;
}

export type LiveInventoryReason =
  | 'ok'
  | 'partial'
  | 'rate_limited'
  | 'upstream_error'
  | 'timeout'
  | 'not_configured'
  | 'bad_method';

/**
 * The JSON envelope returned by `/api/github-live`. `ok` + `complete` together
 * decide what reconciliation is allowed to do:
 *   - `ok === false`            -> ignore live data entirely, keep the snapshot.
 *   - `ok && !complete`         -> overlay metadata onto matched projects and
 *                                  add newly-seen public repos, but NEVER treat
 *                                  a snapshot project's absence as a deletion.
 *   - `ok && complete`          -> full authority, including removing snapshot
 *                                  projects that are no longer public.
 */
export interface LiveInventoryResponse {
  ok: boolean;
  /** Canonical lowercased owner login this inventory is bound to. */
  owner: string;
  /** True only when every page was fetched successfully and nothing was truncated. */
  complete: boolean;
  /** True when the repository ceiling was hit before the account was exhausted. */
  truncated: boolean;
  /** ISO timestamp the endpoint produced this payload (not the CDN cache age). */
  fetchedAt: string;
  /** Whether the endpoint used an authenticated GitHub request server-side. */
  authenticated: boolean;
  repositoryCount: number;
  repositories: LiveRepository[];
  reason: LiveInventoryReason;
}

/** Client-side view of a completed (or failed) live fetch attempt. */
export interface LiveInventoryFetchResult {
  /** Parsed, shape-validated response, or null when the fetch failed / was unusable. */
  response: LiveInventoryResponse | null;
  /** How the payload reached the browser, for the telemetry bar. */
  transport: 'live' | 'cached' | 'error';
  /** CDN cache age in seconds when known (from the `age` response header). */
  ageSeconds: number | null;
  /** Populated only on failure. */
  error?: string;
}
