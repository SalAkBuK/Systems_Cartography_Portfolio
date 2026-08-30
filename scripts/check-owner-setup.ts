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
import { evaluateOwnerIdentityMatch } from '../src/utils/ownerIdentityMatch';
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
import { OWNER_PORTFOLIO_PREFERENCES } from '../src/config/ownerPreferences';

type Level = 'PASS' | 'WARNING' | 'FAIL';

interface CheckResult {
  level: Level;
  message: string;
}

export interface OwnerSetupCheckSummary {
  results: CheckResult[];
  passCount: number;
  warnCount: number;
  failCount: number;
  status: 'PASS' | 'PASS_WITH_WARNINGS' | 'FAIL';
}

export function symbolFor(level: Level): string {
  if (level === 'PASS') return '✓';
  if (level === 'WARNING') return '!';
  return '✗';
}

export interface OwnerSetupCheckOverrides {
  ownerProfile?: typeof OWNER_PROFILE;
  snapshot?: typeof GITHUB_SNAPSHOT;
  snapshotMetadata?: typeof GITHUB_SNAPSHOT_METADATA;
  preferences?: typeof OWNER_PORTFOLIO_PREFERENCES;
  githubTarget?: string;
  crossOwnerConfirmed?: boolean;
}

export function runOwnerSetupChecks(overrides?: OwnerSetupCheckOverrides): OwnerSetupCheckSummary {
  const checkResults: CheckResult[] = [];
  const addPass = (msg: string) => checkResults.push({ level: 'PASS', message: msg });
  const addWarn = (msg: string) => checkResults.push({ level: 'WARNING', message: msg });
  const addFail = (msg: string) => checkResults.push({ level: 'FAIL', message: msg });

  const profile = overrides?.ownerProfile || OWNER_PROFILE;
  const snapshot = overrides?.snapshot || GITHUB_SNAPSHOT;
  const snapshotMetadata = overrides?.snapshotMetadata || (overrides?.snapshot ? {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    githubTarget: overrides.githubTarget || profile.githubTarget || PORTFOLIO_CONFIG.githubTarget,
    sourceIdentifier: snapshot.sourceIdentifier || '',
    rawRepositoryCount: snapshot.projects?.length || 0,
    canonicalRepositoryCount: snapshot.projects?.length || 0,
    inspectedRepositoryCount: snapshot.projects?.length || 0,
    inspectionWarnings: []
  } : GITHUB_SNAPSHOT_METADATA);
  const preferences = overrides?.preferences || OWNER_PORTFOLIO_PREFERENCES;

  const configuredTarget = overrides?.githubTarget || profile.githubTarget || PORTFOLIO_CONFIG.githubTarget;

  // 1. Configured GitHub target must be a valid, parseable owner identity.
  let parsedTargetOwner = '';
  try {
    parsedTargetOwner = parseGitHubTarget(configuredTarget).owner;
    const opName = profile.operator?.name || PORTFOLIO_CONFIG.operator.name;
    const opRole = profile.operator?.role || PORTFOLIO_CONFIG.operator.role;
    addPass(`Owner profile configured (${opName} // ${opRole})`);
    addPass(`GitHub target: github.com/${parsedTargetOwner}`);
  } catch (err) {
    addFail(`Configured GitHub target is malformed: "${configuredTarget}" (${err instanceof Error ? err.message : String(err)})`);
  }

  // 2. Required generated owner identity fields.
  if (!profile.operator?.name || !profile.operator.name.trim()) {
    addFail('Generated owner profile is missing a required operator name. Run: npm run setup -- ./imports/linkedin-profile.pdf');
  }
  if (!profile.githubTarget || !profile.githubTarget.trim()) {
    addFail('Generated owner profile is missing a GitHub target.');
  }

  // 2b. Owner identity match check between operator profile and selected GitHub target.
  const crossOwnerConfirmed = overrides?.crossOwnerConfirmed ?? false;
  const identityMatch = evaluateOwnerIdentityMatch({
    ownerProfile: profile,
    githubTarget: configuredTarget
  });

  if (identityMatch.status === 'MATCH') {
    addPass(`Owner profile and GitHub target identities match (@${identityMatch.profileIdentity})`);
  } else if (identityMatch.status === 'UNKNOWN') {
    addWarn('Owner identity match not verifiable -- no GitHub profile link associated with operator profile');
  } else if (identityMatch.status === 'MISMATCH') {
    if (crossOwnerConfirmed) {
      addWarn(`Profile / GitHub owner mismatch explicitly confirmed by owner (Profile: @${identityMatch.profileIdentity} vs Target: @${identityMatch.targetIdentity})`);
    } else {
      addFail(`Owner identity mismatch requires confirmation (Profile: @${identityMatch.profileIdentity} vs Target: @${identityMatch.targetIdentity})`);
    }
  }

  // 3. GitHub snapshot ownership.
  const hasSnapshotMetadata = Boolean(snapshotMetadata?.githubTarget);
  if (!hasSnapshotMetadata) {
    addWarn('GitHub snapshot not yet generated -- run: npm run sync:github');
  } else {
    const snapshotOwnerMatches = isSameGithubOwner(configuredTarget, snapshotMetadata.githubTarget);
    const configuredSnapshot = resolveGitHubSnapshotForTarget(configuredTarget, snapshotMetadata, snapshot);
    if (snapshotOwnerMatches && configuredSnapshot) {
      addPass(`GitHub snapshot belongs to configured owner (${configuredSnapshot.projects.length} repositories)`);
      addPass(`${configuredSnapshot.projects.length} repositories indexed`);
      addPass(`${configuredSnapshot.skills.length} capabilities generated`);
    } else {
      addFail(
        `GitHub snapshot belongs to a different owner (github.com/${snapshotMetadata.githubTarget?.split('/').pop() || 'unknown'}) than the configured target -- run: npm run sync:github`
      );
    }
  }

  // 4. Professional roles imported.
  const importedRoleCount = (profile.experience || []).length;
  addPass(`${importedRoleCount} professional role${importedRoleCount === 1 ? '' : 's'} imported`);

  // 5. Curated repository evidence ownership.
  const repoEvidenceCount = Object.keys(evidenceByRepository).length;
  const repoEvidenceOwnerMatches = isSameGithubOwner(configuredTarget, REPOSITORY_EVIDENCE_OWNER_GITHUB_TARGET);
  if (repoEvidenceCount === 0) {
    addWarn('No curated repository evidence configured (src/data/repositoryEvidence.ts is empty)');
  } else if (repoEvidenceOwnerMatches) {
    addPass(`Curated repository evidence active (${repoEvidenceCount} repositories)`);
  } else {
    addWarn('Curated repository evidence belongs to another owner -- ignored');
  }

  // 6. Curated professional evidence ownership.
  const professionalEvidenceCount = OWNER_EXPERIENCE_EVIDENCE.length;
  const professionalEvidenceOwnerMatches = isSameGithubOwner(configuredTarget, OWNER_EXPERIENCE_EVIDENCE_GITHUB_TARGET);
  if (professionalEvidenceCount === 0) {
    addWarn('No curated professional evidence configured (src/data/ownerExperienceEvidence.ts is empty)');
  } else if (professionalEvidenceOwnerMatches) {
    addPass(`Curated professional evidence active (${professionalEvidenceCount} organization${professionalEvidenceCount === 1 ? '' : 's'})`);
  } else {
    addWarn('Curated professional evidence belongs to another owner -- ignored');
  }

  // 7. Additional professional experience ownership.
  const additionalExperienceCount = ADDITIONAL_OWNER_EXPERIENCE.length;
  const additionalExperienceOwnerMatches = isSameGithubOwner(configuredTarget, ADDITIONAL_OWNER_EXPERIENCE_OWNER_GITHUB_TARGET);
  if (additionalExperienceCount === 0) {
    addWarn('No additional professional experience configured (src/data/ownerAdditionalExperience.ts is empty)');
  } else if (additionalExperienceOwnerMatches) {
    addPass(`Additional professional experience active (${additionalExperienceCount} record${additionalExperienceCount === 1 ? '' : 's'})`);
  } else {
    addWarn('Additional professional experience belongs to another owner -- ignored');
  }

  // 8. Flagship projects configuration.
  const configuredFlagships = preferences.flagshipProjectIds || [];
  if (configuredFlagships.length === 0) {
    addWarn('No owner-curated flagship projects configured -- defaulting to first available projects (run: npm run setup:flagships)');
  } else {
    addPass(`Flagship configuration active (${configuredFlagships.length} configured)`);
    const availableProjectMap = new Map((snapshot.projects || []).map(p => [p.id, p]));
    for (const fId of configuredFlagships) {
      const proj = availableProjectMap.get(fId);
      if (proj) {
        addPass(`Flagship project: ${proj.title} (${proj.code} // ${fId})`);
      } else {
        addWarn(`Flagship project ID "${fId}" not found in current GitHub snapshot -- run: npm run setup:flagships`);
      }
    }
  }

  // 9. Contact form endpoint (optional; never gates PASS/FAIL).
  if (!PORTFOLIO_CONFIG.contactFormEndpoint) {
    addWarn('No contact form endpoint configured -- the contact page falls back to the visitor\'s mail client');
  } else {
    addPass('Contact form endpoint configured');
  }

  // 10. Defense-in-depth exercise.
  let exposureDetected = false;
  if (!repoEvidenceOwnerMatches && repoEvidenceCount > 0) {
    const sampleRepoName = Object.keys(evidenceByRepository)[0];
    if (getRepositoryEvidence(sampleRepoName, configuredTarget)) {
      addFail('Setup state exposes foreign-owner curated repository evidence at runtime -- this is a bug, not just a warning');
      exposureDetected = true;
    }
  }
  if (!professionalEvidenceOwnerMatches && professionalEvidenceCount > 0) {
    if (getOwnerExperienceEvidenceCollection(configuredTarget).length > 0) {
      addFail('Setup state exposes foreign-owner curated professional evidence at runtime -- this is a bug, not just a warning');
      exposureDetected = true;
    }
  }
  if (!additionalExperienceOwnerMatches && additionalExperienceCount > 0) {
    if (getDefaultAdditionalOwnerExperience(configuredTarget).length > 0) {
      addFail('Setup state exposes foreign-owner additional experience at runtime -- this is a bug, not just a warning');
      exposureDetected = true;
    }
  }
  if (!exposureDetected) {
    addPass('No foreign-owner evidence active');
  }

  const passCount = checkResults.filter(r => r.level === 'PASS').length;
  const warnCount = checkResults.filter(r => r.level === 'WARNING').length;
  const failCount = checkResults.filter(r => r.level === 'FAIL').length;

  let status: 'PASS' | 'PASS_WITH_WARNINGS' | 'FAIL' = 'PASS';
  if (failCount > 0) {
    status = 'FAIL';
  } else if (warnCount > 0) {
    status = 'PASS_WITH_WARNINGS';
  }

  return { results: checkResults, passCount, warnCount, failCount, status };
}

function run(): void {
  const summary = runOwnerSetupChecks();

  // ---- Report ----
  const width = 56;
  const rule = '='.repeat(width);
  console.log(rule);
  console.log('SYSTEMS CARTOGRAPHY // OWNER CHECK');
  console.log(rule);
  for (const r of summary.results) {
    console.log(`${symbolFor(r.level)} ${r.message}`);
  }
  console.log(rule);

  if (summary.status === 'FAIL') {
    console.log(`STATUS: FAIL (${summary.failCount} failure${summary.failCount === 1 ? '' : 's'}, ${summary.warnCount} warning${summary.warnCount === 1 ? '' : 's'})`);
    process.exitCode = 1;
  } else if (summary.status === 'PASS_WITH_WARNINGS') {
    console.log(`STATUS: PASS WITH WARNINGS (${summary.warnCount} warning${summary.warnCount === 1 ? '' : 's'})`);
  } else {
    console.log('STATUS: PASS');
  }
  console.log(rule);
}

if (process.argv[1]?.endsWith('check-owner-setup.ts')) {
  run();
}

export { run as checkOwnerSetup };
