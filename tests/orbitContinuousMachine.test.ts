import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  ORBIT_RATE_MULTIPLIERS,
  computePhaseDelta,
  isOrbitPauseConditionActive,
  normalizeOrbitPhase,
  stepOrbitClock,
  type OrbitClockState,
  type OrbitPauseState,
} from '../src/utils/orbitMotion.ts';
import {
  buildOrbitReflowPlan,
  stepOrbitReflow,
  ORBIT_REFLOW_DURATION_MS,
  type OrbitReflowTransition,
} from '../src/utils/projectDocking.ts';

// Final correction: "continuous machine means continuous even on drop." The
// autonomous orbit must NEVER stop for a detach/reinsertion — not on grab,
// not on crossing the detach threshold, not on the release that commits the
// detach, and not for the 18<->17 reflow that follows. Only isDocumentHidden,
// prefersReducedMotion, isCompact, and explicit user PAUSE (rate 0) may ever
// stop it. This requires the reflow's own targets to be evaluated against
// the CURRENT live phase every frame (see projectDocking.ts's moving-frame
// plan/endpoint machinery) rather than a frozen snapshot — otherwise a
// continuously-advancing phase would produce a visible jump at handoff.

const idlePauseState: OrbitPauseState = {
  isProjectHovered: false,
  isSkillHovered: false,
  isProjectSelected: false,
  isSkillSelected: false,
  isNodeDragging: false,
  isCanvasPanning: false,
  isDocumentHidden: false,
  prefersReducedMotion: false,
  isCompact: false,
  isExperienceSelected: false,
};

const canvasSource = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');

test('OrbitPauseState no longer has any reflow/docking-transition field — a committed detach/reinsertion cannot pause the orbit even in principle', () => {
  assert.ok(!('isDockingTransitionActive' in idlePauseState));
  assert.equal(isOrbitPauseConditionActive(idlePauseState), false);
  const onlyAuthorities: Array<keyof OrbitPauseState> = ['isDocumentHidden', 'prefersReducedMotion', 'isCompact'];
  for (const field of onlyAuthorities) {
    assert.equal(isOrbitPauseConditionActive({ ...idlePauseState, [field]: true }), true, `${field} must still pause`);
  }
  for (const field of Object.keys(idlePauseState) as Array<keyof OrbitPauseState>) {
    if (onlyAuthorities.includes(field)) continue;
    assert.equal(isOrbitPauseConditionActive({ ...idlePauseState, [field]: true }), false, `${field} must remain a non-authority`);
  }
});

test('1. a docked project drag (below or beyond the detach threshold) keeps phase advancing — dragging is not modeled in OrbitPauseState at all', () => {
  let clock: OrbitClockState = { phase: 0, lastTimestamp: 0 };
  // Simulate a multi-second hold/drag: isRunning stays true throughout,
  // because nothing about a drag ever appears in OrbitPauseState.
  for (const t of [200, 800, 1600, 3000, 5000]) {
    clock = stepOrbitClock(clock, t, true, 1);
  }
  assert.ok(clock.phase > 0, 'phase must have advanced across the entire simulated drag');
});

test('2. a valid detach release keeps phase advancing — the orbit clock effect is not keyed on isOrbitReflowActive', () => {
  const effectStart = canvasSource.indexOf('useEffect(() => {', canvasSource.indexOf('const dualOrbitClockRef = useRef<DualOrbitClockState>'));
  const effectEnd = canvasSource.indexOf('const projectsById', effectStart);
  const orbitClockEffect = canvasSource.substring(effectStart, effectEnd);
  assert.ok(!orbitClockEffect.includes('isOrbitReflowActive'), 'the autonomous orbit RAF effect must not depend on reflow state in any way');

  const pauseStateStart = canvasSource.indexOf('const orbitPauseState: OrbitPauseState = useMemo(');
  const pauseStateBlock = canvasSource.substring(pauseStateStart, canvasSource.indexOf('}), [', pauseStateStart));
  assert.ok(!pauseStateBlock.includes('isOrbitReflowActive'), 'orbitPauseState must not read isOrbitReflowActive at all');
});

test('3. an 18->17 detach reflow occurs while phase keeps advancing: reflow progress and live phase change independently across the same tick sequence', () => {
  const previous = Array.from({ length: 18 }, (_, i) => `p${i}`);
  const next = previous.filter(id => id !== 'p5'); // 18 -> 17
  const plan = buildOrbitReflowPlan(previous, next, {});
  const geometry = { centerIso: { x: 0, y: 0 }, radiusX: 120, radiusY: 80 };
  const project = {};
  const transition: OrbitReflowTransition = { plan, durationMs: ORBIT_REFLOW_DURATION_MS, startTimestamp: 0 };

  let clock: OrbitClockState = { phase: 0, lastTimestamp: 0 };
  const progressSamples: number[] = [];
  const phaseSamples: number[] = [];
  for (const t of [0, 50, 100, 150, 220, 260]) {
    clock = stepOrbitClock(clock, t, true, 4);
    const step = stepOrbitReflow(transition, t, clock.phase, geometry, () => project);
    progressSamples.push(step.progress);
    phaseSamples.push(clock.phase);
  }
  assert.ok(new Set(phaseSamples).size > 1, 'live phase must keep changing across the reflow window');
  assert.ok(new Set(progressSamples).size > 1, 'reflow progress must independently advance across the same window');
  assert.equal(progressSamples[progressSamples.length - 1], 1, 'reflow must reach completion within its own duration regardless of phase');
});

test('4. no handoff jump at reflow completion at any live phase (cross-reference: full proof lives in projectDocking.test.ts)', () => {
  const previous = ['a', 'b', 'c'];
  const next = ['a', 'c']; // detach
  const plan = buildOrbitReflowPlan(previous, next, {});
  const geometry = { centerIso: { x: 0, y: 0 }, radiusX: 100, radiusY: 60 };
  const project = {};
  const transition: OrbitReflowTransition = { plan, durationMs: ORBIT_REFLOW_DURATION_MS, startTimestamp: 0 };
  const atCompletion = stepOrbitReflow(transition, ORBIT_REFLOW_DURATION_MS + 5, 2.0, geometry, () => project);
  const justAfter = stepOrbitReflow(transition, ORBIT_REFLOW_DURATION_MS + 500, 2.0, geometry, () => project);
  assert.deepEqual(atCompletion.positions, justAfter.positions, 'positions at/after completion, same phase, must be identical — no drift once complete');
});

test('5. a reinsertion (17->18) reflow also occurs while phase advances, and both call sites pass the pre-update docked order as previousOrder', () => {
  const previous = Array.from({ length: 17 }, (_, i) => `p${i}`);
  const next = [...previous.slice(0, 5), 'new', ...previous.slice(5)]; // reinsert at index 5
  const plan = buildOrbitReflowPlan(previous, next, { new: { x: 999, y: 999 } });
  assert.deepEqual(plan.new.from, { kind: 'fixed', position: { x: 999, y: 999 } });
  assert.deepEqual(plan.new.to, { kind: 'slot', index: 5, count: 18 });

  const releaseStart = canvasSource.indexOf('const processRelease = () => {');
  const releaseEnd = canvasSource.indexOf('const handleWindowMouseMove', releaseStart);
  const release = canvasSource.substring(releaseStart, releaseEnd);
  const insertBlockStart = release.indexOf("} else if (releaseAction === 'insert-detached-project')");
  const insertBlockEnd = release.indexOf('} else {', insertBlockStart);
  const insertBlock = release.substring(insertBlockStart, insertBlockEnd);
  assert.match(insertBlock, /commitOrbitReflow\(\s*dockedOrbitOrder,\s*newOrder,/, 'reinsertion must pass the OLD (pre-insert) docked order as previousOrder');
});

test('6. 64x keeps advancing continuously through a full reflow window with no special-casing', () => {
  let clock: OrbitClockState = { phase: 0, lastTimestamp: 0 };
  for (const t of [0, 50, 110, 220, 500]) {
    clock = stepOrbitClock(clock, t, true, 64);
  }
  const expected = normalizeOrbitPhase(computePhaseDelta(500, 64));
  assert.ok(Math.abs(clock.phase - expected) < 1e-6, '64x must advance by the exact same formula whether or not a reflow happens to be running concurrently');
});

test('7. PAUSE (rate 0) still freezes everything, and nothing in the reflow path can force-start it', () => {
  const clock: OrbitClockState = { phase: 1.5, lastTimestamp: 1000 };
  const paused = stepOrbitClock(clock, 5000, true, 0);
  assert.deepEqual(paused, { phase: 1.5, lastTimestamp: null });

  const commitStart = canvasSource.indexOf('const commitOrbitReflow = useCallback((');
  const commitEnd = canvasSource.indexOf('// The ONE short-lived orbital reflow RAF loop', commitStart);
  const commit = canvasSource.substring(commitStart, commitEnd);
  assert.ok(!commit.includes('setProjectOrbitRateMultiplier'), 'reflow commit must never change the project rate');
  assert.ok(!commit.includes('setReactorOrbitRateMultiplier'), 'reflow commit must never change the reactor rate');
  assert.ok(!commit.includes('setIsResumeReady'), 'reflow commit must never touch the resume-delay state');
});

test('sanity: reduced motion / compact / hidden document remain authoritative pause conditions, unaffected by this change', () => {
  assert.equal(isOrbitPauseConditionActive({ ...idlePauseState, prefersReducedMotion: true }), true);
  assert.equal(isOrbitPauseConditionActive({ ...idlePauseState, isCompact: true }), true);
  assert.equal(isOrbitPauseConditionActive({ ...idlePauseState, isDocumentHidden: true }), true);
});

test('sanity: ORBIT_RATE_MULTIPLIERS exposes 512x as the hard ceiling', () => {
  assert.equal(ORBIT_RATE_MULTIPLIERS[ORBIT_RATE_MULTIPLIERS.length - 1], 512);
});
