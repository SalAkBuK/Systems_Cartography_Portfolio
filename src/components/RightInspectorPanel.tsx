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
  Search
} from 'lucide-react';
import { 
  ProjectData, 
  InfrastructureSkill, 
  ExperienceNode, 
  SubsystemNode,
  ArchitecturePrinciple,
  OperatorMetadata,
  EvidenceProvenance
} from '../types';
import {
  VERIFIED_ARCHITECTURE_PRINCIPLES as ARCHITECTURE_PRINCIPLES,
  VERIFIED_EXPERIENCE as EXPERIENCE_HISTORY,
  VERIFIED_OPERATOR_METADATA as OPERATOR_METADATA,
  VERIFIED_PROJECTS as PROJECTS,
  VERIFIED_SKILLS as INFRASTRUCTURE_SKILLS
} from '../data/verifiedPortfolioData';

export const ProvenanceBadge: React.FC<{ provenance?: EvidenceProvenance }> = ({ provenance = 'VERIFIED' }) => {
  if (provenance === 'CURATED') {
    return (
      <span className="text-[7px] font-bold px-1.5 py-0.5 bg-[#E2A96B] text-[#15150F] border border-[#15150F] tracking-wider uppercase inline-block">
        CURATED
      </span>
    );
  }
  if (provenance === 'DERIVED') {
    return (
      <span className="text-[7px] font-bold px-1.5 py-0.5 bg-[#8EA9DA] text-[#15150F] border border-[#15150F] tracking-wider uppercase inline-block">
        DERIVED
      </span>
    );
  }
  if (provenance === 'UNAVAILABLE') {
    return (
      <span className="text-[7px] font-bold px-1.5 py-0.5 bg-[#7A3E2E] text-[#D4CDA4] border border-[#15150F] tracking-wider uppercase inline-block">
        UNAVAILABLE
      </span>
    );
  }
  return (
    <span className="text-[7px] font-bold px-1.5 py-0.5 bg-[#15150F] text-[#C3E54E] border border-[#15150F] tracking-wider uppercase inline-block">
      VERIFIED
    </span>
  );
};

interface RightInspectorPanelProps {
  selectedProject: ProjectData | null;
  selectedSkill: InfrastructureSkill | null;
  selectedExperience: ExperienceNode | null;
  selectedSubsystem: SubsystemNode | null;
  selectedPrinciple: ArchitecturePrinciple | null;
  onSelectProject: (id: string) => void;
  onSelectSkill: (id: string) => void;
  onDrillIntoProject: (id: string) => void;
  onOpenCaseStudy: () => void;
  onOpenContact: () => void;
  projects?: ProjectData[];
  skills?: InfrastructureSkill[];
  experience?: ExperienceNode[];
  operator?: OperatorMetadata;
}

export const RightInspectorPanel: React.FC<RightInspectorPanelProps> = ({
  selectedProject,
  selectedSkill,
  selectedExperience,
  selectedSubsystem,
  selectedPrinciple,
  onSelectProject,
  onSelectSkill,
  onDrillIntoProject,
  onOpenCaseStudy,
  onOpenContact,
  projects = PROJECTS,
  skills = INFRASTRUCTURE_SKILLS,
  experience = EXPERIENCE_HISTORY,
  operator = OPERATOR_METADATA
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'architecture' | 'metrics' | 'manifest'>('overview');
  const activeOperator = operator || OPERATOR_METADATA;

  return (
    <aside className="w-full lg:w-96 xl:w-[420px] bg-[#D4CDA4] border-t lg:border-t-0 lg:border-l border-[#15150F] flex flex-col shrink-0 select-none overflow-hidden h-72 lg:h-full">
      {/* Inspector Title Bar */}
      <div className="p-3 bg-[#CBC59B]/60 border-b border-[#15150F] flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Terminal size={12} className="text-[#15150F]" />
          <span className="text-[10px] font-bold tracking-widest uppercase">
            {selectedProject 
              ? `INSPECTOR // ${selectedProject.code}` 
              : selectedSkill 
              ? `CAPABILITY // ${selectedSkill.code}`
              : selectedExperience
              ? `BUILD LOG // ${selectedExperience.code}`
              : selectedPrinciple
              ? `PRINCIPLE // ${selectedPrinciple.number}`
              : 'SYSTEM // ROOT CONSOLE'}
          </span>
        </div>
        <span className="text-[8.5px] px-1.5 py-0.5 bg-[#15150F] text-[#C3E54E] font-bold">
          LIVE TELEMETRY
        </span>
      </div>

      {/* Sub-Tabs for Projects */}
      {selectedProject && (
        <div className="flex border-b border-[#15150F] bg-[#DCD6B2]/80 divide-x divide-[#15150F] text-[9px] font-mono font-semibold">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex-1 py-1.5 text-center uppercase tracking-wider transition-colors ${
              activeTab === 'overview' ? 'bg-[#15150F] text-[#D4CDA4] font-bold' : 'hover:bg-[#15150F] hover:text-[#D4CDA4] text-[#15150F]'
            }`}
          >
            01 // OVERVIEW
          </button>
          <button
            onClick={() => setActiveTab('architecture')}
            className={`flex-1 py-1.5 text-center uppercase tracking-wider transition-colors ${
              activeTab === 'architecture' ? 'bg-[#15150F] text-[#D4CDA4] font-bold' : 'hover:bg-[#15150F] hover:text-[#D4CDA4] text-[#15150F]'
            }`}
          >
            02 // ARCH
          </button>
          <button
            onClick={() => setActiveTab('metrics')}
            className={`flex-1 py-1.5 text-center uppercase tracking-wider transition-colors ${
              activeTab === 'metrics' ? 'bg-[#15150F] text-[#D4CDA4] font-bold' : 'hover:bg-[#15150F] hover:text-[#D4CDA4] text-[#15150F]'
            }`}
          >
            03 // METRICS
          </button>
          <button
            onClick={() => setActiveTab('manifest')}
            className={`flex-1 py-1.5 text-center uppercase tracking-wider transition-colors ${
              activeTab === 'manifest' ? 'bg-[#15150F] text-[#D4CDA4] font-bold' : 'hover:bg-[#15150F] hover:text-[#D4CDA4] text-[#15150F]'
            }`}
          >
            04 // SPEC
          </button>
        </div>
      )}

      {/* Inspector Content Area */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 font-mono text-[11px] leading-relaxed">
        {/* CASE 1: SELECTED PROJECT */}
        {selectedProject && (
          <div className="flex flex-col gap-4">
            {/* Header section */}
            <div className="flex flex-col gap-1 border-b border-[#15150F] pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[13.5px] font-bold text-[#15150F]">{selectedProject.code} // {selectedProject.title}</span>
                </div>
                <span className="text-[8.5px] px-1.5 py-0.5 bg-[#15150F] text-[#C3E54E] font-bold">
                  ● {selectedProject.status}
                </span>
              </div>
              <p className="text-[10px] text-[#3D3A2C] font-medium leading-snug">
                {selectedProject.tagline}
              </p>
              <div className="flex items-center gap-3 text-[9px] text-[#5C5946] mt-1">
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
                    <span className="text-[8.5px] font-bold opacity-60 uppercase tracking-wider">
                      SYSTEM SUMMARY
                    </span>
                    <ProvenanceBadge provenance={selectedProject.provenance?.summary || 'VERIFIED'} />
                  </div>
                  <p className="text-[10.5px] text-[#15150F] bg-[#E2DCB9]/70 p-2.5 border border-[#15150F]">
                    {selectedProject.summary}
                  </p>
                </div>

                {/* Problem vs Solution */}
                <div className="flex flex-col gap-2">
                  <div className="p-2.5 border border-[#15150F] bg-[#CBC59B]/30">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[8.5px] font-bold text-[#7A3E2E] uppercase block">
                        [ENGINEERING CHALLENGE]
                      </span>
                      <ProvenanceBadge provenance={selectedProject.provenance?.problem} />
                    </div>
                    <p className="text-[10px] text-[#22211A] leading-snug">
                      {selectedProject.problem}
                    </p>
                  </div>

                  <div className="p-2.5 border border-[#15150F] bg-[#CBC59B]/30">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[8.5px] font-bold text-[#2E6B3A] uppercase block">
                        [ARCHITECTURAL SOLUTION]
                      </span>
                      <ProvenanceBadge provenance={selectedProject.provenance?.solution} />
                    </div>
                    <p className="text-[10px] text-[#22211A] leading-snug">
                      {selectedProject.solution}
                    </p>
                  </div>
                </div>

                {/* Tech Stack & Linked Infrastructure */}
                <div>
                  <div className="text-[8.5px] font-bold opacity-60 uppercase tracking-wider mb-1.5">
                    ARCHITECTURAL TIER &amp; CAPABILITIES
                  </div>

                  {/* Architecture Layer Classification Badge */}
                  <div className="mb-2 p-2 bg-[#15150F] text-[#D4CDA4] border border-[#15150F] flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold text-[#C3E54E] uppercase tracking-wider">
                        TIER: {selectedProject.category === 'fullstack' ? 'FULL-STACK' : selectedProject.category.toUpperCase()}
                      </span>
                      <span className="text-[7.5px] px-1 py-0.5 bg-[#C3E54E] text-[#15150F] font-bold">
                        {selectedProject.techStack.length} TECHNOLOGIES
                      </span>
                    </div>
                    <div className="text-[8.5px] text-[#A8A48B] leading-tight">
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
                          className="flex items-center gap-1.5 px-2 py-1 text-[9px] font-semibold bg-[#E2DCB9] border border-[#15150F] hover:bg-[#15150F] hover:text-[#D4CDA4] transition-colors cursor-pointer"
                        >
                          <span className="w-1.5 h-1.5 bg-[#8EA9DA]"></span>
                          <span>{skill.name.split(' ')[0]}</span>
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
                    <span className="text-[8.5px] font-bold opacity-60 uppercase tracking-wider">
                      SUB-SERVICE DECOMPOSITION ({selectedProject.subsystems.length})
                    </span>
                    <ProvenanceBadge provenance={selectedProject.provenance?.subsystems} />
                  </div>
                  <div className="divide-y divide-[#15150F] border border-[#15150F] bg-[#E2DCB9]/40">
                    {selectedProject.subsystems.map((sub, i) => (
                      <div key={sub.id} className="p-2.5 flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[10px] text-[#15150F]">0{i+1} // {sub.name}</span>
                          <div className="flex items-center gap-1">
                            <span className="text-[8px] bg-[#15150F] text-[#D4CDA4] px-1">{sub.category}</span>
                            {sub.provenance && <ProvenanceBadge provenance={sub.provenance} />}
                          </div>
                        </div>
                        <p className="text-[9.5px] text-[#5C5946] leading-snug">{sub.description}</p>
                        {sub.protocol && (
                          <div className="text-[8.5px] text-[#15150F] font-bold">
                            PROTOCOL: {sub.protocol}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {sub.tech.map(t => (
                            <span key={t} className="text-[7.5px] px-1 bg-[#DCD6B2] border border-[#15150F]/30 text-[#3D3A2C]">
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                    {selectedProject.subsystems.length === 0 && (
                      <div className="p-3 text-[9.5px] text-[#5C5946] leading-relaxed">
                        No subsystem boundary is documented by the linked repository evidence.
                      </div>
                    )}
                  </div>
                </div>

                {/* Key Decisions & Trade-offs */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[8.5px] font-bold opacity-60 uppercase tracking-wider">
                      KEY ARCHITECTURAL DECISIONS &amp; TRADEOFFS
                    </span>
                    <ProvenanceBadge provenance={selectedProject.provenance?.keyDecisions} />
                  </div>
                  <div className="flex flex-col gap-2">
                    {selectedProject.keyDecisions.map((dec, i) => (
                      <div key={i} className="p-2.5 border border-[#15150F] bg-[#CBC59B]/40 flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <div className="font-bold text-[10px] text-[#15150F]">
                            DECISION: {dec.decision}
                          </div>
                          {dec.provenance && <ProvenanceBadge provenance={dec.provenance} />}
                        </div>
                        <div className="text-[9.5px] text-[#3D3A2C]">
                          <span className="font-semibold text-[#5C5946]">RATIONALE: </span>
                          {dec.rationale}
                        </div>
                        <div className="text-[8.5px] text-[#7A3E2E] bg-[#EFEAD0] p-1 border border-[#15150F]/30">
                          <span className="font-bold">TRADE-OFF: </span>
                          {dec.tradeoff}
                        </div>
                      </div>
                    ))}
                    {selectedProject.keyDecisions.length === 0 && (
                      <div className="p-3 border border-[#15150F] bg-[#E2DCB9]/50 text-[9.5px] text-[#5C5946] leading-relaxed">
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
                    <span className="text-[8.5px] font-bold opacity-60 uppercase tracking-wider">
                      01 // REPOSITORY SIGNALS (GITHUB METADATA)
                    </span>
                    <ProvenanceBadge provenance="VERIFIED" />
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {selectedProject.metrics.map((m, i) => (
                      <div key={i} className="p-2.5 border border-[#15150F] bg-[#E2DCB9] flex flex-col">
                        <span className="text-[7.5px] uppercase font-bold opacity-60">{m.label}</span>
                        <span className="text-[14px] font-bold text-[#15150F]">{m.value}</span>
                        {m.note && <span className="text-[7.5px] opacity-75">{m.note}</span>}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Group 2: Engineering Validation & Test Harness */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[8.5px] font-bold opacity-60 uppercase tracking-wider">
                      02 // ENGINEERING VALIDATION &amp; TEST HARNESS
                    </span>
                    <ProvenanceBadge provenance={selectedProject.provenance?.resilienceTesting} />
                  </div>
                  <div className="p-2.5 border border-[#15150F] bg-[#CBC59B]/40 flex flex-col gap-2">
                    <div className="text-[9.5px] leading-relaxed text-[#22211A]">
                      {selectedProject.resilienceTesting}
                    </div>

                    {/* Detected Validation Pills */}
                    {selectedProject.validationEvidence && (
                      <div className="flex flex-wrap gap-1 pt-1 border-t border-[#15150F]/20">
                        {selectedProject.validationEvidence.testFrameworks.map(tf => (
                          <span key={tf} className="text-[7.5px] px-1.5 py-0.5 bg-[#15150F] text-[#C3E54E] font-bold">
                            TEST: {tf}
                          </span>
                        ))}
                        {selectedProject.validationEvidence.e2eHarnesses.map(e2e => (
                          <span key={e2e} className="text-[7.5px] px-1.5 py-0.5 bg-[#15150F] text-[#8EA9DA] font-bold">
                            E2E: {e2e}
                          </span>
                        ))}
                        {selectedProject.validationEvidence.ciWorkflows.map(ci => (
                          <span key={ci} className="text-[7.5px] px-1.5 py-0.5 bg-[#DCD6B2] text-[#15150F] border border-[#15150F] font-bold">
                            CI: {ci}
                          </span>
                        ))}
                        {selectedProject.validationEvidence.hasDocker && (
                          <span key="docker" className="text-[7.5px] px-1.5 py-0.5 bg-[#DCD6B2] text-[#15150F] border border-[#15150F] font-bold">
                            CONTAINER: Docker
                          </span>
                        )}
                        {selectedProject.validationEvidence.testFilesDetected && selectedProject.validationEvidence.testFilesDetected > 0 ? (
                          <span className="text-[7.5px] px-1.5 py-0.5 bg-[#E2DCB9] text-[#15150F] border border-[#15150F]">
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
                    <span className="text-[8.5px] font-bold opacity-60 uppercase tracking-wider">
                      03 // RUNTIME TELEMETRY &amp; PERFORMANCE
                    </span>
                    <ProvenanceBadge provenance={selectedProject.performanceEvidence?.claimed ? 'VERIFIED' : 'UNAVAILABLE'} />
                  </div>
                  <div className="p-2.5 border border-[#15150F] bg-[#E2DCB9]/60 text-[9px] text-[#5C5946] leading-relaxed">
                    {selectedProject.performanceEvidence?.notes || 'No runtime benchmarks or production telemetry claimed in repository.'}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 04: SPEC & ACTIONS */}
            {activeTab === 'manifest' && (
              <div className="flex flex-col gap-3">
                <div className="text-[8.5px] font-bold opacity-60 uppercase tracking-wider">
                  SYSTEM MANIFEST &amp; EXTERNAL ARTIFACTS
                </div>
                <div className="p-2.5 border border-[#15150F] bg-[#E2DCB9]/60 font-mono text-[9.5px] flex flex-col gap-1">
                  <div>REPO_ID: {selectedProject.id}</div>
                  <div>LAYER_TYPE: {selectedProject.category.toUpperCase()}</div>
                  <div>STATUS: {selectedProject.status}</div>
                  <div>SUBSYSTEM_COUNT: {selectedProject.subsystems.length}</div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-col gap-2 mt-2">
                  <button
                    onClick={() => onDrillIntoProject(selectedProject.id)}
                    className="w-full py-2.5 bg-[#15150F] text-[#C3E54E] font-bold text-[10px] tracking-wider border border-[#15150F] hover:bg-[#2A2920] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>ENTER SYSTEM DECOMPOSITION</span>
                    <ArrowUpRight size={13} />
                  </button>

                  <button
                    onClick={onOpenCaseStudy}
                    className="w-full py-2 bg-[#E2DCB9] text-[#15150F] font-bold text-[10px] tracking-wider border border-[#15150F] hover:bg-[#15150F] hover:text-[#D4CDA4] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <FileText size={12} />
                    <span>OPEN FULL ARCHITECTURE SPEC</span>
                  </button>

                  {selectedProject.links.github && (
                    <a
                      href={selectedProject.links.github}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full py-1.5 bg-[#CBC59B] text-[#15150F] font-semibold text-[9.5px] tracking-wider border border-[#15150F] hover:bg-[#15150F] hover:text-[#D4CDA4] flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Github size={12} />
                      <span>VIEW SOURCE CODE (GITHUB)</span>
                    </a>
                  )}

                  {selectedProject.links.demo && (
                    <a
                      href={selectedProject.links.demo}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full py-1.5 bg-[#C3E54E] text-[#15150F] font-bold text-[9.5px] tracking-wider border border-[#15150F] hover:bg-[#B2D63B] flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <ExternalLink size={12} />
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
            <div className="border-b border-[#15150F] pb-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-bold text-[#15150F]">{selectedSkill.code} // {selectedSkill.name}</span>
                <span className="text-[8.5px] bg-[#15150F] text-[#8EA9DA] px-1.5 py-0.5 font-bold">
                  {selectedSkill.yearsActive > 0 ? `${selectedSkill.yearsActive} YRS ACTIVE` : 'YEARS NOT CLAIMED'}
                </span>
              </div>
              <div className="text-[9px] text-[#5C5946] mt-1">
                PROFICIENCY: {selectedSkill.proficiencyScore > 0 ? `${selectedSkill.proficiencyScore}/100` : 'NOT CLAIMED'} · {selectedSkill.systemCount} SYSTEMS MAPPED
              </div>
            </div>

            {/* Connected Systems */}
            <div>
              <div className="text-[8.5px] font-bold opacity-60 uppercase tracking-wider mb-1.5">
                DEPLOYED IN PRODUCTION SYSTEMS
              </div>
              <div className="flex flex-col gap-1.5">
                {(() => {
                  const matchedProjects = projects.filter(p => 
                    selectedSkill.usedInProjects.includes(p.id) || 
                    p.infrastructureDeps.includes(selectedSkill.id) ||
                    p.techStack.some(t => t.toLowerCase().includes(selectedSkill.name.toLowerCase().split(' ')[0]))
                  );

                  if (matchedProjects.length === 0) {
                    return (
                      <div className="text-[9px] text-[#5C5946] italic p-2 bg-[#E2DCB9]/40 border border-[#15150F]/40">
                        Capability available across repository cluster.
                      </div>
                    );
                  }

                  return matchedProjects.map(p => (
                    <button
                      key={p.id}
                      onClick={() => onSelectProject(p.id)}
                      className="flex items-center justify-between p-2 bg-[#E2DCB9] border border-[#15150F] hover:bg-[#15150F] hover:text-[#D4CDA4] transition-colors text-left group cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5" style={{ backgroundColor: p.accentColor }}></span>
                        <span className="font-bold text-[10px]">{p.code}</span>
                        <span className="text-[9.5px] truncate max-w-[170px]">{p.title}</span>
                      </div>
                      <span className="text-[8px] opacity-60 group-hover:text-[#C3E54E]">INSPECT →</span>
                    </button>
                  ));
                })()}
              </div>
            </div>

            {/* Primary Use Cases */}
            <div>
              <div className="text-[8.5px] font-bold opacity-60 uppercase tracking-wider mb-1.5">
                PRIMARY USE CASES
              </div>
              <div className="p-2.5 border border-[#15150F] bg-[#E2DCB9] flex flex-col gap-1">
                {selectedSkill.primaryUseCases.map((uc, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-[9.5px]">
                    <span className="text-[#8EA9DA] font-bold">›</span>
                    <span className="text-[#22211A]">{uc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Technical Highlights */}
            <div>
              <div className="text-[8.5px] font-bold opacity-60 uppercase tracking-wider mb-1.5">
                TECHNICAL HIGHLIGHTS
              </div>
              <div className="p-2.5 border border-[#15150F] bg-[#E2DCB9] flex flex-col gap-1">
                {selectedSkill.technicalHighlights.map((th, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-[9.5px]">
                    <span className="text-[#C3E54E] font-bold">›</span>
                    <span className="text-[#22211A]">{th}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Architectural Blueprint / Sample Pattern */}
            <div>
              <div className="text-[8.5px] font-bold opacity-60 uppercase tracking-wider mb-1.5">
                ARCHITECTURAL BLUEPRINT / PATTERN
              </div>
              <pre className="p-2.5 border border-[#15150F] bg-[#15150F] text-[#D4CDA4] text-[8.5px] overflow-x-auto leading-tight font-mono whitespace-pre-wrap">
                {selectedSkill.samplePattern}
              </pre>
            </div>
          </div>
        )}

        {/* CASE 3: SELECTED EXPERIENCE NODE */}
        {selectedExperience && !selectedProject && !selectedSkill && (
          <div className="flex flex-col gap-4">
            {/* Header section */}
            <div className="border-b border-[#15150F] pb-2.5 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-bold text-[#15150F]">
                  {selectedExperience.code} // {selectedExperience.organization}
                </span>
                <ProvenanceBadge provenance={selectedExperience.provenance || 'CURATED'} />
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-[#3D3A2C] font-semibold">
                <span>{selectedExperience.role}</span>
                <span>·</span>
                <span>{selectedExperience.location}</span>
              </div>
              <div className="flex items-center justify-between text-[9px] text-[#5C5946] mt-0.5 font-mono">
                <span>TIMEFRAME: {selectedExperience.yearRange}</span>
                {selectedExperience.promotionNote && (
                  <span className="text-[7.5px] px-1 py-0.2 bg-[#2E6B3A] text-[#D4CDA4] font-bold">
                    ↑ {selectedExperience.promotionNote}
                  </span>
                )}
              </div>
            </div>

            {/* 1. CAREER PROGRESSION TIMELINE (When multiple roles in progressionGroup) */}
            {selectedExperience.progressionRoles && selectedExperience.progressionRoles.length > 1 && (
              <div>
                <div className="text-[8.5px] font-bold opacity-60 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>CAREER PROGRESSION // TIMELINE</span>
                  <span className="text-[7.5px] opacity-75">{selectedExperience.progressionRoles.length} ROLES</span>
                </div>
                <div className="flex flex-col border border-[#15150F] bg-[#E2DCB9]/40 divide-y divide-[#15150F]/30">
                  {selectedExperience.progressionRoles.map((r, i) => (
                    <div key={r.id || i} className="p-2.5 flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[10.5px] text-[#15150F]">
                          {r.role}
                        </span>
                        <div className="flex items-center gap-1">
                          {r.endDate === null && (
                            <span className="text-[7.5px] px-1 bg-[#15150F] text-[#C3E54E] font-bold">
                              CURRENT
                            </span>
                          )}
                          {r.promotionNote && (
                            <span className="text-[7.5px] px-1 bg-[#2E6B3A] text-[#D4CDA4] font-bold">
                              ↑ PROMOTED
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-[8.5px] font-mono text-[#5C5946]">
                        {r.yearRange}
                      </div>
                      {r.keyOutputs && r.keyOutputs.length > 0 && (
                        <p className="text-[9px] text-[#3D3A2C] leading-snug mt-0.5">
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
                  <span className="text-[8.5px] font-bold opacity-60 uppercase tracking-wider">
                    SYSTEMS ARCHITECTED
                  </span>
                  <span className="text-[7.5px] px-1 bg-[#15150F] text-[#C3E54E] font-bold">
                    HIGH BAR
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {selectedExperience.architectedSystemsDetails && selectedExperience.architectedSystemsDetails.length > 0 ? (
                    selectedExperience.architectedSystemsDetails.map((arch, idx) => (
                      <div key={idx} className="p-2.5 border border-[#15150F] bg-[#E2DCB9] flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[10px] text-[#15150F]">{arch.name}</span>
                          <ProvenanceBadge provenance={arch.provenance || 'VERIFIED'} />
                        </div>
                        <p className="text-[9.5px] text-[#22211A] leading-snug">
                          {arch.description}
                        </p>
                        {arch.architecturalScope && arch.architecturalScope.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1 border-t border-[#15150F]/20">
                            {arch.architecturalScope.map((sc, i) => (
                              <span key={i} className="text-[7.5px] px-1 bg-[#15150F] text-[#D4CDA4] font-mono">
                                {sc}
                              </span>
                            ))}
                          </div>
                        )}
                        {arch.linkedProjectId && (
                          <button
                            onClick={() => onSelectProject(arch.linkedProjectId!)}
                            className="mt-1 flex items-center justify-between px-2 py-1 bg-[#CBC59B] border border-[#15150F] text-[8.5px] font-bold hover:bg-[#15150F] hover:text-[#D4CDA4] transition-colors cursor-pointer text-left"
                          >
                            <span>INSPECT ARCHITECTURE REPO: {arch.linkedProjectId}</span>
                            <ArrowUpRight size={10} />
                          </button>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedExperience.systemsArchitected.map(sys => (
                        <span key={sys} className="px-2 py-1 bg-[#E2DCB9] border border-[#15150F] text-[9.5px] font-semibold">
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
                  <span className="text-[8.5px] font-bold opacity-60 uppercase tracking-wider">
                    PROFESSIONAL SYSTEMS DELIVERED ({selectedExperience.systemsDelivered.length})
                  </span>
                </div>
                <div className="flex flex-col gap-2.5">
                  {selectedExperience.systemsDelivered.map((del, dIdx) => (
                    <div key={dIdx} className="p-2.5 border border-[#15150F] bg-[#E2DCB9]/80 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[10.5px] text-[#15150F]">{del.name}</span>
                        <ProvenanceBadge provenance={del.provenance || 'CURATED'} />
                      </div>
                      {del.status && (
                        <div className="text-[7.5px] font-bold text-[#7A3E2E] bg-[#EFEAD0] px-1.5 py-0.5 border border-[#15150F]/30 w-fit">
                          STATUS: {del.status}
                        </div>
                      )}
                      <p className="text-[9.5px] text-[#3D3A2C] leading-snug">
                        {del.description || del.tagline}
                      </p>

                      {/* Data Flow Diagram (if present) */}
                      {del.dataFlow && (
                        <div className="p-2 bg-[#15150F] text-[#D4CDA4] border border-[#15150F] text-[8px] font-mono leading-relaxed">
                          <span className="text-[#C3E54E] font-bold block mb-0.5">DATA INGESTION PIPELINE:</span>
                          {del.dataFlow}
                        </div>
                      )}

                      {/* Capabilities (if present) */}
                      {del.capabilities && del.capabilities.length > 0 && (
                        <div className="flex flex-col gap-0.5 pt-1 border-t border-[#15150F]/20">
                          <span className="text-[7.5px] font-bold opacity-60 uppercase">SYSTEM CAPABILITIES:</span>
                          {del.capabilities.map((cap, cIdx) => (
                            <div key={cIdx} className="flex items-start gap-1 text-[8.5px] text-[#22211A]">
                              <span className="text-[#2E6B3A] font-bold">▪</span>
                              <span>{cap}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Surface Breakdown Tree (e.g. Backend, Admin Web, Mobile) */}
                      {del.surfaces && del.surfaces.length > 0 && (
                        <div className="flex flex-col gap-1.5 pt-1 border-t border-[#15150F]/20">
                          <span className="text-[7.5px] font-bold opacity-60 uppercase">PLATFORM SURFACES:</span>
                          <div className="divide-y divide-[#15150F]/20 bg-[#DCD6B2]/60 border border-[#15150F]/30">
                            {del.surfaces.map((sfc, sIdx) => (
                              <div key={sIdx} className="p-2 flex flex-col gap-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-[9.5px] text-[#15150F]">
                                    {sIdx === del.surfaces!.length - 1 ? '└──' : '├──'} {sfc.name}
                                  </span>
                                  {sfc.status && (
                                    <span className="text-[7px] px-1 bg-[#15150F] text-[#C3E54E] font-bold">
                                      {sfc.status}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[8.5px] text-[#5C5946] leading-snug pl-3">
                                  {sfc.role}
                                </p>
                                <div className="flex flex-wrap gap-1 pl-3 mt-0.5">
                                  {sfc.tech.map(t => (
                                    <span key={t} className="text-[7px] px-1 bg-[#E2DCB9] text-[#15150F] border border-[#15150F]/30 font-mono">
                                      {t}
                                    </span>
                                  ))}
                                </div>
                                {sfc.linkedProjectId && (
                                  <div className="pl-3 mt-1">
                                    <button
                                      onClick={() => onSelectProject(sfc.linkedProjectId!)}
                                      className="flex items-center gap-1 px-1.5 py-0.5 bg-[#15150F] text-[#D4CDA4] hover:bg-[#C3E54E] hover:text-[#15150F] text-[7.5px] font-bold transition-colors cursor-pointer"
                                    >
                                      <span>INSPECT {sfc.linkedProjectId}</span>
                                      <ArrowUpRight size={9} />
                                    </button>
                                  </div>
                                )}
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
                <div className="text-[8.5px] font-bold opacity-60 uppercase tracking-wider mb-1.5">
                  ENGINEERING CONTRIBUTIONS &amp; DELIVERABLES
                </div>
                <div className="p-2.5 border border-[#15150F] bg-[#E2DCB9] flex flex-col gap-2">
                  {selectedExperience.engineeringContributions && selectedExperience.engineeringContributions.length > 0 ? (
                    selectedExperience.engineeringContributions.map((contrib, i) => (
                      <div key={i} className="flex flex-col gap-0.5 border-b border-[#15150F]/20 pb-1.5 last:border-b-0 last:pb-0">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1 text-[9.5px] font-bold text-[#15150F]">
                            <span className="text-[#2E6B3A]">✓</span>
                            <span>{contrib.title}</span>
                          </div>
                          <ProvenanceBadge provenance={contrib.provenance || 'CURATED'} />
                        </div>
                        <p className="text-[9px] text-[#22211A] leading-snug pl-3">
                          {contrib.description}
                        </p>
                        {contrib.impactArea && (
                          <div className="pl-3 mt-0.5">
                            <span className="text-[7px] px-1 bg-[#15150F] text-[#8EA9DA] font-mono">
                              IMPACT: {contrib.impactArea}
                            </span>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    selectedExperience.keyOutputs.map((out, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-[9.5px]">
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
                <div className="text-[8.5px] font-bold opacity-60 uppercase tracking-wider mb-1.5">
                  INFRASTRUCTURE &amp; OPERATIONS
                </div>
                <div className="p-2.5 border border-[#15150F] bg-[#E2DCB9]/60 flex flex-col gap-2">
                  {selectedExperience.infrastructureOperations.map((infra, i) => (
                    <div key={i} className="flex flex-col gap-0.5 border-b border-[#15150F]/20 pb-1.5 last:border-b-0 last:pb-0">
                      <div className="flex items-center justify-between">
                        <span className="text-[9.5px] font-bold text-[#15150F]">
                          0{i + 1} // {infra.area}
                        </span>
                        {infra.status && (
                          <span className="text-[7px] px-1 bg-[#15150F] text-[#C3E54E] font-bold">
                            {infra.status}
                          </span>
                        )}
                      </div>
                      <p className="text-[9px] text-[#3D3A2C] leading-snug">
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
                <div className="text-[8.5px] font-bold opacity-60 uppercase tracking-wider mb-1.5">
                  CONNECTED EVIDENCE REPOSITORIES ({selectedExperience.evidenceLinks.length})
                </div>
                <div className="flex flex-col gap-1.5">
                  {selectedExperience.evidenceLinks.map((link, i) => (
                    <div key={i} className="flex flex-col gap-1 p-2 bg-[#E2DCB9] border border-[#15150F]">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[9.5px]">{link.label}</span>
                        <span className="text-[7.5px] px-1 bg-[#15150F] text-[#8EA9DA] uppercase font-bold">
                          {link.type}
                        </span>
                      </div>
                      {link.note && <p className="text-[8.5px] text-[#5C5946]">{link.note}</p>}
                      <div className="flex items-center gap-1.5 mt-1">
                        {link.projectId && (
                          <button
                            onClick={() => onSelectProject(link.projectId!)}
                            className="flex-1 py-1 bg-[#15150F] text-[#C3E54E] hover:bg-[#2A2920] font-bold text-[8px] tracking-wider transition-colors flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <span>INSPECT ON TOPOLOGY</span>
                            <ArrowUpRight size={10} />
                          </button>
                        )}
                        {link.url && (
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noreferrer"
                            className="py-1 px-2 bg-[#CBC59B] text-[#15150F] hover:bg-[#15150F] hover:text-[#D4CDA4] font-bold text-[8px] tracking-wider border border-[#15150F] transition-colors flex items-center gap-1"
                          >
                            <Github size={10} />
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
                <div className="text-[8.5px] font-bold opacity-60 uppercase tracking-wider mb-1.5">
                  TECHNOLOGY SURFACE
                </div>
                <div className="flex flex-wrap gap-1">
                  {selectedExperience.technologies.map(t => (
                    <span key={t} className="text-[8.5px] px-1.5 py-0.5 bg-[#15150F] text-[#D4CDA4] font-bold">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* CASE 4: SELECTED PRINCIPLE */}
        {selectedPrinciple && !selectedProject && !selectedSkill && !selectedExperience && (
          <div className="flex flex-col gap-4">
            <div className="border-b border-[#15150F] pb-2.5">
              <span className="text-[8.5px] px-1.5 py-0.5 bg-[#15150F] text-[#C3E54E] font-bold uppercase tracking-widest inline-block mb-1">
                OPERATING PRINCIPLE // {selectedPrinciple.number}
              </span>
              <div className="text-[13px] font-bold text-[#15150F] leading-tight">
                {selectedPrinciple.title}
              </div>
            </div>

            <div>
              <div className="text-[8.5px] font-bold opacity-60 uppercase tracking-wider mb-1.5">
                RULE SPECIFICATION
              </div>
              <p className="text-[10.5px] text-[#15150F] bg-[#E2DCB9] p-3 border border-[#15150F] leading-relaxed">
                {selectedPrinciple.rule}
              </p>
            </div>

            <div>
              <div className="text-[8.5px] font-bold opacity-60 uppercase tracking-wider mb-1.5">
                CONCRETE DEMONSTRATION
              </div>
              <div className="p-3 border border-[#15150F] bg-[#CBC59B]/40 text-[10px] text-[#22211A] leading-relaxed">
                {selectedPrinciple.demonstration}
              </div>
            </div>
          </div>
        )}

        {/* CASE 5: ROOT OPERATOR CONSOLE */}
        {!selectedProject && !selectedSkill && !selectedExperience && !selectedPrinciple && (
          <div className="flex flex-col gap-4">
            {/* Operator Identity Block */}
            <div className="border-b border-[#15150F] pb-3">
              <div className="text-[14px] font-bold text-[#15150F]">{activeOperator.name}</div>
              <div className="text-[10px] text-[#5C5946] font-semibold">{activeOperator.handle} · {activeOperator.role}</div>
              <div className="text-[9px] text-[#5C5946] mt-0.5">LOCATION: {activeOperator.location}</div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 gap-1.5">
              <div className="p-2 border border-[#15150F] bg-[#E2DCB9] flex flex-col">
                <span className="text-[7.5px] opacity-60 uppercase font-bold">SYSTEMS VISUALIZED</span>
                <span className="text-[15px] font-bold text-[#15150F]">{projects.length} REPOSITORIES</span>
              </div>
              <div className="p-2 border border-[#15150F] bg-[#E2DCB9] flex flex-col">
                <span className="text-[7.5px] opacity-60 uppercase font-bold">CAPABILITY PLINTHS</span>
                <span className="text-[15px] font-bold text-[#15150F]">{skills.length} MODULES</span>
              </div>
            </div>

            {/* Manifesto / Summary */}
            <div>
              <div className="text-[8.5px] font-bold opacity-60 uppercase tracking-wider mb-1">
                SYSTEM MANIFESTO
              </div>
              <p className="text-[10px] text-[#22211A] bg-[#E2DCB9]/80 p-2.5 border border-[#15150F] leading-relaxed">
                {activeOperator.systemManifesto}
              </p>
            </div>

            {/* Primary Stack */}
            <div>
              <div className="text-[8.5px] font-bold opacity-60 uppercase tracking-wider mb-1.5">
                PRIMARY STACK MATRIX
              </div>
              <div className="flex flex-wrap gap-1">
                {activeOperator.primaryStack.map(st => (
                  <span key={st} className="text-[8.5px] px-2 py-0.5 bg-[#15150F] text-[#D4CDA4] font-bold">
                    {st}
                  </span>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-1.5 mt-2">
              <button
                onClick={onOpenContact}
                className="w-full py-2 bg-[#15150F] text-[#C3E54E] font-bold text-[10px] tracking-wider border border-[#15150F] hover:bg-[#2A2920] transition-colors cursor-pointer"
              >
                DISPATCH ENCRYPTED COMMS
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

