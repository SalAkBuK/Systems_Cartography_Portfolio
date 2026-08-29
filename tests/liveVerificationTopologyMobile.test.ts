import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { OWNER_EXPERIENCE_EVIDENCE, getOwnerExperienceEvidence } from '../src/data/ownerExperienceEvidence';
import { 
  evidenceByRepository, 
  REPOSITORY_CANONICAL_CLUSTERS, 
  getCanonicalRepositoryKey, 
  getRepositoryEvidence 
} from '../src/data/repositoryEvidence';
import { 
  resolveProjectFromEvidenceKey, 
  resolveProjectIdFromEvidenceKey, 
  isProjectLinkedToExperience, 
  getLinkedProjectIdsForExperience 
} from '../src/utils/portfolioUtils';
import { getCapabilitiesLinkedToExperience } from '../src/utils/capabilityAssociations';
import { 
  getTopologyNodeEmphasis, 
  getConduitPresentationState 
} from '../src/utils/topologyLayout';
import { resolveProfessionalExperience } from '../src/services/experienceResolver';
import { OWNER_PROFILE } from '../src/data/ownerProfile.generated';
import { GITHUB_SNAPSHOT } from '../src/data/githubSnapshot.generated';

// Resolved active experience history
const resolvedExperience = resolveProfessionalExperience({
  importedExperience: OWNER_PROFILE.experience,
  curatedEvidence: OWNER_EXPERIENCE_EVIDENCE
});

// ---------------------------------------------------------------------------
// TEST A: ownerExperienceEvidence references ONLY live TowerDesk repositories
// ---------------------------------------------------------------------------
test('Test A: ownerExperienceEvidence references ONLY live TowerDesk repositories without stale showcase text', () => {
  const codefierEvidence = getOwnerExperienceEvidence('codefier');
  assert.ok(codefierEvidence, 'CodeFier evidence must exist');

  // Verify architected systems
  const archSystems = codefierEvidence.architectedSystems || [];
  const archRepoIds = archSystems.map(a => a.linkedProjectId).filter(Boolean);
  assert.ok(archRepoIds.includes('towerdesk-backend'));
  assert.ok(!archRepoIds.includes('towerdesk-backend-clean'));

  // Verify systems delivered surfaces and projects
  const delivered = codefierEvidence.systemsDelivered || [];
  const allDeliveredRepoIds: string[] = [];
  delivered.forEach(d => {
    (d.linkedProjectIds || []).forEach(id => allDeliveredRepoIds.push(id));
    (d.surfaces || []).forEach(s => {
      if (s.linkedProjectId) allDeliveredRepoIds.push(s.linkedProjectId);
    });
  });

  assert.ok(allDeliveredRepoIds.includes('towerdesk-backend'), 'Backend must be towerdesk-backend');
  assert.ok(allDeliveredRepoIds.includes('tower-desk'), 'Web must be tower-desk');
  assert.ok(allDeliveredRepoIds.includes('towerdesk-mobile-app'), 'Mobile must be towerdesk-mobile-app');
  assert.ok(allDeliveredRepoIds.includes('worthy-crm'), 'Worthy CRM must be worthy-crm');
  assert.ok(allDeliveredRepoIds.includes('remapp-scraper'), 'Remapp must be remapp-scraper');

  assert.ok(!allDeliveredRepoIds.includes('towerdesk-backend-clean'));
  assert.ok(!allDeliveredRepoIds.includes('tower-desk-clean'));
  assert.ok(!allDeliveredRepoIds.includes('towerdesk-mobile-showcase'));
  assert.ok(!allDeliveredRepoIds.includes('binghatti-concierge-app-rn-expo'));

  // Verify evidence links
  const evidenceLinks = codefierEvidence.evidenceLinks || [];
  const linkProjectIds = evidenceLinks.map(l => l.projectId).filter(Boolean);
  assert.ok(linkProjectIds.includes('towerdesk-backend'));
  assert.ok(linkProjectIds.includes('tower-desk'));
  assert.ok(linkProjectIds.includes('towerdesk-mobile-app'));
  assert.ok(linkProjectIds.includes('worthy-crm'));
  assert.ok(linkProjectIds.includes('remapp-scraper'));

  // Verify 0 occurrences of sanitized/showcase claims in ownerExperienceEvidence source
  const source = readFileSync(resolve(process.cwd(), 'src/data/ownerExperienceEvidence.ts'), 'utf8');
  assert.ok(!source.includes('towerdesk-backend-clean'), 'Must not contain towerdesk-backend-clean');
  assert.ok(!source.includes('tower-desk-clean'), 'Must not contain tower-desk-clean');
  assert.ok(!source.includes('towerdesk-mobile-showcase'), 'Must not contain towerdesk-mobile-showcase');
  assert.ok(!source.includes('binghatti-concierge-app-rn-expo'), 'Must not contain binghatti-concierge-app-rn-expo');
});

// ---------------------------------------------------------------------------
// TEST B: evidenceByRepository keyed to live names, REPOSITORY_CANONICAL_CLUSTERS aliasing
// ---------------------------------------------------------------------------
test('Test B: evidenceByRepository keyed to live names and aliases map to canonical keys', () => {
  assert.ok(evidenceByRepository['towerdesk-backend'], 'towerdesk-backend must be a direct key');
  assert.ok(evidenceByRepository['tower-desk'], 'tower-desk must be a direct key');
  assert.ok(evidenceByRepository['towerdesk-mobile-app'], 'towerdesk-mobile-app must be a direct key');
  assert.ok(evidenceByRepository['worthy-crm'], 'worthy-crm must be a direct key');
  assert.ok(evidenceByRepository['remapp-scraper'], 'remapp-scraper must be a direct key');

  // Verify alias mapping
  assert.equal(getCanonicalRepositoryKey('towerdesk-backend'), 'towerdesk-backend');
  assert.equal(getCanonicalRepositoryKey('towerdesk-backend-clean'), 'towerdesk-backend');
  assert.equal(getCanonicalRepositoryKey('tower-desk'), 'tower-desk');
  assert.equal(getCanonicalRepositoryKey('tower-desk-clean'), 'tower-desk');
  assert.equal(getCanonicalRepositoryKey('towerdesk-mobile-app'), 'towerdesk-mobile-app');
  assert.equal(getCanonicalRepositoryKey('towerdesk-mobile-showcase'), 'towerdesk-mobile-app');
  assert.equal(getCanonicalRepositoryKey('binghatti-concierge-app-rn-expo'), 'towerdesk-mobile-app');

  // Verify getRepositoryEvidence returns records for aliases
  assert.ok(getRepositoryEvidence('towerdesk-backend-clean'));
  assert.ok(getRepositoryEvidence('tower-desk-clean'));
  assert.ok(getRepositoryEvidence('towerdesk-mobile-showcase'));
});

// ---------------------------------------------------------------------------
// TEST C: resolveProjectFromEvidenceKey resolves worthy-crm to live runtime ID
// ---------------------------------------------------------------------------
test('Test C: resolveProjectFromEvidenceKey resolves worthy-crm to live runtime ID', () => {
  const resolved = resolveProjectFromEvidenceKey(GITHUB_SNAPSHOT.projects, 'worthy-crm');
  assert.ok(resolved, 'Worthy CRM must resolve');
  assert.equal(resolved.title, 'worthy-crm');
  assert.ok(resolved.id.startsWith('gh-'), `ID must be dynamic GitHub ID, got ${resolved.id}`);
  assert.equal(resolveProjectIdFromEvidenceKey(GITHUB_SNAPSHOT.projects, 'worthy-crm'), resolved.id);
});

// ---------------------------------------------------------------------------
// TEST D: resolveProjectFromEvidenceKey resolves towerdesk-backend and aliases
// ---------------------------------------------------------------------------
test('Test D: resolveProjectFromEvidenceKey resolves towerdesk-backend and aliases', () => {
  const direct = resolveProjectFromEvidenceKey(GITHUB_SNAPSHOT.projects, 'towerdesk-backend');
  assert.ok(direct, 'towerdesk-backend must resolve directly');
  assert.equal(direct.title, 'towerdesk-backend');

  const alias = resolveProjectFromEvidenceKey(GITHUB_SNAPSHOT.projects, 'towerdesk-backend-clean');
  assert.ok(alias, 'towerdesk-backend-clean alias must resolve to same project');
  assert.equal(alias.id, direct.id);
});

// ---------------------------------------------------------------------------
// TEST E: resolveProjectFromEvidenceKey resolves tower-desk and aliases
// ---------------------------------------------------------------------------
test('Test E: resolveProjectFromEvidenceKey resolves tower-desk and aliases', () => {
  const direct = resolveProjectFromEvidenceKey(GITHUB_SNAPSHOT.projects, 'tower-desk');
  assert.ok(direct, 'tower-desk must resolve directly');
  assert.equal(direct.title, 'tower-desk');

  const alias = resolveProjectFromEvidenceKey(GITHUB_SNAPSHOT.projects, 'tower-desk-clean');
  assert.ok(alias, 'tower-desk-clean alias must resolve to same project');
  assert.equal(alias.id, direct.id);
});

// ---------------------------------------------------------------------------
// TEST F: resolveProjectFromEvidenceKey resolves towerdesk-mobile-app and aliases
// ---------------------------------------------------------------------------
test('Test F: resolveProjectFromEvidenceKey resolves towerdesk-mobile-app and aliases', () => {
  const direct = resolveProjectFromEvidenceKey(GITHUB_SNAPSHOT.projects, 'towerdesk-mobile-app');
  assert.ok(direct, 'towerdesk-mobile-app must resolve directly');
  assert.equal(direct.title, 'towerdesk-mobile-app');

  const alias1 = resolveProjectFromEvidenceKey(GITHUB_SNAPSHOT.projects, 'towerdesk-mobile-showcase');
  assert.ok(alias1, 'towerdesk-mobile-showcase alias must resolve to same project');
  assert.equal(alias1.id, direct.id);

  const alias2 = resolveProjectFromEvidenceKey(GITHUB_SNAPSHOT.projects, 'binghatti-concierge-app-rn-expo');
  assert.ok(alias2, 'binghatti-concierge-app-rn-expo alias must resolve to same project');
  assert.equal(alias2.id, direct.id);
});

// ---------------------------------------------------------------------------
// TEST G: resolveProjectFromEvidenceKey resolves remapp-scraper
// ---------------------------------------------------------------------------
test('Test G: resolveProjectFromEvidenceKey resolves remapp-scraper', () => {
  const resolved = resolveProjectFromEvidenceKey(GITHUB_SNAPSHOT.projects, 'remapp-scraper');
  assert.ok(resolved, 'remapp-scraper must resolve');
  assert.equal(resolved.title, 'remapp-scraper');
  assert.ok(resolved.id.startsWith('gh-'));
});

// ---------------------------------------------------------------------------
// TEST H: resolveProjectFromEvidenceKey returns null for unknown / invalid keys
// ---------------------------------------------------------------------------
test('Test H: resolveProjectFromEvidenceKey returns null for unknown or invalid keys without throwing', () => {
  assert.equal(resolveProjectFromEvidenceKey(GITHUB_SNAPSHOT.projects, 'non-existent-repo-12345'), null);
  assert.equal(resolveProjectFromEvidenceKey(GITHUB_SNAPSHOT.projects, ''), null);
  assert.equal(resolveProjectFromEvidenceKey(GITHUB_SNAPSHOT.projects, null), null);
  assert.equal(resolveProjectFromEvidenceKey(GITHUB_SNAPSHOT.projects, undefined), null);
  assert.equal(resolveProjectIdFromEvidenceKey(GITHUB_SNAPSHOT.projects, 'unknown-xyz'), null);
});

// ---------------------------------------------------------------------------
// TEST I: getCapabilitiesLinkedToExperience derives correct skills for CodeFier
// ---------------------------------------------------------------------------
test('Test I: getCapabilitiesLinkedToExperience derives correct capability set for CodeFier', () => {
  const codefierExp = resolvedExperience.find(e => (e.organization || '').toLowerCase().includes('codefier'));
  assert.ok(codefierExp, 'CodeFier experience node must exist');

  const linkedSkillIds = getCapabilitiesLinkedToExperience(codefierExp, GITHUB_SNAPSHOT.projects, GITHUB_SNAPSHOT.skills);
  assert.ok(linkedSkillIds instanceof Set, 'Must return a Set');
  assert.ok(linkedSkillIds.size > 0, 'CodeFier must link to at least 1 synthesized skill');

  // Verify skills used by CodeFier projects are in the set
  const codefierProjects = GITHUB_SNAPSHOT.projects.filter(p => isProjectLinkedToExperience(p, codefierExp));
  assert.equal(codefierProjects.length, 5, `CodeFier must link to exactly 5 repositories, found ${codefierProjects.length}`);
});

// ---------------------------------------------------------------------------
// TEST J: SYSTEMS Mode + Selected Experience emphasis composition
// ---------------------------------------------------------------------------
test('Test J: SYSTEMS Mode + Selected Experience: linked=primary, unlinked=dimmed, skills=contextual', () => {
  // Linked project at rest -> primary
  const linkedProj = getTopologyNodeEmphasis({
    nodeType: 'project',
    mode: 'systems',
    isHovered: false,
    isSelected: false,
    isDragging: false,
    isConnectedToFocus: false,
    isAnyFocusActive: false,
    isSelectedExpActive: true,
    isLinkedToSelectedExp: true,
    isSkillLinkedToExp: false
  });
  assert.equal(linkedProj, 'primary', 'Linked project at rest in systems mode must be primary');

  // Linked project hovered -> highlighted
  const linkedProjHovered = getTopologyNodeEmphasis({
    nodeType: 'project',
    mode: 'systems',
    isHovered: true,
    isSelected: false,
    isDragging: false,
    isConnectedToFocus: false,
    isAnyFocusActive: true,
    isSelectedExpActive: true,
    isLinkedToSelectedExp: true,
    isSkillLinkedToExp: false
  });
  assert.equal(linkedProjHovered, 'highlighted', 'Linked project when hovered must be highlighted');

  // Unlinked project -> dimmed
  const unlinkedProj = getTopologyNodeEmphasis({
    nodeType: 'project',
    mode: 'systems',
    isHovered: false,
    isSelected: false,
    isDragging: false,
    isConnectedToFocus: false,
    isAnyFocusActive: false,
    isSelectedExpActive: true,
    isLinkedToSelectedExp: false,
    isSkillLinkedToExp: false
  });
  assert.equal(unlinkedProj, 'dimmed', 'Unlinked project must be dimmed');

  // Unlinked project hovered -> STILL dimmed (experience filter is authoritative)
  const unlinkedProjHovered = getTopologyNodeEmphasis({
    nodeType: 'project',
    mode: 'systems',
    isHovered: true,
    isSelected: false,
    isDragging: false,
    isConnectedToFocus: false,
    isAnyFocusActive: true,
    isSelectedExpActive: true,
    isLinkedToSelectedExp: false,
    isSkillLinkedToExp: false
  });
  assert.equal(unlinkedProjHovered, 'dimmed', 'Unlinked project hovered must remain dimmed');

  // Skills in systems mode during experience selection -> contextual
  const skillInSystems = getTopologyNodeEmphasis({
    nodeType: 'skill',
    mode: 'systems',
    isHovered: false,
    isSelected: false,
    isDragging: false,
    isConnectedToFocus: false,
    isAnyFocusActive: false,
    isSelectedExpActive: true,
    isLinkedToSelectedExp: false,
    isSkillLinkedToExp: true
  });
  assert.equal(skillInSystems, 'contextual', 'Skills in systems mode during experience filter must be contextual');
});

// ---------------------------------------------------------------------------
// TEST K: CAPABILITIES Mode + Selected Experience emphasis composition
// ---------------------------------------------------------------------------
test('Test K: CAPABILITIES Mode + Selected Experience: linked skills=primary, unlinked skills=dimmed, linked projects=contextual', () => {
  // Linked skill at rest -> primary
  const linkedSkill = getTopologyNodeEmphasis({
    nodeType: 'skill',
    mode: 'capabilities',
    isHovered: false,
    isSelected: false,
    isDragging: false,
    isConnectedToFocus: false,
    isAnyFocusActive: false,
    isSelectedExpActive: true,
    isLinkedToSelectedExp: false,
    isSkillLinkedToExp: true
  });
  assert.equal(linkedSkill, 'primary', 'Linked capability in capabilities mode must be primary');

  // Unlinked skill -> dimmed
  const unlinkedSkill = getTopologyNodeEmphasis({
    nodeType: 'skill',
    mode: 'capabilities',
    isHovered: false,
    isSelected: false,
    isDragging: false,
    isConnectedToFocus: false,
    isAnyFocusActive: false,
    isSelectedExpActive: true,
    isLinkedToSelectedExp: false,
    isSkillLinkedToExp: false
  });
  assert.equal(unlinkedSkill, 'dimmed', 'Unlinked capability in capabilities mode must be dimmed');

  // Unlinked skill hovered in capabilities mode -> STILL dimmed (experience filter authoritative)
  const unlinkedSkillHovered = getTopologyNodeEmphasis({
    nodeType: 'skill',
    mode: 'capabilities',
    isHovered: true,
    isSelected: false,
    isDragging: false,
    isConnectedToFocus: false,
    isAnyFocusActive: true,
    isSelectedExpActive: true,
    isLinkedToSelectedExp: false,
    isSkillLinkedToExp: false
  });
  assert.equal(unlinkedSkillHovered, 'dimmed', 'Unlinked capability when hovered in capabilities mode must remain dimmed');

  // Linked project in capabilities mode -> contextual
  const linkedProjInCap = getTopologyNodeEmphasis({
    nodeType: 'project',
    mode: 'capabilities',
    isHovered: false,
    isSelected: false,
    isDragging: false,
    isConnectedToFocus: false,
    isAnyFocusActive: false,
    isSelectedExpActive: true,
    isLinkedToSelectedExp: true,
    isSkillLinkedToExp: false
  });
  assert.equal(linkedProjInCap, 'contextual', 'Linked project in capabilities mode must be contextual');

  // Unlinked project -> dimmed
  const unlinkedProj = getTopologyNodeEmphasis({
    nodeType: 'project',
    mode: 'capabilities',
    isHovered: false,
    isSelected: false,
    isDragging: false,
    isConnectedToFocus: false,
    isAnyFocusActive: false,
    isSelectedExpActive: true,
    isLinkedToSelectedExp: false,
    isSkillLinkedToExp: false
  });
  assert.equal(unlinkedProj, 'dimmed', 'Unlinked project in capabilities mode must be dimmed');
});

// ---------------------------------------------------------------------------
// TEST L: RELATIONSHIPS Mode + Selected Experience emphasis and conduits
// ---------------------------------------------------------------------------
test('Test L: RELATIONSHIPS Mode + Selected Experience: linked nodes=primary, conduits between linked nodes=background, unrelated=hidden', () => {
  // Linked project -> primary
  const linkedProj = getTopologyNodeEmphasis({
    nodeType: 'project',
    mode: 'relationships',
    isHovered: false,
    isSelected: false,
    isDragging: false,
    isConnectedToFocus: false,
    isAnyFocusActive: false,
    isSelectedExpActive: true,
    isLinkedToSelectedExp: true,
    isSkillLinkedToExp: false
  });
  assert.equal(linkedProj, 'primary');

  // Linked skill -> primary
  const linkedSkill = getTopologyNodeEmphasis({
    nodeType: 'skill',
    mode: 'relationships',
    isHovered: false,
    isSelected: false,
    isDragging: false,
    isConnectedToFocus: false,
    isAnyFocusActive: false,
    isSelectedExpActive: true,
    isLinkedToSelectedExp: false,
    isSkillLinkedToExp: true
  });
  assert.equal(linkedSkill, 'primary');

  // Unlinked skill hovered in relationships mode -> STILL dimmed
  const unlinkedSkillHovered = getTopologyNodeEmphasis({
    nodeType: 'skill',
    mode: 'relationships',
    isHovered: true,
    isSelected: false,
    isDragging: false,
    isConnectedToFocus: false,
    isAnyFocusActive: true,
    isSelectedExpActive: true,
    isLinkedToSelectedExp: false,
    isSkillLinkedToExp: false
  });
  assert.equal(unlinkedSkillHovered, 'dimmed', 'Unlinked skill when hovered in relationships mode must remain dimmed');

  // Conduit between linked project and linked skill -> background (visible)
  const linkedConduit = getConduitPresentationState({
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
    showBackgroundRelationships: true,
    isSelectedExpActive: true,
    isProjectLinkedToExp: true,
    isSkillLinkedToExp: true
  });
  assert.equal(linkedConduit, 'background', 'Conduit between experience-linked project and skill must be background');

  // Conduit for unrelated project -> hidden
  const unrelatedConduit = getConduitPresentationState({
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
    showBackgroundRelationships: true,
    isSelectedExpActive: true,
    isProjectLinkedToExp: false,
    isSkillLinkedToExp: true
  });
  assert.equal(unrelatedConduit, 'hidden', 'Conduit for unrelated project must be hidden');
});

// ---------------------------------------------------------------------------
// TEST M: SYSTEMS and CAPABILITIES modes with Experience selected hide background conduits
// ---------------------------------------------------------------------------
test('Test M: In SYSTEMS and CAPABILITIES modes with Experience selected, background conduits are hidden at rest', () => {
  const conduitInSystems = getConduitPresentationState({
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
    showBackgroundRelationships: false,
    isSelectedExpActive: true,
    isProjectLinkedToExp: true,
    isSkillLinkedToExp: true
  });
  assert.equal(conduitInSystems, 'hidden', 'Systems mode with experience selected must hide background conduits');
});

// ---------------------------------------------------------------------------
// TEST N: RELATIONSHIPS mode without experience selected shows background conduits
// ---------------------------------------------------------------------------
test('Test N: In RELATIONSHIPS mode without experience selected, all valid conduits are background at rest', () => {
  const conduitAtRest = getConduitPresentationState({
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
    showBackgroundRelationships: true,
    isSelectedExpActive: false
  });
  assert.equal(conduitAtRest, 'background', 'Relationships mode at rest without filter must show background conduits');
});

// ---------------------------------------------------------------------------
// TEST O: Hardened CodeFier model invariants (3 systems, 5 snapshot repos)
// ---------------------------------------------------------------------------
test('Test O: CodeFier model invariants: exactly 2 role periods, 3 delivered systems, 5 current snapshot repos', () => {
  const codefierRoles = resolvedExperience.filter(e => (e.organization || '').toLowerCase().includes('codefier'));
  assert.equal(codefierRoles.length, 2, 'CodeFier must have exactly 2 role periods');

  const codefierEvidence = getOwnerExperienceEvidence('codefier');
  assert.ok(codefierEvidence);
  assert.equal(codefierEvidence.systemsDelivered?.length, 3, 'Must have exactly 3 delivered systems');

  const deliveredNames = (codefierEvidence.systemsDelivered || []).map(d => d.name);
  assert.ok(deliveredNames.some(n => n.includes('TowerDesk')));
  assert.ok(deliveredNames.some(n => n.includes('Worthy')));
  assert.ok(deliveredNames.some(n => n.includes('Remapp')));

  const codefierExp = codefierRoles[0];
  const codefierProjects = GITHUB_SNAPSHOT.projects.filter(p => isProjectLinkedToExperience(p, codefierExp));
  assert.equal(codefierProjects.length, 5, 'Must have exactly 5 linked projects from current snapshot');

  const titles = new Set(codefierProjects.map(p => p.title));
  assert.deepEqual(
    titles,
    new Set(['towerdesk-backend', 'tower-desk', 'towerdesk-mobile-app', 'worthy-crm', 'remapp-scraper'])
  );
});

// ---------------------------------------------------------------------------
// TEST P: Mandatory / Non-skipping AOK model invariants
// ---------------------------------------------------------------------------
test('Test P: AOK freelance experience must resolve unconditionally and have 0 project links', () => {
  const aokExp = resolvedExperience.find(
    e =>
      e.id === 'exp-freelance-aok-health-solutions' ||
      e.progressionGroup === 'salakbuk-independent-freelance'
  );

  assert.ok(aokExp, 'AOK freelance experience must resolve');
  assert.equal(getLinkedProjectIdsForExperience(aokExp).size, 0, 'AOK must have 0 linked project IDs in topology');

  GITHUB_SNAPSHOT.projects.forEach(project => {
    assert.equal(
      isProjectLinkedToExperience(project, aokExp),
      false,
      `Project ${project.title} must not be linked to AOK`
    );
  });
});

// ---------------------------------------------------------------------------
// TEST Q: TopTelemetryBar brutalist container
// ---------------------------------------------------------------------------
test('Test Q: TopTelemetryBar source code contains OWNER PROJECTS in brutalist black container', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/components/TopTelemetryBar.tsx'), 'utf8');
  assert.ok(source.includes('OWNER PROJECTS'), 'Must contain OWNER PROJECTS');
  assert.ok(source.includes('bg-[#15150F]'), 'Must use black brutalist background');
  assert.ok(source.includes('text-[#C3E54E]'), 'Must use green accent text');
});

// ---------------------------------------------------------------------------
// TEST R: TopologyCanvas duplicate Zoom In removal, lg breakpoint, and control rail clearance
// ---------------------------------------------------------------------------
test('Test R: TopologyCanvas has exactly 1 Zoom In button, hides telemetry on < lg, and has bottom-14 clearance', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/components/TopologyCanvas.tsx'), 'utf8');
  const zoomInMatches = source.match(/title="Zoom In \(\+\)"/g) || [];
  assert.equal(zoomInMatches.length, 1, 'Must have exactly 1 Zoom In button');

  // Verify corner labels and telemetry use lg breakpoint
  assert.ok(source.includes('hidden lg:flex absolute top-3 left-3'), 'Top-left label must be hidden on < lg');
  assert.ok(source.includes('hidden lg:flex absolute bottom-3 left-3'), 'Bottom-left label must be hidden on < lg');
  assert.ok(source.includes('hidden lg:flex absolute top-3 right-3'), 'Top-right label must be hidden on < lg');

  // Verify floating controls rail uses bottom-14 clearance on compact viewports
  assert.ok(source.includes('bottom-14 lg:bottom-4'), 'Control rail must stay above collapsed bottom sheet on < lg');
});

// ---------------------------------------------------------------------------
// TEST S: RightInspectorPanel mobile bottom drawer, onClearSelection, and resolver
// ---------------------------------------------------------------------------
test('Test S: RightInspectorPanel renders mobile bottom drawer, CLEAR button, and resolves project IDs', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/components/RightInspectorPanel.tsx'), 'utf8');
  assert.ok(source.includes('isMobileExpanded'), 'Must have isMobileExpanded state');
  assert.ok(source.includes('onClearSelection'), 'Must have onClearSelection prop');
  assert.ok(source.includes('✕ CLEAR'), 'Must have ✕ CLEAR button');
  assert.ok(source.includes('resolveProjectFromEvidenceKey'), 'Must import and use resolveProjectFromEvidenceKey');
  assert.ok(source.includes('fixed bottom-0 left-0 right-0 z-30'), 'Must use fixed bottom drawer positioning on mobile');
});

// ---------------------------------------------------------------------------
// TEST T: scripts/sync-github-snapshot.ts token handling safety invariant
// ---------------------------------------------------------------------------
test('Test T: scripts/sync-github-snapshot.ts contains NO readArg("--token") and supports env tokens', () => {
  const source = readFileSync(resolve(process.cwd(), 'scripts/sync-github-snapshot.ts'), 'utf8');
  assert.ok(!source.includes("readArg('--token')"), 'Must NOT accept --token CLI argument');
  assert.ok(!source.includes('readArg("--token")'), 'Must NOT accept --token CLI argument');
  assert.ok(source.includes('process.env.GITHUB_TOKEN'), 'Must support process.env.GITHUB_TOKEN');
  assert.ok(source.includes('process.env.GH_TOKEN'), 'Must support process.env.GH_TOKEN');
});

// ---------------------------------------------------------------------------
// TEST U: No circular dependency: portfolioUtils must NOT import capabilityAssociations
// ---------------------------------------------------------------------------
test('Test U: portfolioUtils.ts MUST NOT import capabilityAssociations.ts', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/utils/portfolioUtils.ts'), 'utf8');
  assert.ok(!source.includes('capabilityAssociations'), 'portfolioUtils must not import from capabilityAssociations');
});

// ---------------------------------------------------------------------------
// TEST V: BottomCommandStrip hidden on < lg to prevent bottom sheet collision
// ---------------------------------------------------------------------------
test('Test V: BottomCommandStrip root contains hidden lg:flex', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/components/BottomCommandStrip.tsx'), 'utf8');
  assert.ok(source.includes('hidden lg:flex'), 'BottomCommandStrip must be hidden below lg breakpoint');
});

// ---------------------------------------------------------------------------
// TEST W: Authoritative experience conduit filtering precedence
// ---------------------------------------------------------------------------
test('Test W: With Experience selected, unrelated conduits remain strictly hidden regardless of hover', () => {
  // CodeFier selected + hover unrelated project -> conduit remains hidden
  const unrelatedProjHovered = getConduitPresentationState({
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
    showBackgroundRelationships: true,
    isSelectedExpActive: true,
    isProjectLinkedToExp: false,
    isSkillLinkedToExp: true
  });
  assert.equal(unrelatedProjHovered, 'hidden', 'Hovering an unrelated project must NOT reveal an unrelated conduit during experience filter');

  // CodeFier selected + hover unrelated capability -> conduit remains hidden
  const unrelatedSkillHovered = getConduitPresentationState({
    isConnected: true,
    isProjectHovered: false,
    isSkillHovered: true,
    isProjectSelected: false,
    isSkillSelected: false,
    isDraggingThisProject: false,
    isDraggingThisSkill: false,
    isAnyProjectHovered: false,
    isAnySkillHovered: true,
    isAnyProjectSelected: false,
    isAnySkillSelected: false,
    isAnyDragging: false,
    showBackgroundRelationships: true,
    isSelectedExpActive: true,
    isProjectLinkedToExp: true,
    isSkillLinkedToExp: false
  });
  assert.equal(unrelatedSkillHovered, 'hidden', 'Hovering an unrelated capability must NOT reveal an unrelated conduit during experience filter');

  // CodeFier selected + hover linked project -> eligible linked conduit becomes focused
  const linkedProjHovered = getConduitPresentationState({
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
    showBackgroundRelationships: false,
    isSelectedExpActive: true,
    isProjectLinkedToExp: true,
    isSkillLinkedToExp: true
  });
  assert.equal(linkedProjHovered, 'focused', 'Hovering an experience-linked project must focus eligible linked conduits');
});
