import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveProjectFromEvidenceKey } from '../src/utils/portfolioUtils';
import { GITHUB_SNAPSHOT } from '../src/data/githubSnapshot.generated';
import { ProjectData } from '../src/types';

// ---------------------------------------------------------------------------
// 1. Source Invariant: RightInspectorPanel must bind setActiveTab('overview') to selectedProject?.id
// ---------------------------------------------------------------------------
test('1. RightInspectorPanel source contains explicit activeTab reset effect tied to selectedProject?.id', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/components/RightInspectorPanel.tsx'), 'utf8');
  
  // Verify default state initialization
  assert.ok(source.includes("useState<'overview' | 'architecture' | 'metrics' | 'manifest'>('overview')"), 'activeTab must default to overview');

  // Verify useEffect reset on selectedProject?.id
  const hasResetEffect = source.includes("setActiveTab('overview');") && 
    (source.includes("[selectedProject?.id]") || source.includes("[selectedProject ? selectedProject.id : null]"));
  
  assert.ok(hasResetEffect, 'RightInspectorPanel must reset activeTab to overview on selectedProject?.id change');
});

// ---------------------------------------------------------------------------
// 2. Behavioral State Machine Simulation for Inspector Sub-Tab Navigation
// ---------------------------------------------------------------------------
class InspectorTabStateMachine {
  private _selectedProjectId: string | null = null;
  private _activeTab: 'overview' | 'architecture' | 'metrics' | 'manifest' = 'overview';
  private _isMobileExpanded: boolean = false;

  public get activeTab() {
    return this._activeTab;
  }

  public get isMobileExpanded() {
    return this._isMobileExpanded;
  }

  public selectProject(project: Partial<ProjectData> | null) {
    const newId = project?.id ?? null;
    if (this._selectedProjectId !== newId) {
      this._selectedProjectId = newId;
      // Mirror of React.useEffect(() => { setActiveTab('overview'); }, [selectedProject?.id]);
      this._activeTab = 'overview';
    }
    if (project) {
      this._isMobileExpanded = true;
    }
  }

  public setTab(tab: 'overview' | 'architecture' | 'metrics' | 'manifest') {
    this._activeTab = tab;
  }

  public toggleMobileExpanded() {
    this._isMobileExpanded = !this._isMobileExpanded;
  }

  public clearSelection() {
    this._selectedProjectId = null;
    this._isMobileExpanded = false;
    // selectedProject is now null -> triggers reset
    this._activeTab = 'overview';
  }
}

test('2. Inspector tab defaults to overview on initial selection', () => {
  const machine = new InspectorTabStateMachine();
  assert.equal(machine.activeTab, 'overview', 'Initial tab must be overview');

  machine.selectProject({ id: 'gh-101', title: 'project-a' });
  assert.equal(machine.activeTab, 'overview', 'Newly selected project starts on overview');
});

test('3. ARCH tab does not leak from Project A to Project B', () => {
  const machine = new InspectorTabStateMachine();
  machine.selectProject({ id: 'gh-101', title: 'project-a' });
  machine.setTab('architecture');
  assert.equal(machine.activeTab, 'architecture', 'Project A moved to ARCH');

  // Select Project B
  machine.selectProject({ id: 'gh-102', title: 'project-b' });
  assert.equal(machine.activeTab, 'overview', 'Project B must reset to overview and not retain ARCH');
});

test('4. METRICS tab does not leak from Project A to Project B', () => {
  const machine = new InspectorTabStateMachine();
  machine.selectProject({ id: 'gh-101', title: 'project-a' });
  machine.setTab('metrics');
  assert.equal(machine.activeTab, 'metrics', 'Project A moved to METRICS');

  // Select Project B
  machine.selectProject({ id: 'gh-102', title: 'project-b' });
  assert.equal(machine.activeTab, 'overview', 'Project B must reset to overview and not retain METRICS');
});

test('5. SPEC (manifest) tab does not leak from Project A to Project B', () => {
  const machine = new InspectorTabStateMachine();
  machine.selectProject({ id: 'gh-101', title: 'project-a' });
  machine.setTab('manifest');
  assert.equal(machine.activeTab, 'manifest', 'Project A moved to SPEC');

  // Select Project B
  machine.selectProject({ id: 'gh-102', title: 'project-b' });
  assert.equal(machine.activeTab, 'overview', 'Project B must reset to overview and not retain SPEC');
});

test('6. Same project selection does not reset activeTab on mobile minimize/expand or re-render', () => {
  const machine = new InspectorTabStateMachine();
  machine.selectProject({ id: 'gh-101', title: 'project-a' });
  machine.setTab('manifest');
  assert.equal(machine.activeTab, 'manifest');

  // Minimize mobile inspector
  machine.toggleMobileExpanded();
  assert.equal(machine.activeTab, 'manifest', 'Minimizing sheet must preserve SPEC tab');

  // Expand mobile inspector
  machine.toggleMobileExpanded();
  assert.equal(machine.activeTab, 'manifest', 'Expanding sheet must preserve SPEC tab');

  // Re-selecting same project does NOT reset tab
  machine.selectProject({ id: 'gh-101', title: 'project-a' });
  assert.equal(machine.activeTab, 'manifest', 'Selecting the same project ID must preserve active tab');
});

test('7. CLEAR selection then reopening project lands on OVERVIEW', () => {
  const machine = new InspectorTabStateMachine();
  machine.selectProject({ id: 'gh-101', title: 'project-a' });
  machine.setTab('architecture');
  assert.equal(machine.activeTab, 'architecture');

  // User hits ✕ CLEAR
  machine.clearSelection();

  // User selects Project A again
  machine.selectProject({ id: 'gh-101', title: 'project-a' });
  assert.equal(machine.activeTab, 'overview', 'Reopened project after CLEAR must start on overview');
});

// ---------------------------------------------------------------------------
// 8. Professional Experience Evidence Ingress -> Project Tab Reset
// ---------------------------------------------------------------------------
test('8. Professional Experience -> Worthy inspect resolves to runtime project and lands on OVERVIEW', () => {
  const machine = new InspectorTabStateMachine();
  // User had Project A open on SPEC
  machine.selectProject({ id: 'gh-101', title: 'project-a' });
  machine.setTab('manifest');
  assert.equal(machine.activeTab, 'manifest');

  // User navigates to Professional Experience, selects CodeFier, clicks INSPECT for worthy-crm
  const worthy = resolveProjectFromEvidenceKey(GITHUB_SNAPSHOT.projects, 'worthy-crm');
  assert.ok(worthy, 'Worthy CRM must resolve');
  assert.ok(worthy.id.startsWith('gh-'));

  machine.selectProject(worthy);
  assert.equal(machine.activeTab, 'overview', 'Worthy CRM must land on OVERVIEW (01 // OVERVIEW)');
});

test('9. Professional Experience -> Remapp inspect resolves to runtime project and lands on OVERVIEW', () => {
  const machine = new InspectorTabStateMachine();
  machine.selectProject({ id: 'gh-101', title: 'project-a' });
  machine.setTab('metrics');
  assert.equal(machine.activeTab, 'metrics');

  const remapp = resolveProjectFromEvidenceKey(GITHUB_SNAPSHOT.projects, 'remapp-scraper');
  assert.ok(remapp, 'Remapp must resolve');

  machine.selectProject(remapp);
  assert.equal(machine.activeTab, 'overview', 'Remapp scraper must land on OVERVIEW (01 // OVERVIEW)');
});

test('10. Professional Experience -> All TowerDesk surfaces resolve and land on OVERVIEW', () => {
  const machine = new InspectorTabStateMachine();
  const surfaces = ['towerdesk-backend', 'tower-desk', 'towerdesk-mobile-app'];

  for (const surface of surfaces) {
    // Put prior project in non-overview tab
    machine.selectProject({ id: 'gh-dummy', title: 'dummy' });
    machine.setTab('architecture');

    const resolved = resolveProjectFromEvidenceKey(GITHUB_SNAPSHOT.projects, surface);
    assert.ok(resolved, `${surface} must resolve`);

    machine.selectProject(resolved);
    assert.equal(machine.activeTab, 'overview', `${surface} must land on OVERVIEW`);
  }
});

// ---------------------------------------------------------------------------
// 11. Navigation Drawer Backdrop & Outside Tap Semantics
// ---------------------------------------------------------------------------
test('11. App.tsx renders compact backdrop with aria-label when isMobileNavOpen is true at z-40', () => {
  const appSource = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');
  assert.ok(appSource.includes('isMobileNavOpen && ('), 'Backdrop condition must be tied to isMobileNavOpen');
  assert.ok(appSource.includes('aria-label="Close system index"'), 'Backdrop button must have aria-label');
  assert.ok(appSource.includes('onClick={() => setIsMobileNavOpen(false)}'), 'Backdrop click must close drawer');
  assert.ok(appSource.includes('fixed inset-0 z-40 bg-[#15150F]/40 lg:hidden'), 'Backdrop must use z-40 and lg:hidden');
});

// ---------------------------------------------------------------------------
// 12. Drawer / Backdrop / Inspector Z-Index Hierarchy Invariant
// ---------------------------------------------------------------------------
test('12. Explicit z-index hierarchy: Drawer (z-50) > Backdrop (z-40) > Inspector (z-30)', () => {
  const railSource = readFileSync(resolve(process.cwd(), 'src/components/LeftNavigationRail.tsx'), 'utf8');
  const appSource = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');
  const inspectorSource = readFileSync(resolve(process.cwd(), 'src/components/RightInspectorPanel.tsx'), 'utf8');

  assert.ok(railSource.includes('z-50'), 'LeftNavigationRail drawer must sit at z-50');
  assert.ok(appSource.includes('z-40'), 'App backdrop must sit at z-40');
  assert.ok(inspectorSource.includes('z-30'), 'RightInspectorPanel bottom sheet must sit at z-30');
});

// ---------------------------------------------------------------------------
// 13. Explicit Internal Drawer Close Control
// ---------------------------------------------------------------------------
test('13. LeftNavigationRail has explicit internal CLOSE button for compact screens', () => {
  const railSource = readFileSync(resolve(process.cwd(), 'src/components/LeftNavigationRail.tsx'), 'utf8');
  assert.ok(railSource.includes('onClick={() => setIsMobileOpen(false)}'), 'Drawer internal close must invoke setIsMobileOpen(false)');
  assert.ok(railSource.includes('aria-label="Close system index"'), 'Drawer close button must have aria-label');
  assert.ok(railSource.includes('lg:hidden'), 'Drawer close button must only show below lg');
  assert.ok(railSource.includes('min-h-[36px]'), 'Drawer close button must have accessible touch target');
});

// ---------------------------------------------------------------------------
// 14. System Index Trigger Breakpoint & Accessibility
// ---------------------------------------------------------------------------
test('14. SYSTEM INDEX trigger uses lg:hidden and proper aria attributes', () => {
  const appSource = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');
  assert.ok(appSource.includes('className="lg:hidden'), 'Trigger bar container must use lg:hidden');
  assert.ok(appSource.includes('aria-expanded={isMobileNavOpen}'), 'Trigger button must bind aria-expanded');
  assert.ok(appSource.includes('aria-controls="system-index-navigation"'), 'Trigger button must control system-index-navigation');
  assert.ok(appSource.includes('min-h-[42px]'), 'Trigger button must have accessible touch target');
});

// ---------------------------------------------------------------------------
// 15. Escape Handler Closes Drawer Before Viewport Reset
// ---------------------------------------------------------------------------
test('15. Escape key handler closes mobile drawer before resetting viewport and includes isMobileNavOpen dependency', () => {
  const appSource = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');
  
  // Verify Escape ordering
  const escapeBlock = appSource.substring(appSource.indexOf("e.key === 'Escape'"), appSource.indexOf("e.key === '0'"));
  const modalPos = escapeBlock.indexOf('isCaseStudyOpen');
  const drawerPos = escapeBlock.indexOf('isMobileNavOpen');
  const resetPos = escapeBlock.indexOf('handleResetView');

  assert.ok(modalPos !== -1 && drawerPos !== -1 && resetPos !== -1, 'All Escape checks must exist');
  assert.ok(modalPos < drawerPos, 'Modal check must precede drawer check');
  assert.ok(drawerPos < resetPos, 'Drawer check must precede handleResetView');

  // Verify effect dependencies
  const keydownEffectBlock = appSource.substring(
    appSource.indexOf('// Keyboard Shortcuts Listener'), 
    appSource.indexOf('// 1. Top Telemetry Bar')
  );
  assert.ok(keydownEffectBlock.includes('isMobileNavOpen'), 'Effect dependencies must include isMobileNavOpen');
});

// ---------------------------------------------------------------------------
// 16. iOS 16px Search Input Rule
// ---------------------------------------------------------------------------
test('16. Search input in LeftNavigationRail uses 16px compact font to prevent iOS Safari page zoom', () => {
  const railSource = readFileSync(resolve(process.cwd(), 'src/components/LeftNavigationRail.tsx'), 'utf8');
  assert.ok(railSource.includes('text-[16px] lg:text-[12px]'), 'Search input must use text-[16px] on compact and text-[12px] on lg+');
});

// ---------------------------------------------------------------------------
// 17. Topology Mode Subtitle Readable Scale
// ---------------------------------------------------------------------------
test('17. Topology mode subtitle no longer uses 6.5px microtext on compact viewports', () => {
  const railSource = readFileSync(resolve(process.cwd(), 'src/components/LeftNavigationRail.tsx'), 'utf8');
  assert.match(
    railSource,
    /<span className=\{`text-\[10px\][^`]*`\}>\s*\{mode\.sub\}/,
    'Mode subtitle must scale to text-[10px]'
  );
  assert.ok(railSource.includes('min-h-[42px] lg:min-h-[30px]'), 'Mode buttons must have >= 42px touch target on compact');
});

// ---------------------------------------------------------------------------
// 18. Main Navigation Row Touch Target & Readable Typography
// ---------------------------------------------------------------------------
test('18. Main navigation rows are >= 12px and >= 44px min-height on compact viewports', () => {
  const railSource = readFileSync(resolve(process.cwd(), 'src/components/LeftNavigationRail.tsx'), 'utf8');
  assert.ok(railSource.includes('min-h-[44px] lg:min-h-[34px]'), 'Main nav must have min-h-[44px] on compact');
  assert.ok(railSource.includes('text-[13px] lg:text-[12px]'), 'Main nav must have text-[13px] on compact and text-[12px] on lg+');
});

// ---------------------------------------------------------------------------
// 19. Project Row Touch Target & Readable Typography
// ---------------------------------------------------------------------------
test('19. Project rows are >= 11px and >= 40px min-height on compact viewports', () => {
  const railSource = readFileSync(resolve(process.cwd(), 'src/components/LeftNavigationRail.tsx'), 'utf8');
  assert.ok(railSource.includes('min-h-[40px] lg:min-h-[28px]'), 'Project rows must have min-h-[40px] on compact');
  assert.ok(railSource.includes('text-[12px] lg:text-[11.5px]'), 'Project rows must have text-[12px] on compact and text-[11.5px] on lg+');
});

// ---------------------------------------------------------------------------
// 20. ProvenanceBadge Readable Compact Typography
// ---------------------------------------------------------------------------
test('20. ProvenanceBadge uses readable compact typography (text-[10px])', () => {
  const inspectorSource = readFileSync(resolve(process.cwd(), 'src/components/RightInspectorPanel.tsx'), 'utf8');
  assert.ok(inspectorSource.includes('text-[10px] font-bold px-1.5 py-0.5'), 'ProvenanceBadge must use text-[10px]');
});

// ---------------------------------------------------------------------------
// 21. Inspector Section Headings Typography
// ---------------------------------------------------------------------------
test('21. RightInspectorPanel section headings use readable compact typography (text-[11px])', () => {
  const inspectorSource = readFileSync(resolve(process.cwd(), 'src/components/RightInspectorPanel.tsx'), 'utf8');
  assert.ok(inspectorSource.includes('text-[11px] font-bold opacity-60 uppercase tracking-wider'), 'Section headings must use text-[11px]');
});

// ---------------------------------------------------------------------------
// 22. Project Summary, Challenge, and Solution Typography
// ---------------------------------------------------------------------------
test('22. Project summary, challenge, and solution copy use readable compact scale (text-[13px])', () => {
  const inspectorSource = readFileSync(resolve(process.cwd(), 'src/components/RightInspectorPanel.tsx'), 'utf8');
  assert.ok(inspectorSource.includes('text-[13px] text-[#15150F] bg-[#E2DCB9]/70'), 'Summary body must use text-[13px]');
  assert.ok(inspectorSource.includes('text-[13px] text-[#22211A] leading-relaxed'), 'Problem/solution copy must use text-[13px]');
});

// ---------------------------------------------------------------------------
// 23. Meaningful Project Technology Metadata Scale
// ---------------------------------------------------------------------------
test('23. Project tech badges and validation pills use readable compact scale (text-[10px])', () => {
  const inspectorSource = readFileSync(resolve(process.cwd(), 'src/components/RightInspectorPanel.tsx'), 'utf8');
  assert.ok(inspectorSource.includes('text-[10px] px-1 bg-[#DCD6B2]'), 'Subsystem tech badges must use text-[10px]');
  assert.ok(inspectorSource.includes('text-[10px] px-1.5 py-0.5 bg-[#15150F] text-[#C3E54E]'), 'Validation test pills must use text-[10px]');
});

// ---------------------------------------------------------------------------
// 24. MINIMIZE and CLEAR Compact Controls Touch Height
// ---------------------------------------------------------------------------
test('24. MINIMIZE and CLEAR sheet controls have >= 36px touch height and readable labels', () => {
  const inspectorSource = readFileSync(resolve(process.cwd(), 'src/components/RightInspectorPanel.tsx'), 'utf8');
  assert.ok(inspectorSource.includes('min-h-[36px]'), 'Sheet controls must have min-h-[36px] touch target');
  assert.ok(inspectorSource.includes('text-[11px] font-bold'), 'Sheet controls must have text-[11px] font size');
});

// ---------------------------------------------------------------------------
// 25. TopTelemetryBar OWNER SOURCE Breakpoint
// ---------------------------------------------------------------------------
test('25. TopTelemetryBar OWNER SOURCE remains hidden until lg breakpoint', () => {
  const telemetrySource = readFileSync(resolve(process.cwd(), 'src/components/TopTelemetryBar.tsx'), 'utf8');
  assert.ok(telemetrySource.includes('className="hidden lg:flex flex-col"'), 'OWNER SOURCE must use hidden lg:flex');
});

// ---------------------------------------------------------------------------
// 26. TopTelemetryBar OWNER PROJECTS and CONTACT Typography & Targets
// ---------------------------------------------------------------------------
test('26. TopTelemetryBar OWNER PROJECTS and CONTACT use increased compact typography and touch targets', () => {
  const telemetrySource = readFileSync(resolve(process.cwd(), 'src/components/TopTelemetryBar.tsx'), 'utf8');
  assert.ok(telemetrySource.includes('text-[10px] text-[#D4CDA4]'), 'OWNER PROJECTS label must use text-[10px]');
  assert.ok(telemetrySource.includes('text-[12px] tracking-wider'), 'Public repos count must use text-[12px]');
  assert.ok(telemetrySource.includes('min-h-[36px]'), 'Action buttons must have >= 36px touch targets on compact');
});

// ---------------------------------------------------------------------------
// 27. Sidebar Sticky Project List Header - Black Brutalist Style & Solid Background
// ---------------------------------------------------------------------------
test('27. Sidebar sticky project list header uses solid black background (bg-[#15150F]) without parent opacity', () => {
  const railSource = readFileSync(resolve(process.cwd(), 'src/components/LeftNavigationRail.tsx'), 'utf8');
  
  // Extract project list header snippet
  const headerStart = railSource.indexOf('Fast Project Jump List');
  assert.ok(headerStart !== -1, 'Fast Project Jump List comment must exist');
  const snippet = railSource.substring(headerStart, headerStart + 350);

  assert.ok(snippet.includes('bg-[#15150F]'), 'Sticky project list header must use solid bg-[#15150F]');
  assert.ok(snippet.includes('sticky top-0 z-20'), 'Sticky project list header must retain sticky top-0 z-20 positioning');
  assert.ok(!snippet.includes('opacity-60 uppercase flex justify-between items-center sticky'), 'Header container must not apply whole-container opacity');
});

// ---------------------------------------------------------------------------
// 28. Sidebar Sticky Project List Header - Accent Lime and Khaki Labels
// ---------------------------------------------------------------------------
test('28. Sticky project list header uses accent lime text for OWNER PROJECTS and readable TIER', () => {
  const railSource = readFileSync(resolve(process.cwd(), 'src/components/LeftNavigationRail.tsx'), 'utf8');
  assert.ok(railSource.includes('<span className="text-[#C3E54E]">OWNER PROJECTS ({filteredProjects.length})</span>'), 'OWNER PROJECTS must use text-[#C3E54E]');
  assert.ok(railSource.includes('TIER</span>'), 'TIER label must be present and readable');
});

// ---------------------------------------------------------------------------
// 29-34. Explicit Selection Exit Paths
// ---------------------------------------------------------------------------
test('29. Selecting an unselected project selects the requested project', () => {
  const appSource = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');
  const handler = appSource.substring(
    appSource.indexOf('const handleSelectProject ='),
    appSource.indexOf('// Handle Drilling into Project')
  );

  assert.ok(handler.includes('setSelectedProjectId(id);'), 'Project handler must select the requested project ID');
  assert.ok(handler.includes("setActiveView('projects');"), 'A new project selection must retain the projects view behavior');
});

test('30. Clicking the selected project again clears selection before the select path', () => {
  const appSource = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');
  const handler = appSource.substring(
    appSource.indexOf('const handleSelectProject ='),
    appSource.indexOf('// Handle Drilling into Project')
  );
  const togglePosition = handler.indexOf('if (selectedProjectId === id)');
  const clearPosition = handler.indexOf('handleClearSelection();');
  const selectPosition = handler.indexOf('setSelectedProjectId(id);');

  assert.ok(togglePosition !== -1, 'Project handler must compare the selected and requested IDs');
  assert.ok(togglePosition < clearPosition && clearPosition < selectPosition, 'Click-again clear must return before the normal select path');
  assert.ok(handler.includes('return;'), 'Click-again clear must stop before reselecting the project');
  assert.ok(handler.includes('[selectedProjectId, handleClearSelection]'), 'Project handler dependencies must track selectedProjectId and the clear callback');
});

test('31. Selecting a different project switches project selection and clears competing focus', () => {
  const appSource = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');
  const handler = appSource.substring(
    appSource.indexOf('const handleSelectProject ='),
    appSource.indexOf('// Handle Drilling into Project')
  );

  assert.ok(handler.includes('setSelectedProjectId(id);'), 'Different-project path must replace the selected project ID');
  assert.ok(handler.includes('setSelectedSkillId(null);'), 'Different-project path must clear skill focus');
  assert.ok(handler.includes('setSelectedExperienceId(null);'), 'Different-project path must clear experience focus');
  assert.ok(handler.includes('setSelectedSubsystem(null);'), 'Different-project path must clear subsystem focus');
  assert.ok(!handler.includes('setViewport'), 'Project selection must not reset the viewport');
  assert.ok(!handler.includes('setTopologyViewMode'), 'Project selection must not reset topology mode or ordering');
});

test('32. Skill and experience click-again toggle behavior remains intact', () => {
  const appSource = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8').replace(/\r\n/g, '\n');
  const skillHandler = appSource.substring(
    appSource.indexOf('const handleSelectSkill ='),
    appSource.indexOf('// Handle Experience Selection')
  );
  const experienceHandler = appSource.substring(
    appSource.indexOf('const handleSelectExperience ='),
    appSource.indexOf('// Reset View')
  );

  assert.ok(skillHandler.includes("if (selectedSkillId === id) {\n      setSelectedSkillId(null);\n      return;"), 'Skill click-again must still toggle off');
  assert.ok(skillHandler.includes('[selectedSkillId]'), 'Skill toggle dependency must remain selectedSkillId');
  assert.ok(experienceHandler.includes("if (selectedExperienceId === id) {\n      setSelectedExperienceId(null);\n      return;"), 'Experience click-again must still toggle off');
  assert.ok(experienceHandler.includes('[selectedExperienceId]'), 'Experience toggle dependency must remain selectedExperienceId');
});

test('33. Escape clears selected focus without resetting viewport or topology state', () => {
  const appSource = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');
  const escapeBlock = appSource.substring(appSource.indexOf("e.key === 'Escape'"), appSource.indexOf("e.key === '0'"));
  const drilledPosition = escapeBlock.indexOf('drilledProjectId');
  const selectionPosition = escapeBlock.indexOf('selectedProjectId || selectedSkillId || selectedExperienceId || selectedSubsystem');
  const clearPosition = escapeBlock.indexOf('handleClearSelection();');
  const resetPosition = escapeBlock.indexOf('handleResetView();');
  const clearHandler = appSource.substring(
    appSource.indexOf('const handleClearSelection ='),
    appSource.indexOf('// Handle Project Selection')
  );

  assert.ok(drilledPosition < selectionPosition, 'Escape must return from a drilled project before general selection clearing');
  assert.ok(selectionPosition < clearPosition && clearPosition < resetPosition, 'Escape must clear selected focus before the reset fallback');
  assert.ok(!clearHandler.includes('setViewport'), 'Selection clearing must preserve viewport position and zoom');
  assert.ok(!clearHandler.includes('setTopologyViewMode'), 'Selection clearing must preserve topology mode and ordering');
  assert.ok(!clearHandler.includes('setInteractiveOrbit'), 'Selection clearing must preserve interactive orbit state');
  assert.ok(!clearHandler.includes('setDetached'), 'Selection clearing must preserve detached project state');
});

test('34. Desktop inspector omits duplicate clear control while mobile CLEAR remains available', () => {
  const inspectorSource = readFileSync(resolve(process.cwd(), 'src/components/RightInspectorPanel.tsx'), 'utf8');
  const titleBar = inspectorSource.substring(
    inspectorSource.indexOf('Inspector Title Bar'),
    inspectorSource.indexOf('Sub-Tabs for Projects')
  );
  const mobileControls = titleBar.substring(titleBar.indexOf('Mobile Sheet Controls'));
  const selectionCondition = '(selectedProject || selectedSkill || selectedExperience || selectedSubsystem)';

  assert.ok(!titleBar.includes('hidden lg:inline-flex'), 'Inspector title bar must not contain a desktop clear control');
  assert.ok(mobileControls.includes('lg:hidden'), 'Existing mobile controls must remain hidden on desktop');
  assert.ok(mobileControls.includes(selectionCondition), 'Mobile CLEAR must still render while an object is selected');
  assert.ok(mobileControls.includes('onClearSelection?.();'), 'Mobile CLEAR must retain the shared clear callback');
  assert.ok(mobileControls.includes('✕ CLEAR'), 'Mobile CLEAR label must remain available');
});

// ---------------------------------------------------------------------------
// 35. Compact Drawer Header - Hides INDX Badge Below lg
// ---------------------------------------------------------------------------
test('35. Compact drawer header hides decorative INDX badge below lg while desktop shows it at lg+', () => {
  const railSource = readFileSync(resolve(process.cwd(), 'src/components/LeftNavigationRail.tsx'), 'utf8');
  assert.ok(railSource.includes('hidden lg:inline text-[10px] px-1 bg-[#15150F] text-[#D4CDA4] font-mono whitespace-nowrap'), 'INDX badge must use hidden lg:inline');
});

// ---------------------------------------------------------------------------
// 36. Compact Drawer Header - Displays CLOSE Button Below lg
// ---------------------------------------------------------------------------
test('36. Compact drawer header displays internal CLOSE control below lg', () => {
  const railSource = readFileSync(resolve(process.cwd(), 'src/components/LeftNavigationRail.tsx'), 'utf8');
  assert.ok(railSource.includes('className="lg:hidden flex items-center gap-1 px-2.5 py-1.5 min-h-[36px] bg-[#15150F] text-[#D4CDA4] hover:text-[#C3E54E] text-[11px] font-bold font-mono border border-[#15150F] cursor-pointer whitespace-nowrap shrink-0"'), 'CLOSE button must be lg:hidden with whitespace-nowrap and shrink-0');
});

// ---------------------------------------------------------------------------
// 37. Compact Drawer Header - Non-wrapping Title Presentation
// ---------------------------------------------------------------------------
test('37. Compact drawer header title and button use whitespace-nowrap preventing row wrapping', () => {
  const railSource = readFileSync(resolve(process.cwd(), 'src/components/LeftNavigationRail.tsx'), 'utf8');
  assert.ok(railSource.includes('Owner Technical Index'), 'Title must be Owner Technical Index');
  assert.ok(railSource.includes('text-[12px] font-bold uppercase tracking-tight text-[#15150F] whitespace-nowrap'), 'Title must include whitespace-nowrap');
});

// ---------------------------------------------------------------------------
// 38. Inspector Content Area Scroll Reset Contract
// ---------------------------------------------------------------------------
test('38. RightInspectorPanel binds content scroll ref and resets scrollTop to 0 on context transition', () => {
  const inspectorSource = readFileSync(resolve(process.cwd(), 'src/components/RightInspectorPanel.tsx'), 'utf8');
  assert.ok(inspectorSource.includes('const contentScrollRef = React.useRef<HTMLDivElement>(null);'), 'contentScrollRef must be defined');
  assert.ok(inspectorSource.includes('ref={contentScrollRef}'), 'contentScrollRef must be attached to the content scroller element');

  const effectComment = '// Deterministic immediate scroll reset to top whenever inspector content context changes';
  const effectCommentIndex = inspectorSource.indexOf(effectComment);
  assert.ok(effectCommentIndex !== -1, 'Scroll reset effect comment must exist');

  const effectBlock = inspectorSource.substring(
    effectCommentIndex,
    inspectorSource.indexOf('// Shared generic progression grouping', effectCommentIndex)
  );

  assert.ok(effectBlock.includes('React.useLayoutEffect('), 'Reset effect must use useLayoutEffect');
  assert.ok(effectBlock.includes('contentScrollRef.current.scrollTop = 0;'), 'Effect must reset scrollTop to 0');
  assert.ok(effectBlock.includes('contentScrollRef.current.scrollLeft = 0;'), 'Effect must reset scrollLeft to 0');
  assert.ok(effectBlock.includes('activeView'), 'Effect dependencies must include activeView');
  assert.ok(effectBlock.includes('selectedProject?.id'), 'Effect dependencies must include selectedProject?.id');
  assert.ok(effectBlock.includes('selectedSkill?.id'), 'Effect dependencies must include selectedSkill?.id');
  assert.ok(effectBlock.includes('selectedExperience?.id'), 'Effect dependencies must include selectedExperience?.id');
  assert.ok(effectBlock.includes('selectedSubsystem?.id'), 'Effect dependencies must include selectedSubsystem?.id');
  assert.ok(effectBlock.includes('activeTab'), 'Effect dependencies must include activeTab');
});

// ---------------------------------------------------------------------------
// 39. Responsive Inspector Height Contract
// ---------------------------------------------------------------------------
test('39. expanded inspector removes its mobile max-height cap on desktop', () => {
  const inspectorSource = readFileSync(resolve(process.cwd(), 'src/components/RightInspectorPanel.tsx'), 'utf8');
  const branchMatch = inspectorSource.match(/isMobileExpanded\s*\?\s*'([^']+)'\s*:\s*'([^']+)'/);

  assert.ok(branchMatch, 'isMobileExpanded expanded and collapsed class branches must exist');
  const [, expandedBranch, collapsedBranch] = branchMatch;

  assert.ok(expandedBranch.includes('h-[62vh]'), 'Mobile expanded inspector must remain 62vh high');
  assert.ok(expandedBranch.includes('max-h-[75vh]'), 'Mobile expanded inspector must retain its 75vh maximum height');
  assert.ok(expandedBranch.includes('lg:h-full'), 'Desktop expanded inspector must use full height');
  assert.ok(expandedBranch.includes('lg:max-h-none'), 'Desktop expanded inspector must remove the mobile max-height cap');

  assert.ok(collapsedBranch.includes('lg:h-full'), 'Desktop collapsed inspector must use full height');
  assert.ok(!collapsedBranch.includes('max-h-[75vh]'), 'Collapsed inspector must not carry the mobile expanded max-height cap');
  assert.ok(!collapsedBranch.includes('lg:max-h-none'), 'Collapsed inspector needs no desktop max-height override');
});
