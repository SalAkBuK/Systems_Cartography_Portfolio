import {
  EvidenceProvenance,
  ExperienceNode,
  OwnerExperienceEvidence
} from '../types';
import { OWNER_PROFILE } from '../data/ownerProfile.generated';
import { OWNER_EXPERIENCE_EVIDENCE, getOwnerExperienceEvidence } from '../data/ownerExperienceEvidence';
import { getDefaultAdditionalOwnerExperience } from '../data/ownerAdditionalExperience';

export interface ResolveProfessionalExperienceOptions {
  importedExperience?: ExperienceNode[];
  additionalExperience?: ExperienceNode[];
  ownerGithubTarget?: string;
  curatedEvidence?: OwnerExperienceEvidence[];
}

/**
 * Conservative helper to extract a normalized chronology identity key from an experience node.
 * Enables coarse persistent years (e.g. '2025') to match precise month-range imported records
 * (e.g. '2025-10' -> '2025-11') within the same calendar year without fabricating dates.
 */
export function getExperienceChronologyKey(exp: ExperienceNode): string {
  // 1. Structured dates take precedence
  if (exp.endDate === null) {
    if (exp.startDate && exp.startDate.trim()) {
      const sYear = exp.startDate.trim().slice(0, 4);
      return `${sYear}:PRESENT`;
    }
    return 'PRESENT';
  }

  if (exp.startDate && exp.endDate) {
    const sYear = exp.startDate.trim().slice(0, 4);
    const eYear = exp.endDate.trim().slice(0, 4);
    return sYear === eYear ? sYear : `${sYear}:${eYear}`;
  }

  if (exp.startDate && exp.endDate === undefined) {
    return exp.startDate.trim().slice(0, 4);
  }

  // 2. Fallback to yearRange string analysis
  const range = (exp.yearRange || '').trim();
  if (!range) return '';

  const isPresent = /present|current/i.test(range);
  const years = range.match(/\b(19\d\d|20\d\d)\b/g);

  if (isPresent) {
    if (years && years.length > 0) {
      return `${years[0]}:PRESENT`;
    }
    return 'PRESENT';
  }

  if (years && years.length > 0) {
    const uniqueYears = Array.from(new Set(years));
    if (uniqueYears.length === 1) {
      return uniqueYears[0];
    }
    return `${years[0]}:${years[years.length - 1]}`;
  }

  return range.toLowerCase().trim();
}

/**
 * Pure helper to merge imported LinkedIn experience and persistent additional curated experience.
 * Preserves all imported records, appends non-duplicate additional records.
 * Duplicate key rule: exact normalized id OR (normalized organization + role + chronologyKey).
 * When a duplicate exists, imported base identity is preserved while persistent portfolio routing metadata is merged.
 */
export function mergeExperienceSources(
  importedExperience: ExperienceNode[] = [],
  additionalExperience: ExperienceNode[] = []
): ExperienceNode[] {
  const result: ExperienceNode[] = (importedExperience || []).map(exp => ({ ...exp }));

  const idToIndex = new Map<string, number>();
  const orgRoleChronoToIndex = new Map<string, number>();

  for (let i = 0; i < result.length; i++) {
    const exp = result[i];
    if (exp.id) {
      idToIndex.set(exp.id.toLowerCase().trim(), i);
    }
    const org = (exp.organization || '').toLowerCase().trim();
    const role = (exp.role || '').toLowerCase().trim();
    const chronoKey = getExperienceChronologyKey(exp);
    if (org && role && chronoKey) {
      orgRoleChronoToIndex.set(`${org}::${role}::${chronoKey}`, i);
    }
  }

  for (const additional of additionalExperience || []) {
    const idKey = additional.id ? additional.id.toLowerCase().trim() : '';
    const org = (additional.organization || '').toLowerCase().trim();
    const role = (additional.role || '').toLowerCase().trim();
    const chronoKey = getExperienceChronologyKey(additional);
    const orgRoleChronoKey = org && role && chronoKey ? `${org}::${role}::${chronoKey}` : '';

    let matchIndex = -1;
    if (idKey && idToIndex.has(idKey)) {
      matchIndex = idToIndex.get(idKey)!;
    } else if (orgRoleChronoKey && orgRoleChronoToIndex.has(orgRoleChronoKey)) {
      matchIndex = orgRoleChronoToIndex.get(orgRoleChronoKey)!;
    }

    if (matchIndex >= 0) {
      // Duplicate found: imported base identity WINS, but preserve explicit persistent routing metadata
      const importedBase = result[matchIndex];
      result[matchIndex] = {
        ...importedBase,
        progressionGroup: additional.progressionGroup ?? importedBase.progressionGroup,
        progressionOrder: additional.progressionOrder ?? importedBase.progressionOrder
      };
    } else {
      const newIndex = result.length;
      const clonedAdditional: ExperienceNode = { ...additional };
      result.push(clonedAdditional);
      if (idKey) idToIndex.set(idKey, newIndex);
      if (orgRoleChronoKey) orgRoleChronoToIndex.set(orgRoleChronoKey, newIndex);
    }
  }

  return result;
}

/**
 * Resolves professional experience nodes by combining imported LinkedIn experience with
 * persistent owner-curated additional experience, then overlaying structured engineering evidence.
 * Preserves all employment records while enriching matching organizations with structured evidence.
 */
export function resolveProfessionalExperience(
  options: ResolveProfessionalExperienceOptions = {}
): ExperienceNode[] {
  const ownerGithubTarget = options.ownerGithubTarget ?? OWNER_PROFILE.githubTarget;
  const importedExperience = options.importedExperience ?? OWNER_PROFILE.experience;
  const additionalExperience =
    options.additionalExperience !== undefined
      ? options.additionalExperience
      : getDefaultAdditionalOwnerExperience(ownerGithubTarget);
  const curatedEvidence = options.curatedEvidence ?? OWNER_EXPERIENCE_EVIDENCE;

  const combinedExperience = mergeExperienceSources(importedExperience, additionalExperience);

  if (!combinedExperience || combinedExperience.length === 0) {
    return [];
  }

  // 1. Group combined nodes by progressionGroup or organization
  const progressionMap = new Map<string, ExperienceNode[]>();
  for (const node of combinedExperience) {
    const groupKey = (node.progressionGroup || node.organization).toLowerCase().trim();
    if (!progressionMap.has(groupKey)) {
      progressionMap.set(groupKey, []);
    }
    progressionMap.get(groupKey)!.push(node);
  }

  // Sort progression groups so that highest progressionOrder / latest date comes first
  for (const [, groupNodes] of progressionMap.entries()) {
    groupNodes.sort((a, b) => {
      const orderA = a.progressionOrder ?? 0;
      const orderB = b.progressionOrder ?? 0;
      if (orderA !== orderB) return orderB - orderA;
      const dateA = a.startDate || a.yearRange;
      const dateB = b.startDate || b.yearRange;
      return dateB.localeCompare(dateA);
    });
  }

  // 2. Resolve each node with matching curated evidence
  return combinedExperience.map(node => {
    const groupKey = (node.progressionGroup || node.organization).toLowerCase().trim();
    const groupNodes = progressionMap.get(groupKey) || [node];
    const isPrimaryInGroup = groupNodes[0]?.id === node.id;

    // Match curated evidence by progressionGroup, organization, or id
    const evidence =
      (curatedEvidence || []).find(e => {
        const target = e.organizationId.toLowerCase().trim();
        const nameTarget = (e.organizationName || '').toLowerCase().trim();
        return (
          target === groupKey ||
          target === node.organization.toLowerCase().trim() ||
          (nameTarget && nameTarget === node.organization.toLowerCase().trim())
        );
      }) || getOwnerExperienceEvidence(groupKey);

    // Only attach deep platform / architecture evidence to the primary node in a progression group,
    // or to standalone organization nodes (to prevent duplicate platform listings)
    const architectedDetails = isPrimaryInGroup ? evidence?.architectedSystems || [] : [];
    const systemsDelivered = isPrimaryInGroup ? evidence?.systemsDelivered || [] : [];
    const engineeringContributions = isPrimaryInGroup ? evidence?.engineeringContributions || [] : [];
    const infrastructureOperations = isPrimaryInGroup ? evidence?.infrastructureOperations || [] : [];
    const evidenceLinks = isPrimaryInGroup ? evidence?.evidenceLinks || [] : [];

    // Merge technologies without duplicates
    const techSet = new Set<string>();
    (node.technologies || []).forEach(t => techSet.add(t));
    if (isPrimaryInGroup) {
      (evidence?.technologies || []).forEach(t => techSet.add(t));
      architectedDetails.forEach(a => (a.technologies || []).forEach(t => techSet.add(t)));
      systemsDelivered.forEach(d => (d.technologies || []).forEach(t => techSet.add(t)));
    }

    const systemsArchitectedNames =
      node.systemsArchitected && node.systemsArchitected.length > 0
        ? node.systemsArchitected
        : architectedDetails.map(a => a.name);

    return {
      ...node,
      provenance: node.provenance || (evidence?.provenance as EvidenceProvenance) || 'CURATED',
      systemsArchitected: systemsArchitectedNames,
      architectedSystemsDetails: architectedDetails,
      systemsDelivered,
      engineeringContributions,
      infrastructureOperations,
      evidenceLinks,
      technologies: Array.from(techSet),
      progressionRoles: groupNodes.length > 1 && isPrimaryInGroup ? groupNodes : undefined
    };
  });
}
