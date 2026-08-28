import { ExperienceNode } from '../types';

/**
 * Expected owner GitHub target for this curated additional experience source.
 */
export const ADDITIONAL_OWNER_EXPERIENCE_OWNER_GITHUB_TARGET = 'https://github.com/SalAkBuK';

/**
 * PERSISTENT OWNER-CURATED ADDITIONAL PROFESSIONAL EXPERIENCE.
 *
 * Source Boundary Architecture:
 * - ownerProfile.generated.ts: generated LinkedIn identity/history (may be overwritten by setup/import)
 * - ownerAdditionalExperience.ts: persistent manually curated additional professional history (must survive LinkedIn re-import)
 * - ownerExperienceEvidence.ts: persistent structured engineering evidence
 */
export const ADDITIONAL_OWNER_EXPERIENCE: ExperienceNode[] = [
  {
    id: 'exp-freelance-aok-health-solutions',
    code: 'EXP-FL-01',
    organization: 'Independent / Freelance',
    role: 'Freelance Web Developer',
    yearRange: '2025',
    location: 'Client Engagement',
    systemDomain: 'Client Web Delivery',
    keyOutputs: [
      'Built and delivered the AOK Health Solutions client website.',
      'Hosted the delivered client site on Hostinger.'
    ],
    systemsArchitected: [],
    technologies: [
      'Next.js',
      'React',
      'TypeScript',
      'Tailwind CSS',
      'Nodemailer'
    ],
    gridPosition: { x: 280, y: -40 },
    provenance: 'CURATED',
    progressionGroup: 'salakbuk-independent-freelance',
    progressionOrder: 1
  }
];

function normalizeGithubTarget(url?: string): string {
  if (!url) return '';
  return url
    .trim()
    .toLowerCase()
    .replace(/\/+$/, '')
    .replace(/^https?:\/\/(www\.)?/, '');
}

/**
 * Pure helper returning default additional owner experience only when the configured owner
 * GitHub target matches the curated source owner target.
 */
export function getDefaultAdditionalOwnerExperience(githubTarget?: string): ExperienceNode[] {
  const normalizedTarget = normalizeGithubTarget(githubTarget);
  const normalizedOwner = normalizeGithubTarget(ADDITIONAL_OWNER_EXPERIENCE_OWNER_GITHUB_TARGET);

  if (normalizedTarget && normalizedOwner && normalizedTarget === normalizedOwner) {
    return ADDITIONAL_OWNER_EXPERIENCE;
  }

  return [];
}

