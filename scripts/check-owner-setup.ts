/**
 * SYSTEMS CARTOGRAPHY // OWNER CHECK
 *
 * `npm run setup:check`
 *
 * A deterministic, local-only, network-free diagnostic that reports whether
 * the current fork's owner configuration is safe and internally consistent:
 *
 *   - Is a valid owner profile configured?
 *   - Does the committed GitHub snapshot belong to the configured owner?
 *   - Is any PERSISTENT OWNER-CURATED data (additional experience,
 *     professional evidence, repository architecture evidence) present on
 *     disk but belonging to a DIFFERENT owner than the one configured? If
 *     so, is it actually inert at runtime (never applied), or could it leak?
 *
 * Safe to run repeatedly. Exits non-zero on FAIL-level issues so it can be
 * wired into `npm run verify` / CI.
 */

import { PORTFOLIO_CONFIG } from '../src/config/portfolioConfig';
import { OWNER_PROFILE } from '../src/data/ownerProfile.generated';
import { GITHUB_SNAPSHOT, GITHUB_SNAPSHOT_METADATA } from '../src/data/githubSnapshot.generated';
import { resolveGitHubSnapshotForTarget, parseGitHubTarget } from '../src/utils/portfolioUtils';
import { isSameGithubOwner } from '../src/utils/ownerScope';
import {
  REPOSITORY_EVIDENCE_OWNER_GITHUB_TARGET,
  evidenceByRepository,
  getRepositoryEvidence
} from '../src/data/repositoryEvidence';
import {
  OWNER_EXPERIENCE_EVIDENCE_GITHUB_TARGET,
  OWNER_EXPERIENCE_EVIDENCE,
  getOwnerExperienceEvidenceCollection
} from '../src/data/ownerExperienceEvidence';
import {
  ADDITIONAL_OWNER_EXPERIENCE_OWNER_GITHUB_TARGET,
  ADDITIONAL_OWNER_EXPERIENCE,
  getDefaultAdditionalOwnerExperience
} from '../src/data/ownerAdditionalExperience';

type Level = 'PASS' | 'WARNING' | 'FAIL';

interface CheckResult {
  level: Level;
  message: string;
}

const results: CheckResult[] = [];

function pass(message: string): void {
  results.push({ level: 'PASS', message });
}
function warn(message: string): void {
  results.push({ level: 'WARNING', message });
}
function fail(message: string): void {
  results.push({ level: 'FAIL', message });
}

function symbolFor(level: Level): string {
  if (level === 'PASS') return '✓'; // ✓
  if (level === 'WARNING') return '!';
  return '✗'; // ✗
}

function run(): void {
  const configuredTarget = PORTFOLIO_CONFIG.githubTarget;

  // 1. Configured GitHub target must be a valid, parseable owner identity.
  let parsedTargetOwner = '';
  try {
    parsedTargetOwner = parseGitHubTarget(configuredTarget).owner;
    pass(`Owner profile configured (${PORTFOLIO_CONFIG.operator.name} // ${PORTFOLIO_CONFIG.operator.role})`);
    pass(`GitHub target: github.com/${parsedTargetOwner}`);
  } catch (err) {
    fail(`Configured GitHub target is malformed: "${configuredTarget}" (${err instanceof Error ? err.message : String(err)})`);
  }

  // 2. Required generated owner identity fields.
  if (!OWNER_PROFILE.operator?.name || !OWNER_PROFILE.operator.name.trim()) {
    fail('Generated owner profile is missing a required operator name. Run: npm run setup -- ./imports/linkedin-profile.pdf');
  }
  if (!OWNER_PROFILE.githubTarget || !OWNER_PROFILE.githubTarget.trim()) {
    fail('Generated owner profile is missing a GitHub target.');
  }

  // 3. GitHub snapshot ownership.
  const hasSnapshotMetadata = Boolean(GITHUB_SNAPSHOT_METADATA?.githubTarget);
  if (!hasSnapshotMetadata) {
    warn('GitHub snapshot not yet generated -- run: npm run sync:github');
  } else {
    const snapshotOwnerMatches = isSameGithubOwner(configuredTarget, GITHUB_SNAPSHOT_METADATA.githubTarget);
    const configuredSnapshot = resolveGitHubSnapshotForTarget(configuredTarget, GITHUB_SNAPSHOT_METADATA, GITHUB_SNAPSHOT);
    if (snapshotOwnerMatches && configuredSnapshot) {
      pass(`GitHub snapshot belongs to configured owner (${configuredSnapshot.projects.length} repositories)`);
      pass(`${configuredSnapshot.projects.length} repositories indexed`);
      pass(`${configuredSnapshot.skills.length} capabilities generated`);
    } else {
      fail(
        `GitHub snapshot belongs to a different owner (github.com/${GITHUB_SNAPSHOT_METADATA.githubTarget?.split('/').pop() || 'unknown'}) than the configured target -- run: npm run sync:github`
      );
    }
  }

  // 4. Professional roles imported.
  const importedRoleCount = (OWNER_PROFILE.experience || []).length;
  pass(`${importedRoleCount} professional role${importedRoleCount === 1 ? '' : 's'} imported`);

  // 5. Curated repository evidence ownership.
  const repoEvidenceCount = Object.keys(evidenceByRepository).length;
  const repoEvidenceOwnerMatches = isSameGithubOwner(configuredTarget, REPOSITORY_EVIDENCE_OWNER_GITHUB_TARGET);
  if (repoEvidenceCount === 0) {
    warn('No curated repository evidence configured (src/data/repositoryEvidence.ts is empty)');
  } else if (repoEvidenceOwnerMatches) {
    pass(`Curated repository evidence active (${repoEvidenceCount} repositories)`);
  } else {
    warn('Curated repository evidence belongs to another owner -- ignored');
  }

  // 6. Curated professional evidence ownership.
  const professionalEvidenceCount = OWNER_EXPERIENCE_EVIDENCE.length;
  const professionalEvidenceOwnerMatches = isSameGithubOwner(configuredTarget, OWNER_EXPERIENCE_EVIDENCE_GITHUB_TARGET);
  if (professionalEvidenceCount === 0) {
    warn('No curated professional evidence configured (src/data/ownerExperienceEvidence.ts is empty)');
  } else if (professionalEvidenceOwnerMatches) {
    pass(`Curated professional evidence active (${professionalEvidenceCount} organization${professionalEvidenceCount === 1 ? '' : 's'})`);
  } else {
    warn('Curated professional evidence belongs to another owner -- ignored');
  }

  // 7. Additional professional experience ownership.
  const additionalExperienceCount = ADDITIONAL_OWNER_EXPERIENCE.length;
  const additionalExperienceOwnerMatches = isSameGithubOwner(configuredTarget, ADDITIONAL_OWNER_EXPERIENCE_OWNER_GITHUB_TARGET);
  if (additionalExperienceCount === 0) {
    warn('No additional professional experience configured (src/data/ownerAdditionalExperience.ts is empty)');
  } else if (additionalExperienceOwnerMatches) {
    pass(`Additional professional experience active (${additionalExperienceCount} record${additionalExperienceCount === 1 ? '' : 's'})`);
  } else {
    warn('Additional professional experience belongs to another owner -- ignored');
  }

  // 8. Contact form endpoint (optional; never gates PASS/FAIL).
  if (!PORTFOLIO_CONFIG.contactFormEndpoint) {
    warn('No contact form endpoint configured -- the contact page falls back to the visitor\'s mail client');
  } else {
    pass('Contact form endpoint configured');
  }

  // 9. Defense-in-depth: functionally EXERCISE each owner-scoped getter with
  // the configured target to prove foreign-owner data cannot leak, rather
  // than only reasoning about it statically.
  let exposureDetected = false;
  if (!repoEvidenceOwnerMatches && repoEvidenceCount > 0) {
    const sampleRepoName = Object.keys(evidenceByRepository)[0];
    if (getRepositoryEvidence(sampleRepoName, configuredTarget)) {
      fail('Setup state exposes foreign-owner curated repository evidence at runtime -- this is a bug, not just a warning');
      exposureDetected = true;
    }
  }
  if (!professionalEvidenceOwnerMatches && professionalEvidenceCount > 0) {
    if (getOwnerExperienceEvidenceCollection(configuredTarget).length > 0) {
      fail('Setup state exposes foreign-owner curated professional evidence at runtime -- this is a bug, not just a warning');
      exposureDetected = true;
    }
  }
  if (!additionalExperienceOwnerMatches && additionalExperienceCount > 0) {
    if (getDefaultAdditionalOwnerExperience(configuredTarget).length > 0) {
      fail('Setup state exposes foreign-owner additional experience at runtime -- this is a bug, not just a warning');
      exposureDetected = true;
    }
  }
  if (!exposureDetected) {
    pass('No foreign-owner evidence active');
  }

  // ---- Report ----
  const width = 56;
  const rule = '='.repeat(width);
  console.log(rule);
  console.log('SYSTEMS CARTOGRAPHY // OWNER CHECK');
  console.log(rule);
  for (const r of results) {
    console.log(`${symbolFor(r.level)} ${r.message}`);
  }
  console.log(rule);

  const failCount = results.filter(r => r.level === 'FAIL').length;
  const warnCount = results.filter(r => r.level === 'WARNING').length;

  if (failCount > 0) {
    console.log(`STATUS: FAIL (${failCount} failure${failCount === 1 ? '' : 's'}, ${warnCount} warning${warnCount === 1 ? '' : 's'})`);
  } else if (warnCount > 0) {
    console.log(`STATUS: PASS WITH WARNINGS (${warnCount} warning${warnCount === 1 ? '' : 's'})`);
  } else {
    console.log('STATUS: PASS');
  }
  console.log(rule);

  if (failCount > 0) {
    process.exitCode = 1;
  }
}

if (process.argv[1]?.endsWith('check-owner-setup.ts')) {
  run();
}

export { run as checkOwnerSetup };
