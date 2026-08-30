export const OWNER_SETUP_SCHEMA_VERSION = 1 as const;

export interface RepositoryIdentity {
  owner: string;
  name: string;
}

export interface OwnerSetupManifest {
  schemaVersion: typeof OWNER_SETUP_SCHEMA_VERSION;
  setupCompleted: boolean;
  configuredRepositoryOwner: string;
  configuredRepositoryName: string;
  portfolioGithubOwner: string;
}

export function createOwnerSetupManifest(
  repository: RepositoryIdentity,
  portfolioGithubOwner: string
): OwnerSetupManifest {
  return {
    schemaVersion: OWNER_SETUP_SCHEMA_VERSION,
    setupCompleted: true,
    configuredRepositoryOwner: repository.owner,
    configuredRepositoryName: repository.name,
    portfolioGithubOwner
  };
}
