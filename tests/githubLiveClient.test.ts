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
