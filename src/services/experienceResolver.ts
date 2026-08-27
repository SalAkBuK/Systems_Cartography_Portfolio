import {
  EvidenceProvenance,
  ExperienceNode,
  OwnerExperienceEvidence
} from '../types';
import { OWNER_PROFILE } from '../data/ownerProfile.generated';
import { OWNER_EXPERIENCE_EVIDENCE, getOwnerExperienceEvidence } from '../data/ownerExperienceEvidence';

export interface ResolveProfessionalExperienceOptions {
  importedExperience?: ExperienceNode[];
  curatedEvidence?: OwnerExperienceEvidence[];
}

/**
 * Resolves imported LinkedIn experience nodes by overlaying persistent owner-curated engineering evidence.
 * Preserves all imported employment records while enriching matching organizations with structured evidence.
 */
export function resolveProfessionalExperience(
  options: ResolveProfessionalExperienceOptions = {}
): ExperienceNode[] {
  const {
    importedExperience = OWNER_PROFILE.experience,
    curatedEvidence = OWNER_EXPERIENCE_EVIDENCE
  } = options;

  if (!importedExperience || importedExperience.length === 0) {
    return [];
  }

  // 1. Group imported nodes by progressionGroup or organization
  const progressionMap = new Map<string, ExperienceNode[]>();
  for (const node of importedExperience) {
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
  return importedExperience.map(node => {
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
