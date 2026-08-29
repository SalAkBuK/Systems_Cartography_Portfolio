import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  assembleTopologyLayout,
  getNodeBounds,
  checkAABBOverlap,
} from '../src/utils/topologyLayout.ts';
import { project3DToIso } from '../src/utils/isometricProjection.ts';
import {
  getTopologyProjectDimensions,
  ORBIT_PROJECT_SCALE,
} from '../src/utils/projectTopologyGeometry.ts';
import { getNodeBounds as collisionGetNodeBounds } from '../src/utils/collision.ts';
import { VERIFIED_PROJECTS, VERIFIED_SKILLS } from '../src/data/verifiedPortfolioData.ts';
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

test('staticOrbitalLattice: N projects produce exactly N unique slots', () => {
  for (const n of [1, 5, 18, 40]) {
    const projects = generateMockProjects(n);
    const skills = generateMockSkills(6);
    const { orbitGeometry } = assembleTopologyLayout(projects, skills);
    assert.equal(orbitGeometry.slots.length, n, `Expected ${n} slots`);
    const uniqueProjectIds = new Set(orbitGeometry.slots.map(s => s.projectId));
    assert.equal(uniqueProjectIds.size, n, 'Every slot must reference a unique project');
    const uniqueSlotIndexes = new Set(orbitGeometry.slots.map(s => s.slotIndex));
    assert.equal(uniqueSlotIndexes.size, n, 'slotIndex values must be unique');
  }
});

// ---------------------------------------------------------------------------
// 4. Exactly ONE project ellipse
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
// 6-7. Ellipse clears capability core; adjacent footprints do not overlap
// ---------------------------------------------------------------------------

test('staticOrbitalLattice: verified portfolio has zero project-project, project-skill, and skill-skill overlap', () => {
  const { projectPositions, skillPositions } = assembleTopologyLayout(VERIFIED_PROJECTS, VERIFIED_SKILLS);

  const skillBoxes = VERIFIED_SKILLS.map(s => ({
    id: s.id,
    ...getNodeBounds('skill', skillPositions[s.id], 48, 48)
  }));
  const projectBoxes = VERIFIED_PROJECTS.map(p => {
    const dims = getTopologyProjectDimensions(p);
    return { id: p.id, ...getNodeBounds('project', projectPositions[p.id], dims.width, dims.depth) };
  });

  for (let i = 0; i < projectBoxes.length; i++) {
    for (let j = i + 1; j < projectBoxes.length; j++) {
      assert.equal(checkAABBOverlap(projectBoxes[i], projectBoxes[j], 0), false, `${projectBoxes[i].id} overlaps ${projectBoxes[j].id}`);
    }
  }
  for (const pb of projectBoxes) {
    for (const sb of skillBoxes) {
      assert.equal(checkAABBOverlap(pb, sb, 0), false, `${pb.id} overlaps capability ${sb.id}`);
    }
  }
});

test('staticOrbitalLattice: pathological wide-width dataset resolves on one ellipse with zero overlap', () => {
  const projects = generateMockProjects(30, [100, 250, 180, 320, 140]);
  const skills = generateMockSkills(12);
  const { projectPositions, skillPositions, orbitGeometry } = assembleTopologyLayout(projects, skills);

  assert.equal(orbitGeometry.slots.length, 30);

  const skillBoxes = skills.map(s => ({ id: s.id, ...getNodeBounds('skill', skillPositions[s.id], 48, 48) }));
  const projectBoxes = projects.map(p => {
    const dims = getTopologyProjectDimensions(p);
    return { id: p.id, ...getNodeBounds('project', projectPositions[p.id], dims.width, dims.depth) };
  });

  for (let i = 0; i < projectBoxes.length; i++) {
    for (let j = i + 1; j < projectBoxes.length; j++) {
      assert.equal(checkAABBOverlap(projectBoxes[i], projectBoxes[j], 0), false);
    }
  }
  for (const pb of projectBoxes) {
    for (const sb of skillBoxes) {
      assert.equal(checkAABBOverlap(pb, sb, 0), false);
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

test('TopologyCanvas.tsx: position precedence is drag > custom/manual > canonical lattice > gridPosition fallback', () => {
  const content = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');

  // getProjectPos: drag branch returns first, then effective (lattice+custom) map, then raw gridPosition
  const getProjectPosIdx = content.indexOf('const getProjectPos = useCallback(');
  const getProjectPosBlock = content.slice(getProjectPosIdx, content.indexOf('}, [draggingNode, effectiveProjectPositions]);', getProjectPosIdx));
  const dragCheckIdx = getProjectPosBlock.indexOf("draggingNode?.type === 'project'");
  const effectiveFallbackIdx = getProjectPosBlock.indexOf('effectiveProjectPositions[project.id] || project.gridPosition');
  assert.ok(dragCheckIdx !== -1 && effectiveFallbackIdx !== -1 && dragCheckIdx < effectiveFallbackIdx, 'Drag position must be checked before the canonical/custom fallback');

  // effectiveProjectPositions: lattice spread first, custom spread second (custom wins on key collision)
  assert.ok(
    content.includes('{ ...staticOrbitalLattice.projectPositions, ...customProjectPositions }'),
    'Custom positions must be layered on top of (spread after) the canonical lattice'
  );
  assert.ok(
    content.includes('{ ...staticOrbitalLattice.skillPositions, ...customSkillPositions }'),
    'Custom skill positions must be layered on top of (spread after) the canonical lattice'
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

test('TopologyCanvas.tsx & topologyLayout.ts & projectTopologyGeometry.ts: zero autonomous motion, zero magnetic/docking implementation', () => {
  const forbidden = [
    'orbitPhase',
    'requestAnimationFrame',
    'setInterval(',
    'dockState',
    'detaching',
    'detached',
    'capturing',
    'magnetic resistance',
    'capture radius',
    'spring animation',
    'redocking',
  ];
  const files = [
    'src/components/TopologyCanvas.tsx',
    'src/utils/topologyLayout.ts',
    'src/utils/projectTopologyGeometry.ts',
    'src/utils/isometricProjection.ts',
  ];
  for (const file of files) {
    const content = fs.readFileSync(path.resolve(file), 'utf8');
    for (const token of forbidden) {
      assert.ok(!content.includes(token), `${file} must not contain "${token}"`);
    }
  }
});

test('TopologyCanvas.tsx: renders exactly one static orbit ellipse track element', () => {
  const content = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');
  const ellipseMatches = content.match(/<ellipse/g) || [];
  assert.equal(ellipseMatches.length, 1, 'Exactly one <ellipse> element (the static orbit track) must be rendered');
  assert.ok(content.includes('staticOrbitalLattice.orbitGeometry.radiusX'), 'Orbit track must use canonical radiusX');
  assert.ok(content.includes('staticOrbitalLattice.orbitGeometry.radiusY'), 'Orbit track must use canonical radiusY');
});

test('ASSEMBLE restores canonical lattice by clearing overrides rather than copying coordinates into custom state', () => {
  const content = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');
  const handleAssembleIdx = content.indexOf('const handleAssemble = useCallback(');
  const handleAssembleBlock = content.slice(handleAssembleIdx, content.indexOf('}, []);', handleAssembleIdx));
  assert.ok(handleAssembleBlock.includes('setCustomProjectPositions({});'), 'ASSEMBLE must clear custom project positions');
  assert.ok(handleAssembleBlock.includes('setCustomSkillPositions({});'), 'ASSEMBLE must clear custom skill positions');
  assert.ok(!handleAssembleBlock.includes('setCustomProjectPositions(projectPositions);'), 'ASSEMBLE must not copy lattice coordinates into custom state');
});
