import { writeFile } from 'node:fs/promises';
import { PORTFOLIO_CONFIG } from '../src/config/portfolioConfig';
import { connectGitHubTarget, GitHubSyncResult } from '../src/services/githubService';
import type { GitHubSnapshotMetadata } from '../src/types';

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

export function serializeGitHubSnapshot(metadata: GitHubSnapshotMetadata, snapshot: GitHubSyncResult): string {
  // Ensure no sensitive tokens or local file paths are present
  const metadataJson = JSON.stringify(metadata, null, 2);
  const snapshotJson = JSON.stringify(snapshot, null, 2);

  return `// THIS IS A GENERATED FILE. DO NOT EDIT DIRECTLY.
// Run "npm run sync:github" to regenerate against the configured GitHub target.

import type { GitHubSnapshotMetadata } from '../types';
import type { GitHubSyncResult } from '../services/githubService';

export const GITHUB_SNAPSHOT_METADATA: GitHubSnapshotMetadata = ${metadataJson};

export const GITHUB_SNAPSHOT: GitHubSyncResult = ${snapshotJson};
`;
}

async function main() {
  const target = readArg('--target') || readArg('--github') || PORTFOLIO_CONFIG.githubTarget;
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const strictInspection = process.argv.includes('--strict');

  console.log(`[sync:github] Fetching public repository snapshot for target: ${target}`);
  if (token) {
    console.log(`[sync:github] Using authenticated GitHub API token.`);
  } else {
    console.log(`[sync:github] No GITHUB_TOKEN detected. Requests will run unauthenticated.`);
  }

  const startTime = Date.now();
  const result = await connectGitHubTarget(target, {
    token,
    inspectionConcurrency: 3,
    strictInspection,
    allowPartial: true
  });

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);

  const metadata: GitHubSnapshotMetadata = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    githubTarget: target,
    sourceIdentifier: result.sourceIdentifier,
    rawRepositoryCount: result.rawCount ?? result.projects.length,
    canonicalRepositoryCount: result.projects.length,
    inspectedRepositoryCount: result.projects.length,
    inspectionWarnings: []
  };

  const outputContent = serializeGitHubSnapshot(metadata, result);

  // Safety audit
  if (token && outputContent.includes(token)) {
    throw new Error('FATAL: GitHub token detected in serialized snapshot output!');
  }
  if (outputContent.includes('C:\\\\') || outputContent.includes('/Users/')) {
    throw new Error('FATAL: Absolute local file path detected in serialized snapshot output!');
  }

  await writeFile('src/data/githubSnapshot.generated.ts', outputContent, 'utf8');

  console.log(`\n======================================================`);
  console.log(`GITHUB SNAPSHOT GENERATION COMPLETE (${durationSec}s)`);
  console.log(`======================================================`);
  console.log(`Target:               ${target}`);
  console.log(`Source Identifier:    ${result.sourceIdentifier}`);
  console.log(`Total Repositories:   ${result.rawCount ?? result.projects.length}`);
  console.log(`Canonical Projects:   ${result.projects.length}`);
  console.log(`Synthesized Skills:   ${result.skills.length}`);
  console.log(`Primary Stack:        ${result.operator.primaryStack.slice(0, 6).join(', ')}`);
  console.log(`Committed Output:     src/data/githubSnapshot.generated.ts`);
  console.log(`======================================================\n`);
}

// Only run main when executed as script
if (process.argv[1]?.endsWith('sync-github-snapshot.ts')) {
  main().catch(err => {
    console.error(`\n[sync:github] FAILED:`, err.message || err);
    process.exit(1);
  });
}

