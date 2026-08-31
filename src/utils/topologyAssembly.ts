/**
 * Phase 1 — pure, DOM-free deterministic math for the first-load "gravitational
 * assembly" topology introduction. Nothing in this module renders anything,
 * schedules anything, or reads real time/randomness itself: every function is
 * a plain deterministic transformation of caller-supplied numbers, mirroring
 * the two existing moving-target precedents already shipping in this topology
 * — `stepOrbitReflow`/`resolveOrbitReflowPositions` (projectDocking.ts) and
 * `createCapabilitySettlingTransition`/`stepCapabilitySettling`
 * (capabilityReactor.ts). Both already solve the shape this feature needs:
 * a fixed start position, a target re-evaluated fresh every frame against the
 * LIVE topology formulas (never a frozen snapshot), and one shared
 * elapsed-time progress value driving every affected node. This module
 * generalizes that shape to the whole-topology startup sequence rather than
 * inventing a second animation philosophy.
 *
 * Explicitly NOT here (later, separately reviewed phases per the architecture
 * audit): any React/JSX, any requestAnimationFrame wiring, any actual
 * position synthesis against ring/reactor geometry (that combination is
 * Phase 2's job, using this module's outputs alongside the existing
 * `getDynamicOrbitalPosition`/`getMountedCapabilityPosition` formulas),
 * conduit rendering, ASSEMBLE reuse, and the App-level "has startup already
 * played this session" latch. That latch belongs one level above
 * TopologyCanvas (likely an App.tsx `useRef`) precisely because TopologyCanvas
 * stays mounted across project drill-in/return but is NOT the thing that
 * decides session-level replay — see the architecture audit's mount-lifecycle
 * findings (TopologyCanvas persists through drill-in; only switching to the
 * Contact view and back, or a true reload, remounts it). Phase 1 intentionally
 * touches no persistence of any kind (no localStorage/sessionStorage/module-
 * level mutable state) — every function here is stateless.
 *
 * Every input is generic: stable identity strings, ring/index integers,
 * elapsed milliseconds, and small timing/budget config objects. Nothing here
 * knows about any specific project, ring count, or owner data.
 */

import { MAX_PROJECTS_PER_RING } from './projectRingAllocation';

const TWO_PI = Math.PI * 2;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

// ---------------------------------------------------------------------------
// 1. Assembly clock — same pause/resume/no-catch-up-jump contract as
// orbitMotion.ts's stepOrbitClock, adapted to a bounded [0, totalDurationMs]
// elapsed-time value instead of an unbounded wrapping phase.
// ---------------------------------------------------------------------------

export interface AssemblyClockState {
  /** Milliseconds of RUNNING time accumulated so far, always in [0, totalDurationMs]. */
  elapsedMs: number;
  /** Timestamp (rAF ms) of the last frame that actually advanced elapsedMs, or null if the clock needs a fresh baseline. */
  lastTimestamp: number | null;
}

/** Fresh clock state for a new assembly run. Returns a new object on every call — never a shared mutable constant. */
export function createAssemblyClockState(): AssemblyClockState {
  return { elapsedMs: 0, lastTimestamp: null };
}

/**
 * One deterministic step of the assembly clock — the same no-catch-up-jump
 * contract as orbitMotion.ts's `stepOrbitClock`:
 * - Not running -> elapsedMs held exactly, lastTimestamp cleared. Clearing it
 *   means the NEXT running step re-baselines instead of computing a delta
 *   across the entire paused/hidden duration (so hiding the tab for five
 *   minutes and returning does not jump assembly five minutes forward).
 * - Running but no baseline yet (first frame ever, or first frame after a
 *   resume) -> capture the timestamp as the new baseline WITHOUT advancing
 *   elapsedMs this frame.
 * - Running with a baseline -> advance elapsedMs by the real elapsed delta,
 *   clamped to [0, totalDurationMs]. A non-finite or non-positive delta
 *   (clock skew, a stale/duplicate timestamp) contributes zero rather than
 *   corrupting elapsedMs.
 */
export function stepAssemblyClock(
  state: AssemblyClockState,
  timestamp: number,
  isRunning: boolean,
  totalDurationMs: number
): AssemblyClockState {
  const safeTotal = Number.isFinite(totalDurationMs) && totalDurationMs > 0 ? totalDurationMs : 0;
  const safeElapsed = clamp(state.elapsedMs, 0, safeTotal);

  if (!isRunning) {
    return { elapsedMs: safeElapsed, lastTimestamp: null };
  }
  if (!Number.isFinite(timestamp)) {
    return { elapsedMs: safeElapsed, lastTimestamp: null };
  }
  if (state.lastTimestamp === null || !Number.isFinite(state.lastTimestamp)) {
    return { elapsedMs: safeElapsed, lastTimestamp: timestamp };
  }

  const deltaMs = timestamp - state.lastTimestamp;
  const safeDelta = Number.isFinite(deltaMs) && deltaMs > 0 ? deltaMs : 0;
  return {
    elapsedMs: clamp(safeElapsed + safeDelta, 0, safeTotal),
    lastTimestamp: timestamp,
  };
}

/** Pure completion check — true once elapsedMs has reached (or been clamped to) totalDurationMs. */
export function isAssemblyComplete(state: AssemblyClockState, totalDurationMs: number): boolean {
  const safeTotal = Number.isFinite(totalDurationMs) && totalDurationMs > 0 ? totalDurationMs : 0;
  return state.elapsedMs >= safeTotal;
}

// Phase 4C2-B: one bounded fast-completion segment for the optional SKIP
// affordance. It reuses the ordinary assembly clock and position resolver;
// this module contributes only centralized duration/progress/easing math.
export const TOPOLOGY_ASSEMBLY_FAST_COMPLETION_DURATION_MS = 200;

export function getAssemblyFastCompletionProgress(
  elapsedMs: number,
  durationMs: number = TOPOLOGY_ASSEMBLY_FAST_COMPLETION_DURATION_MS
): number {
  const safeDuration = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 1;
  const safeElapsed = Number.isFinite(elapsedMs) ? elapsedMs : 0;
  return clamp(safeElapsed / safeDuration, 0, 1);
}

/** Deterministic cubic ease-out: rapid magnetic stabilization, no overshoot. */
export function getAssemblyFastCompletionEasing(progress: number): number {
  const t = clamp(Number.isFinite(progress) ? progress : 0, 0, 1);
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const remaining = 1 - t;
  return 1 - remaining * remaining * remaining;
}

// ---------------------------------------------------------------------------
// 3. Centralized timing configuration. Every duration/offset below is
// relative (an offset from another stage's own start, or from elapsed time
// zero) so the whole schedule can be re-tuned in one place without touching
// any ring/project-count-dependent logic. Nothing here scales with project or
// ring COUNT directly — see sections 4/5 for how per-ring/per-project
// staggering stays bounded regardless of how many rings or projects exist.
// ---------------------------------------------------------------------------

export interface TopologyAssemblyTiming {
  /**
   * Elapsed time at which every node's own capture timing is guaranteed
   * complete ("MOTION complete" — ~2.5-4s target, independent of project/
   * ring count) — also the elapsed time at which getTopologyAssemblyPhase
   * becomes 'online'. This is NOT when the whole assembly clock stops: see
   * presentationCompleteMs below for that. Kept as its own named field
   * (rather than folded into presentationCompleteMs) because node
   * render-position authority clears here, independent of how much longer
   * the presentation layer (status text) stays mounted afterward.
   */
  totalDurationMs: number;
  /**
   * Phase 4C1: elapsed time at which the shared assembly clock itself stops
   * advancing and the ENTIRE topology-assembly runtime tears down
   * (assemblyClockRef cleared, interaction unlocked) — strictly later than
   * totalDurationMs, giving the "TOPOLOGY STABLE" status a brief window to
   * display after node capture has already finished and handed off to
   * ordinary live positions. Presentation-only: no node-motion formula reads
   * this field.
   */
  presentationCompleteMs: number;
  /** Elapsed time at which the Capability Reactor begins revealing. Kept explicit (rather than hardcoded 0) so a future timing revision can stagger it too. */
  reactorRevealStartMs: number;
  reactorRevealDurationMs: number;
  /** Elapsed time at which ring 0's guide begins revealing. Every other ring's own start adds `ringStaggerMs * ringIndex` on top of this. */
  ringRevealStartMs: number;
  ringRevealDurationMs: number;
  /** Additional per-ring delay, applied once per ring index — NOT per project, so ring count alone never explodes the schedule. */
  ringStaggerMs: number;
  /** Offset from a ring's OWN reveal start at which that ring's projects begin capture. */
  projectCaptureStartMs: number;
  projectCaptureDurationMs: number;
  /** Nominal per-project stagger step within a ring, before the span cap below is applied. */
  projectStaggerMs: number;
  /** Hard cap on the TOTAL stagger span within a single ring, regardless of how many projects that ring holds (up to the canonical `MAX_PROJECTS_PER_RING`) — the mechanism that keeps a full 18-project ring from serializing into a long queue. */
  maxProjectStaggerSpanMs: number;
  /** Elapsed time at which conduits begin resolving (after every ring's own project-capture window has had a chance to complete). */
  conduitResolveStartMs: number;
  conduitResolveDurationMs: number;
  /**
   * Phase 4B: elapsed time at which the capability/technology reactor's
   * OWN node-capture begins — deliberately an absolute elapsed-time offset,
   * not a per-ring-relative one like the project fields above, since there
   * is exactly one reactor (no ring-index concept to stagger a start time
   * across). Chosen so capability capture begins meaningfully before the
   * first project capture (see projectCaptureStartMs/ringRevealStartMs
   * below, unchanged) while both phases still overlap.
   */
  capabilityCaptureStartMs: number;
  /** Deliberately shorter than projectCaptureDurationMs — "tight capture, shorter travel." */
  capabilityCaptureDurationMs: number;
  /** Nominal per-capability stagger step, before the span cap below is applied — deliberately smaller than projectStaggerMs. */
  capabilityStaggerMs: number;
  /**
   * Hard cap on the TOTAL stagger span across every capability, regardless
   * of how many exist. Unlike maxProjectStaggerSpanMs (which bounds against
   * the CANONICAL max ring capacity because ring membership is a partitioned,
   * runtime-variable subset), there is no equivalent "max reactor capacity"
   * concept — the reactor holds every capability, and the assembly
   * precondition (see TopologyCanvas) only ever activates from a clean
   * state where none are detached — so the actual live capability count is
   * itself already a stable, safe basis for spreading this span.
   */
  maxCapabilityStaggerSpanMs: number;
}

/**
 * Restrained defaults keeping the full sequence to roughly 3.2s end-to-end.
 * Not final visual tuning — a later phase may adjust these freely; nothing
 * downstream depends on the exact numbers, only on the relative ordering
 * (reactor -> rings -> projects -> conduits -> online) that the phase
 * derivation below assumes of any timing config it is given.
 */
export const DEFAULT_TOPOLOGY_ASSEMBLY_TIMING: TopologyAssemblyTiming = {
  totalDurationMs: 3200,
  // Phase 4C1: 250ms after motion completes — long enough for "TOPOLOGY
  // STABLE" to read as an intentional beat, short enough that the whole
  // ceremony still lands in the accepted ~3.3-3.5s overall span.
  presentationCompleteMs: 3450,
  reactorRevealStartMs: 0,
  // Phase 4C1: extended from 420 to 550 so the reveal window genuinely
  // overlaps capabilityCaptureStartMs (480, unchanged) — "capability
  // synchronization begins while the shell is still establishing," not
  // after it reaches 100%. Presentation-only; no node motion reads this.
  reactorRevealDurationMs: 550,
  ringRevealStartMs: 260,
  ringRevealDurationMs: 480,
  ringStaggerMs: 140,
  projectCaptureStartMs: 520,
  projectCaptureDurationMs: 900,
  projectStaggerMs: 26,
  maxProjectStaggerSpanMs: 420,
  conduitResolveStartMs: 2500,
  conduitResolveDurationMs: 500,
  // Phase 4B: capability capture begins at 480ms — roughly 300ms before the
  // first project capture starts (ringRevealStartMs 260 + projectCaptureStartMs
  // 520 = 780ms), landing in the requested "~200-400ms later" window without
  // changing any existing project constant. Duration/stagger are deliberately
  // tighter than the project equivalents (650ms vs 900ms; a much smaller
  // stagger span) for the "dense mechanical synchronization" feel.
  capabilityCaptureStartMs: 480,
  capabilityCaptureDurationMs: 650,
  capabilityStaggerMs: 8,
  maxCapabilityStaggerSpanMs: 140,
};

/**
 * Redesign Step 1: DEV-only visual-prototype schedule. Production callers keep
 * using DEFAULT_TOPOLOGY_ASSEMBLY_TIMING. This profile makes the dark core and
 * capability ingestion readable before project capture begins, while keeping
 * both node groups in motion together for the latter part of ingestion.
 * Conduit resolution is intentionally later than the prototype's active span.
 */
export const REDESIGN_FIELD_ASSEMBLY_TIMING: TopologyAssemblyTiming = {
  totalDurationMs: 2850,
  presentationCompleteMs: 3050,
  reactorRevealStartMs: 450,
  reactorRevealDurationMs: 850,
  ringRevealStartMs: 900,
  ringRevealDurationMs: 1100,
  ringStaggerMs: 120,
  projectCaptureStartMs: 150,
  projectCaptureDurationMs: 1000,
  projectStaggerMs: 24,
  maxProjectStaggerSpanMs: 360,
  conduitResolveStartMs: 100_000,
  conduitResolveDurationMs: 1,
  capabilityCaptureStartMs: 300,
  capabilityCaptureDurationMs: 1000,
  capabilityStaggerMs: 8,
  maxCapabilityStaggerSpanMs: 100,
};

export const REDESIGN_CORE_ACTIVATION_START_MS = 80;
export const REDESIGN_CORE_ACTIVATION_DURATION_MS = 520;

/** Deterministic restrained activation for the DEV-only central dark core. */
export function getRedesignCoreActivationProgress(elapsedMs: number): number {
  const safeElapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  const rawProgress = clamp(
    (safeElapsed - REDESIGN_CORE_ACTIVATION_START_MS) / REDESIGN_CORE_ACTIVATION_DURATION_MS,
    0,
    1
  );
  const remaining = 1 - rawProgress;
  return 1 - remaining * remaining * remaining;
}

export const REDESIGN_FIELD_TRACE_COUNT = 12;

/**
 * Redesign Step 1.6: each trace's own lifecycle is SPAWN (draws outward from
 * the ring toward the core, invisible -> full) -> a brief FULL_PRESENCE hold
 * -> ABSORPTION (the already-approved ring-side-recedes-toward-core suction).
 * `spawnDurationMs + fullPresenceDurationMs + absorptionDurationMs` together
 * total 820ms — the exact same total per-trace lifecycle span as the
 * pre-1.6 single-phase `consumeDurationMs`, so this is a subdivision of the
 * existing approved envelope, not a lengthening of it.
 */
export interface RedesignFieldTraceTiming {
  startMs: number;
  staggerMs: number;
  spawnDurationMs: number;
  fullPresenceDurationMs: number;
  absorptionDurationMs: number;
}

export const REDESIGN_FIELD_TRACE_TIMING: RedesignFieldTraceTiming = {
  startMs: 100,
  staggerMs: 32,
  spawnDurationMs: 160,
  fullPresenceDurationMs: 60,
  absorptionDurationMs: 600,
};

/** Total per-trace lifecycle span (spawn + full-presence + absorption). */
export function getRedesignFieldTraceLifecycleDurationMs(
  timing: RedesignFieldTraceTiming = REDESIGN_FIELD_TRACE_TIMING
): number {
  const safeSpawn = Number.isFinite(timing.spawnDurationMs) ? Math.max(0, timing.spawnDurationMs) : 0;
  const safeFull = Number.isFinite(timing.fullPresenceDurationMs) ? Math.max(0, timing.fullPresenceDurationMs) : 0;
  const safeAbsorb = Number.isFinite(timing.absorptionDurationMs) ? Math.max(0, timing.absorptionDurationMs) : 0;
  return safeSpawn + safeFull + safeAbsorb;
}

function getRedesignFieldTraceLocalElapsedMs(
  elapsedMs: number,
  traceIndex: number,
  timing: RedesignFieldTraceTiming
): number {
  const safeElapsed = Number.isFinite(elapsedMs) ? elapsedMs : 0;
  const safeIndex = Number.isFinite(traceIndex) ? Math.max(0, Math.floor(traceIndex)) : 0;
  const safeStart = Number.isFinite(timing.startMs) ? Math.max(0, timing.startMs) : 0;
  const safeStagger = Number.isFinite(timing.staggerMs) ? Math.max(0, timing.staggerMs) : 0;
  return safeElapsed - safeStart - safeIndex * safeStagger;
}

/** Deterministic smoothstep — zero slope at both ends, continuous, no popping at phase boundaries. */
function smoothstep01(t: number): number {
  const c = clamp(Number.isFinite(t) ? t : 0, 0, 1);
  return c * c * (3 - 2 * c);
}

/**
 * Single source of truth for the DEV-only BLACK CORE TEST's solid core disc
 * radius (iso units). TopologyCanvas's `redesign-black-core` circle and this
 * module's field-trace destination geometry both read this constant so the
 * two can never silently drift apart.
 */
export const REDESIGN_BLACK_CORE_RADIUS = 34;

export interface RedesignFieldTraceGeometry {
  /** Near the black-core boundary — the trace's fixed, non-consuming end. */
  innerOffset: AssemblyPoint;
  controlOffset: AssemblyPoint;
  /** ON the capability-reactor ring — the trace's consuming end. */
  outerOffset: AssemblyPoint;
}

export interface RedesignFieldTracePresentation {
  /** Overall lifecycle progress in [0, 1] across spawn + full-presence + absorption combined. */
  progress: number;
  /** Spawn-phase progress in [0, 1] — 0 before/at spawn start, 1 once the trace has fully drawn in. */
  spawnProgress: number;
  /** Absorption-phase progress in [0, 1] — 0 until absorption begins (after full-presence), 1 once fully consumed. */
  absorptionProgress: number;
  /** Normalized (pathLength=1) length of the currently-visible dash span. */
  visibleLength: number;
  /** Normalized (pathLength=1) core-side edge of the visible span — the value to feed `strokeDashoffset`. */
  dashOffset: number;
  opacity: number;
}

/**
 * Stable asymmetric curve offsets around a caller-owned center (the
 * capability reactor's own `centerIso`, which is also the black core's
 * center).
 *
 * The source end (`outerOffset`) is placed ON the capability-reactor ring
 * itself using `centerIso.x/y + reactorRadiusX/Y * cos/sin(angle)` — the
 * EXACT same ellipse formula capabilityReactor.ts already uses for the
 * visible ring in three places: the drawn dashed track
 * (`buildCapabilityReactorSegmentPaths`), the ring's own tick marks
 * (`getCapabilityReactorMarker`), and the actual mounted capability node
 * positions (`getMountedCapabilityPosition`). Reusing that exact formula
 * (rather than an inset/pulled-in fraction of it) is what makes the trace
 * visibly touch/emerge from the same ring the viewer already recognizes as
 * the technology/capability orbit, instead of stopping short of it in a gap.
 * `reactorRadiusX`/`reactorRadiusY` must be the caller's own live
 * `capabilityReactorGeometry.radiusX/radiusY` — never a second, invented
 * reactor radius.
 *
 * The destination end (`innerOffset`) sits just inside the black core's
 * boundary (a tiny deliberate overlap so the tip visually disappears beneath
 * the core, which paints on top of the trace layer). Paths are authored
 * inner(core) -> outer(ring) so shortening the visible dash always consumes
 * the OUTER/ring endpoint inward toward the core, never the reverse, and the
 * curve's control point is the midpoint between the two endpoints (plus a
 * small perpendicular bend) so the line never needs to pass through the
 * reactor center to read as curved.
 */
export function getRedesignFieldTraceGeometry(
  traceIndex: number,
  reactorRadiusX: number,
  reactorRadiusY: number,
  traceCount: number = REDESIGN_FIELD_TRACE_COUNT
): RedesignFieldTraceGeometry {
  const safeCount = Number.isFinite(traceCount) && traceCount > 0 ? Math.floor(traceCount) : 1;
  const safeIndex = Number.isFinite(traceIndex) ? Math.max(0, Math.floor(traceIndex)) : 0;
  const safeRadiusX = Number.isFinite(reactorRadiusX) && reactorRadiusX > 0 ? reactorRadiusX : 80;
  const safeRadiusY = Number.isFinite(reactorRadiusY) && reactorRadiusY > 0 ? reactorRadiusY : 55;
  const angleStep = TWO_PI / safeCount;
  const angleJitter = Math.sin((safeIndex + 1) * 2.173) * 0.13;
  const angle = -Math.PI / 2 + safeIndex * angleStep + angleJitter;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  // Source: exactly ON the live capability-reactor ellipse — the identical
  // (centerIso + radiusX*cos, centerIso + radiusY*sin) formula the reactor's
  // own drawn track/markers/node-mounting already use, so the trace visibly
  // touches that ring rather than floating in a gap before it.
  const outerOffset = {
    x: cos * safeRadiusX,
    y: sin * safeRadiusY,
  };

  // Destination: just inside the black core's own boundary (86%-94% of its
  // radius) — a tiny deliberate overlap so the endpoint tucks beneath the
  // core disc (rendered on top) rather than stopping short of it or reaching
  // all the way to the center.
  const coreEdgeUnit = 0.86 + (safeIndex % 3) * 0.04;
  const innerOffset = {
    x: cos * REDESIGN_BLACK_CORE_RADIUS * coreEdgeUnit,
    y: sin * REDESIGN_BLACK_CORE_RADIUS * coreEdgeUnit,
  };

  const bendDirection = safeIndex % 2 === 0 ? 1 : -1;
  const bend = bendDirection * (18 + (safeIndex % 3) * 9);
  const controlOffset = {
    x: (innerOffset.x + outerOffset.x) / 2 - sin * bend,
    y: (innerOffset.y + outerOffset.y) / 2 + cos * bend * 0.62,
  };
  return { innerOffset, controlOffset, outerOffset };
}

/** Shared-clock OVERALL lifecycle progress (spawn + full-presence + absorption) for one bounded, deterministically staggered trace. */
export function getRedesignFieldTraceProgress(
  elapsedMs: number,
  traceIndex: number,
  timing: RedesignFieldTraceTiming = REDESIGN_FIELD_TRACE_TIMING
): number {
  const localElapsedMs = getRedesignFieldTraceLocalElapsedMs(elapsedMs, traceIndex, timing);
  const duration = Math.max(1, getRedesignFieldTraceLifecycleDurationMs(timing));
  return clamp(localElapsedMs / duration, 0, 1);
}

/** SPAWN-phase progress in [0, 1] — reaches 1 once the trace has fully drawn in from the ring toward the core. */
export function getRedesignFieldTraceSpawnProgress(
  elapsedMs: number,
  traceIndex: number,
  timing: RedesignFieldTraceTiming = REDESIGN_FIELD_TRACE_TIMING
): number {
  const localElapsedMs = getRedesignFieldTraceLocalElapsedMs(elapsedMs, traceIndex, timing);
  const safeSpawnDuration = Number.isFinite(timing.spawnDurationMs) ? Math.max(1, timing.spawnDurationMs) : 1;
  return clamp(localElapsedMs / safeSpawnDuration, 0, 1);
}

/** ABSORPTION-phase progress in [0, 1] — 0 until spawn + full-presence have elapsed, 1 once fully consumed. */
export function getRedesignFieldTraceAbsorptionProgress(
  elapsedMs: number,
  traceIndex: number,
  timing: RedesignFieldTraceTiming = REDESIGN_FIELD_TRACE_TIMING
): number {
  const localElapsedMs = getRedesignFieldTraceLocalElapsedMs(elapsedMs, traceIndex, timing);
  const safeSpawnDuration = Number.isFinite(timing.spawnDurationMs) ? Math.max(0, timing.spawnDurationMs) : 0;
  const safeFullDuration = Number.isFinite(timing.fullPresenceDurationMs) ? Math.max(0, timing.fullPresenceDurationMs) : 0;
  const safeAbsorbDuration = Number.isFinite(timing.absorptionDurationMs) ? Math.max(1, timing.absorptionDurationMs) : 1;
  const absorptionLocalElapsedMs = localElapsedMs - safeSpawnDuration - safeFullDuration;
  return clamp(absorptionLocalElapsedMs / safeAbsorbDuration, 0, 1);
}

/**
 * Approved peak opacity (unchanged from the Step 1.5 contrast-tuning pass):
 * the trace reaches exactly this value during FULL_PRESENCE and never exceeds
 * it — only the temporal ramp in/out around that peak is new in Step 1.6.
 */
export const REDESIGN_FIELD_TRACE_PEAK_OPACITY = 0.52;

/**
 * Three-phase normalized dash/opacity values for one trace:
 *
 * - SPAWN: the visible window's RING-side edge stays pinned at the ring
 *   (t=1) while its CORE-side edge advances from the ring (t=1, zero length)
 *   toward the core (t=0, full length) — the line visibly draws OUT OF the
 *   ring TOWARD the core, never the reverse.
 * - FULL_PRESENCE: both edges hold ([0, 1], full length) for a brief beat so
 *   the eye registers ring -> trace -> core before absorption begins.
 * - ABSORPTION (already approved, unchanged direction): the CORE-side edge
 *   stays pinned at the core (t=0) while the RING-side edge recedes from the
 *   ring (t=1) back toward the core (t=0) — the remaining visible segment
 *   stays anchored at the core, exactly as before.
 *
 * Both edges are driven by independent smoothstepped progress values
 * (`spawnProgress`, `absorptionProgress`) that are each clamped to [0, 1] and
 * naturally sequenced (absorption's local clock only starts after spawn's
 * duration has elapsed), so the two edges can never cross and every phase
 * boundary lands exactly where the previous phase left off — continuous,
 * deterministic, no popping.
 */
export function getRedesignFieldTracePresentation(
  elapsedMs: number,
  traceIndex: number,
  timing: RedesignFieldTraceTiming = REDESIGN_FIELD_TRACE_TIMING
): RedesignFieldTracePresentation {
  const progress = getRedesignFieldTraceProgress(elapsedMs, traceIndex, timing);
  const spawnProgress = getRedesignFieldTraceSpawnProgress(elapsedMs, traceIndex, timing);
  const absorptionProgress = getRedesignFieldTraceAbsorptionProgress(elapsedMs, traceIndex, timing);

  const spawnSmooth = smoothstep01(spawnProgress);
  const absorptionSmooth = smoothstep01(absorptionProgress);

  const coreSideEdge = 1 - spawnSmooth;
  const ringSideEdge = 1 - absorptionSmooth;
  const visibleLength = Math.max(0, ringSideEdge - coreSideEdge);
  const dashOffset = coreSideEdge;

  const opacityRamp = spawnSmooth;
  const opacityFadeOut = 1 - clamp((absorptionProgress - 0.58) / 0.42, 0, 1);
  const opacity = REDESIGN_FIELD_TRACE_PEAK_OPACITY * opacityRamp * opacityFadeOut;

  return {
    progress,
    spawnProgress,
    absorptionProgress,
    visibleLength,
    dashOffset,
    opacity,
  };
}

// ---------------------------------------------------------------------------
// 2. Presentation phase derivation — purely derived from elapsed time against
// the timing config; the string union is a read-time label, never a stored
// transition source of truth.
// ---------------------------------------------------------------------------

export type TopologyAssemblyPhase = 'reactor' | 'rings' | 'projects' | 'conduits' | 'online';

/** Elapsed time at which a given ring's own reveal begins (ring 0 = `ringRevealStartMs`, every subsequent ring adds one more `ringStaggerMs`). */
export function getRingAssemblyStartMs(
  ringIndex: number,
  timing: TopologyAssemblyTiming = DEFAULT_TOPOLOGY_ASSEMBLY_TIMING
): number {
  const safeRingIndex = Number.isFinite(ringIndex) ? Math.max(0, ringIndex) : 0;
  return timing.ringRevealStartMs + safeRingIndex * timing.ringStaggerMs;
}

/**
 * Deterministic, monotonic, project-count-independent phase derivation.
 * Boundaries are `>=` comparisons against the config's own start times, so
 * elapsed time exactly at a boundary already reads as the NEXT phase —
 * consistent with `resolveOrbitReflowPositions`'s own `progress >= 1` /
 * `progress <= 0` boundary handling elsewhere in this topology.
 */
export function getTopologyAssemblyPhase(
  elapsedMs: number,
  timing: TopologyAssemblyTiming = DEFAULT_TOPOLOGY_ASSEMBLY_TIMING
): TopologyAssemblyPhase {
  const safeElapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;

  if (safeElapsed >= timing.totalDurationMs) return 'online';
  if (safeElapsed >= timing.conduitResolveStartMs) return 'conduits';

  // Ring 0 / index 0 has zero additional stagger, so its own capture start is
  // the earliest possible moment any project begins moving — the correct
  // boundary between 'rings' (guides only) and 'projects' (capture begins).
  const firstProjectCaptureStartMs = getRingAssemblyStartMs(0, timing) + timing.projectCaptureStartMs;
  if (safeElapsed >= firstProjectCaptureStartMs) return 'projects';
  if (safeElapsed >= timing.ringRevealStartMs) return 'rings';
  return 'reactor';
}

// ---------------------------------------------------------------------------
// 4. Ring stagger — one shared elapsed-time value, read at a per-ring offset.
// No per-ring clock/transition object is ever created.
// ---------------------------------------------------------------------------

/**
 * Ring reveal progress in [0, 1], derived from the SAME shared `elapsedMs`
 * every ring reads — ring 0 always reaches any given progress before ring 1,
 * etc. Deliberately does double duty as both this module's original "ring
 * capture stagger" concept (Phase 1) AND Phase 4C1's "project ring GUIDE
 * visual reveal" — the two are the same timing relationship (a ring's guide
 * should be established by/around the moment that ring's own projects begin
 * capturing), so TopologyCanvas reuses this one function for both rather
 * than duplicating an equivalent second one under a different name.
 */
export function getRingAssemblyProgress(
  elapsedMs: number,
  ringIndex: number,
  timing: TopologyAssemblyTiming = DEFAULT_TOPOLOGY_ASSEMBLY_TIMING
): number {
  const safeElapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  const start = getRingAssemblyStartMs(ringIndex, timing);
  const duration = Math.max(1, timing.ringRevealDurationMs);
  return clamp((safeElapsed - start) / duration, 0, 1);
}

// ---------------------------------------------------------------------------
// Phase 4C1 — presentation-only reveal helpers. None of these touch
// geometry, phase, or any node-motion formula; each is a pure elapsed-time
// -> [0, 1] progress derivation a caller multiplies into an existing
// opacity/style value. Count-independent by construction (pure functions of
// elapsedMs and fixed timing constants), so zero projects/capabilities can
// never stall or divide-by-zero any of them.
// ---------------------------------------------------------------------------

/** Capability Reactor shell reveal progress in [0, 1] — presentation only; never touches reactor geometry or reactor phase. */
export function getReactorRevealProgress(
  elapsedMs: number,
  timing: TopologyAssemblyTiming = DEFAULT_TOPOLOGY_ASSEMBLY_TIMING
): number {
  const safeElapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  const duration = Math.max(1, timing.reactorRevealDurationMs);
  return clamp((safeElapsed - timing.reactorRevealStartMs) / duration, 0, 1);
}

/** Conduit reveal progress in [0, 1] — presentation only; conduits still resolve their actual endpoints from getProjectPos/getSkillPos, never from a separate position formula. */
export function getConduitRevealProgress(
  elapsedMs: number,
  timing: TopologyAssemblyTiming = DEFAULT_TOPOLOGY_ASSEMBLY_TIMING
): number {
  const safeElapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  const duration = Math.max(1, timing.conduitResolveDurationMs);
  return clamp((safeElapsed - timing.conduitResolveStartMs) / duration, 0, 1);
}

// ---------------------------------------------------------------------------
// 5. Project-level stagger — bounded by the CANONICAL maximum ring capacity
// (`MAX_PROJECTS_PER_RING`, currently 18), never by a given ring's actual
// live membership count. This is what keeps a full ring's projects arriving
// in a restrained rapid stagger instead of serializing one-after-another, and
// what keeps a 55+ project / multi-ring portfolio from producing an
// arbitrarily long introduction: every ring's project-capture window is the
// same bounded width regardless of how many rings exist, and rings overlap
// in time (ringStaggerMs is small relative to projectCaptureDurationMs), so
// total introduction length is governed by `totalDurationMs`, not by N.
// ---------------------------------------------------------------------------

/**
 * Deterministic per-project delay (ms) within its own ring, relative to that
 * ring's own project-capture start. Spreads ring-local indices evenly across
 * a span capped at `maxProjectStaggerSpanMs` — the LAST possible index
 * (`MAX_PROJECTS_PER_RING - 1`) always lands at exactly that cap, so growing
 * a ring toward its canonical capacity never grows the total stagger span
 * past it.
 */
export function getProjectAssemblyStartOffsetMs(
  indexWithinRing: number,
  timing: TopologyAssemblyTiming = DEFAULT_TOPOLOGY_ASSEMBLY_TIMING
): number {
  const safeIndex = Number.isFinite(indexWithinRing) ? Math.max(0, indexWithinRing) : 0;
  const maxIndex = Math.max(1, MAX_PROJECTS_PER_RING - 1);
  const safeSpan = Number.isFinite(timing.maxProjectStaggerSpanMs) ? Math.max(0, timing.maxProjectStaggerSpanMs) : 0;
  const safeStep = Number.isFinite(timing.projectStaggerMs) ? Math.max(0, timing.projectStaggerMs) : 0;
  const perProjectStep = Math.min(safeStep, safeSpan / maxIndex);
  return Math.min(safeIndex, maxIndex) * perProjectStep;
}

/** Project capture progress in [0, 1] for one project, derived from its ring's own start plus its deterministic ring-local stagger offset — no per-project clock/transition object. */
export function getProjectAssemblyProgress(
  elapsedMs: number,
  ringIndex: number,
  indexWithinRing: number,
  timing: TopologyAssemblyTiming = DEFAULT_TOPOLOGY_ASSEMBLY_TIMING
): number {
  const safeElapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  const start =
    getRingAssemblyStartMs(ringIndex, timing) +
    timing.projectCaptureStartMs +
    getProjectAssemblyStartOffsetMs(indexWithinRing, timing);
  const duration = Math.max(1, timing.projectCaptureDurationMs);
  return clamp((safeElapsed - start) / duration, 0, 1);
}

// ---------------------------------------------------------------------------
// Phase 4B — capability-level stagger. Bounded by the ACTUAL live capability
// count (not a fixed canonical capacity like MAX_PROJECTS_PER_RING): there is
// no ring-style partitioned/runtime-variable membership for the single
// reactor, and the assembly precondition only ever activates from a state
// where every capability is mounted (never detached), so the count passed in
// is already a stable, safe basis. Deliberately a much smaller span than the
// project stagger (maxCapabilityStaggerSpanMs vs maxProjectStaggerSpanMs) so
// the reactor center reads as "activates rapidly," not serialized.
// ---------------------------------------------------------------------------

/**
 * Deterministic per-capability delay (ms) relative to the reactor's own
 * capture start. Spreads capability indices evenly across a span capped at
 * `maxCapabilityStaggerSpanMs` — the LAST index (`capabilityCount - 1`)
 * always lands at exactly that cap, so a larger capability count never
 * grows the total stagger span past it.
 */
export function getCapabilityAssemblyStartOffsetMs(
  indexWithinReactor: number,
  capabilityCount: number,
  timing: TopologyAssemblyTiming = DEFAULT_TOPOLOGY_ASSEMBLY_TIMING
): number {
  const safeIndex = Number.isFinite(indexWithinReactor) ? Math.max(0, indexWithinReactor) : 0;
  const safeCount = Number.isFinite(capabilityCount) && capabilityCount > 0 ? capabilityCount : 1;
  const maxIndex = Math.max(1, safeCount - 1);
  const safeSpan = Number.isFinite(timing.maxCapabilityStaggerSpanMs) ? Math.max(0, timing.maxCapabilityStaggerSpanMs) : 0;
  const safeStep = Number.isFinite(timing.capabilityStaggerMs) ? Math.max(0, timing.capabilityStaggerMs) : 0;
  const perCapabilityStep = Math.min(safeStep, safeSpan / maxIndex);
  return Math.min(safeIndex, maxIndex) * perCapabilityStep;
}

/** Capability capture progress in [0, 1] for one capability, derived from the shared reactor capture start plus its deterministic stagger offset — no per-capability clock/transition object. */
export function getCapabilityAssemblyProgress(
  elapsedMs: number,
  indexWithinReactor: number,
  capabilityCount: number,
  timing: TopologyAssemblyTiming = DEFAULT_TOPOLOGY_ASSEMBLY_TIMING
): number {
  const safeElapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  const start =
    timing.capabilityCaptureStartMs +
    getCapabilityAssemblyStartOffsetMs(indexWithinReactor, capabilityCount, timing);
  const duration = Math.max(1, timing.capabilityCaptureDurationMs);
  return clamp((safeElapsed - start) / duration, 0, 1);
}

// ---------------------------------------------------------------------------
// 6. Deterministic assembly offset — a stable-identity-seeded, explicitly
// BOUNDED polar displacement (radial + angular) that a later phase combines
// with a project's own eventual ring angle/radius. Deliberately returns an
// abstract offset rather than a synthesized {x, y} screen position: this
// module has no dependency on isometric projection or ring geometry, so the
// same offset algorithm can be reused unchanged however Phase 2 chooses to
// combine it with the live orbit formulas.
// ---------------------------------------------------------------------------

/**
 * Tiny deterministic stable-string hash (FNV-1a, 32-bit). Not cryptographic —
 * only needs to be stable and reasonably well-distributed for identical
 * inputs to always agree and differing inputs to usually diverge. Pure
 * arithmetic on the input string only — no pseudo-random source, no clock
 * read, no external dependency.
 */
export function computeStableIdentityHash(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Maps a 32-bit unsigned hash into the unit interval [0, 1). */
export function mapHashToUnitInterval(hash: number): number {
  return (hash >>> 0) / 0x100000000;
}

export interface AssemblyOffsetBudget {
  /** Hard ceiling (iso units) no computed radial offset may ever exceed. This is the safety bound a future phase uses to keep assembly start positions inside the approved/Fit-All-safe visual bounds — pass a smaller value (e.g. derived from a ring's own radius) without touching the offset algorithm itself. */
  maxRadialOffsetIso: number;
  /** Max angular jitter (radians) applied around a project's own eventual slot angle. Kept small relative to the radial budget so displacement reads as "mostly radial, slightly scattered" rather than randomly placed. */
  maxAngularJitterRadians: number;
}

/**
 * Visual tuning pass (post Phase 4B physical review): the original 90 iso
 * radial budget read as too close to the ring for the capture/attraction
 * motion to be legible. Raised to 140 — a conservative pick within the
 * requested 135-155 investigation range, not the maximum — so a project
 * visibly starts away from its ring before the moving-target capture pulls
 * it in. Angular jitter is deliberately left UNCHANGED at 18°: it already
 * sat at the floor of the requested 18-20° range, and the goal of this pass
 * is a more dramatic RADIAL capture journey, not more scatter — this stays
 * "gravitational/orbital attraction," not randomized card placement. Timing,
 * easing, stagger, and every other accepted behavior are untouched; this is
 * the only constant this pass changes for projects.
 */
export const DEFAULT_ASSEMBLY_OFFSET_BUDGET: AssemblyOffsetBudget = {
  maxRadialOffsetIso: 140,
  maxAngularJitterRadians: Math.PI / 10,
};

/**
 * Phase 4B: a deliberately SMALLER budget for capability/technology reactor
 * nodes — materially tighter than DEFAULT_ASSEMBLY_OFFSET_BUDGET, not a
 * scaled-down copy of it. Capabilities should read as "aligning, locking,
 * magnetically seating" into the reactor, not scattering like project cards.
 *
 * Visual tuning pass (post Phase 4B physical review): raised from 32 to 60
 * iso radial — a conservative pick within the requested 55-70 investigation
 * range — so the center's own capture reads as more than a barely-visible
 * settle, while staying materially tighter than the project radial budget
 * (60 < 140). Angular jitter stays UNCHANGED at 6°, already at the floor of
 * the requested 6-10° range and well under the project's 18° — the center
 * must keep reading as tight/dense/mechanical, not widely scattered.
 */
export const DEFAULT_CAPABILITY_ASSEMBLY_OFFSET_BUDGET: AssemblyOffsetBudget = {
  maxRadialOffsetIso: 60,
  maxAngularJitterRadians: Math.PI / 30,
};

/**
 * DEV-only redesign scatter profiles. Both are deterministic inputs to the
 * existing offset helper; capabilities remain materially tighter than projects.
 */
export const REDESIGN_PROJECT_ASSEMBLY_OFFSET_BUDGET: AssemblyOffsetBudget = {
  maxRadialOffsetIso: 260,
  maxAngularJitterRadians: Math.PI * (38 / 180),
};

export const REDESIGN_CAPABILITY_ASSEMBLY_OFFSET_BUDGET: AssemblyOffsetBudget = {
  maxRadialOffsetIso: 130,
  maxAngularJitterRadians: Math.PI * (16 / 180),
};

export interface AssemblyOffset {
  /** Additional radial distance (iso units) beyond the project's own eventual ring radius, in [0, budget.maxRadialOffsetIso]. */
  radialOffsetIso: number;
  /** Angular offset (radians) around the project's own eventual slot angle, in [-budget.maxAngularJitterRadians, budget.maxAngularJitterRadians]. */
  angularOffsetRadians: number;
}

/**
 * Derives a deterministic, explicitly bounded assembly-start offset from
 * stable topology identity — the same `(projectId, ringIndex, indexWithinRing)`
 * triple always produces the exact same offset, and the offset can never
 * exceed the supplied budget regardless of input. No randomness of any kind.
 */
export function getDeterministicAssemblyOffset(
  projectId: string,
  ringIndex: number,
  indexWithinRing: number,
  budget: AssemblyOffsetBudget = DEFAULT_ASSEMBLY_OFFSET_BUDGET
): AssemblyOffset {
  const safeMaxRadial = Number.isFinite(budget.maxRadialOffsetIso) ? Math.max(0, budget.maxRadialOffsetIso) : 0;
  const safeMaxAngular = Number.isFinite(budget.maxAngularJitterRadians) ? Math.max(0, budget.maxAngularJitterRadians) : 0;
  const safeRingIndex = Number.isFinite(ringIndex) ? Math.max(0, Math.floor(ringIndex)) : 0;
  const safeIndexWithinRing = Number.isFinite(indexWithinRing) ? Math.max(0, Math.floor(indexWithinRing)) : 0;

  // Salted per-axis (and with ring index/local index, not just projectId) so
  // two projects sharing a similar id still diverge, and the radial/angular
  // components never move in lockstep with each other.
  const identity = `${projectId}::${safeRingIndex}::${safeIndexWithinRing}`;
  const radialUnit = mapHashToUnitInterval(computeStableIdentityHash(`${identity}::radial`));
  const angularUnit = mapHashToUnitInterval(computeStableIdentityHash(`${identity}::angular`));

  return {
    radialOffsetIso: radialUnit * safeMaxRadial,
    angularOffsetRadians: (angularUnit * 2 - 1) * safeMaxAngular,
  };
}

// ---------------------------------------------------------------------------
// 8. Capture easing — a single deterministic analytic curve, not a physics
// solver: restrained start (zero slope at progress 0), accelerates, a small
// controlled overshoot approaching the target, then settles exactly at 1.
// Composition of a quadratic ease-in "warm-up" (restrained start) feeding a
// classic bounded "back" ease-out (the overshoot/settle) — both closed-form,
// both deterministic, both exact at their endpoints.
// ---------------------------------------------------------------------------

/** Standard "back" overshoot constant — restrained (~10% peak overshoot for input in [0, 1]), not the more exaggerated values sometimes used for playful UI. */
const CAPTURE_EASE_OVERSHOOT = 1.70158;

/**
 * Phase 4B: a materially tighter overshoot constant for capability/reactor
 * nodes — empirically ~3% peak overshoot (vs the project curve's ~10%) for
 * the identical warm-up/back-ease composition below. Chosen by sampling the
 * same curve shape across candidate constants and picking the smallest one
 * that still reads as an intentional (not accidental/rounding-noise) settle
 * — "pulled inward, tiny mechanical seat, synchronized," not a bounce.
 */
const CAPABILITY_CAPTURE_EASE_OVERSHOOT = 0.9;

/**
 * The shared closed-form "back" ease-out curve, parameterized by its own
 * overshoot constant so project and capability capture can read as
 * distinctly different intensities of the SAME analytic character rather
 * than two independently-tuned curve shapes.
 */
function easeOutBackWithOvershoot(t: number, overshootConstant: number): number {
  const c3 = overshootConstant + 1;
  const shifted = t - 1;
  return 1 + c3 * shifted * shifted * shifted + overshootConstant * shifted * shifted;
}

/**
 * Shared restrained-start/accelerate/overshoot/settle composition: a
 * quadratic ease-in "warm-up" (zero slope at progress 0) feeding the bounded
 * back ease-out above, at the given overshoot constant. progress 0 -> exactly
 * 0, progress 1 -> exactly 1, via explicit endpoint returns rather than
 * trusting the algebra to cancel to exactly 0/1 in floating point — the same
 * reasoning resolveOrbitReflowPositions applies to its own progress<=0/>=1
 * boundaries (see projectDocking.ts): callers relying on an exact settled
 * value (e.g. resolveAssemblyPosition's zero-jump contract) must never see
 * an epsilon-off result. Non-finite input is treated as 0.
 */
function captureEasingWithOvershoot(progress: number, overshootConstant: number): number {
  const t = clamp(Number.isFinite(progress) ? progress : 0, 0, 1);
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const warmedUp = t * t; // zero slope at t=0: restrained start, then accelerates
  return easeOutBackWithOvershoot(warmedUp, overshootConstant);
}

/**
 * Capture easing curve: progress 0 -> exactly 0 (start), progress 1 ->
 * exactly 1 (settled target), with a restrained-start/accelerate/small-
 * overshoot/settle character in between.
 */
export function getAssemblyCaptureEasing(progress: number): number {
  return captureEasingWithOvershoot(progress, CAPTURE_EASE_OVERSHOOT);
}

/**
 * Phase 4B: the SAME curve shape as getAssemblyCaptureEasing, at the much
 * more restrained CAPABILITY_CAPTURE_EASE_OVERSHOOT — "aligned, locked,
 * magnetically seated," not "boing."
 */
export function getCapabilityAssemblyCaptureEasing(progress: number): number {
  return captureEasingWithOvershoot(progress, CAPABILITY_CAPTURE_EASE_OVERSHOOT);
}

// ---------------------------------------------------------------------------
// 9/10. Moving-target position resolution with a hard zero-jump endpoint
// contract. This function knows nothing about ring geometry, orbit phase, or
// how `liveTarget` was computed — the caller re-resolves liveTarget fresh
// every frame from the existing live topology formulas (this is what makes
// the "moving target" property hold; this function itself has no memory of
// any previous call).
// ---------------------------------------------------------------------------

export interface AssemblyPoint {
  x: number;
  y: number;
}

/**
 * Combines a fixed assembly start position, the CURRENT live target position,
 * and progress into a render position.
 *
 * Two DISTINCT notions of "progress" are required, not one:
 *
 * - `rawProgress` — the linear, unmodified [0, 1] timeline position. This
 *   (and ONLY this) determines completion.
 * - `interpolationFactor` — the value actually used to blend `start` toward
 *   `liveTarget`, typically `getAssemblyCaptureEasing(rawProgress)`. This is
 *   deliberately NOT clamped to 1 here: `getAssemblyCaptureEasing`'s bounded
 *   "back" overshoot legitimately returns values above 1 for a wide raw-
 *   progress band before raw progress itself reaches 1 (empirically, from
 *   roughly rawProgress 0.61 through 1, peaking ~1.10 near rawProgress
 *   0.76) — a deliberate small controlled overshoot PAST the live target,
 *   not a bug. Collapsing on `interpolationFactor >= 1` instead of
 *   `rawProgress >= 1` would treat that entire overshoot window as
 *   "finished" and silently delete the effect it exists to produce.
 *
 * Passing `rawProgress` as `interpolationFactor` too (i.e. no easing) is a
 * valid and supported use — the two are independent parameters, not a
 * paired eased/raw couple that must move in lockstep.
 *
 * Zero-jump contract: at `rawProgress >= 1`, `liveTarget` is returned
 * DIRECTLY — not `lerp(start, liveTarget, interpolationFactor)` — so the
 * handoff to the ordinary live position is exact, not merely float-close,
 * regardless of whatever `interpolationFactor` happens to be at that
 * instant. Symmetrically, `rawProgress <= 0` returns `start` directly.
 */
export function resolveAssemblyPosition(
  start: AssemblyPoint,
  liveTarget: AssemblyPoint,
  rawProgress: number,
  interpolationFactor: number
): AssemblyPoint {
  const safeRawProgress = Number.isFinite(rawProgress) ? rawProgress : 0;
  if (safeRawProgress >= 1) return liveTarget;
  if (safeRawProgress <= 0) return start;
  const safeFactor = Number.isFinite(interpolationFactor) ? interpolationFactor : 0;
  return {
    x: start.x + (liveTarget.x - start.x) * safeFactor,
    y: start.y + (liveTarget.y - start.y) * safeFactor,
  };
}

// Re-exported so callers deriving an actual angle (start slot angle +
// angularOffsetRadians) elsewhere don't need a separate TWO_PI constant.
export { TWO_PI as ASSEMBLY_TWO_PI };
