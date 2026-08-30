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
};

test('orbit rate architecture exposes PAUSE through 512×', () => {
  assert.deepEqual(ORBIT_RATE_MULTIPLIERS, [0, 0.5, 1, 2, 4, 8, 16, 32, 64, 128, 256, 512]);
  assert.ok(!ORBIT_RATE_MULTIPLIERS.some(rate => rate > 512), 'PR27 must not expose a rate faster than 512×');
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

test('background pan and orbit rate operate independently at every rate from PAUSE through 512×', () => {
  const panningState = { ...idlePauseState, isCanvasPanning: true };
  assert.equal(isOrbitPauseConditionActive(panningState), false, 'panning alone must not become a system pause');

  for (const rate of ORBIT_RATE_MULTIPLIERS) {
    const start: OrbitClockState = { phase: 0, lastTimestamp: 0 };
    const next = stepOrbitClock(start, 5_000, true, rate);
    const expected = normalizeOrbitPhase(computePhaseDelta(5_000, rate));
    assert.ok(Math.abs(next.phase - expected) < 1e-9, `pan must not alter ${rate}× phase advancement`);
  }
});

test('only compact, reduced motion, and hidden document remain pause authorities (reflow no longer pauses the orbit)', () => {
  const requiredPauseFields: Array<keyof OrbitPauseState> = [
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
  const bottomLeftIndex = source.indexOf('Bottom-Left Controls & Status');
  const controlsIndex = source.indexOf('id="orbit-rate-controls"');

  assert.ok(bottomLeftIndex !== -1, 'Bottom-Left Controls & Status marker must exist');
  assert.ok(controlsIndex !== -1, 'id="orbit-rate-controls" must exist');
  assert.ok(controlsIndex > bottomLeftIndex, 'orbit-rate-controls must occur AFTER the Bottom-Left Controls & Status marker');

  const controls = source.substring(
    source.indexOf('Desktop dual-orbit console'),
    source.indexOf('Top-Right Viewport & Dragging Telemetry')
  );

  assert.ok(controls.includes('id="orbit-rate-controls"'));
  assert.ok(controls.includes('{!isCompactViewport && !prefersReducedMotion && ('), 'Runtime availability authorities must gate the control markup');
  assert.ok(controls.includes('ORBIT CONTROL'));
  assert.ok(controls.includes('R02 SYSTEMS') && controls.includes('CW'));
  assert.ok(controls.includes('R01 REACTOR') && controls.includes('CCW'));
  for (const label of [
    'Decrease deployed systems orbit speed',
    'Increase deployed systems orbit speed',
    'Pause deployed systems orbit',
    'Resume deployed systems orbit',
    'Decrease capability reactor speed',
    'Increase capability reactor speed',
    'Pause capability reactor orbit',
    'Resume capability reactor orbit',
  ]) {
    assert.ok(controls.includes(label), `missing accessible control label: ${label}`);
  }
  assert.ok(controls.includes("isProjectOrbitPaused ? 'RESUME' : 'PAUSE'"));
  assert.ok(controls.includes("isReactorOrbitPaused ? 'RESUME' : 'PAUSE'"));
});

test('orbit controls do not render when the actual canvas container is compact', () => {
  const source = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');
  const controls = source.substring(
    source.indexOf('Desktop dual-orbit console'),
    source.indexOf('Top-Right Viewport & Dragging Telemetry')
  );

  assert.ok(source.includes('const isCompactViewport = containerDimensions.width < 1024;'));
  assert.ok(controls.includes('{!isCompactViewport && !prefersReducedMotion && ('), 'isCompactViewport must prevent control creation even when the browser matches Tailwind lg');
});

test('orbit controls do not render under reduced motion', () => {
  const source = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');
  const controls = source.substring(
    source.indexOf('Desktop dual-orbit console'),
    source.indexOf('Top-Right Viewport & Dragging Telemetry')
  );

  assert.ok(controls.includes('{!isCompactViewport && !prefersReducedMotion && ('), 'prefersReducedMotion must prevent control creation');
});

test('TopologyCanvas owns independent default rates and one shared dual-clock RAF effect', () => {
  const source = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');
  const effectStart = source.indexOf('const dualOrbitClockRef = useRef<DualOrbitClockState>');
  const effectEnd = source.indexOf('const projectsById', effectStart);
  const orbitEffect = source.substring(effectStart, effectEnd);

  assert.ok(source.includes('useState<ActiveOrbitRateMultiplier>(1)'), 'project default must be 1×');
  assert.ok(source.includes('useState<ActiveOrbitRateMultiplier>(0.5)'), 'reactor default must be 0.5×');
  assert.ok(source.includes('const isDualOrbitMachineRunning = isProjectOrbitRunning || isReactorOrbitRunning;'));
  assert.ok(orbitEffect.includes('rebaselineDualOrbitClock(dualOrbitClockRef.current)'));
  assert.ok(orbitEffect.includes('stepDualOrbitClock('));
  assert.equal((orbitEffect.match(/requestAnimationFrame\(/g) ?? []).length, 2, 'Both phases must reuse exactly one autonomous RAF chain');
  assert.ok(!source.includes('localStorage') && !source.includes('sessionStorage'), 'Orbit rate must not persist across refreshes');
});

test('TopologyCanvas mirrors only the project phase for docking and resets both phases canonically', () => {
  const source = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');
  assert.equal(
    (source.match(/const projectOrbitPhaseRef = useRef\(0\);/g) ?? []).length,
    1,
    'There must be exactly one imperative mirror of the project orbit phase'
  );
  assert.ok(!source.includes('reactorOrbitPhaseRef'), 'reactor phase must never gain a project-geometry ref');

  const tickStart = source.indexOf('const tick = (timestamp: number) => {');
  const tickEnd = source.indexOf('rafId = requestAnimationFrame(tick);', tickStart);
  const tick = source.substring(tickStart, tickEnd);
  assert.ok(tick.includes('dualOrbitClockRef.current = next;'));
  assert.ok(tick.includes('projectOrbitPhaseRef.current = next.projectPhase;'));
  assert.ok(tick.includes('setProjectOrbitPhase(next.projectPhase);'));
  assert.ok(tick.includes('setReactorOrbitPhase(next.reactorPhase);'));

  const resetStart = source.indexOf('const resetOrbitPhasesToCanonical = useCallback(() => {');
  const resetEnd = source.indexOf('}, []);', resetStart);
  const reset = source.substring(resetStart, resetEnd);
  assert.ok(reset.includes('dualOrbitClockRef.current = { projectPhase: 0, reactorPhase: 0, lastTimestamp: null };'));
  assert.ok(reset.includes('projectOrbitPhaseRef.current = 0;'));
  assert.ok(reset.includes('setProjectOrbitPhase(0);'));
  assert.ok(reset.includes('setReactorOrbitPhase(0);'));
});

test('reflow commit never snapshots phase (PR24 moving-frame reflow); detached insertion still snapshots release phase for its one-time insertion-index decision', () => {
  const source = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');
  const commitStart = source.indexOf('const commitOrbitReflow = useCallback((');
  const commitEnd = source.indexOf('// The ONE short-lived orbital reflow RAF loop', commitStart);
  const commit = source.substring(commitStart, commitEnd);
  assert.ok(
    !commit.includes('phaseAtCommit'),
    'commit must never freeze a phase snapshot — reflow targets are slot descriptors resolved against the live phase every frame'
  );
  assert.ok(commit.includes('buildOrbitReflowPlan('), 'commit must build a slot-descriptor plan, not fixed positions');
  const commitDependencies = commit.substring(commit.lastIndexOf('}, ['));
  assert.ok(!commitDependencies.includes('orbitPhase'), 'commit callback identity must not change each autonomous frame');

  const releaseStart = source.indexOf("} else if (releaseAction === 'insert-detached-project')");
  const releaseEnd = source.indexOf("setSnapNotice({ message: 'DOCK TARGET ACQUIRED", releaseStart);
  const release = source.substring(releaseStart, releaseEnd);
  assert.ok(release.includes('const phaseAtRelease = projectOrbitPhaseRef.current;'), 'the one-time insertion-INDEX decision still reads the live project phase at release');
  assert.match(release, /theta,\s*phaseAtRelease,/);
  assert.ok(!release.includes('resolveOrbitInsertionIndex(theta, orbitPhase'));
});

test('global window drag listeners have one stable subscription lifecycle while orbit and drag coordinates advance', () => {
  const source = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');
  const effectStart = source.indexOf('// Global window mousemove & mouseup listeners');
  const effectEnd = source.indexOf('// Handle Pan & Drag on canvas surface', effectStart);
  const effect = source.substring(effectStart, effectEnd);

  assert.ok(effect.includes('const draggingNode = draggingNodeRef.current;'));
  assert.ok(effect.includes('const phaseAtRelease = projectOrbitPhaseRef.current;'));
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
  const clockStart = source.indexOf('const dualOrbitClockRef = useRef<DualOrbitClockState>');
  const clockEffect = source.substring(clockStart, source.indexOf('const projectsById', clockStart));
  const panStart = source.indexOf('// Handle Pan & Drag on canvas surface');
  const panHandlers = source.substring(panStart, source.indexOf('// Center coordinate offset', panStart));

  assert.ok(pauseState.includes('isCanvasPanning: isDragging'), 'Pan state remains explicitly modeled');
  assert.ok(!clockEffect.includes('isDragging'), 'Pan start/end must not restart or re-baseline the orbit clock');
  assert.ok(!panHandlers.includes('setProjectOrbitRateMultiplier'), 'Pan must not alter the project rate');
  assert.ok(!panHandlers.includes('setReactorOrbitRateMultiplier'), 'Pan must not alter the reactor rate');
  assert.ok(!panHandlers.includes('setIsResumeReady'), 'Pan must not trigger the resume-delay state');
  assert.ok(!panHandlers.includes('dualOrbitClockRef'), 'Pan must not reset the shared orbit timestamp baseline');
});

test('ASSEMBLE and RESET restore phase/membership without resetting the selected rate', () => {
  const source = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');
  const restoreStart = source.indexOf('const restoreCanonicalDockMembership = useCallback(() => {');
  const restoreEnd = source.indexOf('const hasCustomLayout', restoreStart);
  const restoreBlock = source.substring(restoreStart, restoreEnd);

  assert.ok(restoreBlock.includes('resetOrbitPhasesToCanonical();'), 'Canonical restore must reset both phases');
  assert.ok(!restoreBlock.includes('setProjectOrbitRateMultiplier'), 'Canonical restore must preserve the project rate');
  assert.ok(!restoreBlock.includes('setReactorOrbitRateMultiplier'), 'Canonical restore must preserve the reactor rate');
  assert.ok(!restoreBlock.includes('setIsProjectOrbitPaused'), 'Canonical restore must preserve project pause state');
  assert.ok(!restoreBlock.includes('setIsReactorOrbitPaused'), 'Canonical restore must preserve reactor pause state');
});
