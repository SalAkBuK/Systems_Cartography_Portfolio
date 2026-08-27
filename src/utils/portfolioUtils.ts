import { ExperienceNode, EvidenceProvenance, SystemCategory } from '../types';
import { getCanonicalRepositoryKey } from '../data/repositoryEvidence';

/**
 * Resolves professional experience with clean source precedence and provenance tracking.
 * Precedence: Configured professional employment history (CURATED) always wins when present.
 * GitHub-derived snapshot experience (DERIVED) is only used as a fallback when configured is absent.
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
    return configuredList;
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

const MONTH_ABBRS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export function formatIsoYearMonth(ym: string | null): string {
  if (!ym) return 'PRESENT';
  const parts = ym.split('-');
  if (parts.length >= 2) {
    const year = parts[0];
    const monthIdx = parseInt(parts[1], 10) - 1;
    if (monthIdx >= 0 && monthIdx < 12) {
      return `${MONTH_ABBRS[monthIdx]} ${year}`;
    }
  }
  return ym.toUpperCase();
}

export function computeGroupedTenure(groupNodes: ExperienceNode[], fallbackYearRange: string): string {
  const formattedFallback = fallbackYearRange.toUpperCase().replace(' - ', ' → ');
  const startDates = groupNodes.map(n => n.startDate).filter((d): d is string => Boolean(d));
  const endDates = groupNodes.map(n => n.endDate);

  if (startDates.length === 0) {
    return formattedFallback;
  }

  const earliestStart = [...startDates].sort()[0];
  const isCurrent = endDates.some(d => d === null);

  if (isCurrent) {
    return `${formatIsoYearMonth(earliestStart)} → PRESENT`;
  }

  const validEndDates = endDates.filter((d): d is string => typeof d === 'string' && d.trim().length > 0);
  if (validEndDates.length > 0) {
    const latestEnd = [...validEndDates].sort().reverse()[0];
    return `${formatIsoYearMonth(earliestStart)} → ${formatIsoYearMonth(latestEnd)}`;
  }

  return formattedFallback;
}

export interface GroupedExperienceEntry extends ExperienceNode {
  groupedRoleIds: string[];
  roleCount: number;
  isPromoted: boolean;
  promotionNote?: string;
  organizationTenure: string;
  linkedSystemsCount: number;
}

/**
 * Pure helper grouping experience nodes by progression group / organization.
 * Used by both TopologyCanvas (Experience Dock) and RightInspectorPanel (Experience Index).
 */
export function groupExperienceByProgression(experience: ExperienceNode[]): GroupedExperienceEntry[] {
  const groups: Record<string, ExperienceNode[]> = {};
  const order: string[] = [];

  for (const exp of experience) {
    const groupKey = (exp.progressionGroup || exp.organization || '').trim().toLowerCase();
    if (!groups[groupKey]) {
      groups[groupKey] = [];
      order.push(groupKey);
    }
    groups[groupKey].push(exp);
  }

  return order.map(groupKey => {
    const groupNodes = groups[groupKey];
    // Find primary or latest role in progression group (with progressionRoles or highest progressionOrder)
    const primaryNode = groupNodes.find(n => n.progressionRoles && n.progressionRoles.length > 0)
      || [...groupNodes].sort((a, b) => (b.progressionOrder || 0) - (a.progressionOrder || 0))[0]
      || groupNodes[0];
    const hasPromotion = groupNodes.some(n => Boolean(n.promotionNote));
    const promotionNote = groupNodes.find(n => n.promotionNote)?.promotionNote;
    const organizationTenure = computeGroupedTenure(groupNodes, primaryNode.yearRange);
    const linkedSystemsCount = primaryNode.systemsDelivered?.length || 0;

    return {
      ...primaryNode,
      promotionNote: primaryNode.promotionNote || (hasPromotion ? (promotionNote || 'PROMOTED') : undefined),
      isPromoted: hasPromotion || Boolean(primaryNode.promotionNote),
      groupedRoleIds: groupNodes.map(n => n.id),
      roleCount: groupNodes.length,
      organizationTenure,
      linkedSystemsCount
    };
  });
}
