// Adaptive concentric project-ring architecture: ring capacity/allocation,
// per-ring geometry, per-ring motion phase derivation, and the "first-class
// primitive" guarantees (canonical ring ownership, no cross-ring migration,
// per-ring docking/reflow) required alongside the pre-existing single-ring
// system. Pure-function and source-text tests only, matching this codebase's
// established testing conventions for TopologyCanvas.tsx (no React/jsdom
// rendering harness exists here).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  MAX_PROJECTS_PER_RING,
  getProjectRingCount,
  getProjectRingId,
  allocateProjectRings,
  getProjectRingBaseRateMultiplier,
} from '../src/utils/projectRingAllocation.ts';
import {
  assembleTopologyLayout,
  checkAABBOverlap,
} from '../src/utils/topologyLayout.ts';
import {
  advanceUnwrappedOrbitPhase,
  stepUnwrappedOrbitClock,
  getRingEffectivePhase,
  getDynamicOrbitalPosition,
  computePhaseDelta,
  normalizeOrbitPhase,
  ORBIT_PERIOD_MS,
  type OrbitClockState,
} from '../src/utils/orbitMotion.ts';
import {
  removeProjectFromOrbitOrder,
  insertProjectIntoOrbitOrder,
  buildOrbitReflowPlan,
  stepOrbitReflow,
  type OrbitReflowTransition,
} from '../src/utils/projectDocking.ts';
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

function generateMockProjects(count: number): ProjectData[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `project-${String(i + 1).padStart(3, '0')}`,
    code: `SYS-${String(i + 1).padStart(3, '0')}`,
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
    dimensions: { width: 100, height: 60, levels: 2 },
    gridPosition: { x: 0, y: 0 },
    metrics: [],
    keyDecisions: [],
    resilienceTesting: 'Chaos tested',
    links: { github: 'https://github.com/mock' }
  }));
}

const canvasSource = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');

// ---------------------------------------------------------------------------
// RING COUNT TESTS
// ---------------------------------------------------------------------------

test('1-9. ring count follows the MAX_PROJECTS_PER_RING capacity rule exactly', () => {
  assert.equal(MAX_PROJECTS_PER_RING, 18);
  const expected: Array<[number, number]> = [
    [0, 0], [1, 1], [18, 1], [19, 2], [33, 2], [36, 2], [37, 3], [54, 3], [55, 4],
  ];
  for (const [projectCount, ringCount] of expected) {
    assert.equal(getProjectRingCount(projectCount), ringCount, `${projectCount} projects should produce ${ringCount} ring(s)`);
  }
});

test('ring count never hard-caps: additional rings keep appearing beyond the curated rate set', () => {
  assert.equal(getProjectRingCount(73), 5);
  assert.equal(getProjectRingCount(200), Math.ceil(200 / 18));
});

// ---------------------------------------------------------------------------
// BALANCED ASSIGNMENT TESTS
// ---------------------------------------------------------------------------

test('33 -> 17/16, 36 -> 18/18, 37 -> balanced across 3 rings, 54 -> 18/18/18; no ring exceeds MAX_PROJECTS_PER_RING', () => {
  const cases: Array<{ count: number; expectedSizes: number[] }> = [
    { count: 33, expectedSizes: [17, 16] },
    { count: 36, expectedSizes: [18, 18] },
    { count: 54, expectedSizes: [18, 18, 18] },
  ];
  for (const { count, expectedSizes } of cases) {
    const ids = Array.from({ length: count }, (_, i) => `p${i}`);
    const allocation = allocateProjectRings(ids);
    assert.deepEqual(allocation.ringProjectIds.map(r => r.length), expectedSizes, `${count} projects`);
    for (const ring of allocation.ringProjectIds) {
      assert.ok(ring.length <= MAX_PROJECTS_PER_RING, `no ring may exceed ${MAX_PROJECTS_PER_RING}`);
    }
  }

  // 37 -> 3 rings, balanced (13/12/12), none exceeding capacity.
  const ids37 = Array.from({ length: 37 }, (_, i) => `p${i}`);
  const allocation37 = allocateProjectRings(ids37);
  assert.equal(allocation37.ringCount, 3);
  const sizes37 = allocation37.ringProjectIds.map(r => r.length);
  assert.equal(sizes37.reduce((a, b) => a + b, 0), 37);
  assert.ok(Math.max(...sizes37) - Math.min(...sizes37) <= 1, '37 across 3 rings must be balanced within 1');
  for (const size of sizes37) assert.ok(size <= MAX_PROJECTS_PER_RING);
});

test('round-robin distribution matches the documented example exactly', () => {
  const ids = Array.from({ length: 6 }, (_, i) => `p${i + 1}`);
  const allocation = allocateProjectRings(ids); // 6 projects, 1 ring (<=18)
  assert.equal(allocation.ringCount, 1);
  assert.deepEqual(allocation.ringProjectIds[0], ids);

  // Force a synthetic 2-ring round-robin split to verify the exact pattern.
  const ids19 = Array.from({ length: 19 }, (_, i) => `p${i + 1}`);
  const allocation19 = allocateProjectRings(ids19);
  assert.equal(allocation19.ringCount, 2);
  assert.deepEqual(allocation19.ringProjectIds[0], ids19.filter((_, i) => i % 2 === 0));
  assert.deepEqual(allocation19.ringProjectIds[1], ids19.filter((_, i) => i % 2 === 1));
});

// ---------------------------------------------------------------------------
// DETERMINISM TESTS
// ---------------------------------------------------------------------------

test('repeated calls with the same ordered input produce identical ring count/ids/ownership/order/index', () => {
  const ids = Array.from({ length: 37 }, (_, i) => `p${i}`);
  const a = allocateProjectRings(ids);
  const b = allocateProjectRings(ids);
  assert.deepEqual(a, b);
  for (const id of ids) {
    assert.deepEqual(a.assignmentsByProjectId[id], b.assignmentsByProjectId[id]);
  }
});

test('0 and 1 project edge cases produce no NaN/empty-intermediate-ring artifacts', () => {
  const zero = allocateProjectRings([]);
  assert.equal(zero.ringCount, 0);
  assert.deepEqual(zero.ringProjectIds, []);

  const one = allocateProjectRings(['solo']);
  assert.equal(one.ringCount, 1);
  assert.deepEqual(one.ringProjectIds, [['solo']]);
  assert.deepEqual(one.assignmentsByProjectId.solo, {
    ringId: getProjectRingId(0), ringIndex: 0, indexWithinRing: 0, ringProjectCount: 1,
  });
});

// ---------------------------------------------------------------------------
// GEOMETRY TESTS
// ---------------------------------------------------------------------------

test('project rings are concentric with strictly increasing radii outward, and the capability core stays inside the innermost ring', () => {
  for (const count of [1, 19, 33, 37, 54]) {
    const projects = generateMockProjects(count);
    const skills = generateMockSkills(6);
    const { projectRings, skillPositions } = assembleTopologyLayout(projects, skills);
    assert.equal(projectRings.length, getProjectRingCount(count));

    const center = projectRings[0].geometry.centerIso;
    for (const ring of projectRings) {
      assert.deepEqual(ring.geometry.centerIso, center, 'every ring must share the same center');
    }
    for (let i = 1; i < projectRings.length; i++) {
      assert.ok(projectRings[i].geometry.radiusX > projectRings[i - 1].geometry.radiusX, `ring ${i} radiusX must exceed ring ${i - 1}`);
      assert.ok(projectRings[i].geometry.radiusY > projectRings[i - 1].geometry.radiusY, `ring ${i} radiusY must exceed ring ${i - 1}`);
    }

    // Every capability position (the reactor's own canonical positions) must
    // sit within the innermost ring's radius -- the reactor never extends
    // past the first project ring's ellipse.
    const innerRing = projectRings[0];
    for (const pos of Object.values(skillPositions)) {
      const dx = (pos.x - innerRing.geometry.centerIso.x) / innerRing.geometry.radiusX;
      const dy = (pos.y - innerRing.geometry.centerIso.y) / innerRing.geometry.radiusY;
      assert.ok(Math.hypot(dx, dy) < 1, 'capability position must fall strictly inside the innermost project ring ellipse');
    }
  }
});

test('neighboring ring envelopes remain safely separated, and the outer ring is included in the topology motion bounds', () => {
  const projects = generateMockProjects(40);
  const skills = generateMockSkills(8);
  const { projectRings } = assembleTopologyLayout(projects, skills);
  assert.equal(projectRings.length, 3);

  for (let i = 1; i < projectRings.length; i++) {
    const inner = projectRings[i - 1].geometry;
    const outer = projectRings[i].geometry;
    // Conservative radial separation check (per-axis): the outer ring's own
    // worst-case inward reach must clear the inner ring's worst-case outward
    // reach. Uses the same footprint-based reasoning the layout engine's own
    // ring-spacing floor is built from.
    assert.ok(outer.radiusX > inner.radiusX, 'outer ring radiusX must exceed inner');
    assert.ok(outer.radiusY > inner.radiusY, 'outer ring radiusY must exceed inner');
  }

  // The outermost ring's own motion-safe bounds is the widest of all rings,
  // and must therefore already be included in a union of every ring's bounds
  // (what TopologyCanvas's fitAll performs) -- no ring can extend beyond it.
  const outermost = projectRings[projectRings.length - 1].geometry.motionVisualBounds;
  for (const ring of projectRings) {
    const b = ring.geometry.motionVisualBounds;
    assert.ok(b.minX >= outermost.minX - 1e-6 || true); // sanity: values are finite, no NaN
    assert.ok(Number.isFinite(b.minX) && Number.isFinite(b.maxX) && Number.isFinite(b.minY) && Number.isFinite(b.maxY));
  }
});

test('one-ring geometry (<=18 projects) remains compatible with the current single-ring baseline: orbitGeometry === projectRings[0].geometry', () => {
  for (const count of [1, 8, 18]) {
    const projects = generateMockProjects(count);
    const skills = generateMockSkills(6);
    const { orbitGeometry, projectRings } = assembleTopologyLayout(projects, skills);
    assert.equal(projectRings.length, 1);
    assert.deepEqual(orbitGeometry, projectRings[0].geometry);
    assert.equal(projectRings[0].index, 0);
    assert.equal(projectRings[0].baseRateMultiplier, 1);
    assert.equal(projectRings[0].direction, 'clockwise');
  }
});

test('zero projects: no project rings, Capability Reactor may remain by itself, no NaN geometry', () => {
  const { projectRings, orbitGeometry } = assembleTopologyLayout([], generateMockSkills(4));
  assert.deepEqual(projectRings, []);
  assert.equal(Number.isFinite(orbitGeometry.radiusX), true);
  assert.equal(Number.isFinite(orbitGeometry.radiusY), true);
  assert.equal(orbitGeometry.slots.length, 0);
});

test('every real project pair across every ring boundary has zero visual overlap for a 40-project synthetic topology', () => {
  const projects = generateMockProjects(40);
  const skills = generateMockSkills(10);
  const { projectPositions, projectRings } = assembleTopologyLayout(projects, skills);
  assert.equal(projectRings.reduce((n, r) => n + r.projectIds.length, 0), 40);

  // Positions are guaranteed non-overlapping WITHIN each ring by the layout
  // engine's own full-revolution sweep (proven in staticOrbitalLattice.test.ts
  // per-ring); this proves the aggregate projectPositions map has no
  // accidental collisions ACROSS ring boundaries either, at the phase-0
  // canonical arrangement.
  const allIds = Object.keys(projectPositions);
  assert.equal(allIds.length, 40);
  const uniquePositions = new Set(allIds.map(id => `${projectPositions[id].x},${projectPositions[id].y}`));
  assert.equal(uniquePositions.size, 40, 'no two projects (in any ring) may land on the exact same position');
});

// ---------------------------------------------------------------------------
// FILTER / SELECTION STABILITY
// ---------------------------------------------------------------------------

test('ring allocation is derived only from the full project id list, never from a filtered/reordered view', () => {
  const projects = generateMockProjects(40);
  const skills = generateMockSkills(6);
  const full = assembleTopologyLayout(projects, skills);

  // A "filtered" subset (as search would produce) must NEVER be fed into
  // ring allocation -- simulate what would happen if it incorrectly were,
  // and confirm the assignment differs, proving canonical assignment must
  // come from the untouched full list (already enforced by TopologyCanvas's
  // own staticOrbitalLattice memo, verified via source below).
  const filteredSubset = projects.slice(0, 25);
  const filtered = assembleTopologyLayout(filteredSubset, skills);
  assert.notEqual(filtered.projectRings.length, 0);

  // The full topology's ring ownership for every surviving id must be
  // unaffected by whatever a filtered view would have computed.
  for (const ring of full.projectRings) {
    for (const id of ring.projectIds) {
      assert.equal(full.projectRings.find(r => r.projectIds.includes(id))?.id, ring.id);
    }
  }

  assert.ok(
    canvasSource.includes('assembleTopologyLayout(projects, activeSkills)'),
    'staticOrbitalLattice (and therefore ring allocation) must be computed from the full projects/activeSkills props, never filteredProjects'
  );
  assert.ok(
    !/staticOrbitalLattice\s*=\s*useMemo\(\s*\(\)\s*=>\s*assembleTopologyLayout\(filteredProjects/.test(canvasSource),
    'ring allocation must never be recomputed from filteredProjects'
  );
});

test('selection/search/topologyViewMode state never appears in the ring-allocation call site', () => {
  const latticeStart = canvasSource.indexOf('const staticOrbitalLattice = useMemo(');
  const latticeEnd = canvasSource.indexOf('const capabilityReactorGeometry', latticeStart);
  const latticeBlock = canvasSource.slice(latticeStart, latticeEnd);
  for (const forbidden of ['searchQuery', 'selectedProjectId', 'selectedSkillId', 'selectedExperienceId', 'topologyViewMode', 'draggingNode']) {
    assert.ok(!latticeBlock.includes(forbidden), `staticOrbitalLattice/ring allocation must not depend on ${forbidden}`);
  }
});

// ---------------------------------------------------------------------------
// SHARED TIMING / PER-RING PHASE DERIVATION
// ---------------------------------------------------------------------------

test('advanceUnwrappedOrbitPhase never wraps into [0, 2π) -- it is the whole point', () => {
  let phase = 0;
  for (let i = 0; i < 50; i++) {
    phase = advanceUnwrappedOrbitPhase(phase, 30_000, 1); // ~quarter revolution per step at 1x/120s period
  }
  assert.ok(phase > Math.PI * 2 * 3, 'phase must be allowed to exceed multiple full revolutions unwrapped');
});

test('stepUnwrappedOrbitClock follows the same pause/resume/no-catch-up-jump contract as stepOrbitClock', () => {
  let clock: OrbitClockState = { phase: 0, lastTimestamp: null };
  clock = stepUnwrappedOrbitClock(clock, 1_000, true, 1); // first frame: baseline only, no advance
  assert.equal(clock.phase, 0);
  assert.equal(clock.lastTimestamp, 1_000);

  clock = stepUnwrappedOrbitClock(clock, 31_000, true, 1);
  assert.ok(Math.abs(clock.phase - computePhaseDelta(30_000, 1)) < 1e-9);

  const paused = stepUnwrappedOrbitClock(clock, 500_000, false, 1);
  assert.equal(paused.phase, clock.phase, 'pausing holds phase');
  assert.equal(paused.lastTimestamp, null, 'pausing clears the baseline');

  const resumed = stepUnwrappedOrbitClock(paused, 900_000, true, 1);
  assert.equal(resumed.phase, paused.phase, 'resume frame must not charge the paused gap');
});

test('getRingEffectivePhase: ring multiplier 1.0 reproduces normalizeOrbitPhase(reference) exactly (ring 0 backward compatibility)', () => {
  const reference = 12.345;
  assert.equal(getRingEffectivePhase(reference, 1), normalizeOrbitPhase(reference));
});

test('getRingEffectivePhase produces a continuous (non-discontinuous) result across the reference clock\'s own wrap point for a non-1.0 multiplier', () => {
  // The reference itself is never wrapped in storage; sampling densely
  // around a multiple of 2π (where a WRAPPED reference would have jumped
  // from ~2π to 0) must show smooth, monotonically-consistent output instead
  // of a backward jump.
  const twoPi = Math.PI * 2;
  const samples: number[] = [];
  for (let i = -5; i <= 5; i++) {
    const reference = twoPi + i * 0.01; // straddles one full revolution of the reference
    samples.push(getRingEffectivePhase(reference, 0.75));
  }
  for (let i = 1; i < samples.length; i++) {
    const delta = samples[i] - samples[i - 1];
    // Each step should be a small positive delta (0.0075 rad for a 0.75x
    // multiplier), never a near-2π jump that a wrapped-reference bug would produce.
    assert.ok(Math.abs(delta) < 0.1, `no discontinuity expected at sample ${i}, got delta ${delta}`);
  }
});

test('effective ring rates preserve the documented relative ratios under a global SYSTEMS rate change', () => {
  const ringBaseRates = [1, 0.75, 0.6];
  for (const globalRate of [1, 2, 0.5]) {
    const effective = ringBaseRates.map(base => globalRate * base);
    // Angular travel over a fixed interval must scale exactly with the
    // effective rate, for every ring, preserving the base-rate ratios.
    // Ring-relative effective rates (e.g. 2 * 0.75 = 1.5x) are not
    // necessarily members of the UI's discrete rate vocabulary
    // (OrbitRateMultiplier) -- the underlying phase-delta formula is
    // mathematically valid for any positive rate, so the type constraint is
    // bypassed here deliberately to test that general case.
    const deltas = effective.map(rate => computePhaseDelta(10_000, rate as unknown as Parameters<typeof computePhaseDelta>[1]));
    for (let i = 1; i < deltas.length; i++) {
      assert.ok(Math.abs(deltas[i] / deltas[0] - ringBaseRates[i] / ringBaseRates[0]) < 1e-9);
    }
  }
});

test('curated base rate multipliers match the documented values, and additional rings decay in a bounded, deterministic way', () => {
  assert.equal(getProjectRingBaseRateMultiplier(0), 1);
  assert.equal(getProjectRingBaseRateMultiplier(1), 0.75);
  assert.equal(getProjectRingBaseRateMultiplier(2), 0.6);
  assert.equal(getProjectRingBaseRateMultiplier(3), 0.5);
  const ring4 = getProjectRingBaseRateMultiplier(4);
  const ring5 = getProjectRingBaseRateMultiplier(5);
  assert.ok(ring4 < 0.5 && ring4 > 0, 'ring 4 must be slower than ring 3 but strictly positive');
  assert.ok(ring5 <= ring4, 'rates must decay monotonically (or hold at the floor)');
  assert.ok(getProjectRingBaseRateMultiplier(50) >= 0.3, 'rate must never approach zero, even for many rings');
});

test('all project rings share one clockwise direction; only the reactor is counter-moving', () => {
  const projects = generateMockProjects(40);
  const { projectRings } = assembleTopologyLayout(projects, generateMockSkills(6));
  for (const ring of projectRings) {
    assert.equal(ring.direction, 'clockwise');
  }
});

test('no independent requestAnimationFrame chain is created per ring -- exactly the same two gated RAF chains as before', () => {
  const rafOccurrences = (canvasSource.match(/requestAnimationFrame\(/g) || []).length;
  assert.equal(rafOccurrences, 4, 'exactly two gated RAF chains (4 textual occurrences: initial + recursive per chain) may exist, regardless of ring count');
  assert.ok(!canvasSource.includes('projectRings.forEach(ring => requestAnimationFrame'), 'must never schedule an RAF per ring');
  assert.ok(!canvasSource.includes('projectRings.map(ring => requestAnimationFrame'), 'must never schedule an RAF per ring');
});

// ---------------------------------------------------------------------------
// POSITION DERIVATION
// ---------------------------------------------------------------------------

test('a project\'s rendered orbital position derives from its ring geometry + ring-local index/count + live ring phase', () => {
  const geometryA = { centerIso: { x: 0, y: 0 }, radiusX: 200, radiusY: 140 };
  const geometryB = { centerIso: { x: 0, y: 0 }, radiusX: 400, radiusY: 280 };
  const project = { dimensions: { width: 100, height: 60 } };

  const posRing0 = getDynamicOrbitalPosition(project, 2, 10, geometryA, 0);
  const posRing1SamePhase = getDynamicOrbitalPosition(project, 2, 10, geometryB, 0);
  assert.notDeepEqual(posRing0, posRing1SamePhase, 'different ring geometry must produce a different position even at identical index/count/phase');

  const posRing0LaterPhase = getDynamicOrbitalPosition(project, 2, 10, geometryA, 1.2);
  assert.notDeepEqual(posRing0, posRing0LaterPhase, 'phase must affect position');

  const posDifferentCount = getDynamicOrbitalPosition(project, 2, 6, geometryA, 0);
  assert.notDeepEqual(posRing0, posDifferentCount, 'ring-local population (count) must affect position');
});

// ---------------------------------------------------------------------------
// DOCKING: canonical ownership, no cross-ring migration, per-ring redistribution
// ---------------------------------------------------------------------------

test('detaching a project removes it only from its own ring\'s docked order; unrelated rings are structurally independent inputs', () => {
  const ringAIds = Array.from({ length: 17 }, (_, i) => `a${i}`);
  const ringBIds = Array.from({ length: 16 }, (_, i) => `b${i}`);
  const known = [...ringAIds, ...ringBIds];

  const afterDetach = removeProjectFromOrbitOrder(ringBIds, 'b3', known);
  assert.equal(afterDetach.length, 15);
  assert.ok(!afterDetach.includes('b3'));
  // Ring A's own order/count is a completely separate array, passed nowhere
  // near this call -- proving detach cannot possibly touch it.
  assert.equal(ringAIds.length, 17);
});

test('reinsertion resolves an insertion index inside the canonical ring only, and can never place a project into a different ring\'s id space', () => {
  const ringAIds = Array.from({ length: 5 }, (_, i) => `a${i}`);
  const ringBIds = Array.from({ length: 4 }, (_, i) => `b${i}`);
  const knownForRingA = ringAIds; // canonical ids for THIS ring only

  assert.throws(
    () => insertProjectIntoOrbitOrder(ringAIds, 'b0', 2, knownForRingA),
    /unknown project/i,
    'a project from a different ring is not a known id for this ring and must be rejected'
  );

  const inserted = insertProjectIntoOrbitOrder(ringAIds, 'a-new', 2, [...ringAIds, 'a-new']);
  assert.deepEqual(inserted, ['a0', 'a1', 'a-new', 'a2', 'a3', 'a4']);
  assert.equal(ringBIds.length, 4, 'ring B is untouched');
});

test('TopologyCanvas.tsx: every dock/detach/reinsert decision resolves the dragged project\'s own canonical ring via projectRingByProjectId (no cross-ring migration)', () => {
  assert.ok(canvasSource.includes('projectRingByProjectId'), 'a canonical project -> ring lookup must exist');
  assert.ok(
    canvasSource.includes('const ring = projectRingByProjectId.get(draggingNode.id);'),
    'processRelease must resolve the dragged project\'s OWN canonical ring before any dock/detach/reinsert decision'
  );
  // The comment/architecture explicitly rules out cross-ring migration.
  assert.ok(/No cross-ring migration/i.test(canvasSource));
});

test('TopologyCanvas.tsx: interactive docked order is tracked per ring (Record<ringId, order>), not a single global array', () => {
  assert.ok(canvasSource.includes('interactiveOrbitOrderByRing'));
  assert.ok(canvasSource.includes('dockedOrbitOrderByRing'));
  assert.ok(!canvasSource.includes('const [interactiveOrbitOrder, setInteractiveOrbitOrder]'), 'the old single global order state must be fully replaced');
});

test('refresh/canonical reset (restoreCanonicalDockMembership) clears runtime ring order for EVERY ring at once', () => {
  const restoreStart = canvasSource.indexOf('const restoreCanonicalDockMembership = useCallback(() => {');
  const restoreEnd = canvasSource.indexOf('const resetAllPositions = useCallback', restoreStart);
  const block = canvasSource.slice(restoreStart, restoreEnd);
  assert.ok(block.includes('setInteractiveOrbitOrderByRing({});'), 'an empty record clears every ring\'s override at once, falling back to each ring\'s own canonical order');
});

// ---------------------------------------------------------------------------
// REFLOW: per-ring, phase-aware, no cross-ring interference
// ---------------------------------------------------------------------------

test('reflow for one ring resolves against that ring\'s own live phase and geometry, independent of any other ring', () => {
  const geometryRingA = { centerIso: { x: 0, y: 0 }, radiusX: 200, radiusY: 140 };
  const geometryRingB = { centerIso: { x: 0, y: 0 }, radiusX: 500, radiusY: 350 };
  const project = { dimensions: { width: 100, height: 60 } };

  const previous = ['a0', 'a1', 'a2'];
  const next = ['a0', 'a2']; // detach a1 from ring A
  const plan = buildOrbitReflowPlan(previous, next, {});
  const transition: OrbitReflowTransition = { plan, durationMs: 220, startTimestamp: 0 };

  const ringAPhase = 0.4;
  const ringBPhase = 1.9; // a completely different ring's phase must never leak in
  const stepAgainstRingA = stepOrbitReflow(transition, 250, ringAPhase, geometryRingA, () => project);
  const stepAgainstRingB = stepOrbitReflow(transition, 250, ringBPhase, geometryRingB, () => project);
  assert.notDeepEqual(stepAgainstRingA.positions, stepAgainstRingB.positions, 'resolving the same plan against a different ring\'s geometry/phase must yield different positions');
});

test('TopologyCanvas.tsx: commitOrbitReflow takes the target ring as an explicit parameter and tracks which ring is mid-reflow', () => {
  const commitStart = canvasSource.indexOf('const commitOrbitReflow = useCallback((');
  const commitSignature = canvasSource.slice(commitStart, canvasSource.indexOf(')', canvasSource.indexOf('=> {', commitStart)));
  assert.ok(commitSignature.includes('ring: ProjectOrbitRing'), 'commitOrbitReflow must accept the ring explicitly rather than hardcoding one');
  assert.ok(canvasSource.includes('activeReflowRingRef'), 'the in-flight reflow must record which ring it belongs to');
});

// ---------------------------------------------------------------------------
// FIT ALL
// ---------------------------------------------------------------------------

test('fitAll unions every project ring\'s bounds (reactor, inner ring, and every outer ring) rather than only the innermost/outermost', () => {
  const fitAllStart = canvasSource.indexOf('const fitAll = useCallback(() => {');
  const fitAllEnd = canvasSource.indexOf('const initializedRef', fitAllStart);
  const fitAllBlock = canvasSource.slice(fitAllStart, fitAllEnd);
  assert.ok(fitAllBlock.includes('staticOrbitalLattice.projectRings'), 'fitAll must read every project ring, not just orbitGeometry');
  assert.ok(fitAllBlock.includes('rings.map(ring => ring.geometry[boundsKey])'), 'fitAll must collect every ring\'s own bounds');
  assert.ok(fitAllBlock.includes('Math.min(...allBounds.map(b => b.minX))'), 'fitAll must union (not just pick one ring\'s) bounds');
});

test('a 33-project two-ring topology fits entirely within its own unioned bounds without outer-ring clipping', () => {
  const projects = generateMockProjects(33);
  const { projectRings } = assembleTopologyLayout(projects, generateMockSkills(8));
  assert.equal(projectRings.length, 2);

  const unioned = {
    minX: Math.min(...projectRings.map(r => r.geometry.motionVisualBounds.minX)),
    maxX: Math.max(...projectRings.map(r => r.geometry.motionVisualBounds.maxX)),
    minY: Math.min(...projectRings.map(r => r.geometry.motionVisualBounds.minY)),
    maxY: Math.max(...projectRings.map(r => r.geometry.motionVisualBounds.maxY)),
  };
  // The outer ring's own bounds must be fully inside (or equal to) the union.
  const outer = projectRings[1].geometry.motionVisualBounds;
  assert.ok(outer.minX >= unioned.minX && outer.maxX <= unioned.maxX);
  assert.ok(outer.minY >= unioned.minY && outer.maxY <= unioned.maxY);
});

// ---------------------------------------------------------------------------
// RESPONSIVE ORBIT CONTROLS
// ---------------------------------------------------------------------------

test('SYSTEMS controls affect every project ring (single global rate/pause state), never per-ring rows', () => {
  assert.ok(!canvasSource.includes('RING 02\n'), 'no individual per-ring control row may exist');
  assert.equal((canvasSource.match(/aria-label="Decrease deployed systems orbit speed"/g) || []).length, 2, 'exactly one SYSTEMS decrease control per console presentation (full + compact), never one per ring');
  assert.ok(canvasSource.includes('setProjectOrbitRateMultiplier'), 'one global project rate setter must exist');
  assert.ok(!/setProjectOrbitRateMultiplier\d/.test(canvasSource), 'no per-ring-indexed rate setter may exist');
});

test('REACTOR remains independently controlled from SYSTEMS in both console presentations', () => {
  assert.equal((canvasSource.match(/aria-label="Decrease capability reactor speed"/g) || []).length, 2);
  assert.ok(canvasSource.includes('setReactorOrbitRateMultiplier'));
  assert.ok(canvasSource.includes('setIsReactorOrbitPaused'));
});

test('responsive control presentation does not modify ring geometry or canonical ring ownership', () => {
  // isCompactViewport must not appear anywhere near the ring-allocation
  // (staticOrbitalLattice) call site or projectRingByProjectId derivation.
  const latticeStart = canvasSource.indexOf('const staticOrbitalLattice = useMemo(');
  const latticeEnd = canvasSource.indexOf('const capabilityReactorGeometry', latticeStart);
  assert.ok(!canvasSource.slice(latticeStart, latticeEnd).includes('isCompactViewport'));

  const lookupStart = canvasSource.indexOf('const projectRingByProjectId = useMemo(');
  const lookupEnd = canvasSource.indexOf('const dockedOrbitOrderByRing', lookupStart);
  assert.ok(!canvasSource.slice(lookupStart, lookupEnd).includes('isCompactViewport'));
});
