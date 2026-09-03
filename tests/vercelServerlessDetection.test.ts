import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  analyzeVercelFunctions,
  isVercelDeploymentConfigPath,
  isVercelServerlessFunctionPath,
} from '../src/services/repositoryAnalyzer/vercelFunctionAnalyzer.ts';
import { analyzeDependencies } from '../src/services/repositoryAnalyzer/dependencyAnalyzer.ts';
import { analyzeRepository } from '../src/services/repositoryAnalyzer/index.ts';
import type { RawRepositoryInspection } from '../src/services/repositoryAnalyzer/types.ts';
import {
  GitHubRepoRaw,
  transformGitHubRepoToProject,
  generateGitHubProfileDetails,
} from '../src/services/githubService.ts';
import {
  normalizeTechnologyName,
  getTechnologyFamilies,
  projectUsesCapability,
  RECOGNIZED_CAPABILITY_TAXONOMY,
} from '../src/utils/capabilityAssociations.ts';

/**
 * GENERIC structural detection of Vercel serverless API functions.
 *
 * The immediate evidence gap is a Vite + React repository that also ships real
 * `api/*.ts` Vercel functions (no Express/Fastify/Nest) and therefore looked
 * frontend-only. These tests use SYNTHETIC repositories (`sample-vercel-app`,
 * etc.) so nothing is proven by repository name.
 *
 * Rule: a Vercel serverless-function signal requires BOTH
 *   (a) root Vercel deployment config (`vercel.json`; legacy `now.json` is NOT
 *       accepted -- Vercel removed support for it on 2026-03-31), AND
 *   (b) >=1 valid ROOT `api/**\/*.{ts,js,mjs,cjs}` function path.
 */

function repoFixture(overrides: Partial<GitHubRepoRaw> = {}): GitHubRepoRaw {
  return {
    id: 70001,
    name: 'sample-vercel-app',
    full_name: 'acme/sample-vercel-app',
    description: 'Interactive dashboard with a live data API',
    html_url: 'https://github.com/acme/sample-vercel-app',
    homepage: null,
    stargazers_count: 3,
    forks_count: 0,
    open_issues_count: 1,
    watchers_count: 3,
    language: 'TypeScript',
    topics: [],
    size: 900,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
    pushed_at: '2026-06-01T00:00:00Z',
    archived: false,
    fork: false,
    default_branch: 'main',
    license: null,
    owner: {
      login: 'acme',
      avatar_url: 'https://example.com/a.png',
      html_url: 'https://github.com/acme',
    },
    ...overrides,
  };
}

const TS_NODE_PACKAGE_JSON = JSON.stringify({
  name: 'sample-vercel-app',
  type: 'module',
  devDependencies: { typescript: '^5.8.0', '@types/node': '^22.0.0' },
});

const REACT_TS_NODE_PACKAGE_JSON = JSON.stringify({
  name: 'sample-vercel-app',
  type: 'module',
  dependencies: { react: '^19.0.0', 'react-dom': '^19.0.0' },
  devDependencies: { typescript: '^5.8.0', '@types/node': '^22.0.0', vite: '^6.0.0' },
});

// ---------------------------------------------------------------------------
// 1. Path predicates
// ---------------------------------------------------------------------------
test('isVercelDeploymentConfigPath accepts ONLY a root vercel.json (legacy now.json rejected, support removed 2026-03-31)', () => {
  assert.equal(isVercelDeploymentConfigPath('vercel.json'), true);
  assert.equal(isVercelDeploymentConfigPath('./vercel.json'), true);

  assert.equal(isVercelDeploymentConfigPath('now.json'), false, 'legacy now.json is not current deployment evidence');
  assert.equal(isVercelDeploymentConfigPath('apps/web/vercel.json'), false, 'nested config is not root-authoritative');
  assert.equal(isVercelDeploymentConfigPath('config/vercel.json'), false, 'nested config is not root-authoritative');
  assert.equal(isVercelDeploymentConfigPath('vercel.jsonc'), false);
  assert.equal(isVercelDeploymentConfigPath('package.json'), false);
  assert.equal(isVercelDeploymentConfigPath(''), false);
});

test('isVercelServerlessFunctionPath accepts root api/ JS-family sources, including nested routes', () => {
  assert.equal(isVercelServerlessFunctionPath('api/example.ts'), true);
  assert.equal(isVercelServerlessFunctionPath('api/github-live.ts'), true);
  assert.equal(isVercelServerlessFunctionPath('api/contact.js'), true);
  assert.equal(isVercelServerlessFunctionPath('api/cron.mjs'), true);
  assert.equal(isVercelServerlessFunctionPath('api/legacy.cjs'), true);
  assert.equal(isVercelServerlessFunctionPath('api/users/[id].ts'), true, 'nested dynamic route');
  assert.equal(isVercelServerlessFunctionPath('api/v1/orders/[orderId]/items.ts'), true, 'deep nested route');
});

test('isVercelServerlessFunctionPath rejects non-root api/, non-source files, and lookalikes', () => {
  assert.equal(isVercelServerlessFunctionPath('src/api/example.ts'), false);
  assert.equal(isVercelServerlessFunctionPath('docs/api/example.ts'), false);
  assert.equal(isVercelServerlessFunctionPath('examples/api/example.ts'), false);
  assert.equal(isVercelServerlessFunctionPath('packages/web/api/example.ts'), false);
  assert.equal(isVercelServerlessFunctionPath('apiv2/example.ts'), false, 'the trailing slash on api/ is required');
  assert.equal(isVercelServerlessFunctionPath('api'), false, 'the directory itself is not a function');
  assert.equal(isVercelServerlessFunctionPath('api/README.md'), false);
  assert.equal(isVercelServerlessFunctionPath('api/openapi.json'), false);
  assert.equal(isVercelServerlessFunctionPath('api/types.d.ts'), false, 'type declarations are not functions');
  assert.equal(isVercelServerlessFunctionPath('api/example.test.ts'), false, 'co-located tests are not functions');
  assert.equal(isVercelServerlessFunctionPath('api/example.spec.js'), false);
});

// ---------------------------------------------------------------------------
// 2. analyzeVercelFunctions — requires BOTH signals
// ---------------------------------------------------------------------------
test('analyzeVercelFunctions reports Node.js + Vercel Functions when config AND a function path both exist', () => {
  const result = analyzeVercelFunctions(['vercel.json', 'package.json', 'api/example.ts', 'src/App.tsx']);
  assert.equal(result.isVercelServerlessProject, true);
  assert.deepEqual(result.technologies, ['Node.js', 'Vercel Functions']);
  assert.deepEqual(result.functionPaths, ['api/example.ts']);
});

test('analyzeVercelFunctions detects a nested dynamic route as the sole function', () => {
  const result = analyzeVercelFunctions(['vercel.json', 'api/users/[id].ts']);
  assert.equal(result.isVercelServerlessProject, true);
  assert.deepEqual(result.functionPaths, ['api/users/[id].ts']);
});

test('analyzeVercelFunctions does NOT fire on legacy now.json + api/foo.ts (now.json is not current Vercel deployment evidence)', () => {
  const result = analyzeVercelFunctions(['now.json', 'api/foo.ts', 'api/users/[id].ts', 'package.json']);
  assert.equal(result.isVercelServerlessProject, false);
  assert.equal(result.hasVercelDeploymentConfig, false, 'now.json does not count as a deployment config');
  assert.deepEqual(result.technologies, []);
});

test('analyzeVercelFunctions does NOT fire on a Vercel config with no root api/ function (Vercel-hosted frontend)', () => {
  const result = analyzeVercelFunctions(['vercel.json', 'src/main.tsx', 'src/api/client.ts', 'docs/api/notes.ts']);
  assert.equal(result.isVercelServerlessProject, false);
  assert.equal(result.hasVercelDeploymentConfig, true);
  assert.deepEqual(result.functionPaths, []);
  assert.deepEqual(result.technologies, []);
});

test('analyzeVercelFunctions does NOT fire on api/ functions with no Vercel deployment signal (conservative rule)', () => {
  const result = analyzeVercelFunctions(['api/example.ts', 'api/users/[id].ts', 'package.json']);
  assert.equal(result.isVercelServerlessProject, false);
  assert.equal(result.hasVercelDeploymentConfig, false);
  assert.deepEqual(result.technologies, []);
});

test('analyzeVercelFunctions tolerates empty / missing tree input', () => {
  assert.equal(analyzeVercelFunctions(undefined).isVercelServerlessProject, false);
  assert.equal(analyzeVercelFunctions([]).isVercelServerlessProject, false);
});

// ---------------------------------------------------------------------------
// 3. Dependency analysis integration
// ---------------------------------------------------------------------------
test('analyzeDependencies adds Node.js + Vercel Functions to backend frameworks for a structurally valid repo', () => {
  const deps = analyzeDependencies({
    language: 'TypeScript',
    packageJsonContent: TS_NODE_PACKAGE_JSON,
    treeFiles: ['vercel.json', 'package.json', 'api/example.ts', 'tsconfig.json'],
  });
  assert.ok(deps.frameworks.backend.includes('Node.js'));
  assert.ok(deps.frameworks.backend.includes('Vercel Functions'));
  assert.equal(deps.frameworks.backend.indexOf('Node.js') < deps.frameworks.backend.indexOf('Vercel Functions'), true, 'Node.js is listed before the platform capability');
});

test('analyzeDependencies leaves backend empty for src/api + vercel.json (no false positive)', () => {
  const deps = analyzeDependencies({
    language: 'TypeScript',
    packageJsonContent: JSON.stringify({ dependencies: { react: '^19.0.0' } }),
    treeFiles: ['vercel.json', 'src/api/example.ts', 'src/App.tsx'],
  });
  assert.deepEqual(deps.frameworks.backend, []);
  assert.ok(!Object.values(deps.frameworks).flat().includes('Vercel Functions'));
});

test('analyzeDependencies leaves backend empty for api/ functions with no root vercel.json', () => {
  const deps = analyzeDependencies({
    language: 'TypeScript',
    packageJsonContent: TS_NODE_PACKAGE_JSON,
    treeFiles: ['api/example.ts', 'package.json'],
  });
  assert.deepEqual(deps.frameworks.backend, []);
});

test('analyzeDependencies leaves backend empty for legacy now.json + api/ functions (now.json is not current deployment evidence)', () => {
  const deps = analyzeDependencies({
    language: 'TypeScript',
    packageJsonContent: TS_NODE_PACKAGE_JSON,
    treeFiles: ['now.json', 'package.json', 'api/example.ts', 'api/users/[id].ts'],
  });
  assert.deepEqual(deps.frameworks.backend, []);
  assert.ok(!Object.values(deps.frameworks).flat().includes('Vercel Functions'));
});

test('analyzeDependencies does not treat docs/api/example.ts as a serverless function', () => {
  const deps = analyzeDependencies({
    language: 'TypeScript',
    treeFiles: ['vercel.json', 'docs/api/example.ts', 'README.md'],
  });
  assert.deepEqual(deps.frameworks.backend, []);
});

// ---------------------------------------------------------------------------
// 4. Full analyzeRepository pipeline — techStack + architecture classification
// ---------------------------------------------------------------------------
test('POSITIVE fullstack: React frontend + valid Vercel API => techStack has Node.js + Vercel Functions, classifications include frontend, backend, fullstack', () => {
  const inspection: RawRepositoryInspection = {
    packageJsonContent: REACT_TS_NODE_PACKAGE_JSON,
    treeFiles: [
      'vercel.json',
      'package.json',
      'api/github-live.ts',
      'api/contact.ts',
      'api/users/[id].ts',
      'src/App.tsx',
      'index.html',
    ],
  };
  const project = transformGitHubRepoToProject(repoFixture(), 0, 1, inspection);

  assert.ok(project.techStack.includes('TypeScript'));
  assert.ok(project.techStack.includes('Node.js'));
  assert.ok(project.techStack.includes('Vercel Functions'));
  assert.ok(project.techStack.includes('React'));

  assert.equal(project.category, 'fullstack');
  assert.ok(project.classifications?.includes('frontend'));
  assert.ok(project.classifications?.includes('backend'));
  assert.ok(project.classifications?.includes('fullstack'));
});

test('POSITIVE backend-only: valid Vercel API and no frontend => backend classification, not frontend', () => {
  const inspection: RawRepositoryInspection = {
    packageJsonContent: TS_NODE_PACKAGE_JSON,
    treeFiles: ['vercel.json', 'package.json', 'api/health.js', 'api/webhooks/[provider].mjs'],
  };
  const project = transformGitHubRepoToProject(
    repoFixture({ name: 'sample-vercel-api', description: 'Serverless data API', id: 70002 }),
    0,
    1,
    inspection,
  );

  assert.ok(project.techStack.includes('Node.js'));
  assert.ok(project.techStack.includes('Vercel Functions'));
  assert.equal(project.category, 'backend');
  assert.ok(project.classifications?.includes('backend'));
  assert.ok(!project.classifications?.includes('frontend'));
});

test('NEGATIVE: src/api/foo.ts under a Vercel-hosted frontend stays frontend-only (no Vercel backend evidence)', () => {
  const inspection: RawRepositoryInspection = {
    packageJsonContent: JSON.stringify({
      name: 'frontend-only',
      dependencies: { react: '^19.0.0', 'react-dom': '^19.0.0' },
      devDependencies: { vite: '^6.0.0', typescript: '^5.8.0' },
    }),
    treeFiles: ['vercel.json', 'package.json', 'src/api/foo.ts', 'src/App.tsx', 'index.html'],
  };
  const project = transformGitHubRepoToProject(
    repoFixture({ name: 'sample-frontend-only', description: 'A React dashboard', id: 70003 }),
    0,
    1,
    inspection,
  );

  assert.ok(!project.techStack.includes('Vercel Functions'));
  assert.ok(!project.techStack.includes('Node.js'));
  assert.equal(project.category, 'frontend');
  assert.ok(!project.classifications?.includes('backend'));
});

// ---------------------------------------------------------------------------
// 5. Regression: existing framework + n8n detection unchanged
// ---------------------------------------------------------------------------
test('REGRESSION: Express / Fastify package detection is unchanged', () => {
  const express = analyzeDependencies({
    language: 'JavaScript',
    packageJsonContent: JSON.stringify({ dependencies: { express: '^4.19.0' } }),
    treeFiles: ['index.js', 'package.json'],
  });
  assert.deepEqual(express.frameworks.backend, ['Express']);

  const fastify = analyzeDependencies({
    language: 'TypeScript',
    packageJsonContent: JSON.stringify({ dependencies: { fastify: '^4.0.0' } }),
    treeFiles: ['src/server.ts'],
  });
  assert.deepEqual(fastify.frameworks.backend, ['Fastify']);
});

test('REGRESSION: an Express repo that ALSO has valid Vercel functions reports both, without losing Express', () => {
  const deps = analyzeDependencies({
    language: 'TypeScript',
    packageJsonContent: JSON.stringify({ dependencies: { express: '^4.19.0' } }),
    treeFiles: ['vercel.json', 'api/webhook.ts', 'src/server.ts', 'package.json'],
  });
  assert.ok(deps.frameworks.backend.includes('Express'));
  assert.ok(deps.frameworks.backend.includes('Node.js'));
  assert.ok(deps.frameworks.backend.includes('Vercel Functions'));
});

test('REGRESSION: n8n workflow detection is unchanged and independent of the Vercel path', () => {
  const workflow = JSON.stringify({
    name: 'flow',
    nodes: [{ id: 'n1', name: 'Hook', type: 'n8n-nodes-base.webhook', typeVersion: 1, position: [0, 0], parameters: {} }],
    connections: {},
  });
  const deps = analyzeDependencies({
    language: null,
    treeFiles: ['workflows/flow.json'],
    n8nWorkflowContents: { 'workflows/flow.json': workflow },
  });
  assert.ok(deps.frameworks.backend.includes('n8n'));
  assert.ok(!deps.frameworks.backend.includes('Vercel Functions'));
});

// ---------------------------------------------------------------------------
// 6. Capability normalization + generation
// ---------------------------------------------------------------------------
test('Vercel Functions is the canonical label; spelled-out / legacy variants normalize to it', () => {
  assert.equal(normalizeTechnologyName('Vercel Functions'), 'Vercel Functions');
  assert.equal(normalizeTechnologyName('vercel function'), 'Vercel Functions');
  assert.equal(normalizeTechnologyName('Vercel Serverless Functions'), 'Vercel Functions');
  assert.equal(normalizeTechnologyName('vercel serverless function'), 'Vercel Functions');
  assert.equal(normalizeTechnologyName('Vercel Serverless'), 'Vercel Functions');
  assert.equal(normalizeTechnologyName('vercel serverless api'), 'Vercel Functions');
  // Bare "vercel" is deliberately NOT collapsed (frontend "deployed on Vercel" topic).
  assert.equal(normalizeTechnologyName('Vercel'), 'Vercel');

  assert.ok(RECOGNIZED_CAPABILITY_TAXONOMY['Vercel Functions']);
  assert.equal(RECOGNIZED_CAPABILITY_TAXONOMY['Vercel Functions'].category, 'backend');
  assert.equal(RECOGNIZED_CAPABILITY_TAXONOMY['Vercel Functions'].titleSuffix, 'Serverless API Architecture');
  // The retired label must no longer be a taxonomy key.
  assert.equal(RECOGNIZED_CAPABILITY_TAXONOMY['Vercel Serverless Functions'], undefined);
});

test('the platform name "Vercel Functions" does NOT globally imply the Node.js runtime family', () => {
  // Vercel Functions run on multiple runtimes (Node.js, Python, Go, Edge). The
  // platform name alone is not runtime evidence, so family ancestry must not
  // add Node.js.
  const families = getTechnologyFamilies('Vercel Functions');
  assert.deepEqual(families, ['Vercel Functions']);
  assert.ok(!families.includes('Node.js'));

  // Contrast: a real Node.js framework DOES imply the Node.js family.
  assert.ok(getTechnologyFamilies('Express').includes('Node.js'));
});

test('a JS/TS Vercel project satisfies the Node.js capability through its DIRECT Node.js tech evidence, not via family ancestry', () => {
  // This is exactly what the JS/TS detector emits: an explicit `Node.js` tech.
  const jsTsProject = { id: 'p1', title: 'sample-vercel-app', techStack: ['TypeScript', 'Node.js', 'Vercel Functions'] };
  assert.equal(projectUsesCapability(jsTsProject, 'Node.js'), true, 'direct Node.js evidence matches the Node.js capability');
  assert.equal(projectUsesCapability(jsTsProject, 'Vercel Functions'), true);
  assert.equal(projectUsesCapability(jsTsProject, 'Express'), false);

  // A hypothetical project carrying ONLY the platform label (no runtime
  // evidence) must NOT be attributed to Node.js.
  const platformOnly = { id: 'p2', title: 'other', techStack: ['Vercel Functions'] };
  assert.equal(projectUsesCapability(platformOnly, 'Vercel Functions'), true);
  assert.equal(projectUsesCapability(platformOnly, 'Node.js'), false, 'no runtime evidence => no Node.js attribution');
});

test('generateGitHubProfileDetails synthesizes a Vercel Functions capability node from repository structure (generic, not repo-name based)', () => {
  const inspection: RawRepositoryInspection = {
    packageJsonContent: REACT_TS_NODE_PACKAGE_JSON,
    treeFiles: ['vercel.json', 'package.json', 'api/github-live.ts', 'api/contact.ts', 'src/App.tsx'],
  };
  const project = transformGitHubRepoToProject(repoFixture({ id: 70004 }), 0, 1, inspection);
  const { skills } = generateGitHubProfileDetails([project], null, 'acme/sample-vercel-app');

  const names = skills.map((s) => s.name);
  assert.ok(names.some((n) => n.startsWith('Vercel Functions ')), `expected a Vercel capability, got: ${names.join(' | ')}`);
  assert.ok(names.some((n) => n.startsWith('Node.js ')), `expected a Node.js capability, got: ${names.join(' | ')}`);

  const vercelSkill = skills.find((s) => s.name.startsWith('Vercel Functions '))!;
  assert.equal(vercelSkill.category, 'backend');
  assert.ok(vercelSkill.usedInProjects.includes(project.id));
});

// ---------------------------------------------------------------------------
// 7. Generality guard — no repository special-casing anywhere in the detector
// ---------------------------------------------------------------------------
test('the Vercel detector contains no repository-name / repo-id / filename special case', () => {
  const analyzerSrc = readFileSync('src/services/repositoryAnalyzer/vercelFunctionAnalyzer.ts', 'utf8');
  const depSrc = readFileSync('src/services/repositoryAnalyzer/dependencyAnalyzer.ts', 'utf8');
  for (const [label, src] of [['vercelFunctionAnalyzer', analyzerSrc], ['dependencyAnalyzer', depSrc]] as const) {
    assert.ok(!/Systems_Cartography_Portfolio/i.test(src), `${label} must not name a specific repository`);
    assert.ok(!/github-live/i.test(src), `${label} must not hard-code the github-live.ts filename`);
    assert.ok(!/repoName\s*===|repo\.name\s*===|\.name\s*===\s*['"]/.test(src), `${label} must not branch on a repository name`);
    assert.ok(!/gh-\d{6,}|repo\.id\s*===/.test(src), `${label} must not hard-code a GitHub repo id`);
  }
});
