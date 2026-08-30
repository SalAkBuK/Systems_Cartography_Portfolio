import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  ACTIVE_ORBIT_RATE_MULTIPLIERS,
  computePhaseDelta,
  isOrbitPauseConditionActive,
  rebaselineDualOrbitClock,
  stepDualOrbitClock,
  stepOrbitRate,
  type DualOrbitClockState,
  type OrbitPauseState,
} from '../src/utils/orbitMotion.ts';

const canvasSource = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');
const initialClock: DualOrbitClockState = {
  projectPhase: 1,
  reactorPhase: 2,
  lastTimestamp: 1_000,
};

test('project and reactor phases advance from one shared frame timestamp in opposite directions', () => {
  const next = stepDualOrbitClock(initialClock, 3_000, true, 1, true, 0.5);
  assert.equal(next.lastTimestamp, 3_000);
  assert.ok(Math.abs(next.projectPhase - (1 + computePhaseDelta(2_000, 1))) < 1e-9);
  assert.ok(Math.abs(next.reactorPhase - (2 - computePhaseDelta(2_000, 0.5))) < 1e-9);
  assert.ok(next.projectPhase > initialClock.projectPhase, 'project phase must advance in its existing positive/CW direction');
  assert.ok(next.reactorPhase < initialClock.reactorPhase, 'reactor phase must advance in the opposite/CCW direction');
});

test('project paused and reactor running holds only the project phase', () => {
  const next = stepDualOrbitClock(initialClock, 3_000, false, 1, true, 0.5);
  assert.equal(next.projectPhase, initialClock.projectPhase);
  assert.ok(next.reactorPhase < initialClock.reactorPhase);
  assert.equal(next.lastTimestamp, 3_000);
});

test('reactor paused and project running holds only the reactor phase', () => {
  const next = stepDualOrbitClock(initialClock, 3_000, true, 1, false, 0.5);
  assert.ok(next.projectPhase > initialClock.projectPhase);
  assert.equal(next.reactorPhase, initialClock.reactorPhase);
  assert.equal(next.lastTimestamp, 3_000);
});

test('both paused holds both phases and clears the shared timestamp baseline', () => {
  const next = stepDualOrbitClock(initialClock, 30_000, false, 1, false, 0.5);
  assert.deepEqual(next, { projectPhase: 1, reactorPhase: 2, lastTimestamp: null });
});

test('resume after a full pause establishes a fresh timestamp without catch-up', () => {
  const paused = stepDualOrbitClock(initialClock, 30_000, false, 1, false, 0.5);
  const resumed = stepDualOrbitClock(paused, 300_000, true, 1, true, 0.5);
  assert.deepEqual(resumed, { projectPhase: 1, reactorPhase: 2, lastTimestamp: 300_000 });
  const next = stepDualOrbitClock(resumed, 300_016, true, 1, true, 0.5);
  assert.ok(Math.abs(next.projectPhase - (1 + computePhaseDelta(16, 1))) < 1e-9);
  assert.ok(Math.abs(next.reactorPhase - (2 - computePhaseDelta(16, 0.5))) < 1e-9);
});

test('machine pause and hidden-document resume cannot charge hidden time to either phase', () => {
  const pauseState: OrbitPauseState = {
    isProjectHovered: false,
    isSkillHovered: false,
    isProjectSelected: false,
    isSkillSelected: false,
    isNodeDragging: false,
    isCanvasPanning: false,
    isDocumentHidden: true,
    prefersReducedMotion: false,
    isCompact: false,
    isExperienceSelected: false,
  };
  assert.equal(isOrbitPauseConditionActive(pauseState), true);
  const hidden = stepDualOrbitClock(initialClock, 50_000, false, 1, false, 0.5);
  const visible = stepDualOrbitClock(hidden, 350_000, true, 1, true, 0.5);
  assert.equal(visible.projectPhase, initialClock.projectPhase);
  assert.equal(visible.reactorPhase, initialClock.reactorPhase);
});

test('dual clock rebaseline preserves both phases exactly', () => {
  assert.deepEqual(rebaselineDualOrbitClock(initialClock), {
    projectPhase: 1,
    reactorPhase: 2,
    lastTimestamp: null,
  });
});

test('dual clock rejects non-finite inputs without NaN or Infinity output', () => {
  const corrupt = stepDualOrbitClock(
    { projectPhase: Number.NaN, reactorPhase: Number.POSITIVE_INFINITY, lastTimestamp: 1_000 },
    Number.NaN,
    true,
    1,
    true,
    0.5
  );
  assert.deepEqual(corrupt, { projectPhase: 0, reactorPhase: 0, lastTimestamp: null });
});

test('128×, 256×, and 512× dual-clock steps stay finite and normalized', () => {
  for (const rate of [128, 256, 512] as const) {
    const next = stepDualOrbitClock(initialClock, 61_000, true, rate, true, rate);
    assert.ok(Number.isFinite(next.projectPhase));
    assert.ok(Number.isFinite(next.reactorPhase));
    assert.ok(next.projectPhase >= 0 && next.projectPhase < Math.PI * 2);
    assert.ok(next.reactorPhase >= 0 && next.reactorPhase < Math.PI * 2);
  }
});

test('either orbit can remain paused at 512× while its peer continues', () => {
  const projectPaused = stepDualOrbitClock(initialClock, 1_016, false, 512, true, 512);
  assert.equal(projectPaused.projectPhase, initialClock.projectPhase);
  assert.notEqual(projectPaused.reactorPhase, initialClock.reactorPhase);

  const reactorPaused = stepDualOrbitClock(initialClock, 1_016, true, 512, false, 512);
  assert.notEqual(reactorPaused.projectPhase, initialClock.projectPhase);
  assert.equal(reactorPaused.reactorPhase, initialClock.reactorPhase);
});

test('nonzero rate ladder reaches and clamps at 512× without wrapping', () => {
  assert.deepEqual(ACTIVE_ORBIT_RATE_MULTIPLIERS, [0.5, 1, 2, 4, 8, 16, 32, 64, 128, 256, 512]);
  assert.equal(stepOrbitRate(0.5, 'decrease'), 0.5);
  assert.equal(stepOrbitRate(64, 'increase'), 128);
  assert.equal(stepOrbitRate(128, 'increase'), 256);
  assert.equal(stepOrbitRate(256, 'increase'), 512);
  assert.equal(stepOrbitRate(512, 'increase'), 512);
  assert.equal(stepOrbitRate(512, 'decrease'), 256);
  assert.equal(stepOrbitRate(1, 'decrease'), 0.5);
  assert.equal(stepOrbitRate(1, 'increase'), 2);
});

test('project and reactor +/- controls update only their own rate state', () => {
  const controls = canvasSource.substring(
    canvasSource.indexOf('id="orbit-rate-controls"'),
    canvasSource.indexOf('System backbone, grid snap')
  );
  const projectRow = controls.substring(controls.indexOf('R02 SYSTEMS'), controls.indexOf('R01 REACTOR'));
  const reactorRow = controls.substring(controls.indexOf('R01 REACTOR'));
  assert.ok(projectRow.includes('setProjectOrbitRateMultiplier'));
  assert.ok(!projectRow.includes('setReactorOrbitRateMultiplier'));
  assert.ok(reactorRow.includes('setReactorOrbitRateMultiplier'));
  assert.ok(!reactorRow.includes('setProjectOrbitRateMultiplier'));
});

test('project PAUSE/RESUME preserves the selected project rate', () => {
  const controls = canvasSource.substring(
    canvasSource.indexOf('id="orbit-rate-controls"'),
    canvasSource.indexOf('System backbone, grid snap')
  );
  const pauseHandlerStart = controls.indexOf("aria-label={isProjectOrbitPaused");
  const pauseHandlerEnd = controls.indexOf('R01 REACTOR', pauseHandlerStart);
  const pauseHandler = controls.substring(pauseHandlerStart, pauseHandlerEnd);
  assert.ok(pauseHandler.includes('setIsProjectOrbitPaused(paused => !paused)'));
  assert.ok(!pauseHandler.includes('setProjectOrbitRateMultiplier'));
});

test('reactor PAUSE/RESUME preserves the selected reactor rate', () => {
  const controls = canvasSource.substring(
    canvasSource.indexOf('R01 REACTOR'),
    canvasSource.indexOf('System backbone, grid snap')
  );
  const pauseHandlerStart = controls.indexOf("aria-label={isReactorOrbitPaused");
  const pauseHandler = controls.substring(pauseHandlerStart);
  assert.ok(pauseHandler.includes('setIsReactorOrbitPaused(paused => !paused)'));
  assert.ok(!pauseHandler.includes('setReactorOrbitRateMultiplier'));
});

test('project docking and moving-frame reflow read only the live project phase', () => {
  for (const marker of [
    'resolveOrbitReflowPositions(',
    'stepOrbitReflow(',
    'const phaseAtRelease = getRingPhaseFromRefs(ring);',
  ]) {
    assert.ok(canvasSource.includes(marker));
  }
  const dockingBlock = canvasSource.substring(
    canvasSource.indexOf('const commitOrbitReflow = useCallback(('),
    canvasSource.indexOf('// Handle Pan & Drag on canvas surface')
  );
  // Adaptive rings: commitOrbitReflow reads each ring's own live phase via
  // getRingPhaseFromRefs (ring 0 == projectOrbitPhaseRef.current exactly;
  // every other ring derives from the shared unwrapped reference) rather
  // than a single global projectOrbitPhaseRef read.
  assert.ok(dockingBlock.includes('getRingPhaseFromRefs'));
  assert.ok(!dockingBlock.includes('reactorOrbitPhase'), 'reactor phase must never enter project docking/reflow math');
});

test('one autonomous RAF chain advances both phases and stops when both are paused', () => {
  const effect = canvasSource.substring(
    canvasSource.indexOf('const dualOrbitClockRef = useRef<DualOrbitClockState>'),
    canvasSource.indexOf('const projectsById')
  );
  assert.ok(effect.includes('if (!isDualOrbitMachineRunning)'));
  assert.equal((effect.match(/requestAnimationFrame\(/g) ?? []).length, 2);
  assert.equal((effect.match(/stepDualOrbitClock\(/g) ?? []).length, 1);
  assert.ok(effect.includes('return () => cancelAnimationFrame(rafId)'));
});

test('reactor motion is phase-driven SVG path/tick motion with no CSS autonomous animation or ellipse rotation', () => {
  const reactor = canvasSource.substring(
    canvasSource.indexOf('id="capability-reactor"'),
    canvasSource.indexOf('Orbital Field Annotations')
  );
  assert.ok(reactor.includes('strokeDashoffset={getCapabilityReactorDashOffset(reactorOrbitPhase)}'));
  assert.ok(reactor.includes('getCapabilityReactorMarker('));
  assert.ok(!reactor.includes('animate-spin'));
  assert.ok(!reactor.includes('transform="rotate('));
  assert.ok(!reactor.includes('@keyframes'));
});
