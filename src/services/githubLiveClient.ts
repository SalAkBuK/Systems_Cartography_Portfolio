/**
 * BROWSER CLIENT for the runtime live-GitHub-inventory feature.
 *
 * Calls the SAME-ORIGIN `/api/github-live` endpoint only. It never calls
 * github.com directly, never sends a token, and never accepts an arbitrary URL
 * or owner. Every failure mode (offline, timeout, non-200, malformed JSON,
 * malformed shape) resolves to `{ response: null, transport: 'error' }` so the
 * caller can safely keep the committed snapshot -- this function never throws
 * and never rejects.
 *
 * This module is browser-safe: it imports only the shared TYPE module and the
 * existing URL guard. It must not import `githubLiveInventory.ts` (server-only).
 */

import { sanitizeHttpUrl } from '../utils/urlSecurity';
import type {
  LiveInventoryFetchResult,
  LiveInventoryResponse,
  LiveRepository,
} from './githubLiveTypes';

/** Same integer as the server's `MAX_LIVE_REPOSITORIES`; a small deliberate duplication across the server/client boundary. */
export const MAX_LIVE_REPOSITORIES_CLIENT = 250;
export const DEFAULT_LIVE_FETCH_TIMEOUT_MS = 10_000;
export const LIVE_ENDPOINT_PATH = '/api/github-live';

const VALID_REASONS = new Set([
  'ok',
  'partial',
  'rate_limited',
  'upstream_error',
  'timeout',
  'not_configured',
  'bad_method',
]);

function str(value: unknown, max: number): string {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

function nullableStr(value: unknown, max: number): string | null {
  return str(value, max) || null;
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

/**
 * Defensive re-validation of one repository entry. The server already
 * sanitizes; this is fail-closed defense in depth against a malformed or
 * hostile response. Returns null for anything without usable identity or a
 * safe HTTPS `htmlUrl`.
 */
export function parseLiveRepository(raw: unknown): LiveRepository | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;

  const id = count(value.id);
  const name = str(value.name, 300);
  const ownerLogin = str(value.ownerLogin, 100);
  const htmlUrl = sanitizeHttpUrl(str(value.htmlUrl, 2048));
  if (id <= 0 || !name || !ownerLogin || !htmlUrl) return null;

  const topics = Array.isArray(value.topics)
    ? value.topics.map((t) => str(t, 100)).filter((t): t is string => Boolean(t)).slice(0, 100)
    : [];

  return {
    id,
    name,
    fullName: str(value.fullName, 500) || `${ownerLogin}/${name}`,
    htmlUrl,
    homepage: sanitizeHttpUrl(str(value.homepage, 2048)) || null,
    description: nullableStr(value.description, 2000),
    language: nullableStr(value.language, 100),
    topics,
    stars: count(value.stars),
    forks: count(value.forks),
    openIssues: count(value.openIssues),
    sizeKb: count(value.sizeKb),
    archived: value.archived === true,
    fork: value.fork === true,
    defaultBranch: str(value.defaultBranch, 300) || 'main',
    createdAt: str(value.createdAt, 40),
    updatedAt: str(value.updatedAt, 40),
    pushedAt: str(value.pushedAt, 40) || null,
    ownerLogin,
  };
}

/**
 * Shape-validates a full endpoint payload. Returns null when the envelope is
 * not usable at all; drops individual malformed repositories otherwise.
 */
export function parseLiveInventoryResponse(raw: unknown): LiveInventoryResponse | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;

  if (typeof value.ok !== 'boolean') return null;
  if (typeof value.owner !== 'string') return null;
  if (typeof value.complete !== 'boolean' || typeof value.truncated !== 'boolean') return null;
  if (!Array.isArray(value.repositories)) return null;
  if (typeof value.reason !== 'string' || !VALID_REASONS.has(value.reason)) return null;

  const repositories = value.repositories
    .slice(0, MAX_LIVE_REPOSITORIES_CLIENT)
    .map(parseLiveRepository)
    .filter((repo): repo is LiveRepository => repo !== null);

  return {
    ok: value.ok,
    owner: value.owner.toLowerCase().slice(0, 100),
    complete: value.complete,
    truncated: value.truncated,
    fetchedAt: str(value.fetchedAt, 40) || new Date().toISOString(),
    authenticated: value.authenticated === true,
    repositoryCount: repositories.length,
    repositories,
    reason: value.reason as LiveInventoryResponse['reason'],
  };
}

function readCacheAge(headers: Headers): number | null {
  const ageHeader = headers.get('age');
  if (ageHeader) {
    const age = parseInt(ageHeader, 10);
    if (Number.isFinite(age) && age >= 0) return age;
  }
  const vercelCache = headers.get('x-vercel-cache');
  if (vercelCache && /^(HIT|STALE)$/i.test(vercelCache)) return 1;
  return null;
}

export interface FetchLiveInventoryOptions {
  /** External abort signal (e.g. component unmount). */
  signal?: AbortSignal;
  /** Bounded browser-side deadline. */
  timeoutMs?: number;
  /** Injectable transport for tests. */
  fetchImpl?: typeof fetch;
  /**
   * Manual reload only. Automatic / background / initial syncs leave this
   * false and request the plain `/api/github-live`, which stays served through
   * the ordinary Vercel CDN edge cache (`s-maxage` / `stale-while-revalidate`)
   * -- correct and efficient for a normal visitor.
   *
   * A manual reload sets this true, which (a) bypasses the browser's own HTTP
   * cache (`cache: 'no-cache'`) and (b) appends a unique `?refresh=<token>`
   * query parameter. Because Vercel's CDN cache key includes the query string,
   * that URL is a distinct cache entry the edge has never seen, so the request
   * reaches a fresh function execution instead of reusing the ordinary cached
   * inventory. The token is a pure cache-key discriminator: it carries no
   * owner, no secret, and the server never reads or interprets it.
   */
  bustBrowserCache?: boolean;
  /** Test seam: source of the manual-refresh cache-key timestamp. Defaults to `Date.now`. */
  now?: () => number;
}

/**
 * Monotonic per-session counter mixed into the manual-refresh token so two
 * manual reloads within the same millisecond still produce distinct URLs (and
 * therefore distinct CDN cache keys). Resets on every page load.
 */
let manualRefreshSequence = 0;

/** Builds the same-origin request URL: plain for background sync, `?refresh=<token>` for a manual reload. */
function resolveLiveInventoryRequestUrl(options: FetchLiveInventoryOptions): string {
  if (!options.bustBrowserCache) return LIVE_ENDPOINT_PATH;
  const nowMs = (options.now ?? Date.now)();
  const token = `${nowMs}.${++manualRefreshSequence}`;
  return `${LIVE_ENDPOINT_PATH}?refresh=${encodeURIComponent(token)}`;
}

/**
 * Fetches the live inventory from the same-origin endpoint. Never throws.
 */
export async function fetchLiveGitHubInventory(
  options: FetchLiveInventoryOptions = {},
): Promise<LiveInventoryFetchResult> {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_LIVE_FETCH_TIMEOUT_MS;
  const requestUrl = resolveLiveInventoryRequestUrl(options);

  if (typeof fetchImpl !== 'function') {
    return { response: null, transport: 'error', ageSeconds: null, error: 'fetch unavailable' };
  }
  if (options.signal?.aborted) {
    return { response: null, transport: 'error', ageSeconds: null, error: 'aborted' };
  }

  const controller = new AbortController();
  const onExternalAbort = () => controller.abort();
  if (options.signal) {
    if (options.signal.aborted) controller.abort();
    else options.signal.addEventListener('abort', onExternalAbort, { once: true });
  }
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchImpl(requestUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      cache: options.bustBrowserCache ? 'no-cache' : 'default',
      credentials: 'omit',
      redirect: 'error',
    });

    if (!res.ok) {
      return { response: null, transport: 'error', ageSeconds: null, error: `HTTP ${res.status}` };
    }

    let json: unknown;
    try {
      json = await res.json();
    } catch {
      return { response: null, transport: 'error', ageSeconds: null, error: 'invalid JSON' };
    }

    const parsed = parseLiveInventoryResponse(json);
    if (!parsed) {
      return { response: null, transport: 'error', ageSeconds: null, error: 'malformed payload' };
    }

    const ageSeconds = readCacheAge(res.headers);
    return {
      response: parsed,
      transport: ageSeconds !== null ? 'cached' : 'live',
      ageSeconds,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? controller.signal.aborted
          ? 'aborted'
          : error.message
        : 'network error';
    return { response: null, transport: 'error', ageSeconds: null, error: message };
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onExternalAbort);
  }
}
