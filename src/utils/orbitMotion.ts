// Pure, DOM-free orbital motion math: one shared phase drives every canonical
// project's position around the PR21 static ellipse. No animation library, no
// per-project timers — a single requestAnimationFrame loop in TopologyCanvas
// advances one phase value and this module derives positions from it.
import { projectIsoTo3D } from './isometricProjection';
import { getTopologyProjectDimensions, type ProjectDimensionsSource } from './projectTopologyGeometry';
import type { StaticOrbitGeometry, StaticOrbitSlot } from './topologyLayout';

/** Full revolution period. 90-150s is the acceptable neighborhood; 120s is deliberate/architectural, not flashy. */
export const ORBIT_PERIOD_MS = 120_000;

/** How long after a genuine system/reflow pause clears before motion resumes. */
export const ORBIT_RESUME_DELAY_MS = 800;

/** One shared runtime rate for the whole ring. Zero is an explicit user pause. */
export const ORBIT_RATE_MULTIPLIERS = [0, 0.5, 1, 2, 4, 8, 16, 32, 64] as const;
export type OrbitRateMultiplier = (typeof ORBIT_RATE_MULTIPLIERS)[number];

const TWO_PI = Math.PI * 2;

/** Wraps a phase value into [0, 2π). */
export function normalizeOrbitPhase(phase: number): number {
  const wrapped = phase % TWO_PI;
  return wrapped < 0 ? wrapped + TWO_PI : wrapped;
}

/** Converts elapsed real time into a phase delta at the shared runtime rate. */
export function computePhaseDelta(
  deltaMs: number,
  rateMultiplier: OrbitRateMultiplier = 1,
  periodMs: number = ORBIT_PERIOD_MS
): number {
  if (!(deltaMs > 0) || !(rateMultiplier > 0) || !(periodMs > 0)) return 0;
  return (deltaMs / periodMs) * TWO_PI * rateMultiplier;
}

/** Advances and normalizes a phase by the elapsed real time. */
export function advanceOrbitPhase(
  currentPhase: number,
  deltaMs: number,
  rateMultiplier: OrbitRateMultiplier = 1,
  periodMs: number = ORBIT_PERIOD_MS
): number {
  return normalizeOrbitPhase(currentPhase + computePhaseDelta(deltaMs, rateMultiplier, periodMs));
}

export interface OrbitClockState {
  phase: number;
  /** Timestamp (rAF ms) of the last frame that actually advanced the phase, or null if the clock needs a fresh baseline. */
  lastTimestamp: number | null;
}

/** Preserves phase while forcing the next running frame to establish a fresh time baseline. */
export function rebaselineOrbitClock(state: OrbitClockState): OrbitClockState {
  return { phase: state.phase, lastTimestamp: null };
}

/**
 * One deterministic step of the shared orbit clock. This is the entire
 * no-catch-up-jump contract in one pure function:
 * - Not running or user rate 0 (paused) -> phase held, lastTimestamp cleared.
 *   Clearing it means the NEXT running step re-baselines instead of computing
 *   a delta across the entire paused/hidden duration.
 * - Running but no baseline yet (just resumed, or first frame ever) -> capture
 *   the timestamp as the new baseline WITHOUT advancing phase this frame.
 * - Running with a baseline -> advance phase by the real elapsed delta.
 */
export function stepOrbitClock(
  state: OrbitClockState,
  timestamp: number,
  isRunning: boolean,
  rateMultiplier: OrbitRateMultiplier = 1,
  periodMs: number = ORBIT_PERIOD_MS
): OrbitClockState {
  if (!isRunning || rateMultiplier === 0) {
    return rebaselineOrbitClock(state);
  }
  if (state.lastTimestamp === null) {
    return { phase: state.phase, lastTimestamp: timestamp };
  }
  const deltaMs = timestamp - state.lastTimestamp;
  return {
    phase: advanceOrbitPhase(state.phase, deltaMs, rateMultiplier, periodMs),
    lastTimestamp: timestamp,
  };
}

/**
 * Position-only orbital motion: the project's base slot angle plus the shared
 * orbit phase gives its current angle on the SAME static ellipse from PR21.
 * The project's rendered orientation is never touched here — callers still
 * draw the identical axonometric box/callout, just translated to this origin.
 */
export function getOrbitalProjectPositionAtPhase(
  project: ProjectDimensionsSource,
  slot: StaticOrbitSlot,
  orbitGeometry: StaticOrbitGeometry,
  orbitPhase: number
): { x: number; y: number } {
  const dynamicAngle = slot.angle + orbitPhase;
  const isoX = orbitGeometry.centerIso.x + orbitGeometry.radiusX * Math.cos(dynamicAngle);
  const isoY = orbitGeometry.centerIso.y + orbitGeometry.radiusY * Math.sin(dynamicAngle);
  const worldCenter = projectIsoTo3D(isoX, isoY);
  const dims = getTopologyProjectDimensions(project);
  return {
    x: worldCenter.x - dims.width / 2,
    y: worldCenter.y - dims.depth / 2,
  };
}

/** Minimal ellipse shape needed for orbital position math — deliberately NOT
 * StaticOrbitGeometry itself, so callers can pass the same fixed PR22 ellipse
 * (centerIso/radiusX/radiusY never change) without depending on its `.slots`. */
export interface OrbitEllipseGeometry {
  centerIso: { x: number; y: number };
  radiusX: number;
  radiusY: number;
}

/**
 * PR23 product pivot (dynamic interactive orbit): position is derived from a
 * project's CURRENT index within the CURRENT docked membership count, not
 * from a fixed per-project canonical slot. `-π/2 + (i/N)*2π` is exactly
 * PR21/22's own even-spacing formula — at full canonical membership (index
 * == original slot index, N == total project count) this reproduces
 * getOrbitalProjectPositionAtPhase's result exactly, so canonical and
 * interactive membership share one formula rather than two parallel systems.
 * The ellipse itself (centerIso/radiusX/radiusY) is always the same fixed
 * PR22 geometry — membership changes redistribute ANGULAR SPACING only, never
 * the ring's size or shape.
 */
export function getDynamicOrbitalPosition(
  project: ProjectDimensionsSource,
  indexInDockedOrder: number,
  dockedCount: number,
  orbitGeometry: OrbitEllipseGeometry,
  orbitPhase: number
): { x: number; y: number } {
  const angle = -Math.PI / 2 + (indexInDockedOrder / dockedCount) * TWO_PI + orbitPhase;
  const isoX = orbitGeometry.centerIso.x + orbitGeometry.radiusX * Math.cos(angle);
  const isoY = orbitGeometry.centerIso.y + orbitGeometry.radiusY * Math.sin(angle);
  const worldCenter = projectIsoTo3D(isoX, isoY);
  const dims = getTopologyProjectDimensions(project);
  return {
    x: worldCenter.x - dims.width / 2,
    y: worldCenter.y - dims.depth / 2,
  };
}

/**
 * Interaction, system, and accessibility state stays observable in one object,
 * but only the four machine-level authorities below may stop the orbit. Hover,
 * selection, focus, canvas pan, and node drag deliberately do not participate.
 */
export interface OrbitPauseState {
  isProjectHovered: boolean;
  isSkillHovered: boolean;
  isProjectSelected: boolean;
  isSkillSelected: boolean;
  isNodeDragging: boolean;
  /** Viewport panning is independent motion and never pauses the orbit. */
  isCanvasPanning: boolean;
  isDocumentHidden: boolean;
  prefersReducedMotion: boolean;
  isCompact: boolean;
  isExperienceSelected: boolean;
  /** PR23: a magnetic aborted-pull-return or redock settle transition is actively animating. */
  isDockingTransitionActive: boolean;
}

export function isOrbitPauseConditionActive(state: OrbitPauseState): boolean {
  return (
    state.isDocumentHidden ||
    state.prefersReducedMotion ||
    state.isCompact ||
    state.isDockingTransitionActive
  );
}
