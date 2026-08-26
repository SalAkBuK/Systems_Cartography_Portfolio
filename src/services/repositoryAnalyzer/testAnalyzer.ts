import { EvidenceProvenance } from '../../types';
import { AnalyzedDependencies, AnalyzedDocumentation, AnalyzedTesting, RawRepositoryInspection } from './types';

export function analyzeTesting(
  inspection: RawRepositoryInspection,
  dependencies: AnalyzedDependencies,
  documentation: AnalyzedDocumentation
): AnalyzedTesting {
  const testFrameworks: string[] = [];
  const ciWorkflows: string[] = [];
  const e2eHarnesses: string[] = [];
  const lintersAndFormatters: string[] = [];
  const buildTools: string[] = [];

  let hasDocker = false;
  let hasMigrations = false;
  let testFilesDetected = 0;

  // 1. Check dependencies
  dependencies.frameworks.testing.forEach(t => {
    if (['Playwright', 'Cypress'].includes(t)) {
      if (!e2eHarnesses.includes(t)) e2eHarnesses.push(t);
    } else {
      if (!testFrameworks.includes(t)) testFrameworks.push(t);
    }
  });

  dependencies.frameworks.tools.forEach(t => {
    if (['ESLint', 'Prettier', 'Biome'].includes(t) && !lintersAndFormatters.includes(t)) {
      lintersAndFormatters.push(t);
    }
  });

  dependencies.frameworks.devops.forEach(t => {
    if (['Vite', 'Turborepo', 'esbuild', 'Webpack'].includes(t) && !buildTools.includes(t)) {
      buildTools.push(t);
    }
    if (t === 'Docker') hasDocker = true;
    if (t === 'GitHub Actions' && !ciWorkflows.includes('GitHub Actions')) {
      ciWorkflows.push('GitHub Actions');
    }
  });

  // 2. Check package scripts
  const scripts = dependencies.packageScripts;
  for (const [scriptName, scriptCmd] of Object.entries(scripts)) {
    const text = `${scriptName} ${scriptCmd}`.toLowerCase();
    if (text.includes('vitest') && !testFrameworks.includes('Vitest')) testFrameworks.push('Vitest');
    if (text.includes('jest') && !testFrameworks.includes('Jest')) testFrameworks.push('Jest');
    if (text.includes('playwright') && !e2eHarnesses.includes('Playwright')) e2eHarnesses.push('Playwright');
    if (text.includes('cypress') && !e2eHarnesses.includes('Cypress')) e2eHarnesses.push('Cypress');
    if (text.includes('autocannon') && !testFrameworks.includes('Autocannon (Load)')) testFrameworks.push('Autocannon (Load)');
    if (text.includes('tsc') || text.includes('typecheck') || text.includes('type-check')) {
      if (!lintersAndFormatters.includes('TypeScript Type-Check')) lintersAndFormatters.push('TypeScript Type-Check');
    }
    if (text.includes('eslint') && !lintersAndFormatters.includes('ESLint')) lintersAndFormatters.push('ESLint');
    if (text.includes('biome') && !lintersAndFormatters.includes('Biome')) lintersAndFormatters.push('Biome');
  }

  // 3. Scan tree files
  if (inspection.treeFiles && inspection.treeFiles.length > 0) {
    const testFileRegex = /(\.|_)(test|spec)\.[a-zA-Z0-9]+$|^tests?\/|^__tests__\/|^e2e\//i;
    testFilesDetected = inspection.treeFiles.filter(f => testFileRegex.test(f)).length;

    if (inspection.treeFiles.some(f => f.startsWith('.github/workflows/')) && !ciWorkflows.includes('GitHub Actions')) {
      ciWorkflows.push('GitHub Actions');
    }

    if (inspection.treeFiles.some(f => f.includes('Dockerfile') || f.includes('docker-compose'))) {
      hasDocker = true;
    }

    if (inspection.treeFiles.some(f => f.includes('migrations/') || f.includes('prisma/migrations'))) {
      hasMigrations = true;
    }
  }

  // 4. Build summary
  const summaryParts: string[] = [];

  if (documentation.testingNotes) {
    summaryParts.push(documentation.testingNotes);
  } else {
    if (testFrameworks.length > 0) {
      summaryParts.push(`Unit/integration test suite configured (${testFrameworks.join(', ')}).`);
    }
    if (e2eHarnesses.length > 0) {
      summaryParts.push(`End-to-end browser automation configured (${e2eHarnesses.join(', ')}).`);
    }
    if (ciWorkflows.length > 0) {
      summaryParts.push(`Automated verification pipeline via ${ciWorkflows.join(', ')}.`);
    }
    if (lintersAndFormatters.length > 0) {
      summaryParts.push(`Static analysis & code quality enforced with ${lintersAndFormatters.join(', ')}.`);
    }
    if (testFilesDetected > 0) {
      summaryParts.push(`${testFilesDetected} test files detected in repository structure.`);
    }
    if (hasDocker) {
      summaryParts.push('Containerized execution environment (Dockerfile/Compose).');
    }
  }

  const hasAnyEvidence = testFrameworks.length > 0 || e2eHarnesses.length > 0 || ciWorkflows.length > 0 || lintersAndFormatters.length > 0 || testFilesDetected > 0 || documentation.testingNotes !== null;

  const testingSummary = hasAnyEvidence 
    ? summaryParts.join(' ')
    : 'No test harness, test files, or CI workflow detected in repository.';

  const provenance: EvidenceProvenance = hasAnyEvidence ? 'VERIFIED' : 'UNAVAILABLE';

  return {
    testFrameworks,
    ciWorkflows,
    e2eHarnesses,
    lintersAndFormatters,
    buildTools,
    hasDocker,
    hasMigrations,
    testFilesDetected,
    testingSummary,
    provenance
  };
}
