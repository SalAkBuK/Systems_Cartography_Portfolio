import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  GitHubRequestScheduler,
  sanitizeGitHubRepo,
  sanitizeGitHubUser
} from '../src/services/githubService';
import { groupExperienceByProgression } from '../src/utils/portfolioUtils';
import {
  createSetupPortfolioServer,
  validateOwnerProfilePayload,
  WIZARD_SESSION_CSRF_TOKEN
} from '../scripts/setup-portfolio';
import {
  MAX_LINKEDIN_INPUT_LINES,
  parseLinkedInProfileText
} from '../scripts/linkedinProfileParser';
import {
  extractPdfColumnsFromBytes,
  MAX_LINKEDIN_PDF_BYTES
} from '../scripts/import-linkedin-profile';

test('GitHub payload sanitizers bound strings, URLs, numeric values, and required repository identity', () => {
  const user = sanitizeGitHubUser({
    login: 'x'.repeat(150),
    avatar_url: 'data:text/html,payload',
    html_url: 'https://user:secret@github.com/user',
    public_repos: Number.POSITIVE_INFINITY,
    blog: 'javascript:alert(1)'
  });
  assert.equal(user.login.length, 100);
  assert.equal(user.avatar_url, '');
  assert.equal(user.html_url, '');
  assert.equal(user.public_repos, 0);
  assert.equal(user.blog, null);

  assert.equal(sanitizeGitHubRepo({ name: 'repo', owner: {} }), null);
  const repo = sanitizeGitHubRepo({
    id: 1,
    name: 'repo',
    owner: { login: 'owner' },
    html_url: 'data:text/html,payload',
    homepage: 'javascript:alert(1)',
    topics: Array.from({ length: 150 }, (_, index) => `topic-${index}`)
  });
  assert.ok(repo);
  assert.equal(repo.html_url, 'https://github.com/owner/repo');
  assert.equal(repo.homepage, null);
  assert.equal(repo.topics.length, 100);
});

test('GitHub REST scheduler aborts a stalled request at its configured deadline', async () => {
  const scheduler = new GitHubRequestScheduler({
    requestTimeoutMs: 10,
    maxRetries: 0,
    minSpacingMs: 0
  });
  const stalledFetch = ((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(init.signal?.reason || new Error('aborted')), { once: true });
  })) as typeof fetch;

  await assert.rejects(
    scheduler.request(stalledFetch, 'https://api.github.com/user', {}, { operation: 'testing timeout' }),
    /timed out|abort/i
  );
});

test('experience grouping safely accepts JavaScript prototype-property names', () => {
  const grouped = groupExperienceByProgression([{
    id: 'prototype-key',
    code: 'EXP-TEST',
    organization: '__proto__',
    role: 'Security Engineer',
    yearRange: '2025 - Present',
    location: 'Remote',
    systemDomain: 'Security',
    keyOutputs: [],
    systemsArchitected: [],
    technologies: [],
    gridPosition: { x: 0, y: 0 }
  }]);
  assert.equal(grouped.length, 1);
  assert.equal(grouped[0].organization, '__proto__');
});

test('LinkedIn text, PDF bytes, and saved owner profiles enforce structural limits', async () => {
  assert.throws(
    () => parseLinkedInProfileText(Array.from({ length: MAX_LINKEDIN_INPUT_LINES + 1 }, () => 'line'), []),
    /line import limit/
  );
  assert.equal(validateOwnerProfilePayload({ operator: { name: 'Only a name' } }), false);
  await assert.rejects(
    extractPdfColumnsFromBytes(new Uint8Array(MAX_LINKEDIN_PDF_BYTES + 1)),
    /15 MB import limit/
  );
});

test('setup PDF endpoint rejects unsupported media types and embedded raw PDF signatures', async () => {
  const server = createSetupPortfolioServer({ persistToDisk: false });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as { port: number }).port;
  try {
    const unsupported = await fetch(`http://127.0.0.1:${port}/api/upload-pdf`, {
      method: 'POST',
      headers: { 'x-setup-csrf-token': WIZARD_SESSION_CSRF_TOKEN, 'content-type': 'text/plain' },
      body: '%PDF-1.7'
    });
    assert.equal(unsupported.status, 415);

    const embedded = await fetch(`http://127.0.0.1:${port}/api/upload-pdf`, {
      method: 'POST',
      headers: { 'x-setup-csrf-token': WIZARD_SESSION_CSRF_TOKEN, 'content-type': 'application/pdf' },
      body: 'prefix%PDF-1.7'
    });
    assert.equal(embedded.status, 400);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test('all dynamic public navigation surfaces call the centralized URL guard', () => {
  const read = (file: string) => fs.readFileSync(path.resolve(file), 'utf8');
  assert.match(read('src/components/ResumeModal.tsx'), /sanitizeHttpUrl\(p\.links\?\.github\)/);
  assert.match(read('src/components/LeftNavigationRail.tsx'), /sanitizeHttpUrl\(templateRepositoryUrl\)/);
  assert.match(read('src/components/RightInspectorPanel.tsx'), /isSafeHttpUrl\(activeOperator\.contact\.github\)/);
  assert.doesNotMatch(read('src/components/ContactPage.tsx'), /href=\{`mailto:\$\{/);
});

test('untrusted setup data is context-escaped and the public app has a crash fallback', () => {
  const wizard = fs.readFileSync(path.resolve('scripts/setup-portfolio.html'), 'utf8');
  const flagships = fs.readFileSync(path.resolve('scripts/setup-flagships.ts'), 'utf8');
  const main = fs.readFileSync(path.resolve('src/main.tsx'), 'utf8');
  assert.match(wizard, /inlineJsString\(p\.id\)/);
  assert.match(flagships, /escapeHtml\(p\.code\)/);
  assert.match(flagships, /inlineJsString\(p\.id\)/);
  assert.match(main, /<AppErrorBoundary>/);
});
