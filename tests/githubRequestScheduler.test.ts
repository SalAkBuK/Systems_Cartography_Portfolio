import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GitHubRequestScheduler,
  GitHubPrimaryRateLimitError,
  GitHubQuotaInsufficientError,
  parseGitHubRateLimitHeaders
} from '../src/services/githubRequestScheduler';
import {
  fetchRepoInspection,
  fetchGitHubUserData,
  handleGitHubHttpError,
  type GitHubRepoRaw
} from '../src/services/githubService';
import { createSetupPortfolioServer, WIZARD_SESSION_CSRF_TOKEN } from '../scripts/setup-portfolio';

/** A scheduler with no real delays -- deterministic pacing/backoff tests without sleeping. */
function makeInstantScheduler(overrides?: Partial<{ maxConcurrency: number; minSpacingMs: number; maxRetries: number; retryBaseDelayMs: number }>) {
  const sleeps: number[] = [];
  let clock = 0;
  const scheduler = new GitHubRequestScheduler({
    maxConcurrency: overrides?.maxConcurrency ?? 2,
    minSpacingMs: overrides?.minSpacingMs ?? 120,
    maxRetries: overrides?.maxRetries ?? 1,
    retryBaseDelayMs: overrides?.retryBaseDelayMs ?? 50,
    sleepImpl: async (ms: number) => { sleeps.push(ms); clock += ms; },
    nowImpl: () => clock
  });
  return { scheduler, sleeps };
}

function rateLimitHeaders(remaining: number, limit = 60, reset = 1_800_000_000, used?: number): Record<string, string> {
  return {
    'x-ratelimit-limit': String(limit),
    'x-ratelimit-remaining': String(remaining),
    'x-ratelimit-reset': String(reset),
    'x-ratelimit-used': String(used ?? limit - remaining)
  };
}

const sampleRepo: GitHubRepoRaw = {
  id: 1,
  name: 'sample',
  full_name: 'owner/sample',
  description: null,
  html_url: 'https://github.com/owner/sample',
  homepage: null,
  stargazers_count: 0,
  forks_count: 0,
  open_issues_count: 0,
  watchers_count: 0,
  language: 'TypeScript',
  topics: [],
  size: 10,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
  archived: false,
  fork: false,
  default_branch: 'main',
  license: null,
  owner: { login: 'owner', avatar_url: '', html_url: '' }
};

// ---------------------------------------------------------------------------
// 1-3. Centralized limiter: routing, concurrency, pacing
// ---------------------------------------------------------------------------

test('1. GitHub REST requests are processed through the centralized scheduler', async () => {
  const { scheduler } = makeInstantScheduler();
  let calls = 0;
  const fetchImpl = (async () => {
    calls++;
    return new Response('{}', { status: 200, headers: rateLimitHeaders(59) });
  }) as typeof fetch;

  const res = await scheduler.request(fetchImpl, 'https://api.github.com/x', {}, { operation: 'testing' });
  assert.equal(calls, 1);
  assert.equal(res.status, 200);
  assert.equal(scheduler.rateLimit?.remaining, 59);
});

test('2. maximum configured concurrency is respected', async () => {
  const { scheduler } = makeInstantScheduler({ maxConcurrency: 2, minSpacingMs: 0 });
  let active = 0;
  let maxActive = 0;
  const resolvers: Array<() => void> = [];

  const fetchImpl = (() => new Promise<Response>(resolve => {
    active++;
    maxActive = Math.max(maxActive, active);
    resolvers.push(() => {
      active--;
      resolve(new Response('{}', { status: 200 }));
    });
  })) as unknown as typeof fetch;

  const requests = Array.from({ length: 5 }, (_, i) =>
    scheduler.request(fetchImpl, `https://api.github.com/${i}`, {}, { operation: 'testing' })
  );

  // Let the microtask queue settle so all eligible starts have fired.
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(maxActive, 2, 'no more than maxConcurrency requests should be in flight at once');

  while (resolvers.length > 0) {
    resolvers.shift()!();
    await new Promise(resolve => setImmediate(resolve));
  }

  await Promise.all(requests);
  assert.equal(maxActive, 2);
});

test('3. pacing enforces minimum spacing between request starts, verified via injected clock/sleep (no real waiting)', async () => {
  const { scheduler, sleeps } = makeInstantScheduler({ maxConcurrency: 1, minSpacingMs: 120, maxRetries: 0 });
  const fetchImpl = (async () => new Response('{}', { status: 200 })) as typeof fetch;

  await scheduler.request(fetchImpl, 'https://api.github.com/a', {}, { operation: 'first' });
  await scheduler.request(fetchImpl, 'https://api.github.com/b', {}, { operation: 'second' });
  await scheduler.request(fetchImpl, 'https://api.github.com/c', {}, { operation: 'third' });

  // First request never waits (no prior request); subsequent ones wait the full spacing floor
  // because the injected clock only advances via recorded sleeps.
  assert.deepEqual(sleeps, [120, 120]);
});

// ---------------------------------------------------------------------------
// 4-6. Rate-limit header parsing & metadata
// ---------------------------------------------------------------------------

test('4. rate-limit headers are parsed correctly', () => {
  const headers = new Headers(rateLimitHeaders(42, 60, 1_800_000_000, 18));
  const parsed = parseGitHubRateLimitHeaders(headers);
  assert.deepEqual(parsed, { limit: 60, remaining: 42, reset: 1_800_000_000, used: 18 });
});

test('4b. rate-limit headers missing required fields parse as null', () => {
  assert.equal(parseGitHubRateLimitHeaders(new Headers({})), null);
  assert.equal(parseGitHubRateLimitHeaders(undefined), null);
});

test('5. remaining: 0 produces a structured primary-rate-limit error', async () => {
  const { scheduler } = makeInstantScheduler();
  const fetchImpl = (async () => new Response('rate limited', {
    status: 403,
    headers: rateLimitHeaders(0, 60, 1_800_000_000)
  })) as typeof fetch;

  await assert.rejects(
    scheduler.request(fetchImpl, 'https://api.github.com/x', {}, { operation: 'fetching git tree for "owner/repo"', repository: 'owner/repo' }),
    (err: unknown) => {
      assert.ok(err instanceof GitHubPrimaryRateLimitError);
      assert.equal(err.limit, 60);
      assert.equal(err.remaining, 0);
      assert.equal(err.repository, 'owner/repo');
      assert.match(err.message, /GitHub API primary rate limit exhausted while fetching git tree for "owner\/repo"/);
      return true;
    }
  );
});

test('6. reset timestamp is preserved and reported on the structured error', async () => {
  const { scheduler } = makeInstantScheduler();
  const resetEpoch = 1_900_000_000;
  const fetchImpl = (async () => new Response('rate limited', {
    status: 429,
    headers: rateLimitHeaders(0, 60, resetEpoch)
  })) as typeof fetch;

  await assert.rejects(
    scheduler.request(fetchImpl, 'https://api.github.com/x', {}, { operation: 'fetching GitHub profile for "@owner"' }),
    (err: unknown) => {
      assert.ok(err instanceof GitHubPrimaryRateLimitError);
      assert.equal(err.reset, resetEpoch);
      assert.match(err.message, new RegExp(new Date(resetEpoch * 1000).toISOString().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      return true;
    }
  );
});

// ---------------------------------------------------------------------------
// 7-9. Retry policy
// ---------------------------------------------------------------------------

test('7. primary-rate-limit exhaustion is NOT immediately retried', async () => {
  const { scheduler } = makeInstantScheduler({ maxRetries: 2 });
  let calls = 0;
  const fetchImpl = (async () => {
    calls++;
    return new Response('rate limited', { status: 403, headers: rateLimitHeaders(0) });
  }) as typeof fetch;

  await assert.rejects(scheduler.request(fetchImpl, 'https://api.github.com/x', {}, { operation: 'testing' }));
  assert.equal(calls, 1, 'a rate-limit-exhausted response must never be retried, even with retries configured');
});

test('8. a transient eligible failure (503) can retry with bounded backoff', async () => {
  const { scheduler, sleeps } = makeInstantScheduler({ maxRetries: 1, retryBaseDelayMs: 50 });
  let calls = 0;
  const fetchImpl = (async () => {
    calls++;
    if (calls === 1) return new Response('server error', { status: 503 });
    return new Response('{}', { status: 200, headers: rateLimitHeaders(59) });
  }) as typeof fetch;

  const res = await scheduler.request(fetchImpl, 'https://api.github.com/x', {}, { operation: 'testing' });
  assert.equal(calls, 2, 'exactly one retry attempt should occur');
  assert.equal(res.status, 200);
  assert.ok(sleeps.includes(50), 'backoff delay should have been applied before the retry');
});

test('8b. a transient failure that exhausts retries still surfaces the final response', async () => {
  const { scheduler } = makeInstantScheduler({ maxRetries: 1 });
  let calls = 0;
  const fetchImpl = (async () => {
    calls++;
    return new Response('still down', { status: 502 });
  }) as typeof fetch;

  const res = await scheduler.request(fetchImpl, 'https://api.github.com/x', {}, { operation: 'testing' });
  assert.equal(calls, 2, 'one initial attempt plus exactly one retry, then give up');
  assert.equal(res.status, 502);
});

test('9. a deterministic 404 is not repeatedly retried', async () => {
  const { scheduler } = makeInstantScheduler({ maxRetries: 2 });
  let calls = 0;
  const fetchImpl = (async () => {
    calls++;
    return new Response('not found', { status: 404 });
  }) as typeof fetch;

  const res = await scheduler.request(fetchImpl, 'https://api.github.com/x', {}, { operation: 'testing' });
  assert.equal(calls, 1, '404 is deterministic and must never be retried');
  assert.equal(res.status, 404);
});

test('9b. plain 403 (non-rate-limit) is returned as-is for handleGitHubHttpError without retry', async () => {
  const { scheduler } = makeInstantScheduler({ maxRetries: 2 });
  let calls = 0;
  const fetchImpl = (async () => {
    calls++;
    return new Response('forbidden', { status: 403, headers: rateLimitHeaders(500) });
  }) as typeof fetch;

  const res = await scheduler.request(fetchImpl, 'https://api.github.com/x', {}, { operation: 'testing plain 403' });
  assert.equal(calls, 1);
  assert.throws(
    () => handleGitHubHttpError(res, 'testing plain 403'),
    /GitHub API request forbidden\/rejected while testing plain 403/
  );
});

// ---------------------------------------------------------------------------
// 10. Raw content fetches never touch the REST scheduler
// ---------------------------------------------------------------------------

test('10. raw GitHub README/manifest fetches do not consume REST quota (scheduler sees exactly one REST call per repo)', async () => {
  const { scheduler } = makeInstantScheduler();
  let restCalls = 0;
  let rawCalls = 0;

  const restFetch = (async () => {
    restCalls++;
    return new Response(JSON.stringify({
      truncated: false,
      tree: [{ path: 'README.md', type: 'blob' }, { path: 'package.json', type: 'blob' }]
    }), { status: 200, headers: rateLimitHeaders(59) });
  }) as typeof fetch;

  const rawFetch = (async (input: RequestInfo | URL) => {
    rawCalls++;
    const url = input.toString();
    return new Response(url.endsWith('/README.md') ? '# Hello' : '{}', { status: 200 });
  }) as typeof fetch;

  await fetchRepoInspection('owner', 'repo', 'main', { fetchImpl: restFetch, rawFetchImpl: rawFetch, scheduler });

  assert.equal(restCalls, 1, 'exactly one REST call (the git tree) per repository');
  assert.equal(rawCalls, 2, 'README + package.json both fetched from the raw host, outside the REST scheduler');
  assert.equal(scheduler.rateLimit?.remaining, 59, 'rate-limit tracking reflects only the REST call');
});

// ---------------------------------------------------------------------------
// 12-13. Realistic anonymous-quota simulation (the reported real-world scenario)
// ---------------------------------------------------------------------------

function buildRepos(owner: string, count: number): GitHubRepoRaw[] {
  return Array.from({ length: count }, (_, i) => ({
    ...sampleRepo,
    id: i + 1,
    name: `repo-${i + 1}`,
    full_name: `${owner}/repo-${i + 1}`,
    html_url: `https://github.com/${owner}/repo-${i + 1}`,
    owner: { ...sampleRepo.owner, login: owner }
  }));
}

function makeQuotaTrackingFetch(owner: string, repos: GitHubRepoRaw[], startingRemaining: number, limit = 60) {
  let remaining = startingRemaining;
  const restCalls: string[] = [];
  const fetchImpl = (async (input: RequestInfo | URL) => {
    const url = input.toString();
    restCalls.push(url);
    remaining = Math.max(0, remaining - 1);
    const headers = rateLimitHeaders(remaining, limit);
    if (remaining === 0 && restCalls.length > 0) {
      // The request that would exceed budget: GitHub returns 403 once truly exhausted.
    }
    if (url.includes(`/users/${owner}/repos`)) return new Response(JSON.stringify(repos), { status: 200, headers });
    if (url.includes(`/users/${owner}`)) return new Response(JSON.stringify({ login: owner, public_repos: repos.length }), { status: 200, headers });
    if (url.includes('/git/trees/')) return new Response(JSON.stringify({
      truncated: false,
      tree: [{ path: 'README.md', type: 'blob' }]
    }), { status: 200, headers });
    return new Response('Not Found', { status: 404, headers });
  }) as typeof fetch;
  const rawFetch = (async () => new Response('# Repository', { status: 200 })) as typeof fetch;
  return { fetchImpl, rawFetch, restCalls: () => restCalls };
}

test('12. a simulated 33-repository anonymous sync with a fresh 60-request quota completes within the optimized architecture', async () => {
  const owner = 'hafsah1976';
  const repos = buildRepos(owner, 33);
  const { fetchImpl, rawFetch, restCalls } = makeQuotaTrackingFetch(owner, repos, 60);
  const { scheduler, sleeps } = makeInstantScheduler({ maxConcurrency: 2, minSpacingMs: 1 });

  const result = await fetchGitHubUserData(owner, { fetchImpl, rawFetchImpl: rawFetch, scheduler });

  assert.equal(result.projects.length, 33);
  // 1 (user) + 1 (repos page) + 33 (one tree per repo) = 35 REST requests.
  assert.equal(restCalls().length, 35);
  assert.equal(scheduler.rateLimit?.remaining, 60 - 35, 'ends with the expected remaining budget (~25/60, matching the real-world report)');
  assert.ok(sleeps.length > 0, 'pacing was applied between request starts');
});

test('13. a partially consumed quota fails cleanly and proactively when remaining budget is insufficient', async () => {
  const owner = 'hafsah1976';
  const repos = buildRepos(owner, 17);
  // Only 8 requests remain after discovery's 2 calls would already have been spent down to 8;
  // start remaining at 10 so discovery leaves exactly 8, well short of the 17 required tree calls.
  const { fetchImpl, rawFetch, restCalls } = makeQuotaTrackingFetch(owner, repos, 10);
  const { scheduler } = makeInstantScheduler({ maxConcurrency: 2, minSpacingMs: 0 });

  await assert.rejects(
    fetchGitHubUserData(owner, { fetchImpl, rawFetchImpl: rawFetch, scheduler }),
    (err: unknown) => {
      assert.ok(err instanceof GitHubQuotaInsufficientError);
      assert.equal(err.remaining, 8);
      assert.equal(err.required, 17);
      return true;
    }
  );
  // Only the 2 discovery calls should have happened -- zero of the 17 doomed tree requests were issued.
  assert.equal(restCalls().length, 2, 'proactive stop must occur before issuing any of the guaranteed-to-fail tree requests');
});

// ---------------------------------------------------------------------------
// 14-15. Wizard-level atomicity & recovery
// ---------------------------------------------------------------------------

async function listen(server: ReturnType<typeof createSetupPortfolioServer>): Promise<number> {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  return (server.address() as { port: number }).port;
}
async function close(server: ReturnType<typeof createSetupPortfolioServer>): Promise<void> {
  await new Promise<void>((resolve, reject) => server.close(err => (err ? reject(err) : resolve())));
}

test('14. a failed rate-limited sync does not persist a partial snapshot, set githubSyncedThisSession, or bind the owner profile', async () => {
  const owner = 'hafsah1976';
  const fetchImpl = (async () => new Response('rate limited', {
    status: 403,
    headers: rateLimitHeaders(0)
  })) as typeof fetch;

  const freshProfile: any = {
    source: { kind: 'linkedin_pdf', importedAt: '', reviewed: true, warnings: [] },
    githubTarget: '',
    operator: { name: 'Hafsah Nasreen', role: 'Engineer', location: '', focus: '', primaryStack: [], systemManifesto: '', contact: { email: '', linkedin: '' } },
    experience: [],
    skills: [],
    certifications: [],
    education: []
  };

  const server = createSetupPortfolioServer({
    persistToDisk: false,
    initialStateOverrides: { ownerProfile: freshProfile },
    repositoryIdentityResolver: () => ({
      identity: { owner, name: 'Systems_Cartography_Portfolio' },
      source: 'git-origin'
    }),
    fetchImpl
  });
  const port = await listen(server);
  try {
    const sync = await fetch(`http://127.0.0.1:${port}/api/sync-github`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Setup-CSRF-Token': WIZARD_SESSION_CSRF_TOKEN },
      body: JSON.stringify({ githubTarget: owner })
    });
    assert.equal(sync.status >= 400, true);
    const syncData = await sync.json();
    assert.match(syncData.error, /rate limit/i);

    const state = await fetch(`http://127.0.0.1:${port}/api/state`);
    const stateData = await state.json();
    assert.equal(stateData.confirmedGitHub, '', 'failed sync must not establish a confirmed target');
    assert.equal(stateData.ownerProfile.githubTarget, '', 'failed sync must not bind the owner profile');
    assert.equal(stateData.snapshot.projects.length, 0, 'failed sync must not persist a partial snapshot as authoritative');

    const session = await fetch(`http://127.0.0.1:${port}/api/session`);
    const sessionData = await session.json();
    assert.equal(sessionData.existingSetup, false);
  } finally {
    await close(server);
  }
});

test('15. a successful retry after a simulated reset completes normally and binds the profile', async () => {
  const owner = 'hafsah1976';
  const freshProfile: any = {
    source: { kind: 'linkedin_pdf', importedAt: '', reviewed: true, warnings: [] },
    githubTarget: '',
    operator: { name: 'Hafsah Nasreen', role: 'Engineer', location: '', focus: '', primaryStack: [], systemManifesto: '', contact: { email: '', linkedin: '' } },
    experience: [],
    skills: [],
    certifications: [],
    education: []
  };

  // Simulate: first attempt exhausted, second attempt (post-reset) succeeds.
  // Each /api/sync-github call constructs its own fresh scheduler internally,
  // exactly mirroring two separate real-world attempts across a reset window.
  let attempt = 0;
  const fetchImpl = (async (input: RequestInfo | URL) => {
    const url = input.toString();
    if (attempt === 0) {
      return new Response('rate limited', { status: 403, headers: rateLimitHeaders(0) });
    }
    if (url.includes(`/users/${owner}/repos`)) {
      return new Response(JSON.stringify(buildRepos(owner, 2)), { status: 200, headers: rateLimitHeaders(57) });
    }
    if (url.includes(`/users/${owner}`)) {
      return new Response(JSON.stringify({ login: owner, public_repos: 2 }), { status: 200, headers: rateLimitHeaders(58) });
    }
    if (url.includes('/git/trees/')) {
      return new Response(JSON.stringify({ truncated: false, tree: [] }), { status: 200, headers: rateLimitHeaders(56) });
    }
    return new Response('Not Found', { status: 404 });
  }) as typeof fetch;

  const server = createSetupPortfolioServer({
    persistToDisk: false,
    initialStateOverrides: { ownerProfile: freshProfile },
    repositoryIdentityResolver: () => ({
      identity: { owner, name: 'Systems_Cartography_Portfolio' },
      source: 'git-origin'
    }),
    fetchImpl
  });
  const port = await listen(server);
  try {
    const firstSync = await fetch(`http://127.0.0.1:${port}/api/sync-github`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Setup-CSRF-Token': WIZARD_SESSION_CSRF_TOKEN },
      body: JSON.stringify({ githubTarget: `https://github.com/${owner}` })
    });
    assert.equal(firstSync.status >= 400, true);

    attempt = 1;
    const secondSync = await fetch(`http://127.0.0.1:${port}/api/sync-github`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Setup-CSRF-Token': WIZARD_SESSION_CSRF_TOKEN },
      body: JSON.stringify({ githubTarget: `https://github.com/${owner}` })
    });
    assert.equal(secondSync.status, 200);

    const state = await fetch(`http://127.0.0.1:${port}/api/state`);
    const stateData = await state.json();
    assert.equal(stateData.confirmedGitHub, `https://github.com/${owner}`);
    assert.equal(stateData.ownerProfile.githubTarget, `https://github.com/${owner}`, 'successful shorthand sync binds the canonical profile URL');
    assert.equal(stateData.snapshot.projects.length, 2);
  } finally {
    await close(server);
  }
});
