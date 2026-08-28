import { ProjectData, InfrastructureSkill } from '../types';
import { GRID_SNAP_STEP } from './collision';

export type ConduitPresentationState = 'hidden' | 'background' | 'focused' | 'dragging';

export interface ConduitStateParams {
  isConnected: boolean;
  isProjectHovered: boolean;
  isSkillHovered: boolean;
  isProjectSelected: boolean;
  isSkillSelected: boolean;
  isDraggingThisProject: boolean;
  isDraggingThisSkill: boolean;
  isAnyProjectHovered: boolean;
  isAnySkillHovered: boolean;
  isAnyProjectSelected: boolean;
  isAnySkillSelected: boolean;
  isAnyDragging: boolean;
  traceModeActive: boolean;
}

/**
 * Pure decision layer resolving presentation state for each relationship conduit.
 *
 * Rules:
 * - Not connected -> 'hidden'
 * - Active drag on this node -> 'dragging'
 * - Directly hovered or selected -> 'focused' (prominent, animated)
 * - Focused target active elsewhere:
 *     - If TRACE is ON -> 'background' (subdued, static)
 *     - If TRACE is OFF -> 'hidden' (no distraction)
 * - No focus anywhere:
 *     - If TRACE is ON -> 'background' (subdued, static)
 *     - If TRACE is OFF -> 'hidden'
 */
export function getConduitPresentationState(params: ConduitStateParams): ConduitPresentationState {
  const {
    isConnected,
    isProjectHovered,
    isSkillHovered,
    isProjectSelected,
    isSkillSelected,
    isDraggingThisProject,
    isDraggingThisSkill,
    isAnyProjectHovered,
    isAnySkillHovered,
    isAnyProjectSelected,
    isAnySkillSelected,
    isAnyDragging,
    traceModeActive
  } = params;

  if (!isConnected) return 'hidden';

  const isDirectHover = isProjectHovered || isSkillHovered;
  const isDirectSelection = !isAnyProjectHovered && !isAnySkillHovered && (isProjectSelected || isSkillSelected);
  const isThisDragging = isDraggingThisProject || isDraggingThisSkill;
  const isFocusActive = isAnyProjectHovered || isAnySkillHovered || isAnyProjectSelected || isAnySkillSelected || isAnyDragging;

  if (isThisDragging) {
    return 'dragging';
  }

  if (isDirectHover || isDirectSelection) {
    return 'focused';
  }

  // Edge is not directly related to the active focus target
  if (isFocusActive) {
    return traceModeActive ? 'background' : 'hidden';
  }

  // At rest (no hover, no selection, no drag)
  return traceModeActive ? 'background' : 'hidden';
}

/**
 * Pure SVG text wrapping utility for project callout titles.
 * Handles hyphens, word boundaries, and unbroken tokens cleanly.
 * Wraps to at most `maxLines` lines with an ellipsis on overflow.
 */
export function wrapCalloutTitle(
  title: string,
  maxCharsPerLine: number = 19,
  maxLines: number = 2
): string[] {
  if (!title || typeof title !== 'string') return [''];
  const trimmed = title.trim();
  if (trimmed.length <= maxCharsPerLine) return [trimmed];

  // Tokenize by spaces, hyphens, and underscores, preserving delimiters
  const rawTokens = trimmed.split(/([ -_])/).filter(Boolean);
  const tokens: string[] = [];

  // Group delimiter with previous word if applicable (e.g. "towerdesk-", "backend-")
  for (let i = 0; i < rawTokens.length; i++) {
    const t = rawTokens[i];
    if ((t === '-' || t === '_' || t === ' ') && tokens.length > 0) {
      tokens[tokens.length - 1] += t;
    } else {
      tokens.push(t);
    }
  }

  const lines: string[] = [];
  let currentLine = '';

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    // Handle token that exceeds maxCharsPerLine
    if (token.length > maxCharsPerLine) {
      if (currentLine.trim()) {
        lines.push(currentLine.trim());
        currentLine = '';
        if (lines.length === maxLines) break;
      }

      let remaining = token;
      while (remaining.length > 0) {
        if (lines.length === maxLines - 1) {
          if (remaining.length > maxCharsPerLine) {
            lines.push(remaining.slice(0, maxCharsPerLine - 1) + '…');
          } else {
            lines.push(remaining);
          }
          break;
        } else {
          lines.push(remaining.slice(0, maxCharsPerLine));
          remaining = remaining.slice(maxCharsPerLine);
          if (lines.length === maxLines) break;
        }
      }
      if (lines.length === maxLines) break;
      continue;
    }

    const candidate = currentLine + token;
    if (candidate.length <= maxCharsPerLine) {
      currentLine = candidate;
    } else {
      if (currentLine.trim()) {
        lines.push(currentLine.trim());
      }
      if (lines.length === maxLines) break;
      currentLine = token;
    }
  }

  if (currentLine.trim() && lines.length < maxLines) {
    lines.push(currentLine.trim());
  }

  // Ensure ellipsis if there was remaining text beyond maxLines
  if (lines.length === maxLines) {
    const totalChars = lines.join('').replace(/[… ]/g, '').length;
    const rawChars = trimmed.replace(/[ ]/g, '').length;
    if (totalChars < rawChars) {
      let lastLine = lines[maxLines - 1];
      if (!lastLine.endsWith('…') && !lastLine.endsWith('...')) {
        if (lastLine.length >= maxCharsPerLine) {
          lastLine = lastLine.slice(0, maxCharsPerLine - 1) + '…';
        } else {
          lastLine = lastLine + '…';
        }
        lines[maxLines - 1] = lastLine;
      }
    }
  }

  return lines.length > 0 ? lines : [trimmed];
}

export interface AssembledTopologyPositions {
  projectPositions: Record<string, { x: number; y: number }>;
  skillPositions: Record<string, { x: number; y: number }>;
}

/**
 * Computes an instant, deterministic schematic layout.
 *
 * Hierarchy:
 * - Capabilities: Inner core backbone rings
 * - Projects: Outer concentric system rings
 *
 * Guarantees:
 * - Deterministic output: same input nodes always yield identical coordinates.
 * - Stable sorting: input array ordering changes do NOT change coordinates.
 * - Dynamic scaling: accommodates varying repository and capability counts.
 * - Grid-snapped and collision-safe spacing.
 * - 0 animation frames / 0 physics relaxation needed.
 */
export function assembleTopologyLayout(
  projects: ProjectData[],
  skills: InfrastructureSkill[]
): AssembledTopologyPositions {
  const projectPositions: Record<string, { x: number; y: number }> = {};
  const skillPositions: Record<string, { x: number; y: number }> = {};

  // 1. Stable Sort: Skills (code -> name -> id)
  const sortedSkills = [...skills].sort((a, b) => {
    const codeCmp = (a.code || '').localeCompare(b.code || '');
    if (codeCmp !== 0) return codeCmp;
    const nameCmp = (a.name || '').localeCompare(b.name || '');
    if (nameCmp !== 0) return nameCmp;
    return a.id.localeCompare(b.id);
  });

  // 2. Stable Sort: Projects (code -> title -> id)
  const sortedProjects = [...projects].sort((a, b) => {
    const codeCmp = (a.code || '').localeCompare(b.code || '');
    if (codeCmp !== 0) return codeCmp;
    const titleCmp = (a.title || '').localeCompare(b.title || '');
    if (titleCmp !== 0) return titleCmp;
    return a.id.localeCompare(b.id);
  });

  const snap = (val: number, step: number = GRID_SNAP_STEP) => Math.round(val / step) * step;

  // 3. Layout Capabilities (Inner Core Backbone)
  const totalSkills = sortedSkills.length;
  if (totalSkills > 0) {
    if (totalSkills <= 6) {
      // Single inner ring
      const rx = 90;
      const ry = 65;
      sortedSkills.forEach((skill, idx) => {
        const angle = (idx / totalSkills) * Math.PI * 2 - Math.PI / 2;
        const rawX = Math.cos(angle) * rx;
        const rawY = Math.sin(angle) * ry;
        skillPositions[skill.id] = {
          x: snap(rawX),
          y: snap(rawY)
        };
      });
    } else {
      // Multi-ring capability core (Inner Ring: 6, Outer Capability Ring: remainder)
      const innerCount = Math.min(6, Math.ceil(totalSkills * 0.45));
      const outerCount = totalSkills - innerCount;

      sortedSkills.slice(0, innerCount).forEach((skill, idx) => {
        const angle = (idx / innerCount) * Math.PI * 2 - Math.PI / 2;
        const rawX = Math.cos(angle) * 75;
        const rawY = Math.sin(angle) * 55;
        skillPositions[skill.id] = {
          x: snap(rawX),
          y: snap(rawY)
        };
      });

      sortedSkills.slice(innerCount).forEach((skill, idx) => {
        const angle = (idx / outerCount) * Math.PI * 2 - Math.PI / 2 + Math.PI / outerCount;
        const rawX = Math.cos(angle) * 140;
        const rawY = Math.sin(angle) * 105;
        skillPositions[skill.id] = {
          x: snap(rawX),
          y: snap(rawY)
        };
      });
    }
  }

  // 4. Layout Projects (Outer Concentric Rings)
  const totalProjects = sortedProjects.length;
  if (totalProjects > 0) {
    if (totalProjects <= 8) {
      // Single outer project ring
      const rx = 260;
      const ry = 190;
      sortedProjects.forEach((proj, idx) => {
        const angle = (idx / totalProjects) * Math.PI * 2 - Math.PI / 2;
        const rawX = Math.cos(angle) * rx;
        const rawY = Math.sin(angle) * ry;
        projectPositions[proj.id] = {
          x: snap(rawX),
          y: snap(rawY)
        };
      });
    } else if (totalProjects <= 16) {
      // Two concentric project rings
      const ring1Count = Math.ceil(totalProjects * 0.5);
      const ring2Count = totalProjects - ring1Count;

      sortedProjects.slice(0, ring1Count).forEach((proj, idx) => {
        const angle = (idx / ring1Count) * Math.PI * 2 - Math.PI / 2;
        const rawX = Math.cos(angle) * 250;
        const rawY = Math.sin(angle) * 185;
        projectPositions[proj.id] = {
          x: snap(rawX),
          y: snap(rawY)
        };
      });

      sortedProjects.slice(ring1Count).forEach((proj, idx) => {
        const angle = (idx / ring2Count) * Math.PI * 2 - Math.PI / 2 + Math.PI / ring2Count;
        const rawX = Math.cos(angle) * 375;
        const rawY = Math.sin(angle) * 275;
        projectPositions[proj.id] = {
          x: snap(rawX),
          y: snap(rawY)
        };
      });
    } else {
      // Three concentric project rings for large repositories (e.g. 20+ projects)
      const ring1Count = 8;
      const ring2Count = 10;
      const ring3Count = totalProjects - ring1Count - ring2Count;

      sortedProjects.slice(0, ring1Count).forEach((proj, idx) => {
        const angle = (idx / ring1Count) * Math.PI * 2 - Math.PI / 2;
        projectPositions[proj.id] = {
          x: snap(Math.cos(angle) * 240),
          y: snap(Math.sin(angle) * 180)
        };
      });

      sortedProjects.slice(ring1Count, ring1Count + ring2Count).forEach((proj, idx) => {
        const angle = (idx / ring2Count) * Math.PI * 2 - Math.PI / 2 + Math.PI / ring2Count;
        projectPositions[proj.id] = {
          x: snap(Math.cos(angle) * 360),
          y: snap(Math.sin(angle) * 265)
        };
      });

      sortedProjects.slice(ring1Count + ring2Count).forEach((proj, idx) => {
        const angle = (idx / Math.max(ring3Count, 1)) * Math.PI * 2 - Math.PI / 2;
        projectPositions[proj.id] = {
          x: snap(Math.cos(angle) * 480),
          y: snap(Math.sin(angle) * 350)
        };
      });
    }
  }

  return { projectPositions, skillPositions };
}
