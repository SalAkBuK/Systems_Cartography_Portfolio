import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  DETACH_THRESHOLD_ISO,
  PULL_RESISTANCE,
  ORBIT_CAPTURE_BAND_ISO,
  MAX_CAPTURE_PULL,
  ABORTED_PULL_RETURN_MS,
  ORBIT_REFLOW_DURATION_MS,
  resolveProjectDockState,
  getProjectVisualCenterIso,
  getWorldOriginForIsoCenter,
  lerpPoint,
  hasCrossedDetachThreshold,
  computeResistedWorldOrigin,
  computeFreeWorldOrigin,
  computeCaptureAttraction,
  computeMagneticRenderPosition,
  projectPointOntoOrbitEllipse,
  resolveOrbitInsertionIndex,
  removeProjectFromOrbitOrder,
  insertProjectIntoOrbitOrder,
  deriveDockState,
  resolveOrbitReleaseAction,
  stepOrbitReflow,
  buildOrbitReflowPlan,
  resolveOrbitReflowEndpoint,
  resolveOrbitReflowPositions,
  isDetachedPlacementMotionSafe,
  ORBITAL_CLEARANCE_SAMPLE_COUNT,
  type ProjectDockRuntimeMap,
  type OrbitReflowTransition,
  type OrbitReflowPlan,
} from '../src/utils/projectDocking.ts';
import { project3DToIso } from '../src/utils/isometricProjection.ts';
import { getTopologyProjectDimensions, getTopologyProjectVisualBounds } from '../src/utils/projectTopologyGeometry.ts';
import { assembleTopologyLayout, checkAABBOverlap, getNodeBounds, type StaticOrbitGeometry } from '../src/utils/topologyLayout.ts';
import { getDynamicOrbitalPosition, getOrbitalProjectPositionAtPhase, isOrbitPauseConditionActive, type OrbitPauseState } from '../src/utils/orbitMotion.ts';
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

// A helper that builds a docked order (array of ids, in relative order) plus
// the projects those ids resolve to, from the first N of a generated set.
function dockedOrderOf(projects: ProjectData[]): string[] {
  return projects.map(p => p.id);
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

test('resolveOrbitReleaseAction: only a project already persisted detached may insert from whole-ellipse capture', () => {
  assert.equal(resolveOrbitReleaseAction('detached', 'capturing'), 'insert-detached-project');
});

test('resolveOrbitReleaseAction: below-threshold docked release returns to its existing dock', () => {
  assert.equal(resolveOrbitReleaseAction('docked', 'detaching'), 'return-to-existing-dock');
});

test('resolveOrbitReleaseAction: same-gesture docked breakaway and recapture cancels detach instead of inserting', () => {
  assert.equal(resolveOrbitReleaseAction('docked', 'capturing'), 'return-to-existing-dock');
});

test('resolveOrbitReleaseAction: normal release away from the orbit places detached', () => {
  assert.equal(resolveOrbitReleaseAction('docked', 'detached'), 'place-detached');
  assert.equal(resolveOrbitReleaseAction('detached', 'detached'), 'place-detached');
});

// ---------------------------------------------------------------------------
// Resistance (mandatory numeric proof)
// ---------------------------------------------------------------------------

test('computeResistedWorldOrigin: iso-space pull magnitude = pointer delta * PULL_RESISTANCE', () => {
  assert.equal(PULL_RESISTANCE, 0.28);
  const start = { x: 0, y: 0 };
  const isoDelta = 20;
  const resisted = computeResistedWorldOrigin(start, isoDelta, 0);
  const resistedIso = project3DToIso(resisted.x, resisted.y, 0);
  const magnitude = Math.hypot(resistedIso.x, resistedIso.y);
  assert.ok(Math.abs(magnitude - isoDelta * PULL_RESISTANCE) < 1e-9, `expected ~${isoDelta * PULL_RESISTANCE}, got ${magnitude}`);
});

test('computeResistedWorldOrigin: resistance is independent of viewport zoom (the function only ever sees an already-normalized iso-space delta)', () => {
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

  const justBefore = computeResistedWorldOrigin(start, DETACH_THRESHOLD_ISO - epsilon, 0);
  assert.ok(hasCrossedDetachThreshold(DETACH_THRESHOLD_ISO + epsilon, 0));
  const atCrossing = computeResistedWorldOrigin(start, DETACH_THRESHOLD_ISO + epsilon, 0);

  const jumpDistance = Math.hypot(atCrossing.x - justBefore.x, atCrossing.y - justBefore.y);
  assert.ok(jumpDistance < 1, `breakaway produced a visible jump of ${jumpDistance} world units`);

  const immediatelyAfterBreakaway = computeFreeWorldOrigin(atCrossing, 0, 0);
  assert.deepEqual(immediatelyAfterBreakaway, atCrossing);
});

test('breakaway continuity: this transition happens exactly once per gesture (caller-owned sticky flag, not re-derived every tick)', () => {
  const afterCrossing = deriveDockState({ persistedState: 'docked', isDragging: true, hasCrossedThresholdThisGesture: true, isWithinCaptureRadius: false });
  assert.notEqual(afterCrossing, 'detaching');
});

// ---------------------------------------------------------------------------
// Capture attraction tests
// ---------------------------------------------------------------------------

test('computeCaptureAttraction: beyond the capture band yields zero strength (detached, not capturing)', () => {
  const result = computeCaptureAttraction(ORBIT_CAPTURE_BAND_ISO + 1);
  assert.equal(result.isWithinCaptureRadius, false);
  assert.equal(result.strength, 0);
});

test('computeCaptureAttraction: just inside the band yields weak attraction; near the target yields stronger attraction; monotonic throughout', () => {
  const samples = [ORBIT_CAPTURE_BAND_ISO - 1, ORBIT_CAPTURE_BAND_ISO * 0.75, ORBIT_CAPTURE_BAND_ISO * 0.5, ORBIT_CAPTURE_BAND_ISO * 0.25, 5, 0.5];
  let previousStrength = -1;
  for (const distance of samples) {
    const result = computeCaptureAttraction(distance);
    assert.ok(result.isWithinCaptureRadius);
    assert.ok(result.strength >= previousStrength, `strength must be monotonic as distance decreases (distance=${distance})`);
    previousStrength = result.strength;
  }
  assert.ok(previousStrength > 0);
});

test('computeCaptureAttraction: at distance 0, attraction caps at MAX_CAPTURE_PULL exactly (preview never fully snaps)', () => {
  assert.equal(MAX_CAPTURE_PULL, 0.40);
  const result = computeCaptureAttraction(0);
  assert.equal(result.proximity, 1);
  assert.equal(result.strength, MAX_CAPTURE_PULL);
});

test('computeCaptureAttraction: no discontinuity exactly at the capture band boundary', () => {
  const justInside = computeCaptureAttraction(ORBIT_CAPTURE_BAND_ISO - 0.001);
  const exactlyAt = computeCaptureAttraction(ORBIT_CAPTURE_BAND_ISO);
  const justOutside = computeCaptureAttraction(ORBIT_CAPTURE_BAND_ISO + 0.001);
  assert.ok(justInside.strength < 0.001);
  assert.equal(exactlyAt.strength, 0);
  assert.equal(justOutside.strength, 0);
  assert.equal(exactlyAt.isWithinCaptureRadius, true);
  assert.equal(justOutside.isWithinCaptureRadius, false);
});

test('computeMagneticRenderPosition: never teleports — blends smoothly and equals raw position at zero strength', () => {
  const raw = { x: 100, y: 200 };
  const projectedOrbitPoint = { x: 300, y: 250 };
  assert.deepEqual(computeMagneticRenderPosition(raw, projectedOrbitPoint, 0), raw);
  const blended = computeMagneticRenderPosition(raw, projectedOrbitPoint, 0.2);
  assert.deepEqual(blended, lerpPoint(raw, projectedOrbitPoint, 0.2));
  assert.ok(blended.x > raw.x && blended.x < projectedOrbitPoint.x);
});

// ---------------------------------------------------------------------------
// Whole-ellipse orbit projection: capture works at ANY angle, not a fixed slot.
// ---------------------------------------------------------------------------

test('projectPointOntoOrbitEllipse: projects onto the top, right, bottom, and left of the ellipse', () => {
  const orbitGeometry = { centerIso: { x: 0, y: 0 }, radiusX: 100, radiusY: 50 };

  const top = projectPointOntoOrbitEllipse({ x: 0, y: -200 }, orbitGeometry);
  assert.ok(Math.abs(top.projectedPoint.x) < 1e-6);
  assert.ok(Math.abs(top.projectedPoint.y - (-50)) < 1e-6);

  const right = projectPointOntoOrbitEllipse({ x: 400, y: 0 }, orbitGeometry);
  assert.ok(Math.abs(right.projectedPoint.x - 100) < 1e-6);
  assert.ok(Math.abs(right.projectedPoint.y) < 1e-6);

  const bottom = projectPointOntoOrbitEllipse({ x: 0, y: 300 }, orbitGeometry);
  assert.ok(Math.abs(bottom.projectedPoint.x) < 1e-6);
  assert.ok(Math.abs(bottom.projectedPoint.y - 50) < 1e-6);

  const left = projectPointOntoOrbitEllipse({ x: -900, y: 0 }, orbitGeometry);
  assert.ok(Math.abs(left.projectedPoint.x - (-100)) < 1e-6);
  assert.ok(Math.abs(left.projectedPoint.y) < 1e-6);
});

test('projectPointOntoOrbitEllipse: works at arbitrary diagonal angles too, always landing exactly on the ellipse', () => {
  const orbitGeometry = { centerIso: { x: 50, y: -30 }, radiusX: 200, radiusY: 120 };
  for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1], [3, 1], [-2, 5]]) {
    const point = { x: orbitGeometry.centerIso.x + dx * 500, y: orbitGeometry.centerIso.y + dy * 500 };
    const { projectedPoint } = projectPointOntoOrbitEllipse(point, orbitGeometry);
    const normalized =
      ((projectedPoint.x - orbitGeometry.centerIso.x) ** 2) / (orbitGeometry.radiusX ** 2) +
      ((projectedPoint.y - orbitGeometry.centerIso.y) ** 2) / (orbitGeometry.radiusY ** 2);
    assert.ok(Math.abs(normalized - 1) < 1e-9, `projected point must lie exactly on the ellipse (dx=${dx},dy=${dy})`);
  }
});

test('capture band works uniformly around the entire ellipse, not just at any one project\'s original slot', () => {
  const orbitGeometry = { centerIso: { x: 0, y: 0 }, radiusX: 300, radiusY: 200 };
  const angles = [0, Math.PI / 4, Math.PI / 2, Math.PI, (3 * Math.PI) / 2, 2.1, -1.4];
  for (const angle of angles) {
    const onEllipse = { x: orbitGeometry.radiusX * Math.cos(angle), y: orbitGeometry.radiusY * Math.sin(angle) };
    const nudged = { x: onEllipse.x * 1.02, y: onEllipse.y * 1.02 }; // just outside, small nudge
    const { distanceIso } = projectPointOntoOrbitEllipse(nudged, orbitGeometry);
    const attraction = computeCaptureAttraction(distanceIso);
    assert.ok(attraction.isWithinCaptureRadius, `a small nudge off the ellipse at angle=${angle} must remain within the capture band`);
  }
});

// ---------------------------------------------------------------------------
// resolveOrbitInsertionIndex: phase compensation + relative-order preservation
// ---------------------------------------------------------------------------

test('resolveOrbitInsertionIndex: a point at slot 0\'s own angle inserts after it (index 1) — ties resolve consistently', () => {
  const N = 5;
  const step = (2 * Math.PI) / N;
  const theta = -Math.PI / 2; // exactly index 0's angle at phase 0
  const index = resolveOrbitInsertionIndex(theta, 0, N);
  assert.equal(index, 1);
  void step;
});

test('resolveOrbitInsertionIndex: matches the spec\'s own worked example — dropping between E and F inserts exactly there, preserving every other project\'s relative order', () => {
  // current docked order: A B D E F (E=index3, F=index4 at phase 0)
  const order = ['A', 'B', 'D', 'E', 'F'];
  const N = order.length;
  const angleOf = (i: number) => -Math.PI / 2 + (i / N) * 2 * Math.PI;
  const thetaBetweenEandF = (angleOf(3) + angleOf(4)) / 2; // strictly between E and F

  const insertionIndex = resolveOrbitInsertionIndex(thetaBetweenEandF, 0, N);
  const newOrder = insertProjectIntoOrbitOrder(order, 'C', insertionIndex, ['A', 'B', 'C', 'D', 'E', 'F']);

  assert.deepEqual(newOrder, ['A', 'B', 'D', 'E', 'C', 'F'], 'C must land strictly between E and F, matching the spec example exactly');
});

test('same-gesture docked breakaway + capture: C returns once in unchanged A B C D E F membership with no detached persistence', () => {
  const canonicalOrder = ['A', 'B', 'C', 'D', 'E', 'F'];
  const persistedState = 'docked' as const;
  const dockStateAtRelease = deriveDockState({
    persistedState,
    isDragging: true,
    hasCrossedThresholdThisGesture: true,
    isWithinCaptureRadius: true,
  });
  const action = resolveOrbitReleaseAction(persistedState, dockStateAtRelease);

  assert.equal(action, 'return-to-existing-dock');
  const finalOrder = canonicalOrder;
  const finalDockMap: ProjectDockRuntimeMap = {};
  const finalCustomPositions: Record<string, { x: number; y: number }> = {};

  assert.equal(finalOrder.length, 6, 'must not create N+1 phantom spacing');
  assert.equal(finalOrder.filter(id => id === 'C').length, 1, 'C must appear exactly once');
  assert.deepEqual(finalOrder, canonicalOrder, 'same-gesture capture must preserve canonical relative order');
  assert.equal(resolveProjectDockState(finalDockMap, 'C'), 'docked');
  assert.equal(finalCustomPositions.C, undefined, 'no detached custom position may persist');
});

test('resolveOrbitInsertionIndex: accounts for orbitPhase — the same absolute visual angle produces different logical insertion points as the ring rotates', () => {
  const N = 4;
  const absoluteTheta = 0; // fixed visual angle
  const indexAtPhase0 = resolveOrbitInsertionIndex(absoluteTheta, 0, N);
  const indexAtPhaseQuarterTurn = resolveOrbitInsertionIndex(absoluteTheta, Math.PI / 2, N);
  assert.notEqual(indexAtPhase0, indexAtPhaseQuarterTurn, 'rotating the ring by a quarter turn must change which logical gap a fixed visual angle falls into');
});

test('resolveOrbitInsertionIndex: subtracting the CORRECT frozen phase recovers the same logical insertion point regardless of how far the ring had rotated', () => {
  const N = 6;
  const order = ['P0', 'P1', 'P2', 'P3', 'P4', 'P5'];
  const angleOf = (i: number, phase: number) => -Math.PI / 2 + (i / N) * 2 * Math.PI + phase;

  for (const phase of [0, 0.7, Math.PI, 4.2, -1.9]) {
    const thetaBetween2and3 = (angleOf(2, phase) + angleOf(3, phase)) / 2;
    const insertionIndex = resolveOrbitInsertionIndex(thetaBetween2and3, phase, N);
    const newOrder = [...order];
    newOrder.splice(insertionIndex, 0, 'NEW');
    assert.deepEqual(newOrder, ['P0', 'P1', 'P2', 'NEW', 'P3', 'P4', 'P5'], `phase=${phase} must resolve to the same logical gap`);
  }
});

test('resolveOrbitInsertionIndex: index 0 request wraps to the empty-ring default and general results always stay in [0, N]', () => {
  assert.equal(resolveOrbitInsertionIndex(0, 0, 0), 0);
  const N = 7;
  for (let s = 0; s < 72; s++) {
    const theta = (s / 72) * 2 * Math.PI - Math.PI;
    const index = resolveOrbitInsertionIndex(theta, 0.3, N);
    assert.ok(index >= 0 && index <= N, `index ${index} out of [0, ${N}] range at theta=${theta}`);
  }
});

// ---------------------------------------------------------------------------
// getDynamicOrbitalPosition: canonical/interactive unification, redistribution
// ---------------------------------------------------------------------------

test('getDynamicOrbitalPosition: at full membership (index == canonical slot index, N == total), matches the canonical per-slot formula exactly', () => {
  const projects = generateMockProjects(10);
  const skills = generateMockSkills(5);
  const { orbitGeometry } = assembleTopologyLayout(projects, skills);

  for (const slot of orbitGeometry.slots) {
    const project = projects.find(p => p.id === slot.projectId)!;
    const phase = 0.85;
    const dynamicPos = getDynamicOrbitalPosition(project, slot.slotIndex, orbitGeometry.slots.length, orbitGeometry, phase);
    const canonicalPos = getOrbitalProjectPositionAtPhase(project, slot, orbitGeometry, phase);
    assert.ok(Math.abs(dynamicPos.x - canonicalPos.x) < 1e-6, `x mismatch for slot ${slot.slotIndex}`);
    assert.ok(Math.abs(dynamicPos.y - canonicalPos.y) < 1e-6, `y mismatch for slot ${slot.slotIndex}`);
  }

  const slot0 = orbitGeometry.slots[0];
  const project0 = projects.find(p => p.id === slot0.projectId)!;
  const atPhaseZero = getDynamicOrbitalPosition(project0, slot0.slotIndex, orbitGeometry.slots.length, orbitGeometry, 0);
  assert.ok(Math.abs(atPhaseZero.x - slot0.worldX) < 1e-6);
  assert.ok(Math.abs(atPhaseZero.y - slot0.worldY) < 1e-6);
});

test('getDynamicOrbitalPosition: canonical order is deterministic — same inputs always produce the same position', () => {
  const projects = generateMockProjects(8);
  const skills = generateMockSkills(4);
  const { orbitGeometry } = assembleTopologyLayout(projects, skills);
  const a = getDynamicOrbitalPosition(projects[3], 3, 8, orbitGeometry, 1.2);
  const b = getDynamicOrbitalPosition(projects[3], 3, 8, orbitGeometry, 1.2);
  assert.deepEqual(a, b);
});

test('getDynamicOrbitalPosition: detaching one project removes only that identity — remaining relative order stays identical and produces exact 2π/(N-1) spacing', () => {
  const projects = generateMockProjects(6);
  const skills = generateMockSkills(4);
  const { orbitGeometry } = assembleTopologyLayout(projects, skills);
  const fullOrder = orbitGeometry.slots.map(s => s.projectId).sort((a, b) =>
    orbitGeometry.slots.find(s => s.projectId === a)!.slotIndex - orbitGeometry.slots.find(s => s.projectId === b)!.slotIndex
  );

  const detachedId = fullOrder[2];
  const remainingOrder = fullOrder.filter(id => id !== detachedId);
  assert.equal(remainingOrder.length, 5);
  // Relative order of every OTHER identity must be unchanged (no resort).
  assert.deepEqual(remainingOrder, fullOrder.filter(id => id !== detachedId));

  const angleStep = (2 * Math.PI) / remainingOrder.length;
  for (let i = 0; i < remainingOrder.length; i++) {
    const project = projects.find(p => p.id === remainingOrder[i])!;
    const pos = getDynamicOrbitalPosition(project, i, remainingOrder.length, orbitGeometry, 0);
    const expectedAngle = -Math.PI / 2 + i * angleStep;
    const expectedIso = {
      x: orbitGeometry.centerIso.x + orbitGeometry.radiusX * Math.cos(expectedAngle),
      y: orbitGeometry.centerIso.y + orbitGeometry.radiusY * Math.sin(expectedAngle),
    };
    const actualIso = project3DToIso(pos.x + getTopologyProjectDimensions(project).width / 2, pos.y + getTopologyProjectDimensions(project).depth / 2, 0);
    assert.ok(Math.abs(actualIso.x - expectedIso.x) < 1e-6, `iso x mismatch at index ${i}`);
    assert.ok(Math.abs(actualIso.y - expectedIso.y) < 1e-6, `iso y mismatch at index ${i}`);
  }
});

test('getDynamicOrbitalPosition: the SAME fixed ellipse (center/radii) is reused after membership changes — the ring never contracts or expands', () => {
  const projects = generateMockProjects(6);
  const skills = generateMockSkills(4);
  const { orbitGeometry } = assembleTopologyLayout(projects, skills);
  const posAt6 = getDynamicOrbitalPosition(projects[0], 0, 6, orbitGeometry, 0);
  const posAt5 = getDynamicOrbitalPosition(projects[0], 0, 5, orbitGeometry, 0);
  // Both must be exactly on the SAME ellipse (same center/radii) — only the
  // angular position (governed by N) differs, never the ellipse's shape.
  const isoAt6 = project3DToIso(posAt6.x + getTopologyProjectDimensions(projects[0]).width / 2, posAt6.y + getTopologyProjectDimensions(projects[0]).depth / 2, 0);
  const isoAt5 = project3DToIso(posAt5.x + getTopologyProjectDimensions(projects[0]).width / 2, posAt5.y + getTopologyProjectDimensions(projects[0]).depth / 2, 0);
  const onEllipse = (p: { x: number; y: number }) =>
    ((p.x - orbitGeometry.centerIso.x) ** 2) / (orbitGeometry.radiusX ** 2) + ((p.y - orbitGeometry.centerIso.y) ** 2) / (orbitGeometry.radiusY ** 2);
  assert.ok(Math.abs(onEllipse(isoAt6) - 1) < 1e-9);
  assert.ok(Math.abs(onEllipse(isoAt5) - 1) < 1e-9);
  // Index 0 sits at the same base angle (-π/2) regardless of N, so both are identical.
  assert.ok(Math.abs(isoAt6.x - isoAt5.x) < 1e-6 && Math.abs(isoAt6.y - isoAt5.y) < 1e-6);
});

test('getDynamicOrbitalPosition: reinserting a project (N-1 -> N) yields exact 2π/N spacing with no empty dedicated slot left behind', () => {
  const projects = generateMockProjects(6);
  const skills = generateMockSkills(4);
  const { orbitGeometry } = assembleTopologyLayout(projects, skills);
  const order = orbitGeometry.slots.slice().sort((a, b) => a.slotIndex - b.slotIndex).map(s => s.projectId);

  // detach index 2, then reinsert at the same spot -> back to 6, exact 2π/6 spacing, no gap.
  const reduced = order.filter((_, i) => i !== 2);
  const reinserted = [...reduced];
  reinserted.splice(2, 0, order[2]);
  assert.deepEqual(reinserted, order, 'reinserting at the same logical position must exactly reproduce the original order');

  const angleStep = (2 * Math.PI) / reinserted.length;
  for (let i = 0; i < reinserted.length; i++) {
    const project = projects.find(p => p.id === reinserted[i])!;
    const pos = getDynamicOrbitalPosition(project, i, reinserted.length, orbitGeometry, 0);
    const dims = getTopologyProjectDimensions(project);
    const iso = project3DToIso(pos.x + dims.width / 2, pos.y + dims.depth / 2, 0);
    const expectedAngle = -Math.PI / 2 + i * angleStep;
    assert.ok(Math.abs(iso.x - (orbitGeometry.centerIso.x + orbitGeometry.radiusX * Math.cos(expectedAngle))) < 1e-6);
    assert.ok(Math.abs(iso.y - (orbitGeometry.centerIso.y + orbitGeometry.radiusY * Math.sin(expectedAngle))) < 1e-6);
  }
});

// ---------------------------------------------------------------------------
// Shared orbital reflow transition (stepOrbitReflow) — ONE eased progress
// value applied to every affected project's position at once. PR24: targets
// are SLOT descriptors resolved against a live phase every call, never
// frozen positions — these fixture helpers use 'fixed' endpoints (which
// ignore project/orbitGeometry/livePhase entirely) to isolate and test the
// pure timing/easing/shared-progress mechanics independent of geometry.
// ---------------------------------------------------------------------------

const dummyProject = {};
const dummyOrbitGeometry = { centerIso: { x: 0, y: 0 }, radiusX: 100, radiusY: 60 };
const resolveDummyProject = () => dummyProject;

function fixedPlan(
  entries: Record<string, { from: { x: number; y: number }; to: { x: number; y: number } }>
): OrbitReflowPlan {
  const plan: OrbitReflowPlan = {};
  for (const id of Object.keys(entries)) {
    plan[id] = {
      from: { kind: 'fixed', position: entries[id].from },
      to: { kind: 'fixed', position: entries[id].to },
    };
  }
  return plan;
}

test('stepOrbitReflow: elapsed-time based ease-out with no overshoot, reaching exactly the `to` endpoint at/after the duration', () => {
  const transition: OrbitReflowTransition = {
    plan: fixedPlan({ a: { from: { x: 0, y: 0 }, to: { x: 100, y: 0 } } }),
    durationMs: ABORTED_PULL_RETURN_MS,
    startTimestamp: 1000,
  };
  const midStep = stepOrbitReflow(transition, 1000 + ABORTED_PULL_RETURN_MS / 2, 0, dummyOrbitGeometry, resolveDummyProject);
  assert.ok(midStep.positions.a.x > 0 && midStep.positions.a.x < 100, 'must be strictly between start and end mid-flight');
  assert.ok(!midStep.isComplete);

  const overStep = stepOrbitReflow(transition, 1000 + ABORTED_PULL_RETURN_MS + 50, 0, dummyOrbitGeometry, resolveDummyProject);
  assert.equal(overStep.isComplete, true);
  assert.deepEqual(overStep.positions, { a: { x: 100, y: 0 } });

  for (let t = 0; t <= ABORTED_PULL_RETURN_MS; t += 10) {
    const step = stepOrbitReflow(transition, 1000 + t, 0, dummyOrbitGeometry, resolveDummyProject);
    assert.ok(step.positions.a.x >= -1e-6 && step.positions.a.x <= 100 + 1e-6, `overshoot detected at t=${t}: x=${step.positions.a.x}`);
  }
});

test('stepOrbitReflow: every affected project shares the EXACT SAME eased progress value — no project ever lags behind another', () => {
  const transition: OrbitReflowTransition = {
    plan: fixedPlan({
      a: { from: { x: 0, y: 0 }, to: { x: 200, y: 0 } },
      b: { from: { x: 0, y: 100 }, to: { x: 0, y: 400 } },
      c: { from: { x: -50, y: -50 }, to: { x: 150, y: -50 } },
    }),
    durationMs: ORBIT_REFLOW_DURATION_MS,
    startTimestamp: 0,
  };
  const step = stepOrbitReflow(transition, ORBIT_REFLOW_DURATION_MS * 0.4, 0, dummyOrbitGeometry, resolveDummyProject);
  const tA = (step.positions.a.x - 0) / (200 - 0);
  const tB = (step.positions.b.y - 100) / (400 - 100);
  const tC = (step.positions.c.x - (-50)) / (150 - (-50));
  assert.ok(Math.abs(tA - tB) < 1e-9 && Math.abs(tB - tC) < 1e-9, 'all three projects must interpolate by the identical fraction at any given tick');
  assert.ok(Math.abs(tA - step.progress) < 1e-9, 'per-project fraction must equal the single shared progress value');
});

test('stepOrbitReflow: with no startTimestamp yet (first tick), holds the `from` endpoint with zero progress rather than jumping ahead', () => {
  const transition: OrbitReflowTransition = {
    plan: fixedPlan({ a: { from: { x: 5, y: 5 }, to: { x: 500, y: 500 } } }),
    durationMs: 220,
    startTimestamp: null,
  };
  const result = stepOrbitReflow(transition, 12345, 0, dummyOrbitGeometry, resolveDummyProject);
  assert.deepEqual(result.positions, { a: { x: 5, y: 5 } });
  assert.equal(result.progress, 0);
  assert.equal(result.isComplete, false);
});

// ---------------------------------------------------------------------------
// PR24 moving-frame reflow: 'slot' endpoints are resolved against the LIVE
// phase every call, never a snapshot — this is what lets the autonomous
// orbit keep advancing throughout a reflow with zero discontinuity at handoff.
// ---------------------------------------------------------------------------

test('buildOrbitReflowPlan: an untouched project keeps the SAME slot (from === to) when membership/order does not change for it', () => {
  const plan = buildOrbitReflowPlan(['a', 'b', 'c'], ['a', 'b', 'c'], { b: { x: 42, y: 7 } });
  assert.deepEqual(plan.a, { from: { kind: 'slot', index: 0, count: 3 }, to: { kind: 'slot', index: 0, count: 3 } });
  assert.deepEqual(plan.c, { from: { kind: 'slot', index: 2, count: 3 }, to: { kind: 'slot', index: 2, count: 3 } });
  assert.deepEqual(plan.b, { from: { kind: 'fixed', position: { x: 42, y: 7 } }, to: { kind: 'slot', index: 1, count: 3 } });
});

test('buildOrbitReflowPlan: a detach (18 -> 17) gives every remaining project its old and new slot, excludes the departing id entirely', () => {
  const previous = ['a', 'b', 'c', 'd'];
  const next = ['a', 'c', 'd']; // b detached
  const plan = buildOrbitReflowPlan(previous, next, {});
  assert.equal(Object.keys(plan).length, 3, 'the departing project must not appear in the plan at all');
  assert.deepEqual(plan.a, { from: { kind: 'slot', index: 0, count: 4 }, to: { kind: 'slot', index: 0, count: 3 } });
  assert.deepEqual(plan.c, { from: { kind: 'slot', index: 2, count: 4 }, to: { kind: 'slot', index: 1, count: 3 } });
  assert.deepEqual(plan.d, { from: { kind: 'slot', index: 3, count: 4 }, to: { kind: 'slot', index: 2, count: 3 } });
});

test('buildOrbitReflowPlan: a reinsertion (17 -> 18) gives the returning project a fixed drag-position `from` and every other project its old/new slot', () => {
  const previous = ['a', 'c', 'd'];
  const next = ['a', 'b', 'c', 'd']; // b reinserted at index 1
  const plan = buildOrbitReflowPlan(previous, next, { b: { x: 11, y: -3 } });
  assert.deepEqual(plan.b, { from: { kind: 'fixed', position: { x: 11, y: -3 } }, to: { kind: 'slot', index: 1, count: 4 } });
  assert.deepEqual(plan.a, { from: { kind: 'slot', index: 0, count: 3 }, to: { kind: 'slot', index: 0, count: 4 } });
  assert.deepEqual(plan.d, { from: { kind: 'slot', index: 2, count: 3 }, to: { kind: 'slot', index: 3, count: 4 } });
});

test('resolveOrbitReflowEndpoint: a slot endpoint tracks the live phase; a fixed endpoint ignores it entirely', () => {
  const geometry = { centerIso: { x: 0, y: 0 }, radiusX: 100, radiusY: 100 };
  const project = {};
  const atPhaseZero = resolveOrbitReflowEndpoint({ kind: 'slot', index: 0, count: 4 }, project, geometry, 0);
  const atPhaseHalfPi = resolveOrbitReflowEndpoint({ kind: 'slot', index: 0, count: 4 }, project, geometry, Math.PI / 2);
  assert.notDeepEqual(atPhaseZero, atPhaseHalfPi, 'a slot endpoint must move with the live phase');

  const fixed = { kind: 'fixed' as const, position: { x: 7, y: 9 } };
  assert.deepEqual(resolveOrbitReflowEndpoint(fixed, project, geometry, 0), { x: 7, y: 9 });
  assert.deepEqual(resolveOrbitReflowEndpoint(fixed, project, geometry, Math.PI), { x: 7, y: 9 });
});

test('resolveOrbitReflowPositions/stepOrbitReflow: completion at progress=1 against a given live phase EXACTLY matches getDynamicOrbitalPosition at that same phase — zero-jump handoff', () => {
  const geometry = { centerIso: { x: 0, y: 0 }, radiusX: 120, radiusY: 80 };
  const project = {};
  const previous = ['a', 'b', 'c', 'd'];
  const next = ['a', 'c', 'd'];
  const plan = buildOrbitReflowPlan(previous, next, {});

  for (const livePhaseAtCompletion of [0, 1.2345, Math.PI, 5.9]) {
    const transition: OrbitReflowTransition = { plan, durationMs: ORBIT_REFLOW_DURATION_MS, startTimestamp: 0 };
    const result = stepOrbitReflow(transition, ORBIT_REFLOW_DURATION_MS + 1, livePhaseAtCompletion, geometry, () => project);
    assert.ok(result.isComplete);
    for (const id of next) {
      const i = next.indexOf(id);
      const expected = getDynamicOrbitalPosition(project, i, next.length, geometry, livePhaseAtCompletion);
      assert.deepEqual(result.positions[id], expected, `project ${id} must land EXACTLY on the live dynamic position at handoff`);
    }
  }
});

// ---------------------------------------------------------------------------
// isDetachedPlacementMotionSafe — array-based docked order (dynamic pivot)
// ---------------------------------------------------------------------------

function buildSmallOrbitScenario() {
  const projects = generateMockProjects(5);
  const skills = generateMockSkills(4);
  const { orbitGeometry } = assembleTopologyLayout(projects, skills);
  const dockedOrder = dockedOrderOf(projects);

  const currentPositions: Record<string, { x: number; y: number }> = {};
  for (let i = 0; i < dockedOrder.length; i++) {
    const p = projects.find(pr => pr.id === dockedOrder[i])!;
    currentPositions[p.id] = getDynamicOrbitalPosition(p, i, dockedOrder.length, orbitGeometry, 0);
  }

  const candidateProject = { ...generateMockProjects(1)[0], id: 'project-detached-candidate' };

  let candidateOrigin: { x: number; y: number } | null = null;
  for (let s = 1; s < ORBITAL_CLEARANCE_SAMPLE_COUNT; s++) {
    const phase = (s / ORBITAL_CLEARANCE_SAMPLE_COUNT) * 2 * Math.PI;
    const origin = getDynamicOrbitalPosition(candidateProject, 0, dockedOrder.length, orbitGeometry, phase);
    const check = checkCollisions('project', candidateProject.id, origin, currentPositions, {}, projects, []);
    if (!check.hasCollision) {
      candidateOrigin = origin;
      break;
    }
  }
  assert.ok(candidateOrigin, 'test setup: must find at least one sampled phase where the candidate is current-safe');

  const dockedProjectsForSweep = dockedOrder.map(id => projects.find(p => p.id === id)!);

  return { projects, skills, orbitGeometry, currentPositions, candidateProject, candidateOrigin: candidateOrigin!, dockedProjectsForSweep };
}

test('delayed-collision regression: a candidate that is collision-free RIGHT NOW is still rejected because a docked project sweeps through it later', () => {
  const { projects, orbitGeometry, currentPositions, candidateProject, candidateOrigin, dockedProjectsForSweep } = buildSmallOrbitScenario();

  const currentCheck = checkCollisions('project', candidateProject.id, candidateOrigin, currentPositions, {}, projects, []);
  assert.equal(currentCheck.hasCollision, false, 'The candidate must be genuinely collision-free against the CURRENT (phase-frozen) orbit positions');

  const isSafe = isDetachedPlacementMotionSafe(candidateProject, candidateOrigin, orbitGeometry, dockedProjectsForSweep);
  assert.equal(isSafe, false, 'A point exactly on the shared ellipse must be rejected — every docked project eventually sweeps through every point on the track');
});

test('delayed-collision regression: a sufficiently separated detached position is accepted as motion-safe', () => {
  const { orbitGeometry, candidateProject, dockedProjectsForSweep } = buildSmallOrbitScenario();
  const farAwayOrigin = {
    x: orbitGeometry.centerIso.x + orbitGeometry.radiusX * 20,
    y: orbitGeometry.centerIso.y + orbitGeometry.radiusY * 20,
  };
  const isSafe = isDetachedPlacementMotionSafe(candidateProject, farAwayOrigin, orbitGeometry, dockedProjectsForSweep);
  assert.equal(isSafe, true, 'A position far outside the entire orbit must never be rejected');
});

test('delayed-collision regression: an EMPTY docked order (nothing left orbiting) makes any candidate trivially motion-safe', () => {
  const { candidateProject, candidateOrigin, orbitGeometry } = buildSmallOrbitScenario();
  const isSafe = isDetachedPlacementMotionSafe(candidateProject, candidateOrigin, orbitGeometry, []);
  assert.equal(isSafe, true, 'An empty docked order must never reject any candidate');
});

test('isDetachedPlacementMotionSafe: uses INDEX within the supplied docked order, not any fixed canonical slot — stays correct for any membership size', () => {
  // Same candidate/origin, but with only 3 of the 5 projects still docked (as
  // if 2 had already been detached) — the sweep must reflect 3-way spacing.
  const { projects, orbitGeometry, candidateProject } = buildSmallOrbitScenario();
  const threeDocked = projects.slice(0, 3);
  const currentPositions: Record<string, { x: number; y: number }> = {};
  for (let i = 0; i < threeDocked.length; i++) {
    currentPositions[threeDocked[i].id] = getDynamicOrbitalPosition(threeDocked[i], i, threeDocked.length, orbitGeometry, 0);
  }

  let candidateOrigin: { x: number; y: number } | null = null;
  for (let s = 1; s < ORBITAL_CLEARANCE_SAMPLE_COUNT; s++) {
    const phase = (s / ORBITAL_CLEARANCE_SAMPLE_COUNT) * 2 * Math.PI;
    const origin = getDynamicOrbitalPosition(candidateProject, 0, threeDocked.length, orbitGeometry, phase);
    if (!checkCollisions('project', candidateProject.id, origin, currentPositions, {}, projects, []).hasCollision) {
      candidateOrigin = origin;
      break;
    }
  }
  assert.ok(candidateOrigin);
  const isSafe = isDetachedPlacementMotionSafe(candidateProject, candidateOrigin!, orbitGeometry, threeDocked);
  assert.equal(isSafe, false, 'A 3-way sweep must still catch the same class of delayed collision');
});

// ---------------------------------------------------------------------------
// Search resolution: the EXISTING findNearestValidGridPosition expanding-ring
// search is reused, not duplicated — isCandidateValid is an additional gate.
// ---------------------------------------------------------------------------

test('search resolution: findNearestValidGridPosition rejects a current-safe-but-future-unsafe candidate and continues through the EXISTING search to a position safe on BOTH counts', () => {
  const { projects, orbitGeometry, currentPositions, candidateProject, candidateOrigin, dockedProjectsForSweep } = buildSmallOrbitScenario();

  const isCandidateValid = (pos: { x: number; y: number }) =>
    isDetachedPlacementMotionSafe(candidateProject, pos, orbitGeometry, dockedProjectsForSweep);

  assert.equal(checkCollisions('project', candidateProject.id, candidateOrigin, currentPositions, {}, projects, []).hasCollision, false);
  assert.equal(isCandidateValid(candidateOrigin), false);

  const resolved = findNearestValidGridPosition(
    'project', candidateProject.id, candidateOrigin,
    currentPositions, {}, projects, [],
    25, false,
    isCandidateValid
  );

  assert.equal(resolved.foundValidPosition, true);
  assert.equal(resolved.wasAdjusted, true, 'The resolver must move off the naive candidate');
  assert.equal(resolved.wasAdjustedForValidatorOnly, true, 'The shift must be attributed to the validator, not an ordinary current-node collision');

  const finalCollision = checkCollisions('project', candidateProject.id, { x: resolved.x, y: resolved.y }, currentPositions, {}, projects, []);
  assert.equal(finalCollision.hasCollision, false, 'Final position must remain collision-free against current nodes');
  assert.equal(isCandidateValid({ x: resolved.x, y: resolved.y }), true, 'Final position must be motion-safe against the future orbital sweep');
});

test('search resolution: an ordinary candidate with no orbital-clearance concern is unaffected — isCandidateValid is a pure additive gate, default behavior unchanged', () => {
  const { projects, currentPositions } = buildSmallOrbitScenario();
  const farAwayProject = { ...generateMockProjects(1)[0], id: 'project-far-away' };
  const farAwayRawPos = { x: 100000, y: 100000 };
  const withoutValidator = findNearestValidGridPosition('project', farAwayProject.id, farAwayRawPos, currentPositions, {}, projects, [], 25, true);
  const withAlwaysTrueValidator = findNearestValidGridPosition('project', farAwayProject.id, farAwayRawPos, currentPositions, {}, projects, [], 25, true, () => true);
  assert.deepEqual(withoutValidator, withAlwaysTrueValidator, 'Supplying an always-true validator must be indistinguishable from omitting it entirely');
  assert.equal(withoutValidator.wasAdjusted, false);
});

test('search saturation: an always-false validator is never represented as a valid fallback', () => {
  const project = { ...generateMockProjects(1)[0], id: 'project-saturation' };
  const rawPos = { x: 125, y: -75 };
  const resolved = findNearestValidGridPosition(
    'project', project.id, rawPos,
    {}, {}, [project], [],
    25, true,
    () => false
  );

  assert.equal(resolved.foundValidPosition, false);
  assert.equal(resolved.x, 125, 'fallback coordinates remain diagnostic only');
  assert.equal(resolved.y, -75, 'fallback coordinates remain diagnostic only');
});

// ---------------------------------------------------------------------------
// Orbit integration: pause conditions
// ---------------------------------------------------------------------------

test('isOrbitPauseConditionActive: OrbitPauseState no longer carries a reflow/docking-transition field at all — a committed detach/reinsertion never pauses the orbit', () => {
  const state: OrbitPauseState = {
    isProjectHovered: false, isSkillHovered: false, isProjectSelected: false, isSkillSelected: false,
    isNodeDragging: false, isCanvasPanning: false, isDocumentHidden: false, prefersReducedMotion: false,
    isCompact: false, isExperienceSelected: false,
  };
  assert.equal(isOrbitPauseConditionActive(state), false);
  assert.ok(!('isDockingTransitionActive' in state));
});

test('TopologyCanvas.tsx: orbitPauseState is not derived from the mere existence of detached/interactively-reordered projects, nor from an active reflow — PR24 keeps the ring continuous through all of it', () => {
  const content = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');
  const pauseStateIdx = content.indexOf('const orbitPauseState: OrbitPauseState = useMemo(');
  const pauseStateBlock = content.slice(pauseStateIdx, content.indexOf('}), [', pauseStateIdx));
  assert.ok(!pauseStateBlock.includes('projectDockState'), 'orbitPauseState must not pause merely because some project is detached at rest');
  assert.ok(!pauseStateBlock.includes('interactiveOrbitOrder'), 'orbitPauseState must not pause merely because membership/order has been visitor-modified');
  assert.ok(!pauseStateBlock.includes('isOrbitReflowActive'), 'orbitPauseState must not pause during an active shared orbital reflow — the ring keeps advancing through it');
});

// ---------------------------------------------------------------------------
// RAF lifecycle for the shared orbital reflow (mirrors the PR22 orbit-clock proof)
// ---------------------------------------------------------------------------

function extractOrbitReflowEffect(content: string): string {
  const guardIdx = content.indexOf('if (!isOrbitReflowActive) return;');
  assert.ok(guardIdx !== -1, 'orbit reflow effect guard must be present');
  const startIdx = content.lastIndexOf('useEffect(() => {', guardIdx);
  assert.ok(startIdx !== -1, 'orbit reflow effect block must be present');
  const endIdx = content.indexOf('}, [isOrbitReflowActive]);', startIdx);
  assert.ok(endIdx !== -1);
  return content.slice(startIdx, endIdx + '}, [isOrbitReflowActive]);'.length);
}

test('TopologyCanvas.tsx: idle (no active reflow) schedules zero reflow RAF callbacks', () => {
  const content = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');
  const block = extractOrbitReflowEffect(content);
  const guardIdx = block.indexOf('if (!isOrbitReflowActive) return;');
  const firstRafIdx = block.indexOf('requestAnimationFrame(');
  assert.ok(guardIdx !== -1 && firstRafIdx !== -1);
  assert.ok(guardIdx < firstRafIdx, 'The idle-guard must return before any requestAnimationFrame call is reached');
});

test('TopologyCanvas.tsx: an active reflow schedules exactly ONE RAF chain (not one per project), cancelled on cleanup/completion', () => {
  const content = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');
  const block = extractOrbitReflowEffect(content);
  const runningBlock = block.slice(block.indexOf('let rafId'));
  const rafCallCount = (runningBlock.match(/requestAnimationFrame\(/g) || []).length;
  assert.equal(rafCallCount, 2, 'Exactly one chain: one initial schedule plus one re-schedule inside tick');
  assert.ok(runningBlock.includes('return () => cancelAnimationFrame(rafId)'), 'Cleanup must cancel the active frame');
  assert.ok(runningBlock.includes('setIsOrbitReflowActive(false)'), 'Completion must clear the reactive flag, tearing the loop down (zero reflow RAF once finished)');
});

test('TopologyCanvas.tsx: reflow completion clears the render-position map so getProjectPos falls back to the authoritative interactive orbital position with no handoff jump', () => {
  const content = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');
  const block = extractOrbitReflowEffect(content);
  assert.ok(block.includes('setOrbitReflowRenderPositions(null)'), 'Completing a reflow must clear the render-position override so effectiveProjectPositions/dockedProjectPositions become authoritative again');
});

// ---------------------------------------------------------------------------
// Real GITHUB_SNAPSHOT regression (no src/data mutation, no sync)
// ---------------------------------------------------------------------------

test('real committed snapshot: every project has exactly one reserved slot, and re-assembling never reassigns slots regardless of any dock runtime state', () => {
  const projects = GITHUB_SNAPSHOT.projects;
  const skills = GITHUB_SNAPSHOT.skills;
  const layout1 = assembleTopologyLayout(projects, skills);
  const layout2 = assembleTopologyLayout(projects, skills);

  assert.equal(layout1.orbitGeometry.slots.length, projects.length, 'Every project must have exactly one reserved slot');
  const uniqueProjectIds = new Set(layout1.orbitGeometry.slots.map(s => s.projectId));
  assert.equal(uniqueProjectIds.size, projects.length);

  assert.deepEqual(layout1.orbitGeometry.slots, layout2.orbitGeometry.slots, 'Slot assignment must be identical regardless of any transient dock/detach activity, since dock state is not an input to layout at all');
});

test('real committed snapshot: canonical order derived from staticOrbitalLattice.orbitGeometry.slots contains all 18 real projects exactly once', () => {
  const projects = GITHUB_SNAPSHOT.projects;
  const skills = GITHUB_SNAPSHOT.skills;
  const { orbitGeometry } = assembleTopologyLayout(projects, skills);
  const canonicalOrder = orbitGeometry.slots.map(s => s.projectId);

  assert.equal(canonicalOrder.length, projects.length);
  assert.equal(new Set(canonicalOrder).size, projects.length, 'no duplicate identities');
  for (const p of projects) {
    assert.ok(canonicalOrder.includes(p.id), `${p.id} must appear in the canonical order`);
  }
});

test('real committed snapshot: detaching one real project (18 -> 17) preserves identity integrity — no duplicate, no missing, relative order otherwise unchanged', () => {
  const projects = GITHUB_SNAPSHOT.projects;
  const skills = GITHUB_SNAPSHOT.skills;
  const { orbitGeometry } = assembleTopologyLayout(projects, skills);
  const canonicalOrder = orbitGeometry.slots.map(s => s.projectId);

  const detachedId = canonicalOrder[7];
  const after = canonicalOrder.filter(id => id !== detachedId);

  assert.equal(after.length, 17);
  assert.equal(new Set(after).size, 17, 'no duplicate identities after detach');
  assert.ok(!after.includes(detachedId));
  assert.deepEqual(after, canonicalOrder.filter(id => id !== detachedId), 'relative order of every other identity is untouched — no resort');
});

test('real committed snapshot: reinserting a detached real project (17 -> 18) preserves identity integrity', () => {
  const projects = GITHUB_SNAPSHOT.projects;
  const skills = GITHUB_SNAPSHOT.skills;
  const { orbitGeometry } = assembleTopologyLayout(projects, skills);
  const canonicalOrder = orbitGeometry.slots.map(s => s.projectId);

  const detachedId = canonicalOrder[3];
  const reduced = canonicalOrder.filter(id => id !== detachedId);
  const reinserted = [...reduced];
  reinserted.splice(3, 0, detachedId);

  assert.equal(reinserted.length, 18);
  assert.equal(new Set(reinserted).size, 18, 'no duplicate identities after reinsertion');
  assert.deepEqual(reinserted, canonicalOrder, 'reinserting at the same logical position must exactly reproduce the original canonical order');
});

test('interactive-order invariant: repeated detach/reinsert operations keep only known real project IDs and never duplicate identity', () => {
  const { orbitGeometry } = assembleTopologyLayout(GITHUB_SNAPSHOT.projects, GITHUB_SNAPSHOT.skills);
  const knownIds = orbitGeometry.slots.map(slot => slot.projectId);
  let order = [...knownIds];

  for (const [projectId, insertionIndex] of [
    [knownIds[2], 9],
    [knownIds[11], 1],
    [knownIds[2], knownIds.length - 1],
    [knownIds[7], 4],
  ] as const) {
    order = removeProjectFromOrbitOrder(order, projectId, knownIds);
    assert.equal(order.includes(projectId), false);
    order = insertProjectIntoOrbitOrder(order, projectId, insertionIndex, knownIds);
    assert.equal(order.filter(id => id === projectId).length, 1);
    assert.equal(new Set(order).size, order.length);
    assert.ok(order.every(id => knownIds.includes(id)));
  }

  assert.equal(order.length, knownIds.length);
  assert.throws(
    () => insertProjectIntoOrbitOrder(order, order[0], 1, knownIds),
    /already present/,
    'correct transitions reject duplicates rather than silently cleaning them up'
  );
  assert.throws(
    () => insertProjectIntoOrbitOrder(order, 'unknown-project', 1, knownIds),
    /unknown project/,
    'runtime order cannot admit an ID outside the current snapshot'
  );
});

test('real committed snapshot: ASSEMBLE/RESET restore interactiveOrbitOrder to null and clear every dock-runtime exception (byte-for-byte canonical restoration)', () => {
  const content = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');
  const restoreIdx = content.indexOf('const restoreCanonicalDockMembership = useCallback(() => {');
  assert.ok(restoreIdx !== -1);
  const restoreBlock = content.slice(restoreIdx, content.indexOf('const resetAllPositions = useCallback', restoreIdx));
  assert.ok(restoreBlock.includes('setProjectDockState({});'), 'must clear the ENTIRE dock-runtime map at once');
  assert.ok(
    restoreBlock.includes('setInteractiveOrbitOrderByRing({});'),
    'must restore canonical order authority for EVERY ring at once — an empty record means every ring falls back to its own static lattice slot order'
  );
  assert.ok(restoreBlock.includes('setCustomProjectPositions({});'), 'must clear every custom/detached position override');

  // Once interactiveOrbitOrderByRing is empty again, re-deriving canonical
  // order from the (unchanged) static lattice must byte-for-byte reproduce
  // the original sequence — the lattice's own slot order never mutates.
  const { orbitGeometry } = assembleTopologyLayout(GITHUB_SNAPSHOT.projects, GITHUB_SNAPSHOT.skills);
  const before = orbitGeometry.slots.map(s => s.projectId);
  const { orbitGeometry: orbitGeometryAfter } = assembleTopologyLayout(GITHUB_SNAPSHOT.projects, GITHUB_SNAPSHOT.skills);
  const after = orbitGeometryAfter.slots.map(s => s.projectId);
  assert.deepEqual(after, before);
});

// ---------------------------------------------------------------------------
// No new drag during an active reflow (preserves the prior independent-review fix)
// ---------------------------------------------------------------------------

test('TopologyCanvas.tsx: all four node drag-start handlers (skill mouse/touch, project mouse/touch) check isOrbitReflowActive before starting a drag', () => {
  const content = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');
  const starts = [...content.matchAll(/on(?:MouseDown|TouchStart)=\{\(e\) => \{/g)];
  assert.ok(starts.length >= 4, 'expected at least the four inline node drag-start handlers');

  let guardedHandlerCount = 0;
  for (const match of starts) {
    const idx = match.index!;
    // Window widened 700 -> 1000 in Phase 4A: the two PROJECT handlers now
    // also check/clear an active project-assembly test before reaching this
    // guard (see assemblyClockRef in TopologyCanvas.tsx), pushing
    // setDraggingNode further into the handler body. This is a scan-window
    // implementation constant only, not the invariant itself — the actual
    // guard-before-setDraggingNode ordering below is unchanged and still
    // enforced for all four handlers.
    const window = content.slice(idx, idx + 1000);
    const setDraggingIdx = window.indexOf('setDraggingNode(');
    if (setDraggingIdx === -1) continue;
    const guardIdx = window.indexOf('if (isOrbitReflowActive) return;');
    assert.ok(guardIdx !== -1 && guardIdx < setDraggingIdx, `Drag-start handler at file offset ${idx} must check isOrbitReflowActive BEFORE calling setDraggingNode`);
    guardedHandlerCount++;
  }
  assert.equal(guardedHandlerCount, 4, 'Exactly four node drag-start handlers must exist and all must be guarded');
});

test('architecture: a reflow is committed before the drag session itself is cleared, so no new drag can begin in between', () => {
  const content = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');
  const releaseIdx = content.indexOf('const processRelease = () => {');
  const nextEffectIdx = content.indexOf('const handleWindowMouseMove', releaseIdx);
  const releaseBlock = content.slice(releaseIdx, nextEffectIdx === -1 ? undefined : nextEffectIdx);
  const commitIdx = releaseBlock.indexOf('commitOrbitReflow(');
  const finalNullIdx = releaseBlock.lastIndexOf('setDraggingNode(null);');
  assert.ok(commitIdx !== -1 && finalNullIdx !== -1);
  assert.ok(commitIdx < finalNullIdx, 'A reflow is committed before the drag session itself is cleared');
});

test('TopologyCanvas.tsx: same-gesture docked capture returns existing membership; only persisted-detached capture reaches checked insertion', () => {
  const content = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');
  const releaseIdx = content.indexOf('const processRelease = () => {');
  const releaseBlock = content.slice(releaseIdx, content.indexOf('const handleWindowMouseMove', releaseIdx));
  const actionIdx = releaseBlock.indexOf('const releaseAction = resolveOrbitReleaseAction(persisted, dockStateAtRelease);');
  const returnIdx = releaseBlock.indexOf("if (releaseAction === 'return-to-existing-dock')", actionIdx);
  const insertIdx = releaseBlock.indexOf("else if (releaseAction === 'insert-detached-project')", returnIdx);
  const returnBlock = releaseBlock.slice(returnIdx, insertIdx);
  const insertBlock = releaseBlock.slice(insertIdx, releaseBlock.indexOf('} else {', insertIdx));

  assert.ok(actionIdx !== -1 && returnIdx !== -1 && insertIdx !== -1);
  assert.ok(returnBlock.includes('commitOrbitReflow(ring, dockedOrbitOrder'), 'same-gesture capture must return to unchanged order, scoped to the project\'s own canonical ring');
  assert.ok(!returnBlock.includes('setInteractiveOrbitOrderByRing('));
  assert.ok(!returnBlock.includes('setCustomProjectPositions('));
  assert.ok(!returnBlock.includes('setProjectDockState('));
  assert.ok(insertBlock.includes('insertProjectIntoOrbitOrder('), 'eligible reinsertion must use the checked insertion transition');
});

test('TopologyCanvas.tsx: exhausted safe-placement search cancels first detach and retains an already-detached prior position without unsafe writes', () => {
  const content = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');
  const releaseIdx = content.indexOf('const processRelease = () => {');
  const releaseBlock = content.slice(releaseIdx, content.indexOf('const handleWindowMouseMove', releaseIdx));
  const exhaustionIdx = releaseBlock.indexOf('if (!resolved.foundValidPosition)');
  const successIdx = releaseBlock.indexOf('const finalPos =', exhaustionIdx);
  const exhaustionBlock = releaseBlock.slice(exhaustionIdx, successIdx);

  assert.ok(exhaustionIdx !== -1 && successIdx !== -1);
  assert.ok(exhaustionBlock.includes('if (wasDocked)'));
  assert.ok(exhaustionBlock.includes('commitOrbitReflow('), 'first-time detach must return to existing docked order');
  assert.ok(exhaustionBlock.includes('NO SAFE CLEARANCE // DETACH CANCELLED'));
  assert.ok(exhaustionBlock.includes('NO SAFE CLEARANCE // PREVIOUS POSITION RETAINED'));
  assert.ok(!exhaustionBlock.includes('setCustomProjectPositions('), 'unsafe candidate must never overwrite custom position');
  assert.ok(!exhaustionBlock.includes('setProjectDockState('), 'unsafe candidate must never change dock state');
  assert.ok(!exhaustionBlock.includes('setInteractiveOrbitOrder('), 'unsafe candidate must never change membership');
  assert.ok(exhaustionBlock.includes('setDraggingNode(null);') && exhaustionBlock.includes('return;'));
});

test('TopologyCanvas.tsx: a detach commit builds the future-clearance sweep set from the CURRENT interactive docked order, excluding the project being dropped', () => {
  const content = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');
  const releaseIdx = content.indexOf('const processRelease = () => {');
  const idx = content.indexOf('removeProjectFromOrbitOrder(dockedOrbitOrder, draggingNode.id, canonicalOrbitOrder)', releaseIdx);
  assert.ok(idx !== -1, 'detach must remove exactly the dragged identity from the current interactive docked order through the checked transition');
  const nearby = content.slice(idx, idx + 600);
  assert.ok(nearby.includes('isDetachedPlacementMotionSafe('), 'must reuse the existing motion-safety validator, not a duplicate search algorithm');
});

// ---------------------------------------------------------------------------
// Mandatory arbitrary-adjacency regression: every ordered pair of the 18 real
// distinct projects, as adjacent neighbors anywhere on the densest 18-project
// ring, across every adjacent slot location and 72 sampled global phases,
// using the FULL visual/callout envelope. Reports PASS (current radii) or
// FAILS with the exact offending pair/index/angle/phase.
// ---------------------------------------------------------------------------

test('arbitrary interactive order safety: every real project pair, adjacent at any ring position/phase, never overlaps (full visual/callout envelope)', () => {
  const projects = GITHUB_SNAPSHOT.projects;
  const skills = GITHUB_SNAPSHOT.skills;
  const { orbitGeometry } = assembleTopologyLayout(projects, skills) as { orbitGeometry: StaticOrbitGeometry };
  const N = projects.length;
  assert.equal(N, 18, 'this regression is defined against the real, densest 18-project ring');

  // getTopologyProjectVisualBounds/project3DToIso are both linear in the
  // world-space translation applied — so a project's visual envelope at any
  // iso-space center is its envelope at visual-center (0,0), translated by
  // that iso point. Precomputing the center-relative envelope once per project
  // turns the O(pairs * positions * phases) sweep into pure arithmetic.
  const envelopeOffsetByProjectId = new Map<string, ReturnType<typeof getTopologyProjectVisualBounds>>();
  for (const p of projects) {
    const centeredOrigin = getWorldOriginForIsoCenter(p, { x: 0, y: 0 });
    envelopeOffsetByProjectId.set(p.id, getTopologyProjectVisualBounds(p, centeredOrigin));
  }

  function envelopeAt(projectId: string, isoCenter: { x: number; y: number }) {
    const offset = envelopeOffsetByProjectId.get(projectId)!;
    return {
      minX: offset.minX + isoCenter.x,
      maxX: offset.maxX + isoCenter.x,
      minY: offset.minY + isoCenter.y,
      maxY: offset.maxY + isoCenter.y,
    };
  }

  function isoCenterAtIndex(i: number, n: number, phase: number) {
    const angle = -Math.PI / 2 + (i / n) * 2 * Math.PI + phase;
    return {
      x: orbitGeometry.centerIso.x + orbitGeometry.radiusX * Math.cos(angle),
      y: orbitGeometry.centerIso.y + orbitGeometry.radiusY * Math.sin(angle),
    };
  }

  const SAMPLE_PHASES = 72;
  let offender: { a: string; b: string; slotIndex: number; phase: number } | null = null;

  outer:
  for (let ai = 0; ai < projects.length && !offender; ai++) {
    for (let bi = 0; bi < projects.length; bi++) {
      if (ai === bi) continue;
      const a = projects[ai].id;
      const b = projects[bi].id;
      for (let k = 0; k < N; k++) {
        const kNext = (k + 1) % N;
        for (let s = 0; s < SAMPLE_PHASES; s++) {
          const phase = (s / SAMPLE_PHASES) * 2 * Math.PI;
          const centerA = isoCenterAtIndex(k, N, phase);
          const centerB = isoCenterAtIndex(kNext, N, phase);
          const boxA = envelopeAt(a, centerA);
          const boxB = envelopeAt(b, centerB);
          if (checkAABBOverlap(boxA, boxB, 0)) {
            offender = { a, b, slotIndex: k, phase };
            break outer;
          }
        }
      }
    }
  }

  if (offender) {
    assert.fail(
      `FAIL: adjacent-pair overlap found — projects ${offender.a} and ${offender.b} adjacent at ` +
      `slot index ${offender.slotIndex}/${offender.slotIndex + 1} (mod ${N}), phase=${offender.phase.toFixed(4)} rad. ` +
      `Current radii radiusX=${orbitGeometry.radiusX.toFixed(2)}, radiusY=${orbitGeometry.radiusY.toFixed(2)} are insufficient ` +
      `for arbitrary visitor reordering; the smallest deterministic radius increase must be found before shipping interactive reordering.`
    );
  } else {
    // PASS: report the exact accepted radii so the report can cite them.
    assert.ok(true, `PASS: radiusX=${orbitGeometry.radiusX.toFixed(2)}, radiusY=${orbitGeometry.radiusY.toFixed(2)} are safe for every real adjacent pair, position, and phase.`);
  }
});

test('arbitrary interactive order safety: every real project clears the capability core at every dynamic slot and phase', () => {
  const projects = GITHUB_SNAPSHOT.projects;
  const skills = GITHUB_SNAPSHOT.skills;
  const { orbitGeometry, skillPositions } = assembleTopologyLayout(projects, skills);
  const N = orbitGeometry.slots.length;

  const coreCorners: { x: number; y: number }[] = [];
  for (const skill of skills) {
    const bounds = getNodeBounds('skill', skillPositions[skill.id], 48, 48);
    coreCorners.push(project3DToIso(bounds.minX, bounds.minY, 0));
    coreCorners.push(project3DToIso(bounds.maxX, bounds.minY, 0));
    coreCorners.push(project3DToIso(bounds.maxX, bounds.maxY, 0));
    coreCorners.push(project3DToIso(bounds.minX, bounds.maxY, 0));
  }
  const coreBounds = {
    minX: Math.min(...coreCorners.map(c => c.x)),
    maxX: Math.max(...coreCorners.map(c => c.x)),
    minY: Math.min(...coreCorners.map(c => c.y)),
    maxY: Math.max(...coreCorners.map(c => c.y)),
  };

  for (const project of projects) {
    for (let index = 0; index < N; index++) {
      for (let sample = 0; sample < ORBITAL_CLEARANCE_SAMPLE_COUNT; sample++) {
        const phase = (sample / ORBITAL_CLEARANCE_SAMPLE_COUNT) * 2 * Math.PI;
        const dynamicPos = getDynamicOrbitalPosition(project, index, N, orbitGeometry, phase);
        const projectBounds = getTopologyProjectVisualBounds(project, dynamicPos);
        assert.equal(
          checkAABBOverlap(projectBounds, coreBounds, 0),
          false,
          `${project.id} invades the capability core at dynamic index ${index}, phase sample ${sample}`
        );
      }
    }
  }
});

// ---------------------------------------------------------------------------
// getWorldOriginForIsoCenter: inverse of getProjectVisualCenterIso
// ---------------------------------------------------------------------------

test('getWorldOriginForIsoCenter: is the exact inverse of getProjectVisualCenterIso', () => {
  const project = generateMockProjects(1)[0];
  const worldOrigin = { x: 123, y: -45 };
  const isoCenter = getProjectVisualCenterIso(project, worldOrigin);
  const recovered = getWorldOriginForIsoCenter(project, isoCenter);
  assert.ok(Math.abs(recovered.x - worldOrigin.x) < 1e-6);
  assert.ok(Math.abs(recovered.y - worldOrigin.y) < 1e-6);
});
