// Pure, DOM-free magnetic docking mechanics for PR23: a project can be pulled
// off the shared orbit (with resistance, then a clean breakaway), dragged
// freely once detached, and magnetically reinserted by releasing near any
// point on the ellipse. Every step here is a plain closed-form formula the
// component evaluates each pointer-move tick — no simulation of any kind.
import { projectIsoTo3D } from './isometricProjection';
import { project3DToIso } from './isometricProjection';
import {
  getTopologyProjectDimensions,
  getTopologyProjectVisualBounds,
  type ProjectDimensionsSource,
  type ProjectVisualBoundsSource
} from './projectTopologyGeometry';
import { checkAABBOverlap } from './topologyLayout';
import { getDynamicOrbitalPosition, type OrbitEllipseGeometry } from './orbitMotion';

// ---------------------------------------------------------------------------
// Product constants (initial values; tune here, not scattered through the component)
// ---------------------------------------------------------------------------

/** Iso-space pointer travel (beyond the ordinary ~3px click threshold) that breaks a docked project loose. */
export const DETACH_THRESHOLD_ISO = 30;
/** Fraction of pointer iso-space displacement actually applied while resisting (magnetically attached). */
export const PULL_RESISTANCE = 0.28;
/** Iso-space distance from the NEAREST point on the shared orbit ellipse within which magnetic capture engages — works at any angle around the ring, not just a project's original slot. */
export const ORBIT_CAPTURE_BAND_ISO = 52;
/** Maximum blend toward the projected orbit point at zero distance (capture strength ceiling). */
export const MAX_CAPTURE_PULL = 0.40;
/** Return-animation duration when a pull is released before crossing the detach threshold (single project, no membership change). */
export const ABORTED_PULL_RETURN_MS = 120;
/** Shared orbital reflow duration when docked membership/order changes (a detach or a whole-ring reinsertion redistributes every remaining docked project). */
export const ORBIT_REFLOW_DURATION_MS = 220;

// ---------------------------------------------------------------------------
// Runtime dock state (UI-only — never persisted to src/data)
// ---------------------------------------------------------------------------

export type ProjectDockState = 'docked' | 'detaching' | 'detached' | 'capturing';

export interface ProjectDockRuntime {
  state: 'detached';
}

/** Sparse map: an absent entry means docked. Only ever holds 'detached' — 'detaching'/'capturing' are transient, gesture-local. */
export type ProjectDockRuntimeMap = Record<string, ProjectDockRuntime>;

export function resolveProjectDockState(map: ProjectDockRuntimeMap, projectId: string): 'docked' | 'detached' {
  return map[projectId] ? 'detached' : 'docked';
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

/** Visual/iso-space center of a project's rendered footprint at a given world (top-left) origin. */
export function getProjectVisualCenterIso(
  project: ProjectDimensionsSource,
  worldOrigin: { x: number; y: number }
): { x: number; y: number } {
  const dims = getTopologyProjectDimensions(project);
  return project3DToIso(worldOrigin.x + dims.width / 2, worldOrigin.y + dims.depth / 2, 0);
}

/** Inverse of getProjectVisualCenterIso: the world (top-left) origin a project needs so its visual center lands exactly on the given iso-space point. */
export function getWorldOriginForIsoCenter(
  project: ProjectDimensionsSource,
  isoCenter: { x: number; y: number }
): { x: number; y: number } {
  const dims = getTopologyProjectDimensions(project);
  const worldCenter = projectIsoTo3D(isoCenter.x, isoCenter.y);
  return { x: worldCenter.x - dims.width / 2, y: worldCenter.y - dims.depth / 2 };
}

/** Linear interpolation between two points; t=0 -> from, t=1 -> to. */
export function lerpPoint(
  from: { x: number; y: number },
  to: { x: number; y: number },
  t: number
): { x: number; y: number } {
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
}

// ---------------------------------------------------------------------------
// Detach mechanics (resistance + breakaway)
// ---------------------------------------------------------------------------

/** Whether raw iso-space pointer travel has broken a docked project loose. */
export function hasCrossedDetachThreshold(
  isoDeltaX: number,
  isoDeltaY: number,
  threshold: number = DETACH_THRESHOLD_ISO
): boolean {
  return Math.hypot(isoDeltaX, isoDeltaY) > threshold;
}

/**
 * World-space origin while magnetically resisted (pre-breakaway): only
 * PULL_RESISTANCE of the pointer's iso-space displacement is actually applied.
 */
export function computeResistedWorldOrigin(
  startNodePos: { x: number; y: number },
  isoDeltaX: number,
  isoDeltaY: number,
  resistance: number = PULL_RESISTANCE
): { x: number; y: number } {
  const worldDelta = projectIsoTo3D(isoDeltaX * resistance, isoDeltaY * resistance);
  return { x: startNodePos.x + worldDelta.x, y: startNodePos.y + worldDelta.y };
}

/**
 * World-space origin for ordinary free drag (post-breakaway, no resistance),
 * measured from a baseline captured at the moment of breakaway — NOT from the
 * original gesture start — so crossing the threshold cannot jump the project.
 */
export function computeFreeWorldOrigin(
  baselineWorldPos: { x: number; y: number },
  isoDeltaX: number,
  isoDeltaY: number
): { x: number; y: number } {
  const worldDelta = projectIsoTo3D(isoDeltaX, isoDeltaY);
  return { x: baselineWorldPos.x + worldDelta.x, y: baselineWorldPos.y + worldDelta.y };
}

// ---------------------------------------------------------------------------
// Whole-ellipse orbit projection (dynamic interactive orbit pivot): capture no
// longer targets a project's own canonical slot. Instead, ANY point near the
// shared ellipse — at any angle — is a valid capture/insertion target.
// ---------------------------------------------------------------------------

export interface OrbitEllipseProjection {
  /** Angle (radians) of the nearest point on the ellipse, in the SAME rotated iso frame the dragged point was measured in (includes current orbitPhase). */
  theta: number;
  /** The nearest point on the ellipse itself, in iso/visual space. */
  projectedPoint: { x: number; y: number };
  /** Iso-space distance from the dragged point to that projected point. */
  distanceIso: number;
}

/**
 * Projects an arbitrary iso-space point onto the nearest point of the shared
 * orbit ellipse. Works uniformly at any angle — top, bottom, left, right, or
 * anywhere in between — there is no dependency on any project's original slot.
 */
export function projectPointOntoOrbitEllipse(
  point: { x: number; y: number },
  orbitGeometry: OrbitEllipseGeometry
): OrbitEllipseProjection {
  const dx = point.x - orbitGeometry.centerIso.x;
  const dy = point.y - orbitGeometry.centerIso.y;
  const theta = Math.atan2(dy / orbitGeometry.radiusY, dx / orbitGeometry.radiusX);
  const projectedPoint = {
    x: orbitGeometry.centerIso.x + orbitGeometry.radiusX * Math.cos(theta),
    y: orbitGeometry.centerIso.y + orbitGeometry.radiusY * Math.sin(theta),
  };
  const distanceIso = Math.hypot(point.x - projectedPoint.x, point.y - projectedPoint.y);
  return { theta, projectedPoint, distanceIso };
}

const TWO_PI = Math.PI * 2;

/**
 * Maps a dragged point's ellipse-projection angle (theta, measured in the
 * CURRENT rotated frame) back to an insertion index within the current
 * docked order (length `currentDockedCount`, BEFORE the new project is
 * added). `orbitPhase` must be the frozen phase at the moment of the gesture
 * (the orbit is already paused throughout any drag) — subtracting it maps the
 * visual angle back to the un-rotated logical frame the docked order's even
 * spacing is defined in, so the result is stable regardless of how far the
 * ring has rotated. Returns an index in [0, currentDockedCount] suitable for
 * Array.prototype.splice.
 *
 * A point whose logical angle falls strictly between existing slot k and slot
 * k+1 must insert AFTER slot k (index k+1) — e.g. releasing between docked
 * projects E and F must produce [...E, new, F...], never [...new, E, F...].
 * A point landing exactly ON an existing slot's own angle also inserts after
 * it (same +1), which is an arbitrary but consistent tie-break; landing
 * exactly at the wrap-around point (logical angle 0) is circularly equivalent
 * whichever boundary is chosen, since inserting at the array's end and
 * inserting at its start produce the same relative cyclic order.
 */
export function resolveOrbitInsertionIndex(
  theta: number,
  orbitPhase: number,
  currentDockedCount: number
): number {
  if (currentDockedCount <= 0) return 0;
  const logicalAngle = theta - orbitPhase;
  // Undo the -π/2 base offset so index 0 sits at shifted-angle 0.
  let shifted = (logicalAngle + Math.PI / 2) % TWO_PI;
  if (shifted < 0) shifted += TWO_PI;
  const step = TWO_PI / currentDockedCount;
  // epsilon guards exact-boundary float noise (a true value of exactly k*step
  // must never floor down to k-1); +1 places the insertion AFTER the slot
  // whose arc the point falls within, not before it.
  const index = Math.floor(shifted / step + 1e-9) + 1;
  return Math.min(Math.max(index, 0), currentDockedCount);
}

// ---------------------------------------------------------------------------
// Magnetic capture (whole-ellipse preview)
// ---------------------------------------------------------------------------

export interface CaptureAttraction {
  distanceIso: number;
  /** 0 at the capture-band boundary, 1 at zero distance. */
  proximity: number;
  /** proximity^2 * MAX_CAPTURE_PULL — the actual blend fraction toward the projected orbit point. */
  strength: number;
  isWithinCaptureRadius: boolean;
}

/**
 * Progressive magnetic attraction as a detached project nears ANY point on
 * the shared orbit ellipse (not just its own original slot). Continuous by
 * construction: at distance === band radius, proximity/strength are exactly
 * 0, so the blended position equals the raw position with no discontinuity
 * when crossing the band boundary in either direction.
 */
export function computeCaptureAttraction(
  distanceIso: number,
  captureBand: number = ORBIT_CAPTURE_BAND_ISO,
  maxPull: number = MAX_CAPTURE_PULL
): CaptureAttraction {
  const isWithinCaptureRadius = distanceIso <= captureBand;
  const proximity = Math.min(Math.max(1 - distanceIso / captureBand, 0), 1);
  const strength = proximity * proximity * maxPull;
  return { distanceIso, proximity, strength, isWithinCaptureRadius };
}

/** Blends the raw (pointer-derived) drag position toward the projected orbit point by the given strength. Never mutates/corrupts the raw position — callers must track it separately. */
export function computeMagneticRenderPosition(
  rawWorldPos: { x: number; y: number },
  projectedOrbitWorldOrigin: { x: number; y: number },
  strength: number
): { x: number; y: number } {
  if (strength <= 0) return rawWorldPos;
  return lerpPoint(rawWorldPos, projectedOrbitWorldOrigin, strength);
}

// ---------------------------------------------------------------------------
// State machine (pure — the component supplies the few booleans each tick)
// ---------------------------------------------------------------------------

export interface DockSessionInput {
  /** At-rest persisted state (from resolveProjectDockState) — 'docked' or 'detached'. */
  persistedState: 'docked' | 'detached';
  /** Pointer currently down on this exact project. */
  isDragging: boolean;
  /** Sticky per-gesture flag: true forever once this gesture has crossed the detach threshold. */
  hasCrossedThresholdThisGesture: boolean;
  /** Only meaningful once the project is (or has become) detached this gesture. */
  isWithinCaptureRadius: boolean;
}

/**
 * The entire PR23 state machine in one pure function. `isDragging=false`
 * simply reflects the persisted at-rest state (docked or detached). While
 * dragging: a docked project that hasn't crossed the threshold is
 * 'detaching'; once it has (or was already detached), it is 'detached'
 * unless currently within its own capture radius, in which case it is
 * 'capturing'. Leaving the radius again returns to 'detached' with no
 * special-casing required — the same branch handles both directions.
 */
export function deriveDockState(input: DockSessionInput): ProjectDockState {
  if (!input.isDragging) return input.persistedState;
  if (input.persistedState === 'docked' && !input.hasCrossedThresholdThisGesture) {
    return 'detaching';
  }
  return input.isWithinCaptureRadius ? 'capturing' : 'detached';
}

/**
 * Resolves the FINAL persisted outcome when the pointer is released, given
 * the dock state at the instant of release and whether the proposed target
 * is blocked. Whole-ellipse insertion passes false because it redistributes
 * the ring instead of claiming a fixed vacancy.
 */
export function resolveReleaseOutcome(
  dockStateAtRelease: ProjectDockState,
  isTargetBlocked: boolean
): 'docked' | 'detached' {
  if (dockStateAtRelease === 'detaching') return 'docked'; // aborted pull — never left
  if (dockStateAtRelease === 'capturing' && !isTargetBlocked) return 'docked'; // valid redock
  return 'detached'; // ordinary detached drop, or a blocked capture falling through to free placement
}

// ---------------------------------------------------------------------------
// Shared orbital reflow transition — ONE generalized elapsed-time-based
// ease-out core for every position-settling scenario in PR23: an aborted
// pull returning a single project to its current ring position, a detach
// redistributing the remaining N-1 docked projects, or a reinsertion
// redistributing N+1. All three are the exact same mechanism — a map of
// projectId -> {from, to} positions interpolated by ONE shared eased
// progress value — so there is exactly one transition system, not several
// competing ones. One short-lived transition at a time; no per-project
// persistent loop.
// ---------------------------------------------------------------------------

function easeOutCubic(t: number): number {
  const clamped = Math.min(Math.max(t, 0), 1);
  return 1 - Math.pow(1 - clamped, 3);
}

export interface OrbitReflowTransition {
  fromPositions: Record<string, { x: number; y: number }>;
  toPositions: Record<string, { x: number; y: number }>;
  durationMs: number;
  /** null until the first animation-frame timestamp establishes the baseline. */
  startTimestamp: number | null;
}

export interface OrbitReflowStepResult {
  positions: Record<string, { x: number; y: number }>;
  progress: number; // eased 0..1
  isComplete: boolean;
}

/**
 * One elapsed-time-based step of a shared reflow transition. Distance-per-
 * frame is never fixed — every affected project's position is purely a
 * function of (timestamp - startTimestamp) against durationMs, using the
 * SAME eased progress value for all of them, so frame-rate variance cannot
 * change perceived speed and no project ever lags behind another. Ease-out
 * only: no overshoot, no bounce, no spring.
 */
export function stepOrbitReflow(
  transition: OrbitReflowTransition,
  timestamp: number
): OrbitReflowStepResult {
  if (transition.startTimestamp === null) {
    return { positions: transition.fromPositions, progress: 0, isComplete: false };
  }
  const elapsed = timestamp - transition.startTimestamp;
  if (elapsed >= transition.durationMs) {
    return { positions: transition.toPositions, progress: 1, isComplete: true };
  }
  const t = easeOutCubic(elapsed / transition.durationMs);
  const positions: Record<string, { x: number; y: number }> = {};
  for (const id of Object.keys(transition.toPositions)) {
    const from = transition.fromPositions[id] ?? transition.toPositions[id];
    positions[id] = lerpPoint(from, transition.toPositions[id], t);
  }
  return { positions, progress: t, isComplete: false };
}

// ---------------------------------------------------------------------------
// Motion-safe detached placement: a detached project sits fixed while the
// rest of the ring keeps orbiting (PR22), so a free-drop that is collision-
// free RIGHT NOW can still be swept through later by a docked project
// traversing that angular location. This mirrors PR22's own motion-safety
// sweep (same 72-sample/5-degree resolution, same visual/callout envelopes,
// same checkAABBOverlap) but applied to ONE stationary candidate against the
// full future orbit, instead of validating the orbit's own construction.
// ---------------------------------------------------------------------------

/** Matches PR22's accepted motion-safety sweep resolution (5-degree increments). */
export const ORBITAL_CLEARANCE_SAMPLE_COUNT = 72;

/**
 * True if `candidateOrigin` (a project about to be dropped as detached) never
 * overlaps any currently-DOCKED project's full visual/callout envelope at any
 * sampled phase across one complete revolution. Positions are derived from
 * `dockedOrderProjects`' INDEX within the CURRENT interactive docked order —
 * NOT from any fixed canonical StaticOrbitSlot — so this stays correct for
 * any membership count and any visitor-reordered sequence, not just the
 * original full 18-project ring. `dockedOrderProjects` must contain ONLY the
 * projects that will actually keep orbiting, in their current relative order
 * — the candidate itself and every OTHER already-detached project must be
 * excluded by the caller (they are stationary and already covered by
 * ordinary current-position collision checks, not this sweep).
 */
export function isDetachedPlacementMotionSafe(
  candidateProject: ProjectVisualBoundsSource,
  candidateOrigin: { x: number; y: number },
  orbitGeometry: OrbitEllipseGeometry,
  dockedOrderProjects: ProjectVisualBoundsSource[],
  sampleCount: number = ORBITAL_CLEARANCE_SAMPLE_COUNT
): boolean {
  const candidateBox = getTopologyProjectVisualBounds(candidateProject, candidateOrigin);
  const dockedCount = dockedOrderProjects.length;
  if (dockedCount === 0) return true;

  for (let s = 0; s < sampleCount; s++) {
    const phase = (s / sampleCount) * 2 * Math.PI;
    for (let i = 0; i < dockedCount; i++) {
      const movingProject = dockedOrderProjects[i];
      const movingOrigin = getDynamicOrbitalPosition(movingProject, i, dockedCount, orbitGeometry, phase);
      const movingBox = getTopologyProjectVisualBounds(movingProject, movingOrigin);
      if (checkAABBOverlap(candidateBox, movingBox, 0)) {
        return false;
      }
    }
  }
  return true;
}
