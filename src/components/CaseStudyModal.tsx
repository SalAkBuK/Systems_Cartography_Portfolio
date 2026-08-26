import React from 'react';
import { 
  X, 
  ExternalLink, 
  Github, 
  Layers, 
  ShieldAlert, 
  Activity, 
  CheckCircle2, 
  FileCode,
  ArrowRight,
  Server,
  Zap,
  Terminal,
  Database
} from 'lucide-react';
import { ProjectData, OperatorMetadata } from '../types';
import { OPERATOR_METADATA } from '../data/portfolioData';

interface CaseStudyModalProps {
  project: ProjectData | null;
  isOpen: boolean;
  onClose: () => void;
  operator?: OperatorMetadata;
}

export const CaseStudyModal: React.FC<CaseStudyModalProps> = ({
  project,
  isOpen,
  onClose,
  operator = OPERATOR_METADATA
}) => {
  if (!isOpen || !project) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#15150F]/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto select-none">
      <div 
        className="relative w-full max-w-4xl bg-[#D4CDA4] border-2 border-precision text-[#15150F] flex flex-col max-h-[90vh] shadow-[8px_8px_0px_#15150F] font-mono text-[11px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-3 bg-[#CBC59B] border-b border-precision flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5" style={{ backgroundColor: project.accentColor }}></span>
            <span className="font-bold text-[12px] tracking-wider uppercase">
              ARCHITECTURE SPEC // {project.code} : {project.title}
            </span>
            <span className="text-[8.5px] px-1.5 py-0.5 bg-[#15150F] text-[#C3E54E] font-bold">
              {project.status}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 bg-[#15150F] text-[#D4CDA4] hover:bg-[#C3E54E] hover:text-[#15150F] flex items-center justify-center transition-colors border border-precision"
            title="Close Spec (Esc)"
          >
            <X size={14} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-6 leading-relaxed">
          {/* Executive Overview Box */}
          <div className="p-4 border border-precision bg-[#E2DCB9]/80 flex flex-col gap-2">
            <div className="text-[13px] font-bold text-[#15150F]">
              {project.title} — {project.tagline}
            </div>
            <p className="text-[11px] text-[#22211A]">
              {project.summary}
            </p>
            <div className="flex flex-wrap items-center gap-3 text-[9px] text-[#5C5946] border-t border-precision pt-2 mt-1">
              <span>ACTIVE YEAR: {project.year}</span>
              <span>·</span>
              <span>CLASSIFICATION: {project.category.toUpperCase()}</span>
              <span>·</span>
              <span>SUBSYSTEMS: {project.subsystems.length} MODULES</span>
            </div>
          </div>

          {/* Problem Statement vs Architectural Solution */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3.5 border border-precision bg-[#DCD6B2]/40 flex flex-col gap-1.5">
              <span className="text-[9px] font-bold text-[#7A3E2E] tracking-wider uppercase flex items-center gap-1.5">
                <ShieldAlert size={12} />
                <span>01 // THE SYSTEM PROBLEM</span>
              </span>
              <p className="text-[10.5px] text-[#15150F]">
                {project.problem}
              </p>
            </div>

            <div className="p-3.5 border border-precision bg-[#DCD6B2]/40 flex flex-col gap-1.5">
              <span className="text-[9px] font-bold text-[#2E6B3A] tracking-wider uppercase flex items-center gap-1.5">
                <CheckCircle2 size={12} />
                <span>02 // ARCHITECTURAL SOLUTION</span>
              </span>
              <p className="text-[10.5px] text-[#15150F]">
                {project.solution}
              </p>
            </div>
          </div>

          {/* Subsystems Decomposition Matrix */}
          <div>
            <div className="text-[10px] font-bold text-[#5C5946] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Layers size={13} />
              <span>03 // SUB-SERVICE ARCHITECTURE &amp; DATA PIPELINES</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {project.subsystems.map((sub, idx) => (
                <div key={sub.id} className="p-3 bg-[#E2DCB9] border border-precision flex flex-col gap-1.5">
                  <div className="flex items-center justify-between border-b border-precision pb-1">
                    <span className="font-bold text-[10.5px] text-[#15150F]">
                      MOD {idx + 1} // {sub.name}
                    </span>
                    <span className="text-[8px] bg-[#15150F] text-[#D4CDA4] px-1">
                      {sub.category}
                    </span>
                  </div>
                  <div className="text-[9.5px] font-medium text-[#4A4736]">
                    ROLE: {sub.role}
                  </div>
                  <p className="text-[9px] text-[#5C5946] leading-snug">
                    {sub.description}
                  </p>
                  {sub.protocol && (
                    <div className="text-[8px] font-bold text-[#15150F]">
                      PROTOCOL: {sub.protocol}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1 pt-1 mt-auto">
                    {sub.tech.map(t => (
                      <span key={t} className="text-[8px] px-1 bg-[#D4CDA4] border border-precision/40">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Key Architectural Trade-Offs & Decisions */}
          <div>
            <div className="text-[10px] font-bold text-[#5C5946] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <FileCode size={13} />
              <span>04 // ARCHITECTURAL DECISIONS &amp; TRADEOFF MATRIX</span>
            </div>
            <div className="flex flex-col gap-2">
              {project.keyDecisions.map((dec, i) => (
                <div key={i} className="p-3 border border-precision bg-[#DCD6B2]/70 flex flex-col gap-1">
                  <div className="font-bold text-[10.5px] text-[#15150F]">
                    DECISION {i + 1}: {dec.decision}
                  </div>
                  <div className="text-[9.5px] text-[#3D3A2C]">
                    <span className="font-bold text-[#5C5946]">RATIONALE: </span>
                    {dec.rationale}
                  </div>
                  <div className="text-[9px] text-[#7A3E2E] bg-[#EFEAD0] p-1.5 border border-precision/30 mt-0.5">
                    <span className="font-bold">CONSCIOUS TRADEOFF: </span>
                    {dec.tradeoff}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Telemetry Benchmarks & Resilience Testing */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] font-bold text-[#5C5946] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Activity size={13} />
                <span>05 // VERIFIED PRODUCTION BENCHMARKS</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {project.metrics.map((m, i) => (
                  <div key={i} className="p-2.5 border border-precision bg-[#E2DCB9] flex flex-col">
                    <span className="text-[8px] uppercase font-bold text-[#5C5946]">{m.label}</span>
                    <span className="text-[16px] font-bold text-[#15150F]">{m.value}</span>
                    {m.note && <span className="text-[8px] text-[#6B664F]">{m.note}</span>}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-bold text-[#5C5946] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <ShieldAlert size={13} />
                <span>06 // CHAOS &amp; RESILIENCE VERIFICATION</span>
              </div>
              <div className="p-3 border border-precision bg-[#DCD6B2]/50 text-[10px] leading-relaxed text-[#22211A] h-[calc(100%-24px)]">
                {project.resilienceTesting}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-3 bg-[#CBC59B] border-t border-precision flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="text-[9px] text-[#5C5946]">
            SPEC DOCUMENT // {operator.name.toUpperCase()} ARCHITECTURAL ARCHIVE
          </div>
          <div className="flex items-center gap-2">
            {project.links.github && (
              <a
                href={project.links.github}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 px-3 py-1.5 bg-[#15150F] text-[#D4CDA4] hover:bg-[#2A2920] transition-colors border border-precision text-[10px] font-bold"
              >
                <Github size={12} />
                <span>VIEW REPOSITORY</span>
              </a>
            )}
            {project.links.demo && (
              <a
                href={project.links.demo}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 px-3 py-1.5 bg-[#C3E54E] text-[#15150F] hover:bg-[#B2D63B] transition-colors border border-precision text-[10px] font-bold"
              >
                <ExternalLink size={12} />
                <span>LIVE SYSTEM</span>
              </a>
            )}
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-[#D4CDA4] text-[#15150F] hover:bg-[#15150F] hover:text-[#D4CDA4] transition-colors border border-precision text-[10px] font-bold"
            >
              CLOSE SPEC [ESC]
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
