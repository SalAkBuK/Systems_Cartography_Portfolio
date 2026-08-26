import React, { useState, useEffect } from 'react';
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
  ChevronRight,
  Github,
  FileText
} from 'lucide-react';
import { ActiveView, ProjectData, SystemCategory, InfrastructureSkill, ExperienceNode } from '../types';
import { INFRASTRUCTURE_SKILLS, EXPERIENCE_HISTORY, ARCHITECTURE_PRINCIPLES } from '../data/portfolioData';

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
  onOpenGitHubSync?: () => void;
  onOpenCVUpload?: () => void;
  gitHubSource?: string | null;
  cvSource?: string | null;
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
  onOpenGitHubSync,
  onOpenCVUpload,
  gitHubSource,
  cvSource
}) => {
  const [systemLogs, setSystemLogs] = useState<string[]>([
    'Mapping topography...',
    'Interface ready.'
  ]);

  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      const timeStr = d.toTimeString().split(' ')[0];
      const logEvents = [
        'Cartography mesh aligned.',
        'Trace conduits stabilized.',
        'Telemetry stream synced.',
        'Inspector cache updated.',
        'Node latency: 12ms.'
      ];
      const randomEv = logEvents[Math.floor(Math.random() * logEvents.length)];
      setSystemLogs(prev => [
        `${timeStr} ${randomEv}`,
        ...prev.slice(0, 3)
      ]);
    }, 12000);
    return () => clearInterval(timer);
  }, []);

  const navItems: { id: ActiveView; num: string; label: string; count?: number; icon: React.ComponentType<{ size: number }> }[] = [
    { id: 'system_overview', num: '00', label: 'SYSTEM OVERVIEW', icon: Compass },
    { id: 'identity', num: '01', label: 'OPERATOR IDENTITY', icon: User },
    { id: 'projects', num: '02', label: 'PROJECT TOPOLOGY', count: (projects || []).length, icon: Cpu },
    { id: 'experience', num: '03', label: 'EXPERIENCE LOG', count: (experience || []).length, icon: History },
    { id: 'infrastructure', num: '04', label: 'INFRASTRUCTURE', count: (skills || []).length, icon: Layers },
    { id: 'process', num: '05', label: 'SYSTEM PROCESS', count: ARCHITECTURE_PRINCIPLES.length, icon: GitCommit },
    { id: 'contact', num: '06', label: 'EXTERNAL INTERFACE', icon: Share2 },
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
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
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
          Technical Index
        </h2>
        <span className="text-[8.5px] px-1 bg-[#15150F] text-[#D4CDA4] font-mono">
          INDX // 00-06
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

      {/* Ingestion Actions in Index */}
      <div className="p-2 border-b border-[#15150F] bg-[#15150F] text-[#D4CDA4] flex flex-col gap-1">
        {onOpenCVUpload && (
          <button
            onClick={onOpenCVUpload}
            className="w-full py-1.5 px-2 bg-[#22211A] hover:bg-[#8EA9DA] hover:text-[#15150F] border border-[#3E3C2F] text-[9px] font-bold tracking-wider flex items-center justify-between transition-colors"
          >
            <div className="flex items-center gap-1.5">
              <FileText size={11} className="text-[#8EA9DA]" />
              <span>{cvSource ? `CV: ${cvSource.slice(0, 16).toUpperCase()}` : 'INGEST CV / RESUME'}</span>
            </div>
            <span className="text-[7.5px] opacity-70">PARSE →</span>
          </button>
        )}

        {onOpenGitHubSync && (
          <button
            onClick={onOpenGitHubSync}
            className="w-full py-1.5 px-2 bg-[#22211A] hover:bg-[#C3E54E] hover:text-[#15150F] border border-[#3E3C2F] text-[9px] font-bold tracking-wider flex items-center justify-between transition-colors"
          >
            <div className="flex items-center gap-1.5">
              <Github size={11} className="text-[#C3E54E]" />
              <span>{gitHubSource ? `GH: ${gitHubSource.toUpperCase()}` : 'INGEST GITHUB REPOS'}</span>
            </div>
            <span className="text-[7.5px] opacity-70">SYNC →</span>
          </button>
        )}
      </div>

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
          <span>MAPPED STRUCTURES ({filteredProjects.length})</span>
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

      {/* Bottom Live System Log */}
      <div className="p-2.5 border-t border-[#15150F] text-[8.5px] uppercase leading-relaxed font-mono bg-[#CBC59B]/40 shrink-0">
        <p className="font-bold opacity-60 mb-0.5">System Log:</p>
        <div className="flex flex-col gap-0.5 opacity-85">
          {systemLogs.map((log, idx) => (
            <p key={idx} className="truncate">• {log}</p>
          ))}
        </div>
      </div>
    </aside>
  );
};
