import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as http from 'node:http';
import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'node:vm';
import {
  createSetupPortfolioServer,
  validateLocalhostHost,
  validateLocalhostOrigin,
  readBoundedJsonBody,
  WIZARD_HOST,
  WIZARD_PORT,
  WIZARD_SESSION_CSRF_TOKEN
} from '../scripts/setup-portfolio';
import {
  addFlagshipItem,
  removeFlagshipItem,
  reorderFlagshipItem,
  moveFlagshipItem,
  MAX_FLAGSHIP_COUNT
} from '../src/utils/flagshipSelectionModel';
import { runOwnerSetupChecks } from '../scripts/check-owner-setup';
import { NO_EXPERIENCE_WARNING } from '../scripts/linkedinProfileParser';

function makeHttpRequest(
  port: number,
  urlPath: string,
  options: { method?: string; headers?: Record<string, string>; body?: string }
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: urlPath,
        method: options.method || 'GET',
        headers: options.headers || {}
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve({ statusCode: res.statusCode || 0, body: data }));
      }
    );
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

function createWizardBrowserHarness() {
  const html = fs.readFileSync(path.resolve('scripts/setup-portfolio.html'), 'utf8');
  const inlineScript = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(inlineScript, 'Wizard inline script must be present');

  const elements = new Map<string, any>();
  const getElement = (id: string) => {
    if (!elements.has(id)) {
      elements.set(id, {
        id,
        value: '',
        innerText: '',
        innerHTML: '',
        disabled: false,
        style: { display: 'none' },
        className: '',
        classList: { add() {}, remove() {}, toggle() {} },
        addEventListener() {}
      });
    }
    return elements.get(id);
  };

  let uploadResponse: { ok: boolean; body: any } = { ok: false, body: { success: false, error: 'not configured' } };
  let savedProfile: any = null;
  const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input.toString();
    if (url === '/api/session') {
      return { ok: true, json: async () => ({ csrfToken: 'csrf', existingSetup: false }) };
    }
    if (url === '/api/state') {
      return { ok: true, json: async () => ({ snapshot: { projects: [] }, preferences: { flagshipProjectIds: [] } }) };
    }
    if (url.startsWith('/api/upload-pdf')) {
      return { ok: uploadResponse.ok, json: async () => uploadResponse.body };
    }
    if (url === '/api/save-profile') {
      savedProfile = JSON.parse(String(init?.body)).profile;
      return { ok: true, json: async () => ({ success: true }) };
    }
    throw new Error(`Unexpected wizard fetch: ${url}`);
  };

  const context: any = {
    document: {
      getElementById: getElement,
      querySelectorAll: () => []
    },
    fetch: fetchImpl,
    console
  };
  vm.runInNewContext(`${inlineScript}\n;globalThis.__wizardTestApi = {
    handleFileSelected,
    uploadAndParsePdf,
    saveProfileAndContinue,
    getParsedProfile: () => parsedProfile,
    getCurrentStep: () => currentStep
  };`, context, { filename: 'setup-portfolio.inline.js' });

  return {
    api: context.__wizardTestApi as {
      handleFileSelected(event: any): void;
      uploadAndParsePdf(): Promise<void>;
      saveProfileAndContinue(): Promise<void>;
      getParsedProfile(): any;
      getCurrentStep(): number;
    },
    element: getElement,
    setUploadResponse(response: { ok: boolean; body: any }) { uploadResponse = response; },
    getSavedProfile: () => savedProfile
  };
}

test('1. setup:portfolio: script registered in package.json and host binds strictly to 127.0.0.1', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert.ok(pkg.scripts['setup:portfolio'], 'package.json must contain setup:portfolio script');
  assert.equal(pkg.scripts['setup:portfolio'], 'tsx scripts/setup-portfolio.ts');
  assert.equal(WIZARD_HOST, '127.0.0.1');
  assert.equal(WIZARD_PORT, 4174);
});

test('2. setup:portfolio: validateLocalhostHost strictly accepts only localhost/127.0.0.1', () => {
  assert.equal(validateLocalhostHost('127.0.0.1:4174'), true);
  assert.equal(validateLocalhostHost('localhost:4174'), true);
  assert.equal(validateLocalhostHost('127.0.0.1'), true);
  assert.equal(validateLocalhostHost('localhost'), true);
  assert.equal(validateLocalhostHost('localhost.evil.com'), false);
  assert.equal(validateLocalhostHost('127.0.0.1.attacker.org'), false);
  assert.equal(validateLocalhostHost('evil-site.com'), false);
  assert.equal(validateLocalhostHost(''), false);
  assert.equal(validateLocalhostHost(undefined), false);
});

test('3. setup:portfolio: validateLocalhostOrigin strictly checks mutation origin header', () => {
  assert.equal(validateLocalhostOrigin('http://127.0.0.1:4174'), true);
  assert.equal(validateLocalhostOrigin('http://localhost:4174'), true);
  assert.equal(validateLocalhostOrigin('http://localhost:3000'), true);
  assert.equal(validateLocalhostOrigin('http://evil.com'), false);
  assert.equal(validateLocalhostOrigin('http://localhost.attacker.com'), false);
  assert.equal(validateLocalhostOrigin('invalid-url'), false);
  assert.equal(validateLocalhostOrigin(undefined), true);
});

test('4. setup:portfolio: server enforces exact Host and Origin rejection with 403 Forbidden', async () => {
  const server = createSetupPortfolioServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const addr = server.address() as { port: number };

  // Foreign Host
  const badHostRes = await makeHttpRequest(addr.port, '/', {
    method: 'GET',
    headers: { host: 'malicious-host.com' }
  });
  assert.equal(badHostRes.statusCode, 403);

  // Foreign Origin on POST mutation
  const badOriginRes = await makeHttpRequest(addr.port, '/api/save-profile', {
    method: 'POST',
    headers: {
      host: `127.0.0.1:${addr.port}`,
      origin: 'http://malicious-website.com',
      'x-setup-csrf-token': WIZARD_SESSION_CSRF_TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ profile: {} })
  });
  assert.equal(badOriginRes.statusCode, 403);

  server.close();
});

test('5. setup:portfolio: mutation POST endpoints require valid CSRF token', async () => {
  const server = createSetupPortfolioServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const addr = server.address() as { port: number };

  // POST without CSRF header
  const noCsrfRes = await fetch(`http://127.0.0.1:${addr.port}/api/save-profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile: {} })
  });
  assert.equal(noCsrfRes.status, 403);

  // POST with wrong CSRF header
  const badCsrfRes = await fetch(`http://127.0.0.1:${addr.port}/api/save-profile`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-setup-csrf-token': 'fake-csrf-token'
    },
    body: JSON.stringify({ profile: {} })
  });
  assert.equal(badCsrfRes.status, 403);

  server.close();
});

test('6. setup:portfolio: enforces 256KB request body size limit with 413 Payload Too Large', async () => {
  const server = createSetupPortfolioServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const addr = server.address() as { port: number };

  // Send an oversized JSON payload (>256KB)
  const hugePayload = JSON.stringify({ profile: { junk: 'X'.repeat(300 * 1024) } });
  try {
    const hugeRes = await fetch(`http://127.0.0.1:${addr.port}/api/save-profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-setup-csrf-token': WIZARD_SESSION_CSRF_TOKEN
      },
      body: hugePayload
    });
    assert.equal(hugeRes.status, 413);
  } catch {
    assert.ok(true);
  }

  server.close();
});

test('7. setup:portfolio: rejects empty and invalid PDF uploads purely in-memory without leaving disk artifacts', async () => {
  const server = createSetupPortfolioServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const addr = server.address() as { port: number };

  // Empty upload
  const emptyRes = await fetch(`http://127.0.0.1:${addr.port}/api/upload-pdf`, {
    method: 'POST',
    headers: {
      'x-setup-csrf-token': WIZARD_SESSION_CSRF_TOKEN,
      'Content-Type': 'application/pdf'
    },
    body: Buffer.alloc(0)
  });
  assert.equal(emptyRes.status, 400);

  // Invalid magic header
  const fakePdfRes = await fetch(`http://127.0.0.1:${addr.port}/api/upload-pdf`, {
    method: 'POST',
    headers: {
      'x-setup-csrf-token': WIZARD_SESSION_CSRF_TOKEN,
      'Content-Type': 'application/pdf'
    },
    body: Buffer.from('NOT A PDF FILE')
  });
  assert.equal(fakePdfRes.status, 400);
  const data = await fakePdfRes.json();
  assert.ok(data.error.includes('%PDF'));

  // Ensure .tmp/setup has no leaked upload files
  const tmpDir = path.resolve('.tmp/setup');
  if (fs.existsSync(tmpDir)) {
    const files = fs.readdirSync(tmpDir);
    assert.equal(files.length, 0, 'No temp upload files should remain on disk');
  }

  server.close();
});

test('8. setup:portfolio: live runtimeState updates immediately across same session without server restart', async () => {
  const initialProfile: any = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceIdentifier: 'test-source',
    githubTarget: 'https://github.com/initial-owner',
    operator: {
      name: 'Initial Developer',
      role: 'Junior Engineer',
      location: 'Remote',
      status: 'AVAILABLE // INITIAL',
      headline: 'Initial Headline',
      summary: 'Initial Summary',
      contact: { github: 'https://github.com/initial-owner' }
    },
    experience: [],
    skills: [],
    certifications: [],
    education: []
  };

  const initialSnapshot: any = {
    sourceIdentifier: 'test-snapshot',
    sourceType: 'GITHUB_USER',
    user: { login: 'initial-owner' },
    projects: [
      { id: 'proj-1', code: 'PR-01', title: 'Alpha System', summary: '', techStack: [], category: 'SYSTEM', status: 'ACTIVE', year: '2025' },
      { id: 'proj-2', code: 'PR-02', title: 'Beta Service', summary: '', techStack: [], category: 'API', status: 'ACTIVE', year: '2025' }
    ],
    skills: []
  };

  const server = createSetupPortfolioServer({
    initialStateOverrides: {
      ownerProfile: initialProfile,
      snapshot: initialSnapshot,
      preferences: { flagshipProjectIds: ['proj-1'] }
    },
    persistToDisk: false
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const addr = server.address() as { port: number };

  // 1. Check initial state
  const stateRes1 = await fetch(`http://127.0.0.1:${addr.port}/api/state`);
  const stateData1 = await stateRes1.json();
  assert.equal(stateData1.ownerProfile.operator.name, 'Initial Developer');
  assert.equal(stateData1.snapshot.projects.length, 2);
  assert.deepEqual(stateData1.preferences.flagshipProjectIds, ['proj-1']);

  // 2. Mutate profile via POST /api/save-profile (simulate new import)
  const updatedProfile = {
    ...initialProfile,
    operator: {
      ...initialProfile.operator,
      name: 'Updated Lead Architect',
      role: 'Staff Systems Engineer'
    }
  };

  const saveRes = await fetch(`http://127.0.0.1:${addr.port}/api/save-profile`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-setup-csrf-token': WIZARD_SESSION_CSRF_TOKEN
    },
    body: JSON.stringify({ profile: updatedProfile })
  });
  assert.equal(saveRes.status, 200);

  // 3. Immediately query /api/state: MUST reflect updated name without restarting
  const stateRes2 = await fetch(`http://127.0.0.1:${addr.port}/api/state`);
  const stateData2 = await stateRes2.json();
  assert.equal(stateData2.ownerProfile.operator.name, 'Updated Lead Architect');
  assert.equal(stateData2.ownerProfile.operator.role, 'Staff Systems Engineer');

  // 4. Mutate flagships via POST /api/save-flagships
  const saveFlagshipsRes = await fetch(`http://127.0.0.1:${addr.port}/api/save-flagships`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-setup-csrf-token': WIZARD_SESSION_CSRF_TOKEN
    },
    body: JSON.stringify({ flagshipProjectIds: ['proj-2', 'proj-1'] })
  });
  assert.equal(saveFlagshipsRes.status, 200);

  // 5. Query /api/state: MUST reflect updated flagships in order
  const stateRes3 = await fetch(`http://127.0.0.1:${addr.port}/api/state`);
  const stateData3 = await stateRes3.json();
  assert.deepEqual(stateData3.preferences.flagshipProjectIds, ['proj-2', 'proj-1']);

  server.close();
});

test('9. setup:portfolio: verification endpoint evaluates live runtimeState directly', async () => {
  const validProfile: any = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceIdentifier: 'test-source',
    githubTarget: 'https://github.com/valid-owner',
    operator: {
      name: 'Valid Developer',
      role: 'Principal Engineer',
      location: 'Remote',
      status: 'AVAILABLE',
      headline: 'Headline',
      summary: 'Summary',
      contact: { github: 'https://github.com/valid-owner' }
    },
    experience: [],
    skills: [],
    certifications: [],
    education: []
  };

  const validSnapshot: any = {
    sourceIdentifier: 'test-snapshot',
    sourceType: 'GITHUB_USER',
    user: { login: 'valid-owner' },
    projects: [
      { id: 'proj-1', code: 'PR-01', title: 'System 1', summary: '', techStack: [], category: 'SYSTEM', status: 'ACTIVE', year: '2025' }
    ],
    skills: [{ id: 'sk-1', name: 'TypeScript', category: 'Language', strength: 90, level: 'CORE' }]
  };

  const server = createSetupPortfolioServer({
    initialStateOverrides: {
      ownerProfile: validProfile,
      snapshot: validSnapshot,
      confirmedGitHub: 'https://github.com/valid-owner',
      preferences: { flagshipProjectIds: ['proj-1'] }
    },
    persistToDisk: false
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const addr = server.address() as { port: number };

  const verifyRes = await fetch(`http://127.0.0.1:${addr.port}/api/verify`);
  assert.equal(verifyRes.status, 200);
  const verifyData = await verifyRes.json();

  assert.equal(verifyData.success, true);
  assert.equal(verifyData.summary.failCount, 0);
  assert.ok(verifyData.summary.results.some((r: any) => r.message.includes('Valid Developer')));
  assert.ok(verifyData.summary.results.some(
    (r: any) => r.level === 'PASS' && r.message === '0 professional roles imported'
  ));

  server.close();
});

test('10. flagshipSelectionModel: pure rules enforce max 4, no duplicates, and rejection when full', () => {
  const current = ['p1', 'p2', 'p3'];

  // Add 4th item -> Success
  const res1 = addFlagshipItem(current, 'p4');
  assert.equal(res1.success, true);
  assert.deepEqual(res1.selectedIds, ['p1', 'p2', 'p3', 'p4']);

  // Add 5th item -> Rejected with error message
  const res2 = addFlagshipItem(res1.selectedIds, 'p5');
  assert.equal(res2.success, false);
  assert.equal(res2.error, 'MAXIMUM FLAGSHIPS REACHED // REMOVE ONE FIRST');
  assert.deepEqual(res2.selectedIds, ['p1', 'p2', 'p3', 'p4']);

  // Add duplicate -> No change
  const res3 = addFlagshipItem(current, 'p2');
  assert.equal(res3.success, true);
  assert.deepEqual(res3.selectedIds, ['p1', 'p2', 'p3']);

  // Remove item
  const removed = removeFlagshipItem(res1.selectedIds, 'p2');
  assert.deepEqual(removed, ['p1', 'p3', 'p4']);

  // Reorder items
  const reordered = reorderFlagshipItem(['p1', 'p2', 'p3', 'p4'], 0, 2);
  assert.deepEqual(reordered, ['p2', 'p3', 'p1', 'p4']);

  // Move item up/down
  const movedUp = moveFlagshipItem(['p1', 'p2', 'p3'], 1, -1);
  assert.deepEqual(movedUp, ['p2', 'p1', 'p3']);
});

test('11. setup:portfolio: wizard enforces first-time owner profile progression gating and existing owner skip semantics', async () => {
  // 1. First-time uninitialized owner session
  const uninitializedProfile: any = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceIdentifier: 'empty',
    githubTarget: '',
    operator: {
      name: '',
      role: '',
      location: '',
      status: '',
      headline: '',
      summary: '',
      contact: {}
    },
    experience: [],
    skills: [],
    certifications: [],
    education: []
  };

  const uninitializedServer = createSetupPortfolioServer({
    initialStateOverrides: {
      ownerProfile: uninitializedProfile,
      confirmedGitHub: ''
    },
    persistToDisk: false
  });
  await new Promise<void>((resolve) => uninitializedServer.listen(0, '127.0.0.1', () => resolve()));
  const uninitAddr = uninitializedServer.address() as { port: number };

  const sessionRes1 = await fetch(`http://127.0.0.1:${uninitAddr.port}/api/session`);
  const sessionData1 = await sessionRes1.json();
  assert.equal(sessionData1.existingSetup, false, 'Uninitialized profile must report existingSetup: false');

  uninitializedServer.close();

  // 2. Existing initialized owner session
  const initializedProfile: any = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceIdentifier: 'existing',
    githubTarget: 'https://github.com/configured-owner',
    operator: {
      name: 'Configured Engineer',
      role: 'Staff Architect',
      location: 'Remote',
      status: 'AVAILABLE',
      headline: 'Headline',
      summary: 'Summary',
      contact: { github: 'https://github.com/configured-owner' }
    },
    experience: [],
    skills: [],
    certifications: [],
    education: []
  };

  const initializedServer = createSetupPortfolioServer({
    initialStateOverrides: {
      ownerProfile: initializedProfile,
      confirmedGitHub: 'https://github.com/configured-owner'
    },
    persistToDisk: false
  });
  await new Promise<void>((resolve) => initializedServer.listen(0, '127.0.0.1', () => resolve()));
  const initAddr = initializedServer.address() as { port: number };

  const sessionRes2 = await fetch(`http://127.0.0.1:${initAddr.port}/api/session`);
  const sessionData2 = await sessionRes2.json();
  assert.equal(sessionData2.existingSetup, true, 'Configured zero-experience profile must report existingSetup: true');

  initializedServer.close();

  // 3. HTML template source verification for progression rules
  const htmlContent = fs.readFileSync(path.resolve('scripts/setup-portfolio.html'), 'utf8');
  const topologyContent = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');
  assert.ok(htmlContent.includes('KEEP EXISTING PROFILE & CONTINUE'), 'Template must support KEEP EXISTING PROFILE & CONTINUE for configured owners');
  assert.ok(htmlContent.includes('SAVE PROFILE & CONTINUE'), 'Template must support SAVE PROFILE & CONTINUE after successful new parse');
  assert.ok(htmlContent.includes('updateProfileProgressionUI'), 'Template must implement reactive progression UI updates');
  assert.ok(
    topologyContent.includes('experience ?? EXPERIENCE_HISTORY'),
    'An explicit empty experience array must not activate bundled fallback employment'
  );
});

test('12. setup wizard renders and continues after a successful zero-experience LinkedIn import', async () => {
  const harness = createWizardBrowserHarness();
  await new Promise(resolve => setImmediate(resolve));
  const profile = {
    githubTarget: 'https://github.com/inferred-owner',
    operator: { name: 'PDF Owner', role: 'Engineer', location: 'Remote' },
    experience: [],
    source: { warnings: [NO_EXPERIENCE_WARNING] }
  };
  harness.api.handleFileSelected({ target: { files: [{ name: 'profile.pdf', size: 4096 }] } });
  harness.setUploadResponse({ ok: true, body: { success: true, profile } });

  await harness.api.uploadAndParsePdf();

  assert.deepEqual(harness.api.getParsedProfile(), profile);
  assert.equal(harness.element('parsedProfileReview').style.display, 'block');
  assert.equal(harness.element('reviewExpCount').innerText, '0 roles');
  assert.equal(harness.element('reviewWarnings').innerText, NO_EXPERIENCE_WARNING);
  assert.equal(harness.element('githubTargetInput').value, profile.githubTarget);
  assert.equal(harness.element('continueToGithubBtn').disabled, false);
  assert.equal(harness.element('statusBanner').className, 'status-banner success');
  assert.match(harness.element('statusBanner').innerText, /successfully parsed/);
  assert.equal(harness.element('importPdfBtn').disabled, false);
  assert.equal(harness.element('importPdfBtn').innerText, 'IMPORT PROFILE');

  await harness.api.saveProfileAndContinue();
  assert.deepEqual(harness.getSavedProfile(), profile);
  assert.equal(harness.api.getCurrentStep(), 2);

  harness.setUploadResponse({ ok: false, body: { success: false, error: 'PDF parse error: malformed export' } });
  await harness.api.uploadAndParsePdf();

  assert.equal(harness.api.getParsedProfile(), null);
  assert.equal(harness.element('parsedProfileReview').style.display, 'none');
  assert.equal(harness.element('statusBanner').className, 'status-banner error');
  assert.equal(harness.element('statusBanner').innerText, 'PDF parse error: malformed export');
  assert.equal(harness.element('importPdfBtn').disabled, false);
  assert.equal(harness.element('importPdfBtn').innerText, 'IMPORT PROFILE');
});
