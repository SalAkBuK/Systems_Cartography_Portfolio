import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const canvasSource = readFileSync(resolve(process.cwd(), 'src/components/TopologyCanvas.tsx'), 'utf8');

test('orbital field guides and annotations render noninteractive background geometry and hierarchy labels', () => {
  const guideGroupIndex = canvasSource.indexOf('id="orbital-field-guides"');
  const reactorGroupIndex = canvasSource.indexOf('id="capability-reactor"');
  const annotGroupIndex = canvasSource.indexOf('id="orbital-field-annotations"');
  const conduitsIndex = canvasSource.indexOf('id="wiring-conduits"');
  const zonesIndex = canvasSource.indexOf('id="zones"');

  assert.ok(guideGroupIndex !== -1, 'orbital-field-guides element must exist');
  assert.ok(annotGroupIndex !== -1, 'orbital-field-annotations element must exist');
  assert.ok(reactorGroupIndex !== -1, 'capability-reactor element must exist');

  // Layering order: after zones, before wiring-conduits
  assert.ok(zonesIndex < guideGroupIndex, 'orbital-field-guides must render after zones');
  assert.ok(guideGroupIndex < reactorGroupIndex, 'capability reactor must render after orbital-field-guides');
  assert.ok(reactorGroupIndex < annotGroupIndex, 'orbital-field-annotations must render after capability reactor');
  assert.ok(annotGroupIndex < conduitsIndex, 'orbital-field-annotations must render before wiring conduits');

  // Adaptive rings: the guide group now nests one <g> per project ring
  // (looping projectRings), so the FIRST literal `</g>` after the group's
  // opening tag is an inner per-ring group, not the outer one. The already-
  // established reactorGroupIndex boundary (guideGroupIndex < reactorGroupIndex,
  // asserted above) is a robust, nesting-independent extraction instead.
  const guideGroupBlock = canvasSource.substring(guideGroupIndex, reactorGroupIndex);
  const annotGroupBlock = canvasSource.substring(
    annotGroupIndex,
    canvasSource.indexOf('</g>', annotGroupIndex) + 4
  );

  // Noninteractive pointerEvents on both groups
  assert.ok(guideGroupBlock.includes('pointerEvents="none"'), 'Guide group must explicitly specify pointerEvents="none"');
  assert.ok(annotGroupBlock.includes('pointerEvents="none"'), 'Annotation group must explicitly specify pointerEvents="none"');

  // Authoritative geometry references: one guide ellipse per project ring,
  // each still sourced from the same canonical ring.geometry (no duplicated
  // magic numbers).
  assert.ok(guideGroupBlock.includes('projectRings.map(ring =>'), 'Must render one guide ellipse per adaptive project ring');
  assert.ok(guideGroupBlock.includes('ring.geometry.centerIso.x'), 'Must reference canonical per-ring centerIso.x');
  assert.ok(guideGroupBlock.includes('ring.geometry.centerIso.y'), 'Must reference canonical per-ring centerIso.y');
  assert.ok(guideGroupBlock.includes('ring.geometry.radiusX'), 'Must reference canonical per-ring radiusX');
  assert.ok(guideGroupBlock.includes('ring.geometry.radiusY'), 'Must reference canonical per-ring radiusY');

  // 24 registration ticks
  assert.ok(guideGroupBlock.includes('24'), 'Must render 24 registration ticks');

  // Static hierarchy annotations
  assert.ok(annotGroupBlock.includes('RING 01 // CAPABILITY REACTOR'), 'Must render Ring 01 capability reactor annotation');
  assert.ok(annotGroupBlock.includes('RING 02 // DEPLOYED SYSTEMS'), 'Must render the one-ring-baseline Ring 02 deployed systems annotation');
  assert.ok(annotGroupBlock.includes('staticOrbitalLattice.orbitGeometry.motionVisualBounds.minY'), 'One-ring Ring 02 must anchor to motionVisualBounds.minY');
  // Multi-ring: one label per ring, each with its own live system count.
  assert.ok(annotGroupBlock.includes('projectRings.map(ring =>'), 'Must render one annotation per ring when there is more than one');
  assert.ok(annotGroupBlock.includes('ring.geometry.motionVisualBounds.minY'), 'Each additional ring label must anchor to its OWN motionVisualBounds.minY');

  // Live telemetry derived from runtime docked orbit state, summed across every ring
  assert.ok(annotGroupBlock.includes('ORBITAL LOAD //') && annotGroupBlock.includes('totalDockedProjectCount'), 'Must render live ORBITAL LOAD telemetry derived from every ring\'s docked order');
});
