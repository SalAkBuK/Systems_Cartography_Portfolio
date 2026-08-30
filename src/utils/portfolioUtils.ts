import { ExperienceNode, EvidenceProvenance, SystemCategory, GitHubSnapshotMetadata, ProjectData } from '../types';
import { getCanonicalRepositoryKey } from '../data/repositoryEvidence';
import type { GitHubSyncResult } from '../services/githubService';
import { parseGitHubTarget, normalizeGitHubTarget, getGithubOwnerIdentity } from './ownerScope';

/**
 * GitHub target parsing/normalization now lives in the centralized
 * src/utils/ownerScope.ts owner-scope utility. Re-exported here so existing
 * call sites (and their `../utils/portfolioUtils` imports) keep working
 * unchanged.
 */
export type { ParsedGitHubTarget } from './ownerScope';
export { parseGitHubTarget, normalizeGitHubTarget };

/**
 * Owner-scopes the generated GitHub snapshot.
 * Returns the snapshot if the configured target matches the snapshot metadata target,
 * otherwise returns null to prevent data leakage in forks.
 */
export function resolveGitHubSnapshotForTarget(
  configuredTarget: string,
  metadata?: GitHubSnapshotMetadata | null,
  snapshot?: GitHubSyncResult | null
): GitHubSyncResult | null {
  if (!configuredTarget || !metadata || !snapshot) {
    return null;
  }

  const normalizedConfigured = normalizeGitHubTarget(configuredTarget);
  const normalizedSnapshot = normalizeGitHubTarget(metadata.githubTarget || metadata.sourceIdentifier);

  if (normalizedConfigured && normalizedSnapshot && normalizedConfigured === normalizedSnapshot) {
    return snapshot;
  }

  return null;
}

/**
 * Resolves professional experience with clean source precedence and provenance tracking.
 * Precedence: Configured professional employment history (CURATED) always wins when provided,
 * including an explicit empty array for an owner with no professional roles.
 * GitHub-derived snapshot experience (DERIVED) is only used when configured is undefined.
 */
export function resolveExperience(
  configured?: ExperienceNode[],
  gitHubDerived?: ExperienceNode[]
): ExperienceNode[] {
  const configuredList = (configured || []).map(exp => ({
    ...exp,
    provenance: exp.provenance || ('CURATED' as EvidenceProvenance)
  }));

  if (configured !== undefined) {
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
 * Minimal project identity shape accepted by `isProjectLinkedToExperience`.
 * `links.github` is optional and, when present, is used to derive the
 * project's ACTUAL GitHub owner for owner-scoped canonical alias resolution.
 */
export interface ProjectLinkIdentity {
  id: string;
  title: string;
  links?: { github?: string };
}

/**
 * Determine if a ProjectData node is linked to an ExperienceNode using generic evidence links and alias resolution.
 *
 * Owner scope: canonical repository-alias matching (e.g. "towerdesk-backend-clean"
 * resolving to "towerdesk-backend") is owner-curated data. It is only applied
 * when the PROJECT's own actual GitHub owner (derived from `project.links.github`
 * via `getGithubOwnerIdentity`) matches the declared source owner of that
 * alias table. Exact id/title matches always work regardless of owner. When
 * the project's owner cannot be determined (no `links.github`), canonical
 * aliasing is disabled and only exact matching applies -- this fails closed
 * rather than assuming the current curated source owner.
 */
export function isProjectLinkedToExperience(
  project: ProjectLinkIdentity,
  exp: ExperienceNode
): boolean {
  const linkedIds = getLinkedProjectIdsForExperience(exp);
  const projId = project.id.toLowerCase().trim();
  const projTitle = project.title.toLowerCase().trim();

  if (linkedIds.has(projId) || linkedIds.has(projTitle)) {
    return true;
  }

  const projectOwner = getGithubOwnerIdentity(project.links?.github);
  if (!projectOwner) {
    // Unknown project owner: fail closed. Exact matching above already ran;
    // canonical/alias matching never activates without a known owner.
    return false;
  }

  const canonicalTitle = getCanonicalRepositoryKey(projTitle, projectOwner);
  if (linkedIds.has(canonicalTitle)) {
    return true;
  }

  for (const linkedId of linkedIds) {
    if (getCanonicalRepositoryKey(linkedId, projectOwner) === canonicalTitle) {
      return true;
    }
  }

  return false;
}

/**
 * Resolves a ProjectData object from a professional evidence key (e.g. 'worthy-crm', 'towerdesk-backend', 'towerdesk-backend-clean').
 * Resolution hierarchy:
 * 1. Exact match on ProjectData.id (case-insensitive)
 * 2. Exact match on ProjectData.title / repository name (case-insensitive)
 * 3. Canonical cluster mapping via getCanonicalRepositoryKey (case-insensitive)
 *
 * Owner scope: canonical alias matching (step 3) is evaluated PER CANDIDATE
 * project, using that candidate's own actual GitHub owner (derived from
 * `project.links.github`). There is no global/current-owner assumption --
 * a foreign project never gets canonical-aliased just because another
 * project in the same array happens to belong to the curated source owner.
 * A candidate whose owner cannot be determined is skipped for alias
 * matching (fails closed); exact id/title matching is unaffected.
 *
 * Returns ProjectData or null (no fuzzy guessing).
 */
export function resolveProjectFromEvidenceKey(
  projects: ProjectData[],
  evidenceKey?: string | null
): ProjectData | null {
  if (!evidenceKey || typeof evidenceKey !== 'string' || !Array.isArray(projects) || projects.length === 0) {
    return null;
  }

  const target = evidenceKey.toLowerCase().trim();
  if (!target) return null;

  // 1. Direct match on ProjectData.id
  const directIdMatch = projects.find(p => p.id.toLowerCase().trim() === target);
  if (directIdMatch) return directIdMatch;

  // 2. Exact match on ProjectData.title (repository name)
  const exactTitleMatch = projects.find(p => p.title.toLowerCase().trim() === target);
  if (exactTitleMatch) return exactTitleMatch;

  // 3. Canonical repository alias resolution, per candidate's own owner.
  const canonicalMatch = projects.find(p => {
    const projectOwner = getGithubOwnerIdentity(p.links?.github);
    if (!projectOwner) return false;

    const canonicalTarget = getCanonicalRepositoryKey(target, projectOwner);
    const pTitleCanonical = getCanonicalRepositoryKey(p.title.toLowerCase().trim(), projectOwner);
    const pIdCanonical = getCanonicalRepositoryKey(p.id.toLowerCase().trim(), projectOwner);
    return pTitleCanonical === canonicalTarget || pIdCanonical === canonicalTarget;
  });
  if (canonicalMatch) return canonicalMatch;

  return null;
}

/**
 * Convenience helper returning the actual ProjectData.id or null.
 */
export function resolveProjectIdFromEvidenceKey(
  projects: ProjectData[],
  evidenceKey?: string | null
): string | null {
  return resolveProjectFromEvidenceKey(projects, evidenceKey)?.id || null;
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
 * Used by RightInspectorPanel (Experience Index & Career History views).
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

/**
 * Pure helper to clone and apply deployment/demo links from local configuration to projects.
 * Preserves the underlying GitHub snapshot and fallback repository homepage.
 */
export function applyProjectLinkOverrides(
  projects: ProjectData[],
  projectLinks: Record<string, string> = {}
): ProjectData[] {
  return projects.map(p => {
    const overriddenDemo = resolveDeploymentLink(p.title, p.links.demo, projectLinks);
    return {
      ...p,
      links: {
        ...p.links,
        demo: overriddenDemo
      }
    };
  });
}

/**
 * Pure resolver for owner-curated flagship projects.
 * - When `flagshipIds` is explicitly provided and non-empty:
 *   - Respects the exact ordering of `flagshipIds`
 *   - Safely ignores unknown, missing, or empty IDs
 *   - Never returns duplicate projects
 *   - Caps results at `limit` (default: 4)
 *   - Does NOT backfill with unconfigured projects
 * - Fallback: When `flagshipIds` is absent or empty, defaults to the first `limit` active projects.
 */
export function resolveFlagshipProjects(
  projects: ProjectData[],
  flagshipIds?: string[],
  limit: number = 4
): ProjectData[] {
  if (!Array.isArray(projects) || projects.length === 0) {
    return [];
  }

  const effectiveLimit = Math.max(1, limit);

  // If flagshipIds is explicitly provided and non-empty, resolve strictly against configured IDs
  if (Array.isArray(flagshipIds) && flagshipIds.length > 0) {
    const projectMap = new Map<string, ProjectData>();
    for (const p of projects) {
      if (p && p.id) {
        projectMap.set(p.id.toLowerCase().trim(), p);
      }
    }

    const result: ProjectData[] = [];
    const addedIds = new Set<string>();

    for (const rawId of flagshipIds) {
      if (result.length >= effectiveLimit) break;
      if (!rawId || typeof rawId !== 'string') continue;
      const normalizedId = rawId.toLowerCase().trim();
      const match = projectMap.get(normalizedId);
      if (match && !addedIds.has(match.id.toLowerCase().trim())) {
        result.push(match);
        addedIds.add(match.id.toLowerCase().trim());
      }
    }

    return result;
  }

  // Fallback: when configuration is absent or empty, return the first `limit` active projects
  return projects.slice(0, effectiveLimit);
}

