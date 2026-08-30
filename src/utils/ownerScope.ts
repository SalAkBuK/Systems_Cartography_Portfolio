/**
 * CENTRALIZED OWNER-SCOPE UTILITY.
 *
 * Systems Cartography lets a fork owner configure their own GitHub target
 * (`PORTFOLIO_CONFIG.githubTarget`, normally inferred from LinkedIn import /
 * git remote during `npm run setup`). Several persistent data sources are
 * PERSISTENT OWNER-CURATED DATA that ships in source control for the current
 * repository owner:
 *
 *   - src/data/ownerAdditionalExperience.ts
 *   - src/data/ownerExperienceEvidence.ts
 *   - src/data/repositoryEvidence.ts
 *
 * Generic engine services (the experience resolver, the repository analyzer,
 * the GitHub sync pipeline) must apply that curated data ONLY when its
 * declared source-owner GitHub target matches the configured/observed owner
 * for the data currently being processed. Otherwise a fork configured for a
 * different owner could silently inherit another owner's professional
 * evidence or repository architecture notes -- including through repository
 * NAME collisions (two different owners both having a repo named
 * `towerdesk-backend`) or organization NAME collisions (a fork owner who
 * also worked at a company literally named "CodeFier").
 *
 * This module is the ONE place that parses, normalizes, and compares GitHub
 * owner identities. Do not reimplement lowercase/strip-slash GitHub target
 * comparison logic elsewhere -- import from here instead.
 *
 * This is owner IDENTITY scoping only. It is intentionally not an
 * authentication system.
 */

export interface ParsedGitHubTarget {
  type: 'user' | 'repo';
  owner: string;
  repo?: string;
  canonicalIdentifier: string;
}

/**
 * Deterministically parses a GitHub target (URL, shorthand, or handle).
 * Rejects invalid protocols, unrelated hosts, and query/hash injections.
 *
 * Accepts equivalent forms consistently, e.g.:
 *   https://github.com/Example
 *   https://github.com/example/
 *   github.com/example
 *   https://www.github.com/example
 *   @example
 *   example
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
 * Normalizes a GitHub target string (URL, handle, or path) to a canonical
 * lowercased identity. For a bare user/org target this is just the owner
 * login; for a repository URL it is `owner/repo`.
 *
 * e.g. "https://github.com/SalAkBuK/" -> "salakbuk"
 *      "github.com/SalAkBuK"          -> "salakbuk"
 *      "SalAkBuK"                     -> "salakbuk"
 *      "https://github.com/Owner/Repo" -> "owner/repo"
 *
 * Returns '' for unparseable input (never throws).
 */
export function normalizeGithubTarget(target?: string | null): string {
  if (!target || typeof target !== 'string' || !target.trim()) return '';
  try {
    return parseGitHubTarget(target).canonicalIdentifier;
  } catch {
    return '';
  }
}

/** Backward-compatible alias (existing call sites/tests use this casing). */
export const normalizeGitHubTarget = normalizeGithubTarget;

/**
 * Extracts just the OWNER login from a GitHub target, regardless of whether
 * a bare owner/org or a full owner/repo URL was supplied. This is the
 * identity that ALL owner-scope comparisons should use, since curated
 * evidence ownership is always an owner-level concept (never a repo-level
 * one) and repository URLs (e.g. an evidence link's `repositoryUrl`) must
 * resolve to the same identity as a bare configured owner target.
 *
 * Returns '' for unparseable/empty input (never throws).
 */
export function getGithubOwnerIdentity(target?: string | null): string {
  if (!target || typeof target !== 'string' || !target.trim()) return '';
  try {
    return parseGitHubTarget(target).owner.toLowerCase();
  } catch {
    return '';
  }
}

/**
 * Pure equivalence check between two GitHub targets, compared at the OWNER
 * identity level. Both empty/unparseable inputs are treated as NOT equal
 * (an unknown owner never "matches" -- the safe default is always to deny).
 */
export function isSameGithubOwner(a?: string | null, b?: string | null): boolean {
  const idA = getGithubOwnerIdentity(a);
  const idB = getGithubOwnerIdentity(b);
  return Boolean(idA) && Boolean(idB) && idA === idB;
}
