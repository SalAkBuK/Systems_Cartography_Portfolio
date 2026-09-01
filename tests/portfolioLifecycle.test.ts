import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveExperience, resolveDeploymentLink, isProjectLinkedToExperience } from '../src/utils/portfolioUtils.ts';
import { ExperienceNode } from '../src/types.ts';
import { PORTFOLIO_CONFIG } from '../src/config/portfolioConfig.ts';

const sampleConfiguredExperience: ExperienceNode[] = [
  {
    id: 'exp-cfg-01',
    code: 'EXP-01',
    role: 'Senior Systems Architect',
    organization: 'Acme Systems',
    location: 'Remote',
    yearRange: '2023 - PRESENT',
    systemDomain: 'Distributed Storage',
    keyOutputs: ['Architected distributed raft log with 99.99% durability'],
    systemsArchitected: ['RaftCluster-v2'],
    technologies: ['TypeScript', 'Rust', 'PostgreSQL'],
    gridPosition: { x: -100, y: -50 }
  }
];

const sampleGitHubDerivedExperience: ExperienceNode[] = [
  {
    id: 'exp-gh-01',
    code: 'EXP-GH-01',
    role: 'Public Repository Architect',
    organization: 'GitHub Snapshot',
    location: 'Public Cloud',
    yearRange: '2024 - 2026',
    systemDomain: 'Open Source Systems',
    keyOutputs: ['Maintained 10 public repositories'],
    systemsArchitected: ['TowerDesk', 'PillCheck'],
    technologies: ['TypeScript', 'React', 'NestJS'],
    gridPosition: { x: 50, y: 50 }
  }
];

test('configured experience survives GitHub sync and receives CURATED provenance without appending snapshot', () => {
  const merged = resolveExperience(sampleConfiguredExperience, sampleGitHubDerivedExperience);

  assert.equal(merged.length, 1, 'Configured experience must not append synthetic GitHub snapshot');
  assert.equal(merged[0].id, 'exp-cfg-01');
  assert.equal(merged[0].role, 'Senior Systems Architect');
  assert.equal(merged[0].provenance, 'CURATED');
});

test('GitHub-derived experience does not overwrite configured professional employment', () => {
  const merged = resolveExperience(sampleConfiguredExperience, []);

  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, 'exp-cfg-01');
  assert.equal(merged[0].organization, 'Acme Systems');
  assert.equal(merged[0].provenance, 'CURATED');
});

test('configured experience completely takes precedence over synthetic GitHub derived entries', () => {
  const duplicateDerived: ExperienceNode[] = [
    {
      ...sampleGitHubDerivedExperience[0],
      id: 'EXP-CFG-01',
      role: 'Senior Systems Architect',
      organization: 'Acme Systems'
    }
  ];

  const merged = resolveExperience(sampleConfiguredExperience, duplicateDerived);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, 'exp-cfg-01');
  assert.equal(merged[0].provenance, 'CURATED');
});

test('GitHub-derived experience is used as fallback when configured experience is absent', () => {
  const merged = resolveExperience(undefined, sampleGitHubDerivedExperience);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, 'exp-gh-01');
  assert.equal(merged[0].provenance, 'DERIVED');
});

test('an explicit zero-experience profile does not gain synthetic GitHub employment', () => {
  const merged = resolveExperience([], sampleGitHubDerivedExperience);

  assert.deepEqual(merged, []);
});

test('current configured career with synthetic GitHub snapshot resolves to 4 roles, 3 orgs, 3 progression cards', () => {
  const configuredRoles = PORTFOLIO_CONFIG.experience || [];
  assert.equal(configuredRoles.length, 4, 'Owner has 4 configured career roles (3 LinkedIn + 1 Freelance)');

  const resolved = resolveExperience(configuredRoles, sampleGitHubDerivedExperience);
  
  // 1. Must resolve to exactly 4 professional role records (NOT 5)
  assert.equal(resolved.length, 4, 'Must retain 4 roles and not append 5th snapshot record');
  assert.ok(resolved.every(r => r.provenance === 'CURATED'), 'All resolved roles have CURATED provenance');
  assert.ok(!resolved.some(r => r.organization === 'GitHub Snapshot' || r.yearRange === 'PUBLIC GITHUB SNAPSHOT'), 'No synthetic GitHub employer record is present');

  // 2. Unique organizations must be 3 (CodeFier, Devinity Solutions, Independent / Freelance)
  const uniqueOrgs = Array.from(
    new Set(resolved.map(e => (e.organization || '').trim().toLowerCase()))
  ).filter(Boolean);
  assert.equal(uniqueOrgs.length, 3, 'Unique organizations must be 3');

  // 3. Grouped organization cards must be 3
  const groups: Record<string, any[]> = {};
  const order: string[] = [];
  for (const exp of resolved) {
    const groupKey = exp.progressionGroup || (exp.organization || '').trim().toLowerCase();
    if (!groups[groupKey]) {
      groups[groupKey] = [];
      order.push(groupKey);
    }
    groups[groupKey].push(exp);
  }
  assert.equal(order.length, 3, 'Grouped organization cards must be exactly 3');
});

test('manual projectLinks override wins over GitHub homepage', () => {
  const projectLinks = {
    'tower-desk-clean': 'https://towerdesk.custom-domain.com'
  };
  const result = resolveDeploymentLink(
    'tower-desk-clean',
    'https://towerdesk.github.io',
    projectLinks
  );

  assert.equal(result, 'https://towerdesk.custom-domain.com');
});

test('projectLinks repository matching is genuinely case-insensitive', () => {
  const projectLinks = {
    'Tower-Desk-Clean': 'https://towerdesk.custom-domain.com',
    'PILLCHECK-PUBLIC': 'https://pillcheck.custom-domain.com'
  };

  const result1 = resolveDeploymentLink(
    'tower-desk-clean',
    'https://fallback.com',
    projectLinks
  );
  assert.equal(result1, 'https://towerdesk.custom-domain.com');

  const result2 = resolveDeploymentLink(
    'pillcheck-public',
    null,
    projectLinks
  );
  assert.equal(result2, 'https://pillcheck.custom-domain.com');
});

test('GitHub homepage is used when no manual override exists', () => {
  const projectLinks = {
    'other-repo': 'https://other.app'
  };
  const result = resolveDeploymentLink(
    'my-new-service',
    'https://myservice.vercel.app',
    projectLinks
  );

  assert.equal(result, 'https://myservice.vercel.app');
});

test('no deployment URL results in undefined demo link', () => {
  const result1 = resolveDeploymentLink('my-repo', null, {});
  assert.equal(result1, undefined);

  const result2 = resolveDeploymentLink('my-repo', '', undefined);
  assert.equal(result2, undefined);

  const result3 = resolveDeploymentLink('my-repo', '   ', { 'my-repo': '   ' });
  assert.equal(result3, undefined);
});

test('resolveDeploymentLink rejects javascript:, data:, and non-HTTP schemes (SEC-01 mitigation)', () => {
  // Dangerous homepage from GitHub API is rejected
  assert.equal(resolveDeploymentLink('bad-repo', 'javascript:alert(1)'), undefined);
  assert.equal(resolveDeploymentLink('bad-repo', 'JAVASCRIPT:alert(document.domain)'), undefined);
  assert.equal(resolveDeploymentLink('bad-repo', 'data:text/html,<script>alert(1)</script>'), undefined);
  assert.equal(resolveDeploymentLink('bad-repo', 'vbscript:msgbox(1)'), undefined);
  assert.equal(resolveDeploymentLink('bad-repo', 'file:///etc/passwd'), undefined);
  assert.equal(resolveDeploymentLink('bad-repo', '//evil.com'), undefined);
  assert.equal(resolveDeploymentLink('bad-repo', 'relative/path/index.html'), undefined);

  // Dangerous manual override is rejected
  const hostileOverrides = {
    'bad-override': 'javascript:/* hostile code */',
    'data-override': 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=='
  };
  assert.equal(resolveDeploymentLink('bad-override', 'https://fallback.com', hostileOverrides), 'https://fallback.com');
  assert.equal(resolveDeploymentLink('data-override', null, hostileOverrides), undefined);

  // Valid HTTP and HTTPS links are accepted
  assert.equal(resolveDeploymentLink('good-repo', 'https://valid-demo.com'), 'https://valid-demo.com');
  assert.equal(resolveDeploymentLink('good-repo', 'http://valid-demo.com:8080/path?q=1'), 'http://valid-demo.com:8080/path?q=1');
});

test('canonical LinkedIn field is accessible on PORTFOLIO_CONFIG.operator.contact.linkedin', () => {
  assert.equal(typeof PORTFOLIO_CONFIG.operator.contact.linkedin, 'string');
});

test('isProjectLinkedToExperience links projects generically via evidenceLinks and aliases without hardcoded names', () => {
  const mockExperience: ExperienceNode = {
    ...sampleConfiguredExperience[0],
    id: 'exp-codefier',
    systemsDelivered: [
      {
        name: 'TowerDesk Platform',
        tagline: 'Property Management Platform',
        description: 'End-to-end property operations',
        technologies: ['NestJS', 'React', 'React Native'],
        linkedProjectIds: ['towerdesk-backend-clean', 'tower-desk-clean', 'towerdesk-mobile-showcase']
      }
    ],
    evidenceLinks: [
      { label: 'Backend Architecture', type: 'repository', projectId: 'towerdesk-backend-clean' },
      { label: 'Real Estate CRM', type: 'repository', projectId: 'worthy-crm' }
    ]
  };

  // Direct ID / title match (exact matching never depends on owner)
  assert.equal(isProjectLinkedToExperience({ id: 'gh-1', title: 'towerdesk-backend-clean' }, mockExperience), true);
  assert.equal(isProjectLinkedToExperience({ id: 'gh-2', title: 'worthy-crm' }, mockExperience), true);

  // Canonical cluster alias match (e.g. original repository resolves to clean showcase).
  // Owner-scoped: only applies when the project's OWN GitHub owner (from
  // links.github) matches the curated source owner (SalAkBuK).
  assert.equal(
    isProjectLinkedToExperience({ id: 'gh-3', title: 'towerdesk-backend', links: { github: 'https://github.com/SalAkBuK/towerdesk-backend' } }, mockExperience),
    true
  );
  assert.equal(
    isProjectLinkedToExperience({ id: 'gh-4', title: 'binghatti-concierge-app-rn-expo', links: { github: 'https://github.com/SalAkBuK/binghatti-concierge-app-rn-expo' } }, mockExperience),
    true
  );

  // Same alias match WITHOUT a known project owner must fail closed (no
  // current-owner assumption).
  assert.equal(isProjectLinkedToExperience({ id: 'gh-3-unknown-owner', title: 'towerdesk-backend' }, mockExperience), false);

  // Same alias match for a FOREIGN owner must also fail closed -- a
  // different developer's repository sharing this exact name must not
  // inherit SalAkBuK's canonical clustering.
  assert.equal(
    isProjectLinkedToExperience({ id: 'gh-3-foreign', title: 'towerdesk-backend', links: { github: 'https://github.com/example-owner/towerdesk-backend' } }, mockExperience),
    false
  );

  // Unlinked project
  assert.equal(isProjectLinkedToExperience({ id: 'gh-5', title: 'unrelated-project' }, mockExperience), false);
});

