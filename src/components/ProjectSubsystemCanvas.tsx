import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Layers, 
  Activity, 
  Cpu, 
  Database, 
  Server, 
  Terminal, 
  FileCode,
  Shield,
  Zap,
  Radio,
  FileText
} from 'lucide-react';
import { ProjectData, SubsystemNode } from '../types';
import { project3DToIso } from './TopologyCanvas';

interface ProjectSubsystemCanvasProps {
  project: ProjectData;
  onReturnToLandscape: () => void;
  selectedSubsystemId: string | null;
  onSelectSubsystem: (subsystem: SubsystemNode) => void;
  onOpenCaseStudy: () => void;
}

export const ProjectSubsystemCanvas: React.FC<ProjectSubsystemCanvasProps> = ({
  project,
  onReturnToLandscape,
  selectedSubsystemId,
  onSelectSubsystem,
  onOpenCaseStudy
}) => {
  const [hoveredSubsystemId, setHoveredSubsystemId] = useState<string | null>(null);

  const getSubsystemIcon = (cat: SubsystemNode['category']) => {
    switch (cat) {
      case 'frontend': return Terminal;
      case 'backend': return Server;
      case 'database': return Database;
      case 'queue': return Zap;
      case 'auth': return Shield;
      case 'telemetry': return Radio;
      default: return Cpu;
    }
  };

  return (
    <div className="relative flex-1 w-full h-full bg-[#D4CDA4] drafting-subgrid flex flex-col select-none overflow-hidden">
      {/* Top Header & Breadcrumb Toolbar */}
      <div className="p-2.5 bg-[#CBC59B] border-b border-precision flex flex-wrap items-center justify-between gap-2 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={onReturnToLandscape}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-[#15150F] text-[#D4CDA4] text-[10px] font-bold tracking-wider hover:bg-[#2B2A20] transition-colors border border-precision"
            title="Return to Global Systems Landscape (Esc)"
          >
            <ArrowLeft size={12} className="text-[#C3E54E]" />
            <span>← RETURN TO LANDSCAPE</span>
          </button>

          <div className="flex items-center gap-1.5 text-[10px] font-mono">
            <span className="text-[#5C5946]">TOPOLOGY &gt;</span>
            <span className="font-bold text-[#15150F]">{project.code} // {project.title}</span>
            <span className="text-[8.5px] px-1.5 py-0.5 bg-[#15150F] text-[#D4CDA4]">
              DECOMPOSED SCHEMATIC
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenCaseStudy}
            className="flex items-center gap-1 px-2.5 py-1 text-[9.5px] font-bold uppercase bg-[#E2DCB9] border border-precision hover:bg-[#15150F] hover:text-[#D4CDA4] transition-colors"
          >
            <FileText size={11} />
            <span>FULL CASE STUDY SPEC</span>
          </button>
        </div>
      </div>

      {/* Main Schematic Blueprint Surface */}
      <div className="flex-1 relative overflow-y-auto overflow-x-hidden p-4 md:p-6 flex flex-col items-center justify-start lg:justify-center">
        {/* Decomposed Subsystem Blueprint Container */}
        <div className="relative w-full max-w-5xl bg-[#CBC59B]/50 border-2 border-[#15150F] p-4 md:p-6 shadow-[4px_4px_0px_#15150F]">
          {/* Schematic Corner Framing & Metadata */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#15150F] pb-2.5 mb-5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-[#C3E54E] border border-[#15150F] inline-block"></span>
              <span className="text-[10px] font-bold text-[#15150F] tracking-widest uppercase">
                SUBSYSTEM TOPOLOGY // {project.code} · {project.subsystems.length} DOCUMENTED BOUNDARIES
              </span>
            </div>
            <div className="text-[9px] font-mono text-[#5C5946] flex items-center gap-3">
              <span>EVIDENCE VIEW</span>
              <span className="text-[#15150F] font-bold bg-[#D4CDA4] px-1.5 py-0.5 border border-[#15150F]">
                SOURCE: CV / REPO
              </span>
            </div>
          </div>

          {/* Interactive Subsystem Node Grid with Animated Data Buses */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
            {project.subsystems.map((sub, idx) => {
              const isSelected = selectedSubsystemId === sub.id;
              const isHovered = hoveredSubsystemId === sub.id;
              const Icon = getSubsystemIcon(sub.category);

              return (
                <div
                  key={sub.id}
                  onClick={() => onSelectSubsystem(sub)}
                  onMouseEnter={() => setHoveredSubsystemId(sub.id)}
                  onMouseLeave={() => setHoveredSubsystemId(null)}
                  className={`
                    relative p-4 border-2 cursor-pointer transition-all duration-150 flex flex-col justify-between font-mono select-none min-h-[220px]
                    ${isSelected 
                      ? 'border-[#15150F] bg-[#15150F] text-[#D4CDA4] shadow-[4px_4px_0px_#C3E54E]' 
                      : isHovered
                      ? 'border-[#15150F] bg-[#22211A] text-[#D4CDA4] shadow-[3px_3px_0px_#15150F]'
                      : 'border-[#15150F] bg-[#15150F] text-[#D4CDA4] hover:bg-[#1E1D16]'
                    }
                  `}
                >
                  {/* Category Accent Bar at Top */}
                  <div 
                    className="absolute top-0 left-0 right-0 h-1" 
                    style={{ backgroundColor: isSelected ? '#C3E54E' : project.accentColor }} 
                  />

                  {/* Header */}
                  <div>
                    <div className="flex items-center justify-between border-b border-[#3E3C2F] pb-2 mb-2">
                      <div className="flex items-center gap-2">
                        <Icon size={14} className={isSelected ? 'text-[#C3E54E]' : 'text-[#C3E54E]'} />
                        <span className="text-[11px] font-bold tracking-tight text-white">{sub.name}</span>
                      </div>
                      <span className="text-[8px] font-bold px-1 py-0.5 border border-[#C3E54E]/40 text-[#C3E54E] bg-[#15150F]">
                        MOD 0{idx + 1}
                      </span>
                    </div>

                    {/* Role & Protocol */}
                    <div className="flex items-center justify-between text-[9px] font-bold text-[#C3E54E] mb-2">
                      <span>{sub.role}</span>
                      {sub.protocol && (
                        <span className="text-[7.5px] text-[#9E997F] px-1 bg-[#26251E]">
                          {sub.protocol}
                        </span>
                      )}
                    </div>

                    {/* Description */}
                    <p className="text-[9px] leading-relaxed text-[#C8C2A0] mb-3">
                      {sub.description}
                    </p>
                  </div>

                  {/* Bottom Footer: Tech & Metrics */}
                  <div className="mt-auto pt-2 border-t border-[#3E3C2F] flex flex-col gap-2">
                    {/* Tech Badges */}
                    <div className="flex flex-wrap gap-1">
                      {sub.tech.map(t => (
                        <span
                          key={t}
                          className="text-[7.5px] px-1.5 py-0.5 border border-[#484535] bg-[#22211A] text-[#D4CDA4]"
                        >
                          {t}
                        </span>
                      ))}
                    </div>

                    {/* Live Metric Readout */}
                    {sub.metrics && sub.metrics.length > 0 && (
                      <div className="flex justify-between items-center text-[8px] font-bold text-[#C3E54E] bg-[#0E0E0B] px-2 py-1 border border-[#2B2A20]">
                        <span className="text-[#9E997F]">{sub.metrics[0].label}:</span>
                        <span>{sub.metrics[0].value}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {project.subsystems.length === 0 && (
              <div className="sm:col-span-2 lg:col-span-4 p-6 border-2 border-dashed border-[#15150F] bg-[#E2DCB9] text-[11px] text-[#5C5946] leading-relaxed">
                No subsystem diagram is shown because the current CV and linked public repositories do not document one for this project. Add an owner-confirmed architecture note or link a supporting repository to populate this view.
              </div>
            )}
          </div>

          {/* Inter-subsystem Bus Conduit Animation Bar */}
          <div className="mt-4 pt-3 border-t border-[#15150F] flex items-center justify-between text-[8px] font-mono text-[#5C5946]">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-[#C3E54E] rounded-full animate-pulse"></span>
              <span className="font-bold text-[#15150F]">INTERNAL RPC PIPELINE:</span>
              <span>SYNCHRONIZED BUS STREAM ACTIVE</span>
            </div>
            <div className="hidden sm:flex items-center gap-1 font-bold text-[#15150F]">
              <span>[CLICK NODE FOR DRILL-DOWN SPEC]</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Technical Bar */}
      <div className="p-2 border-t border-precision bg-[#CBC59B] text-[9px] font-mono text-[#4A4736] flex justify-between items-center z-10">
        <div>
          <span className="font-bold text-[#15150F]">ARCHITECTURAL FOCUS: </span>
          <span>{project.architectureNotes}</span>
        </div>
        <div className="flex items-center gap-2">
          <span>PRESS ESC TO RETURN</span>
        </div>
      </div>
    </div>
  );
};
