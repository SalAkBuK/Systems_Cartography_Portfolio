import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  fetchLiveGitHubInventory,
  parseLiveInventoryResponse,
  parseLiveRepository,
  LIVE_ENDPOINT_PATH,
  MAX_LIVE_REPOSITORIES_CLIENT,
} from '../src/services/githubLiveClient.ts';

function repoPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 100,
    name: 'sample-repo',
    fullName: 'SalAkBuK/sample-repo',
    htmlUrl: 'https://github.com/SalAkBuK/sample-repo',
    homepage: 'https://sample.example.com',
    description: 'desc',
    language: 'TypeScript',
    topics: ['portfolio'],
    stars: 3,
    forks: 1,
    openIssues: 0,
    sizeKb: 500,
    archived: false,
    fork: false,
    defaultBranch: 'main',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    pushedAt: '2026-01-02T00:00:00Z',
    ownerLogin: 'SalAkBuK',
    ...overrides,
  };
}

function envelope(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ok: true,
    owner: 'salakbuk',
    complete: true,
    truncated: false,
    fetchedAt: '2026-01-03T00:00:00Z',
    authenticated: false,
    repositoryCount: 1,
    repositories: [repoPayload()],
    reason: 'ok',
    ...overrides,
  };
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

// ---------------------------------------------------------------------------
// Transport + happy path
// ---------------------------------------------------------------------------
test('a fresh 200 response is parsed and reported as transport "live"', async () => {
  let requestedUrl = '';
  const result = await fetchLiveGitHubInventory({
    fetchImpl: (async (input: RequestInfo | URL) => {
      requestedUrl = input.toString();
      return jsonResponse(envelope());
    }) as typeof fetch,
  });
  assert.equal(requestedUrl, LIVE_ENDPOINT_PATH);
  assert.equal(result.transport, 'live');
  assert.equal(result.ageSeconds, null);
  assert.equal(result.response?.ok, true);
  assert.equal(result.response?.repositories.length, 1);
});

test('an "age" header marks the payload as CDN-cached', async () => {
  const result = await fetchLiveGitHubInventory({
    fetchImpl: (async () => jsonResponse(envelope(), { headers: { age: '240', 'content-type': 'application/json' } })) as typeof fetch,
  });
  assert.equal(result.transport, 'cached');
  assert.equal(result.ageSeconds, 240);
});

test('an x-vercel-cache HIT marks the payload as CDN-cached', async () => {
  const result = await fetchLiveGitHubInventory({
    fetchImpl: (async () =>
      jsonResponse(envelope(), { headers: { 'x-vercel-cache': 'HIT', 'content-type': 'application/json' } })) as typeof fetch,
  });
  assert.equal(result.transport, 'cached');
});

// ---------------------------------------------------------------------------
// Manual reload vs automatic sync: CDN cache-key discrimination
//
// The manual reload button bypasses the browser HTTP cache but NOT the Vercel
// CDN edge cache, so it could echo a stale cached inventory (e.g. still count a
// since-deleted repo). A manual reload must therefore hit a distinct URL
// (`?refresh=<token>`) that is a fresh CDN cache key; automatic/background
// syncs must keep requesting exactly `/api/github-live` so normal visitors stay
// CDN-efficient.
// ---------------------------------------------------------------------------
function captureRequest() {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: input.toString(), init });
    return jsonResponse(envelope());
  }) as typeof fetch;
  return { calls, fetchImpl };
}

test('an automatic / background sync (bustBrowserCache: false) requests EXACTLY /api/github-live with no refresh param', async () => {
  const { calls, fetchImpl } = captureRequest();
  await fetchLiveGitHubInventory({ fetchImpl, bustBrowserCache: false });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, LIVE_ENDPOINT_PATH);
  assert.doesNotMatch(calls[0].url, /[?&]refresh=/);
  assert.equal(calls[0].init?.cache, 'default', 'automatic sync keeps the browser default cache and the CDN edge cache');
});

test('the default (no options) call is also the plain CDN-cached endpoint', async () => {
  const { calls, fetchImpl } = captureRequest();
  await fetchLiveGitHubInventory({ fetchImpl });
  assert.equal(calls[0].url, LIVE_ENDPOINT_PATH);
});

test('a manual reload (bustBrowserCache: true) requests /api/github-live?refresh=<non-empty token> and keeps GET / omit / error', async () => {
  const { calls, fetchImpl } = captureRequest();
  await fetchLiveGitHubInventory({ fetchImpl, bustBrowserCache: true, now: () => 1_700_000_000_000 });

  assert.equal(calls.length, 1);
  const url = new URL(calls[0].url, 'https://portfolio.example');
  assert.equal(url.pathname, LIVE_ENDPOINT_PATH);
  const token = url.searchParams.get('refresh');
  assert.ok(token && token.length > 0, 'refresh token must be present and non-empty');
  assert.match(token, /^1700000000000\./, 'token is derived from the injected clock');

  assert.equal(calls[0].init?.method, 'GET');
  assert.equal(calls[0].init?.credentials, 'omit');
  assert.equal(calls[0].init?.redirect, 'error');
  assert.equal(calls[0].init?.cache, 'no-cache', 'manual reload also bypasses the browser HTTP cache');
});

test('the manual reload URL carries ONLY the refresh cache-key discriminator (no owner, token, or other params)', async () => {
  const { calls, fetchImpl } = captureRequest();
  await fetchLiveGitHubInventory({ fetchImpl, bustBrowserCache: true, now: () => 42 });
  const url = new URL(calls[0].url, 'https://portfolio.example');
  assert.deepEqual([...url.searchParams.keys()], ['refresh']);
});

test('two manual reloads never reuse the same URL / CDN cache key, even at the same millisecond', async () => {
  const { calls, fetchImpl } = captureRequest();
  const frozenClock = () => 1_700_000_000_000;
  await fetchLiveGitHubInventory({ fetchImpl, bustBrowserCache: true, now: frozenClock });
  await fetchLiveGitHubInventory({ fetchImpl, bustBrowserCache: true, now: frozenClock });
  assert.equal(calls.length, 2);
  assert.notEqual(calls[0].url, calls[1].url, 'the monotonic sequence keeps same-millisecond reloads distinct');
});

test('a manual reload still parses a normal 200 payload (only the URL changes, not the response handling)', async () => {
  const result = await fetchLiveGitHubInventory({
    bustBrowserCache: true,
    fetchImpl: (async () => jsonResponse(envelope({ repositoryCount: 17 }))) as typeof fetch,
  });
  assert.equal(result.transport, 'live');
  assert.equal(result.response?.ok, true);
});

// ---------------------------------------------------------------------------
// Failure modes -> null response, never throws
// ---------------------------------------------------------------------------
test('a non-200 response resolves to a null response the caller treats as fallback', async () => {
  const result = await fetchLiveGitHubInventory({
    fetchImpl: (async () => new Response('nope', { status: 502 })) as typeof fetch,
  });
  assert.equal(result.response, null);
  assert.equal(result.transport, 'error');
  assert.match(result.error || '', /HTTP 502/);
});

test('invalid JSON resolves to a null response', async () => {
  const result = await fetchLiveGitHubInventory({
    fetchImpl: (async () => jsonResponse('{not json')) as typeof fetch,
  });
  assert.equal(result.response, null);
  assert.match(result.error || '', /invalid JSON/);
});

test('a structurally malformed envelope resolves to a null response (fail closed)', async () => {
  const result = await fetchLiveGitHubInventory({
    fetchImpl: (async () => jsonResponse({ owner: 'salakbuk', repositories: [] })) as typeof fetch,
  });
  assert.equal(result.response, null);
  assert.match(result.error || '', /malformed payload/);
});

test('a rejecting / throwing transport never propagates - it resolves to an error result', async () => {
  const rejects = await fetchLiveGitHubInventory({
    fetchImpl: (async () => {
      throw new Error('network down');
    }) as typeof fetch,
  });
  assert.equal(rejects.response, null);
  assert.equal(rejects.transport, 'error');
});

test('the browser request is abandoned at the configured timeout', async () => {
  const stalled = ((_i: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    })) as typeof fetch;
  const result = await fetchLiveGitHubInventory({ fetchImpl: stalled, timeoutMs: 20 });
  assert.equal(result.response, null);
  assert.equal(result.transport, 'error');
});

test('an already-aborted external signal short-circuits to an error result', async () => {
  const controller = new AbortController();
  controller.abort();
  const result = await fetchLiveGitHubInventory({
    signal: controller.signal,
    fetchImpl: (async () => jsonResponse(envelope())) as typeof fetch,
  });
  assert.equal(result.response, null);
});

// ---------------------------------------------------------------------------
// Defensive shape validation
// ---------------------------------------------------------------------------
test('parseLiveRepository drops entries without identity or a safe HTTPS url', () => {
  assert.equal(parseLiveRepository({ id: 0, name: 'x', ownerLogin: 'o', htmlUrl: 'https://github.com/o/x' }), null);
  assert.equal(parseLiveRepository(repoPayload({ htmlUrl: 'javascript:alert(1)' })), null);
  assert.equal(parseLiveRepository(repoPayload({ homepage: 'data:text/html,x' }))?.homepage, null);
  assert.ok(parseLiveRepository(repoPayload()));
});

test('parseLiveInventoryResponse drops malformed repositories, keeps valid ones, and bounds the count', () => {
  const parsed = parseLiveInventoryResponse(
    envelope({
      repositories: [
        repoPayload({ id: 1, name: 'a' }),
        { garbage: true },
        repoPayload({ id: 2, name: 'b', htmlUrl: 'javascript:x' }),
        repoPayload({ id: 3, name: 'c' }),
      ],
    }),
  );
  assert.ok(parsed);
  assert.equal(parsed.repositories.length, 2);
  assert.deepEqual(parsed.repositories.map((r) => r.name).sort(), ['a', 'c']);
});

test('parseLiveInventoryResponse rejects an unknown reason and a non-array repositories field', () => {
  assert.equal(parseLiveInventoryResponse(envelope({ reason: 'exfiltrate' })), null);
  assert.equal(parseLiveInventoryResponse(envelope({ repositories: 'not-an-array' })), null);
});

test('parseLiveInventoryResponse caps repositories at the client ceiling', () => {
  const many = Array.from({ length: MAX_LIVE_REPOSITORIES_CLIENT + 40 }, (_, i) => repoPayload({ id: i + 1, name: `r-${i}` }));
  const parsed = parseLiveInventoryResponse(envelope({ repositories: many }));
  assert.ok(parsed);
  assert.equal(parsed.repositories.length, MAX_LIVE_REPOSITORIES_CLIENT);
});

// ---------------------------------------------------------------------------
// Source guarantee: browser client stays lightweight
// ---------------------------------------------------------------------------
test('the browser client never imports the server core or the deep pipeline', () => {
  const src = readFileSync('src/services/githubLiveClient.ts', 'utf8');
  const importLines = src.split('\n').filter((line) => /^\s*import\s/.test(line));
  assert.ok(!importLines.some((l) => /githubLiveInventory/.test(l)), 'must not import the server core');
  assert.ok(!importLines.some((l) => /githubService|repositoryAnalyzer/.test(l)), 'must not import the deep pipeline');
});
