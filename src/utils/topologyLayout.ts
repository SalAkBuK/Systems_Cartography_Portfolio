import { ProjectData, InfrastructureSkill, TopologyViewMode } from '../types';
import { GRID_SNAP_STEP } from './collision';
import { project3DToIso, projectIsoTo3D } from './isometricProjection';
import {
  getTopologyProjectDimensions,
  getTopologyProjectVisualBounds,
  wrapCalloutTitle,
  type TopologyVisualBounds,
  type TopologyProjectDimensions
} from './projectTopologyGeometry';

// Re-exported for backward compatibility: TopologyCanvas and existing tests
// import wrapCalloutTitle from this module. The canonical implementation now
// lives alongside the rest of the project visual-geometry helpers.
export { wrapCalloutTitle };

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

  // When experience filter is active, it is authoritative:
  // Any relationship not between an experience-linked project and its connected skill is strictly hidden.
  if (isSelectedExpActive && !(isProjectLinkedToExp && isSkillLinkedToExp)) {
    return 'hidden';
  }

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

  // When experience filter is active and this is an eligible experience relationship:
  if (isSelectedExpActive) {
    return showBackgroundRelationships ? 'background' : 'hidden';
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

  // 2. Authoritative unlinked capability filter during Experience Selection in Capabilities/Relationships modes
  // Unlinked capabilities remain strictly dimmed even if hovered or connected to focus
  if (
    isSelectedExpActive && 
    nodeType === 'skill' && 
    (mode === 'capabilities' || mode === 'relationships') && 
    !isSkillLinkedToExp
  ) {
    return 'dimmed';
  }

  // 3. Direct Interaction / Focus Target (highest priority for active node interaction)
  if (isHovered || isSelected || isDragging) {
    return 'highlighted';
  }

  // 4. Connected to Active Focus Target (e.g. hovering a project highlights its connected skills)
  if (isConnectedToFocus) {
    return 'highlighted';
  }

  // 5. When Experience Selection IS Active (filter context at rest):
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
 * One slot on the static project orbit ellipse. `isoX`/`isoY` are the slot's
 * position in isometric/visual space (what the ellipse looks like on screen);
 * `worldX`/`worldY` are the corresponding project TOP-LEFT origin in world
 * coordinate space (what gets stored/rendered/collision-checked).
 */
export interface StaticOrbitSlot {
  projectId: string;
  slotIndex: number;
  angle: number;
  isoX: number;
  isoY: number;
  worldX: number;
  worldY: number;
}

/**
 * Static geometric description of the single project orbit ellipse surrounding
 * the capability nucleus. Pure geometry — no runtime/animation state.
 */
export interface StaticOrbitGeometry {
  centerIso: { x: number; y: number };
  radiusX: number;
  radiusY: number;
  slots: StaticOrbitSlot[];
  visualBounds: { minX: number; maxX: number; minY: number; maxY: number };
  /**
   * Conservative bounds that stay valid across the ENTIRE revolution (PR22
   * orbital motion), not just the phase-0 static arrangement. Computed once,
   * analytically — never recomputed per animation frame. Because project
   * orientation never rotates, each project's visual envelope offset relative
   * to its own orbiting center is invariant under translation along the
   * ellipse; the worst-case offset in each direction, applied to the full
   * ellipse bounding box, bounds every possible phase.
   */
  motionVisualBounds: { minX: number; maxX: number; minY: number; maxY: number };
}

export interface AssembledTopologyPositions {
  projectPositions: Record<string, { x: number; y: number }>;
  skillPositions: Record<string, { x: number; y: number }>;
  orbitGeometry: StaticOrbitGeometry;
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

const ellipsePerimeter = (rx: number, ry: number): number =>
  2 * Math.PI * Math.sqrt((rx * rx + ry * ry) / 2);

/** Iso-space half-extent [x, y] of a project's footprint if it were placed at world origin. */
function isoFootprintHalfExtent(width: number, depth: number): { x: number; y: number } {
  const corners = [
    project3DToIso(0, 0, 0),
    project3DToIso(width, 0, 0),
    project3DToIso(width, depth, 0),
    project3DToIso(0, depth, 0),
  ];
  const xs = corners.map(c => c.x);
  const ys = corners.map(c => c.y);
  return {
    x: (Math.max(...xs) - Math.min(...xs)) / 2,
    y: (Math.max(...ys) - Math.min(...ys)) / 2,
  };
}

const ORBIT_CORE_CLEARANCE_ISO = 100; // breathing room (iso units) between capability core and orbit ellipse
const ORBIT_SLOT_MARGIN = 28; // additional iso-space margin reserved per project along the ellipse perimeter (preliminary heuristic only — actual visual-envelope validation below is authoritative)
const ORBIT_RADIUS_GROWTH_STEP = 24;
const ORBIT_MAX_GROWTH_ITERATIONS = 400;
const FIT_VIEWPORT_PADDING = 40; // modest final padding around the union of everything actually rendered

function unionVisualBounds(boxes: TopologyVisualBounds[]): TopologyVisualBounds {
  return {
    minX: Math.min(...boxes.map(b => b.minX)),
    maxX: Math.max(...boxes.map(b => b.maxX)),
    minY: Math.min(...boxes.map(b => b.minY)),
    maxY: Math.max(...boxes.map(b => b.maxY)),
  };
}

/**
 * Builds the single static elliptical project orbit surrounding the capability
 * nucleus. The ellipse is defined in isometric/visual space (so it reads as a
 * true ellipse on screen) and centered on the capability core's actual visual
 * bounds. Each project occupies exactly one evenly-spaced slot on that one
 * ellipse — growing N never adds another ring, only a larger ellipse.
 *
 * Canonical orbit positions are intentionally NOT grid-snapped: they are exact
 * continuous coordinates so the rendered project center lies precisely on the
 * ellipse track. Manual dragging remains governed by GRID_SNAP_STEP elsewhere.
 */
function buildStaticProjectOrbit(
  sortedProjects: ProjectData[],
  capabilityBoxes: PlacedNodeBounds[]
): { projectPositions: Record<string, { x: number; y: number }>; orbitGeometry: StaticOrbitGeometry } {
  // 1. Project the capability core into isometric/visual space to find the true visual nucleus.
  let coreMinIsoX = 0, coreMaxIsoX = 0, coreMinIsoY = 0, coreMaxIsoY = 0;
  if (capabilityBoxes.length > 0) {
    const corners: { x: number; y: number }[] = [];
    capabilityBoxes.forEach(box => {
      corners.push(project3DToIso(box.minX, box.minY, 0));
      corners.push(project3DToIso(box.maxX, box.minY, 0));
      corners.push(project3DToIso(box.maxX, box.maxY, 0));
      corners.push(project3DToIso(box.minX, box.maxY, 0));
    });
    coreMinIsoX = Math.min(...corners.map(c => c.x));
    coreMaxIsoX = Math.max(...corners.map(c => c.x));
    coreMinIsoY = Math.min(...corners.map(c => c.y));
    coreMaxIsoY = Math.max(...corners.map(c => c.y));
  }

  const centerIso = {
    x: (coreMinIsoX + coreMaxIsoX) / 2,
    y: (coreMinIsoY + coreMaxIsoY) / 2,
  };
  const coreHalfWidthIso = (coreMaxIsoX - coreMinIsoX) / 2;
  const coreHalfHeightIso = (coreMaxIsoY - coreMinIsoY) / 2;
  const coreIsoBounds: TopologyVisualBounds = { minX: coreMinIsoX, maxX: coreMaxIsoX, minY: coreMinIsoY, maxY: coreMaxIsoY };

  const projectPositions: Record<string, { x: number; y: number }> = {};
  const totalProjects = sortedProjects.length;

  if (totalProjects === 0) {
    const radiusX = coreHalfWidthIso + ORBIT_CORE_CLEARANCE_ISO;
    const radiusY = coreHalfHeightIso + ORBIT_CORE_CLEARANCE_ISO;
    const ellipseBounds: TopologyVisualBounds = {
      minX: centerIso.x - radiusX, maxX: centerIso.x + radiusX,
      minY: centerIso.y - radiusY, maxY: centerIso.y + radiusY,
    };
    const unioned = unionVisualBounds([coreIsoBounds, ellipseBounds]);
    const paddedBounds = {
      minX: unioned.minX - FIT_VIEWPORT_PADDING,
      maxX: unioned.maxX + FIT_VIEWPORT_PADDING,
      minY: unioned.minY - FIT_VIEWPORT_PADDING,
      maxY: unioned.maxY + FIT_VIEWPORT_PADDING,
    };
    return {
      projectPositions,
      orbitGeometry: {
        centerIso,
        radiusX,
        radiusY,
        slots: [],
        visualBounds: paddedBounds,
        motionVisualBounds: paddedBounds,
      },
    };
  }

  // 2. Base radius: clear the capability core plus the largest project's iso footprint.
  const projectDims = sortedProjects.map(p => getTopologyProjectDimensions(p));
  const footprintHalfExtents = projectDims.map(d => isoFootprintHalfExtent(d.width, d.depth));
  const maxFootprintIsoHalfX = Math.max(...footprintHalfExtents.map(e => e.x));
  const maxFootprintIsoHalfY = Math.max(...footprintHalfExtents.map(e => e.y));

  let radiusX = coreHalfWidthIso + ORBIT_CORE_CLEARANCE_ISO + maxFootprintIsoHalfX;
  let radiusY = coreHalfHeightIso + ORBIT_CORE_CLEARANCE_ISO + maxFootprintIsoHalfY;

  // 3. Grow the single ellipse until its perimeter can comfortably host every project slot.
  const totalSlotRequirement = projectDims.reduce(
    (sum, d) => sum + Math.max(d.width, d.depth) + ORBIT_SLOT_MARGIN,
    0
  );
  let growthIterations = 0;
  while (ellipsePerimeter(radiusX, radiusY) < totalSlotRequirement && growthIterations < ORBIT_MAX_GROWTH_ITERATIONS) {
    radiusX += ORBIT_RADIUS_GROWTH_STEP;
    radiusY += ORBIT_RADIUS_GROWTH_STEP * 0.72;
    growthIterations++;
  }

  // 4. Evenly distribute one slot per project, starting at the top, going clockwise.
  // Positions are the EXACT inverse-projection of the ellipse point — no grid
  // snapping — so the rendered project center lies precisely on the track.
  //
  // `angleOffset` mirrors PR22's shared orbit phase: this same base-angle
  // formula plus a uniform offset is exactly what orbitMotion.ts's
  // getOrbitalProjectPositionAtPhase computes at runtime. Duplicated here
  // (rather than imported) so this module stays self-contained; the two are
  // covered by cross-checking tests.
  const positionAtAngle = (
    dims: TopologyProjectDimensions,
    angle: number,
    rx: number,
    ry: number
  ): { isoX: number; isoY: number; origin: { x: number; y: number } } => {
    const isoX = centerIso.x + rx * Math.cos(angle);
    const isoY = centerIso.y + ry * Math.sin(angle);
    const worldCenter = projectIsoTo3D(isoX, isoY);
    return { isoX, isoY, origin: { x: worldCenter.x - dims.width / 2, y: worldCenter.y - dims.depth / 2 } };
  };

  const computeSlots = (rx: number, ry: number) => {
    const slots: StaticOrbitSlot[] = [];
    const positions: Record<string, { x: number; y: number }> = {};
    const visualBoxes: TopologyVisualBounds[] = [];

    for (let i = 0; i < totalProjects; i++) {
      const project = sortedProjects[i];
      const dims = projectDims[i];
      const angle = (i / totalProjects) * 2 * Math.PI - Math.PI / 2;
      const { isoX, isoY, origin } = positionAtAngle(dims, angle, rx, ry);

      positions[project.id] = origin;
      slots.push({
        projectId: project.id,
        slotIndex: i,
        angle,
        isoX,
        isoY,
        worldX: origin.x,
        worldY: origin.y,
      });
      visualBoxes.push(getTopologyProjectVisualBounds(project, origin));
    }

    return { slots, positions, visualBoxes };
  };

  // PR22 introduces autonomous orbital motion: every project shares one phase
  // and revolves through EVERY angular position over a full revolution, not
  // just its phase-0 slot. A radius that is collision-safe only at phase 0 is
  // NOT proven safe through the whole revolution — slot chord distances vary
  // around an ellipse, and project footprints/callouts differ in size, so a
  // wide project rotating into a "tight" arc position (or past a mismatched
  // neighbor) can overlap even when the phase-0 arrangement was clear. So the
  // authority for growing the ellipse is a full-revolution sweep, not a
  // single static check.
  const MOTION_SWEEP_SAMPLES = 72; // 5-degree increments

  const hasOverlapAcrossRevolution = (rx: number, ry: number): boolean => {
    for (let s = 0; s < MOTION_SWEEP_SAMPLES; s++) {
      const angleOffset = (s / MOTION_SWEEP_SAMPLES) * 2 * Math.PI;
      const boxes: TopologyVisualBounds[] = [];
      for (let i = 0; i < totalProjects; i++) {
        const angle = (i / totalProjects) * 2 * Math.PI - Math.PI / 2 + angleOffset;
        const { origin } = positionAtAngle(projectDims[i], angle, rx, ry);
        boxes.push(getTopologyProjectVisualBounds(sortedProjects[i], origin));
      }
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          if (checkAABBOverlap(boxes[i], boxes[j], 0)) return true;
        }
        if (checkAABBOverlap(boxes[i], coreIsoBounds, 0)) return true;
      }
    }
    return false;
  };

  // 5. Validate zero-overlap ACROSS THE FULL REVOLUTION against the actual
  // rendered visual envelopes; if the heuristic radius wasn't quite enough,
  // grow the whole ellipse uniformly and re-check (never nudge a single slot
  // independently — the perimeter must stay one coherent ellipse, safe at
  // every phase, not just phase 0).
  let validationIterations = 0;
  while (hasOverlapAcrossRevolution(radiusX, radiusY) && validationIterations < ORBIT_MAX_GROWTH_ITERATIONS) {
    radiusX += ORBIT_RADIUS_GROWTH_STEP;
    radiusY += ORBIT_RADIUS_GROWTH_STEP * 0.72;
    validationIterations++;
  }

  if (hasOverlapAcrossRevolution(radiusX, radiusY)) {
    throw new Error('Deterministic layout failed: unable to place a motion-safe static project orbit without collision.');
  }

  const { slots, positions, visualBoxes } = computeSlots(radiusX, radiusY);
  Object.assign(projectPositions, positions);

  const ellipseBounds: TopologyVisualBounds = {
    minX: centerIso.x - radiusX, maxX: centerIso.x + radiusX,
    minY: centerIso.y - radiusY, maxY: centerIso.y + radiusY,
  };
  const unioned = unionVisualBounds([coreIsoBounds, ellipseBounds, ...visualBoxes]);
  const visualBounds: TopologyVisualBounds = {
    minX: unioned.minX - FIT_VIEWPORT_PADDING,
    maxX: unioned.maxX + FIT_VIEWPORT_PADDING,
    minY: unioned.minY - FIT_VIEWPORT_PADDING,
    maxY: unioned.maxY + FIT_VIEWPORT_PADDING,
  };

  // Motion-safe bounds: each project's visual envelope offset relative to its
  // OWN orbiting center (slot.isoX/isoY) is invariant under translation along
  // the ellipse (orientation never rotates), so the worst-case offset in each
  // direction — computed once from the phase-0 envelopes already on hand —
  // bounds every possible phase without re-deriving anything per frame.
  let maxOffsetLeft = 0, maxOffsetRight = 0, maxOffsetTop = 0, maxOffsetBottom = 0;
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const box = visualBoxes[i];
    maxOffsetLeft = Math.max(maxOffsetLeft, slot.isoX - box.minX);
    maxOffsetRight = Math.max(maxOffsetRight, box.maxX - slot.isoX);
    maxOffsetTop = Math.max(maxOffsetTop, slot.isoY - box.minY);
    maxOffsetBottom = Math.max(maxOffsetBottom, box.maxY - slot.isoY);
  }
  const motionEllipseBounds: TopologyVisualBounds = {
    minX: centerIso.x - radiusX - maxOffsetLeft,
    maxX: centerIso.x + radiusX + maxOffsetRight,
    minY: centerIso.y - radiusY - maxOffsetTop,
    maxY: centerIso.y + radiusY + maxOffsetBottom,
  };
  const motionUnioned = unionVisualBounds([coreIsoBounds, motionEllipseBounds]);
  const motionVisualBounds: TopologyVisualBounds = {
    minX: motionUnioned.minX - FIT_VIEWPORT_PADDING,
    maxX: motionUnioned.maxX + FIT_VIEWPORT_PADDING,
    minY: motionUnioned.minY - FIT_VIEWPORT_PADDING,
    maxY: motionUnioned.maxY + FIT_VIEWPORT_PADDING,
  };

  return {
    projectPositions,
    orbitGeometry: {
      centerIso,
      radiusX,
      radiusY,
      slots,
      visualBounds,
      motionVisualBounds,
    },
  };
}

export interface FitViewportOptions {
  /** Fraction of the available container to actually fill (breathing room). Default 0.95. */
  paddingFactor?: number;
  /** Absolute floor on zoom — only a safety net against pathological (near-zero) values. Default 0.15. */
  minZoom?: number;
  /** Absolute ceiling on zoom, so a tiny lattice doesn't zoom in absurdly far. Default 1.2. */
  maxZoom?: number;
}

export interface FitViewportResult {
  zoom: number;
  x: number;
  y: number;
}

/**
 * Pure viewport-fit calculation: given a visual bounds box and a container
 * size, returns the zoom/pan that frames the bounds entirely, unit-testable
 * without any DOM. `minZoom` is a last-resort floor — it must stay low enough
 * that it never binds for realistic layouts, otherwise it silently clips the
 * bounds it was supposed to protect.
 */
export function computeFitViewport(
  bounds: TopologyVisualBounds,
  containerWidth: number,
  containerHeight: number,
  options: FitViewportOptions = {}
): FitViewportResult {
  const paddingFactor = options.paddingFactor ?? 0.95;
  const minZoom = options.minZoom ?? 0.15;
  const maxZoom = options.maxZoom ?? 1.2;

  const boundsWidth = Math.max(bounds.maxX - bounds.minX, 1);
  const boundsHeight = Math.max(bounds.maxY - bounds.minY, 1);
  const midX = (bounds.minX + bounds.maxX) / 2;
  const midY = (bounds.minY + bounds.maxY) / 2;

  const fitRatio = Math.min(containerWidth / boundsWidth, containerHeight / boundsHeight) * paddingFactor;
  const zoom = Number(Math.min(Math.max(fitRatio, minZoom), maxZoom).toFixed(4));

  return { zoom, x: -midX * zoom, y: -midY * zoom };
}

/**
 * Computes an instant, deterministic, and collision-safe schematic layout.
 *
 * Hierarchy:
 * - Capabilities: Inner core backbone rings (expanding as capacity requires)
 * - Projects: ONE static outer elliptical orbit, strictly outside the entire
 *   capability core, growing radius (never adding a second ring) as N increases.
 *
 * Coordinate Semantics:
 * - Project coordinates: TOP-LEFT origin of the structure box.
 * - Skill coordinates: CENTER of the capability plinth.
 *
 * Guarantees:
 * - Deterministic output: identical inputs produce identical coordinates.
 * - Stable sorting: input array ordering changes do NOT change coordinates.
 * - Dynamic scaling: the orbit ellipse grows to fit capacity; capability rings
 *   still expand as needed.
 * - Guaranteed collision-safe: verifies bounding-box clearance before writing positions.
 * - Capability (skill) coordinates are grid-snapped to GRID_SNAP_STEP. Canonical
 *   project orbit coordinates are intentionally continuous (exact ellipse
 *   positions, not grid-snapped) — see buildStaticProjectOrbit.
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

  if (totalSkills === 1) {
    // Single capability at center (0, 0)
    const skill = sortedSkills[0];
    const pos = { x: 0, y: 0 };
    const bounds = getNodeBounds('skill', pos, 48, 48);
    skillPositions[skill.id] = pos;
    placedBoxes.push({ id: skill.id, type: 'skill', ...bounds });
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
      }

      // Expand to next capability ring
      rx += 80;
      ry += 60;
      ringIndex++;
    }
  }

  // 4. Layout Projects: ONE static elliptical orbit surrounding the capability nucleus.
  // `placedBoxes` at this point contains only capability (skill) boxes.
  const { projectPositions: orbitProjectPositions, orbitGeometry } = buildStaticProjectOrbit(
    sortedProjects,
    placedBoxes
  );
  Object.assign(projectPositions, orbitProjectPositions);

  return { projectPositions, skillPositions, orbitGeometry };
}
