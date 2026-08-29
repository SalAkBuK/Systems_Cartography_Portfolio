import React, { useState, useEffect, useCallback } from 'react';
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
import { CaseStudyModal } from './components/CaseStudyModal';
import { ContactPage } from './components/ContactPage';
import { ResumeModal } from './components/ResumeModal';
import { GITHUB_SNAPSHOT, GITHUB_SNAPSHOT_METADATA } from './data/githubSnapshot.generated';
import { applyProjectLinkOverrides, resolveExperience, resolveGitHubSnapshotForTarget } from './utils/portfolioUtils';
import { Menu, X } from 'lucide-react';

export default function App() {
  const [activeView, setActiveView] = useState<ActiveView>('system_overview');

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

  const [projects] = useState<ProjectData[]>(() => {
    if (!configuredSnapshot?.projects) return [];
    return applyProjectLinkOverrides(configuredSnapshot.projects, PORTFOLIO_CONFIG.projectLinks);
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

  // Handle Project Selection
  const handleSelectProject = useCallback((id: string) => {
    setSelectedProjectId(id);
    setSelectedSkillId(null);
    setSelectedExperienceId(null);
    setSelectedSubsystem(null);
    setActiveView('projects');
  }, []);

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

  // Clear Selection (Deselect objects without altering viewport or active navigation view)
  const handleClearSelection = useCallback(() => {
    setSelectedProjectId(null);
    setSelectedSkillId(null);
    setSelectedExperienceId(null);
    setSelectedSubsystem(null);
    setDrilledProjectId(null);
  }, []);

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
    handleReturnToLandscape, 
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
            <ContactPage operator={operator} formEndpoint={PORTFOLIO_CONFIG.contactFormEndpoint} />
          ) : drilledProject ? (
            <ProjectSubsystemCanvas
              project={drilledProject}
              onReturnToLandscape={handleReturnToLandscape}
              selectedSubsystemId={selectedSubsystem?.id || null}
              onSelectSubsystem={(sub) => setSelectedSubsystem(sub)}
              onOpenCaseStudy={() => setIsCaseStudyOpen(true)}
            />
          ) : (
            <TopologyCanvas
              selectedProjectId={selectedProjectId}
              onSelectProject={handleSelectProject}
              onDrillIntoProject={handleDrillIntoProject}
              selectedSkillId={selectedSkillId}
              onSelectSkill={handleSelectSkill}
              selectedExperienceId={selectedExperienceId}
              searchQuery={searchQuery}
              topologyViewMode={topologyViewMode}
              viewport={viewport}
              setViewport={setViewport}
              projects={projects}
              skills={skills}
              experience={experience}
            />
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

      {/* Deep Dive Case Study Spec Modal */}
      <CaseStudyModal
        project={selectedProject}
        isOpen={isCaseStudyOpen}
        onClose={() => setIsCaseStudyOpen(false)}
        operator={operator}
      />

      {/* Technical Resume & Spec Modal */}
      <ResumeModal
        isOpen={isResumeOpen}
        onClose={() => setIsResumeOpen(false)}
        operator={operator}
        projects={projects}
        skills={skills}
        experience={experience}
      />
    </div>
  );
}
