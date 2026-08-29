import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ISO_COS,
  ISO_SIN,
  project3DToIso,
  projectIsoTo3D
} from '../src/utils/isometricProjection.ts';
import { project3DToIso as canvasProject3DToIso, projectIsoTo3D as canvasProjectIsoTo3D } from '../src/components/TopologyCanvas.tsx';

const EPSILON = 1e-9;

test('isometricProjection: ISO_COS/ISO_SIN match the documented 30-degree axonometric angle', () => {
  assert.ok(Math.abs(ISO_COS - Math.cos(Math.PI / 6)) < EPSILON);
  assert.equal(ISO_SIN, 0.5);
});

test('isometricProjection: world -> iso -> world round-trip is identity within floating-point tolerance (z=0)', () => {
  const samples: Array<{ x: number; y: number }> = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 0, y: 100 },
    { x: -250, y: 375 },
    { x: 1234.5, y: -987.25 },
    { x: -1, y: -1 },
    { x: 9999, y: -9999 },
  ];

  for (const p of samples) {
    const iso = project3DToIso(p.x, p.y, 0);
    const back = projectIsoTo3D(iso.x, iso.y);
    assert.ok(Math.abs(back.x - p.x) < 1e-6, `x round-trip failed for (${p.x}, ${p.y}): got ${back.x}`);
    assert.ok(Math.abs(back.y - p.y) < 1e-6, `y round-trip failed for (${p.x}, ${p.y}): got ${back.y}`);
  }
});

test('isometricProjection: TopologyCanvas re-exports are the same canonical implementation (backward compatibility)', () => {
  const sample = { x: 321, y: -654, z: 12 };
  assert.deepEqual(
    canvasProject3DToIso(sample.x, sample.y, sample.z),
    project3DToIso(sample.x, sample.y, sample.z)
  );
  const isoSample = project3DToIso(sample.x, sample.y, 0);
  assert.deepEqual(canvasProjectIsoTo3D(isoSample.x, isoSample.y), projectIsoTo3D(isoSample.x, isoSample.y));
});
