import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type GitHubAuthMode = 'env-token' | 'github-cli' | 'anonymous';

export interface GitHubAuthResolution {
  mode: GitHubAuthMode;
  token?: string;
  authenticated: boolean;
}

export interface GitHubRateLimitInfo {
  limit: number;
  remaining: number;
  resetAt: string;
}

export interface GitHubAuthStatus {
  authMode: GitHubAuthMode;
  authenticated: boolean;
  rateLimit: GitHubRateLimitInfo | null;
}

export type ExecFileRunner = (file: string, args: string[]) => Promise<{ stdout: string; stderr: string }>;

/**
 * Resolves GitHub credentials strictly in the preferred precedence order:
 * 1. GITHUB_TOKEN / GH_TOKEN environment variable
 * 2. Authenticated GitHub CLI session (`gh auth token`)
 * 3. Anonymous fallback
 *
 * Never logs, prints, or exposes the token.
 */
export async function resolveGitHubAuth(
  options?: {
    env?: NodeJS.ProcessEnv;
    execImpl?: ExecFileRunner;
  }
): Promise<GitHubAuthResolution> {
  const env = options?.env || process.env;
  const envToken = (env.GITHUB_TOKEN || env.GH_TOKEN || '').trim();

  // 1. Preferred: Environment token
  if (envToken) {
    return {
      mode: 'env-token',
      token: envToken,
      authenticated: true
    };
  }

  // 2. Secondary: GitHub CLI session
  const runner = options?.execImpl || (execFileAsync as unknown as ExecFileRunner);
  try {
    const result = await runner('gh', ['auth', 'token']);
    const cliToken = (result.stdout || '').trim();
    if (cliToken) {
      return {
        mode: 'github-cli',
        token: cliToken,
        authenticated: true
      };
    }
  } catch {
    // Gracefully handle: gh not installed or gh not logged in
  }

  // 3. Fallback: Anonymous
  return {
    mode: 'anonymous',
    token: undefined,
    authenticated: false
  };
}

/**
 * Parses standard GitHub rate-limit HTTP headers safely.
 */
export function parseRateLimitHeaders(
  headers?: Headers | Record<string, string | string[] | undefined>
): GitHubRateLimitInfo | null {
  if (!headers) return null;

  const getHeader = (name: string): string | null => {
    if (typeof (headers as Headers).get === 'function') {
      return (headers as Headers).get(name);
    }
    const val = (headers as Record<string, string | string[] | undefined>)[name] ||
                (headers as Record<string, string | string[] | undefined>)[name.toLowerCase()];
    if (Array.isArray(val)) return val[0] || null;
    return val || null;
  };

  const limitStr = getHeader('x-ratelimit-limit');
  const remainingStr = getHeader('x-ratelimit-remaining');
  const resetStr = getHeader('x-ratelimit-reset');

  if (limitStr && remainingStr && resetStr) {
    const limit = parseInt(limitStr, 10);
    const remaining = parseInt(remainingStr, 10);
    const resetSeconds = parseInt(resetStr, 10);
    if (!isNaN(limit) && !isNaN(remaining) && !isNaN(resetSeconds)) {
      return {
        limit,
        remaining,
        resetAt: new Date(resetSeconds * 1000).toISOString()
      };
    }
  }

  return null;
}

/**
 * Queries GitHub rate-limit status safely without secret exposure.
 * GET /rate_limit does not consume rate-limit budget points.
 */
export async function fetchGitHubRateLimit(
  token?: string,
  fetchImpl?: typeof fetch
): Promise<GitHubRateLimitInfo | null> {
  const fetcher = fetchImpl || globalThis.fetch;
  try {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'systems-cartography-setup'
    };
    if (token && token.trim()) {
      headers['Authorization'] = `Bearer ${token.trim()}`;
    }

    const res = await fetcher('https://api.github.com/rate_limit', { headers });
    if (!res.ok) {
      return parseRateLimitHeaders(res.headers);
    }

    const data = await res.json() as any;
    if (data?.resources?.core) {
      const core = data.resources.core;
      return {
        limit: Number(core.limit) || 0,
        remaining: Number(core.remaining) || 0,
        resetAt: core.reset ? new Date(Number(core.reset) * 1000).toISOString() : new Date().toISOString()
      };
    }

    return parseRateLimitHeaders(res.headers);
  } catch {
    return null;
  }
}

/**
 * Resolves safe public auth and rate-limit diagnostics for the wizard UI.
 * Guaranteed to NEVER include secrets or tokens in the returned structure.
 */
export async function getGitHubAuthStatus(
  options?: {
    env?: NodeJS.ProcessEnv;
    execImpl?: ExecFileRunner;
    fetchImpl?: typeof fetch;
  }
): Promise<GitHubAuthStatus> {
  const auth = await resolveGitHubAuth(options);
  const rateLimit = await fetchGitHubRateLimit(auth.token, options?.fetchImpl);

  return {
    authMode: auth.mode,
    authenticated: auth.authenticated,
    rateLimit
  };
}
