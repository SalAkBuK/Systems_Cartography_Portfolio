import React, { useState, useEffect, useCallback, useRef, Suspense, lazy } from 'react';
import { 
  ActiveView, 
  ViewportState, 
  SubsystemNode,
  ProjectData,
  InfrastructureSkill,
  ExperienceNode,
  OperatorMetadata,
  TopologyViewMode
} from './types';
import {
  VERIFIED_OPERATOR_METADATA as OPERATOR_METADATA
} from './data/verifiedPortfolioData';
import { PORTFOLIO_CONFIG } from './config/portfolioConfig';
import { TopTelemetryBar } from './components/TopTelemetryBar';
import { LeftNavigationRail } from './components/LeftNavigationRail';
import { TopologyCanvas } from './components/TopologyCanvas';
import { ProjectSubsystemCanvas } from './components/ProjectSubsystemCanvas';
import { RightInspectorPanel } from './components/RightInspectorPanel';
import { BottomCommandStrip } from './components/BottomCommandStrip';
import { GITHUB_SNAPSHOT, GITHUB_SNAPSHOT_METADATA } from './data/githubSnapshot.generated';
import { resolveExperience, resolveGitHubSnapshotForTarget } from './utils/portfolioUtils';
import { projectIdStillPresent } from './utils/reconcileLiveRepositories';
import { useLiveGitHubInventory } from './hooks/useLiveGitHubInventory';
import { Menu, X } from 'lucide-react';

// Deferred: none of these three are needed for the initial topology render
// (case study / resume are modals opened on demand; contact is a secondary
// view reached via navigation). Each is mounted only once actually
// opened/entered below, so the dynamic import fires on first use, not on
// initial app load.
const CaseStudyModal = lazy(() => import('./components/CaseStudyModal').then(m => ({ default: m.CaseStudyModal })));
const ContactPage = lazy(() => import('./components/ContactPage').then(m => ({ default: m.ContactPage })));
const ResumeModal = lazy(() => import('./components/ResumeModal').then(m => ({ default: m.ResumeModal })));

/** Stable empty base so the live-inventory hook never re-seeds from a fresh array each render. */
const EMPTY_PROJECTS: ProjectData[] = [];

/** Minimal brutalist loading state for a deferred surface's Suspense boundary -- shown only for the brief window while its chunk downloads on first use. */
function DeferredSurfaceFallback({ variant }: { variant: 'modal' | 'page' }) {
  if (variant === 'page') {
    return (
      <div className="flex-1 flex items-center justify-center text-[11px] font-bold tracking-wider uppercase text-[#15150F]" aria-hidden="true">
        LOADING...
      </div>
    );
  }
  return (
    <div className="fixed inset-0 z-50 bg-[#15150F]/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6" aria-hidden="true">
      <div className="bg-[#D4CDA4] border-2 border-precision text-[#15150F] px-4 py-3 text-[11px] font-bold tracking-wider uppercase shadow-[8px_8px_0px_#15150F]">
        LOADING...
      </div>
    </div>
  );
}

export default function App() {
  const [activeView, setActiveView] = useState<ActiveView>('system_overview');

  // Runtime-only App-session authority for the production topology startup.
  // App remains mounted while Contact replaces TopologyCanvas, so claiming
  // here prevents a later canvas instance from replaying the ceremony. A full
  // page reload creates a fresh App instance (and therefore a fresh ref).
  const hasPlayedTopologyStartupRef = useRef(false);
  const claimTopologyStartup = useCallback(() => {
    if (hasPlayedTopologyStartupRef.current) {
      return false;
    }

    hasPlayedTopologyStartupRef.current = true;
    return true;
  }, []);

  useEffect(() => {
    document.title = PORTFOLIO_CONFIG.pageTitle;
    document.querySelector('meta[name="description"]')?.setAttribute('content', PORTFOLIO_CONFIG.metaDescription);
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', PORTFOLIO_CONFIG.pageTitle);
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', PORTFOLIO_CONFIG.metaDescription);
  }, []);

  // Pure snapshot resolution: owner-scoped
  const configuredSnapshot = resolveGitHubSnapshotForTarget(
    PORTFOLIO_CONFIG.githubTarget,
    GITHUB_SNAPSHOT_METADATA,
    GITHUB_SNAPSHOT
  );

  // The committed snapshot renders IMMEDIATELY (synchronous initial value).
  // After mount, a single same-origin /api/github-live request reconciles the
  // CURRENT public repository inventory (repos created / renamed / deleted /
  // archived / made private). Any live failure keeps the snapshot projects
  // untouched. This path never imports the heavy per-repository deep-inspection
  // pipeline -- it calls the lightweight same-origin /api/github-live endpoint.
  const {
    projects,
    status: liveInventoryStatus,
    lastRefreshedAt: liveInventoryRefreshedAt,
    liveRepositoryCount,
    renderedProjectCount,
    isRefreshing: liveInventoryRefreshing,
    refresh: refreshLiveInventory,
  } = useLiveGitHubInventory({
    snapshotProjects: configuredSnapshot?.projects ?? EMPTY_PROJECTS,
    projectLinks: PORTFOLIO_CONFIG.projectLinks,
    configuredGithubTarget: PORTFOLIO_CONFIG.githubTarget,
    enabled: Boolean(configuredSnapshot),
  });
  const [skills] = useState<InfrastructureSkill[]>(() => configuredSnapshot?.skills || []);
  const [experience] = useState<ExperienceNode[]>(() => 
    resolveExperience(PORTFOLIO_CONFIG.experience, configuredSnapshot?.experience)
  );

  const [operator] = useState<OperatorMetadata>(() => {
    const configuredOperator = PORTFOLIO_CONFIG.operator;
    if (!configuredSnapshot) return configuredOperator;
    return {
      ...configuredSnapshot.operator,
      ...configuredOperator,
      primaryStack: configuredSnapshot.operator.primaryStack.length > 0 ? configuredSnapshot.operator.primaryStack : configuredOperator.primaryStack,
      commitsIndexed: 'Not indexed',
      productionUptime: 'Not claimed',
      contact: {
        ...configuredSnapshot.operator.contact,
        ...configuredOperator.contact,
        github: configuredOperator.contact.github || configuredSnapshot.operator.contact.github
      }
    };
  });

  const gitHubSource = configuredSnapshot?.sourceIdentifier || null;
  const gitHubSyncState = configuredSnapshot ? 'ready' : 'mismatch';

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [drilledProjectId, setDrilledProjectId] = useState<string | null>(null);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [selectedExperienceId, setSelectedExperienceId] = useState<string | null>(null);
  const [selectedSubsystem, setSelectedSubsystem] = useState<SubsystemNode | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [topologyViewMode, setTopologyViewMode] = useState<TopologyViewMode>('systems');
  const [viewport, setViewport] = useState<ViewportState>({ x: 0, y: 0, zoom: 1 });

  // Modal States
  const [isCaseStudyOpen, setIsCaseStudyOpen] = useState(false);
  const [isResumeOpen, setIsResumeOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  // Selected Objects
  const selectedProject = selectedProjectId ? projects.find(p => p.id === selectedProjectId) || null : null;
  const drilledProject = drilledProjectId ? projects.find(p => p.id === drilledProjectId) || null : null;
  const selectedSkill = selectedSkillId ? skills.find(s => s.id === selectedSkillId) || null : null;
  const selectedExperience = selectedExperienceId ? experience.find(e => e.id === selectedExperienceId) || null : null;

  // Clear Selection (Deselect objects without altering viewport or active navigation view)
  const handleClearSelection = useCallback(() => {
    setSelectedProjectId(null);
    setSelectedSkillId(null);
    setSelectedExperienceId(null);
    setSelectedSubsystem(null);
    setDrilledProjectId(null);
  }, []);

  // Handle Project Selection
  const handleSelectProject = useCallback((id: string) => {
    if (selectedProjectId === id) {
      handleClearSelection();
      return;
    }

    setSelectedProjectId(id);
    setSelectedSkillId(null);
    setSelectedExperienceId(null);
    setSelectedSubsystem(null);
    setActiveView('projects');
  }, [selectedProjectId, handleClearSelection]);

  // Handle Drilling into Project Subsystem Decomposition
  const handleDrillIntoProject = useCallback((id: string) => {
    setSelectedProjectId(id);
    setDrilledProjectId(id);
    setSelectedSkillId(null);
    setSelectedExperienceId(null);
    setSelectedSubsystem(null);
  }, []);

  // Return to global landscape from decomposed view
  const handleReturnToLandscape = useCallback(() => {
    setDrilledProjectId(null);
    setSelectedSubsystem(null);
  }, []);

  // Handle Skill Selection (with click-again toggle to clear)
  const handleSelectSkill = useCallback((id: string) => {
    if (selectedSkillId === id) {
      setSelectedSkillId(null);
      return;
    }
    setSelectedSkillId(id);
    setSelectedProjectId(null);
    setDrilledProjectId(null);
    setSelectedExperienceId(null);
    setSelectedSubsystem(null);
    setActiveView('infrastructure');
  }, [selectedSkillId]);

  // Handle Experience Selection (with click-again toggle to clear)
  const handleSelectExperience = useCallback((id: string) => {
    if (selectedExperienceId === id) {
      setSelectedExperienceId(null);
      return;
    }
    setSelectedExperienceId(id);
    setSelectedProjectId(null);
    setDrilledProjectId(null);
    setSelectedSkillId(null);
    setSelectedSubsystem(null);
    setActiveView('experience');
  }, [selectedExperienceId]);

  // Reset View
  const handleResetView = useCallback(() => {
    setViewport({ x: 0, y: 0, zoom: 1 });
    setSelectedProjectId(null);
    setDrilledProjectId(null);
    setSelectedSkillId(null);
    setSelectedExperienceId(null);
    setSelectedSubsystem(null);
  }, []);

  // Handle View Changes from Navigation (Neutral Tab Switching)
  const handleNavViewChange = (view: ActiveView) => {
    setActiveView(view);
    setDrilledProjectId(null);

    if (view === 'system_overview') {
      setSelectedProjectId(null);
      setSelectedSkillId(null);
      setSelectedExperienceId(null);
      setViewport({ x: 0, y: 0, zoom: 1 });
    } else if (view === 'identity') {
      setSelectedProjectId(null);
      setSelectedSkillId(null);
      setSelectedExperienceId(null);
    } else if (view === 'projects') {
      setTopologyViewMode('systems');
      setSelectedProjectId(null);
      setSelectedSkillId(null);
      setSelectedExperienceId(null);
    } else if (view === 'experience') {
      // Neutral view: show Professional Experience index without arbitrarily auto-selecting the first record
      setSelectedProjectId(null);
      setSelectedSkillId(null);
    } else if (view === 'infrastructure') {
      setTopologyViewMode('capabilities');
      setSelectedProjectId(null);
      setSelectedExperienceId(null);
    } else if (view === 'contact') {
      setSelectedProjectId(null);
      setSelectedSkillId(null);
      setSelectedExperienceId(null);
    }
  };

  // If a live reconciliation removes a project that is currently selected or
  // drilled into, clear that stale reference so the inspector / subsystem view
  // can never strand on a project that no longer exists.
  useEffect(() => {
    if (!projectIdStillPresent(projects, selectedProjectId)) {
      setSelectedProjectId(null);
    }
    if (!projectIdStillPresent(projects, drilledProjectId)) {
      setDrilledProjectId(null);
      setSelectedSubsystem(null);
    }
  }, [projects, selectedProjectId, drilledProjectId]);

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid firing when typing in input or textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key === 'Escape') {
        if (isCaseStudyOpen) {
          setIsCaseStudyOpen(false);
        } else if (isResumeOpen) {
          setIsResumeOpen(false);
        } else if (isMobileNavOpen) {
          setIsMobileNavOpen(false);
        } else if (drilledProjectId) {
          handleReturnToLandscape();
        } else if (selectedProjectId || selectedSkillId || selectedExperienceId || selectedSubsystem) {
          handleClearSelection();
        } else {
          handleResetView();
        }
      } else if (e.key === '0') {
        setViewport({ x: 0, y: 0, zoom: 1 });
      } else if (e.key === '+' || e.key === '=') {
        setViewport(prev => ({ ...prev, zoom: Math.min(prev.zoom + 0.15, 2.5) }));
      } else if (e.key === '-' || e.key === '_') {
        setViewport(prev => ({ ...prev, zoom: Math.max(prev.zoom - 0.15, 0.45) }));
      } else if (e.key === 'r' || e.key === 'R') {
        setIsResumeOpen(true);
      } else if (e.key === 'c' || e.key === 'C') {
        handleNavViewChange('contact');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isCaseStudyOpen, 
    isResumeOpen, 
    isMobileNavOpen,
    drilledProjectId,
    selectedProjectId,
    selectedSkillId,
    selectedExperienceId,
    selectedSubsystem,
    handleReturnToLandscape,
    handleClearSelection,
    handleResetView
  ]);

  return (
    <div className="w-screen h-screen flex flex-col bg-[#D4CDA4] text-[#15150F] font-mono overflow-hidden select-none border-[6px] lg:border-[10px] border-[#15150F]">
      {/* 1. Top Telemetry Bar */}
      <TopTelemetryBar
        setActiveView={handleNavViewChange}
        onResetView={handleResetView}
        onOpenContact={() => handleNavViewChange('contact')}
        onOpenResume={() => setIsResumeOpen(true)}
        activeProjectsCount={projects.length}
        gitHubSource={gitHubSource}
        gitHubUrl={operator.contact.github}
        siteId={PORTFOLIO_CONFIG.siteId}
        templateRepositoryUrl={PORTFOLIO_CONFIG.templateRepositoryUrl}
        syncState={gitHubSyncState}
        liveSync={{
          available: Boolean(configuredSnapshot),
          status: liveInventoryStatus,
          lastRefreshedAt: liveInventoryRefreshedAt,
          liveRepositoryCount,
          renderedProjectCount,
          isRefreshing: liveInventoryRefreshing,
          onRefresh: refreshLiveInventory,
        }}
      />

      {/* Mobile Drawer Trigger Bar */}
      <div className="lg:hidden flex items-center justify-between px-3 py-1.5 bg-[#CBC59B] border-b border-[#15150F] text-[11px]">
        <button
          type="button"
          aria-expanded={isMobileNavOpen}
          aria-controls="system-index-navigation"
          onClick={() => setIsMobileNavOpen(prev => !prev)}
          className="flex items-center gap-1.5 font-bold uppercase tracking-wider bg-[#15150F] text-[#D4CDA4] px-3 py-2 text-[12px] min-h-[42px] cursor-pointer"
        >
          {isMobileNavOpen ? <X size={14} /> : <Menu size={14} />}
          <span>{isMobileNavOpen ? 'CLOSE INDEX' : 'SYSTEM INDEX'}</span>
        </button>
        <span className="font-bold text-[11px] truncate max-w-[200px] sm:max-w-none">{operator.name.toUpperCase()} // TOPOLOGY</span>
      </div>

      {/* 2. Main Workplane Console Grid */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Compact Navigation Backdrop (Closes Drawer on Outside Tap) */}
        {isMobileNavOpen && (
          <button
            type="button"
            aria-label="Close system index"
            onClick={() => setIsMobileNavOpen(false)}
            className="fixed inset-0 z-40 bg-[#15150F]/40 lg:hidden cursor-pointer"
          />
        )}

        {/* Left Navigation Rail */}
        <LeftNavigationRail
          activeView={activeView}
          setActiveView={handleNavViewChange}
          topologyViewMode={topologyViewMode}
          setTopologyViewMode={setTopologyViewMode}
          selectedProjectId={selectedProjectId}
          onSelectProject={handleSelectProject}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          isMobileOpen={isMobileNavOpen}
          setIsMobileOpen={setIsMobileNavOpen}
          projects={projects}
          skills={skills}
          experience={experience}
          templateRepositoryUrl={PORTFOLIO_CONFIG.templateRepositoryUrl}
        />

        {/* Central Spatial Landscape / Decomposed Subsystem View */}
        <main className="flex-1 flex flex-col relative overflow-hidden bg-[#D4CDA4]">
          {activeView === 'contact' ? (
            <Suspense fallback={<DeferredSurfaceFallback variant="page" />}>
              <ContactPage operator={operator} formEndpoint={PORTFOLIO_CONFIG.contactFormEndpoint} />
            </Suspense>
          ) : (
            <>
              {/* TopologyCanvas stays mounted, full-size, and layout-
                  measurable for the entire topology/project lifetime —
                  drilling into a project's subsystem view must never unmount
                  it, or every piece of its runtime-only visitor layout state
                  (detached positions, interactiveOrbitOrder, custom skill
                  positions, orbit rate/phase, grid snap) is lost on the way
                  back. It is hidden purely VISUALLY (invisible +
                  pointer-events-none) while drilled in, never via
                  display:none/`hidden` — TopologyCanvas's own ResizeObserver
                  reads containerRef.current.clientWidth/clientHeight to
                  derive isCompactViewport, and isCompact is itself an
                  autonomous-orbit pause authority, so collapsing it to 0x0
                  would silently pause the continuous machine while the
                  schematic is open. `absolute inset-0` keeps its real box
                  (and thus real measured dimensions) unchanged throughout;
                  only opacity/hit-testing/focusability change. Returning
                  simply reveals the SAME instance again. */}
              <div
                className={`absolute inset-0 ${drilledProject ? 'invisible pointer-events-none' : 'visible'}`}
                inert={Boolean(drilledProject)}
                aria-hidden={drilledProject ? true : undefined}
              >
                <TopologyCanvas
                  selectedProjectId={selectedProjectId}
                  onSelectProject={handleSelectProject}
                  onDrillIntoProject={handleDrillIntoProject}
                  selectedSkillId={selectedSkillId}
                  onSelectSkill={handleSelectSkill}
                  selectedExperienceId={selectedExperienceId}
                  onClearSelection={handleClearSelection}
                  searchQuery={searchQuery}
                  topologyViewMode={topologyViewMode}
                  viewport={viewport}
                  setViewport={setViewport}
                  projects={projects}
                  skills={skills}
                  experience={experience}
                  claimTopologyStartup={claimTopologyStartup}
                />
              </div>
              {drilledProject && (
                <div className="absolute inset-0 z-10">
                  <ProjectSubsystemCanvas
                    project={drilledProject}
                    onReturnToLandscape={handleReturnToLandscape}
                    selectedSubsystemId={selectedSubsystem?.id || null}
                    onSelectSubsystem={(sub) => setSelectedSubsystem(sub)}
                    onOpenCaseStudy={() => setIsCaseStudyOpen(true)}
                  />
                </div>
              )}
            </>
          )}
        </main>

        {/* Right Contextual Inspector Panel */}
        {activeView !== 'contact' && <RightInspectorPanel
          activeView={activeView}
          selectedProject={selectedProject}
          selectedSkill={selectedSkill}
          selectedExperience={selectedExperience}
          selectedSubsystem={selectedSubsystem}
          onSelectProject={handleSelectProject}
          onSelectSkill={handleSelectSkill}
          onSelectExperience={handleSelectExperience}
          onDrillIntoProject={handleDrillIntoProject}
          onOpenCaseStudy={() => setIsCaseStudyOpen(true)}
          onOpenContact={() => handleNavViewChange('contact')}
          onClearSelection={handleClearSelection}
          projects={projects}
          skills={skills}
          experience={experience}
          operator={operator}
        />}
      </div>

      {/* 3. Bottom Command & Operating Strip */}
      <BottomCommandStrip
        viewport={viewport}
        topologyViewMode={topologyViewMode}
        selectedProjectId={selectedProjectId}
        onResetView={handleResetView}
        onOpenResume={() => setIsResumeOpen(true)}
        onOpenContact={() => handleNavViewChange('contact')}
        operatorName={operator.name}
        operatorLocation={operator.location}
        operatorLinkedin={operator.contact.linkedin}
      />

      {/* Deep Dive Case Study Spec Modal -- mounted (and its chunk fetched)
          only once actually opened; closing unmounts it again since it has
          no exit animation or state worth preserving across opens (its own
          `if (!isOpen) return null` already made open/closed instant). */}
      {isCaseStudyOpen && (
        <Suspense fallback={<DeferredSurfaceFallback variant="modal" />}>
          <CaseStudyModal
            project={selectedProject}
            isOpen={isCaseStudyOpen}
            onClose={() => setIsCaseStudyOpen(false)}
            operator={operator}
          />
        </Suspense>
      )}

      {/* Technical Resume & Spec Modal -- same on-demand mount as above. */}
      {isResumeOpen && (
        <Suspense fallback={<DeferredSurfaceFallback variant="modal" />}>
          <ResumeModal
            isOpen={isResumeOpen}
            onClose={() => setIsResumeOpen(false)}
            operator={operator}
            projects={projects}
            skills={skills}
            experience={experience}
          />
        </Suspense>
      )}
    </div>
  );
}
