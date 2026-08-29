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
