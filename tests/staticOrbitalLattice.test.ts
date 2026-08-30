import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  assembleTopologyLayout,
  getNodeBounds,
  checkAABBOverlap,
  computeFitViewport,
  getConduitPresentationState,
} from '../src/utils/topologyLayout.ts';
import { project3DToIso } from '../src/utils/isometricProjection.ts';
import {
  getTopologyProjectDimensions,
  getTopologyProjectVisualBounds,
  ORBIT_PROJECT_SCALE,
} from '../src/utils/projectTopologyGeometry.ts';
import { getNodeBounds as collisionGetNodeBounds } from '../src/utils/collision.ts';
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
// 1-3. Deterministic slot assignment, array-order independence, N -> N slots
// ---------------------------------------------------------------------------

test('staticOrbitalLattice: deterministic slot assignment across repeated invocations', () => {
  const projects = generateMockProjects(18);
  const skills = generateMockSkills(6);
  const layout1 = assembleTopologyLayout(projects, skills);
  const layout2 = assembleTopologyLayout(projects, skills);
  assert.deepEqual(layout1.orbitGeometry, layout2.orbitGeometry, 'Orbit geometry must be 100% deterministic');
});

test('staticOrbitalLattice: shuffled input array order does not change slot assignment', () => {
  const projects = generateMockProjects(18);
  const skills = generateMockSkills(6);
  const standard = assembleTopologyLayout(projects, skills);
  const shuffled = assembleTopologyLayout([...projects].reverse(), [...skills].reverse());
  assert.deepEqual(standard.orbitGeometry, shuffled.orbitGeometry, 'Shuffling input order must not change orbit geometry');
});

test('staticOrbitalLattice: N projects produce exactly N unique slots across all project rings', () => {
  for (const n of [1, 5, 18, 40]) {
    const projects = generateMockProjects(n);
    const skills = generateMockSkills(6);
    const { orbitGeometry, projectRings } = assembleTopologyLayout(projects, skills);
    const allSlots = projectRings.flatMap(ring => ring.geometry.slots);
    assert.equal(allSlots.length, n, `Expected ${n} slots total across every ring`);
    const uniqueProjectIds = new Set(allSlots.map(s => s.projectId));
    assert.equal(uniqueProjectIds.size, n, 'Every slot must reference a unique project');
    // slotIndex is only unique WITHIN a ring (each ring restarts at 0), so
    // uniqueness is checked per ring rather than across the whole topology.
    for (const ring of projectRings) {
      const uniqueSlotIndexes = new Set(ring.geometry.slots.map(s => s.slotIndex));
      assert.equal(uniqueSlotIndexes.size, ring.geometry.slots.length, `slotIndex values must be unique within ${ring.id}`);
    }
    // orbitGeometry stays a genuine view of ring 0, never synthesized/divergent.
    assert.deepEqual(orbitGeometry, projectRings[0].geometry);
  }
});

// ---------------------------------------------------------------------------
// 4. Exactly ONE project ellipse — proven against ACTUAL rendered positions,
// not just the internal StaticOrbitSlot algebra.
// ---------------------------------------------------------------------------

test('staticOrbitalLattice: all project slots lie on exactly one shared ellipse (single radiusX/radiusY, single center)', () => {
  const projects = generateMockProjects(18);
  const skills = generateMockSkills(6);
  const { orbitGeometry } = assembleTopologyLayout(projects, skills);

  assert.equal(typeof orbitGeometry.radiusX, 'number');
  assert.equal(typeof orbitGeometry.radiusY, 'number');

  // Every slot's iso position must satisfy the ellipse equation for the SAME
  // center/radiusX/radiusY (proving there is no second ring with a different radius).
  for (const slot of orbitGeometry.slots) {
    const dx = (slot.isoX - orbitGeometry.centerIso.x) / orbitGeometry.radiusX;
    const dy = (slot.isoY - orbitGeometry.centerIso.y) / orbitGeometry.radiusY;
    const ellipseResidual = dx * dx + dy * dy;
    assert.ok(Math.abs(ellipseResidual - 1) < 1e-6, `Slot ${slot.projectId} does not lie on the canonical ellipse (residual ${ellipseResidual})`);
  }
});

test('staticOrbitalLattice: the ACTUAL stored/rendered project center — not just slot algebra — lies exactly on the ellipse', () => {
  const projects = generateMockProjects(18);
  const skills = generateMockSkills(6);
  const { projectPositions, orbitGeometry } = assembleTopologyLayout(projects, skills);

  for (const slot of orbitGeometry.slots) {
    // 1. Read the actual canonical position that rendering/collision/drag would use.
    const origin = projectPositions[slot.projectId];
    assert.ok(origin, `projectPositions missing for ${slot.projectId}`);

    // 2. Calculate the actual rendered project center using the SAME shared dimensions helper.
    const project = projects.find(p => p.id === slot.projectId)!;
    const dims = getTopologyProjectDimensions(project);
    const actualCenter = { x: origin.x + dims.width / 2, y: origin.y + dims.depth / 2 };

    // 3. Project that center through the canonical isometric projection.
    const actualIso = project3DToIso(actualCenter.x, actualCenter.y, 0);

    // 4. It must equal the slot's isoX/isoY within floating-point tolerance —
    // proving the STORED position (not merely the internal slot bookkeeping)
    // renders exactly where the ellipse says it should.
    assert.ok(Math.abs(actualIso.x - slot.isoX) < 1e-6, `${slot.projectId} actual iso.x ${actualIso.x} != slot.isoX ${slot.isoX}`);
    assert.ok(Math.abs(actualIso.y - slot.isoY) < 1e-6, `${slot.projectId} actual iso.y ${actualIso.y} != slot.isoY ${slot.isoY}`);

    // 5. And that point must itself satisfy the shared ellipse equation.
    const dx = (actualIso.x - orbitGeometry.centerIso.x) / orbitGeometry.radiusX;
    const dy = (actualIso.y - orbitGeometry.centerIso.y) / orbitGeometry.radiusY;
    const residual = dx * dx + dy * dy;
    assert.ok(Math.abs(residual - 1) < 1e-6, `${slot.projectId} actual rendered center does not satisfy the ellipse equation (residual ${residual})`);
  }
});

test('staticOrbitalLattice: canonical project positions are continuous (NOT grid-snapped), unlike capability positions', () => {
  const projects = generateMockProjects(11); // odd count unlikely to land on grid multiples by coincidence
  const skills = generateMockSkills(5);
  const { projectPositions, skillPositions } = assembleTopologyLayout(projects, skills);

  const GRID_SNAP_STEP_LOCAL = 25;
  const anyProjectUnsnapped = Object.values(projectPositions).some(
    pos => Math.abs(pos.x) % GRID_SNAP_STEP_LOCAL !== 0 || Math.abs(pos.y) % GRID_SNAP_STEP_LOCAL !== 0
  );
  assert.ok(anyProjectUnsnapped, 'Canonical project orbit positions must be continuous, not forced onto the grid');

  Object.values(skillPositions).forEach(pos => {
    assert.equal(Math.abs(pos.x) % GRID_SNAP_STEP_LOCAL, 0, 'Capability positions remain grid-snapped');
    assert.equal(Math.abs(pos.y) % GRID_SNAP_STEP_LOCAL, 0, 'Capability positions remain grid-snapped');
  });
});

// ---------------------------------------------------------------------------
// 5. Approximately 2π/N angular spacing
// ---------------------------------------------------------------------------

test('staticOrbitalLattice: slots are evenly distributed at ~2π/N angular spacing with no per-slot stagger', () => {
  const n = 18;
  const projects = generateMockProjects(n);
  const skills = generateMockSkills(6);
  const { orbitGeometry } = assembleTopologyLayout(projects, skills);

  const expectedSpacing = (2 * Math.PI) / n;
  const sortedAngles = orbitGeometry.slots.map(s => s.angle).sort((a, b) => a - b);
  for (let i = 1; i < sortedAngles.length; i++) {
    const spacing = sortedAngles[i] - sortedAngles[i - 1];
    assert.ok(Math.abs(spacing - expectedSpacing) < 1e-9, `Angular spacing ${spacing} deviates from expected ${expectedSpacing}`);
  }
});

// ---------------------------------------------------------------------------
// 6-7. Ellipse clears capability core; adjacent RENDERED VISUAL envelopes
// (structure + callout card, not just the ground footprint) do not overlap.
//
// Note: VERIFIED_PROJECTS/VERIFIED_SKILLS in src/data/verifiedPortfolioData.ts
// are an intentional empty placeholder in this repo (the deployed app resolves
// real topology data from the committed src/data/githubSnapshot.generated.ts
// instead) — asserting overlap-freedom against that empty array would be
// vacuously true and is NOT a real-portfolio regression. See
// tests/staticOrbitalLatticeSnapshot.test.ts for the actual committed-data test.
// ---------------------------------------------------------------------------

test('staticOrbitalLattice: pathological wide-width dataset resolves across its project rings with zero VISUAL envelope overlap', () => {
  const projects = generateMockProjects(30, [100, 250, 180, 320, 140]);
  const skills = generateMockSkills(12);
  const { projectPositions, skillPositions, projectRings } = assembleTopologyLayout(projects, skills);

  // 30 projects -> 2 concentric rings (18-per-ring capacity), not one ellipse
  // -- but zero-overlap must still hold across the whole topology.
  assert.equal(projectRings.reduce((sum, ring) => sum + ring.geometry.slots.length, 0), 30);

  const skillIsoBoxes = skills.map(s => {
    const bounds = getNodeBounds('skill', skillPositions[s.id], 48, 48);
    const corners = [
      project3DToIso(bounds.minX, bounds.minY, 0),
      project3DToIso(bounds.maxX, bounds.minY, 0),
      project3DToIso(bounds.maxX, bounds.maxY, 0),
      project3DToIso(bounds.minX, bounds.maxY, 0),
    ];
    return {
      id: s.id,
      minX: Math.min(...corners.map(c => c.x)), maxX: Math.max(...corners.map(c => c.x)),
      minY: Math.min(...corners.map(c => c.y)), maxY: Math.max(...corners.map(c => c.y)),
    };
  });
  const projectVisualBoxes = projects.map(p => ({
    id: p.id,
    ...getTopologyProjectVisualBounds(p, projectPositions[p.id]),
  }));

  for (let i = 0; i < projectVisualBoxes.length; i++) {
    for (let j = i + 1; j < projectVisualBoxes.length; j++) {
      assert.equal(checkAABBOverlap(projectVisualBoxes[i], projectVisualBoxes[j], 0), false, `${projectVisualBoxes[i].id} visual envelope overlaps ${projectVisualBoxes[j].id}`);
    }
  }
  for (const pb of projectVisualBoxes) {
    for (const sb of skillIsoBoxes) {
      assert.equal(checkAABBOverlap(pb, sb, 0), false, `${pb.id} visual envelope invades capability ${sb.id}`);
    }
  }
});

test('staticOrbitalLattice: synthetic long/wrapping titles do not cause callout card overlap between adjacent orbit slots', () => {
  const longTitleProjects = generateMockProjects(20).map((p, i) => ({
    ...p,
    title: i % 2 === 0
      ? 'An Extremely Long Two Line Wrapping Project Title Example'
      : `System Component ${i + 1}`,
  }));
  const skills = generateMockSkills(8);
  const { projectPositions } = assembleTopologyLayout(longTitleProjects, skills);

  const visualBoxes = longTitleProjects.map(p => ({
    id: p.id,
    ...getTopologyProjectVisualBounds(p, projectPositions[p.id]),
  }));

  for (let i = 0; i < visualBoxes.length; i++) {
    for (let j = i + 1; j < visualBoxes.length; j++) {
      assert.equal(checkAABBOverlap(visualBoxes[i], visualBoxes[j], 0), false, `${visualBoxes[i].id} callout envelope overlaps ${visualBoxes[j].id}`);
    }
  }
});

// ---------------------------------------------------------------------------
// 8. Orbit center derives from capability visual center (not raw world origin)
// ---------------------------------------------------------------------------

test('staticOrbitalLattice: orbit center is the isometric visual center of the capability core, not raw world (0,0)', () => {
  const projects = generateMockProjects(10);
  const skills = generateMockSkills(9); // multi-ring capability core, off-center in iso space
  const { skillPositions, orbitGeometry } = assembleTopologyLayout(projects, skills);

  const isoCorners: { x: number; y: number }[] = [];
  Object.values(skillPositions).forEach(pos => {
    const bounds = getNodeBounds('skill', pos, 48, 48);
    isoCorners.push(project3DToIso(bounds.minX, bounds.minY, 0));
    isoCorners.push(project3DToIso(bounds.maxX, bounds.minY, 0));
    isoCorners.push(project3DToIso(bounds.maxX, bounds.maxY, 0));
    isoCorners.push(project3DToIso(bounds.minX, bounds.maxY, 0));
  });
  const expectedCenterX = (Math.min(...isoCorners.map(c => c.x)) + Math.max(...isoCorners.map(c => c.x))) / 2;
  const expectedCenterY = (Math.min(...isoCorners.map(c => c.y)) + Math.max(...isoCorners.map(c => c.y))) / 2;

  assert.ok(Math.abs(orbitGeometry.centerIso.x - expectedCenterX) < 1e-6);
  assert.ok(Math.abs(orbitGeometry.centerIso.y - expectedCenterY) < 1e-6);
});

// ---------------------------------------------------------------------------
// 15. Project geometry scale consistency across rendering / layout / collision
// ---------------------------------------------------------------------------

test('projectTopologyGeometry: getTopologyProjectDimensions applies ORBIT_PROJECT_SCALE by default and matches the formula exactly', () => {
  const project = { dimensions: { width: 200, height: 80, levels: 2 } };
  const dims = getTopologyProjectDimensions(project);
  assert.equal(dims.width, 200 * 0.75 * ORBIT_PROJECT_SCALE);
  assert.equal(dims.depth, 55 * ORBIT_PROJECT_SCALE);
  assert.equal(dims.height, 80 * 0.75 * ORBIT_PROJECT_SCALE);
});

test('projectTopologyGeometry: collision.ts getNodeBounds uses the exact same shared dimensions as the layout engine', () => {
  const project = generateMockProjects(1)[0];
  const dims = getTopologyProjectDimensions(project);
  const pos = { x: 100, y: 200 };
  const collisionBounds = collisionGetNodeBounds('project', project.id, pos, [project]);
  // collision.ts adds a 14px clearance PADDING on top of the shared footprint
  assert.equal(collisionBounds.minX, pos.x - 14);
  assert.equal(collisionBounds.maxX, pos.x + dims.width + 14);
  assert.equal(collisionBounds.minY, pos.y - 14);
  assert.equal(collisionBounds.maxY, pos.y + dims.depth + 14);
});

// ---------------------------------------------------------------------------
// 10-14, 16. Component-level wiring that can only be verified structurally
// (position precedence, canonical-vs-filtered slot source, no motion/docking)
// ---------------------------------------------------------------------------

test('TopologyCanvas.tsx: static orbital lattice is computed from full projects/activeSkills, never filteredProjects', () => {
  const content = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');
  const latticeIdx = content.indexOf('const staticOrbitalLattice = useMemo(');
  assert.ok(latticeIdx !== -1, 'staticOrbitalLattice memo must exist');
  const latticeBlock = content.slice(latticeIdx, content.indexOf(');', latticeIdx) + 2);
  assert.ok(latticeBlock.includes('assembleTopologyLayout(projects, activeSkills)'), 'Lattice must be computed from full projects/activeSkills');
  assert.ok(!latticeBlock.includes('filteredProjects'), 'Lattice computation must not depend on filteredProjects');
  assert.ok(!latticeBlock.includes('topologyViewMode'), 'Lattice computation must not depend on topologyViewMode');
  assert.ok(!latticeBlock.includes('selectedExperienceId'), 'Lattice computation must not depend on selectedExperienceId');
});

test('TopologyCanvas.tsx: position precedence is drag > shared reflow > custom/detached > dynamic docked orbit > gridPosition fallback', () => {
  const content = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');

  // getProjectPos: drag branch returns first, then the active shared reflow,
  // then the effective dynamic-orbit/custom map, then raw gridPosition.
  const getProjectPosIdx = content.indexOf('const getProjectPos = useCallback(');
  const getProjectPosBlock = content.slice(getProjectPosIdx, content.indexOf('const getSkillPos', getProjectPosIdx));
  const dragCheckIdx = getProjectPosBlock.indexOf("draggingNode?.type === 'project'");
  const reflowCheckIdx = getProjectPosBlock.indexOf('orbitReflowRenderPositions[project.id]');
  const effectiveFallbackIdx = getProjectPosBlock.indexOf('effectiveProjectPositions[project.id] || project.gridPosition');
  assert.ok(
    dragCheckIdx !== -1 && reflowCheckIdx !== -1 && effectiveFallbackIdx !== -1 &&
      dragCheckIdx < reflowCheckIdx && reflowCheckIdx < effectiveFallbackIdx,
    'Drag must win over shared reflow, which must win over the dynamic/custom fallback'
  );

  // effectiveProjectPositions: dynamic docked orbit spread first, custom
  // detached/manual positions second so stationary detached projects win.
  assert.ok(
    content.includes('{ ...dockedProjectPositions, ...customProjectPositions }'),
    'Custom positions must be layered on top of (spread after) the dynamic docked orbit'
  );
  assert.ok(
    content.includes('getEffectiveCapabilityPositions(mountedCapabilityOrbitPositions, customSkillPositions)'),
    'Effective skill positions must resolve mounted reactor positions with custom overrides'
  );
});

test('TopologyCanvas.tsx: collision and snap-resolution read from effective (canonical+custom) positions, never raw custom state alone', () => {
  const content = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');

  const findNearestCalls = content.split('findNearestValidGridPosition(').length - 1;
  const checkCollisionsCalls = content.split('checkCollisions(').length - 1;
  assert.ok(findNearestCalls >= 3, 'findNearestValidGridPosition must be called at multiple resolution points');
  assert.ok(checkCollisionsCalls >= 1, 'checkCollisions must be called for live collision preview');

  // No call site may pass the raw (lattice-less) custom position maps directly.
  assert.ok(
    !content.includes('draggingNode.currentPos,\n      customProjectPositions,') &&
    !content.includes('draggingNode.currentPos,\n            customProjectPositions,'),
    'Collision/snap resolution must not read raw customProjectPositions directly (must use effectiveProjectPositions)'
  );
});

// PR22 legitimately introduced orbitPhase/requestAnimationFrame, and PR23
// legitimately introduces dockState/detaching/detached/capturing/redocking —
// those are the actual product terms now, not premature scope creep. What
// remains explicitly forbidden (PR23 spec section 57) is a physics/animation
// engine, external libraries, orbital slot reassignment, and any persistence
// of docking state outside transient UI state.
test('TopologyCanvas.tsx & topologyLayout.ts & projectTopologyGeometry.ts & orbitMotion.ts & projectDocking.ts: no physics engine, no external animation library, no docking-state persistence', () => {
  const forbidden = [
    'Three.js',
    "from 'three'",
    'from "three"',
    "require('three')",
    'require("three")',
    'd3-force',
    'framer-motion',
    'matter-js',
    'cannon',
    'physics engine',
    'spring library',
    'randomVelocity',
    'momentum',
    'inertia',
    'tumbl',
    'reassignSlot',
    'elastic orbit deformation',
    'localStorage',
    'sessionStorage',
  ];
  const files = [
    'src/components/TopologyCanvas.tsx',
    'src/utils/topologyLayout.ts',
    'src/utils/projectTopologyGeometry.ts',
    'src/utils/isometricProjection.ts',
    'src/utils/orbitMotion.ts',
    'src/utils/projectDocking.ts',
  ];
  for (const file of files) {
    const content = fs.readFileSync(path.resolve(file), 'utf8');
    for (const token of forbidden) {
      assert.ok(!content.toLowerCase().includes(token.toLowerCase()), `${file} must not contain "${token}"`);
    }
  }
});

test('TopologyCanvas.tsx: renders exactly one static orbit ellipse track template, looped once per adaptive project ring', () => {
  const content = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');
  const ellipseMatches = content.match(/<ellipse/g) || [];
  // Adaptive rings render N tracks at runtime (one per ring), but from
  // exactly ONE <ellipse> JSX template in source, looped over projectRings —
  // never a duplicated/hand-copied element per ring count.
  assert.equal(ellipseMatches.length, 1, 'Exactly one <ellipse> JSX template (looped per ring) must exist in source');
  assert.ok(content.includes('projectRings.map(ring =>'), 'The single ellipse template must be looped once per adaptive project ring');
  assert.ok(content.includes('ring.geometry.radiusX'), 'Orbit track must use each ring\'s own canonical radiusX');
  assert.ok(content.includes('ring.geometry.radiusY'), 'Orbit track must use each ring\'s own canonical radiusY');
});

test('ASSEMBLE restores canonical lattice by clearing overrides rather than copying coordinates into custom state', () => {
  const content = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');
  const handleAssembleIdx = content.indexOf('const handleAssemble = useCallback(');
  const handleAssembleBlock = content.slice(handleAssembleIdx, content.indexOf('});', handleAssembleIdx) + 3);
  assert.ok(handleAssembleBlock.includes('restoreCanonicalDockMembership();'), 'ASSEMBLE must delegate to the shared canonical-restore routine (also used by RESET)');
  assert.ok(!handleAssembleBlock.includes('setCustomProjectPositions(projectPositions);'), 'ASSEMBLE must not copy lattice coordinates into custom state');

  // PR23: the shared restore routine itself must clear every override,
  // cancel any in-flight drag/settle animation, and clear dock-runtime state.
  const restoreIdx = content.indexOf('const restoreCanonicalDockMembership = useCallback(');
  const restoreBlock = content.slice(restoreIdx, content.indexOf('}, [', restoreIdx));
  assert.ok(restoreBlock.includes('setDraggingNode(null);'), 'Restoring canonical membership must cancel any active drag');
  assert.ok(restoreBlock.includes('cancelOrbitReflow();'), 'Restoring canonical membership must cancel any in-flight shared reflow');
  assert.ok(restoreBlock.includes('setCustomProjectPositions({});'), 'ASSEMBLE/RESET must clear custom project positions');
  assert.ok(restoreBlock.includes('setCustomSkillPositions({});'), 'ASSEMBLE/RESET must clear custom skill positions');
  assert.ok(restoreBlock.includes('setProjectDockState({});'), 'ASSEMBLE/RESET must clear every project dock-runtime exception');
});

// ---------------------------------------------------------------------------
// Callout geometry centralization: no duplicated magic 132/28/38 in the renderer
// ---------------------------------------------------------------------------

test('TopologyCanvas.tsx: callout card geometry reads from shared PROJECT_CALLOUT_* constants, not duplicated magic numbers', () => {
  const content = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');
  assert.ok(content.includes('PROJECT_CALLOUT_WIDTH'), 'Callout width must come from the shared constant');
  assert.ok(content.includes('PROJECT_CALLOUT_SINGLE_HEIGHT') && content.includes('PROJECT_CALLOUT_DOUBLE_HEIGHT'), 'Callout heights must come from shared constants');
  assert.ok(!content.includes('const cardWidth = 132'), 'cardWidth must not re-declare the magic literal locally');
  assert.ok(!content.includes('cardHeight = isTwoLines ? 38 : 28'), 'cardHeight must not re-declare magic literals locally');
});

// ---------------------------------------------------------------------------
// Gap 4: FIT ALL must frame the complete rendered lattice at every required
// viewport size, using a pure (DOM-free) fit calculation.
// ---------------------------------------------------------------------------

test('computeFitViewport: fitted content never exceeds the usable viewport at any required target size', () => {
  // A representative real-scale lattice bounds (18 projects, 24 skills; see
  // tests/staticOrbitalLatticeSnapshot.test.ts for the actual committed data).
  const projects = generateMockProjects(18, [100, 120, 140, 160]);
  const skills = generateMockSkills(24);
  const { orbitGeometry } = assembleTopologyLayout(projects, skills);
  const bounds = orbitGeometry.visualBounds;
  const boundsWidth = bounds.maxX - bounds.minX;
  const boundsHeight = bounds.maxY - bounds.minY;

  const targets: Array<{ w: number; h: number }> = [
    { w: 390, h: 844 },
    { w: 768, h: 1024 },
    { w: 1024, h: 768 },
    { w: 1440, h: 900 },
    { w: 1920, h: 1080 },
  ];

  for (const { w, h } of targets) {
    const isCompact = w < 1024;
    const { zoom } = computeFitViewport(bounds, w, h, {
      paddingFactor: isCompact ? 0.92 : 0.95,
      minZoom: isCompact ? 0.15 : 0.20,
      maxZoom: 1.2,
    });
    const fittedWidth = boundsWidth * zoom;
    const fittedHeight = boundsHeight * zoom;
    assert.ok(fittedWidth <= w + 1e-6, `${w}x${h}: fitted width ${fittedWidth.toFixed(1)} exceeds viewport width ${w} (zoom ${zoom})`);
    assert.ok(fittedHeight <= h + 1e-6, `${w}x${h}: fitted height ${fittedHeight.toFixed(1)} exceeds viewport height ${h} (zoom ${zoom})`);
  }
});

test('computeFitViewport: minZoom floor does not bind for a realistic lattice at the smallest required viewport (390x844)', () => {
  const projects = generateMockProjects(18, [100, 120, 140, 160]);
  const skills = generateMockSkills(24);
  const { orbitGeometry } = assembleTopologyLayout(projects, skills);

  const naturalFit = computeFitViewport(orbitGeometry.visualBounds, 390, 844, { minZoom: 0, maxZoom: 100, paddingFactor: 0.92 });
  const clampedFit = computeFitViewport(orbitGeometry.visualBounds, 390, 844, { minZoom: 0.15, maxZoom: 1.2, paddingFactor: 0.92 });
  assert.ok(
    Math.abs(naturalFit.zoom - clampedFit.zoom) < 1e-6,
    `minZoom floor (0.15) incorrectly overrode the natural fit ratio (${naturalFit.zoom} vs clamped ${clampedFit.zoom}) — this would clip content`
  );
});

test('computeFitViewport: centers the bounds midpoint (pure, DOM-free)', () => {
  const bounds = { minX: -100, maxX: 300, minY: -50, maxY: 150 };
  const { zoom, x, y } = computeFitViewport(bounds, 800, 600, { paddingFactor: 1, minZoom: 0, maxZoom: 100 });
  const midX = (bounds.minX + bounds.maxX) / 2;
  const midY = (bounds.minY + bounds.maxY) / 2;
  assert.ok(Math.abs(x - (-midX * zoom)) < 1e-6);
  assert.ok(Math.abs(y - (-midY * zoom)) < 1e-6);
});

// ---------------------------------------------------------------------------
// PR22: focused/background relationship conduit presentation hierarchy.
// Association logic (getConduitPresentationState, projectUsesCapability,
// calculateConduitGeometry) is UNCHANGED — see topologyLegibility.test.ts
// tests 1-8 and 16, still passing unmodified. Only rendering weight changed.
// ---------------------------------------------------------------------------

function extractConduitRenderBlock(content: string): string {
  const startIdx = content.indexOf("if (presentationState === 'background') {");
  const endIdx = content.indexOf('return connections;', startIdx);
  return content.slice(startIdx, endIdx === -1 ? undefined : endIdx);
}

test('TopologyCanvas.tsx: background relationships remain thin/subdued (no lime highway at rest)', () => {
  const content = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');
  const block = extractConduitRenderBlock(content);
  const backgroundBlock = block.slice(0, block.indexOf('Focused or Dragging state'));

  assert.ok(!backgroundBlock.includes('#C3E54E'), 'Background (at-rest) conduits must not use the lime accent color');
  assert.ok(/strokeWidth=\{0\.7\}/.test(backgroundBlock), 'Background conduit stroke must be thin (~0.7)');
  assert.ok(backgroundBlock.includes('strokeDasharray="3 3"'), 'Background conduits remain dashed/schematic');
});

test('TopologyCanvas.tsx: focused conduits no longer use the oversized highway treatment (no 5px/3.5px glow halo, no 3px+ ink line, no 3.5px+ endpoints)', () => {
  const content = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');
  const block = extractConduitRenderBlock(content);
  const focusedBlock = block.slice(block.indexOf('Focused or Dragging state'));

  assert.ok(!focusedBlock.includes('strokeWidth={isDirectHover ? 5 : 3.5}'), 'Old oversized glow halo width must be gone');
  assert.ok(!focusedBlock.includes('strokeWidth={isDirectHover ? 3 : 2.2}'), 'Old oversized main-path width must be gone');
  assert.ok(!focusedBlock.includes('r={3.5}'), 'Old oversized 3.5px anchor ports must be gone');
  assert.ok(!focusedBlock.includes('animate-ping'), 'No animate-ping midpoint halo for every active conduit');
  assert.ok(!focusedBlock.includes('coreTech.length'), 'No floating per-conduit technology tag box (redundant pile of labels)');

  // New tighter treatment is present.
  assert.ok(focusedBlock.includes('strokeWidth={isDirectHover ? 2.2 : 1.8}'), 'New subtle lime support stroke must be present');
  assert.ok(focusedBlock.includes('strokeWidth={isDirectHover ? 1.2 : 0.9}'), 'New thin ink main path must be present');
});

test('TopologyCanvas.tsx: continuous signal animation only ever renders under direct hover, never for every focused/selected conduit unconditionally', () => {
  const content = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');
  const block = extractConduitRenderBlock(content);
  const focusedBlock = block.slice(block.indexOf('Focused or Dragging state'));

  const signalIdx = focusedBlock.indexOf('signal-conduit-fast');
  assert.ok(signalIdx !== -1, 'signal animation class must still exist for direct-hover use');
  const guardIdx = focusedBlock.lastIndexOf('isDirectHover &&', signalIdx);
  assert.ok(guardIdx !== -1 && signalIdx - guardIdx < 300, 'Signal animation must be gated immediately behind an isDirectHover && conditional, not rendered unconditionally');
});

// ---------------------------------------------------------------------------
// PR22: reduced-motion and compact-viewport wiring regression. The pure
// isOrbitPauseConditionActive contract itself is exhaustively tested in
// tests/orbitMotion.test.ts; this proves TopologyCanvas actually WIRES
// prefersReducedMotion and the compact-viewport check into it, not just that
// the pure function would handle them correctly in isolation.
// ---------------------------------------------------------------------------

test('TopologyCanvas.tsx: prefers-reduced-motion is read via matchMedia and fed into the orbit pause state', () => {
  const content = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');
  assert.ok(content.includes("matchMedia('(prefers-reduced-motion: reduce)')"), 'Must query the reduced-motion media feature');
  assert.ok(content.includes("mediaQuery.addEventListener('change'"), 'Must react to reduced-motion preference changes while running, not just at mount');
  const pauseStateIdx = content.indexOf('const orbitPauseState: OrbitPauseState = useMemo(');
  const pauseStateBlock = content.slice(pauseStateIdx, content.indexOf('}), [', pauseStateIdx));
  assert.ok(pauseStateBlock.includes('prefersReducedMotion,'), 'orbitPauseState must include prefersReducedMotion');
});

test('TopologyCanvas.tsx: compact viewport (<1024px) is derived from containerDimensions and feeds the orbit pause state — no separate mobile autoplay path', () => {
  const content = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');
  assert.ok(content.includes('const isCompactViewport = containerDimensions.width < 1024;'), 'Compact threshold must be derived from the existing container width state');
  const pauseStateIdx = content.indexOf('const orbitPauseState: OrbitPauseState = useMemo(');
  const pauseStateBlock = content.slice(pauseStateIdx, content.indexOf('}), [', pauseStateIdx));
  assert.ok(pauseStateBlock.includes('isCompact: isCompactViewport,'), 'orbitPauseState must include the compact-viewport flag');
  assert.ok(!content.includes('swipe-to-spin') && !content.includes('long-press detach') && !content.includes('touch magnetic'), 'No mobile autoplay/swipe/long-press motion features may be introduced');
});

test('topologyLayout.ts: getConduitPresentationState association/state-machine rules are unchanged by PR22 (styling-only change)', () => {
  // Behavioral proof that the decision layer itself was not touched: the exact
  // same rule set from PR21 (tests 1-8 in topologyLegibility.test.ts) still holds.
  const hidden = getConduitPresentationState({
    isConnected: true, isProjectHovered: false, isSkillHovered: false,
    isProjectSelected: false, isSkillSelected: false, isDraggingThisProject: false,
    isDraggingThisSkill: false, isAnyProjectHovered: false, isAnySkillHovered: false,
    isAnyProjectSelected: false, isAnySkillSelected: false, isAnyDragging: false,
    showBackgroundRelationships: false,
  });
  assert.equal(hidden, 'hidden');

  const focused = getConduitPresentationState({
    isConnected: true, isProjectHovered: true, isSkillHovered: false,
    isProjectSelected: false, isSkillSelected: false, isDraggingThisProject: false,
    isDraggingThisSkill: false, isAnyProjectHovered: true, isAnySkillHovered: false,
    isAnyProjectSelected: false, isAnySkillSelected: false, isAnyDragging: false,
    showBackgroundRelationships: false,
  });
  assert.equal(focused, 'focused');
});
