import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { 
  getConduitPresentationState, 
  wrapCalloutTitle, 
  assembleTopologyLayout,
  getNodeBounds,
  checkAABBOverlap
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

test('14. getNodeBounds: Correctly reflects center coordinates for skills and top-left for projects', () => {
  // Skill: center (100, 50) with 48x48
  const skillBounds = getNodeBounds('skill', { x: 100, y: 50 }, 48, 48);
  assert.deepEqual(skillBounds, {
    minX: 76,
    maxX: 124,
    minY: 26,
    maxY: 74
  });

  // Project: origin (100, 50) with width 80, height 55
  const projectBounds = getNodeBounds('project', { x: 100, y: 50 }, 80, 55);
  assert.deepEqual(projectBounds, {
    minX: 100,
    maxX: 180,
    minY: 50,
    maxY: 105
  });
});

test('15. checkAABBOverlap: True rendered skill center footprint detects overlap where top-left assumption would fail', () => {
  // Skill centered at (50, 50), true bounds [26, 74] x [26, 74]
  const skillBounds = getNodeBounds('skill', { x: 50, y: 50 }, 48, 48);
  // Project placed at origin (20, 20) with width 20, height 20 -> bounds [20, 40] x [20, 40]
  const projectBounds = getNodeBounds('project', { x: 20, y: 20 }, 20, 20);

  // Under center semantics: [20, 40] overlaps [26, 74] (x: 20 < 74 and 40 > 26)
  assert.equal(checkAABBOverlap(projectBounds, skillBounds, 0), true, 'Must detect overlap with skill center bounds');

  // If skill was falsely treated as top-left (50, 50) with bounds [50, 98], project [20, 40] would NOT overlap [50, 98]
  const fakeTopLeftSkillBounds = { minX: 50, maxX: 98, minY: 50, maxY: 98 };
  assert.equal(checkAABBOverlap(projectBounds, fakeTopLeftSkillBounds, 0), false);
});

test('16. calculateConduitGeometry: Terminate conduit endpoint exactly at capability center', async () => {
  const { calculateConduitGeometry } = await import('../src/utils/forceLayout.ts');
  const { project3DToIso } = await import('../src/components/TopologyCanvas.tsx');

  const sourceNode = { x: 0, y: 0, width: 80, height: 55, type: 'project' };
  const skillCenter = { x: 100, y: 50 };
  const targetNode = { x: skillCenter.x, y: skillCenter.y, width: 48, height: 48, type: 'skill' };

  const conduit = calculateConduitGeometry(sourceNode, targetNode, 'p--s', 'p1', 's1', 'project', 'skill');

  const expectedIso = project3DToIso(skillCenter.x, skillCenter.y, 0);
  assert.deepEqual(conduit.endIso, expectedIso, 'Conduit endIso must match isometric projection of skill center');
});

test('17. assembleTopologyLayout: Produces identical positions across multiple invocations (deterministic)', () => {
  const layout1 = assembleTopologyLayout(VERIFIED_PROJECTS, VERIFIED_SKILLS);
  const layout2 = assembleTopologyLayout(VERIFIED_PROJECTS, VERIFIED_SKILLS);
  assert.deepEqual(layout1, layout2, 'Layout must be 100% deterministic');
});

test('18. assembleTopologyLayout: Stable sorting ensures shuffled input order does not alter output positions', () => {
  const shuffledProjects = [...VERIFIED_PROJECTS].reverse();
  const shuffledSkills = [...VERIFIED_SKILLS].reverse();
  
  const layoutStandard = assembleTopologyLayout(VERIFIED_PROJECTS, VERIFIED_SKILLS);
  const layoutShuffled = assembleTopologyLayout(shuffledProjects, shuffledSkills);
  
  assert.deepEqual(layoutStandard, layoutShuffled, 'Shuffling input array order must yield identical positions');
});

test('19. assembleTopologyLayout: Verified portfolio layout has zero overlaps and correct inner/outer separation', () => {
  const { projectPositions, skillPositions } = assembleTopologyLayout(VERIFIED_PROJECTS, VERIFIED_SKILLS);

  // Assert all coordinates snapped
  Object.values(projectPositions).forEach(pos => {
    assert.equal(Math.abs(pos.x) % GRID_SNAP_STEP, 0);
    assert.equal(Math.abs(pos.y) % GRID_SNAP_STEP, 0);
  });
  Object.values(skillPositions).forEach(pos => {
    assert.equal(Math.abs(pos.x) % GRID_SNAP_STEP, 0);
    assert.equal(Math.abs(pos.y) % GRID_SNAP_STEP, 0);
  });

  const skillBoxes = VERIFIED_SKILLS.map(s => ({
    id: s.id,
    type: 'skill' as const,
    ...getNodeBounds('skill', skillPositions[s.id], 48, 48)
  }));

  const projectBoxes = VERIFIED_PROJECTS.map(p => ({
    id: p.id,
    type: 'project' as const,
    ...getNodeBounds('project', projectPositions[p.id], (p.dimensions?.width || 100) * 0.75, 55)
  }));

  // Assert zero skill-to-skill overlap
  for (let i = 0; i < skillBoxes.length; i++) {
    for (let j = i + 1; j < skillBoxes.length; j++) {
      assert.equal(
        checkAABBOverlap(skillBoxes[i], skillBoxes[j], 0),
        false,
        `Skills ${skillBoxes[i].id} and ${skillBoxes[j].id} must not overlap`
      );
    }
  }

  // Assert zero project-to-project overlap
  for (let i = 0; i < projectBoxes.length; i++) {
    for (let j = i + 1; j < projectBoxes.length; j++) {
      assert.equal(
        checkAABBOverlap(projectBoxes[i], projectBoxes[j], 0),
        false,
        `Projects ${projectBoxes[i].id} and ${projectBoxes[j].id} must not overlap`
      );
    }
  }

  // Assert zero project-to-skill overlap
  for (const pb of projectBoxes) {
    for (const sb of skillBoxes) {
      assert.equal(
        checkAABBOverlap(pb, sb, 0),
        false,
        `Project ${pb.id} and Skill ${sb.id} must not overlap`
      );
    }
  }

  // Assert projects strictly outside inner capability core
  const maxSkillExtent = Math.max(...skillBoxes.map(s => Math.max(Math.abs(s.minX), Math.abs(s.maxX), Math.abs(s.minY), Math.abs(s.maxY))));
  const minProjectDist = Math.min(...projectBoxes.map(p => Math.hypot((p.minX + p.maxX) / 2, (p.minY + p.maxY) / 2)));
  assert.ok(maxSkillExtent < minProjectDist, 'Skills must be strictly inside project rings');
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
        type: 'skill' as const,
        ...getNodeBounds('skill', skillPositions[s.id], 48, 48)
      }));

      const projectBoxes = mockProjects.map(p => ({
        id: p.id,
        type: 'project' as const,
        ...getNodeBounds('project', projectPositions[p.id], (p.dimensions?.width || 100) * 0.75, 55)
      }));

      // 4. Assert zero capability overlap
      for (let i = 0; i < skillBoxes.length; i++) {
        for (let j = i + 1; j < skillBoxes.length; j++) {
          assert.equal(
            checkAABBOverlap(skillBoxes[i], skillBoxes[j], 0),
            false,
            `Collision detected between skills ${skillBoxes[i].id} and ${skillBoxes[j].id}`
          );
        }
      }

      // 5. Assert zero project overlap
      for (let i = 0; i < projectBoxes.length; i++) {
        for (let j = i + 1; j < projectBoxes.length; j++) {
          assert.equal(
            checkAABBOverlap(projectBoxes[i], projectBoxes[j], 0),
            false,
            `Collision detected between projects ${projectBoxes[i].id} and ${projectBoxes[j].id}`
          );
        }
      }

      // 6. Assert zero project-capability overlap
      for (const pb of projectBoxes) {
        for (const sb of skillBoxes) {
          assert.equal(
            checkAABBOverlap(pb, sb, 0),
            false,
            `Collision detected between project ${pb.id} and skill ${sb.id}`
          );
        }
      }

      // 7. Assert project region is outside capability core
      const maxSkillExtent = Math.max(...skillBoxes.map(s => Math.max(Math.abs(s.minX), Math.abs(s.maxX), Math.abs(s.minY), Math.abs(s.maxY))));
      const minProjectDist = Math.min(...projectBoxes.map(p => Math.hypot((p.minX + p.maxX) / 2, (p.minY + p.maxY) / 2)));
      assert.ok(
        maxSkillExtent < minProjectDist,
        `Inner skill core max extent (${maxSkillExtent}) must be less than outer project min radius (${minProjectDist})`
      );
    });
  }
}

// Pathological Test: Unusually wide project dimensions
test('20. assembleTopologyLayout: Pathological dataset with large variable project widths resolves without overlap', () => {
  const pathologicalProjects = generateMockProjects(30, [100, 250, 180, 320, 140]);
  const mockSkills = generateMockSkills(12);

  const layout = assembleTopologyLayout(pathologicalProjects, mockSkills);
  const { projectPositions, skillPositions } = layout;

  const skillBoxes = mockSkills.map(s => ({
    id: s.id,
    type: 'skill' as const,
    ...getNodeBounds('skill', skillPositions[s.id], 48, 48)
  }));

  const projectBoxes = pathologicalProjects.map(p => ({
    id: p.id,
    type: 'project' as const,
    ...getNodeBounds('project', projectPositions[p.id], p.dimensions.width * 0.75, 55)
  }));

  // Assert all coordinates finite and snapped
  Object.values(projectPositions).forEach(pos => {
    assert.ok(Number.isFinite(pos.x));
    assert.ok(Number.isFinite(pos.y));
    assert.equal(Math.abs(pos.x) % GRID_SNAP_STEP, 0);
    assert.equal(Math.abs(pos.y) % GRID_SNAP_STEP, 0);
  });

  // Zero project-to-project collisions
  for (let i = 0; i < projectBoxes.length; i++) {
    for (let j = i + 1; j < projectBoxes.length; j++) {
      assert.equal(
        checkAABBOverlap(projectBoxes[i], projectBoxes[j], 0),
        false,
        `Pathological overlap between ${projectBoxes[i].id} and ${projectBoxes[j].id}`
      );
    }
  }

  // Zero project-to-skill collisions
  for (const pb of projectBoxes) {
    for (const sb of skillBoxes) {
      assert.equal(
        checkAABBOverlap(pb, sb, 0),
        false,
        `Pathological overlap between project ${pb.id} and skill ${sb.id}`
      );
    }
  }
});

// ---------------------------------------------------------------------------
// PART 4: Experience Dock & Stale Code Deletion Invariants
// ---------------------------------------------------------------------------

test('21. App.tsx: traceModeActive specifically initialized to false', () => {
  const appContent = fs.readFileSync(path.resolve('src/App.tsx'), 'utf8');
  assert.ok(
    appContent.includes("const [traceModeActive, setTraceModeActive] = useState(false);"),
    'traceModeActive state hook must specifically initialize to false in App.tsx'
  );
});

test('22. TopologyCanvas.tsx: Floating Experience Dock and drag handlers are completely removed', () => {
  const canvasContent = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');
  
  assert.ok(!canvasContent.includes("sys_cartography_experience_dock_position"), 'No dock localStorage key');
  assert.ok(!canvasContent.includes("dockPosition"), 'No dock position state');
  assert.ok(!canvasContent.includes("clampDock"), 'No clampDock helper');
  assert.ok(!canvasContent.includes("PROFESSIONAL EXPERIENCE DOCK"), 'No dock markup in canvas');
  assert.ok(!canvasContent.includes("onSelectExperience:"), 'onSelectExperience prop removed from TopologyCanvasProps');
});

test('23. forceLayout.ts: Dead force-graph scaffolding and simulation methods are deleted', async () => {
  const forceLayoutModule = await import('../src/utils/forceLayout.ts');
  const forceLayoutContent = fs.readFileSync(path.resolve('src/utils/forceLayout.ts'), 'utf8');
  
  assert.equal(typeof forceLayoutModule.calculateConduitGeometry, 'function', 'calculateConduitGeometry must be exported');
  assert.ok(!forceLayoutContent.includes("createTopologyGraph"), 'createTopologyGraph must be removed');
  assert.ok(!forceLayoutContent.includes("LayoutNode"), 'LayoutNode interface must be removed');
  assert.ok(!forceLayoutContent.includes("LayoutEdge"), 'LayoutEdge interface must be removed');
  assert.ok(!forceLayoutContent.includes("stepForceSimulation"), 'stepForceSimulation must be removed');
  assert.ok(!forceLayoutContent.includes("computeEquilibriumLayout"), 'computeEquilibriumLayout must be removed');
});

test('24. TopologyCanvas.tsx: Hover card reads from runtime projects array and uses getCapabilityCoreTechnology', () => {
  const canvasContent = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');
  
  assert.ok(canvasContent.includes("projects.find(item => item.id === hoveredProjectId)"), 'Hover card must look up hovered project in runtime projects array');
  assert.ok(!canvasContent.includes("PROJECTS.find"), 'Hover card must not use static PROJECTS fallback');
  assert.ok(canvasContent.includes("getCapabilityCoreTechnology(skill)"), 'Midpoint and skill labels must use getCapabilityCoreTechnology');
});

test('25. RightInspectorPanel.tsx: Stale dock repositioning tip is removed', () => {
  const panelContent = fs.readFileSync(path.resolve('src/components/RightInspectorPanel.tsx'), 'utf8');
  assert.ok(!panelContent.includes("EXPERIENCE DOCK CAN ALSO BE REPOSITIONED"), 'Stale dock repositioning tip must be removed');
});
