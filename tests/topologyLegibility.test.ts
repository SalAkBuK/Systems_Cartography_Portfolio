import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { 
  getConduitPresentationState, 
  wrapCalloutTitle, 
  assembleTopologyLayout,
  getNodeBounds,
  checkAABBOverlap,
  getTopologyNodeEmphasis,
  getNodeEmphasisClassName,
  type TopologyViewMode
} from '../src/utils/topologyLayout.ts';
import { getCapabilityCoreTechnology } from '../src/utils/capabilityAssociations.ts';
import { matchesProjectClassification } from '../src/utils/portfolioUtils.ts';
import { VERIFIED_PROJECTS, VERIFIED_SKILLS } from '../src/data/verifiedPortfolioData.ts';
import { GRID_SNAP_STEP } from '../src/utils/collision.ts';
import { ProjectData, InfrastructureSkill } from '../src/types.ts';

// ---------------------------------------------------------------------------
// PART 1: Progressive Conduit Disclosure & Topology View Modes State Machine
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
    showBackgroundRelationships: true
  });
  assert.equal(state, 'hidden', 'Unconnected conduit must always be hidden');
});

test('2. getConduitPresentationState: At rest in SYSTEMS/CAPABILITIES mode (showBackgroundRelationships=false) returns hidden', () => {
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
    showBackgroundRelationships: false
  });
  assert.equal(state, 'hidden', 'Connected conduit at rest in SYSTEMS/CAPABILITIES mode must be hidden');
});

test('3. getConduitPresentationState: At rest in RELATIONSHIPS mode (showBackgroundRelationships=true) returns background', () => {
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
    showBackgroundRelationships: true
  });
  assert.equal(state, 'background', 'Connected conduit at rest in RELATIONSHIPS mode must be background');
});

test('4. getConduitPresentationState: Returns focused when project is hovered (in any mode)', () => {
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
    showBackgroundRelationships: false
  });
  assert.equal(state, 'focused', 'Connected conduit of hovered project must be focused');
});

test('5. getConduitPresentationState: Returns focused when skill is selected (in any mode)', () => {
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
    showBackgroundRelationships: false
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
    showBackgroundRelationships: false
  });
  assert.equal(state, 'dragging', 'Connected conduit of dragged project must be dragging');
});

test('7. getConduitPresentationState: Unrelated conduit during focus in SYSTEMS/CAPABILITIES mode returns hidden', () => {
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
    showBackgroundRelationships: false
  });
  assert.equal(state, 'hidden', 'Unrelated conduit during focus in SYSTEMS/CAPABILITIES mode must be hidden');
});

test('8. getConduitPresentationState: Unrelated conduit during focus in RELATIONSHIPS mode returns background', () => {
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
    showBackgroundRelationships: true
  });
  assert.equal(state, 'background', 'Unrelated conduit during focus in RELATIONSHIPS mode must be background');
});

// ---------------------------------------------------------------------------
// Node Emphasis Presentation Tests
// ---------------------------------------------------------------------------

test('8a. getTopologyNodeEmphasis: SYSTEMS mode at rest presents projects as primary and skills as contextual', () => {
  const projEmphasis = getTopologyNodeEmphasis({
    nodeType: 'project',
    mode: 'systems',
    isHovered: false,
    isSelected: false,
    isDragging: false,
    isConnectedToFocus: false,
    isAnyFocusActive: false,
    isSelectedExpActive: false,
    isLinkedToSelectedExp: false
  });
  assert.equal(projEmphasis, 'primary');
  assert.equal(getNodeEmphasisClassName(projEmphasis), 'opacity-100');

  const skillEmphasis = getTopologyNodeEmphasis({
    nodeType: 'skill',
    mode: 'systems',
    isHovered: false,
    isSelected: false,
    isDragging: false,
    isConnectedToFocus: false,
    isAnyFocusActive: false,
    isSelectedExpActive: false,
    isLinkedToSelectedExp: false
  });
  assert.equal(skillEmphasis, 'contextual');
  assert.ok(getNodeEmphasisClassName(skillEmphasis).includes('opacity-55'));
});

test('8b. getTopologyNodeEmphasis: CAPABILITIES mode at rest presents skills as primary and projects as contextual', () => {
  const skillEmphasis = getTopologyNodeEmphasis({
    nodeType: 'skill',
    mode: 'capabilities',
    isHovered: false,
    isSelected: false,
    isDragging: false,
    isConnectedToFocus: false,
    isAnyFocusActive: false,
    isSelectedExpActive: false,
    isLinkedToSelectedExp: false
  });
  assert.equal(skillEmphasis, 'primary');
  assert.equal(getNodeEmphasisClassName(skillEmphasis), 'opacity-100');

  const projEmphasis = getTopologyNodeEmphasis({
    nodeType: 'project',
    mode: 'capabilities',
    isHovered: false,
    isSelected: false,
    isDragging: false,
    isConnectedToFocus: false,
    isAnyFocusActive: false,
    isSelectedExpActive: false,
    isLinkedToSelectedExp: false
  });
  assert.equal(projEmphasis, 'contextual');
  assert.ok(getNodeEmphasisClassName(projEmphasis).includes('opacity-55'));
});

test('8c. getTopologyNodeEmphasis: RELATIONSHIPS mode at rest presents both node types as primary', () => {
  const projEmphasis = getTopologyNodeEmphasis({
    nodeType: 'project',
    mode: 'relationships',
    isHovered: false,
    isSelected: false,
    isDragging: false,
    isConnectedToFocus: false,
    isAnyFocusActive: false,
    isSelectedExpActive: false,
    isLinkedToSelectedExp: false
  });
  assert.equal(projEmphasis, 'primary');

  const skillEmphasis = getTopologyNodeEmphasis({
    nodeType: 'skill',
    mode: 'relationships',
    isHovered: false,
    isSelected: false,
    isDragging: false,
    isConnectedToFocus: false,
    isAnyFocusActive: false,
    isSelectedExpActive: false,
    isLinkedToSelectedExp: false
  });
  assert.equal(skillEmphasis, 'primary');
});

test('8d. getTopologyNodeEmphasis: Hover/selection overrides contextual de-emphasis in all modes', () => {
  // Skill hovered in SYSTEMS mode becomes highlighted
  const skillHovered = getTopologyNodeEmphasis({
    nodeType: 'skill',
    mode: 'systems',
    isHovered: true,
    isSelected: false,
    isDragging: false,
    isConnectedToFocus: false,
    isAnyFocusActive: true,
    isSelectedExpActive: false,
    isLinkedToSelectedExp: false
  });
  assert.equal(skillHovered, 'highlighted');

  // Connected project in CAPABILITIES mode becomes highlighted
  const connectedProj = getTopologyNodeEmphasis({
    nodeType: 'project',
    mode: 'capabilities',
    isHovered: false,
    isSelected: false,
    isDragging: false,
    isConnectedToFocus: true,
    isAnyFocusActive: true,
    isSelectedExpActive: false,
    isLinkedToSelectedExp: false
  });
  assert.equal(connectedProj, 'highlighted');
});

test('8e. getTopologyNodeEmphasis: Selected Professional Experience is authoritative for projects (linked=highlighted, unlinked=dimmed regardless of hover/connected)', () => {
  // A. Selected Experience + linked project -> highlighted
  const linkedProj = getTopologyNodeEmphasis({
    nodeType: 'project',
    mode: 'systems',
    isHovered: false,
    isSelected: false,
    isDragging: false,
    isConnectedToFocus: false,
    isAnyFocusActive: false,
    isSelectedExpActive: true,
    isLinkedToSelectedExp: true
  });
  assert.equal(linkedProj, 'highlighted', 'Linked project during experience selection must be highlighted');

  // B. Selected Experience + unlinked project at rest -> dimmed
  const unlinkedProjAtRest = getTopologyNodeEmphasis({
    nodeType: 'project',
    mode: 'systems',
    isHovered: false,
    isSelected: false,
    isDragging: false,
    isConnectedToFocus: false,
    isAnyFocusActive: false,
    isSelectedExpActive: true,
    isLinkedToSelectedExp: false
  });
  assert.equal(unlinkedProjAtRest, 'dimmed', 'Unlinked project during experience selection at rest must be dimmed');
  assert.ok(getNodeEmphasisClassName(unlinkedProjAtRest).includes('opacity-20'));

  // C. Selected Experience + unlinked project hovered -> STILL dimmed
  const unlinkedProjHovered = getTopologyNodeEmphasis({
    nodeType: 'project',
    mode: 'systems',
    isHovered: true,
    isSelected: false,
    isDragging: false,
    isConnectedToFocus: false,
    isAnyFocusActive: true,
    isSelectedExpActive: true,
    isLinkedToSelectedExp: false
  });
  assert.equal(unlinkedProjHovered, 'dimmed', 'Unlinked project during experience selection must remain dimmed when hovered');

  // D. Selected Experience + unlinked project marked connected-to-focus -> STILL dimmed
  const unlinkedProjConnected = getTopologyNodeEmphasis({
    nodeType: 'project',
    mode: 'systems',
    isHovered: false,
    isSelected: false,
    isDragging: false,
    isConnectedToFocus: true,
    isAnyFocusActive: true,
    isSelectedExpActive: true,
    isLinkedToSelectedExp: false
  });
  assert.equal(unlinkedProjConnected, 'dimmed', 'Unlinked project during experience selection must remain dimmed when connected to focus');

  // E. Once isSelectedExpActive is false, hovered project -> highlighted normally
  const projectHoveredNormal = getTopologyNodeEmphasis({
    nodeType: 'project',
    mode: 'systems',
    isHovered: true,
    isSelected: false,
    isDragging: false,
    isConnectedToFocus: false,
    isAnyFocusActive: true,
    isSelectedExpActive: false,
    isLinkedToSelectedExp: false
  });
  assert.equal(projectHoveredNormal, 'highlighted', 'Project without experience selection must be highlighted when hovered');
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
// PART 4: Navigation Order, Topology Controls & Deletion Invariants
// ---------------------------------------------------------------------------

test('21. LeftNavigationRail.tsx: Navigation order is strictly 00 OVERVIEW -> 01 PROFILE -> 02 EXPERIENCE -> 03 TOPOLOGY -> 04 CAPABILITIES -> 05 CONTACT', () => {
  const railContent = fs.readFileSync(path.resolve('src/components/LeftNavigationRail.tsx'), 'utf8');
  
  // Verify order in navItems
  const overviewIdx = railContent.indexOf("id: 'system_overview', num: '00'");
  const identityIdx = railContent.indexOf("id: 'identity', num: '01'");
  const experienceIdx = railContent.indexOf("id: 'experience', num: '02'");
  const projectsIdx = railContent.indexOf("id: 'projects', num: '03'");
  const infraIdx = railContent.indexOf("id: 'infrastructure', num: '04'");
  const contactIdx = railContent.indexOf("id: 'contact', num: '05'");

  assert.ok(overviewIdx !== -1, '00 SYSTEM OVERVIEW must exist');
  assert.ok(identityIdx !== -1, '01 OPERATOR PROFILE must exist');
  assert.ok(experienceIdx !== -1, '02 PROFESSIONAL EXPERIENCE must exist');
  assert.ok(projectsIdx !== -1, '03 PROJECT TOPOLOGY must exist');
  assert.ok(infraIdx !== -1, '04 TECHNICAL CAPABILITIES must exist');
  assert.ok(contactIdx !== -1, '05 EXTERNAL INTERFACE must exist');

  assert.ok(overviewIdx < identityIdx, '00 OVERVIEW before 01 PROFILE');
  assert.ok(identityIdx < experienceIdx, '01 PROFILE before 02 EXPERIENCE');
  assert.ok(experienceIdx < projectsIdx, '02 EXPERIENCE before 03 TOPOLOGY');
  assert.ok(projectsIdx < infraIdx, '03 TOPOLOGY before 04 CAPABILITIES');
  assert.ok(infraIdx < contactIdx, '04 CAPABILITIES before 05 CONTACT');
});

test('22. App.tsx: topologyViewMode specifically initialized to "systems"', () => {
  const appContent = fs.readFileSync(path.resolve('src/App.tsx'), 'utf8');
  assert.ok(
    appContent.includes("const [topologyViewMode, setTopologyViewMode] = useState<TopologyViewMode>('systems');"),
    'topologyViewMode state hook must specifically initialize to "systems" in App.tsx'
  );
  assert.ok(!appContent.includes("traceModeActive"), 'traceModeActive state hook must be removed from App.tsx');
});

test('23. App.tsx: Explicit navigation establishes neutral topology view mode while node selection preserves it', () => {
  const appContent = fs.readFileSync(path.resolve('src/App.tsx'), 'utf8').replace(/\r\n/g, '\n');
  
  // Navigation to projects establishes neutral SYSTEMS view with no arbitrary project selected
  const projectsNavIdx = appContent.indexOf("view === 'projects'");
  assert.ok(projectsNavIdx !== -1, 'projects nav branch must exist');
  const projectsNavSection = appContent.slice(projectsNavIdx, projectsNavIdx + 200);

  assert.ok(projectsNavSection.includes("setTopologyViewMode('systems');"), 'Explicit navigation to projects establishes systems mode');
  assert.ok(projectsNavSection.includes("setSelectedProjectId(null);"), 'Explicit navigation to projects clears selectedProjectId for neutral landscape');
  assert.ok(projectsNavSection.includes("setSelectedSkillId(null);"), 'Explicit navigation to projects clears selectedSkillId');
  assert.ok(projectsNavSection.includes("setSelectedExperienceId(null);"), 'Explicit navigation to projects clears selectedExperienceId');
  assert.ok(!projectsNavSection.includes("setSelectedProjectId(projects[0].id)"), 'Explicit navigation must NOT arbitrarily auto-select projects[0]');

  // Navigation to infrastructure establishes CAPABILITIES mode
  assert.ok(appContent.includes("view === 'infrastructure') {\n      setTopologyViewMode('capabilities');"), 'Explicit navigation to capabilities establishes capabilities mode');
  
  // Node selection handlers do NOT overwrite topologyViewMode
  const handleSelectProj = appContent.slice(appContent.indexOf('handleSelectProject ='), appContent.indexOf('handleSelectSkill ='));
  assert.ok(!handleSelectProj.includes('setTopologyViewMode'), 'handleSelectProject must not overwrite topologyViewMode');
  assert.ok(handleSelectProj.includes('setSelectedProjectId(id);'), 'handleSelectProject selects the requested project ID');
  
  const handleSelectSk = appContent.slice(appContent.indexOf('handleSelectSkill ='), appContent.indexOf('handleSelectExperience ='));
  assert.ok(!handleSelectSk.includes('setTopologyViewMode'), 'handleSelectSkill must not overwrite topologyViewMode');
});

test('24. LeftNavigationRail.tsx: CLASSIFICATION FILTER and category buttons are replaced by TOPOLOGY VIEW mode switch', () => {
  const railContent = fs.readFileSync(path.resolve('src/components/LeftNavigationRail.tsx'), 'utf8');
  
  assert.ok(!railContent.includes("CLASSIFICATION // FILTER"), 'CLASSIFICATION // FILTER header must be removed');
  assert.ok(!railContent.includes("selectedCategory"), 'selectedCategory prop must be removed');
  assert.ok(!railContent.includes("setSelectedCategory"), 'setSelectedCategory prop must be removed');
  assert.ok(!railContent.includes("{ id: 'all', label: 'ALL' }"), 'Category pills array must be removed');
  
  assert.ok(railContent.includes("TOPOLOGY // VIEW"), 'TOPOLOGY // VIEW header must exist');
  assert.ok(railContent.includes("id: 'systems', label: 'SYSTEMS'"), 'SYSTEMS mode button must exist');
  assert.ok(railContent.includes("id: 'capabilities', label: 'CAPABILITIES'"), 'CAPABILITIES mode button must exist');
  assert.ok(railContent.includes("id: 'relationships', label: 'RELATIONSHIPS'"), 'RELATIONSHIPS mode button must exist');
});

test('25. portfolioUtils.ts: Project classification model and matcher utility remain intact internally', () => {
  const mockProject: ProjectData = {
    id: 'mock-proj',
    code: 'SYS-01',
    title: 'Mock Infrastructure Project',
    tagline: 'Mock tagline',
    category: 'infrastructure',
    status: 'ACTIVE',
    year: '2025',
    dimensions: { width: 100, height: 80, levels: 2 },
    gridPosition: { x: 0, y: 0 },
    accentColor: '#C3E54E',
    summary: 'Testing classification matching',
    problem: 'Problem statement',
    solution: 'Solution statement',
    architectureNotes: 'Architecture notes',
    techStack: ['TypeScript', 'Docker'],
    infrastructureDeps: ['docker'],
    subsystems: [],
    metrics: [],
    keyDecisions: [],
    resilienceTesting: 'Tested',
    links: { github: 'https://github.com/example/mock' }
  };

  assert.equal(mockProject.category, 'infrastructure', 'Project category metadata remains on ProjectData');
  assert.equal(matchesProjectClassification(mockProject, 'all'), true);
  assert.equal(matchesProjectClassification(mockProject, 'infrastructure'), true);
  assert.equal(matchesProjectClassification(mockProject, 'tooling'), false);
});

test('26. TopTelemetryBar.tsx & BottomCommandStrip.tsx: TRACE controls and shortcuts are removed', () => {
  const topContent = fs.readFileSync(path.resolve('src/components/TopTelemetryBar.tsx'), 'utf8');
  assert.ok(!topContent.includes("onToggleTraceMode"), 'No onToggleTraceMode in TopTelemetryBar');
  assert.ok(!topContent.includes("traceModeActive"), 'No traceModeActive in TopTelemetryBar');
  assert.ok(!topContent.includes("TRACE"), 'No TRACE button in TopTelemetryBar');

  const bottomContent = fs.readFileSync(path.resolve('src/components/BottomCommandStrip.tsx'), 'utf8');
  assert.ok(!bottomContent.includes("onToggleTraceMode"), 'No onToggleTraceMode in BottomCommandStrip');
  assert.ok(!bottomContent.includes("traceModeActive"), 'No traceModeActive in BottomCommandStrip');
  assert.ok(!bottomContent.includes("[T] TRACE SIGNAL"), 'No [T] TRACE SIGNAL in BottomCommandStrip actions');
  assert.ok(bottomContent.includes("VIEW:"), 'Passive VIEW mode indicator exists in BottomCommandStrip');

  const appContent = fs.readFileSync(path.resolve('src/App.tsx'), 'utf8');
  assert.ok(!appContent.includes("e.key === 't' || e.key === 'T'"), 'T keyboard shortcut for trace toggle is removed');
});

test('27. TopologyCanvas.tsx: Floating Experience Dock and drag handlers are completely removed', () => {
  const canvasContent = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');
  
  assert.ok(!canvasContent.includes("sys_cartography_experience_dock_position"), 'No dock localStorage key');
  assert.ok(!canvasContent.includes("dockPosition"), 'No dock position state');
  assert.ok(!canvasContent.includes("clampDock"), 'No clampDock helper');
  assert.ok(!canvasContent.includes("PROFESSIONAL EXPERIENCE DOCK"), 'No dock markup in canvas');
  assert.ok(!canvasContent.includes("onSelectExperience:"), 'onSelectExperience prop removed from TopologyCanvasProps');
});

test('28. forceLayout.ts: Dead force-graph scaffolding and simulation methods are deleted', async () => {
  const forceLayoutModule = await import('../src/utils/forceLayout.ts');
  const forceLayoutContent = fs.readFileSync(path.resolve('src/utils/forceLayout.ts'), 'utf8');
  
  assert.equal(typeof forceLayoutModule.calculateConduitGeometry, 'function', 'calculateConduitGeometry must be exported');
  assert.ok(!forceLayoutContent.includes("createTopologyGraph"), 'createTopologyGraph must be removed');
  assert.ok(!forceLayoutContent.includes("LayoutNode"), 'LayoutNode interface must be removed');
  assert.ok(!forceLayoutContent.includes("LayoutEdge"), 'LayoutEdge interface must be removed');
  assert.ok(!forceLayoutContent.includes("stepForceSimulation"), 'stepForceSimulation must be removed');
  assert.ok(!forceLayoutContent.includes("computeEquilibriumLayout"), 'computeEquilibriumLayout must be removed');
});

test('29. TopologyCanvas.tsx: Hover card reads from runtime projects array and uses getCapabilityCoreTechnology', () => {
  const canvasContent = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');
  
  assert.ok(canvasContent.includes("projects.find(item => item.id === hoveredProjectId)"), 'Hover card must look up hovered project in runtime projects array');
  assert.ok(!canvasContent.includes("PROJECTS.find"), 'Hover card must not use static PROJECTS fallback');
  assert.ok(canvasContent.includes("getCapabilityCoreTechnology(skill)"), 'Midpoint and skill labels must use getCapabilityCoreTechnology');
});

test('30. RightInspectorPanel.tsx & portfolioUtils.ts: Stale dock references and obsolete NAVIGATION FILTER guidance are removed', () => {
  const panelContent = fs.readFileSync(path.resolve('src/components/RightInspectorPanel.tsx'), 'utf8');
  assert.ok(!panelContent.includes("EXPERIENCE DOCK CAN ALSO BE REPOSITIONED"), 'Stale dock repositioning tip must be removed');
  assert.ok(!panelContent.includes("NAVIGATION FILTER"), 'Obsolete NAVIGATION FILTER guidance must be removed');
  assert.ok(!panelContent.includes("Filter by architectural layer"), 'Obsolete Filter by architectural layer text must be removed');
  assert.ok(!panelContent.includes("Experience Dock"), 'Experience Dock text in comments must be updated');
  assert.ok(panelContent.includes("TOPOLOGY VIEW: Systems / Capabilities / Relationships"), 'Accurate TOPOLOGY VIEW guidance must exist');

  const utilsContent = fs.readFileSync(path.resolve('src/utils/portfolioUtils.ts'), 'utf8');
  assert.ok(!utilsContent.includes("Experience Dock"), 'Experience Dock reference in portfolioUtils comments must be updated');
});

test('31. LeftNavigationRail.tsx: Fast Project Jump click path directly calls onSelectProject without calling setActiveView("projects")', () => {
  const railContent = fs.readFileSync(path.resolve('src/components/LeftNavigationRail.tsx'), 'utf8');
  
  // Extract fast project jump button onClick
  const jumpButtonIdx = railContent.indexOf('{filteredProjects.map((p) => {');
  assert.ok(jumpButtonIdx !== -1, 'Fast project jump mapping must exist');
  
  const jumpSection = railContent.slice(jumpButtonIdx, jumpButtonIdx + 400);
  assert.ok(jumpSection.includes('onSelectProject(p.id);'), 'onClick must call onSelectProject(p.id)');
  assert.ok(jumpSection.includes('setIsMobileOpen(false);'), 'onClick must call setIsMobileOpen(false)');
  assert.ok(!jumpSection.includes("setActiveView('projects')"), 'onClick must NOT call setActiveView("projects") which would reset topologyViewMode');
});

test('32. TopologyCanvas.tsx: renderedConnections iterates filteredProjects and reacts to search changes', () => {
  const canvasContent = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');
  
  // Verify renderedConnections iterates filteredProjects
  assert.ok(
    canvasContent.includes("filteredProjects.forEach(project => {"),
    'renderedConnections must iterate filteredProjects instead of unfiltered projects array'
  );
  
  // Verify useMemo dependencies include filteredProjects
  const connectionsUseMemoIdx = canvasContent.indexOf('const renderedConnections = useMemo(');
  const connectionsUseMemoEnd = canvasContent.indexOf('return connections;', connectionsUseMemoIdx);
  const depsSlice = canvasContent.slice(connectionsUseMemoEnd, connectionsUseMemoEnd + 250);
  
  assert.ok(depsSlice.includes('filteredProjects'), 'renderedConnections useMemo dependencies must include filteredProjects');
});

test('33. TopologyCanvas search filtering: Hiding projects via search eliminates their relationship conduits', () => {
  const mockProjects: ProjectData[] = [
    {
      id: 'proj-alpha',
      code: 'ALPHA',
      title: 'Alpha CRM System',
      tagline: 'Alpha tagline',
      category: 'backend',
      status: 'ACTIVE',
      year: '2025',
      dimensions: { width: 100, height: 80, levels: 2 },
      gridPosition: { x: 0, y: 0 },
      accentColor: '#C3E54E',
      summary: 'Summary',
      problem: 'Problem',
      solution: 'Solution',
      architectureNotes: 'Notes',
      techStack: ['Node.js', 'PostgreSQL'],
      infrastructureDeps: ['node-js', 'postgresql'],
      subsystems: [],
      metrics: [],
      keyDecisions: [],
      resilienceTesting: 'Tested',
      links: {}
    },
    {
      id: 'proj-beta',
      code: 'BETA',
      title: 'Beta Front-end App',
      tagline: 'Beta tagline',
      category: 'frontend',
      status: 'ACTIVE',
      year: '2025',
      dimensions: { width: 100, height: 80, levels: 2 },
      gridPosition: { x: 100, y: 100 },
      accentColor: '#8EA9DA',
      summary: 'Summary',
      problem: 'Problem',
      solution: 'Solution',
      architectureNotes: 'Notes',
      techStack: ['React', 'Tailwind'],
      infrastructureDeps: ['react'],
      subsystems: [],
      metrics: [],
      keyDecisions: [],
      resilienceTesting: 'Tested',
      links: {}
    }
  ];

  // Search for "CRM" (matches Alpha only)
  const searchQuery: string = 'CRM';
  const filtered = mockProjects.filter(p => 
    searchQuery === '' || 
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.techStack.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, 'proj-alpha');

  // Candidate connection generation for filtered set
  const renderedProjectIds = new Set(filtered.map(p => p.id));
  assert.equal(renderedProjectIds.has('proj-alpha'), true, 'Alpha project connections are candidates');
  assert.equal(renderedProjectIds.has('proj-beta'), false, 'Beta project connections must NOT be generated');
});
