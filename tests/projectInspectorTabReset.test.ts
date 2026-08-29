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
test('11. App.tsx renders compact backdrop with aria-label when isMobileNavOpen is true', () => {
  const appSource = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');
  assert.ok(appSource.includes('isMobileNavOpen && ('), 'Backdrop condition must be tied to isMobileNavOpen');
  assert.ok(appSource.includes('aria-label="Close system index"'), 'Backdrop button must have aria-label');
  assert.ok(appSource.includes('onClick={() => setIsMobileNavOpen(false)}'), 'Backdrop click must close drawer');
  assert.ok(appSource.includes('fixed inset-0 z-30 bg-[#15150F]/40 lg:hidden'), 'Backdrop must use z-30 and lg:hidden');
});

// ---------------------------------------------------------------------------
// 12. Drawer Stacking & ID Invariants
// ---------------------------------------------------------------------------
test('12. LeftNavigationRail has id="system-index-navigation" and sits at z-40 above backdrop (z-30)', () => {
  const railSource = readFileSync(resolve(process.cwd(), 'src/components/LeftNavigationRail.tsx'), 'utf8');
  assert.ok(railSource.includes('id="system-index-navigation"'), 'Rail must have id="system-index-navigation"');
  assert.ok(railSource.includes('z-40'), 'Drawer must use z-40 to sit above backdrop z-30');
  assert.ok(railSource.includes('lg:static lg:translate-x-0'), 'Drawer must switch to static layout at lg breakpoint');
});

// ---------------------------------------------------------------------------
// 13. System Index Trigger Breakpoint & Accessibility
// ---------------------------------------------------------------------------
test('13. SYSTEM INDEX trigger uses lg:hidden and proper aria attributes', () => {
  const appSource = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');
  assert.ok(appSource.includes('className="lg:hidden'), 'Trigger bar container must use lg:hidden');
  assert.ok(appSource.includes('aria-expanded={isMobileNavOpen}'), 'Trigger button must bind aria-expanded');
  assert.ok(appSource.includes('aria-controls="system-index-navigation"'), 'Trigger button must control system-index-navigation');
  assert.ok(appSource.includes('min-h-[42px]'), 'Trigger button must have accessible touch target');
});

// ---------------------------------------------------------------------------
// 14. Escape Handler Closes Drawer Before Viewport Reset
// ---------------------------------------------------------------------------
test('14. Escape key handler closes mobile drawer before resetting viewport and includes isMobileNavOpen dependency', () => {
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
// 15. iOS 16px Search Input Rule
// ---------------------------------------------------------------------------
test('15. Search input in LeftNavigationRail uses 16px compact font to prevent iOS Safari page zoom', () => {
  const railSource = readFileSync(resolve(process.cwd(), 'src/components/LeftNavigationRail.tsx'), 'utf8');
  assert.ok(railSource.includes('text-[16px] lg:text-[9.5px]'), 'Search input must use text-[16px] on compact and text-[9.5px] on lg+');
});

// ---------------------------------------------------------------------------
// 16. Topology Mode Subtitle Readable Scale
// ---------------------------------------------------------------------------
test('16. Topology mode subtitle no longer uses 6.5px microtext on compact viewports', () => {
  const railSource = readFileSync(resolve(process.cwd(), 'src/components/LeftNavigationRail.tsx'), 'utf8');
  assert.ok(railSource.includes('text-[9.5px] lg:text-[6.5px]'), 'Mode subtitle must scale to text-[9.5px] on compact');
  assert.ok(railSource.includes('min-h-[42px] lg:min-h-[30px]'), 'Mode buttons must have >= 42px touch target on compact');
});

// ---------------------------------------------------------------------------
// 17. Main Navigation Row Touch Target & Readable Typography
// ---------------------------------------------------------------------------
test('17. Main navigation rows are >= 12px and >= 44px min-height on compact viewports', () => {
  const railSource = readFileSync(resolve(process.cwd(), 'src/components/LeftNavigationRail.tsx'), 'utf8');
  assert.ok(railSource.includes('min-h-[44px] lg:min-h-[34px]'), 'Main nav must have min-h-[44px] on compact');
  assert.ok(railSource.includes('text-[13px] lg:text-[10.5px]'), 'Main nav must have text-[13px] on compact');
});

// ---------------------------------------------------------------------------
// 18. Project Row Touch Target & Readable Typography
// ---------------------------------------------------------------------------
test('18. Project rows are >= 11px and >= 40px min-height on compact viewports', () => {
  const railSource = readFileSync(resolve(process.cwd(), 'src/components/LeftNavigationRail.tsx'), 'utf8');
  assert.ok(railSource.includes('min-h-[40px] lg:min-h-[28px]'), 'Project rows must have min-h-[40px] on compact');
  assert.ok(railSource.includes('text-[12px] lg:text-[9.5px]'), 'Project rows must have text-[12px] on compact');
});

// ---------------------------------------------------------------------------
// 19. Inspector Sub-Tabs & Title Typography
// ---------------------------------------------------------------------------
test('19. RightInspectorPanel sub-tabs and title bar use increased compact typography', () => {
  const inspectorSource = readFileSync(resolve(process.cwd(), 'src/components/RightInspectorPanel.tsx'), 'utf8');
  assert.ok(inspectorSource.includes('text-[11.5px] lg:text-[10px]'), 'Inspector title must use text-[11.5px] on compact');
  assert.ok(inspectorSource.includes('text-[11.5px] lg:text-[9px]'), 'Inspector tabs must use text-[11.5px] on compact');
  assert.ok(inspectorSource.includes('min-h-[38px] lg:min-h-[28px]'), 'Inspector tabs must have min-h-[38px] on compact');
});

// ---------------------------------------------------------------------------
// 20. TopTelemetryBar Typography & Touch Targets
// ---------------------------------------------------------------------------
test('20. TopTelemetryBar OWNER PROJECTS and CONTACT use increased compact typography and touch targets', () => {
  const telemetrySource = readFileSync(resolve(process.cwd(), 'src/components/TopTelemetryBar.tsx'), 'utf8');
  assert.ok(telemetrySource.includes('text-[9.5px] lg:text-[7.5px]'), 'OWNER PROJECTS label must use text-[9.5px] on compact');
  assert.ok(telemetrySource.includes('text-[11.5px] lg:text-[9.5px]'), 'Public repos count must use text-[11.5px] on compact');
  assert.ok(telemetrySource.includes('min-h-[36px]'), 'Action buttons must have >= 36px touch targets on compact');
});
