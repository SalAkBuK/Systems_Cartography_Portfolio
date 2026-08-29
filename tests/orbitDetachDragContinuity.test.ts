import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  ORBIT_RATE_MULTIPLIERS,
  computePhaseDelta,
  isOrbitPauseConditionActive,
  normalizeOrbitPhase,
  rebaselineOrbitClock,
  stepOrbitClock,
  type OrbitClockState,
  type OrbitPauseState,
} from '../src/utils/orbitMotion.ts';

// Regression coverage for a corrected requirement: an earlier draft of PR24
// froze the autonomous orbit the instant a docked project crossed the
// magnetic detach threshold mid-drag. Physical QA found that this reads as
// "the machine stops the moment you touch a block" — wrong. The orbit must
// keep moving through the ENTIRE drag gesture, below or beyond the detach
// threshold, already-detached or not. Only the shared reflow that a
// COMMITTED detach/reinsertion triggers may pause the ring — exactly the
// pre-existing isDockingTransitionActive authority, nothing new.

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
  isDockingTransitionActive: false,
};

const canvasSource = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');
const orbitMotionSource = fs.readFileSync(path.resolve('src/utils/orbitMotion.ts'), 'utf8');

test('1. a docked project drag below the detach threshold does not pause the orbit', () => {
  assert.equal(isOrbitPauseConditionActive({ ...idlePauseState, isNodeDragging: true }), false);
});

test('2. a docked project drag that crosses the detach threshold STILL does not pause the orbit', () => {
  // There is no threshold-crossing field in OrbitPauseState at all — crossing
  // the threshold has zero effect on pause eligibility, by construction.
  assert.equal(isOrbitPauseConditionActive({ ...idlePauseState, isNodeDragging: true }), false);
  assert.equal(Object.keys(idlePauseState).some(k => k.toLowerCase().includes('breakaway')), false);
});

test('regression guard: OrbitPauseState exposes exactly the original four machine-level authorities, no breakaway field', () => {
  const interfaceBlock = orbitMotionSource.substring(
    orbitMotionSource.indexOf('export interface OrbitPauseState {'),
    orbitMotionSource.indexOf('export function isOrbitPauseConditionActive')
  );
  assert.ok(!interfaceBlock.includes('isProjectBreakawayActive'), 'a docked-project breakaway must not exist as a pause authority');
  assert.ok(!interfaceBlock.includes('isBreakawayTransaction'));

  const predicateBlock = orbitMotionSource.substring(
    orbitMotionSource.indexOf('export function isOrbitPauseConditionActive'),
  );
  const predicateBody = predicateBlock.substring(0, predicateBlock.indexOf('\n}') + 2);
  assert.ok(predicateBody.includes('state.isDocumentHidden'));
  assert.ok(predicateBody.includes('state.prefersReducedMotion'));
  assert.ok(predicateBody.includes('state.isCompact'));
  assert.ok(predicateBody.includes('state.isDockingTransitionActive'));
  assert.ok(!predicateBody.includes('Breakaway'));
});

test('regression guard: TopologyCanvas never wires detach-threshold crossing into any pause/orbit-clock state', () => {
  assert.ok(!canvasSource.includes('isBreakawayTransaction'));
  assert.ok(!canvasSource.includes('isProjectBreakawayActive'));

  // crossedDetachThreshold must remain purely about drag/capture math, never
  // read by the orbit pause memo or the orbit clock effect.
  const pauseStateBlock = canvasSource.substring(
    canvasSource.indexOf('// One ring, one phase, one pause state'),
    canvasSource.indexOf('const isPauseConditionActive')
  );
  assert.ok(!pauseStateBlock.includes('crossedDetachThreshold'));
});

test('3. a committed detach release still pauses the orbit through the existing shared reflow authority', () => {
  assert.equal(isOrbitPauseConditionActive({ ...idlePauseState, isDockingTransitionActive: true }), true);
  assert.ok(canvasSource.includes('isDockingTransitionActive: Boolean(isOrbitReflowActive),'));
});

test('4. reflow finishing resumes the clock from a fresh timestamp baseline with no catch-up', () => {
  let clock: OrbitClockState = { phase: 3.2, lastTimestamp: 5_000 };
  // Reflow begins: orbit pauses (isRunning false), any further elapsed time must not accumulate.
  clock = stepOrbitClock(clock, 9_000, false, 1);
  assert.deepEqual(clock, { phase: 3.2, lastTimestamp: null });

  // Reflow ends 4 seconds later; the ring is running again but the first
  // frame only establishes the new baseline — it must not apply the 4s gap.
  clock = stepOrbitClock(clock, 13_000, true, 1);
  assert.equal(clock.phase, 3.2, 'first running frame after reflow must not charge the paused interval');
  assert.equal(clock.lastTimestamp, 13_000);

  clock = stepOrbitClock(clock, 13_016, true, 1);
  assert.ok(Math.abs(clock.phase - normalizeOrbitPhase(3.2 + computePhaseDelta(16, 1))) < 1e-9);
});

test('5. 64× is preserved through a freeze/reflow/resume cycle', () => {
  let clock: OrbitClockState = { phase: 1.1, lastTimestamp: 0 };
  clock = stepOrbitClock(clock, 4_000, false, 64); // reflow pause
  assert.equal(clock.phase, 1.1);
  clock = stepOrbitClock(clock, 9_000, true, 64); // resume: baseline only
  assert.equal(clock.phase, 1.1);
  clock = stepOrbitClock(clock, 9_016, true, 64);
  assert.ok(Math.abs(clock.phase - normalizeOrbitPhase(1.1 + computePhaseDelta(16, 64))) < 1e-9);
});

test('6. PAUSE (rate 0) remains paused across a reflow transition', () => {
  const clock: OrbitClockState = { phase: 2.0, lastTimestamp: 1_000 };
  const duringReflow = stepOrbitClock(clock, 5_000, true, 0);
  assert.deepEqual(duringReflow, { phase: 2.0, lastTimestamp: null }, 'rate 0 holds phase regardless of reflow state');
  const afterReflow = stepOrbitClock(duringReflow, 9_000, true, 0);
  assert.deepEqual(afterReflow, { phase: 2.0, lastTimestamp: null }, 'still paused after reflow settles');
});

test('7. no path resets orbit phase to canonical zero except ASSEMBLE/RESET', () => {
  const resetCalls = canvasSource.match(/resetOrbitPhaseToCanonical\(\);/g) ?? [];
  assert.equal(resetCalls.length, 1);
  assert.ok(canvasSource.includes('const restoreCanonicalDockMembership = useCallback(() => {'));

  const releaseStart = canvasSource.indexOf('const processRelease = () => {');
  const releaseEnd = canvasSource.indexOf('const handleWindowMouseMove', releaseStart);
  const release = canvasSource.substring(releaseStart, releaseEnd);
  assert.ok(!release.includes('resetOrbitPhaseToCanonical'));
  assert.ok(!release.includes('setOrbitPhase(0)'));
});

test('rebaseline architecture is reused everywhere — no second clock', () => {
  assert.equal((canvasSource.match(/orbitClockRef\s*=\s*useRef/g) ?? []).length, 1);
});

test('sanity: ORBIT_RATE_MULTIPLIERS still exposes 64× as the ceiling', () => {
  assert.equal(ORBIT_RATE_MULTIPLIERS[ORBIT_RATE_MULTIPLIERS.length - 1], 64);
});
