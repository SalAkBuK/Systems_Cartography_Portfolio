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
  assert.ok(railSource.includes('text-[16px] lg:text-[9.5px]'), 'Search input must use text-[16px] on compact and text-[9.5px] on lg+');
});

// ---------------------------------------------------------------------------
// 17. Topology Mode Subtitle Readable Scale
// ---------------------------------------------------------------------------
test('17. Topology mode subtitle no longer uses 6.5px microtext on compact viewports', () => {
  const railSource = readFileSync(resolve(process.cwd(), 'src/components/LeftNavigationRail.tsx'), 'utf8');
  assert.ok(railSource.includes('text-[9.5px] lg:text-[6.5px]'), 'Mode subtitle must scale to text-[9.5px] on compact');
  assert.ok(railSource.includes('min-h-[42px] lg:min-h-[30px]'), 'Mode buttons must have >= 42px touch target on compact');
});

// ---------------------------------------------------------------------------
// 18. Main Navigation Row Touch Target & Readable Typography
// ---------------------------------------------------------------------------
test('18. Main navigation rows are >= 12px and >= 44px min-height on compact viewports', () => {
  const railSource = readFileSync(resolve(process.cwd(), 'src/components/LeftNavigationRail.tsx'), 'utf8');
  assert.ok(railSource.includes('min-h-[44px] lg:min-h-[34px]'), 'Main nav must have min-h-[44px] on compact');
  assert.ok(railSource.includes('text-[13px] lg:text-[10.5px]'), 'Main nav must have text-[13px] on compact');
});

// ---------------------------------------------------------------------------
// 19. Project Row Touch Target & Readable Typography
// ---------------------------------------------------------------------------
test('19. Project rows are >= 11px and >= 40px min-height on compact viewports', () => {
  const railSource = readFileSync(resolve(process.cwd(), 'src/components/LeftNavigationRail.tsx'), 'utf8');
  assert.ok(railSource.includes('min-h-[40px] lg:min-h-[28px]'), 'Project rows must have min-h-[40px] on compact');
  assert.ok(railSource.includes('text-[12px] lg:text-[9.5px]'), 'Project rows must have text-[12px] on compact');
});

// ---------------------------------------------------------------------------
// 20. ProvenanceBadge Readable Compact Typography
// ---------------------------------------------------------------------------
test('20. ProvenanceBadge uses readable compact typography (text-[9.5px] lg:text-[7px])', () => {
  const inspectorSource = readFileSync(resolve(process.cwd(), 'src/components/RightInspectorPanel.tsx'), 'utf8');
  assert.ok(inspectorSource.includes('text-[9.5px] lg:text-[7px]'), 'ProvenanceBadge must use text-[9.5px] on compact and text-[7px] on desktop');
});

// ---------------------------------------------------------------------------
// 21. Inspector Section Headings Typography
// ---------------------------------------------------------------------------
test('21. RightInspectorPanel section headings use readable compact typography (text-[10.5px] lg:text-[8.5px])', () => {
  const inspectorSource = readFileSync(resolve(process.cwd(), 'src/components/RightInspectorPanel.tsx'), 'utf8');
  assert.ok(inspectorSource.includes('text-[10.5px] lg:text-[8.5px] font-bold opacity-60 uppercase tracking-wider'), 'Section headings must use text-[10.5px] on compact');
});

// ---------------------------------------------------------------------------
// 22. Project Summary, Challenge, and Solution Typography
// ---------------------------------------------------------------------------
test('22. Project summary, challenge, and solution copy use readable compact scale (text-[12px])', () => {
  const inspectorSource = readFileSync(resolve(process.cwd(), 'src/components/RightInspectorPanel.tsx'), 'utf8');
  assert.ok(inspectorSource.includes('text-[12px] lg:text-[10.5px] text-[#15150F] bg-[#E2DCB9]/70'), 'Summary body must use text-[12px] on compact');
  assert.ok(inspectorSource.includes('text-[12px] lg:text-[10px] text-[#22211A] leading-relaxed'), 'Problem/solution copy must use text-[12px] on compact');
});

// ---------------------------------------------------------------------------
// 23. Meaningful Project Technology Metadata Scale
// ---------------------------------------------------------------------------
test('23. Project tech badges and validation pills use readable compact scale (text-[9.5px])', () => {
  const inspectorSource = readFileSync(resolve(process.cwd(), 'src/components/RightInspectorPanel.tsx'), 'utf8');
  assert.ok(inspectorSource.includes('text-[9.5px] lg:text-[7.5px] px-1 bg-[#DCD6B2]'), 'Subsystem tech badges must use text-[9.5px] on compact');
  assert.ok(inspectorSource.includes('text-[9.5px] lg:text-[7.5px] px-1.5 py-0.5 bg-[#15150F] text-[#C3E54E]'), 'Validation test pills must use text-[9.5px] on compact');
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
  assert.ok(telemetrySource.includes('text-[9.5px] lg:text-[7.5px]'), 'OWNER PROJECTS label must use text-[9.5px] on compact');
  assert.ok(telemetrySource.includes('text-[11.5px] lg:text-[9.5px]'), 'Public repos count must use text-[11.5px] on compact');
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
// 29. Compact Drawer Header - Hides INDX Badge Below lg
// ---------------------------------------------------------------------------
test('29. Compact drawer header hides decorative INDX badge below lg while desktop shows it at lg+', () => {
  const railSource = readFileSync(resolve(process.cwd(), 'src/components/LeftNavigationRail.tsx'), 'utf8');
  assert.ok(railSource.includes('hidden lg:inline text-[8.5px] px-1 bg-[#15150F] text-[#D4CDA4] font-mono whitespace-nowrap'), 'INDX badge must use hidden lg:inline');
});

// ---------------------------------------------------------------------------
// 30. Compact Drawer Header - Displays CLOSE Button Below lg
// ---------------------------------------------------------------------------
test('30. Compact drawer header displays internal CLOSE control below lg', () => {
  const railSource = readFileSync(resolve(process.cwd(), 'src/components/LeftNavigationRail.tsx'), 'utf8');
  assert.ok(railSource.includes('className="lg:hidden flex items-center gap-1 px-2.5 py-1.5 min-h-[36px] bg-[#15150F] text-[#D4CDA4] hover:text-[#C3E54E] text-[11px] font-bold font-mono border border-[#15150F] cursor-pointer whitespace-nowrap shrink-0"'), 'CLOSE button must be lg:hidden with whitespace-nowrap and shrink-0');
});

// ---------------------------------------------------------------------------
// 31. Compact Drawer Header - Non-wrapping Title Presentation
// ---------------------------------------------------------------------------
test('31. Compact drawer header title and button use whitespace-nowrap preventing row wrapping', () => {
  const railSource = readFileSync(resolve(process.cwd(), 'src/components/LeftNavigationRail.tsx'), 'utf8');
  assert.ok(railSource.includes('Owner Technical Index'), 'Title must be Owner Technical Index');
  assert.ok(railSource.includes('text-[12px] lg:text-[11px] font-bold uppercase tracking-tight text-[#15150F] whitespace-nowrap'), 'Title must include whitespace-nowrap');
});
