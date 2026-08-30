import * as fs from 'fs';
import * as path from 'path';

/**
 * Formats the TypeScript source code for src/config/ownerPreferences.ts.
 * Optionally annotates project IDs with project title comments for human readability.
 */
export function formatOwnerPreferencesFile(
  flagshipProjectIds: string[],
  projectTitleMap?: Record<string, string>
): string {
  const lines = [
    '/**',
    ' * OWNER PORTFOLIO PREFERENCES',
    ' *',
    ' * Persistent, owner-curated configuration for flagship project display.',
    ' * This file is updated by `npm run setup:flagships` and survives GitHub syncs.',
    ' */',
    '',
    'export interface OwnerPortfolioPreferences {',
    '  flagshipProjectIds: string[];',
    '}',
    '',
    'export const OWNER_PORTFOLIO_PREFERENCES: OwnerPortfolioPreferences = {',
    '  flagshipProjectIds: ['
  ];

  if (flagshipProjectIds.length === 0) {
    lines.push('  ]');
  } else {
    flagshipProjectIds.forEach((id, index) => {
      const isLast = index === flagshipProjectIds.length - 1;
      const comma = isLast ? '' : ',';
      const title = projectTitleMap?.[id];
      const comment = title ? ` // ${title}` : '';
      lines.push(`    '${id}'${comma}${comment}`);
    });
    lines.push('  ]');
  }

  lines.push('};');
  lines.push('');

  return lines.join('\n');
}

/**
 * Validates and safely writes owner preferences to the specified file path.
 * Enforces:
 * - max 4 projects
 * - no duplicate IDs
 * - rejection of unknown IDs when availableProjectIds is supplied
 * - atomic write via temporary file
 */
export function writeOwnerPreferences(
  filePath: string,
  flagshipProjectIds: string[],
  availableProjectIds?: string[],
  projectTitleMap?: Record<string, string>
): { success: boolean; savedIds: string[]; error?: string } {
  if (!Array.isArray(flagshipProjectIds)) {
    return { success: false, savedIds: [], error: 'flagshipProjectIds must be an array' };
  }

  // Deduplicate while preserving order
  const deduplicated: string[] = [];
  const seen = new Set<string>();

  for (const rawId of flagshipProjectIds) {
    if (!rawId || typeof rawId !== 'string') continue;
    const cleanId = rawId.trim();
    if (!cleanId || seen.has(cleanId)) continue;

    // If availableProjectIds is provided as an array, validate membership.
    // An empty array means zero IDs are valid.
    if (Array.isArray(availableProjectIds)) {
      if (!availableProjectIds.includes(cleanId)) {
        continue; // skip unknown ID
      }
    }

    seen.add(cleanId);
    deduplicated.push(cleanId);
    if (deduplicated.length >= 4) break;
  }

  const content = formatOwnerPreferencesFile(deduplicated, projectTitleMap);

  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Atomic write via temp file
    const tempFile = `${filePath}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, content, 'utf8');
    fs.renameSync(tempFile, filePath);

    return { success: true, savedIds: deduplicated };
  } catch (err) {
    return {
      success: false,
      savedIds: [],
      error: err instanceof Error ? err.message : String(err)
    };
  }
}
