import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCVText } from '../src/services/cvParserService.ts';
import {
  generateGitHubProfileDetails,
  GitHubRepoRaw,
  transformGitHubRepoToProject
} from '../src/services/githubService.ts';

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

test('maps the reviewed Salih CV to canonical verified data', () => {
  const result = parseCVText(`
    FULL-STACK DEVELOPER
    Salih Mohammad Bukhari
    LOCATION Rawalpindi, Pakistan
    TowerDesk Platform
    PillCheck
  `, 'Salih_Bukhari_CV.pdf');

  assert.equal(result.operator.name, 'Salih Mohammad Bukhari');
  assert.equal(result.operator.location, 'Rawalpindi, Pakistan');
  assert.equal(result.operator.commitsIndexed, 'Not indexed');
  assert.equal(result.operator.productionUptime, 'Not claimed');
  assert.deepEqual(result.projects.map(project => project.title), [
    'TowerDesk Platform',
    'TowerDesk App',
    'PillCheck',
    'AOK Health Solutions',
    'Psych Websites'
  ]);
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
