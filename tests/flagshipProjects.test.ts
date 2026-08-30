import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as http from 'node:http';
import { resolveFlagshipProjects } from '../src/utils/portfolioUtils';
import {
  formatOwnerPreferencesFile,
  writeOwnerPreferences
} from '../src/utils/ownerPreferencesStorage';
import { ProjectData } from '../src/types';
import { PORTFOLIO_CONFIG } from '../src/config/portfolioConfig';
import { OWNER_PORTFOLIO_PREFERENCES } from '../src/config/ownerPreferences';
import {
  createFlagshipConfiguratorServer,
  DEFAULT_CONFIGURATOR_HOST,
  DEFAULT_CONFIGURATOR_PORT
} from '../scripts/setup-flagships';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const mockProjects: ProjectData[] = [
  {
    id: 'gh-101',
    code: 'GH-01',
    title: 'alpha-service',
    tagline: 'Alpha service tagline',
    category: 'backend',
    status: 'ACTIVE',
    year: '2026',
    dimensions: { width: 100, height: 80, levels: 2 },
    gridPosition: { x: 0, y: 0 },
    accentColor: '#8EA9DA',
    summary: 'Alpha service summary',
    problem: 'Alpha problem',
    solution: 'Alpha architecture solution',
    architectureNotes: 'Alpha notes',
    techStack: ['TypeScript', 'Node.js', 'PostgreSQL'],
    infrastructureDeps: [],
    subsystems: [],
    metrics: [{ label: 'Stargazers', value: '12 ?' }],
    keyDecisions: [],
    resilienceTesting: 'Jest suites configured',
    validationEvidence: {
      testFrameworks: ['Jest'],
      ciWorkflows: ['GitHub Actions'],
      e2eHarnesses: [],
      lintersAndFormatters: ['ESLint'],
      buildTools: [],
      hasDocker: true,
      hasMigrations: true,
      testFilesDetected: 14,
      summary: '14 test suites configured'
    },
    links: { github: 'https://github.com/owner/alpha-service' }
  },
  {
    id: 'gh-102',
    code: 'GH-02',
    title: 'beta-frontend',
    tagline: 'Beta frontend tagline',
    category: 'frontend',
    status: 'PRODUCTION',
    year: '2025',
    dimensions: { width: 100, height: 80, levels: 2 },
    gridPosition: { x: 50, y: 50 },
    accentColor: '#C3E54E',
    summary: 'Beta frontend summary',
    problem: 'Beta problem',
    solution: 'Beta architecture solution',
    architectureNotes: 'Beta notes',
    techStack: ['React', 'TypeScript', 'Tailwind CSS'],
    infrastructureDeps: [],
    subsystems: [],
    metrics: [{ label: 'Stars', value: '0 ?' }],
    keyDecisions: [],
    resilienceTesting: 'Vitest suites configured',
    links: { github: 'https://github.com/owner/beta-frontend' }
  },
  {
    id: 'gh-103',
    code: 'GH-03',
    title: 'gamma-core',
    tagline: 'Gamma core tagline',
    category: 'fullstack',
    status: 'ACTIVE',
    year: '2026',
    dimensions: { width: 100, height: 80, levels: 2 },
    gridPosition: { x: 100, y: 100 },
    accentColor: '#E5534E',
    summary: 'Gamma core summary',
    problem: 'Gamma problem',
    solution: 'Gamma architecture solution',
    architectureNotes: 'Gamma notes',
    techStack: ['Python', 'FastAPI'],
    infrastructureDeps: [],
    subsystems: [],
    metrics: [],
    keyDecisions: [],
    resilienceTesting: '',
    links: { github: 'https://github.com/owner/gamma-core' }
  },
  {
    id: 'gh-104',
    code: 'GH-04',
    title: 'delta-mobile',
    tagline: 'Delta mobile tagline',
    category: 'frontend',
    status: 'ACTIVE',
    year: '2026',
    dimensions: { width: 100, height: 80, levels: 2 },
    gridPosition: { x: 150, y: 150 },
    accentColor: '#93C5FD',
    summary: 'Delta mobile summary',
    problem: 'Delta problem',
    solution: 'Delta architecture solution',
    architectureNotes: 'Delta notes',
    techStack: ['React Native', 'Expo'],
    infrastructureDeps: [],
    subsystems: [],
    metrics: [],
    keyDecisions: [],
    resilienceTesting: '',
    links: { github: 'https://github.com/owner/delta-mobile' }
  },
  {
    id: 'gh-105',
    code: 'GH-05',
    title: 'epsilon-tools',
    tagline: 'Epsilon tools tagline',
    category: 'tooling',
    status: 'EXPERIMENTAL',
    year: '2024',
    dimensions: { width: 100, height: 80, levels: 2 },
    gridPosition: { x: 200, y: 200 },
    accentColor: '#F59E0B',
    summary: 'Epsilon summary',
    problem: 'Epsilon problem',
    solution: 'Epsilon architecture solution',
    architectureNotes: 'Epsilon notes',
    techStack: ['Rust', 'CLI'],
    infrastructureDeps: [],
    subsystems: [],
    metrics: [],
    keyDecisions: [],
    resilienceTesting: '',
    links: { github: 'https://github.com/owner/epsilon-tools' }
  }
];

test('1. resolveFlagshipProjects: resolves configured flagship IDs correctly', () => {
  const result = resolveFlagshipProjects(mockProjects, ['gh-103', 'gh-101', 'gh-105', 'gh-102']);
  assert.equal(result.length, 4);
  assert.equal(result[0].id, 'gh-103');
  assert.equal(result[1].id, 'gh-101');
  assert.equal(result[2].id, 'gh-105');
  assert.equal(result[3].id, 'gh-102');
});

test('2. resolveFlagshipProjects: preserves exact owner-specified order', () => {
  const customOrder = ['gh-104', 'gh-102', 'gh-101', 'gh-103'];
  const result = resolveFlagshipProjects(mockProjects, customOrder);
  assert.deepEqual(result.map(p => p.id), customOrder);
});

test('3. resolveFlagshipProjects: safely ignores unknown IDs without arbitrary backfilling when non-empty', () => {
  const configured = ['gh-nonexistent', 'gh-103', 'gh-invalid', 'gh-105'];
  const result = resolveFlagshipProjects(mockProjects, configured, 4);
  assert.equal(result.length, 2);
  assert.equal(result[0].id, 'gh-103');
  assert.equal(result[1].id, 'gh-105');
});

test('4. resolveFlagshipProjects: explicitly configured 3 projects resolves exactly 3 (no backfill)', () => {
  const threeProjects = ['gh-102', 'gh-104', 'gh-101'];
  const result = resolveFlagshipProjects(mockProjects, threeProjects, 4);
  assert.equal(result.length, 3);
  assert.deepEqual(result.map(p => p.id), threeProjects);
});

test('5. resolveFlagshipProjects: prevents duplicate project entries when duplicate IDs configured', () => {
  const duplicateConfig = ['gh-101', 'gh-101', 'gh-102', 'gh-102', 'gh-103'];
  const result = resolveFlagshipProjects(mockProjects, duplicateConfig, 4);
  assert.equal(result.length, 3);
  assert.equal(result[0], mockProjects[0]);
  assert.equal(result[1], mockProjects[1]);
  assert.equal(result[2], mockProjects[2]);
});

test('6. resolveFlagshipProjects: empty or undefined configuration falls back gracefully to first N active projects', () => {
  const fallbackEmpty = resolveFlagshipProjects(mockProjects, []);
  assert.equal(fallbackEmpty.length, 4);
  assert.deepEqual(fallbackEmpty.map(p => p.id), ['gh-101', 'gh-102', 'gh-103', 'gh-104']);

  const fallbackUndefined = resolveFlagshipProjects(mockProjects, undefined);
  assert.equal(fallbackUndefined.length, 4);
  assert.deepEqual(fallbackUndefined.map(p => p.id), ['gh-101', 'gh-102', 'gh-103', 'gh-104']);
});

test('7. ownerPreferencesStorage: formatOwnerPreferencesFile generates valid TypeScript', () => {
  const formatted = formatOwnerPreferencesFile(
    ['gh-101', 'gh-102'],
    { 'gh-101': 'alpha-service', 'gh-102': 'beta-frontend' }
  );

  assert.ok(formatted.includes("export const OWNER_PORTFOLIO_PREFERENCES"));
  assert.ok(formatted.includes("'gh-101', // alpha-service"));
  assert.ok(formatted.includes("'gh-102' // beta-frontend"));
});

test('8. ownerPreferencesStorage: writeOwnerPreferences enforces max 4, deduplication, and atomic write', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pref-test-'));
  const testFile = path.join(tmpDir, 'ownerPreferences.ts');

  const availableIds = ['gh-101', 'gh-102', 'gh-103', 'gh-104', 'gh-105'];
  const inputIds = ['gh-103', 'gh-101', 'gh-103', 'gh-999', 'gh-104', 'gh-105', 'gh-102'];

  const writeResult = writeOwnerPreferences(testFile, inputIds, availableIds);
  assert.equal(writeResult.success, true);
  // Expected: gh-103, gh-101, gh-104, gh-105 (gh-999 ignored, gh-103 duplicate dropped, max 4 capped)
  assert.deepEqual(writeResult.savedIds, ['gh-103', 'gh-101', 'gh-104', 'gh-105']);

  const fileContent = fs.readFileSync(testFile, 'utf8');
  assert.ok(fileContent.includes("'gh-103'"));
  assert.ok(!fileContent.includes("'gh-999'"));

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('8b. ownerPreferencesStorage: writeOwnerPreferences with empty availableProjectIds array saves zero IDs', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pref-test-empty-'));
  const testFile = path.join(tmpDir, 'ownerPreferences.ts');

  const availableIds: string[] = [];
  const inputIds = ['gh-101', 'gh-102', 'gh-103'];

  const writeResult = writeOwnerPreferences(testFile, inputIds, availableIds);
  assert.equal(writeResult.success, true);
  assert.deepEqual(writeResult.savedIds, []);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('9. ResumeModal source: uses resolveFlagshipProjects and does not use direct activeProjects.slice(0, 4)', () => {
  const modalPath = path.resolve(process.cwd(), 'src/components/ResumeModal.tsx');
  const modalCode = fs.readFileSync(modalPath, 'utf8');

  assert.ok(
    modalCode.includes('resolveFlagshipProjects'),
    'ResumeModal must import and call resolveFlagshipProjects'
  );
  assert.ok(
    !modalCode.includes('activeProjects.slice(0, 4)'),
    'ResumeModal must NOT perform arbitrary activeProjects.slice(0, 4)'
  );
  assert.ok(
    modalCode.includes('resolvedFlagships'),
    'ResumeModal must reference resolvedFlagships in both UI and Markdown generator'
  );
});

test('10. PORTFOLIO_CONFIG: consumes OWNER_PORTFOLIO_PREFERENCES.flagshipProjectIds', () => {
  assert.ok(Array.isArray(PORTFOLIO_CONFIG.flagshipProjectIds));
  assert.deepEqual(
    PORTFOLIO_CONFIG.flagshipProjectIds,
    OWNER_PORTFOLIO_PREFERENCES.flagshipProjectIds
  );
});

test('11. Flagship Configurator Server: binds strictly to localhost (127.0.0.1) and enforces origin check', async () => {
  assert.equal(DEFAULT_CONFIGURATOR_HOST, '127.0.0.1');
  assert.equal(DEFAULT_CONFIGURATOR_PORT, 4174);

  const server = createFlagshipConfiguratorServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const addr = server.address();
  assert.ok(typeof addr === 'object' && addr !== null);
  assert.equal(addr.address, '127.0.0.1');

  const testPort = addr.port;

  // Test non-local host header receives 403 Forbidden via raw http.request
  const statusCode = await new Promise<number>((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: testPort,
      path: '/',
      method: 'GET',
      headers: { host: 'external-host.com' }
    }, res => {
      resolve(res.statusCode || 0);
    });
    req.on('error', reject);
    req.end();
  });
  assert.equal(statusCode, 403);

  // Test local host header succeeds
  const successRes = await fetch(`http://127.0.0.1:${testPort}/`);
  assert.equal(successRes.status, 200);

  server.close();
});
