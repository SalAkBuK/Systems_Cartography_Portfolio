import React, { useState } from 'react';
import { 
  Terminal, 
  Layers, 
  Cpu, 
  ExternalLink, 
  FileText, 
  Github, 
  ShieldCheck, 
  Activity, 
  ChevronRight,
  Code2,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  Info,
  Flame,
  Check,
  Search,
  Workflow,
  Radio
} from 'lucide-react';
import { 
  ActiveView,
  ProjectData, 
  InfrastructureSkill, 
  ExperienceNode, 
  SubsystemNode,
  OperatorMetadata,
  EvidenceProvenance
} from '../types';
import {
  VERIFIED_ARCHITECTURE_PRINCIPLES,
  VERIFIED_EXPERIENCE as EXPERIENCE_HISTORY,
  VERIFIED_OPERATOR_METADATA as OPERATOR_METADATA,
  VERIFIED_PROJECTS as PROJECTS,
  VERIFIED_SKILLS as INFRASTRUCTURE_SKILLS
} from '../data/verifiedPortfolioData';
import { groupExperienceByProgression, resolveProjectFromEvidenceKey } from '../utils/portfolioUtils';
import { 
  projectUsesCapability, 
  getCapabilityProfessionalHistory, 
  getCapabilityCoreTechnology 
} from '../utils/capabilityAssociations';

export const ProvenanceBadge: React.FC<{ provenance?: EvidenceProvenance }> = ({ provenance = 'VERIFIED' }) => {
  if (provenance === 'CURATED') {
    return (
      <span className="text-[9.5px] lg:text-[7px] font-bold px-1.5 py-0.5 bg-[#E2A96B] text-[#15150F] border border-[#15150F] tracking-wider uppercase inline-block">
        CURATED
      </span>
    );
  }
  if (provenance === 'DERIVED') {
    return (
      <span className="text-[9.5px] lg:text-[7px] font-bold px-1.5 py-0.5 bg-[#8EA9DA] text-[#15150F] border border-[#15150F] tracking-wider uppercase inline-block">
        DERIVED
      </span>
    );
  }
  if (provenance === 'UNAVAILABLE') {
    return (
      <span className="text-[9.5px] lg:text-[7px] font-bold px-1.5 py-0.5 bg-[#7A3E2E] text-[#D4CDA4] border border-[#15150F] tracking-wider uppercase inline-block">
        UNAVAILABLE
      </span>
    );
  }
  return (
    <span className="text-[9.5px] lg:text-[7px] font-bold px-1.5 py-0.5 bg-[#15150F] text-[#C3E54E] border border-[#15150F] tracking-wider uppercase inline-block">
      VERIFIED
    </span>
  );
};

interface RightInspectorPanelProps {
  activeView?: ActiveView;
  selectedProject: ProjectData | null;
  selectedSkill: InfrastructureSkill | null;
  selectedExperience: ExperienceNode | null;
  selectedSubsystem: SubsystemNode | null;
  onSelectProject: (id: string) => void;
  onSelectSkill: (id: string) => void;
  onSelectExperience: (id: string) => void;
  onDrillIntoProject: (id: string) => void;
  onOpenCaseStudy: () => void;
  onOpenContact: () => void;
  onClearSelection?: () => void;
  projects?: ProjectData[];
  skills?: InfrastructureSkill[];
  experience?: ExperienceNode[];
  operator?: OperatorMetadata;
}

export const RightInspectorPanel: React.FC<RightInspectorPanelProps> = ({
  activeView = 'system_overview',
  selectedProject,
  selectedSkill,
  selectedExperience,
  selectedSubsystem,
  onSelectProject,
  onSelectSkill,
  onSelectExperience,
  onDrillIntoProject,
  onOpenCaseStudy,
  onOpenContact,
  onClearSelection,
  projects = PROJECTS,
  skills = INFRASTRUCTURE_SKILLS,
  experience = EXPERIENCE_HISTORY,
  operator = OPERATOR_METADATA
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'architecture' | 'metrics' | 'manifest'>('overview');
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);
  const activeOperator = operator || OPERATOR_METADATA;
  const uniqueOrganizations = Array.from(
    new Set(experience.map(e => (e.organization || '').trim().toLowerCase()))
  ).filter(Boolean).length;

  // Auto-expand mobile sheet on active selection
  React.useEffect(() => {
    if (selectedProject || selectedSkill || selectedExperience || selectedSubsystem) {
      setIsMobileExpanded(true);
    }
  }, [selectedProject, selectedSkill, selectedExperience, selectedSubsystem]);

  // Reset project inspector sub-tab to overview whenever selected project identity changes
  React.useEffect(() => {
    setActiveTab('overview');
  }, [selectedProject?.id]);

  // Shared generic progression grouping used by Professional Experience index/detail views
  const groupedExperience = React.useMemo(() => groupExperienceByProgression(experience), [experience]);

  return (
    <aside 
      id="right-inspector-panel"
      className={`w-full lg:w-96 xl:w-[420px] bg-[#D4CDA4] border-t-2 lg:border-t-0 lg:border-l border-[#15150F] flex flex-col shrink-0 select-none overflow-hidden transition-all duration-200 ${
        isMobileExpanded 
          ? 'fixed bottom-0 left-0 right-0 z-30 h-[62vh] max-h-[75vh] shadow-[0_-6px_20px_rgba(21,21,15,0.45)] lg:static lg:h-full lg:shadow-none' 
          : 'fixed bottom-0 left-0 right-0 z-30 h-11 lg:static lg:h-full'
      }`}
    >
      {/* Inspector Title Bar (Desktop + Mobile Sheet Bar) */}
      <div className="p-2.5 sm:p-3 bg-[#CBC59B]/80 border-b border-[#15150F] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5 overflow-hidden">
          <Terminal size={13} className="text-[#15150F] shrink-0" />
          <span className="text-[11.5px] lg:text-[10px] font-bold tracking-widest uppercase truncate">
            {selectedProject 
              ? `INSPECTOR // ${selectedProject.code} · ${selectedProject.title}` 
              : selectedSkill 
              ? `CAPABILITY // ${selectedSkill.code} · ${selectedSkill.name}`
              : selectedExperience
              ? `BUILD LOG // ${selectedExperience.code} · ${selectedExperience.organization}`
              : activeView === 'identity'
              ? 'OPERATOR // PROFILE CONSOLE'
              : activeView === 'projects'
              ? 'PROJECTS // TOPOLOGY OVERVIEW'
              : activeView === 'experience'
              ? 'CAREER // PROFESSIONAL INDEX'
              : activeView === 'infrastructure'
              ? 'CAPABILITIES // TECHNICAL INDEX'
              : 'SYSTEM // SYSTEM OVERVIEW'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="hidden sm:inline-block text-[9.5px] lg:text-[8.5px] px-1.5 py-0.5 bg-[#15150F] text-[#C3E54E] font-bold">
            LIVE TELEMETRY
          </span>

          {(selectedProject || selectedSkill || selectedExperience || selectedSubsystem) && (
            <button
              onClick={onClearSelection}
              className="hidden lg:inline-flex items-center px-2 py-1 bg-[#CBC59B] text-[#15150F] text-[8.5px] font-bold border border-[#15150F] cursor-pointer hover:bg-[#15150F] hover:text-[#D4CDA4] transition-colors"
              title="Clear selection"
              aria-label="Clear selection"
            >
              ✕ CLEAR
            </button>
          )}

          {/* Mobile Sheet Controls */}
          <div className="flex items-center gap-1.5 lg:hidden">
            <button
              onClick={() => setIsMobileExpanded(prev => !prev)}
              className="px-3 py-1.5 bg-[#15150F] text-[#C3E54E] text-[11px] font-bold border border-[#15150F] flex items-center gap-1 cursor-pointer min-h-[36px]"
              title={isMobileExpanded ? 'Minimize inspector' : 'Expand inspector'}
            >
              <span>{isMobileExpanded ? '↓ MINIMIZE' : '↑ EXPAND'}</span>
            </button>
            {(selectedProject || selectedSkill || selectedExperience || selectedSubsystem) && (
              <button
                onClick={() => {
                  setIsMobileExpanded(false);
                  onClearSelection?.();
                }}
                className="px-2.5 py-1.5 bg-[#CBC59B] text-[#15150F] text-[11px] font-bold border border-[#15150F] cursor-pointer hover:bg-[#15150F] hover:text-[#D4CDA4] transition-colors min-h-[36px]"
                title="Clear Selection"
              >
                ✕ CLEAR
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sub-Tabs for Projects */}
      {selectedProject && (
        <div className="flex border-b border-[#15150F] bg-[#DCD6B2]/80 divide-x divide-[#15150F] text-[11.5px] lg:text-[9px] font-mono font-semibold">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex-1 py-2 lg:py-1.5 min-h-[38px] lg:min-h-[28px] text-center uppercase tracking-wider transition-colors ${
              activeTab === 'overview' ? 'bg-[#15150F] text-[#D4CDA4] font-bold' : 'hover:bg-[#15150F] hover:text-[#D4CDA4] text-[#15150F]'
            }`}
          >
            01 // OVERVIEW
          </button>
          <button
            onClick={() => setActiveTab('architecture')}
            className={`flex-1 py-2 lg:py-1.5 min-h-[38px] lg:min-h-[28px] text-center uppercase tracking-wider transition-colors ${
              activeTab === 'architecture' ? 'bg-[#15150F] text-[#D4CDA4] font-bold' : 'hover:bg-[#15150F] hover:text-[#D4CDA4] text-[#15150F]'
            }`}
          >
            02 // ARCH
          </button>
          <button
            onClick={() => setActiveTab('metrics')}
            className={`flex-1 py-2 lg:py-1.5 min-h-[38px] lg:min-h-[28px] text-center uppercase tracking-wider transition-colors ${
              activeTab === 'metrics' ? 'bg-[#15150F] text-[#D4CDA4] font-bold' : 'hover:bg-[#15150F] hover:text-[#D4CDA4] text-[#15150F]'
            }`}
          >
            03 // METRICS
          </button>
          <button
            onClick={() => setActiveTab('manifest')}
            className={`flex-1 py-2 lg:py-1.5 min-h-[38px] lg:min-h-[28px] text-center uppercase tracking-wider transition-colors ${
              activeTab === 'manifest' ? 'bg-[#15150F] text-[#D4CDA4] font-bold' : 'hover:bg-[#15150F] hover:text-[#D4CDA4] text-[#15150F]'
            }`}
          >
            04 // SPEC
          </button>
        </div>
      )}

      {/* Inspector Content Area */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 font-mono text-[12.5px] lg:text-[11px] leading-relaxed">
        {/* CASE 1: SELECTED PROJECT */}
        {selectedProject && (
          <div className="flex flex-col gap-4">
            {/* Header section */}
            <div className="flex flex-col gap-1 border-b border-[#15150F] pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] lg:text-[13.5px] font-bold text-[#15150F]">{selectedProject.code} // {selectedProject.title}</span>
                </div>
                <span className="text-[9.5px] lg:text-[8.5px] px-1.5 py-0.5 bg-[#15150F] text-[#C3E54E] font-bold">
                  ● {selectedProject.status}
                </span>
              </div>
              <p className="text-[12px] lg:text-[10px] text-[#3D3A2C] font-medium leading-snug">
                {selectedProject.tagline}
              </p>
              <div className="flex items-center gap-3 text-[10.5px] lg:text-[9px] text-[#5C5946] mt-1">
                <span>YEAR: {selectedProject.year}</span>
                <span>·</span>
                <span>GRID: {selectedProject.dimensions.width}x{selectedProject.dimensions.height}</span>
                <span>·</span>
                <span>TIERS: {selectedProject.dimensions.levels} LEVELS</span>
              </div>
            </div>

            {/* TAB 01: OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="flex flex-col gap-3.5">
                {/* Summary */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10.5px] lg:text-[8.5px] font-bold opacity-60 uppercase tracking-wider">
                      SYSTEM SUMMARY
                    </span>
                    <ProvenanceBadge provenance={selectedProject.provenance?.summary || 'VERIFIED'} />
                  </div>
                  <p className="text-[12px] lg:text-[10.5px] text-[#15150F] bg-[#E2DCB9]/70 p-2.5 border border-[#15150F] leading-relaxed">
                    {selectedProject.summary}
                  </p>
                </div>

                {/* Problem vs Solution */}
                <div className="flex flex-col gap-2">
                  <div className="p-2.5 border border-[#15150F] bg-[#CBC59B]/30">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] lg:text-[8.5px] font-bold text-[#7A3E2E] uppercase block">
                        [ENGINEERING CHALLENGE]
                      </span>
                      <ProvenanceBadge provenance={selectedProject.provenance?.problem} />
                    </div>
                    <p className="text-[12px] lg:text-[10px] text-[#22211A] leading-relaxed">
                      {selectedProject.problem}
                    </p>
                  </div>

                  <div className="p-2.5 border border-[#15150F] bg-[#CBC59B]/30">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] lg:text-[8.5px] font-bold text-[#2E6B3A] uppercase block">
                        [ARCHITECTURAL SOLUTION]
                      </span>
                      <ProvenanceBadge provenance={selectedProject.provenance?.solution} />
                    </div>
                    <p className="text-[12px] lg:text-[10px] text-[#22211A] leading-relaxed">
                      {selectedProject.solution}
                    </p>
                  </div>
                </div>

                {/* Tech Stack & Linked Infrastructure */}
                <div>
                  <div className="text-[10.5px] lg:text-[8.5px] font-bold opacity-60 uppercase tracking-wider mb-1.5">
                    ARCHITECTURAL TIER &amp; CAPABILITIES
                  </div>

                  {/* Architecture Layer Classification Badge */}
                  <div className="mb-2 p-2 bg-[#15150F] text-[#D4CDA4] border border-[#15150F] flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] lg:text-[9px] font-bold text-[#C3E54E] uppercase tracking-wider">
                        TIER: {selectedProject.category === 'fullstack' ? 'FULL-STACK' : selectedProject.category.toUpperCase()}
                      </span>
                      <span className="text-[9.5px] lg:text-[7.5px] px-1 py-0.5 bg-[#C3E54E] text-[#15150F] font-bold">
                        {selectedProject.techStack.length} TECHNOLOGIES
                      </span>
                    </div>
                    <div className="text-[11px] lg:text-[8.5px] text-[#A8A48B] leading-tight">
                      {selectedProject.category === 'fullstack' 
                        ? 'Repository signals indicate both frontend and backend application concerns.'
                        : selectedProject.category === 'backend'
                        ? 'Repository signals indicate primarily server-side application concerns.'
                        : selectedProject.category === 'frontend'
                        ? 'Repository signals indicate primarily client-facing application concerns.'
                        : selectedProject.category === 'infrastructure'
                        ? 'Repository purpose is classified as infrastructure-oriented.'
                        : 'Repository purpose is classified as developer/tooling-oriented.'}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {selectedProject.infrastructureDeps.map(infraId => {
                      const skill = skills.find(s => s.id === infraId);
                      if (!skill) return null;
                      return (
                        <button
                          key={skill.id}
                          onClick={() => onSelectSkill(skill.id)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 lg:py-1 min-h-[36px] lg:min-h-0 text-[11px] lg:text-[9px] font-semibold bg-[#E2DCB9] border border-[#15150F] hover:bg-[#15150F] hover:text-[#D4CDA4] transition-colors cursor-pointer"
                        >
                          <span className="w-1.5 h-1.5 bg-[#8EA9DA]"></span>
                          <span>{getCapabilityCoreTechnology(skill)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 02: ARCHITECTURE */}
            {activeTab === 'architecture' && (
              <div className="flex flex-col gap-3.5">
                {/* Layer Decomposition */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10.5px] lg:text-[8.5px] font-bold opacity-60 uppercase tracking-wider">
                      SUB-SERVICE DECOMPOSITION ({selectedProject.subsystems.length})
                    </span>
                    <ProvenanceBadge provenance={selectedProject.provenance?.subsystems} />
                  </div>
                  <div className="divide-y divide-[#15150F] border border-[#15150F] bg-[#E2DCB9]/40">
                    {selectedProject.subsystems.map((sub, i) => (
                      <div key={sub.id} className="p-2.5 flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[12px] lg:text-[10px] text-[#15150F]">0{i+1} // {sub.name}</span>
                          <div className="flex items-center gap-1">
                            <span className="text-[9.5px] lg:text-[8px] bg-[#15150F] text-[#D4CDA4] px-1">{sub.category}</span>
                            {sub.provenance && <ProvenanceBadge provenance={sub.provenance} />}
                          </div>
                        </div>
                        <p className="text-[11.5px] lg:text-[9.5px] text-[#5C5946] leading-snug">{sub.description}</p>
                        {sub.protocol && (
                          <div className="text-[10.5px] lg:text-[8.5px] text-[#15150F] font-bold">
                            PROTOCOL: {sub.protocol}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {sub.tech.map(t => (
                            <span key={t} className="text-[9.5px] lg:text-[7.5px] px-1 bg-[#DCD6B2] border border-[#15150F]/30 text-[#3D3A2C]">
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                    {selectedProject.subsystems.length === 0 && (
                      <div className="p-3 text-[11.5px] lg:text-[9.5px] text-[#5C5946] leading-relaxed">
                        No subsystem boundary is documented by the linked repository evidence.
                      </div>
                    )}
                  </div>
                </div>

                {/* Key Decisions & Trade-offs */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10.5px] lg:text-[8.5px] font-bold opacity-60 uppercase tracking-wider">
                      KEY ARCHITECTURAL DECISIONS &amp; TRADEOFFS
                    </span>
                    <ProvenanceBadge provenance={selectedProject.provenance?.keyDecisions} />
                  </div>
                  <div className="flex flex-col gap-2">
                    {selectedProject.keyDecisions.map((dec, i) => (
                      <div key={i} className="p-2.5 border border-[#15150F] bg-[#CBC59B]/40 flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <div className="font-bold text-[12px] lg:text-[10px] text-[#15150F]">
                            DECISION: {dec.decision}
                          </div>
                          {dec.provenance && <ProvenanceBadge provenance={dec.provenance} />}
                        </div>
                        <div className="text-[11.5px] lg:text-[9.5px] text-[#3D3A2C]">
                          <span className="font-semibold text-[#5C5946]">RATIONALE: </span>
                          {dec.rationale}
                        </div>
                        <div className="text-[11px] lg:text-[8.5px] text-[#7A3E2E] bg-[#EFEAD0] p-1 border border-[#15150F]/30">
                          <span className="font-bold">TRADE-OFF: </span>
                          {dec.tradeoff}
                        </div>
                      </div>
                    ))}
                    {selectedProject.keyDecisions.length === 0 && (
                      <div className="p-3 border border-[#15150F] bg-[#E2DCB9]/50 text-[11.5px] lg:text-[9.5px] text-[#5C5946] leading-relaxed">
                        No owner-confirmed architectural decision is available for this project yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 03: METRICS & RESILIENCE */}
            {activeTab === 'metrics' && (
              <div className="flex flex-col gap-3.5">
                {/* Group 1: Repository Signals (GitHub Metadata) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10.5px] lg:text-[8.5px] font-bold opacity-60 uppercase tracking-wider">
                      01 // REPOSITORY SIGNALS (GITHUB METADATA)
                    </span>
                    <ProvenanceBadge provenance="VERIFIED" />
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {selectedProject.metrics.map((m, i) => (
                      <div key={i} className="p-2.5 border border-[#15150F] bg-[#E2DCB9] flex flex-col">
                        <span className="text-[9.5px] lg:text-[7.5px] uppercase font-bold opacity-60">{m.label}</span>
                        <span className="text-[14px] font-bold text-[#15150F]">{m.value}</span>
                        {m.note && <span className="text-[9.5px] lg:text-[7.5px] opacity-75">{m.note}</span>}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Group 2: Engineering Validation & Test Harness */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10.5px] lg:text-[8.5px] font-bold opacity-60 uppercase tracking-wider">
                      02 // ENGINEERING VALIDATION &amp; TEST HARNESS
                    </span>
                    <ProvenanceBadge provenance={selectedProject.provenance?.resilienceTesting} />
                  </div>
                  <div className="p-2.5 border border-[#15150F] bg-[#CBC59B]/40 flex flex-col gap-2">
                    <div className="text-[12px] lg:text-[9.5px] leading-relaxed text-[#22211A]">
                      {selectedProject.resilienceTesting}
                    </div>

                    {/* Detected Validation Pills */}
                    {selectedProject.validationEvidence && (
                      <div className="flex flex-wrap gap-1 pt-1 border-t border-[#15150F]/20">
                        {selectedProject.validationEvidence.testFrameworks.map(tf => (
                          <span key={tf} className="text-[9.5px] lg:text-[7.5px] px-1.5 py-0.5 bg-[#15150F] text-[#C3E54E] font-bold">
                            TEST: {tf}
                          </span>
                        ))}
                        {selectedProject.validationEvidence.e2eHarnesses.map(e2e => (
                          <span key={e2e} className="text-[9.5px] lg:text-[7.5px] px-1.5 py-0.5 bg-[#15150F] text-[#8EA9DA] font-bold">
                            E2E: {e2e}
                          </span>
                        ))}
                        {selectedProject.validationEvidence.ciWorkflows.map(ci => (
                          <span key={ci} className="text-[9.5px] lg:text-[7.5px] px-1.5 py-0.5 bg-[#DCD6B2] text-[#15150F] border border-[#15150F] font-bold">
                            CI: {ci}
                          </span>
                        ))}
                        {selectedProject.validationEvidence.hasDocker && (
                          <span key="docker" className="text-[9.5px] lg:text-[7.5px] px-1.5 py-0.5 bg-[#DCD6B2] text-[#15150F] border border-[#15150F] font-bold">
                            CONTAINER: Docker
                          </span>
                        )}
                        {selectedProject.validationEvidence.testFilesDetected && selectedProject.validationEvidence.testFilesDetected > 0 ? (
                          <span className="text-[9.5px] lg:text-[7.5px] px-1.5 py-0.5 bg-[#E2DCB9] text-[#15150F] border border-[#15150F]">
                            {selectedProject.validationEvidence.testFilesDetected} TEST FILES DETECTED
                          </span>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>

                {/* Group 3: Runtime Telemetry & Performance */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10.5px] lg:text-[8.5px] font-bold opacity-60 uppercase tracking-wider">
                      03 // RUNTIME TELEMETRY &amp; PERFORMANCE
                    </span>
                    <ProvenanceBadge provenance={selectedProject.performanceEvidence?.claimed ? 'VERIFIED' : 'UNAVAILABLE'} />
                  </div>
                  <div className="p-2.5 border border-[#15150F] bg-[#E2DCB9]/60 text-[11.5px] lg:text-[9px] text-[#5C5946] leading-relaxed">
                    {selectedProject.performanceEvidence?.notes || 'No runtime benchmarks or production telemetry claimed in repository.'}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 04: SPEC & ACTIONS */}
            {activeTab === 'manifest' && (
              <div className="flex flex-col gap-3">
                <div className="text-[10.5px] lg:text-[8.5px] font-bold opacity-60 uppercase tracking-wider">
                  SYSTEM MANIFEST &amp; EXTERNAL ARTIFACTS
                </div>
                <div className="p-2.5 border border-[#15150F] bg-[#E2DCB9]/60 font-mono text-[11.5px] lg:text-[9.5px] flex flex-col gap-1">
                  <div>REPO_ID: {selectedProject.id}</div>
                  <div>LAYER_TYPE: {selectedProject.category.toUpperCase()}</div>
                  <div>STATUS: {selectedProject.status}</div>
                  <div>SUBSYSTEM_COUNT: {selectedProject.subsystems.length}</div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-col gap-2 mt-2">
                  <button
                    onClick={() => onDrillIntoProject(selectedProject.id)}
                    className="w-full min-h-[44px] lg:min-h-[34px] py-2.5 bg-[#15150F] text-[#C3E54E] font-bold text-[12px] lg:text-[10px] tracking-wider border border-[#15150F] hover:bg-[#2A2920] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>ENTER SYSTEM DECOMPOSITION</span>
                    <ArrowUpRight size={14} />
                  </button>

                  <button
                    onClick={onOpenCaseStudy}
                    className="w-full min-h-[42px] lg:min-h-[32px] py-2 bg-[#E2DCB9] text-[#15150F] font-bold text-[12px] lg:text-[10px] tracking-wider border border-[#15150F] hover:bg-[#15150F] hover:text-[#D4CDA4] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <FileText size={13} />
                    <span>OPEN FULL ARCHITECTURE SPEC</span>
                  </button>

                  {selectedProject.links.github && (
                    <a
                      href={selectedProject.links.github}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full min-h-[38px] lg:min-h-[28px] py-2 lg:py-1.5 bg-[#CBC59B] text-[#15150F] font-semibold text-[11.5px] lg:text-[9.5px] tracking-wider border border-[#15150F] hover:bg-[#15150F] hover:text-[#D4CDA4] flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Github size={13} />
                      <span>VIEW SOURCE CODE (GITHUB)</span>
                    </a>
                  )}

                  {selectedProject.links.demo && (
                    <a
                      href={selectedProject.links.demo}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full min-h-[38px] lg:min-h-[28px] py-2 lg:py-1.5 bg-[#C3E54E] text-[#15150F] font-bold text-[11.5px] lg:text-[9.5px] tracking-wider border border-[#15150F] hover:bg-[#B2D63B] flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <ExternalLink size={13} />
                      <span>LIVE SYSTEM TELEMETRY / DEMO</span>
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* CASE 2: SELECTED INFRASTRUCTURE SKILL */}
        {selectedSkill && !selectedProject && (
          <div className="flex flex-col gap-4">
            {/* Back to Capabilities Index button */}
            <button
              type="button"
              onClick={() => onSelectSkill(selectedSkill.id)}
              className="flex items-center gap-1.5 py-1.5 px-2.5 min-h-[36px] lg:min-h-0 bg-[#15150F] text-[#C3E54E] hover:bg-[#2A2920] border border-[#15150F] text-[10.5px] lg:text-[8.5px] font-mono font-bold tracking-wider transition-colors cursor-pointer w-fit shadow-[1px_1px_0px_#15150F]"
              title="Return to Technical Capabilities Index"
            >
              <span>← TECHNICAL CAPABILITIES</span>
            </button>

            {/* Capability Header */}
            <div className="border-b border-[#15150F] pb-2.5">
              {(() => {
                const profHistory = getCapabilityProfessionalHistory(selectedSkill, experience);
                const matchedProjects = projects.filter(p => projectUsesCapability(p, selectedSkill));

                return (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-[14px] lg:text-[13px] font-bold text-[#15150F]">{selectedSkill.code} // {selectedSkill.name}</span>
                      <span className={`text-[9.5px] lg:text-[8.5px] px-1.5 py-0.5 font-bold ${
                        profHistory.hasEvidence 
                          ? 'bg-[#15150F] text-[#8EA9DA]' 
                          : 'bg-[#15150F]/70 text-[#D4CDA4]'
                      }`}>
                        {profHistory.hasEvidence 
                          ? (profHistory.periodCount > 1 
                              ? `PROFESSIONAL EVIDENCE // ${profHistory.periodCount} ROLE PERIODS` 
                              : `PROFESSIONAL EVIDENCE // ${profHistory.timeSpan}`)
                          : 'PROFESSIONAL HISTORY // UNAVAILABLE'}
                      </span>
                    </div>
                    <div className="text-[11px] lg:text-[9px] text-[#5C5946] mt-1">
                      CHRONOLOGY: {profHistory.hasEvidence 
                        ? `${profHistory.timeSpan} (${profHistory.roleCount} ${profHistory.roleCount === 1 ? 'ROLE RECORD' : 'ROLE RECORDS'})` 
                        : 'NO DATED ROLE RECORDS'} · {matchedProjects.length} {matchedProjects.length === 1 ? 'SYSTEM MAPPED' : 'SYSTEMS MAPPED'}
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Associated Systems */}
            <div>
              {(() => {
                const matchedProjects = projects.filter(p => projectUsesCapability(p, selectedSkill));

                return (
                  <>
                    <div className="text-[10.5px] lg:text-[8.5px] font-bold opacity-60 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                      <span>ASSOCIATED SYSTEMS ({matchedProjects.length})</span>
                      <span className="text-[9.5px] lg:text-[7.5px] font-mono opacity-80 font-normal">REPOSITORY EVIDENCE ASSOCIATIONS</span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {matchedProjects.length === 0 ? (
                        <div className="text-[11px] lg:text-[9px] text-[#5C5946] italic p-2 bg-[#E2DCB9]/40 border border-[#15150F]/40">
                          No associated repositories in current repository cluster.
                        </div>
                      ) : (
                        matchedProjects.map(p => (
                          <button
                            key={p.id}
                            onClick={() => onSelectProject(p.id)}
                            className="flex items-center justify-between p-2 min-h-[40px] lg:min-h-0 bg-[#E2DCB9] border border-[#15150F] hover:bg-[#15150F] hover:text-[#D4CDA4] transition-colors text-left group cursor-pointer"
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5" style={{ backgroundColor: p.accentColor }}></span>
                              <span className="font-bold text-[11px] lg:text-[10px]">{p.code}</span>
                              <span className="text-[12px] lg:text-[9.5px] truncate max-w-[170px]">{p.title}</span>
                            </div>
                            <span className="text-[10px] lg:text-[8px] opacity-60 group-hover:text-[#C3E54E]">INSPECT →</span>
                          </button>
                        ))
                      )}
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Primary Use Cases */}
            <div>
              <div className="text-[10.5px] lg:text-[8.5px] font-bold opacity-60 uppercase tracking-wider mb-1.5">
                PRIMARY USE CASES
              </div>
              <div className="p-2.5 border border-[#15150F] bg-[#E2DCB9] flex flex-col gap-1">
                {selectedSkill.primaryUseCases.map((uc, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-[12px] lg:text-[9.5px]">
                    <span className="text-[#8EA9DA] font-bold">›</span>
                    <span className="text-[#22211A]">{uc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Technical Highlights */}
            <div>
              <div className="text-[10.5px] lg:text-[8.5px] font-bold opacity-60 uppercase tracking-wider mb-1.5">
                TECHNICAL HIGHLIGHTS
              </div>
              <div className="p-2.5 border border-[#15150F] bg-[#E2DCB9] flex flex-col gap-1">
                {selectedSkill.technicalHighlights.map((th, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-[12px] lg:text-[9.5px]">
                    <span className="text-[#C3E54E] font-bold">›</span>
                    <span className="text-[#22211A]">{th}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Architectural Blueprint / Sample Pattern */}
            <div>
              <div className="text-[10.5px] lg:text-[8.5px] font-bold opacity-60 uppercase tracking-wider mb-1.5">
                ARCHITECTURAL BLUEPRINT / PATTERN
              </div>
              <pre className="p-2.5 border border-[#15150F] bg-[#15150F] text-[#D4CDA4] text-[10.5px] lg:text-[8.5px] overflow-x-auto leading-tight font-mono whitespace-pre-wrap">
                {selectedSkill.samplePattern}
              </pre>
            </div>
          </div>
        )}

        {/* CASE 3: SELECTED EXPERIENCE NODE */}
        {selectedExperience && !selectedProject && !selectedSkill && (
          <div className="flex flex-col gap-4">
            {/* Back to Experience Index button */}
            <button
              type="button"
              onClick={() => onSelectExperience(selectedExperience.id)}
              className="flex items-center gap-1.5 py-1.5 px-2.5 min-h-[36px] lg:min-h-0 bg-[#15150F] text-[#C3E54E] hover:bg-[#2A2920] border border-[#15150F] text-[10.5px] lg:text-[8.5px] font-mono font-bold tracking-wider transition-colors cursor-pointer w-fit shadow-[1px_1px_0px_#15150F]"
              title="Return to Professional Experience Index"
            >
              <span>← PROFESSIONAL EXPERIENCE</span>
            </button>

            {/* Header section */}
            <div className="border-b border-[#15150F] pb-2.5 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[14px] lg:text-[13px] font-bold text-[#15150F]">
                  {selectedExperience.code} // {selectedExperience.organization}
                </span>
                <ProvenanceBadge provenance={selectedExperience.provenance || 'CURATED'} />
              </div>
              <div className="flex items-center gap-1.5 text-[12px] lg:text-[10px] text-[#3D3A2C] font-semibold">
                <span>{selectedExperience.role}</span>
                <span>·</span>
                <span>{selectedExperience.location}</span>
              </div>
              <div className="flex items-center justify-between text-[10.5px] lg:text-[9px] text-[#5C5946] mt-0.5 font-mono">
                <span>TIMEFRAME: {selectedExperience.yearRange}</span>
                {selectedExperience.promotionNote && (
                  <span className="text-[9.5px] lg:text-[7.5px] px-1 py-0.2 bg-[#2E6B3A] text-[#D4CDA4] font-bold">
                    ↑ {selectedExperience.promotionNote}
                  </span>
                )}
              </div>
            </div>

            {/* 1. CAREER PROGRESSION TIMELINE (When multiple roles in progressionGroup) */}
            {selectedExperience.progressionRoles && selectedExperience.progressionRoles.length > 1 && (
              <div>
                <div className="text-[10.5px] lg:text-[8.5px] font-bold opacity-60 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>CAREER PROGRESSION // TIMELINE</span>
                  <span className="text-[9.5px] lg:text-[7.5px] opacity-75">{selectedExperience.progressionRoles.length} ROLES</span>
                </div>
                <div className="flex flex-col border border-[#15150F] bg-[#E2DCB9]/40 divide-y divide-[#15150F]/30">
                  {selectedExperience.progressionRoles.map((r, i) => (
                    <div key={r.id || i} className="p-2.5 flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[12px] lg:text-[10.5px] text-[#15150F]">
                          {r.role}
                        </span>
                        <div className="flex items-center gap-1">
                          {r.endDate === null && (
                            <span className="text-[9.5px] lg:text-[7.5px] px-1 bg-[#15150F] text-[#C3E54E] font-bold">
                              CURRENT
                            </span>
                          )}
                          {r.promotionNote && (
                            <span className="text-[9.5px] lg:text-[7.5px] px-1 bg-[#2E6B3A] text-[#D4CDA4] font-bold">
                              ↑ PROMOTED
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-[10.5px] lg:text-[8.5px] font-mono text-[#5C5946]">
                        {r.yearRange}
                      </div>
                      {r.keyOutputs && r.keyOutputs.length > 0 && (
                        <p className="text-[11.5px] lg:text-[9px] text-[#3D3A2C] leading-snug mt-0.5">
                          {r.keyOutputs[0]}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2. SYSTEMS ARCHITECTED (High Evidentiary Bar) */}
            {((selectedExperience.architectedSystemsDetails && selectedExperience.architectedSystemsDetails.length > 0) ||
              (selectedExperience.systemsArchitected && selectedExperience.systemsArchitected.length > 0)) && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10.5px] lg:text-[8.5px] font-bold opacity-60 uppercase tracking-wider">
                    SYSTEMS ARCHITECTED
                  </span>
                  <span className="text-[9.5px] lg:text-[7.5px] px-1 bg-[#15150F] text-[#C3E54E] font-bold">
                    HIGH BAR
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {selectedExperience.architectedSystemsDetails && selectedExperience.architectedSystemsDetails.length > 0 ? (
                    selectedExperience.architectedSystemsDetails.map((arch, idx) => (
                      <div key={idx} className="p-2.5 border border-[#15150F] bg-[#E2DCB9] flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[12px] lg:text-[10px] text-[#15150F]">{arch.name}</span>
                          <ProvenanceBadge provenance={arch.provenance || 'VERIFIED'} />
                        </div>
                        <p className="text-[12px] lg:text-[9.5px] text-[#22211A] leading-snug">
                          {arch.description}
                        </p>
                        {arch.architecturalScope && arch.architecturalScope.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1 border-t border-[#15150F]/20">
                            {arch.architecturalScope.map((sc, i) => (
                              <span key={i} className="text-[9.5px] lg:text-[7.5px] px-1 bg-[#15150F] text-[#D4CDA4] font-mono">
                                {sc}
                              </span>
                            ))}
                          </div>
                        )}
                        {arch.linkedProjectId && (() => {
                          const resolved = resolveProjectFromEvidenceKey(projects, arch.linkedProjectId);
                          if (!resolved) return null;
                          return (
                            <button
                              onClick={() => onSelectProject(resolved.id)}
                              className="mt-1 flex items-center justify-between px-2.5 py-1.5 min-h-[38px] lg:min-h-0 bg-[#CBC59B] border border-[#15150F] text-[11px] lg:text-[8.5px] font-bold hover:bg-[#15150F] hover:text-[#D4CDA4] transition-colors cursor-pointer text-left"
                            >
                              <span>INSPECT ARCHITECTURE REPO: {resolved.title}</span>
                              <ArrowUpRight size={12} />
                            </button>
                          );
                        })()}
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedExperience.systemsArchitected.map(sys => (
                        <span key={sys} className="px-2 py-1 bg-[#E2DCB9] border border-[#15150F] text-[11px] lg:text-[9.5px] font-semibold">
                          {sys}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 3. PROFESSIONAL SYSTEMS DELIVERED */}
            {selectedExperience.systemsDelivered && selectedExperience.systemsDelivered.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10.5px] lg:text-[8.5px] font-bold opacity-60 uppercase tracking-wider">
                    PROFESSIONAL SYSTEMS DELIVERED ({selectedExperience.systemsDelivered.length})
                  </span>
                </div>
                <div className="flex flex-col gap-2.5">
                  {selectedExperience.systemsDelivered.map((del, dIdx) => (
                    <div key={dIdx} className="p-2.5 border border-[#15150F] bg-[#E2DCB9]/80 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[12.5px] lg:text-[10.5px] text-[#15150F]">{del.name}</span>
                        <ProvenanceBadge provenance={del.provenance || 'CURATED'} />
                      </div>
                      {del.status && (
                        <div className="text-[9.5px] lg:text-[7.5px] font-bold text-[#7A3E2E] bg-[#EFEAD0] px-1.5 py-0.5 border border-[#15150F]/30 w-fit">
                          STATUS: {del.status}
                        </div>
                      )}
                      <p className="text-[12px] lg:text-[9.5px] text-[#3D3A2C] leading-snug">
                        {del.description || del.tagline}
                      </p>

                      {/* Data Flow Diagram (if present) */}
                      {del.dataFlow && (
                        <div className="p-2 bg-[#15150F] text-[#D4CDA4] border border-[#15150F] text-[10px] lg:text-[8px] font-mono leading-relaxed">
                          <span className="text-[#C3E54E] font-bold block mb-0.5 text-[10.5px] lg:text-[8px]">DATA INGESTION PIPELINE:</span>
                          {del.dataFlow}
                        </div>
                      )}

                      {/* Capabilities (if present) */}
                      {del.capabilities && del.capabilities.length > 0 && (
                        <div className="flex flex-col gap-0.5 pt-1 border-t border-[#15150F]/20">
                          <span className="text-[9.5px] lg:text-[7.5px] font-bold opacity-60 uppercase">SYSTEM CAPABILITIES:</span>
                          {del.capabilities.map((cap, cIdx) => (
                            <div key={cIdx} className="flex items-start gap-1 text-[11.5px] lg:text-[8.5px] text-[#22211A]">
                              <span className="text-[#2E6B3A] font-bold">▪</span>
                              <span>{cap}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Surface Breakdown Tree (e.g. Backend, Admin Web, Mobile) */}
                      {del.surfaces && del.surfaces.length > 0 && (
                        <div className="flex flex-col gap-1.5 pt-1 border-t border-[#15150F]/20">
                          <span className="text-[9.5px] lg:text-[7.5px] font-bold opacity-60 uppercase">PLATFORM SURFACES:</span>
                          <div className="divide-y divide-[#15150F]/20 bg-[#DCD6B2]/60 border border-[#15150F]/30">
                            {del.surfaces.map((sfc, sIdx) => (
                              <div key={sIdx} className="p-2 flex flex-col gap-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-[12px] lg:text-[9.5px] text-[#15150F]">
                                    {sIdx === del.surfaces!.length - 1 ? '└──' : '├──'} {sfc.name}
                                  </span>
                                  {sfc.status && (
                                    <span className="text-[9.5px] lg:text-[7px] px-1 bg-[#15150F] text-[#C3E54E] font-bold">
                                      {sfc.status}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11.5px] lg:text-[8.5px] text-[#5C5946] leading-snug pl-3">
                                  {sfc.role}
                                </p>
                                <div className="flex flex-wrap gap-1 pl-3 mt-0.5">
                                  {sfc.tech.map(t => (
                                    <span key={t} className="text-[9.5px] lg:text-[7px] px-1 bg-[#E2DCB9] text-[#15150F] border border-[#15150F]/30 font-mono">
                                      {t}
                                    </span>
                                  ))}
                                </div>
                                {sfc.linkedProjectId && (() => {
                                  const resolved = resolveProjectFromEvidenceKey(projects, sfc.linkedProjectId);
                                  if (!resolved) return null;
                                  return (
                                    <div className="pl-3 mt-1">
                                      <button
                                        onClick={() => onSelectProject(resolved.id)}
                                        className="flex items-center gap-1 px-2 py-1 min-h-[36px] lg:min-h-0 bg-[#15150F] text-[#D4CDA4] hover:bg-[#C3E54E] hover:text-[#15150F] text-[10.5px] lg:text-[7.5px] font-bold transition-colors cursor-pointer"
                                      >
                                        <span>INSPECT {resolved.title}</span>
                                        <ArrowUpRight size={11} />
                                      </button>
                                    </div>
                                  );
                                })()}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. MAJOR ENGINEERING CONTRIBUTIONS */}
            {((selectedExperience.engineeringContributions && selectedExperience.engineeringContributions.length > 0) ||
              (selectedExperience.keyOutputs && selectedExperience.keyOutputs.length > 0)) && (
              <div>
                <div className="text-[10.5px] lg:text-[8.5px] font-bold opacity-60 uppercase tracking-wider mb-1.5">
                  ENGINEERING CONTRIBUTIONS &amp; DELIVERABLES
                </div>
                <div className="p-2.5 border border-[#15150F] bg-[#E2DCB9] flex flex-col gap-2">
                  {selectedExperience.engineeringContributions && selectedExperience.engineeringContributions.length > 0 ? (
                    selectedExperience.engineeringContributions.map((contrib, i) => (
                      <div key={i} className="flex flex-col gap-0.5 border-b border-[#15150F]/20 pb-1.5 last:border-b-0 last:pb-0">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1 text-[12px] lg:text-[9.5px] font-bold text-[#15150F]">
                            <span className="text-[#2E6B3A]">✓</span>
                            <span>{contrib.title}</span>
                          </div>
                          <ProvenanceBadge provenance={contrib.provenance || 'CURATED'} />
                        </div>
                        <p className="text-[11.5px] lg:text-[9px] text-[#22211A] leading-snug pl-3">
                          {contrib.description}
                        </p>
                        {contrib.impactArea && (
                          <div className="pl-3 mt-0.5">
                            <span className="text-[9.5px] lg:text-[7px] px-1 bg-[#15150F] text-[#8EA9DA] font-mono">
                              IMPACT: {contrib.impactArea}
                            </span>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    selectedExperience.keyOutputs.map((out, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-[12px] lg:text-[9.5px]">
                        <span className="text-[#2E6B3A] font-bold">✓</span>
                        <span className="text-[#22211A]">{out}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* 5. INFRASTRUCTURE & OPERATIONS */}
            {selectedExperience.infrastructureOperations && selectedExperience.infrastructureOperations.length > 0 && (
              <div>
                <div className="text-[10.5px] lg:text-[8.5px] font-bold opacity-60 uppercase tracking-wider mb-1.5">
                  INFRASTRUCTURE &amp; OPERATIONS
                </div>
                <div className="p-2.5 border border-[#15150F] bg-[#E2DCB9]/60 flex flex-col gap-2">
                  {selectedExperience.infrastructureOperations.map((infra, i) => (
                    <div key={i} className="flex flex-col gap-0.5 border-b border-[#15150F]/20 pb-1.5 last:border-b-0 last:pb-0">
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] lg:text-[9.5px] font-bold text-[#15150F]">
                          0{i + 1} // {infra.area}
                        </span>
                        {infra.status && (
                          <span className="text-[9.5px] lg:text-[7px] px-1 bg-[#15150F] text-[#C3E54E] font-bold">
                            {infra.status}
                          </span>
                        )}
                      </div>
                      <p className="text-[11.5px] lg:text-[9px] text-[#3D3A2C] leading-snug">
                        {infra.details}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 6. EVIDENCE & PROJECT REPOSITORY LINKS */}
            {selectedExperience.evidenceLinks && selectedExperience.evidenceLinks.length > 0 && (
              <div>
                <div className="text-[10.5px] lg:text-[8.5px] font-bold opacity-60 uppercase tracking-wider mb-1.5">
                  CONNECTED EVIDENCE REPOSITORIES ({selectedExperience.evidenceLinks.length})
                </div>
                <div className="flex flex-col gap-1.5">
                  {selectedExperience.evidenceLinks.map((link, i) => (
                    <div key={i} className="flex flex-col gap-1 p-2 bg-[#E2DCB9] border border-[#15150F]">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[12px] lg:text-[9.5px]">{link.label}</span>
                        <span className="text-[9.5px] lg:text-[7.5px] px-1 bg-[#15150F] text-[#8EA9DA] uppercase font-bold">
                          {link.type}
                        </span>
                      </div>
                      {link.note && <p className="text-[11px] lg:text-[8.5px] text-[#5C5946]">{link.note}</p>}
                      <div className="flex items-center gap-1.5 mt-1">
                        {link.projectId && (() => {
                          const resolved = resolveProjectFromEvidenceKey(projects, link.projectId);
                          if (!resolved) {
                            return (
                              <span className="flex-1 py-1 text-[9.5px] lg:text-[7.5px] font-mono text-[#5C5946] italic text-center">
                                REPOSITORY NOT IN CURRENT SNAPSHOT
                              </span>
                            );
                          }
                          return (
                            <button
                              onClick={() => onSelectProject(resolved.id)}
                              className="flex-1 py-1.5 min-h-[38px] lg:min-h-0 bg-[#15150F] text-[#C3E54E] hover:bg-[#2A2920] font-bold text-[11px] lg:text-[8px] tracking-wider transition-colors flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <span>INSPECT ON TOPOLOGY</span>
                              <ArrowUpRight size={12} />
                            </button>
                          );
                        })()}
                        {link.url && (
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noreferrer"
                            className="py-1.5 px-2 min-h-[38px] lg:min-h-0 bg-[#CBC59B] text-[#15150F] hover:bg-[#15150F] hover:text-[#D4CDA4] font-bold text-[11px] lg:text-[8px] tracking-wider border border-[#15150F] transition-colors flex items-center gap-1"
                          >
                            <Github size={12} />
                            <span>GITHUB</span>
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 7. TECHNOLOGY SURFACE */}
            {selectedExperience.technologies && selectedExperience.technologies.length > 0 && (
              <div>
                <div className="text-[10.5px] lg:text-[8.5px] font-bold opacity-60 uppercase tracking-wider mb-1.5">
                  TECHNOLOGY SURFACE
                </div>
                <div className="flex flex-wrap gap-1">
                  {selectedExperience.technologies.map(t => (
                    <span key={t} className="text-[10.5px] lg:text-[8.5px] px-1.5 py-0.5 bg-[#15150F] text-[#D4CDA4] font-bold">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* CASE 4: UNSELECTED ROOT CONSOLE / VIEW-SPECIFIC OVERVIEWS */}
        {!selectedProject && !selectedSkill && !selectedExperience && (
          <div className="flex flex-col gap-4">
            {activeView === 'identity' ? (
              /* --- OPERATOR PROFILE CONSOLE --- */
              <>
                {/* Operator Identity Block */}
                <div className="border-b border-[#15150F] pb-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[15px] lg:text-[14px] font-bold text-[#15150F]">{activeOperator.name}</span>
                    <span className="text-[9.5px] lg:text-[8px] bg-[#15150F] text-[#C3E54E] px-1.5 py-0.5 font-bold">
                      {activeOperator.status || 'ACTIVE'}
                    </span>
                  </div>
                  <div className="text-[12px] lg:text-[10px] text-[#5C5946] font-semibold mt-0.5">
                    {activeOperator.handle} · {activeOperator.role}
                  </div>
                  <div className="text-[11px] lg:text-[9px] text-[#5C5946] mt-0.5">
                    LOCATION: {activeOperator.location}
                  </div>
                  <div className="text-[11.5px] lg:text-[9px] text-[#3D3A2C] mt-1 font-medium bg-[#E2DCB9]/60 p-2 border border-[#15150F]/40 leading-relaxed">
                    FOCUS: {activeOperator.focus}
                  </div>
                </div>

                {/* Operator Portfolio Telemetry */}
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="p-2 border border-[#15150F] bg-[#E2DCB9] flex flex-col">
                    <span className="text-[9.5px] lg:text-[7.5px] opacity-60 uppercase font-bold">PUBLIC PROJECTS</span>
                    <span className="text-[14px] font-bold text-[#15150F]">
                      {projects.length} MAPPED
                    </span>
                  </div>
                  <div className="p-2 border border-[#15150F] bg-[#E2DCB9] flex flex-col">
                    <span className="text-[9.5px] lg:text-[7.5px] opacity-60 uppercase font-bold">CAREER ORGANIZATIONS</span>
                    <span className="text-[14px] font-bold text-[#15150F]">
                      {uniqueOrganizations} {uniqueOrganizations === 1 ? 'ORGANIZATION' : 'ORGANIZATIONS'}
                    </span>
                  </div>
                </div>

                {/* Primary Stack Matrix */}
                <div>
                  <div className="text-[10.5px] lg:text-[8.5px] font-bold opacity-60 uppercase tracking-wider mb-1.5">
                    PRIMARY STACK MATRIX
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {activeOperator.primaryStack.map(st => (
                      <span key={st} className="text-[10.5px] lg:text-[8.5px] px-2 py-0.5 bg-[#15150F] text-[#D4CDA4] font-bold">
                        {st}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Career Footprint Snapshot */}
                <div>
                  <div className="text-[10.5px] lg:text-[8.5px] font-bold opacity-60 uppercase tracking-wider mb-1.5">
                    CAREER FOOTPRINT // SUMMARY
                  </div>
                  <div className="flex flex-col border border-[#15150F] bg-[#E2DCB9]/40 divide-y divide-[#15150F]/20">
                    {experience.map((exp) => (
                      <div key={exp.id} className="p-2 flex items-center justify-between text-[11px] lg:text-[9px]">
                        <div>
                          <span className="font-bold text-[#15150F]">{exp.organization}</span>
                          <span className="text-[#5C5946] block text-[10px] lg:text-[8px]">{exp.role}</span>
                        </div>
                        <span className="text-[10px] lg:text-[8px] font-mono text-[#15150F] opacity-75">{exp.yearRange}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Verification & Communication Channels */}
                <div>
                  <div className="text-[10.5px] lg:text-[8.5px] font-bold opacity-60 uppercase tracking-wider mb-1.5">
                    COMMUNICATION &amp; VERIFICATION CHANNELS
                  </div>
                  <div className="p-2.5 border border-[#15150F] bg-[#E2DCB9] font-mono text-[11px] lg:text-[9px] flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="opacity-60">GITHUB:</span>
                      <a href={activeOperator.contact.github} target="_blank" rel="noreferrer" className="font-bold underline hover:text-[#2E6B3A]">
                        {activeOperator.contact.github.replace('https://github.com/', '')}
                      </a>
                    </div>
                    {activeOperator.contact.linkedin && (
                      <div className="flex items-center justify-between">
                        <span className="opacity-60">LINKEDIN:</span>
                        <a href={activeOperator.contact.linkedin} target="_blank" rel="noreferrer" className="font-bold underline hover:text-[#2E6B3A]">
                          PROFILE INTERFACE
                        </a>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="opacity-60">AVAILABILITY:</span>
                      <span className="font-bold text-[#2E6B3A]">{activeOperator.contact.availability || 'DIRECT COMMS'}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-1.5 mt-1">
                  <button
                    onClick={onOpenContact}
                    className="w-full min-h-[42px] py-2 bg-[#15150F] text-[#C3E54E] font-bold text-[12px] lg:text-[10px] tracking-wider border border-[#15150F] hover:bg-[#2A2920] transition-colors cursor-pointer"
                  >
                    DISPATCH ENCRYPTED COMMS
                  </button>
                </div>
              </>
            ) : activeView === 'projects' ? (
              /* --- PROJECTS OVERVIEW PROMPT --- */
              <>
                <div className="border-b border-[#15150F] pb-2.5">
                  <span className="text-[9.5px] lg:text-[8px] bg-[#15150F] text-[#C3E54E] px-1.5 py-0.5 font-bold uppercase tracking-wider">
                    SYSTEM TOPOLOGY // {projects.length} REPOSITORIES
                  </span>
                  <div className="text-[14px] lg:text-[12px] font-bold text-[#15150F] mt-1.5">
                    PROJECT LANDSCAPE EXPLORER
                  </div>
                </div>
                <div className="p-3 border border-[#15150F] bg-[#E2DCB9] text-[12px] lg:text-[9.5px] text-[#22211A] leading-relaxed flex flex-col gap-2">
                  <p>
                    Select any repository node on the canvas to inspect architectural blueprints, tech stacks, and live telemetry.
                  </p>
                  <div className="p-2.5 bg-[#15150F] text-[#D4CDA4] text-[11px] lg:text-[8.5px] font-mono flex flex-col gap-1">
                    <div>› CLICK NODE: Inspect architectural evidence</div>
                    <div>› DBL-CLICK NODE: Enter subsystem decomposition</div>
                    <div>› DRAG NODE: Spatial repositioning</div>
                    <div>› TOPOLOGY VIEW: Systems / Capabilities / Relationships</div>
                    <div>› SEARCH: Filter repository nodes by title / code / stack</div>
                  </div>
                </div>
              </>
            ) : activeView === 'experience' ? (
              /* --- PROFESSIONAL EXPERIENCE INDEX --- */
              <div className="flex flex-col gap-3">
                <div className="border-b border-[#15150F] pb-2 flex flex-col gap-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[9.5px] lg:text-[8px] bg-[#15150F] text-[#C3E54E] px-1.5 py-0.5 font-bold uppercase tracking-wider">
                      CAREER INDEX // {groupedExperience.length} {groupedExperience.length === 1 ? 'ORGANIZATION' : 'ORGANIZATIONS'}
                    </span>
                    <span className="text-[9.5px] lg:text-[7.5px] font-mono text-[#5C5946]">{experience.length} ROLES RECORDED</span>
                  </div>
                  <div className="text-[14px] lg:text-[12px] font-bold text-[#15150F] mt-1">
                    PROFESSIONAL EXPERIENCE INDEX
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  {groupedExperience.map((org) => {
                    return (
                      <button
                        key={org.id}
                        onClick={() => onSelectExperience(org.id)}
                        className="p-2.5 min-h-[44px] bg-[#E2DCB9] border border-[#15150F] hover:bg-[#15150F] hover:text-[#D4CDA4] transition-all text-left group shadow-[2px_2px_0px_#15150F] cursor-pointer flex flex-col gap-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-[13px] lg:text-[11px] uppercase tracking-tight group-hover:text-[#C3E54E]">
                              {org.code} // {org.organization}
                            </span>
                            {org.promotionNote && (
                              <span className="text-[8.5px] lg:text-[6.5px] px-1 py-0.2 bg-[#2E6B3A] text-[#D4CDA4] font-bold group-hover:bg-[#C3E54E] group-hover:text-[#15150F]">
                                PROMOTED
                              </span>
                            )}
                          </div>
                          <ProvenanceBadge provenance={org.provenance || 'CURATED'} />
                        </div>

                        <div className="flex flex-col text-[12px] lg:text-[9.5px]">
                          <span className="font-semibold text-[#15150F] group-hover:text-[#D4CDA4]">
                            {org.role}
                          </span>
                          <span className="text-[10.5px] lg:text-[8px] text-[#5C5946] group-hover:text-[#A8A48B] font-mono">
                            {org.organizationTenure}
                          </span>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-[#15150F]/20 group-hover:border-[#D4CDA4]/20 text-[10px] lg:text-[8px] font-mono">
                          <span className="text-[#5C5946] group-hover:text-[#A8A48B]">
                            {org.linkedSystemsCount > 0
                              ? `SYSTEMS LINKED // ${String(org.linkedSystemsCount).padStart(2, '0')}`
                              : `PROGRESSION // ${org.roleCount} ${org.roleCount === 1 ? 'ROLE' : 'ROLES'}`}
                          </span>
                          <span className="font-bold text-[#15150F] group-hover:text-[#C3E54E] flex items-center gap-0.5">
                            <span>OPEN</span>
                            <span>→</span>
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : activeView === 'infrastructure' ? (
              /* --- TECHNICAL CAPABILITIES INDEX --- */
              <div className="flex flex-col gap-3">
                <div className="border-b border-[#15150F] pb-2 flex flex-col gap-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[9.5px] lg:text-[8px] bg-[#15150F] text-[#C3E54E] px-1.5 py-0.5 font-bold uppercase tracking-wider">
                      CAPABILITY MATRIX // {skills.length} MODULES
                    </span>
                    <span className="text-[9.5px] lg:text-[7.5px] font-mono text-[#5C5946]">COMMONLY DETECTED TECH</span>
                  </div>
                  <div className="text-[14px] lg:text-[12px] font-bold text-[#15150F] mt-1">
                    TECHNICAL CAPABILITIES INDEX
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  {skills.map((skill) => {
                    const associatedProjectsCount = projects.filter(p => projectUsesCapability(p, skill)).length;
                    return (
                      <button
                        key={skill.id}
                        onClick={() => onSelectSkill(skill.id)}
                        className="p-2.5 min-h-[44px] bg-[#E2DCB9] border border-[#15150F] hover:bg-[#15150F] hover:text-[#D4CDA4] transition-all text-left group shadow-[2px_2px_0px_#15150F] cursor-pointer flex flex-col gap-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[13px] lg:text-[11px] uppercase tracking-tight group-hover:text-[#C3E54E]">
                            {skill.code} // {skill.name}
                          </span>
                          <span className="text-[9.5px] lg:text-[7px] font-bold px-1.5 py-0.5 bg-[#15150F] text-[#D4CDA4] group-hover:bg-[#C3E54E] group-hover:text-[#15150F] border border-[#15150F] tracking-wider uppercase">
                            {skill.category.toUpperCase()}
                          </span>
                        </div>

                        {skill.primaryUseCases && skill.primaryUseCases.length > 0 && (
                          <p className="text-[11.5px] lg:text-[9px] text-[#3D3A2C] group-hover:text-[#D4CDA4] leading-snug line-clamp-2">
                            {skill.primaryUseCases[0]}
                          </p>
                        )}

                        <div className="flex items-center justify-between pt-1 border-t border-[#15150F]/20 group-hover:border-[#D4CDA4]/20 text-[10px] lg:text-[8px] font-mono">
                          <span className="text-[#5C5946] group-hover:text-[#A8A48B]">
                            REPOSITORY ASSOCIATIONS // {String(associatedProjectsCount).padStart(2, '0')}
                          </span>
                          <span className="font-bold text-[#15150F] group-hover:text-[#C3E54E] flex items-center gap-0.5">
                            <span>OPEN</span>
                            <span>→</span>
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="p-2 bg-[#CBC59B]/50 border border-[#15150F]/30 text-[9.5px] lg:text-[7.5px] text-[#5C5946] font-mono">
                  TIP // CLICKING A CAPABILITY HIGHLIGHTS ITS CONDUITS ON THE CANVAS
                </div>
              </div>
            ) : (
              /* --- SYSTEM OVERVIEW (Default) --- */
              <>
                {/* System Cartography Intro */}
                <div className="border-b border-[#15150F] pb-2.5">
                  <span className="text-[9.5px] lg:text-[8px] bg-[#15150F] text-[#C3E54E] px-1.5 py-0.5 font-bold uppercase tracking-wider">
                    PORTFOLIO CARTOGRAPHY // PUBLIC INSPECTOR
                  </span>
                  <div className="text-[14px] lg:text-[12px] font-bold text-[#15150F] mt-1.5">
                    SYSTEMS CARTOGRAPHY ENGINE
                  </div>
                  <p className="text-[12px] lg:text-[9.5px] text-[#5C5946] mt-1 leading-snug">
                    Interactive visualization modeling architectural topology, capability conduits, and verified professional engineering systems across public repositories.
                  </p>
                </div>

                {/* Quick Metrics */}
                <div className="grid grid-cols-3 gap-1">
                  <div className="p-2 border border-[#15150F] bg-[#E2DCB9] flex flex-col">
                    <span className="text-[9px] lg:text-[7px] opacity-60 uppercase font-bold">REPOSITORIES</span>
                    <span className="text-[14px] lg:text-[13px] font-bold text-[#15150F]">{projects.length}</span>
                  </div>
                  <div className="p-2 border border-[#15150F] bg-[#E2DCB9] flex flex-col">
                    <span className="text-[9px] lg:text-[7px] opacity-60 uppercase font-bold">CAPABILITIES</span>
                    <span className="text-[14px] lg:text-[13px] font-bold text-[#15150F]">{skills.length}</span>
                  </div>
                  <div className="p-2 border border-[#15150F] bg-[#E2DCB9] flex flex-col">
                    <span className="text-[9px] lg:text-[7px] opacity-60 uppercase font-bold">CAREER ROLES</span>
                    <span className="text-[14px] lg:text-[13px] font-bold text-[#15150F]">{experience.length}</span>
                  </div>
                </div>

                {/* Manifesto / Summary */}
                <div>
                  <div className="text-[10.5px] lg:text-[8.5px] font-bold opacity-60 uppercase tracking-wider mb-1">
                    SYSTEM MANIFESTO
                  </div>
                  <p className="text-[12px] lg:text-[10px] text-[#22211A] bg-[#E2DCB9]/80 p-2.5 border border-[#15150F] leading-relaxed">
                    {activeOperator.systemManifesto}
                  </p>
                </div>

                {/* Evidence Classification Taxonomy */}
                <div>
                  <div className="text-[10.5px] lg:text-[8.5px] font-bold opacity-60 uppercase tracking-wider mb-1.5">
                    EVIDENCE CLASSIFICATION TAXONOMY
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-[10px] lg:text-[8px] font-mono">
                    <div className="p-1.5 bg-[#15150F] text-[#C3E54E] border border-[#15150F] flex flex-col">
                      <span className="font-bold">● VERIFIED</span>
                      <span className="text-[9px] lg:text-[7px] text-[#A8A48B] leading-tight">Public GitHub files, manifests, and code</span>
                    </div>
                    <div className="p-1.5 bg-[#E2A96B]/30 text-[#15150F] border border-[#15150F] flex flex-col">
                      <span className="font-bold text-[#7A3E2E]">▲ CURATED</span>
                      <span className="text-[9px] lg:text-[7px] text-[#5C5946] leading-tight">Reviewed LinkedIn import / owner evidence</span>
                    </div>
                    <div className="p-1.5 bg-[#CBC59B] text-[#15150F] border border-[#15150F] flex flex-col">
                      <span className="font-bold text-[#15150F]">◆ DERIVED</span>
                      <span className="text-[9px] lg:text-[7px] text-[#5C5946] leading-tight">Multi-signal heuristic classifications</span>
                    </div>
                    <div className="p-1.5 bg-[#E2DCB9] text-[#7A3E2E] border border-[#15150F] flex flex-col">
                      <span className="font-bold">○ UNAVAILABLE</span>
                      <span className="text-[9px] lg:text-[7px] text-[#5C5946] leading-tight">Unclaimed / unestablished evidence gap</span>
                    </div>
                  </div>
                </div>

                {/* EVIDENCE PRINCIPLES */}
                <div>
                  <div className="text-[10.5px] lg:text-[8.5px] font-bold opacity-60 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>EVIDENCE PRINCIPLES</span>
                    <span className="text-[9.5px] lg:text-[7.5px] text-[#C3E54E] bg-[#15150F] px-1 py-0.2 font-mono font-bold">
                      {VERIFIED_ARCHITECTURE_PRINCIPLES.length} INTEGRITY RULES
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5 border border-[#15150F] bg-[#E2DCB9]/40 p-2 divide-y divide-[#15150F]/20">
                    {VERIFIED_ARCHITECTURE_PRINCIPLES.map((pr) => (
                      <div key={pr.id} className="pt-1.5 first:pt-0 flex flex-col gap-0.5">
                        <span className="font-bold text-[12px] lg:text-[9.5px] text-[#15150F]">
                          {pr.number} // {pr.title}
                        </span>
                        <p className="text-[11.5px] lg:text-[9px] text-[#22211A] font-medium leading-snug">
                          {pr.summary}
                        </p>
                        <p className="text-[10.5px] lg:text-[8.5px] text-[#5C5946] leading-tight">
                          {pr.elaboration}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Primary Stack */}
                <div>
                  <div className="text-[10.5px] lg:text-[8.5px] font-bold opacity-60 uppercase tracking-wider mb-1.5">
                    PRIMARY STACK MATRIX
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {activeOperator.primaryStack.map(st => (
                      <span key={st} className="text-[10.5px] lg:text-[8.5px] px-2 py-0.5 bg-[#15150F] text-[#D4CDA4] font-bold">
                        {st}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-1.5 mt-2">
                  <button
                    onClick={onOpenContact}
                    className="w-full min-h-[42px] py-2 bg-[#15150F] text-[#C3E54E] font-bold text-[12px] lg:text-[10px] tracking-wider border border-[#15150F] hover:bg-[#2A2920] transition-colors cursor-pointer"
                  >
                    DISPATCH ENCRYPTED COMMS
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};

