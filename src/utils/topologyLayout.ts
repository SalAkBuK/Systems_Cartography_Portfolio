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
  maxCharsPerLine: number = 20,
  maxLines: number = 2
): string[] {
  if (!title || typeof title !== 'string') return [''];
  const trimmed = title.trim();
  if (trimmed.length <= maxCharsPerLine) return [trimmed];

  // Tokenize by spaces, hyphens, and underscores using safe delimiter regex
  const rawTokens = trimmed.split(/([ \-_])/).filter(Boolean);
  const tokens: string[] = [];

  // Group delimiter with previous word if applicable (e.g. "towerdesk-", "backend_")
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
      }
      if (lines.length === maxLines) break;

      // Slice the oversized token across available lines
      let rem = token;
      while (rem.length > 0 && lines.length < maxLines) {
        if (lines.length === maxLines - 1) {
          // Last line: truncate with ellipsis if necessary
          if (rem.length > maxCharsPerLine) {
            lines.push(rem.slice(0, maxCharsPerLine - 1) + '…');
          } else {
            lines.push(rem);
          }
          rem = '';
          break;
        } else {
          lines.push(rem.slice(0, maxCharsPerLine));
          rem = rem.slice(maxCharsPerLine);
        }
      }
      continue;
    }

    const candidate = currentLine ? `${currentLine}${token}` : token;
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

interface PlacedNodeBox {
  id: string;
  type: 'project' | 'skill';
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Checks AABB collision between two node bounding boxes on the ground drafting plane.
 */
function boxesOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
  margin: number = 10
): boolean {
  return (
    a.x - margin < b.x + b.width &&
    a.x + a.width + margin > b.x &&
    a.y - margin < b.y + b.height &&
    a.y + a.height + margin > b.y
  );
}

/**
 * Computes an instant, deterministic, and collision-safe schematic layout.
 *
 * Hierarchy:
 * - Capabilities: Inner core backbone rings (expanding as capacity requires)
 * - Projects: Outer concentric system rings (strictly outside the entire capability core)
 *
 * Guarantees:
 * - Deterministic output: identical inputs produce identical coordinates.
 * - Stable sorting: input array ordering changes do NOT change coordinates.
 * - Dynamic scaling: calculates capacity per ring and dynamically adds rings as needed.
 * - Collision-safe: verifies bounding-box clearance against all placed nodes.
 * - Grid-snapped: all node x/y coordinates are multiples of GRID_SNAP_STEP.
 * - 0 animation frames / 0 physics relaxation needed.
 */
export function assembleTopologyLayout(
  projects: ProjectData[],
  skills: InfrastructureSkill[]
): AssembledTopologyPositions {
  const projectPositions: Record<string, { x: number; y: number }> = {};
  const skillPositions: Record<string, { x: number; y: number }> = {};
  const placedBoxes: PlacedNodeBox[] = [];

  const snap = (val: number, step: number = GRID_SNAP_STEP) => (Math.round(val / step) * step) || 0;

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

  // 3. Layout Capabilities (Inner Core Backbone Rings)
  const totalSkills = sortedSkills.length;
  let maxCapabilityRadius = 0;
  let maxCapabilityRx = 0;
  let maxCapabilityRy = 0;

  if (totalSkills === 1) {
    // Single capability at center
    const skill = sortedSkills[0];
    const pos = { x: 0, y: 0 };
    skillPositions[skill.id] = pos;
    placedBoxes.push({ id: skill.id, type: 'skill', x: pos.x, y: pos.y, width: 48, height: 48 });
    maxCapabilityRadius = 35;
    maxCapabilityRx = 35;
    maxCapabilityRy = 35;
  } else if (totalSkills > 1) {
    let unplacedSkills = [...sortedSkills];
    let ringIndex = 0;
    let rx = 90;
    let ry = 65;

    while (unplacedSkills.length > 0) {
      // Approximate ellipse perimeter = 2 * PI * sqrt((rx^2 + ry^2) / 2)
      const perimeter = 2 * Math.PI * Math.sqrt((rx * rx + ry * ry) / 2);
      // Capability footprint is 48x48; with clearance ~75px per node along perimeter
      const capacity = Math.max(3, Math.floor(perimeter / 75));
      const batchCount = Math.min(unplacedSkills.length, capacity);
      const batch = unplacedSkills.slice(0, batchCount);
      unplacedSkills = unplacedSkills.slice(batchCount);

      const angleStagger = ringIndex > 0 ? (ringIndex * Math.PI) / batchCount : 0;

      for (let i = 0; i < batch.length; i++) {
        const skill = batch[i];
        const angle = (i / batchCount) * 2 * Math.PI - Math.PI / 2 + angleStagger;
        const rawX = Math.cos(angle) * rx;
        const rawY = Math.sin(angle) * ry;

        let candX = snap(rawX);
        let candY = snap(rawY);
        let candBox = { x: candX, y: candY, width: 48, height: 48 };

        // Deterministic collision deflection if snapped box overlaps placed nodes
        let step = 0;
        while (placedBoxes.some(box => boxesOverlap(candBox, box, 12)) && step < 50) {
          step++;
          candX = snap(rawX + Math.cos(angle) * (step * GRID_SNAP_STEP));
          candY = snap(rawY + Math.sin(angle) * (step * GRID_SNAP_STEP));
          candBox = { x: candX, y: candY, width: 48, height: 48 };
        }

        skillPositions[skill.id] = { x: candX, y: candY };
        placedBoxes.push({ id: skill.id, type: 'skill', x: candX, y: candY, width: 48, height: 48 });

        const dist = Math.hypot(candX + 24, candY + 24);
        if (dist > maxCapabilityRadius) maxCapabilityRadius = dist;
        if (Math.abs(candX) > maxCapabilityRx) maxCapabilityRx = Math.abs(candX);
        if (Math.abs(candY) > maxCapabilityRy) maxCapabilityRy = Math.abs(candY);
      }

      // Expand to next capability ring
      rx += 80;
      ry += 60;
      ringIndex++;
    }
  }

  // 4. Layout Projects (Outer Concentric Rings strictly outside capability region)
  const totalProjects = sortedProjects.length;
  if (totalProjects > 0) {
    let unplacedProjects = [...sortedProjects];
    let projectRingIndex = 0;

    // Start project rings outside the entire capability core plus clearance buffer
    let projRx = Math.max(260, maxCapabilityRx + 160);
    let projRy = Math.max(185, maxCapabilityRy + 120);

    while (unplacedProjects.length > 0) {
      const perimeter = 2 * Math.PI * Math.sqrt((projRx * projRx + projRy * projRy) / 2);
      // Project footprint width is (dim.width * 0.75) ~75px, depth 55px; safe perimeter spacing ~135px
      const capacity = Math.max(4, Math.floor(perimeter / 135));
      const batchCount = Math.min(unplacedProjects.length, capacity);
      const batch = unplacedProjects.slice(0, batchCount);
      unplacedProjects = unplacedProjects.slice(batchCount);

      const angleStagger = (projectRingIndex * Math.PI) / 6;

      for (let i = 0; i < batch.length; i++) {
        const proj = batch[i];
        const pWidth = (proj.dimensions?.width || 100) * 0.75;
        const pHeight = 55;

        const angle = (i / batchCount) * 2 * Math.PI - Math.PI / 2 + angleStagger;
        const rawX = Math.cos(angle) * projRx;
        const rawY = Math.sin(angle) * projRy;

        let candX = snap(rawX);
        let candY = snap(rawY);
        let candBox = { x: candX, y: candY, width: pWidth, height: pHeight };

        // Deterministic collision deflection if snapped box overlaps any placed node
        let step = 0;
        while (placedBoxes.some(box => boxesOverlap(candBox, box, 15)) && step < 60) {
          step++;
          candX = snap(rawX + Math.cos(angle) * (step * GRID_SNAP_STEP));
          candY = snap(rawY + Math.sin(angle) * (step * GRID_SNAP_STEP));
          candBox = { x: candX, y: candY, width: pWidth, height: pHeight };
        }

        projectPositions[proj.id] = { x: candX, y: candY };
        placedBoxes.push({ id: proj.id, type: 'project', x: candX, y: candY, width: pWidth, height: pHeight });
      }

      // Expand to next concentric project ring
      projRx += 140;
      projRy += 105;
      projectRingIndex++;
    }
  }

  return { projectPositions, skillPositions };
}
