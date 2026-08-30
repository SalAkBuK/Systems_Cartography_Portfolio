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
import { buildMinimalLinkedInPdf } from './fixtures/buildTestPdf';

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

/**
 * A genuinely fresh profile as if `alice` (a fork owner distinct from the
 * inherited SalAkBuK setup) had actually completed the PROFILE step this
 * session -- as opposed to the inherited OWNER_PROFILE, which must never
 * self-validate a fork's setup.
 */
const freshAliceProfile: any = {
  source: { kind: 'linkedin_pdf', importedAt: new Date().toISOString(), reviewed: true, warnings: [] },
  githubTarget: 'https://github.com/alice',
  operator: {
    name: 'Alice Example',
    role: 'Engineer',
    location: 'Remote',
    focus: '',
    primaryStack: [],
    systemManifesto: '',
    contact: { email: '', linkedin: '' }
  },
  experience: [],
  skills: [],
  certifications: [],
  education: []
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
      ownerProfile: freshAliceProfile,
      confirmedGitHub: freshAliceProfile.githubTarget,
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
    assert.equal((await verify.json()).success, true, 'A genuinely fresh in-session profile must be able to pass verification');

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
    assert.equal((await verify.json()).success, false, 'Inherited owner data alone must NOT pass verification in a fork');
    const complete = await postComplete(port);
    assert.equal(complete.status, 409);
    assert.match((await complete.json()).error, /run verification successfully/i);
    assert.equal(written.length, 0);
  } finally {
    await close(server);
  }
});

test('a fork wizard that fakes session flags without fresh data still cannot rewrite the setup manifest', async () => {
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
    assert.equal(
      (await verify.json()).success,
      false,
      'Session flags alone (without genuinely fresh profile/github/flagship data) must not satisfy verification'
    );
    const complete = await postComplete(port);
    assert.equal(complete.status, 409);
    assert.equal(written.length, 0);
  } finally {
    await close(server);
  }
});

test('a fork with a copied configured profile is presented as requiring fresh setup', async () => {
  const server = createSetupPortfolioServer({
    persistToDisk: false,
    // Simulates the fork's own detected git origin, distinct from the
    // inherited SalAkBuK manifest -- avoids depending on this sandbox's own
    // real git origin for a deterministic assertion.
    initialStateOverrides: { detectedGitHub: 'https://github.com/alice' },
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
    assert.equal(data.repositoryReinitializationRequired, true);
    assert.equal(
      data.detectedGitHub,
      'https://github.com/alice',
      'the fork\'s own origin must still be surfaced as a detected suggestion'
    );
    assert.equal(
      data.confirmedGitHub,
      '',
      'a merely detected suggestion must never be reported as confirmed -- confirmation requires deliberate user action'
    );
    assert.doesNotMatch(data.confirmedGitHub || '', /salakbuk/i);
    assert.equal(data.operator?.name, '', 'Inherited operator identity must not appear as the active fork profile');
    assert.equal(data.githubTarget, '', 'Inherited githubTarget must not appear as the active fork profile githubTarget');
    assert.equal(data.projectsCount, 0, 'Inherited GitHub snapshot must not appear as active fork project data');
    assert.equal(data.flagshipsCount, 0, 'Inherited flagship selections must not appear as active for a fork');
    assert.equal(data.identityMatch.status, 'UNKNOWN', 'No profile identity is configured yet, so match status cannot be MISMATCH');

    const state = await fetch(`http://127.0.0.1:${port}/api/state`);
    const stateData = await state.json();
    assert.equal(stateData.repositoryReinitializationRequired, true);
    assert.equal(stateData.snapshot.projects.length, 0);
    assert.equal(stateData.preferences.flagshipProjectIds.length, 0);
    assert.equal(stateData.ownerProfile.operator.name, '');
  } finally {
    await close(server);
  }
});

test('PDF upload during fresh-fork reinitialization does not stamp the parsed profile with the inherited upstream GitHub target', async () => {
  const server = createSetupPortfolioServer({
    persistToDisk: false,
    initialStateOverrides: { detectedGitHub: 'https://github.com/alice' },
    repositoryIdentityResolver: () => ({
      identity: { owner: 'alice', name: 'Systems_Cartography_Portfolio' },
      source: 'git-origin'
    })
  });
  const port = await listen(server);
  try {
    const session = await fetch(`http://127.0.0.1:${port}/api/session`);
    const sessionData = await session.json();
    assert.doesNotMatch(sessionData.confirmedGitHub || '', /salakbuk/i);

    // Mirrors the wizard's browser behavior: the (uncontaminated) session
    // target is echoed back as the query param during PDF upload.
    const uploadUrl = `http://127.0.0.1:${port}/api/upload-pdf?githubTarget=${encodeURIComponent(sessionData.confirmedGitHub || '')}`;
    const upload = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'X-Setup-CSRF-Token': WIZARD_SESSION_CSRF_TOKEN, 'Content-Type': 'application/pdf' },
      body: Buffer.from('NOT A REAL PDF')
    });
    // The upload itself fails PDF parsing (no real PDF bytes) -- what matters
    // here is only that the target the wizard would have stamped in never
    // carries the inherited SalAkBuK identity.
    assert.equal(upload.status, 400);
    const uploadData = await upload.json();
    assert.doesNotMatch(uploadData.error || '', /salakbuk/i);

    const state = await fetch(`http://127.0.0.1:${port}/api/state`);
    const stateData = await state.json();
    assert.doesNotMatch(stateData.confirmedGitHub || '', /salakbuk/i);
  } finally {
    await close(server);
  }
});

/**
 * Focused regressions for the detected-vs-confirmed GitHub target distinction,
 * exercised against a real parseable PDF (not just malformed bytes), using
 * the fresh-fork example from the report: hafsah1976/Systems_Cartography_Portfolio.
 */
test('1+2+3+4. fresh fork detects hafsah1976, but detection alone never becomes confirmedGitHub nor stamps the uploaded PDF profile', async () => {
  const server = createSetupPortfolioServer({
    persistToDisk: false,
    initialStateOverrides: { detectedGitHub: 'https://github.com/hafsah1976' },
    repositoryIdentityResolver: () => ({
      identity: { owner: 'hafsah1976', name: 'Systems_Cartography_Portfolio' },
      source: 'git-origin'
    })
  });
  const port = await listen(server);
  try {
    // 1. Fresh fork detects hafsah1976.
    const session = await fetch(`http://127.0.0.1:${port}/api/session`);
    const sessionData = await session.json();
    assert.equal(sessionData.detectedGitHub, 'https://github.com/hafsah1976');

    // 2 + 4. Detection alone does not create confirmedGitHub; the two are
    // clearly distinguished in the same response.
    assert.equal(sessionData.confirmedGitHub, '');
    assert.notEqual(sessionData.detectedGitHub, sessionData.confirmedGitHub);

    // 3. Upload a real PDF with NO explicit githubTarget query param (mirrors
    // the corrected browser behavior: the detected suggestion is never
    // echoed back as a query param unless the user deliberately accepted it).
    const upload = await fetch(`http://127.0.0.1:${port}/api/upload-pdf`, {
      method: 'POST',
      headers: { 'X-Setup-CSRF-Token': WIZARD_SESSION_CSRF_TOKEN, 'Content-Type': 'application/pdf' },
      body: Buffer.from(buildMinimalLinkedInPdf())
    });
    assert.equal(upload.status, 200);
    const uploadData = await upload.json();
    assert.equal(uploadData.success, true);
    assert.equal(uploadData.profile.operator.name, 'Jordan Candidate');
    assert.equal(
      uploadData.profile.githubTarget,
      '',
      'a merely detected GitHub target must never be stamped onto the freshly parsed profile'
    );

    // The upload also must not have silently promoted detection into confirmation.
    const stateAfter = await fetch(`http://127.0.0.1:${port}/api/state`);
    const stateAfterData = await stateAfter.json();
    assert.equal(stateAfterData.confirmedGitHub, '');
  } finally {
    await close(server);
  }
});

test('3b. an explicitly confirmed GitHub target IS used to associate the uploaded PDF profile', async () => {
  const server = createSetupPortfolioServer({
    persistToDisk: false,
    initialStateOverrides: { detectedGitHub: 'https://github.com/hafsah1976' },
    repositoryIdentityResolver: () => ({
      identity: { owner: 'hafsah1976', name: 'Systems_Cartography_Portfolio' },
      source: 'git-origin'
    })
  });
  const port = await listen(server);
  try {
    // Deliberate action: the query param is only ever sent by the corrected
    // browser once the user has explicitly confirmed a target (e.g. via
    // "USE DETECTED TARGET" or by running GitHub sync first).
    const uploadUrl = `http://127.0.0.1:${port}/api/upload-pdf?githubTarget=${encodeURIComponent('https://github.com/hafsah1976')}`;
    const upload = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'X-Setup-CSRF-Token': WIZARD_SESSION_CSRF_TOKEN, 'Content-Type': 'application/pdf' },
      body: Buffer.from(buildMinimalLinkedInPdf())
    });
    assert.equal(upload.status, 200);
    const uploadData = await upload.json();
    assert.equal(uploadData.profile.githubTarget, 'https://github.com/hafsah1976');

    const state = await fetch(`http://127.0.0.1:${port}/api/state`);
    const stateData = await state.json();
    assert.equal(stateData.confirmedGitHub, 'https://github.com/hafsah1976');
  } finally {
    await close(server);
  }
});

test('5. explicit GitHub sync of hafsah1976 establishes confirmedGitHub for the fresh fork session', async () => {
  const mockFetch: typeof fetch = (async (input: RequestInfo | URL) => {
    const url = input.toString();
    if (url.includes('/users/hafsah1976/repos')) {
      return new Response(JSON.stringify([
        {
          id: 1,
          name: 'test-repo',
          full_name: 'hafsah1976/test-repo',
          description: 'A test repo',
          html_url: 'https://github.com/hafsah1976/test-repo',
          stargazers_count: 1,
          forks_count: 0,
          open_issues_count: 0,
          language: 'TypeScript',
          topics: ['test'],
          size: 10,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
          archived: false,
          fork: false,
          default_branch: 'main',
          owner: { login: 'hafsah1976', avatar_url: '', html_url: '' }
        }
      ]), { status: 200 });
    }
    if (url.includes('/readme')) {
      return new Response('# README', { status: 200 });
    }
    if (url.includes('/git/trees')) {
      return new Response(JSON.stringify({ tree: [], truncated: false }), { status: 200 });
    }
    if (url.includes('/rate_limit')) {
      return new Response(JSON.stringify({
        resources: { core: { limit: 5000, remaining: 5000, reset: 1770000000 } }
      }), { status: 200 });
    }
    return new Response(JSON.stringify({
      login: 'hafsah1976',
      name: 'Hafsah Nasreen',
      public_repos: 1
    }), { status: 200 });
  }) as any;

  const server = createSetupPortfolioServer({
    persistToDisk: false,
    initialStateOverrides: { detectedGitHub: 'https://github.com/hafsah1976' },
    repositoryIdentityResolver: () => ({
      identity: { owner: 'hafsah1976', name: 'Systems_Cartography_Portfolio' },
      source: 'git-origin'
    }),
    fetchImpl: mockFetch
  });
  const port = await listen(server);
  try {
    const before = await fetch(`http://127.0.0.1:${port}/api/session`);
    const beforeData = await before.json();
    assert.equal(beforeData.confirmedGitHub, '', 'must be unconfirmed before the deliberate sync action');

    const sync = await fetch(`http://127.0.0.1:${port}/api/sync-github`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Setup-CSRF-Token': WIZARD_SESSION_CSRF_TOKEN },
      body: JSON.stringify({ githubTarget: 'https://github.com/hafsah1976' })
    });
    assert.equal(sync.status, 200);

    const after = await fetch(`http://127.0.0.1:${port}/api/state`);
    const afterData = await after.json();
    assert.equal(afterData.confirmedGitHub, 'https://github.com/hafsah1976');
  } finally {
    await close(server);
  }
});

test('6. a genuinely intentional profile-A / target-B mismatch still requires explicit confirmation in a fresh fork', async () => {
  const server = createSetupPortfolioServer({
    persistToDisk: false,
    initialStateOverrides: {
      // Simulates: user already saved a fresh profile explicitly associated
      // with GitHub identity A, then deliberately selects target B.
      ownerProfile: { ...freshAliceProfile, githubTarget: 'https://github.com/owner-a' },
      confirmedGitHub: 'https://github.com/owner-b'
    },
    repositoryIdentityResolver: () => ({
      identity: { owner: 'hafsah1976', name: 'Systems_Cartography_Portfolio' },
      source: 'git-origin'
    })
  });
  const port = await listen(server);
  try {
    const session = await fetch(`http://127.0.0.1:${port}/api/session`);
    const data = await session.json();
    assert.equal(data.identityMatch.status, 'MISMATCH');

    const verify = await fetch(`http://127.0.0.1:${port}/api/verify`);
    const verifyData = await verify.json();
    assert.equal(verifyData.success, false, 'an unconfirmed genuine mismatch must still block verification');
    assert.ok(verifyData.summary.results.some((r: any) => /identity mismatch requires confirmation/i.test(r.message)));

    const confirm = await fetch(`http://127.0.0.1:${port}/api/confirm-cross-owner`, {
      method: 'POST',
      headers: { 'X-Setup-CSRF-Token': WIZARD_SESSION_CSRF_TOKEN }
    });
    assert.equal(confirm.status, 200);
  } finally {
    await close(server);
  }
});

test('8. stale SalAkBuK state remains quarantined throughout the detected/confirmed distinction', async () => {
  const server = createSetupPortfolioServer({
    persistToDisk: false,
    initialStateOverrides: { detectedGitHub: 'https://github.com/hafsah1976' },
    repositoryIdentityResolver: () => ({
      identity: { owner: 'hafsah1976', name: 'Systems_Cartography_Portfolio' },
      source: 'git-origin'
    })
  });
  const port = await listen(server);
  try {
    const session = await fetch(`http://127.0.0.1:${port}/api/session`);
    const data = await session.json();
    const serialized = JSON.stringify(data);
    assert.doesNotMatch(serialized, /salakbuk/i);

    const state = await fetch(`http://127.0.0.1:${port}/api/state`);
    const stateData = await state.json();
    assert.doesNotMatch(JSON.stringify(stateData), /salakbuk/i);
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
      ownerProfile: freshAliceProfile,
      confirmedGitHub: freshAliceProfile.githubTarget,
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

test('the real configured repository still loads the existing owner profile, snapshot, and preferences normally', async () => {
  // No repositoryIdentityResolver override -> resolves this actual checkout's
  // git origin, which matches OWNER_SETUP_MANIFEST (SalAkBuK/Systems_Cartography_Portfolio).
  const server = createSetupPortfolioServer({ persistToDisk: false });
  const port = await listen(server);
  try {
    const session = await fetch(`http://127.0.0.1:${port}/api/session`);
    const data = await session.json();
    assert.equal(data.repositoryReinitializationRequired, false);
    assert.equal(data.operator?.name, 'Salih Bukhari');
    assert.match(data.confirmedGitHub, /SalAkBuK/i);

    const state = await fetch(`http://127.0.0.1:${port}/api/state`);
    const stateData = await state.json();
    assert.equal(stateData.repositoryReinitializationRequired, false);
    assert.equal(stateData.snapshot.projects.length > 0, true, 'The real owner snapshot must remain active for the configured repository');
    assert.equal(stateData.preferences.flagshipProjectIds.length, 4);
  } finally {
    await close(server);
  }
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
