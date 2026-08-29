// Single source of truth for a project structure's rendered footprint/height AND
// its full visual envelope (structure + callout card), so rendering, canonical
// orbital layout, collision detection, drag-landing previews, and conduit
// anchoring never disagree about a project's size or on-screen extent.
import { project3DToIso } from './isometricProjection';

/**
 * Deliberate presentation scale applied to every project's rendered structure so
 * projects read as subordinate to the technical capability nucleus rather than
 * visually dominating it. Does NOT mutate ProjectData.dimensions.
 */
export const ORBIT_PROJECT_SCALE = 0.84;

const BASE_PROJECT_DEPTH = 55;
const DEFAULT_PROJECT_WIDTH = 100;
const DEFAULT_PROJECT_HEIGHT = 60;

export interface TopologyProjectDimensions {
  width: number;
  depth: number;
  height: number;
}

export interface ProjectDimensionsSource {
  dimensions?: { width: number; height: number; levels?: number };
}

/**
 * Returns the ground-footprint width/depth and vertical height for a project
 * structure at the given presentation scale (defaults to ORBIT_PROJECT_SCALE).
 */
export function getTopologyProjectDimensions(
  project: ProjectDimensionsSource | null | undefined,
  scale: number = ORBIT_PROJECT_SCALE
): TopologyProjectDimensions {
  const rawWidth = project?.dimensions?.width ?? DEFAULT_PROJECT_WIDTH;
  const rawHeight = project?.dimensions?.height ?? DEFAULT_PROJECT_HEIGHT;
  return {
    width: rawWidth * 0.75 * scale,
    depth: BASE_PROJECT_DEPTH * scale,
    height: rawHeight * 0.75 * scale,
  };
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

// ---------------------------------------------------------------------------
// Project callout card geometry — single source of truth for the on-screen
// label card TopologyCanvas renders above every project structure, so the
// orbital layout's overlap validation reasons about the SAME visual footprint
// that actually gets drawn.
// ---------------------------------------------------------------------------

export const PROJECT_CALLOUT_WIDTH = 132;
export const PROJECT_CALLOUT_SINGLE_HEIGHT = 28;
export const PROJECT_CALLOUT_DOUBLE_HEIGHT = 38;
export const PROJECT_CALLOUT_SINGLE_Y = -12;
export const PROJECT_CALLOUT_DOUBLE_Y = -15;

/** Small breathing margin (iso/visual units) added around a project's full visual envelope. */
export const PROJECT_VISUAL_MARGIN = 12;

export interface TopologyVisualBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface ProjectVisualBoundsSource extends ProjectDimensionsSource {
  title?: string;
}

/**
 * Computes a project's FULL rendered visual envelope in isometric/visual space —
 * the 3D structure box (ground + top face, at scaled height) UNION the callout
 * card TopologyCanvas draws above it — plus a small breathing margin. This is
 * the safe-footprint used to validate orbital slot spacing: two project cube
 * footprints can be AABB-clear on the ground plane while their rendered
 * callouts still visually collide, so layout validation must reason about this
 * envelope rather than the ground-plane box alone.
 */
export function getTopologyProjectVisualBounds(
  project: ProjectVisualBoundsSource | null | undefined,
  worldOrigin: { x: number; y: number },
  scale: number = ORBIT_PROJECT_SCALE
): TopologyVisualBounds {
  const { width, depth, height } = getTopologyProjectDimensions(project, scale);

  // 1. Iso-project all 8 corners of the 3D structure box (ground + top face).
  const corners = [
    project3DToIso(worldOrigin.x, worldOrigin.y, 0),
    project3DToIso(worldOrigin.x + width, worldOrigin.y, 0),
    project3DToIso(worldOrigin.x + width, worldOrigin.y + depth, 0),
    project3DToIso(worldOrigin.x, worldOrigin.y + depth, 0),
    project3DToIso(worldOrigin.x, worldOrigin.y, height),
    project3DToIso(worldOrigin.x + width, worldOrigin.y, height),
    project3DToIso(worldOrigin.x + width, worldOrigin.y + depth, height),
    project3DToIso(worldOrigin.x, worldOrigin.y + depth, height),
  ];
  let minX = Math.min(...corners.map(c => c.x));
  let maxX = Math.max(...corners.map(c => c.x));
  let minY = Math.min(...corners.map(c => c.y));
  let maxY = Math.max(...corners.map(c => c.y));

  // 2. Add the callout card, anchored exactly like TopologyCanvas's render:
  //    <g transform={translate(p3_top.x - 8, p3_top.y - 30)}>
  //      <rect x="-4" y={cardY} width={cardWidth} height={cardHeight} />
  const p3_top = project3DToIso(worldOrigin.x, worldOrigin.y + depth, height);
  const titleLines = wrapCalloutTitle(project?.title || '', 20, 2);
  const isTwoLines = titleLines.length > 1;
  const cardHeight = isTwoLines ? PROJECT_CALLOUT_DOUBLE_HEIGHT : PROJECT_CALLOUT_SINGLE_HEIGHT;
  const cardY = isTwoLines ? PROJECT_CALLOUT_DOUBLE_Y : PROJECT_CALLOUT_SINGLE_Y;

  const calloutLeft = p3_top.x - 8 - 4;
  const calloutRight = calloutLeft + PROJECT_CALLOUT_WIDTH;
  const calloutTop = p3_top.y - 30 + cardY;
  const calloutBottom = calloutTop + cardHeight;

  minX = Math.min(minX, calloutLeft);
  maxX = Math.max(maxX, calloutRight);
  minY = Math.min(minY, calloutTop);
  maxY = Math.max(maxY, calloutBottom);

  return {
    minX: minX - PROJECT_VISUAL_MARGIN,
    maxX: maxX + PROJECT_VISUAL_MARGIN,
    minY: minY - PROJECT_VISUAL_MARGIN,
    maxY: maxY + PROJECT_VISUAL_MARGIN,
  };
}
