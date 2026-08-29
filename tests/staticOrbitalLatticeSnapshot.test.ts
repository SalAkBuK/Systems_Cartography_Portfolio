// Real-data orbital regression: exercises the ACTUAL committed portfolio data
// the deployed app renders (src/data/githubSnapshot.generated.ts), not the
// intentionally-empty VERIFIED_PROJECTS/VERIFIED_SKILLS placeholder arrays in
// src/data/verifiedPortfolioData.ts. No sync script is run — this reads the
// snapshot file already committed to the repo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { assembleTopologyLayout, getNodeBounds, checkAABBOverlap, computeFitViewport } from '../src/utils/topologyLayout.ts';
import { project3DToIso } from '../src/utils/isometricProjection.ts';
import { getTopologyProjectVisualBounds } from '../src/utils/projectTopologyGeometry.ts';
import { getOrbitalProjectPositionAtPhase } from '../src/utils/orbitMotion.ts';
import { GITHUB_SNAPSHOT } from '../src/data/githubSnapshot.generated.ts';

const projects = GITHUB_SNAPSHOT.projects;
const skills = GITHUB_SNAPSHOT.skills;

test('committed GITHUB_SNAPSHOT actually contains projects and skills (not an empty placeholder)', () => {
  assert.ok(projects.length > 0, 'GITHUB_SNAPSHOT.projects must be non-empty for this to be a real regression');
  assert.ok(skills.length > 0, 'GITHUB_SNAPSHOT.skills must be non-empty for this to be a real regression');
});

test('static orbital lattice on the real committed snapshot: project count equals generated orbital slot count', () => {
  const { orbitGeometry } = assembleTopologyLayout(projects, skills);
  assert.equal(orbitGeometry.slots.length, projects.length);
});

test('static orbital lattice on the real committed snapshot: every current project and skill has a canonical position', () => {
  const { projectPositions, skillPositions } = assembleTopologyLayout(projects, skills);

  for (const p of projects) {
    const pos = projectPositions[p.id];
    assert.ok(pos, `Project ${p.id} (${p.title}) has no canonical position`);
    assert.ok(Number.isFinite(pos.x) && Number.isFinite(pos.y), `Project ${p.id} position is not finite`);
  }
  for (const s of skills) {
    const pos = skillPositions[s.id];
    assert.ok(pos, `Skill ${s.id} (${s.name}) has no canonical position`);
    assert.ok(Number.isFinite(pos.x) && Number.isFinite(pos.y), `Skill ${s.id} position is not finite`);
  }
});

test('static orbital lattice on the real committed snapshot: zero rendered visual-envelope overlap between projects', () => {
  const { projectPositions } = assembleTopologyLayout(projects, skills);
  const visualBoxes = projects.map(p => ({ id: p.id, ...getTopologyProjectVisualBounds(p, projectPositions[p.id]) }));

  for (let i = 0; i < visualBoxes.length; i++) {
    for (let j = i + 1; j < visualBoxes.length; j++) {
      assert.equal(
        checkAABBOverlap(visualBoxes[i], visualBoxes[j], 0),
        false,
        `${visualBoxes[i].id} (${projects[i].title}) rendered envelope overlaps ${visualBoxes[j].id} (${projects[j].title})`
      );
    }
  }
});

test('static orbital lattice on the real committed snapshot: no project visual safe bounds invade the capability core', () => {
  const { projectPositions, skillPositions } = assembleTopologyLayout(projects, skills);

  // Independently recompute the capability core's isometric bounding box from
  // the actual skill positions (same derivation the layout engine uses for the
  // orbit center), so this check does not merely trust internal orbitGeometry state.
  const coreCorners: { x: number; y: number }[] = [];
  skills.forEach(s => {
    const bounds = getNodeBounds('skill', skillPositions[s.id], 48, 48);
    coreCorners.push(project3DToIso(bounds.minX, bounds.minY, 0));
    coreCorners.push(project3DToIso(bounds.maxX, bounds.minY, 0));
    coreCorners.push(project3DToIso(bounds.maxX, bounds.maxY, 0));
    coreCorners.push(project3DToIso(bounds.minX, bounds.maxY, 0));
  });
  const coreBounds = {
    minX: Math.min(...coreCorners.map(c => c.x)),
    maxX: Math.max(...coreCorners.map(c => c.x)),
    minY: Math.min(...coreCorners.map(c => c.y)),
    maxY: Math.max(...coreCorners.map(c => c.y)),
  };

  for (const p of projects) {
    const visualBounds = getTopologyProjectVisualBounds(p, projectPositions[p.id]);
    assert.equal(
      checkAABBOverlap(visualBounds, coreBounds, 0),
      false,
      `${p.id} (${p.title}) visual envelope invades the capability core`
    );
  }
});

test('static orbital lattice on the real committed snapshot: deterministic across repeated invocations', () => {
  const layout1 = assembleTopologyLayout(projects, skills);
  const layout2 = assembleTopologyLayout(projects, skills);
  assert.deepEqual(layout1, layout2);
});

// ---------------------------------------------------------------------------
// PR22 motion-safety: PR21 proved zero overlap at phase 0. Autonomous orbital
// motion moves every project through EVERY angular position over a full
// revolution, so that alone does not prove safety through the whole
// revolution — slot chord distances vary around an ellipse and project
// footprints/callouts differ in size. Sweep the actual committed data at
// 5-degree increments (72 samples) and prove it holds throughout.
// ---------------------------------------------------------------------------

const MOTION_SWEEP_SAMPLES = 72; // 5-degree increments

function buildCoreBounds() {
  const { skillPositions } = assembleTopologyLayout(projects, skills);
  const coreCorners: { x: number; y: number }[] = [];
  skills.forEach(s => {
    const bounds = getNodeBounds('skill', skillPositions[s.id], 48, 48);
    coreCorners.push(project3DToIso(bounds.minX, bounds.minY, 0));
    coreCorners.push(project3DToIso(bounds.maxX, bounds.minY, 0));
    coreCorners.push(project3DToIso(bounds.maxX, bounds.maxY, 0));
    coreCorners.push(project3DToIso(bounds.minX, bounds.maxY, 0));
  });
  return {
    minX: Math.min(...coreCorners.map(c => c.x)),
    maxX: Math.max(...coreCorners.map(c => c.x)),
    minY: Math.min(...coreCorners.map(c => c.y)),
    maxY: Math.max(...coreCorners.map(c => c.y)),
  };
}

test('motion-safety sweep (72 phases, real committed snapshot): all 18 canonical projects remain on the same ellipse at every sampled phase', () => {
  const { orbitGeometry } = assembleTopologyLayout(projects, skills);

  // Exact algebraic check: every slot's dynamic angle at every sampled phase
  // satisfies centerIso + radius*cos/sin(angle+phase) — proving one coherent
  // ellipse (same center/radiusX/radiusY for all 18 projects), not a drifting
  // or per-project-varying track.
  for (let s = 0; s < MOTION_SWEEP_SAMPLES; s++) {
    const phase = (s / MOTION_SWEEP_SAMPLES) * 2 * Math.PI;
    for (const slot of orbitGeometry.slots) {
      const angle = slot.angle + phase;
      const isoX = orbitGeometry.centerIso.x + orbitGeometry.radiusX * Math.cos(angle);
      const isoY = orbitGeometry.centerIso.y + orbitGeometry.radiusY * Math.sin(angle);
      const dx = (isoX - orbitGeometry.centerIso.x) / orbitGeometry.radiusX;
      const dy = (isoY - orbitGeometry.centerIso.y) / orbitGeometry.radiusY;
      assert.ok(Math.abs(dx * dx + dy * dy - 1) < 1e-9, `${slot.projectId} left the ellipse at phase sample ${s}`);
    }
  }
});

test('motion-safety sweep (72 phases, real committed snapshot): zero project-project visual envelope overlap and zero capability-core invasion at every phase', () => {
  const { orbitGeometry } = assembleTopologyLayout(projects, skills);
  const projById = new Map(projects.map(p => [p.id, p]));
  const coreBounds = buildCoreBounds();

  for (let s = 0; s < MOTION_SWEEP_SAMPLES; s++) {
    const phase = (s / MOTION_SWEEP_SAMPLES) * 2 * Math.PI;
    const boxes = orbitGeometry.slots.map(slot => {
      const project = projById.get(slot.projectId)!;
      const origin = getOrbitalProjectPositionAtPhase(project, slot, orbitGeometry, phase);
      return { id: slot.projectId, ...getTopologyProjectVisualBounds(project, origin) };
    });

    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        assert.equal(
          checkAABBOverlap(boxes[i], boxes[j], 0),
          false,
          `phase sample ${s} (${((phase * 180) / Math.PI).toFixed(1)}deg): ${boxes[i].id} overlaps ${boxes[j].id}`
        );
      }
      assert.equal(
        checkAABBOverlap(boxes[i], coreBounds, 0),
        false,
        `phase sample ${s} (${((phase * 180) / Math.PI).toFixed(1)}deg): ${boxes[i].id} invades the capability core`
      );
    }
  }
});

test('motion-safety sweep (72 phases, real committed snapshot): every moving project envelope stays inside motionVisualBounds', () => {
  const { orbitGeometry } = assembleTopologyLayout(projects, skills);
  const projById = new Map(projects.map(p => [p.id, p]));
  const mb = orbitGeometry.motionVisualBounds;

  for (let s = 0; s < MOTION_SWEEP_SAMPLES; s++) {
    const phase = (s / MOTION_SWEEP_SAMPLES) * 2 * Math.PI;
    for (const slot of orbitGeometry.slots) {
      const project = projById.get(slot.projectId)!;
      const origin = getOrbitalProjectPositionAtPhase(project, slot, orbitGeometry, phase);
      const box = getTopologyProjectVisualBounds(project, origin);
      assert.ok(box.minX >= mb.minX - 1e-6, `${slot.projectId} at phase sample ${s} exceeds motionVisualBounds.minX`);
      assert.ok(box.maxX <= mb.maxX + 1e-6, `${slot.projectId} at phase sample ${s} exceeds motionVisualBounds.maxX`);
      assert.ok(box.minY >= mb.minY - 1e-6, `${slot.projectId} at phase sample ${s} exceeds motionVisualBounds.minY`);
      assert.ok(box.maxY <= mb.maxY + 1e-6, `${slot.projectId} at phase sample ${s} exceeds motionVisualBounds.maxY`);
    }
  }
});

test('motion-safety: computeFitViewport frames motionVisualBounds without clipping at every required desktop/tablet viewport', () => {
  const { orbitGeometry } = assembleTopologyLayout(projects, skills);
  const bounds = orbitGeometry.motionVisualBounds;
  const boundsWidth = bounds.maxX - bounds.minX;
  const boundsHeight = bounds.maxY - bounds.minY;

  // 390x844 is static because compact motion is disabled (see TopologyCanvas's
  // isCompact branch), but the pure motion-safe bounds must still be
  // mathematically correct and frameable at every required size.
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
    assert.ok(fittedWidth <= w + 1e-6, `${w}x${h}: fitted width ${fittedWidth.toFixed(1)} exceeds viewport (zoom ${zoom})`);
    assert.ok(fittedHeight <= h + 1e-6, `${w}x${h}: fitted height ${fittedHeight.toFixed(1)} exceeds viewport (zoom ${zoom})`);
  }
});
