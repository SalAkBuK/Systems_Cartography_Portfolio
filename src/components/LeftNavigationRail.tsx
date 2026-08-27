import React from 'react';
import { 
  Compass, 
  User, 
  Cpu, 
  History, 
  Layers, 
  GitCommit, 
  Share2, 
  Filter,
  Search,
  Github
} from 'lucide-react';
import { ActiveView, ProjectData, SystemCategory, InfrastructureSkill, ExperienceNode } from '../types';
import {
  VERIFIED_ARCHITECTURE_PRINCIPLES as ARCHITECTURE_PRINCIPLES,
  VERIFIED_EXPERIENCE as EXPERIENCE_HISTORY,
  VERIFIED_SKILLS as INFRASTRUCTURE_SKILLS
} from '../data/verifiedPortfolioData';
import { matchesProjectClassification } from '../utils/portfolioUtils';

interface LeftNavigationRailProps {
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  selectedCategory: SystemCategory | 'all';
  setSelectedCategory: (cat: SystemCategory | 'all') => void;
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
  selectedCategory,
  setSelectedCategory,
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
    { id: 'projects', num: '02', label: 'PROJECT TOPOLOGY', count: (projects || []).length, icon: Cpu },
    { id: 'experience', num: '03', label: 'PROFESSIONAL EXPERIENCE', count: (experience || []).length, icon: History },
    { id: 'infrastructure', num: '04', label: 'INFRASTRUCTURE', count: (skills || []).length, icon: Layers },
    { id: 'contact', num: '05', label: 'EXTERNAL INTERFACE', icon: Share2 },
  ];

  const categories: { id: SystemCategory | 'all'; label: string; color?: string }[] = [
    { id: 'all', label: 'ALL' },
    { id: 'infrastructure', label: 'INFRA' },
    { id: 'fullstack', label: 'FULL' },
    { id: 'backend', label: 'BACK' },
    { id: 'frontend', label: 'FRONT' },
    { id: 'tooling', label: 'TOOL' },
  ];

  const filteredProjects = projects.filter(p => {
    const matchesCategory = matchesProjectClassification(p, selectedCategory);
    const matchesSearch = searchQuery === '' || 
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.techStack.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <aside 
      className={`
        fixed inset-y-0 left-0 z-40 w-72 md:w-64 lg:w-72 bg-[#D4CDA4] border-r border-[#15150F] flex flex-col transition-transform duration-200 ease-out
        md:static md:translate-x-0 shrink-0 select-none
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}
    >
      {/* Technical Index Header */}
      <div className="p-3 border-b border-[#15150F] bg-[#CBC59B]/50 flex items-center justify-between">
        <h2 className="text-[11px] font-bold uppercase tracking-tighter opacity-70">
          Owner Technical Index
        </h2>
        <span className="text-[8.5px] px-1 bg-[#15150F] text-[#D4CDA4] font-mono">
          INDX // 00-05
        </span>
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
                flex items-center justify-between px-3 py-2 text-left text-[10.5px] font-mono tracking-wider transition-colors border-b border-[#15150F]/20 last:border-b-0
                ${isActive 
                  ? 'bg-[#15150F] text-[#D4CDA4] font-bold' 
                  : 'hover:bg-[#15150F] hover:text-[#D4CDA4] text-[#15150F]'
                }
              `}
            >
              <div className="flex items-center gap-2">
                <span className={`text-[8.5px] font-bold ${isActive ? 'text-[#C3E54E]' : 'opacity-60'}`}>
                  {item.num}
                </span>
                <Icon size={12} className={isActive ? 'text-[#C3E54E]' : 'opacity-70'} />
                <span className="tracking-tight">{item.label}</span>
              </div>
              {item.count !== undefined && item.count !== null && (
                <span className={`text-[8.5px] px-1 border ${
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

      <a href={templateRepositoryUrl} target="_blank" rel="noreferrer" className="p-2 border-b border-[#15150F] bg-[#15150F] text-[#C3E54E] hover:bg-[#22211A] flex items-center justify-between text-[9px] font-bold tracking-wider" title="Fork this portfolio repository">
        <span className="flex items-center gap-1.5"><Github size={11} /> USE TEMPLATE</span>
        <span>FORK →</span>
      </a>

      {/* Search & Filter Toolbar */}
      <div className="p-2.5 border-b border-[#15150F] bg-[#CBC59B]/30 flex flex-col gap-2">
        <div className="flex items-center justify-between text-[8.5px] font-bold tracking-widest opacity-60">
          <span>CLASSIFICATION // FILTER</span>
          <Filter size={10} />
        </div>

        {/* Search input */}
        <div className="relative flex items-center">
          <Search size={11} className="absolute left-2 opacity-50" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="SEARCH NODE / STACK..."
            className="w-full bg-[#E2DCB9] border border-[#15150F] pl-6 pr-2 py-1 text-[9.5px] placeholder:opacity-40 text-[#15150F] focus:outline-none focus:bg-[#EFEAD0]"
          />
        </div>

        {/* Category Pills */}
        <div className="grid grid-cols-6 gap-1">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`
                py-1 text-[8px] font-bold tracking-tighter uppercase text-center border transition-colors
                ${selectedCategory === cat.id
                  ? 'bg-[#15150F] text-[#D4CDA4] border-[#15150F]'
                  : 'bg-[#D4CDA4] text-[#15150F] border-[#15150F]/40 hover:border-[#15150F]'
                }
              `}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Fast Project Jump List */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#15150F]/30 flex flex-col min-h-32">
        <div className="px-3 py-1 bg-[#CBC59B]/80 text-[8px] font-bold tracking-widest opacity-60 uppercase flex justify-between items-center sticky top-0 z-10 border-b border-[#15150F]/20">
          <span>OWNER PROJECTS ({filteredProjects.length})</span>
          <span>TIER</span>
        </div>

        {filteredProjects.map((p) => {
          const isSelected = selectedProjectId === p.id;
          return (
            <button
              key={p.id}
              onClick={() => {
                onSelectProject(p.id);
                setActiveView('projects');
                setIsMobileOpen(false);
              }}
              className={`
                px-3 py-1.5 text-left text-[9.5px] font-mono transition-colors flex items-center justify-between
                ${isSelected 
                  ? 'bg-[#15150F] text-[#D4CDA4]' 
                  : 'hover:bg-[#15150F] hover:text-[#D4CDA4] text-[#15150F]'
                }
              `}
            >
              <div className="flex items-center gap-1.5 overflow-hidden">
                <span 
                  className="w-1.5 h-1.5 shrink-0" 
                  style={{ backgroundColor: p.accentColor }} 
                />
                <span className="font-bold shrink-0">{p.code}</span>
                <span className="truncate">{p.title}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-1">
                <span className={`text-[7.5px] px-1 py-0.2 border ${
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
      <div className="p-2.5 border-t border-[#15150F] text-[8.5px] uppercase leading-relaxed font-mono bg-[#CBC59B]/40 shrink-0">
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
