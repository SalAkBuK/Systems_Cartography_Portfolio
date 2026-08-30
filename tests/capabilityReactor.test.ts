import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { GITHUB_SNAPSHOT } from '../src/data/githubSnapshot.generated.ts';
import { getCapabilityCoreTechnology } from '../src/utils/capabilityAssociations.ts';
import {
  buildCapabilityReactorSegmentPaths,
  deriveCapabilityReactorGeometry,
  getCapabilityReactorDashOffset,
  getCapabilityReactorMarker,
} from '../src/utils/capabilityReactor.ts';
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

test('capability render positions retain canonical-plus-drag precedence and never consume reactor phase', () => {
  const skillPositionBlock = canvasSource.substring(
    canvasSource.indexOf('const effectiveSkillPositions = useMemo('),
    canvasSource.indexOf('const cancelOrbitReflow')
  );
  assert.ok(skillPositionBlock.includes('staticOrbitalLattice.skillPositions'));
  assert.ok(skillPositionBlock.includes('customSkillPositions'));
  assert.ok(!skillPositionBlock.includes('reactorOrbitPhase'));
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
