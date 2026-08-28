import {
  EvidenceProvenance,
  ExperienceNode,
  OwnerExperienceEvidence
} from '../types';
import { OWNER_PROFILE } from '../data/ownerProfile.generated';
import { OWNER_EXPERIENCE_EVIDENCE, getOwnerExperienceEvidence } from '../data/ownerExperienceEvidence';
import { ADDITIONAL_OWNER_EXPERIENCE } from '../data/ownerAdditionalExperience';

export interface ResolveProfessionalExperienceOptions {
  importedExperience?: ExperienceNode[];
  additionalExperience?: ExperienceNode[];
  curatedEvidence?: OwnerExperienceEvidence[];
}

/**
 * Pure helper to merge imported LinkedIn experience and persistent additional curated experience.
 * Preserves all imported records, appends non-duplicate additional records.
 * Duplicate key rule: exact normalized id OR (normalized organization + role + yearRange).
 * When a duplicate exists, imported base identity is preserved.
 */
export function mergeExperienceSources(
  importedExperience: ExperienceNode[] = [],
  additionalExperience: ExperienceNode[] = []
): ExperienceNode[] {
  const result: ExperienceNode[] = [...(importedExperience || [])];
  
  const existingIds = new Set<string>();
  const existingOrgRoleYears = new Set<string>();

  for (const exp of result) {
    if (exp.id) {
      existingIds.add(exp.id.toLowerCase().trim());
    }
    const org = (exp.organization || '').toLowerCase().trim();
    const role = (exp.role || '').toLowerCase().trim();
    const year = (exp.yearRange || '').toLowerCase().trim();
    if (org && role && year) {
      existingOrgRoleYears.add(`${org}::${role}::${year}`);
    }
  }

  for (const exp of additionalExperience || []) {
    const idKey = exp.id ? exp.id.toLowerCase().trim() : '';
    const org = (exp.organization || '').toLowerCase().trim();
    const role = (exp.role || '').toLowerCase().trim();
    const year = (exp.yearRange || '').toLowerCase().trim();
    const orgRoleYearKey = org && role && year ? `${org}::${role}::${year}` : '';

    const isDuplicate =
      (idKey && existingIds.has(idKey)) ||
      (orgRoleYearKey && existingOrgRoleYears.has(orgRoleYearKey));

    if (!isDuplicate) {
      result.push(exp);
      if (idKey) existingIds.add(idKey);
      if (orgRoleYearKey) existingOrgRoleYears.add(orgRoleYearKey);
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
  const {
    importedExperience = OWNER_PROFILE.experience,
    additionalExperience = ADDITIONAL_OWNER_EXPERIENCE,
    curatedEvidence = OWNER_EXPERIENCE_EVIDENCE
  } = options;

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
