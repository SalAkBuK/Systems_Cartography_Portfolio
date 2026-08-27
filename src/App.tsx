import React, { useState, useEffect, useCallback } from 'react';
import { 
  ActiveView, 
  SystemCategory, 
  ViewportState, 
  SubsystemNode,
  ProjectData,
  InfrastructureSkill,
  ExperienceNode,
  OperatorMetadata
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
import { connectGitHubTarget, GitHubSyncResult } from './services/githubService';
import { resolveExperience } from './utils/portfolioUtils';
import { Menu, X } from 'lucide-react';

const STORAGE_KEY_PROJECTS = 'sys_cartography_custom_projects';
const STORAGE_KEY_GITHUB_SOURCE = 'sys_cartography_github_source';
const STORAGE_KEY_SKILLS = 'sys_cartography_skills';
const STORAGE_KEY_EXPERIENCE = 'sys_cartography_experience';
const STORAGE_KEY_OPERATOR = 'sys_cartography_operator';
const STORAGE_KEY_SCHEMA_VERSION = 'sys_cartography_schema_version';
const CURRENT_STORAGE_SCHEMA_VERSION = `4:${PORTFOLIO_CONFIG.githubTarget.toLowerCase()}:${PORTFOLIO_CONFIG.siteId.toLowerCase()}`;

function migrateStoredPortfolio(): void {
  try {
    if (localStorage.getItem(STORAGE_KEY_SCHEMA_VERSION) === CURRENT_STORAGE_SCHEMA_VERSION) return;
    [
      STORAGE_KEY_PROJECTS,
      STORAGE_KEY_GITHUB_SOURCE,
      STORAGE_KEY_SKILLS,
      STORAGE_KEY_EXPERIENCE,
      STORAGE_KEY_OPERATOR,
      'sys_cartography_cv_source'
    ].forEach(key => localStorage.removeItem(key));
    localStorage.setItem(STORAGE_KEY_SCHEMA_VERSION, CURRENT_STORAGE_SCHEMA_VERSION);
  } catch {
    // Storage can be unavailable in private browsing contexts.
  }
}

export default function App() {
  migrateStoredPortfolio();
  const [activeView, setActiveView] = useState<ActiveView>('system_overview');

  useEffect(() => {
    document.title = PORTFOLIO_CONFIG.pageTitle;
    document.querySelector('meta[name="description"]')?.setAttribute('content', PORTFOLIO_CONFIG.metaDescription);
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', PORTFOLIO_CONFIG.pageTitle);
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', PORTFOLIO_CONFIG.metaDescription);
  }, []);

  // Public GitHub snapshot, cached locally for graceful read-only fallback.
  const [projects, setProjects] = useState<ProjectData[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PROJECTS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // fallback
    }
    return [];
  });

  const [skills, setSkills] = useState<InfrastructureSkill[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SKILLS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // fallback
    }
    return [];
  });

  const [experience, setExperience] = useState<ExperienceNode[]>(() => {
    if (PORTFOLIO_CONFIG.experience && PORTFOLIO_CONFIG.experience.length > 0) {
      return resolveExperience(PORTFOLIO_CONFIG.experience);
    }
    try {
      const saved = localStorage.getItem(STORAGE_KEY_EXPERIENCE);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return resolveExperience(undefined, parsed);
        }
      }
    } catch {
      // fallback
    }
    return [];
  });

  const [operator, setOperator] = useState<OperatorMetadata>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_OPERATOR);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.name) {
          return parsed;
        }
      }
    } catch {
      // fallback
    }
    return OPERATOR_METADATA;
  });

  const [gitHubSource, setGitHubSource] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_GITHUB_SOURCE) || null;
    } catch {
      return null;
    }
  });

  const [gitHubSyncState, setGitHubSyncState] = useState<'loading' | 'ready' | 'error'>('loading');

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [drilledProjectId, setDrilledProjectId] = useState<string | null>(null);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [selectedExperienceId, setSelectedExperienceId] = useState<string | null>(null);
  const [selectedSubsystem, setSelectedSubsystem] = useState<SubsystemNode | null>(null);
  
  const [selectedCategory, setSelectedCategory] = useState<SystemCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [traceModeActive, setTraceModeActive] = useState(true);
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

  // Public data is synchronized automatically from the configured GitHub target.
  const handleApplyGitHubSync = useCallback((result: GitHubSyncResult) => {
    const configuredOperator = PORTFOLIO_CONFIG.operator;
    const mergedOperator: OperatorMetadata = {
      ...result.operator,
      ...configuredOperator,
      primaryStack: result.operator.primaryStack.length > 0 ? result.operator.primaryStack : configuredOperator.primaryStack,
      commitsIndexed: 'Not indexed',
      productionUptime: 'Not claimed',
      contact: {
        ...result.operator.contact,
        ...configuredOperator.contact,
        github: configuredOperator.contact.github || result.operator.contact.github
      }
    };
    const resolvedExperience = resolveExperience(PORTFOLIO_CONFIG.experience, result.experience);
    setProjects(result.projects);
    setSkills(result.skills);
    setExperience(resolvedExperience);
    setGitHubSource(result.sourceIdentifier);
    setOperator(mergedOperator);
    try {
      localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(result.projects));
      localStorage.setItem(STORAGE_KEY_SKILLS, JSON.stringify(result.skills));
      localStorage.setItem(STORAGE_KEY_EXPERIENCE, JSON.stringify(resolvedExperience));
      localStorage.setItem(STORAGE_KEY_GITHUB_SOURCE, result.sourceIdentifier);
      localStorage.setItem(STORAGE_KEY_OPERATOR, JSON.stringify(mergedOperator));
    } catch {
      // Storage quota or private mode
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setGitHubSyncState('loading');
    connectGitHubTarget(PORTFOLIO_CONFIG.githubTarget)
      .then(result => {
        if (cancelled) return;
        handleApplyGitHubSync(result);
        setGitHubSyncState('ready');
      })
      .catch(() => {
        if (!cancelled) setGitHubSyncState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [handleApplyGitHubSync]);

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
      if (!selectedProjectId && projects.length > 0) setSelectedProjectId(projects[0].id);
      setSelectedSkillId(null);
      setSelectedExperienceId(null);
    } else if (view === 'experience') {
      // Neutral view: show Experience Dock without arbitrarily auto-selecting first employer
      setSelectedProjectId(null);
      setSelectedSkillId(null);
    } else if (view === 'infrastructure') {
      // Neutral view: show Technical Capabilities without arbitrarily auto-selecting first capability
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
      } else if (e.key === 't' || e.key === 'T') {
        setTraceModeActive(prev => !prev);
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
    drilledProjectId, 
    handleReturnToLandscape, 
    handleResetView
  ]);

  return (
    <div className="w-screen h-screen flex flex-col bg-[#D4CDA4] text-[#15150F] font-mono overflow-hidden select-none border-[6px] md:border-[10px] border-[#15150F]">
      {/* 1. Top Telemetry Bar */}
      <TopTelemetryBar
        setActiveView={handleNavViewChange}
        onResetView={handleResetView}
        onToggleTraceMode={() => setTraceModeActive(prev => !prev)}
        traceModeActive={traceModeActive}
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
      <div className="md:hidden flex items-center justify-between px-3 py-1.5 bg-[#CBC59B] border-b border-precision text-[10px]">
        <button
          onClick={() => setIsMobileNavOpen(prev => !prev)}
          className="flex items-center gap-1.5 font-bold uppercase tracking-wider bg-[#15150F] text-[#D4CDA4] px-2 py-1"
        >
          {isMobileNavOpen ? <X size={12} /> : <Menu size={12} />}
          <span>{isMobileNavOpen ? 'CLOSE INDEX' : 'SYSTEM INDEX'}</span>
        </button>
        <span className="font-bold text-[9px]">{operator.name.toUpperCase()} // TOPOLOGY</span>
      </div>

      {/* 2. Main Workplane Console Grid */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Left Navigation Rail */}
        <LeftNavigationRail
          activeView={activeView}
          setActiveView={handleNavViewChange}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
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
              onSelectExperience={handleSelectExperience}
              selectedCategory={selectedCategory}
              searchQuery={searchQuery}
              traceModeActive={traceModeActive}
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
          onDrillIntoProject={handleDrillIntoProject}
          onOpenCaseStudy={() => setIsCaseStudyOpen(true)}
          onOpenContact={() => handleNavViewChange('contact')}
          projects={projects}
          skills={skills}
          experience={experience}
          operator={operator}
        />}
      </div>

      {/* 3. Bottom Command & Operating Strip */}
      <BottomCommandStrip
        viewport={viewport}
        traceModeActive={traceModeActive}
        onToggleTraceMode={() => setTraceModeActive(prev => !prev)}
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
