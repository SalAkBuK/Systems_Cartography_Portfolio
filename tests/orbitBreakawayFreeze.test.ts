import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  isOrbitPauseConditionActive,
  type OrbitPauseState,
} from '../src/utils/orbitMotion.ts';

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
  isProjectBreakawayActive: false,
};

const canvasSource = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');

test('1. a docked project below the detach threshold keeps the orbit pause condition inactive', () => {
  const state = { ...idlePauseState, isNodeDragging: true, isProjectBreakawayActive: false };
  assert.equal(isOrbitPauseConditionActive(state), false, 'below-threshold drag must not pause');
});

test('2. a docked project crossing the detach threshold activates the pause condition', () => {
  const state = { ...idlePauseState, isNodeDragging: true, isProjectBreakawayActive: true };
  assert.equal(isOrbitPauseConditionActive(state), true, 'breakaway must pause the orbit');
});

test('3. isProjectBreakawayActive is one of exactly the five machine-level pause authorities', () => {
  const requiredPauseFields: Array<keyof OrbitPauseState> = [
    'isDockingTransitionActive',
    'isCompact',
    'prefersReducedMotion',
    'isDocumentHidden',
    'isProjectBreakawayActive',
  ];

  for (const field of requiredPauseFields) {
    assert.equal(isOrbitPauseConditionActive({ ...idlePauseState, [field]: true }), true, `${field} must still pause`);
  }

  const nonAuthorities: Array<keyof OrbitPauseState> = [
    'isProjectHovered', 'isSkillHovered', 'isProjectSelected', 'isSkillSelected',
    'isNodeDragging', 'isCanvasPanning', 'isExperienceSelected',
  ];
  for (const field of nonAuthorities) {
    assert.equal(isOrbitPauseConditionActive({ ...idlePauseState, [field]: true }), false, `${field} must remain a non-authority`);
  }
});

test('4/9. the breakaway pause authority is derived only from draggingNode.isBreakawayTransaction on a project', () => {
  const stateBlock = canvasSource.substring(
    canvasSource.indexOf('// One ring, one phase, one pause state'),
    canvasSource.indexOf('const isPauseConditionActive')
  );
  assert.match(
    stateBlock,
    /isProjectBreakawayActive:\s*Boolean\(\s*draggingNode\?\.type === 'project' && draggingNode\.isBreakawayTransaction\s*\)/,
    'orbitPauseState must derive isProjectBreakawayActive strictly from draggingNode.isBreakawayTransaction on a project'
  );
});

test('5/10. mousedown handlers never set isBreakawayTransaction true at gesture start (already-detached grabs must not freeze)', () => {
  const mouseDownBlocks = [...canvasSource.matchAll(/setDraggingNode\(\{[\s\S]*?\}\);/g)]
    .map(m => m[0])
    .filter(block => block.includes("type: 'project'"));

  assert.ok(mouseDownBlocks.length >= 2, 'expected both project onMouseDown and onTouchStart handlers');
  for (const block of mouseDownBlocks) {
    assert.ok(
      !block.includes('isBreakawayTransaction'),
      'gesture-start draggingNode must never explicitly set isBreakawayTransaction, regardless of persisted dock state'
    );
  }
});

test('6. isBreakawayTransaction is set true ONLY inside the first-time detach-crossing branch, sticky thereafter', () => {
  const moveBlockStart = canvasSource.indexOf("if (!crossedDetachThreshold) {");
  const moveBlockEnd = canvasSource.indexOf('// Magnetic capture preview', moveBlockStart);
  const moveBlock = canvasSource.substring(moveBlockStart, moveBlockEnd);

  assert.ok(moveBlock.includes('crossedDetachThreshold = true;'));
  assert.ok(moveBlock.includes('isBreakawayTransaction = true;'));
  // The crossing branch is only reachable when crossedDetachThreshold started
  // false, which never happens for an already-persisted-detached project
  // (its mousedown seeds crossedDetachThreshold: true).
  assert.ok(
    canvasSource.includes('let isBreakawayTransaction = prev.isBreakawayTransaction ?? false;'),
    'isBreakawayTransaction must carry over sticky across frames like crossedDetachThreshold'
  );

  assert.match(
    canvasSource,
    /return \{\s*\.\.\.prev,\s*crossedDetachThreshold,\s*isBreakawayTransaction,/,
    'the per-frame draggingNode update must persist isBreakawayTransaction alongside crossedDetachThreshold'
  );
});

test('7/8. release paths never reset orbit phase to canonical zero for detach/reflow/cancel', () => {
  const releaseStart = canvasSource.indexOf('const processRelease = () => {');
  const releaseEnd = canvasSource.indexOf('const handleWindowMouseMove', releaseStart);
  const release = canvasSource.substring(releaseStart, releaseEnd);

  assert.ok(!release.includes('resetOrbitPhaseToCanonical'), 'no release path may snap the ring back to phase 0');
  assert.ok(!release.includes('setOrbitPhase(0)'), 'no release path may directly zero the orbit phase');
  assert.ok(release.includes('commitOrbitReflow('), 'detach/reinsertion/cancel paths must reuse the shared reflow mechanism');
});

test('11. only ASSEMBLE/RESET (restoreCanonicalDockMembership) resets orbit phase to canonical zero', () => {
  const resetFnMatches = canvasSource.match(/resetOrbitPhaseToCanonical\(\);/g) ?? [];
  assert.equal(resetFnMatches.length, 1, 'resetOrbitPhaseToCanonical must be called from exactly one call site');
  assert.ok(canvasSource.includes('const restoreCanonicalDockMembership = useCallback(() => {'));
});

test('rebaseline architecture is reused for breakaway freeze/resume — no second clock introduced', () => {
  assert.equal(
    (canvasSource.match(/orbitClockRef\s*=\s*useRef/g) ?? []).length,
    1,
    'PR24 breakaway freeze must not introduce a second orbit clock ref'
  );
  assert.ok(canvasSource.includes('orbitClockRef.current = rebaselineOrbitClock(orbitClockRef.current);'));
});
