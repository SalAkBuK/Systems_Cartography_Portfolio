import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { ProjectData } from '../src/types.ts';
import type { LiveInventoryResponse, LiveRepository } from '../src/services/githubLiveTypes.ts';
import { reconcileLiveRepositories } from '../src/utils/reconcileLiveRepositories.ts';
import { resolveLiveRepositoryCount } from '../src/hooks/useLiveGitHubInventory.ts';
import { formatLiveInventoryCounts } from '../src/components/TopTelemetryBar.tsx';
import { GITHUB_SNAPSHOT } from '../src/data/githubSnapshot.generated.ts';

// Regression coverage for a misleading telemetry label:
//
// The header read "17 REPOS" while the configured owner has 18 public
// repositories. The frontend hook exposed `repositoryCount: projects.length` —
// the RENDERED project count after reconciliation/filtering — under a name that
// claims to be the raw live repository count. The live API response already
// carries the real number (`LiveInventoryResponse.repositoryCount` =
// `result.repositories.length`).
//
// Fix: the hook now exposes TWO clearly-named values —
//   liveRepositoryCount : number | null  (raw live inventory count; null until
//                                         a live/cached payload has succeeded)
//   renderedProjectCount: number         (always projects.length)
// — and the telemetry bar shows both: "18 REPOS // 17 PROJECTS".

const OWNER_TARGET = 'https://github.com/SalAkBuK';

const hookSrc = readFileSync('src/hooks/useLiveGitHubInventory.ts', 'utf8');
const appSrc = readFileSync('src/App.tsx', 'utf8');
const telemetrySrc = readFileSync('src/components/TopTelemetryBar.tsx', 'utf8');

function liveRepo(overrides: Partial<LiveRepository> = {}): LiveRepository {
  const name = overrides.name ?? 'sample-repo';
  const ownerLogin = overrides.ownerLogin ?? 'SalAkBuK';
  return {
    id: 100,
    name,
    fullName: `${ownerLogin}/${name}`,
    htmlUrl: `https://github.com/${ownerLogin}/${name}`,
    homepage: null,
    description: 'short github blurb',
    language: 'TypeScript',
    topics: [],
    stars: 1,
    forks: 0,
    openIssues: 0,
    sizeKb: 800,
    archived: false,
    fork: false,
    defaultBranch: 'main',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
    pushedAt: '2026-06-02T00:00:00Z',
    ownerLogin,
    ...overrides,
  };
}

function inventory(
  repositories: LiveRepository[],
  overrides: Partial<LiveInventoryResponse> = {},
): LiveInventoryResponse {
  return {
    ok: true,
    owner: 'salakbuk',
    complete: true,
    truncated: false,
    fetchedAt: '2026-06-03T00:00:00Z',
    authenticated: false,
    // Parity with the client parser: repositoryCount === repositories.length.
    repositoryCount: repositories.length,
    repositories,
    reason: 'ok',
    ...overrides,
  };
}

/** The snapshot's committed projects, each carrying its stable `gh-<id>`. */
const snapshotProjects: ProjectData[] = GITHUB_SNAPSHOT.projects;

/** One live repo per snapshot project, matched by GitHub numeric id. */
function liveReposMatchingSnapshot(): LiveRepository[] {
  return snapshotProjects.map((project) => {
    const numericId = Number((project.id || '').replace(/^gh-/, ''));
    return liveRepo({ id: numericId, name: project.title, ownerLogin: 'SalAkBuK', sizeKb: 500 });
  });
}

// ---------------------------------------------------------------------------
// 1. Behavioral proof: 18 live repos -> 17 rendered projects, two distinct
//    numbers with two distinct sources.
// ---------------------------------------------------------------------------
test('a live payload of N+1 repositories reconciles to N projects, and the two counts have independent sources', () => {
  const snapshotCount = snapshotProjects.length;

  // N matched repos + 1 fork (forks are never promoted to projects — parity
  // with the snapshot generator).
  const liveRepos = [
    ...liveReposMatchingSnapshot(),
    liveRepo({ id: 999000001, name: 'a-fork', fork: true }),
  ];
  const response = inventory(liveRepos);

  const reconciled = reconcileLiveRepositories(snapshotProjects, response, {
    configuredGithubTarget: OWNER_TARGET,
  });

  assert.equal(reconciled.stats.applied, true, 'the complete, owner-matched payload is applied');

  // Raw live repository count: straight from the response envelope.
  assert.equal(response.repositoryCount, snapshotCount + 1, 'the live payload reports one more repo than renders');
  assert.equal(liveRepos.length, snapshotCount + 1);

  // Rendered project count: the reconciliation output length.
  assert.equal(reconciled.projects.length, snapshotCount, 'the fork is filtered — one fewer project than repos');

  // The hook derivation keeps them apart.
  const liveRepositoryCount = resolveLiveRepositoryCount(null, reconciled.stats.applied, response);
  const renderedProjectCount = reconciled.projects.length;
  assert.equal(liveRepositoryCount, snapshotCount + 1);
  assert.equal(renderedProjectCount, snapshotCount);
  assert.notEqual(liveRepositoryCount, renderedProjectCount, 'the two telemetry numbers must not collapse into one');
});

test('with the CURRENT committed snapshot this is exactly 18 REPOS // 17 PROJECTS', () => {
  assert.equal(snapshotProjects.length, 17, 'precondition: the committed snapshot currently renders 17 projects');

  const liveRepos = [
    ...liveReposMatchingSnapshot(),
    liveRepo({ id: 999000002, name: 'a-fork', fork: true }),
  ];
  const response = inventory(liveRepos);
  const reconciled = reconcileLiveRepositories(snapshotProjects, response, {
    configuredGithubTarget: OWNER_TARGET,
  });

  const liveRepositoryCount = resolveLiveRepositoryCount(null, reconciled.stats.applied, response);
  const renderedProjectCount = reconciled.projects.length;

  assert.equal(liveRepositoryCount, 18);
  assert.equal(renderedProjectCount, 17);
  assert.equal(
    formatLiveInventoryCounts(liveRepositoryCount, renderedProjectCount),
    '18 REPOS // 17 PROJECTS',
  );
});

// ---------------------------------------------------------------------------
// 2. Snapshot / fallback must never fabricate a live repository count.
// ---------------------------------------------------------------------------
test('resolveLiveRepositoryCount stays null before any live payload has succeeded', () => {
  assert.equal(resolveLiveRepositoryCount(null, false, null), null);
  assert.equal(resolveLiveRepositoryCount(null, false, inventory([liveRepo()])), null, 'a non-applied response is ignored');
});

test('resolveLiveRepositoryCount publishes the live payload count once an applied response arrives', () => {
  const response = inventory([liveRepo({ id: 1 }), liveRepo({ id: 2 }), liveRepo({ id: 3 })]);
  assert.equal(resolveLiveRepositoryCount(null, true, response), 3);
});

test('a later fallback keeps the last known-good live count rather than reverting to null or the project count', () => {
  const good = inventory(Array.from({ length: 18 }, (_, i) => liveRepo({ id: i + 1, name: `r-${i}` })));
  const afterLive = resolveLiveRepositoryCount(null, true, good);
  assert.equal(afterLive, 18);

  // Network failure / malformed payload -> no response, not applied.
  assert.equal(resolveLiveRepositoryCount(afterLive, false, null), 18, 'fallback preserves the last live count');
  // Owner-mismatch style: response present but reconciliation declined it.
  assert.equal(resolveLiveRepositoryCount(afterLive, false, inventory([liveRepo()])), 18);
});

test('the live repository count is NEVER derived from the rendered project count', () => {
  // resolveLiveRepositoryCount has no access to projects.length by signature.
  const response = inventory([liveRepo({ id: 1 }), liveRepo({ id: 2 })]);
  // Even if far more projects render, the live count is the payload's own.
  assert.equal(resolveLiveRepositoryCount(null, true, response), 2);
});

// ---------------------------------------------------------------------------
// 3. formatLiveInventoryCounts — the brutalist telemetry token.
// ---------------------------------------------------------------------------
test('formatLiveInventoryCounts shows both counts, zero-padded, distinguished by REPOS vs PROJECTS', () => {
  assert.equal(formatLiveInventoryCounts(18, 17), '18 REPOS // 17 PROJECTS');
  assert.equal(formatLiveInventoryCounts(3, 3), '03 REPOS // 03 PROJECTS');
});

test('formatLiveInventoryCounts shows only the project count (no fabricated REPOS) until a live payload exists', () => {
  assert.equal(formatLiveInventoryCounts(null, 17), '17 PROJECTS');
  assert.ok(!formatLiveInventoryCounts(null, 17).includes('REPOS'), 'must not claim a live repo count while none is known');
});

// ---------------------------------------------------------------------------
// 4. Structural wiring — the misleading name is gone end to end.
// ---------------------------------------------------------------------------
test('the hook exposes liveRepositoryCount (number | null) and renderedProjectCount, not a single repositoryCount', () => {
  assert.ok(hookSrc.includes('liveRepositoryCount: number | null'), 'result type declares liveRepositoryCount as number | null');
  assert.ok(hookSrc.includes('renderedProjectCount: number'), 'result type declares renderedProjectCount');
  assert.ok(hookSrc.includes('renderedProjectCount: projects.length'), 'renderedProjectCount is projects.length');
  assert.ok(!/repositoryCount:\s*projects\.length/.test(hookSrc), 'the old projects.length-as-repositoryCount bug is gone');
  assert.ok(!/^\s*repositoryCount: number;?\s*$/m.test(hookSrc), 'the hook no longer returns a bare repositoryCount');
  assert.ok(hookSrc.includes('useState<number | null>(null)'), 'the live count starts null (no live payload yet)');
});

test('the hook only sources the live count from an applied response envelope', () => {
  assert.ok(
    hookSrc.includes('resolveLiveRepositoryCount(prev, reconciled.stats.applied, response)'),
    'the live count update runs inside the applied branch, off the response envelope',
  );
  // The setter must not appear in any fallback/catch branch.
  const fallbackSlices = hookSrc.split('resolveLiveRepositoryCount');
  assert.equal(fallbackSlices.length, 3, 'resolveLiveRepositoryCount is referenced exactly twice: its definition and its single call site');
});

test('App.tsx forwards both counts from the hook into the telemetry bar', () => {
  assert.ok(appSrc.includes('liveRepositoryCount,'), 'App destructures liveRepositoryCount from the hook');
  assert.ok(appSrc.includes('renderedProjectCount,'), 'App destructures renderedProjectCount from the hook');
  assert.ok(!/repositoryCount: liveRepositoryCount/.test(appSrc), 'the old repositoryCount alias is gone');
  const liveSyncBlock = appSrc.slice(appSrc.indexOf('liveSync={{'), appSrc.indexOf('}}', appSrc.indexOf('liveSync={{')));
  assert.ok(liveSyncBlock.includes('liveRepositoryCount'), 'liveSync passes liveRepositoryCount');
  assert.ok(liveSyncBlock.includes('renderedProjectCount'), 'liveSync passes renderedProjectCount');
});

test('TopTelemetryBar consumes the two distinct counts and no longer references liveSync.repositoryCount', () => {
  assert.ok(!telemetrySrc.includes('liveSync.repositoryCount'), 'the misleading single field is gone from the view');
  assert.ok(telemetrySrc.includes('liveRepositoryCount: number | null'), 'the telemetry prop type carries the nullable live count');
  assert.ok(telemetrySrc.includes('renderedProjectCount: number'), 'the telemetry prop type carries the rendered project count');
  assert.ok(
    telemetrySrc.includes('formatLiveInventoryCounts(liveSync.liveRepositoryCount, liveSync.renderedProjectCount)'),
    'the header renders both counts through the shared formatter',
  );
  // The GITHUB // LIVE label is untouched.
  assert.ok(telemetrySrc.includes('GITHUB // LIVE'));
});

test('the OWNER PROJECTS card labels activeProjectsCount as PROJECTS, not PUBLIC REPOS (it counts rendered eligible projects, not the raw repo inventory)', () => {
  assert.ok(
    telemetrySrc.includes("{activeProjectsCount.toString().padStart(2, '0')} PROJECTS"),
    'the OWNER PROJECTS card must read "NN PROJECTS"',
  );
  assert.ok(
    !/activeProjectsCount\.toString\(\)\.padStart\(2, '0'\)\} PUBLIC REPOS/.test(telemetrySrc),
    'activeProjectsCount must never be labelled "PUBLIC REPOS" — that number is the rendered project count',
  );
});
