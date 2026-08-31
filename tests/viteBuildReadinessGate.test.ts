// Fork-safety fix: the existing deployment-readiness check (already enforced
// via `npm run setup:deploy-check` ahead of `vite build` in the "build" npm
// script) previously did NOT run when `vite build` / `npx vite build` was
// invoked directly, bypassing the npm script wrapper entirely. This suite
// proves the gate is now also enforced INSIDE vite.config.ts itself, reusing
// the existing `runDeploymentReadinessCheck` implementation (no duplicated
// owner-comparison logic), and that it never fires outside a production
// build (dev server, setup wizard).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execFileSync } from 'node:child_process';
// vite.config.ts's pre-existing (unrelated to this fix) `resolve.alias` uses
// the CommonJS `__dirname` global. Vite's own config loader shims that for
// ESM config files; a plain Node/tsx `import` of the file does not provide
// it, so this test harness supplies an equivalent shim purely so the config
// factory can be invoked directly here -- this does not change vite.config.ts
// or its real runtime behavior under an actual `vite build`/`vite dev`.
(globalThis as unknown as { __dirname?: string }).__dirname = path.resolve('.');

import viteConfigFactoryImport from '../vite.config';

const viteConfigSource = fs.readFileSync(path.resolve('vite.config.ts'), 'utf8');

type ViteConfigFactory = (env: { command: 'build' | 'serve'; mode: string }) => unknown;

// A single static import is sufficient (and simpler than re-importing per
// test): the exported value is a plain function closure with no internal
// caching of its own -- every call re-reads live process.env/git state via
// the existing runDeploymentReadinessCheck implementation.
const configFactory = viteConfigFactoryImport as unknown as ViteConfigFactory;

// Every environment variable detectRepositoryIdentity() consults, in the
// same priority order it checks them (src/utils/deploymentReadiness.ts).
// Cleared before each simulated scenario so ambient CI state on the machine
// actually running this test suite can never leak into or mask the scenario
// being simulated.
const CI_ENV_KEYS = [
  'VERCEL', 'VERCEL_GIT_REPO_OWNER', 'VERCEL_GIT_REPO_SLUG',
  'NETLIFY', 'REPOSITORY_URL',
  'GITHUB_ACTIONS', 'GITHUB_REPOSITORY',
  'GITLAB_CI', 'CI_PROJECT_PATH',
  'BITBUCKET_BUILD_NUMBER', 'BITBUCKET_REPO_FULL_NAME',
  'CI', 'CI_REPOSITORY_URL'
];

function withEnv<T>(overrides: Record<string, string | undefined>, fn: () => T): T {
  const saved: Record<string, string | undefined> = {};
  for (const key of CI_ENV_KEYS) saved[key] = process.env[key];
  try {
    for (const key of CI_ENV_KEYS) delete process.env[key];
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    return fn();
  } finally {
    for (const key of CI_ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}

function captureConsoleLog<T>(fn: () => T): { result: T; output: string } {
  const lines: string[] = [];
  const original = console.log;
  console.log = (...args: unknown[]) => { lines.push(args.map(String).join(' ')); };
  try {
    const result = fn();
    return { result, output: lines.join('\n') };
  } finally {
    console.log = original;
  }
}

test('vite.config.ts imports the EXISTING deployment-readiness implementation rather than duplicating owner-comparison logic', () => {
  assert.match(viteConfigSource, /from ['"]\.\/scripts\/check-deployment-readiness['"]/);
  assert.match(viteConfigSource, /runDeploymentReadinessCheck/);
  for (const forbidden of [
    'sameRepository', 'configuredRepositoryOwner ===', 'configuredRepositoryName ===',
    'OWNER_SETUP_MANIFEST', '.toLowerCase() ===', 'evaluateDeploymentReadiness', 'detectRepositoryIdentity'
  ]) {
    assert.ok(
      !viteConfigSource.includes(forbidden),
      `vite.config.ts must reuse the existing readiness function, not reimplement/duplicate owner-comparison logic (found "${forbidden}")`
    );
  }
});

test('no owner-specific identity was added to vite.config.ts', () => {
  assert.ok(!/SalAkBuK/i.test(viteConfigSource), 'vite.config.ts must not hardcode the owner GitHub handle');
  assert.ok(!/Systems_Cartography_Portfolio/i.test(viteConfigSource), 'vite.config.ts must not hardcode the repository name');
});

test('the gate is scoped to `command === "build"` so ordinary dev mode is never touched by construction', () => {
  assert.match(viteConfigSource, /command === 'build'/);
});

test('vite production build: matching configured/live repository identity allows the build to proceed and actually invokes the existing readiness check', () => {
  const { result: config, output } = withEnv({}, () =>
    captureConsoleLog(() => configFactory({ command: 'build', mode: 'production' }))
  );
  assert.ok(config && typeof config === 'object', 'a valid config object must be returned when readiness passes');
  assert.ok((config as Record<string, unknown>).plugins, 'the returned config must still be the real Vite config (plugins present)');
  assert.match(output, /DEPLOYMENT GUARD/, 'the existing runDeploymentReadinessCheck output must actually run during a production build');
  assert.match(output, /BUILD ALLOWED/);
});

test('vite production build: a foreign/fork repository identity throws and blocks the build before any output is generated', () => {
  assert.throws(
    () => withEnv(
      { GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'some-stranger/other-repo' },
      () => configFactory({ command: 'build', mode: 'production' })
    ),
    /Deployment readiness check failed/,
    'a repository-identity mismatch must throw during Vite config resolution, before any bundling/output happens'
  );
});

test('vite production build: an unresolvable repository identity (no CI signal, no git origin) also fails closed', () => {
  const originalCwd = process.cwd();
  const outsideGitDir = os.tmpdir();
  try {
    assert.throws(
      () => withEnv({}, () => {
        // Force git-origin resolution to fail too by running from a cwd
        // with no git repository, so identity is genuinely UNAVAILABLE
        // (not just mismatched).
        process.chdir(outsideGitDir);
        return configFactory({ command: 'build', mode: 'production' });
      }),
      /Deployment readiness check failed/
    );
  } finally {
    process.chdir(originalCwd);
  }
});

test('development/setup workflow is not accidentally blocked: command !== "build" never invokes the gate, even with a foreign identity in scope', () => {
  const config = withEnv(
    { GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'some-stranger/other-repo' },
    () => configFactory({ command: 'serve', mode: 'development' })
  );
  assert.ok(config && typeof config === 'object', 'the dev server config must resolve normally regardless of repository identity');
  assert.ok((config as Record<string, unknown>).plugins, 'the dev server must still get the real Vite config');
});

test('owner/generated data and the deployment-readiness source of truth are untouched by this fix', () => {
  const protectedPaths = [
    'src/data/ownerProfile.generated.ts',
    'src/data/githubSnapshot.generated.ts',
    'src/config/ownerSetup.generated.ts',
    'src/config/ownerPreferences.ts',
    'src/utils/deploymentReadiness.ts',
    'scripts/deployment-readiness.ts',
    'scripts/check-deployment-readiness.ts',
    'scripts/check-owner-setup.ts',
    'scripts/setup-portfolio.ts'
  ];
  const changed = execFileSync(
    'git',
    ['diff', '--name-only', 'HEAD', '--', ...protectedPaths],
    { encoding: 'utf8', cwd: path.resolve('.') }
  ).trim();
  assert.equal(changed, '', `expected no changes to owner/generated/readiness-source files, but found:\n${changed}`);
});

test('the npm package.json build script still chains through the existing setup:deploy-check as a first, fast-failing layer', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));
  assert.match(packageJson.scripts.build, /setup:deploy-check/);
  assert.match(packageJson.scripts.build, /vite build/);
});
