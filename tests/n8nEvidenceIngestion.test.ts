import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GitHubRepoRaw,
  transformGitHubRepoToProject,
  generateGitHubProfileDetails,
  fetchRepoInspection,
  sanitizeGitHubUser,
} from '../src/services/githubService.ts';
import {
  analyzeN8nWorkflows,
  isN8nWorkflowDocument,
  isN8nNodeType,
  isCandidateN8nWorkflowPath,
} from '../src/services/repositoryAnalyzer/n8nWorkflowAnalyzer.ts';
import { analyzeDependencies } from '../src/services/repositoryAnalyzer/dependencyAnalyzer.ts';
import {
  normalizeTechnologyName,
  projectUsesCapability,
  getProjectTechnologyEvidence,
  RECOGNIZED_CAPABILITY_TAXONOMY,
} from '../src/utils/capabilityAssociations.ts';

/**
 * SYNTHETIC repository -- deliberately NOT named `physio_bot`. Proves the
 * GENERIC pipeline: any repository whose technology evidence is an n8n workflow
 * export gets evidence-grounded capability relationships.
 */
const N8N_WORKFLOW_JSON = JSON.stringify({
  name: 'Appointment Intake',
  nodes: [
    { id: 'n1', name: 'Incoming Webhook', type: 'n8n-nodes-base.webhook', typeVersion: 1, position: [0, 0], parameters: { path: 'intake' } },
    { id: 'n2', name: 'Normalize', type: 'n8n-nodes-base.set', typeVersion: 3, position: [220, 0], parameters: {} },
    { id: 'n3', name: 'Append Row', type: 'n8n-nodes-base.googleSheets', typeVersion: 4, position: [440, 0], parameters: { operation: 'append' } },
    { id: 'n4', name: 'Confirm via WhatsApp', type: 'n8n-nodes-base.whatsApp', typeVersion: 1, position: [660, 0], parameters: {} },
  ],
  connections: {
    'Incoming Webhook': { main: [[{ node: 'Normalize', type: 'main', index: 0 }]] },
    Normalize: { main: [[{ node: 'Append Row', type: 'main', index: 0 }]] },
    'Append Row': { main: [[{ node: 'Confirm via WhatsApp', type: 'main', index: 0 }]] },
  },
  pinData: {},
});

function repoFixture(overrides: Partial<GitHubRepoRaw> = {}): GitHubRepoRaw {
  return {
    id: 88001,
    name: 'clinic-intake-automation',
    full_name: 'SalAkBuK/clinic-intake-automation',
    description: 'Appointment intake automation',
    html_url: 'https://github.com/SalAkBuK/clinic-intake-automation',
    homepage: null,
    stargazers_count: 0,
    forks_count: 0,
    open_issues_count: 0,
    watchers_count: 0,
    language: null,
    topics: [],
    size: 40,
    created_at: '2026-02-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
    pushed_at: '2026-06-01T00:00:00Z',
    archived: false,
    fork: false,
    default_branch: 'main',
    license: null,
    owner: { login: 'SalAkBuK', avatar_url: 'https://example.com/a.png', html_url: 'https://github.com/SalAkBuK' },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// n8n workflow analyzer — structured node-type evidence only
// ---------------------------------------------------------------------------
test('isN8nNodeType / isN8nWorkflowDocument recognize genuine n8n exports and reject look-alikes', () => {
  assert.equal(isN8nNodeType('n8n-nodes-base.webhook'), true);
  assert.equal(isN8nNodeType('@n8n/n8n-nodes-langchain.agent'), true);
  assert.equal(isN8nNodeType('some-community/n8n-nodes-foo.bar'), true);
  assert.equal(isN8nNodeType('githubActions.checkout'), false);

  assert.equal(isN8nWorkflowDocument(JSON.parse(N8N_WORKFLOW_JSON)), true);
  assert.equal(isN8nWorkflowDocument({ nodes: [] }), false, 'empty nodes is not proof');
  assert.equal(isN8nWorkflowDocument({ nodes: [{ type: 'not-n8n.thing' }] }), false);
  assert.equal(isN8nWorkflowDocument({ foo: 'bar' }), false);
});

test('analyzeN8nWorkflows maps node types to canonical technologies (never prose)', () => {
  const result = analyzeN8nWorkflows({ 'workflows/intake.json': N8N_WORKFLOW_JSON });
  assert.equal(result.isN8nProject, true);
  assert.equal(result.workflowCount, 1);
  assert.deepEqual(result.technologies.sort(), ['Google Sheets', 'WhatsApp Cloud API', 'Webhooks', 'n8n'].sort());
});

test('analyzeN8nWorkflows yields nothing for a workflow with only generic nodes', () => {
  const genericOnly = JSON.stringify({
    nodes: [
      { type: 'n8n-nodes-base.set', name: 'a' },
      { type: 'n8n-nodes-base.if', name: 'b' },
    ],
    connections: {},
  });
  const result = analyzeN8nWorkflows({ 'flow.json': genericOnly });
  assert.deepEqual(result.technologies, ['n8n'], 'n8n itself yes; no unproven integrations');
});

test('isCandidateN8nWorkflowPath is narrow and never collides with ordinary config JSON', () => {
  assert.equal(isCandidateN8nWorkflowPath('workflows/intake.json'), true);
  assert.equal(isCandidateN8nWorkflowPath('n8n/My Workflow.json'), true);
  assert.equal(isCandidateN8nWorkflowPath('appointment-workflow.json'), true);
  assert.equal(isCandidateN8nWorkflowPath('automation.json'), true);
  assert.equal(isCandidateN8nWorkflowPath('package.json'), false);
  assert.equal(isCandidateN8nWorkflowPath('tsconfig.json'), false);
  assert.equal(isCandidateN8nWorkflowPath('tailwind.config.json'), false);
  assert.equal(isCandidateN8nWorkflowPath('src/data/users.json'), false);
  assert.equal(isCandidateN8nWorkflowPath('manifest.json'), false);
});

// ---------------------------------------------------------------------------
// canonical vocabulary
// ---------------------------------------------------------------------------
test('canonical vocabulary recognizes n8n + the integrations an n8n workflow proves', () => {
  assert.equal(normalizeTechnologyName('n8n'), 'n8n');
  assert.equal(normalizeTechnologyName('N8N'), 'n8n');
  assert.equal(normalizeTechnologyName('google-sheets'), 'Google Sheets');
  assert.equal(normalizeTechnologyName('Google Sheets'), 'Google Sheets');
  assert.equal(normalizeTechnologyName('whatsapp-cloud-api'), 'WhatsApp Cloud API');
  assert.equal(normalizeTechnologyName('webhooks'), 'Webhooks');

  // A bare "whatsapp" tag is too weak to assert the Cloud API specifically.
  assert.notEqual(normalizeTechnologyName('whatsapp'), 'WhatsApp Cloud API');

  for (const tech of ['n8n', 'Webhooks', 'Google Sheets', 'WhatsApp Cloud API']) {
    assert.ok(RECOGNIZED_CAPABILITY_TAXONOMY[tech], `${tech} eligible for a capability node`);
  }
});

// ---------------------------------------------------------------------------
// end-to-end: deep pipeline -> project -> capabilities
// ---------------------------------------------------------------------------
test('n8n workflow evidence flows into techStack and produces consistent capability links', () => {
  const inspection = {
    treeFiles: ['README.md', 'workflows/intake.json'],
    readmeContent: '# Clinic Intake\nAn appointment automation.',
    n8nWorkflowFiles: ['workflows/intake.json'],
    n8nWorkflowContents: { 'workflows/intake.json': N8N_WORKFLOW_JSON },
  };

  const project = transformGitHubRepoToProject(repoFixture(), 0, 1, inspection);

  for (const tech of ['n8n', 'Webhooks', 'Google Sheets', 'WhatsApp Cloud API']) {
    assert.ok(project.techStack.includes(tech), `techStack should include ${tech}`);
  }

  // projectUsesCapability recognizes the canonical evidence directly.
  assert.equal(projectUsesCapability(project, 'n8n'), true);
  assert.equal(projectUsesCapability(project, 'Google Sheets'), true);
  assert.equal(projectUsesCapability(project, 'WhatsApp Cloud API'), true);
  assert.equal(projectUsesCapability(project, 'Webhooks'), true);
  assert.equal(projectUsesCapability(project, 'PostgreSQL'), false);

  // Capability generation creates the skill nodes and links both directions.
  const { skills } = generateGitHubProfileDetails([project], sanitizeGitHubUser({ login: 'SalAkBuK' }), 'SalAkBuK');
  const n8nSkill = skills.find((s) => s.name.startsWith('n8n '));
  assert.ok(n8nSkill, 'an n8n capability node is generated');
  assert.ok(n8nSkill!.usedInProjects.includes(project.id), 'capability.usedInProjects references the project');
  assert.ok(project.infrastructureDeps.includes(n8nSkill!.id), 'project.infrastructureDeps references the capability');

  // Consistency: every infrastructureDep resolves to a generated skill, and
  // every skill listing this project is in infrastructureDeps.
  const skillIds = new Set(skills.map((s) => s.id));
  for (const depId of project.infrastructureDeps) assert.ok(skillIds.has(depId));
  for (const s of skills) {
    if (s.usedInProjects.includes(project.id)) {
      assert.ok(project.infrastructureDeps.includes(s.id), `${s.name} listed project but is not in infrastructureDeps`);
    }
  }
});

test('a GitHub primary language of JavaScript behaves conservatively (JavaScript only, no automation techs)', () => {
  const project = transformGitHubRepoToProject(
    repoFixture({ id: 88002, name: 'plain-js-lib', language: 'JavaScript', description: 'A small JavaScript library' }),
    0,
    1,
    { treeFiles: ['README.md', 'index.js'], readmeContent: '# lib' },
  );
  assert.ok(project.techStack.includes('JavaScript'));
  for (const tech of ['n8n', 'Webhooks', 'Google Sheets', 'WhatsApp Cloud API']) {
    assert.ok(!project.techStack.includes(tech), `JavaScript alone must not imply ${tech}`);
  }
  assert.equal(projectUsesCapability(project, 'JavaScript'), true);
  assert.equal(projectUsesCapability(project, 'n8n'), false);
});

test('a description that merely NAMES n8n / WhatsApp / Google Sheets fabricates NOTHING without structured evidence', () => {
  const project = transformGitHubRepoToProject(
    repoFixture({
      id: 88003,
      name: 'prose-only',
      description: 'A WhatsApp bot built with n8n and Google Sheets for appointment automation',
      language: null,
      topics: [],
    }),
    0,
    1,
    { treeFiles: ['README.md'], readmeContent: 'This project uses n8n, the WhatsApp Cloud API and Google Sheets.' },
  );
  for (const tech of ['n8n', 'Webhooks', 'Google Sheets', 'WhatsApp Cloud API']) {
    assert.ok(!project.techStack.includes(tech), `prose alone must not add ${tech}`);
    assert.equal(projectUsesCapability(project, tech), false);
  }
  assert.deepEqual(getProjectTechnologyEvidence(project), ['Codebase']);
});

test('an EXACT recognized GitHub topic is accepted evidence; a generic topic is not', () => {
  const project = transformGitHubRepoToProject(
    repoFixture({ id: 88004, name: 'tagged', language: 'JavaScript', topics: ['n8n', 'healthcare', 'automation'] }),
    0,
    1,
    { treeFiles: ['README.md'], readmeContent: '# tagged' },
  );
  assert.equal(projectUsesCapability(project, 'n8n'), true, 'exact "n8n" topic connects');
  // "healthcare" / "automation" are not technologies and create no capability.
  assert.ok(!RECOGNIZED_CAPABILITY_TAXONOMY['Healthcare']);
  assert.ok(!RECOGNIZED_CAPABILITY_TAXONOMY['Automation']);
});

// ---------------------------------------------------------------------------
// owner scoping is untouched by the new vocabulary
// ---------------------------------------------------------------------------
test('a foreign-owner repository of the same name still inherits NO curated SalAkBuK evidence', () => {
  const foreign = transformGitHubRepoToProject(
    repoFixture({ id: 88005, name: 'towerdesk-backend', full_name: 'impostor/towerdesk-backend', owner: { login: 'impostor', avatar_url: '', html_url: 'https://github.com/impostor' } }),
    0,
    1,
    { treeFiles: ['README.md'], readmeContent: '# generic' },
  );
  assert.notEqual(foreign.provenance?.problem, 'CURATED');
  assert.notEqual(foreign.provenance?.subsystems, 'CURATED');
});

test('the current owner\'s equivalent repository still resolves its curated evidence', () => {
  const owned = transformGitHubRepoToProject(
    repoFixture({ id: 88006, name: 'towerdesk-backend', full_name: 'SalAkBuK/towerdesk-backend' }),
    0,
    1,
    { treeFiles: ['README.md', 'package.json'], readmeContent: '# generic', packageJsonContent: '{"name":"x"}' },
  );
  assert.equal(owned.provenance?.problem, 'CURATED');
  assert.match(owned.problem, /multi-tenant property operations/i);
});

// ---------------------------------------------------------------------------
// deep inspection actually fetches + validates n8n workflow files
// ---------------------------------------------------------------------------
test('fetchRepoInspection fetches and content-validates n8n workflow JSON, ignoring unrelated JSON', async () => {
  const restFetch: typeof fetch = (async (input: RequestInfo | URL) => {
    const url = input.toString();
    if (url.includes('/git/trees/')) {
      return new Response(
        JSON.stringify({
          truncated: false,
          tree: [
            { path: 'README.md', type: 'blob' },
            { path: 'workflows/intake.json', type: 'blob' },
            { path: 'workflows/not-a-workflow.json', type: 'blob' },
            { path: 'data/config.json', type: 'blob' },
          ],
        }),
        { status: 200 },
      );
    }
    return new Response('Not Found', { status: 404 });
  }) as typeof fetch;

  const rawFetch: typeof fetch = (async (input: RequestInfo | URL) => {
    const url = input.toString();
    if (url.endsWith('/README.md')) return new Response('# readme', { status: 200 });
    if (url.endsWith('/workflows/intake.json')) return new Response(N8N_WORKFLOW_JSON, { status: 200 });
    if (url.endsWith('/workflows/not-a-workflow.json')) return new Response('{"hello":"world"}', { status: 200 });
    return new Response('Not Found', { status: 404 });
  }) as typeof fetch;

  const inspection = await fetchRepoInspection('SalAkBuK', 'clinic-intake-automation', 'main', {
    fetchImpl: restFetch,
    rawFetchImpl: rawFetch,
  });

  assert.deepEqual(inspection.n8nWorkflowFiles, ['workflows/intake.json']);
  assert.ok(inspection.n8nWorkflowContents?.['workflows/intake.json']);
  assert.equal(inspection.n8nWorkflowContents?.['workflows/not-a-workflow.json'], undefined);
  assert.equal(inspection.n8nWorkflowContents?.['data/config.json'], undefined);

  const deps = analyzeDependencies(inspection);
  assert.ok(deps.frameworks.backend.includes('n8n'));
  assert.ok(deps.frameworks.backend.includes('Google Sheets'));
});
