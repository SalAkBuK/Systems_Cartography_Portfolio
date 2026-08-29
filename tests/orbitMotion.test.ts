import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  ORBIT_PERIOD_MS,
  ORBIT_RESUME_DELAY_MS,
  normalizeOrbitPhase,
  computePhaseDelta,
  advanceOrbitPhase,
  stepOrbitClock,
  getOrbitalProjectPositionAtPhase,
  isOrbitPauseConditionActive,
  type OrbitClockState,
  type OrbitPauseState,
} from '../src/utils/orbitMotion.ts';
import { assembleTopologyLayout } from '../src/utils/topologyLayout.ts';
import { project3DToIso } from '../src/utils/isometricProjection.ts';
import { getTopologyProjectDimensions } from '../src/utils/projectTopologyGeometry.ts';
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
// A. phase 0 reproduces PR21 canonical orbital positions
// ---------------------------------------------------------------------------

test('getOrbitalProjectPositionAtPhase: phase 0 exactly reproduces the static canonical position for every project', () => {
  const projects = generateMockProjects(18);
  const skills = generateMockSkills(8);
  const { projectPositions, orbitGeometry } = assembleTopologyLayout(projects, skills);

  for (const slot of orbitGeometry.slots) {
    const project = projects.find(p => p.id === slot.projectId)!;
    const atPhaseZero = getOrbitalProjectPositionAtPhase(project, slot, orbitGeometry, 0);
    const canonical = projectPositions[slot.projectId];
    assert.ok(Math.abs(atPhaseZero.x - canonical.x) < 1e-9, `${slot.projectId} x mismatch at phase 0`);
    assert.ok(Math.abs(atPhaseZero.y - canonical.y) < 1e-9, `${slot.projectId} y mismatch at phase 0`);
  }
});

// ---------------------------------------------------------------------------
// B. phase π/2 moves every canonical project by the same angular offset
// ---------------------------------------------------------------------------

test('getOrbitalProjectPositionAtPhase: a phase shift moves every project by exactly the same angular offset', () => {
  const projects = generateMockProjects(12);
  const skills = generateMockSkills(6);
  const { orbitGeometry } = assembleTopologyLayout(projects, skills);
  const phase = Math.PI / 2;

  for (const slot of orbitGeometry.slots) {
    const project = projects.find(p => p.id === slot.projectId)!;
    const pos = getOrbitalProjectPositionAtPhase(project, slot, orbitGeometry, phase);
    const dims = getTopologyProjectDimensions(project);
    const iso = project3DToIso(pos.x + dims.width / 2, pos.y + dims.depth / 2, 0);
    const expectedIsoX = orbitGeometry.centerIso.x + orbitGeometry.radiusX * Math.cos(slot.angle + phase);
    const expectedIsoY = orbitGeometry.centerIso.y + orbitGeometry.radiusY * Math.sin(slot.angle + phase);
    assert.ok(Math.abs(iso.x - expectedIsoX) < 1e-6, `${slot.projectId} did not move by the shared phase offset (x)`);
    assert.ok(Math.abs(iso.y - expectedIsoY) < 1e-6, `${slot.projectId} did not move by the shared phase offset (y)`);
  }
});

// ---------------------------------------------------------------------------
// C. angular separation remains exactly 2π/N at any shared phase
// ---------------------------------------------------------------------------

test('getOrbitalProjectPositionAtPhase: angular separation between slots stays exactly 2π/N regardless of shared phase', () => {
  const n = 15;
  const projects = generateMockProjects(n);
  const skills = generateMockSkills(6);
  const { orbitGeometry } = assembleTopologyLayout(projects, skills);
  const expectedSpacing = (2 * Math.PI) / n;

  for (const phase of [0, 0.3, Math.PI / 2, Math.PI, 5.5]) {
    const dynamicAngles = orbitGeometry.slots.map(s => s.angle + phase).sort((a, b) => a - b);
    for (let i = 1; i < dynamicAngles.length; i++) {
      const spacing = dynamicAngles[i] - dynamicAngles[i - 1];
      assert.ok(Math.abs(spacing - expectedSpacing) < 1e-9, `spacing deviated at phase ${phase}`);
    }
  }
});

// ---------------------------------------------------------------------------
// D. every actual rendered project center satisfies the ellipse equation at
// multiple phases (not just phase 0 — see staticOrbitalLattice.test.ts for
// the phase-0 version of this proof)
// ---------------------------------------------------------------------------

test('getOrbitalProjectPositionAtPhase: rendered center satisfies the shared ellipse equation at multiple phases', () => {
  const projects = generateMockProjects(18);
  const skills = generateMockSkills(8);
  const { orbitGeometry } = assembleTopologyLayout(projects, skills);

  for (const phase of [0, 1.234, Math.PI, 4.71, 6.0]) {
    for (const slot of orbitGeometry.slots) {
      const project = projects.find(p => p.id === slot.projectId)!;
      const origin = getOrbitalProjectPositionAtPhase(project, slot, orbitGeometry, phase);
      const dims = getTopologyProjectDimensions(project);
      const centerIso = project3DToIso(origin.x + dims.width / 2, origin.y + dims.depth / 2, 0);
      const dx = (centerIso.x - orbitGeometry.centerIso.x) / orbitGeometry.radiusX;
      const dy = (centerIso.y - orbitGeometry.centerIso.y) / orbitGeometry.radiusY;
      const residual = dx * dx + dy * dy;
      assert.ok(Math.abs(residual - 1) < 1e-6, `${slot.projectId} off the ellipse at phase ${phase} (residual ${residual})`);
    }
  }
});

// ---------------------------------------------------------------------------
// E. project block orientation is unchanged by phase (position-only motion)
// ---------------------------------------------------------------------------

test('getOrbitalProjectPositionAtPhase: returns a translation only — same footprint dimensions at every phase, never a rotated/rescaled box', () => {
  const projects = generateMockProjects(1);
  const skills = generateMockSkills(3);
  const { orbitGeometry } = assembleTopologyLayout(projects, skills);
  const slot = orbitGeometry.slots[0];
  const project = projects[0];

  const dimsAtEachPhase = [0, 1, 2, 3, 4, 5, 6].map(phase => {
    const origin = getOrbitalProjectPositionAtPhase(project, slot, orbitGeometry, phase);
    // The function returns only {x, y} — a top-left origin. There is no angle,
    // rotation, or scale field to apply; callers draw the identical axonometric
    // box/callout at this origin exactly as PR21 did.
    return Object.keys(origin).sort();
  });
  for (const keys of dimsAtEachPhase) {
    assert.deepEqual(keys, ['x', 'y'], 'getOrbitalProjectPositionAtPhase must return position only, never orientation');
  }
});

test('TopologyCanvas.tsx: no rotate/tangent transform is ever applied to a project structure or callout', () => {
  const content = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');
  const startIdx = content.indexOf('<g id="project-structures">');
  const endIdx = content.indexOf('</svg>', startIdx);
  assert.ok(startIdx !== -1 && endIdx !== -1, 'project-structures render block must exist');
  const projectStructuresBlock = content.slice(startIdx, endIdx);
  // Decorative fill-pattern rotation (patternTransform="rotate(45 0 0)" for the
  // architectural hatch texture) is unrelated and pre-dates this PR; only a
  // rotate() on a project/callout <g> transform would violate position-only motion.
  assert.ok(
    !/transform=\{`[^`]*rotate\(/.test(projectStructuresBlock) && !/transform="[^"]*rotate\(/.test(projectStructuresBlock),
    'No rotate() transform may be applied to any project structure or callout element'
  );
});

// ---------------------------------------------------------------------------
// F. stable project identity -> stable base slot, independent of phase
// ---------------------------------------------------------------------------

test('assembleTopologyLayout: slot assignment (angle/index) is independent of any phase — orbitGeometry itself carries no phase', () => {
  const projects = generateMockProjects(10);
  const skills = generateMockSkills(5);
  const { orbitGeometry } = assembleTopologyLayout(projects, skills);
  assert.ok(!('phase' in orbitGeometry), 'orbitGeometry must not carry phase state — it is pure static geometry');
  assert.ok(!('orbitPhase' in orbitGeometry), 'orbitGeometry must not carry phase state — it is pure static geometry');

  // Re-running assembleTopologyLayout (as if mode/search/filter changed) with the
  // exact same inputs must yield an identical slot assignment.
  const { orbitGeometry: again } = assembleTopologyLayout(projects, skills);
  assert.deepEqual(orbitGeometry.slots, again.slots);
});

// ---------------------------------------------------------------------------
// Shared-clock architecture (pure core: stepOrbitClock)
// ---------------------------------------------------------------------------

test('normalizeOrbitPhase: wraps into [0, 2π)', () => {
  assert.ok(normalizeOrbitPhase(0) === 0);
  assert.ok(Math.abs(normalizeOrbitPhase(2 * Math.PI) - 0) < 1e-9);
  assert.ok(Math.abs(normalizeOrbitPhase(-Math.PI / 2) - (1.5 * Math.PI)) < 1e-9);
  assert.ok(Math.abs(normalizeOrbitPhase(5 * Math.PI) - Math.PI) < 1e-9);
});

test('computePhaseDelta: scales linearly with elapsed time and inversely with period', () => {
  const full = computePhaseDelta(ORBIT_PERIOD_MS);
  assert.ok(Math.abs(full - 2 * Math.PI) < 1e-9, 'one full period elapsed must equal one full revolution');
  const half = computePhaseDelta(ORBIT_PERIOD_MS / 2);
  assert.ok(Math.abs(half - Math.PI) < 1e-9);
  assert.equal(computePhaseDelta(0), 0);
  assert.equal(computePhaseDelta(-100), 0, 'negative elapsed time must not move the phase backward');
});

test('advanceOrbitPhase: adds the delta and normalizes', () => {
  const advanced = advanceOrbitPhase(0, ORBIT_PERIOD_MS / 4);
  assert.ok(Math.abs(advanced - Math.PI / 2) < 1e-9);
});

test('stepOrbitClock: exactly one shared phase advances per real-time step (no per-project independent phases exist in this API)', () => {
  const state: OrbitClockState = { phase: 0, lastTimestamp: 1000 };
  const next = stepOrbitClock(state, 1000 + ORBIT_PERIOD_MS / 4, true);
  assert.ok(Math.abs(next.phase - Math.PI / 2) < 1e-9);
  assert.equal(next.lastTimestamp, 1000 + ORBIT_PERIOD_MS / 4);
});

test('stepOrbitClock: not running holds phase and clears the timestamp baseline', () => {
  const state: OrbitClockState = { phase: 1.23, lastTimestamp: 5000 };
  const next = stepOrbitClock(state, 999999, false);
  assert.equal(next.phase, 1.23, 'phase must be held while paused');
  assert.equal(next.lastTimestamp, null, 'timestamp baseline must be cleared while paused');
});

test('stepOrbitClock: resuming with no baseline captures the timestamp WITHOUT advancing phase this frame', () => {
  const state: OrbitClockState = { phase: 1.0, lastTimestamp: null };
  const next = stepOrbitClock(state, 123456, true);
  assert.equal(next.phase, 1.0, 'first frame after resume must not silently advance the phase');
  assert.equal(next.lastTimestamp, 123456);
});

// ---------------------------------------------------------------------------
// No catch-up jump after a long pause / hidden tab
// ---------------------------------------------------------------------------

test('stepOrbitClock: a tab hidden for 5 minutes does not apply 5 minutes of orbital delta on resume', () => {
  let clock: OrbitClockState = { phase: 0, lastTimestamp: 0 };

  // Running normally for a bit.
  clock = stepOrbitClock(clock, 16, true);
  const phaseBeforeHide = clock.phase;

  // Tab goes hidden: isRunning becomes false. Real time keeps moving in the
  // background (simulated by huge timestamp jumps), but the clock is not
  // running, so lastTimestamp keeps getting cleared — nothing accumulates.
  const FIVE_MINUTES_MS = 5 * 60 * 1000;
  for (let i = 0; i < 5; i++) {
    clock = stepOrbitClock(clock, 16 + FIVE_MINUTES_MS * (i + 1), false);
    assert.equal(clock.phase, phaseBeforeHide, 'phase must not move at all while not running');
    assert.equal(clock.lastTimestamp, null);
  }

  // Tab becomes visible again: isRunning is true, but there is no baseline,
  // so this frame must NOT apply the 5-minute gap as a delta.
  const resumeTimestamp = 16 + FIVE_MINUTES_MS * 6;
  clock = stepOrbitClock(clock, resumeTimestamp, true);
  assert.equal(clock.phase, phaseBeforeHide, 'resume frame must not apply the paused duration as orbital delta');

  // The FOLLOWING frame (a normal small delta) advances normally.
  clock = stepOrbitClock(clock, resumeTimestamp + 16, true);
  const expectedSmallDelta = computePhaseDelta(16);
  assert.ok(
    Math.abs(clock.phase - normalizeOrbitPhase(phaseBeforeHide + expectedSmallDelta)) < 1e-9,
    'the frame after resume must advance by only the small real frame delta, not the paused duration'
  );
});

// ---------------------------------------------------------------------------
// Pause eligibility contract
// ---------------------------------------------------------------------------

const idleState: OrbitPauseState = {
  isProjectHovered: false,
  isSkillHovered: false,
  isProjectSelected: false,
  isSkillSelected: false,
  isNodeDragging: false,
  isCanvasPanning: false,
  isDocumentHidden: false,
  prefersReducedMotion: false,
  isCompact: false,
  isExperienceSelected: false,
};

test('isOrbitPauseConditionActive: desktop idle allows motion', () => {
  assert.equal(isOrbitPauseConditionActive(idleState), false);
});

const pauseTriggeringFields: Array<keyof OrbitPauseState> = [
  'isProjectHovered',
  'isSkillHovered',
  'isProjectSelected',
  'isSkillSelected',
  'isNodeDragging',
  'isCanvasPanning',
  'isDocumentHidden',
  'prefersReducedMotion',
  'isCompact',
  'isExperienceSelected',
];

for (const field of pauseTriggeringFields) {
  test(`isOrbitPauseConditionActive: ${field} alone pauses the entire orbit`, () => {
    const state: OrbitPauseState = { ...idleState, [field]: true };
    assert.equal(isOrbitPauseConditionActive(state), true);
  });
}

test('ORBIT_RESUME_DELAY_MS is within the specified 600-1000ms neighborhood (target ~800ms)', () => {
  assert.ok(ORBIT_RESUME_DELAY_MS >= 600 && ORBIT_RESUME_DELAY_MS <= 1000);
});

test('ORBIT_PERIOD_MS is within the specified 90-150s neighborhood (target 120s)', () => {
  assert.ok(ORBIT_PERIOD_MS >= 90_000 && ORBIT_PERIOD_MS <= 150_000);
});
