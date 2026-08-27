import { ExperienceNode, EvidenceProvenance } from '../types';

/**
 * Resolves professional experience with deterministic merge and provenance tracking.
 * Precedence: PORTFOLIO_CONFIG.experience -> GitHub/project-derived experience when curated is absent.
 * If both sources are retained, merges deterministically without duplicates and preserves owner curation.
 */
export function resolveExperience(
  configured?: ExperienceNode[],
  gitHubDerived?: ExperienceNode[]
): ExperienceNode[] {
  const configuredList = (configured || []).map(exp => ({
    ...exp,
    provenance: exp.provenance || ('CURATED' as EvidenceProvenance)
  }));

  if (configuredList.length > 0) {
    const existingIds = new Set(configuredList.map(e => e.id.toLowerCase().trim()));
    const existingRoleOrgs = new Set(
      configuredList.map(e => `${e.role.toLowerCase().trim()}::${e.organization.toLowerCase().trim()}`)
    );

    const nonDuplicateDerived = (gitHubDerived || [])
      .filter(e => {
        const idMatch = existingIds.has(e.id.toLowerCase().trim());
        const roleOrgMatch = existingRoleOrgs.has(
          `${e.role.toLowerCase().trim()}::${e.organization.toLowerCase().trim()}`
        );
        return !idMatch && !roleOrgMatch;
      })
      .map(e => ({
        ...e,
        provenance: e.provenance || ('DERIVED' as EvidenceProvenance)
      }));

    return [...configuredList, ...nonDuplicateDerived];
  }

  return (gitHubDerived || []).map(e => ({
    ...e,
    provenance: e.provenance || ('DERIVED' as EvidenceProvenance)
  }));
}

/**
 * Resolves repository deployment URL with case-insensitive matching against projectLinks config.
 * Precedence: manual projectLinks override -> GitHub repository homepage -> undefined
 */
export function resolveDeploymentLink(
  repoName: string,
  homepage?: string | null,
  projectLinks?: Record<string, string>
): string | undefined {
  if (projectLinks && typeof projectLinks === 'object') {
    const target = (repoName || '').trim().toLowerCase();
    for (const [key, url] of Object.entries(projectLinks)) {
      if (key.trim().toLowerCase() === target && typeof url === 'string' && url.trim().length > 0) {
        return url.trim();
      }
    }
  }

  if (homepage && typeof homepage === 'string' && homepage.trim().length > 0) {
    return homepage.trim();
  }

  return undefined;
}
