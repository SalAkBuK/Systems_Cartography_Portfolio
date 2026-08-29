// Pure, DOM-free orbital motion math: one shared phase drives every canonical
// project's position around the PR21 static ellipse. No animation library, no
// per-project timers — a single requestAnimationFrame loop in TopologyCanvas
// advances one phase value and this module derives positions from it.
import { projectIsoTo3D } from './isometricProjection';
import { getTopologyProjectDimensions, type ProjectDimensionsSource } from './projectTopologyGeometry';
import type { StaticOrbitGeometry, StaticOrbitSlot } from './topologyLayout';

/** Full revolution period. 90-150s is the acceptable neighborhood; 120s is deliberate/architectural, not flashy. */
export const ORBIT_PERIOD_MS = 120_000;

/** How long after the last transient interaction clears before motion resumes. */
export const ORBIT_RESUME_DELAY_MS = 800;

const TWO_PI = Math.PI * 2;

/** Wraps a phase value into [0, 2π). */
export function normalizeOrbitPhase(phase: number): number {
  const wrapped = phase % TWO_PI;
  return wrapped < 0 ? wrapped + TWO_PI : wrapped;
}

/** Converts elapsed real time into a phase delta for the given revolution period. */
export function computePhaseDelta(deltaMs: number, periodMs: number = ORBIT_PERIOD_MS): number {
  if (!(deltaMs > 0) || !(periodMs > 0)) return 0;
  return (deltaMs / periodMs) * TWO_PI;
}

/** Advances and normalizes a phase by the elapsed real time. */
export function advanceOrbitPhase(
  currentPhase: number,
  deltaMs: number,
  periodMs: number = ORBIT_PERIOD_MS
): number {
  return normalizeOrbitPhase(currentPhase + computePhaseDelta(deltaMs, periodMs));
}

export interface OrbitClockState {
  phase: number;
  /** Timestamp (rAF ms) of the last frame that actually advanced the phase, or null if the clock needs a fresh baseline. */
  lastTimestamp: number | null;
}

/**
 * One deterministic step of the shared orbit clock. This is the entire
 * no-catch-up-jump contract in one pure function:
 * - Not running (paused for any reason) -> phase held, lastTimestamp cleared.
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
  periodMs: number = ORBIT_PERIOD_MS
): OrbitClockState {
  if (!isRunning) {
    return { phase: state.phase, lastTimestamp: null };
  }
  if (state.lastTimestamp === null) {
    return { phase: state.phase, lastTimestamp: timestamp };
  }
  const deltaMs = timestamp - state.lastTimestamp;
  return {
    phase: advanceOrbitPhase(state.phase, deltaMs, periodMs),
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

/**
 * Every condition that must hold the whole ring motionless. Deliberately a
 * single flat OR — one ring, one phase, one pause state; no per-node pausing.
 */
export interface OrbitPauseState {
  isProjectHovered: boolean;
  isSkillHovered: boolean;
  isProjectSelected: boolean;
  isSkillSelected: boolean;
  isNodeDragging: boolean;
  isCanvasPanning: boolean;
  isDocumentHidden: boolean;
  prefersReducedMotion: boolean;
  isCompact: boolean;
  isExperienceSelected: boolean;
}

export function isOrbitPauseConditionActive(state: OrbitPauseState): boolean {
  return (
    state.isProjectHovered ||
    state.isSkillHovered ||
    state.isProjectSelected ||
    state.isSkillSelected ||
    state.isNodeDragging ||
    state.isCanvasPanning ||
    state.isDocumentHidden ||
    state.prefersReducedMotion ||
    state.isCompact ||
    state.isExperienceSelected
  );
}
