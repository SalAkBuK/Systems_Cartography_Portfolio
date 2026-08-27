import assert from 'node:assert/strict';
import test from 'node:test';
import {
  generateGitHubProfileDetails,
  GitHubRepoRaw,
  transformGitHubRepoToProject
} from '../src/services/githubService.ts';
import { PORTFOLIO_CONFIG } from '../src/config/portfolioConfig.ts';
import { VERIFIED_EXPERIENCE, VERIFIED_PROJECTS, VERIFIED_SKILLS } from '../src/data/verifiedPortfolioData.ts';

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
