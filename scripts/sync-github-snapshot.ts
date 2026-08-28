import { writeFile, rename, unlink } from 'node:fs/promises';
import { PORTFOLIO_CONFIG } from '../src/config/portfolioConfig';
import { connectGitHubTarget, GitHubSyncResult, GitHubFetchOptions, DEFAULT_INSPECTION_CONCURRENCY } from '../src/services/githubService';
import type { GitHubSnapshotMetadata } from '../src/types';

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

export function serializeGitHubSnapshot(metadata: GitHubSnapshotMetadata, snapshot: GitHubSyncResult): string {
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

export async function generateGitHubSnapshot(
  target: string,
  options?: GitHubFetchOptions
): Promise<{ metadata: GitHubSnapshotMetadata; snapshot: GitHubSyncResult; outputContent: string }> {
  const result = await connectGitHubTarget(target, {
    inspectionConcurrency: DEFAULT_INSPECTION_CONCURRENCY,
    ...options
  });

  if (!result.inspectionSummary) {
    throw new Error('Internal contract error: Snapshot result is missing inspectionSummary.');
  }

  const metadata: GitHubSnapshotMetadata = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    githubTarget: target,
    sourceIdentifier: result.sourceIdentifier,
    rawRepositoryCount: result.rawCount ?? result.projects.length,
    canonicalRepositoryCount: result.inspectionSummary.canonicalRepositoryCount,
    inspectedRepositoryCount: result.inspectionSummary.inspectedRepositoryCount,
    inspectionWarnings: result.inspectionSummary.warnings
  };

  if (metadata.inspectedRepositoryCount !== metadata.canonicalRepositoryCount) {
    throw new Error(
      `Snapshot generation incomplete: Inspected ${metadata.inspectedRepositoryCount} of ${metadata.canonicalRepositoryCount} canonical repositories.`
    );
  }

  if (metadata.inspectionWarnings.length > 0) {
    throw new Error(
      `Snapshot generation produced warnings: ${metadata.inspectionWarnings.join('; ')}`
    );
  }

  const outputContent = serializeGitHubSnapshot(metadata, result);

  // Safety audit: Check for token leaks or local machine paths
  if (options?.token && outputContent.includes(options.token)) {
    throw new Error('FATAL: Injected GitHub token detected in serialized snapshot output!');
  }
  if (outputContent.includes('Authorization: Bearer') || outputContent.includes('ghp_')) {
    throw new Error('FATAL: Authorization header or GitHub PAT detected in serialized snapshot output!');
  }
  if (outputContent.includes('C:\\\\') || outputContent.includes('/Users/')) {
    throw new Error('FATAL: Absolute local file path detected in serialized snapshot output!');
  }

  return { metadata, snapshot: result, outputContent };
}

export async function syncGitHubSnapshotToFile(
  target: string,
  options?: GitHubFetchOptions,
  outputPath = 'src/data/githubSnapshot.generated.ts'
): Promise<{ metadata: GitHubSnapshotMetadata; snapshot: GitHubSyncResult }> {
  const { metadata, snapshot, outputContent } = await generateGitHubSnapshot(target, options);

  // Transactional file write: write to .tmp file first, then atomically rename
  const tmpPath = `${outputPath}.tmp`;
  try {
    await writeFile(tmpPath, outputContent, 'utf8');
    await rename(tmpPath, outputPath);
  } catch (err) {
    try {
      await unlink(tmpPath);
    } catch {
      // Ignore cleanup error
    }
    throw err;
  }

  return { metadata, snapshot };
}

async function main() {
  const target = readArg('--target') || readArg('--github') || PORTFOLIO_CONFIG.githubTarget;
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

  console.log(`[sync:github] Fetching public repository snapshot for target: ${target}`);
  if (token) {
    console.log(`[sync:github] Using authenticated GitHub API token.`);
  } else {
    console.log(`[sync:github] No GITHUB_TOKEN detected. Requests will run unauthenticated.`);
  }

  const startTime = Date.now();
  const { metadata, snapshot } = await syncGitHubSnapshotToFile(target, {
    token,
    inspectionConcurrency: DEFAULT_INSPECTION_CONCURRENCY
  });

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n======================================================`);
  console.log(`GITHUB SNAPSHOT GENERATION COMPLETE (${durationSec}s)`);
  console.log(`======================================================`);
  console.log(`Target:                     ${target}`);
  console.log(`Source Identifier:          ${snapshot.sourceIdentifier}`);
  console.log(`Total Repositories:         ${metadata.rawRepositoryCount}`);
  console.log(`Canonical Projects:         ${metadata.canonicalRepositoryCount}`);
  console.log(`Inspected Repositories:     ${metadata.inspectedRepositoryCount}`);
  console.log(`Inspection Warnings:        ${metadata.inspectionWarnings.length}`);
  console.log(`Synthesized Skills:         ${snapshot.skills.length}`);
  console.log(`Primary Stack:              ${snapshot.operator.primaryStack.slice(0, 6).join(', ')}`);
  console.log(`Committed Output:           src/data/githubSnapshot.generated.ts`);
  console.log(`======================================================\n`);
}

// Only run main when executed as script
if (process.argv[1]?.endsWith('sync-github-snapshot.ts')) {
  main().catch(err => {
    console.error(`\n[sync:github] FAILED:`, err.message || err);
    process.exit(1);
  });
}


