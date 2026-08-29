import React from 'react';
import { 
  Compass, 
  User, 
  Cpu, 
  History, 
  Layers, 
  Share2, 
  Search,
  Github,
  X
} from 'lucide-react';
import { ActiveView, ProjectData, InfrastructureSkill, ExperienceNode, TopologyViewMode } from '../types';
import {
  VERIFIED_EXPERIENCE as EXPERIENCE_HISTORY,
  VERIFIED_SKILLS as INFRASTRUCTURE_SKILLS
} from '../data/verifiedPortfolioData';

interface LeftNavigationRailProps {
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  topologyViewMode: TopologyViewMode;
  setTopologyViewMode: (mode: TopologyViewMode) => void;
  selectedProjectId: string | null;
  onSelectProject: (id: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
  projects?: ProjectData[];
  skills?: InfrastructureSkill[];
  experience?: ExperienceNode[];
  templateRepositoryUrl: string;
}

export const LeftNavigationRail: React.FC<LeftNavigationRailProps> = ({
  activeView,
  setActiveView,
  topologyViewMode,
  setTopologyViewMode,
  selectedProjectId,
  onSelectProject,
  searchQuery,
  setSearchQuery,
  isMobileOpen,
  setIsMobileOpen,
  projects = [],
  skills = INFRASTRUCTURE_SKILLS,
  experience = EXPERIENCE_HISTORY,
  templateRepositoryUrl
}) => {
  const systemLogs = [
    'Public instance: owner read only.',
    'Owner identity: source controlled.',
    'Project source: configured GitHub.',
    'Claims require repository evidence.'
  ];

  const navItems: { id: ActiveView; num: string; label: string; count?: number; icon: React.ComponentType<{ size: number }> }[] = [
    { id: 'system_overview', num: '00', label: 'SYSTEM OVERVIEW', icon: Compass },
    { id: 'identity', num: '01', label: 'OPERATOR PROFILE', icon: User },
    { id: 'experience', num: '02', label: 'PROFESSIONAL EXPERIENCE', count: (experience || []).length, icon: History },
    { id: 'projects', num: '03', label: 'PROJECT TOPOLOGY', count: (projects || []).length, icon: Cpu },
    { id: 'infrastructure', num: '04', label: 'TECHNICAL CAPABILITIES', count: (skills || []).length, icon: Layers },
    { id: 'contact', num: '05', label: 'EXTERNAL INTERFACE', icon: Share2 },
  ];

  const topologyModes: { id: TopologyViewMode; label: string; sub: string }[] = [
    { id: 'systems', label: 'SYSTEMS', sub: 'PROJECT-CENTRIC' },
    { id: 'capabilities', label: 'CAPABILITIES', sub: 'STACK-CENTRIC' },
    { id: 'relationships', label: 'RELATIONSHIPS', sub: 'FULL WIRING' }
  ];

  const filteredProjects = projects.filter(p => {
    return searchQuery === '' || 
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.techStack.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
  });

  return (
    <aside 
      id="system-index-navigation"
      className={`
        fixed inset-y-0 left-0 z-50 w-72 sm:w-80 lg:w-72 bg-[#D4CDA4] border-r border-[#15150F] flex flex-col transition-transform duration-200 ease-out
        lg:static lg:z-auto lg:translate-x-0 shrink-0 select-none
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}
    >
      {/* Technical Index Header */}
      <div className="p-3 border-b border-[#15150F] bg-[#CBC59B]/50 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-[12px] lg:text-[11px] font-bold uppercase tracking-tight text-[#15150F] whitespace-nowrap">
            Owner Technical Index
          </h2>
          <span className="hidden lg:inline text-[8.5px] px-1 bg-[#15150F] text-[#D4CDA4] font-mono whitespace-nowrap">
            INDX // 00-05
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsMobileOpen(false)}
          className="lg:hidden flex items-center gap-1 px-2.5 py-1.5 min-h-[36px] bg-[#15150F] text-[#D4CDA4] hover:text-[#C3E54E] text-[11px] font-bold font-mono border border-[#15150F] cursor-pointer whitespace-nowrap shrink-0"
          aria-label="Close system index"
        >
          <X size={13} />
          <span>CLOSE</span>
        </button>
      </div>

      {/* Main Navigation Matrix */}
      <nav className="flex flex-col border-b border-[#15150F]">
        {navItems.map((item) => {
          const isActive = activeView === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveView(item.id);
                setIsMobileOpen(false);
              }}
              className={`
                min-h-[44px] lg:min-h-[34px] flex items-center justify-between px-3.5 py-2.5 lg:py-2 text-left text-[13px] lg:text-[10.5px] font-mono tracking-wider transition-colors border-b border-[#15150F]/20 last:border-b-0
                ${isActive 
                  ? 'bg-[#15150F] text-[#D4CDA4] font-bold' 
                  : 'hover:bg-[#15150F] hover:text-[#D4CDA4] text-[#15150F]'
                }
              `}
            >
              <div className="flex items-center gap-2.5">
                <span className={`text-[11px] lg:text-[8.5px] font-bold ${isActive ? 'text-[#C3E54E]' : 'opacity-60'}`}>
                  {item.num}
                </span>
                <Icon size={14} className={isActive ? 'text-[#C3E54E]' : 'opacity-70'} />
                <span className="tracking-tight">{item.label}</span>
              </div>
              {item.count !== undefined && item.count !== null && (
                <span className={`text-[10.5px] lg:text-[8.5px] px-1.5 py-0.5 lg:py-0 border ${
                  isActive 
                    ? 'border-[#3E3C2F] bg-[#22211A] text-[#C3E54E]' 
                    : 'border-[#15150F]/30 text-current opacity-80'
                }`}>
                  {(item.count ?? 0).toString().padStart(2, '0')}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <a href={templateRepositoryUrl} target="_blank" rel="noreferrer" className="min-h-[38px] lg:min-h-[30px] p-2.5 lg:p-2 border-b border-[#15150F] bg-[#15150F] text-[#C3E54E] hover:bg-[#22211A] flex items-center justify-between text-[11px] lg:text-[9px] font-bold tracking-wider" title="Fork this portfolio repository">
        <span className="flex items-center gap-1.5"><Github size={13} /> USE TEMPLATE</span>
        <span>FORK →</span>
      </a>

      {/* Topology View Mode & Search Toolbar */}
      <div className="p-2.5 border-b border-[#15150F] bg-[#CBC59B]/30 flex flex-col gap-2">
        <div className="flex items-center justify-between text-[10px] lg:text-[8.5px] font-bold tracking-widest opacity-60">
          <span>TOPOLOGY // VIEW</span>
          <Layers size={12} />
        </div>

        {/* 3-Way Mode Switch (Brutalist Precision) */}
        <div className="grid grid-cols-3 gap-1">
          {topologyModes.map((mode) => {
            const isSelected = topologyViewMode === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => setTopologyViewMode(mode.id)}
                className={`
                  min-h-[42px] lg:min-h-[30px] py-1.5 lg:py-1 px-1 text-center border transition-colors flex flex-col items-center justify-center
                  ${isSelected
                    ? 'bg-[#15150F] text-[#D4CDA4] border-[#15150F] font-bold'
                    : 'bg-[#D4CDA4] text-[#15150F] border-[#15150F]/40 hover:border-[#15150F]'
                  }
                `}
                title={`${mode.label} // ${mode.sub}`}
              >
                <span className="text-[11px] lg:text-[8px] font-bold uppercase tracking-tight">{mode.label}</span>
                <span className={`text-[9.5px] lg:text-[6.5px] tracking-tighter uppercase font-medium ${isSelected ? 'text-[#C3E54E]' : 'opacity-60'}`}>
                  {mode.sub}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search input (16px compact font prevents iOS Safari auto-zoom) */}
        <div className="relative flex items-center">
          <Search size={13} className="absolute left-2 opacity-50 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="SEARCH NODE / STACK..."
            className="w-full bg-[#E2DCB9] border border-[#15150F] pl-7 pr-2 py-2 lg:py-1 text-[16px] lg:text-[9.5px] placeholder:text-[13px] lg:placeholder:text-[9.5px] placeholder:opacity-40 text-[#15150F] focus:outline-none focus:bg-[#EFEAD0]"
          />
        </div>
      </div>

      {/* Fast Project Jump List */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#15150F]/30 flex flex-col min-h-32">
        <div className="px-3 py-1.5 lg:py-1 bg-[#15150F] text-[#D4CDA4] text-[10px] lg:text-[8px] font-bold tracking-widest uppercase flex justify-between items-center sticky top-0 z-20 border-b border-[#15150F]">
          <span className="text-[#C3E54E]">OWNER PROJECTS ({filteredProjects.length})</span>
          <span className="opacity-80">TIER</span>
        </div>

        {filteredProjects.map((p) => {
          const isSelected = selectedProjectId === p.id;
          return (
            <button
              key={p.id}
              onClick={() => {
                onSelectProject(p.id);
                setIsMobileOpen(false);
              }}
              className={`
                min-h-[40px] lg:min-h-[28px] px-3.5 py-2 lg:py-1.5 text-left text-[12px] lg:text-[9.5px] font-mono transition-colors flex items-center justify-between
                ${isSelected 
                  ? 'bg-[#15150F] text-[#D4CDA4]' 
                  : 'hover:bg-[#15150F] hover:text-[#D4CDA4] text-[#15150F]'
                }
              `}
            >
              <div className="flex items-center gap-1.5 overflow-hidden">
                <span 
                  className="w-2 h-2 lg:w-1.5 lg:h-1.5 shrink-0" 
                  style={{ backgroundColor: p.accentColor }} 
                />
                <span className="font-bold shrink-0">{p.code}</span>
                <span className="truncate">{p.title}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-1">
                <span className={`text-[10px] lg:text-[7.5px] px-1.5 py-0.5 lg:py-0.2 border ${
                  isSelected ? 'border-[#3E3C2F] text-[#C3E54E]' : 'border-[#15150F]/30 opacity-75'
                }`}>
                  L{p.dimensions.levels}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Evidence state */}
      <div className="p-3 lg:p-2.5 border-t border-[#15150F] text-[10.5px] lg:text-[8.5px] uppercase leading-relaxed font-mono bg-[#CBC59B]/40 shrink-0">
        <p className="font-bold opacity-60 mb-0.5">Owner evidence state:</p>
        <div className="flex flex-col gap-0.5 opacity-85">
          {systemLogs.map((log, idx) => (
            <p key={idx} className="truncate">• {log}</p>
          ))}
        </div>
      </div>
    </aside>
  );
};
