import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fetchGitHubUserData,
  generateGitHubProfileDetails,
  GitHubRepoRaw,
  transformGitHubRepoToProject
} from '../src/services/githubService.ts';
import { PORTFOLIO_CONFIG } from '../src/config/portfolioConfig.ts';
import { VERIFIED_EXPERIENCE, VERIFIED_PROJECTS, VERIFIED_SKILLS } from '../src/data/verifiedPortfolioData.ts';
import { matchesProjectClassification } from '../src/utils/portfolioUtils.ts';
import { createTopologyGraph } from '../src/utils/forceLayout.ts';

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
    const result = await fetchGitHubUserData('SalAkBuK');
    assert.equal(result.rawCount, 21, 'Must report rawCount of all 21 repos');
    assert.equal(result.projects.length, 21, 'Must transform all 21 eligible repos');
    assert.ok(requestedUrls.some(u => u.includes('per_page=100')), 'Must request per_page=100');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fetchGitHubUserData paginates across multiple pages (150 repos) and does not make extra page requests', async () => {
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
    const result = await fetchGitHubUserData('SalAkBuK');
    assert.equal(result.rawCount, 150, 'Must record rawCount of 150');
    assert.equal(result.projects.length, 150, 'Must include all 150 eligible projects');
    assert.deepEqual(requestedPages, [1, 2], 'Must request exactly page 1 and page 2 without extra page 3');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fetchGitHubUserData paginates cleanly across full boundary (200 repos)', async () => {
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
    const result = await fetchGitHubUserData('SalAkBuK');
    assert.equal(result.rawCount, 200);
    assert.equal(result.projects.length, 200);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fetchGitHubUserData rejects honestly on later-page failure without returning partial repos', async () => {
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
        await fetchGitHubUserData('SalAkBuK');
      },
      /Failed to fetch all repositories for "SalAkBuK" while requesting page 2/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('canonical and sanitized TowerDesk repositories deduplicate to 3 logical projects', async () => {
  const originalFetch = globalThis.fetch;
  const towerdeskClusterRepos: GitHubRepoRaw[] = [
    { ...repo, id: 101, name: 'towerdesk-backend', full_name: 'SalAkBuK/towerdesk-backend', html_url: 'https://github.com/SalAkBuK/towerdesk-backend', size: 500 },
    { ...repo, id: 102, name: 'towerdesk-backend-clean', full_name: 'SalAkBuK/towerdesk-backend-clean', html_url: 'https://github.com/SalAkBuK/towerdesk-backend-clean', size: 500 },
    { ...repo, id: 103, name: 'tower-desk', full_name: 'SalAkBuK/tower-desk', html_url: 'https://github.com/SalAkBuK/tower-desk', size: 400 },
    { ...repo, id: 104, name: 'tower-desk-clean', full_name: 'SalAkBuK/tower-desk-clean', html_url: 'https://github.com/SalAkBuK/tower-desk-clean', size: 400 },
    { ...repo, id: 105, name: 'binghatti-concierge-app-rn-expo', full_name: 'SalAkBuK/binghatti-concierge-app-rn-expo', html_url: 'https://github.com/SalAkBuK/binghatti-concierge-app-rn-expo', size: 300 },
    { ...repo, id: 106, name: 'towerdesk-mobile-showcase', full_name: 'SalAkBuK/towerdesk-mobile-showcase', html_url: 'https://github.com/SalAkBuK/towerdesk-mobile-showcase', size: 300 }
  ];

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes('/users/SalAkBuK/repos')) {
      return { ok: true, status: 200, json: async () => towerdeskClusterRepos } as Response;
    }
    if (url.includes('/users/SalAkBuK')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ login: 'SalAkBuK', name: 'Salih Bukhari', avatar_url: 'https://example.com/avatar.png', public_repos: 6 })
      } as Response;
    }
    return { ok: false, status: 404, text: async () => 'Not found' } as Response;
  }) as typeof fetch;

  try {
    const result = await fetchGitHubUserData('SalAkBuK');
    assert.equal(result.rawCount, 6, 'All 6 raw repos are retrieved from GitHub');
    assert.equal(result.projects.length, 3, 'The 6 TowerDesk repos collapse into exactly 3 logical presentation surfaces');
    const titles = result.projects.map(p => p.title);
    assert.ok(titles.includes('towerdesk-backend-clean'));
    assert.ok(titles.includes('tower-desk-clean'));
    assert.ok(titles.includes('towerdesk-mobile-showcase'));
  } finally {
    globalThis.fetch = originalFetch;
  }
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

test('createTopologyGraph operates strictly on projects and skills without accepting experience', () => {
  const mockProjects = [transformGitHubRepoToProject(repo, 0, 1)];
  const graph = createTopologyGraph(mockProjects, VERIFIED_SKILLS);

  // Assert all node types are project or skill only
  for (const node of graph.nodes.values()) {
    assert.ok(node.type === 'project' || node.type === 'skill', 'Node type must be project or skill only');
    assert.notEqual(node.type, 'experience', 'Experience must never be a force-layout node');
  }

  // Assert all edges are between project and skill only
  for (const edge of graph.edges) {
    assert.ok(edge.sourceType === 'project' || edge.sourceType === 'skill');
    assert.ok(edge.targetType === 'project' || edge.targetType === 'skill');
  }
});


