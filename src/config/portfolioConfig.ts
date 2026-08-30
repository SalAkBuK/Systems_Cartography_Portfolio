import { ExperienceNode, OperatorMetadata } from '../types';
import { OWNER_PROFILE } from '../data/ownerProfile.generated';
import { resolveProfessionalExperience } from '../services/experienceResolver';
import { OWNER_PORTFOLIO_PREFERENCES } from './ownerPreferences';

const githubTarget = OWNER_PROFILE.githubTarget.replace(/\/$/, '');
const githubUsername = githubTarget.split('/').filter(Boolean).pop() || 'owner';
const ownerName = OWNER_PROFILE.operator.name || 'Portfolio Owner';
const ownerRole = OWNER_PROFILE.operator.role || 'Software Developer';
const siteOwnerId = ownerName
  .toUpperCase()
  .replace(/[^A-Z0-9]+/g, '.')
  .replace(/^\.+|\.+$/g, '') || 'OWNER';

/**
 * Fork owners normally run `npm run setup -- <linkedin-profile.pdf>` once.
 * That command generates ownerProfile.generated.ts and infers githubTarget from
 * the fork's git remote. Manual edits here are only needed for optional overrides.
 */
export const PORTFOLIO_CONFIG: {
  siteId: string;
  pageTitle: string;
  metaDescription: string;
  githubTarget: string;
  templateRepositoryUrl: string;
  contactFormEndpoint: string;
  operator: OperatorMetadata;
  projectLinks?: Record<string, string>;
  flagshipProjectIds?: string[];
  experience?: ExperienceNode[];
} = {
  siteId: `${siteOwnerId}.SYSTEMS.PORTFOLIO`,
  pageTitle: `${ownerName} // Systems Cartography`,
  metaDescription: `Public GitHub systems portfolio of ${ownerRole} ${ownerName}.`,
  githubTarget,
  templateRepositoryUrl: 'https://github.com/SalAkBuK/Systems_Cartography_Portfolio',
  contactFormEndpoint: (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_CONTACT_FORM_ENDPOINT?.trim() || '',
  operator: {
    name: ownerName,
    handle: `@${githubUsername}`,
    role: ownerRole,
    location: OWNER_PROFILE.operator.location,
    status: 'OWNER CURATED // AVAILABLE BY INQUIRY',
    focus: OWNER_PROFILE.operator.focus,
    yearsActive: 0,
    commitsIndexed: 'Not indexed',
    productionUptime: 'Not claimed',
    primaryStack: [...OWNER_PROFILE.operator.primaryStack],
    systemManifesto: OWNER_PROFILE.operator.systemManifesto,
    contact: {
      email: OWNER_PROFILE.operator.contact.email,
      github: githubTarget,
      linkedin: OWNER_PROFILE.operator.contact.linkedin,
      pgpKeyId: '',
      pgpFingerprint: '',
      matrix: '',
      availability: 'Contact for current availability'
    }
  },
  projectLinks: {
    // Optional manual override. GitHub repository Website/Homepage remains the fallback.
  },
  flagshipProjectIds: OWNER_PORTFOLIO_PREFERENCES.flagshipProjectIds,
  experience: resolveProfessionalExperience({ importedExperience: OWNER_PROFILE.experience })
};
