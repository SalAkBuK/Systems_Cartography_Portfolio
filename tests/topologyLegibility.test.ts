import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { 
  getConduitPresentationState, 
  wrapCalloutTitle, 
  assembleTopologyLayout 
} from '../src/utils/topologyLayout.ts';
import { getCapabilityCoreTechnology } from '../src/utils/capabilityAssociations.ts';
import { VERIFIED_PROJECTS, VERIFIED_SKILLS } from '../src/data/verifiedPortfolioData.ts';
import { GRID_SNAP_STEP } from '../src/utils/collision.ts';
import { ProjectData, InfrastructureSkill } from '../src/types.ts';

// ---------------------------------------------------------------------------
// PART 1: Progressive Conduit Disclosure State Machine
// ---------------------------------------------------------------------------

test('1. getConduitPresentationState: Returns hidden when nodes are not connected', () => {
  const state = getConduitPresentationState({
    isConnected: false,
    isProjectHovered: true,
    isSkillHovered: false,
    isProjectSelected: false,
    isSkillSelected: false,
    isDraggingThisProject: false,
    isDraggingThisSkill: false,
    isAnyProjectHovered: true,
    isAnySkillHovered: false,
    isAnyProjectSelected: false,
    isAnySkillSelected: false,
    isAnyDragging: false,
    traceModeActive: true
  });
  assert.equal(state, 'hidden', 'Unconnected conduit must always be hidden');
});

test('2. getConduitPresentationState: At rest with TRACE OFF returns hidden', () => {
  const state = getConduitPresentationState({
    isConnected: true,
    isProjectHovered: false,
    isSkillHovered: false,
    isProjectSelected: false,
    isSkillSelected: false,
    isDraggingThisProject: false,
    isDraggingThisSkill: false,
    isAnyProjectHovered: false,
    isAnySkillHovered: false,
    isAnyProjectSelected: false,
    isAnySkillSelected: false,
    isAnyDragging: false,
    traceModeActive: false
  });
  assert.equal(state, 'hidden', 'Connected conduit at rest with TRACE OFF must be hidden');
});

test('3. getConduitPresentationState: At rest with TRACE ON returns background', () => {
  const state = getConduitPresentationState({
    isConnected: true,
    isProjectHovered: false,
    isSkillHovered: false,
    isProjectSelected: false,
    isSkillSelected: false,
    isDraggingThisProject: false,
    isDraggingThisSkill: false,
    isAnyProjectHovered: false,
    isAnySkillHovered: false,
    isAnyProjectSelected: false,
    isAnySkillSelected: false,
    isAnyDragging: false,
    traceModeActive: true
  });
  assert.equal(state, 'background', 'Connected conduit at rest with TRACE ON must be background');
});

test('4. getConduitPresentationState: Returns focused when project is hovered (even with TRACE OFF)', () => {
  const state = getConduitPresentationState({
    isConnected: true,
    isProjectHovered: true,
    isSkillHovered: false,
    isProjectSelected: false,
    isSkillSelected: false,
    isDraggingThisProject: false,
    isDraggingThisSkill: false,
    isAnyProjectHovered: true,
    isAnySkillHovered: false,
    isAnyProjectSelected: false,
    isAnySkillSelected: false,
    isAnyDragging: false,
    traceModeActive: false
  });
  assert.equal(state, 'focused', 'Connected conduit of hovered project must be focused');
});

test('5. getConduitPresentationState: Returns focused when skill is selected (even with TRACE OFF)', () => {
  const state = getConduitPresentationState({
    isConnected: true,
    isProjectHovered: false,
    isSkillHovered: false,
    isProjectSelected: false,
    isSkillSelected: true,
    isDraggingThisProject: false,
    isDraggingThisSkill: false,
    isAnyProjectHovered: false,
    isAnySkillHovered: false,
    isAnyProjectSelected: false,
    isAnySkillSelected: true,
    isAnyDragging: false,
    traceModeActive: false
  });
  assert.equal(state, 'focused', 'Connected conduit of selected skill must be focused');
});

test('6. getConduitPresentationState: Returns dragging when connected node is dragged', () => {
  const state = getConduitPresentationState({
    isConnected: true,
    isProjectHovered: false,
    isSkillHovered: false,
    isProjectSelected: false,
    isSkillSelected: false,
    isDraggingThisProject: true,
    isDraggingThisSkill: false,
    isAnyProjectHovered: false,
    isAnySkillHovered: false,
    isAnyProjectSelected: false,
    isAnySkillSelected: false,
    isAnyDragging: true,
    traceModeActive: false
  });
  assert.equal(state, 'dragging', 'Connected conduit of dragged project must be dragging');
});

test('7. getConduitPresentationState: Unrelated conduit when another node is hovered and TRACE OFF returns hidden', () => {
  const state = getConduitPresentationState({
    isConnected: true,
    isProjectHovered: false,
    isSkillHovered: false,
    isProjectSelected: false,
    isSkillSelected: false,
    isDraggingThisProject: false,
    isDraggingThisSkill: false,
    isAnyProjectHovered: true,
    isAnySkillHovered: false,
    isAnyProjectSelected: false,
    isAnySkillSelected: false,
    isAnyDragging: false,
    traceModeActive: false
  });
  assert.equal(state, 'hidden', 'Unrelated conduit during focus with TRACE OFF must be hidden');
});

test('8. getConduitPresentationState: Unrelated conduit when another node is hovered and TRACE ON returns background', () => {
  const state = getConduitPresentationState({
    isConnected: true,
    isProjectHovered: false,
    isSkillHovered: false,
    isProjectSelected: false,
    isSkillSelected: false,
    isDraggingThisProject: false,
    isDraggingThisSkill: false,
    isAnyProjectHovered: true,
    isAnySkillHovered: false,
    isAnyProjectSelected: false,
    isAnySkillSelected: false,
    isAnyDragging: false,
    traceModeActive: true
  });
  assert.equal(state, 'background', 'Unrelated conduit during focus with TRACE ON must be background');
});

// ---------------------------------------------------------------------------
// PART 2: Project Callout Title Wrapping & Safe Tokenization
// ---------------------------------------------------------------------------

test('9. wrapCalloutTitle: Short title returns a single line', () => {
  const lines = wrapCalloutTitle('Worthy CRM', 20, 2);
  assert.deepEqual(lines, ['Worthy CRM']);
});

test('10. wrapCalloutTitle: Long multi-word title splits across 2 lines cleanly without character slicing', () => {
  const lines = wrapCalloutTitle('TowerDesk Mobile Client Application', 20, 2);
  assert.deepEqual(lines, ['TowerDesk Mobile', 'Client Application']);
});

test('11. wrapCalloutTitle: Long hyphenated identifier splits cleanly on hyphen boundary', () => {
  const lines = wrapCalloutTitle('binghatti-concierge-app-rn-expo', 20, 2);
  assert.deepEqual(lines, ['binghatti-concierge-', 'app-rn-expo']);
});

test('12. wrapCalloutTitle: Mixed-case and underscore identifiers are preserved without delimiter range bug', () => {
  const lines = wrapCalloutTitle('API_V2-Backend_Service', 20, 2);
  assert.deepEqual(lines, ['API_V2-Backend_', 'Service']);
});

test('13. wrapCalloutTitle: Extremely long unbroken token or title truncates with ellipsis at max 2 lines', () => {
  const lines = wrapCalloutTitle('SupercalifragilisticexpialidociousUnbrokenStringLongerThanMaxLimit', 20, 2);
  assert.equal(lines.length, 2);
  assert.ok(lines[1].endsWith('…'));
});

// ---------------------------------------------------------------------------
// PART 3: Deterministic Schematic Layout Assembler & Synthetic Scaling
// ---------------------------------------------------------------------------

function checkFootprintOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

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

function generateMockProjects(count: number): ProjectData[] {
  return Array.from({ length: count }, (_, i) => ({
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
    dimensions: { width: 100, height: 60, levels: 2 },
    gridPosition: { x: 0, y: 0 },
    verifiedFacts: [],
    metrics: [],
    keyDecisions: [],
    resilienceTesting: 'Chaos tested',
    links: { github: 'https://github.com/mock' }
  }));
}

test('14. assembleTopologyLayout: Produces identical positions across multiple invocations (deterministic)', () => {
  const layout1 = assembleTopologyLayout(VERIFIED_PROJECTS, VERIFIED_SKILLS);
  const layout2 = assembleTopologyLayout(VERIFIED_PROJECTS, VERIFIED_SKILLS);
  assert.deepEqual(layout1, layout2, 'Layout must be 100% deterministic');
});

test('15. assembleTopologyLayout: Stable sorting ensures shuffled input order does not alter output positions', () => {
  const shuffledProjects = [...VERIFIED_PROJECTS].reverse();
  const shuffledSkills = [...VERIFIED_SKILLS].reverse();
  
  const layoutStandard = assembleTopologyLayout(VERIFIED_PROJECTS, VERIFIED_SKILLS);
  const layoutShuffled = assembleTopologyLayout(shuffledProjects, shuffledSkills);
  
  assert.deepEqual(layoutStandard, layoutShuffled, 'Shuffling input array order must yield identical positions');
});

test('16. assembleTopologyLayout: Verified portfolio layout has zero overlaps and correct inner/outer separation', () => {
  const { projectPositions, skillPositions } = assembleTopologyLayout(VERIFIED_PROJECTS, VERIFIED_SKILLS);

  // Assert all coordinates snapped
  Object.values(projectPositions).forEach(pos => {
    assert.equal(pos.x % GRID_SNAP_STEP, 0);
    assert.equal(pos.y % GRID_SNAP_STEP, 0);
  });
  Object.values(skillPositions).forEach(pos => {
    assert.equal(pos.x % GRID_SNAP_STEP, 0);
    assert.equal(pos.y % GRID_SNAP_STEP, 0);
  });

  const skillBoxes = VERIFIED_SKILLS.map(s => ({
    id: s.id,
    x: skillPositions[s.id].x,
    y: skillPositions[s.id].y,
    width: 48,
    height: 48
  }));

  const projectBoxes = VERIFIED_PROJECTS.map(p => ({
    id: p.id,
    x: projectPositions[p.id].x,
    y: projectPositions[p.id].y,
    width: (p.dimensions?.width || 100) * 0.75,
    height: 55
  }));

  // Assert zero skill-to-skill overlap
  for (let i = 0; i < skillBoxes.length; i++) {
    for (let j = i + 1; j < skillBoxes.length; j++) {
      assert.equal(
        checkFootprintOverlap(skillBoxes[i], skillBoxes[j]),
        false,
        `Skills ${skillBoxes[i].id} and ${skillBoxes[j].id} must not overlap`
      );
    }
  }

  // Assert zero project-to-project overlap
  for (let i = 0; i < projectBoxes.length; i++) {
    for (let j = i + 1; j < projectBoxes.length; j++) {
      assert.equal(
        checkFootprintOverlap(projectBoxes[i], projectBoxes[j]),
        false,
        `Projects ${projectBoxes[i].id} and ${projectBoxes[j].id} must not overlap`
      );
    }
  }

  // Assert zero project-to-skill overlap
  for (const pb of projectBoxes) {
    for (const sb of skillBoxes) {
      assert.equal(
        checkFootprintOverlap(pb, sb),
        false,
        `Project ${pb.id} and Skill ${sb.id} must not overlap`
      );
    }
  }

  // Assert projects strictly outside inner capability core
  const maxSkillRadius = Math.max(...skillBoxes.map(s => Math.hypot(s.x + s.width / 2, s.y + s.height / 2)));
  const minProjectRadius = Math.min(...projectBoxes.map(p => Math.hypot(p.x + p.width / 2, p.y + p.height / 2)));
  assert.ok(maxSkillRadius < minProjectRadius, 'Skills must be strictly inside project rings');
});

// Synthetic Scaling Matrix Tests
const skillCounts = [1, 6, 12, 24];
const projectCounts = [1, 8, 20, 50, 100];

for (const sCount of skillCounts) {
  for (const pCount of projectCounts) {
    test(`assembleTopologyLayout Scale Test: ${sCount} Capabilities × ${pCount} Projects`, () => {
      const mockSkills = generateMockSkills(sCount);
      const mockProjects = generateMockProjects(pCount);

      const layout1 = assembleTopologyLayout(mockProjects, mockSkills);
      const layout2 = assembleTopologyLayout(mockProjects, mockSkills);

      // 1. Assert 100% determinism
      assert.deepEqual(layout1, layout2, 'Must produce identical coordinates across calls');

      // 2. Assert shuffled input determinism
      const shuffledProjects = [...mockProjects].reverse();
      const shuffledSkills = [...mockSkills].reverse();
      const layoutShuffled = assembleTopologyLayout(shuffledProjects, shuffledSkills);
      assert.deepEqual(layout1, layoutShuffled, 'Must produce identical coordinates when input order is reversed');

      const { projectPositions, skillPositions } = layout1;

      // 3. Assert all nodes receive finite grid-snapped coordinates
      mockSkills.forEach(s => {
        const pos = skillPositions[s.id];
        assert.ok(pos, `Skill ${s.id} position missing`);
        assert.ok(Number.isFinite(pos.x));
        assert.ok(Number.isFinite(pos.y));
        assert.equal(Math.abs(pos.x) % GRID_SNAP_STEP, 0, `Skill ${s.id} x must be multiple of ${GRID_SNAP_STEP}`);
        assert.equal(Math.abs(pos.y) % GRID_SNAP_STEP, 0, `Skill ${s.id} y must be multiple of ${GRID_SNAP_STEP}`);
      });

      mockProjects.forEach(p => {
        const pos = projectPositions[p.id];
        assert.ok(pos, `Project ${p.id} position missing`);
        assert.ok(Number.isFinite(pos.x));
        assert.ok(Number.isFinite(pos.y));
        assert.equal(Math.abs(pos.x) % GRID_SNAP_STEP, 0, `Project ${p.id} x must be multiple of ${GRID_SNAP_STEP}`);
        assert.equal(Math.abs(pos.y) % GRID_SNAP_STEP, 0, `Project ${p.id} y must be multiple of ${GRID_SNAP_STEP}`);
      });

      const skillBoxes = mockSkills.map(s => ({
        id: s.id,
        x: skillPositions[s.id].x,
        y: skillPositions[s.id].y,
        width: 48,
        height: 48
      }));

      const projectBoxes = mockProjects.map(p => ({
        id: p.id,
        x: projectPositions[p.id].x,
        y: projectPositions[p.id].y,
        width: (p.dimensions?.width || 100) * 0.75,
        height: 55
      }));

      // 4. Assert zero capability overlap
      for (let i = 0; i < skillBoxes.length; i++) {
        for (let j = i + 1; j < skillBoxes.length; j++) {
          assert.equal(
            checkFootprintOverlap(skillBoxes[i], skillBoxes[j]),
            false,
            `Collision detected between skills ${skillBoxes[i].id} and ${skillBoxes[j].id}`
          );
        }
      }

      // 5. Assert zero project overlap
      for (let i = 0; i < projectBoxes.length; i++) {
        for (let j = i + 1; j < projectBoxes.length; j++) {
          assert.equal(
            checkFootprintOverlap(projectBoxes[i], projectBoxes[j]),
            false,
            `Collision detected between projects ${projectBoxes[i].id} and ${projectBoxes[j].id}`
          );
        }
      }

      // 6. Assert zero project-capability overlap
      for (const pb of projectBoxes) {
        for (const sb of skillBoxes) {
          assert.equal(
            checkFootprintOverlap(pb, sb),
            false,
            `Collision detected between project ${pb.id} and skill ${sb.id}`
          );
        }
      }

      // 7. Assert project region is outside capability core
      const maxSkillDist = Math.max(...skillBoxes.map(s => Math.hypot(s.x + s.width / 2, s.y + s.height / 2)));
      const minProjectDist = Math.min(...projectBoxes.map(p => Math.hypot(p.x + p.width / 2, p.y + p.height / 2)));
      assert.ok(
        maxSkillDist < minProjectDist,
        `Inner skill core max radius (${maxSkillDist}) must be less than outer project min radius (${minProjectDist})`
      );
    });
  }
}

// ---------------------------------------------------------------------------
// PART 4: Experience Dock & Stale Code Deletion Invariants
// ---------------------------------------------------------------------------

test('17. App.tsx: traceModeActive specifically initialized to false', () => {
  const appContent = fs.readFileSync(path.resolve('src/App.tsx'), 'utf8');
  assert.ok(
    appContent.includes("const [traceModeActive, setTraceModeActive] = useState(false);"),
    'traceModeActive state hook must specifically initialize to false in App.tsx'
  );
});

test('18. TopologyCanvas.tsx: Floating Experience Dock and drag handlers are completely removed', () => {
  const canvasContent = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');
  
  assert.ok(!canvasContent.includes("sys_cartography_experience_dock_position"), 'No dock localStorage key');
  assert.ok(!canvasContent.includes("dockPosition"), 'No dock position state');
  assert.ok(!canvasContent.includes("clampDock"), 'No clampDock helper');
  assert.ok(!canvasContent.includes("PROFESSIONAL EXPERIENCE DOCK"), 'No dock markup in canvas');
  assert.ok(!canvasContent.includes("onSelectExperience:"), 'onSelectExperience prop removed from TopologyCanvasProps');
});

test('19. forceLayout.ts: Dead force-graph scaffolding and simulation methods are deleted', async () => {
  const forceLayoutModule = await import('../src/utils/forceLayout.ts');
  const forceLayoutContent = fs.readFileSync(path.resolve('src/utils/forceLayout.ts'), 'utf8');
  
  assert.equal(typeof forceLayoutModule.calculateConduitGeometry, 'function', 'calculateConduitGeometry must be exported');
  assert.ok(!forceLayoutContent.includes("createTopologyGraph"), 'createTopologyGraph must be removed');
  assert.ok(!forceLayoutContent.includes("LayoutNode"), 'LayoutNode interface must be removed');
  assert.ok(!forceLayoutContent.includes("LayoutEdge"), 'LayoutEdge interface must be removed');
  assert.ok(!forceLayoutContent.includes("stepForceSimulation"), 'stepForceSimulation must be removed');
  assert.ok(!forceLayoutContent.includes("computeEquilibriumLayout"), 'computeEquilibriumLayout must be removed');
});

test('20. TopologyCanvas.tsx: Hover card reads from runtime projects array and uses getCapabilityCoreTechnology', () => {
  const canvasContent = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');
  
  assert.ok(canvasContent.includes("projects.find(item => item.id === hoveredProjectId)"), 'Hover card must look up hovered project in runtime projects array');
  assert.ok(!canvasContent.includes("PROJECTS.find"), 'Hover card must not use static PROJECTS fallback');
  assert.ok(canvasContent.includes("getCapabilityCoreTechnology(skill)"), 'Midpoint and skill labels must use getCapabilityCoreTechnology');
});

test('21. RightInspectorPanel.tsx: Stale dock repositioning tip is removed', () => {
  const panelContent = fs.readFileSync(path.resolve('src/components/RightInspectorPanel.tsx'), 'utf8');
  assert.ok(!panelContent.includes("EXPERIENCE DOCK CAN ALSO BE REPOSITIONED"), 'Stale dock repositioning tip must be removed');
});
