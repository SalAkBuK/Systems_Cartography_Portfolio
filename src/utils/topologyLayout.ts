import { ProjectData, InfrastructureSkill, TopologyViewMode } from '../types';
import { GRID_SNAP_STEP } from './collision';

export type { TopologyViewMode };

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
  showBackgroundRelationships: boolean;
  isSelectedExpActive?: boolean;
  isProjectLinkedToExp?: boolean;
  isSkillLinkedToExp?: boolean;
}

/**
 * Pure decision layer resolving presentation state for each relationship conduit.
 *
 * Rules:
 * - Not connected -> 'hidden'
 * - Active drag on this node -> 'dragging'
 * - Directly hovered or selected -> 'focused' (prominent, animated)
 * - When Experience is active:
 *     - RELATIONSHIPS mode: only promote conduits where BOTH project and skill are linked to selected experience. Unrelated -> 'hidden'.
 *     - SYSTEMS/CAPABILITIES mode: no background conduits -> 'hidden'.
 * - When Experience is inactive:
 *     - RELATIONSHIPS mode -> 'background' (subdued, static)
 *     - SYSTEMS/CAPABILITIES mode -> 'hidden' (no distraction)
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
    showBackgroundRelationships,
    isSelectedExpActive,
    isProjectLinkedToExp,
    isSkillLinkedToExp
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

  // When experience filter is active
  if (isSelectedExpActive) {
    if (showBackgroundRelationships) {
      // RELATIONSHIPS mode: promote conduits between experience-linked projects and their skills
      return (isProjectLinkedToExp && isSkillLinkedToExp) ? 'background' : 'hidden';
    }
    // SYSTEMS / CAPABILITIES mode: no background conduit noise
    return 'hidden';
  }

  // Edge is not directly related to the active focus target
  if (isFocusActive) {
    return showBackgroundRelationships ? 'background' : 'hidden';
  }

  // At rest (no hover, no selection, no drag, no experience filter)
  return showBackgroundRelationships ? 'background' : 'hidden';
}

export type TopologyNodeVisualLevel = 
  | 'primary'      // Full strength (100% opacity, active ink)
  | 'highlighted'  // Active focus target / direct interaction / linked to active selection
  | 'contextual'   // Visible subordinate (~55% opacity, readable, no grayscale)
  | 'dimmed';      // Filtered out / unrelated to active focus / unlinked during experience selection (20% opacity, grayscale)

export interface NodeEmphasisParams {
  nodeType: 'project' | 'skill';
  mode: TopologyViewMode;
  isHovered: boolean;
  isSelected: boolean;
  isDragging: boolean;
  isConnectedToFocus: boolean;
  isAnyFocusActive: boolean;
  isSelectedExpActive: boolean;
  isLinkedToSelectedExp: boolean;
  isSkillLinkedToExp?: boolean;
}

/**
 * Pure helper determining visual emphasis level for topology nodes based on view mode and interaction state.
 * Composes Professional Experience filter context with Topology presentation modes.
 */
export function getTopologyNodeEmphasis(params: NodeEmphasisParams): TopologyNodeVisualLevel {
  const {
    nodeType,
    mode,
    isHovered,
    isSelected,
    isDragging,
    isConnectedToFocus,
    isAnyFocusActive,
    isSelectedExpActive,
    isLinkedToSelectedExp,
    isSkillLinkedToExp
  } = params;

  // 1. Authoritative unlinked project filter during Experience Selection
  // Unlinked projects remain strictly dimmed regardless of hover or connected focus
  if (isSelectedExpActive && nodeType === 'project' && !isLinkedToSelectedExp) {
    return 'dimmed';
  }

  // 2. Direct Interaction / Focus Target (highest priority for active node interaction)
  if (isHovered || isSelected || isDragging) {
    return 'highlighted';
  }

  // 3. Connected to Active Focus Target (e.g. hovering a project highlights its connected skills)
  if (isConnectedToFocus) {
    return 'highlighted';
  }

  // 4. When Experience Selection IS Active (filter context):
  if (isSelectedExpActive) {
    if (nodeType === 'project') {
      if (mode === 'systems') {
        return 'primary';
      }
      if (mode === 'capabilities') {
        return 'contextual';
      }
      // mode === 'relationships'
      return 'primary';
    }

    if (nodeType === 'skill') {
      const isLinked = Boolean(isSkillLinkedToExp);
      if (mode === 'systems') {
        return 'contextual';
      }
      if (mode === 'capabilities') {
        return isLinked ? 'primary' : 'dimmed';
      }
      // mode === 'relationships'
      return isLinked ? 'primary' : 'dimmed';
    }
  }

  // 5. Unrelated node during active canvas focus
  if (isAnyFocusActive) {
    return 'dimmed';
  }

  // 6. At Rest (no focus active, no experience selected):
  if (mode === 'systems') {
    return nodeType === 'project' ? 'primary' : 'contextual';
  }

  if (mode === 'capabilities') {
    return nodeType === 'skill' ? 'primary' : 'contextual';
  }

  // mode === 'relationships'
  return 'primary';
}

export function getNodeEmphasisClassName(level: TopologyNodeVisualLevel): string {
  switch (level) {
    case 'highlighted':
    case 'primary':
      return 'opacity-100';
    case 'contextual':
      return 'opacity-55 transition-opacity duration-200';
    case 'dimmed':
      return 'opacity-20 grayscale pointer-events-auto transition-opacity duration-200';
  }
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

export interface PlacedNodeBounds {
  id: string;
  type: 'project' | 'skill';
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Returns the AABB bounds for a node given its canonical coordinate semantics.
 * - Project: pos is TOP-LEFT origin. Bounds: [pos.x, pos.x + width], [pos.y, pos.y + height]
 * - Skill: pos is CENTER. Bounds: [pos.x - width/2, pos.x + width/2], [pos.y - height/2, pos.y + height/2]
 */
export function getNodeBounds(
  type: 'project' | 'skill',
  pos: { x: number; y: number },
  width: number = type === 'skill' ? 48 : 75,
  height: number = type === 'skill' ? 48 : 55
): { minX: number; maxX: number; minY: number; maxY: number } {
  if (type === 'skill') {
    const halfW = width / 2;
    const halfH = height / 2;
    return {
      minX: pos.x - halfW,
      maxX: pos.x + halfW,
      minY: pos.y - halfH,
      maxY: pos.y + halfH
    };
  } else {
    return {
      minX: pos.x,
      maxX: pos.x + width,
      minY: pos.y,
      maxY: pos.y + height
    };
  }
}

/**
 * Checks AABB collision between two node bounding boxes on the ground drafting plane with optional margin.
 */
export function checkAABBOverlap(
  a: { minX: number; maxX: number; minY: number; maxY: number },
  b: { minX: number; maxX: number; minY: number; maxY: number },
  margin: number = 10
): boolean {
  return (
    a.minX - margin < b.maxX &&
    a.maxX + margin > b.minX &&
    a.minY - margin < b.maxY &&
    a.maxY + margin > b.minY
  );
}

/**
 * Computes an instant, deterministic, and collision-safe schematic layout.
 *
 * Hierarchy:
 * - Capabilities: Inner core backbone rings (expanding as capacity requires)
 * - Projects: Outer concentric system rings (strictly outside the entire capability core)
 *
 * Coordinate Semantics:
 * - Project coordinates: TOP-LEFT origin of the structure box.
 * - Skill coordinates: CENTER of the capability plinth.
 *
 * Guarantees:
 * - Deterministic output: identical inputs produce identical coordinates.
 * - Stable sorting: input array ordering changes do NOT change coordinates.
 * - Dynamic scaling: calculates capacity per ring and dynamically adds rings as needed.
 * - Guaranteed collision-safe: verifies bounding-box clearance before writing positions.
 * - Grid-snapped: all node x/y coordinates are multiples of GRID_SNAP_STEP.
 * - 0 animation frames / 0 physics relaxation needed.
 */
export function assembleTopologyLayout(
  projects: ProjectData[],
  skills: InfrastructureSkill[]
): AssembledTopologyPositions {
  const projectPositions: Record<string, { x: number; y: number }> = {};
  const skillPositions: Record<string, { x: number; y: number }> = {};
  const placedBoxes: PlacedNodeBounds[] = [];

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
  let maxCapabilityExtentX = 0;
  let maxCapabilityExtentY = 0;

  if (totalSkills === 1) {
    // Single capability at center (0, 0)
    const skill = sortedSkills[0];
    const pos = { x: 0, y: 0 };
    const bounds = getNodeBounds('skill', pos, 48, 48);
    skillPositions[skill.id] = pos;
    placedBoxes.push({ id: skill.id, type: 'skill', ...bounds });
    maxCapabilityExtentX = 24;
    maxCapabilityExtentY = 24;
  } else if (totalSkills > 1) {
    let unplacedSkills = [...sortedSkills];
    let ringIndex = 0;
    let rx = 90;
    let ry = 65;

    while (unplacedSkills.length > 0) {
      // Approximate ellipse perimeter = 2 * PI * sqrt((rx^2 + ry^2) / 2)
      const perimeter = 2 * Math.PI * Math.sqrt((rx * rx + ry * ry) / 2);
      // Capability footprint is 48x48; safe arc spacing ~75px per node along perimeter
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
        let candBounds = getNodeBounds('skill', { x: candX, y: candY }, 48, 48);

        // Deterministic collision search with radial stepping & candidate ring expansion
        let isCollisionFree = false;
        let step = 0;
        let currentCandRx = rx;
        let currentCandRy = ry;

        while (!isCollisionFree && step < 80) {
          if (!placedBoxes.some(box => checkAABBOverlap(candBounds, box, 12))) {
            isCollisionFree = true;
            break;
          }
          step++;
          if (step % 8 === 0) {
            currentCandRx += GRID_SNAP_STEP * 2;
            currentCandRy += GRID_SNAP_STEP * 2;
          }
          const rayOffset = (step % 8) * GRID_SNAP_STEP;
          candX = snap(Math.cos(angle) * (currentCandRx + rayOffset));
          candY = snap(Math.sin(angle) * (currentCandRy + rayOffset));
          candBounds = getNodeBounds('skill', { x: candX, y: candY }, 48, 48);
        }

        if (!isCollisionFree) {
          throw new Error(`Deterministic layout failed: unable to place capability ${skill.id} without collision.`);
        }

        skillPositions[skill.id] = { x: candX, y: candY };
        placedBoxes.push({ id: skill.id, type: 'skill', ...candBounds });

        const extentX = Math.abs(candX) + 24;
        const extentY = Math.abs(candY) + 24;
        if (extentX > maxCapabilityExtentX) maxCapabilityExtentX = extentX;
        if (extentY > maxCapabilityExtentY) maxCapabilityExtentY = extentY;
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
    let projRx = Math.max(260, maxCapabilityExtentX + 160);
    let projRy = Math.max(185, maxCapabilityExtentY + 120);

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
        let candBounds = getNodeBounds('project', { x: candX, y: candY }, pWidth, pHeight);

        // Deterministic collision search with radial stepping & candidate ring expansion
        let isCollisionFree = false;
        let step = 0;
        let currentCandRx = projRx;
        let currentCandRy = projRy;

        while (!isCollisionFree && step < 120) {
          if (!placedBoxes.some(box => checkAABBOverlap(candBounds, box, 15))) {
            isCollisionFree = true;
            break;
          }
          step++;
          if (step % 10 === 0) {
            currentCandRx += GRID_SNAP_STEP * 2;
            currentCandRy += GRID_SNAP_STEP * 2;
          }
          const rayOffset = (step % 10) * GRID_SNAP_STEP;
          candX = snap(Math.cos(angle) * (currentCandRx + rayOffset));
          candY = snap(Math.sin(angle) * (currentCandRy + rayOffset));
          candBounds = getNodeBounds('project', { x: candX, y: candY }, pWidth, pHeight);
        }

        if (!isCollisionFree) {
          throw new Error(`Deterministic layout failed: unable to place project ${proj.id} without collision.`);
        }

        projectPositions[proj.id] = { x: candX, y: candY };
        placedBoxes.push({ id: proj.id, type: 'project', ...candBounds });
      }

      // Expand to next concentric project ring
      projRx += 140;
      projRy += 105;
      projectRingIndex++;
    }
  }

  return { projectPositions, skillPositions };
}
