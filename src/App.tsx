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
  VERIFIED_ARCHITECTURE_PRINCIPLES as ARCHITECTURE_PRINCIPLES,
  VERIFIED_EXPERIENCE as EXPERIENCE_HISTORY,
  VERIFIED_OPERATOR_METADATA as OPERATOR_METADATA,
  VERIFIED_PROJECTS as PROJECTS,
  VERIFIED_SKILLS as INFRASTRUCTURE_SKILLS
} from './data/verifiedPortfolioData';
import { mergePortfolioProjects } from './services/portfolioMergeService';
import { TopTelemetryBar } from './components/TopTelemetryBar';
import { LeftNavigationRail } from './components/LeftNavigationRail';
import { TopologyCanvas } from './components/TopologyCanvas';
import { ProjectSubsystemCanvas } from './components/ProjectSubsystemCanvas';
import { RightInspectorPanel } from './components/RightInspectorPanel';
import { BottomCommandStrip } from './components/BottomCommandStrip';
import { CaseStudyModal } from './components/CaseStudyModal';
import { ContactInterfaceModal } from './components/ContactInterfaceModal';
import { ResumeModal } from './components/ResumeModal';
import { GitHubConnectModal } from './components/GitHubConnectModal';
import { CVUploadModal } from './components/CVUploadModal';
import { GitHubSyncResult } from './services/githubService';
import { ParsedCVSyncResult } from './services/cvParserService';
import { Menu, X } from 'lucide-react';

const STORAGE_KEY_PROJECTS = 'sys_cartography_custom_projects';
const STORAGE_KEY_GITHUB_SOURCE = 'sys_cartography_github_source';
const STORAGE_KEY_SKILLS = 'sys_cartography_skills';
const STORAGE_KEY_EXPERIENCE = 'sys_cartography_experience';
const STORAGE_KEY_OPERATOR = 'sys_cartography_operator';
const STORAGE_KEY_CV_SOURCE = 'sys_cartography_cv_source';
const STORAGE_KEY_SCHEMA_VERSION = 'sys_cartography_schema_version';
const CURRENT_STORAGE_SCHEMA_VERSION = '3';

function migrateStoredPortfolio(): void {
  try {
    if (localStorage.getItem(STORAGE_KEY_SCHEMA_VERSION) === CURRENT_STORAGE_SCHEMA_VERSION) return;
    [
      STORAGE_KEY_PROJECTS,
      STORAGE_KEY_GITHUB_SOURCE,
      STORAGE_KEY_SKILLS,
      STORAGE_KEY_EXPERIENCE,
      STORAGE_KEY_OPERATOR,
      STORAGE_KEY_CV_SOURCE
    ].forEach(key => localStorage.removeItem(key));
    localStorage.setItem(STORAGE_KEY_SCHEMA_VERSION, CURRENT_STORAGE_SCHEMA_VERSION);
  } catch {
    // Storage can be unavailable in private browsing contexts.
  }
}

export default function App() {
  migrateStoredPortfolio();
  const [activeView, setActiveView] = useState<ActiveView>('system_overview');

  // Dynamic projects state (loaded from local storage if previously synced, else default flagship projects)
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
    return PROJECTS;
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
    return INFRASTRUCTURE_SKILLS;
  });

  const [experience, setExperience] = useState<ExperienceNode[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_EXPERIENCE);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // fallback
    }
    return EXPERIENCE_HISTORY;
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

  const [cvSource, setCvSource] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_CV_SOURCE) || null;
    } catch {
      return null;
    }
  });

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [drilledProjectId, setDrilledProjectId] = useState<string | null>(null);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [selectedExperienceId, setSelectedExperienceId] = useState<string | null>(null);
  const [selectedSubsystem, setSelectedSubsystem] = useState<SubsystemNode | null>(null);
  const [selectedPrincipleId, setSelectedPrincipleId] = useState<string | null>(null);
  
  const [selectedCategory, setSelectedCategory] = useState<SystemCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [traceModeActive, setTraceModeActive] = useState(true);
  const [viewport, setViewport] = useState<ViewportState>({ x: 0, y: 0, zoom: 1 });

  // Modal States
  const [isCaseStudyOpen, setIsCaseStudyOpen] = useState(false);
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [isResumeOpen, setIsResumeOpen] = useState(false);
  const [isGitHubModalOpen, setIsGitHubModalOpen] = useState(false);
  const [isCVModalOpen, setIsCVModalOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  // Selected Objects
  const selectedProject = selectedProjectId ? projects.find(p => p.id === selectedProjectId) || null : null;
  const drilledProject = drilledProjectId ? projects.find(p => p.id === drilledProjectId) || null : null;
  const selectedSkill = selectedSkillId ? skills.find(s => s.id === selectedSkillId) || null : null;
  const selectedExperience = selectedExperienceId ? experience.find(e => e.id === selectedExperienceId) || null : null;
  const selectedPrinciple = selectedPrincipleId ? ARCHITECTURE_PRINCIPLES.find(pr => pr.id === selectedPrincipleId) || null : null;

  // GitHub Sync Handlers
  const handleApplyGitHubSync = useCallback((result: GitHubSyncResult) => {
    const mergedOperator: OperatorMetadata = {
      ...result.operator,
      name: operator.name,
      handle: operator.handle,
      role: operator.role,
      location: operator.location,
      focus: operator.focus,
      yearsActive: operator.yearsActive,
      commitsIndexed: 'Not indexed',
      productionUptime: 'Not claimed',
      systemManifesto: operator.systemManifesto,
      contact: {
        ...result.operator.contact,
        ...operator.contact,
        github: result.operator.contact.github || operator.contact.github
      }
    };
    const mergedProjects = cvSource ? mergePortfolioProjects(projects, result.projects) : result.projects;
    setProjects(mergedProjects);
    setGitHubSource(result.sourceIdentifier);
    setOperator(mergedOperator);
    try {
      localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(mergedProjects));
      localStorage.setItem(STORAGE_KEY_GITHUB_SOURCE, result.sourceIdentifier);
      localStorage.setItem(STORAGE_KEY_OPERATOR, JSON.stringify(mergedOperator));
    } catch {
      // Storage quota or private mode
    }
    if (mergedProjects.length > 0) {
      setSelectedProjectId(mergedProjects[0].id);
      setActiveView('projects');
    }
    setDrilledProjectId(null);
  }, [cvSource, operator, projects]);

  // CV / Resume Sync Handlers
  const handleApplyCVSync = useCallback((result: ParsedCVSyncResult) => {
    const mergedProjects = gitHubSource
      ? mergePortfolioProjects(result.projects, projects)
      : result.projects;

    setProjects(mergedProjects);
    setSkills(result.skills);
    setExperience(result.experience);
    setOperator(result.operator);
    setCvSource(result.sourceDocument);

    try {
      localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(mergedProjects));
      localStorage.setItem(STORAGE_KEY_SKILLS, JSON.stringify(result.skills));
      localStorage.setItem(STORAGE_KEY_EXPERIENCE, JSON.stringify(result.experience));
      localStorage.setItem(STORAGE_KEY_OPERATOR, JSON.stringify(result.operator));
      localStorage.setItem(STORAGE_KEY_CV_SOURCE, result.sourceDocument);
    } catch {
      // Storage quota or private mode
    }

    if (result.projects.length > 0) {
      setSelectedProjectId(result.projects[0].id);
      setActiveView('projects');
    }
    setDrilledProjectId(null);
  }, [gitHubSource, projects]);

  const handleResetToDefaultProjects = useCallback(() => {
    setProjects(PROJECTS);
    setSkills(INFRASTRUCTURE_SKILLS);
    setExperience(EXPERIENCE_HISTORY);
    setOperator(OPERATOR_METADATA);
    setGitHubSource(null);
    setCvSource(null);
    try {
      localStorage.removeItem(STORAGE_KEY_PROJECTS);
      localStorage.removeItem(STORAGE_KEY_GITHUB_SOURCE);
      localStorage.removeItem(STORAGE_KEY_SKILLS);
      localStorage.removeItem(STORAGE_KEY_EXPERIENCE);
      localStorage.removeItem(STORAGE_KEY_OPERATOR);
      localStorage.removeItem(STORAGE_KEY_CV_SOURCE);
    } catch {
      // storage
    }
    setSelectedProjectId(PROJECTS[0].id);
    setDrilledProjectId(null);
  }, []);

  // Handle Project Selection
  const handleSelectProject = useCallback((id: string) => {
    setSelectedProjectId(id);
    setSelectedSkillId(null);
    setSelectedExperienceId(null);
    setSelectedPrincipleId(null);
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

  // Handle Skill Selection
  const handleSelectSkill = useCallback((id: string) => {
    setSelectedSkillId(id);
    setSelectedProjectId(null);
    setDrilledProjectId(null);
    setSelectedExperienceId(null);
    setSelectedPrincipleId(null);
    setSelectedSubsystem(null);
    setActiveView('infrastructure');
  }, []);

  // Handle Experience Selection
  const handleSelectExperience = useCallback((id: string) => {
    setSelectedExperienceId(id);
    setSelectedProjectId(null);
    setDrilledProjectId(null);
    setSelectedSkillId(null);
    setSelectedPrincipleId(null);
    setSelectedSubsystem(null);
    setActiveView('experience');
  }, []);

  // Handle Principle Selection
  const handleSelectPrinciple = useCallback((id: string) => {
    setSelectedPrincipleId(id);
    setSelectedProjectId(null);
    setDrilledProjectId(null);
    setSelectedSkillId(null);
    setSelectedExperienceId(null);
    setSelectedSubsystem(null);
    setActiveView('process');
  }, []);

  // Reset View
  const handleResetView = useCallback(() => {
    setViewport({ x: 0, y: 0, zoom: 1 });
    setSelectedProjectId(null);
    setDrilledProjectId(null);
    setSelectedSkillId(null);
    setSelectedExperienceId(null);
    setSelectedPrincipleId(null);
    setSelectedSubsystem(null);
  }, []);

  // Handle View Changes from Navigation
  const handleNavViewChange = (view: ActiveView) => {
    setActiveView(view);
    setDrilledProjectId(null);

    if (view === 'system_overview') {
      setSelectedProjectId(null);
      setSelectedSkillId(null);
      setSelectedExperienceId(null);
      setSelectedPrincipleId(null);
      setViewport({ x: 0, y: 0, zoom: 1 });
    } else if (view === 'identity') {
      setSelectedProjectId(null);
      setSelectedSkillId(null);
      setSelectedExperienceId(null);
      setSelectedPrincipleId(null);
    } else if (view === 'projects') {
      if (!selectedProjectId && projects.length > 0) setSelectedProjectId(projects[0].id);
      setSelectedSkillId(null);
      setSelectedExperienceId(null);
      setSelectedPrincipleId(null);
    } else if (view === 'experience') {
      if (!selectedExperienceId && experience.length > 0) setSelectedExperienceId(experience[0].id);
      setSelectedProjectId(null);
      setSelectedSkillId(null);
      setSelectedPrincipleId(null);
    } else if (view === 'infrastructure') {
      if (!selectedSkillId && skills.length > 0) setSelectedSkillId(skills[0].id);
      setSelectedProjectId(null);
      setSelectedExperienceId(null);
      setSelectedPrincipleId(null);
    } else if (view === 'process') {
      if (!selectedPrincipleId) setSelectedPrincipleId(ARCHITECTURE_PRINCIPLES[0].id);
      setSelectedProjectId(null);
      setSelectedSkillId(null);
      setSelectedExperienceId(null);
    } else if (view === 'contact') {
      setIsContactOpen(true);
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
        if (isCVModalOpen) {
          setIsCVModalOpen(false);
        } else if (isGitHubModalOpen) {
          setIsGitHubModalOpen(false);
        } else if (isCaseStudyOpen) {
          setIsCaseStudyOpen(false);
        } else if (isContactOpen) {
          setIsContactOpen(false);
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
        setIsContactOpen(true);
      } else if (e.key === 'u' || e.key === 'U') {
        setIsCVModalOpen(true);
      } else if (e.key === 'g' || e.key === 'G') {
        if (e.altKey || e.metaKey) {
          setIsGitHubModalOpen(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isCVModalOpen,
    isGitHubModalOpen,
    isCaseStudyOpen, 
    isContactOpen, 
    isResumeOpen, 
    drilledProjectId, 
    handleReturnToLandscape, 
    handleResetView
  ]);

  return (
    <div className="w-screen h-screen flex flex-col bg-[#D4CDA4] text-[#15150F] font-mono overflow-hidden select-none border-[6px] md:border-[10px] border-[#15150F]">
      {/* 1. Top Telemetry Bar */}
      <TopTelemetryBar
        activeView={activeView}
        setActiveView={handleNavViewChange}
        selectedProjectId={selectedProjectId}
        onResetView={handleResetView}
        onToggleTraceMode={() => setTraceModeActive(prev => !prev)}
        traceModeActive={traceModeActive}
        onOpenContact={() => setIsContactOpen(true)}
        onOpenResume={() => setIsResumeOpen(true)}
        onOpenGitHubSync={() => setIsGitHubModalOpen(true)}
        onOpenCVUpload={() => setIsCVModalOpen(true)}
        activeProjectsCount={projects.length}
        gitHubSource={gitHubSource}
        cvSource={cvSource}
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
          onOpenGitHubSync={() => setIsGitHubModalOpen(true)}
          onOpenCVUpload={() => setIsCVModalOpen(true)}
          gitHubSource={gitHubSource}
          cvSource={cvSource}
        />

        {/* Central Spatial Landscape / Decomposed Subsystem View */}
        <main className="flex-1 flex flex-col relative overflow-hidden bg-[#D4CDA4]">
          {drilledProject ? (
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
        <RightInspectorPanel
          selectedProject={selectedProject}
          selectedSkill={selectedSkill}
          selectedExperience={selectedExperience}
          selectedSubsystem={selectedSubsystem}
          selectedPrinciple={selectedPrinciple}
          onSelectProject={handleSelectProject}
          onSelectSkill={handleSelectSkill}
          onDrillIntoProject={handleDrillIntoProject}
          onOpenCaseStudy={() => setIsCaseStudyOpen(true)}
          onOpenContact={() => setIsContactOpen(true)}
          projects={projects}
          skills={skills}
          experience={experience}
          operator={operator}
        />
      </div>

      {/* 3. Bottom Command & Operating Strip */}
      <BottomCommandStrip
        viewport={viewport}
        traceModeActive={traceModeActive}
        onToggleTraceMode={() => setTraceModeActive(prev => !prev)}
        selectedProjectId={selectedProjectId}
        onResetView={handleResetView}
        onOpenResume={() => setIsResumeOpen(true)}
        onOpenContact={() => setIsContactOpen(true)}
        operatorName={operator.name}
        operatorLocation={operator.location}
      />

      {/* CV / Resume Ingestion Modal */}
      <CVUploadModal
        isOpen={isCVModalOpen}
        onClose={() => setIsCVModalOpen(false)}
        onApplyCVSync={handleApplyCVSync}
        onResetToDefault={handleResetToDefaultProjects}
        currentOperator={operator}
      />

      {/* GitHub Sync Modal */}
      <GitHubConnectModal
        isOpen={isGitHubModalOpen}
        onClose={() => setIsGitHubModalOpen(false)}
        onApplySync={handleApplyGitHubSync}
        onResetToDefault={handleResetToDefaultProjects}
        currentSync={gitHubSource ? {
          sourceType: 'user',
          sourceIdentifier: gitHubSource,
          user: null,
          projects: projects,
          skills: skills,
          operator: operator,
          experience: experience,
          rawCount: projects.length
        } : null}
      />

      {/* Deep Dive Case Study Spec Modal */}
      <CaseStudyModal
        project={selectedProject}
        isOpen={isCaseStudyOpen}
        onClose={() => setIsCaseStudyOpen(false)}
        operator={operator}
      />

      {/* External Contact Interface Modal */}
      <ContactInterfaceModal
        isOpen={isContactOpen}
        onClose={() => setIsContactOpen(false)}
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
        onOpenCVUpload={() => setIsCVModalOpen(true)}
      />
    </div>
  );
}
