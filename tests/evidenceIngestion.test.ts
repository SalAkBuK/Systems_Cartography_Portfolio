import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fetchGitHubUserData,
  discoverGitHubInventory,
  filterEligibleRepositories,
  canonicalizeRepositories,
  generateGitHubProfileDetails,
  GitHubRepoRaw,
  MAX_GITHUB_REPOSITORIES,
  transformGitHubRepoToProject
} from '../src/services/githubService.ts';
import { PORTFOLIO_CONFIG } from '../src/config/portfolioConfig.ts';
import { VERIFIED_EXPERIENCE, VERIFIED_PROJECTS, VERIFIED_SKILLS } from '../src/data/verifiedPortfolioData.ts';
import { matchesProjectClassification } from '../src/utils/portfolioUtils.ts';
import { assembleTopologyLayout } from '../src/utils/topologyLayout.ts';

const repo: GitHubRepoRaw = {
  id: 1,
  name: 'portfolio',
  full_name: 'SalAkBuK/portfolio',
  description: 'Interactive developer portfolio',
  html_url: 'https://github.com/SalAkBuK/portfolio',
  homepage: null,
  stargazers_count: 0,
  forks_count: 0,
  open_issues_count: 0,
  watchers_count: 0,
  language: 'TypeScript',
  topics: ['react'],
  size: 100,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
  pushed_at: '2026-08-01T00:00:00Z',
  archived: false,
  fork: false,
  default_branch: 'main',
  license: null,
  owner: {
    login: 'SalAkBuK',
    avatar_url: 'https://example.com/avatar.png',
    html_url: 'https://github.com/SalAkBuK'
  }
};

test('owner identity and GitHub source live in one self-hosting configuration', () => {
  assert.equal(PORTFOLIO_CONFIG.operator.name, 'Salih Bukhari');
  assert.equal(PORTFOLIO_CONFIG.githubTarget, 'https://github.com/SalAkBuK');
  assert.equal(PORTFOLIO_CONFIG.operator.contact.github, 'https://github.com/SalAkBuK');
});

test('no résumé-derived fallback catalogue is bundled', () => {
  assert.deepEqual(VERIFIED_PROJECTS, []);
  assert.deepEqual(VERIFIED_SKILLS, []);
  assert.deepEqual(VERIFIED_EXPERIENCE, []);
});

test('GitHub repository transformation publishes metadata without invented architecture', () => {
  const project = transformGitHubRepoToProject(repo, 0, 1);

  assert.equal(project.problem, 'Not established by GitHub repository metadata.');
  assert.equal(project.subsystems.length, 0);
  assert.equal(project.keyDecisions.length, 0);
  assert.equal(project.resilienceTesting, 'Not established by GitHub repository metadata.');
  assert.doesNotMatch(JSON.stringify(project), /zero-dependency|zero-regression|99\.98|p99/i);
});

test('GitHub profile generation does not infer career history or private contact channels', () => {
  const project = transformGitHubRepoToProject(repo, 0, 1);
  const result = generateGitHubProfileDetails([project], {
    login: 'SalAkBuK',
    name: null,
    avatar_url: repo.owner.avatar_url,
    bio: null,
    html_url: repo.owner.html_url,
    public_repos: 1,
    followers: 0,
    following: 0,
    company: null,
    location: null,
    blog: null
  }, 'SalAkBuK');

  assert.equal(result.operator.yearsActive, 0);
  assert.equal(result.operator.commitsIndexed, 'Not indexed');
  assert.equal(result.operator.productionUptime, 'Not claimed');
  assert.equal(result.operator.contact.linkedin, '');
  assert.equal(result.operator.contact.matrix, '');
  assert.equal(result.experience.length, 1);
  assert.match(result.experience[0].yearRange, /PUBLIC GITHUB SNAPSHOT/);
});

test('reviewed repositories expose only documented architecture and test evidence', () => {
  const towerdesk = transformGitHubRepoToProject({
    ...repo,
    id: 2,
    name: 'towerdesk-backend-clean',
    full_name: 'SalAkBuK/towerdesk-backend-clean',
    html_url: 'https://github.com/SalAkBuK/towerdesk-backend-clean',
    description: 'Multi-tenant property management backend',
    topics: ['nestjs', 'prisma', 'postgresql']
  }, 0, 1);

  assert.equal(towerdesk.subsystems.length, 5);
  assert.match(towerdesk.architectureNotes, /Repository README/);
  assert.match(towerdesk.resilienceTesting, /Jest integration\/e2e/);
  assert.doesNotMatch(JSON.stringify(towerdesk), /99\.9|SLA|production uptime/i);
});

test('PillCheck repository evidence is mapped directly from the public repository identity', () => {
  const pillcheck = transformGitHubRepoToProject({
    ...repo,
    id: 3,
    name: 'pillcheck-public',
    full_name: 'SalAkBuK/pillcheck-public',
    html_url: 'https://github.com/SalAkBuK/pillcheck-public',
    description: 'Medication reminder app'
  }, 0, 1);

  assert.equal(pillcheck.title, 'pillcheck-public');
  assert.equal(pillcheck.subsystems.length, 4);
  assert.match(pillcheck.architectureNotes, /custom backend/i);
});

test('fetchGitHubUserData discovers all 21 public repositories on a single page', async () => {
  const originalFetch = globalThis.fetch;
  const mockRepos: GitHubRepoRaw[] = Array.from({ length: 21 }, (_, i) => ({
    ...repo,
    id: i + 1,
    name: `repo-${(i + 1).toString().padStart(2, '0')}`,
    full_name: `SalAkBuK/repo-${(i + 1).toString().padStart(2, '0')}`,
    html_url: `https://github.com/SalAkBuK/repo-${(i + 1).toString().padStart(2, '0')}`,
    size: 100 + i * 10
  }));

  const requestedUrls: string[] = [];

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    requestedUrls.push(url);

    if (url.includes('/users/SalAkBuK/repos')) {
      return {
        ok: true,
        status: 200,
        json: async () => mockRepos
      } as Response;
    }

    if (url.includes('/users/SalAkBuK')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          login: 'SalAkBuK',
          name: 'Salih Bukhari',
          avatar_url: 'https://example.com/avatar.png',
          bio: 'Full Stack Engineer',
          html_url: 'https://github.com/SalAkBuK',
          public_repos: 21,
          followers: 0,
          following: 0,
          company: null,
          location: 'Rawalpindi, Pakistan',
          blog: null
        })
      } as Response;
    }

    return {
      ok: false,
      status: 404,
      text: async () => 'Not found'
    } as Response;
  }) as typeof fetch;

  try {
    const result = await discoverGitHubInventory('SalAkBuK');
    assert.equal(result.rawCount, 21, 'Must report rawCount of all 21 repos');
    assert.equal(result.repos.length, 21, 'Must discover all 21 repos');
    assert.ok(requestedUrls.some(u => u.includes('per_page=100')), 'Must request per_page=100');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('discoverGitHubInventory paginates across multiple pages (150 repos) and does not make extra page requests', async () => {
  const originalFetch = globalThis.fetch;
  const page1Repos: GitHubRepoRaw[] = Array.from({ length: 100 }, (_, i) => ({
    ...repo,
    id: i + 1,
    name: `p1-repo-${(i + 1).toString().padStart(3, '0')}`,
    full_name: `SalAkBuK/p1-repo-${(i + 1).toString().padStart(3, '0')}`,
    html_url: `https://github.com/SalAkBuK/p1-repo-${(i + 1).toString().padStart(3, '0')}`,
    size: 100
  }));
  const page2Repos: GitHubRepoRaw[] = Array.from({ length: 50 }, (_, i) => ({
    ...repo,
    id: 101 + i,
    name: `p2-repo-${(i + 1).toString().padStart(3, '0')}`,
    full_name: `SalAkBuK/p2-repo-${(i + 1).toString().padStart(3, '0')}`,
    html_url: `https://github.com/SalAkBuK/p2-repo-${(i + 1).toString().padStart(3, '0')}`,
    size: 100
  }));

  const requestedPages: number[] = [];

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();

    if (url.includes('/users/SalAkBuK/repos')) {
      const pageMatch = url.match(/[?&]page=(\d+)/);
      const pageNum = pageMatch ? parseInt(pageMatch[1], 10) : 1;
      requestedPages.push(pageNum);

      if (pageNum === 1) {
        return { ok: true, status: 200, json: async () => page1Repos } as Response;
      }
      if (pageNum === 2) {
        return { ok: true, status: 200, json: async () => page2Repos } as Response;
      }
      return { ok: true, status: 200, json: async () => [] } as Response;
    }

    if (url.includes('/users/SalAkBuK')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          login: 'SalAkBuK',
          name: 'Salih Bukhari',
          avatar_url: 'https://example.com/avatar.png',
          bio: 'Full Stack Engineer',
          html_url: 'https://github.com/SalAkBuK',
          public_repos: 150,
          followers: 0,
          following: 0,
          company: null,
          location: 'Rawalpindi, Pakistan',
          blog: null
        })
      } as Response;
    }

    return { ok: false, status: 404, text: async () => 'Not found' } as Response;
  }) as typeof fetch;

  try {
    const result = await discoverGitHubInventory('SalAkBuK');
    assert.equal(result.rawCount, 150, 'Must record rawCount of 150');
    assert.equal(result.repos.length, 150, 'Must include all 150 discovered repositories');
    assert.deepEqual(requestedPages, [1, 2], 'Must request exactly page 1 and page 2 without extra page 3');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('discoverGitHubInventory paginates cleanly across full boundary (200 repos)', async () => {
  const originalFetch = globalThis.fetch;
  const page1Repos: GitHubRepoRaw[] = Array.from({ length: 100 }, (_, i) => ({
    ...repo,
    id: i + 1,
    name: `p1-repo-${(i + 1).toString().padStart(3, '0')}`,
    full_name: `SalAkBuK/p1-repo-${(i + 1).toString().padStart(3, '0')}`,
    html_url: `https://github.com/SalAkBuK/p1-repo-${(i + 1).toString().padStart(3, '0')}`,
    size: 100
  }));
  const page2Repos: GitHubRepoRaw[] = Array.from({ length: 100 }, (_, i) => ({
    ...repo,
    id: 101 + i,
    name: `p2-repo-${(i + 1).toString().padStart(3, '0')}`,
    full_name: `SalAkBuK/p2-repo-${(i + 1).toString().padStart(3, '0')}`,
    html_url: `https://github.com/SalAkBuK/p2-repo-${(i + 1).toString().padStart(3, '0')}`,
    size: 100
  }));

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();

    if (url.includes('/users/SalAkBuK/repos')) {
      const pageMatch = url.match(/[?&]page=(\d+)/);
      const pageNum = pageMatch ? parseInt(pageMatch[1], 10) : 1;

      if (pageNum === 1) return { ok: true, status: 200, json: async () => page1Repos } as Response;
      if (pageNum === 2) return { ok: true, status: 200, json: async () => page2Repos } as Response;
      if (pageNum === 3) return { ok: true, status: 200, json: async () => [] } as Response;
    }

    if (url.includes('/users/SalAkBuK')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          login: 'SalAkBuK',
          name: 'Salih Bukhari',
          avatar_url: 'https://example.com/avatar.png',
          public_repos: 200
        })
      } as Response;
    }

    return { ok: false, status: 404, text: async () => 'Not found' } as Response;
  }) as typeof fetch;

  try {
    const result = await discoverGitHubInventory('SalAkBuK');
    assert.equal(result.rawCount, 200);
    assert.equal(result.repos.length, 200);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('discoverGitHubInventory reports the defensive repository cap honestly', async () => {
  const originalFetch = globalThis.fetch;
  const pages = [0, 1, 2].map(pageIndex => Array.from({ length: 100 }, (_, index) => {
    const id = pageIndex * 100 + index + 1;
    return {
      ...repo,
      id,
      name: `repo-${id}`,
      full_name: `SalAkBuK/repo-${id}`,
      html_url: `https://github.com/SalAkBuK/repo-${id}`
    };
  }));
  const requestedPages: number[] = [];

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = input.toString();
    if (url.includes('/users/SalAkBuK/repos')) {
      const page = Number(url.match(/[?&]page=(\d+)/)?.[1] || 1);
      requestedPages.push(page);
      return { ok: true, status: 200, json: async () => pages[page - 1] || [] } as Response;
    }
    if (url.includes('/users/SalAkBuK')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ login: 'SalAkBuK', public_repos: 300 })
      } as Response;
    }
    if (url.includes('/git/trees/')) {
      return { ok: true, status: 200, json: async () => ({ truncated: false, tree: [] }) } as Response;
    }
    return { ok: false, status: 404 } as Response;
  }) as typeof fetch;

  try {
    const result = await discoverGitHubInventory('SalAkBuK');
    assert.equal(result.repos.length, MAX_GITHUB_REPOSITORIES);
    assert.equal(result.rawCount, 300, 'rawCount must reflect the account inventory, not the retained slice');
    assert.equal(result.repositoryInventoryTruncated, true);
    assert.equal(result.warnings.length, 1);
    assert.match(result.warnings[0], /truncated.*retained 250.*at least 300/i);
    assert.deepEqual(requestedPages, [1, 2, 3]);

    const syncResult = await fetchGitHubUserData('SalAkBuK', {
      inspectionConcurrency: 25,
      schedulerOptions: { maxConcurrency: 25, minSpacingMs: 0, maxRetries: 0 }
    });
    assert.equal(syncResult.rawCount, 300);
    assert.equal(syncResult.repositoryInventoryTruncated, true);
    assert.equal(syncResult.inspectionSummary?.canonicalRepositoryCount, 250);
    assert.equal(syncResult.inspectionSummary?.inspectedRepositoryCount, 250);
    assert.match(syncResult.inspectionSummary?.warnings[0] || '', /inventory truncated/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('discoverGitHubInventory rejects honestly on later-page failure without returning partial repos', async () => {
  const originalFetch = globalThis.fetch;
  const page1Repos: GitHubRepoRaw[] = Array.from({ length: 100 }, (_, i) => ({
    ...repo,
    id: i + 1,
    name: `p1-repo-${(i + 1).toString().padStart(3, '0')}`,
    full_name: `SalAkBuK/p1-repo-${(i + 1).toString().padStart(3, '0')}`,
    html_url: `https://github.com/SalAkBuK/p1-repo-${(i + 1).toString().padStart(3, '0')}`,
    size: 100
  }));

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();

    if (url.includes('/users/SalAkBuK/repos')) {
      const pageMatch = url.match(/[?&]page=(\d+)/);
      const pageNum = pageMatch ? parseInt(pageMatch[1], 10) : 1;

      if (pageNum === 1) {
        return { ok: true, status: 200, json: async () => page1Repos } as Response;
      }
      return { ok: false, status: 500, statusText: 'Internal Server Error' } as Response;
    }

    if (url.includes('/users/SalAkBuK')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          login: 'SalAkBuK',
          name: 'Salih Bukhari',
          avatar_url: 'https://example.com/avatar.png',
          public_repos: 200
        })
      } as Response;
    }

    return { ok: false, status: 404, text: async () => 'Not found' } as Response;
  }) as typeof fetch;

  try {
    await assert.rejects(
      async () => {
        await discoverGitHubInventory('SalAkBuK');
      },
      /fetching all repositories for "SalAkBuK" while requesting page 2/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('canonical and sanitized TowerDesk repositories deduplicate to 3 logical projects', () => {
  const towerdeskClusterRepos: GitHubRepoRaw[] = [
    { ...repo, id: 101, name: 'towerdesk-backend', full_name: 'SalAkBuK/towerdesk-backend', html_url: 'https://github.com/SalAkBuK/towerdesk-backend', size: 500 },
    { ...repo, id: 102, name: 'towerdesk-backend-clean', full_name: 'SalAkBuK/towerdesk-backend-clean', html_url: 'https://github.com/SalAkBuK/towerdesk-backend-clean', size: 500 },
    { ...repo, id: 103, name: 'tower-desk', full_name: 'SalAkBuK/tower-desk', html_url: 'https://github.com/SalAkBuK/tower-desk', size: 400 },
    { ...repo, id: 104, name: 'tower-desk-clean', full_name: 'SalAkBuK/tower-desk-clean', html_url: 'https://github.com/SalAkBuK/tower-desk-clean', size: 400 },
    { ...repo, id: 105, name: 'binghatti-concierge-app-rn-expo', full_name: 'SalAkBuK/binghatti-concierge-app-rn-expo', html_url: 'https://github.com/SalAkBuK/binghatti-concierge-app-rn-expo', size: 300 },
    { ...repo, id: 106, name: 'towerdesk-mobile-app', full_name: 'SalAkBuK/towerdesk-mobile-app', html_url: 'https://github.com/SalAkBuK/towerdesk-mobile-app', size: 300 }
  ];

  const canonical = canonicalizeRepositories(filterEligibleRepositories(towerdeskClusterRepos));
  assert.equal(canonical.length, 3, 'The TowerDesk repos collapse into exactly 3 logical presentation surfaces');
  const titles = canonical.map(p => p.name);
  assert.ok(titles.includes('towerdesk-backend'));
  assert.ok(titles.includes('tower-desk'));
  assert.ok(titles.includes('towerdesk-mobile-app'));
});

test('FormCrash is multi-classified and discoverable under TOOL and FULL filters without duplication', () => {
  const formcrashRepo: GitHubRepoRaw = {
    ...repo,
    id: 50,
    name: 'formcrash',
    full_name: 'SalAkBuK/formcrash',
    html_url: 'https://github.com/SalAkBuK/formcrash',
    description: 'A local-first resilience testing workbench for browser flows',
    language: 'TypeScript',
    topics: ['resilience-testing', 'playwright', 'fastify', 'nextjs', 'sqlite']
  };

  const project = transformGitHubRepoToProject(formcrashRepo, 0, 1);

  // FormCrash is ONE ProjectData node
  assert.equal(project.title, 'formcrash');
  assert.equal(project.category, 'tooling');
  assert.ok(project.classifications?.includes('tooling'));
  assert.ok(project.classifications?.includes('fullstack'));

  // Centralized filter matcher
  assert.equal(matchesProjectClassification(project, 'tooling'), true, 'Must match TOOL filter');
  assert.equal(matchesProjectClassification(project, 'fullstack'), true, 'Must match FULL filter');
  assert.equal(matchesProjectClassification(project, 'all'), true, 'Must match ALL filter');
  assert.equal(matchesProjectClassification(project, 'infrastructure'), false, 'Must not match INFRA filter');
});

test('ordinary full-stack application with test frameworks does not automatically match TOOL', () => {
  const fullstackAppRepo: GitHubRepoRaw = {
    ...repo,
    id: 60,
    name: 'ecommerce-portal',
    full_name: 'SalAkBuK/ecommerce-portal',
    html_url: 'https://github.com/SalAkBuK/ecommerce-portal',
    description: 'A customer-facing online store with cart, checkout, and inventory catalog',
    language: 'TypeScript',
    topics: ['react', 'nextjs', 'postgres', 'jest', 'playwright']
  };

  const project = transformGitHubRepoToProject(fullstackAppRepo, 0, 1);

  assert.equal(project.category, 'fullstack');
  assert.equal(matchesProjectClassification(project, 'tooling'), false, 'Ordinary app with tests must not match TOOL filter');
  assert.equal(matchesProjectClassification(project, 'fullstack'), true, 'Must match FULL filter');
});

test('frontend app whose README contains "## Testing" section does not become tooling', () => {
  const frontendAppRepo: GitHubRepoRaw = {
    ...repo,
    id: 61,
    name: 'marketing-site',
    full_name: 'SalAkBuK/marketing-site',
    html_url: 'https://github.com/SalAkBuK/marketing-site',
    description: 'Corporate marketing website and component library',
    language: 'TypeScript',
    topics: ['react', 'tailwind', 'vite']
  };

  const project = transformGitHubRepoToProject(frontendAppRepo, 0, 1);

  assert.equal(project.category, 'frontend');
  assert.equal(matchesProjectClassification(project, 'tooling'), false, 'Frontend app with tests in README must not match TOOL filter');
  assert.equal(matchesProjectClassification(project, 'frontend'), true, 'Must match FRONTEND filter');
});

test('backend service with test frameworks remains backend and not tooling', () => {
  const backendRepo: GitHubRepoRaw = {
    ...repo,
    id: 62,
    name: 'billing-service',
    full_name: 'SalAkBuK/billing-service',
    html_url: 'https://github.com/SalAkBuK/billing-service',
    description: 'Payment gateway webhooks and invoicing backend service',
    language: 'Go',
    topics: ['api', 'grpc', 'postgres', 'unit-tests']
  };

  const project = transformGitHubRepoToProject(backendRepo, 0, 1);

  assert.equal(project.category, 'backend');
  assert.equal(matchesProjectClassification(project, 'tooling'), false, 'Backend service with unit tests must not match TOOL filter');
  assert.equal(matchesProjectClassification(project, 'backend'), true, 'Must match BACKEND filter');
});

test('assembleTopologyLayout operates strictly on projects and skills without accepting experience', () => {
  const mockProjects = [transformGitHubRepoToProject(repo, 0, 1)];
  const { projectPositions, skillPositions } = assembleTopologyLayout(mockProjects, VERIFIED_SKILLS);

  // Assert positions generated for projects and skills only
  assert.ok(projectPositions[mockProjects[0].id], 'Project position must be generated');
  assert.equal(Object.keys(projectPositions).length, mockProjects.length);
  assert.equal(Object.keys(skillPositions).length, VERIFIED_SKILLS.length);
});

test('summary provenance is VERIFIED from GitHub metadata while challenge and solution remain UNAVAILABLE', () => {
  const physioBotRepo: GitHubRepoRaw = {
    ...repo,
    id: 70,
    name: 'physio_bot',
    full_name: 'SalAkBuK/physio_bot',
    html_url: 'https://github.com/SalAkBuK/physio_bot',
    description: 'Whatsapp Bot for Physio appointments automations with google sheets x n8n',
    language: 'JavaScript',
    topics: ['n8n', 'whatsapp']
  };

  const project = transformGitHubRepoToProject(physioBotRepo, 0, 1);

  // Summary accurately sourced from GitHub metadata has VERIFIED provenance
  assert.equal(project.provenance?.summary, 'VERIFIED', 'System summary provenance must be VERIFIED from GitHub metadata');
  
  // Without inspected challenge/solution or curated evidence, engineering challenge and solution remain UNAVAILABLE
  assert.equal(project.provenance?.problem, 'UNAVAILABLE', 'Engineering challenge must remain UNAVAILABLE without evidence');
  assert.equal(project.provenance?.solution, 'UNAVAILABLE', 'Architectural solution must remain UNAVAILABLE without evidence');
  assert.ok(project.summary.includes('Whatsapp Bot for Physio appointments automations'));
});

test('uninspected repository with strong tooling phrase in GitHub description classifies as tooling', () => {
  const cliToolRepo: GitHubRepoRaw = {
    ...repo,
    id: 71,
    name: 'schema-validator',
    full_name: 'SalAkBuK/schema-validator',
    html_url: 'https://github.com/SalAkBuK/schema-validator',
    description: 'A developer tool and CLI tool for validating Prisma models and database migrations',
    language: 'TypeScript',
    topics: []
  };

  // Transformed without deep inspection (inspectionParam undefined)
  const project = transformGitHubRepoToProject(cliToolRepo, 0, 1);

  assert.equal(project.category, 'tooling', 'Repo with CLI tool / developer tool in description must classify as tooling');
  assert.equal(matchesProjectClassification(project, 'tooling'), true);
});



