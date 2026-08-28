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
// PART 2: Project Callout Title Wrapping
// ---------------------------------------------------------------------------

test('9. wrapCalloutTitle: Short title returns a single line', () => {
  const lines = wrapCalloutTitle('Worthy CRM', 18, 2);
  assert.deepEqual(lines, ['Worthy CRM']);
});

test('10. wrapCalloutTitle: Long multi-word title splits across 2 lines cleanly', () => {
  const lines = wrapCalloutTitle('TowerDesk Mobile Client Application', 18, 2);
  assert.equal(lines.length, 2);
  assert.ok(lines[0].length <= 20);
  assert.ok(lines[1].length <= 20);
});

test('11. wrapCalloutTitle: Long hyphenated identifier splits on hyphen boundary', () => {
  const lines = wrapCalloutTitle('worthy-crm-nextjs-app', 18, 2);
  assert.equal(lines.length, 2);
  assert.ok(lines[0].includes('worthy-crm'));
});

test('12. wrapCalloutTitle: Extremely long unbroken token or title truncates with ellipsis at max 2 lines', () => {
  const lines = wrapCalloutTitle('SupercalifragilisticexpialidociousUnbrokenStringLongerThanMaxLimit', 18, 2);
  assert.equal(lines.length, 2);
  assert.ok(lines[1].endsWith('…') || lines[1].length <= 18);
});

// ---------------------------------------------------------------------------
// PART 3: Deterministic Schematic Layout Assembler
// ---------------------------------------------------------------------------

test('13. assembleTopologyLayout: Produces identical positions across multiple invocations (deterministic)', () => {
  const layout1 = assembleTopologyLayout(VERIFIED_PROJECTS, VERIFIED_SKILLS);
  const layout2 = assembleTopologyLayout(VERIFIED_PROJECTS, VERIFIED_SKILLS);
  assert.deepEqual(layout1, layout2, 'Layout must be 100% deterministic');
});

test('14. assembleTopologyLayout: Stable sorting ensures shuffled input order does not alter output positions', () => {
  const shuffledProjects = [...VERIFIED_PROJECTS].reverse();
  const shuffledSkills = [...VERIFIED_SKILLS].reverse();
  
  const layoutStandard = assembleTopologyLayout(VERIFIED_PROJECTS, VERIFIED_SKILLS);
  const layoutShuffled = assembleTopologyLayout(shuffledProjects, shuffledSkills);
  
  assert.deepEqual(layoutStandard, layoutShuffled, 'Shuffling input array order must yield identical positions');
});

test('15. assembleTopologyLayout: All positions are snapped to GRID_SNAP_STEP multiples', () => {
  const { projectPositions, skillPositions } = assembleTopologyLayout(VERIFIED_PROJECTS, VERIFIED_SKILLS);
  
  Object.values(projectPositions).forEach(pos => {
    assert.equal(pos.x % GRID_SNAP_STEP, 0, 'Project position x must be a multiple of GRID_SNAP_STEP');
    assert.equal(pos.y % GRID_SNAP_STEP, 0, 'Project position y must be a multiple of GRID_SNAP_STEP');
  });

  Object.values(skillPositions).forEach(pos => {
    assert.equal(pos.x % GRID_SNAP_STEP, 0, 'Skill position x must be a multiple of GRID_SNAP_STEP');
    assert.equal(pos.y % GRID_SNAP_STEP, 0, 'Skill position y must be a multiple of GRID_SNAP_STEP');
  });
});

test('16. assembleTopologyLayout: Skills are positioned in inner core region while projects are in outer region', () => {
  const { projectPositions, skillPositions } = assembleTopologyLayout(VERIFIED_PROJECTS, VERIFIED_SKILLS);
  
  const skillDistances = Object.values(skillPositions).map(p => Math.hypot(p.x, p.y));
  const projectDistances = Object.values(projectPositions).map(p => Math.hypot(p.x, p.y));
  
  const maxSkillRadius = Math.max(...skillDistances);
  const minProjectRadius = Math.min(...projectDistances);
  
  assert.ok(
    maxSkillRadius < minProjectRadius, 
    'Inner skill core max radius must be less than outer project min radius'
  );
});

// ---------------------------------------------------------------------------
// PART 4: Experience Dock & Stale Code Deletion Invariants
// ---------------------------------------------------------------------------

test('17. App.tsx: traceModeActive defaults to false', () => {
  const appContent = fs.readFileSync(path.resolve('src/App.tsx'), 'utf8');
  assert.ok(appContent.includes("useState(false)"), 'traceModeActive must default to false in App.tsx');
  assert.ok(!appContent.includes("useState(true)"), 'traceModeActive must not default to true in App.tsx');
});

test('18. TopologyCanvas.tsx: Floating Experience Dock and drag handlers are completely removed', () => {
  const canvasContent = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');
  
  assert.ok(!canvasContent.includes("sys_cartography_experience_dock_position"), 'No dock localStorage key');
  assert.ok(!canvasContent.includes("dockPosition"), 'No dock position state');
  assert.ok(!canvasContent.includes("clampDock"), 'No clampDock helper');
  assert.ok(!canvasContent.includes("PROFESSIONAL EXPERIENCE DOCK"), 'No dock markup in canvas');
  assert.ok(!canvasContent.includes("onSelectExperience:"), 'onSelectExperience prop removed from TopologyCanvasProps');
});

test('19. forceLayout.ts: Dead simulation methods are deleted while conduit geometry is preserved', async () => {
  const forceLayoutModule = await import('../src/utils/forceLayout.ts');
  const forceLayoutContent = fs.readFileSync(path.resolve('src/utils/forceLayout.ts'), 'utf8');
  
  assert.equal(typeof forceLayoutModule.calculateConduitGeometry, 'function', 'calculateConduitGeometry must be exported');
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
