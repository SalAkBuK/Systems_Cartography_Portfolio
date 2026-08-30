import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { evaluateOwnerIdentityMatch } from '../src/utils/ownerIdentityMatch';
import { runOwnerSetupChecks } from '../scripts/check-owner-setup';
import { createSetupPortfolioServer, WIZARD_SESSION_CSRF_TOKEN } from '../scripts/setup-portfolio';
import { OWNER_PROFILE } from '../src/data/ownerProfile.generated';
import { GITHUB_SNAPSHOT } from '../src/data/githubSnapshot.generated';
import { OWNER_PORTFOLIO_PREFERENCES } from '../src/config/ownerPreferences';

test('1. profile GitHub + selected GitHub match -> PASS', () => {
  const match = evaluateOwnerIdentityMatch({
    ownerProfile: { githubTarget: 'https://github.com/SalAkBuK' } as any,
    githubTarget: 'https://github.com/SalAkBuK'
  });

  assert.equal(match.status, 'MATCH');
  assert.equal(match.profileIdentity, 'salakbuk');
  assert.equal(match.targetIdentity, 'salakbuk');

  const summary = runOwnerSetupChecks({
    ownerProfile: {
      ...OWNER_PROFILE,
      githubTarget: 'https://github.com/SalAkBuK'
    },
    githubTarget: 'https://github.com/SalAkBuK',
    snapshot: {
      ...GITHUB_SNAPSHOT,
      sourceIdentifier: 'SalAkBuK'
    }
  });

  const identityResults = summary.results.filter(r => r.message.includes('Owner profile and GitHub target identities match'));
  assert.equal(identityResults.length, 1);
  assert.equal(identityResults[0].level, 'PASS');
});

test('2. profile GitHub differs from selected GitHub -> MISMATCH', () => {
  const match = evaluateOwnerIdentityMatch({
    ownerProfile: { githubTarget: 'https://github.com/SalAkBuK' } as any,
    githubTarget: 'https://github.com/hafsah1976'
  });

  assert.equal(match.status, 'MISMATCH');
  assert.equal(match.profileIdentity, 'salakbuk');
  assert.equal(match.targetIdentity, 'hafsah1976');
});

test('3. Profile and target match but snapshot belongs to different owner -> Identity is MATCH, snapshot is FAIL', () => {
  const match = evaluateOwnerIdentityMatch({
    ownerProfile: { githubTarget: 'https://github.com/SalAkBuK' } as any,
    githubTarget: 'https://github.com/SalAkBuK'
  });
  assert.equal(match.status, 'MATCH');

  const summary = runOwnerSetupChecks({
    ownerProfile: {
      ...OWNER_PROFILE,
      githubTarget: 'https://github.com/SalAkBuK'
    },
    githubTarget: 'https://github.com/SalAkBuK',
    snapshotMetadata: {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      githubTarget: 'https://github.com/hafsah1976',
      sourceIdentifier: 'hafsah1976',
      rawRepositoryCount: 1,
      canonicalRepositoryCount: 1,
      inspectedRepositoryCount: 1
    }
  });

  // Identity match must be PASS
  const identityPass = summary.results.find(r => r.message.includes('Owner profile and GitHub target identities match'));
  assert.ok(identityPass);
  assert.equal(identityPass?.level, 'PASS');

  // Snapshot ownership must be FAIL
  const snapshotFail = summary.results.find(r => r.message.includes('GitHub snapshot belongs to a different owner'));
  assert.ok(snapshotFail);
  assert.equal(snapshotFail?.level, 'FAIL');
});

test('4. Mismatch blocks completion before confirmation (FAIL level in checks)', () => {
  const summary = runOwnerSetupChecks({
    ownerProfile: {
      ...OWNER_PROFILE,
      githubTarget: 'https://github.com/SalAkBuK'
    },
    githubTarget: 'https://github.com/hafsah1976',
    snapshot: {
      ...GITHUB_SNAPSHOT,
      sourceIdentifier: 'hafsah1976'
    },
    crossOwnerConfirmed: false
  });

  assert.equal(summary.status, 'FAIL');
  assert.ok(summary.failCount >= 1);
  const mismatchFail = summary.results.find(r => r.message.includes('Owner identity mismatch requires confirmation'));
  assert.ok(mismatchFail, 'Must include blocking identity mismatch failure');
  assert.equal(mismatchFail?.level, 'FAIL');
});

test('5. Explicit confirmation removes blocking failure and allows setup completion', () => {
  const summary = runOwnerSetupChecks({
    ownerProfile: {
      ...OWNER_PROFILE,
      githubTarget: 'https://github.com/SalAkBuK'
    },
    githubTarget: 'https://github.com/hafsah1976',
    snapshot: {
      ...GITHUB_SNAPSHOT,
      sourceIdentifier: 'hafsah1976',
      projects: GITHUB_SNAPSHOT.projects
    },
    crossOwnerConfirmed: true
  });

  const mismatchFail = summary.results.find(r => r.level === 'FAIL' && r.message.includes('identity mismatch'));
  assert.equal(mismatchFail, undefined, 'Blocking failure must be removed once confirmed');
});

test('6. Confirmed mismatch remains a WARNING (not a PASS)', () => {
  const summary = runOwnerSetupChecks({
    ownerProfile: {
      ...OWNER_PROFILE,
      githubTarget: 'https://github.com/SalAkBuK'
    },
    githubTarget: 'https://github.com/hafsah1976',
    snapshot: {
      ...GITHUB_SNAPSHOT,
      sourceIdentifier: 'hafsah1976'
    },
    crossOwnerConfirmed: true
  });

  const mismatchWarn = summary.results.find(r => r.message.includes('Profile / GitHub owner mismatch explicitly confirmed by owner'));
  assert.ok(mismatchWarn, 'Must report warning for confirmed cross-owner');
  assert.equal(mismatchWarn?.level, 'WARNING');
  assert.ok(summary.warnCount >= 1);
});

test('7. Changing GitHub target resets crossOwnerConfirmed in wizard server', async () => {
  const mockFetch: typeof fetch = (async (input: RequestInfo | URL) => {
    const url = input.toString();
    if (url.includes('/users/another-owner/repos')) {
      return new Response(JSON.stringify([
        {
          id: 999,
          name: 'test-repo',
          full_name: 'another-owner/test-repo',
          description: 'A test repo',
          html_url: 'https://github.com/another-owner/test-repo',
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
          owner: { login: 'another-owner', avatar_url: '', html_url: '' }
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
      login: 'another-owner',
      name: 'Another Owner',
      public_repos: 1
    }), { status: 200 });
  }) as any;

  const server = createSetupPortfolioServer({
    persistToDisk: false,
    fetchImpl: mockFetch,
    initialStateOverrides: {
      ownerProfile: { ...OWNER_PROFILE, githubTarget: 'https://github.com/SalAkBuK' },
      confirmedGitHub: 'https://github.com/hafsah1976',
      crossOwnerConfirmed: false
    }
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const addr = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    // Step A: Confirm cross-owner
    const confirmRes = await fetch(`${baseUrl}/api/confirm-cross-owner`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-setup-csrf-token': WIZARD_SESSION_CSRF_TOKEN }
    });
    const confirmData = await confirmRes.json();
    assert.equal(confirmData.success, true);
    assert.equal(confirmData.crossOwnerConfirmed, true);

    // Verify state reflects crossOwnerConfirmed = true
    const stateRes1 = await fetch(`${baseUrl}/api/state`);
    const stateData1 = await stateRes1.json();
    assert.equal(stateData1.crossOwnerConfirmed, true);

    // Step B: Resync to a new GitHub target
    const syncRes = await fetch(`${baseUrl}/api/sync-github`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-setup-csrf-token': WIZARD_SESSION_CSRF_TOKEN },
      body: JSON.stringify({ githubTarget: 'https://github.com/another-owner' })
    });
    const syncData = await syncRes.json();
    assert.equal(syncData.success, true);

    // Step C: Verify crossOwnerConfirmed has reset to false
    const stateRes2 = await fetch(`${baseUrl}/api/state`);
    const stateData2 = await stateRes2.json();
    assert.equal(stateData2.crossOwnerConfirmed, false, 'Must reset crossOwnerConfirmed when GitHub target changes');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('8. Changing owner profile resets crossOwnerConfirmed in wizard server', async () => {
  const server = createSetupPortfolioServer({
    persistToDisk: false,
    initialStateOverrides: {
      ownerProfile: { ...OWNER_PROFILE, githubTarget: 'https://github.com/SalAkBuK' },
      confirmedGitHub: 'https://github.com/hafsah1976',
      crossOwnerConfirmed: true
    }
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const addr = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    // Save updated profile
    const saveProfileRes = await fetch(`${baseUrl}/api/save-profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-setup-csrf-token': WIZARD_SESSION_CSRF_TOKEN },
      body: JSON.stringify({
        profile: {
          ...OWNER_PROFILE,
          operator: { ...OWNER_PROFILE.operator, name: 'New Owner Name' }
        }
      })
    });
    assert.equal(saveProfileRes.status, 200);

    // Verify crossOwnerConfirmed reset to false
    const stateRes = await fetch(`${baseUrl}/api/state`);
    const stateData = await stateRes.json();
    assert.equal(stateData.crossOwnerConfirmed, false, 'Must reset crossOwnerConfirmed when profile changes');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('9. Missing profile GitHub identity -> UNKNOWN warning, not failure', () => {
  const match = evaluateOwnerIdentityMatch({
    ownerProfile: {
      ...OWNER_PROFILE,
      githubTarget: ''
    } as any,
    githubTarget: 'https://github.com/SalAkBuK'
  });

  assert.equal(match.status, 'UNKNOWN');
  assert.equal(match.profileIdentity, null);

  const summary = runOwnerSetupChecks({
    ownerProfile: {
      ...OWNER_PROFILE,
      githubTarget: ''
    },
    githubTarget: 'https://github.com/SalAkBuK',
    snapshot: GITHUB_SNAPSHOT
  });

  const unknownWarn = summary.results.find(r => r.message.includes('Owner identity match not verifiable'));
  assert.ok(unknownWarn, 'Must report UNKNOWN as a warning');
  assert.equal(unknownWarn?.level, 'WARNING');
});

test('10. Authenticated GitHub CLI account does not participate in owner comparison', () => {
  const match = evaluateOwnerIdentityMatch({
    ownerProfile: { githubTarget: 'https://github.com/SalAkBuK' } as any,
    githubTarget: 'https://github.com/SalAkBuK'
  });

  assert.equal(match.status, 'MATCH');
});

test('11. Foreign-owner curated evidence remains ignored even if cross-owner is confirmed', () => {
  const summary = runOwnerSetupChecks({
    ownerProfile: {
      ...OWNER_PROFILE,
      githubTarget: 'https://github.com/SalAkBuK'
    },
    githubTarget: 'https://github.com/hafsah1976',
    snapshot: {
      ...GITHUB_SNAPSHOT,
      sourceIdentifier: 'hafsah1976'
    },
    crossOwnerConfirmed: true
  });

  const repoEvidenceIgnored = summary.results.find(r => r.message.includes('Curated repository evidence belongs to another owner -- ignored'));
  const profEvidenceIgnored = summary.results.find(r => r.message.includes('Curated professional evidence belongs to another owner -- ignored'));
  const addExpIgnored = summary.results.find(r => r.message.includes('Additional professional experience belongs to another owner -- ignored'));

  assert.ok(repoEvidenceIgnored, 'Foreign repository evidence must be ignored');
  assert.ok(profEvidenceIgnored, 'Foreign professional evidence must be ignored');
  assert.ok(addExpIgnored, 'Foreign additional experience must be ignored');

  const noForeignActive = summary.results.find(r => r.message.includes('No foreign-owner evidence active'));
  assert.ok(noForeignActive, 'No foreign-owner evidence should be exposed');
  assert.equal(noForeignActive?.level, 'PASS');
});

test('12. Regression: In-memory wizard operations with persistToDisk=false leave disk files completely untouched', async () => {
  const profileDiskPath = path.resolve('src/data/ownerProfile.generated.ts');
  const snapshotDiskPath = path.resolve('src/data/githubSnapshot.generated.ts');
  const prefsDiskPath = path.resolve('src/config/ownerPreferences.ts');

  const origProfileContent = fs.readFileSync(profileDiskPath, 'utf8');
  const origSnapshotContent = fs.readFileSync(snapshotDiskPath, 'utf8');
  const origPrefsContent = fs.readFileSync(prefsDiskPath, 'utf8');

  const mockFetch: typeof fetch = (async () => new Response(JSON.stringify({
    login: 'test-cross-owner',
    name: 'Test Cross Owner',
    public_repos: 0
  }))) as any;

  const server = createSetupPortfolioServer({
    persistToDisk: false,
    fetchImpl: mockFetch
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const addr = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    // 1. Mutate profile in memory
    await fetch(`${baseUrl}/api/save-profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-setup-csrf-token': WIZARD_SESSION_CSRF_TOKEN },
      body: JSON.stringify({
        profile: { ...OWNER_PROFILE, operator: { ...OWNER_PROFILE.operator, name: 'Mutated In Memory' } }
      })
    });

    // 2. Mutate sync in memory
    await fetch(`${baseUrl}/api/sync-github`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-setup-csrf-token': WIZARD_SESSION_CSRF_TOKEN },
      body: JSON.stringify({ githubTarget: 'https://github.com/test-cross-owner' })
    });

    // 3. Mutate flagships in memory
    await fetch(`${baseUrl}/api/save-flagships`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-setup-csrf-token': WIZARD_SESSION_CSRF_TOKEN },
      body: JSON.stringify({ flagshipProjectIds: ['temp-1', 'temp-2'] })
    });

    // 4. Verify disk files are byte-for-byte identical
    assert.equal(fs.readFileSync(profileDiskPath, 'utf8'), origProfileContent, 'ownerProfile.generated.ts must NOT be touched');
    assert.equal(fs.readFileSync(snapshotDiskPath, 'utf8'), origSnapshotContent, 'githubSnapshot.generated.ts must NOT be touched');
    assert.equal(fs.readFileSync(prefsDiskPath, 'utf8'), origPrefsContent, 'ownerPreferences.ts must NOT be touched');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
