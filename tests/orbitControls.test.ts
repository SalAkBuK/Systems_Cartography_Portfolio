import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  ORBIT_PERIOD_MS,
  ORBIT_RATE_MULTIPLIERS,
  computePhaseDelta,
  isOrbitPauseConditionActive,
  normalizeOrbitPhase,
  rebaselineOrbitClock,
  stepOrbitClock,
  type OrbitClockState,
  type OrbitPauseState,
  type OrbitRateMultiplier,
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
};

test('orbit rate architecture exposes PAUSE through 64×', () => {
  assert.deepEqual(ORBIT_RATE_MULTIPLIERS, [0, 0.5, 1, 2, 4, 8, 16, 32, 64]);
  assert.ok(!ORBIT_RATE_MULTIPLIERS.some(rate => rate > 64), 'PR24 must not expose a rate faster than 64×');
});

test('1× produces the existing 120-second phase delta', () => {
  assert.ok(Math.abs(computePhaseDelta(ORBIT_PERIOD_MS, 1) - Math.PI * 2) < 1e-9);
});

test('0.5× produces exactly half the 1× phase delta', () => {
  const elapsedMs = 5_000;
  assert.equal(computePhaseDelta(elapsedMs, 0.5), computePhaseDelta(elapsedMs, 1) / 2);
});

test('2× produces exactly twice the 1× phase delta', () => {
  const elapsedMs = 5_000;
  assert.equal(computePhaseDelta(elapsedMs, 2), computePhaseDelta(elapsedMs, 1) * 2);
});

test('0× holds phase and clears the clock baseline even if a caller marks the clock running', () => {
  const state: OrbitClockState = { phase: 2.41, lastTimestamp: 1_000 };
  const paused = stepOrbitClock(state, 21_000, true, 0);
  assert.deepEqual(paused, { phase: 2.41, lastTimestamp: null });
});

test('running rate change preserves phase and applies the new velocity only after a fresh baseline', () => {
  let clock: OrbitClockState = { phase: 0.8, lastTimestamp: 1_000 };
  clock = stepOrbitClock(clock, 2_000, true, 1);
  const phaseAtRateChange = clock.phase;

  clock = rebaselineOrbitClock(clock);
  assert.equal(clock.phase, phaseAtRateChange, 're-baselining a rate change must preserve phase');
  assert.equal(clock.lastTimestamp, null);

  clock = stepOrbitClock(clock, 30_000, true, 2);
  assert.equal(clock.phase, phaseAtRateChange, 'first frame at the new rate establishes time without movement');

  clock = stepOrbitClock(clock, 30_016, true, 2);
  assert.ok(Math.abs(clock.phase - (phaseAtRateChange + computePhaseDelta(16, 2))) < 1e-9);
});

test('user pause then resume has no catch-up jump and continues from the held phase', () => {
  let clock: OrbitClockState = { phase: 2.41, lastTimestamp: 1_000 };
  clock = stepOrbitClock(clock, 21_000, true, 0);
  assert.equal(clock.phase, 2.41);

  clock = stepOrbitClock(clock, 41_000, true, 2);
  assert.equal(clock.phase, 2.41, 'resume frame must not charge the paused 40-second gap');
  assert.equal(clock.lastTimestamp, 41_000);

  clock = stepOrbitClock(clock, 41_016, true, 2);
  assert.ok(Math.abs(clock.phase - (2.41 + computePhaseDelta(16, 2))) < 1e-9);
});

test('background pan and orbit rate operate independently at every rate from PAUSE through 64×', () => {
  const panningState = { ...idlePauseState, isCanvasPanning: true };
  assert.equal(isOrbitPauseConditionActive(panningState), false, 'panning alone must not become a system pause');

  for (const rate of ORBIT_RATE_MULTIPLIERS) {
    const start: OrbitClockState = { phase: 0, lastTimestamp: 0 };
    const next = stepOrbitClock(start, 5_000, true, rate);
    const expected = normalizeOrbitPhase(computePhaseDelta(5_000, rate));
    assert.ok(Math.abs(next.phase - expected) < 1e-9, `pan must not alter ${rate}× phase advancement`);
  }
});

test('only reflow, compact, reduced motion, and hidden document remain pause authorities', () => {
  const requiredPauseFields: Array<keyof OrbitPauseState> = [
    'isDockingTransitionActive',
    'isCompact',
    'prefersReducedMotion',
    'isDocumentHidden',
  ];

  for (const field of requiredPauseFields) {
    assert.equal(isOrbitPauseConditionActive({ ...idlePauseState, [field]: true }), true, `${field} must still pause`);
  }
});

function advanceDuringInteraction(
  interaction: Partial<OrbitPauseState>,
  rate: OrbitRateMultiplier = 1
): OrbitClockState {
  const pauseActive = isOrbitPauseConditionActive({ ...idlePauseState, ...interaction });
  return stepOrbitClock(
    { phase: 0, lastTimestamp: 0 },
    5_000,
    rate > 0 && !pauseActive,
    rate
  );
}

test('orbit phase advances while a docked project drag is active', () => {
  assert.ok(advanceDuringInteraction({ isNodeDragging: true }).phase > 0);
});

test('orbit phase advances while a capability drag is active', () => {
  assert.ok(advanceDuringInteraction({ isNodeDragging: true, isSkillHovered: true }).phase > 0);
});

test('orbit phase advances while a detached-project drag is active', () => {
  assert.ok(advanceDuringInteraction({ isNodeDragging: true, isProjectHovered: true }).phase > 0);
});

test('selected project and selected capability do not stop phase', () => {
  assert.ok(advanceDuringInteraction({ isProjectSelected: true }).phase > 0);
  assert.ok(advanceDuringInteraction({ isSkillSelected: true }).phase > 0);
});

test('experience focus and FOCUS LOCK do not stop phase', () => {
  assert.ok(advanceDuringInteraction({ isExperienceSelected: true }).phase > 0);
  assert.ok(advanceDuringInteraction({ isProjectSelected: true, isProjectHovered: true }).phase > 0);
});

test('project and capability hover do not stop phase', () => {
  assert.ok(advanceDuringInteraction({ isProjectHovered: true }).phase > 0);
  assert.ok(advanceDuringInteraction({ isSkillHovered: true }).phase > 0);
});

test('manual PAUSE freezes phase during every direct interaction', () => {
  const interactions: Array<Partial<OrbitPauseState>> = [
    { isNodeDragging: true },
    { isNodeDragging: true, isProjectHovered: true },
    { isNodeDragging: true, isSkillHovered: true },
    { isProjectSelected: true },
    { isSkillSelected: true },
    { isExperienceSelected: true },
    { isCanvasPanning: true },
  ];
  for (const interaction of interactions) {
    assert.equal(advanceDuringInteraction(interaction, 0).phase, 0);
  }
});

test('every non-pause rate retains its exact value during node drag', () => {
  for (const rate of ORBIT_RATE_MULTIPLIERS.filter(rate => rate > 0)) {
    const next = advanceDuringInteraction({ isNodeDragging: true }, rate);
    assert.ok(Math.abs(next.phase - normalizeOrbitPhase(computePhaseDelta(5_000, rate))) < 1e-9);
  }
});

test('desktop non-compact TopologyCanvas renders accessible orbit controls with explicit active telemetry', () => {
  const source = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');
  const controls = source.substring(
    source.indexOf('Desktop autonomous-orbit rate console'),
    source.indexOf('Screen-positioned focus status')
  );

  assert.ok(controls.includes('id="orbit-rate-controls"'));
  assert.ok(controls.includes('{!isCompactViewport && !prefersReducedMotion && ('), 'Runtime availability authorities must gate the control markup');
  assert.ok(controls.includes('hidden lg:flex absolute top-3 left-1/2'), 'Rate controls must be hidden on compact viewports');
  assert.ok(controls.includes("orbitRateMultiplier === 0 ? 'ORBIT // PAUSED'"), 'User pause must be textually explicit');
  assert.ok(controls.includes('`ORBIT RATE // ${orbitRateMultiplier}×`'), 'Active running rate must be textually explicit');
  assert.ok(controls.includes('aria-label="Autonomous orbit rate"'));
  assert.ok(controls.includes('aria-pressed={isActive}'));
  assert.ok(controls.includes("const label = rate === 0 ? 'PAUSE' : `${rate}×`"));
});

test('orbit controls do not render when the actual canvas container is compact', () => {
  const source = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');
  const controls = source.substring(
    source.indexOf('Desktop autonomous-orbit rate console'),
    source.indexOf('Screen-positioned focus status')
  );

  assert.ok(source.includes('const isCompactViewport = containerDimensions.width < 1024;'));
  assert.ok(controls.includes('{!isCompactViewport && !prefersReducedMotion && ('), 'isCompactViewport must prevent control creation even when the browser matches Tailwind lg');
});

test('orbit controls do not render under reduced motion', () => {
  const source = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');
  const controls = source.substring(
    source.indexOf('Desktop autonomous-orbit rate console'),
    source.indexOf('Screen-positioned focus status')
  );

  assert.ok(controls.includes('{!isCompactViewport && !prefersReducedMotion && ('), 'prefersReducedMotion must prevent control creation');
});

test('TopologyCanvas owns one shared default-1× rate and rate changes re-baseline the existing RAF effect', () => {
  const source = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');
  const rateStateMatches = source.match(/useState<OrbitRateMultiplier>\(1\)/g) ?? [];
  const effectStart = source.indexOf('const orbitClockRef = useRef<OrbitClockState>');
  const effectEnd = source.indexOf('}, [isOrbitRunning, orbitRateMultiplier]);', effectStart);
  const orbitEffect = source.substring(effectStart, effectEnd);

  assert.equal(rateStateMatches.length, 1, 'There must be one shared rate value, not per-project rate state');
  assert.ok(source.includes('const isOrbitRunning = orbitRateMultiplier > 0 && !isPauseConditionActive && isResumeReady;'));
  assert.ok(orbitEffect.includes('rebaselineOrbitClock(orbitClockRef.current)'), 'Rate-boundary effect must clear elapsed-time baseline without clearing phase');
  assert.ok(orbitEffect.includes('stepOrbitClock(orbitClockRef.current, timestamp, true, orbitRateMultiplier)'));
  assert.equal((orbitEffect.match(/requestAnimationFrame\(/g) ?? []).length, 2, 'Rate controls must reuse exactly one autonomous RAF chain');
  assert.ok(!source.includes('localStorage') && !source.includes('sessionStorage'), 'Orbit rate must not persist across refreshes');
});

test('TopologyCanvas maintains one current-phase mirror and synchronizes tick and canonical reset writes', () => {
  const source = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');
  assert.equal(
    (source.match(/const orbitPhaseRef = useRef\(0\);/g) ?? []).length,
    1,
    'There must be exactly one imperative mirror of the reactive orbit phase'
  );

  const tickStart = source.indexOf('const tick = (timestamp: number) => {');
  const tickEnd = source.indexOf('rafId = requestAnimationFrame(tick);', tickStart);
  const tick = source.substring(tickStart, tickEnd);
  assert.ok(tick.includes('orbitClockRef.current = next;'));
  assert.ok(tick.includes('orbitPhaseRef.current = next.phase;'));
  assert.ok(tick.includes('setOrbitPhase(next.phase);'));

  const resetStart = source.indexOf('const resetOrbitPhaseToCanonical = useCallback(() => {');
  const resetEnd = source.indexOf('}, []);', resetStart);
  const reset = source.substring(resetStart, resetEnd);
  assert.ok(reset.includes('orbitClockRef.current = { phase: 0, lastTimestamp: null };'));
  assert.ok(reset.includes('orbitPhaseRef.current = 0;'));
  assert.ok(reset.includes('setOrbitPhase(0);'));
});

test('reflow commit and detached insertion snapshot the current phase instead of capturing render phase', () => {
  const source = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');
  const commitStart = source.indexOf('const commitOrbitReflow = useCallback((');
  const commitEnd = source.indexOf('// The ONE short-lived orbital reflow RAF loop', commitStart);
  const commit = source.substring(commitStart, commitEnd);
  assert.ok(commit.includes('const phaseAtCommit = orbitPhaseRef.current;'));
  assert.match(commit, /phaseAtCommit\s*\);/, 'Every destination must use the one phase-at-commit snapshot');
  const commitDependencies = commit.substring(commit.lastIndexOf('}, ['));
  assert.ok(!commitDependencies.includes('orbitPhase'), 'commit callback identity must not change each autonomous frame');

  const releaseStart = source.indexOf("} else if (releaseAction === 'insert-detached-project')");
  const releaseEnd = source.indexOf("setSnapNotice({ message: 'DOCK TARGET ACQUIRED", releaseStart);
  const release = source.substring(releaseStart, releaseEnd);
  assert.ok(release.includes('const phaseAtRelease = orbitPhaseRef.current;'));
  assert.match(release, /theta,\s*phaseAtRelease,/);
  assert.ok(!release.includes('resolveOrbitInsertionIndex(theta, orbitPhase'));
});

test('global window drag listeners have one stable subscription lifecycle while orbit and drag coordinates advance', () => {
  const source = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');
  const effectStart = source.indexOf('// Global window mousemove & mouseup listeners');
  const effectEnd = source.indexOf('// Handle Pan & Drag on canvas surface', effectStart);
  const effect = source.substring(effectStart, effectEnd);

  assert.ok(effect.includes('const draggingNode = draggingNodeRef.current;'));
  assert.ok(effect.includes('const phaseAtRelease = orbitPhaseRef.current;'));
  assert.ok(effect.includes('}, [isGlobalDragActive]);'));
  const dependencies = effect.substring(effect.lastIndexOf('}, ['));
  assert.equal(dependencies.trim(), '}, [isGlobalDragActive]);');
  assert.ok(!dependencies.includes('orbitPhase'));
  assert.ok(!dependencies.includes('draggingNode'));
  assert.ok(!dependencies.includes('effectiveProjectPositions'));
  assert.equal((effect.match(/window\.addEventListener\(/g) ?? []).length, 4);
  assert.equal((effect.match(/window\.removeEventListener\(/g) ?? []).length, 4);
});

test('background panning cannot change pause readiness, clock baseline, or selected rate', () => {
  const source = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');
  const pauseStateStart = source.indexOf('const orbitPauseState: OrbitPauseState = useMemo(');
  const pauseState = source.substring(pauseStateStart, source.indexOf('const isPauseConditionActive', pauseStateStart));
  const clockStart = source.indexOf('const orbitClockRef = useRef<OrbitClockState>');
  const clockEffect = source.substring(clockStart, source.indexOf('}, [isOrbitRunning, orbitRateMultiplier]);', clockStart));
  const panStart = source.indexOf('// Handle Pan & Drag on canvas surface');
  const panHandlers = source.substring(panStart, source.indexOf('// Center coordinate offset', panStart));

  assert.ok(pauseState.includes('isCanvasPanning: isDragging'), 'Pan state remains explicitly modeled');
  assert.ok(!clockEffect.includes('isDragging'), 'Pan start/end must not restart or re-baseline the orbit clock');
  assert.ok(!panHandlers.includes('setOrbitRateMultiplier'), 'Pan must not alter the selected rate');
  assert.ok(!panHandlers.includes('setIsResumeReady'), 'Pan must not trigger the resume-delay state');
  assert.ok(!panHandlers.includes('orbitClockRef'), 'Pan must not reset the orbit timestamp baseline');
});

test('ASSEMBLE and RESET restore phase/membership without resetting the selected rate', () => {
  const source = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');
  const restoreStart = source.indexOf('const restoreCanonicalDockMembership = useCallback(() => {');
  const restoreEnd = source.indexOf('const hasCustomLayout', restoreStart);
  const restoreBlock = source.substring(restoreStart, restoreEnd);

  assert.ok(restoreBlock.includes('resetOrbitPhaseToCanonical();'), 'Canonical restore must retain existing phase-reset behavior');
  assert.ok(!restoreBlock.includes('setOrbitRateMultiplier'), 'Canonical restore must preserve the user-selected runtime rate');
});
