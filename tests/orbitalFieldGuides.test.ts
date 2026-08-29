import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const canvasSource = readFileSync(resolve(process.cwd(), 'src/components/TopologyCanvas.tsx'), 'utf8');

test('orbital field guides and annotations render noninteractive background geometry and hierarchy labels', () => {
  const guideGroupIndex = canvasSource.indexOf('id="orbital-field-guides"');
  const annotGroupIndex = canvasSource.indexOf('id="orbital-field-annotations"');
  const conduitsIndex = canvasSource.indexOf('id="wiring-conduits"');
  const zonesIndex = canvasSource.indexOf('id="zones"');

  assert.ok(guideGroupIndex !== -1, 'orbital-field-guides element must exist');
  assert.ok(annotGroupIndex !== -1, 'orbital-field-annotations element must exist');

  // Layering order: after zones, before wiring-conduits
  assert.ok(zonesIndex < guideGroupIndex, 'orbital-field-guides must render after zones');
  assert.ok(guideGroupIndex < annotGroupIndex, 'orbital-field-annotations must render after orbital-field-guides');
  assert.ok(annotGroupIndex < conduitsIndex, 'orbital-field-annotations must render before wiring conduits');

  const guideGroupBlock = canvasSource.substring(
    guideGroupIndex,
    canvasSource.indexOf('</g>', guideGroupIndex) + 4
  );
  const annotGroupBlock = canvasSource.substring(
    annotGroupIndex,
    canvasSource.indexOf('</g>', annotGroupIndex) + 4
  );

  // Noninteractive pointerEvents on both groups
  assert.ok(guideGroupBlock.includes('pointerEvents="none"'), 'Guide group must explicitly specify pointerEvents="none"');
  assert.ok(annotGroupBlock.includes('pointerEvents="none"'), 'Annotation group must explicitly specify pointerEvents="none"');

  // Authoritative geometry references
  assert.ok(guideGroupBlock.includes('staticOrbitalLattice.orbitGeometry.centerIso.x'), 'Must reference canonical centerIso.x');
  assert.ok(guideGroupBlock.includes('staticOrbitalLattice.orbitGeometry.centerIso.y'), 'Must reference canonical centerIso.y');
  assert.ok(guideGroupBlock.includes('staticOrbitalLattice.orbitGeometry.radiusX'), 'Must reference canonical radiusX');
  assert.ok(guideGroupBlock.includes('staticOrbitalLattice.orbitGeometry.radiusY'), 'Must reference canonical radiusY');

  // 24 registration ticks
  assert.ok(guideGroupBlock.includes('24'), 'Must render 24 registration ticks');

  // Static hierarchy annotations
  assert.ok(annotGroupBlock.includes('RING 01 // CAPABILITY NUCLEUS'), 'Must render Ring 01 capability nucleus annotation');
  assert.ok(annotGroupBlock.includes('RING 02 // DEPLOYED SYSTEMS'), 'Must render Ring 02 deployed systems annotation');
  assert.ok(annotGroupBlock.includes('staticOrbitalLattice.orbitGeometry.motionVisualBounds.minY'), 'Ring 02 must anchor to motionVisualBounds.minY');

  // Live telemetry derived from runtime docked orbit state
  assert.ok(annotGroupBlock.includes('ORBITAL LOAD //') && annotGroupBlock.includes('dockedOrbitOrder.length'), 'Must render live ORBITAL LOAD telemetry derived from dockedOrbitOrder.length');
});
