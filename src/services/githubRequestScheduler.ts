/**
 * CENTRALIZED GITHUB REST REQUEST SCHEDULER.
 *
 * Every GitHub REST API call (api.github.com) in the optimized sync
 * architecture -- profile lookup, repository inventory pagination, and one
 * recursive git-tree call per canonical repository -- should be issued
 * through `GitHubRequestScheduler#request` rather than calling `fetch`
 * directly. This does NOT change what is fetched or how many requests the
 * architecture issues; it adds:
 *
 *   - bounded global concurrency across the whole sync operation
 *   - a minimum pacing floor between request starts (burst/secondary-limit
 *     mitigation only -- it cannot restore a depleted primary quota)
 *   - centralized `x-ratelimit-*` metadata tracking, updated from every
 *     response (success or failure)
 *   - a small bounded retry for genuinely transient failures (network
 *     exceptions, selected 5xx statuses) -- never for rate-limit or
 *     deterministic 4xx responses
 *   - immediate, structured, non-retried errors when GitHub reports the
 *     primary rate limit is exhausted (429, or 403 with remaining === 0)
 *
 * Raw content requests (raw.githubusercontent.com for README/manifest
 * bodies) intentionally do NOT go through this scheduler -- they were
 * already moved off the REST/Contents API specifically to avoid consuming
 * REST quota, and must stay that way.
 */

export interface GitHubRateLimitSnapshot {
  limit: number;
  remaining: number;
  /** Epoch seconds, as reported by `x-ratelimit-reset`. */
  reset: number;
  used: number;
}

interface HeaderReader {
  get(name: string): string | null;
}

/** Parses the standard GitHub REST rate-limit response headers, if present. */
export function parseGitHubRateLimitHeaders(headers?: HeaderReader | null): GitHubRateLimitSnapshot | null {
  if (!headers || typeof headers.get !== 'function') return null;

  const limitStr = headers.get('x-ratelimit-limit');
  const remainingStr = headers.get('x-ratelimit-remaining');
  const resetStr = headers.get('x-ratelimit-reset');
  if (limitStr === null || remainingStr === null || resetStr === null) return null;

  const limit = parseInt(limitStr, 10);
  const remaining = parseInt(remainingStr, 10);
  const reset = parseInt(resetStr, 10);
  if (!Number.isFinite(limit) || !Number.isFinite(remaining) || !Number.isFinite(reset)) return null;

  const usedStr = headers.get('x-ratelimit-used');
  const parsedUsed = usedStr !== null ? parseInt(usedStr, 10) : NaN;
  const used = Number.isFinite(parsedUsed) ? parsedUsed : Math.max(0, limit - remaining);

  return { limit, remaining, reset, used };
}

/** Human-readable reset time; falls back gracefully when reset is unknown. */
export function formatRateLimitResetTime(resetEpochSeconds: number): string {
  if (!Number.isFinite(resetEpochSeconds) || resetEpochSeconds <= 0) return 'an unknown time';
  return new Date(resetEpochSeconds * 1000).toISOString();
}

export interface GitHubRequestContext {
  /** Free-form description already matching existing error context strings, e.g. `fetching git tree for "owner/repo"`. */
  operation: string;
  /** Structured `owner/repo` identifier, when the operation targets one specific repository. */
  repository?: string;
}

/**
 * Thrown immediately (no retry) when GitHub reports the PRIMARY rate limit
 * is exhausted -- either an explicit 429, or a 403 with
 * `x-ratelimit-remaining: 0`. Carries structured fields so callers (the
 * wizard UI, CLI output) can build actionable guidance without re-parsing
 * the message string.
 */
export class GitHubPrimaryRateLimitError extends Error {
  readonly limit: number;
  readonly remaining: number;
  readonly reset: number;
  readonly operation: string;
  readonly repository?: string;

  constructor(details: { limit: number; remaining: number; reset: number; operation: string; repository?: string }) {
    super(
      `GitHub API primary rate limit exhausted while ${details.operation}. ` +
      `Retry after ${formatRateLimitResetTime(details.reset)} or authenticate GitHub access.`
    );
    this.name = 'GitHubPrimaryRateLimitError';
    this.limit = details.limit;
    this.remaining = details.remaining;
    this.reset = details.reset;
    this.operation = details.operation;
    this.repository = details.repository;
  }
}

/**
 * Thrown proactively, before issuing further requests, when the scheduler's
 * last known remaining quota is already provably insufficient for the exact
 * amount of remaining REST work the caller knows it still needs (e.g. one
 * git-tree request per remaining canonical repository). This avoids
 * guaranteed-to-fail requests rather than reacting to them after the fact.
 */
export class GitHubQuotaInsufficientError extends Error {
  readonly remaining: number;
  readonly required: number;
  readonly reset: number;
  readonly operation: string;

  constructor(details: { remaining: number; required: number; reset: number; operation: string }) {
    super(
      `GitHub API primary rate limit has only ${details.remaining} request(s) remaining, ` +
      `but ${details.operation} requires at least ${details.required} more. ` +
      `Retry after ${formatRateLimitResetTime(details.reset)} or authenticate GitHub access.`
    );
    this.name = 'GitHubQuotaInsufficientError';
    this.remaining = details.remaining;
    this.required = details.required;
    this.reset = details.reset;
    this.operation = details.operation;
  }
}

export interface GitHubRequestSchedulerOptions {
  /** Maximum in-flight REST requests at once. Conservative default for setup-time sync. */
  maxConcurrency?: number;
  /** Minimum milliseconds between request STARTS, globally across the scheduler. */
  minSpacingMs?: number;
  /** Number of retry attempts for transient (network/selected-5xx) failures. Kept very small deliberately. */
  maxRetries?: number;
  /** Base delay for retry backoff; attempt N waits `retryBaseDelayMs * N` ms. */
  retryBaseDelayMs?: number;
  /** Per-attempt network timeout. */
  requestTimeoutMs?: number;
  sleepImpl?: (ms: number) => Promise<void>;
  nowImpl?: () => number;
}

export const DEFAULT_GITHUB_SCHEDULER_MAX_CONCURRENCY = 2;
export const DEFAULT_GITHUB_SCHEDULER_MIN_SPACING_MS = 120;
export const DEFAULT_GITHUB_SCHEDULER_MAX_RETRIES = 1;
export const DEFAULT_GITHUB_SCHEDULER_RETRY_BASE_DELAY_MS = 50;
export const DEFAULT_GITHUB_REQUEST_TIMEOUT_MS = 15_000;

function defaultSleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Only genuinely transient server-side statuses are retry-eligible. Rate-limit and 4xx statuses never are. */
function isRetryableStatus(status: number): boolean {
  return status === 500 || status === 502 || status === 503 || status === 504;
}

function isPrimaryRateLimitExhausted(res: Response): boolean {
  if (res.status === 429) return true;
  if (res.status === 403 && res.headers?.get?.('x-ratelimit-remaining') === '0') return true;
  return false;
}

/**
 * Centralized GitHub REST request gateway: bounded concurrency, minimum
 * pacing between request starts, rate-limit metadata tracking, and a small
 * bounded transient retry. One instance should be shared across every REST
 * call belonging to a single logical sync operation so concurrency/pacing
 * and rate-limit knowledge are global to that operation.
 */
export class GitHubRequestScheduler {
  private readonly maxConcurrency: number;
  private readonly minSpacingMs: number;
  private readonly maxRetries: number;
  private readonly retryBaseDelayMs: number;
  private readonly requestTimeoutMs: number;
  private readonly sleepImpl: (ms: number) => Promise<void>;
  private readonly nowImpl: () => number;

  private activeCount = 0;
  private lastRequestStart = -Infinity;
  private readonly queue: Array<() => void> = [];

  /** Latest known primary rate-limit snapshot, updated from every response this scheduler has seen. */
  rateLimit: GitHubRateLimitSnapshot | null = null;

  constructor(options?: GitHubRequestSchedulerOptions) {
    this.maxConcurrency = Math.max(1, options?.maxConcurrency ?? DEFAULT_GITHUB_SCHEDULER_MAX_CONCURRENCY);
    this.minSpacingMs = Math.max(0, options?.minSpacingMs ?? DEFAULT_GITHUB_SCHEDULER_MIN_SPACING_MS);
    this.maxRetries = Math.max(0, options?.maxRetries ?? DEFAULT_GITHUB_SCHEDULER_MAX_RETRIES);
    this.retryBaseDelayMs = Math.max(0, options?.retryBaseDelayMs ?? DEFAULT_GITHUB_SCHEDULER_RETRY_BASE_DELAY_MS);
    this.requestTimeoutMs = Math.max(1, options?.requestTimeoutMs ?? DEFAULT_GITHUB_REQUEST_TIMEOUT_MS);
    this.sleepImpl = options?.sleepImpl || defaultSleep;
    this.nowImpl = options?.nowImpl || (() => Date.now());
  }

  /**
   * Conservative proactive budget check: true when quota is unknown (never
   * block on an estimate we don't have) or the last known remaining quota
   * covers the exact number of additional requests the caller says it still
   * needs.
   */
  hasSufficientQuotaFor(requiredRequestCount: number): boolean {
    if (!this.rateLimit) return true;
    return this.rateLimit.remaining >= requiredRequestCount;
  }

  /** Throws GitHubQuotaInsufficientError when known-remaining quota cannot cover known-remaining work. */
  assertSufficientQuotaFor(requiredRequestCount: number, operation: string): void {
    if (this.hasSufficientQuotaFor(requiredRequestCount)) return;
    const snapshot = this.rateLimit!;
    throw new GitHubQuotaInsufficientError({
      remaining: snapshot.remaining,
      required: requiredRequestCount,
      reset: snapshot.reset,
      operation
    });
  }

  private async acquireSlot(): Promise<void> {
    if (this.activeCount < this.maxConcurrency) {
      this.activeCount++;
      return;
    }
    await new Promise<void>(resolve => this.queue.push(resolve));
    this.activeCount++;
  }

  private releaseSlot(): void {
    this.activeCount--;
    const next = this.queue.shift();
    if (next) next();
  }

  private async waitForPacingSlot(): Promise<void> {
    const elapsed = this.nowImpl() - this.lastRequestStart;
    if (elapsed < this.minSpacingMs) {
      await this.sleepImpl(this.minSpacingMs - elapsed);
    }
    this.lastRequestStart = this.nowImpl();
  }

  /**
   * Executes one GitHub REST API request under bounded concurrency and
   * pacing. Rate-limit headers are recorded from every response. A primary
   * rate-limit exhaustion response throws immediately (never retried); a
   * genuinely transient failure (network exception or selected 5xx) gets a
   * small bounded retry; every other response (including all other 4xx) is
   * returned as-is for the caller's own status handling.
   */
  async request(
    fetchImpl: typeof fetch,
    url: string,
    init: RequestInit,
    context: GitHubRequestContext
  ): Promise<Response> {
    await this.acquireSlot();
    try {
      await this.waitForPacingSlot();

      let attempt = 0;
      for (;;) {
        try {
          const controller = new AbortController();
          const upstreamSignal = init.signal;
          const abortFromUpstream = () => controller.abort(upstreamSignal?.reason);
          if (upstreamSignal?.aborted) abortFromUpstream();
          else upstreamSignal?.addEventListener('abort', abortFromUpstream, { once: true });
          const timeout = setTimeout(
            () => controller.abort(new Error(`GitHub request timed out after ${this.requestTimeoutMs}ms.`)),
            this.requestTimeoutMs
          );
          let res: Response;
          try {
            res = await fetchImpl(url, { ...init, signal: controller.signal });
          } finally {
            clearTimeout(timeout);
            upstreamSignal?.removeEventListener('abort', abortFromUpstream);
          }
          const parsedRateLimit = parseGitHubRateLimitHeaders(res.headers);
          if (parsedRateLimit) this.rateLimit = parsedRateLimit;

          if (isPrimaryRateLimitExhausted(res)) {
            const snapshot = parsedRateLimit || this.rateLimit;
            throw new GitHubPrimaryRateLimitError({
              limit: snapshot?.limit ?? 0,
              remaining: snapshot?.remaining ?? 0,
              reset: snapshot?.reset ?? 0,
              operation: context.operation,
              repository: context.repository
            });
          }

          if (!res.ok && isRetryableStatus(res.status) && attempt < this.maxRetries) {
            attempt++;
            await this.sleepImpl(this.retryBaseDelayMs * attempt);
            continue;
          }

          return res;
        } catch (err) {
          if (err instanceof GitHubPrimaryRateLimitError) throw err;
          if (init.signal?.aborted) throw err;
          if (attempt < this.maxRetries) {
            attempt++;
            await this.sleepImpl(this.retryBaseDelayMs * attempt);
            continue;
          }
          throw err;
        }
      }
    } finally {
      this.releaseSlot();
    }
  }
}
