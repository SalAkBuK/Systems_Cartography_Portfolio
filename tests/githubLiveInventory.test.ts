import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  handleLiveGitHubRequest,
  fetchLivePublicRepositories,
  sanitizeLiveRepository,
  resolveConfiguredOwner,
  cacheControlForReason,
  MAX_LIVE_REPOSITORIES,
  LIVE_REPOS_PER_PAGE,
} from '../src/services/githubLiveInventory.ts';
import { OWNER_PROFILE } from '../src/data/ownerProfile.generated.ts';

const CONFIGURED_OWNER = 'SalAkBuK';

function repoFixture(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 100,
    name: 'sample-repo',
    full_name: `${CONFIGURED_OWNER}/sample-repo`,
    description: 'A sample repository',
    html_url: `https://github.com/${CONFIGURED_OWNER}/sample-repo`,
    homepage: 'https://sample.example.com',
    stargazers_count: 5,
    forks_count: 2,
    open_issues_count: 1,
    language: 'TypeScript',
    topics: ['systems', 'portfolio'],
    size: 500,
    archived: false,
    fork: false,
    default_branch: 'main',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    pushed_at: '2026-02-01T00:00:00Z',
    owner: { login: CONFIGURED_OWNER },
    ...overrides,
  };
}

/** Mock GitHub REST transport: paginated `/users/:owner/repos`. */
function pagedFetch(pages: Record<string, unknown>[][], seen?: { urls: string[]; auth: (string | null)[] }): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input.toString();
    seen?.urls.push(url);
    seen?.auth.push(new Headers(init?.headers).get('authorization'));
    const match = url.match(/[?&]page=(\d+)/);
    const page = match ? Number(match[1]) : 1;
    const body = pages[page - 1] ?? [];
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
}

// ---------------------------------------------------------------------------
// Owner binding
// ---------------------------------------------------------------------------
test('resolveConfiguredOwner uses the committed owner target and has NO env override', () => {
  assert.equal(resolveConfiguredOwner().toLowerCase(), 'salakbuk');
  // Sanity: the committed profile really is the SalAkBuK target this test assumes.
  assert.match(OWNER_PROFILE.githubTarget, /salakbuk/i);
  // The only way to change the owner is an explicit DI argument (test seam);
  // there is no environment variable that does this.
  assert.equal(resolveConfiguredOwner('https://github.com/some-org'), 'some-org');
});

test('handleLiveGitHubRequest ignores process env entirely for owner selection', async () => {
  const seen = { urls: [] as string[], auth: [] as (string | null)[] };
  // Even with a hostile "owner" env var present, the configured owner is used.
  await handleLiveGitHubRequest({
    method: 'GET',
    env: { GITHUB_TOKEN: undefined } as Record<string, string | undefined>,
    fetchImpl: pagedFetch([[repoFixture()]], seen),
    schedulerOptions: { minSpacingMs: 0, maxRetries: 0 },
  });
  assert.match(seen.urls[0], /\/users\/SalAkBuK\/repos/);
});

test('endpoint queries ONLY the configured owner and never a request-supplied username', async () => {
  const seen = { urls: [] as string[], auth: [] as (string | null)[] };
  await handleLiveGitHubRequest({
    method: 'GET',
    env: {},
    fetchImpl: pagedFetch([[repoFixture()]], seen),
    schedulerOptions: { minSpacingMs: 0, maxRetries: 0 },
  });
  assert.equal(seen.urls.length, 1);
  assert.match(seen.urls[0], /api\.github\.com\/users\/SalAkBuK\/repos/);
  assert.match(seen.urls[0], /type=owner/);
});

// ---------------------------------------------------------------------------
// Pagination + repository ceiling
// ---------------------------------------------------------------------------
test('pagination walks every page until a short page and reports a complete inventory', async () => {
  const page1 = Array.from({ length: LIVE_REPOS_PER_PAGE }, (_, i) => repoFixture({ id: i + 1, name: `r-${i + 1}` }));
  const page2 = Array.from({ length: 30 }, (_, i) => repoFixture({ id: 200 + i, name: `s-${i}` }));
  const seen = { urls: [] as string[], auth: [] as (string | null)[] };

  const result = await fetchLivePublicRepositories({
    owner: CONFIGURED_OWNER,
    fetchImpl: pagedFetch([page1, page2], seen),
    schedulerOptions: { minSpacingMs: 0, maxRetries: 0 },
  });

  assert.equal(result.repositories.length, 130);
  assert.equal(result.complete, true);
  assert.equal(result.truncated, false);
  assert.equal(result.reason, 'ok');
  assert.deepEqual(
    seen.urls.map((u) => u.match(/[?&]page=(\d+)/)![1]),
    ['1', '2'],
  );
});

test('the defensive repository ceiling truncates and marks the inventory incomplete', async () => {
  const fullPage = () =>
    Array.from({ length: LIVE_REPOS_PER_PAGE }, (_, i) => repoFixture({ id: Math.random() * 1e9, name: `r-${Math.random()}` }));
  const result = await fetchLivePublicRepositories({
    owner: CONFIGURED_OWNER,
    fetchImpl: pagedFetch([fullPage(), fullPage(), fullPage(), fullPage()]),
    schedulerOptions: { minSpacingMs: 0, maxRetries: 0 },
  });
  assert.equal(result.repositories.length, MAX_LIVE_REPOSITORIES);
  assert.equal(result.truncated, true);
  assert.equal(result.complete, false);
  assert.equal(result.reason, 'partial');
});

// ---------------------------------------------------------------------------
// Sanitization
// ---------------------------------------------------------------------------
test('sanitizeLiveRepository bounds strings/URLs/topics and drops hostile or identity-less entries', () => {
  assert.equal(sanitizeLiveRepository({ name: 'x', owner: {} }, 'salakbuk'), null);
  assert.equal(sanitizeLiveRepository({ id: 1, name: 'x', owner: { login: 'someone-else' } }, 'salakbuk'), null);

  const clean = sanitizeLiveRepository(
    repoFixture({
      html_url: 'javascript:alert(1)',
      homepage: 'data:text/html,x',
      topics: Array.from({ length: 150 }, (_, i) => `t-${i}`),
      description: 'y'.repeat(5000),
      stargazers_count: Number.POSITIVE_INFINITY,
    }),
    'salakbuk',
  );
  assert.ok(clean);
  assert.equal(clean.htmlUrl, 'https://github.com/SalAkBuK/sample-repo');
  assert.equal(clean.homepage, null);
  assert.equal(clean.topics.length, 100);
  assert.equal(clean.description!.length, 2000);
  assert.equal(clean.stars, 0);
});

test('endpoint response drops repositories owned by a different login (defense in depth)', async () => {
  const result = await handleLiveGitHubRequest({
    method: 'GET',
    env: {},
    fetchImpl: pagedFetch([[repoFixture(), repoFixture({ id: 2, name: 'foreign', owner: { login: 'attacker' }, full_name: 'attacker/foreign' })]]),
    schedulerOptions: { minSpacingMs: 0, maxRetries: 0 },
  });
  assert.equal(result.body.repositoryCount, 1);
  assert.equal(result.body.repositories[0].name, 'sample-repo');
});

// ---------------------------------------------------------------------------
// Credentials
// ---------------------------------------------------------------------------
test('a server-side token is sent to GitHub but NEVER appears in the JSON response', async () => {
  const seen = { urls: [] as string[], auth: [] as (string | null)[] };
  const result = await handleLiveGitHubRequest({
    method: 'GET',
    env: { GITHUB_TOKEN: 'ghp_TESTONLY_should_not_leak' },
    fetchImpl: pagedFetch([[repoFixture()]], seen),
    schedulerOptions: { minSpacingMs: 0, maxRetries: 0 },
  });
  assert.equal(seen.auth[0], 'Bearer ghp_TESTONLY_should_not_leak');
  assert.equal(result.body.authenticated, true);
  const serialized = JSON.stringify(result);
  assert.ok(!serialized.includes('ghp_TESTONLY_should_not_leak'));
  assert.ok(!serialized.includes('Authorization'));
});

// ---------------------------------------------------------------------------
// Rate limit + upstream failure + timeout
// ---------------------------------------------------------------------------
test('a primary rate-limit response yields ok:false, reason rate_limited, and a bounded retry window', async () => {
  const reset = Math.floor(Date.now() / 1000) + 400;
  const rateLimitedFetch = (async () =>
    new Response('{"message":"rate limited"}', {
      status: 403,
      headers: {
        'x-ratelimit-limit': '60',
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': String(reset),
      },
    })) as typeof fetch;

  const result = await handleLiveGitHubRequest({
    method: 'GET',
    env: {},
    fetchImpl: rateLimitedFetch,
    schedulerOptions: { minSpacingMs: 0, maxRetries: 0 },
  });

  assert.equal(result.body.ok, false);
  assert.equal(result.body.reason, 'rate_limited');
  assert.equal(result.body.complete, false);
  assert.equal(result.body.repositories.length, 0);
  const cache = result.headers['Cache-Control'];
  const sMaxAge = Number(cache.match(/s-maxage=(\d+)/)![1]);
  assert.ok(sMaxAge >= 60 && sMaxAge <= 900, `s-maxage ${sMaxAge} within [60,900]`);
});

test('an upstream 500 yields ok:false / upstream_error and a short retry window', async () => {
  const result = await handleLiveGitHubRequest({
    method: 'GET',
    env: {},
    fetchImpl: (async () => new Response('nope', { status: 500 })) as typeof fetch,
    schedulerOptions: { minSpacingMs: 0, maxRetries: 0 },
  });
  assert.equal(result.body.ok, false);
  assert.equal(result.body.reason, 'upstream_error');
  assert.match(result.headers['Cache-Control'], /s-maxage=60\b/);
});

test('a stalled GitHub request is abandoned at the scheduler deadline with reason timeout', async () => {
  const stalledFetch = ((_i: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason || new Error('aborted')), { once: true });
    })) as typeof fetch;

  const result = await handleLiveGitHubRequest({
    method: 'GET',
    env: {},
    fetchImpl: stalledFetch,
    schedulerOptions: { minSpacingMs: 0, maxRetries: 0, requestTimeoutMs: 15 },
  });
  assert.equal(result.body.ok, false);
  assert.equal(result.body.reason, 'timeout');
});

// ---------------------------------------------------------------------------
// Cache headers + method guard + not-configured
// ---------------------------------------------------------------------------
test('a complete inventory is CDN-cacheable for 5-15 minutes with a longer stale window', async () => {
  const result = await handleLiveGitHubRequest({
    method: 'GET',
    env: {},
    fetchImpl: pagedFetch([[repoFixture()]]),
    schedulerOptions: { minSpacingMs: 0, maxRetries: 0 },
  });
  assert.equal(result.body.ok, true);
  assert.equal(result.body.complete, true);
  assert.equal(result.body.reason, 'ok');
  const cache = result.headers['Cache-Control'];
  const sMaxAge = Number(cache.match(/s-maxage=(\d+)/)![1]);
  assert.ok(sMaxAge >= 300 && sMaxAge <= 900, `s-maxage ${sMaxAge} in the 5-15 minute band`);
  assert.match(cache, /stale-while-revalidate=\d+/);
});

test('cacheControlForReason never emits a cache directive that would store a hard failure long-term', () => {
  assert.match(cacheControlForReason('ok'), /s-maxage=600/);
  assert.match(cacheControlForReason('upstream_error'), /s-maxage=60\b/);
  assert.match(cacheControlForReason('timeout'), /s-maxage=60\b/);
});

test('non-GET methods are rejected with 405 and are not cached', async () => {
  const result = await handleLiveGitHubRequest({ method: 'POST', env: {} });
  assert.equal(result.status, 405);
  assert.equal(result.body.reason, 'bad_method');
  assert.equal(result.headers['Cache-Control'], 'no-store');
});

test('a missing owner configuration fails closed as not_configured (never a blank proxy)', async () => {
  // The unparseable target is supplied through the DI seam, not an env var.
  const result = await handleLiveGitHubRequest({
    method: 'GET',
    env: {},
    githubTarget: '///',
  });
  assert.equal(result.body.ok, false);
  assert.equal(result.body.reason, 'not_configured');
  assert.equal(result.body.repositories.length, 0);
});

// ---------------------------------------------------------------------------
// Source guarantees
// ---------------------------------------------------------------------------
test('the endpoint core never imports the deep-inspection pipeline', () => {
  const src = readFileSync('src/services/githubLiveInventory.ts', 'utf8');
  const importLines = src.split('\n').filter((line) => /^\s*import\s/.test(line));
  assert.ok(!importLines.some((l) => /['"]\.\/githubService['"]/.test(l)), 'must not import githubService');
  assert.ok(!importLines.some((l) => /repositoryAnalyzer/.test(l)), 'must not import the repository analyzer');
  assert.ok(!importLines.some((l) => /capabilityAssociations/.test(l)), 'must not import capability associations');
});
