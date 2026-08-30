import { execFileSync } from 'node:child_process';
import { OWNER_SETUP_MANIFEST } from '../src/config/ownerSetup.generated';
import {
  detectRepositoryIdentity,
  evaluateDeploymentReadiness,
  type DeploymentReadinessResult,
  type RepositoryIdentityReaders,
  type RepositoryIdentityResolution
} from '../src/utils/deploymentReadiness';

export interface DeploymentReadinessOptions {
  env?: Record<string, string | undefined>;
  cwd?: string;
  getGitOriginUrl?: () => string | null;
}

export function readGitOriginUrl(cwd = process.cwd()): string | null {
  try {
    return execFileSync('git', ['remote', 'get-url', 'origin'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim() || null;
  } catch {
    return null;
  }
}

export function resolveCurrentRepository(
  options: DeploymentReadinessOptions = {}
): RepositoryIdentityResolution {
  const readers: RepositoryIdentityReaders = {
    env: options.env || process.env,
    getGitOriginUrl: options.getGitOriginUrl || (() => readGitOriginUrl(options.cwd))
  };
  return detectRepositoryIdentity(readers);
}

export function checkDeploymentReadiness(
  options: DeploymentReadinessOptions = {}
): DeploymentReadinessResult {
  return evaluateDeploymentReadiness(OWNER_SETUP_MANIFEST, resolveCurrentRepository(options));
}
