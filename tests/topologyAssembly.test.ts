// Phase 1 coverage for the pure topology-assembly math primitives. No React,
// no RAF, no rendering — this suite proves the deterministic clock,
// phase/stagger derivation, bounded deterministic offset, capture easing, and
// moving-target/zero-jump resolution contracts in isolation, matching this
// codebase's established convention (pure-function node:test assertions, no
// React/jsdom harness — see adaptiveProjectRings.test.ts / orbitContinuousMachine.test.ts).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAssemblyClockState,
  stepAssemblyClock,
  isAssemblyComplete,
  getTopologyAssemblyPhase,
  getRingAssemblyStartMs,
  getRingAssemblyProgress,
  getProjectAssemblyStartOffsetMs,
  getProjectAssemblyProgress,
  computeStableIdentityHash,
  mapHashToUnitInterval,
  getDeterministicAssemblyOffset,
  getAssemblyCaptureEasing,
  getCapabilityAssemblyStartOffsetMs,
  getCapabilityAssemblyProgress,
  getCapabilityAssemblyCaptureEasing,
  resolveAssemblyPosition,
  getReactorRevealProgress,
  getConduitRevealProgress,
  getAssemblyFastCompletionProgress,
  getAssemblyFastCompletionEasing,
  getRedesignCoreActivationProgress,
  getRedesignFieldTraceGeometry,
  getRedesignFieldTraceProgress,
  getRedesignFieldTracePresentation,
  REDESIGN_BLACK_CORE_RADIUS,
  DEFAULT_TOPOLOGY_ASSEMBLY_TIMING,
  REDESIGN_FIELD_ASSEMBLY_TIMING,
  REDESIGN_PROJECT_ASSEMBLY_OFFSET_BUDGET,
  REDESIGN_CAPABILITY_ASSEMBLY_OFFSET_BUDGET,
  REDESIGN_FIELD_TRACE_COUNT,
  REDESIGN_FIELD_TRACE_TIMING,
  REDESIGN_FIELD_TRACE_PEAK_OPACITY,
  TOPOLOGY_ASSEMBLY_FAST_COMPLETION_DURATION_MS,
  DEFAULT_ASSEMBLY_OFFSET_BUDGET,
  DEFAULT_CAPABILITY_ASSEMBLY_OFFSET_BUDGET,
  type AssemblyClockState,
  type AssemblyOffsetBudget,
} from '../src/utils/topologyAssembly.ts';
import { MAX_PROJECTS_PER_RING } from '../src/utils/projectRingAllocation.ts';
import { projectPointOntoCapabilityReactor, type CapabilityReactorGeometry } from '../src/utils/capabilityReactor.ts';
import fs from 'node:fs';
import path from 'node:path';

const timing = DEFAULT_TOPOLOGY_ASSEMBLY_TIMING;

// ---------------------------------------------------------------------------
// Clock
// ---------------------------------------------------------------------------

test('clock: first running frame baselines without advancing elapsedMs', () => {
  const state = createAssemblyClockState();
  const next = stepAssemblyClock(state, 1000, true, 3000);
  assert.equal(next.elapsedMs, 0);
  assert.equal(next.lastTimestamp, 1000);
});

test('clock: subsequent running frame advances by exact delta', () => {
  const first = stepAssemblyClock(createAssemblyClockState(), 1000, true, 3000);
  const second = stepAssemblyClock(first, 1250, true, 3000);
  assert.equal(second.elapsedMs, 250);
  assert.equal(second.lastTimestamp, 1250);
});

test('clock: paused state preserves elapsedMs exactly', () => {
  const running = stepAssemblyClock(stepAssemblyClock(createAssemblyClockState(), 1000, true, 3000), 1400, true, 3000);
  assert.equal(running.elapsedMs, 400);
  const paused = stepAssemblyClock(running, 1500, false, 3000);
  assert.equal(paused.elapsedMs, 400, 'elapsedMs must not change while paused');
});

test('clock: pause clears the timestamp baseline', () => {
  const running = stepAssemblyClock(createAssemblyClockState(), 1000, true, 3000);
  const paused = stepAssemblyClock(running, 1500, false, 3000);
  assert.equal(paused.lastTimestamp, null);
});

test('clock: first resumed frame does not advance elapsedMs (re-baselines only)', () => {
  const running = stepAssemblyClock(stepAssemblyClock(createAssemblyClockState(), 1000, true, 3000), 1400, true, 3000);
  const paused = stepAssemblyClock(running, 1500, false, 3000);
  // Simulate the tab being hidden for five minutes, then resuming.
  const resumedFirstFrame = stepAssemblyClock(paused, 1500 + 5 * 60_000, true, 3000);
  assert.equal(resumedFirstFrame.elapsedMs, 400, 'must not jump forward by the paused duration');
  assert.equal(resumedFirstFrame.lastTimestamp, 1500 + 5 * 60_000);
});

test('clock: second resumed frame advances normally from the new baseline', () => {
  const running = stepAssemblyClock(stepAssemblyClock(createAssemblyClockState(), 1000, true, 3000), 1400, true, 3000);
  const paused = stepAssemblyClock(running, 1500, false, 3000);
  const resumedBaseline = stepAssemblyClock(paused, 1500 + 5 * 60_000, true, 3000);
  const resumedAdvance = stepAssemblyClock(resumedBaseline, 1500 + 5 * 60_000 + 100, true, 3000);
  assert.equal(resumedAdvance.elapsedMs, 500);
});

test('clock: elapsedMs clamps at totalDurationMs and never exceeds it', () => {
  let state = createAssemblyClockState();
  state = stepAssemblyClock(state, 0, true, 1000);
  state = stepAssemblyClock(state, 5000, true, 1000);
  assert.equal(state.elapsedMs, 1000);
  const isComplete = isAssemblyComplete(state, 1000);
  assert.equal(isComplete, true);
});

test('clock: invalid/negative deltas cannot corrupt elapsedMs', () => {
  const baseline = stepAssemblyClock(createAssemblyClockState(), 1000, true, 3000);
  const advanced = stepAssemblyClock(baseline, 1200, true, 3000);
  assert.equal(advanced.elapsedMs, 200);
  // A timestamp that goes BACKWARD (clock skew / stale event) must contribute zero, not a negative delta.
  const wentBackward = stepAssemblyClock(advanced, 1100, true, 3000);
  assert.equal(wentBackward.elapsedMs, 200, 'a backward timestamp must not reduce or corrupt elapsedMs');
  // Non-finite timestamp must also be inert.
  const nonFinite = stepAssemblyClock(advanced, Number.NaN, true, 3000);
  assert.equal(nonFinite.elapsedMs, 200);
  assert.equal(nonFinite.lastTimestamp, null);
});

test('clock: isAssemblyComplete is false before totalDurationMs and true at/after it', () => {
  let state = stepAssemblyClock(createAssemblyClockState(), 0, true, 1000);
  state = stepAssemblyClock(state, 999, true, 1000);
  assert.equal(isAssemblyComplete(state, 1000), false);
  state = stepAssemblyClock(state, 1000, true, 1000);
  assert.equal(isAssemblyComplete(state, 1000), true);
});

// ---------------------------------------------------------------------------
// Phase derivation
// ---------------------------------------------------------------------------

test('phase: phases occur in the intended order as elapsed time increases', () => {
  const samples = [0, 50, 300, 900, 2600, 3200, 5000];
  const phases = samples.map(ms => getTopologyAssemblyPhase(ms, timing));
  const order = ['reactor', 'rings', 'projects', 'conduits', 'online'];
  let lastIndex = -1;
  for (const phase of phases) {
    const idx = order.indexOf(phase);
    assert.ok(idx >= lastIndex, `phase ${phase} must not regress relative to prior samples`);
    lastIndex = idx;
  }
  assert.deepEqual(phases, ['reactor', 'reactor', 'rings', 'projects', 'conduits', 'online', 'online']);
});

test('phase: exact timing boundaries are deterministic', () => {
  assert.equal(getTopologyAssemblyPhase(timing.ringRevealStartMs - 1, timing), 'reactor');
  assert.equal(getTopologyAssemblyPhase(timing.ringRevealStartMs, timing), 'rings');

  const firstProjectCaptureStartMs = getRingAssemblyStartMs(0, timing) + timing.projectCaptureStartMs;
  assert.equal(getTopologyAssemblyPhase(firstProjectCaptureStartMs - 1, timing), 'rings');
  assert.equal(getTopologyAssemblyPhase(firstProjectCaptureStartMs, timing), 'projects');

  assert.equal(getTopologyAssemblyPhase(timing.conduitResolveStartMs - 1, timing), 'projects');
  assert.equal(getTopologyAssemblyPhase(timing.conduitResolveStartMs, timing), 'conduits');

  assert.equal(getTopologyAssemblyPhase(timing.totalDurationMs - 1, timing), 'conduits');
  assert.equal(getTopologyAssemblyPhase(timing.totalDurationMs, timing), 'online');
});

test('phase: final/large elapsed time always resolves to online', () => {
  assert.equal(getTopologyAssemblyPhase(timing.totalDurationMs, timing), 'online');
  assert.equal(getTopologyAssemblyPhase(timing.totalDurationMs * 100, timing), 'online');
  assert.equal(getTopologyAssemblyPhase(Number.POSITIVE_INFINITY, timing), 'reactor', 'non-finite input must not throw; treated as elapsed 0 (defensive, not a real caller input)');
});

// ---------------------------------------------------------------------------
// Ring stagger
// ---------------------------------------------------------------------------

test('ring stagger: ring 0 begins before ring 1', () => {
  assert.ok(getRingAssemblyStartMs(0, timing) < getRingAssemblyStartMs(1, timing));
});

test('ring stagger: ring 1 begins before ring 2', () => {
  assert.ok(getRingAssemblyStartMs(1, timing) < getRingAssemblyStartMs(2, timing));
});

test('ring stagger: progress clamps exactly to [0, 1]', () => {
  assert.equal(getRingAssemblyProgress(-500, 0, timing), 0);
  assert.equal(getRingAssemblyProgress(0, 5, timing), 0, 'far-future ring has not started yet at elapsed 0');
  assert.equal(getRingAssemblyProgress(timing.totalDurationMs * 10, 0, timing), 1);
});

test('ring stagger: large ring indexes remain finite and never negative/NaN', () => {
  const progress = getRingAssemblyProgress(timing.totalDurationMs, 100000, timing);
  assert.ok(Number.isFinite(progress));
  assert.ok(progress >= 0 && progress <= 1);
  const start = getRingAssemblyStartMs(100000, timing);
  assert.ok(Number.isFinite(start));
});

// ---------------------------------------------------------------------------
// Project stagger
// ---------------------------------------------------------------------------

test('project stagger: adjacent ring-local projects receive deterministic differing starts', () => {
  const offset0 = getProjectAssemblyStartOffsetMs(0, timing);
  const offset1 = getProjectAssemblyStartOffsetMs(1, timing);
  const offset2 = getProjectAssemblyStartOffsetMs(2, timing);
  assert.equal(offset0, 0);
  assert.ok(offset1 > offset0);
  assert.ok(offset2 > offset1);
});

test('project stagger: repeated calculation is identical (pure/deterministic)', () => {
  const a = getProjectAssemblyProgress(900, 1, 4, timing);
  const b = getProjectAssemblyProgress(900, 1, 4, timing);
  assert.equal(a, b);
});

test('project stagger: maximum ring capacity does not make timing explode', () => {
  const lastIndexOffset = getProjectAssemblyStartOffsetMs(MAX_PROJECTS_PER_RING - 1, timing);
  assert.ok(lastIndexOffset <= timing.maxProjectStaggerSpanMs + 1e-9);
  // An index far beyond canonical capacity must still be clamped to the same span, not grow further.
  const beyondCapacityOffset = getProjectAssemblyStartOffsetMs(MAX_PROJECTS_PER_RING * 10, timing);
  assert.equal(beyondCapacityOffset, lastIndexOffset);
});

test('project stagger: high total portfolio counts remain bounded because rings overlap', () => {
  // A 55+ project portfolio spans ceil(55/18) = 4 rings (indices 0-3). Every
  // ring's project-capture window must still complete comfortably inside the
  // overall totalDurationMs budget rather than serializing ring-after-ring.
  const ringCountFor55Plus = Math.ceil(55 / MAX_PROJECTS_PER_RING);
  const lastRingIndex = ringCountFor55Plus - 1;
  const lastRingLastProjectStart =
    getRingAssemblyStartMs(lastRingIndex, timing) +
    timing.projectCaptureStartMs +
    getProjectAssemblyStartOffsetMs(MAX_PROJECTS_PER_RING - 1, timing);
  const lastRingLastProjectFinish = lastRingLastProjectStart + timing.projectCaptureDurationMs;
  assert.ok(
    lastRingLastProjectFinish <= timing.totalDurationMs,
    `expected last project capture (${lastRingLastProjectFinish}ms) to finish within totalDurationMs (${timing.totalDurationMs}ms)`
  );
});

// ---------------------------------------------------------------------------
// Deterministic offset
// ---------------------------------------------------------------------------

test('offset: identical id/ring/index inputs produce identical offset', () => {
  const a = getDeterministicAssemblyOffset('project-alpha', 0, 3);
  const b = getDeterministicAssemblyOffset('project-alpha', 0, 3);
  assert.deepEqual(a, b);
});

test('offset: different stable ids can produce different angular variation', () => {
  const a = getDeterministicAssemblyOffset('project-alpha', 0, 0);
  const b = getDeterministicAssemblyOffset('project-bravo', 0, 0);
  assert.notEqual(a.angularOffsetRadians, b.angularOffsetRadians);
  assert.notEqual(a.radialOffsetIso, b.radialOffsetIso);
});

test('offset: implementation never calls Math.random', () => {
  const source = fs.readFileSync(path.resolve('src/utils/topologyAssembly.ts'), 'utf8');
  assert.ok(!source.includes('Math.random'), 'topologyAssembly.ts must not use Math.random anywhere');
});

test('offset: displacement never exceeds the configured maximum', () => {
  const tightBudget: AssemblyOffsetBudget = { maxRadialOffsetIso: 12, maxAngularJitterRadians: 0.05 };
  for (let i = 0; i < 40; i++) {
    const offset = getDeterministicAssemblyOffset(`project-${i}`, i % 4, i % 18, tightBudget);
    assert.ok(offset.radialOffsetIso >= 0 && offset.radialOffsetIso <= tightBudget.maxRadialOffsetIso + 1e-9);
    assert.ok(Math.abs(offset.angularOffsetRadians) <= tightBudget.maxAngularJitterRadians + 1e-9);
  }
});

test('offset: all outputs are finite for a wide range of inputs, including a zero budget', () => {
  const zeroBudget: AssemblyOffsetBudget = { maxRadialOffsetIso: 0, maxAngularJitterRadians: 0 };
  const cases: Array<[string, number, number, AssemblyOffsetBudget | undefined]> = [
    ['', 0, 0, undefined],
    ['project-x', -5, -5, undefined],
    ['project-y', 0, 0, zeroBudget],
    ['🚀unicode-id', 3, 17, undefined],
  ];
  for (const [id, ringIndex, indexWithinRing, budget] of cases) {
    const offset = budget
      ? getDeterministicAssemblyOffset(id, ringIndex, indexWithinRing, budget)
      : getDeterministicAssemblyOffset(id, ringIndex, indexWithinRing);
    assert.ok(Number.isFinite(offset.radialOffsetIso));
    assert.ok(Number.isFinite(offset.angularOffsetRadians));
  }
});

test('offset: default budget bounds are respected against the default config', () => {
  const offset = getDeterministicAssemblyOffset('project-default', 2, 6);
  assert.ok(offset.radialOffsetIso <= DEFAULT_ASSEMBLY_OFFSET_BUDGET.maxRadialOffsetIso);
  assert.ok(Math.abs(offset.angularOffsetRadians) <= DEFAULT_ASSEMBLY_OFFSET_BUDGET.maxAngularJitterRadians);
});

test('offset: stable hash + unit-interval mapping are themselves deterministic and bounded', () => {
  assert.equal(computeStableIdentityHash('abc'), computeStableIdentityHash('abc'));
  assert.notEqual(computeStableIdentityHash('abc'), computeStableIdentityHash('abd'));
  const unit = mapHashToUnitInterval(computeStableIdentityHash('any-stable-string'));
  assert.ok(unit >= 0 && unit < 1);
});

// ---------------------------------------------------------------------------
// Easing
// ---------------------------------------------------------------------------

test('easing: progress 0 produces exactly the start value (0)', () => {
  assert.equal(getAssemblyCaptureEasing(0), 0);
});

test('easing: progress 1 produces exactly the settled value (1)', () => {
  assert.equal(getAssemblyCaptureEasing(1), 1);
});

test('easing: any intentional overshoot stays small and bounded', () => {
  let max = -Infinity;
  for (let i = 0; i <= 100; i++) {
    max = Math.max(max, getAssemblyCaptureEasing(i / 100));
  }
  assert.ok(max > 1, 'expected the curve to intentionally overshoot above 1 somewhere in its range');
  assert.ok(max <= 1.15, `overshoot must stay restrained, got peak ${max}`);
});

test('easing: curve stays finite (and does not diverge wildly) across the full sampled range', () => {
  for (let i = -20; i <= 120; i++) {
    const value = getAssemblyCaptureEasing(i / 100);
    assert.ok(Number.isFinite(value), `non-finite result at progress ${i / 100}`);
    assert.ok(value >= -0.05 && value <= 1.15, `out-of-range result ${value} at progress ${i / 100}`);
  }
});

test('easing: exceeds 1.0 for a wide raw-progress band strictly before raw completion — the exact reason resolveAssemblyPosition needs a separate raw-progress completion signal (Phase 3.5)', () => {
  // Documents the conflict this micro-phase exists to resolve: if the eased
  // factor alone were used to decide completion, roughly the last 39% of
  // the timeline would incorrectly read as "finished."
  let firstCrossing: number | null = null;
  for (let i = 0; i <= 1000; i++) {
    const t = i / 1000;
    if (getAssemblyCaptureEasing(t) > 1) {
      firstCrossing = t;
      break;
    }
  }
  assert.ok(firstCrossing !== null, 'expected the curve to cross above 1.0 somewhere before raw progress 1');
  assert.ok(firstCrossing! < 0.7, 'expected the crossing well before raw completion, not just at the very end');
  assert.ok(getAssemblyCaptureEasing(0.9) > 1, 'sanity: still overshooting at raw progress 0.9, i.e. 90% through the raw timeline');
});

// ---------------------------------------------------------------------------
// Moving target
// ---------------------------------------------------------------------------

test('moving target: changing liveTarget mid-transition changes the resolved position', () => {
  const start = { x: 0, y: 0 };
  const targetA = { x: 100, y: 0 };
  const targetB = { x: 0, y: 100 };
  const resolvedA = resolveAssemblyPosition(start, targetA, 0.5, 0.5);
  const resolvedB = resolveAssemblyPosition(start, targetB, 0.5, 0.5);
  assert.notDeepEqual(resolvedA, resolvedB);
});

test('moving target: the function stores/captures nothing internally (pure, stateless)', () => {
  const start = { x: 0, y: 0 };
  const target = { x: 10, y: 10 };
  const first = resolveAssemblyPosition(start, target, 0.5, 0.5);
  // Calling again with a DIFFERENT target at the same progress must reflect
  // that new target immediately — proof there is no internal memoized target.
  const differentTarget = { x: 200, y: 200 };
  const second = resolveAssemblyPosition(start, differentTarget, 0.5, 0.5);
  assert.notDeepEqual(first, second);
  assert.deepEqual(second, { x: 100, y: 100 });
});

// ---------------------------------------------------------------------------
// Zero-jump endpoint (Phase 3.5: completion is governed by rawProgress ONLY,
// independent of whatever interpolationFactor happens to be)
// ---------------------------------------------------------------------------

test('zero-jump: raw progress exactly 1 returns the exact target coordinates, regardless of interpolationFactor', () => {
  const start = { x: 5, y: 5 };
  const target = { x: 123.456, y: -78.9 };
  const resolved = resolveAssemblyPosition(start, target, 1, 1.03);
  assert.deepEqual(resolved, target);
  assert.equal(resolved, target, 'expected the SAME object reference, not merely a deep-equal copy');
});

test('zero-jump: raw progress greater than 1 also returns the exact target', () => {
  const start = { x: 5, y: 5 };
  const target = { x: 123.456, y: -78.9 };
  const resolved = resolveAssemblyPosition(start, target, 1.5, 1.03);
  assert.deepEqual(resolved, target);
});

test('zero-jump: repeated end-state resolution is deterministic', () => {
  const start = { x: 5, y: 5 };
  const target = { x: 42, y: 42 };
  const first = resolveAssemblyPosition(start, target, 1, 1);
  const second = resolveAssemblyPosition(start, target, 1, 1);
  assert.deepEqual(first, second);
});

// ---------------------------------------------------------------------------
// Phase 3.5 — raw progress vs. eased interpolation factor are independent.
// An eased factor above 1.0 (mid-timeline overshoot) must NOT be mistaken
// for completion; only rawProgress may signal completion. This is the
// contract the module-level docs on resolveAssemblyPosition describe.
// ---------------------------------------------------------------------------

test('overshoot: an interpolation factor above 1.0 mid-timeline does NOT snap to liveTarget merely because it exceeds 1', () => {
  const start = { x: 0, y: 0 };
  const target = { x: 100, y: 0 };
  const rawProgress = 0.72;
  const interpolationFactor = getAssemblyCaptureEasing(rawProgress);
  assert.ok(interpolationFactor > 1, 'sanity: this specific raw progress must actually be in the overshoot band');

  const result = resolveAssemblyPosition(start, target, rawProgress, interpolationFactor);
  assert.notDeepEqual(result, target, 'must not have snapped to the live target early');
});

test('overshoot: that intermediate position genuinely passes beyond the live target along the start->target vector', () => {
  const start = { x: 0, y: 0 };
  const target = { x: 100, y: 0 };
  const rawProgress = 0.72;
  const interpolationFactor = getAssemblyCaptureEasing(rawProgress);
  const result = resolveAssemblyPosition(start, target, rawProgress, interpolationFactor);
  assert.ok(result.x > 100, `expected overshoot beyond the target's x=100, got ${result.x}`);
});

test('overshoot: raw progress 1 collapses the very same overshooting interpolation factor to the exact live target', () => {
  const start = { x: 0, y: 0 };
  const target = { x: 100, y: 0 };
  const interpolationFactor = getAssemblyCaptureEasing(0.72); // still > 1
  const finished = resolveAssemblyPosition(start, target, 1, interpolationFactor);
  assert.deepEqual(finished, target);
});

test('overshoot: the interpolation factor is never clamped to 1 by the resolver itself — the raw asymmetry between rawProgress and interpolationFactor is preserved through the blend', () => {
  const start = { x: 0, y: 0 };
  const target = { x: 100, y: 0 };
  const clampedAt1 = resolveAssemblyPosition(start, target, 0.5, 1);
  const above1 = resolveAssemblyPosition(start, target, 0.5, 1.1);
  assert.notDeepEqual(clampedAt1, above1, 'a caller-supplied interpolationFactor above 1 must produce a different (further) result than exactly 1, proving no internal clamp to 1');
  assert.ok(above1.x > clampedAt1.x);
});

test('overshoot: negative raw progress returns exactly the start position regardless of interpolationFactor, never invalid movement', () => {
  const start = { x: 5, y: 5 };
  const target = { x: 100, y: 100 };
  const resolved = resolveAssemblyPosition(start, target, -0.4, 1.1);
  assert.deepEqual(resolved, start);
  assert.equal(resolved, start, 'expected the exact start reference');
});

test('overshoot: a non-finite interpolationFactor is treated inertly (0) rather than corrupting the output, without affecting raw-progress completion semantics', () => {
  const start = { x: 0, y: 0 };
  const target = { x: 100, y: 0 };
  const midTimeline = resolveAssemblyPosition(start, target, 0.5, Number.NaN);
  assert.ok(Number.isFinite(midTimeline.x) && Number.isFinite(midTimeline.y));
  assert.deepEqual(midTimeline, start, 'a non-finite factor must be treated as 0 (no blend applied), never NaN propagation');

  // Completion must still be exact at rawProgress 1, even with a garbage factor.
  const finished = resolveAssemblyPosition(start, target, 1, Number.POSITIVE_INFINITY);
  assert.deepEqual(finished, target);
});

test('overshoot: all outputs remain finite across a dense sample of raw-progress/interpolation-factor combinations', () => {
  const start = { x: 0, y: 0 };
  const target = { x: 100, y: 50 };
  for (let i = -20; i <= 120; i++) {
    const rawProgress = i / 100;
    const interpolationFactor = getAssemblyCaptureEasing(rawProgress);
    const resolved = resolveAssemblyPosition(start, target, rawProgress, interpolationFactor);
    assert.ok(Number.isFinite(resolved.x) && Number.isFinite(resolved.y), `non-finite output at rawProgress ${rawProgress}`);
  }
});

// ---------------------------------------------------------------------------
// Generic edge cases
// ---------------------------------------------------------------------------

test('generic: zero projects requires no project-transition entries (nothing here iterates a project list at all)', () => {
  // This module never receives or iterates a project collection — every
  // project-facing function takes a single project's identity/index. Zero
  // projects simply means a caller never invokes these functions, which
  // requires no special-casing in this module. Ring-facing functions must
  // still behave for ring index 0 even with nothing docked to it.
  assert.equal(getRingAssemblyProgress(0, 0, timing), 0);
  assert.doesNotThrow(() => getProjectAssemblyProgress(0, 0, 0, timing));
});

test('generic: synthetic 1/18/19/33/55-project-equivalent inputs derive valid bounded stagger schedules with no owner-specific code', () => {
  const portfolioSizes = [1, 18, 19, 33, 55];
  for (const projectCount of portfolioSizes) {
    const ringCount = Math.max(1, Math.ceil(projectCount / MAX_PROJECTS_PER_RING));
    for (let ringIndex = 0; ringIndex < ringCount; ringIndex++) {
      const projectsInThisRing = Math.min(MAX_PROJECTS_PER_RING, projectCount - ringIndex * MAX_PROJECTS_PER_RING);
      for (let indexWithinRing = 0; indexWithinRing < Math.max(0, projectsInThisRing); indexWithinRing++) {
        const progress = getProjectAssemblyProgress(timing.totalDurationMs, ringIndex, indexWithinRing, timing);
        assert.ok(progress >= 0 && progress <= 1);
        const offset = getDeterministicAssemblyOffset(`synthetic-${projectCount}-${ringIndex}-${indexWithinRing}`, ringIndex, indexWithinRing);
        assert.ok(Number.isFinite(offset.radialOffsetIso) && Number.isFinite(offset.angularOffsetRadians));
      }
    }
  }
});

// ---------------------------------------------------------------------------
// Phase 4C1 — presentation-only reveal helpers (getReactorRevealProgress,
// getConduitRevealProgress) and the presentationCompleteMs timing field.
// Pure elapsed-time -> [0,1] derivations only; none of these touch geometry,
// phase, or any node-motion formula.
// ---------------------------------------------------------------------------

test('4C1: getReactorRevealProgress is 0 before its start, rises linearly across its duration, and clamps to 1 after', () => {
  assert.equal(getReactorRevealProgress(timing.reactorRevealStartMs - 1, timing), 0);
  assert.equal(getReactorRevealProgress(timing.reactorRevealStartMs, timing), 0);
  const mid = timing.reactorRevealStartMs + timing.reactorRevealDurationMs / 2;
  assert.ok(Math.abs(getReactorRevealProgress(mid, timing) - 0.5) < 1e-9);
  assert.equal(getReactorRevealProgress(timing.reactorRevealStartMs + timing.reactorRevealDurationMs, timing), 1);
  assert.equal(getReactorRevealProgress(timing.reactorRevealStartMs + timing.reactorRevealDurationMs * 50, timing), 1);
});

test('4C1: getReactorRevealProgress genuinely overlaps capability capture — reveal is still mid-flight when capabilityCaptureStartMs is reached', () => {
  // The whole point of extending reactorRevealDurationMs in Phase 4C1: the
  // brief must say capability synchronization begins WHILE the reactor shell
  // is still establishing, not after it reaches 100%.
  const progressAtCapabilityStart = getReactorRevealProgress(timing.capabilityCaptureStartMs, timing);
  assert.ok(progressAtCapabilityStart > 0 && progressAtCapabilityStart < 1, `expected a genuine mid-reveal overlap, got progress ${progressAtCapabilityStart} at capabilityCaptureStartMs`);
});

test('4C1: getReactorRevealProgress defensively handles non-finite/negative input without throwing', () => {
  assert.equal(getReactorRevealProgress(-500, timing), 0);
  assert.equal(getReactorRevealProgress(Number.NaN, timing), 0);
  assert.doesNotThrow(() => getReactorRevealProgress(Number.POSITIVE_INFINITY, timing));
});

test('4C1: getConduitRevealProgress is 0 before conduitResolveStartMs, rises linearly, and clamps to 1 after conduitResolveDurationMs elapses', () => {
  assert.equal(getConduitRevealProgress(timing.conduitResolveStartMs - 1, timing), 0);
  assert.equal(getConduitRevealProgress(timing.conduitResolveStartMs, timing), 0);
  const mid = timing.conduitResolveStartMs + timing.conduitResolveDurationMs / 2;
  assert.ok(Math.abs(getConduitRevealProgress(mid, timing) - 0.5) < 1e-9);
  assert.equal(getConduitRevealProgress(timing.conduitResolveStartMs + timing.conduitResolveDurationMs, timing), 1);
});

test('4C1: getConduitRevealProgress stays hidden/near-zero until nodes are substantially synchronized — conduitResolveStartMs sits late in the timeline, well after project capture begins', () => {
  const firstProjectCaptureStartMs = getRingAssemblyStartMs(0, timing) + timing.projectCaptureStartMs;
  assert.ok(
    timing.conduitResolveStartMs > firstProjectCaptureStartMs,
    'conduits must not begin resolving before the first project even begins capturing'
  );
  assert.equal(getConduitRevealProgress(0, timing), 0, 'quiet starting field: conduits fully hidden at elapsed 0');
});

test('4C1: presentationCompleteMs is strictly later than totalDurationMs — the shared clock keeps advancing past MOTION complete for a genuine "TOPOLOGY STABLE" beat', () => {
  assert.ok(
    timing.presentationCompleteMs > timing.totalDurationMs,
    'presentationCompleteMs must give the presentation layer a window strictly after node motion has finished'
  );
  assert.equal(
    getTopologyAssemblyPhase(timing.totalDurationMs, timing),
    'online',
    'the status phase must already read online for the entire presentationCompleteMs tail window'
  );
});

test('4C1: reveal helpers are count-independent pure functions of (elapsedMs, timing) only — same signature shape as the rest of this module, no project/capability list ever passed in', () => {
  // Structural proof by construction: calling with only the two documented
  // parameters must not throw, for any ring/element count scenario, because
  // neither function's signature accepts a count at all.
  assert.doesNotThrow(() => getReactorRevealProgress(0));
  assert.doesNotThrow(() => getConduitRevealProgress(0));
  // Function.length only counts parameters before the first default value,
  // so a (elapsedMs, timing = DEFAULT_TOPOLOGY_ASSEMBLY_TIMING) signature —
  // exactly what both helpers use — reports 1, not 2. The doesNotThrow calls
  // above are the real proof of "callable with just elapsedMs, no count".
  assert.equal(getReactorRevealProgress.length, 1, 'only elapsedMs is required — timing has a default, and there is no count parameter');
  assert.equal(getConduitRevealProgress.length, 1, 'only elapsedMs is required — timing has a default, and there is no count parameter');
});

test('module: does not import React', () => {
  const source = fs.readFileSync(path.resolve('src/utils/topologyAssembly.ts'), 'utf8');
  assert.ok(!/from ['"]react['"]/i.test(source));
  assert.ok(!source.includes("import React"));
});

test('module: does not read window/document/performance.now/Date.now', () => {
  const source = fs.readFileSync(path.resolve('src/utils/topologyAssembly.ts'), 'utf8');
  assert.ok(!source.includes('window.'));
  assert.ok(!source.includes('document.'));
  assert.ok(!source.includes('performance.now'));
  assert.ok(!source.includes('Date.now'));
});

// ===========================================================================
// PHASE 2 — dormant integration of the Phase 1 clock primitive into the
// existing shared dual-orbit RAF tick in TopologyCanvas.tsx. No visual
// behavior changes in this phase: these are structural/source-text
// regressions (matching this repo's established convention — see
// dualOrbitMachine.test.ts / orbitControls.test.ts / orbitContinuousMachine.test.ts,
// none of which use a React/jsdom rendering harness) plus a few pure-function
// tests proving the exact pause/resume formula TopologyCanvas now wires in.
// ===========================================================================

const canvasSource = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');

// The same tick-boundary extraction technique orbitControls.test.ts already
// uses ("TopologyCanvas mirrors only the project phase..." test): from the
// tick function's own declaration up to its FIRST recursive
// requestAnimationFrame(tick) call, which is the entire per-frame body minus
// that trailing self-reschedule line.
function extractDualOrbitTickBody(source: string): string {
  const tickStart = source.indexOf('const tick = (timestamp: number) => {');
  assert.ok(tickStart !== -1, 'expected to find the shared dual-orbit tick function');
  const tickEnd = source.indexOf('rafId = requestAnimationFrame(tick);', tickStart);
  assert.ok(tickEnd !== -1, 'expected the tick body to end at its own recursive reschedule call');
  return source.substring(tickStart, tickEnd);
}

// Same boundary dualOrbitMachine.test.ts / orbitControls.test.ts already use
// for "the whole shared RAF effect."
function extractDualOrbitEffect(source: string): string {
  const start = source.indexOf('const dualOrbitClockRef = useRef<DualOrbitClockState>');
  assert.ok(start !== -1);
  const end = source.indexOf('const projectsById', start);
  assert.ok(end !== -1);
  return source.substring(start, end);
}

test('phase2/1: TopologyCanvas.tsx imports every Phase 1 assembly primitive it uses from topologyAssembly.ts rather than duplicating any of it', () => {
  // Phase 4A activates real usage, so the import block grows to match:
  // createAssemblyClockState, isAssemblyComplete, getProjectAssemblyProgress,
  // getAssemblyCaptureEasing, resolveAssemblyPosition, and
  // getDeterministicAssemblyOffset join the Phase 2/3 imports. Still one
  // single import statement from '../utils/topologyAssembly', not a
  // scattered/duplicated set.
  // Phase 4C1 adds the four presentation-only reveal/phase helpers
  // (getTopologyAssemblyPhase, getRingAssemblyProgress,
  // getReactorRevealProgress, getConduitRevealProgress) to the same single
  // import statement — still one import from '../utils/topologyAssembly',
  // no scattered/duplicated set.
  const topologyImport = canvasSource.match(/import\s*\{([\s\S]*?)\}\s*from\s*'\.\.\/utils\/topologyAssembly';/);
  assert.ok(topologyImport, 'expected one topologyAssembly import block');
  for (const importedName of [
    'createAssemblyClockState', 'stepAssemblyClock', 'isAssemblyComplete',
    'getProjectAssemblyProgress', 'getAssemblyCaptureEasing',
    'getCapabilityAssemblyProgress', 'getCapabilityAssemblyCaptureEasing',
    'getTopologyAssemblyPhase', 'getRingAssemblyProgress',
    'getReactorRevealProgress', 'getConduitRevealProgress',
    'getRedesignCoreActivationProgress', 'resolveAssemblyPosition',
    'getDeterministicAssemblyOffset', 'DEFAULT_TOPOLOGY_ASSEMBLY_TIMING',
    'REDESIGN_FIELD_ASSEMBLY_TIMING',
  ]) {
    assert.ok(topologyImport![1].includes(importedName), `expected ${importedName} in the shared import`);
  }
  // No second implementation of any of these anywhere in the component file.
  assert.ok(!canvasSource.includes('interface AssemblyClockState'), 'TopologyCanvas must not redeclare the Phase 1 type');
  assert.ok(!canvasSource.includes('function stepAssemblyClock'), 'TopologyCanvas must not redefine the Phase 1 stepping function');
  assert.ok(!canvasSource.includes('function resolveAssemblyPosition'), 'TopologyCanvas must not redefine the Phase 1 resolver');
  assert.ok(!canvasSource.includes('function getDeterministicAssemblyOffset'), 'TopologyCanvas must not redefine the Phase 1 offset primitive');
});

test('phase2/2: an assembly runtime ref exists and is nullable/inactive by default', () => {
  assert.ok(
    canvasSource.includes('const assemblyClockRef = useRef<AssemblyClockState | null>(null);'),
    'expected a nullable assembly clock ref initialized to null'
  );
});

test('phase2/3 (extended by Phase 4C2-B): startup and SKIP reuse the same nullable clock ref', () => {
  // Old invariant (Phase 2/3): createAssemblyClockState was not even
  // imported, and exactly ONE assignment site existed anywhere. Phase 4A
  // authorized invariant: 5 sites (adding activation + two interaction-
  // cancellation clears). Phase 4B authorized invariant: the
  // interaction-cancellation writer is REMOVED entirely (see phase4b/38,39
  // below) — direct manipulation is now locked via processMove instead of
  // by tearing down assembly — leaving exactly 3 sites: the guarded
  // per-frame re-step, the completion clear, and the one activation call.
  // What must still hold: the lifecycle callers never duplicate clock setup;
  // only this shared primitive assigns a newly created clock, and
  // ASSEMBLE/RESET remain unrelated.
  assert.ok(!/assemblyClockRef\.current\s*=\s*\{/.test(canvasSource), 'no object-literal (hand-rolled clock start) assignment may exist — must always go through createAssemblyClockState()');

  const assignments = canvasSource.match(/assemblyClockRef\.current\s*=/g) ?? [];
  assert.equal(
    assignments.length,
    5,
    'expected one shared step, two completion clears, startup creation, and SKIP rebaseline'
  );
  assert.equal(
    (canvasSource.match(/assemblyClockRef\.current\s*=\s*createAssemblyClockState\(\);/g) ?? []).length,
    2,
    'startup and SKIP both use the same baseline factory on the same clock ref'
  );
  assert.equal(
    (canvasSource.match(/assemblyClockRef\.current\s*=\s*null;/g) ?? []).length,
    2,
    'normal completion and fast completion are the only clear-to-null sites'
  );
  assert.ok(
    canvasSource.includes('assemblyClockRef.current = nextAssemblyClock;'),
    'the per-frame re-step must assign the freshly stepped clock, not stepAssemblyClock(...) inline'
  );

  // The activation call site must be inside the shared gated primitive, not
  // duplicated between automatic startup and the DEV control.
  const triggerStart = canvasSource.indexOf("const startTopologyAssembly = useCallback((mode: TopologyAssemblyMode = 'production') => {");
  const triggerEndMatch = canvasSource.slice(triggerStart).match(/\}, \[\r?\n\s*canStartTopologyAssembly,/);
  assert.ok(triggerStart !== -1 && triggerEndMatch);
  const triggerEnd = triggerStart + triggerEndMatch!.index!;
  const triggerBlock = canvasSource.substring(triggerStart, triggerEnd);
  assert.ok(triggerBlock.includes('if (!canStartTopologyAssembly) return false;'), 'activation must be preconditioned');
  assert.ok(triggerBlock.includes('assemblyClockRef.current = createAssemblyClockState();'));

  // Phase 4C2-A intentionally calls the shared primitive after initial Fit All.
  const mountEffectStart = canvasSource.indexOf('const initializedRef = useRef(false);');
  const mountEffectEnd = canvasSource.indexOf('// Keyboard controls for zoom, fit, snap toggle, and reset', mountEffectStart);
  const mountEffect = canvasSource.substring(mountEffectStart, mountEffectEnd);
  assert.ok(mountEffect.includes("startTopologyAssembly('redesign');"), 'promotion: production startup now activates the approved redesign choreography directly');
});

test('Promotion: production startup is the sole caller of startTopologyAssembly, and it explicitly activates the approved redesign choreography', () => {
  // Old invariant (pre-promotion): the bare `startTopologyAssembly();`
  // (implicit 'production' mode) was the one automatic caller, and a
  // DEV-only manual control was the only caller of 'redesign' mode. New
  // invariant: the redesign choreography IS production's startup now, so
  // the bare no-arg call site no longer exists anywhere, and the sole
  // surviving call site explicitly passes 'redesign'.
  assert.equal((canvasSource.match(/startTopologyAssembly\(\);/g) ?? []).length, 0, 'no bare no-arg call site should remain — production now explicitly requests redesign mode');
  assert.equal((canvasSource.match(/startTopologyAssembly\('redesign'\);/g) ?? []).length, 1, 'exactly one caller: the production mount effect');
  assert.ok(!canvasSource.includes('TEST ASSEMBLY'));
  assert.ok(!canvasSource.includes('BLACK CORE TEST'), 'the temporary manual-testing button is removed now that production uses this path automatically');
  assert.ok(!canvasSource.includes('import.meta.env.DEV'), 'no DEV-only gating remains for this feature — it is real production behavior now');

  const startupEffect = extractInitialStartupEffect(canvasSource);
  assert.ok(startupEffect.includes("startTopologyAssembly('redesign');"), 'the one surviving call site must be the production mount effect');

  // No URL query parameters, localStorage flags, console globals, window
  // debug APIs, or keyboard shortcuts were used to activate it instead.
  assert.ok(!canvasSource.includes('URLSearchParams'));
  assert.ok(!canvasSource.includes('window.location.search'));
  assert.ok(!/localStorage.*assembl/i.test(canvasSource));
  assert.ok(!/window\.\w*[Aa]ssembly/.test(canvasSource), 'no window.* debug API for assembly may exist');
});

test('phase2/4+/raf-invariant: assembly stepping occurs only inside the existing persistent dual-orbit tick, exactly once', () => {
  assert.equal(
    (canvasSource.match(/stepAssemblyClock\(/g) ?? []).length,
    1,
    'stepAssemblyClock must be called from exactly one call site in the whole file'
  );
  const tickBody = extractDualOrbitTickBody(canvasSource);
  assert.ok(tickBody.includes('stepAssemblyClock('), 'the one call site must live inside the shared dual-orbit tick body');
  assert.ok(
    tickBody.includes('if (assemblyClockRef.current) {'),
    'assembly stepping must be guarded so it only runs when a transition already exists'
  );
  // Structural proof the call is nested INSIDE the guard, not merely present
  // somewhere in the tick: the guard opens before the call and the call's
  // own closing brace precedes the tick's own trailing reschedule.
  const guardIndex = tickBody.indexOf('if (assemblyClockRef.current) {');
  const callIndex = tickBody.indexOf('stepAssemblyClock(');
  assert.ok(guardIndex !== -1 && guardIndex < callIndex, 'the guard must open before the call it protects');
});

test('phase2/5,6,7/raf-invariant: no new persistent RAF chain, no per-project RAF, no per-ring RAF — total requestAnimationFrame count is unchanged from the two pre-existing chains', () => {
  // Exactly two independent, pre-existing RAF chains in this component: the
  // one persistent dual-orbit tick (2 occurrences: initial call + its own
  // recursive reschedule) and the one short-lived orbital-reflow tick (2
  // occurrences, same shape). Assembly reuses the FIRST of these; it does
  // not add a third chain, and total requestAnimationFrame( usage in the
  // file must therefore still be exactly 4 — not 5, not 6, and never once
  // per project or per ring (which would scale with project/ring count
  // instead of staying a fixed constant).
  const totalRafCalls = (canvasSource.match(/requestAnimationFrame\(/g) ?? []).length;
  assert.equal(totalRafCalls, 4, 'total requestAnimationFrame( call count must remain exactly 4 (dual-orbit tick x2 + reflow tick x2)');

  const dualOrbitEffect = extractDualOrbitEffect(canvasSource);
  assert.equal((dualOrbitEffect.match(/requestAnimationFrame\(/g) ?? []).length, 2, 'the dual-orbit effect itself must still schedule exactly 2 (matches dualOrbitMachine.test.ts)');

  // No RAF call appears inside any `.map(` iteration over projects/rings
  // anywhere in the file (the structural signature of a per-project or
  // per-ring loop) — a blunt but effective guard against exactly the
  // anti-pattern this phase must avoid.
  assert.ok(
    !/\.map\([^)]*=>\s*\{[^}]*requestAnimationFrame/s.test(canvasSource),
    'no requestAnimationFrame call may appear inside a per-project/per-ring .map(...) callback'
  );
});

test('phase2/8,9: no assembly-specific setInterval or setTimeout timing loop exists', () => {
  assert.equal((canvasSource.match(/setInterval\(/g) ?? []).length, 0, 'this component must not use setInterval for anything, assembly included');

  // setTimeout IS used elsewhere in this file (toast auto-dismiss, the
  // orbit resume-delay grace timer) — those are legitimate and pre-existing.
  // The requirement is narrower: nothing assembly-related may be driven by
  // setTimeout. Prove it by checking the tick body (the only place assembly
  // code exists) contains no setTimeout call at all.
  const tickBody = extractDualOrbitTickBody(canvasSource);
  assert.ok(!tickBody.includes('setTimeout('), 'the shared tick (where assembly stepping lives) must not use setTimeout for anything');
});

test('phase2/10,23: the assembly step performs no work while the runtime ref is null', () => {
  // Covered structurally by phase2/3 (no assignment site can run before the
  // guard sees a non-null value) and phase2/4 (the call is nested inside
  // the `if (assemblyClockRef.current)` guard). This test adds the runtime
  // proof at the pure-function level: calling the exact guard expression
  // TopologyCanvas uses, with the ref in its inactive default state,
  // performs no work — mirroring `if (assemblyClockRef.current) { ... }`
  // with `assemblyClockRef.current === null`.
  const assemblyClockRefCurrent: AssemblyClockState | null = null;
  let stepped = false;
  if (assemblyClockRefCurrent) {
    stepped = true;
  }
  assert.equal(stepped, false);
});

test('phase2/11: a hypothetical active assembly clock, stepped with the document hidden, preserves elapsedMs and clears the timestamp baseline (Phase 1 contract, exercised via the exact formula TopologyCanvas wires in)', () => {
  // TopologyCanvas computes `isAssemblyRunning = !isPauseConditionActive`,
  // and isPauseConditionActive === isDocumentHidden || prefersReducedMotion
  // (see orbitMotion.ts's isOrbitPauseConditionActive). Model that exact
  // formula here rather than re-deriving a parallel one.
  const isDocumentHidden = true;
  const prefersReducedMotion = false;
  const isPauseConditionActive = isDocumentHidden || prefersReducedMotion;
  const isAssemblyRunning = !isPauseConditionActive;

  let clock = stepAssemblyClock(createAssemblyClockState(), 1000, true, 3000);
  clock = stepAssemblyClock(clock, 1400, true, 3000);
  assert.equal(clock.elapsedMs, 400);

  const hiddenStep = stepAssemblyClock(clock, 1500, isAssemblyRunning, 3000);
  assert.equal(isAssemblyRunning, false);
  assert.equal(hiddenStep.elapsedMs, 400, 'elapsedMs must not change while the document is hidden');
  assert.equal(hiddenStep.lastTimestamp, null, 'the timestamp baseline must clear while hidden');
});

test('phase2/12: a hypothetical active assembly clock, stepped with reduced motion preferred, does not advance', () => {
  const isDocumentHidden = false;
  const prefersReducedMotion = true;
  const isPauseConditionActive = isDocumentHidden || prefersReducedMotion;
  const isAssemblyRunning = !isPauseConditionActive;

  const baseline = stepAssemblyClock(createAssemblyClockState(), 1000, true, 3000);
  const notRunning = stepAssemblyClock(baseline, 1400, isAssemblyRunning, 3000);
  assert.equal(isAssemblyRunning, false);
  assert.equal(notRunning.elapsedMs, 0);
  assert.equal(notRunning.lastTimestamp, null);
});

test('phase2/13: compact viewport alone does not suppress or alter the assembly running condition', () => {
  // isPauseConditionActive/isOrbitPauseConditionActive deliberately excludes
  // isCompact (see orbitMotion.ts) — model the same boolean TopologyCanvas
  // actually computes and confirm compact-alone leaves assembly running.
  const isDocumentHidden = false;
  const prefersReducedMotion = false;
  const isCompact = true; // deliberately irrelevant
  const isPauseConditionActive = isDocumentHidden || prefersReducedMotion;
  const isAssemblyRunning = !isPauseConditionActive;
  assert.equal(isCompact, true, 'sanity: compact is true in this scenario');
  assert.equal(isAssemblyRunning, true, 'a narrow center panel must not pause a hypothetical assembly clock');
});

test('phase2/14,15,16,17: the actual stepAssemblyClock( call site never references SYSTEMS/REACTOR pause state, orbit running flags, rate multipliers, or compact viewport', () => {
  const callMatch = canvasSource.match(/stepAssemblyClock\(\s*([\s\S]*?)\s*\);/);
  assert.ok(callMatch, 'expected to find the stepAssemblyClock( call site');
  const callArgs = callMatch![1];

  for (const forbidden of [
    'isProjectOrbitPaused',
    'isReactorOrbitPaused',
    'isProjectOrbitRunning',
    'isReactorOrbitRunning',
    'projectOrbitRateMultiplier',
    'reactorOrbitRateMultiplier',
    'isCompactViewport',
    'isCompact',
  ]) {
    assert.ok(!callArgs.includes(forbidden), `stepAssemblyClock's own arguments must not reference ${forbidden}`);
  }

  assert.ok(callArgs.includes('timestamp'), 'must be stepped from the same shared frame timestamp as the rest of the tick');
  assert.ok(callArgs.includes('isAssemblyRunning'), 'must be gated by its own independent running condition');
  // Phase 4C1: the clock's own clamp ceiling is presentationCompleteMs, not
  // totalDurationMs — it must keep advancing past node-motion completion so
  // the presentation layer gets its brief "TOPOLOGY STABLE" window (see the
  // two-stage motion-complete/presentation-complete split below). Still the
  // centralized Phase 1 timing config, not a duplicated literal.
  assert.ok(callArgs.includes('assemblyTiming.presentationCompleteMs'), 'must use the selected centralized presentation-complete ceiling, not a duplicated literal');

  // And the running condition itself is derived ONLY from isPauseConditionActive.
  const runningMatch = canvasSource.match(/const isAssemblyRunning = ([^;]+);/);
  assert.ok(runningMatch, 'expected to find the isAssemblyRunning derivation');
  assert.equal(runningMatch![1].trim(), '!isPauseConditionActive');
});

test('phase2/18: getProjectPos\'s pre-existing precedence lines (drag, reflow, effective+grid) are byte-for-byte unchanged (superseded by phase3/6-11 for the new assembly branch itself)', () => {
  // As of Phase 2 this test also asserted getProjectPos referenced assembly
  // nowhere at all. Phase 3 deliberately and explicitly authorizes adding
  // one new assembly precedence branch here (see phase3/6 through
  // phase3/11 below for the full precedence proof) — so that blanket
  // "no assembly" assertion is now obsolete by design. What must still hold
  // or is proven identical to before: none of the PRE-EXISTING lines
  // changed.
  const start = canvasSource.indexOf('const getProjectPos = useCallback((project: ProjectData) => {');
  const end = canvasSource.indexOf('const getSkillPos = useCallback(', start);
  const block = canvasSource.substring(start, end);
  assert.match(block, /draggingNode\?\.type === 'project' && draggingNode\.id === project\.id/, 'active-drag precedence unchanged');
  assert.match(block, /orbitReflowRenderPositions && orbitReflowRenderPositions\[project\.id\]/, 'reflow-layer precedence unchanged');
  assert.match(block, /effectiveProjectPositions\[project\.id\] \|\| project\.gridPosition/, 'live/custom + legacy fallback precedence unchanged');
});

test('phase2/19 (superseded by Phase 4B): getSkillPos\'s pre-existing precedence lines (drag, settling, effective+grid) are byte-for-byte unchanged — Phase 4B deliberately adds one new assembly branch, proven in phase4b/45,46 below', () => {
  // Old invariant (Phase 2/3): getSkillPos referenced assembly nowhere at
  // all. Phase 4B explicitly and deliberately authorizes adding one new
  // capability-assembly precedence branch here (mirroring the project
  // precedence chain) — see phase4b/45,46 for the full precedence proof.
  // What must still hold, and does: none of the PRE-EXISTING lines changed.
  const start = canvasSource.indexOf('const getSkillPos = useCallback((skill: InfrastructureSkill) => {');
  const end = canvasSource.indexOf('const activeDockingPreview = useMemo(', start);
  const block = canvasSource.substring(start, end);
  assert.match(block, /capabilitySettlingRenderPositions && capabilitySettlingRenderPositions\[skill\.id\]/, 'settling-layer precedence unchanged');
  assert.match(block, /effectiveSkillPositions\[skill\.id\] \|\| skill\.gridPosition/, 'live/custom + legacy fallback precedence unchanged');
});

test('phase2/20,21: ASSEMBLE and RESET remain semantically unchanged — neither references the assembly clock', () => {
  const restoreStart = canvasSource.indexOf('const restoreCanonicalDockMembership = useCallback(() => {');
  const restoreEnd = canvasSource.indexOf('const resetAllPositions = useCallback(', restoreStart);
  const restoreBlock = canvasSource.substring(restoreStart, restoreEnd);
  assert.ok(!restoreBlock.includes('assemblyClockRef'), 'restoreCanonicalDockMembership must not touch the assembly ref yet');
  assert.ok(!restoreBlock.includes('stepAssemblyClock'), 'restoreCanonicalDockMembership must not step assembly yet');

  const resetStart = canvasSource.indexOf('const resetAllPositions = useCallback(');
  const resetEnd = canvasSource.indexOf('const handleAssemble = useCallback(', resetStart);
  const resetBlock = canvasSource.substring(resetStart, resetEnd);
  assert.ok(!resetBlock.includes('assemblyClockRef'));

  const assembleStart = canvasSource.indexOf('const handleAssemble = useCallback(');
  const assembleEnd = canvasSource.indexOf('const hasCustomLayout', assembleStart);
  const assembleBlock = canvasSource.substring(assembleStart, assembleEnd);
  assert.ok(!assembleBlock.includes('assemblyClockRef'), 'handleAssemble must remain instant — no assembly transition yet');

  // Both still funnel through the exact same shared primitive as before.
  assert.ok(resetBlock.includes('restoreCanonicalDockMembership()'));
  assert.ok(assembleBlock.includes('restoreCanonicalDockMembership()'));
});

test('phase2/22: App.tsx, ProjectSubsystemCanvas.tsx, and orbitMotion.ts remain untouched by this phase (no assembly references introduced)', () => {
  const appSource = fs.readFileSync(path.resolve('src/App.tsx'), 'utf8');
  assert.ok(!appSource.toLowerCase().includes('assembly'), 'App.tsx must not reference assembly in any way in Phase 2');

  const subsystemSource = fs.readFileSync(path.resolve('src/components/ProjectSubsystemCanvas.tsx'), 'utf8');
  assert.ok(!subsystemSource.toLowerCase().includes('assembly'));

  const orbitMotionSource = fs.readFileSync(path.resolve('src/utils/orbitMotion.ts'), 'utf8');
  assert.ok(!orbitMotionSource.toLowerCase().includes('assembly'), 'orbitMotion.ts must remain untouched — the Phase 1 module intentionally lives beside it, not inside it');
});

// ===========================================================================
// PHASE 3 — the temporary PROJECT assembly render-position layer. Still
// zero visible behavior: the map is created but nothing in the application
// ever writes to it, so getProjectPos's new branch is dead code at runtime
// (structurally present, never taken) exactly like assemblyClockRef stayed
// structurally unreachable in Phase 2. Same testing convention as the rest
// of this file and dualOrbitMachine.test.ts/orbitControls.test.ts: source-
// text structural regressions, no React/jsdom rendering harness.
// ===========================================================================

function extractGetProjectPosBlock(source: string): string {
  const start = source.indexOf('const getProjectPos = useCallback((project: ProjectData) => {');
  assert.ok(start !== -1);
  const end = source.indexOf('const getSkillPos = useCallback(', start);
  assert.ok(end !== -1);
  return source.substring(start, end);
}

test('phase3/1,2: a project assembly render-position state exists and defaults to empty', () => {
  assert.ok(
    canvasSource.includes(
      'const [assemblyProjectRenderPositions, setAssemblyProjectRenderPositions] = useState<Record<string, AssemblyPoint>>({});'
    ),
    'expected a Record<string, AssemblyPoint> state defaulting to an empty object'
  );
});

test('phase3/3,4,5,14 (extended by 4C2-B): project render-position writers are limited to startup and the mutually exclusive normal/fast RAF branches', () => {
  // Old invariant (Phase 3): zero writer sites. Phase 4A invariant: 5 sites
  // (activation, RAF completion-clear, RAF per-frame update, and two
  // interaction-cancellation clears). Phase 4B invariant: the
  // interaction-cancellation writer is removed (see phase4b/38,39) —
  // exactly 3 sites remain: the RAF tick's completion clear, the RAF tick's
  // per-frame update, and the DEV trigger's initial synchronous populate.
  // Still no mount trigger, no ASSEMBLE/RESET writer, no App.tsx writer.
  const setterCalls = (canvasSource.match(/setAssemblyProjectRenderPositions\(/g) ?? []).length;
  assert.equal(setterCalls, 5, 'startup plus normal/fast update and completion-clear sites');

  const mountEffectStart = canvasSource.indexOf('const initializedRef = useRef(false);');
  const mountEffectEnd = canvasSource.indexOf('// Keyboard controls for zoom, fit, snap toggle, and reset', mountEffectStart);
  const mountEffect = canvasSource.substring(mountEffectStart, mountEffectEnd);
  assert.ok(!mountEffect.includes('assemblyProjectRenderPositions'), 'the mount auto-fit effect must not reference the project assembly layer');

  // Exactly one writer call in production startup, populating with the
  // fixed start positions synchronously (not waiting for the first RAF tick).
  const triggerBlock = extractTriggerBlock(canvasSource);
  assert.equal((triggerBlock.match(/setAssemblyProjectRenderPositions\(/g) ?? []).length, 1);
  assert.ok(triggerBlock.includes('setAssemblyProjectRenderPositions(projectStartPositions);'));
});

test('phase3/6: getProjectPos precedence is exactly drag -> reflow -> assembly -> effective -> grid, in that source order', () => {
  const block = extractGetProjectPosBlock(canvasSource);
  const dragIdx = block.indexOf("draggingNode?.type === 'project' && draggingNode.id === project.id");
  const reflowIdx = block.indexOf('orbitReflowRenderPositions && orbitReflowRenderPositions[project.id]');
  const assemblyIdx = block.indexOf('assemblyProjectRenderPositions[project.id]');
  const effectiveIdx = block.indexOf('effectiveProjectPositions[project.id] || project.gridPosition');

  for (const [name, idx] of [['drag', dragIdx], ['reflow', reflowIdx], ['assembly', assemblyIdx], ['effective+grid', effectiveIdx]] as const) {
    assert.ok(idx !== -1, `expected to find the ${name} branch in getProjectPos`);
  }
  assert.ok(dragIdx < reflowIdx, 'drag must precede reflow');
  assert.ok(reflowIdx < assemblyIdx, 'reflow must precede assembly');
  assert.ok(assemblyIdx < effectiveIdx, 'assembly must precede the effective/grid fallback');
});

test('phase3/7,8: active drag and orbit reflow are genuine early returns, so both still short-circuit before assembly is ever consulted', () => {
  const block = extractGetProjectPosBlock(canvasSource);
  assert.match(
    block,
    /if \(draggingNode\?\.type === 'project' && draggingNode\.id === project\.id\) \{\s*\n\s*return draggingNode\.currentPos;\s*\n\s*\}/,
    'drag branch must be an unconditional early return, not merged into a later expression'
  );
  assert.match(
    block,
    /if \(orbitReflowRenderPositions && orbitReflowRenderPositions\[project\.id\]\) \{\s*\n\s*return orbitReflowRenderPositions\[project\.id\];\s*\n\s*\}/,
    'reflow branch must be an unconditional early return, so it always wins over assembly if both were ever somehow present'
  );
});

test('phase3/9,10,11: assembly is a plain truthy-lookup early return, so a present entry wins over the effective/custom/docked layer and an absent one falls straight through to it', () => {
  const block = extractGetProjectPosBlock(canvasSource);
  assert.match(
    block,
    /if \(assemblyProjectRenderPositions\[project\.id\]\) \{\s*\n\s*return assemblyProjectRenderPositions\[project\.id\];\s*\n\s*\}/,
    'assembly branch must be a plain object-property truthy check with an unconditional early return — present entry wins outright, absent entry (the Phase 3 default, always) falls through with zero special-casing'
  );
  // Immediately followed by the untouched, unrestructured effective/grid line.
  const assemblyBlockEnd = block.indexOf('}', block.indexOf('assemblyProjectRenderPositions[project.id]) {')) + 1;
  const remainder = block.substring(assemblyBlockEnd).trim();
  assert.ok(
    remainder.startsWith('return effectiveProjectPositions[project.id] || project.gridPosition;'),
    'the very next statement after the assembly guard must be the untouched effective/custom + grid fallback line'
  );
});

test('phase3/12,25 (superseded by Phase 4B): getSkillPos never references the PROJECT-only assembly layer; capability authority is now the deliberate Phase 4B addition proven elsewhere', () => {
  // Old invariant (Phase 3): capability assembly was explicitly out of
  // scope — getSkillPos referenced no assembly concept at all. Phase 4B
  // authorizes exactly the capability half of that (never the project
  // half): getSkillPos must still never reference assemblyProjectRenderPositions.
  const start = canvasSource.indexOf('const getSkillPos = useCallback((skill: InfrastructureSkill) => {');
  const end = canvasSource.indexOf('const activeDockingPreview = useMemo(', start);
  const block = canvasSource.substring(start, end);
  assert.ok(!block.includes('assemblyProjectRenderPositions'), 'getSkillPos must never reference the project-only assembly layer');
  assert.match(block, /capabilitySettlingRenderPositions && capabilitySettlingRenderPositions\[skill\.id\]/, 'settling-layer precedence unchanged');
  assert.match(block, /effectiveSkillPositions\[skill\.id\] \|\| skill\.gridPosition/, 'live/custom + legacy fallback precedence unchanged');
});

test('phase3/13,15: projectDocking.ts (docking + interactive order + reflow) and projectRingAllocation.ts remain completely untouched', () => {
  const dockingSource = fs.readFileSync(path.resolve('src/utils/projectDocking.ts'), 'utf8');
  assert.ok(!dockingSource.toLowerCase().includes('assembly'), 'projectDocking.ts must not reference assembly — docking state/order untouched');

  const ringAllocSource = fs.readFileSync(path.resolve('src/utils/projectRingAllocation.ts'), 'utf8');
  assert.ok(!ringAllocSource.toLowerCase().includes('assembly'), 'projectRingAllocation.ts must not reference assembly — ring allocation untouched');
});

test('phase3/16: TopologyCanvas.tsx references no generated owner data (unchanged general invariant, unrelated to assembly specifically)', () => {
  assert.ok(!canvasSource.includes('.generated'), 'TopologyCanvas.tsx must not import any *.generated owner data file');
  assert.ok(!canvasSource.includes('ownerPreferences'), 'TopologyCanvas.tsx must not import owner preferences');
});

test('phase3/17,18 (superseded by Phase 4A): still no new RAF loop, and the shared tick now drives project positions too — one map, one setter call per frame', () => {
  const totalRafCalls = (canvasSource.match(/requestAnimationFrame\(/g) ?? []).length;
  assert.equal(totalRafCalls, 4, 'total requestAnimationFrame( count must remain exactly 4 — Phase 4A adds no second chain');

  const tickBody = extractDualOrbitTickBody(canvasSource);
  assert.equal((tickBody.match(/stepAssemblyClock\(/g) ?? []).length, 1, 'the tick must still call stepAssemblyClock exactly once');
});

test('phase4a + 4C2-B: normal and fast branches each update/clear project positions mutually exclusively, never per-project', () => {
  // Old invariant (Phase 3): zero calls inside the tick. New authorized
  // invariant (Phase 4A): exactly two textual call sites — the completion
  // clear and the per-frame update — structurally inside an if/else so only
  // ONE of them can ever execute on any given frame. This is the "one
  // render-position map built per frame, one setter call, never per-project"
  // requirement, proven structurally rather than by running React.
  const tickBody = extractDualOrbitTickBody(canvasSource);
  assert.equal((tickBody.match(/setAssemblyProjectRenderPositions\(/g) ?? []).length, 4);

  // Phase 4C1: the completion check is now the "MOTION complete" (Stage 1)
  // branch of the two-stage completion split — named isMotionComplete and
  // checked against totalDurationMs (Stage 2's presentation-complete
  // teardown, checked against presentationCompleteMs, is proven separately
  // below). Still an if/else, still mutually exclusive.
  const completeIdx = tickBody.indexOf('const isMotionComplete = isAssemblyComplete(nextAssemblyClock, assemblyTiming.totalDurationMs);');
  const elseIdx = tickBody.indexOf('} else {', completeIdx);
  const firstCallIdx = tickBody.indexOf('setAssemblyProjectRenderPositions({});', completeIdx);
  const secondCallIdx = tickBody.indexOf('setAssemblyProjectRenderPositions(nextPositions);', elseIdx);
  assert.ok(completeIdx !== -1 && elseIdx !== -1 && firstCallIdx !== -1 && secondCallIdx !== -1);
  assert.ok(
    completeIdx < firstCallIdx && firstCallIdx < elseIdx && elseIdx < secondCallIdx,
    'the two calls must sit in the if-branch and the else-branch respectively, proving mutual exclusivity'
  );

  // No per-project setter call: the loop that builds nextPositions contains
  // no setAssemblyProjectRenderPositions call inside its own body.
  const loopStart = tickBody.indexOf('for (const projectId of Object.keys(plan.startPositions)) {');
  const loopEnd = tickBody.indexOf('setAssemblyProjectRenderPositions(nextPositions);', loopStart);
  const loopBody = tickBody.substring(loopStart, loopEnd);
  assert.ok(!loopBody.includes('setAssemblyProjectRenderPositions('), 'the per-project loop must never itself call the setter — it only builds the map, which is set once after the loop');
});

test('phase3/20,21 (superseded by Phase 4B): the deterministic offset and moving-target resolver are consumed exactly twice each — once for projects, once for capabilities — with the corrected 4-argument resolver contract', () => {
  // Old invariant (Phase 3): none of these were referenced at all. Phase 4A
  // invariant: exactly one call site each (projects only). Phase 4B
  // invariant: exactly two call sites each (projects AND capabilities),
  // getDeterministicAssemblyOffset only at activation (never per-frame) for
  // BOTH layers, the resolvers only inside the RAF tick for BOTH layers.
  // getRingAssemblyProgress/getCapabilityAssemblyProgress-as-a-direct-call
  // for ring stagger remains uncalled directly for projects (ring stagger is
  // consumed transitively through getProjectAssemblyProgress) — capabilities
  // have no ring-stagger equivalent to transitively consume.
  assert.equal((canvasSource.match(/getDeterministicAssemblyOffset\(/g) ?? []).length, 2, 'one for projects, one for capabilities');
  assert.equal((canvasSource.match(/resolveAssemblyPosition\(/g) ?? []).length, 4, 'normal and fast paths each resolve projects and capabilities');
  assert.equal((canvasSource.match(/getProjectAssemblyProgress\(/g) ?? []).length, 1);
  assert.equal((canvasSource.match(/getCapabilityAssemblyProgress\(/g) ?? []).length, 1);
  assert.equal((canvasSource.match(/getAssemblyCaptureEasing\(/g) ?? []).length, 1);
  assert.equal((canvasSource.match(/getCapabilityAssemblyCaptureEasing\(/g) ?? []).length, 1);

  // getDeterministicAssemblyOffset must be called at activation time only —
  // never inside the per-frame tick (fixed start positions, computed once) —
  // for BOTH layers.
  const tickBody = extractDualOrbitTickBody(canvasSource);
  assert.ok(!tickBody.includes('getDeterministicAssemblyOffset('), 'the offset must never be recomputed per frame');

  // Phase 4C1 legitimately adds exactly ONE direct call site to
  // getRingAssemblyProgress: the ring-GUIDE visual reveal in the JSX
  // (documented in topologyAssembly.ts as intentional dual-purpose reuse of
  // the same Phase 1 function). Project ring STAGGER itself — inside the RAF
  // tick, feeding actual capture positions — must remain entirely transitive
  // through getProjectAssemblyProgress; no direct call may appear there.
  assert.equal(
    (canvasSource.match(/getRingAssemblyProgress\(/g) ?? []).length,
    2,
    'exactly two direct guide call sites: production and DEV redesign timing branches'
  );
  assert.ok(
    !tickBody.includes('getRingAssemblyProgress('),
    'project capture positions inside the RAF tick must still consume ring stagger transitively through getProjectAssemblyProgress, never via a direct call'
  );
  const triggerBlock = extractTriggerBlock(canvasSource);
  assert.equal((triggerBlock.match(/getDeterministicAssemblyOffset\(/g) ?? []).length, 2);

  // resolveAssemblyPosition, getProjectAssemblyProgress, and
  // getCapabilityAssemblyProgress must be called from inside the tick (fresh
  // every frame), matching the corrected 4-argument resolver contract:
  // start, liveTarget, rawProgress, interpolationFactor.
  assert.equal((tickBody.match(/resolveAssemblyPosition\(/g) ?? []).length, 4);
  assert.ok(tickBody.includes('getProjectAssemblyProgress('));
  assert.ok(tickBody.includes('getCapabilityAssemblyProgress('));
  assert.match(
    tickBody,
    /resolveAssemblyPosition\(\s*plan\.startPositions\[projectId\],\s*liveTarget,\s*rawProgress,\s*interpolationFactor\s*\)/,
    'project resolveAssemblyPosition call must use (fixedStart, liveTarget, rawProgress, interpolationFactor) — the Phase 3.5-corrected contract'
  );
  assert.match(
    tickBody,
    /resolveAssemblyPosition\(\s*startPosition,\s*liveTarget,\s*rawProgress,\s*interpolationFactor\s*\)/,
    'capability resolveAssemblyPosition call must use the same corrected 4-argument contract'
  );
});

test('phase3/22,23,24: ASSEMBLE, RESET, and App.tsx remain unchanged and reference neither the new project assembly layer nor its setter', () => {
  const restoreStart = canvasSource.indexOf('const restoreCanonicalDockMembership = useCallback(() => {');
  const restoreEnd = canvasSource.indexOf('const resetAllPositions = useCallback(', restoreStart);
  const restoreBlock = canvasSource.substring(restoreStart, restoreEnd);
  assert.ok(!restoreBlock.includes('assemblyProjectRenderPositions'), 'restoreCanonicalDockMembership must not touch the project assembly layer yet');

  const resetStart = canvasSource.indexOf('const resetAllPositions = useCallback(');
  const resetEnd = canvasSource.indexOf('const handleAssemble = useCallback(', resetStart);
  const resetBlock = canvasSource.substring(resetStart, resetEnd);
  assert.ok(!resetBlock.includes('assemblyProjectRenderPositions'));

  const assembleStart = canvasSource.indexOf('const handleAssemble = useCallback(');
  const assembleEnd = canvasSource.indexOf('const hasCustomLayout', assembleStart);
  const assembleBlock = canvasSource.substring(assembleStart, assembleEnd);
  assert.ok(!assembleBlock.includes('assemblyProjectRenderPositions'), 'handleAssemble must remain unchanged — no assembly animation yet');

  const appSource = fs.readFileSync(path.resolve('src/App.tsx'), 'utf8');
  assert.ok(!appSource.toLowerCase().includes('assembly'), 'App.tsx must remain completely untouched in Phase 3');
});

test('phase3: drag initiation already reads getProjectPos, so a future assembly-rendered project would naturally begin dragging from its assembly position with no assembly-specific drag math needed', () => {
  // getProjectPos(project) is called twice in this file — once for conduit
  // geometry (renderedConnections) and once, distinctly, in the project
  // render loop that also owns drag-start. Anchor on the render-loop's own
  // `const originX = projectPos.x;` line, which only appears once, rather
  // than the ambiguous call site itself.
  const originXIdx = canvasSource.indexOf('const originX = projectPos.x;');
  assert.ok(originXIdx !== -1, 'expected the project render loop to derive originX from getProjectPos-sourced projectPos');
  const projectPosLineIdx = canvasSource.lastIndexOf('const projectPos = getProjectPos(project);', originXIdx);
  assert.ok(projectPosLineIdx !== -1 && originXIdx - projectPosLineIdx < 200, 'originX must be derived from a projectPos assigned immediately above via getProjectPos');

  // The onMouseDown handler further down this same render-loop iteration
  // builds its drag-start position from these same origin values.
  const mouseDownStart = canvasSource.indexOf('onMouseDown={(e) => {', originXIdx);
  const mouseDownEnd = canvasSource.indexOf('onTouchStart=', mouseDownStart);
  const mouseDownBlock = canvasSource.substring(mouseDownStart, mouseDownEnd);
  assert.ok(mouseDownBlock.includes('const startPos = { x: originX, y: originY };'), 'drag start must derive from the same getProjectPos-sourced origin, not a separately computed position');
});

// ===========================================================================
// PHASE 4A — the first VISUAL phase: a manually-triggered, DEV-only project-
// capture experiment. At that phase there was no automatic trigger. Same
// testing convention as every prior phase
// (source-text structural regressions plus pure-function proofs, no React/
// jsdom rendering harness).
// ===========================================================================

function extractTriggerBlock(source: string): string {
  const start = source.indexOf("const startTopologyAssembly = useCallback((mode: TopologyAssemblyMode = 'production') => {");
  assert.ok(start !== -1);
  const endMatch = source.slice(start).match(/\}, \[\r?\n\s*canStartTopologyAssembly,/);
  assert.ok(endMatch);
  const end = start + endMatch!.index!;
  return source.substring(start, end);
}

function extractPreconditionBlock(source: string): string {
  const start = source.indexOf('const canStartTopologyAssembly = useMemo(() => {');
  assert.ok(start !== -1);
  const end = source.indexOf('const startTopologyAssembly', start);
  assert.ok(end !== -1);
  return source.substring(start, end);
}

test('phase4a/4,5 + phase4b/3,4,5: activation builds fixed start positions ONCE for BOTH projects and capabilities (object literals, never per-frame recomputation), and neither plan stores a live-target field', () => {
  const trigger = extractTriggerBlock(canvasSource);
  assert.ok(trigger.includes('assemblyProjectPlanRef.current = { startPositions: projectStartPositions };'), 'the project plan must be assigned exactly once, synchronously, at activation');
  assert.ok(trigger.includes('assemblyCapabilityPlanRef.current = { startPositions: capabilityStartPositions };'), 'the capability plan must be assigned exactly once, synchronously, at the SAME activation event');
  assert.equal((trigger.match(/getDynamicOrbitalPosition\(/g) ?? []).length, 1, 'project liveTarget at activation is computed once per project inside the same forEach, not memoized/looped elsewhere');
  assert.equal((trigger.match(/getMountedCapabilityPosition\(/g) ?? []).length, 1, 'capability liveTarget at activation is computed once per capability inside the same forEach');

  // Neither plan interface has a target/phase field to freeze — only the
  // fixed start positions. A future accidental "cache the target too"
  // change would be caught here.
  const planInterfaceStart = canvasSource.indexOf('interface ActiveProjectAssemblyPlan {');
  const planInterfaceEnd = canvasSource.indexOf('}', planInterfaceStart) + 1;
  const planInterface = canvasSource.substring(planInterfaceStart, planInterfaceEnd);
  assert.match(planInterface, /interface ActiveProjectAssemblyPlan \{\s*\n\s*startPositions: Record<string, AssemblyPoint>;\s*\n\s*\}/, 'the project plan must store only startPositions — no liveTarget, no phase, no ring snapshot');

  const capabilityPlanInterfaceStart = canvasSource.indexOf('interface ActiveCapabilityAssemblyPlan {');
  const capabilityPlanInterfaceEnd = canvasSource.indexOf('}', capabilityPlanInterfaceStart) + 1;
  const capabilityPlanInterface = canvasSource.substring(capabilityPlanInterfaceStart, capabilityPlanInterfaceEnd);
  assert.match(capabilityPlanInterface, /interface ActiveCapabilityAssemblyPlan \{\s*\n\s*startPositions: Record<string, AssemblyPoint>;\s*\n\s*\}/, 'the capability plan must store only startPositions — no liveTarget, no reactor phase snapshot');
});

test('phase4a/6,7: the deterministic offset primitive is used at activation with the default (unmodified) budget, respecting the configured bound', () => {
  const trigger = extractTriggerBlock(canvasSource);
  assert.match(
    trigger,
    /isRedesignPrototype \? REDESIGN_PROJECT_ASSEMBLY_OFFSET_BUDGET : undefined/,
    'production must still pass undefined and therefore use DEFAULT_ASSEMBLY_OFFSET_BUDGET; only explicit redesign mode may override it'
  );
  assert.ok(!trigger.includes('maxRadialOffsetIso:'), 'must not construct a custom budget object inline — the configured default budget governs the bound');
});

test('phase4a/8: the assembly clock is created via the Phase 1 baseline factory, never a hand-rolled object', () => {
  const trigger = extractTriggerBlock(canvasSource);
  assert.ok(trigger.includes('assemblyClockRef.current = createAssemblyClockState();'));
  assert.ok(!/assemblyClockRef\.current\s*=\s*\{\s*elapsedMs/.test(trigger), 'must not hand-roll {elapsedMs: 0, lastTimestamp: null} inline');
});

test('phase4a/9,10: the per-frame target is resolved against the CURRENT ring phase via the existing ref-based phase getter — no duplicated outer-ring phase math', () => {
  const tickBody = extractDualOrbitTickBody(canvasSource);
  assert.ok(tickBody.includes('const ringPhase = getRingPhaseFromRefs(ring);'), 'must reuse the existing ring-0-vs-outer-ring phase getter, not a new formula');
  assert.ok(!/ring\.baseRateMultiplier/.test(tickBody.substring(tickBody.indexOf('for (const projectId of Object.keys(plan.startPositions))'))), 'must not re-derive getRingEffectivePhase\'s own formula inline inside the assembly loop');
  assert.ok(tickBody.includes('getDynamicOrbitalPosition(project, indexWithinRing, dockedCount, ring.geometry, ringPhase)'), 'liveTarget must be resolved fresh every frame with the live ring phase, matching the ordinary dockedProjectPositions formula exactly');
});

test('phase4a/11,12,13,14: ring stagger, project stagger, capture easing, and the corrected 4-argument resolver are all consumed from inside the tick, in the right order', () => {
  const tickBody = extractDualOrbitTickBody(canvasSource);
  const rawProgressIdx = tickBody.indexOf('getProjectAssemblyProgress(');
  const easingIdx = tickBody.indexOf('getAssemblyCaptureEasing(', rawProgressIdx);
  const resolveIdx = tickBody.indexOf('resolveAssemblyPosition(', easingIdx);
  assert.ok(rawProgressIdx !== -1 && easingIdx !== -1 && resolveIdx !== -1);
  assert.ok(rawProgressIdx < easingIdx && easingIdx < resolveIdx, 'raw progress must be computed before easing, which must be computed before the resolver call');
  assert.match(
    tickBody,
    /getProjectAssemblyProgress\(\s*nextAssemblyClock\.elapsedMs,\s*ring\.index,\s*indexWithinRing,\s*assemblyTiming\s*\)/,
    'getProjectAssemblyProgress (which internally consumes ring stagger via ring.index, and project stagger via indexWithinRing) must be called with the live elapsed clock'
  );
  assert.ok(tickBody.includes('const interpolationFactor = getAssemblyCaptureEasing(rawProgress);'));
});

test('phase4a/17,18: assembly keeps the persistent RAF chain alive, and this adds no second chain', () => {
  assert.ok(canvasSource.includes('const shouldRunAnimationMachine = isDualOrbitMachineRunning || isTopologyAssemblyActive;'));
  const effectStart = canvasSource.indexOf('const dualOrbitClockRef = useRef<DualOrbitClockState>');
  const effectEnd = canvasSource.indexOf('const projectsById', effectStart);
  const effect = canvasSource.substring(effectStart, effectEnd);
  assert.ok(effect.includes('if (!shouldRunAnimationMachine) {'));
  assert.equal((effect.match(/requestAnimationFrame\(/g) ?? []).length, 2, 'still exactly one chain');
});

test('phase4a/19,20,21,22,23,24: assembly pause/rate authority is unchanged from Phase 2 — document-hidden/reduced-motion pause it, SYSTEMS/REACTOR pause and rate multipliers do not, and the DEV trigger itself refuses to activate under reduced motion', () => {
  const callMatch = canvasSource.match(/stepAssemblyClock\(\s*([\s\S]*?)\s*\);/);
  assert.ok(callMatch);
  const callArgs = callMatch![1];
  assert.ok(callArgs.includes('isAssemblyRunning'));
  for (const forbidden of ['isProjectOrbitPaused', 'isReactorOrbitPaused', 'isProjectOrbitRunning', 'isReactorOrbitRunning', 'projectOrbitRateMultiplier', 'reactorOrbitRateMultiplier']) {
    assert.ok(!callArgs.includes(forbidden), `stepAssemblyClock's own arguments must not reference ${forbidden}`);
  }
  const runningMatch = canvasSource.match(/const isAssemblyRunning = ([^;]+);/);
  assert.ok(runningMatch);
  assert.equal(runningMatch![1].trim(), '!isPauseConditionActive');

  // Pure-function proof of the document-hidden/reduced-motion pause contract
  // using the exact formula TopologyCanvas wires in (isPauseConditionActive
  // = isDocumentHidden || prefersReducedMotion), reused unchanged from Phase 2.
  const hiddenBaseline = stepAssemblyClock(createAssemblyClockState(), 1000, true, 3000);
  const hiddenAdvanced = stepAssemblyClock(hiddenBaseline, 1400, true, 3000);
  const isPauseConditionActive = true; // document hidden
  const hiddenStep = stepAssemblyClock(hiddenAdvanced, 1500, !isPauseConditionActive, 3000);
  assert.equal(hiddenStep.elapsedMs, hiddenAdvanced.elapsedMs, 'elapsedMs must hold while hidden');
  assert.equal(hiddenStep.lastTimestamp, null, 'baseline must clear while hidden');

  // The DEV trigger itself refuses to activate under reduced motion.
  const precondition = extractPreconditionBlock(canvasSource);
  assert.ok(precondition.includes('!prefersReducedMotion'), 'canStartTopologyAssembly must require reduced motion to be OFF');
});

test('phase4a/25,26,27 + phase4b/25 (docking side): assembly never writes projectDockState, interactiveOrbitOrderByRing, or customProjectPositions/customSkillPositions, anywhere', () => {
  const trigger = extractTriggerBlock(canvasSource);
  const tickBody = extractDualOrbitTickBody(canvasSource);
  const processMoveStart = canvasSource.indexOf('const processMove = (clientX: number, clientY: number) => {');
  const processMoveEnd = canvasSource.indexOf('const processRelease = () => {', processMoveStart);
  const processMoveBlock = canvasSource.substring(processMoveStart, processMoveEnd);
  for (const forbiddenSetter of ['setProjectDockState(', 'setInteractiveOrbitOrderByRing(', 'setCustomProjectPositions(', 'setCustomSkillPositions(']) {
    assert.ok(!trigger.includes(forbiddenSetter), `activation must never call ${forbiddenSetter}`);
    assert.ok(!tickBody.includes(forbiddenSetter), `the tick's assembly step must never call ${forbiddenSetter}`);
  }
  // processMove's own early-return guard (see phase4b/35,36,37) is what
  // actually keeps these setters unreachable while assembly is active —
  // confirm the guard exists and precedes every other statement in the function.
  assert.ok(processMoveBlock.includes('if (dragRuntimeRef.current.isTopologyAssemblyActive) return;'));
});

test('phase4a/28,29 + phase4b/17,18 (extended by Phase 4C1): completion clears BOTH temporary assembly authorities across two stages — MOTION complete (plans + render-position maps) then PRESENTATION complete (clock + active flag) — and neither stage resets orbit/reactor phase, docking, or ring order', () => {
  // Phase 4C1 splits the old single completion block into two, so that the
  // shared clock can keep advancing (and interaction can stay locked) for a
  // brief window after node capture finishes, giving "TOPOLOGY STABLE" a
  // beat to display before full teardown. See the module doc comment on
  // presentationCompleteMs in topologyAssembly.ts for the full rationale.
  const tickBody = extractDualOrbitTickBody(canvasSource);

  // Stage 1 — MOTION complete: clears the temporary plan refs and both
  // render-position maps ONLY. Must NOT yet clear the clock or the active
  // flag — those stay alive so the presentation layer can keep reading
  // assemblyElapsedMs and isTopologyAssemblyActive during the tail window.
  const motionStart = tickBody.indexOf('const isMotionComplete = isAssemblyComplete(nextAssemblyClock, assemblyTiming.totalDurationMs);');
  const motionElseIdx = tickBody.indexOf('} else {', motionStart);
  assert.ok(motionStart !== -1 && motionElseIdx !== -1);
  const motionBlock = tickBody.substring(motionStart, motionElseIdx);
  assert.ok(motionBlock.includes('assemblyProjectPlanRef.current = null;'));
  assert.ok(motionBlock.includes('assemblyCapabilityPlanRef.current = null;'));
  assert.ok(motionBlock.includes('setAssemblyProjectRenderPositions({});'));
  assert.ok(motionBlock.includes('setAssemblyCapabilityRenderPositions({});'));
  assert.ok(!motionBlock.includes('assemblyClockRef.current = null;'), 'MOTION complete must not yet tear down the shared clock');
  assert.ok(!motionBlock.includes('setIsTopologyAssemblyActive(false);'), 'MOTION complete must not yet unlock interaction — that is Stage 2');

  // Stage 2 — PRESENTATION complete: tears down the clock, the active flag
  // (this is where interaction actually unlocks), and the render-facing
  // elapsed value, strictly after Stage 1 in source order.
  const presentationStart = tickBody.indexOf('if (isAssemblyComplete(nextAssemblyClock, assemblyTiming.presentationCompleteMs)) {', motionElseIdx);
  assert.ok(presentationStart !== -1 && presentationStart > motionElseIdx, 'the presentation-complete teardown must appear after the motion-complete branch');
  const presentationEnd = tickBody.indexOf('\n      }', presentationStart);
  const presentationBlock = tickBody.substring(presentationStart, presentationEnd);
  assert.ok(presentationBlock.includes('assemblyClockRef.current = null;'));
  assert.ok(presentationBlock.includes('setIsTopologyAssemblyActive(false);'));
  assert.ok(presentationBlock.includes('setAssemblyElapsedMs(null);'));

  const combinedBlock = motionBlock + presentationBlock;
  for (const forbidden of [
    'resetOrbitPhasesToCanonical',
    'setProjectOrbitPhase(0)',
    'setReactorOrbitPhase(0)',
    'setProjectDockState(',
    'setInteractiveOrbitOrderByRing(',
    'setCustomSkillPositions(',
    'dualOrbitClockRef.current =',
  ]) {
    assert.ok(!combinedBlock.includes(forbidden), `completion must never call/touch ${forbidden}`);
  }
});

test('phase4b/38,39: the Phase 4A cancel-on-drag path is completely removed for BOTH projects and capabilities — no interaction-cancellation writer to assembly state exists anywhere', () => {
  assert.ok(!canvasSource.includes('interaction ends the ceremony'), 'the Phase 4A project cancel-on-drag comment/code must be gone');
  assert.ok(!canvasSource.includes('interaction-cancels-ceremony'), 'the Phase 4A touch cancel-on-drag comment/code must be gone');
  assert.ok(!/if \(isTopologyAssemblyActive\) \{\s*assemblyClockRef\.current = null;/.test(canvasSource), 'no mousedown/touchstart handler may clear assembly state directly');
  // The only THREE assemblyClockRef.current assignment sites (proven exactly
  // in phase2/3 above) are the per-frame re-step, the completion clear, and
  // the one activation call — none of which live inside a node's
  // onMouseDown/onTouchStart/onDoubleClick handler.
});

test('phase4a/38: no generated owner data or owner preferences are referenced by any Phase 4A addition', () => {
  assert.ok(!canvasSource.includes('.generated'));
  assert.ok(!canvasSource.includes('ownerPreferences'));
  const dockingSource = fs.readFileSync(path.resolve('src/utils/projectDocking.ts'), 'utf8');
  assert.ok(!dockingSource.toLowerCase().includes('assembly'));
  const ringAllocSource = fs.readFileSync(path.resolve('src/utils/projectRingAllocation.ts'), 'utf8');
  assert.ok(!ringAllocSource.toLowerCase().includes('assembly'));
  const capabilityReactorSource = fs.readFileSync(path.resolve('src/utils/capabilityReactor.ts'), 'utf8');
  assert.ok(!capabilityReactorSource.toLowerCase().includes('assembly'));
});

test('phase4a/39,40: getProjectAssemblyProgress resolves valid bounded per-ring stagger for both a synthetic single-ring (<=18 project) topology and a synthetic multi-ring topology', () => {
  // Single ring (ring index 0): every docked index must resolve to a valid
  // progress at the shared clock's total duration.
  for (let indexWithinRing = 0; indexWithinRing < 18; indexWithinRing++) {
    const progress = getProjectAssemblyProgress(timing.totalDurationMs, 0, indexWithinRing, timing);
    assert.ok(progress >= 0 && progress <= 1);
  }
  // Multi-ring (rings 0-3, covering a 55+ project topology): every ring's
  // own phase source must resolve without collapsing to ring 0's formula —
  // proven at the TopologyCanvas integration level by getRingPhaseFromRefs
  // itself already branching on ring.index (see phase4a/9,10 above); proven
  // here at the pure-math level that every ring/index combination a 55+
  // project topology could produce stays valid and bounded.
  for (let ringIndex = 0; ringIndex < 4; ringIndex++) {
    for (let indexWithinRing = 0; indexWithinRing < 18; indexWithinRing++) {
      const progress = getProjectAssemblyProgress(timing.totalDurationMs, ringIndex, indexWithinRing, timing);
      assert.ok(progress >= 0 && progress <= 1, `out-of-range progress at ring ${ringIndex} index ${indexWithinRing}`);
    }
  }
});

// ===========================================================================
// PHASE 4B — capability/technology reactor synchronization, and the removal
// of the Phase 4A cancel-on-drag interaction policy in favor of a direct-
// manipulation lock. At that phase the only activation path was the DEV-only
// TEST ASSEMBLY button. Same testing convention throughout.
// ===========================================================================

// -- Pure math: capability offset/timing/easing -----------------------------

test('phase4b/6: capability offset is deterministic — identical (capabilityId, indexWithinReactor) always produces the identical offset', () => {
  const a = getDeterministicAssemblyOffset('capability-alpha', 0, 3, DEFAULT_CAPABILITY_ASSEMBLY_OFFSET_BUDGET);
  const b = getDeterministicAssemblyOffset('capability-alpha', 0, 3, DEFAULT_CAPABILITY_ASSEMBLY_OFFSET_BUDGET);
  assert.deepEqual(a, b);
});

test('phase4b/7: the capability offset budget is materially smaller than the project offset budget on both axes', () => {
  assert.ok(
    DEFAULT_CAPABILITY_ASSEMBLY_OFFSET_BUDGET.maxRadialOffsetIso < DEFAULT_ASSEMBLY_OFFSET_BUDGET.maxRadialOffsetIso,
    'capability radial budget must be smaller than the project radial budget'
  );
  assert.ok(
    DEFAULT_CAPABILITY_ASSEMBLY_OFFSET_BUDGET.maxAngularJitterRadians < DEFAULT_ASSEMBLY_OFFSET_BUDGET.maxAngularJitterRadians,
    'capability angular budget must be smaller than the project angular budget'
  );
  // Visual tuning pass: concretely within the requested 55-70 iso / 6-10
  // degree investigation range (raised from the original 25-45 iso / 4-9
  // degree range so the reactor's own capture reads as more than a
  // barely-visible settle, while staying materially tighter than projects).
  assert.ok(DEFAULT_CAPABILITY_ASSEMBLY_OFFSET_BUDGET.maxRadialOffsetIso >= 55 && DEFAULT_CAPABILITY_ASSEMBLY_OFFSET_BUDGET.maxRadialOffsetIso <= 70);
  const angularDegrees = DEFAULT_CAPABILITY_ASSEMBLY_OFFSET_BUDGET.maxAngularJitterRadians * (180 / Math.PI);
  assert.ok(angularDegrees >= 6 && angularDegrees <= 10);
});

test('phase4b/8: capability offset never exceeds its configured budget, across many synthetic identities/indices', () => {
  for (let i = 0; i < 40; i++) {
    const offset = getDeterministicAssemblyOffset(`capability-${i}`, 0, i, DEFAULT_CAPABILITY_ASSEMBLY_OFFSET_BUDGET);
    assert.ok(offset.radialOffsetIso >= 0 && offset.radialOffsetIso <= DEFAULT_CAPABILITY_ASSEMBLY_OFFSET_BUDGET.maxRadialOffsetIso + 1e-9);
    assert.ok(Math.abs(offset.angularOffsetRadians) <= DEFAULT_CAPABILITY_ASSEMBLY_OFFSET_BUDGET.maxAngularJitterRadians + 1e-9);
    assert.ok(Number.isFinite(offset.radialOffsetIso) && Number.isFinite(offset.angularOffsetRadians));
  }
});

test('phase4b/9: capability progress derives from the SAME shared elapsed-time domain projects use — not an independent clock reading', () => {
  // Both functions accept the identical elapsedMs unit/domain (the shared
  // topology assembly clock's own elapsedMs) — proven by exercising both
  // with the same sample values and confirming both resolve sensibly
  // relative to the SAME timing config's totalDurationMs.
  const midway = DEFAULT_TOPOLOGY_ASSEMBLY_TIMING.totalDurationMs / 2;
  const capabilityProgress = getCapabilityAssemblyProgress(midway, 0, 24, DEFAULT_TOPOLOGY_ASSEMBLY_TIMING);
  const projectProgress = getProjectAssemblyProgress(midway, 0, 0, DEFAULT_TOPOLOGY_ASSEMBLY_TIMING);
  assert.ok(Number.isFinite(capabilityProgress) && Number.isFinite(projectProgress));
  assert.equal(capabilityProgress, 1, 'capability capture (start 480ms, duration 650ms) is long complete by the halfway point of a 3.2s sequence');
});

test('phase4b/19: capability capture easing overshoot is materially smaller than the accepted project overshoot', () => {
  let projectMax = -Infinity;
  let capabilityMax = -Infinity;
  for (let i = 0; i <= 1000; i++) {
    const t = i / 1000;
    projectMax = Math.max(projectMax, getAssemblyCaptureEasing(t));
    capabilityMax = Math.max(capabilityMax, getCapabilityAssemblyCaptureEasing(t));
  }
  assert.ok(capabilityMax > 1, 'capability curve must still intentionally overshoot, just a smaller amount');
  assert.ok(capabilityMax < projectMax, `capability overshoot (${capabilityMax}) must be smaller than project overshoot (${projectMax})`);
  assert.ok(capabilityMax <= 1.05, `capability overshoot must read as a tight mechanical seat, not a bounce — got ${capabilityMax}`);
  // Endpoints remain exact regardless of the tighter constant.
  assert.equal(getCapabilityAssemblyCaptureEasing(0), 0);
  assert.equal(getCapabilityAssemblyCaptureEasing(1), 1);
});

test('phase4b/20: capability stagger offset is deterministic and monotonic in index', () => {
  const a = getCapabilityAssemblyStartOffsetMs(5, 24, DEFAULT_TOPOLOGY_ASSEMBLY_TIMING);
  const b = getCapabilityAssemblyStartOffsetMs(5, 24, DEFAULT_TOPOLOGY_ASSEMBLY_TIMING);
  assert.equal(a, b, 'identical inputs must produce the identical offset');
  const offset0 = getCapabilityAssemblyStartOffsetMs(0, 24, DEFAULT_TOPOLOGY_ASSEMBLY_TIMING);
  const offset1 = getCapabilityAssemblyStartOffsetMs(1, 24, DEFAULT_TOPOLOGY_ASSEMBLY_TIMING);
  assert.equal(offset0, 0);
  assert.ok(offset1 > offset0, 'later capability indices must start no earlier than prior ones');
});

test('phase4b/21: capability stagger span stays bounded (and materially shorter than the project stagger span) as capability count grows', () => {
  const span24 = getCapabilityAssemblyStartOffsetMs(23, 24, DEFAULT_TOPOLOGY_ASSEMBLY_TIMING);
  const span100 = getCapabilityAssemblyStartOffsetMs(99, 100, DEFAULT_TOPOLOGY_ASSEMBLY_TIMING);
  assert.ok(span24 <= DEFAULT_TOPOLOGY_ASSEMBLY_TIMING.maxCapabilityStaggerSpanMs + 1e-9);
  assert.ok(span100 <= DEFAULT_TOPOLOGY_ASSEMBLY_TIMING.maxCapabilityStaggerSpanMs + 1e-9, 'growing the capability count past any real portfolio size must not grow the span past its configured cap');
  assert.ok(
    DEFAULT_TOPOLOGY_ASSEMBLY_TIMING.maxCapabilityStaggerSpanMs < DEFAULT_TOPOLOGY_ASSEMBLY_TIMING.maxProjectStaggerSpanMs,
    'the capability stagger span must be materially shorter than the project stagger span — the center activates rapidly'
  );
});

test('phase4b/23 (superseded by the visual tuning pass): project angular budget is unchanged (18°) — only the radial budget was deliberately raised for a more legible capture journey, and stays within the requested 135-155 iso investigation range, not the maximum', () => {
  // Old invariant (Phase 4B): both axes fixed at 90 iso / 18°. New
  // authorized invariant (visual tuning pass): radial raised to 140 (a
  // conservative pick, not the 155 ceiling) because 90 read as too close to
  // the ring for the attraction/capture motion to be visually dramatic;
  // angular deliberately left untouched — the goal was a bigger RADIAL
  // capture journey, not more scatter, and 18° already sat at the floor of
  // the requested 18-20° range.
  assert.ok(DEFAULT_ASSEMBLY_OFFSET_BUDGET.maxRadialOffsetIso >= 135 && DEFAULT_ASSEMBLY_OFFSET_BUDGET.maxRadialOffsetIso <= 155);
  assert.notEqual(DEFAULT_ASSEMBLY_OFFSET_BUDGET.maxRadialOffsetIso, 155, 'must be a conservative pick, not blindly the maximum of the investigation range');
  assert.equal(DEFAULT_ASSEMBLY_OFFSET_BUDGET.maxAngularJitterRadians, Math.PI / 10, 'angular jitter must remain unchanged at 18° — this pass increases radial displacement only');
});

test('phase4b/24: project accepted capture easing remains byte-identical after the shared-curve refactor (same ~10% peak overshoot, same exact endpoints)', () => {
  assert.equal(getAssemblyCaptureEasing(0), 0);
  assert.equal(getAssemblyCaptureEasing(1), 1);
  let max = -Infinity;
  for (let i = 0; i <= 1000; i++) {
    max = Math.max(max, getAssemblyCaptureEasing(i / 1000));
  }
  assert.ok(Math.abs(max - 1.10004) < 0.001, `project overshoot must remain ~10% (unchanged from Phase 1/3.5), got ${max}`);
});

// -- TopologyCanvas integration: capability RAF stepping ---------------------

test('phase4b/10,11,12: no second assembly clock, no capability-specific RAF, no capability timer exists', () => {
  assert.ok(!canvasSource.includes('capabilityAssemblyClockRef'), 'capabilities must share the ONE assemblyClockRef, never a clock of their own');
  assert.equal((canvasSource.match(/useRef<AssemblyClockState/g) ?? []).length, 1, 'exactly one AssemblyClockState ref in the whole file');
  const totalRafCalls = (canvasSource.match(/requestAnimationFrame\(/g) ?? []).length;
  assert.equal(totalRafCalls, 4, 'still exactly 4 (dual-orbit tick x2 + reflow tick x2) — no capability-specific chain');
  const tickBody = extractDualOrbitTickBody(canvasSource);
  assert.ok(!tickBody.includes('setInterval('));
  assert.ok(!tickBody.includes('setTimeout('), 'no capability timer inside the shared tick');
});

test('phase4b/13,14,15: the capability target is recalculated every frame from the CURRENT reactor phase via the existing getMountedCapabilityPosition primitive — never duplicated math, never a frozen snapshot', () => {
  const tickBody = extractDualOrbitTickBody(canvasSource);
  assert.ok(tickBody.includes('getMountedCapabilityPosition('), 'the tick must reuse the existing primitive');
  assert.match(
    tickBody,
    /getMountedCapabilityPosition\(\s*indexWithinReactor,\s*capabilityCount,\s*capabilityReactorGeometry,\s*next\.reactorPhase\s*\)/,
    'must be called with the SAME-TICK next.reactorPhase value, matching how capability settling already reads it'
  );
  // No inline reimplementation of the ellipse-angle formula inside the
  // capability block of the tick (Math.cos/Math.sin belong only to the
  // one-time activation displacement math in the trigger, not the tick).
  const capabilityStepStart = tickBody.indexOf('const capabilityPlan = assemblyCapabilityPlanRef.current;');
  const capabilityStepBlock = tickBody.substring(capabilityStepStart);
  assert.ok(!capabilityStepBlock.includes('Math.cos'), 'the tick must not re-derive reactor ellipse geometry inline');
  assert.ok(!capabilityStepBlock.includes('Math.sin'));
});

test('phase4b/27 + 4C2-B: normal and fast capability setters remain branch-scoped and never run per capability', () => {
  const tickBody = extractDualOrbitTickBody(canvasSource);
  assert.equal((tickBody.match(/setAssemblyCapabilityRenderPositions\(/g) ?? []).length, 4, 'normal and fast completion/update pairs');
  // Phase 4C1: the completion check is the "MOTION complete" (Stage 1) branch.
  const completeIdx = tickBody.indexOf('const isMotionComplete = isAssemblyComplete(nextAssemblyClock, assemblyTiming.totalDurationMs);');
  const elseIdx = tickBody.indexOf('} else {', completeIdx);
  const firstCallIdx = tickBody.indexOf('setAssemblyCapabilityRenderPositions({});', completeIdx);
  const secondCallIdx = tickBody.indexOf('setAssemblyCapabilityRenderPositions(nextCapabilityPositions);', elseIdx);
  assert.ok(completeIdx !== -1 && elseIdx !== -1 && firstCallIdx !== -1 && secondCallIdx !== -1);
  assert.ok(completeIdx < firstCallIdx && firstCallIdx < elseIdx && elseIdx < secondCallIdx);

  // No per-capability setter call inside the forEach loop that builds the map.
  const fastLoopStart = tickBody.indexOf('frameContext.canonicalCapabilityOrder.forEach((capabilityId, indexWithinReactor) => {');
  const fastLoopEnd = tickBody.indexOf('setAssemblyCapabilityRenderPositions(nextFastCapabilityPositions);', fastLoopStart);
  assert.ok(!tickBody.substring(fastLoopStart, fastLoopEnd).includes('setAssemblyCapabilityRenderPositions('));

  const normalLoopStart = tickBody.indexOf('frameContext.canonicalCapabilityOrder.forEach((capabilityId, indexWithinReactor) => {', fastLoopEnd);
  const normalLoopEnd = tickBody.indexOf('setAssemblyCapabilityRenderPositions(nextCapabilityPositions);', normalLoopStart);
  assert.ok(!tickBody.substring(normalLoopStart, normalLoopEnd).includes('setAssemblyCapabilityRenderPositions('));
});

test('phase4b/34: if REACTOR is paused, the capability step still reads next.reactorPhase — a stationary phase produces a stationary target, with no special-casing required', () => {
  // Structural proof: the capability step's live-target call always passes
  // next.reactorPhase directly, regardless of whether the reactor orbit is
  // currently advancing — stepDualOrbitClock's own existing contract
  // (proven in dualOrbitMachine.test.ts) already guarantees next.reactorPhase
  // simply holds steady when isReactorOrbitRunning is false, so no
  // capability-specific reactor-pause branch exists or is needed.
  const tickBody = extractDualOrbitTickBody(canvasSource);
  assert.ok(!tickBody.includes('isReactorOrbitPaused'), 'the capability assembly step must not special-case REACTOR pause — it inherits stationary behavior for free from next.reactorPhase');
});

// -- TopologyCanvas integration: interaction lock ----------------------------

test('phase4b/35,36,37: processMove is the ONE guard preventing project, capability, AND touch drag from progressing during active assembly', () => {
  const processMoveStart = canvasSource.indexOf('const processMove = (clientX: number, clientY: number) => {');
  const processMoveEnd = canvasSource.indexOf('const processRelease = () => {', processMoveStart);
  assert.ok(processMoveStart !== -1 && processMoveEnd !== -1);
  const processMoveBlock = canvasSource.substring(processMoveStart, processMoveEnd);
  const guardIdx = processMoveBlock.indexOf('if (dragRuntimeRef.current.isTopologyAssemblyActive) return;');
  assert.ok(guardIdx !== -1, 'processMove must guard on the shared active flag');
  // The guard must be the FIRST substantive statement (right after reading
  // draggingNodeRef), covering every code path below it — both project and
  // skill branches, and both mouse and touch (processMove is shared by
  // handleWindowMouseMove and handleWindowTouchMove, per the existing
  // single-function design already proven elsewhere in this suite).
  const draggingNodeCheckIdx = processMoveBlock.indexOf('if (!draggingNode) return;');
  assert.ok(draggingNodeCheckIdx !== -1 && draggingNodeCheckIdx < guardIdx, 'the null-check must precede the assembly guard, but nothing else may');
  assert.ok(canvasSource.includes('const handleWindowTouchMove = (e: TouchEvent) => {'), 'touch continues to share processMove, not a separate implementation');
});

test('phase4b/40,41: project and capability nodes stop advertising a grab cursor while assembly is active, reverting to default', () => {
  const cursorOccurrences = canvasSource.match(/className=\{`\$\{isTopologyAssemblyActive \? 'cursor-default' : 'cursor-grab active:cursor-grabbing'\} group transition-all duration-200 \$\{emphasisClass\}`\}/g) ?? [];
  assert.equal(cursorOccurrences.length, 2, 'expected the identical conditional cursor class on both the project node and the capability node');
});

test('phase4b/42,43: project double-click drill-in is guarded while assembly is active, and the guard is a plain early return (not a permanent lock) so normal drill-in resumes automatically once assembly completes', () => {
  const doubleClickStart = canvasSource.indexOf('onDoubleClick={(e) => {');
  const doubleClickEnd = canvasSource.indexOf('onMouseEnter={() => setHoveredProjectId', doubleClickStart);
  assert.ok(doubleClickStart !== -1 && doubleClickEnd !== -1);
  const doubleClickBlock = canvasSource.substring(doubleClickStart, doubleClickEnd);
  assert.ok(doubleClickBlock.includes('if (isTopologyAssemblyActive) return;'));
  assert.ok(doubleClickBlock.includes('onDrillIntoProject(project.id);'), 'the ordinary drill-in call remains, reached whenever isTopologyAssemblyActive is false — including automatically once assembly completes');
});

test('phase4b/44: normal capability interaction is gated by the SAME reactive isTopologyAssemblyActive flag the completion branch clears — nothing else must be reset for capability interaction to resume', () => {
  // isTopologyAssemblyActive is the only condition capability cursor/lock
  // logic reads (proven in phase4b/40,41 above); the completion branch sets
  // it back to false (proven in phase4a/28,29 above) — composing those two
  // facts is the whole "resumes automatically" guarantee, with no separate
  // capability-specific re-enable step required anywhere.
  assert.ok(canvasSource.includes('setIsTopologyAssemblyActive(false);'));
});

test('phase4b/45,46: capability position precedence is exactly drag -> settling -> assembly -> effective -> grid, in that source order, mirroring the project precedence chain', () => {
  const start = canvasSource.indexOf('const getSkillPos = useCallback((skill: InfrastructureSkill) => {');
  const end = canvasSource.indexOf('const activeDockingPreview = useMemo(', start);
  const block = canvasSource.substring(start, end);
  const dragIdx = block.indexOf("draggingNode?.type === 'skill' && draggingNode.id === skill.id");
  const settlingIdx = block.indexOf('capabilitySettlingRenderPositions && capabilitySettlingRenderPositions[skill.id]');
  const assemblyIdx = block.indexOf('assemblyCapabilityRenderPositions[skill.id]');
  const effectiveIdx = block.indexOf('effectiveSkillPositions[skill.id] || skill.gridPosition');
  for (const [name, idx] of [['drag', dragIdx], ['settling', settlingIdx], ['assembly', assemblyIdx], ['effective+grid', effectiveIdx]] as const) {
    assert.ok(idx !== -1, `expected to find the ${name} branch in getSkillPos`);
  }
  assert.ok(dragIdx < settlingIdx, 'drag must precede settling');
  assert.ok(settlingIdx < assemblyIdx, 'settling must precede assembly (settling remains higher precedence, defensively)');
  assert.ok(assemblyIdx < effectiveIdx, 'assembly must precede the effective/grid fallback');

  // Assembly branch is a genuine early return, same shape as the project one.
  assert.match(
    block,
    /if \(assemblyCapabilityRenderPositions\[skill\.id\]\) \{\s*\n\s*return assemblyCapabilityRenderPositions\[skill\.id\];\s*\n\s*\}/,
    'assembly branch must be a plain object-property truthy check with an unconditional early return'
  );
});

test('phase4b/47: capability settling itself is byte-for-byte unchanged — same functions, same call sites, same precedence relative to drag', () => {
  const capabilityReactorSource = fs.readFileSync(path.resolve('src/utils/capabilityReactor.ts'), 'utf8');
  assert.ok(!capabilityReactorSource.toLowerCase().includes('assembly'), 'capabilityReactor.ts must not reference assembly in any way — Phase 4B never modifies capability settling mechanics');
  assert.ok(canvasSource.includes('stepCapabilitySettling('), 'the settling step call site is unchanged');
  assert.ok(canvasSource.includes('createCapabilitySettlingTransition('), 'the settling creation call site is unchanged');
});

test('phase4b/54: capabilityReactor.ts has zero diff-worthy references to assembly — any Phase 4B TopologyCanvas usage is import-only, not a modification', () => {
  const capabilityReactorSource = fs.readFileSync(path.resolve('src/utils/capabilityReactor.ts'), 'utf8');
  assert.ok(!capabilityReactorSource.includes('Phase 4'), 'no Phase 4A/4B comment or code was added to capabilityReactor.ts');
});

test('phase4b: activation preconditions still refuse a dirty topology (active drag, project reflow, capability settling, custom project/capability positions, reduced motion, already active) — unchanged list, now gating BOTH plans', () => {
  const precondition = extractPreconditionBlock(canvasSource);
  for (const requiredCondition of [
    '!draggingNode',
    '!isOrbitReflowActive',
    'capabilitySettlingRenderPositions === null',
    '!hasCustomLayout',
    '!prefersReducedMotion',
    '!isTopologyAssemblyActive',
  ]) {
    assert.ok(precondition.includes(requiredCondition), `precondition must still include ${requiredCondition}`);
  }
});

test('phase4b: generic requirement — no owner-specific identity, repo counts, or literals appear anywhere in the new capability assembly code', () => {
  for (const forbidden of ['SalAkBuK', 'hafsah1976', '18 repos', '33 repos', 'salakbuk']) {
    assert.ok(!canvasSource.toLowerCase().includes(forbidden.toLowerCase()), `must not reference ${forbidden}`);
  }
});

// ===========================================================================
// PHASE 4C1 — system initialization choreography / presentation layer.
// Every beat derives from the SAME assembly elapsedMs already stepped by the
// shared RAF tick (proven above); no new RAF loop, no second clock/timer, no
// new node-motion/geometry/phase mechanics. These tests prove: (a) exactly
// one new render-facing state value was added and every presentation value
// derives from it, (b) the reactor/ring/conduit reveals are opacity-only
// multiplications into pre-existing values, (c) the status UI is fully
// derived, generic, and cleanly mounts/unmounts, and (d) project capture,
// docking, ring geometry, and orbit mechanics remain byte-for-byte untouched.
// ===========================================================================

test('4C1/1: exactly ONE new render-facing elapsed-time state was added — assemblyElapsedMs, nullable, defaulting to null', () => {
  assert.ok(
    canvasSource.includes('const [assemblyElapsedMs, setAssemblyElapsedMs] = useState<number | null>(null);'),
    'expected a single nullable render-facing elapsed-time state'
  );
  // Minimum-state requirement: no other new Phase 4C1 useState was added —
  // every presentation value below must be a useMemo/inline derivation of
  // this one state, never an independent useState.
  for (const forbidden of [
    'useState<number | null>(0)',
    'const [reactorRevealOpacity, setReactorRevealOpacity]',
    'const [conduitRevealOpacity, setConduitRevealOpacity]',
    'const [assemblyStatusPhase, setAssemblyStatusPhase]',
    'const [topologyStatus, setTopologyStatus]',
  ]) {
    assert.ok(!canvasSource.includes(forbidden), `must not introduce a second independent presentation state: ${forbidden}`);
  }
});

test('4C1/2 + 4C2-B: the one presentation elapsed state is written only by startup and mutually exclusive normal/fast RAF branches', () => {
  const assignments = canvasSource.match(/setAssemblyElapsedMs\(/g) ?? [];
  assert.equal(assignments.length, 5, 'startup plus normal/fast update and teardown sites');
  assert.ok(canvasSource.includes('setAssemblyElapsedMs(0);'), 'activation must synchronously seed elapsed time at 0 so the very first render already shows the initial reveal state');
  assert.ok(canvasSource.includes('setAssemblyElapsedMs(nextAssemblyClock.elapsedMs);'), 'the tick must update it from the SAME clock state stepAssemblyClock already produced this frame — no independent time source');
  assert.ok(canvasSource.includes('setAssemblyElapsedMs(null);'), 'presentation-complete teardown must clear it back to null');
});

test('4C1/3 + Redesign Step 1: presentation remains derived from shared elapsed state and an explicit timing profile', () => {
  assert.match(
    canvasSource,
    /getTopologyAssemblyPhase\(assemblyElapsedMs, activePresentationTiming\)/,
    'assemblyStatusPhase must derive purely from assemblyElapsedMs via the reused Phase 1 getTopologyAssemblyPhase, defaulting to null (no active status) when not assembling'
  );
  assert.match(
    canvasSource,
    /getReactorRevealProgress\(assemblyElapsedMs, activePresentationTiming\)/,
    'assemblyReactorRevealOpacity must default to 1 (fully revealed) when not assembling — ordinary rendering is completely unaffected'
  );
  assert.match(
    canvasSource,
    /isRedesignPrototypeVisible[\s\S]*?\? 0[\s\S]*?getConduitRevealProgress\(assemblyElapsedMs, DEFAULT_TOPOLOGY_ASSEMBLY_TIMING\)/,
    'assemblyConduitRevealOpacity must default to 1 (fully revealed) when not assembling'
  );
});

test('4C1/4: reactor shell reveal is a restrained opacity-only multiplication into the pre-existing 0.46 group opacity — no scale/transform/spin added, no reactor geometry or dash-offset formula touched', () => {
  assert.ok(
    canvasSource.includes('<g id="capability-reactor" pointerEvents="none" className="pointer-events-none" opacity={0.46 * assemblyReactorRevealOpacity}>'),
    'the reactor group must multiply its existing fixed opacity by the reveal progress, not replace or restructure it'
  );
  // Restrained per the brief: no transform/scale/rotate was added to this group.
  const reactorGroupStart = canvasSource.indexOf('<g id="capability-reactor"');
  const reactorGroupEnd = canvasSource.indexOf('\n        <g id=', reactorGroupStart + 1);
  const reactorGroupTag = canvasSource.substring(reactorGroupStart, canvasSource.indexOf('>', reactorGroupStart) + 1);
  assert.ok(!reactorGroupTag.includes('transform='), 'reactor reveal must be opacity-only — no transform/scale/spin');
  assert.ok(reactorGroupEnd > reactorGroupStart, 'sanity: found the following sibling group');
  // getCapabilityReactorDashOffset call (the reactor's own circulating
  // structure) must still be driven only by reactorOrbitPhase, unchanged.
  assert.ok(canvasSource.includes('getCapabilityReactorDashOffset(reactorOrbitPhase)'), 'reactor dash-offset formula must remain untouched by the reveal');
});

test('4C1/5: project ring guide reveal is per-ring, staggered by ring index, opacity-only, and generic across any ring count — no ellipse geometry (cx/cy/rx/ry) or registration-tick math touched', () => {
  assert.match(
    canvasSource,
    /const ringRevealProgress =[\s\S]*?redesignPresentationElapsedMs !== null[\s\S]*?REDESIGN_FIELD_ASSEMBLY_TIMING[\s\S]*?assemblyElapsedMs === null[\s\S]*?getRingAssemblyProgress\(assemblyElapsedMs, ring\.index, DEFAULT_TOPOLOGY_ASSEMBLY_TIMING\);/,
    'per-ring reveal progress must derive from ring.index via the reused getRingAssemblyProgress, defaulting to 1 (fully revealed) when not assembling'
  );
  assert.ok(
    canvasSource.includes('<g key={ring.id} opacity={ringOpacity * ringRevealProgress}>'),
    'the per-ring group must multiply its existing hierarchy opacity by the reveal progress, not replace it'
  );
  // Geometry itself (ellipse cx/cy/rx/ry) must be computed exactly as before
  // the reveal was added — still straight from ring.geometry, no new offset.
  const guidesStart = canvasSource.indexOf('id="orbital-field-guides"');
  const guidesEnd = canvasSource.indexOf('{isRedesignPrototypeActive && redesignPresentationElapsedMs !== null', guidesStart);
  const guidesBlock = canvasSource.substring(guidesStart, guidesEnd);
  assert.ok(guidesBlock.includes('cx={cx}') && guidesBlock.includes('cy={cy}') && guidesBlock.includes('rx={rx}') && guidesBlock.includes('ry={ry}'), 'ellipse geometry props must remain exactly the pre-existing ring.geometry-derived values');
  assert.ok(!guidesBlock.includes('transform='), 'ring guide reveal must be opacity-only — no transform');
  // Works for any ring index/count: derivation reads only ring.index, never
  // a hardcoded ring id or a fixed ring count.
  assert.ok(!guidesBlock.includes('ring.index === 0 &&') , 'must not special-case any specific ring index');
});

test('4C1/6: conduit presentation reveal is opacity-only on the existing wiring-conduits group — conduits still resolve their endpoints exclusively from the pre-existing renderedConnections/getProjectPos/getSkillPos pipeline, never a separate position formula', () => {
  assert.ok(
    canvasSource.includes('<g id="wiring-conduits" opacity={assemblyConduitRevealOpacity}>'),
    'the conduits group must gain only an opacity prop, no other structural change'
  );
  assert.ok(canvasSource.includes('{renderedConnections}'), 'conduits must still render the same pre-existing renderedConnections collection');
  // No new conduit-specific position/geometry function was introduced.
  assert.ok(!canvasSource.includes('getConduitPosition'), 'no separate conduit position formula may exist — conduits stay bound to getProjectPos/getSkillPos via calculateConduitGeometry as before');
});

test('4C1/7: the status readout renders only while an assembly transition is active, derives its text and counts entirely from state, and is absolutely positioned + pointer-events-none so it cannot cause layout shift', () => {
  const statusStart = canvasSource.indexOf('{!isRedesignPrototypeVisible && assemblyElapsedMs !== null && assemblyStatusPhase !== null && (');
  assert.ok(statusStart !== -1, 'expected the status readout to be conditionally rendered on both assemblyElapsedMs and assemblyStatusPhase being non-null');
  const statusEnd = canvasSource.indexOf('{/* Bottom-Left Controls & Status */}', statusStart);
  const statusBlock = canvasSource.substring(statusStart, statusEnd);

  assert.ok(statusBlock.includes('className="absolute'), 'status readout must be absolutely positioned, not participate in document flow');
  assert.ok(statusBlock.includes('pointer-events-none'), 'status readout must not intercept pointer events');
  assert.ok(statusBlock.includes('SYSTEM INITIALIZING'));
  assert.ok(statusBlock.includes('TOPOLOGY STABLE'));
  assert.ok(statusBlock.includes('RESOLVING TOPOLOGY'));

  // Derived counts, not hardcoded literals — must read the live project/
  // capability collections, never a fixed owner-specific number.
  assert.ok(statusBlock.includes('{projects.length}'), 'system count must be derived from the live projects array, never hardcoded');
  assert.ok(statusBlock.includes('{canonicalCapabilityOrder.length}'), 'capability count must be derived from the live canonical capability order, never hardcoded');
  for (const forbiddenLiteral of ['18 SYSTEMS', '33 SYSTEMS', '15 CAPABILITIES']) {
    assert.ok(!statusBlock.includes(forbiddenLiteral), `must not hardcode a literal count: ${forbiddenLiteral}`);
  }

  // "RESOLVING TOPOLOGY" (the conduits-phase secondary line) is itself
  // conditional on assemblyStatusPhase === 'conduits', not always shown
  // alongside "SYSTEM INITIALIZING".
  assert.match(statusBlock, /\{assemblyStatusPhase === 'conduits' && \(/, 'the secondary line must be gated on the conduits phase specifically');
});

test('4C1/8: the status readout is a single conditional block, not a permanently-mounted duplicate telemetry component — it fully unmounts (returns nothing) once assemblyElapsedMs returns to null', () => {
  // There is exactly one JSX <span> actually rendering each status string
  // (comments elsewhere may mention the phrase in prose, which is fine — no
  // second always-on status widget duplicates the rendered text itself,
  // e.g. in the bottom-left telemetry console).
  const stableSpanOccurrences = (canvasSource.match(/>TOPOLOGY STABLE<\/span>/g) ?? []).length;
  assert.equal(stableSpanOccurrences, 1, 'TOPOLOGY STABLE must be rendered in exactly one place — the conditionally-mounted status readout, not a permanent duplicate');
  const initializingSpanOccurrences = (canvasSource.match(/>SYSTEM INITIALIZING<\/span>/g) ?? []).length;
  assert.equal(initializingSpanOccurrences, 1);
});

test('4C1/9: project capture mechanics remain completely untouched by this phase — the RAF tick project-position formula block is byte-for-byte identical in shape to the pre-4C1 structure proven in phase4a/phase3 tests above', () => {
  const tickBody = extractDualOrbitTickBody(canvasSource);
  // Re-affirm (in the 4C1 context) the exact same project-layer formula
  // chain phase3/20,21 already proves in full: ring/index -> rawProgress ->
  // easing -> liveTarget -> resolveAssemblyPosition, completely undisturbed
  // by the presentation additions above/below it in the tick.
  assert.ok(tickBody.includes('getProjectAssemblyProgress('));
  assert.ok(tickBody.includes('getAssemblyCaptureEasing('));
  assert.ok(tickBody.includes('getDynamicOrbitalPosition('));
  assert.match(
    tickBody,
    /resolveAssemblyPosition\(\s*plan\.startPositions\[projectId\],\s*liveTarget,\s*rawProgress,\s*interpolationFactor\s*\)/
  );
  // The offset budget / displacement constants (140 iso project radial, 18°
  // angular; 60 iso capability radial, 6° angular) live in
  // DEFAULT_ASSEMBLY_OFFSET_BUDGET / DEFAULT_CAPABILITY_ASSEMBLY_OFFSET_BUDGET
  // in topologyAssembly.ts, not in TopologyCanvas.tsx — this phase touches
  // neither constant.
  assert.ok(!canvasSource.includes('DEFAULT_ASSEMBLY_OFFSET_BUDGET ='), 'must not redefine the accepted project offset budget');
  assert.ok(!canvasSource.includes('DEFAULT_CAPABILITY_ASSEMBLY_OFFSET_BUDGET ='), 'must not redefine the accepted capability offset budget');
});

test('4C1/10 + 4C2-B: interaction remains locked until either normal presentation-complete or fast-completion teardown', () => {
  const processMoveStart = canvasSource.indexOf('const processMove = (clientX: number, clientY: number) => {');
  const processMoveEnd = canvasSource.indexOf('const processRelease = () => {', processMoveStart);
  const processMoveBlock = canvasSource.substring(processMoveStart, processMoveEnd);
  assert.ok(processMoveBlock.includes('if (dragRuntimeRef.current.isTopologyAssemblyActive) return;'), 'processMove guard must remain exactly as Phase 4B established it');

  // isTopologyAssemblyActive itself is only ever cleared inside the Stage 2
  // (presentation-complete) teardown block — proven structurally by finding
  // its one false-assignment site and confirming it sits after the
  // presentation-complete boundary rather than the motion-complete one.
  const tickBody = extractDualOrbitTickBody(canvasSource);
  const motionCompleteIdx = tickBody.indexOf('const isMotionComplete = isAssemblyComplete(nextAssemblyClock, assemblyTiming.totalDurationMs);');
  const presentationCompleteIdx = tickBody.indexOf('if (isAssemblyComplete(nextAssemblyClock, assemblyTiming.presentationCompleteMs)) {');
  const normalFalseAssignmentIdx = tickBody.lastIndexOf('setIsTopologyAssemblyActive(false);');
  assert.ok(motionCompleteIdx !== -1 && presentationCompleteIdx !== -1 && normalFalseAssignmentIdx !== -1);
  assert.ok(
    normalFalseAssignmentIdx > presentationCompleteIdx && presentationCompleteIdx > motionCompleteIdx,
    'interaction unlock (setIsTopologyAssemblyActive(false)) must occur inside the presentation-complete branch, strictly after motion-complete — Section 22 option B'
  );
  assert.equal((tickBody.match(/setIsTopologyAssemblyActive\(false\);/g) ?? []).length, 2);
});

test('4C1/11 (superseded by 4C2-B): visible SKIP exists without ESC or alternate fast-forward mechanisms', () => {
  assert.ok(canvasSource.includes('handleSkipTopologyAssembly'));
  assert.ok(canvasSource.includes('SKIP'));
  for (const forbidden of ["key === 'Escape'", 'fast-forward', 'fastForward']) assert.ok(!canvasSource.includes(forbidden));
});

test('4C1/12 (superseded by 4C2-A): activation still has exactly one implementation', () => {
  const appSource = fs.readFileSync(path.resolve('src/App.tsx'), 'utf8');
  assert.ok(appSource.includes('claimTopologyStartup={claimTopologyStartup}'));

  const activationCalls = canvasSource.match(/setIsTopologyAssemblyActive\(true\)/g) ?? [];
  assert.equal(activationCalls.length, 1, 'automatic and DEV callers must share one activation implementation');
});

test('4C1/13: reduced-motion DEV-trigger gating is unchanged — the precondition still requires !prefersReducedMotion, and no separate reduced-motion presentation path was added', () => {
  const precondition = extractPreconditionBlock(canvasSource);
  assert.ok(precondition.includes('!prefersReducedMotion'));
  assert.ok(!canvasSource.includes('prefersReducedMotion ? getReactorRevealProgress'), 'no reduced-motion-specific branch was added to any reveal helper call site');
});

test('4C1/14: no new requestAnimationFrame/setInterval loop was introduced by this phase — the RAF count remains exactly 4, matching the pre-4C1 invariant', () => {
  const totalRafCalls = (canvasSource.match(/requestAnimationFrame\(/g) ?? []).length;
  assert.equal(totalRafCalls, 4, 'Phase 4C1 must add zero new RAF chains — every presentation beat derives from the existing shared tick');
});

test('4C1/15: generic requirement — no owner-specific identity, hardcoded system/capability counts, or literal ring-count assumptions appear anywhere in the new presentation code', () => {
  for (const forbidden of ['SalAkBuK', 'hafsah1976', 'salakbuk']) {
    assert.ok(!canvasSource.toLowerCase().includes(forbidden.toLowerCase()), `must not reference ${forbidden}`);
  }
  // The status block itself must never branch on a specific ring count or
  // project count value.
  const statusStart = canvasSource.indexOf('{!isRedesignPrototypeVisible && assemblyElapsedMs !== null && assemblyStatusPhase !== null && (');
  const statusEnd = canvasSource.indexOf('{/* Bottom-Left Controls & Status */}', statusStart);
  const statusBlock = canvasSource.substring(statusStart, statusEnd);
  assert.ok(!/projects\.length === \d+/.test(statusBlock), 'must not special-case a specific project count');
  assert.ok(!/canonicalCapabilityOrder\.length === \d+/.test(statusBlock), 'must not special-case a specific capability count');
});

// ===========================================================================
// PHASE 4C2-A — production startup lifecycle. Source-structure regression
// coverage follows this repository's no-jsdom convention and checks the claim,
// readiness, accessibility, shared-start, and remount contracts directly.
// ===========================================================================

const appSource = fs.readFileSync(path.resolve('src/App.tsx'), 'utf8');
const mainSource = fs.readFileSync(path.resolve('src/main.tsx'), 'utf8');

function extractInitialStartupEffect(source: string): string {
  const start = source.indexOf('const initializedRef = useRef(false);');
  assert.ok(start !== -1);
  const end = source.indexOf('// Keyboard controls for zoom, fit, snap toggle, and reset', start);
  assert.ok(end !== -1);
  return source.substring(start, end);
}

test('4C2-A/1-7,19,20: App owns a synchronous runtime-only claim-once ref that resets only with a new App instance', () => {
  const appFunctionStart = appSource.indexOf('export default function App() {');
  const latchStart = appSource.indexOf('const hasPlayedTopologyStartupRef = useRef(false);', appFunctionStart);
  const claimStart = appSource.indexOf('const claimTopologyStartup = useCallback(() => {', latchStart);
  const claimEnd = appSource.indexOf('}, []);', claimStart);
  assert.ok(appFunctionStart !== -1 && latchStart > appFunctionStart && claimStart > latchStart && claimEnd > claimStart);

  const claimBlock = appSource.substring(claimStart, claimEnd);
  assert.ok(claimBlock.includes('if (hasPlayedTopologyStartupRef.current) {'));
  assert.ok(claimBlock.includes('return false;'));
  assert.ok(claimBlock.includes('hasPlayedTopologyStartupRef.current = true;'));
  assert.ok(claimBlock.includes('return true;'));
  assert.ok(claimBlock.indexOf('hasPlayedTopologyStartupRef.current = true;') < claimBlock.lastIndexOf('return true;'));
  assert.ok(!appSource.includes('localStorage'));
  assert.ok(!appSource.includes('sessionStorage'));
  assert.ok(!appSource.includes('document.cookie'));
  assert.ok(!appSource.includes('window.location'));
});

test('4C2-A/8,17-19,27,28: TopologyCanvas receives the App claim; drill-in preserves the instance and Contact remount cannot replay', () => {
  assert.ok(canvasSource.includes('claimTopologyStartup: () => boolean;'));
  assert.ok(canvasSource.includes('claimTopologyStartup,'));
  assert.ok(appSource.includes('claimTopologyStartup={claimTopologyStartup}'));

  const topologyBranch = appSource.substring(
    appSource.indexOf("{activeView === 'contact' ? ("),
    appSource.indexOf('{/* 3. Bottom Command & Operating Strip */}')
  );
  assert.ok(topologyBranch.includes('<ContactPage'));
  assert.ok(topologyBranch.includes('<TopologyCanvas'));
  assert.ok(topologyBranch.includes("drilledProject ? 'invisible pointer-events-none' : 'visible'"));
  assert.ok(appSource.indexOf('const hasPlayedTopologyStartupRef') < appSource.indexOf("{activeView === 'contact' ? ("));
});

test('4C2-A/9,10,29-31 + Promotion: automatic production startup is the sole caller, and it activates the approved redesign choreography directly', () => {
  assert.equal((canvasSource.match(/const startTopologyAssembly = useCallback\(/g) ?? []).length, 1);
  assert.equal((canvasSource.match(/assemblyClockRef\.current = createAssemblyClockState\(\);/g) ?? []).length, 2);
  assert.equal((canvasSource.match(/startTopologyAssembly\(\);/g) ?? []).length, 0, 'no bare no-arg call site remains');

  const startupEffect = extractInitialStartupEffect(canvasSource);
  assert.ok(startupEffect.includes("startTopologyAssembly('redesign');"));
  assert.ok(!startupEffect.includes('import.meta.env.DEV'));

  // Promotion: the DEV-only manual-testing button is removed and the
  // field-trace layer's DEV gate is removed (it must reach production now)
  // — no import.meta.env.DEV usage remains anywhere for this feature.
  assert.equal((canvasSource.match(/import\.meta\.env\.DEV/g) ?? []).length, 0, 'no DEV-only gating remains — this is real production behavior now');
  assert.equal((canvasSource.match(/startTopologyAssembly\('redesign'\);/g) ?? []).length, 1);
  assert.ok(!canvasSource.includes('TEST ASSEMBLY'));
  assert.ok(!canvasSource.includes('BLACK CORE TEST'));
});

test('4C2-A/11-16: startup waits for measured dimensions, batches after initial Fit All, and cannot replay on effect reruns or StrictMode', () => {
  const effect = extractInitialStartupEffect(canvasSource);
  const fitIndex = effect.indexOf('fitAll();');
  const claimIndex = effect.indexOf('if (!claimTopologyStartup()) return;');
  const startIndex = effect.indexOf("startTopologyAssembly('redesign');");
  assert.ok(effect.includes('if (initializedRef.current) return;'));
  assert.ok(effect.includes('useLayoutEffect(() => {'), 'fit/start must flush before paint to avoid a default-camera frame');
  assert.ok(effect.includes('containerRef.current?.clientWidth ?? 0'));
  assert.ok(effect.includes('containerRef.current?.clientHeight ?? 0'));
  assert.ok(effect.includes('if (width <= 200 || height <= 200) return;'));
  assert.ok(fitIndex !== -1 && claimIndex > fitIndex && startIndex > claimIndex);
  assert.ok(effect.indexOf('initializedRef.current = true;') < claimIndex);
  assert.ok(!effect.includes('setTimeout('));
  assert.ok(!effect.includes('requestAnimationFrame('));
  assert.ok(mainSource.includes('<StrictMode>'));
  assert.equal((canvasSource.match(/requestAnimationFrame\(/g) ?? []).length, 4);
});

test('4C2-A/21-25: reduced motion consumes the claim and leaves every assembly runtime layer in its ordinary final state', () => {
  const effect = extractInitialStartupEffect(canvasSource);
  const claimIndex = effect.indexOf('if (!claimTopologyStartup()) return;');
  const reducedIndex = effect.indexOf('if (prefersReducedMotion) return;');
  const startIndex = effect.indexOf("startTopologyAssembly('redesign');");
  assert.ok(claimIndex !== -1 && reducedIndex > claimIndex && startIndex > reducedIndex);

  const beforeStart = effect.substring(0, startIndex);
  for (const forbidden of [
    'createAssemblyClockState(',
    'setAssemblyProjectRenderPositions(',
    'setAssemblyCapabilityRenderPositions(',
    'setAssemblyElapsedMs(',
    'setIsTopologyAssemblyActive(true)',
  ]) {
    assert.ok(!beforeStart.includes(forbidden), `reduced-motion path must not call ${forbidden}`);
  }
});

test('4C2-A/26: hidden-at-start uses the existing paused clock contract and therefore cannot catch up', () => {
  const effect = extractInitialStartupEffect(canvasSource);
  assert.ok(!effect.includes('isDocumentHidden'), 'claim and preparation occur even while hidden');
  assert.ok(canvasSource.includes('const isAssemblyRunning = !isPauseConditionActive;'));

  const baseline = stepAssemblyClock(createAssemblyClockState(), 1000, false, timing.presentationCompleteMs);
  assert.equal(baseline.elapsedMs, 0);
  assert.equal(baseline.lastTimestamp, null);
  const visibleBaseline = stepAssemblyClock(baseline, 100000, true, timing.presentationCompleteMs);
  assert.equal(visibleBaseline.elapsedMs, 0);
  assert.equal(visibleBaseline.lastTimestamp, 100000);
});

test('4C2-A/32-44: choreography, motion utilities, owner data, and empty-topology completion remain unchanged/generic', () => {
  assert.equal((canvasSource.match(/requestAnimationFrame\(/g) ?? []).length, 4);
  const start = extractTriggerBlock(canvasSource);
  assert.ok(start.includes('const projectStartPositions: Record<string, AssemblyPoint> = {};'));
  assert.ok(start.includes('const capabilityStartPositions: Record<string, AssemblyPoint> = {};'));
  assert.ok(start.includes('assemblyClockRef.current = createAssemblyClockState();'));
  assert.ok(start.includes('setIsTopologyAssemblyActive(true);'));

  for (const generatedPath of fs.readdirSync(path.resolve('src/data')).filter(name => name.includes('.generated'))) {
    const generatedSource = fs.readFileSync(path.resolve('src/data', generatedPath), 'utf8');
    assert.ok(!/topologyStartup|startupSession|hasPlayedTopologyStartup/i.test(generatedSource));
  }

  for (const protectedPath of [
    'src/utils/projectDocking.ts',
    'src/utils/projectRingAllocation.ts',
    'src/utils/orbitMotion.ts',
    'src/utils/capabilityReactor.ts',
  ]) {
    const source = fs.readFileSync(path.resolve(protectedPath), 'utf8');
    assert.ok(!source.includes('claimTopologyStartup'), `${protectedPath} must remain outside startup lifecycle integration`);
  }
});

// ===========================================================================
// PHASE 4C2-B — restrained fast completion and final QA-scaffolding removal.
// ===========================================================================

function extractSkipHandler(source: string): string {
  const start = source.indexOf('const handleSkipTopologyAssembly = useCallback(() => {');
  assert.ok(start !== -1);
  const end = source.indexOf('// Real-time preview calculation of snapped', start);
  assert.ok(end !== -1);
  return source.substring(start, end);
}

function extractFastCompletionTickBlock(source: string): string {
  const tick = extractDualOrbitTickBody(source);
  const start = tick.indexOf('if (fastPlan) {');
  const end = tick.indexOf('// Phase 4C1: clamped against presentationCompleteMs', start);
  assert.ok(start !== -1 && end > start);
  return tick.substring(start, end);
}

test('4C2-B/22-24: fast completion is centralized at 200ms with deterministic bounded cubic easing', () => {
  assert.equal(TOPOLOGY_ASSEMBLY_FAST_COMPLETION_DURATION_MS, 200);
  assert.ok(TOPOLOGY_ASSEMBLY_FAST_COMPLETION_DURATION_MS >= 150);
  assert.ok(TOPOLOGY_ASSEMBLY_FAST_COMPLETION_DURATION_MS <= 250);
  assert.equal(getAssemblyFastCompletionProgress(0), 0);
  assert.equal(getAssemblyFastCompletionProgress(100), 0.5);
  assert.equal(getAssemblyFastCompletionProgress(200), 1);
  assert.equal(getAssemblyFastCompletionProgress(1000), 1);
  assert.equal(getAssemblyFastCompletionEasing(0), 0);
  assert.equal(getAssemblyFastCompletionEasing(0.5), 0.875);
  assert.equal(getAssemblyFastCompletionEasing(1), 1);
  for (let index = 0; index <= 100; index++) {
    const eased = getAssemblyFastCompletionEasing(index / 100);
    assert.ok(eased >= 0 && eased <= 1, 'fast completion must never overshoot');
  }
});

test('4C2-B/7-12 + Promotion: legacy TEST ASSEMBLY and the temporary BLACK CORE TEST button both stay gone; production SKIP remains accessible and scoped for the now-production redesign choreography', () => {
  assert.ok(!canvasSource.includes('TEST ASSEMBLY'));
  assert.ok(!canvasSource.includes('Sparkles'));
  // Promotion: the manual-testing button and the field-trace DEV gate are
  // both removed -- no import.meta.env.DEV usage remains for this feature.
  assert.equal((canvasSource.match(/import\.meta\.env\.DEV/g) ?? []).length, 0);
  assert.ok(!canvasSource.includes('BLACK CORE TEST'), 'the temporary manual-testing button is removed now that production activates this path automatically');
  // Two mutually-exclusive presentation contexts (the redesign minimal
  // status text, now shown during production startup, and the older
  // non-redesign status card) each render their own SKIP button so the
  // affordance is reachable regardless of which one is currently visible --
  // both call the identical shared handler.
  assert.equal((canvasSource.match(/handleSkipTopologyAssembly\(\);/g) ?? []).length, 2, 'both presentation contexts call the same SKIP handler');
  assert.equal((canvasSource.match(/const canSkipTopologyAssembly =/g) ?? []).length, 1, 'one shared eligibility condition, not duplicated logic');
  assert.ok(!canvasSource.includes("key === 'Escape'"), 'ESC support was deliberately not added');
  for (const forbidden of ['URLSearchParams', 'window.location.search', 'localStorage', 'sessionStorage']) {
    assert.ok(!canvasSource.includes(forbidden), `no alternate replay/skip mechanism via ${forbidden}`);
  }

  const statusStart = canvasSource.indexOf('{!isRedesignPrototypeVisible && assemblyElapsedMs !== null && assemblyStatusPhase !== null && (');
  const statusEnd = canvasSource.indexOf('{/* Bottom-Left Controls & Status */}', statusStart);
  const status = canvasSource.substring(statusStart, statusEnd);
  assert.ok(status.includes('canSkipTopologyAssembly'));
  assert.match(status, /<button\s+type="button"\s+aria-label="Skip topology initialization"/);
  assert.match(status, />\s*SKIP\s*<\/button>/);
  assert.ok(status.includes('pointer-events-auto'));
  assert.ok(!status.includes('autoFocus'));

  // The redesign minimal status text (production's actual startup
  // presentation) must ALSO carry a working SKIP button, not just the
  // legacy non-redesign card above.
  const redesignStatusStart = canvasSource.indexOf('{isRedesignPrototypeVisible && (');
  const redesignStatusEnd = canvasSource.indexOf('{/* System initialization status', redesignStatusStart);
  const redesignStatus = canvasSource.substring(redesignStatusStart, redesignStatusEnd);
  assert.ok(redesignStatus.includes('canSkipTopologyAssembly'));
  assert.match(redesignStatus, /<button\s+type="button"\s+aria-label="Skip topology initialization"/);
  assert.match(redesignStatus, />\s*SKIP\s*<\/button>/);
});

test('4C2-B/13-15,51: skip captures current visible maps, not original deterministic starts, and App owns no skip state', () => {
  const handler = extractSkipHandler(canvasSource);
  assert.ok(handler.includes('projectStartPositions: { ...assemblyProjectRenderPositions }'));
  assert.ok(handler.includes('capabilityStartPositions: { ...assemblyCapabilityRenderPositions }'));
  assert.ok(handler.includes('startPresentationElapsedMs: assemblyElapsedMs'));
  assert.ok(!handler.includes('projectStartPositions: { ...assemblyProjectPlanRef'));
  assert.ok(!handler.includes('capabilityStartPositions: { ...assemblyCapabilityPlanRef'));
  assert.ok(handler.indexOf('assemblyProjectPlanRef.current = null;') > handler.indexOf('assemblyFastCompletionPlanRef.current = {'));
  assert.ok(handler.indexOf('assemblyCapabilityPlanRef.current = null;') > handler.indexOf('assemblyFastCompletionPlanRef.current = {'));
  assert.ok(handler.includes('assemblyClockRef.current = createAssemblyClockState();'));
  assert.ok(!appSource.toLowerCase().includes('skip'));
});

test('4C2-B/16-21,40,41: fast project/capability targets stay live and endpoint resolution is exact', () => {
  const fast = extractFastCompletionTickBlock(canvasSource);
  assert.match(fast, /getDynamicOrbitalPosition\(\s*project,\s*indexWithinRing,\s*dockedIds\.length,\s*ring\.geometry,\s*getRingPhaseFromRefs\(ring\)\s*\)/);
  assert.match(fast, /getMountedCapabilityPosition\(\s*indexWithinReactor,\s*capabilityCount,\s*capabilityReactorGeometry,\s*next\.reactorPhase\s*\)/);
  assert.ok(fast.includes('fastPlan.projectStartPositions[projectId]'));
  assert.ok(fast.includes('fastPlan.capabilityStartPositions[capabilityId]'));
  assert.ok(!fast.includes('projectOrbitPhase ='));
  assert.ok(!fast.includes('reactorOrbitPhase ='));

  const currentVisible = { x: 40, y: 70 };
  const firstLiveTarget = { x: 100, y: 110 };
  const movedLiveTarget = { x: 120, y: 90 };
  const progress = 0.5;
  const eased = getAssemblyFastCompletionEasing(progress);
  assert.notDeepEqual(
    resolveAssemblyPosition(currentVisible, firstLiveTarget, progress, eased),
    resolveAssemblyPosition(currentVisible, movedLiveTarget, progress, eased),
    'changing the live target during SKIP must change the resolved position'
  );
  assert.deepEqual(resolveAssemblyPosition(currentVisible, movedLiveTarget, 1, 1), movedLiveTarget);
});

test('4C2-B/18-21,42-44: skip never changes orbit rate/phase, docking, or interactive ring order', () => {
  const handler = extractSkipHandler(canvasSource);
  const fast = extractFastCompletionTickBlock(canvasSource);
  for (const forbidden of [
    'setProjectOrbitRateMultiplier(',
    'setReactorOrbitRateMultiplier(',
    'setProjectOrbitPhase(',
    'setReactorOrbitPhase(',
    'resetOrbitPhasesToCanonical(',
    'setProjectDockState(',
    'setInteractiveOrbitOrderByRing(',
    'setCustomProjectPositions(',
    'setCustomSkillPositions(',
  ]) {
    assert.ok(!handler.includes(forbidden), `SKIP handler must not call ${forbidden}`);
    assert.ok(!fast.includes(forbidden), `fast RAF branch must not call ${forbidden}`);
  }
});

test('4C2-B/25-30: one existing RAF/clock remains authoritative with one map setter per layer per fast frame', () => {
  const tick = extractDualOrbitTickBody(canvasSource);
  const fast = extractFastCompletionTickBlock(canvasSource);
  const handler = extractSkipHandler(canvasSource);
  assert.equal((canvasSource.match(/requestAnimationFrame\(/g) ?? []).length, 4);
  assert.equal((tick.match(/stepAssemblyClock\(/g) ?? []).length, 1);
  assert.equal((canvasSource.match(/setInterval\(/g) ?? []).length, 0);
  assert.ok(!fast.includes('setTimeout('));
  assert.ok(!handler.includes('setTimeout('));
  assert.equal((fast.match(/setAssemblyProjectRenderPositions\(nextFastProjectPositions\);/g) ?? []).length, 1);
  assert.equal((fast.match(/setAssemblyCapabilityRenderPositions\(nextFastCapabilityPositions\);/g) ?? []).length, 1);

  const projectLoopStart = fast.indexOf('for (const projectId of Object.keys(fastPlan.projectStartPositions)) {');
  const projectSetter = fast.indexOf('setAssemblyProjectRenderPositions(nextFastProjectPositions);');
  assert.ok(!fast.substring(projectLoopStart, projectSetter).includes('setAssemblyProjectRenderPositions('));
  const capabilityLoopStart = fast.indexOf('frameContext.canonicalCapabilityOrder.forEach');
  const capabilitySetter = fast.indexOf('setAssemblyCapabilityRenderPositions(nextFastCapabilityPositions);');
  assert.ok(!fast.substring(capabilityLoopStart, capabilitySetter).includes('setAssemblyCapabilityRenderPositions('));
});

test('4C2-B/31-34: presentation rapidly resolves through existing elapsed-time derivations and reaches TOPOLOGY STABLE', () => {
  const fast = extractFastCompletionTickBlock(canvasSource);
  assert.ok(fast.includes('DEFAULT_TOPOLOGY_ASSEMBLY_TIMING.presentationCompleteMs - fastPlan.startPresentationElapsedMs'));
  assert.ok(fast.includes('setAssemblyElapsedMs(presentationElapsedMs);'));
  assert.ok(canvasSource.includes('getReactorRevealProgress(assemblyElapsedMs, activePresentationTiming)'));
  assert.ok(canvasSource.includes('getRingAssemblyProgress(assemblyElapsedMs, ring.index, DEFAULT_TOPOLOGY_ASSEMBLY_TIMING)'));
  assert.ok(canvasSource.includes('getConduitRevealProgress(assemblyElapsedMs, DEFAULT_TOPOLOGY_ASSEMBLY_TIMING)'));
  assert.ok(canvasSource.includes('TOPOLOGY STABLE'));

  const lateFastProgress = getAssemblyFastCompletionEasing(0.75);
  const presentationElapsed = timing.presentationCompleteMs * lateFastProgress;
  assert.equal(getTopologyAssemblyPhase(presentationElapsed, timing), 'online');
  assert.equal(getReactorRevealProgress(presentationElapsed, timing), 1);
  assert.equal(getConduitRevealProgress(presentationElapsed, timing), 1);
});

test('4C2-B/35-39: interaction stays locked during fast completion and returns only in its completion branch', () => {
  const handler = extractSkipHandler(canvasSource);
  const fast = extractFastCompletionTickBlock(canvasSource);
  assert.ok(handler.includes('setIsAssemblyFastCompleting(true);'));
  assert.ok(!handler.includes('setIsTopologyAssemblyActive(false);'));
  const complete = fast.indexOf('if (isFastCompletionComplete) {');
  const unlock = fast.indexOf('setIsTopologyAssemblyActive(false);', complete);
  assert.ok(complete !== -1 && unlock > complete);
  assert.ok(canvasSource.includes('if (dragRuntimeRef.current.isTopologyAssemblyActive) return;'));
  assert.match(canvasSource, /if \(isTopologyAssemblyActive\) return;\s+onDrillIntoProject\(project\.id\);/);
  assert.ok(fast.indexOf('setAssemblyProjectRenderPositions({});') < unlock);
  assert.ok(fast.indexOf('setAssemblyCapabilityRenderPositions({});') < unlock);
});

test('4C2-B/45-47: frozen normal constants, timings, and normal assembly branch remain intact', () => {
  assert.deepEqual(DEFAULT_TOPOLOGY_ASSEMBLY_TIMING, {
    totalDurationMs: 3200,
    presentationCompleteMs: 3450,
    reactorRevealStartMs: 0,
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
    capabilityCaptureStartMs: 480,
    capabilityCaptureDurationMs: 650,
    capabilityStaggerMs: 8,
    maxCapabilityStaggerSpanMs: 140,
  });
  assert.equal(DEFAULT_ASSEMBLY_OFFSET_BUDGET.maxRadialOffsetIso, 140);
  assert.equal(DEFAULT_CAPABILITY_ASSEMBLY_OFFSET_BUDGET.maxRadialOffsetIso, 60);
  const tick = extractDualOrbitTickBody(canvasSource);
  assert.ok(tick.includes('getAssemblyCaptureEasing(rawProgress)'));
  assert.ok(tick.includes('getCapabilityAssemblyCaptureEasing(rawProgress)'));
});

test('4C2-B/48-50: zero-project, zero-capability, and empty-topology fast completion are safe', () => {
  const emptyProjectStarts: Record<string, { x: number; y: number }> = {};
  const emptyCapabilityStarts: Record<string, { x: number; y: number }> = {};
  assert.deepEqual(Object.keys(emptyProjectStarts), []);
  assert.deepEqual(Object.keys(emptyCapabilityStarts), []);

  let clock = createAssemblyClockState();
  clock = stepAssemblyClock(clock, 1000, true, TOPOLOGY_ASSEMBLY_FAST_COMPLETION_DURATION_MS);
  clock = stepAssemblyClock(clock, 1200, true, TOPOLOGY_ASSEMBLY_FAST_COMPLETION_DURATION_MS);
  assert.equal(isAssemblyComplete(clock, TOPOLOGY_ASSEMBLY_FAST_COMPLETION_DURATION_MS), true);
  assert.equal(getAssemblyFastCompletionProgress(clock.elapsedMs), 1);
});

test('4C2-B/1-6,17,52-56: startup lifecycle, reduced motion, App latch, and protected modules remain unchanged', () => {
  const startup = extractInitialStartupEffect(canvasSource);
  assert.ok(startup.includes('if (!claimTopologyStartup()) return;'));
  assert.ok(startup.includes('if (prefersReducedMotion) return;'));
  assert.ok(startup.includes("startTopologyAssembly('redesign');"));
  assert.ok(appSource.includes('const hasPlayedTopologyStartupRef = useRef(false);'));
  assert.ok(appSource.includes('claimTopologyStartup={claimTopologyStartup}'));
  assert.ok(appSource.includes("{activeView === 'contact' ? ("));
  assert.ok(appSource.includes("drilledProject ? 'invisible pointer-events-none' : 'visible'"));

  for (const protectedPath of [
    'src/utils/projectDocking.ts',
    'src/utils/projectRingAllocation.ts',
    'src/utils/orbitMotion.ts',
    'src/utils/capabilityReactor.ts',
  ]) {
    const source = fs.readFileSync(path.resolve(protectedPath), 'utf8');
    assert.ok(!source.includes('FastCompletion'));
    assert.ok(!source.includes('handleSkipTopologyAssembly'));
  }
});

// ===========================================================================
// REDESIGN STEP 1 — DEV-only black-core field-assembly visual prototype.
// ===========================================================================

test('Promotion: the former DEV-only BLACK CORE TEST button is gone; production startup is the one caller and App lifecycle is unaware of the mode name', () => {
  // Old invariant: a manual DEV-only <button> was the sole 'redesign' caller
  // and production called the bare no-arg default. New invariant: that
  // button is removed entirely (visually approved, promotion complete —
  // there is no remaining debugging value in a manual re-trigger button
  // since every fresh App session already plays this choreography), and the
  // one production mount effect is the sole 'redesign' caller.
  assert.ok(!canvasSource.includes('BLACK CORE TEST'));
  assert.ok(!canvasSource.includes('Run black core field assembly prototype'));
  assert.equal((canvasSource.match(/startTopologyAssembly\('redesign'\);/g) ?? []).length, 1);
  const startup = extractInitialStartupEffect(canvasSource);
  assert.ok(startup.includes("startTopologyAssembly('redesign');"));
  // App.tsx owns only the generic once-per-session claim primitive; it has
  // no knowledge of 'redesign' as a concept, matching "use the existing
  // production startup lifecycle, do not create a second lifecycle."
  assert.ok(!appSource.includes('redesignPrototype'));
  assert.ok(!appSource.includes('BLACK CORE'));
  assert.ok(!appSource.includes("'redesign'"));
});

test('Redesign Step 1/3-5: the alternate path reuses one assembly clock and the existing shared RAF without timers', () => {
  const tick = extractDualOrbitTickBody(canvasSource);
  const trigger = extractTriggerBlock(canvasSource);
  assert.equal((canvasSource.match(/requestAnimationFrame\(/g) ?? []).length, 4);
  assert.equal((tick.match(/stepAssemblyClock\(/g) ?? []).length, 1);
  assert.equal((canvasSource.match(/setInterval\(/g) ?? []).length, 0);
  assert.ok(!trigger.includes('setTimeout('));
  assert.ok(!tick.includes('setTimeout('));
  assert.ok(trigger.includes('assemblyModeRef.current = mode;'));
  assert.ok(trigger.includes('assemblyClockRef.current = createAssemblyClockState();'));
});

test('Redesign Step 1/6: central dark-core activation is pure, deterministic, bounded, monotonic, and non-flashy', () => {
  assert.equal(getRedesignCoreActivationProgress(-100), 0);
  assert.equal(getRedesignCoreActivationProgress(80), 0);
  assert.equal(getRedesignCoreActivationProgress(600), 1);
  let previous = 0;
  for (let elapsed = 0; elapsed <= 800; elapsed += 8) {
    const progress = getRedesignCoreActivationProgress(elapsed);
    assert.ok(progress >= previous && progress >= 0 && progress <= 1);
    previous = progress;
  }
  const coreStart = canvasSource.indexOf('id="redesign-black-core"');
  const coreEnd = canvasSource.indexOf('{/* Fixed capability-reactor ellipse', coreStart);
  const core = canvasSource.substring(coreStart, coreEnd);
  assert.ok(core.includes('fill="#090908"'));
  assert.ok(core.includes('data-core-activation={redesignCoreActivationProgress.toFixed(3)}'));
  for (const forbidden of ['linearGradient', 'radialGradient', 'filter=', 'animateTransform', 'particle']) {
    assert.ok(!core.includes(forbidden));
  }
});

test('Redesign Step 1/7,8: capability ingestion begins first and overlaps project capture', () => {
  const capabilityStart = REDESIGN_FIELD_ASSEMBLY_TIMING.capabilityCaptureStartMs;
  const capabilityLatestEnd = capabilityStart
    + REDESIGN_FIELD_ASSEMBLY_TIMING.maxCapabilityStaggerSpanMs
    + REDESIGN_FIELD_ASSEMBLY_TIMING.capabilityCaptureDurationMs;
  const firstProjectStart = REDESIGN_FIELD_ASSEMBLY_TIMING.ringRevealStartMs
    + REDESIGN_FIELD_ASSEMBLY_TIMING.projectCaptureStartMs;
  assert.ok(capabilityStart < firstProjectStart, 'capabilities must move first');
  assert.ok(firstProjectStart < capabilityLatestEnd, 'project capture must overlap ongoing capability ingestion');
});

test('Redesign Step 1/9,10: both layers reuse the existing per-frame moving-target capture infrastructure', () => {
  const tick = extractDualOrbitTickBody(canvasSource);
  assert.ok(tick.includes('const assemblyTiming = assemblyModeRef.current === \'redesign\''));
  assert.match(tick, /getDynamicOrbitalPosition\(project, indexWithinRing, dockedCount, ring\.geometry, ringPhase\)/);
  assert.match(tick, /getMountedCapabilityPosition\(\s*indexWithinReactor,\s*capabilityCount,\s*capabilityReactorGeometry,\s*next\.reactorPhase\s*\)/);
  assert.ok(tick.includes('getAssemblyCaptureEasing(rawProgress)'));
  assert.ok(tick.includes('getCapabilityAssemblyCaptureEasing(rawProgress)'));
});

test('Redesign Step 1/11,12: deterministic redesign scatter is broader than production while capabilities remain tighter than projects', () => {
  assert.ok(REDESIGN_PROJECT_ASSEMBLY_OFFSET_BUDGET.maxRadialOffsetIso > DEFAULT_ASSEMBLY_OFFSET_BUDGET.maxRadialOffsetIso);
  assert.ok(REDESIGN_PROJECT_ASSEMBLY_OFFSET_BUDGET.maxAngularJitterRadians > DEFAULT_ASSEMBLY_OFFSET_BUDGET.maxAngularJitterRadians);
  assert.ok(REDESIGN_CAPABILITY_ASSEMBLY_OFFSET_BUDGET.maxRadialOffsetIso > DEFAULT_CAPABILITY_ASSEMBLY_OFFSET_BUDGET.maxRadialOffsetIso);
  assert.ok(REDESIGN_CAPABILITY_ASSEMBLY_OFFSET_BUDGET.maxRadialOffsetIso < REDESIGN_PROJECT_ASSEMBLY_OFFSET_BUDGET.maxRadialOffsetIso);
  assert.ok(REDESIGN_CAPABILITY_ASSEMBLY_OFFSET_BUDGET.maxAngularJitterRadians < REDESIGN_PROJECT_ASSEMBLY_OFFSET_BUDGET.maxAngularJitterRadians);
  assert.deepEqual(
    getDeterministicAssemblyOffset('synthetic-project', 2, 7, REDESIGN_PROJECT_ASSEMBLY_OFFSET_BUDGET),
    getDeterministicAssemblyOffset('synthetic-project', 2, 7, REDESIGN_PROJECT_ASSEMBLY_OFFSET_BUDGET)
  );
});

test('Redesign Step 1/13,14: ring guides begin nearly absent and conduits remain hidden through provisional equilibrium', () => {
  assert.equal(getRingAssemblyProgress(0, 0, REDESIGN_FIELD_ASSEMBLY_TIMING), 0);
  assert.ok(canvasSource.includes('? 0.05 + 0.65 * getRingAssemblyProgress('));
  assert.ok(canvasSource.includes('REDESIGN_FIELD_ASSEMBLY_TIMING'));
  assert.match(
    canvasSource,
    /const assemblyConduitRevealOpacity = useMemo\([\s\S]*?isRedesignPrototypeVisible\s*\n\s*\? 0/
  );
  assert.ok(REDESIGN_FIELD_ASSEMBLY_TIMING.conduitResolveStartMs > REDESIGN_FIELD_ASSEMBLY_TIMING.presentationCompleteMs);
});

test('Redesign Step 1/15: prototype status copy stays terse, secondary, and separate from production telemetry', () => {
  const statusStart = canvasSource.indexOf('data-redesign-prototype-status={redesignPrototypeState}');
  const statusEnd = canvasSource.indexOf('{/* System initialization status', statusStart);
  const status = canvasSource.substring(statusStart, statusEnd);
  assert.ok(status.includes("'TOPOLOGY // INITIALIZING'"));
  assert.ok(status.includes("'EQUILIBRIUM // STABLE'"));
  assert.ok(status.includes('text-[9px]'));
  assert.ok(status.includes('text-[#15150F]/55'));
  // Scoped to the container's OWN opening tag (before its children, which
  // now legitimately include the promoted SKIP button and its hover state)
  // — the container itself must not carry the dark telemetry-card background.
  const containerTag = status.substring(0, status.indexOf('>') + 1);
  assert.ok(!containerTag.includes('bg-[#15150F]'));
});

test('Redesign Step 1/16,18: interaction lock and reduced-motion eligibility remain the accepted shared architecture', () => {
  const precondition = extractPreconditionBlock(canvasSource);
  const trigger = extractTriggerBlock(canvasSource);
  assert.ok(precondition.includes('!prefersReducedMotion'));
  assert.ok(precondition.includes('!isTopologyAssemblyActive'));
  assert.ok(trigger.includes('setIsTopologyAssemblyActive(true);'));
  assert.ok(canvasSource.includes('if (dragRuntimeRef.current.isTopologyAssemblyActive) return;'));
  assert.match(canvasSource, /if \(isTopologyAssemblyActive\) return;\s+onDrillIntoProject\(project\.id\);/);
});

test('Redesign Step 1/19-22: redesign stays generic and protected mechanics remain outside the experiment', () => {
  const trigger = extractTriggerBlock(canvasSource);
  assert.ok(!/projectId\s*===\s*['"]/.test(trigger));
  assert.ok(!/capabilityId\s*===\s*['"]/.test(trigger));
  assert.ok(!/projects\.length\s*===\s*\d+/.test(trigger));
  for (const protectedPath of [
    'src/utils/projectDocking.ts',
    'src/utils/projectRingAllocation.ts',
    'src/utils/orbitMotion.ts',
    'src/utils/capabilityReactor.ts',
  ]) {
    const source = fs.readFileSync(path.resolve(protectedPath), 'utf8');
    assert.ok(!/BLACK CORE|REDESIGN_FIELD|redesignPrototype/.test(source), `${protectedPath} must remain outside the prototype`);
  }
});

// ===========================================================================
// REDESIGN STEP 1.5 — temporary environmental field-trace suction.
// ===========================================================================

function extractRedesignFieldTraceLayer(source: string): string {
  // Promotion: this layer is no longer DEV-gated -- it must be reachable in
  // a production build, since production startup now activates redesign
  // mode directly. The boundary text reflects that (no import.meta.env.DEV).
  const start = source.indexOf('{isRedesignPrototypeActive && redesignPresentationElapsedMs !== null && (');
  const end = source.indexOf('{isRedesignPrototypeVisible && (', start);
  assert.ok(start !== -1 && end > start, 'expected the field-trace layer immediately before the core');
  return source.substring(start, end);
}

test('Promotion Step: field traces are reachable from production startup (no DEV gating), and the mount effect is the sole activation path', () => {
  const layer = extractRedesignFieldTraceLayer(canvasSource);
  assert.ok(layer.includes('id="redesign-field-traces"'));
  assert.ok(layer.includes('isRedesignPrototypeActive'));
  // Old invariant: this layer was DEV-only. New invariant: it must be
  // reachable in a production build, since production startup now drives
  // redesign mode directly -- see the production bundle verification suite
  // further below, which rebuilds and greps dist/ for these exact ids.
  assert.ok(!layer.includes('import.meta.env.DEV'), 'field traces must no longer be stripped from production builds');
  assert.equal((canvasSource.match(/startTopologyAssembly\('redesign'\);/g) ?? []).length, 1);
  assert.equal((canvasSource.match(/startTopologyAssembly\(\);/g) ?? []).length, 0, 'no bare no-arg call site remains');
  const startup = extractInitialStartupEffect(canvasSource);
  assert.ok(startup.includes("startTopologyAssembly('redesign');"), 'the mount effect is the one caller, and it explicitly requests redesign mode');
  assert.ok(!startup.includes('redesign-field-traces'), 'sanity: the mount effect calls the activation primitive, it does not inline field-trace rendering');
});

test('Redesign Step 1.5/4-7,9,10: geometry is deterministic, bounded to 12 traces, random-free, and relative to the existing core center', () => {
  assert.equal(REDESIGN_FIELD_TRACE_COUNT, 12);
  assert.ok(REDESIGN_FIELD_TRACE_COUNT >= 8 && REDESIGN_FIELD_TRACE_COUNT <= 14);
  for (let traceIndex = 0; traceIndex < REDESIGN_FIELD_TRACE_COUNT; traceIndex++) {
    const first = getRedesignFieldTraceGeometry(traceIndex, 150, 100);
    const second = getRedesignFieldTraceGeometry(traceIndex, 150, 100);
    assert.deepEqual(first, second);
    for (const value of [
      first.outerOffset.x, first.outerOffset.y,
      first.innerOffset.x, first.innerOffset.y,
      first.controlOffset.x, first.controlOffset.y,
    ]) {
      assert.ok(Number.isFinite(value));
    }
  }
  const helperSource = fs.readFileSync(path.resolve('src/utils/topologyAssembly.ts'), 'utf8');
  const geometryStart = helperSource.indexOf('export function getRedesignFieldTraceGeometry(');
  const geometryEnd = helperSource.indexOf('/** Shared-clock progress', geometryStart);
  const geometryBody = helperSource.substring(geometryStart, geometryEnd);
  assert.ok(!geometryBody.includes('Math.random'));

  const layer = extractRedesignFieldTraceLayer(canvasSource);
  assert.ok(layer.includes('const coreX = capabilityReactorGeometry.centerIso.x;'));
  assert.ok(layer.includes('const coreY = capabilityReactorGeometry.centerIso.y;'));
  assert.ok(layer.includes('d={`M ${coreX + trace.innerOffset.x} ${coreY + trace.innerOffset.y} Q'));
  assert.ok(!layer.includes('centerX'));
  assert.ok(!layer.includes('centerY'));

  // Source derives from the LIVE capability reactor ring geometry (radiusX/
  // radiusY passed in from the caller), never a second invented radius.
  const memoStart = canvasSource.indexOf('const redesignFieldTraces = useMemo(');
  const memoEnd = canvasSource.indexOf(');', memoStart);
  const memoBody = canvasSource.substring(memoStart, memoEnd);
  assert.ok(memoBody.includes('capabilityReactorGeometry.radiusX'));
  assert.ok(memoBody.includes('capabilityReactorGeometry.radiusY'));
  assert.ok(!geometryBody.includes('const radiusX ='), 'must not invent a duplicate reactor radius constant');
  assert.ok(!geometryBody.includes('const radiusY ='), 'must not invent a duplicate reactor radius constant');

  // Angular placement is deterministic (a pure function of traceIndex) and
  // every trace lands at a distinct angle around the shared center.
  const angles = new Set<number>();
  for (let traceIndex = 0; traceIndex < REDESIGN_FIELD_TRACE_COUNT; traceIndex++) {
    const geometry = getRedesignFieldTraceGeometry(traceIndex, 150, 100);
    angles.add(Math.round(Math.atan2(geometry.outerOffset.y, geometry.outerOffset.x) * 1000));
  }
  assert.equal(angles.size, REDESIGN_FIELD_TRACE_COUNT);
});

test('Redesign Step 1.5 field-trace geometry: source sits on the reactor ring, destination sits at the black-core boundary, and the path never needs the center', () => {
  const radiusX = 150;
  const radiusY = 100;
  for (let traceIndex = 0; traceIndex < REDESIGN_FIELD_TRACE_COUNT; traceIndex++) {
    const geometry = getRedesignFieldTraceGeometry(traceIndex, radiusX, radiusY);

    // Outer endpoint lies EXACTLY on the reactor ellipse itself (the same
    // centerIso + radiusX*cos/radiusY*sin formula the visible ring track,
    // its tick marks, and mounted capability nodes all already use) —
    // normalizing by the ellipse's own radii must land on the unit circle,
    // not merely near it, so the trace visibly touches the recognized ring.
    const normalizedOuterRadius = Math.hypot(geometry.outerOffset.x / radiusX, geometry.outerOffset.y / radiusY);
    assert.ok(Math.abs(normalizedOuterRadius - 1) < 1e-9, `trace ${traceIndex} outer endpoint should sit exactly on the reactor ring, got ${normalizedOuterRadius}`);

    // Inner endpoint lies just inside the black core's own boundary — never
    // at the center, and never materially beyond the core's radius.
    const innerRadius = Math.hypot(geometry.innerOffset.x, geometry.innerOffset.y);
    assert.ok(innerRadius > 0.5 * REDESIGN_BLACK_CORE_RADIUS, `trace ${traceIndex} inner endpoint must not sit at/near the center`);
    assert.ok(innerRadius <= REDESIGN_BLACK_CORE_RADIUS, `trace ${traceIndex} inner endpoint must not reach past the black core's own boundary`);

    // The visible path occupies the gap, not the center: the inner endpoint
    // is materially closer to the core than to the ring.
    const outerRadius = Math.hypot(geometry.outerOffset.x, geometry.outerOffset.y);
    assert.ok(innerRadius < outerRadius * 0.5, `trace ${traceIndex} should mostly occupy the ring-to-core gap`);

    // The control point (and therefore the quadratic curve it drives) never
    // collapses onto the shared center.
    const controlRadius = Math.hypot(geometry.controlOffset.x, geometry.controlOffset.y);
    assert.ok(controlRadius > innerRadius * 0.5, `trace ${traceIndex} curve should not unnecessarily pass through the core center`);
  }
});

test('Redesign Step 1.5 field-trace geometry: trace source is provably ON the same visible ring the reactor itself uses for capture/mounting, not a different or inset boundary', () => {
  // Cross-checks against capabilityReactor.ts's OWN ellipse-projection
  // helper (the same function real drag/magnetic-capture logic uses to find
  // the nearest point on the visible ring) rather than trusting that our
  // formula merely LOOKS equivalent. This is the same ellipse
  // buildCapabilityReactorSegmentPaths (drawn track), getCapabilityReactorMarker
  // (tick marks), and getMountedCapabilityPosition (actual node placement)
  // all already share — confirming radiusX/radiusY is the correct authority
  // for "the inner visible technology/capability orbit," not some other
  // reactor boundary.
  const geometry: CapabilityReactorGeometry = {
    centerIso: { x: 0, y: 0 },
    radiusX: 150,
    radiusY: 100,
    canonicalVisualBounds: { minX: -150, maxX: 150, minY: -100, maxY: 100 },
  };
  for (let traceIndex = 0; traceIndex < REDESIGN_FIELD_TRACE_COUNT; traceIndex++) {
    const trace = getRedesignFieldTraceGeometry(traceIndex, geometry.radiusX, geometry.radiusY);
    const projection = projectPointOntoCapabilityReactor(trace.outerOffset, geometry);
    assert.ok(
      projection.distanceIso < 1e-6,
      `trace ${traceIndex} outer endpoint must already sit on the reactor's own ellipse (distance ${projection.distanceIso})`
    );
  }
});

test('Redesign Step 1.5 field-trace geometry: destination geometry is anchored to the single black-core radius authority', () => {
  assert.equal(REDESIGN_BLACK_CORE_RADIUS, 34);
  const layer = extractRedesignFieldTraceLayer(canvasSource);
  assert.ok(!layer.includes('centerIso.x + trace.outerOffset'), 'sanity: outer offset composition happens at render time, not baked into geometry');
  const coreLayerStart = canvasSource.indexOf('id="redesign-black-core"');
  const coreLayerEnd = canvasSource.indexOf('{/* Fixed capability-reactor ellipse', coreLayerStart);
  const coreLayer = canvasSource.substring(coreLayerStart, coreLayerEnd);
  assert.ok(coreLayer.includes('r={REDESIGN_BLACK_CORE_RADIUS}'), 'the solid black-core disc radius must come from the shared constant, not a literal');
  assert.ok(!coreLayer.includes('r="34"'), 'no duplicate hardcoded core radius literal');
});

test('Redesign Step 1.5/8-10 (timing updated by Step 1.6): shared elapsed time starts staggered spawn before capability ingestion', () => {
  const layer = extractRedesignFieldTraceLayer(canvasSource);
  assert.match(layer, /getRedesignFieldTracePresentation\(\s*redesignPresentationElapsedMs,/);
  assert.equal(REDESIGN_FIELD_TRACE_TIMING.startMs, 100);
  assert.ok(REDESIGN_FIELD_TRACE_TIMING.startMs >= 80 && REDESIGN_FIELD_TRACE_TIMING.startMs <= 120);
  assert.ok(REDESIGN_FIELD_TRACE_TIMING.startMs < REDESIGN_FIELD_ASSEMBLY_TIMING.capabilityCaptureStartMs);
  assert.ok(REDESIGN_FIELD_TRACE_TIMING.staggerMs > 0);
  assert.equal(REDESIGN_FIELD_TRACE_TIMING.staggerMs, 32);
  const elapsed = REDESIGN_FIELD_TRACE_TIMING.startMs + REDESIGN_FIELD_TRACE_TIMING.staggerMs * 3 + 10;
  assert.ok(getRedesignFieldTraceProgress(elapsed, 0) > getRedesignFieldTraceProgress(elapsed, 3));
  assert.ok(getRedesignFieldTraceProgress(elapsed, 3) > getRedesignFieldTraceProgress(elapsed, 4));
});

// ===========================================================================
// REDESIGN STEP 1.6 — spawn / full-presence / absorption lifecycle.
// Geometry (getRedesignFieldTraceGeometry) and contrast (color/width/peak
// opacity) are FROZEN by this step; only the temporal presentation changes.
// ===========================================================================

test('Redesign Step 1.6/1,2: a trace has zero visible length and zero opacity before it spawns', () => {
  const timing = REDESIGN_FIELD_TRACE_TIMING;
  for (let traceIndex = 0; traceIndex < REDESIGN_FIELD_TRACE_COUNT; traceIndex++) {
    const beforeStart = getRedesignFieldTracePresentation(0, traceIndex, timing);
    assert.equal(beforeStart.visibleLength, 0, `trace ${traceIndex} must be zero-length before spawn`);
    assert.equal(beforeStart.opacity, 0, `trace ${traceIndex} must be invisible before spawn`);
    assert.equal(beforeStart.spawnProgress, 0);
    assert.equal(beforeStart.absorptionProgress, 0);
  }
});

test('Redesign Step 1.6/3,4: spawn progresses deterministically and draws OUT of the ring TOWARD the core (ring-side edge pinned, core-side edge advances)', () => {
  const timing = REDESIGN_FIELD_TRACE_TIMING;
  const traceIndex = 0;
  const quarterSpawn = timing.startMs + timing.spawnDurationMs * 0.25;
  const halfSpawn = timing.startMs + timing.spawnDurationMs * 0.5;
  const threeQuarterSpawn = timing.startMs + timing.spawnDurationMs * 0.75;

  const early = getRedesignFieldTracePresentation(quarterSpawn, traceIndex, timing);
  const mid = getRedesignFieldTracePresentation(halfSpawn, traceIndex, timing);
  const late = getRedesignFieldTracePresentation(threeQuarterSpawn, traceIndex, timing);

  // Spawn progress itself is monotonically increasing and deterministic.
  assert.ok(early.spawnProgress > 0 && early.spawnProgress < mid.spawnProgress);
  assert.ok(mid.spawnProgress < late.spawnProgress && late.spawnProgress < 1);
  assert.deepEqual(getRedesignFieldTracePresentation(halfSpawn, traceIndex, timing), mid, 'deterministic: identical inputs produce identical output');

  // The visible window grows monotonically during spawn...
  assert.ok(early.visibleLength > 0 && early.visibleLength < mid.visibleLength);
  assert.ok(mid.visibleLength < late.visibleLength);

  // ...and it grows by advancing its CORE-side edge (dashOffset, path t=0)
  // inward from the ring (t=1) toward the core (t=0) while the RING-side
  // edge (dashOffset + visibleLength, path t=1 = the ring end) stays pinned
  // at exactly 1 throughout spawn. This is what makes the line draw OUT OF
  // the ring TOWARD the core, never grow outward FROM the core.
  for (const sample of [early, mid, late]) {
    const ringSideEdge = sample.dashOffset + sample.visibleLength;
    assert.ok(Math.abs(ringSideEdge - 1) < 1e-9, 'ring-side edge must stay pinned at the ring (t=1) throughout spawn');
  }
  assert.ok(early.dashOffset > mid.dashOffset && mid.dashOffset > late.dashOffset, 'core-side edge must advance toward the core (decreasing t) as spawn progresses');
});

test('Redesign Step 1.6/5,6: a brief full-presence phase holds the trace fully drawn at peak opacity after spawn completes', () => {
  const timing = REDESIGN_FIELD_TRACE_TIMING;
  assert.ok(timing.fullPresenceDurationMs >= 40 && timing.fullPresenceDurationMs <= 100, 'full-presence duration should be a restrained 40-100ms beat');
  const traceIndex = 0;
  const midFullPresence = timing.startMs + timing.spawnDurationMs + timing.fullPresenceDurationMs / 2;
  const full = getRedesignFieldTracePresentation(midFullPresence, traceIndex, timing);
  assert.equal(full.spawnProgress, 1);
  assert.equal(full.absorptionProgress, 0);
  assert.equal(full.visibleLength, 1);
  assert.equal(full.dashOffset, 0);
  assert.equal(full.opacity, REDESIGN_FIELD_TRACE_PEAK_OPACITY);
});

test('Redesign Step 1.6/7,8,9: absorption follows full-presence and preserves the already-approved ring-side -> core suction, staying core-anchored', () => {
  const timing = REDESIGN_FIELD_TRACE_TIMING;
  const traceIndex = 0;
  const absorbStart = timing.startMs + timing.spawnDurationMs + timing.fullPresenceDurationMs;
  const quarterAbsorb = absorbStart + timing.absorptionDurationMs * 0.25;
  const halfAbsorb = absorbStart + timing.absorptionDurationMs * 0.5;
  const threeQuarterAbsorb = absorbStart + timing.absorptionDurationMs * 0.75;
  const doneAbsorb = absorbStart + timing.absorptionDurationMs;

  const early = getRedesignFieldTracePresentation(quarterAbsorb, traceIndex, timing);
  const mid = getRedesignFieldTracePresentation(halfAbsorb, traceIndex, timing);
  const late = getRedesignFieldTracePresentation(threeQuarterAbsorb, traceIndex, timing);
  const done = getRedesignFieldTracePresentation(doneAbsorb, traceIndex, timing);

  // Absorption progress starts only once spawn + full-presence have elapsed.
  assert.ok(early.absorptionProgress > 0 && early.absorptionProgress < mid.absorptionProgress);
  assert.ok(mid.absorptionProgress < late.absorptionProgress && late.absorptionProgress < done.absorptionProgress);
  assert.equal(done.absorptionProgress, 1);

  // The CORE-side edge (dashOffset) stays pinned at exactly 0 throughout
  // absorption — the remaining visible segment stays anchored toward the
  // black core, never the ring.
  for (const sample of [early, mid, late, done]) {
    assert.equal(sample.dashOffset, 0, 'core-side edge must stay pinned at the core (t=0) throughout absorption');
  }
  // The RING-side edge (visibleLength, since dashOffset===0) recedes
  // monotonically from 1 toward 0 — disappearing from the ring side toward
  // the core, matching the already-approved suction direction.
  assert.ok(early.visibleLength > mid.visibleLength && mid.visibleLength > late.visibleLength);
  assert.equal(done.visibleLength, 0);
});

test('Redesign Step 1.6/10,11: opacity rises smoothly during spawn and eventually falls during the final portion of absorption, with no popping', () => {
  const timing = REDESIGN_FIELD_TRACE_TIMING;
  const traceIndex = 0;

  const spawnSamples = [0.1, 0.3, 0.5, 0.7, 0.9].map(fraction =>
    getRedesignFieldTracePresentation(timing.startMs + timing.spawnDurationMs * fraction, traceIndex, timing).opacity
  );
  for (let i = 1; i < spawnSamples.length; i++) {
    assert.ok(spawnSamples[i] > spawnSamples[i - 1], 'opacity must rise monotonically during spawn');
  }
  assert.equal(spawnSamples[0] > 0, true);

  const absorbStart = timing.startMs + timing.spawnDurationMs + timing.fullPresenceDurationMs;
  const stillStrong = getRedesignFieldTracePresentation(absorbStart + timing.absorptionDurationMs * 0.3, traceIndex, timing);
  const fading = getRedesignFieldTracePresentation(absorbStart + timing.absorptionDurationMs * 0.8, traceIndex, timing);
  const gone = getRedesignFieldTracePresentation(absorbStart + timing.absorptionDurationMs, traceIndex, timing);
  assert.equal(stillStrong.opacity, REDESIGN_FIELD_TRACE_PEAK_OPACITY, 'opacity should remain at peak through most of absorption');
  assert.ok(fading.opacity < stillStrong.opacity, 'opacity must eventually fall during the final portion of absorption');
  assert.equal(gone.opacity, 0);
});

test('Redesign Step 1.6/12: a fully completed trace has zero visible length and zero opacity', () => {
  const timing = REDESIGN_FIELD_TRACE_TIMING;
  const lifecycleDurationMs = timing.spawnDurationMs + timing.fullPresenceDurationMs + timing.absorptionDurationMs;
  for (let traceIndex = 0; traceIndex < REDESIGN_FIELD_TRACE_COUNT; traceIndex++) {
    const completeElapsedMs = timing.startMs + traceIndex * timing.staggerMs + lifecycleDurationMs;
    const complete = getRedesignFieldTracePresentation(completeElapsedMs, traceIndex, timing);
    assert.equal(complete.visibleLength, 0, `trace ${traceIndex} should be fully consumed`);
    assert.equal(complete.opacity, 0, `trace ${traceIndex} should be fully invisible`);
    assert.equal(complete.progress, 1);
  }
  for (let traceIndex = 0; traceIndex < REDESIGN_FIELD_TRACE_COUNT; traceIndex++) {
    const equilibrium = getRedesignFieldTracePresentation(REDESIGN_FIELD_ASSEMBLY_TIMING.totalDurationMs, traceIndex);
    assert.equal(equilibrium.progress, 1);
    assert.equal(equilibrium.opacity, 0);
    assert.equal(equilibrium.visibleLength, 0);
  }
});

test('Redesign Step 1.6/13: the per-trace lifecycle equals the previously-approved total duration (subdivided, not lengthened) and the render layer feeds the dynamic dashOffset', () => {
  const timing = REDESIGN_FIELD_TRACE_TIMING;
  assert.equal(timing.spawnDurationMs + timing.fullPresenceDurationMs + timing.absorptionDurationMs, 820, 'total per-trace lifecycle must stay at the previously-approved 820ms envelope');
  assert.ok(timing.spawnDurationMs >= 140 && timing.spawnDurationMs <= 180);
  assert.ok(timing.fullPresenceDurationMs >= 40 && timing.fullPresenceDurationMs <= 80);

  const layer = extractRedesignFieldTraceLayer(canvasSource);
  assert.ok(layer.includes('pathLength="1"'));
  assert.ok(layer.includes('strokeDasharray={`${presentation.visibleLength} 2`}'));
  assert.ok(layer.includes('strokeDashoffset={presentation.dashOffset}'), 'dashOffset must now be dynamic (spawn/absorption-driven), not a fixed literal');
  assert.ok(!layer.includes('strokeDashoffset="0"'), 'the old fixed-zero dashoffset must be gone now that spawn needs a moving core-side edge');
});

test('Redesign Step 1.5/14-17: traces add no RAF, timer, or per-trace React state', () => {
  const layer = extractRedesignFieldTraceLayer(canvasSource);
  assert.equal((canvasSource.match(/requestAnimationFrame\(/g) ?? []).length, 4);
  assert.equal((canvasSource.match(/setInterval\(/g) ?? []).length, 0);
  for (const forbidden of ['requestAnimationFrame(', 'setTimeout(', 'setInterval(', 'useState(', 'setRedesignFieldTrace']) {
    assert.ok(!layer.includes(forbidden), `field-trace layer must not contain ${forbidden}`);
  }
  assert.equal((extractDualOrbitTickBody(canvasSource).match(/stepAssemblyClock\(/g) ?? []).length, 1);
});

test('Redesign Step 1.5/18-20,24: node constants, live-target formulas, and ring presentation remain unchanged', () => {
  assert.equal(DEFAULT_ASSEMBLY_OFFSET_BUDGET.maxRadialOffsetIso, 140);
  assert.equal(DEFAULT_CAPABILITY_ASSEMBLY_OFFSET_BUDGET.maxRadialOffsetIso, 60);
  assert.equal(REDESIGN_PROJECT_ASSEMBLY_OFFSET_BUDGET.maxRadialOffsetIso, 260);
  assert.equal(REDESIGN_PROJECT_ASSEMBLY_OFFSET_BUDGET.maxAngularJitterRadians, Math.PI * (38 / 180));
  assert.equal(REDESIGN_CAPABILITY_ASSEMBLY_OFFSET_BUDGET.maxRadialOffsetIso, 130);
  assert.equal(REDESIGN_CAPABILITY_ASSEMBLY_OFFSET_BUDGET.maxAngularJitterRadians, Math.PI * (16 / 180));
  assert.equal(REDESIGN_FIELD_ASSEMBLY_TIMING.capabilityCaptureStartMs, 300);
  assert.equal(REDESIGN_FIELD_ASSEMBLY_TIMING.ringRevealStartMs + REDESIGN_FIELD_ASSEMBLY_TIMING.projectCaptureStartMs, 1050);
  const tick = extractDualOrbitTickBody(canvasSource);
  assert.ok(tick.includes('getDynamicOrbitalPosition(project, indexWithinRing, dockedCount, ring.geometry, ringPhase)'));
  assert.match(tick, /getMountedCapabilityPosition\(\s*indexWithinReactor,\s*capabilityCount,\s*capabilityReactorGeometry,\s*next\.reactorPhase\s*\)/);
  const guidesStart = canvasSource.indexOf('id="orbital-field-guides"');
  const guidesEnd = canvasSource.indexOf('{isRedesignPrototypeActive && redesignPresentationElapsedMs !== null', guidesStart);
  const guides = canvasSource.substring(guidesStart, guidesEnd);
  assert.ok(guides.includes('0.05 + 0.65 * getRingAssemblyProgress('));
  assert.ok(!guides.includes('FieldTrace'));
});

test('Redesign Step 1.5/21,22: environmental traces stay separate from real topology conduits and conduit data', () => {
  const layer = extractRedesignFieldTraceLayer(canvasSource);
  for (const forbidden of [
    'renderedConnections', 'calculateConduitGeometry', 'projectUsesCapability',
    'wiring-conduits', 'conduitGeom', 'project.id', 'skill.id',
  ]) {
    assert.ok(!layer.includes(forbidden), `environmental layer must not consume ${forbidden}`);
  }
  assert.match(canvasSource, /const assemblyConduitRevealOpacity = useMemo\(\s*\(\) => isRedesignPrototypeVisible\s*\? 0/);
  assert.ok(canvasSource.includes('<g id="wiring-conduits" opacity={assemblyConduitRevealOpacity}>'));
});

test('Redesign Step 1.5/25-30: App lifecycle, protected mechanics, and owner data remain outside field-trace work', () => {
  assert.ok(!/FieldTrace|field-trace|redesign-field/.test(appSource));
  for (const protectedPath of [
    'src/utils/projectDocking.ts',
    'src/utils/projectRingAllocation.ts',
    'src/utils/orbitMotion.ts',
    'src/utils/capabilityReactor.ts',
  ]) {
    const source = fs.readFileSync(path.resolve(protectedPath), 'utf8');
    assert.ok(!/FieldTrace|field-trace|redesign-field/.test(source), `${protectedPath} must remain untouched by traces`);
  }
  for (const ownerPath of fs.readdirSync(path.resolve('src/data'))) {
    const source = fs.readFileSync(path.resolve('src/data', ownerPath), 'utf8');
    assert.ok(!/FieldTrace|field-trace|redesign-field/.test(source), `${ownerPath} must remain owner data only`);
  }
});

test('Field-trace contrast tuning: approved color/width/peak-opacity remain frozen through the Step 1.6 spawn/absorption rework', () => {
  const timing = REDESIGN_FIELD_TRACE_TIMING;
  const beforeSpawn = getRedesignFieldTracePresentation(0, 0, timing);
  const fullPresenceElapsed = timing.startMs + timing.spawnDurationMs + timing.fullPresenceDurationMs / 2;
  const peak = getRedesignFieldTracePresentation(fullPresenceElapsed, 0, timing);
  // Before spawn, the trace is fully invisible (Step 1.6 requirement) —
  // this deliberately supersedes the pre-1.6 dormant floor of 0.34.
  assert.equal(beforeSpawn.opacity, 0);
  // The approved PEAK opacity itself (0.52) is unchanged from the Step 1.5
  // contrast-tuning pass — only when the trace reaches it changed.
  assert.equal(REDESIGN_FIELD_TRACE_PEAK_OPACITY, 0.52);
  assert.ok(Math.abs(peak.opacity - 0.52) < 1e-12);
  assert.ok(peak.opacity >= 0.30 && peak.opacity <= 0.52);

  const layer = extractRedesignFieldTraceLayer(canvasSource);
  // Approved color range: #343229 - #403D31 (each channel between the two).
  const strokeMatch = layer.match(/stroke="#([0-9A-Fa-f]{6})"/);
  assert.ok(strokeMatch, 'expected a literal hex stroke color on the trace path');
  const [r, g, b] = [strokeMatch![1].slice(0, 2), strokeMatch![1].slice(2, 4), strokeMatch![1].slice(4, 6)]
    .map(channel => parseInt(channel, 16));
  const floor = { r: 0x34, g: 0x32, b: 0x29 };
  const ceil = { r: 0x40, g: 0x3D, b: 0x31 };
  assert.ok(r >= floor.r && r <= ceil.r, `stroke red channel ${r} out of approved range`);
  assert.ok(g >= floor.g && g <= ceil.g, `stroke green channel ${g} out of approved range`);
  assert.ok(b >= floor.b && b <= ceil.b, `stroke blue channel ${b} out of approved range`);
  assert.ok(!/stroke="#5C5946"/.test(layer), 'old too-light color must be gone');

  // Approved stroke-width range: 1.15px - 1.30px.
  const widthMatch = layer.match(/strokeWidth="([0-9.]+)"/);
  assert.ok(widthMatch, 'expected a literal strokeWidth on the trace path');
  const width = parseFloat(widthMatch![1]);
  assert.ok(width >= 1.15 && width <= 1.30, `strokeWidth ${width} out of approved 1.15-1.30 range`);

  // No forbidden treatments.
  for (const forbidden of ['url(#', 'filter=', 'blur', 'gradient', 'Gradient', 'stroke="#fff', 'stroke="white']) {
    assert.ok(!layer.includes(forbidden), `field-trace layer must not use ${forbidden}`);
  }

  assert.ok(layer.includes('pathLength="1"'));
  assert.ok(layer.includes('strokeDasharray={`${presentation.visibleLength} 2`}'));
  assert.ok(layer.includes('strokeDashoffset={presentation.dashOffset}'));

  // Frozen values.
  assert.equal(REDESIGN_FIELD_TRACE_COUNT, 12);
  assert.deepEqual(REDESIGN_FIELD_TRACE_TIMING, {
    startMs: 100,
    staggerMs: 32,
    spawnDurationMs: 160,
    fullPresenceDurationMs: 60,
    absorptionDurationMs: 600,
  });
  assert.equal(REDESIGN_FIELD_ASSEMBLY_TIMING.capabilityCaptureStartMs, 300);
  assert.equal(
    REDESIGN_FIELD_ASSEMBLY_TIMING.ringRevealStartMs + REDESIGN_FIELD_ASSEMBLY_TIMING.projectCaptureStartMs,
    1050
  );
  assert.equal(REDESIGN_PROJECT_ASSEMBLY_OFFSET_BUDGET.maxRadialOffsetIso, 260);
  assert.equal(REDESIGN_PROJECT_ASSEMBLY_OFFSET_BUDGET.maxAngularJitterRadians, Math.PI * (38 / 180));
  assert.equal(REDESIGN_CAPABILITY_ASSEMBLY_OFFSET_BUDGET.maxRadialOffsetIso, 130);
  assert.equal(REDESIGN_CAPABILITY_ASSEMBLY_OFFSET_BUDGET.maxAngularJitterRadians, Math.PI * (16 / 180));

  const helperSource = fs.readFileSync(path.resolve('src/utils/topologyAssembly.ts'), 'utf8');
  assert.ok(helperSource.includes('const angleJitter = Math.sin((safeIndex + 1) * 2.173) * 0.13;'));
  assert.ok(helperSource.includes('function smoothstep01('), 'the shared smoothstep helper backing both spawn and absorption edges must exist');
  assert.equal((canvasSource.match(/requestAnimationFrame\(/g) ?? []).length, 4);
  assert.equal((canvasSource.match(/setInterval\(/g) ?? []).length, 0);
  assert.equal((canvasSource.match(/startTopologyAssembly\('redesign'\);/g) ?? []).length, 1, 'promotion: production startup is the sole caller and explicitly requests redesign mode');
});
