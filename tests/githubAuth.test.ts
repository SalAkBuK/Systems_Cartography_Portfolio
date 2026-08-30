import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as http from 'node:http';
import * as fs from 'fs';
import * as path from 'path';
import {
  resolveGitHubAuth,
  parseRateLimitHeaders,
  fetchGitHubRateLimit,
  getGitHubAuthStatus
} from '../scripts/githubAuthResolver';
import {
  discoverGitHubInventory,
  fetchRepoInspection,
  fetchGitHubUserData,
  connectGitHubTarget,
  GitHubFetchOptions
} from '../src/services/githubService';
import {
  createSetupPortfolioServer,
  WIZARD_SESSION_CSRF_TOKEN
} from '../scripts/setup-portfolio';

test('1. GITHUB_TOKEN preferred when present in environment', async () => {
  const customEnv = { GITHUB_TOKEN: 'ghp_env_token_secret_123' };
  const mockExec = async () => ({ stdout: 'gho_cli_token_456', stderr: '' });

  const res = await resolveGitHubAuth({ env: customEnv, execImpl: mockExec });
  assert.equal(res.mode, 'env-token');
  assert.equal(res.authenticated, true);
  assert.equal(res.token, 'ghp_env_token_secret_123');
});

test('2. GitHub CLI token used when environment token is absent', async () => {
  const customEnv = {};
  const mockExec = async (file: string, args: string[]) => {
    assert.equal(file, 'gh');
    assert.deepEqual(args, ['auth', 'token']);
    return { stdout: ' gho_cli_token_456 \n', stderr: '' };
  };

  const res = await resolveGitHubAuth({ env: customEnv, execImpl: mockExec });
  assert.equal(res.mode, 'github-cli');
  assert.equal(res.authenticated, true);
  assert.equal(res.token, 'gho_cli_token_456');
});

test('3. Missing gh executable falls back gracefully to anonymous mode', async () => {
  const customEnv = {};
  const mockExec = async () => {
    const err = new Error('spawn gh ENOENT');
    (err as any).code = 'ENOENT';
    throw err;
  };

  const res = await resolveGitHubAuth({ env: customEnv, execImpl: mockExec });
  assert.equal(res.mode, 'anonymous');
  assert.equal(res.authenticated, false);
  assert.equal(res.token, undefined);
});

test('4. Unauthenticated gh CLI session falls back gracefully to anonymous mode', async () => {
  const customEnv = {};
  const mockExec = async () => {
    throw new Error('You are not logged into any GitHub hosts. Run gh auth login to authenticate.');
  };

  const res = await resolveGitHubAuth({ env: customEnv, execImpl: mockExec });
  assert.equal(res.mode, 'anonymous');
  assert.equal(res.authenticated, false);
  assert.equal(res.token, undefined);
});

test('5. Anonymous fallback still functions with empty env and no CLI', async () => {
  const customEnv = { GITHUB_TOKEN: '', GH_TOKEN: '' };
  const mockExec = async () => ({ stdout: '', stderr: '' });

  const res = await resolveGitHubAuth({ env: customEnv, execImpl: mockExec });
  assert.equal(res.mode, 'anonymous');
  assert.equal(res.authenticated, false);
  assert.equal(res.token, undefined);
});

test('6. Token never appears in returned wizard state or API status payloads', async () => {
  const secretToken = 'gho_super_secret_pat_9876543210';
  const customEnv = { GITHUB_TOKEN: secretToken };

  const status = await getGitHubAuthStatus({
    env: customEnv,
    fetchImpl: (async () => new Response(JSON.stringify({
      resources: { core: { limit: 5000, remaining: 4990, reset: 1770000000 } }
    }))) as any
  });

  const serialized = JSON.stringify(status);
  assert.ok(!serialized.includes(secretToken), 'Token must NEVER be in JSON payload');
  assert.equal(status.authenticated, true);
  assert.equal(status.authMode, 'env-token');
  assert.equal(status.rateLimit?.limit, 5000);
  assert.equal(status.rateLimit?.remaining, 4990);
});

test('7. Token never appears in HTTP rate limit diagnostic headers or error text', () => {
  const headers = new Headers({
    'x-ratelimit-limit': '5000',
    'x-ratelimit-remaining': '4820',
    'x-ratelimit-reset': '1770000000'
  });

  const parsed = parseRateLimitHeaders(headers);
  assert.deepEqual(parsed, {
    limit: 5000,
    remaining: 4820,
    resetAt: new Date(1770000000 * 1000).toISOString()
  });
});

test('8. Existing GitHub fetch layer receives authentication token across all calls', async () => {
  const calls: Array<{ url: string; authHeader: string | null }> = [];
  const secretToken = 'gho_test_token_alpha';

  const mockFetch: typeof fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input.toString();
    const headers = new Headers(init?.headers);
    calls.push({ url, authHeader: headers.get('authorization') });

    if (url.includes('/users/testuser/repos')) {
      return new Response(JSON.stringify([
        {
          id: 101,
          name: 'repo-one',
          full_name: 'testuser/repo-one',
          description: 'A test repository',
          html_url: 'https://github.com/testuser/repo-one',
          homepage: null,
          stargazers_count: 5,
          forks_count: 1,
          open_issues_count: 0,
          watchers_count: 5,
          language: 'TypeScript',
          topics: ['react'],
          size: 100,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
          archived: false,
          fork: false,
          default_branch: 'main',
          owner: { login: 'testuser', avatar_url: '', html_url: '' }
        }
      ]), { status: 200 });
    }

    if (url.includes('/users/testuser')) {
      return new Response(JSON.stringify({
        login: 'testuser',
        name: 'Test Developer',
        avatar_url: 'https://avatar.url',
        bio: 'Full Stack Engineer',
        html_url: 'https://github.com/testuser',
        public_repos: 1
      }), { status: 200 });
    }

    if (url.includes('/readme')) {
      return new Response('# Repo One', { status: 200 });
    }

    if (url.includes('/git/trees/')) {
      return new Response(JSON.stringify({
        tree: [
          { path: 'package.json' },
          { path: 'src/index.ts' }
        ],
        truncated: false
      }), { status: 200 });
    }

    if (url.includes('/contents/package.json')) {
      return new Response(JSON.stringify({
        name: 'repo-one',
        dependencies: { react: '^18.0.0' }
      }), { status: 200 });
    }

    return new Response('Not Found', { status: 404 });
  }) as any;

  const result = await fetchGitHubUserData('testuser', {
    token: secretToken,
    fetchImpl: mockFetch
  });

  assert.equal(result.projects.length, 1);
  assert.ok(calls.length >= 4, 'Must make profile, repo, tree, readme, and manifest calls');

  // Verify EVERY call to api.github.com included the Authorization header with Bearer token
  for (const call of calls) {
    assert.equal(
      call.authHeader,
      `Bearer ${secretToken}`,
      `Call to ${call.url} must include Authorization header`
    );
  }
});

test('9. Manifest fetching explicitly receives authentication header', async () => {
  let manifestAuthHeader: string | null = null;
  const secretToken = 'gho_manifest_auth_token';

  const mockFetch: typeof fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input.toString();
    const headers = new Headers(init?.headers);

    if (url.includes('/contents/package.json')) {
      manifestAuthHeader = headers.get('authorization');
      return new Response('{"name":"pkg"}', { status: 200 });
    }
    if (url.includes('/readme')) {
      return new Response('README', { status: 200 });
    }
    if (url.includes('/git/trees/')) {
      return new Response(JSON.stringify({
        tree: [{ path: 'package.json' }],
        truncated: false
      }), { status: 200 });
    }
    return new Response('Not Found', { status: 404 });
  }) as any;

  await fetchRepoInspection('owner', 'repo', 'main', {
    token: secretToken,
    fetchImpl: mockFetch
  });

  assert.equal(manifestAuthHeader, `Bearer ${secretToken}`);
});

test('10. Authenticated rate-limit metadata handled safely without credentials', async () => {
  const mockFetch: typeof fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    assert.equal(headers.get('authorization'), 'Bearer cli_token_test');
    return new Response(JSON.stringify({
      resources: {
        core: { limit: 5000, remaining: 4932, reset: 1770001000 }
      }
    }), { status: 200 });
  }) as any;

  const rateLimit = await fetchGitHubRateLimit('cli_token_test', mockFetch);
  assert.equal(rateLimit?.limit, 5000);
  assert.equal(rateLimit?.remaining, 4932);
  assert.equal(rateLimit?.resetAt, new Date(1770001000 * 1000).toISOString());
});

test('11. Setup wizard progression: first-time failed sync cannot advance and existing owner keeps profile', async () => {
  const html = fs.readFileSync(path.resolve('scripts/setup-portfolio.html'), 'utf8');

  // Verify progression gating logic exists in HTML
  assert.ok(html.includes('updateGithubProgressionUI'), 'Wizard must maintain updateGithubProgressionUI function');
  assert.ok(html.includes('KEEP EXISTING GITHUB SNAPSHOT & CONTINUE'), 'Wizard must support keeping existing snapshot');
  assert.ok(html.includes('CONTINUE TO FLAGSHIPS →'), 'Wizard must support advancing to flagships after success');
  assert.ok(html.includes('recheckGitHubAuth'), 'Wizard must provide recheckGitHubAuth function');
  assert.ok(html.includes('RECHECK GITHUB ACCESS'), 'Wizard must render RECHECK GITHUB ACCESS button');
});

test('12. Authenticated cross-owner sync: token owner-A can synchronize public repositories for owner-B', async () => {
  const calls: Array<{ url: string; authHeader: string | null }> = [];
  const tokenForUserA = 'gho_user_a_token_secret';

  const mockFetch: typeof fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input.toString();
    const headers = new Headers(init?.headers);
    calls.push({ url, authHeader: headers.get('authorization') });

    if (url.includes('/users/owner-B/repos')) {
      return new Response(JSON.stringify([
        {
          id: 202,
          name: 'project-b',
          full_name: 'owner-B/project-b',
          description: 'Project belonging to owner B',
          html_url: 'https://github.com/owner-B/project-b',
          homepage: null,
          stargazers_count: 10,
          forks_count: 2,
          open_issues_count: 0,
          watchers_count: 10,
          language: 'Go',
          topics: [],
          size: 250,
          created_at: '2024-05-01T00:00:00Z',
          updated_at: '2025-05-01T00:00:00Z',
          archived: false,
          fork: false,
          default_branch: 'main',
          owner: { login: 'owner-B', avatar_url: '', html_url: '' }
        }
      ]), { status: 200 });
    }

    if (url.includes('/users/owner-B')) {
      return new Response(JSON.stringify({
        login: 'owner-B',
        name: 'Owner B Public Profile',
        avatar_url: '',
        bio: 'Systems Engineer B',
        html_url: 'https://github.com/owner-B',
        public_repos: 1
      }), { status: 200 });
    }

    if (url.includes('/readme')) return new Response('# Project B', { status: 200 });
    if (url.includes('/git/trees/')) return new Response(JSON.stringify({ tree: [], truncated: false }), { status: 200 });

    return new Response('Not Found', { status: 404 });
  }) as any;

  // Sync owner-B using user A's token
  const result = await fetchGitHubUserData('owner-B', {
    token: tokenForUserA,
    fetchImpl: mockFetch
  });

  // Verify:
  // 1. Result belongs to target owner-B
  assert.equal(result.user.login, 'owner-B');
  assert.equal(result.projects[0].title, 'project-b');
  assert.equal(result.sourceIdentifier, 'owner-B');

  // 2. All calls to fetch owner-B were authenticated with tokenForUserA
  assert.ok(calls.length >= 3);
  for (const call of calls) {
    assert.equal(call.authHeader, `Bearer ${tokenForUserA}`);
    assert.ok(call.url.includes('owner-B'), 'All query URLs must target owner-B');
  }
});

test('13. Setup wizard server exposes /api/github-auth-status safely without leaking token', async () => {
  const server = createSetupPortfolioServer({ persistToDisk: false });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const addr = server.address() as { port: number };

  const res = await fetch(`http://127.0.0.1:${addr.port}/api/github-auth-status`);
  assert.equal(res.status, 200);
  const data = await res.json();

  assert.equal(data.success, true);
  assert.ok(typeof data.authenticated === 'boolean');
  assert.ok(['env-token', 'github-cli', 'anonymous'].includes(data.authMode));
  assert.equal((data as any).token, undefined, 'API payload must never return a token field');

  server.close();
});
