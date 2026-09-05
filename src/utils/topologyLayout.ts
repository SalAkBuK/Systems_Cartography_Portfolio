import { ProjectData, InfrastructureSkill, TopologyViewMode } from '../types';
import { GRID_SNAP_STEP } from './collision';
import { project3DToIso, projectIsoTo3D } from './isometricProjection';
import {
  getTopologyProjectDimensions,
  getTopologyProjectVisualBounds,
  wrapCalloutTitle,
  PROJECT_CALLOUT_WIDTH,
  type TopologyVisualBounds,
  type TopologyProjectDimensions
} from './projectTopologyGeometry';
import {
  allocateProjectRings,
  getProjectRingBaseRateMultiplier,
  getProjectRingId,
} from './projectRingAllocation';

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

/**
 * One concentric project ring: a first-class topology primitive. Every
 * project belongs to exactly one ring (see `projectRingAllocation.ts`), and
 * a ring's own `geometry` is the same `StaticOrbitGeometry` shape the
 * original single-ring topology always used -- scoped to just this ring's
 * projects. Rings are concentric (shared `centerIso` via the geometry) with
 * strictly increasing radius outward from the Capability Reactor.
 */
export interface ProjectOrbitRing {
  id: string;
  index: number;
  /** Canonical project ids assigned to this ring, in canonical order. */
  projectIds: string[];
  geometry: StaticOrbitGeometry;
  /** Multiplied by the global user-selected SYSTEMS rate to get this ring's effective rate. */
  baseRateMultiplier: number;
  direction: 'clockwise';
}

export interface AssembledTopologyPositions {
  projectPositions: Record<string, { x: number; y: number }>;
  skillPositions: Record<string, { x: number; y: number }>;
  /**
   * Ring 0's own geometry (or a reactor-clearance-only empty ellipse when
   * there are zero projects). Kept for backward compatibility with the
   * original single-ring topology -- always genuinely equal to
   * `projectRings[0]?.geometry`, never synthesized/divergent data. Prefer
   * `projectRings` for anything that needs to be ring-count-aware.
   */
  orbitGeometry: StaticOrbitGeometry;
  /** Every concentric project ring, inner (index 0) to outer. */
  projectRings: ProjectOrbitRing[];
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
/**
 * Single deterministic increment by which the project orbit ellipse grows when
 * a candidate radius fails a collision-safety invariant. `radiusX` grows by
 * this; `radiusY` grows by `ORBIT_RADIUS_GROWTH_STEP * ORBIT_RADIUS_GROWTH_ASPECT`
 * so the ellipse keeps its shape. Exported so layout regressions can assert the
 * returned radius is the SMALLEST multiple-of-step that satisfies every invariant.
 */
export const ORBIT_RADIUS_GROWTH_STEP = 24;
export const ORBIT_RADIUS_GROWTH_ASPECT = 0.72;
const ORBIT_MAX_GROWTH_ITERATIONS = 400;
const FIT_VIEWPORT_PADDING = 40; // modest final padding around the union of everything actually rendered

/**
 * Fixed radial allowance (iso units) added between two neighboring project
 * rings, on top of both rings' own worst-case project-block footprint
 * half-extents (computed at the call site from what is actually being
 * rendered — never a bare "+50"). `ORBIT_SLOT_MARGIN` mirrors the same
 * breathing room already trusted within a single ring; `PROJECT_CALLOUT_WIDTH`
 * covers a project's rendered title callout, which can extend well beyond
 * its structural block and is not included in the block-footprint
 * calculation this spacing is added to.
 */
const PROJECT_RING_SPACING_ISO = ORBIT_SLOT_MARGIN + PROJECT_CALLOUT_WIDTH;

/**
 * Capability (skill) nodes are placed as fixed 48x48 logical footprints --
 * every getNodeBounds('skill', ..., width, height) call in the capability
 * ring loop below passes this exact size. It is the footprint the ring
 * spacing invariant below is measured against: what actually gets rendered
 * and collision-checked, never a separately-assumed size.
 */
const CAPABILITY_NODE_FOOTPRINT = 48;
const CAPABILITY_NODE_HALF_FOOTPRINT = CAPABILITY_NODE_FOOTPRINT / 2;

/**
 * Initial radial guess (world units) enforced between one capability ring's
 * REALIZED outer envelope (see `outerX`/`outerY` on `CapabilityRingPlacement`
 * -- measured from where nodes actually land, including any collision-driven
 * radial adjustment, never the nominal seed radius that only describes where
 * slots started) and the next ring's own node footprint, before the
 * measured-clearance growth loop below takes over. Replaces a flat
 * "rx += 80 / ry += 60" increment that had no relationship to what actually
 * got placed (for the committed portfolio's real ~28-capability data, that
 * flat increment left as little as ~2 world units of actual Y clearance once
 * ring 0's realized packing was accounted for).
 *
 * This alone is NOT the spacing invariant -- it is only a starting point for
 * `CAPABILITY_RING_MIN_ISO_CLEARANCE` below to refine, because a world-space
 * radial gap measured only along a ring's cardinal X/Y axes does not
 * guarantee a genuine gap at every other angle around two elliptical rings
 * populated at different angles/densities: a node's collision-driven radial
 * push (below) moves it outward along ITS OWN angle, not necessarily X or Y,
 * so this axis-only floor can under-count how far a node actually landed.
 */
const CAPABILITY_RING_SEED_CLEARANCE = GRID_SNAP_STEP * 3;

/**
 * The REAL spacing invariant: minimum allowed gap, in isometric/visual space
 * -- the same coordinate space `ORBIT_CORE_CLEARANCE_ISO` already measures
 * capability-core-to-project-orbit breathing room in -- between the NEAREST
 * rendered envelopes of two adjacent capability rings' actual placed nodes.
 * Verified directly by measurement (`measureMinIsoGapToPreviousRing` below),
 * not inferred from seed-radius arithmetic: the isometric projection turns
 * each axis-aligned 48x48 node footprint into a rotated diamond, so two
 * nodes comfortably separated along a ring's cardinal axes can still project
 * to near-touching iso bounding boxes if the offset between them runs along
 * a different direction -- exactly how the previous (seed-radius-only) fix
 * still measured as little as ~2-4 iso units of actual rendered gap despite
 * satisfying its own formula. `tests/capabilityRingSpacing.test.ts` asserts
 * this same measurement against real placed positions, not just the formula.
 */
export const CAPABILITY_RING_MIN_ISO_CLEARANCE = 60;

/** World-unit step by which a ring's radius grows when the measured ISO clearance to the previous ring falls short of the invariant. */
const CAPABILITY_RING_CLEARANCE_GROWTH_STEP = 16;
const CAPABILITY_RING_MAX_CLEARANCE_GROWTH_ITERATIONS = 200;

/** One concentric capability ring's placement diagnostics -- see `buildCapabilityRingLayout`. */
export interface CapabilityRingPlacement {
  ringIndex: number;
  skillIds: string[];
  /** Radii this ring's slots were actually placed at (after any clearance-driven growth), before per-node collision-driven adjustment. */
  seedRadiusX: number;
  seedRadiusY: number;
  /** Realized outer envelope after placement -- input for the next ring's initial seed guess. */
  outerX: number;
  outerY: number;
}

function snapToGrid(val: number, step: number = GRID_SNAP_STEP): number {
  return (Math.round(val / step) * step) || 0;
}

/** Projects a world-space AABB's four corners into isometric/visual space and returns their bounding box -- the same technique used for the capability core and project visual bounds elsewhere in this module. Exported so regressions can measure the same real, rendered gap this invariant is defined against. */
export function isoBoxFromWorldBounds(bounds: { minX: number; maxX: number; minY: number; maxY: number }): TopologyVisualBounds {
  const corners = [
    project3DToIso(bounds.minX, bounds.minY, 0),
    project3DToIso(bounds.maxX, bounds.minY, 0),
    project3DToIso(bounds.maxX, bounds.maxY, 0),
    project3DToIso(bounds.minX, bounds.maxY, 0),
  ];
  return {
    minX: Math.min(...corners.map(c => c.x)),
    maxX: Math.max(...corners.map(c => c.x)),
    minY: Math.min(...corners.map(c => c.y)),
    maxY: Math.max(...corners.map(c => c.y)),
  };
}

/** Minimum Euclidean distance between two axis-aligned rectangles (0 if they touch or overlap). */
export function minRectDistance(a: TopologyVisualBounds, b: TopologyVisualBounds): number {
  const dx = Math.max(b.minX - a.maxX, a.minX - b.maxX, 0);
  const dy = Math.max(b.minY - a.maxY, a.minY - b.maxY, 0);
  return Math.hypot(dx, dy);
}

/** Smallest measured iso-space gap between any node of the candidate ring and any node of the previous ring (Infinity if there is no previous ring). */
function measureMinIsoGapToPreviousRing(candidateBoxes: PlacedNodeBounds[], previousRingIsoBoxes: TopologyVisualBounds[]): number {
  if (previousRingIsoBoxes.length === 0) return Infinity;
  let min = Infinity;
  for (const box of candidateBoxes) {
    const isoBox = isoBoxFromWorldBounds(box);
    for (const prevIsoBox of previousRingIsoBoxes) {
      min = Math.min(min, minRectDistance(isoBox, prevIsoBox));
    }
  }
  return min;
}

/**
 * Builds one or more concentric capability rings around the topology center.
 * Skills are batched onto each ring by how many fit its perimeter (unchanged
 * heuristic), then each is placed via the existing deterministic
 * collision-avoidance search (unchanged in mechanism, but re-runnable at a
 * larger radius -- see below). What this changes from the original
 * fixed-increment loop, in two layers:
 *
 * 1. Ring N+1's INITIAL radius guess derives from ring N's REALIZED outer
 *    envelope (the actual placed bounds, including any collision-driven
 *    pushback) plus this ring's own footprint plus
 *    `CAPABILITY_RING_SEED_CLEARANCE` -- instead of a flat "+80/+60" with no
 *    relationship to what actually got placed.
 * 2. That guess is then verified by ACTUALLY PLACING the ring and measuring
 *    the real isometric-space gap to the previous ring's actual placed
 *    nodes (`measureMinIsoGapToPreviousRing`). If the measured gap falls
 *    short of `CAPABILITY_RING_MIN_ISO_CLEARANCE`, the radius grows and the
 *    ENTIRE ring is re-placed (never a single slot nudged independently),
 *    repeating until the real invariant holds. Only the immediately
 *    preceding ring is checked -- exactly the same reasoning
 *    `buildProjectOrbitRings` already documents for project rings: because
 *    each ring's radius is only ever grown outward from its predecessor's
 *    realized state, a verified gap to the immediate neighbor, combined with
 *    strictly increasing radii, rules out any farther-out ring ever being
 *    closer.
 */
export function buildCapabilityRingLayout(
  sortedSkills: InfrastructureSkill[]
): { skillPositions: Record<string, { x: number; y: number }>; placedBoxes: PlacedNodeBounds[]; rings: CapabilityRingPlacement[] } {
  const skillPositions: Record<string, { x: number; y: number }> = {};
  const placedBoxes: PlacedNodeBounds[] = [];
  const rings: CapabilityRingPlacement[] = [];

  let unplacedSkills = [...sortedSkills];
  let ringIndex = 0;
  let rx = 90;
  let ry = 65;
  let previousOuterX = 0;
  let previousOuterY = 0;
  let previousRingIsoBoxes: TopologyVisualBounds[] = [];

  while (unplacedSkills.length > 0) {
    if (ringIndex > 0) {
      rx = previousOuterX + CAPABILITY_NODE_HALF_FOOTPRINT + CAPABILITY_RING_SEED_CLEARANCE;
      ry = previousOuterY + CAPABILITY_NODE_HALF_FOOTPRINT + CAPABILITY_RING_SEED_CLEARANCE;
    }

    // Approximate ellipse perimeter = 2 * PI * sqrt((rx^2 + ry^2) / 2)
    const perimeter = 2 * Math.PI * Math.sqrt((rx * rx + ry * ry) / 2);
    // Capability footprint is 48x48; safe arc spacing ~75px per node along perimeter
    const capacity = Math.max(3, Math.floor(perimeter / 75));
    const batchCount = Math.min(unplacedSkills.length, capacity);
    const batch = unplacedSkills.slice(0, batchCount);
    unplacedSkills = unplacedSkills.slice(batchCount);

    const angleStagger = ringIndex > 0 ? (ringIndex * Math.PI) / batchCount : 0;

    // Places this ring's fixed batch at the given (attemptRx, attemptRy),
    // reusing the existing per-node deterministic collision-avoidance search
    // unchanged. Callable repeatedly at growing radii by the clearance loop
    // below without mutating any outer state until an attempt is accepted --
    // checks each candidate against both already-COMMITTED boxes from prior
    // rings (`placedBoxes`) and this attempt's own boxes placed so far.
    const placeBatchAt = (attemptRx: number, attemptRy: number) => {
      const positions: Record<string, { x: number; y: number }> = {};
      const boxes: PlacedNodeBounds[] = [];
      let ringOuterX = 0;
      let ringOuterY = 0;

      for (let i = 0; i < batch.length; i++) {
        const skill = batch[i];
        const angle = (i / batchCount) * 2 * Math.PI - Math.PI / 2 + angleStagger;

        let candX = snapToGrid(Math.cos(angle) * attemptRx);
        let candY = snapToGrid(Math.sin(angle) * attemptRy);
        let candBounds = getNodeBounds('skill', { x: candX, y: candY }, CAPABILITY_NODE_FOOTPRINT, CAPABILITY_NODE_FOOTPRINT);

        // Deterministic collision search with radial stepping & candidate ring expansion
        let isCollisionFree = false;
        let step = 0;
        let currentCandRx = attemptRx;
        let currentCandRy = attemptRy;

        const collidesWithAnyPlaced = () =>
          placedBoxes.some(box => checkAABBOverlap(candBounds, box, 12)) ||
          boxes.some(box => checkAABBOverlap(candBounds, box, 12));

        while (!isCollisionFree && step < 80) {
          if (!collidesWithAnyPlaced()) {
            isCollisionFree = true;
            break;
          }
          step++;
          if (step % 8 === 0) {
            currentCandRx += GRID_SNAP_STEP * 2;
            currentCandRy += GRID_SNAP_STEP * 2;
          }
          const rayOffset = (step % 8) * GRID_SNAP_STEP;
          candX = snapToGrid(Math.cos(angle) * (currentCandRx + rayOffset));
          candY = snapToGrid(Math.sin(angle) * (currentCandRy + rayOffset));
          candBounds = getNodeBounds('skill', { x: candX, y: candY }, CAPABILITY_NODE_FOOTPRINT, CAPABILITY_NODE_FOOTPRINT);
        }

        if (!isCollisionFree) {
          throw new Error(`Deterministic layout failed: unable to place capability ${skill.id} without collision.`);
        }

        positions[skill.id] = { x: candX, y: candY };
        boxes.push({ id: skill.id, type: 'skill' as const, ...candBounds });
        ringOuterX = Math.max(ringOuterX, Math.abs(candBounds.minX), Math.abs(candBounds.maxX));
        ringOuterY = Math.max(ringOuterY, Math.abs(candBounds.minY), Math.abs(candBounds.maxY));
      }

      return { positions, boxes, ringOuterX, ringOuterY };
    };

    let placement = placeBatchAt(rx, ry);
    let growthIterations = 0;
    while (
      measureMinIsoGapToPreviousRing(placement.boxes, previousRingIsoBoxes) < CAPABILITY_RING_MIN_ISO_CLEARANCE &&
      growthIterations < CAPABILITY_RING_MAX_CLEARANCE_GROWTH_ITERATIONS
    ) {
      rx += CAPABILITY_RING_CLEARANCE_GROWTH_STEP;
      ry += CAPABILITY_RING_CLEARANCE_GROWTH_STEP;
      placement = placeBatchAt(rx, ry);
      growthIterations++;
    }
    if (measureMinIsoGapToPreviousRing(placement.boxes, previousRingIsoBoxes) < CAPABILITY_RING_MIN_ISO_CLEARANCE) {
      throw new Error(`Deterministic layout failed: unable to maintain minimum capability ring clearance at ring ${ringIndex}.`);
    }

    Object.assign(skillPositions, placement.positions);
    placedBoxes.push(...placement.boxes);

    rings.push({
      ringIndex,
      skillIds: batch.map(s => s.id),
      seedRadiusX: rx,
      seedRadiusY: ry,
      outerX: placement.ringOuterX,
      outerY: placement.ringOuterY,
    });

    previousOuterX = placement.ringOuterX;
    previousOuterY = placement.ringOuterY;
    previousRingIsoBoxes = placement.boxes.map(box => isoBoxFromWorldBounds(box));
    ringIndex++;
  }

  return { skillPositions, placedBoxes, rings };
}

/** Worst-case iso-space footprint half-extent across a set of projects (0 for an empty set). */
function computeMaxProjectFootprintIsoHalfExtent(projects: ProjectData[]): { x: number; y: number } {
  if (projects.length === 0) return { x: 0, y: 0 };
  const extents = projects.map(p => {
    const dims = getTopologyProjectDimensions(p);
    return isoFootprintHalfExtent(dims.width, dims.depth);
  });
  return {
    x: Math.max(...extents.map(e => e.x)),
    y: Math.max(...extents.map(e => e.y)),
  };
}

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
 *
 * `radiusFloor` (optional) is used only by the multi-ring builder below to
 * push an outer ring's starting radius past its inner neighbor's outer edge
 * before this function's own base-radius heuristic and full-revolution
 * validation take over exactly as they do for a single ring. Omitted (the
 * single-ring / ring-0 case), behavior is byte-identical to before this
 * parameter existed.
 */
function buildStaticProjectOrbit(
  sortedProjects: ProjectData[],
  capabilityBoxes: PlacedNodeBounds[],
  radiusFloor?: { minRadiusX: number; minRadiusY: number }
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

  let radiusX = Math.max(
    coreHalfWidthIso + ORBIT_CORE_CLEARANCE_ISO + maxFootprintIsoHalfX,
    radiusFloor?.minRadiusX ?? 0
  );
  let radiusY = Math.max(
    coreHalfHeightIso + ORBIT_CORE_CLEARANCE_ISO + maxFootprintIsoHalfY,
    radiusFloor?.minRadiusY ?? 0
  );

  // 3. Grow the single ellipse until its perimeter can comfortably host every project slot.
  const totalSlotRequirement = projectDims.reduce(
    (sum, d) => sum + Math.max(d.width, d.depth) + ORBIT_SLOT_MARGIN,
    0
  );
  let growthIterations = 0;
  while (ellipsePerimeter(radiusX, radiusY) < totalSlotRequirement && growthIterations < ORBIT_MAX_GROWTH_ITERATIONS) {
    radiusX += ORBIT_RADIUS_GROWTH_STEP;
    radiusY += ORBIT_RADIUS_GROWTH_STEP * ORBIT_RADIUS_GROWTH_ASPECT;
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

  // Interactive project reordering (projectDocking.ts / interactiveOrbitOrder)
  // lets a visitor drop ANY project immediately before ANY other on this same
  // ellipse. The canonical sweep above only proves the ONE adjacency each
  // project has in canonical order — so a radius that is canonical-safe can
  // still let a visitor place the two widest blocks side by side and overlap.
  // This proves the stronger invariant: EVERY ordered project pair stays
  // collision-free when placed one slot apart (angular separation 2*PI/N) at
  // every point on the orbit. It is bounded, never factorial: O(N^2) pairs x a
  // full-revolution sweep, reusing the identical visual-envelope + AABB
  // primitives. Each project's rendered envelope, taken relative to its own
  // orbiting centre, is invariant under translation along the ellipse (project
  // orientation never rotates — the same property motionVisualBounds relies
  // on), so it is precomputed once and the sweep is pure arithmetic. Wider slot
  // separations only ever gain chord clearance on this ellipse, so proving the
  // 1-slot adjacency is sufficient for every wider reordering.
  const slotAngularStep = (2 * Math.PI) / totalProjects;
  // Same effective angular resolution as the "arbitrary interactive order
  // safety" regression (its nested slot x phase sweep resolves to ~2*PI/(N*72)).
  const REORDER_SWEEP_SAMPLES = totalProjects * MOTION_SWEEP_SAMPLES;
  const isoZeroWorld = projectIsoTo3D(0, 0);
  const envelopeAtOrbitCentre: TopologyVisualBounds[] = sortedProjects.map((project, i) => {
    const dims = projectDims[i];
    return getTopologyProjectVisualBounds(project, {
      x: isoZeroWorld.x - dims.width / 2,
      y: isoZeroWorld.y - dims.depth / 2,
    });
  });
  const translatedBox = (i: number, isoCentre: { x: number; y: number }): TopologyVisualBounds => {
    const e = envelopeAtOrbitCentre[i];
    return {
      minX: e.minX + isoCentre.x,
      maxX: e.maxX + isoCentre.x,
      minY: e.minY + isoCentre.y,
      maxY: e.maxY + isoCentre.y,
    };
  };

  const hasReorderAdjacencyOverlap = (rx: number, ry: number): boolean => {
    for (let m = 0; m < REORDER_SWEEP_SAMPLES; m++) {
      const leadAngle = (m / REORDER_SWEEP_SAMPLES) * 2 * Math.PI - Math.PI / 2;
      const trailAngle = leadAngle + slotAngularStep;
      const leadCentre = { x: centerIso.x + rx * Math.cos(leadAngle), y: centerIso.y + ry * Math.sin(leadAngle) };
      const trailCentre = { x: centerIso.x + rx * Math.cos(trailAngle), y: centerIso.y + ry * Math.sin(trailAngle) };
      for (let a = 0; a < totalProjects; a++) {
        const boxLead = translatedBox(a, leadCentre);
        for (let b = 0; b < totalProjects; b++) {
          if (a === b) continue;
          if (checkAABBOverlap(boxLead, translatedBox(b, trailCentre), 0)) return true;
        }
      }
    }
    return false;
  };

  // The canonical per-project core check inside hasOverlapAcrossRevolution
  // above samples MOTION_SWEEP_SAMPLES (72) angles for each project, offset
  // by THAT PROJECT'S OWN canonical index -- proven sufficient for the
  // canonical rotating ring (every project always at its own slot). Under
  // interactive reordering, though, a project can land at ANY of the N slot
  // indices, which (because N and 72 share no common structure in general)
  // sweeps a angles the per-project canonical grid never sampled — up to
  // REORDER_SWEEP_SAMPLES (N*72) distinct positions, the same resolution
  // hasReorderAdjacencyOverlap already requires for project-vs-project
  // safety above. A radius could satisfy the coarser canonical check while
  // still letting a reordered project's envelope clip the capability core at
  // one of the finer, unsampled angles — exactly the gap that let a larger
  // capability core (PR: capability ring spacing) slip through undetected
  // here despite failing the dedicated arbitrary-reorder core-clearance
  // regression. This closes that gap directly, at the same fine resolution,
  // reusing the identical translatedBox primitive.
  const hasReorderCoreInvasion = (rx: number, ry: number): boolean => {
    for (let m = 0; m < REORDER_SWEEP_SAMPLES; m++) {
      const angle = (m / REORDER_SWEEP_SAMPLES) * 2 * Math.PI - Math.PI / 2;
      const centre = { x: centerIso.x + rx * Math.cos(angle), y: centerIso.y + ry * Math.sin(angle) };
      for (let a = 0; a < totalProjects; a++) {
        if (checkAABBOverlap(translatedBox(a, centre), coreIsoBounds, 0)) return true;
      }
    }
    return false;
  };

  const isOrbitRadiusSafe = (rx: number, ry: number): boolean =>
    !hasOverlapAcrossRevolution(rx, ry) && !hasReorderAdjacencyOverlap(rx, ry) && !hasReorderCoreInvasion(rx, ry);

  // 5. Validate zero-overlap ACROSS THE FULL REVOLUTION against the actual
  // rendered visual envelopes — for the canonical ordering AND for every
  // supported interactive reordering; if the heuristic radius wasn't quite
  // enough, grow the whole ellipse uniformly and re-check (never nudge a single
  // slot independently — the perimeter must stay one coherent ellipse, safe at
  // every phase, not just phase 0). The loop returns the smallest radius under
  // ORBIT_RADIUS_GROWTH_STEP that satisfies both invariants; an already-safe
  // radius grows zero times.
  let validationIterations = 0;
  while (!isOrbitRadiusSafe(radiusX, radiusY) && validationIterations < ORBIT_MAX_GROWTH_ITERATIONS) {
    radiusX += ORBIT_RADIUS_GROWTH_STEP;
    radiusY += ORBIT_RADIUS_GROWTH_STEP * ORBIT_RADIUS_GROWTH_ASPECT;
    validationIterations++;
  }

  if (!isOrbitRadiusSafe(radiusX, radiusY)) {
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

/**
 * Splits the full canonical project collection into one or more concentric
 * rings (see `projectRingAllocation.ts` for the capacity/assignment rule)
 * and builds each ring's own `StaticOrbitGeometry` outward from the
 * Capability Reactor.
 *
 * Each ring's radius floor is derived directly from rendered envelopes: the
 * previous ring's own outer radius, plus both rings' worst-case project
 * footprint half-extents, plus the fixed callout/breathing allowance
 * (`PROJECT_RING_SPACING_ISO`). Because `buildStaticProjectOrbit` never
 * shrinks below a supplied floor — its own within-ring growth loop only
 * ever grows radiusX/radiusY further to satisfy its OWN collision-safety
 * sweep — clearance from the ring immediately inside can only improve, never
 * regress, once the floor guarantees it at the starting radius. (A
 * bounding-box overlap check between rings was deliberately NOT used here:
 * every ring's motion envelope is a box centered on the shared topology
 * center, so any two such boxes always overlap near that shared center
 * regardless of radius — the radial floor above is the correct authority.)
 *
 * At 1 ring (<=18 projects) this reproduces the original single-ring
 * geometry exactly: ring 0 receives no radius floor, so its base-radius
 * heuristic and full-revolution validation run byte-identical to before
 * multi-ring support existed.
 */
function buildProjectOrbitRings(
  sortedProjects: ProjectData[],
  capabilityBoxes: PlacedNodeBounds[]
): { rings: ProjectOrbitRing[]; projectPositions: Record<string, { x: number; y: number }> } {
  const projectIds = sortedProjects.map(p => p.id);
  const allocation = allocateProjectRings(projectIds);
  const projectPositions: Record<string, { x: number; y: number }> = {};
  if (allocation.ringCount === 0) return { rings: [], projectPositions };

  const projectsById = new Map(sortedProjects.map(p => [p.id, p]));
  const rings: ProjectOrbitRing[] = [];

  let previousOuterRadiusX = 0;
  let previousOuterRadiusY = 0;
  let previousMaxFootprint = { x: 0, y: 0 };

  for (let ringIndex = 0; ringIndex < allocation.ringCount; ringIndex++) {
    const ringProjectIds = allocation.ringProjectIds[ringIndex];
    const ringProjects = ringProjectIds.map(id => projectsById.get(id)!);
    const thisMaxFootprint = computeMaxProjectFootprintIsoHalfExtent(ringProjects);

    const minRadiusX = ringIndex === 0
      ? 0
      : previousOuterRadiusX + previousMaxFootprint.x + thisMaxFootprint.x + PROJECT_RING_SPACING_ISO;
    const minRadiusY = ringIndex === 0
      ? 0
      : previousOuterRadiusY + previousMaxFootprint.y + thisMaxFootprint.y + PROJECT_RING_SPACING_ISO;

    const { projectPositions: ringPositions, orbitGeometry } = buildStaticProjectOrbit(
      ringProjects,
      capabilityBoxes,
      { minRadiusX, minRadiusY }
    );
    Object.assign(projectPositions, ringPositions);

    rings.push({
      id: getProjectRingId(ringIndex),
      index: ringIndex,
      projectIds: ringProjectIds,
      geometry: orbitGeometry,
      baseRateMultiplier: getProjectRingBaseRateMultiplier(ringIndex),
      direction: 'clockwise',
    });

    previousOuterRadiusX = orbitGeometry.radiusX;
    previousOuterRadiusY = orbitGeometry.radiusY;
    previousMaxFootprint = thisMaxFootprint;
  }

  return { rings, projectPositions };
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
    const { skillPositions: ringSkillPositions, placedBoxes: ringPlacedBoxes } = buildCapabilityRingLayout(sortedSkills);
    Object.assign(skillPositions, ringSkillPositions);
    placedBoxes.push(...ringPlacedBoxes);
  }

  // 4. Layout Projects: one or more concentric elliptical project rings
  // surrounding the capability nucleus, adaptively sized to project count.
  // `placedBoxes` at this point contains only capability (skill) boxes.
  const { rings: projectRings, projectPositions: ringProjectPositions } = buildProjectOrbitRings(
    sortedProjects,
    placedBoxes
  );
  Object.assign(projectPositions, ringProjectPositions);

  // `orbitGeometry` is kept as a genuine (never synthesized) view of ring 0
  // for callers that predate multi-ring support; the zero-project case still
  // reuses buildStaticProjectOrbit's own reactor-clearance-only ellipse.
  const orbitGeometry = projectRings[0]?.geometry ?? buildStaticProjectOrbit([], placedBoxes).orbitGeometry;

  return { projectPositions, skillPositions, orbitGeometry, projectRings };
}
