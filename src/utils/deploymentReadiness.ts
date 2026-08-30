import type { OwnerSetupManifest, RepositoryIdentity } from '../config/ownerSetupManifest';

export type RepositoryIdentitySource =
  | 'vercel'
  | 'netlify'
  | 'github-actions'
  | 'gitlab-ci'
  | 'bitbucket-pipelines'
  | 'ci-repository-url'
  | 'git-origin';

export interface RepositoryIdentityResolution {
  identity: RepositoryIdentity | null;
  source: RepositoryIdentitySource | null;
  reason?: string;
}

export interface RepositoryIdentityReaders {
  env?: Record<string, string | undefined>;
  getGitOriginUrl?: () => string | null;
}

export type DeploymentReadinessCode =
  | 'READY'
  | 'SETUP_INCOMPLETE'
  | 'UNSUPPORTED_MANIFEST'
  | 'REPOSITORY_IDENTITY_UNAVAILABLE'
  | 'REPOSITORY_MISMATCH';

export interface DeploymentReadinessResult {
  ready: boolean;
  code: DeploymentReadinessCode;
  configuredRepository: RepositoryIdentity | null;
  currentRepository: RepositoryIdentity | null;
  identitySource: RepositoryIdentitySource | null;
}

function cleanPart(value: string): string {
  return value.trim().replace(/^\/+|\/+$/g, '').replace(/\.git$/i, '');
}

export function parseRepositorySlug(value?: string | null): RepositoryIdentity | null {
  if (!value) return null;
  const clean = value.trim().replace(/^\/+|\/+$/g, '').replace(/\.git$/i, '');
  const parts = clean.split('/').filter(Boolean);
  if (parts.length !== 2) return null;

  const owner = cleanPart(parts[0]);
  const name = cleanPart(parts[1]);
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(owner)) return null;
  if (!/^[A-Za-z0-9._-]+$/.test(name)) return null;
  return { owner, name };
}

export function parseGitRemoteUrl(value?: string | null): RepositoryIdentity | null {
  if (!value) return null;
  const remote = value.trim();
  if (!remote) return null;

  const scpLike = remote.match(/^[^@\s]+@([^:\s]+):(.+)$/);
  if (scpLike) {
    if (scpLike[1].toLowerCase() !== 'github.com') return null;
    return parseRepositorySlug(scpLike[2]);
  }

  try {
    const parsed = new URL(remote);
    if (parsed.hostname.toLowerCase() !== 'github.com') return null;
    return parseRepositorySlug(parsed.pathname);
  } catch {
    return null;
  }
}

function resolved(
  identity: RepositoryIdentity | null,
  source: RepositoryIdentitySource
): RepositoryIdentityResolution | null {
  return identity ? { identity, source } : null;
}

function unavailable(
  source: RepositoryIdentitySource,
  reason: string
): RepositoryIdentityResolution {
  return { identity: null, source, reason };
}

function isEnabled(value?: string): boolean {
  return value === '1' || value?.toLowerCase() === 'true';
}

/**
 * Detect repository identity without network access.
 *
 * Provider metadata wins over CI metadata, which wins over the local git
 * origin. Recognized provider context is authoritative: if its repository
 * metadata is missing or malformed, detection fails instead of falling back.
 */
export function detectRepositoryIdentity(
  readers: RepositoryIdentityReaders = {}
): RepositoryIdentityResolution {
  const env = readers.env || {};

  if (isEnabled(env.VERCEL)) {
    const identity = parseRepositorySlug(
      `${env.VERCEL_GIT_REPO_OWNER || ''}/${env.VERCEL_GIT_REPO_SLUG || ''}`
    );
    return identity
      ? { identity, source: 'vercel' }
      : unavailable('vercel', 'Vercel repository owner or slug is missing or malformed.');
  }

  if (isEnabled(env.NETLIFY)) {
    const identity = parseGitRemoteUrl(env.REPOSITORY_URL);
    return identity
      ? { identity, source: 'netlify' }
      : unavailable('netlify', 'Netlify repository URL is missing or malformed.');
  }

  if (isEnabled(env.GITHUB_ACTIONS)) {
    const identity = parseRepositorySlug(env.GITHUB_REPOSITORY);
    return identity
      ? { identity, source: 'github-actions' }
      : unavailable('github-actions', 'GitHub Actions repository metadata is missing or malformed.');
  }

  if (isEnabled(env.GITLAB_CI)) {
    const identity = parseRepositorySlug(env.CI_PROJECT_PATH);
    return identity
      ? { identity, source: 'gitlab-ci' }
      : unavailable('gitlab-ci', 'GitLab CI project path is missing or malformed.');
  }

  if (env.BITBUCKET_BUILD_NUMBER !== undefined) {
    const identity = parseRepositorySlug(env.BITBUCKET_REPO_FULL_NAME);
    return identity
      ? { identity, source: 'bitbucket-pipelines' }
      : unavailable('bitbucket-pipelines', 'Bitbucket repository metadata is missing or malformed.');
  }

  if (isEnabled(env.CI) && env.CI_REPOSITORY_URL !== undefined) {
    const identity = parseGitRemoteUrl(env.CI_REPOSITORY_URL);
    return identity
      ? { identity, source: 'ci-repository-url' }
      : unavailable('ci-repository-url', 'CI repository URL is malformed.');
  }

  let gitOrigin: string | null = null;
  try {
    gitOrigin = readers.getGitOriginUrl?.() || null;
  } catch {
    gitOrigin = null;
  }
  const localGit = resolved(parseGitRemoteUrl(gitOrigin), 'git-origin');
  if (localGit) return localGit;

  return {
    identity: null,
    source: null,
    reason: 'No supported deployment-provider, CI, or GitHub origin repository identity was available.'
  };
}

function sameRepository(a: RepositoryIdentity, b: RepositoryIdentity): boolean {
  return a.owner.toLowerCase() === b.owner.toLowerCase()
    && a.name.toLowerCase() === b.name.toLowerCase();
}

export function evaluateDeploymentReadiness(
  manifest: OwnerSetupManifest,
  resolution: RepositoryIdentityResolution
): DeploymentReadinessResult {
  const configuredRepository = manifest.configuredRepositoryOwner && manifest.configuredRepositoryName
    ? { owner: manifest.configuredRepositoryOwner, name: manifest.configuredRepositoryName }
    : null;

  if (manifest.schemaVersion !== 1) {
    return {
      ready: false,
      code: 'UNSUPPORTED_MANIFEST',
      configuredRepository,
      currentRepository: resolution.identity,
      identitySource: resolution.source
    };
  }

  if (!manifest.setupCompleted || !configuredRepository) {
    return {
      ready: false,
      code: 'SETUP_INCOMPLETE',
      configuredRepository,
      currentRepository: resolution.identity,
      identitySource: resolution.source
    };
  }

  if (!resolution.identity) {
    return {
      ready: false,
      code: 'REPOSITORY_IDENTITY_UNAVAILABLE',
      configuredRepository,
      currentRepository: null,
      identitySource: resolution.source
    };
  }

  if (!sameRepository(configuredRepository, resolution.identity)) {
    return {
      ready: false,
      code: 'REPOSITORY_MISMATCH',
      configuredRepository,
      currentRepository: resolution.identity,
      identitySource: resolution.source
    };
  }

  return {
    ready: true,
    code: 'READY',
    configuredRepository,
    currentRepository: resolution.identity,
    identitySource: resolution.source
  };
}
