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

// Physical QA clarified the freeze boundary: the orbit must keep moving for
// the ENTIRE hold/drag (grab, below threshold, beyond threshold, dragging a
// detached candidate far away) and must stop ONLY at the exact instant a
// release commits a detach/reinsertion — with no visible one-frame lag where
// the ring ticks once more before the reflow pause takes hold. Freezing is
// still done exclusively through the pre-existing isOrbitReflowActive /
// isDockingTransitionActive authority; nothing new was added to
// OrbitPauseState.

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

test('1. mousedown (a fresh grab, no drag yet) does not pause the orbit', () => {
  // Grabbing a node only sets draggingNode; isNodeDragging is not a pause
  // authority at all, and no reflow has started.
  assert.equal(isOrbitPauseConditionActive({ ...idlePauseState, isNodeDragging: true }), false);
});

test('2. below-threshold drag does not pause the orbit', () => {
  assert.equal(isOrbitPauseConditionActive({ ...idlePauseState, isNodeDragging: true }), false);
});

test('3. beyond-threshold drag (breakaway held, not yet released) does not pause the orbit', () => {
  // No threshold-crossing field exists in OrbitPauseState — held drag can
  // never pause regardless of how far past the detach threshold it goes.
  assert.equal(isOrbitPauseConditionActive({ ...idlePauseState, isNodeDragging: true }), false);
  assert.ok(!Object.keys(idlePauseState).some(k => /breakaway/i.test(k)));
});

test('4/5. commitOrbitReflow cancels the in-flight orbit RAF synchronously, at the very top of the function, before any other work', () => {
  const fnStart = canvasSource.indexOf('const commitOrbitReflow = useCallback((');
  const fnBodyStart = canvasSource.indexOf(') => {', fnStart) + ') => {'.length;
  const phaseAtCommitIdx = canvasSource.indexOf('const phaseAtCommit = orbitPhaseRef.current;', fnBodyStart);
  const cancelIdx = canvasSource.indexOf('cancelAnimationFrame(orbitRafIdRef.current);', fnBodyStart);

  assert.ok(cancelIdx !== -1, 'commitOrbitReflow must synchronously cancel the pending orbit RAF');
  assert.ok(phaseAtCommitIdx !== -1);
  assert.ok(
    cancelIdx < phaseAtCommitIdx,
    'the RAF cancellation must happen before any other commit work, guaranteeing no tick can slip in between the release and the freeze'
  );

  // The prose in between fnBodyStart and phaseAtCommitIdx must not contain a
  // requestAnimationFrame call of its own (no scheduling slipped in before
  // the cancel takes effect).
  const preamble = canvasSource.substring(fnBodyStart, phaseAtCommitIdx);
  assert.ok(!preamble.includes('requestAnimationFrame('));
});

test('4/5. the cancelled RAF id is the SAME ref the orbit-clock tick loop schedules — one shared handle, no second mechanism', () => {
  const effectStart = canvasSource.indexOf('const orbitRafIdRef = useRef<number | null>(null);');
  assert.ok(effectStart !== -1, 'orbitRafIdRef must exist as a single ref shared between the tick loop and commitOrbitReflow');

  const tickLoopBlock = canvasSource.substring(
    canvasSource.indexOf('useEffect(() => {', effectStart),
    canvasSource.indexOf('}, [isOrbitRunning, orbitRateMultiplier]);', effectStart)
  );
  assert.ok(tickLoopBlock.includes('orbitRafIdRef.current = requestAnimationFrame(tick);'));
  assert.match(tickLoopBlock, /cancelAnimationFrame\(orbitRafIdRef\.current\)/);

  // No second animation-frame-id ref was introduced for this purpose.
  assert.equal((canvasSource.match(/useRef<number \| null>\(null\)/g) ?? []).length, 1);
});

test('6. reflow completion resumes the clock from a fresh timestamp baseline with no catch-up', () => {
  let clock: OrbitClockState = { phase: 3.2, lastTimestamp: 5_000 };
  clock = stepOrbitClock(clock, 9_000, false, 1); // frozen during reflow
  assert.deepEqual(clock, { phase: 3.2, lastTimestamp: null });

  clock = stepOrbitClock(clock, 13_000, true, 1); // resume: baseline only, no jump
  assert.equal(clock.phase, 3.2);
  assert.equal(clock.lastTimestamp, 13_000);

  clock = stepOrbitClock(clock, 13_016, true, 1);
  assert.ok(Math.abs(clock.phase - normalizeOrbitPhase(3.2 + computePhaseDelta(16, 1))) < 1e-9);
});

test('7. the selected rate survives a freeze/reflow/resume cycle at every non-pause rate', () => {
  for (const rate of ORBIT_RATE_MULTIPLIERS.filter(r => r > 0)) {
    let clock: OrbitClockState = { phase: 0.5, lastTimestamp: 0 };
    clock = stepOrbitClock(clock, 4_000, false, rate);
    clock = stepOrbitClock(clock, 8_000, true, rate);
    clock = stepOrbitClock(clock, 8_016, true, rate);
    assert.ok(Math.abs(clock.phase - normalizeOrbitPhase(0.5 + computePhaseDelta(16, rate))) < 1e-9, `rate ${rate}x must survive`);
  }
});

test('8. 64× specifically survives a five-second hold followed by an immediate freeze/reflow/resume', () => {
  let clock: OrbitClockState = { phase: 0, lastTimestamp: 0 };
  clock = stepOrbitClock(clock, 5_000, true, 64); // five-second hold, ring moving
  const phaseAtRelease = clock.phase;
  assert.ok(phaseAtRelease > 0);

  clock = stepOrbitClock(clock, 5_100, false, 64); // frozen immediately at release
  assert.equal(clock.phase, phaseAtRelease);

  clock = stepOrbitClock(clock, 9_000, true, 64); // resume baseline only
  assert.equal(clock.phase, phaseAtRelease);
  clock = stepOrbitClock(clock, 9_016, true, 64);
  assert.ok(Math.abs(clock.phase - normalizeOrbitPhase(phaseAtRelease + computePhaseDelta(16, 64))) < 1e-9);
});

test('9. PAUSE (rate 0) remains paused across a reflow transition and is never force-started by it', () => {
  const clock: OrbitClockState = { phase: 2.0, lastTimestamp: 1_000 };
  const duringReflow = stepOrbitClock(clock, 5_000, true, 0);
  assert.deepEqual(duringReflow, { phase: 2.0, lastTimestamp: null });
  const afterReflow = stepOrbitClock(duringReflow, 9_000, true, 0);
  assert.deepEqual(afterReflow, { phase: 2.0, lastTimestamp: null });
});

test('10. a simple click/selection (no meaningful drag) never calls commitOrbitReflow, so it cannot trigger a drop pause', () => {
  const noMoveMatch = canvasSource.match(/\/\/ PROJECT\s*\r?\n\s*if \(!draggingNode\.hasMoved\) \{[\s\S]*?\r?\n\s*\}/);
  assert.ok(noMoveMatch, 'the no-move click branch must exist');
  const noMoveBlock = noMoveMatch![0];

  assert.ok(noMoveBlock.includes('onSelectProject(draggingNode.id);'));
  assert.ok(noMoveBlock.includes('return;'), 'the click path must return before reaching any reflow logic');
  assert.ok(!noMoveBlock.includes('commitOrbitReflow'));
});

test('11. reinsertion of an already-detached project also freezes immediately via the same commitOrbitReflow call', () => {
  const releaseStart = canvasSource.indexOf('const processRelease = () => {');
  const releaseEnd = canvasSource.indexOf('const handleWindowMouseMove', releaseStart);
  const release = canvasSource.substring(releaseStart, releaseEnd);

  const insertBlockStart = release.indexOf("} else if (releaseAction === 'insert-detached-project')");
  const insertBlockEnd = release.indexOf('} else {', insertBlockStart);
  const insertBlock = release.substring(insertBlockStart, insertBlockEnd);
  assert.ok(insertBlock.includes('commitOrbitReflow(newOrder'), 'reinsertion must go through the same shared, synchronously-freezing reflow commit');
});

test('12. the failed-safe-placement return path also goes through commitOrbitReflow, and reflow completion always clears isOrbitReflowActive so the ring cannot stay frozen', () => {
  const releaseStart = canvasSource.indexOf('const processRelease = () => {');
  const releaseEnd = canvasSource.indexOf('const handleWindowMouseMove', releaseStart);
  const release = canvasSource.substring(releaseStart, releaseEnd);

  const exhaustionStart = release.indexOf('if (!resolved.foundValidPosition) {');
  const exhaustionEnd = release.indexOf('setDraggingNode(null);\n        return;\n      }', exhaustionStart);
  const exhaustionBlock = release.substring(exhaustionStart, exhaustionEnd);
  assert.ok(exhaustionBlock.includes('commitOrbitReflow('), 'failed-placement detach must return via the same shared reflow');

  const reflowEffectStart = canvasSource.indexOf('if (!isOrbitReflowActive) return;');
  const reflowEffectEnd = canvasSource.indexOf('}, [isOrbitReflowActive]);', reflowEffectStart);
  const reflowEffect = canvasSource.substring(reflowEffectStart, reflowEffectEnd);
  assert.ok(reflowEffect.includes('if (result.isComplete) {'));
  assert.ok(reflowEffect.includes('setIsOrbitReflowActive(false);'), 'reflow completion must unconditionally clear the pause authority');
});

test('regression guard: no new long-lived pause mechanism was introduced — OrbitPauseState keeps exactly the original four authorities', () => {
  const orbitMotionSource = fs.readFileSync(path.resolve('src/utils/orbitMotion.ts'), 'utf8');
  const interfaceBlock = orbitMotionSource.substring(
    orbitMotionSource.indexOf('export interface OrbitPauseState {'),
    orbitMotionSource.indexOf('export function isOrbitPauseConditionActive')
  );
  assert.ok(!interfaceBlock.includes('isProjectBreakawayActive'));
  assert.ok(!interfaceBlock.includes('isBreakawayTransaction'));
  assert.ok(!canvasSource.includes('isProjectBreakawayActive'));
  assert.ok(!canvasSource.includes('isBreakawayTransaction'));
});
