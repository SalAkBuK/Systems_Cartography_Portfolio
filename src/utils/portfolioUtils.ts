import { ExperienceNode, EvidenceProvenance, SystemCategory, GitHubSnapshotMetadata, ProjectData } from '../types';
import { getCanonicalRepositoryKey } from '../data/repositoryEvidence';
import type { GitHubSyncResult } from '../services/githubService';

export interface ParsedGitHubTarget {
  type: 'user' | 'repo';
  owner: string;
  repo?: string;
  canonicalIdentifier: string;
}

/**
 * Deterministically parses a GitHub target (URL, shorthand, or handle).
 * Rejects invalid protocols, unrelated hosts, and query/hash injections.
 */
export function parseGitHubTarget(input?: string | null): ParsedGitHubTarget {
  if (!input || typeof input !== 'string') {
    throw new Error('Please enter a GitHub username, org, or repository link.');
  }

  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('Please enter a GitHub username, org, or repository link.');
  }

  let path = trimmed;

  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//i.test(trimmed)) {
    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      throw new Error(`Invalid URL format: "${trimmed}".`);
    }

    const host = url.hostname.toLowerCase();
    if (host !== 'github.com' && host !== 'www.github.com') {
      throw new Error(`Invalid GitHub host "${url.hostname}". Expected "github.com".`);
    }

    path = url.pathname;
  } else if (/^(www\.)?github\.com(\/|$)/i.test(trimmed)) {
    path = trimmed.replace(/^(www\.)?github\.com\/?/i, '');
    const qIdx = path.search(/[?#]/);
    if (qIdx >= 0) path = path.slice(0, qIdx);
  } else {
    // If shorthand target contains URL scheme or query/hash or hostile chars
    if (path.includes('://') || path.includes('?') || path.includes('#')) {
      throw new Error(`Invalid GitHub target: "${trimmed}".`);
    }
  }

  const segments = path
    .split('/')
    .map(s => s.trim().replace(/^@/, ''))
    .filter(Boolean);

  if (segments.length === 0) {
    throw new Error(`Invalid GitHub target: "${trimmed}". Expected a username or repository.`);
  }

  const validSegmentRegex = /^[a-zA-Z0-9_.-]+$/;
  for (const seg of segments) {
    if (!validSegmentRegex.test(seg)) {
      throw new Error(`Invalid GitHub identifier segment: "${seg}".`);
    }
  }

  if (segments.length === 1) {
    const owner = segments[0];
    return {
      type: 'user',
      owner,
      canonicalIdentifier: owner.toLowerCase()
    };
  }

  const owner = segments[0];
  const repo = segments[1].replace(/\.git$/i, '');
  return {
    type: 'repo',
    owner,
    repo,
    canonicalIdentifier: `${owner.toLowerCase()}/${repo.toLowerCase()}`
  };
}

/**
 * Normalizes a GitHub target string (URL, handle, or path) to a canonical lowercased identity.
 * e.g. "https://github.com/SalAkBuK/" -> "salakbuk"
 *      "github.com/SalAkBuK" -> "salakbuk"
 *      "SalAkBuK" -> "salakbuk"
 */
export function normalizeGitHubTarget(target?: string | null): string {
  if (!target || typeof target !== 'string' || !target.trim()) return '';
  try {
    const parsed = parseGitHubTarget(target);
    return parsed.canonicalIdentifier;
  } catch {
    return '';
  }
}

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

/**
 * Resolves a ProjectData object from a professional evidence key (e.g. 'worthy-crm', 'towerdesk-backend', 'towerdesk-backend-clean').
 * Resolution hierarchy:
 * 1. Exact match on ProjectData.id (case-insensitive)
 * 2. Exact match on ProjectData.title / repository name (case-insensitive)
 * 3. Canonical cluster mapping via getCanonicalRepositoryKey (case-insensitive)
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

  // 3. Canonical repository alias resolution
  const canonicalTarget = getCanonicalRepositoryKey(target);
  const canonicalMatch = projects.find(p => {
    const pTitleCanonical = getCanonicalRepositoryKey(p.title.toLowerCase().trim());
    const pIdCanonical = getCanonicalRepositoryKey(p.id.toLowerCase().trim());
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

