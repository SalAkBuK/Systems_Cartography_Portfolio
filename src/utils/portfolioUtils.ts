import { ExperienceNode, EvidenceProvenance, SystemCategory } from '../types';
import { getCanonicalRepositoryKey } from '../data/repositoryEvidence';

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

/**
 * Matches a project against an active filter category, checking both primary category and classifications.
 */
export function matchesProjectClassification(
  project: { category: SystemCategory; classifications?: SystemCategory[] },
  selectedCategory: SystemCategory | 'all'
): boolean {
  if (selectedCategory === 'all') return true;
  if (project.category === selectedCategory) return true;
  if (Array.isArray(project.classifications) && project.classifications.includes(selectedCategory)) {
    return true;
  }
  return false;
}

/**
 * Extract all linked project IDs / repository names from an ExperienceNode.
 */
export function getLinkedProjectIdsForExperience(exp: ExperienceNode): Set<string> {
  const ids = new Set<string>();

  (exp.systemsDelivered || []).forEach(sys => {
    (sys.linkedProjectIds || []).forEach(id => ids.add(id.toLowerCase().trim()));
    (sys.surfaces || []).forEach(surface => {
      if (surface.linkedProjectId) ids.add(surface.linkedProjectId.toLowerCase().trim());
    });
  });

  (exp.architectedSystemsDetails || []).forEach(arch => {
    if (arch.linkedProjectId) ids.add(arch.linkedProjectId.toLowerCase().trim());
  });

  (exp.evidenceLinks || []).forEach(link => {
    if (link.projectId) ids.add(link.projectId.toLowerCase().trim());
  });

  return ids;
}

/**
 * Determine if a ProjectData node is linked to an ExperienceNode using generic evidence links and alias resolution.
 */
export function isProjectLinkedToExperience(
  project: { id: string; title: string },
  exp: ExperienceNode
): boolean {
  const linkedIds = getLinkedProjectIdsForExperience(exp);
  const projId = project.id.toLowerCase().trim();
  const projTitle = project.title.toLowerCase().trim();
  const canonicalTitle = getCanonicalRepositoryKey(projTitle);

  if (linkedIds.has(projId) || linkedIds.has(projTitle) || linkedIds.has(canonicalTitle)) {
    return true;
  }

  for (const linkedId of linkedIds) {
    if (getCanonicalRepositoryKey(linkedId) === canonicalTitle) {
      return true;
    }
  }

  return false;
}

