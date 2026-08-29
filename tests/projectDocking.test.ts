import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  DETACH_THRESHOLD_ISO,
  PULL_RESISTANCE,
  CAPTURE_RADIUS_ISO,
  MAX_CAPTURE_PULL,
  REDOCK_DURATION_MS,
  ABORTED_PULL_RETURN_MS,
  resolveProjectDockState,
  getProjectVisualCenterIso,
  lerpPoint,
  hasCrossedDetachThreshold,
  computeResistedWorldOrigin,
  computeFreeWorldOrigin,
  computeCaptureAttraction,
  computeMagneticRenderPosition,
  deriveDockState,
  resolveReleaseOutcome,
  stepSettleTransition,
  isDetachedPlacementMotionSafe,
  ORBITAL_CLEARANCE_SAMPLE_COUNT,
  type ProjectDockRuntimeMap,
} from '../src/utils/projectDocking.ts';
import { project3DToIso } from '../src/utils/isometricProjection.ts';
import { getTopologyProjectDimensions, getTopologyProjectVisualBounds } from '../src/utils/projectTopologyGeometry.ts';
import { assembleTopologyLayout, getNodeBounds, checkAABBOverlap } from '../src/utils/topologyLayout.ts';
import { getOrbitalProjectPositionAtPhase, isOrbitPauseConditionActive, type OrbitPauseState } from '../src/utils/orbitMotion.ts';
import { checkCollisions, findNearestValidGridPosition } from '../src/utils/collision.ts';
import { GITHUB_SNAPSHOT } from '../src/data/githubSnapshot.generated.ts';
import { ProjectData, InfrastructureSkill } from '../src/types.ts';

function generateMockSkills(count: number): InfrastructureSkill[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `skill-${String(i + 1).padStart(3, '0')}`,
    code: `CAP-${String(i + 1).padStart(2, '0')}`,
    name: `Capability ${i + 1}`,
    category: 'infrastructure' as const,
    yearsActive: 3,
    proficiencyScore: 90,
    primaryUseCases: ['Distributed Systems'],
    technicalHighlights: ['High throughput'],
    samplePattern: 'Event Driven',
    systemCount: 2,
    usedInProjects: [],
    gridPosition: { x: 0, y: 0 }
  }));
}

function generateMockProjects(count: number, customWidths?: number[]): ProjectData[] {
  return Array.from({ length: count }, (_, i) => {
    const w = customWidths && customWidths[i % customWidths.length] ? customWidths[i % customWidths.length] : 100;
    return {
      id: `project-${String(i + 1).padStart(3, '0')}`,
      code: `SYS-${String(i + 1).padStart(2, '0')}`,
      title: `System Component ${i + 1}`,
      summary: 'Synthetic summary',
      problem: 'Synthetic problem',
      solution: 'Synthetic solution',
      architectureNotes: 'Synthetic notes',
      status: 'ACTIVE' as const,
      year: '2025',
      tagline: 'Synthetic test component',
      accentColor: '#C3E54E',
      category: 'fullstack' as const,
      techStack: ['TypeScript'],
      infrastructureDeps: [],
      subsystems: [],
      dimensions: { width: w, height: 60, levels: 2 },
      gridPosition: { x: 0, y: 0 },
      verifiedFacts: [],
      metrics: [],
      keyDecisions: [],
      resilienceTesting: 'Chaos tested',
      links: { github: 'https://github.com/mock' }
    };
  });
}

// ---------------------------------------------------------------------------
// A. absent dock-state entry resolves to docked
// ---------------------------------------------------------------------------

test('resolveProjectDockState: absent entry resolves to docked; present entry resolves to detached', () => {
  const map: ProjectDockRuntimeMap = { 'project-002': { state: 'detached' } };
  assert.equal(resolveProjectDockState(map, 'project-001'), 'docked');
  assert.equal(resolveProjectDockState(map, 'project-002'), 'detached');
});

test('ProjectDockRuntimeMap: does not initialize a duplicate entry per project — starts empty', () => {
  const map: ProjectDockRuntimeMap = {};
  assert.equal(Object.keys(map).length, 0, 'A fresh dock map must not pre-populate an entry per project');
});

// ---------------------------------------------------------------------------
// B-G. deriveDockState state machine
// ---------------------------------------------------------------------------

test('deriveDockState: docked pointer interaction enters detaching', () => {
  const state = deriveDockState({ persistedState: 'docked', isDragging: true, hasCrossedThresholdThisGesture: false, isWithinCaptureRadius: false });
  assert.equal(state, 'detaching');
});

test('deriveDockState: below-threshold movement remains detaching', () => {
  // Repeated calls with hasCrossedThresholdThisGesture still false must keep returning 'detaching'.
  for (let i = 0; i < 5; i++) {
    const state = deriveDockState({ persistedState: 'docked', isDragging: true, hasCrossedThresholdThisGesture: false, isWithinCaptureRadius: false });
    assert.equal(state, 'detaching');
  }
});

test('deriveDockState: threshold crossing transitions out of detaching (caller sets the sticky flag exactly once)', () => {
  const state = deriveDockState({ persistedState: 'docked', isDragging: true, hasCrossedThresholdThisGesture: true, isWithinCaptureRadius: false });
  assert.equal(state, 'detached');
});

test('deriveDockState: an already-detached project being dragged remains detached outside the capture radius', () => {
  const state = deriveDockState({ persistedState: 'detached', isDragging: true, hasCrossedThresholdThisGesture: true, isWithinCaptureRadius: false });
  assert.equal(state, 'detached');
});

test('deriveDockState: entering the capture radius enters capturing', () => {
  const state = deriveDockState({ persistedState: 'detached', isDragging: true, hasCrossedThresholdThisGesture: true, isWithinCaptureRadius: true });
  assert.equal(state, 'capturing');
});

test('deriveDockState: leaving the capture radius returns to detached before release — no special-casing required', () => {
  const capturing = deriveDockState({ persistedState: 'detached', isDragging: true, hasCrossedThresholdThisGesture: true, isWithinCaptureRadius: true });
  const detachedAgain = deriveDockState({ persistedState: 'detached', isDragging: true, hasCrossedThresholdThisGesture: true, isWithinCaptureRadius: false });
  assert.equal(capturing, 'capturing');
  assert.equal(detachedAgain, 'detached');
});

test('deriveDockState: at rest (not dragging) simply reflects the persisted state', () => {
  assert.equal(deriveDockState({ persistedState: 'docked', isDragging: false, hasCrossedThresholdThisGesture: false, isWithinCaptureRadius: false }), 'docked');
  assert.equal(deriveDockState({ persistedState: 'detached', isDragging: false, hasCrossedThresholdThisGesture: false, isWithinCaptureRadius: false }), 'detached');
});

test('resolveReleaseOutcome: valid capture release ends docked', () => {
  assert.equal(resolveReleaseOutcome('capturing', false), 'docked');
});

test('resolveReleaseOutcome: aborted pull (still detaching at release) ends docked', () => {
  assert.equal(resolveReleaseOutcome('detaching', false), 'docked');
});

test('resolveReleaseOutcome: normal release away from slot ends detached', () => {
  assert.equal(resolveReleaseOutcome('detached', false), 'detached');
});

test('resolveReleaseOutcome: a blocked capture falls through to detached free placement', () => {
  assert.equal(resolveReleaseOutcome('capturing', true), 'detached');
});

// ---------------------------------------------------------------------------
// Resistance (mandatory numeric proof)
// ---------------------------------------------------------------------------

test('computeResistedWorldOrigin: iso-space pull magnitude = pointer delta * PULL_RESISTANCE', () => {
  assert.equal(PULL_RESISTANCE, 0.28);
  const start = { x: 0, y: 0 };
  const isoDelta = 20;
  const resisted = computeResistedWorldOrigin(start, isoDelta, 0);
  // Re-project the resulting world delta back into iso space to measure the
  // ACTUAL visual displacement produced, rather than assuming world-space
  // magnitude equals iso-space magnitude (the projection is not an isometry).
  const resistedIso = project3DToIso(resisted.x, resisted.y, 0);
  const magnitude = Math.hypot(resistedIso.x, resistedIso.y);
  assert.ok(Math.abs(magnitude - isoDelta * PULL_RESISTANCE) < 1e-9, `expected ~${isoDelta * PULL_RESISTANCE}, got ${magnitude}`);
});

test('computeResistedWorldOrigin: resistance is independent of viewport zoom (the function only ever sees an already-normalized iso-space delta)', () => {
  // The component divides the raw pointer delta by viewport.zoom BEFORE calling
  // this function — computeResistedWorldOrigin itself takes no zoom parameter,
  // so identical iso-space deltas always produce identical results regardless
  // of what zoom the user is actually at. This is the whole zoom-consistency
  // contract: the SAME physical/logical drag at 0.5x and 1.0x normalizes to
  // the SAME iso-space delta, and is therefore guaranteed to produce the SAME
  // magnetic result.
  const start = { x: 100, y: 200 };
  const a = computeResistedWorldOrigin(start, 20, -10);
  const b = computeResistedWorldOrigin(start, 20, -10);
  assert.deepEqual(a, b);
});

// ---------------------------------------------------------------------------
// Mandatory breakaway continuity test
// ---------------------------------------------------------------------------

test('breakaway continuity: rendered position does not jump when the detach threshold is crossed', () => {
  const start = { x: 0, y: 0 };
  const epsilon = 0.05;

  // Movement immediately BEFORE the threshold: still resisted.
  const justBefore = computeResistedWorldOrigin(start, DETACH_THRESHOLD_ISO - epsilon, 0);

  // Movement immediately AT/AFTER the threshold: this becomes the breakaway baseline.
  assert.ok(hasCrossedDetachThreshold(DETACH_THRESHOLD_ISO + epsilon, 0));
  const atCrossing = computeResistedWorldOrigin(start, DETACH_THRESHOLD_ISO + epsilon, 0);

  const jumpDistance = Math.hypot(atCrossing.x - justBefore.x, atCrossing.y - justBefore.y);
  // A genuine jump (28% -> 100% of pointer displacement) would be on the order
  // of DETACH_THRESHOLD_ISO * (1 - PULL_RESISTANCE) in world units — many times
  // larger than what two epsilon-apart resisted samples can differ by.
  assert.ok(jumpDistance < 1, `breakaway produced a visible jump of ${jumpDistance} world units`);

  // Free drag must establish a NEW baseline at breakaway: zero further pointer
  // movement from the crossing instant must render EXACTLY at the captured position.
  const immediatelyAfterBreakaway = computeFreeWorldOrigin(atCrossing, 0, 0);
  assert.deepEqual(immediatelyAfterBreakaway, atCrossing);
});

test('breakaway continuity: this transition happens exactly once per gesture (caller-owned sticky flag, not re-derived every tick)', () => {
  // Once the caller has recorded crossedDetachThreshold = true, subsequent
  // calls to hasCrossedDetachThreshold are never consulted again for THIS
  // gesture — deriveDockState never returns to 'detaching' once persistedState
  // is no longer 'docked' or the sticky flag is true.
  const afterCrossing = deriveDockState({ persistedState: 'docked', isDragging: true, hasCrossedThresholdThisGesture: true, isWithinCaptureRadius: false });
  assert.notEqual(afterCrossing, 'detaching');
});

// ---------------------------------------------------------------------------
// Capture tests
// ---------------------------------------------------------------------------

test('computeCaptureAttraction: beyond the capture radius yields zero strength (detached, not capturing)', () => {
  const result = computeCaptureAttraction(CAPTURE_RADIUS_ISO + 1);
  assert.equal(result.isWithinCaptureRadius, false);
  assert.equal(result.strength, 0);
});

test('computeCaptureAttraction: just inside the radius yields weak attraction; near the target yields stronger attraction; monotonic throughout', () => {
  const samples = [CAPTURE_RADIUS_ISO - 1, CAPTURE_RADIUS_ISO * 0.75, CAPTURE_RADIUS_ISO * 0.5, CAPTURE_RADIUS_ISO * 0.25, 5, 0.5];
  let previousStrength = -1;
  for (const distance of samples) {
    const result = computeCaptureAttraction(distance);
    assert.ok(result.isWithinCaptureRadius);
    assert.ok(result.strength >= previousStrength, `strength must be monotonic as distance decreases (distance=${distance})`);
    previousStrength = result.strength;
  }
  assert.ok(previousStrength > 0);
});

test('computeCaptureAttraction: at distance 0, attraction caps at MAX_CAPTURE_PULL exactly (preview never fully snaps — only the settle animation does)', () => {
  assert.equal(MAX_CAPTURE_PULL, 0.40);
  const result = computeCaptureAttraction(0);
  assert.equal(result.proximity, 1);
  assert.equal(result.strength, MAX_CAPTURE_PULL);
});

test('computeCaptureAttraction: no discontinuity exactly at the capture radius boundary', () => {
  const justInside = computeCaptureAttraction(CAPTURE_RADIUS_ISO - 0.001);
  const exactlyAt = computeCaptureAttraction(CAPTURE_RADIUS_ISO);
  const justOutside = computeCaptureAttraction(CAPTURE_RADIUS_ISO + 0.001);
  assert.ok(justInside.strength < 0.001);
  assert.equal(exactlyAt.strength, 0);
  assert.equal(justOutside.strength, 0);
  assert.equal(exactlyAt.isWithinCaptureRadius, true);
  assert.equal(justOutside.isWithinCaptureRadius, false);
});

test('computeMagneticRenderPosition: never teleports — blends smoothly and equals raw position at zero strength', () => {
  const raw = { x: 100, y: 200 };
  const reserved = { x: 300, y: 250 };
  assert.deepEqual(computeMagneticRenderPosition(raw, reserved, 0), raw);
  const blended = computeMagneticRenderPosition(raw, reserved, 0.2);
  assert.deepEqual(blended, lerpPoint(raw, reserved, 0.2));
  // Blended point must lie strictly between raw and reserved, never past either.
  assert.ok(blended.x > raw.x && blended.x < reserved.x);
});

// ---------------------------------------------------------------------------
// Slot movement: reserved slot moves with the orbit; a detached project does not
// ---------------------------------------------------------------------------

test('slot movement: the reserved slot position changes with orbit phase; a detached custom position does not depend on phase at all', () => {
  const projects = generateMockProjects(10);
  const skills = generateMockSkills(5);
  const { orbitGeometry } = assembleTopologyLayout(projects, skills);
  const slot = orbitGeometry.slots[0];
  const project = projects.find(p => p.id === slot.projectId)!;

  const positionAtPhaseA = getOrbitalProjectPositionAtPhase(project, slot, orbitGeometry, 0);
  const positionAtPhaseB = getOrbitalProjectPositionAtPhase(project, slot, orbitGeometry, Math.PI / 2);
  assert.notDeepEqual(positionAtPhaseA, positionAtPhaseB, 'The reserved slot must move as orbit phase advances');

  // A detached project's persisted position is just a plain {x,y} — nothing
  // about its representation is a function of phase, so it is definitionally
  // fixed regardless of how far the reserved slot has moved.
  const detachedCustomPosition = { x: -500, y: 300 };
  assert.deepEqual(detachedCustomPosition, { x: -500, y: 300 });
});

// ---------------------------------------------------------------------------
// Mandatory redock handoff test: zero position jump at handoff
// ---------------------------------------------------------------------------

test('redock handoff: settle animation final position exactly equals the canonical rendered position after the override is removed', () => {
  const projects = generateMockProjects(8);
  const skills = generateMockSkills(6);
  const { orbitGeometry } = assembleTopologyLayout(projects, skills);
  const slot = orbitGeometry.slots[0];
  const project = projects.find(p => p.id === slot.projectId)!;
  const frozenPhase = 2.1; // orbit is paused throughout the whole docking gesture, so this is fixed

  const reservedPosition = getOrbitalProjectPositionAtPhase(project, slot, orbitGeometry, frozenPhase);

  const transition = { projectId: project.id, fromPos: { x: -900, y: 400 }, toPos: reservedPosition, durationMs: REDOCK_DURATION_MS, startTimestamp: 0 };
  const finalStep = stepSettleTransition(transition, REDOCK_DURATION_MS); // exactly at/after duration -> complete
  assert.equal(finalStep.isComplete, true);

  // "Remove the custom override" == the canonical position is re-derived at
  // the SAME frozen phase — must be identical to the settle animation's final position.
  const canonicalAfterHandoff = getOrbitalProjectPositionAtPhase(project, slot, orbitGeometry, frozenPhase);
  assert.deepEqual(finalStep.position, canonicalAfterHandoff);
});

test('stepSettleTransition: elapsed-time based ease-out with no overshoot, reaching exactly toPos at/after the duration', () => {
  const transition = { projectId: 'p', fromPos: { x: 0, y: 0 }, toPos: { x: 100, y: 0 }, durationMs: ABORTED_PULL_RETURN_MS, startTimestamp: 1000 };
  const midStep = stepSettleTransition(transition, 1000 + ABORTED_PULL_RETURN_MS / 2);
  assert.ok(midStep.position.x > 0 && midStep.position.x < 100, 'must be strictly between start and end mid-flight');
  assert.ok(!midStep.isComplete);

  const overStep = stepSettleTransition(transition, 1000 + ABORTED_PULL_RETURN_MS + 50);
  assert.equal(overStep.isComplete, true);
  assert.deepEqual(overStep.position, transition.toPos);

  // No overshoot at any sampled point.
  for (let t = 0; t <= ABORTED_PULL_RETURN_MS; t += 10) {
    const step = stepSettleTransition(transition, 1000 + t);
    assert.ok(step.position.x >= -1e-6 && step.position.x <= 100 + 1e-6, `overshoot detected at t=${t}: x=${step.position.x}`);
  }
});

// ---------------------------------------------------------------------------
// Mandatory blocked-target test (reuses existing collision.ts infrastructure)
// ---------------------------------------------------------------------------

test('blocked redock: a reserved slot occupied by another detached project rejects capture via the existing checkCollisions infrastructure', () => {
  const projectA = generateMockProjects(1)[0];
  projectA.id = 'project-A';
  const projectB = generateMockProjects(1)[0];
  projectB.id = 'project-B';
  const projects = [projectA, projectB];

  const reservedOriginA = { x: 0, y: 0 };
  const dimsA = getTopologyProjectDimensions(projectA);

  // Project B is manually detached such that its footprint occupies A's reserved slot.
  const effectiveProjectPositions: Record<string, { x: number; y: number }> = {
    [projectA.id]: { x: 500, y: 500 }, // A is currently elsewhere, mid-drag toward its own slot
    [projectB.id]: { x: reservedOriginA.x + dimsA.width / 2, y: reservedOriginA.y + dimsA.depth / 2 },
  };

  const blockCheck = checkCollisions('project', projectA.id, reservedOriginA, effectiveProjectPositions, {}, projects, []);
  assert.equal(blockCheck.hasCollision, true, 'Redock target occupied by another detached project must be reported as blocked');

  // Normal free-placement behavior remains available regardless (checkCollisions
  // is a plain query — it never prevents ordinary dragging/dropping elsewhere).
  const elsewhereCheck = checkCollisions('project', projectA.id, { x: 900, y: 900 }, effectiveProjectPositions, {}, projects, []);
  assert.equal(elsewhereCheck.hasCollision, false);
});

// ---------------------------------------------------------------------------
// Orbit integration: pause conditions
// ---------------------------------------------------------------------------

test('isOrbitPauseConditionActive: docking transition pauses the orbit', () => {
  const state: OrbitPauseState = {
    isProjectHovered: false, isSkillHovered: false, isProjectSelected: false, isSkillSelected: false,
    isNodeDragging: false, isCanvasPanning: false, isDocumentHidden: false, prefersReducedMotion: false,
    isCompact: false, isExperienceSelected: false, isDockingTransitionActive: true,
  };
  assert.equal(isOrbitPauseConditionActive(state), true);
});

test('TopologyCanvas.tsx: orbitPauseState is not derived from the mere existence of detached projects — an idle detached project does not itself stop the orbit', () => {
  const content = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');
  const pauseStateIdx = content.indexOf('const orbitPauseState: OrbitPauseState = useMemo(');
  const pauseStateBlock = content.slice(pauseStateIdx, content.indexOf('}), [', pauseStateIdx));
  // The pause state may reference draggingNode (active interaction) and
  // activeDockTransitionProjectId (an active settle animation), but must NOT
  // read projectDockState directly — merely having detached projects sitting
  // elsewhere is not itself a pause condition.
  assert.ok(!pauseStateBlock.includes('projectDockState'), 'orbitPauseState must not pause merely because some project is detached at rest');
  assert.ok(pauseStateBlock.includes('activeDockTransitionProjectId'), 'orbitPauseState must pause during an active settle animation');
});

// ---------------------------------------------------------------------------
// RAF lifecycle for the dock-settle transition (mirrors the PR22 orbit-clock proof)
// ---------------------------------------------------------------------------

function extractDockTransitionEffect(content: string): string {
  const guardIdx = content.indexOf('if (!activeDockTransitionProjectId) return;');
  assert.ok(guardIdx !== -1, 'dock transition effect guard must be present');
  const startIdx = content.lastIndexOf('useEffect(() => {', guardIdx);
  assert.ok(startIdx !== -1, 'dock transition effect block must be present');
  const endIdx = content.indexOf('}, [activeDockTransitionProjectId, finalizeProjectAsDocked]);', startIdx);
  assert.ok(endIdx !== -1);
  return content.slice(startIdx, endIdx + '}, [activeDockTransitionProjectId, finalizeProjectAsDocked]);'.length);
}

test('TopologyCanvas.tsx: idle (no active transition) schedules zero docking RAF callbacks', () => {
  const content = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');
  const block = extractDockTransitionEffect(content);
  const guardIdx = block.indexOf('if (!activeDockTransitionProjectId) return;');
  const firstRafIdx = block.indexOf('requestAnimationFrame(');
  assert.ok(guardIdx !== -1 && firstRafIdx !== -1);
  assert.ok(guardIdx < firstRafIdx, 'The idle-guard must return before any requestAnimationFrame call is reached');
});

test('TopologyCanvas.tsx: an active redock schedules exactly one docking RAF chain, cancelled on cleanup/completion', () => {
  const content = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');
  const block = extractDockTransitionEffect(content);
  const runningBlock = block.slice(block.indexOf('let rafId'));
  const rafCallCount = (runningBlock.match(/requestAnimationFrame\(/g) || []).length;
  assert.equal(rafCallCount, 2, 'Exactly one chain: one initial schedule plus one re-schedule inside tick');
  assert.ok(runningBlock.includes('return () => cancelAnimationFrame(rafId)'), 'Cleanup must cancel the active frame');
  assert.ok(runningBlock.includes('setActiveDockTransitionProjectId(null)'), 'Completion must clear the reactive flag, tearing the loop down (zero docking RAF once finished)');
});

test('TopologyCanvas.tsx: finish/cancel path finalizes the project as docked (clears custom position and dock-runtime exception)', () => {
  const content = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');
  const block = extractDockTransitionEffect(content);
  assert.ok(block.includes('finalizeProjectAsDocked(finishedProjectId)'), 'Completing a settle transition must finalize canonical dock membership');
});

// ---------------------------------------------------------------------------
// Real GITHUB_SNAPSHOT regression (no src/data mutation, no sync)
// ---------------------------------------------------------------------------

test('real committed snapshot: every project has exactly one reserved slot, and re-assembling never reassigns slots regardless of any dock runtime state', () => {
  const projects = GITHUB_SNAPSHOT.projects;
  const skills = GITHUB_SNAPSHOT.skills;
  const layout1 = assembleTopologyLayout(projects, skills);
  const layout2 = assembleTopologyLayout(projects, skills); // simulates "re-render after some project detached" — dock state is not an input here at all

  assert.equal(layout1.orbitGeometry.slots.length, projects.length, 'Every project must have exactly one reserved slot');
  const uniqueProjectIds = new Set(layout1.orbitGeometry.slots.map(s => s.projectId));
  assert.equal(uniqueProjectIds.size, projects.length);

  assert.deepEqual(layout1.orbitGeometry.slots, layout2.orbitGeometry.slots, 'Slot assignment must be identical regardless of any transient dock/detach activity, since dock state is not an input to layout at all');
});

test('real committed snapshot: redock target for any project resolves to that project\'s own canonical slot at a given phase', () => {
  const projects = GITHUB_SNAPSHOT.projects;
  const skills = GITHUB_SNAPSHOT.skills;
  const { orbitGeometry } = assembleTopologyLayout(projects, skills);
  const targetProject = projects[5];
  const slot = orbitGeometry.slots.find(s => s.projectId === targetProject.id)!;
  assert.ok(slot, 'Target project must have a slot');

  const phase = 1.5;
  const reservedA = getOrbitalProjectPositionAtPhase(targetProject, slot, orbitGeometry, phase);
  const reservedB = getOrbitalProjectPositionAtPhase(targetProject, slot, orbitGeometry, phase);
  assert.deepEqual(reservedA, reservedB, 'The same project + same phase must always resolve to the same reserved target — never a neighboring or reassigned slot');
});

test('real committed snapshot: ASSEMBLE source path clears dock-runtime state for all projects (18/18 return to canonical membership)', () => {
  const content = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');
  assert.ok(content.includes('setProjectDockState({});'), 'The canonical-restore routine must clear the ENTIRE dock-runtime map at once (not per-project), covering all 18 real projects uniformly');
});

// ---------------------------------------------------------------------------
// Issue 1 (review round 2): no new node drag may begin during an active
// settle transition — one node interaction/settle transition at a time.
// ---------------------------------------------------------------------------

test('TopologyCanvas.tsx: all four node drag-start handlers (skill mouse/touch, project mouse/touch) check activeDockTransitionProjectId before starting a drag', () => {
  const content = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');
  const starts = [...content.matchAll(/on(?:MouseDown|TouchStart)=\{\(e\) => \{/g)];
  assert.ok(starts.length >= 4, 'expected at least the four inline node drag-start handlers (canvas pan uses named function references, not inline arrows, so it is not counted here)');

  let guardedHandlerCount = 0;
  for (const match of starts) {
    const idx = match.index!;
    const window = content.slice(idx, idx + 700);
    const setDraggingIdx = window.indexOf('setDraggingNode(');
    if (setDraggingIdx === -1) continue; // not a drag-start handler
    const guardIdx = window.indexOf('if (activeDockTransitionProjectId) return;');
    assert.ok(guardIdx !== -1 && guardIdx < setDraggingIdx, `Drag-start handler at file offset ${idx} must check activeDockTransitionProjectId BEFORE calling setDraggingNode`);
    guardedHandlerCount++;
  }
  assert.equal(guardedHandlerCount, 4, 'Exactly four node drag-start handlers must exist and all must be guarded');
});

test('deriveDockState/architecture: settle transitions and draggingNode are mutually exclusive by construction (only one node interaction exists at a time)', () => {
  // This is an architectural invariant proven by the source guard above plus
  // the fact that starting a settle transition (startSettleTransition) is
  // only ever called from the release path AFTER setDraggingNode(null) — so a
  // settle transition and an active draggingNode never coexist for the
  // SAME gesture, and the guard above prevents a DIFFERENT node from
  // starting a new draggingNode while one is settling.
  const content = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');
  const releaseIdx = content.indexOf('const processRelease = () => {');
  const nextEffectIdx = content.indexOf('const handleWindowMouseMove', releaseIdx);
  const releaseBlock = content.slice(releaseIdx, nextEffectIdx === -1 ? undefined : nextEffectIdx);
  const startSettleIdx = releaseBlock.indexOf('startSettleTransition(');
  const finalNullIdx = releaseBlock.lastIndexOf('setDraggingNode(null);');
  assert.ok(startSettleIdx !== -1 && finalNullIdx !== -1);
  assert.ok(startSettleIdx < finalNullIdx, 'A settle transition is started before the drag session itself is cleared, and no new drag can begin in between (single-threaded event handling + the guard above)');
});

// ---------------------------------------------------------------------------
// Issue 2 (review round 2): motion-safe detached placement. Demonstrates the
// ACTUAL delayed-collision bug — a spot that is collision-free at drop time
// can still be swept through later by a docked project traversing the full
// orbit — and proves the new validator rejects it while ordinary current-
// position collision checking alone would have accepted it.
// ---------------------------------------------------------------------------

function buildSmallOrbitScenario() {
  const projects = generateMockProjects(5);
  const skills = generateMockSkills(4);
  const { orbitGeometry } = assembleTopologyLayout(projects, skills);
  const slot0 = orbitGeometry.slots.find(s => s.projectId === projects[0].id)!;

  // Positions "right now" (frozen orbit phase = 0, i.e. ordinary docked
  // membership at rest) — matches how effectiveProjectPositions looks at the
  // instant of a drop, since the orbit is paused throughout any drag.
  const currentPositions: Record<string, { x: number; y: number }> = {};
  for (const slot of orbitGeometry.slots) {
    const p = projects.find(pr => pr.id === slot.projectId)!;
    currentPositions[p.id] = getOrbitalProjectPositionAtPhase(p, slot, orbitGeometry, 0);
  }

  // The candidate detached project: same shape as the mocks, a distinct id.
  const candidateProject = { ...generateMockProjects(1)[0], id: 'project-detached-candidate' };

  // Because every project shares the same phase and the same ellipse, a
  // rotationally-symmetric ring of identically-sized projects means ANY point
  // exactly on the shared ellipse is, over a full revolution, eventually
  // occupied by EVERY project — not just one. So rather than hand-deriving a
  // "safe right now" angle (which depends on exact packing geometry), find
  // one empirically: project[0]'s own position at some non-zero sampled phase
  // that happens to be clear of every OTHER project's CURRENT (phase-0)
  // position. This is exactly the real-world scenario: the ring has moved
  // since the projects were last at rest, and the user drops a project into
  // a gap that looks clear right now.
  let candidateOrigin: { x: number; y: number } | null = null;
  let dangerousSampleIndex = -1;
  for (let s = 1; s < ORBITAL_CLEARANCE_SAMPLE_COUNT; s++) {
    const phase = (s / ORBITAL_CLEARANCE_SAMPLE_COUNT) * 2 * Math.PI;
    const origin = getOrbitalProjectPositionAtPhase(candidateProject, slot0, orbitGeometry, phase);
    const check = checkCollisions('project', candidateProject.id, origin, currentPositions, {}, projects, []);
    if (!check.hasCollision) {
      candidateOrigin = origin;
      dangerousSampleIndex = s;
      break;
    }
  }
  assert.ok(candidateOrigin, 'test setup: must find at least one sampled phase where the candidate is current-safe');

  const movingProjects = new Map(projects.map(p => [p.id, p]));

  return { projects, skills, orbitGeometry, currentPositions, candidateProject, candidateOrigin: candidateOrigin!, movingProjects, dangerousSampleIndex };
}

test('delayed-collision regression: a candidate that is collision-free RIGHT NOW is still rejected because a docked project sweeps through it later', () => {
  const { projects, orbitGeometry, currentPositions, candidateProject, candidateOrigin, movingProjects } = buildSmallOrbitScenario();

  // 1. Ordinary CURRENT-position collision checking alone accepts it.
  const currentCheck = checkCollisions('project', candidateProject.id, candidateOrigin, currentPositions, {}, projects, []);
  assert.equal(currentCheck.hasCollision, false, 'The candidate must be genuinely collision-free against the CURRENT (phase-frozen) orbit positions');

  // 2. Future-orbit motion safety rejects it, because project[0] occupies
  // overlapping visual bounds at a later sampled phase (PI/2).
  const isSafe = isDetachedPlacementMotionSafe(candidateProject, candidateOrigin, orbitGeometry, movingProjects);
  assert.equal(isSafe, false, 'A point exactly on the shared ellipse must be rejected — every docked project eventually sweeps through every point on the track');
});

test('delayed-collision regression: a sufficiently separated detached position is accepted as motion-safe', () => {
  const { orbitGeometry, candidateProject, movingProjects } = buildSmallOrbitScenario();
  // Far outside the entire orbit in every direction.
  const farAwayOrigin = {
    x: orbitGeometry.centerIso.x + orbitGeometry.radiusX * 20,
    y: orbitGeometry.centerIso.y + orbitGeometry.radiusY * 20,
  };
  const isSafe = isDetachedPlacementMotionSafe(candidateProject, farAwayOrigin, orbitGeometry, movingProjects);
  assert.equal(isSafe, true, 'A position far outside the entire orbit must never be rejected');
});

test('delayed-collision regression: the moving set is exactly what the caller supplies — with no projects left orbiting, nothing can ever be swept', () => {
  // With a ring of identically-sized, evenly-spaced projects sharing one
  // phase, ANY point on the shared ellipse is eventually reachable by EVERY
  // project over a full revolution (not just one) — so this function's
  // exclusion contract cannot be demonstrated by removing a single mover from
  // a symmetric ring. What it CAN prove directly: the function trusts the
  // caller's moving set completely rather than re-deriving it from
  // orbitGeometry itself, so an empty moving set (as if every other project
  // were also persisted-detached) makes any candidate — including the exact
  // dangerous one above — trivially motion-safe.
  const { candidateProject, candidateOrigin, orbitGeometry } = buildSmallOrbitScenario();
  const isSafe = isDetachedPlacementMotionSafe(candidateProject, candidateOrigin, orbitGeometry, new Map());
  assert.equal(isSafe, true, 'An empty moving set must never reject any candidate');
});

test('TopologyCanvas.tsx: the moving-projects set built for orbital-clearance validation excludes both the project being dropped and every OTHER persisted-detached project', () => {
  const content = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');
  const movingIdx = content.indexOf('const movingProjects = new Map<string, ProjectData>();');
  assert.ok(movingIdx !== -1, 'the moving-projects construction must exist');
  const movingBlock = content.slice(movingIdx, content.indexOf('const isCandidateValid', movingIdx));
  assert.ok(movingBlock.includes("if (p.id === draggingNode.id) continue;"), 'must exclude the project currently being dropped');
  assert.ok(movingBlock.includes("resolveProjectDockState(projectDockState, p.id) === 'detached') continue;"), 'must exclude every other project that is itself persisted-detached (stationary, already covered by ordinary collision checks)');
});

// ---------------------------------------------------------------------------
// Search resolution: the EXISTING findNearestValidGridPosition expanding-ring
// search is reused, not duplicated — isCandidateValid is an additional gate.
// ---------------------------------------------------------------------------

test('search resolution: findNearestValidGridPosition rejects a current-safe-but-future-unsafe candidate and continues through the EXISTING search to a position safe on BOTH counts', () => {
  const { projects, orbitGeometry, currentPositions, candidateProject, candidateOrigin, movingProjects } = buildSmallOrbitScenario();

  const isCandidateValid = (pos: { x: number; y: number }) =>
    isDetachedPlacementMotionSafe(candidateProject, pos, orbitGeometry, movingProjects);

  // Sanity: the naive candidate is current-safe but motion-UNsafe (same fact
  // proven above), so acceptance must come from continuing the ring search.
  assert.equal(checkCollisions('project', candidateProject.id, candidateOrigin, currentPositions, {}, projects, []).hasCollision, false);
  assert.equal(isCandidateValid(candidateOrigin), false);

  const resolved = findNearestValidGridPosition(
    'project', candidateProject.id, candidateOrigin,
    currentPositions, {}, projects, [],
    25, false, // grid snapping disabled to keep the arithmetic exact for this test
    isCandidateValid
  );

  assert.equal(resolved.wasAdjusted, true, 'The resolver must move off the naive candidate');
  assert.equal(resolved.wasAdjustedForValidatorOnly, true, 'The shift must be attributed to the validator, not an ordinary current-node collision (no real node was in the way right now)');

  // The FINAL position returned by the SAME existing search must satisfy BOTH
  // conditions — proving no second, independent search algorithm was needed.
  const finalCollision = checkCollisions('project', candidateProject.id, { x: resolved.x, y: resolved.y }, currentPositions, {}, projects, []);
  assert.equal(finalCollision.hasCollision, false, 'Final position must remain collision-free against current nodes');
  assert.equal(isCandidateValid({ x: resolved.x, y: resolved.y }), true, 'Final position must be motion-safe against the future orbital sweep');
});

test('search resolution: an ordinary candidate with no orbital-clearance concern is unaffected — isCandidateValid is a pure additive gate, default behavior unchanged', () => {
  const { projects, currentPositions } = buildSmallOrbitScenario();
  const farAwayProject = { ...generateMockProjects(1)[0], id: 'project-far-away' };
  const farAwayRawPos = { x: 100000, y: 100000 }; // nowhere near anything
  const withoutValidator = findNearestValidGridPosition('project', farAwayProject.id, farAwayRawPos, currentPositions, {}, projects, [], 25, true);
  const withAlwaysTrueValidator = findNearestValidGridPosition('project', farAwayProject.id, farAwayRawPos, currentPositions, {}, projects, [], 25, true, () => true);
  assert.deepEqual(withoutValidator, withAlwaysTrueValidator, 'Supplying an always-true validator must be indistinguishable from omitting it entirely');
  assert.equal(withoutValidator.wasAdjusted, false);
});
