import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeRepository } from '../src/services/repositoryAnalyzer/index.ts';
import { GitHubRepoRaw } from '../src/services/githubService.ts';
import { RawRepositoryInspection } from '../src/services/repositoryAnalyzer/types.ts';

const baseRepo: GitHubRepoRaw = {
  id: 101,
  name: 'distributed-event-mesh',
  full_name: 'test-org/distributed-event-mesh',
  description: 'High throughput event broker and stream processing engine',
  html_url: 'https://github.com/test-org/distributed-event-mesh',
  homepage: 'https://mesh.example.com',
  stargazers_count: 42,
  forks_count: 12,
  open_issues_count: 3,
  watchers_count: 42,
  language: 'TypeScript',
  topics: ['event-mesh', 'streaming', 'distributed-systems'],
  size: 5120,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2026-06-01T00:00:00Z',
  pushed_at: '2026-06-01T00:00:00Z',
  archived: false,
  fork: false,
  default_branch: 'main',
  license: { key: 'mit', spdx_id: 'MIT', name: 'MIT License' },
  owner: {
    login: 'test-org',
    avatar_url: 'https://example.com/avatar.png',
    html_url: 'https://github.com/test-org'
  }
};

test('Pure repository inspection without curated override parses README and package.json', () => {
  const sampleReadme = `
# Distributed Event Mesh

A decentralized event broker with zero-copy stream processing.

## The Challenge
Legacy message brokers encounter severe garbage collection pauses and high lock contention when handling 50k concurrent producers under bursty loads.

## Architectural Solution
Implemented a zero-allocation ring buffer with worker thread pool dispatching and memory-mapped append-only log segments.

## Subsystems
- **Ingestion Gateway**: Ingests high-volume TCP binary frames with token validation.
- **Log Engine**: Manages append-only disk segments using fsync batches.
- **Consumer Dispatcher**: Distributes partitions to consumer groups with auto-rebalance.

## Architectural Decisions
### Decision: Use ring buffer over channel queues
- **Rationale**: Eliminates object allocation on hot publish paths.
- **Trade-off**: Requires pre-allocated fixed memory pools and backpressure signaling.
`;

  const samplePackageJson = JSON.stringify({
    name: 'distributed-event-mesh',
    version: '1.2.0',
    scripts: {
      build: 'tsc',
      test: 'vitest run',
      'test:e2e': 'playwright test',
      lint: 'eslint .'
    },
    dependencies: {
      ws: '^8.14.0',
      zod: '^3.22.0'
    },
    devDependencies: {
      vitest: '^1.0.0',
      playwright: '^1.40.0',
      typescript: '^5.3.0',
      eslint: '^8.50.0'
    }
  });

  const sampleInspection: RawRepositoryInspection = {
    readmeContent: sampleReadme,
    packageJsonContent: samplePackageJson,
    treeFiles: [
      'packages/gateway/src/index.ts',
      'packages/engine/src/storage.ts',
      'packages/dispatcher/src/consumer.ts',
      '.github/workflows/ci.yml',
      'Dockerfile',
      'vitest.config.ts'
    ]
  };

  const project = analyzeRepository(baseRepo, 0, 1, sampleInspection);

  // Assert Challenge and Solution extracted from README
  assert.equal(project.provenance?.problem, 'VERIFIED');
  assert.match(project.problem, /garbage collection pauses/i);
  assert.equal(project.provenance?.solution, 'VERIFIED');
  assert.match(project.solution, /zero-allocation ring buffer/i);

  // Assert Subsystems extracted
  assert.ok(project.subsystems.length >= 3);
  const ingestionSub = project.subsystems.find(s => s.name.toLowerCase().includes('ingestion'));
  assert.ok(ingestionSub, 'Should discover Ingestion Gateway subsystem');
  assert.equal(ingestionSub?.provenance, 'VERIFIED');

  // Assert Decisions extracted
  assert.ok(project.keyDecisions.length >= 1);
  const decision = project.keyDecisions[0];
  assert.match(decision.decision, /ring buffer/i);
  assert.match(decision.tradeoff, /pre-allocated fixed memory/i);
  assert.equal(decision.provenance, 'VERIFIED');

  // Assert Validation & Testing Evidence
  assert.ok(project.validationEvidence);
  assert.ok(project.validationEvidence.testFrameworks.includes('Vitest'));
  assert.ok(project.validationEvidence.e2eHarnesses.includes('Playwright'));
  assert.ok(project.validationEvidence.ciWorkflows.includes('GitHub Actions'));
  assert.equal(project.validationEvidence.hasDocker, true);
  assert.match(project.resilienceTesting, /Vitest/);
});

test('FormCrash repository regression oracle preserves curated fidelity and provenance', () => {
  const formcrashRepo: GitHubRepoRaw = {
    ...baseRepo,
    id: 102,
    name: 'formcrash',
    full_name: 'SalAkBuK/formcrash',
    html_url: 'https://github.com/SalAkBuK/formcrash',
    description: 'Autonomous E2E test generation engine',
    language: 'TypeScript',
    owner: {
      login: 'SalAkBuK',
      avatar_url: 'https://example.com/avatar.png',
      html_url: 'https://github.com/SalAkBuK'
    }
  };

  const emptyInspection: RawRepositoryInspection = {
    readmeContent: null,
    packageJsonContent: null,
    treeFiles: []
  };

  const formcrash = analyzeRepository(formcrashRepo, 0, 1, emptyInspection);

  // Check that curated data is applied and labeled as CURATED
  assert.equal(formcrash.provenance?.problem, 'CURATED');
  assert.equal(formcrash.provenance?.solution, 'CURATED');
  assert.equal(formcrash.provenance?.subsystems, 'CURATED');
  assert.equal(formcrash.provenance?.keyDecisions, 'CURATED');
  assert.ok(formcrash.subsystems.length >= 4);
  assert.ok(formcrash.keyDecisions.length >= 2);
  assert.match(formcrash.problem, /transactional browser journeys/i);
});

// ---------------------------------------------------------------------------
// PR28: Owner-Scoped Repository Evidence (Foreign-Owner Collision Protection)
// ---------------------------------------------------------------------------
test('PR28: A foreign owner\'s repository named "towerdesk-backend" does NOT receive SalAkBuK curated evidence (repository-name collision)', () => {
  const foreignTowerdesk: GitHubRepoRaw = {
    ...baseRepo,
    id: 201,
    name: 'towerdesk-backend',
    full_name: 'example-owner/towerdesk-backend',
    html_url: 'https://github.com/example-owner/towerdesk-backend',
    description: 'Unrelated property backend built by a different developer',
    language: 'Python',
    owner: {
      login: 'example-owner',
      avatar_url: 'https://example.com/avatar.png',
      html_url: 'https://github.com/example-owner'
    }
  };

  const emptyInspection: RawRepositoryInspection = {
    readmeContent: null,
    packageJsonContent: null,
    treeFiles: []
  };

  const project = analyzeRepository(foreignTowerdesk, 0, 1, emptyInspection);

  // Must NOT inherit SalAkBuK's curated TowerDesk architecture evidence merely
  // because the repository name matches -- evidence identity is OWNER + REPO.
  assert.notEqual(project.provenance?.problem, 'CURATED', 'Foreign repo must not receive CURATED problem statement');
  assert.notEqual(project.provenance?.subsystems, 'CURATED', 'Foreign repo must not receive CURATED subsystems');
  assert.ok(!project.problem.includes('property operations'), 'Foreign repo must not receive TowerDesk problem text');
  assert.ok(!project.subsystems.some(s => s.id.startsWith('tdb-')), 'Foreign repo must not receive TowerDesk subsystem IDs');
});

test('PR28: SalAkBuK\'s own "towerdesk-backend" repository still receives curated evidence (current-owner regression)', () => {
  const ownTowerdesk: GitHubRepoRaw = {
    ...baseRepo,
    id: 202,
    name: 'towerdesk-backend',
    full_name: 'SalAkBuK/towerdesk-backend',
    html_url: 'https://github.com/SalAkBuK/towerdesk-backend',
    owner: {
      login: 'SalAkBuK',
      avatar_url: 'https://example.com/avatar.png',
      html_url: 'https://github.com/SalAkBuK'
    }
  };

  const emptyInspection: RawRepositoryInspection = {
    readmeContent: null,
    packageJsonContent: null,
    treeFiles: []
  };

  const project = analyzeRepository(ownTowerdesk, 0, 1, emptyInspection);
  assert.equal(project.provenance?.problem, 'CURATED');
  assert.equal(project.provenance?.subsystems, 'CURATED');
  assert.match(project.problem, /property operations/i);
});

test('Sparse repository without README or package.json reports honest UNAVAILABLE status', () => {
  const sparseRepo: GitHubRepoRaw = {
    ...baseRepo,
    id: 103,
    name: 'sparse-empty-experiment',
    full_name: 'test-org/sparse-empty-experiment',
    description: '',
    language: null
  };

  const emptyInspection: RawRepositoryInspection = {
    readmeContent: null,
    packageJsonContent: null,
    treeFiles: []
  };

  const sparse = analyzeRepository(sparseRepo, 0, 1, emptyInspection);

  assert.equal(sparse.provenance?.problem, 'UNAVAILABLE');
  assert.equal(sparse.subsystems.length, 0);
  assert.equal(sparse.keyDecisions.length, 0);
  assert.equal(sparse.validationEvidence?.provenance, 'UNAVAILABLE');
  assert.match(sparse.problem, /Not established/);
});

test('Metrics safety prevents fabricating uptime or latency benchmarks', () => {
  const sampleInspection: RawRepositoryInspection = {
    readmeContent: '# Test Repo\nSimple utility script.',
    packageJsonContent: '{"name":"test-repo"}',
    treeFiles: ['index.js']
  };

  const project = analyzeRepository(baseRepo, 0, 1, sampleInspection);

  assert.equal(project.performanceEvidence?.claimed, false);
  assert.match(project.performanceEvidence?.notes || '', /No runtime benchmarks/);
  // Ensure forbidden hallucinated patterns do not exist in stringified representation
  const serialized = JSON.stringify(project);
  assert.doesNotMatch(serialized, /99\.99%|p99\.9|production SLA guaranteed/i);
});
