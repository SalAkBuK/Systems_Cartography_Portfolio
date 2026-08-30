import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseGitHubTarget,
  normalizeGithubTarget,
  getGithubOwnerIdentity,
  isSameGithubOwner
} from '../src/utils/ownerScope';
import { getRepositoryEvidence, getCanonicalRepositoryKey, REPOSITORY_EVIDENCE_OWNER_GITHUB_TARGET } from '../src/data/repositoryEvidence';
import { getOwnerExperienceEvidenceCollection, OWNER_EXPERIENCE_EVIDENCE_GITHUB_TARGET } from '../src/data/ownerExperienceEvidence';
import { getDefaultAdditionalOwnerExperience, ADDITIONAL_OWNER_EXPERIENCE_OWNER_GITHUB_TARGET } from '../src/data/ownerAdditionalExperience';
import { resolveProfessionalExperience } from '../src/services/experienceResolver';
import { resolveGitHubSnapshotForTarget } from '../src/utils/portfolioUtils';
import { GITHUB_SNAPSHOT, GITHUB_SNAPSHOT_METADATA } from '../src/data/githubSnapshot.generated';
import { PORTFOLIO_CONFIG } from '../src/config/portfolioConfig';
import { analyzeRepository } from '../src/services/repositoryAnalyzer/index';
import { canonicalizeRepositories, generateGitHubProfileDetails, GitHubRepoRaw } from '../src/services/githubService';

// ---------------------------------------------------------------------------
// PART 1: Centralized owner-scope utility (src/utils/ownerScope.ts)
// ---------------------------------------------------------------------------

test('PR28: getGithubOwnerIdentity extracts the owner login from equivalent target forms', () => {
  const forms = [
    'https://github.com/Example',
    'https://github.com/example/',
    'github.com/example',
    'https://www.github.com/example',
    '@example',
    'example',
    '  Example  ',
    'HTTPS://GITHUB.COM/EXAMPLE'
  ];
  for (const form of forms) {
    assert.equal(getGithubOwnerIdentity(form), 'example', `Form "${form}" must normalize to owner "example"`);
  }
});

test('PR28: getGithubOwnerIdentity extracts the owner from a full repository URL, not the repo name', () => {
  assert.equal(getGithubOwnerIdentity('https://github.com/SalAkBuK/towerdesk-backend'), 'salakbuk');
  assert.equal(getGithubOwnerIdentity('https://github.com/example-owner/towerdesk-backend'), 'example-owner');
});

test('PR28: getGithubOwnerIdentity returns "" for empty/unparseable/hostile input (never throws)', () => {
  assert.equal(getGithubOwnerIdentity(''), '');
  assert.equal(getGithubOwnerIdentity(null), '');
  assert.equal(getGithubOwnerIdentity(undefined), '');
  assert.equal(getGithubOwnerIdentity('https://evil.example/github.com/SalAkBuK'), '');
  assert.equal(getGithubOwnerIdentity('not a url at all???'), '');
});

test('PR28: isSameGithubOwner matches equivalent forms and rejects distinct/unknown owners', () => {
  assert.ok(isSameGithubOwner('https://github.com/SalAkBuK', 'github.com/salakbuk/'));
  assert.ok(isSameGithubOwner('https://github.com/SalAkBuK/towerdesk-backend', 'SalAkBuK'));
  assert.ok(!isSameGithubOwner('https://github.com/SalAkBuK', 'https://github.com/example-owner'));
  assert.ok(!isSameGithubOwner('', 'https://github.com/SalAkBuK'), 'Empty target never matches');
  assert.ok(!isSameGithubOwner(undefined, undefined), 'Two unknown/empty targets never match each other');
});

test('PR28: normalizeGithubTarget (spec-suggested name) matches the existing normalizeGitHubTarget behavior', () => {
  assert.equal(normalizeGithubTarget('https://github.com/SalAkBuK/'), 'salakbuk');
  assert.equal(normalizeGithubTarget('github.com/SalAkBuK'), 'salakbuk');
  assert.equal(normalizeGithubTarget(''), '');
});

test('PR28: parseGitHubTarget is exported from ownerScope.ts as the single canonical implementation', () => {
  const parsed = parseGitHubTarget('https://github.com/SalAkBuK/towerdesk-backend');
  assert.equal(parsed.type, 'repo');
  assert.equal(parsed.owner, 'SalAkBuK');
  assert.equal(parsed.repo, 'towerdesk-backend');
});

// ---------------------------------------------------------------------------
// PART 2: Hard Foreign-Owner Test Fixture (spec acceptance test group)
// ---------------------------------------------------------------------------

const SYNTHETIC_OWNER_TARGET = 'https://github.com/example-owner';

const syntheticOwnerRepo = (overrides: Partial<GitHubRepoRaw>): GitHubRepoRaw => ({
  id: 9001,
  name: 'placeholder',
  full_name: 'example-owner/placeholder',
  description: 'Synthetic fixture repository',
  html_url: 'https://github.com/example-owner/placeholder',
  homepage: null,
  stargazers_count: 3,
  forks_count: 0,
  open_issues_count: 0,
  watchers_count: 3,
  language: 'TypeScript',
  topics: [],
  size: 250,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  pushed_at: '2026-01-01T00:00:00Z',
  archived: false,
  fork: false,
  default_branch: 'main',
  license: null,
  owner: {
    login: 'example-owner',
    avatar_url: 'https://example.com/avatar.png',
    html_url: 'https://github.com/example-owner'
  },
  ...overrides
});

test('PR28 HARD FIXTURE 1: Synthetic owner receives ZERO SalAkBuK additional experience', () => {
  const result = getDefaultAdditionalOwnerExperience(SYNTHETIC_OWNER_TARGET);
  assert.deepEqual(result, []);
  assert.notEqual(ADDITIONAL_OWNER_EXPERIENCE_OWNER_GITHUB_TARGET, SYNTHETIC_OWNER_TARGET);
});

test('PR28 HARD FIXTURE 2: Synthetic CodeFier employment receives ZERO SalAkBuK CodeFier engineering evidence', () => {
  const resolved = resolveProfessionalExperience({
    importedExperience: [
      {
        id: 'exp-fixture-codefier',
        code: 'EXP-01',
        yearRange: '2024 - Present',
        role: 'Engineer',
        organization: 'CodeFier',
        location: 'Toronto, Canada',
        systemDomain: 'Systems',
        keyOutputs: ['Unrelated work at a differently-owned company named CodeFier.'],
        systemsArchitected: [],
        technologies: ['Rust'],
        gridPosition: { x: 0, y: 0 },
        startDate: '2024-01',
        endDate: null
      }
    ],
    ownerGithubTarget: SYNTHETIC_OWNER_TARGET
  });

  const codefier = resolved.find(e => e.organization === 'CodeFier')!;
  assert.ok(codefier);
  assert.equal(codefier.systemsDelivered?.length || 0, 0);
  assert.equal(codefier.architectedSystemsDetails?.length || 0, 0);
});

test('PR28 HARD FIXTURE 3: Synthetic towerdesk-backend receives ZERO SalAkBuK TowerDesk curated repository evidence', () => {
  const repo = syntheticOwnerRepo({ id: 9002, name: 'towerdesk-backend', full_name: 'example-owner/towerdesk-backend' });
  const project = analyzeRepository(repo, 0, 1, { readmeContent: null, packageJsonContent: null, treeFiles: [] });
  assert.notEqual(project.provenance?.subsystems, 'CURATED');
  assert.ok(!project.subsystems.some(s => s.id.startsWith('tdb-')));
});

test('PR28 HARD FIXTURE 4: Synthetic worthy-crm receives ZERO SalAkBuK Worthy evidence', () => {
  const repo = syntheticOwnerRepo({ id: 9003, name: 'worthy-crm', full_name: 'example-owner/worthy-crm', language: 'PHP' });
  const project = analyzeRepository(repo, 0, 1, { readmeContent: null, packageJsonContent: null, treeFiles: [] });
  assert.notEqual(project.provenance?.subsystems, 'CURATED');
  assert.ok(!project.subsystems.some(s => s.id.startsWith('wcrm-')));
});

test('PR28 HARD FIXTURE 5: Synthetic repository aliases/clusters do not inherit current-owner aliases', () => {
  assert.equal(
    getCanonicalRepositoryKey('towerdesk-backend-clean', SYNTHETIC_OWNER_TARGET),
    'towerdesk-backend-clean',
    'Synthetic owner repo name must not resolve through the SalAkBuK cluster alias table'
  );

  const repos = [
    syntheticOwnerRepo({ id: 9004, name: 'towerdesk-backend-clean', full_name: 'example-owner/towerdesk-backend-clean' }),
    syntheticOwnerRepo({ id: 9005, name: 'towerdesk-backend', full_name: 'example-owner/towerdesk-backend' })
  ];
  const canonical = canonicalizeRepositories(repos);
  assert.equal(canonical.length, 2, 'Two distinctly-named synthetic repos must not be merged via SalAkBuK cluster aliases');
});

test('PR28 HARD FIXTURE 6: Generic repository-derived technology/capability analysis still works for the synthetic owner', () => {
  const repo = syntheticOwnerRepo({
    id: 9006,
    name: 'edge-cache-router',
    full_name: 'example-owner/edge-cache-router',
    language: 'Go',
    topics: ['kubernetes', 'redis']
  });
  const project = analyzeRepository(repo, 0, 1, {
    readmeContent: '# Edge Cache Router\nA distributed caching layer.',
    packageJsonContent: null,
    treeFiles: ['README.md']
  });

  assert.equal(project.title, 'edge-cache-router');
  assert.ok(project.techStack.length > 0, 'Generic technology detection must still populate techStack');
  assert.ok(project.subsystems.length > 0, 'Generic architecture analysis must still synthesize subsystems');
  assert.notEqual(project.provenance?.subsystems, 'CURATED', 'No curated overlay should apply to an unrelated synthetic repo');

  const { skills } = generateGitHubProfileDetails([project], null, 'example-owner');
  assert.ok(Array.isArray(skills), 'Capability synthesis must still run for the synthetic owner');
});

test('PR28 HARD FIXTURE 7: Synthetic owner can still produce a valid portfolio model end-to-end', () => {
  const repos = [
    syntheticOwnerRepo({ id: 9007, name: 'towerdesk-backend', full_name: 'example-owner/towerdesk-backend' }),
    syntheticOwnerRepo({ id: 9008, name: 'worthy-crm', full_name: 'example-owner/worthy-crm', language: 'PHP' }),
    syntheticOwnerRepo({ id: 9009, name: 'notes-app', full_name: 'example-owner/notes-app', language: 'JavaScript' })
  ];
  const canonical = canonicalizeRepositories(repos);
  const projects = canonical.map((repo, idx) =>
    analyzeRepository(repo, idx, canonical.length, { readmeContent: null, packageJsonContent: null, treeFiles: [] })
  );
  const { skills, operator, experience } = generateGitHubProfileDetails(projects, null, 'example-owner');

  assert.equal(projects.length, 3);
  assert.ok(projects.every(p => typeof p.id === 'string' && p.id.length > 0));
  assert.ok(Array.isArray(skills));
  assert.ok(operator && typeof operator.name === 'string');
  assert.ok(Array.isArray(experience));
  assert.ok(projects.every(p => p.provenance?.subsystems !== 'CURATED'), 'No SalAkBuK curated evidence anywhere in the synthetic model');
});

test('PR28 HARD FIXTURE 8: Snapshot mismatch continues to fail safely for the synthetic owner', () => {
  const result = resolveGitHubSnapshotForTarget(SYNTHETIC_OWNER_TARGET, GITHUB_SNAPSHOT_METADATA, GITHUB_SNAPSHOT);
  assert.equal(result, null, 'The committed SalAkBuK snapshot must refuse to render for a differently-configured owner');
});

// ---------------------------------------------------------------------------
// PART 3: Current-Owner Regression (the opposite must also hold)
// ---------------------------------------------------------------------------

test('PR28 REGRESSION: Current owner (SalAkBuK) still resolves all owner-scoped data sources unchanged', () => {
  assert.ok(isSameGithubOwner(PORTFOLIO_CONFIG.githubTarget, REPOSITORY_EVIDENCE_OWNER_GITHUB_TARGET));
  assert.ok(isSameGithubOwner(PORTFOLIO_CONFIG.githubTarget, OWNER_EXPERIENCE_EVIDENCE_GITHUB_TARGET));
  assert.ok(isSameGithubOwner(PORTFOLIO_CONFIG.githubTarget, ADDITIONAL_OWNER_EXPERIENCE_OWNER_GITHUB_TARGET));

  assert.ok(getOwnerExperienceEvidenceCollection(PORTFOLIO_CONFIG.githubTarget).length > 0);
  assert.ok(getDefaultAdditionalOwnerExperience(PORTFOLIO_CONFIG.githubTarget).length > 0);
  assert.ok(getRepositoryEvidence('towerdesk-backend', PORTFOLIO_CONFIG.githubTarget));

  const configuredSnapshot = resolveGitHubSnapshotForTarget(PORTFOLIO_CONFIG.githubTarget, GITHUB_SNAPSHOT_METADATA, GITHUB_SNAPSHOT);
  assert.ok(configuredSnapshot, 'Current owner GitHub snapshot must still resolve');
  assert.equal(PORTFOLIO_CONFIG.operator.name, 'Salih Bukhari');
});
