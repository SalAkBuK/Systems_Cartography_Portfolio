import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { 
  resolveGitHubSnapshotForTarget, 
  normalizeGitHubTarget 
} from '../src/utils/portfolioUtils.ts';
import { 
  runWithConcurrency, 
  fetchRepoInspection, 
  fetchGitHubUserData, 
  GitHubRepoRaw 
} from '../src/services/githubService.ts';
import { analyzeDependencies } from '../src/services/repositoryAnalyzer/dependencyAnalyzer.ts';
import { analyzeRepository } from '../src/services/repositoryAnalyzer/index.ts';
import { serializeGitHubSnapshot } from '../scripts/sync-github-snapshot.ts';
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
test('fetchGitHubUserData throws actionable rate-limit error on 403 response with x-ratelimit-reset header', async () => {
  const resetUnix = Math.floor(Date.now() / 1000) + 3600;
  const mockFetch: typeof fetch = (async () => {
    return {
      ok: false,
      status: 403,
      headers: {
        get: (name: string) => {
          if (name.toLowerCase() === 'x-ratelimit-remaining') return '0';
          if (name.toLowerCase() === 'x-ratelimit-reset') return resetUnix.toString();
          return null;
        }
      }
    } as unknown as Response;
  }) as typeof fetch;

  await assert.rejects(
    async () => {
      await fetchGitHubUserData('test-user', { fetchImpl: mockFetch });
    },
    /GitHub API rate limit exhausted while fetching GitHub profile.*Provide GITHUB_TOKEN/
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
        fetchImpl: mockFetch,
        strictInspection: true
      });
    },
    /Tree truncated for "test-user\/big-repo"/
  );
});

// ---------------------------------------------------------------------------
// 6. Multi-Manifest Dependency Extraction & Ecosystem Analysis
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

test('analyzeDependencies extracts PHP dependencies from composer.json', () => {
  const inspection = {
    manifestContents: {
      'composer.json': JSON.stringify({
        require: {
          'laravel/framework': '^11.0',
          'doctrine/orm': '^3.0'
        },
        'require-dev': {
          'phpunit/phpunit': '^11.0'
        }
      })
    },
    treeFiles: ['composer.json']
  };

  const deps = analyzeDependencies(inspection);
  assert.equal(deps.primaryEcosystem, 'PHP');
  assert.ok(deps.frameworks.backend.includes('Laravel'));
  assert.ok(deps.frameworks.database.includes('Doctrine'));
  assert.ok(deps.frameworks.testing.includes('PHPUnit'));
});

test('analyzeDependencies extracts Go dependencies from go.mod', () => {
  const goModContent = `
module github.com/test-user/stream-engine

go 1.22

require (
\tgithub.com/gin-gonic/gin v1.9.1
\tgoogle.golang.org/grpc v1.62.0
\tgithub.com/jackc/pgx v5.5.0
\tgithub.com/stretchr/testify v1.8.4
)
`;

  const inspection = {
    manifestContents: {
      'go.mod': goModContent
    },
    treeFiles: ['go.mod', 'main.go']
  };

  const deps = analyzeDependencies(inspection);
  assert.equal(deps.primaryEcosystem, 'Go');
  assert.ok(deps.frameworks.backend.includes('Go Module'));
  assert.ok(deps.frameworks.backend.includes('Gin'));
  assert.ok(deps.frameworks.backend.includes('gRPC'));
  assert.ok(deps.frameworks.database.includes('PostgreSQL Driver'));
  assert.ok(deps.frameworks.testing.includes('Testify'));
});

test('analyzeDependencies extracts Rust dependencies from Cargo.toml', () => {
  const cargoTomlContent = `
[package]
name = "event-broker"
version = "0.1.0"
edition = "2021"

[dependencies]
axum = "0.7"
tokio = { version = "1.0", features = ["full"] }
sqlx = { version = "0.7", features = ["postgres"] }
serde = { version = "1.0", features = ["derive"] }
`;

  const inspection = {
    manifestContents: {
      'Cargo.toml': cargoTomlContent
    },
    treeFiles: ['Cargo.toml', 'src/main.rs']
  };

  const deps = analyzeDependencies(inspection);
  assert.equal(deps.primaryEcosystem, 'Rust');
  assert.ok(deps.frameworks.backend.includes('Cargo / Rust'));
  assert.ok(deps.frameworks.backend.includes('Axum'));
  assert.ok(deps.frameworks.backend.includes('Tokio'));
  assert.ok(deps.frameworks.database.includes('SQLx'));
  assert.ok(deps.frameworks.tools.includes('Serde'));
});

test('analyzeDependencies extracts Python dependencies from requirements.txt and pyproject.toml', () => {
  const requirementsContent = `
fastapi==0.110.0
sqlalchemy>=2.0.0
pytest>=8.0.0
pydantic>=2.0.0
celery>=5.3.0
`;

  const inspection = {
    manifestContents: {
      'requirements.txt': requirementsContent
    },
    treeFiles: ['requirements.txt', 'app.py']
  };

  const deps = analyzeDependencies(inspection);
  assert.equal(deps.primaryEcosystem, 'Python');
  assert.ok(deps.frameworks.backend.includes('FastAPI'));
  assert.ok(deps.frameworks.database.includes('SQLAlchemy'));
  assert.ok(deps.frameworks.testing.includes('pytest'));
  assert.ok(deps.frameworks.tools.includes('Pydantic'));
  assert.ok(deps.frameworks.backend.includes('Celery'));
});

test('analyzeDependencies ignores unknown packages without inventing capabilities', () => {
  const inspection = {
    packageJsonContent: JSON.stringify({
      dependencies: {
        'some-random-internal-lib': '1.0.0',
        'foo-bar-baz-custom': '0.0.1'
      }
    }),
    treeFiles: ['package.json']
  };

  const deps = analyzeDependencies(inspection);
  assert.deepEqual(deps.frameworks.frontend, []);
  assert.deepEqual(deps.frameworks.backend, []);
  assert.deepEqual(deps.frameworks.database, []);
});

// ---------------------------------------------------------------------------
// 7. Reviewed Repository Evidence Precedence
// ---------------------------------------------------------------------------
test('analyzeRepository gives reviewed repository evidence precedence over generic parsed signals', () => {
  const towerdeskRepo: GitHubRepoRaw = {
    ...sampleRepo,
    id: 101,
    name: 'towerdesk-backend-clean',
    full_name: 'SalAkBuK/towerdesk-backend-clean',
    html_url: 'https://github.com/SalAkBuK/towerdesk-backend-clean'
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
// 8. Snapshot Serializer Contract & Safety
// ---------------------------------------------------------------------------
test('serializeGitHubSnapshot produces valid TypeScript module without leaking tokens or local paths', () => {
  const output = serializeGitHubSnapshot(sampleMetadata, sampleSnapshot);
  assert.ok(output.includes('export const GITHUB_SNAPSHOT_METADATA: GitHubSnapshotMetadata = {'));
  assert.ok(output.includes('export const GITHUB_SNAPSHOT: GitHubSyncResult = {'));
  assert.ok(!output.includes('token'), 'Snapshot must not contain tokens');
  assert.ok(!output.includes('ghp_'), 'Snapshot must not contain GitHub PATs');
  assert.ok(!output.includes('C:\\'), 'Snapshot must not contain Windows local paths');
});

// ---------------------------------------------------------------------------
// 9. Committed Snapshot Validation
// ---------------------------------------------------------------------------
test('committed GITHUB_SNAPSHOT is valid, matches configured target, and contains projects', () => {
  assert.equal(GITHUB_SNAPSHOT_METADATA.schemaVersion, 1);
  assert.equal(normalizeGitHubTarget(GITHUB_SNAPSHOT_METADATA.githubTarget), normalizeGitHubTarget(PORTFOLIO_CONFIG.githubTarget));
  assert.equal(GITHUB_SNAPSHOT_METADATA.sourceIdentifier, 'SalAkBuK');
  assert.ok(GITHUB_SNAPSHOT.projects.length >= 15, 'Committed snapshot should contain all canonical owner projects');
  assert.ok(GITHUB_SNAPSHOT.skills.length >= 10, 'Committed snapshot should contain synthesized capabilities');
  assert.equal(GITHUB_SNAPSHOT.operator.handle, '@SalAkBuK');
});
