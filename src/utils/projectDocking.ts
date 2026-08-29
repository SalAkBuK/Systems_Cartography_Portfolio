// Pure, DOM-free magnetic docking mechanics for PR23: a project can be pulled
// off its reserved orbital slot (with resistance, then a clean breakaway),
// dragged freely once detached, and magnetically redocked by releasing near
// its own reserved slot. Every step here is a plain closed-form formula the
// component evaluates each pointer-move tick — no simulation of any kind.
import { projectIsoTo3D } from './isometricProjection';
import { project3DToIso } from './isometricProjection';
import { getTopologyProjectDimensions, type ProjectDimensionsSource } from './projectTopologyGeometry';

// ---------------------------------------------------------------------------
// Product constants (initial values; tune here, not scattered through the component)
// ---------------------------------------------------------------------------

/** Iso-space pointer travel (beyond the ordinary ~3px click threshold) that breaks a docked project loose. */
export const DETACH_THRESHOLD_ISO = 30;
/** Fraction of pointer iso-space displacement actually applied while resisting (magnetically attached). */
export const PULL_RESISTANCE = 0.28;
/** Iso-space distance from a project's own reserved slot within which magnetic capture engages. */
export const CAPTURE_RADIUS_ISO = 52;
/** Maximum blend toward the reserved slot at zero distance (capture strength ceiling). */
export const MAX_CAPTURE_PULL = 0.40;
/** Settle-animation duration when a valid capture is released (autonomous redock). */
export const REDOCK_DURATION_MS = 180;
/** Return-animation duration when a pull is released before crossing the detach threshold. */
export const ABORTED_PULL_RETURN_MS = 120;

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
// Magnetic capture (redock preview)
// ---------------------------------------------------------------------------

export interface CaptureAttraction {
  distanceIso: number;
  /** 0 at the capture radius boundary, 1 at zero distance. */
  proximity: number;
  /** proximity^2 * MAX_CAPTURE_PULL — the actual blend fraction toward the reserved slot. */
  strength: number;
  isWithinCaptureRadius: boolean;
}

/**
 * Progressive magnetic attraction as a project (already detached) nears its
 * OWN reserved slot. Continuous by construction: at distance === captureRadius,
 * proximity/strength are exactly 0, so the blended position equals the raw
 * position with no discontinuity when crossing the radius in either direction.
 */
export function computeCaptureAttraction(
  distanceIso: number,
  captureRadius: number = CAPTURE_RADIUS_ISO,
  maxPull: number = MAX_CAPTURE_PULL
): CaptureAttraction {
  const isWithinCaptureRadius = distanceIso <= captureRadius;
  const proximity = Math.min(Math.max(1 - distanceIso / captureRadius, 0), 1);
  const strength = proximity * proximity * maxPull;
  return { distanceIso, proximity, strength, isWithinCaptureRadius };
}

/** Blends the raw (pointer-derived) drag position toward the reserved slot by the given strength. Never mutates/corrupts the raw position — callers must track it separately. */
export function computeMagneticRenderPosition(
  rawWorldPos: { x: number; y: number },
  reservedSlotWorldOrigin: { x: number; y: number },
  strength: number
): { x: number; y: number } {
  if (strength <= 0) return rawWorldPos;
  return lerpPoint(rawWorldPos, reservedSlotWorldOrigin, strength);
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
 * the dock state at the instant of release and whether the reserved slot is
 * currently blocked by another detached project's footprint.
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
// Settle animation (shared by aborted-pull-return AND redock-settle — same
// elapsed-time-based ease-out core, only the duration differs). One
// short-lived transition at a time; a plain formula, no per-project
// persistent loop.
// ---------------------------------------------------------------------------

function easeOutCubic(t: number): number {
  const clamped = Math.min(Math.max(t, 0), 1);
  return 1 - Math.pow(1 - clamped, 3);
}

export interface SettleTransition {
  fromPos: { x: number; y: number };
  toPos: { x: number; y: number };
  durationMs: number;
  /** null until the first animation-frame timestamp establishes the baseline. */
  startTimestamp: number | null;
}

export interface SettleStepResult {
  position: { x: number; y: number };
  progress: number; // eased 0..1
  isComplete: boolean;
}

/**
 * One elapsed-time-based step of a settle transition. Distance-per-frame is
 * never fixed — position is purely a function of (timestamp - startTimestamp)
 * against durationMs, so frame-rate variance cannot change the perceived
 * speed. Ease-out only: no overshoot, no bounce.
 */
export function stepSettleTransition(
  transition: SettleTransition,
  timestamp: number
): SettleStepResult {
  if (transition.startTimestamp === null) {
    return { position: transition.fromPos, progress: 0, isComplete: false };
  }
  const elapsed = timestamp - transition.startTimestamp;
  if (elapsed >= transition.durationMs) {
    return { position: transition.toPos, progress: 1, isComplete: true };
  }
  const t = easeOutCubic(elapsed / transition.durationMs);
  return { position: lerpPoint(transition.fromPos, transition.toPos, t), progress: t, isComplete: false };
}
