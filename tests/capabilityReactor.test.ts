import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { GITHUB_SNAPSHOT } from '../src/data/githubSnapshot.generated.ts';
import { getCapabilityCoreTechnology } from '../src/utils/capabilityAssociations.ts';
import {
  buildCapabilityReactorSegmentPaths,
  CAPABILITY_REACTOR_START_ANGLE,
  deriveCapabilityReactorGeometry,
  getCapabilityReactorDashOffset,
  getCapabilityReactorMarker,
  getDeterministicCapabilityOrder,
  getEffectiveCapabilityPositions,
  getMountedCapabilityPosition,
} from '../src/utils/capabilityReactor.ts';
import { project3DToIso } from '../src/utils/isometricProjection.ts';
import { assembleTopologyLayout } from '../src/utils/topologyLayout.ts';

const canvasSource = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');
const { projects, skills } = GITHUB_SNAPSHOT;
const lattice = assembleTopologyLayout(projects, skills);
const sources = skills.map(skill => ({
  id: skill.id,
  technologyLabel: getCapabilityCoreTechnology(skill),
  systemCount: skill.systemCount,
}));

test('reactor geometry is deterministic and derived from canonical capability positions', () => {
  const before = JSON.stringify(lattice.skillPositions);
  const first = deriveCapabilityReactorGeometry(sources, lattice.skillPositions);
  const second = deriveCapabilityReactorGeometry([...sources].reverse(), lattice.skillPositions);
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(lattice.skillPositions), before, 'geometry derivation must not mutate canonical positions');
  assert.ok(canvasSource.includes('staticOrbitalLattice.skillPositions'));
  const derivationBlock = canvasSource.substring(
    canvasSource.indexOf('const capabilityReactorGeometry = useMemo('),
    canvasSource.indexOf('const capabilityReactorSegmentPaths')
  );
  assert.ok(!derivationBlock.includes('effectiveSkillPositions'));
  assert.ok(!derivationBlock.includes('customSkillPositions'));
});

test('fixed reactor track surrounds canonical capability plinth and label bounds', () => {
  const geometry = deriveCapabilityReactorGeometry(sources, lattice.skillPositions);
  const bounds = geometry.canonicalVisualBounds;
  assert.ok(geometry.centerIso.x - geometry.radiusX < bounds.minX);
  assert.ok(geometry.centerIso.x + geometry.radiusX > bounds.maxX);
  assert.ok(geometry.centerIso.y - geometry.radiusY < bounds.minY);
  assert.ok(geometry.centerIso.y + geometry.radiusY > bounds.maxY);
});

test('reactor and its structural markers remain inside the existing project orbit composition', () => {
  const geometry = deriveCapabilityReactorGeometry(sources, lattice.skillPositions);
  assert.ok(geometry.radiusX + 10 < lattice.orbitGeometry.radiusX);
  assert.ok(geometry.radiusY + 10 < lattice.orbitGeometry.radiusY);
  const reactorBounds = {
    minX: geometry.centerIso.x - geometry.radiusX - 10,
    maxX: geometry.centerIso.x + geometry.radiusX + 10,
    minY: geometry.centerIso.y - geometry.radiusY - 10,
    maxY: geometry.centerIso.y + geometry.radiusY + 10,
  };
  const fitBounds = lattice.orbitGeometry.motionVisualBounds;
  assert.ok(reactorBounds.minX >= fitBounds.minX);
  assert.ok(reactorBounds.maxX <= fitBounds.maxX);
  assert.ok(reactorBounds.minY >= fitBounds.minY);
  assert.ok(reactorBounds.maxY <= fitBounds.maxY);
});

test('reactor segment geometry has four fixed cardinal gaps', () => {
  const geometry = deriveCapabilityReactorGeometry(sources, lattice.skillPositions);
  const segments = buildCapabilityReactorSegmentPaths(geometry);
  assert.equal(segments.length, 4);
  assert.equal(new Set(segments).size, 4);
  assert.ok(segments.every(segment => segment.includes(`A ${geometry.radiusX} ${geometry.radiusY}`)));
});

test('phase moves markers along the fixed ellipse without changing its radii', () => {
  const geometry = deriveCapabilityReactorGeometry(sources, lattice.skillPositions);
  const atZero = getCapabilityReactorMarker(geometry, 0, 1, 8, 7);
  const moved = getCapabilityReactorMarker(geometry, -Math.PI / 4, 1, 8, 7);
  assert.notDeepEqual(moved, atZero);
  for (const marker of [atZero, moved]) {
    const residual =
      ((marker.x - geometry.centerIso.x) / geometry.radiusX) ** 2 +
      ((marker.y - geometry.centerIso.y) / geometry.radiusY) ** 2;
    assert.ok(Math.abs(residual - 1) < 1e-9);
  }
  assert.notEqual(getCapabilityReactorDashOffset(0), getCapabilityReactorDashOffset(-Math.PI / 4));
});

test('capability render positions derive from reactor phase with custom-drag precedence', () => {
  const skillPositionBlock = canvasSource.substring(
    canvasSource.indexOf('const canonicalCapabilityOrder = useMemo('),
    canvasSource.indexOf('const cancelOrbitReflow')
  );
  assert.ok(skillPositionBlock.includes('canonicalCapabilityOrder'));
  assert.ok(skillPositionBlock.includes('getMountedCapabilityPosition('));
  assert.ok(skillPositionBlock.includes('reactorOrbitPhase'));
  assert.ok(skillPositionBlock.includes('mountedCapabilityOrbitPositions'));
  assert.ok(skillPositionBlock.includes('customSkillPositions'));
  assert.ok(!skillPositionBlock.includes('projectOrbitPhase'));
});

test('canonical full capability identity order is deterministic and filter-independent', () => {
  const expected = skills.map(skill => skill.id);
  assert.deepEqual(getDeterministicCapabilityOrder(sources), expected);
  assert.deepEqual(getDeterministicCapabilityOrder(sources), expected);
  const orderBlock = canvasSource.substring(
    canvasSource.indexOf('const canonicalCapabilityOrder = useMemo('),
    canvasSource.indexOf('const mountedCapabilityOrbitPositions')
  );
  assert.ok(orderBlock.includes('activeSkills.map'));
  for (const forbidden of ['filteredProjects', 'searchQuery', 'selectedSkillId', 'hoveredSkillId', 'selectedExperienceId']) {
    assert.ok(!orderBlock.includes(forbidden), `${forbidden} must not influence capability slots`);
  }
});

test('every mounted capability receives a unique fixed angular slot on the reactor ellipse', () => {
  const geometry = deriveCapabilityReactorGeometry(sources, lattice.skillPositions);
  const positions = sources.map((_, index) => getMountedCapabilityPosition(index, sources.length, geometry, 0.731));
  assert.equal(new Set(positions.map(position => `${position.x.toFixed(9)},${position.y.toFixed(9)}`)).size, sources.length);
  for (const position of positions) {
    const iso = project3DToIso(position.x, position.y, 0);
    const residual =
      ((iso.x - geometry.centerIso.x) / geometry.radiusX) ** 2 +
      ((iso.y - geometry.centerIso.y) / geometry.radiusY) ** 2;
    assert.ok(Math.abs(residual - 1) < 1e-9);
  }
});

test('reactor phase moves mounted capabilities in the same counter direction as structural markers', () => {
  const geometry = deriveCapabilityReactorGeometry(sources, lattice.skillPositions);
  const phase = -Math.PI / 7;
  const initial = getMountedCapabilityPosition(0, sources.length, geometry, 0);
  const moved = getMountedCapabilityPosition(0, sources.length, geometry, phase);
  assert.notDeepEqual(moved, initial);

  const mountedIso = project3DToIso(moved.x, moved.y, 0);
  const marker = getCapabilityReactorMarker(geometry, phase, 3, 4, 7);
  assert.ok(Math.abs(mountedIso.x - marker.x) < 1e-9);
  assert.ok(Math.abs(mountedIso.y - marker.y) < 1e-9);
  assert.ok(mountedIso.x < geometry.centerIso.x, 'negative reactor phase must move the top slot counter to the left');
  assert.equal(CAPABILITY_REACTOR_START_ANGLE, -Math.PI / 2);
});

test('custom override stays stationary while reactor advances and other slots continue without redistribution', () => {
  const geometry = deriveCapabilityReactorGeometry(sources, lattice.skillPositions);
  const order = getDeterministicCapabilityOrder(sources);
  const buildMounted = (phase: number) => Object.fromEntries(
    order.map((id, index) => [id, getMountedCapabilityPosition(index, order.length, geometry, phase)])
  );
  const detachedId = order[5];
  const peerId = order[6];
  const custom = { [detachedId]: { x: 777, y: -333 } };
  const mountedAtZero = buildMounted(0);
  const mountedLater = buildMounted(-0.4);
  const effectiveAtZero = getEffectiveCapabilityPositions(mountedAtZero, custom);
  const effectiveLater = getEffectiveCapabilityPositions(mountedLater, custom);

  assert.deepEqual(effectiveAtZero[detachedId], custom[detachedId]);
  assert.deepEqual(effectiveLater[detachedId], custom[detachedId]);
  assert.notDeepEqual(effectiveAtZero[peerId], effectiveLater[peerId]);
  assert.deepEqual(mountedAtZero[peerId], getMountedCapabilityPosition(6, order.length, geometry, 0));
  assert.deepEqual(mountedLater[peerId], getMountedCapabilityPosition(6, order.length, geometry, -0.4));
});

test('mounted capability visual footprints clear adjacent labels throughout a full revolution', () => {
  const geometry = deriveCapabilityReactorGeometry(sources, lattice.skillPositions);
  const halfWidth = (source: typeof sources[number]) => Math.max(
    24,
    source.technologyLabel.length * 6.1 / 2,
    `${source.systemCount} SYSTEMS`.length * 5.2 / 2
  );
  const phases = 1440;
  for (let sample = 0; sample < phases; sample++) {
    const phase = sample / phases * Math.PI * 2;
    const isoPositions = sources.map((_, index) => {
      const position = getMountedCapabilityPosition(index, sources.length, geometry, phase);
      return project3DToIso(position.x, position.y, 0);
    });
    for (let index = 0; index < sources.length; index++) {
      const next = (index + 1) % sources.length;
      const horizontalGap = Math.abs(isoPositions[index].x - isoPositions[next].x) -
        (halfWidth(sources[index]) + halfWidth(sources[next]));
      const verticalGap = Math.abs(isoPositions[index].y - isoPositions[next].y) - 58;
      assert.ok(
        horizontalGap >= -1e-6 || verticalGap >= -1e-6,
        `${sources[index].technologyLabel}/${sources[next].technologyLabel} overlap at phase ${phase}`
      );
    }
  }
});

test('reactor track plus every mounted visual footprint remains within existing project motion bounds', () => {
  const geometry = deriveCapabilityReactorGeometry(sources, lattice.skillPositions);
  const motionBounds = lattice.orbitGeometry.motionVisualBounds;
  const halfWidth = (source: typeof sources[number]) => Math.max(
    24,
    source.technologyLabel.length * 6.1 / 2,
    `${source.systemCount} SYSTEMS`.length * 5.2 / 2
  );
  for (let sample = 0; sample < 720; sample++) {
    const phase = sample / 720 * Math.PI * 2;
    sources.forEach((source, index) => {
      const position = getMountedCapabilityPosition(index, sources.length, geometry, phase);
      const iso = project3DToIso(position.x, position.y, 0);
      assert.ok(iso.x - halfWidth(source) >= motionBounds.minX - 1e-6);
      assert.ok(iso.x + halfWidth(source) <= motionBounds.maxX + 1e-6);
      assert.ok(iso.y - 20 >= motionBounds.minY - 1e-6);
      assert.ok(iso.y + 38 <= motionBounds.maxY + 1e-6);
    });
  }
});

test('conduits and skill rendering share the live effective position getter', () => {
  const getterBlock = canvasSource.substring(
    canvasSource.indexOf('const getSkillPos = useCallback('),
    canvasSource.indexOf('// PR23 product pivot: derives', canvasSource.indexOf('const getSkillPos = useCallback('))
  );
  const conduitBlock = canvasSource.substring(
    canvasSource.indexOf('const renderedConnections = useMemo('),
    canvasSource.indexOf('return (', canvasSource.indexOf('const renderedConnections = useMemo('))
  );
  const skillRenderBlock = canvasSource.substring(
    canvasSource.indexOf('<g id="infrastructure-nodes">'),
    canvasSource.indexOf('Snap & Collision Landing Footprint Preview')
  );
  assert.ok(getterBlock.includes('effectiveSkillPositions[skill.id]'));
  assert.ok(conduitBlock.includes('const skillPos = getSkillPos(skill);'));
  assert.ok(skillRenderBlock.includes('const skillPos = getSkillPos(skill);'));
});

test('skill drag starts live, click slop creates no override, true drag persists only on release', () => {
  const moveStart = canvasSource.indexOf('const processMove = (clientX: number, clientY: number) => {');
  const releaseStart = canvasSource.indexOf('const processRelease = () => {', moveStart);
  const processMove = canvasSource.substring(moveStart, releaseStart);
  const projectReleaseStart = canvasSource.indexOf('// PROJECT', releaseStart);
  const skillRelease = canvasSource.substring(releaseStart, projectReleaseStart);
  const skillRenderBlock = canvasSource.substring(
    canvasSource.indexOf('<g id="infrastructure-nodes">'),
    canvasSource.indexOf('Snap & Collision Landing Footprint Preview')
  );

  assert.ok(processMove.includes('Math.hypot(deltaScreenX, deltaScreenY) > 3'));
  assert.ok(!processMove.includes('setCustomSkillPositions'), 'pointer jitter/move must not persist a skill override');
  assert.ok(skillRelease.includes('if (!draggingNode.hasMoved)'));
  assert.ok(skillRelease.includes('onSelectSkill(draggingNode.id)'));
  assert.ok(skillRelease.includes('setCustomSkillPositions(prev => ({ ...prev, [draggingNode.id]: finalPos }))'));
  assert.ok(skillRenderBlock.includes('startNodePos: { ...skillPos }'));
  assert.ok(skillRenderBlock.includes('currentPos: { ...skillPos }'));
});

test('ASSEMBLE and RESET clear custom capabilities and remount original reserved slots', () => {
  const restoreBlock = canvasSource.substring(
    canvasSource.indexOf('const restoreCanonicalDockMembership = useCallback('),
    canvasSource.indexOf('const hasCustomLayout')
  );
  const resetBlock = canvasSource.substring(
    canvasSource.indexOf('const resetAllPositions = useCallback('),
    canvasSource.indexOf('const handleAssemble = useCallback(')
  );
  const assembleBlock = canvasSource.substring(
    canvasSource.indexOf('const handleAssemble = useCallback('),
    canvasSource.indexOf('const hasCustomLayout')
  );
  assert.ok(restoreBlock.includes('setCustomSkillPositions({})'));
  assert.ok(restoreBlock.includes('resetOrbitPhasesToCanonical()'));
  assert.ok(resetBlock.includes('restoreCanonicalDockMembership()'));
  assert.ok(assembleBlock.includes('restoreCanonicalDockMembership()'));
});

test('reactor is background infrastructure between guides and conduits and is noninteractive', () => {
  const zones = canvasSource.indexOf('id="zones"');
  const guides = canvasSource.indexOf('id="orbital-field-guides"');
  const reactor = canvasSource.indexOf('id="capability-reactor"');
  const conduits = canvasSource.indexOf('id="wiring-conduits"');
  const nodes = canvasSource.indexOf('id="infrastructure-nodes"');
  assert.ok(zones < guides && guides < reactor && reactor < conduits && conduits < nodes);
  const reactorBlock = canvasSource.substring(reactor, canvasSource.indexOf('Orbital Field Annotations'));
  assert.ok(reactorBlock.includes('pointerEvents="none"'));
});

test('project orbital radii and canonical project positions remain owned by topologyLayout', () => {
  const topologyLayoutSource = fs.readFileSync(path.resolve('src/utils/topologyLayout.ts'), 'utf8');
  assert.ok(!topologyLayoutSource.includes('capabilityReactor'));
  assert.ok(!canvasSource.includes('getDynamicOrbitalPosition(\n        project,\n        i,\n        count,\n        capabilityReactorGeometry'));
});
