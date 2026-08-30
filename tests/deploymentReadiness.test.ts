import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import {
  detectRepositoryIdentity,
  evaluateDeploymentReadiness,
  parseGitRemoteUrl,
  parseRepositorySlug
} from '../src/utils/deploymentReadiness';
import {
  createOwnerSetupManifest,
  type OwnerSetupManifest
} from '../src/config/ownerSetupManifest';
import { OWNER_SETUP_MANIFEST } from '../src/config/ownerSetup.generated';
import {
  createSetupPortfolioServer,
  WIZARD_SESSION_CSRF_TOKEN
} from '../scripts/setup-portfolio';
import { GITHUB_SNAPSHOT_METADATA } from '../src/data/githubSnapshot.generated';
import { runOwnerSetupChecks } from '../scripts/check-owner-setup';

const protectedOwnerDataPaths = [
  'src/data/ownerProfile.generated.ts',
  'src/data/githubSnapshot.generated.ts',
  'src/config/ownerPreferences.ts'
];

const originalManifest: OwnerSetupManifest = {
  schemaVersion: 1,
  setupCompleted: true,
  configuredRepositoryOwner: 'SalAkBuK',
  configuredRepositoryName: 'Systems_Cartography_Portfolio',
  portfolioGithubOwner: 'SalAkBuK'
};

const originalResolution = {
  identity: { owner: 'SalAkBuK', name: 'Systems_Cartography_Portfolio' },
  source: 'git-origin' as const
};

async function listen(server: ReturnType<typeof createSetupPortfolioServer>): Promise<number> {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return (server.address() as { port: number }).port;
}

async function close(server: ReturnType<typeof createSetupPortfolioServer>): Promise<void> {
  await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
}

async function postComplete(port: number): Promise<Response> {
  return fetch(`http://127.0.0.1:${port}/api/complete`, {
    method: 'POST',
    headers: { 'X-Setup-CSRF-Token': WIZARD_SESSION_CSRF_TOKEN }
  });
}

test('deployment guard passes when the original repository matches its setup manifest', () => {
  const result = evaluateDeploymentReadiness(originalManifest, originalResolution);
  assert.equal(result.ready, true);
  assert.equal(result.code, 'READY');
});

test('deployment guard fails when a fork owner differs from the copied manifest', () => {
  const result = evaluateDeploymentReadiness(originalManifest, {
    identity: { owner: 'alice', name: 'Systems_Cartography_Portfolio' },
    source: 'vercel'
  });
  assert.equal(result.ready, false);
  assert.equal(result.code, 'REPOSITORY_MISMATCH');
});

test('copied owner profile, snapshot, preferences, and manifest cannot self-validate in a fork', () => {
  // Owner-data agreement is intentionally not an input to this repository-bound check.
  const result = evaluateDeploymentReadiness(OWNER_SETUP_MANIFEST, {
    identity: { owner: 'alice', name: 'Systems_Cartography_Portfolio' },
    source: 'github-actions'
  });
  assert.equal(result.ready, false);
  assert.equal(result.code, 'REPOSITORY_MISMATCH');
});

test('a completed fork setup rewrites repository identity only after fresh setup steps and verification', async () => {
  const protectedOwnerDataBefore = protectedOwnerDataPaths.map(file => fs.readFileSync(file, 'utf8'));
  const written: OwnerSetupManifest[] = [];
  const server = createSetupPortfolioServer({
    initialStateOverrides: {
      profileSavedThisSession: true,
      githubSyncedThisSession: true,
      flagshipsSavedThisSession: true
    },
    persistToDisk: false,
    persistSetupManifest: true,
    repositoryIdentityResolver: () => ({
      identity: { owner: 'alice', name: 'Systems_Cartography_Portfolio' },
      source: 'git-origin'
    }),
    setupManifestWriter: manifest => written.push(manifest)
  });
  const port = await listen(server);
  try {
    const verify = await fetch(`http://127.0.0.1:${port}/api/verify`);
    assert.equal((await verify.json()).success, true);

    const complete = await postComplete(port);
    assert.equal(complete.status, 200);
    assert.equal(written.length, 1);
    assert.equal(written[0].configuredRepositoryOwner, 'alice');
    assert.equal(written[0].configuredRepositoryName, 'Systems_Cartography_Portfolio');
  } finally {
    await close(server);
  }
  assert.deepEqual(
    protectedOwnerDataPaths.map(file => fs.readFileSync(file, 'utf8')),
    protectedOwnerDataBefore,
    'persistToDisk:false must not touch generated owner data or preferences'
  );
});

test('an incomplete fork wizard cannot rewrite the setup manifest', async () => {
  const written: OwnerSetupManifest[] = [];
  const server = createSetupPortfolioServer({
    persistToDisk: false,
    persistSetupManifest: true,
    repositoryIdentityResolver: () => ({
      identity: { owner: 'alice', name: 'Systems_Cartography_Portfolio' },
      source: 'git-origin'
    }),
    setupManifestWriter: manifest => written.push(manifest)
  });
  const port = await listen(server);
  try {
    const verify = await fetch(`http://127.0.0.1:${port}/api/verify`);
    assert.equal((await verify.json()).success, true, 'Copied owner data alone can pass internal diagnostics');
    const complete = await postComplete(port);
    assert.equal(complete.status, 409);
    assert.match((await complete.json()).error, /fresh setup steps/i);
    assert.equal(written.length, 0);
  } finally {
    await close(server);
  }
});

test('a fork with a copied configured profile is presented as requiring fresh setup', async () => {
  const server = createSetupPortfolioServer({
    persistToDisk: false,
    repositoryIdentityResolver: () => ({
      identity: { owner: 'alice', name: 'Systems_Cartography_Portfolio' },
      source: 'git-origin'
    })
  });
  const port = await listen(server);
  try {
    const session = await fetch(`http://127.0.0.1:${port}/api/session`);
    const data = await session.json();
    assert.equal(data.existingSetup, false);
    assert.equal(data.repositorySetupRequired, true);
  } finally {
    await close(server);
  }
});

test('failed verification cannot rewrite the setup manifest', async () => {
  const written: OwnerSetupManifest[] = [];
  const server = createSetupPortfolioServer({
    initialStateOverrides: {
      snapshotMetadata: {
        ...GITHUB_SNAPSHOT_METADATA,
        githubTarget: 'https://github.com/different-owner'
      },
      profileSavedThisSession: true,
      githubSyncedThisSession: true,
      flagshipsSavedThisSession: true
    },
    persistToDisk: false,
    persistSetupManifest: true,
    repositoryIdentityResolver: () => ({
      identity: { owner: 'alice', name: 'Systems_Cartography_Portfolio' },
      source: 'git-origin'
    }),
    setupManifestWriter: manifest => written.push(manifest)
  });
  const port = await listen(server);
  try {
    const verify = await fetch(`http://127.0.0.1:${port}/api/verify`);
    assert.equal((await verify.json()).success, false);
    const complete = await postComplete(port);
    assert.equal(complete.status, 409);
    assert.equal(written.length, 0);
  } finally {
    await close(server);
  }
});

test('successful verification cannot be reused after a setup input changes', async () => {
  const written: OwnerSetupManifest[] = [];
  const server = createSetupPortfolioServer({
    initialStateOverrides: {
      profileSavedThisSession: true,
      githubSyncedThisSession: true,
      flagshipsSavedThisSession: true
    },
    persistToDisk: false,
    persistSetupManifest: true,
    repositoryIdentityResolver: () => ({
      identity: { owner: 'alice', name: 'Systems_Cartography_Portfolio' },
      source: 'git-origin'
    }),
    setupManifestWriter: manifest => written.push(manifest)
  });
  const port = await listen(server);
  try {
    const verify = await fetch(`http://127.0.0.1:${port}/api/verify`);
    assert.equal((await verify.json()).success, true);

    const mutate = await fetch(`http://127.0.0.1:${port}/api/save-flagships`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Setup-CSRF-Token': WIZARD_SESSION_CSRF_TOKEN
      },
      body: JSON.stringify({ flagshipProjectIds: [] })
    });
    assert.equal(mutate.status, 200);

    const complete = await postComplete(port);
    assert.equal(complete.status, 409);
    assert.match((await complete.json()).error, /run verification successfully/i);
    assert.equal(written.length, 0);
  } finally {
    await close(server);
  }
});

test('repository owner and portfolio GitHub owner may differ after deliberate valid setup', () => {
  const manifest = createOwnerSetupManifest(
    { owner: 'alice', name: 'Systems_Cartography_Portfolio' },
    'some-public-organization'
  );
  const result = evaluateDeploymentReadiness(manifest, {
    identity: { owner: 'alice', name: 'Systems_Cartography_Portfolio' },
    source: 'vercel'
  });
  assert.equal(manifest.portfolioGithubOwner, 'some-public-organization');
  assert.equal(result.ready, true);
});

test('GitHub CLI authentication identity does not participate in repository detection', () => {
  const result = detectRepositoryIdentity({
    env: {
      GH_USER: 'authenticated-someone-else',
      GITHUB_USER: 'authenticated-someone-else'
    },
    getGitOriginUrl: () => 'https://github.com/alice/Systems_Cartography_Portfolio.git'
  });
  assert.deepEqual(result.identity, { owner: 'alice', name: 'Systems_Cartography_Portfolio' });
  assert.equal(result.source, 'git-origin');
});

test('HTTPS GitHub remotes are parsed without network access', () => {
  assert.deepEqual(
    parseGitRemoteUrl('https://github.com/owner/repository.git'),
    { owner: 'owner', name: 'repository' }
  );
});

test('SSH GitHub remotes are parsed without network access', () => {
  assert.deepEqual(
    parseGitRemoteUrl('git@github.com:owner/repository.git'),
    { owner: 'owner', name: 'repository' }
  );
});

test('malformed and unknown remotes are handled safely', () => {
  assert.equal(parseGitRemoteUrl('not a repository remote'), null);
  assert.equal(parseGitRemoteUrl('https://example.com/owner/repository.git'), null);
  assert.equal(parseRepositorySlug('owner/too/many/parts'), null);
  assert.equal(parseRepositorySlug('owner!/repository'), null);
  const result = detectRepositoryIdentity({ env: {}, getGitOriginUrl: () => 'malformed' });
  assert.equal(result.identity, null);
});

test('deployment-provider metadata takes precedence over CI and git origin', () => {
  const result = detectRepositoryIdentity({
    env: {
      VERCEL: '1',
      VERCEL_GIT_REPO_OWNER: 'provider-owner',
      VERCEL_GIT_REPO_SLUG: 'provider-repo',
      GITHUB_ACTIONS: 'true',
      GITHUB_REPOSITORY: 'ci-owner/ci-repo'
    },
    getGitOriginUrl: () => 'https://github.com/git-owner/git-repo.git'
  });
  assert.deepEqual(result.identity, { owner: 'provider-owner', name: 'provider-repo' });
  assert.equal(result.source, 'vercel');
});

test('no .git directory is needed when supported CI metadata is valid', () => {
  const githubActionsResult = detectRepositoryIdentity({
    env: {
      GITHUB_ACTIONS: 'true',
      GITHUB_REPOSITORY: 'alice/Systems_Cartography_Portfolio'
    },
    getGitOriginUrl: () => { throw new Error('.git unavailable'); }
  });
  assert.deepEqual(githubActionsResult.identity, { owner: 'alice', name: 'Systems_Cartography_Portfolio' });
  assert.equal(githubActionsResult.source, 'github-actions');

  const supportedCiUrlResult = detectRepositoryIdentity({
    env: {
      CI: 'true',
      CI_REPOSITORY_URL: 'https://github.com/alice/Systems_Cartography_Portfolio.git'
    },
    getGitOriginUrl: () => { throw new Error('.git unavailable'); }
  });
  assert.deepEqual(supportedCiUrlResult.identity, { owner: 'alice', name: 'Systems_Cartography_Portfolio' });
  assert.equal(supportedCiUrlResult.source, 'ci-repository-url');

  const netlifyResult = detectRepositoryIdentity({
    env: {
      NETLIFY: 'true',
      REPOSITORY_URL: 'https://github.com/alice/Systems_Cartography_Portfolio.git'
    },
    getGitOriginUrl: () => { throw new Error('.git unavailable'); }
  });
  assert.deepEqual(netlifyResult.identity, { owner: 'alice', name: 'Systems_Cartography_Portfolio' });
  assert.equal(netlifyResult.source, 'netlify');
});

test('malformed or incomplete authoritative provider metadata fails without falling back to Git', () => {
  const result = detectRepositoryIdentity({
    env: {
      VERCEL: '1',
      VERCEL_GIT_REPO_OWNER: 'provider-owner',
      PORTFOLIO_REPOSITORY_IDENTITY: 'SalAkBuK/Systems_Cartography_Portfolio'
    },
    getGitOriginUrl: () => 'https://github.com/SalAkBuK/Systems_Cartography_Portfolio.git'
  });
  assert.equal(result.identity, null);
  assert.equal(result.source, 'vercel');
  assert.match(result.reason || '', /missing or malformed/i);
});

test('a valid GitHub origin remains a trusted identity source', () => {
  const result = detectRepositoryIdentity({
    env: {},
    getGitOriginUrl: () => 'git@github.com:alice/Systems_Cartography_Portfolio.git'
  });
  assert.deepEqual(result.identity, { owner: 'alice', name: 'Systems_Cartography_Portfolio' });
  assert.equal(result.source, 'git-origin');
});

test('repository identity unavailability fails closed and deterministically', () => {
  const resolution = detectRepositoryIdentity({ env: {}, getGitOriginUrl: () => null });
  const result = evaluateDeploymentReadiness(originalManifest, resolution);
  assert.equal(result.ready, false);
  assert.equal(result.code, 'REPOSITORY_IDENTITY_UNAVAILABLE');
});

test('PORTFOLIO_REPOSITORY_IDENTITY has no effect when trusted identity is unavailable', () => {
  const result = detectRepositoryIdentity({
    env: {
      PORTFOLIO_REPOSITORY_IDENTITY: 'SalAkBuK/Systems_Cartography_Portfolio',
      CI_REPOSITORY_URL: 'https://github.com/SalAkBuK/Systems_Cartography_Portfolio.git'
    },
    getGitOriginUrl: () => null
  });
  assert.equal(result.identity, null);
  assert.equal(result.source, null);
});

test('an inherited manifest cannot be validated through a manually supplied identity environment variable', () => {
  const resolution = detectRepositoryIdentity({
    env: { PORTFOLIO_REPOSITORY_IDENTITY: 'SalAkBuK/Systems_Cartography_Portfolio' },
    getGitOriginUrl: () => null
  });
  const result = evaluateDeploymentReadiness(originalManifest, resolution);
  assert.equal(result.ready, false);
  assert.equal(result.code, 'REPOSITORY_IDENTITY_UNAVAILABLE');
});

test('owner checks can pass before the repository setup manifest is initialized', () => {
  const ownerSummary = runOwnerSetupChecks();
  const uninitializedManifest: OwnerSetupManifest = {
    schemaVersion: 1,
    setupCompleted: false,
    configuredRepositoryOwner: '',
    configuredRepositoryName: '',
    portfolioGithubOwner: ''
  };
  const deployment = evaluateDeploymentReadiness(uninitializedManifest, originalResolution);
  const unsupportedManifest = {
    ...uninitializedManifest,
    schemaVersion: 999
  } as unknown as OwnerSetupManifest;
  const unsupportedDeployment = evaluateDeploymentReadiness(unsupportedManifest, originalResolution);

  assert.equal(ownerSummary.failCount, 0);
  assert.notEqual(ownerSummary.status, 'FAIL');
  assert.equal(deployment.ready, false);
  assert.equal(deployment.code, 'SETUP_INCOMPLETE');
  assert.equal(unsupportedDeployment.ready, false);
  assert.equal(unsupportedDeployment.code, 'UNSUPPORTED_MANIFEST');
});

test('the current SalAkBuK repository baseline remains deployment-ready', () => {
  const result = evaluateDeploymentReadiness(OWNER_SETUP_MANIFEST, originalResolution);
  assert.equal(result.ready, true);
});

test('deployment guard source has no credential or authenticated-account dependency', () => {
  const source = [
    fs.readFileSync('scripts/check-deployment-readiness.ts', 'utf8'),
    fs.readFileSync('scripts/deployment-readiness.ts', 'utf8'),
    fs.readFileSync('src/utils/deploymentReadiness.ts', 'utf8')
  ].join('\n');
  assert.doesNotMatch(source, /GITHUB_TOKEN|GH_TOKEN|API_KEY|CLIENT_SECRET|gh auth/i);
  assert.doesNotMatch(source, /PORTFOLIO_REPOSITORY_IDENTITY/);
});
