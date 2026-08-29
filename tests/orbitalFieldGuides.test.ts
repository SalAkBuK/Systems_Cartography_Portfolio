import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const canvasSource = readFileSync(resolve(process.cwd(), 'src/components/TopologyCanvas.tsx'), 'utf8');

test('orbital-field-guides renders authoritative noninteractive background ellipse, 24 ticks, and drafting hierarchy annotations', () => {
  const guideGroupIndex = canvasSource.indexOf('id="orbital-field-guides"');
  assert.ok(guideGroupIndex !== -1, 'orbital-field-guides element must exist');

  const guideGroupBlock = canvasSource.substring(
    guideGroupIndex,
    canvasSource.indexOf('</g>', guideGroupIndex) + 4
  );

  // Noninteractive pointerEvents
  assert.ok(guideGroupBlock.includes('pointerEvents="none"'), 'Group must explicitly specify pointerEvents="none"');

  // Authoritative geometry references
  assert.ok(guideGroupBlock.includes('staticOrbitalLattice.orbitGeometry.centerIso.x'), 'Must reference canonical centerIso.x');
  assert.ok(guideGroupBlock.includes('staticOrbitalLattice.orbitGeometry.centerIso.y'), 'Must reference canonical centerIso.y');
  assert.ok(guideGroupBlock.includes('staticOrbitalLattice.orbitGeometry.radiusX'), 'Must reference canonical radiusX');
  assert.ok(guideGroupBlock.includes('staticOrbitalLattice.orbitGeometry.radiusY'), 'Must reference canonical radiusY');

  // 24 registration ticks
  assert.ok(guideGroupBlock.includes('24'), 'Must render 24 registration ticks');

  // Static hierarchy annotations
  assert.ok(guideGroupBlock.includes('RING 01 // CAPABILITY NUCLEUS'), 'Must render Ring 01 capability nucleus annotation');
  assert.ok(guideGroupBlock.includes('RING 02 // DEPLOYED SYSTEMS'), 'Must render Ring 02 deployed systems annotation');

  // Layering order: after zones, before wiring-conduits
  const zonesIndex = canvasSource.indexOf('id="zones"');
  const conduitsIndex = canvasSource.indexOf('id="wiring-conduits"');

  assert.ok(zonesIndex < guideGroupIndex, 'orbital-field-guides must render after zones');
  assert.ok(guideGroupIndex < conduitsIndex, 'orbital-field-guides must render before wiring conduits');
});
