/**
 * SERVER-SIDE LIVE GITHUB INVENTORY CORE  (Node runtime only -- never import
 * this from browser code; the browser talks to the same-origin `/api/github-live`
 * endpoint via `githubLiveClient.ts`).
 *
 * This is the transport-agnostic core behind the Vercel serverless function
 * `api/github-live.ts` and the local Vite dev middleware. It:
 *
 *   1. Determines the portfolio's configured GitHub owner from committed owner
 *      configuration (never from a request parameter -- this is NOT an
 *      arbitrary GitHub proxy).
 *   2. Retrieves that owner's CURRENT public repositories from the official
 *      GitHub REST API, with proper pagination and a defensive repository
 *      ceiling matching the snapshot pipeline's `MAX_GITHUB_REPOSITORIES`.
 *   3. Reduces each repository to the small, bounded, sanitized `LiveRepository`
 *      shape the frontend needs -- it does NOT run the heavy per-repository
 *      deep-inspection pipeline in `githubService.ts`, which stays reserved for
 *      setup-time snapshot generation.
 *   4. Uses a server-side `GITHUB_TOKEN` when present (never returned, logged,
 *      or exposed), and works unauthenticated otherwise with graceful
 *      rate-limit handling.
 *
 * Reuse: the security-critical URL guard (`sanitizeHttpUrl`), the GitHub target
 * parser (`parseGitHubTarget`), and the centralized REST request scheduler
 * (bounded concurrency / pacing / timeout / transient retry / primary
 * rate-limit detection) are all reused from existing modules. The deep-
 * inspection analyzer stack is intentionally NOT pulled in here.
 */

import { OWNER_PROFILE } from '../data/ownerProfile.generated';
import { parseGitHubTarget } from '../utils/ownerScope';
import { sanitizeHttpUrl } from '../utils/urlSecurity';
import {
  GitHubRequestScheduler,
  GitHubPrimaryRateLimitError,
  formatRateLimitResetTime,
  type GitHubRequestSchedulerOptions,
} from './githubRequestScheduler';
import type {
  LiveInventoryReason,
  LiveInventoryResponse,
  LiveRepository,
} from './githubLiveTypes';

/**
 * Defensive repository ceiling. Deliberately identical to
 * `MAX_GITHUB_REPOSITORIES` in `githubService.ts` so the runtime inventory and
 * the committed snapshot agree on how many repositories they will ever
 * represent. Kept as a local constant (rather than imported) so this module
 * never transitively pulls in the deep-inspection stack.
 */
export const MAX_LIVE_REPOSITORIES = 250;
export const LIVE_REPOS_PER_PAGE = 100;
/** ceil(MAX_LIVE_REPOSITORIES / LIVE_REPOS_PER_PAGE) -- hard pagination stop. */
export const MAX_LIVE_PAGES = 3;
/** GitHub `/users/:owner/repos` payloads are small; this is a generous guard. */
export const MAX_LIVE_JSON_BYTES = 4 * 1024 * 1024;
/** Per-request network deadline for a single GitHub REST call. */
export const LIVE_GITHUB_REQUEST_TIMEOUT_MS = 6_000;
/** Whole-operation budget (all pages together). */
export const LIVE_TOTAL_BUDGET_MS = 9_000;

/** String length ceilings for sanitized text fields. */
const MAX_NAME_LEN = 300;
const MAX_FULL_NAME_LEN = 500;
const MAX_URL_LEN = 2_048;
const MAX_DESCRIPTION_LEN = 2_000;
const MAX_LANGUAGE_LEN = 100;
const MAX_TOPIC_LEN = 100;
const MAX_TOPICS = 100;
const MAX_LOGIN_LEN = 100;
const MAX_BRANCH_LEN = 300;
const MAX_TIMESTAMP_LEN = 40;

export interface LiveInventoryEnv {
  /** Server-side GitHub token. Never returned, logged, or bundled. */
  GITHUB_TOKEN?: string;
  GH_TOKEN?: string;
}

export interface HandleLiveRequestOptions {
  method?: string;
  env?: LiveInventoryEnv;
  fetchImpl?: typeof fetch;
  /** Upstream abort signal (e.g. platform request cancellation). */
  signal?: AbortSignal;
  /** Injectable clock for deterministic tests. */
  now?: () => number;
  /** Scheduler overrides for tests (pacing, retries, timeouts, sleep/clock). */
  schedulerOptions?: GitHubRequestSchedulerOptions;
  /**
   * TEST / DEPENDENCY-INJECTION SEAM ONLY. Explicit GitHub target to bind to,
   * instead of the committed `OWNER_PROFILE.githubTarget`. The production
   * function (`api/github-live.ts`) and the Vite dev middleware never pass
   * this, so a deployed instance can only ever query its configured owner --
   * there is no environment-variable owner override.
   */
  githubTarget?: string;
}

export interface LiveHttpResult {
  status: number;
  headers: Record<string, string>;
  /** Always the `LiveInventoryResponse` object (JSON-serializable). */
  body: LiveInventoryResponse;
}

function boundedString(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function boundedNullableString(value: unknown, maxLength: number): string | null {
  return boundedString(value, maxLength) || null;
}

function safeCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function boundedUrl(value: unknown): string | null {
  return sanitizeHttpUrl(boundedString(value, MAX_URL_LEN)) || null;
}

/**
 * Resolves the portfolio's bound GitHub owner login from the committed
 * `OWNER_PROFILE.githubTarget`. There is NO environment-variable override -- a
 * deployed instance can only ever query its configured owner. `githubTarget` is
 * a test / dependency-injection seam (see `HandleLiveRequestOptions.githubTarget`).
 * Returns '' when the target cannot be parsed.
 */
export function resolveConfiguredOwner(githubTarget: string = OWNER_PROFILE.githubTarget): string {
  try {
    return parseGitHubTarget(githubTarget || '').owner;
  } catch {
    return '';
  }
}

/**
 * Validates + bounds one raw GitHub repository object into a `LiveRepository`.
 * Returns null for anything missing required identity, or owned by a login
 * other than `expectedOwnerLower` (defense in depth: the `/users/:owner/repos`
 * endpoint already scopes results, but a mismatch is dropped rather than
 * trusted).
 */
export function sanitizeLiveRepository(raw: unknown, expectedOwnerLower: string): LiveRepository | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  const ownerValue =
    value.owner && typeof value.owner === 'object' ? (value.owner as Record<string, unknown>) : null;

  const id = safeCount(value.id);
  const name = boundedString(value.name, MAX_NAME_LEN);
  const ownerLogin = boundedString(ownerValue?.login, MAX_LOGIN_LEN);
  if (id <= 0 || !name || !ownerLogin) return null;

  if (expectedOwnerLower && ownerLogin.toLowerCase() !== expectedOwnerLower) {
    return null;
  }

  const canonicalUrl = `https://github.com/${encodeURIComponent(ownerLogin)}/${encodeURIComponent(name)}`;
  const topics = Array.isArray(value.topics)
    ? value.topics
        .map((topic) => boundedString(topic, MAX_TOPIC_LEN))
        .filter((topic): topic is string => Boolean(topic))
        .slice(0, MAX_TOPICS)
    : [];

  return {
    id,
    name,
    fullName: boundedString(value.full_name, MAX_FULL_NAME_LEN) || `${ownerLogin}/${name}`,
    htmlUrl: boundedUrl(value.html_url) || canonicalUrl,
    homepage: boundedUrl(value.homepage),
    description: boundedNullableString(value.description, MAX_DESCRIPTION_LEN),
    language: boundedNullableString(value.language, MAX_LANGUAGE_LEN),
    topics,
    stars: safeCount(value.stargazers_count),
    forks: safeCount(value.forks_count),
    openIssues: safeCount(value.open_issues_count),
    sizeKb: safeCount(value.size),
    archived: value.archived === true,
    fork: value.fork === true,
    defaultBranch: boundedString(value.default_branch, MAX_BRANCH_LEN) || 'main',
    createdAt: boundedString(value.created_at, MAX_TIMESTAMP_LEN),
    updatedAt: boundedString(value.updated_at, MAX_TIMESTAMP_LEN),
    pushedAt: boundedString(value.pushed_at, MAX_TIMESTAMP_LEN) || null,
    ownerLogin,
  };
}

async function readBoundedJson(res: Response, maxBytes: number): Promise<unknown> {
  const contentLength = res.headers?.get?.('content-length');
  if (contentLength && Number.isFinite(Number(contentLength)) && Number(contentLength) > maxBytes) {
    throw new Error(`GitHub response exceeds the ${maxBytes}-byte inventory limit.`);
  }
  const text = await res.text();
  if (text.length > maxBytes) {
    throw new Error(`GitHub response exceeds the ${maxBytes}-byte inventory limit.`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('GitHub inventory response was not valid JSON.');
  }
}

export interface LivePublicRepositoriesResult {
  repositories: LiveRepository[];
  /** True only if every page loaded and nothing was truncated by the ceiling. */
  complete: boolean;
  truncated: boolean;
  reason: LiveInventoryReason;
  /** Epoch seconds of the rate-limit reset, when a rate limit was hit. */
  rateLimitResetEpoch?: number;
}

/**
 * Retrieves the configured owner's current public repositories with pagination
 * and the defensive ceiling. Never throws: transport / rate-limit / malformed
 * failures are converted into a `reason` and `complete: false`.
 */
export async function fetchLivePublicRepositories(params: {
  owner: string;
  token?: string;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  now?: () => number;
  schedulerOptions?: GitHubRequestSchedulerOptions;
}): Promise<LivePublicRepositoriesResult> {
  const { owner } = params;
  const fetchImpl = params.fetchImpl || globalThis.fetch;
  const now = params.now || (() => Date.now());
  const ownerLower = owner.toLowerCase();
  const startedAt = now();

  const scheduler = new GitHubRequestScheduler({
    maxConcurrency: 1,
    minSpacingMs: 0,
    maxRetries: 1,
    requestTimeoutMs: LIVE_GITHUB_REQUEST_TIMEOUT_MS,
    ...params.schedulerOptions,
  });

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'systems-cartography-portfolio-live',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (params.token && params.token.trim()) {
    headers.Authorization = `Bearer ${params.token.trim()}`;
  }

  const repositories: LiveRepository[] = [];
  let truncated = false;

  for (let page = 1; page <= MAX_LIVE_PAGES; page++) {
    if (now() - startedAt > LIVE_TOTAL_BUDGET_MS) {
      return { repositories, complete: false, truncated, reason: 'timeout' };
    }

    const url =
      `https://api.github.com/users/${encodeURIComponent(owner)}/repos` +
      `?type=owner&sort=updated&per_page=${LIVE_REPOS_PER_PAGE}&page=${page}`;

    let res: Response;
    try {
      res = await scheduler.request(fetchImpl, url, { headers, signal: params.signal }, {
        operation: `fetching live public repositories for "${owner}" (page ${page})`,
      });
    } catch (error) {
      if (error instanceof GitHubPrimaryRateLimitError) {
        return {
          repositories,
          complete: false,
          truncated,
          reason: 'rate_limited',
          rateLimitResetEpoch: error.reset || undefined,
        };
      }
      const aborted =
        params.signal?.aborted ||
        (error instanceof Error && /abort|timed out/i.test(error.message));
      return {
        repositories,
        complete: false,
        truncated,
        reason: aborted ? 'timeout' : 'upstream_error',
      };
    }

    if (res.status === 404) {
      // Configured owner does not exist / has no public presence. A definitive,
      // successful answer: zero public repositories.
      return { repositories: [], complete: page === 1, truncated: false, reason: 'ok' };
    }
    if (!res.ok) {
      const reason: LiveInventoryReason =
        res.status === 429 || res.status === 403 ? 'rate_limited' : 'upstream_error';
      const resetHeader = res.headers?.get?.('x-ratelimit-reset');
      const resetEpoch = resetHeader ? parseInt(resetHeader, 10) : NaN;
      return {
        repositories,
        complete: false,
        truncated,
        reason,
        rateLimitResetEpoch: Number.isFinite(resetEpoch) ? resetEpoch : undefined,
      };
    }

    let pageJson: unknown;
    try {
      pageJson = await readBoundedJson(res, MAX_LIVE_JSON_BYTES);
    } catch {
      return { repositories, complete: false, truncated, reason: 'upstream_error' };
    }
    if (!Array.isArray(pageJson)) {
      return { repositories, complete: false, truncated, reason: 'upstream_error' };
    }
    if (pageJson.length === 0) {
      // Natural end of pagination -> a complete inventory.
      return { repositories, complete: true, truncated, reason: truncated ? 'partial' : 'ok' };
    }

    for (const rawRepo of pageJson) {
      const sanitized = sanitizeLiveRepository(rawRepo, ownerLower);
      if (!sanitized) continue;
      if (repositories.length >= MAX_LIVE_REPOSITORIES) {
        truncated = true;
        break;
      }
      repositories.push(sanitized);
    }

    if (truncated) {
      return { repositories, complete: false, truncated: true, reason: 'partial' };
    }
    if (pageJson.length < LIVE_REPOS_PER_PAGE) {
      return { repositories, complete: true, truncated: false, reason: 'ok' };
    }
    if (page === MAX_LIVE_PAGES) {
      // Filled every allowed page and GitHub still had a full last page: the
      // account exceeds the ceiling.
      truncated = true;
      return { repositories, complete: false, truncated: true, reason: 'partial' };
    }
  }

  return { repositories, complete: false, truncated, reason: 'partial' };
}

/** Cache-Control tuned per outcome. Fresh 5-15m for good data; short for retryable failures. */
export function cacheControlForReason(
  reason: LiveInventoryReason,
  opts: { rateLimitResetEpoch?: number; now?: () => number } = {},
): string {
  const now = opts.now || (() => Date.now());
  switch (reason) {
    case 'ok':
      // Fresh for 10 minutes at the CDN; serve stale for up to an hour while a
      // single background request refreshes it. Visitors get an instant
      // response and GitHub is only contacted on a cache miss / refresh.
      return 'public, max-age=0, s-maxage=600, stale-while-revalidate=3600';
    case 'partial':
      return 'public, max-age=0, s-maxage=180, stale-while-revalidate=1800';
    case 'rate_limited': {
      const reset = opts.rateLimitResetEpoch;
      let sMaxAge = 300;
      if (reset && Number.isFinite(reset)) {
        const seconds = Math.round(reset - now() / 1000);
        sMaxAge = Math.min(900, Math.max(60, seconds));
      }
      return `public, max-age=0, s-maxage=${sMaxAge}, stale-while-revalidate=3600`;
    }
    case 'upstream_error':
    case 'timeout':
      return 'public, max-age=0, s-maxage=60, stale-while-revalidate=600';
    case 'not_configured':
      return 'public, max-age=0, s-maxage=300';
    default:
      return 'no-store';
  }
}

const BASE_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json; charset=utf-8',
  'X-Robots-Tag': 'noindex',
};

/**
 * Transport-agnostic request handler. Adapters (Vercel function, Vite dev
 * middleware) only translate their platform request/response to/from this.
 */
export async function handleLiveGitHubRequest(
  options: HandleLiveRequestOptions = {},
): Promise<LiveHttpResult> {
  const method = (options.method || 'GET').toUpperCase();
  const env = options.env || {};
  const now = options.now || (() => Date.now());
  const fetchedAt = new Date(now()).toISOString();

  const owner = resolveConfiguredOwner(options.githubTarget);

  const emptyBody = (
    ok: boolean,
    reason: LiveInventoryReason,
    complete: boolean,
    truncated: boolean,
  ): LiveInventoryResponse => ({
    ok,
    owner: owner.toLowerCase(),
    complete,
    truncated,
    fetchedAt,
    authenticated: Boolean((env.GITHUB_TOKEN || env.GH_TOKEN || '').trim()),
    repositoryCount: 0,
    repositories: [],
    reason,
  });

  if (method !== 'GET' && method !== 'HEAD') {
    return {
      status: 405,
      headers: { ...BASE_HEADERS, Allow: 'GET, HEAD', 'Cache-Control': 'no-store' },
      body: emptyBody(false, 'bad_method', false, false),
    };
  }

  if (!owner) {
    return {
      status: 500,
      headers: { ...BASE_HEADERS, 'Cache-Control': cacheControlForReason('not_configured') },
      body: emptyBody(false, 'not_configured', false, false),
    };
  }

  const token = (env.GITHUB_TOKEN || env.GH_TOKEN || '').trim() || undefined;

  const result = await fetchLivePublicRepositories({
    owner,
    token,
    fetchImpl: options.fetchImpl,
    signal: options.signal,
    now,
    schedulerOptions: options.schedulerOptions,
  });

  const hardFailure =
    result.reason === 'rate_limited' ||
    result.reason === 'upstream_error' ||
    result.reason === 'timeout';

  const ok = !hardFailure;

  const body: LiveInventoryResponse = {
    ok,
    owner: owner.toLowerCase(),
    complete: result.complete,
    truncated: result.truncated,
    fetchedAt,
    authenticated: Boolean(token),
    repositoryCount: result.repositories.length,
    repositories: result.repositories,
    reason: result.reason,
  };

  const headers: Record<string, string> = {
    ...BASE_HEADERS,
    'Cache-Control': cacheControlForReason(result.reason, {
      rateLimitResetEpoch: result.rateLimitResetEpoch,
      now,
    }),
  };
  if (result.reason === 'rate_limited' && result.rateLimitResetEpoch) {
    headers['X-Live-RateLimit-Reset'] = formatRateLimitResetTime(result.rateLimitResetEpoch);
  }

  // Always HTTP 200: the CDN can then shield GitHub even during a soft failure,
  // and the client decides what to do from the `ok` / `complete` fields.
  return { status: 200, headers, body };
}
