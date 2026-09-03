import test from 'node:test';
import assert from 'node:assert/strict';
import type { ProjectData } from '../src/types.ts';
import type { LiveInventoryResponse, LiveRepository } from '../src/services/githubLiveTypes.ts';
import {
  reconcileLiveRepositories,
  overlayLiveMetadata,
  synthesizeLiveOnlyProject,
  resolveLiveStatus,
  inferConservativeCategory,
  projectIdStillPresent,
} from '../src/utils/reconcileLiveRepositories.ts';
import { assembleTopologyLayout } from '../src/utils/topologyLayout.ts';
import type { InfrastructureSkill } from '../src/types.ts';

const OWNER_TARGET = 'https://github.com/SalAkBuK';

function project(overrides: Partial<ProjectData> = {}): ProjectData {
  return {
    id: 'gh-100',
    code: 'GH-01',
    title: 'sample-repo',
    tagline: 'curated tagline',
    category: 'backend',
    classifications: ['backend'],
    status: 'ACTIVE',
    year: '2025',
    dimensions: { width: 100, height: 70, levels: 2 },
    gridPosition: { x: -160, y: -90 },
    accentColor: '#8EA9DA',
    summary: 'Curated engineering summary that must never be overwritten by a short GitHub description.',
    problem: 'Curated engineering challenge.',
    solution: 'Curated architectural solution.',
    architectureNotes: 'Curated architecture notes.',
    techStack: ['TypeScript', 'NestJS', 'PostgreSQL'],
    infrastructureDeps: ['gh-infra-1', 'gh-infra-2'],
    subsystems: [
      {
        id: 's1',
        name: 'Guarded REST API',
        category: 'backend',
        role: 'entry',
        description: 'desc',
        tech: ['NestJS'],
        coordinates: { x: 0, y: 0, z: 0 },
        dimensions: { width: 1, height: 1, depth: 1 },
        provenance: 'CURATED',
      },
    ],
    metrics: [
      { label: 'Stargazers', value: '1 ★', note: 'GitHub community stars', provenance: 'VERIFIED' },
      { label: 'Forks', value: '0 ⑂', note: 'Public downstream forks', provenance: 'VERIFIED' },
      { label: 'Open Issues', value: '0 open', note: 'Issue tracker backlog', provenance: 'VERIFIED' },
      { label: 'Primary Language', value: 'TypeScript', note: 'Dominant language', provenance: 'VERIFIED' },
    ],
    keyDecisions: [{ decision: 'd', rationale: 'r', tradeoff: 't', provenance: 'CURATED' }],
    resilienceTesting: 'Curated resilience testing evidence.',
    provenance: {
      summary: 'VERIFIED',
      problem: 'CURATED',
      solution: 'CURATED',
      subsystems: 'CURATED',
      keyDecisions: 'CURATED',
      resilienceTesting: 'CURATED',
      metrics: 'VERIFIED',
    },
    validationEvidence: {
      testFrameworks: ['Jest'],
      ciWorkflows: ['ci.yml'],
      e2eHarnesses: [],
      lintersAndFormatters: ['ESLint'],
      buildTools: ['tsc'],
      hasDocker: true,
      hasMigrations: true,
      testFilesDetected: 12,
      summary: 'Curated validation summary.',
      provenance: 'CURATED',
    },
    links: { github: 'https://github.com/SalAkBuK/sample-repo', caseStudy: true },
    ...overrides,
  };
}

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
    topics: ['backend'],
    stars: 42,
    forks: 7,
    openIssues: 3,
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
    repositoryCount: repositories.length,
    repositories,
    reason: 'ok',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. Matched project retains rich snapshot evidence; only GitHub facts overlay
// ---------------------------------------------------------------------------
test('a matched project keeps ALL curated snapshot evidence and overlays only GitHub-owned metadata', () => {
  const snapshot = [project()];
  const result = reconcileLiveRepositories(
    snapshot,
    inventory([liveRepo({ stars: 42, forks: 7, openIssues: 3, archived: false })]),
    { configuredGithubTarget: OWNER_TARGET },
  );

  assert.equal(result.stats.applied, true);
  assert.equal(result.stats.matched, 1);
  assert.equal(result.stats.overlaid, 1);
  assert.equal(result.projects.length, 1);

  const merged = result.projects[0];
  // Preserved curated content:
  assert.equal(merged.summary, snapshot[0].summary);
  assert.equal(merged.tagline, snapshot[0].tagline);
  assert.equal(merged.problem, snapshot[0].problem);
  assert.equal(merged.solution, snapshot[0].solution);
  assert.equal(merged.architectureNotes, snapshot[0].architectureNotes);
  assert.deepEqual(merged.subsystems, snapshot[0].subsystems);
  assert.deepEqual(merged.keyDecisions, snapshot[0].keyDecisions);
  assert.deepEqual(merged.techStack, snapshot[0].techStack);
  assert.deepEqual(merged.infrastructureDeps, snapshot[0].infrastructureDeps);
  assert.deepEqual(merged.provenance, snapshot[0].provenance);
  assert.deepEqual(merged.validationEvidence, snapshot[0].validationEvidence);
  assert.equal(merged.resilienceTesting, snapshot[0].resilienceTesting);
  assert.equal(merged.code, 'GH-01');

  // Overlaid GitHub facts:
  assert.equal(merged.metrics.find((m) => m.label === 'Stargazers')!.value, '42 ★');
  assert.equal(merged.metrics.find((m) => m.label === 'Forks')!.value, '7 ⑂');
  assert.equal(merged.metrics.find((m) => m.label === 'Open Issues')!.value, '3 open');
  assert.equal(merged.year, '2026');
});

test('overlayLiveMetadata returns the SAME reference when nothing GitHub-owned changed', () => {
  const p = project({ year: '2026' });
  const identical = liveRepo({
    stars: 1,
    forks: 0,
    openIssues: 0,
    pushedAt: '2026-01-01T00:00:00Z',
    homepage: null,
    archived: false,
  });
  assert.equal(overlayLiveMetadata(p, identical), p);
});

test('overlaying updates repo URL, homepage-derived demo, and archived status', () => {
  const p = project({ status: 'PRODUCTION' });
  const merged = overlayLiveMetadata(
    p,
    liveRepo({ htmlUrl: 'https://github.com/SalAkBuK/sample-repo', homepage: 'https://demo.example.com', archived: true }),
  );
  assert.equal(merged.links.demo, 'https://demo.example.com');
  assert.equal(merged.status, 'ARCHIVED');
  // curated PRODUCTION restored once un-archived:
  assert.equal(resolveLiveStatus('PRODUCTION', false), 'PRODUCTION');
  assert.equal(resolveLiveStatus('ARCHIVED', false), 'ACTIVE');
  assert.equal(resolveLiveStatus('ACTIVE', true), 'ARCHIVED');
});

// ---------------------------------------------------------------------------
// 2. New public repo appears
// ---------------------------------------------------------------------------
test('a public repo present live but absent from the snapshot appears as a minimal honest project', () => {
  const result = reconcileLiveRepositories(
    [project()],
    inventory([
      liveRepo(),
      liveRepo({ id: 999, name: 'brand-new-service', fullName: 'SalAkBuK/brand-new-service', description: null, language: 'Go', topics: [] }),
    ]),
    { configuredGithubTarget: OWNER_TARGET },
  );

  assert.equal(result.stats.added, 1);
  const created = result.projects.find((p) => p.id === 'gh-999')!;
  assert.ok(created);
  assert.equal(created.title, 'brand-new-service');
  assert.equal(created.code, 'GH-L01');
  assert.equal(created.infrastructureDeps.length, 0, 'zero capability relationships is allowed');
  assert.equal(created.problem, 'Not established by GitHub repository metadata.');
  assert.equal(created.provenance?.problem, 'UNAVAILABLE');
  assert.equal(created.provenance?.subsystems, 'UNAVAILABLE');
  assert.equal(created.subsystems.length, 0);
  assert.equal(created.category, 'backend'); // Go -> backend, conservatively
  assert.equal(created.links.github, 'https://github.com/SalAkBuK/brand-new-service');
  assert.match(created.architectureNotes, /snapshot refresh/i);
});

test('a NEW live-only repo does NOT inherit deep/curated evidence even when owner + name match a historical evidence key', () => {
  // "towerdesk-backend" is a curated repositoryEvidence key for owner SalAkBuK.
  // Simulates: the real towerdesk-backend was deleted, and a DIFFERENT new
  // repository (new GitHub id) was created under the same owner with the same
  // name. It must appear, but shallow -- no inherited architecture.
  const result = reconcileLiveRepositories(
    [project()],
    inventory([
      liveRepo(),
      liveRepo({
        id: 999555,
        name: 'towerdesk-backend',
        fullName: 'SalAkBuK/towerdesk-backend',
        ownerLogin: 'SalAkBuK',
        description: 'A fresh unrelated project',
        language: 'Go',
        topics: [],
      }),
    ]),
    { configuredGithubTarget: OWNER_TARGET },
  );
  const created = result.projects.find((p) => p.id === 'gh-999555')!;
  assert.ok(created, 'the new repo still appears');
  assert.equal(created.provenance?.problem, 'UNAVAILABLE');
  assert.equal(created.provenance?.subsystems, 'UNAVAILABLE');
  assert.equal(created.subsystems.length, 0);
  assert.equal(created.keyDecisions.length, 0);
  assert.equal(created.problem, 'Not established by GitHub repository metadata.');
  assert.doesNotMatch(created.problem, /multi-tenant property operations/i);
  assert.doesNotMatch(created.solution, /modular NestJS API/i);
});

test('an existing SNAPSHOT project matched to a live repo of the same id KEEPS its curated evidence', () => {
  // The snapshot project already carries curated architecture; overlay must not
  // touch it. (Curated evidence lives with the committed snapshot, not the
  // live-only synthesizer.)
  const curatedSnapshotProject = project({
    id: 'gh-100',
    problem: 'Curated engineering challenge.',
    solution: 'Curated architectural solution.',
  });
  const result = reconcileLiveRepositories(
    [curatedSnapshotProject],
    inventory([liveRepo({ id: 100, stars: 999 })]),
    { configuredGithubTarget: OWNER_TARGET },
  );
  assert.equal(result.projects[0].problem, 'Curated engineering challenge.');
  assert.equal(result.projects[0].solution, 'Curated architectural solution.');
  assert.deepEqual(result.projects[0].subsystems, curatedSnapshotProject.subsystems);
});

test('curated evidence is NOT applied to a live-only repo owned by a different login', () => {
  const result = reconcileLiveRepositories(
    [project()],
    inventory([
      liveRepo(),
      liveRepo({ id: 556, name: 'towerdesk-backend', fullName: 'impostor/towerdesk-backend', ownerLogin: 'impostor' }),
    ]),
    { configuredGithubTarget: OWNER_TARGET },
  );
  // owner-mismatched repo is dropped entirely by the owner-scope filter
  assert.equal(result.projects.some((p) => p.id === 'gh-556'), false);
});

// ---------------------------------------------------------------------------
// 3. Deleted / private repo disappears only on a COMPLETE inventory
// ---------------------------------------------------------------------------
test('a snapshot project absent from a COMPLETE live inventory is removed', () => {
  const snapshot = [project({ id: 'gh-100' }), project({ id: 'gh-200', code: 'GH-02', title: 'gone-repo', links: { github: 'https://github.com/SalAkBuK/gone-repo' } })];
  const result = reconcileLiveRepositories(snapshot, inventory([liveRepo({ id: 100 })], { complete: true }), {
    configuredGithubTarget: OWNER_TARGET,
  });
  assert.equal(result.stats.removed, 1);
  assert.equal(result.projects.length, 1);
  assert.equal(result.projects[0].id, 'gh-100');
});

test('an INCOMPLETE (partial/truncated) live inventory NEVER removes a snapshot project', () => {
  const snapshot = [project({ id: 'gh-100' }), project({ id: 'gh-200', code: 'GH-02', title: 'gone-repo', links: { github: 'https://github.com/SalAkBuK/gone-repo' } })];
  const result = reconcileLiveRepositories(
    snapshot,
    inventory([liveRepo({ id: 100 })], { complete: false, truncated: true, reason: 'partial' }),
    { configuredGithubTarget: OWNER_TARGET },
  );
  assert.equal(result.stats.removed, 0);
  assert.equal(result.stats.retainedOnIncomplete, 1);
  assert.equal(result.projects.length, 2);
});

// ---------------------------------------------------------------------------
// 4. Failure / malformed / owner mismatch -> keep snapshot
// ---------------------------------------------------------------------------
test('a failed live response (ok:false) preserves the snapshot untouched', () => {
  const snapshot = [project()];
  const result = reconcileLiveRepositories(
    snapshot,
    inventory([], { ok: false, complete: false, reason: 'rate_limited' }),
    { configuredGithubTarget: OWNER_TARGET },
  );
  assert.equal(result.stats.applied, false);
  assert.equal(result.stats.fallbackReason, 'not_ok');
  assert.equal(result.projects, snapshot);
  assert.equal(result.changed, false);
});

test('a null / undefined live response preserves the snapshot', () => {
  const snapshot = [project()];
  assert.equal(reconcileLiveRepositories(snapshot, null, { configuredGithubTarget: OWNER_TARGET }).projects, snapshot);
  assert.equal(reconcileLiveRepositories(snapshot, undefined, { configuredGithubTarget: OWNER_TARGET }).projects, snapshot);
});

test('an owner-mismatched live inventory is ignored and the snapshot is kept', () => {
  const snapshot = [project()];
  const result = reconcileLiveRepositories(snapshot, inventory([liveRepo()], { owner: 'someone-else' }), {
    configuredGithubTarget: OWNER_TARGET,
  });
  assert.equal(result.stats.applied, false);
  assert.equal(result.stats.fallbackReason, 'owner_mismatch');
  assert.equal(result.projects, snapshot);
});

test('a structurally malformed repository entry is skipped without throwing', () => {
  const snapshot = [project()];
  const junk = [
    liveRepo(),
    null as unknown as LiveRepository,
    { id: 'not-a-number', name: 'x' } as unknown as LiveRepository,
    { id: 5, name: '', ownerLogin: 'SalAkBuK' } as unknown as LiveRepository,
  ];
  const result = reconcileLiveRepositories(snapshot, inventory(junk), { configuredGithubTarget: OWNER_TARGET });
  assert.equal(result.stats.applied, true);
  assert.equal(result.stats.matched, 1);
  assert.equal(result.stats.added, 0);
});

test('reconciliation never empties the topology even from a complete-but-empty inventory', () => {
  const snapshot = [project()];
  const result = reconcileLiveRepositories(snapshot, inventory([], { complete: true }), {
    configuredGithubTarget: OWNER_TARGET,
  });
  assert.equal(result.stats.fallbackReason, 'would_empty_topology');
  assert.equal(result.projects, snapshot);
});

// ---------------------------------------------------------------------------
// 5. Rename + canonical identity
// ---------------------------------------------------------------------------
test('a renamed repository is matched by stable GitHub id and its title/URL update', () => {
  const snapshot = [project({ id: 'gh-100', title: 'old-name', links: { github: 'https://github.com/SalAkBuK/old-name' } })];
  const result = reconcileLiveRepositories(
    snapshot,
    inventory([liveRepo({ id: 100, name: 'new-name', fullName: 'SalAkBuK/new-name', htmlUrl: 'https://github.com/SalAkBuK/new-name' })]),
    { configuredGithubTarget: OWNER_TARGET },
  );
  assert.equal(result.stats.matched, 1);
  assert.equal(result.stats.added, 0, 'the renamed repo must NOT also appear as a new project');
  assert.equal(result.projects[0].title, 'new-name');
  assert.equal(result.projects[0].links.github, 'https://github.com/SalAkBuK/new-name');
  assert.equal(result.projects[0].id, 'gh-100', 'stable identity preserved');
});

test('a canonical repository alias in the snapshot matches its canonical live repo', () => {
  // snapshot project links to the alias "towerdesk-backend-clean"; live has "towerdesk-backend".
  const snapshot = [
    project({
      id: 'gh-no-numeric', // force owner/repo + canonical matching, not id matching
      title: 'towerdesk-backend-clean',
      links: { github: 'https://github.com/SalAkBuK/towerdesk-backend-clean' },
    }),
  ];
  const result = reconcileLiveRepositories(
    snapshot,
    inventory([liveRepo({ id: 321, name: 'towerdesk-backend', fullName: 'SalAkBuK/towerdesk-backend' })]),
    { configuredGithubTarget: OWNER_TARGET },
  );
  assert.equal(result.stats.matched, 1);
  assert.equal(result.stats.added, 0);
});

// ---------------------------------------------------------------------------
// 6. Forks / archived / empty for live-only additions
// ---------------------------------------------------------------------------
test('forks and empty repositories are not promoted to projects; archived ones are kept as ARCHIVED', () => {
  const result = reconcileLiveRepositories(
    [project()],
    inventory([
      liveRepo(),
      liveRepo({ id: 2, name: 'a-fork', fullName: 'SalAkBuK/a-fork', fork: true }),
      liveRepo({ id: 3, name: 'empty-repo', fullName: 'SalAkBuK/empty-repo', sizeKb: 0 }),
      liveRepo({ id: 4, name: 'old-archived', fullName: 'SalAkBuK/old-archived', archived: true }),
    ]),
    { configuredGithubTarget: OWNER_TARGET },
  );
  assert.equal(result.projects.some((p) => p.id === 'gh-2'), false, 'fork excluded');
  assert.equal(result.projects.some((p) => p.id === 'gh-3'), false, 'empty repo excluded');
  const archived = result.projects.find((p) => p.id === 'gh-4')!;
  assert.ok(archived);
  assert.equal(archived.status, 'ARCHIVED');
});

// ---------------------------------------------------------------------------
// 7. Conservative category + topology tolerance
// ---------------------------------------------------------------------------
test('inferConservativeCategory maps language/topics without description phrase-matching', () => {
  assert.equal(inferConservativeCategory('Rust', []), 'backend');
  assert.equal(inferConservativeCategory('TypeScript', []), 'fullstack');
  assert.equal(inferConservativeCategory('TypeScript', ['react', 'frontend']), 'frontend');
  assert.equal(inferConservativeCategory('TypeScript', ['api', 'react']), 'fullstack');
  assert.equal(inferConservativeCategory('HCL', ['terraform']), 'infrastructure');
  assert.equal(inferConservativeCategory(null, ['cli']), 'tooling');
});

test('live-only techStack keeps the primary language + ONLY recognized topics, never generic tags', () => {
  const created = synthesizeLiveOnlyProject(
    liveRepo({
      id: 7000,
      name: 'automation-hub',
      fullName: 'SalAkBuK/automation-hub',
      language: 'JavaScript',
      topics: ['n8n', 'healthcare', 'portfolio', 'automation', 'google-sheets', 'open-source', 'react'],
    }),
    0,
  );
  assert.deepEqual(
    [...created.techStack].sort(),
    ['Google Sheets', 'JavaScript', 'React', 'n8n'].sort(),
  );
  for (const junk of ['healthcare', 'Healthcare', 'portfolio', 'Portfolio', 'automation', 'Automation', 'open-source']) {
    assert.ok(!created.techStack.includes(junk), `generic tag "${junk}" must not be a technology`);
  }
});

test('a live-only repo with no language and no recognized topics gets an inert "Codebase" techStack (no fabricated links)', () => {
  const created = synthesizeLiveOnlyProject(
    liveRepo({ id: 7001, name: 'mystery', fullName: 'SalAkBuK/mystery', language: null, topics: ['healthcare', 'mvp'] }),
    0,
  );
  assert.deepEqual(created.techStack, ['Codebase']);
  assert.equal(created.infrastructureDeps.length, 0);
});

test('a synthesized zero-capability project does not crash the deterministic topology layout', () => {
  const skills: InfrastructureSkill[] = [
    {
      id: 'gh-infra-1',
      code: 'INF-01',
      name: 'TypeScript & Typed Systems',
      category: 'fullstack',
      yearsActive: 0,
      proficiencyScore: 0,
      gridPosition: { x: 0, y: 0 },
      systemCount: 1,
      usedInProjects: ['gh-100'],
      primaryUseCases: [],
      technicalHighlights: [],
      samplePattern: '',
    },
  ];
  const synthesized = synthesizeLiveOnlyProject(
    liveRepo({ id: 4242, name: 'zero-cap', fullName: 'SalAkBuK/zero-cap', language: null, topics: [] }),
    0,
  );
  assert.doesNotThrow(() => {
    const layout = assembleTopologyLayout([project(), synthesized], skills);
    assert.ok(layout.projectPositions['gh-4242'], 'the new project gets a topology position');
  });
});

// ---------------------------------------------------------------------------
// 8. Selection-safety helper
// ---------------------------------------------------------------------------
test('projectIdStillPresent reports a disappeared selection so the caller can clear it', () => {
  const projects = [project({ id: 'gh-1' }), project({ id: 'gh-2' })];
  assert.equal(projectIdStillPresent(projects, 'gh-1'), true);
  assert.equal(projectIdStillPresent(projects, 'gh-404'), false);
  assert.equal(projectIdStillPresent(projects, null), true);
});
