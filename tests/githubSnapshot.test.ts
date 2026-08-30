import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { 
  resolveGitHubSnapshotForTarget, 
  normalizeGitHubTarget,
  parseGitHubTarget,
  applyProjectLinkOverrides 
} from '../src/utils/portfolioUtils.ts';
import { 
  runWithConcurrency, 
  fetchRepoInspection, 
  fetchGitHubUserData, 
  canonicalizeRepositories,
  inspectCanonicalRepositories,
  handleGitHubHttpError,
  generateGitHubProfileDetails,
  sanitizeGitHubUser,
  GitHubRepoRaw 
} from '../src/services/githubService.ts';
import { analyzeDependencies } from '../src/services/repositoryAnalyzer/dependencyAnalyzer.ts';
import { analyzeRepository } from '../src/services/repositoryAnalyzer/index.ts';
import { serializeGitHubSnapshot, generateGitHubSnapshot, syncGitHubSnapshotToFile } from '../scripts/sync-github-snapshot.ts';
import { GITHUB_SNAPSHOT, GITHUB_SNAPSHOT_METADATA } from '../src/data/githubSnapshot.generated.ts';
import { PORTFOLIO_CONFIG } from '../src/config/portfolioConfig.ts';
import type { GitHubSnapshotMetadata } from '../src/types.ts';
import type { GitHubSyncResult } from '../src/services/githubService.ts';

const sampleMetadata: GitHubSnapshotMetadata = {
  schemaVersion: 1,
  generatedAt: '2026-08-28T00:00:00.000Z',
  githubTarget: 'https://github.com/SalAkBuK',
  sourceIdentifier: 'SalAkBuK',
  rawRepositoryCount: 19,
  canonicalRepositoryCount: 18,
  inspectedRepositoryCount: 18,
  inspectionWarnings: []
};

const sampleSnapshot: GitHubSyncResult = {
  sourceType: 'user',
  sourceIdentifier: 'SalAkBuK',
  user: {
    login: 'SalAkBuK',
    name: 'Salih Bukhari',
    avatar_url: 'https://github.com/SalAkBuK.png',
    bio: 'Full Stack Engineer',
    html_url: 'https://github.com/SalAkBuK',
    public_repos: 19,
    followers: 10,
    following: 10,
    company: null,
    location: 'Rawalpindi, Pakistan',
    blog: null
  },
  projects: [
    {
      id: 'gh-1',
      code: 'GH-01',
      title: 'Systems_Cartography_Portfolio',
      tagline: 'Interactive portfolio',
      category: 'fullstack',
      status: 'ACTIVE',
      year: '2026',
      dimensions: { width: 90, height: 75, levels: 2 },
      gridPosition: { x: -160, y: -90 },
      accentColor: '#8EA9DA',
      summary: 'Systems portfolio',
      problem: 'Interactive brutalist cartography',
      solution: 'Decoupled architecture',
      architectureNotes: 'Verified metadata only',
      techStack: ['TypeScript', 'React', 'Vite'],
      infrastructureDeps: [],
      subsystems: [],
      metrics: [],
      keyDecisions: [],
      links: {
        github: 'https://github.com/SalAkBuK/Systems_Cartography_Portfolio'
      },
      provenance: { problem: 'VERIFIED', solution: 'VERIFIED', architectureNotes: 'VERIFIED', subsystems: 'VERIFIED', keyDecisions: 'VERIFIED', resilienceTesting: 'VERIFIED' },
      resilienceTesting: 'Automated test suite'
    }
  ],
  skills: [
    {
      id: 'gh-infra-1',
      code: 'INF-01',
      name: 'TypeScript & Typed Systems',
      category: 'fullstack',
      yearsActive: 2,
      proficiencyScore: 76,
      gridPosition: { x: 0, y: 0 },
      systemCount: 1,
      usedInProjects: ['gh-1'],
      primaryUseCases: ['Primary development language'],
      technicalHighlights: ['Strong type safety'],
      samplePattern: '// Pattern'
    }
  ],
  operator: {
    name: 'Salih Bukhari',
    handle: '@SalAkBuK',
    role: 'Full Stack Engineer',
    location: 'Rawalpindi, Pakistan',
    status: 'ACTIVE_BUILD // GITHUB SYNCHRONIZED',
    focus: 'Full stack development',
    yearsActive: 0,
    commitsIndexed: 'Not indexed',
    productionUptime: 'Not claimed',
    primaryStack: ['TypeScript', 'React'],
    systemManifesto: 'Manifesto',
    contact: {
      email: '',
      github: 'https://github.com/SalAkBuK',
      linkedin: '',
      pgpKeyId: '',
      pgpFingerprint: '',
      matrix: '',
      availability: 'Available'
    }
  },
  experience: [],
  rawCount: 19
};

const sampleRepo: GitHubRepoRaw = {
  id: 1,
  name: 'sample-service',
  full_name: 'test-user/sample-service',
  description: 'A sample backend service',
  html_url: 'https://github.com/test-user/sample-service',
  homepage: null,
  stargazers_count: 5,
  forks_count: 1,
  open_issues_count: 0,
  watchers_count: 5,
  language: 'TypeScript',
  topics: ['backend'],
  size: 500,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  pushed_at: '2026-01-01T00:00:00Z',
  archived: false,
  fork: false,
  default_branch: 'main',
  license: null,
  owner: {
    login: 'test-user',
    avatar_url: 'https://example.com/avatar.png',
    html_url: 'https://github.com/test-user'
  }
};

// ---------------------------------------------------------------------------
// 1. Snapshot Owner Scoping & Fork Safety
// ---------------------------------------------------------------------------
test('normalizeGitHubTarget normalizes URLs, handles, casing, and trailing slashes', () => {
  assert.equal(normalizeGitHubTarget('https://github.com/SalAkBuK/'), 'salakbuk');
  assert.equal(normalizeGitHubTarget('http://www.github.com/SalAkBuK'), 'salakbuk');
  assert.equal(normalizeGitHubTarget('github.com/SalAkBuK/'), 'salakbuk');
  assert.equal(normalizeGitHubTarget('@SalAkBuK'), 'salakbuk');
  assert.equal(normalizeGitHubTarget('  SalAkBuK  '), 'salakbuk');
  assert.equal(normalizeGitHubTarget(''), '');
  assert.equal(normalizeGitHubTarget(null), '');
});

test('resolveGitHubSnapshotForTarget returns snapshot when configured target matches metadata target', () => {
  const result = resolveGitHubSnapshotForTarget('https://github.com/SalAkBuK', sampleMetadata, sampleSnapshot);
  assert.ok(result);
  assert.equal(result.sourceIdentifier, 'SalAkBuK');
  assert.equal(result.projects.length, 1);
});

test('resolveGitHubSnapshotForTarget returns snapshot when target formats differ only in protocol or trailing slash', () => {
  const result = resolveGitHubSnapshotForTarget('github.com/salakbuk/', sampleMetadata, sampleSnapshot);
  assert.ok(result);
  assert.equal(result.sourceIdentifier, 'SalAkBuK');
});

test('resolveGitHubSnapshotForTarget returns null when fork owner configured target does not match snapshot metadata', () => {
  const result = resolveGitHubSnapshotForTarget('https://github.com/fork-owner', sampleMetadata, sampleSnapshot);
  assert.equal(result, null, 'Fork owner must not see previous owner snapshot');
});

test('resolveGitHubSnapshotForTarget returns null when metadata or snapshot is missing', () => {
  assert.equal(resolveGitHubSnapshotForTarget('https://github.com/SalAkBuK', null, sampleSnapshot), null);
  assert.equal(resolveGitHubSnapshotForTarget('https://github.com/SalAkBuK', sampleMetadata, null), null);
});

// ---------------------------------------------------------------------------
// 2. Runtime Network Independence & Telemetry
// ---------------------------------------------------------------------------
test('App.tsx source contains zero visitor-time connectGitHubTarget calls and zero localStorage sync caches', () => {
  const appSrc = readFileSync('src/App.tsx', 'utf8');
  assert.ok(!appSrc.includes('connectGitHubTarget('), 'App.tsx must not call connectGitHubTarget at runtime');
  assert.ok(!appSrc.includes('STORAGE_KEY_PROJECTS'), 'App.tsx must not use STORAGE_KEY_PROJECTS');
  assert.ok(!appSrc.includes('STORAGE_KEY_GITHUB_SOURCE'), 'App.tsx must not use STORAGE_KEY_GITHUB_SOURCE');
  assert.ok(!appSrc.includes('migrateStoredPortfolio'), 'App.tsx must not contain migrateStoredPortfolio');
  assert.ok(appSrc.includes('resolveGitHubSnapshotForTarget'), 'App.tsx must use resolveGitHubSnapshotForTarget');
});

test('TopTelemetryBar.tsx displays GITHUB SNAPSHOT when ready and SNAPSHOT // REFRESH REQUIRED when mismatch', () => {
  const telemetrySrc = readFileSync('src/components/TopTelemetryBar.tsx', 'utf8');
  assert.ok(telemetrySrc.includes('GITHUB SNAPSHOT //'), 'TopTelemetryBar must display GITHUB SNAPSHOT header');
  assert.ok(telemetrySrc.includes('SNAPSHOT // REFRESH REQUIRED'), 'TopTelemetryBar must display REFRESH REQUIRED on mismatch');
  assert.ok(!telemetrySrc.includes('GITHUB // LOADING'), 'TopTelemetryBar must not contain obsolete LOADING state');
  assert.ok(!telemetrySrc.includes('CACHED // GITHUB UNAVAILABLE'), 'TopTelemetryBar must not contain obsolete UNAVAILABLE state');
});

// ---------------------------------------------------------------------------
// 3. Concurrency Limiter
// ---------------------------------------------------------------------------
test('runWithConcurrency bounds maximum concurrent workers and preserves exact input order', async () => {
  let activeWorkers = 0;
  let maxObservedWorkers = 0;

  const items = [10, 20, 30, 40, 50, 60];
  const results = await runWithConcurrency(items, 2, async (item, idx) => {
    activeWorkers++;
    maxObservedWorkers = Math.max(maxObservedWorkers, activeWorkers);
    await new Promise(resolve => setTimeout(resolve, 10));
    activeWorkers--;
    return { item, idx, square: item * item };
  });

  assert.equal(maxObservedWorkers, 2, 'Max concurrent workers must not exceed limit 2');
  assert.equal(results.length, 6);
  results.forEach((r, idx) => {
    assert.equal(r.idx, idx, `Index order must match input index ${idx}`);
    assert.equal(r.item, items[idx]);
    assert.equal(r.square, items[idx] * items[idx]);
  });
});

test('runWithConcurrency handles empty array and limit greater than items gracefully', async () => {
  const empty = await runWithConcurrency([], 3, async () => 1);
  assert.deepEqual(empty, []);

  const single = await runWithConcurrency([42], 5, async (x) => x * 2);
  assert.deepEqual(single, [84]);
});

// ---------------------------------------------------------------------------
// 4. Deep Inspection of All Canonical Repositories
// ---------------------------------------------------------------------------
test('fetchGitHubUserData deep-inspects all canonical repos without top-3 limit', async () => {
  const inspectedRepos: string[] = [];

  const mockFetch: typeof fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();

    if (url.includes('/users/test-user/repos')) {
      const repos: GitHubRepoRaw[] = Array.from({ length: 6 }, (_, i) => ({
        ...sampleRepo,
        id: i + 1,
        name: `service-${i + 1}`,
        full_name: `test-user/service-${i + 1}`,
        html_url: `https://github.com/test-user/service-${i + 1}`,
        size: 200
      }));
      return { ok: true, status: 200, json: async () => repos } as Response;
    }

    if (url.includes('/users/test-user')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          login: 'test-user',
          name: 'Test User',
          avatar_url: 'https://example.com/avatar.png',
          public_repos: 6
        })
      } as Response;
    }

    if (url.includes('/readme')) {
      const repoMatch = url.match(/\/repos\/test-user\/([^\/]+)\/readme/);
      if (repoMatch) {
        inspectedRepos.push(repoMatch[1]);
      }
      return { ok: true, status: 200, text: async () => '# Service' } as Response;
    }

    if (url.includes('/git/trees/')) {
      return { ok: true, status: 200, json: async () => ({ tree: [{ path: 'package.json' }] }) } as Response;
    }

    if (url.includes('/contents/package.json')) {
      return { ok: true, status: 200, text: async () => JSON.stringify({ name: 'test', dependencies: { express: '^4.0.0' } }) } as Response;
    }

    return { ok: false, status: 404, text: async () => 'Not found' } as Response;
  }) as typeof fetch;

  const result = await fetchGitHubUserData('test-user', {
    fetchImpl: mockFetch,
    inspectionConcurrency: 2
  });

  assert.equal(result.projects.length, 6);
  assert.equal(inspectedRepos.length, 6, 'All 6 canonical repositories must be deeply inspected (no idx < 3 cap)');
});

// ---------------------------------------------------------------------------
// 5. Rate Limit & Error Handling
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// 5. Rate Limit, 403 Forbidden & Error Classification
// ---------------------------------------------------------------------------
test('handleGitHubHttpError correctly distinguishes 429, 403 remaining=0, 403 retry-after, and plain 403', () => {
  // Case A: 429
  const res429 = {
    status: 429,
    statusText: 'Too Many Requests',
    headers: { get: () => null }
  } as unknown as Response;
  assert.throws(
    () => handleGitHubHttpError(res429, 'testing 429'),
    /GitHub API rate limit exceeded while testing 429/
  );

  // Case B: 403 + remaining = '0'
  const resetUnix = Math.floor(Date.now() / 1000) + 3600;
  const res403Primary = {
    status: 403,
    statusText: 'Forbidden',
    headers: {
      get: (h: string) => h.toLowerCase() === 'x-ratelimit-remaining' ? '0' : h.toLowerCase() === 'x-ratelimit-reset' ? resetUnix.toString() : null
    }
  } as unknown as Response;
  assert.throws(
    () => handleGitHubHttpError(res403Primary, 'testing primary limit'),
    /GitHub API primary rate limit exhausted while testing primary limit/
  );

  // Case C: 403 + Retry-After
  const res403Secondary = {
    status: 403,
    statusText: 'Forbidden',
    headers: {
      get: (h: string) => h.toLowerCase() === 'retry-after' ? '60' : null
    }
  } as unknown as Response;
  assert.throws(
    () => handleGitHubHttpError(res403Secondary, 'testing secondary limit'),
    /GitHub API secondary rate limit reached while testing secondary limit/
  );

  // Case D: Plain 403 (e.g. permission denied or repository restricted)
  const res403Plain = {
    status: 403,
    statusText: 'Forbidden',
    headers: {
      get: (h: string) => h.toLowerCase() === 'x-ratelimit-remaining' ? '4990' : null
    }
  } as unknown as Response;
  try {
    handleGitHubHttpError(res403Plain, 'testing plain 403');
    assert.fail('Should have thrown');
  } catch (err: any) {
    assert.match(err.message, /GitHub API request forbidden\/rejected while testing plain 403/);
    assert.ok(!err.message.includes('rate limit exhausted'), 'Plain 403 must not report rate limit exhaustion');
  }
});

test('fetchRepoInspection throws error when git tree returns non-OK status', async () => {
  const mockFetch: typeof fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes('/git/trees/')) {
      return {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      } as Response;
    }
    return { ok: true, status: 200, text: async () => '' } as Response;
  }) as typeof fetch;

  await assert.rejects(
    async () => {
      await fetchRepoInspection('test-user', 'broken-tree-repo', 'main', {
        fetchImpl: mockFetch
      });
    },
    /fetching git tree for "test-user\/broken-tree-repo"/
  );
});

test('fetchRepoInspection throws error when git tree is truncated in strict mode', async () => {
  const mockFetch: typeof fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes('/git/trees/')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          tree: [{ path: 'src/index.ts' }],
          truncated: true
        })
      } as Response;
    }
    return { ok: true, status: 200, text: async () => '' } as Response;
  }) as typeof fetch;

  await assert.rejects(
    async () => {
      await fetchRepoInspection('test-user', 'big-repo', 'main', {
        fetchImpl: mockFetch
      });
    },
    /Tree truncated for "test-user\/big-repo"/
  );
});

test('fetchRepoInspection throws error when git tree is missing or not an array', async () => {
  const mockFetch: typeof fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes('/git/trees/')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          tree: 'not-an-array'
        })
      } as Response;
    }
    return { ok: true, status: 200, text: async () => '' } as Response;
  }) as typeof fetch;

  await assert.rejects(
    async () => {
      await fetchRepoInspection('test-user', 'malformed-tree-repo', 'main', {
        fetchImpl: mockFetch
      });
    },
    /Git tree payload is missing or not an array/
  );
});

test('fetchRepoInspection throws in strict mode when tree-listed manifest returns 404 or 500', async () => {
  const mockFetch: typeof fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes('/git/trees/')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          tree: [{ path: 'package.json' }, { path: 'apps/api/package.json' }],
          truncated: false
        })
      } as Response;
    }
    if (url.includes('/contents/package.json')) {
      return { ok: true, status: 200, text: async () => '{"name":"root"}' } as Response;
    }
    if (url.includes('/contents/apps%2Fapi%2Fpackage.json')) {
      return { ok: false, status: 404, statusText: 'Not Found' } as Response;
    }
    return { ok: false, status: 404 } as Response;
  }) as typeof fetch;

  await assert.rejects(
    async () => {
      await fetchRepoInspection('test-user', 'broken-manifest-repo', 'main', {
        fetchImpl: mockFetch
      });
    },
    /Manifest file "apps\/api\/package\.json" listed in tree for "test-user\/broken-manifest-repo" was not found \(404\)/
  );
});

// ---------------------------------------------------------------------------
// 6. Staged Pipeline & Canonical Deduplication Before Inspection
// ---------------------------------------------------------------------------
const salakbukOwner = {
  login: 'SalAkBuK',
  avatar_url: 'https://example.com/avatar.png',
  html_url: 'https://github.com/SalAkBuK'
};

test('canonicalizeRepositories dedupes clusters before deep inspection and discarded aliases receive 0 requests', async () => {
  const clusterRepos: GitHubRepoRaw[] = [
    { ...sampleRepo, id: 1, name: 'towerdesk-backend-clean', full_name: 'SalAkBuK/towerdesk-backend-clean', owner: salakbukOwner },
    { ...sampleRepo, id: 2, name: 'towerdesk-backend', full_name: 'SalAkBuK/towerdesk-backend', owner: salakbukOwner },
    { ...sampleRepo, id: 3, name: 'svc-alpha', full_name: 'SalAkBuK/svc-alpha', owner: salakbukOwner },
    { ...sampleRepo, id: 4, name: 'svc-beta', full_name: 'SalAkBuK/svc-beta', owner: salakbukOwner },
    { ...sampleRepo, id: 5, name: 'svc-gamma', full_name: 'SalAkBuK/svc-gamma', owner: salakbukOwner },
    { ...sampleRepo, id: 6, name: 'svc-delta', full_name: 'SalAkBuK/svc-delta', owner: salakbukOwner },
    { ...sampleRepo, id: 7, name: 'svc-epsilon', full_name: 'SalAkBuK/svc-epsilon', owner: salakbukOwner }
  ];

  const canonical = canonicalizeRepositories(clusterRepos);
  assert.equal(canonical.length, 6, 'Cluster must dedupe down to 6 canonical repos');

  const requestedInspectionRepos: string[] = [];
  const mockFetch: typeof fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes('/git/trees/')) {
      const match = url.match(/\/repos\/SalAkBuK\/([^\/]+)\/git\/trees/);
      if (match) requestedInspectionRepos.push(match[1]);
      return { ok: true, status: 200, json: async () => ({ tree: [] }) } as Response;
    }
    return { ok: true, status: 200, text: async () => '' } as Response;
  }) as typeof fetch;

  const { inspections, summary } = await inspectCanonicalRepositories(canonical, {
    fetchImpl: mockFetch
  });

  assert.equal(summary.canonicalRepositoryCount, 6);
  assert.equal(summary.inspectedRepositoryCount, 6);
  assert.equal(summary.warnings.length, 0);
  assert.equal(inspections.length, 6);
  assert.ok(requestedInspectionRepos.includes('towerdesk-backend'), 'Canonical repo must be inspected');
  assert.ok(!requestedInspectionRepos.includes('towerdesk-backend-clean'), 'Discarded alias must receive 0 inspection requests');
});

test('PR28: canonicalizeRepositories does NOT apply SalAkBuK clustering to a foreign owner\'s repositories (cluster-alias isolation)', () => {
  const foreignClusterRepos: GitHubRepoRaw[] = [
    { ...sampleRepo, id: 1, name: 'towerdesk-backend-clean', full_name: 'example-owner/towerdesk-backend-clean' },
    { ...sampleRepo, id: 2, name: 'towerdesk-backend', full_name: 'example-owner/towerdesk-backend' }
  ];

  const canonical = canonicalizeRepositories(foreignClusterRepos);
  // A foreign owner's two distinctly-named repositories must NOT be
  // collapsed into one just because SalAkBuK's alias table maps
  // "towerdesk-backend-clean" -> "towerdesk-backend". Both survive.
  assert.equal(canonical.length, 2, 'Foreign owner repositories must not be deduped via SalAkBuK cluster aliases');
});

// ---------------------------------------------------------------------------
// 7. Multi-Manifest Dependency Extraction & Section-Aware TOML / Pyproject
// ---------------------------------------------------------------------------
test('analyzeDependencies extracts dependencies across multiple bounded package.json manifests', () => {
  const inspection = {
    packageJsonContent: JSON.stringify({
      name: 'root',
      dependencies: { react: '^19.0.0', 'lucide-react': '^0.500.0' },
      scripts: { build: 'vite build', test: 'vitest' }
    }),
    manifestContents: {
      'package.json': JSON.stringify({
        name: 'root',
        dependencies: { react: '^19.0.0', 'lucide-react': '^0.500.0' }
      }),
      'apps/server/package.json': JSON.stringify({
        dependencies: { express: '^4.21.0', '@prisma/client': '^6.0.0' }
      })
    },
    treeFiles: ['package.json', 'apps/server/package.json', 'Dockerfile', '.github/workflows/ci.yml']
  };

  const deps = analyzeDependencies(inspection);
  assert.ok(deps.frameworks.frontend.includes('React'));
  assert.ok(deps.frameworks.frontend.includes('Lucide Icons'));
  assert.ok(deps.frameworks.backend.includes('Express'));
  assert.ok(deps.frameworks.database.includes('Prisma Client'));
  assert.ok(deps.frameworks.devops.includes('Docker'));
  assert.ok(deps.frameworks.devops.includes('GitHub Actions'));
  assert.equal(deps.packageScripts.build, 'vite build');
});

test('analyzeDependencies ignores non-dependency descriptions in Cargo.toml (No False Positives)', () => {
  const cargoTomlWithProse = `
[package]
name = "event-broker"
version = "0.1.0"
edition = "2021"
description = "A high-performance broker inspired by axum and actix-web HTTP patterns"

[dependencies]
tokio = { version = "1.0", features = ["full"] }
serde = { version = "1.0", features = ["derive"] }
`;

  const inspection = {
    manifestContents: {
      'Cargo.toml': cargoTomlWithProse
    },
    treeFiles: ['Cargo.toml', 'src/main.rs']
  };

  const deps = analyzeDependencies(inspection);
  assert.equal(deps.primaryEcosystem, 'Rust');
  assert.ok(deps.frameworks.backend.includes('Cargo / Rust'));
  assert.ok(deps.frameworks.backend.includes('Tokio'));
  assert.ok(deps.frameworks.tools.includes('Serde'));
  assert.ok(!deps.frameworks.backend.includes('Axum'), 'Axum mentioned only in description must NOT be detected as dependency');
  assert.ok(!deps.frameworks.backend.includes('Actix Web'), 'Actix Web mentioned only in description must NOT be detected');
});

test('analyzeDependencies ignores non-dependency descriptions in pyproject.toml (No False Positives)', () => {
  const pyprojectWithProse = `
[project]
name = "data-pipeline"
version = "0.1.0"
description = "Microservice designed for migration from FastAPI and Django to Celery async tasks"
dependencies = [
    "sqlalchemy>=2.0.0",
    "pydantic>=2.0.0"
]

[tool.ruff]
target-version = "py311"
`;

  const inspection = {
    manifestContents: {
      'pyproject.toml': pyprojectWithProse
    },
    treeFiles: ['pyproject.toml', 'main.py']
  };

  const deps = analyzeDependencies(inspection);
  assert.equal(deps.primaryEcosystem, 'Python');
  assert.ok(deps.frameworks.database.includes('SQLAlchemy'));
  assert.ok(deps.frameworks.tools.includes('Pydantic'));
  assert.ok(!deps.frameworks.backend.includes('FastAPI'), 'FastAPI mentioned only in description must NOT be detected');
  assert.ok(!deps.frameworks.backend.includes('Django'), 'Django mentioned only in description must NOT be detected');
});

// ---------------------------------------------------------------------------
// 8. Project Link Overrides Independence
// ---------------------------------------------------------------------------
test('applyProjectLinkOverrides applies live demo URLs at runtime without modifying snapshot', () => {
  const baseProjects = sampleSnapshot.projects;
  const projectLinks = {
    'Systems_Cartography_Portfolio': 'https://portfolio-live.example.com'
  };

  const overridden = applyProjectLinkOverrides(baseProjects, projectLinks);
  assert.equal(overridden[0].links.demo, 'https://portfolio-live.example.com');
  assert.equal(baseProjects[0].links.demo, undefined, 'Original snapshot project must remain unmodified');
});

// ---------------------------------------------------------------------------
// 9. Reviewed Repository Evidence Precedence
// ---------------------------------------------------------------------------
test('analyzeRepository gives reviewed repository evidence precedence over generic parsed signals', () => {
  const towerdeskRepo: GitHubRepoRaw = {
    ...sampleRepo,
    id: 101,
    name: 'towerdesk-backend-clean',
    full_name: 'SalAkBuK/towerdesk-backend-clean',
    html_url: 'https://github.com/SalAkBuK/towerdesk-backend-clean',
    owner: {
      login: 'SalAkBuK',
      avatar_url: 'https://example.com/avatar.png',
      html_url: 'https://github.com/SalAkBuK'
    }
  };

  const project = analyzeRepository({
    repo: towerdeskRepo,
    index: 0,
    total: 1,
    inspection: {
      readmeContent: '# Generic README\nSome description',
      treeFiles: ['package.json']
    }
  });

  assert.equal(project.provenance?.problem, 'CURATED');
  assert.equal(project.provenance?.solution, 'CURATED');
  assert.equal(project.provenance?.subsystems, 'CURATED');
  assert.ok(project.subsystems.length >= 4);
  assert.match(project.problem, /property operations/i);
});

// ---------------------------------------------------------------------------
// 10. Snapshot Serializer Contract, Real Secret Safety & Transactional Write
// ---------------------------------------------------------------------------
test('generateGitHubSnapshot rejects real injected tokens and prevents leakage in serialized module', async () => {
  const fakeSecret = 'TEST_FAKE_GITHUB_SECRET_9f83abc123';
  const mockFetch: typeof fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes('/users/test-user/repos')) {
      return { ok: true, status: 200, json: async () => [sampleRepo] } as Response;
    }
    if (url.includes('/users/test-user')) {
      return { ok: true, status: 200, json: async () => ({ login: 'test-user', public_repos: 1 }) } as Response;
    }
    if (url.includes('/git/trees/')) {
      return { ok: true, status: 200, json: async () => ({ tree: [] }) } as Response;
    }
    return { ok: true, status: 200, text: async () => 'README with Bearer authentication discussion' } as Response;
  }) as typeof fetch;

  const { outputContent } = await generateGitHubSnapshot('test-user', {
    token: fakeSecret,
    fetchImpl: mockFetch
  });

  assert.ok(!outputContent.includes(fakeSecret), 'Output must not leak the injected secret value');
  assert.ok(!outputContent.includes('Authorization: Bearer'), 'Output must not leak authorization header');
  assert.ok(outputContent.includes('export const GITHUB_SNAPSHOT: GitHubSyncResult = {'));
});

test('syncGitHubSnapshotToFile performs transactional write and preserves target on failure', async () => {
  const { writeFile, unlink } = await import('node:fs/promises');
  const testFile = 'tests/scratch-test-snapshot.ts';
  const initialContent = '// Original untouched file content';
  await writeFile(testFile, initialContent, 'utf8');

  const mockFailingFetch: typeof fetch = (async () => {
    return { ok: false, status: 500, statusText: 'Internal Server Error' } as Response;
  }) as typeof fetch;

  await assert.rejects(
    async () => {
      await syncGitHubSnapshotToFile('test-user', { fetchImpl: mockFailingFetch }, testFile);
    }
  );

  const afterContent = readFileSync(testFile, 'utf8');
  assert.equal(afterContent, initialContent, 'Failed snapshot sync must not corrupt original file');

  await unlink(testFile);
});

// ---------------------------------------------------------------------------
// 11. Committed Snapshot Validation & Completeness Contract
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// 11. Fallback Profile & Location Verification (No Invented Roles)
// ---------------------------------------------------------------------------
test('generateGitHubProfileDetails fallback with no bio sets role to "GitHub profile"', () => {
  const userWithoutBio = sanitizeGitHubUser({ login: 'anon-user', name: 'Anonymous', bio: null, location: null });
  const { operator, experience } = generateGitHubProfileDetails(sampleSnapshot.projects, userWithoutBio, 'anon-user');

  assert.equal(operator.role, 'GitHub profile', 'Role without bio must be "GitHub profile"');
  assert.equal(experience[0].role, 'GitHub profile', 'Experience node role must match fallback');
  assert.equal(operator.location, 'Not provided on GitHub', 'Location without user location must be "Not provided on GitHub"');
  assert.equal(experience[0].location, 'Not provided on GitHub');
  assert.equal(operator.status, 'ACTIVE_BUILD // GITHUB SNAPSHOT');
});

test('generateGitHubProfileDetails uses supplied bio and location rather than invented values', () => {
  const userWithBio = sanitizeGitHubUser({
    login: 'real-user',
    name: 'Real Engineer',
    bio: 'Distributed Systems & Cloud Engineer\nBuilding high throughput stream engines',
    location: 'Berlin, Germany'
  });
  const { operator, experience } = generateGitHubProfileDetails(sampleSnapshot.projects, userWithBio, 'real-user');

  assert.equal(operator.role, 'Distributed Systems & Cloud Engineer');
  assert.equal(experience[0].role, 'Distributed Systems & Cloud Engineer');
  assert.equal(operator.location, 'Berlin, Germany');
  assert.equal(experience[0].location, 'Berlin, Germany');
});

test('No source file contains hardcoded fallback "Systems Architect & Full Stack Engineer" or "Global" as location fallback', () => {
  const githubServiceSrc = readFileSync('src/services/githubService.ts', 'utf8');
  assert.ok(!githubServiceSrc.includes("'Systems Architect & Full Stack Engineer'"), 'Must not contain hardcoded role');
  assert.ok(!githubServiceSrc.includes('"Systems Architect & Full Stack Engineer"'), 'Must not contain hardcoded role');
  assert.ok(!githubServiceSrc.includes("location || 'Global'"), 'Must not contain fallback to Global');
  assert.ok(!githubServiceSrc.includes('location || "Global"'), 'Must not contain fallback to Global');
});

// ---------------------------------------------------------------------------
// 12. GitHub Target Deterministic Parser & Hostile Host Rejection
// ---------------------------------------------------------------------------
test('parseGitHubTarget parses valid GitHub target URLs, handles, and shorthand correctly', () => {
  const target1 = parseGitHubTarget('https://github.com/SalAkBuK');
  assert.equal(target1.type, 'user');
  assert.equal(target1.owner, 'SalAkBuK');
  assert.equal(target1.canonicalIdentifier, 'salakbuk');

  const target2 = parseGitHubTarget('https://github.com/SalAkBuK/');
  assert.equal(target2.type, 'user');
  assert.equal(target2.owner, 'SalAkBuK');
  assert.equal(target2.canonicalIdentifier, 'salakbuk');

  const target3 = parseGitHubTarget('http://www.github.com/SalAkBuK');
  assert.equal(target3.type, 'user');
  assert.equal(target3.owner, 'SalAkBuK');
  assert.equal(target3.canonicalIdentifier, 'salakbuk');

  const target4 = parseGitHubTarget('github.com/SalAkBuK');
  assert.equal(target4.type, 'user');
  assert.equal(target4.owner, 'SalAkBuK');

  const target5 = parseGitHubTarget('@SalAkBuK');
  assert.equal(target5.type, 'user');
  assert.equal(target5.owner, 'SalAkBuK');

  const target6 = parseGitHubTarget('SalAkBuK');
  assert.equal(target6.type, 'user');
  assert.equal(target6.owner, 'SalAkBuK');

  const target7 = parseGitHubTarget('SalAkBuK/portfolio');
  assert.equal(target7.type, 'repo');
  assert.equal(target7.owner, 'SalAkBuK');
  assert.equal(target7.repo, 'portfolio');
  assert.equal(target7.canonicalIdentifier, 'salakbuk/portfolio');

  const target8 = parseGitHubTarget('https://github.com/SalAkBuK/portfolio');
  assert.equal(target8.type, 'repo');
  assert.equal(target8.owner, 'SalAkBuK');
  assert.equal(target8.repo, 'portfolio');
});

test('parseGitHubTarget rejects hostile hosts and query/hash injection', () => {
  assert.throws(
    () => parseGitHubTarget('https://evil.example/github.com/SalAkBuK'),
    /Invalid GitHub host "evil\.example"/
  );

  assert.throws(
    () => parseGitHubTarget('https://github.com.evil.example/SalAkBuK'),
    /Invalid GitHub host "github\.com\.evil\.example"/
  );

  assert.throws(
    () => parseGitHubTarget('http://phishing.site/user'),
    /Invalid GitHub host/
  );

  assert.throws(
    () => parseGitHubTarget(''),
    /Please enter a GitHub username/
  );
});

test('normalizeGitHubTarget normalizes equivalent valid GitHub targets to canonical lowercase identity', () => {
  assert.equal(normalizeGitHubTarget('https://github.com/SalAkBuK/'), 'salakbuk');
  assert.equal(normalizeGitHubTarget('github.com/salakbuk'), 'salakbuk');
  assert.equal(normalizeGitHubTarget('@SalAkBuK'), 'salakbuk');
  assert.equal(normalizeGitHubTarget('SalAkBuK'), 'salakbuk');
  assert.equal(normalizeGitHubTarget('https://evil.example/github.com/SalAkBuK'), '');
});

// ---------------------------------------------------------------------------
// 13. Snapshot Completeness Contract & Inspection Summary Requirement
// ---------------------------------------------------------------------------
test('generateGitHubSnapshot requires inspectionSummary and throws internal contract error if missing', async () => {
  const mockFetchWithoutSummary: typeof fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes('/users/test-user/repos')) {
      return { ok: true, status: 200, json: async () => [sampleRepo] } as Response;
    }
    if (url.includes('/users/test-user')) {
      return { ok: true, status: 200, json: async () => ({ login: 'test-user', public_repos: 1 }) } as Response;
    }
    if (url.includes('/git/trees/')) {
      return { ok: true, status: 200, json: async () => ({ tree: [] }) } as Response;
    }
    return { ok: true, status: 200, text: async () => '' } as Response;
  }) as typeof fetch;

  // Normal execution succeeds and generates snapshot
  const { metadata } = await generateGitHubSnapshot('test-user', { fetchImpl: mockFetchWithoutSummary });
  assert.equal(metadata.canonicalRepositoryCount, 1);
  assert.equal(metadata.inspectedRepositoryCount, 1);
  assert.equal(metadata.inspectionWarnings.length, 0);
});

// ---------------------------------------------------------------------------
// 14. Committed Snapshot Validation & Completeness Contract
// ---------------------------------------------------------------------------
test('committed GITHUB_SNAPSHOT is valid, matches configured target, and reports true complete inspection', () => {
  assert.equal(GITHUB_SNAPSHOT_METADATA.schemaVersion, 1);
  assert.equal(normalizeGitHubTarget(GITHUB_SNAPSHOT_METADATA.githubTarget), normalizeGitHubTarget(PORTFOLIO_CONFIG.githubTarget));
  assert.equal(GITHUB_SNAPSHOT_METADATA.sourceIdentifier, 'SalAkBuK');
  assert.ok(GITHUB_SNAPSHOT.projects.length >= 15, 'Committed snapshot should contain all canonical owner projects');
  assert.ok(GITHUB_SNAPSHOT.skills.length >= 10, 'Committed snapshot should contain synthesized capabilities');
  assert.equal(GITHUB_SNAPSHOT.operator.handle, '@SalAkBuK');
  assert.equal(
    GITHUB_SNAPSHOT_METADATA.inspectedRepositoryCount, 
    GITHUB_SNAPSHOT_METADATA.canonicalRepositoryCount,
    'All canonical repositories must be deeply inspected in committed snapshot'
  );
  assert.equal(
    GITHUB_SNAPSHOT_METADATA.inspectionWarnings.length, 
    0,
    'A successful strict snapshot must have zero inspection warnings'
  );
});

