import { getGithubOwnerIdentity } from './ownerScope';
import type { GeneratedOwnerProfile } from '../types';

export type OwnerIdentityMatchStatus = 'MATCH' | 'MISMATCH' | 'UNKNOWN';

export interface OwnerIdentityMatchResult {
  status: OwnerIdentityMatchStatus;
  profileIdentity: string | null;
  targetIdentity: string | null;
  reasons: string[];
}

/**
 * Pure helper evaluating whether the imported operator profile and
 * the selected GitHub target represent the same owner identity.
 */
export function evaluateOwnerIdentityMatch(params: {
  ownerProfile?: Partial<GeneratedOwnerProfile> | null;
  githubTarget?: string | null;
}): OwnerIdentityMatchResult {
  const profileRawTarget = params.ownerProfile?.githubTarget || '';
  const profileIdentity = getGithubOwnerIdentity(profileRawTarget) || null;

  const targetRaw = params.githubTarget || '';
  const targetIdentity = getGithubOwnerIdentity(targetRaw) || null;

  // 1. If profile has no GitHub target -> UNKNOWN
  if (!profileIdentity) {
    return {
      status: 'UNKNOWN',
      profileIdentity: null,
      targetIdentity,
      reasons: [
        'No GitHub profile link was associated with the imported operator profile. Identity match cannot be verified.'
      ]
    };
  }

  // 2. If no target has been selected -> UNKNOWN
  if (!targetIdentity) {
    return {
      status: 'UNKNOWN',
      profileIdentity,
      targetIdentity: null,
      reasons: [
        'No confirmed GitHub repository target has been selected yet.'
      ]
    };
  }

  // 3. Compare normalized identities
  if (profileIdentity.toLowerCase() === targetIdentity.toLowerCase()) {
    return {
      status: 'MATCH',
      profileIdentity,
      targetIdentity,
      reasons: [
        `Profile GitHub identity (@${profileIdentity}) matches confirmed GitHub repository target (@${targetIdentity}).`
      ]
    };
  }

  // 4. Identity mismatch
  return {
    status: 'MISMATCH',
    profileIdentity,
    targetIdentity,
    reasons: [
      `Profile GitHub identity (@${profileIdentity}) does not match selected GitHub target (@${targetIdentity}). These appear to belong to different owners.`
    ]
  };
}
