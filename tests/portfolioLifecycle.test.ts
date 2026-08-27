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

test('configured experience survives GitHub sync and receives CURATED provenance', () => {
  const merged = resolveExperience(sampleConfiguredExperience, sampleGitHubDerivedExperience);

  assert.equal(merged.length, 2);
  assert.equal(merged[0].id, 'exp-cfg-01');
  assert.equal(merged[0].role, 'Senior Systems Architect');
  assert.equal(merged[0].provenance, 'CURATED');
  assert.equal(merged[1].id, 'exp-gh-01');
  assert.equal(merged[1].provenance, 'DERIVED');
});

test('GitHub-derived experience does not overwrite configured professional employment', () => {
  const merged = resolveExperience(sampleConfiguredExperience, []);

  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, 'exp-cfg-01');
  assert.equal(merged[0].organization, 'Acme Systems');
  assert.equal(merged[0].provenance, 'CURATED');
});

test('no duplicated experience after merge when IDs or role/org match', () => {
  const duplicateDerived: ExperienceNode[] = [
    {
      ...sampleGitHubDerivedExperience[0],
      id: 'EXP-CFG-01', // case-insensitive ID collision
      role: 'Senior Systems Architect',
      organization: 'Acme Systems'
    }
  ];

  const merged = resolveExperience(sampleConfiguredExperience, duplicateDerived);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, 'exp-cfg-01');
  assert.equal(merged[0].provenance, 'CURATED');
});

test('GitHub-derived experience is used when configured experience is absent', () => {
  const merged = resolveExperience([], sampleGitHubDerivedExperience);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, 'exp-gh-01');
  assert.equal(merged[0].provenance, 'DERIVED');
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

  // Direct ID / title match
  assert.equal(isProjectLinkedToExperience({ id: 'gh-1', title: 'towerdesk-backend-clean' }, mockExperience), true);
  assert.equal(isProjectLinkedToExperience({ id: 'gh-2', title: 'worthy-crm' }, mockExperience), true);

  // Canonical cluster alias match (e.g. original repository resolves to clean showcase)
  assert.equal(isProjectLinkedToExperience({ id: 'gh-3', title: 'towerdesk-backend' }, mockExperience), true);
  assert.equal(isProjectLinkedToExperience({ id: 'gh-4', title: 'binghatti-concierge-app-rn-expo' }, mockExperience), true);

  // Unlinked project
  assert.equal(isProjectLinkedToExperience({ id: 'gh-5', title: 'unrelated-project' }, mockExperience), false);
});

