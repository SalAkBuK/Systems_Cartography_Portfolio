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
  Flame
} from 'lucide-react';
import { 
  ProjectData, 
  InfrastructureSkill, 
  ExperienceNode, 
  SubsystemNode,
  ArchitecturePrinciple,
  OperatorMetadata
} from '../types';
import {
  VERIFIED_ARCHITECTURE_PRINCIPLES as ARCHITECTURE_PRINCIPLES,
  VERIFIED_EXPERIENCE as EXPERIENCE_HISTORY,
  VERIFIED_OPERATOR_METADATA as OPERATOR_METADATA,
  VERIFIED_PROJECTS as PROJECTS,
  VERIFIED_SKILLS as INFRASTRUCTURE_SKILLS
} from '../data/verifiedPortfolioData';

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
                  <div className="text-[8.5px] font-bold opacity-60 uppercase tracking-wider mb-1">
                    SYSTEM SUMMARY
                  </div>
                  <p className="text-[10.5px] text-[#15150F] bg-[#E2DCB9]/70 p-2.5 border border-[#15150F]">
                    {selectedProject.summary}
                  </p>
                </div>

                {/* Problem vs Solution */}
                <div className="flex flex-col gap-2">
                  <div className="p-2.5 border border-[#15150F] bg-[#CBC59B]/30">
                    <span className="text-[8.5px] font-bold text-[#7A3E2E] uppercase block mb-1">
                      [ENGINEERING CHALLENGE]
                    </span>
                    <p className="text-[10px] text-[#22211A] leading-snug">
                      {selectedProject.problem}
                    </p>
                  </div>

                  <div className="p-2.5 border border-[#15150F] bg-[#CBC59B]/30">
                    <span className="text-[8.5px] font-bold text-[#2E6B3A] uppercase block mb-1">
                      [ARCHITECTURAL SOLUTION]
                    </span>
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
                        TIER: {selectedProject.category === 'fullstack' ? 'FULL-STACK DISTRIBUTED' : selectedProject.category.toUpperCase()}
                      </span>
                      <span className="text-[7.5px] px-1 py-0.5 bg-[#C3E54E] text-[#15150F] font-bold">
                        {selectedProject.techStack.length} TECHNOLOGIES
                      </span>
                    </div>
                    <div className="text-[8.5px] text-[#A8A48B] leading-tight">
                      {selectedProject.category === 'fullstack' 
                        ? 'Includes client-side reactive interface, API transaction gateway, and persistence layer.'
                        : selectedProject.category === 'backend'
                        ? 'Focused on server runtime, compute algorithms, and data invariants.'
                        : selectedProject.category === 'frontend'
                        ? 'Focused on component architecture, state management, and user rendering.'
                        : selectedProject.category === 'infrastructure'
                        ? 'Focused on orchestration, containerization, networks, and service meshes.'
                        : 'Focused on developer productivity, CLI interfaces, and compilers.'}
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
                  <div className="text-[8.5px] font-bold opacity-60 uppercase tracking-wider mb-1.5">
                    SUB-SERVICE DECOMPOSITION ({selectedProject.subsystems.length})
                  </div>
                  <div className="divide-y divide-[#15150F] border border-[#15150F] bg-[#E2DCB9]/40">
                    {selectedProject.subsystems.map((sub, i) => (
                      <div key={sub.id} className="p-2.5 flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[10px] text-[#15150F]">0{i+1} // {sub.name}</span>
                          <span className="text-[8px] bg-[#15150F] text-[#D4CDA4] px-1">{sub.category}</span>
                        </div>
                        <p className="text-[9.5px] text-[#5C5946] leading-snug">{sub.description}</p>
                        {sub.protocol && (
                          <div className="text-[8.5px] text-[#15150F] font-bold">
                            PROTOCOL: {sub.protocol}
                          </div>
                        )}
                      </div>
                    ))}
                    {selectedProject.subsystems.length === 0 && (
                      <div className="p-3 text-[9.5px] text-[#5C5946] leading-relaxed">
                        No subsystem boundary is documented by the current CV or linked repository evidence.
                      </div>
                    )}
                  </div>
                </div>

                {/* Key Decisions & Trade-offs */}
                <div>
                  <div className="text-[8.5px] font-bold opacity-60 uppercase tracking-wider mb-1.5">
                    KEY ARCHITECTURAL DECISIONS &amp; TRADEOFFS
                  </div>
                  <div className="flex flex-col gap-2">
                    {selectedProject.keyDecisions.map((dec, i) => (
                      <div key={i} className="p-2.5 border border-[#15150F] bg-[#CBC59B]/40 flex flex-col gap-1">
                        <div className="font-bold text-[10px] text-[#15150F]">
                          DECISION: {dec.decision}
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
                {/* Telemetry Benchmarks */}
                <div>
                  <div className="text-[8.5px] font-bold opacity-60 uppercase tracking-wider mb-1.5">
                    EVIDENCE &amp; REPOSITORY METRICS
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

                {/* Resilience Testing */}
                <div>
                  <div className="text-[8.5px] font-bold opacity-60 uppercase tracking-wider mb-1">
                    VALIDATION &amp; TEST EVIDENCE
                  </div>
                  <div className="p-2.5 border border-[#15150F] bg-[#CBC59B]/40 text-[9.5px] leading-relaxed text-[#22211A]">
                    {selectedProject.resilienceTesting}
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
                    className="w-full py-2.5 bg-[#15150F] text-[#C3E54E] font-bold text-[10px] tracking-wider border border-[#15150F] hover:bg-[#2A2920] flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <span>ENTER SYSTEM DECOMPOSITION</span>
                    <ArrowUpRight size={13} />
                  </button>

                  <button
                    onClick={onOpenCaseStudy}
                    className="w-full py-2 bg-[#E2DCB9] text-[#15150F] font-bold text-[10px] tracking-wider border border-[#15150F] hover:bg-[#15150F] hover:text-[#D4CDA4] flex items-center justify-center gap-1.5 transition-colors"
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
                PROFICIENCY INDEX: {selectedSkill.proficiencyScore}/100 · {selectedSkill.systemCount} SYSTEMS MAPPED
              </div>
            </div>

            {/* Connected Systems */}
            <div>
              <div className="text-[8.5px] font-bold opacity-60 uppercase tracking-wider mb-1.5">
                DEPLOYED IN PRODUCTION SYSTEMS
              </div>
              <div className="flex flex-col gap-1.5">
                {(() => {
                  // Check explicit usedInProjects or projects that declare this skill in infrastructureDeps
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
              <div className="text-[8.5px] font-bold opacity-60 uppercase tracking-wider mb-1">
                PRIMARY ARCHITECTURAL USE CASES
              </div>
              <ul className="flex flex-col gap-1 text-[9.5px] text-[#22211A] bg-[#CBC59B]/30 p-2.5 border border-[#15150F]">
                {selectedSkill.primaryUseCases.map((uc, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="opacity-60 font-bold">▪</span>
                    <span>{uc}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Sample Architectural Pattern */}
            <div>
              <div className="text-[8.5px] font-bold opacity-60 uppercase tracking-wider mb-1">
                PRODUCTION CODE / ARCHITECTURE PATTERN
              </div>
              <pre className="p-2.5 bg-[#15150F] text-[#D4CDA4] text-[8.5px] leading-tight font-mono overflow-x-auto border border-[#15150F]">
                <code>{selectedSkill.samplePattern}</code>
              </pre>
            </div>
          </div>
        )}

        {/* CASE 3: SELECTED EXPERIENCE LOG */}
        {selectedExperience && !selectedProject && !selectedSkill && (
          <div className="flex flex-col gap-4">
            <div className="border-b border-[#15150F] pb-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-bold text-[#15150F]">{selectedExperience.code} // {selectedExperience.role}</span>
                <span className="text-[8.5px] bg-[#15150F] text-[#C3E54E] px-1.5 py-0.5 font-bold">
                  {selectedExperience.yearRange}
                </span>
              </div>
              <div className="text-[10px] font-semibold text-[#3D3A2C] mt-0.5">
                {selectedExperience.organization} · {selectedExperience.location}
              </div>
              <div className="text-[8.5px] opacity-60 mt-1">
                DOMAIN: {selectedExperience.systemDomain}
              </div>
            </div>

            {/* Key Outputs */}
            <div>
              <div className="text-[8.5px] font-bold opacity-60 uppercase tracking-wider mb-1.5">
                KEY TECHNICAL OUTPUTS &amp; IMPACT
              </div>
              <div className="flex flex-col gap-1.5">
                {selectedExperience.keyOutputs.map((out, i) => (
                  <div key={i} className="p-2 bg-[#E2DCB9]/70 border border-[#15150F] text-[9.5px] leading-snug text-[#22211A] flex items-start gap-1.5">
                    <span className="opacity-60 font-bold shrink-0">0{i+1}.</span>
                    <span>{out}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Systems Architected */}
            <div>
              <div className="text-[8.5px] font-bold opacity-60 uppercase tracking-wider mb-1">
                SYSTEMS ARCHITECTED
              </div>
              <div className="flex flex-wrap gap-1">
                {selectedExperience.systemsArchitected.map(sys => (
                  <span key={sys} className="px-2 py-0.5 bg-[#CBC59B] border border-[#15150F] text-[9px] font-bold">
                    {sys}
                  </span>
                ))}
              </div>
            </div>

            {/* Technologies */}
            <div>
              <div className="text-[8.5px] font-bold opacity-60 uppercase tracking-wider mb-1">
                CORE STACK DEPLOYED
              </div>
              <div className="flex flex-wrap gap-1">
                {selectedExperience.technologies.map(t => (
                  <span key={t} className="px-1.5 py-0.5 bg-[#15150F] text-[#D4CDA4] text-[8.5px]">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* CASE 4: SELECTED PRINCIPLE */}
        {selectedPrinciple && !selectedProject && !selectedSkill && !selectedExperience && (
          <div className="flex flex-col gap-4">
            <div className="border-b border-[#15150F] pb-2.5">
              <span className="text-[8.5px] font-bold opacity-60 uppercase tracking-widest block">
                SYSTEM PROCESS // AXIOM {selectedPrinciple.number}
              </span>
              <span className="text-[13px] font-bold text-[#15150F]">{selectedPrinciple.title}</span>
            </div>

            <div className="p-2.5 bg-[#E2DCB9] border border-[#15150F] text-[10px] font-medium leading-snug text-[#15150F]">
              "{selectedPrinciple.summary}"
            </div>

            <div>
              <div className="text-[8.5px] font-bold opacity-60 uppercase tracking-wider mb-1">
                ARCHITECTURAL ELABORATION
              </div>
              <p className="text-[9.5px] leading-relaxed text-[#22211A] bg-[#CBC59B]/30 p-2.5 border border-[#15150F]">
                {selectedPrinciple.elaboration}
              </p>
            </div>

            <div>
              <div className="text-[8.5px] font-bold opacity-60 uppercase tracking-wider mb-1">
                APPLIED IN SYSTEMS
              </div>
              <div className="flex flex-col gap-1">
                {(() => {
                  let matched = projects.filter(p => selectedPrinciple.appliedIn.includes(p.id));
                  if (matched.length === 0 && projects.length > 0) {
                    matched = projects.slice(0, 2);
                  }
                  return matched.map(p => (
                    <button
                      key={p.id}
                      onClick={() => onSelectProject(p.id)}
                      className="p-1.5 bg-[#E2DCB9] border border-[#15150F] text-left text-[9px] font-bold flex justify-between hover:bg-[#15150F] hover:text-[#D4CDA4] transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5" style={{ backgroundColor: p.accentColor }}></span>
                        <span>{p.code} // {p.title}</span>
                      </div>
                      <span>INSPECT →</span>
                    </button>
                  ));
                })()}
              </div>
            </div>
          </div>
        )}

        {/* CASE 5: ROOT SYSTEM OVERVIEW (Default) */}
        {!selectedProject && !selectedSkill && !selectedExperience && !selectedPrinciple && (
          <div className="flex flex-col gap-4">
            {/* Operator Identity Block */}
            <div className="border-b border-[#15150F] pb-3 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-bold text-[#15150F]">{activeOperator.name}</span>
                <span className="text-[8px] bg-[#15150F] text-[#C3E54E] px-1.5 py-0.5 font-bold">
                  {activeOperator.status.split('//')[0]}
                </span>
              </div>
              <div className="text-[10px] font-semibold text-[#3D3A2C]">
                {activeOperator.role}
              </div>
              <div className="text-[8.5px] opacity-60">
                {activeOperator.location}
              </div>
            </div>

            {/* Manifesto */}
            <div>
              <div className="text-[8.5px] font-bold opacity-60 uppercase tracking-wider mb-1">
                SYSTEM MANIFESTO &amp; PHILOSOPHY
              </div>
              <p className="text-[10px] text-[#15150F] bg-[#E2DCB9]/70 p-2.5 border border-[#15150F] leading-relaxed">
                {activeOperator.systemManifesto}
              </p>
            </div>

            {/* Quick System Telemetry Grid */}
            <div className="grid grid-cols-2 gap-1.5">
              <div className="p-2 border border-[#15150F] bg-[#CBC59B]/40">
                <span className="text-[7.5px] uppercase font-bold opacity-60">MAPPED SYSTEMS</span>
                <span className="text-[14px] font-bold text-[#15150F] block">{projects.length} PRODUCTION</span>
              </div>
              <div className="p-2 border border-[#15150F] bg-[#CBC59B]/40">
                <span className="text-[7.5px] uppercase font-bold opacity-60">CAREER ACTIVE</span>
                <span className="text-[14px] font-bold text-[#15150F] block">{activeOperator.yearsActive > 0 ? `${activeOperator.yearsActive} YEARS` : 'NOT CLAIMED'}</span>
              </div>
              <div className="p-2 border border-[#15150F] bg-[#CBC59B]/40">
                <span className="text-[7.5px] uppercase font-bold opacity-60">COMMITS INDEXED</span>
                <span className="text-[14px] font-bold text-[#15150F] block">{activeOperator.commitsIndexed}</span>
              </div>
              <div className="p-2 border border-[#15150F] bg-[#CBC59B]/40">
                <span className="text-[7.5px] uppercase font-bold opacity-60">SLA RELIABILITY</span>
                <span className="text-[14px] font-bold text-[#15150F] block">{activeOperator.productionUptime}</span>
              </div>
            </div>

            {/* Flagship Projects Quick Jump */}
            <div>
              <div className="text-[8.5px] font-bold opacity-60 uppercase tracking-wider mb-1.5">
                FLAGSHIP ARCHITECTURAL SYSTEMS
              </div>
              <div className="flex flex-col gap-1">
                {projects.slice(0, 3).map(p => (
                  <button
                    key={p.id}
                    onClick={() => onSelectProject(p.id)}
                    className="p-2 bg-[#E2DCB9] border border-[#15150F] text-left text-[9.5px] font-mono flex items-center justify-between hover:bg-[#15150F] hover:text-[#D4CDA4] transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5" style={{ backgroundColor: p.accentColor }}></span>
                      <span className="font-bold">{p.code}</span>
                      <span>{p.title}</span>
                    </div>
                    <span className="text-[8px] opacity-60">INSPECT →</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Connect Action */}
            <button
              onClick={onOpenContact}
              className="w-full py-2 bg-[#C3E54E] text-[#15150F] font-bold text-[10px] uppercase tracking-widest border border-[#15150F] hover:bg-[#B2D63B] transition-colors mt-auto shadow-none"
            >
              INITIALIZE CONNECTION // CONTACT
            </button>
          </div>
        )}
      </div>

      {/* Persistent Bottom Action Strip in Inspector */}
      {selectedProject && (
        <div className="p-2.5 bg-[#CBC59B] border-t border-[#15150F] flex items-center justify-between shrink-0">
          <span className="text-[8.5px] text-[#4A4736] font-mono">
            {selectedProject.subsystems.length} SUB-SERVICES ONLINE
          </span>
          <button
            onClick={() => onDrillIntoProject(selectedProject.id)}
            className="px-2.5 py-1 bg-[#15150F] text-[#C3E54E] text-[9.5px] font-bold tracking-wider hover:bg-[#2A2920] transition-colors flex items-center gap-1"
          >
            <span>DECOMPOSE</span>
            <span>→</span>
          </button>
        </div>
      )}
    </aside>
  );
};
