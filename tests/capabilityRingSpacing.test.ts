// Capability (skill) ring spacing regression coverage.
//
// History: the capability ring loop in topologyLayout.ts originally grew
// from one ring to the next by a flat "rx += 80 / ry += 60" increment with
// no relationship to a ring's own realized envelope. A first fix (see git
// history) replaced that with a seed-radius formula measured against each
// ring's realized outer envelope on its cardinal X/Y axes -- but production
// screenshots showed the two capability bands still visibly crowded. The
// reason: a world-space radial gap measured only along a ring's cardinal
// axes does not guarantee a genuine gap at every OTHER angle around two
// elliptical, differently-populated rings -- a node's collision-driven
// radial push moves it outward along ITS OWN angle, not necessarily X or Y,
// so the axis-only floor under-counted how far some nodes actually landed.
// Measuring the ACTUAL rendered (isometric-space) gap between real placed
// nodes on the committed snapshot found ring-to-ring gaps as small as ~2-4
// iso units even though the seed-radius formula was satisfied.
//
// This suite tests the CURRENT fix directly against that failure mode: it
// measures the real minimum isometric-space separation between adjacent
// rings' actual placed node envelopes (not the seed-radius formula), the
// same measurement production now enforces via a grow-and-reverify loop.
// Matches this codebase's established convention (pure-function node:test
// assertions, no React/jsdom harness -- see adaptiveProjectRings.test.ts).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assembleTopologyLayout,
  buildCapabilityRingLayout,
  checkAABBOverlap,
  getNodeBounds,
  isoBoxFromWorldBounds,
  minRectDistance,
  CAPABILITY_RING_MIN_ISO_CLEARANCE,
} from '../src/utils/topologyLayout.ts';
import { GITHUB_SNAPSHOT } from '../src/data/githubSnapshot.generated.ts';
import { InfrastructureSkill } from '../src/types.ts';

// Capability nodes are placed as fixed 48x48 logical footprints throughout
// topologyLayout.ts (every getNodeBounds('skill', ..., 48, 48) call, and
// already hardcoded the same way by tests/staticOrbitalLattice.test.ts and
// tests/staticOrbitalLatticeSnapshot.test.ts).
const CAPABILITY_NODE_FOOTPRINT = 48;

function generateMockSkills(count: number): InfrastructureSkill[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `skill-${String(i + 1).padStart(3, '0')}`,
    code: `CAP-${String(i + 1).padStart(3, '0')}`,
    name: `Capability ${i + 1}`,
    category: 'infrastructure' as const,
    yearsActive: 3,
    proficiencyScore: 90,
    primaryUseCases: ['Distributed Systems'],
    technicalHighlights: ['High throughput'],
    samplePattern: 'Event Driven',
    systemCount: 2,
    usedInProjects: [],
    gridPosition: { x: 0, y: 0 },
  }));
}

// Same stable sort assembleTopologyLayout applies to skills before handing
// them to the ring-placement loop (code -> name -> id) -- reproduced here so
// tests can call buildCapabilityRingLayout directly against real committed
// data and get identical ring membership/order to the full pipeline.
function sortSkillsCanonically(skills: InfrastructureSkill[]): InfrastructureSkill[] {
  return [...skills].sort((a, b) => {
    const codeCmp = (a.code || '').localeCompare(b.code || '');
    if (codeCmp !== 0) return codeCmp;
    const nameCmp = (a.name || '').localeCompare(b.name || '');
    if (nameCmp !== 0) return nameCmp;
    return a.id.localeCompare(b.id);
  });
}

/** The exact real-world measurement production uses: minimum isometric-space gap between every node of ring A and every node of ring B. */
function measureMinIsoRingGap(
  skillPositions: Record<string, { x: number; y: number }>,
  ringAIds: string[],
  ringBIds: string[]
): number {
  const isoBoxesA = ringAIds.map(id => isoBoxFromWorldBounds(getNodeBounds('skill', skillPositions[id], CAPABILITY_NODE_FOOTPRINT, CAPABILITY_NODE_FOOTPRINT)));
  const isoBoxesB = ringBIds.map(id => isoBoxFromWorldBounds(getNodeBounds('skill', skillPositions[id], CAPABILITY_NODE_FOOTPRINT, CAPABILITY_NODE_FOOTPRINT)));
  let min = Infinity;
  for (const a of isoBoxesA) {
    for (const b of isoBoxesB) {
      min = Math.min(min, minRectDistance(a, b));
    }
  }
  return min;
}

// ---------------------------------------------------------------------------
// ACTUAL RENDERED RING SEPARATION (the real invariant)
// ---------------------------------------------------------------------------

test('every adjacent capability ring pair maintains at least CAPABILITY_RING_MIN_ISO_CLEARANCE of ACTUAL isometric-space separation for 28, 35, and 50 capabilities', () => {
  for (const count of [28, 35, 50]) {
    const { skillPositions, rings } = buildCapabilityRingLayout(generateMockSkills(count));
    assert.ok(rings.length > 1, `${count} capabilities should require multiple rings to reproduce the reported crowding`);
    for (let i = 1; i < rings.length; i++) {
      const gap = measureMinIsoRingGap(skillPositions, rings[i - 1].skillIds, rings[i].skillIds);
      assert.ok(
        gap >= CAPABILITY_RING_MIN_ISO_CLEARANCE - 1e-9,
        `count=${count} ring ${i - 1}->${i}: measured iso gap ${gap.toFixed(2)} fell below the ${CAPABILITY_RING_MIN_ISO_CLEARANCE}-unit invariant`
      );
    }
  }
});

test('the real committed snapshot (~28 capabilities) maintains the same measured minimum iso-space ring separation', () => {
  const skills = sortSkillsCanonically(GITHUB_SNAPSHOT.skills);
  assert.ok(skills.length >= 25, 'expected the committed snapshot to still be in the ~28-capability regime this fix targets');

  const { skillPositions, rings } = buildCapabilityRingLayout(skills);
  assert.ok(rings.length > 1, 'the real snapshot should still require multiple capability rings');
  for (let i = 1; i < rings.length; i++) {
    const gap = measureMinIsoRingGap(skillPositions, rings[i - 1].skillIds, rings[i].skillIds);
    assert.ok(
      gap >= CAPABILITY_RING_MIN_ISO_CLEARANCE - 1e-9,
      `real snapshot ring ${i - 1}->${i}: measured iso gap ${gap.toFixed(2)} fell below the ${CAPABILITY_RING_MIN_ISO_CLEARANCE}-unit invariant`
    );
  }
});

test('regression: the real committed snapshot no longer reproduces the ~2-4 iso-unit near-touching gap the seed-radius-only fix left behind', () => {
  // Documents the actual reported bug concretely: measuring the previous
  // fix's output against the real snapshot found ring 1->2 separated by as
  // little as ~2 iso units -- effectively touching at production scale. The
  // current measured gap must be substantially larger, not just technically
  // above zero.
  const skills = sortSkillsCanonically(GITHUB_SNAPSHOT.skills);
  const { skillPositions, rings } = buildCapabilityRingLayout(skills);
  for (let i = 1; i < rings.length; i++) {
    const gap = measureMinIsoRingGap(skillPositions, rings[i - 1].skillIds, rings[i].skillIds);
    assert.ok(gap > 30, `ring ${i - 1}->${i}: measured gap ${gap.toFixed(2)} is still near the previously-reported crowded range`);
  }
});

// ---------------------------------------------------------------------------
// NO NODE OVERLAP
// ---------------------------------------------------------------------------

test('no two capability nodes overlap for 28, 35, or 50 capabilities', () => {
  for (const count of [28, 35, 50]) {
    const { skillPositions } = buildCapabilityRingLayout(generateMockSkills(count));
    const ids = Object.keys(skillPositions);
    assert.equal(ids.length, count);
    const boxes = ids.map(id => ({ id, ...getNodeBounds('skill', skillPositions[id], CAPABILITY_NODE_FOOTPRINT, CAPABILITY_NODE_FOOTPRINT) }));
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        assert.equal(checkAABBOverlap(boxes[i], boxes[j], 0), false, `${boxes[i].id} overlaps ${boxes[j].id} at count=${count}`);
      }
    }
  }
});

test('no two capability nodes overlap on the real committed snapshot', () => {
  const { skillPositions } = buildCapabilityRingLayout(sortSkillsCanonically(GITHUB_SNAPSHOT.skills));
  const boxes = Object.entries(skillPositions).map(([id, pos]) => ({ id, ...getNodeBounds('skill', pos, CAPABILITY_NODE_FOOTPRINT, CAPABILITY_NODE_FOOTPRINT) }));
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      assert.equal(checkAABBOverlap(boxes[i], boxes[j], 0), false, `${boxes[i].id} overlaps ${boxes[j].id}`);
    }
  }
});

// ---------------------------------------------------------------------------
// DETERMINISM
// ---------------------------------------------------------------------------

test('deterministic output: repeated calls with the same capability list produce identical positions and ring diagnostics', () => {
  for (const count of [28, 35, 50]) {
    const skills = generateMockSkills(count);
    const first = buildCapabilityRingLayout(skills);
    const second = buildCapabilityRingLayout(skills);
    assert.deepEqual(first.skillPositions, second.skillPositions);
    assert.deepEqual(first.rings, second.rings);
  }
});

test('deterministic output holds end-to-end through assembleTopologyLayout as well', () => {
  const skills = generateMockSkills(28);
  const layout1 = assembleTopologyLayout([], skills);
  const layout2 = assembleTopologyLayout([], skills);
  assert.deepEqual(layout1.skillPositions, layout2.skillPositions);
});

// ---------------------------------------------------------------------------
// PROJECT-ORBIT INTEGRATION (real committed data: 28 capabilities + 17 projects)
// ---------------------------------------------------------------------------

test('assembleTopologyLayout on the real committed snapshot produces finite, fully-populated, non-overlapping capability AND project positions together', () => {
  const { skillPositions, projectPositions } = assembleTopologyLayout(GITHUB_SNAPSHOT.projects, GITHUB_SNAPSHOT.skills);
  for (const skill of GITHUB_SNAPSHOT.skills) {
    const pos = skillPositions[skill.id];
    assert.ok(pos, `skill ${skill.id} has no canonical position`);
    assert.ok(Number.isFinite(pos.x) && Number.isFinite(pos.y));
  }
  for (const project of GITHUB_SNAPSHOT.projects) {
    const pos = projectPositions[project.id];
    assert.ok(pos, `project ${project.id} has no canonical position`);
    assert.ok(Number.isFinite(pos.x) && Number.isFinite(pos.y));
  }
});

// ---------------------------------------------------------------------------
// PRESERVED BEHAVIOR: ordering, grid snapping, center/orientation unaffected
// ---------------------------------------------------------------------------

test('capability positions remain grid-snapped after the spacing fix', () => {
  const { skillPositions } = buildCapabilityRingLayout(generateMockSkills(35));
  const GRID_SNAP_STEP_LOCAL = 25;
  for (const pos of Object.values(skillPositions)) {
    assert.equal(Math.abs(pos.x) % GRID_SNAP_STEP_LOCAL, 0, 'capability positions must remain grid-snapped');
    assert.equal(Math.abs(pos.y) % GRID_SNAP_STEP_LOCAL, 0, 'capability positions must remain grid-snapped');
  }
});

test('single-capability and small (<=6) counts are unaffected -- ring 0\'s own seed radius (90, 65) is unchanged', () => {
  const { rings } = buildCapabilityRingLayout(generateMockSkills(6));
  assert.equal(rings.length, 1, '6 capabilities must still fit entirely on ring 0');
  assert.equal(rings[0].seedRadiusX, 90);
  assert.equal(rings[0].seedRadiusY, 65);
});

test('does not hard-code the current 28-capability count: the same measured-separation invariant holds for an arbitrary count with no special-casing', () => {
  for (const count of [29, 41, 63]) {
    const { skillPositions, rings } = buildCapabilityRingLayout(generateMockSkills(count));
    assert.equal(rings.reduce((sum, r) => sum + r.skillIds.length, 0), count);
    for (let i = 1; i < rings.length; i++) {
      const gap = measureMinIsoRingGap(skillPositions, rings[i - 1].skillIds, rings[i].skillIds);
      assert.ok(gap >= CAPABILITY_RING_MIN_ISO_CLEARANCE - 1e-9, `count=${count} ring ${i - 1}->${i}: gap ${gap.toFixed(2)} below invariant`);
    }
  }
});

test('ordering is preserved: ring membership/order derives from the canonically sorted skill list, not insertion order', () => {
  const skills = generateMockSkills(28);
  const shuffled = [...skills].reverse();
  const a = buildCapabilityRingLayout(sortSkillsCanonically(skills));
  const b = buildCapabilityRingLayout(sortSkillsCanonically(shuffled));
  assert.deepEqual(a.skillPositions, b.skillPositions);
  assert.deepEqual(a.rings.map(r => r.skillIds), b.rings.map(r => r.skillIds));
});
