/** Production-build guard for copied owner data in repository forks. */

import { checkDeploymentReadiness } from './deployment-readiness';

export function formatRepository(identity: { owner: string; name: string } | null): string {
  return identity ? `${identity.owner}/${identity.name}` : 'UNAVAILABLE';
}

export function runDeploymentReadinessCheck(): boolean {
  const result = checkDeploymentReadiness();
  const rule = '='.repeat(56);

  console.log(rule);
  console.log('SYSTEMS CARTOGRAPHY // DEPLOYMENT GUARD');
  console.log(rule);

  if (result.ready) {
    console.log('✓ REPOSITORY OWNER SETUP VERIFIED');
    console.log(`Repository: ${formatRepository(result.currentRepository)}`);
    console.log(`Identity source: ${result.identitySource}`);
    console.log(rule);
    console.log('BUILD ALLOWED');
    console.log(rule);
    return true;
  }

  if (result.code === 'REPOSITORY_MISMATCH') {
    console.log('✗ FORK OWNER SETUP REQUIRED');
    console.log('');
    console.log('This repository is configured for:');
    console.log(formatRepository(result.configuredRepository));
    console.log('');
    console.log('Current repository:');
    console.log(formatRepository(result.currentRepository));
    console.log('');
    console.log("This fork still contains another owner's portfolio data.");
  } else if (result.code === 'REPOSITORY_IDENTITY_UNAVAILABLE') {
    console.log('✗ DEPLOYMENT IDENTITY UNAVAILABLE');
    console.log('');
    console.log('Unable to determine the Git repository being built.');
    console.log('');
    console.log('Production build is blocked because the portfolio setup');
    console.log('cannot be bound to the current repository.');
    console.log('');
    console.log('Run the build from:');
    console.log('- a supported Git-connected CI/deployment provider, or');
    console.log('- a checkout retaining a valid GitHub origin remote.');
  } else {
    console.log('✗ VERIFIED OWNER SETUP REQUIRED');
    console.log('');
    console.log(`Setup manifest state: ${result.code}`);
  }

  console.log('');
  if (result.code !== 'REPOSITORY_IDENTITY_UNAVAILABLE') {
    console.log('Run:');
    console.log('npm run setup:portfolio');
    console.log('');
    console.log('Then complete VERIFY and COMPLETE before deploying.');
  }
  console.log('');
  console.log(rule);
  console.log('BUILD BLOCKED');
  console.log(rule);
  return false;
}

function run(): void {
  if (!runDeploymentReadinessCheck()) process.exitCode = 1;
}

if (process.argv[1]?.endsWith('check-deployment-readiness.ts')) {
  run();
}
