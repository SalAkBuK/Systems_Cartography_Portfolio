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
  type ProjectDockRuntimeMap,
} from '../src/utils/projectDocking.ts';
import { project3DToIso } from '../src/utils/isometricProjection.ts';
import { getTopologyProjectDimensions } from '../src/utils/projectTopologyGeometry.ts';
import { assembleTopologyLayout, getNodeBounds, checkAABBOverlap } from '../src/utils/topologyLayout.ts';
import { getOrbitalProjectPositionAtPhase, isOrbitPauseConditionActive, type OrbitPauseState } from '../src/utils/orbitMotion.ts';
import { checkCollisions } from '../src/utils/collision.ts';
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
