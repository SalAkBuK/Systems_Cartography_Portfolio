// Capability (skill) ring spacing regression coverage. The capability ring
// loop in topologyLayout.ts used to grow from one ring to the next by a flat
// "rx += 80 / ry += 60" increment that had no relationship to a ring's own
// realized envelope (which can be pushed outward by the loop's own
// collision-driven radial stepping). As capability count grew (~28+), that
// flat increment could leave adjacent rings visually crowded, or in the
// worst case let a heavily-packed ring's pushed-out nodes sit right up
// against the next ring's nominal start. This suite pins the replacement
// invariant: ring N+1's seed radius must derive from ring N's REALIZED outer
// envelope plus the capability node footprint plus an explicit minimum
// clearance -- matching this codebase's established convention (pure-function
// node:test assertions, no React/jsdom harness -- see
// adaptiveProjectRings.test.ts, which this suite mirrors for capability
// rings).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assembleTopologyLayout,
  buildCapabilityRingLayout,
  checkAABBOverlap,
  getNodeBounds,
  CAPABILITY_RING_MIN_CLEARANCE,
} from '../src/utils/topologyLayout.ts';
import { GITHUB_SNAPSHOT } from '../src/data/githubSnapshot.generated.ts';
import { InfrastructureSkill } from '../src/types.ts';

// Capability nodes are placed as fixed 48x48 logical footprints throughout
// topologyLayout.ts (every getNodeBounds('skill', ..., 48, 48) call, and
// already hardcoded the same way by tests/staticOrbitalLattice.test.ts and
// tests/staticOrbitalLatticeSnapshot.test.ts). This is the footprint the
// ring-spacing invariant below is measured against.
const CAPABILITY_NODE_FOOTPRINT = 48;
const CAPABILITY_NODE_HALF_FOOTPRINT = CAPABILITY_NODE_FOOTPRINT / 2;

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

// ---------------------------------------------------------------------------
// SPACING INVARIANT
// ---------------------------------------------------------------------------

test('capability ring counts: 28 (current), 35, and 50 capabilities all require more than one ring', () => {
  for (const count of [28, 35, 50]) {
    const { rings } = buildCapabilityRingLayout(generateMockSkills(count));
    assert.ok(rings.length > 1, `${count} capabilities should require multiple rings to reproduce the reported crowding`);
    assert.equal(rings.reduce((sum, r) => sum + r.skillIds.length, 0), count, `every capability must be assigned to exactly one ring for ${count}`);
  }
});

test('every ring after the first seeds its radius from the PREVIOUS ring\'s realized outer envelope plus footprint plus CAPABILITY_RING_MIN_CLEARANCE -- never a flat increment', () => {
  for (const count of [28, 35, 50]) {
    const { rings } = buildCapabilityRingLayout(generateMockSkills(count));
    for (let i = 1; i < rings.length; i++) {
      const prev = rings[i - 1];
      const ring = rings[i];
      const expectedSeedX = prev.outerX + CAPABILITY_NODE_HALF_FOOTPRINT + CAPABILITY_RING_MIN_CLEARANCE;
      const expectedSeedY = prev.outerY + CAPABILITY_NODE_HALF_FOOTPRINT + CAPABILITY_RING_MIN_CLEARANCE;
      assert.ok(
        Math.abs(ring.seedRadiusX - expectedSeedX) < 1e-9,
        `count=${count} ring ${i}: seedRadiusX ${ring.seedRadiusX} must equal previous ring's realized outerX (${prev.outerX}) + footprint + clearance (${expectedSeedX})`
      );
      assert.ok(
        Math.abs(ring.seedRadiusY - expectedSeedY) < 1e-9,
        `count=${count} ring ${i}: seedRadiusY ${ring.seedRadiusY} must equal previous ring's realized outerY (${prev.outerY}) + footprint + clearance (${expectedSeedY})`
      );
    }
  }
});

test('minimum inter-ring clearance invariant: every ring maintains at least CAPABILITY_RING_MIN_CLEARANCE of breathing room beyond the previous ring\'s realized envelope and its own footprint', () => {
  for (const count of [28, 35, 50]) {
    const { rings } = buildCapabilityRingLayout(generateMockSkills(count));
    for (let i = 1; i < rings.length; i++) {
      const prev = rings[i - 1];
      const ring = rings[i];
      const clearanceX = ring.seedRadiusX - prev.outerX - CAPABILITY_NODE_HALF_FOOTPRINT;
      const clearanceY = ring.seedRadiusY - prev.outerY - CAPABILITY_NODE_HALF_FOOTPRINT;
      assert.ok(clearanceX >= CAPABILITY_RING_MIN_CLEARANCE - 1e-9, `count=${count} ring ${i}: X clearance ${clearanceX} fell below the invariant`);
      assert.ok(clearanceY >= CAPABILITY_RING_MIN_CLEARANCE - 1e-9, `count=${count} ring ${i}: Y clearance ${clearanceY} fell below the invariant`);
    }
  }
});

test('regression: 28-capability ring 1 seed radius now clears further than the original flat "+80/+60" increment ever guaranteed', () => {
  // Documents the actual reported bug: the old code always seeded ring 1 at
  // exactly rx=90+80=170, ry=65+60=125, regardless of how far ring 0's own
  // nodes actually landed. With 28 capabilities, ring 0 packs enough nodes
  // that its realized envelope alone (before any clearance is even added)
  // already approaches that old fixed seed -- proving the old increment left
  // little to no real breathing room.
  const { rings } = buildCapabilityRingLayout(generateMockSkills(28));
  const OLD_FIXED_RING1_RX = 90 + 80;
  const OLD_FIXED_RING1_RY = 65 + 60;
  assert.ok(rings[0].outerX > OLD_FIXED_RING1_RX * 0.6, 'sanity: ring 0 must actually pack out far enough for this regression to be meaningful');
  assert.ok(rings[1].seedRadiusX > OLD_FIXED_RING1_RX, `new ring 1 seedRadiusX (${rings[1].seedRadiusX}) must exceed the old flat increment (${OLD_FIXED_RING1_RX})`);
  assert.ok(rings[1].seedRadiusY > OLD_FIXED_RING1_RY, `new ring 1 seedRadiusY (${rings[1].seedRadiusY}) must exceed the old flat increment (${OLD_FIXED_RING1_RY})`);
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

test('collision-driven radial adjustment (if any triggers) cannot push a ring\'s nodes into the next ring: no cross-ring overlap even where per-node pushback occurred', () => {
  // 50 capabilities packs ring 2 with 26 nodes -- the densest ring, most
  // likely to trigger the per-node collision-avoidance radial stepping.
  const { skillPositions, rings } = buildCapabilityRingLayout(generateMockSkills(50));
  assert.ok(rings.length >= 3);
  const boxesByRing = rings.map(ring =>
    ring.skillIds.map(id => ({ id, ...getNodeBounds('skill', skillPositions[id], CAPABILITY_NODE_FOOTPRINT, CAPABILITY_NODE_FOOTPRINT) }))
  );
  for (let r = 0; r < boxesByRing.length - 1; r++) {
    for (const a of boxesByRing[r]) {
      for (const b of boxesByRing[r + 1]) {
        assert.equal(checkAABBOverlap(a, b, 0), false, `${a.id} (ring ${r}) overlaps ${b.id} (ring ${r + 1})`);
      }
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
// REAL COMMITTED SNAPSHOT (current ~28 capability count)
// ---------------------------------------------------------------------------

test('real committed snapshot currently has ~28 capabilities and maintains the same spacing invariant', () => {
  const skills = sortSkillsCanonically(GITHUB_SNAPSHOT.skills);
  assert.ok(skills.length >= 25, 'expected the committed snapshot to still be in the ~28-capability regime this fix targets');

  const { rings, skillPositions } = buildCapabilityRingLayout(skills);
  assert.equal(Object.keys(skillPositions).length, skills.length);

  for (let i = 1; i < rings.length; i++) {
    const prev = rings[i - 1];
    const ring = rings[i];
    const clearanceX = ring.seedRadiusX - prev.outerX - CAPABILITY_NODE_HALF_FOOTPRINT;
    const clearanceY = ring.seedRadiusY - prev.outerY - CAPABILITY_NODE_HALF_FOOTPRINT;
    assert.ok(clearanceX >= CAPABILITY_RING_MIN_CLEARANCE - 1e-9);
    assert.ok(clearanceY >= CAPABILITY_RING_MIN_CLEARANCE - 1e-9);
  }

  const boxes = Object.entries(skillPositions).map(([id, pos]) => ({ id, ...getNodeBounds('skill', pos, CAPABILITY_NODE_FOOTPRINT, CAPABILITY_NODE_FOOTPRINT) }));
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      assert.equal(checkAABBOverlap(boxes[i], boxes[j], 0), false, `${boxes[i].id} overlaps ${boxes[j].id}`);
    }
  }
});

test('assembleTopologyLayout on the real committed snapshot produces finite, fully-populated capability positions', () => {
  const { skillPositions } = assembleTopologyLayout(GITHUB_SNAPSHOT.projects, GITHUB_SNAPSHOT.skills);
  for (const skill of GITHUB_SNAPSHOT.skills) {
    const pos = skillPositions[skill.id];
    assert.ok(pos, `skill ${skill.id} has no canonical position`);
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

test('does not hard-code the current 28-capability count: the same invariant holds for an arbitrary count with no special-casing', () => {
  for (const count of [29, 41, 63]) {
    const { rings } = buildCapabilityRingLayout(generateMockSkills(count));
    assert.equal(rings.reduce((sum, r) => sum + r.skillIds.length, 0), count);
    for (let i = 1; i < rings.length; i++) {
      const prev = rings[i - 1];
      const ring = rings[i];
      assert.ok(ring.seedRadiusX - prev.outerX - CAPABILITY_NODE_HALF_FOOTPRINT >= CAPABILITY_RING_MIN_CLEARANCE - 1e-9);
      assert.ok(ring.seedRadiusY - prev.outerY - CAPABILITY_NODE_HALF_FOOTPRINT >= CAPABILITY_RING_MIN_CLEARANCE - 1e-9);
    }
  }
});
