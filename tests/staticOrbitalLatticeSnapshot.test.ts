// Real-data orbital regression: exercises the ACTUAL committed portfolio data
// the deployed app renders (src/data/githubSnapshot.generated.ts), not the
// intentionally-empty VERIFIED_PROJECTS/VERIFIED_SKILLS placeholder arrays in
// src/data/verifiedPortfolioData.ts. No sync script is run — this reads the
// snapshot file already committed to the repo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { assembleTopologyLayout, getNodeBounds, checkAABBOverlap } from '../src/utils/topologyLayout.ts';
import { project3DToIso } from '../src/utils/isometricProjection.ts';
import { getTopologyProjectVisualBounds } from '../src/utils/projectTopologyGeometry.ts';
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
