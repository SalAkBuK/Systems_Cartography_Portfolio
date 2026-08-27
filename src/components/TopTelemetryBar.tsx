import React from 'react';
import { Activity, FileText, Mail, RotateCcw } from 'lucide-react';
import { ActiveView } from '../types';

interface TopTelemetryBarProps {
  setActiveView: (view: ActiveView) => void;
  onResetView: () => void;
  onToggleTraceMode: () => void;
  traceModeActive: boolean;
  onOpenContact: () => void;
  onOpenResume: () => void;
  activeProjectsCount?: number;
  gitHubSource?: string | null;
  gitHubUrl: string;
  siteId: string;
  templateRepositoryUrl: string;
  syncState: 'loading' | 'ready' | 'error';
}

export const TopTelemetryBar: React.FC<TopTelemetryBarProps> = ({
  setActiveView,
  onResetView,
  onToggleTraceMode,
  traceModeActive,
  onOpenContact,
  onOpenResume,
  activeProjectsCount = 0,
  gitHubSource,
  siteId,
  syncState
}) => (
  <header className="h-12 bg-[#D4CDA4] border-b border-[#15150F] flex items-center px-3 sm:px-4 justify-between text-[10px] uppercase tracking-widest font-bold select-none z-30 shrink-0">
    <div className="flex items-center gap-4 sm:gap-6 overflow-hidden">
      <button
        onClick={() => {
          setActiveView('system_overview');
          onResetView();
        }}
        className="flex items-center gap-2 hover:opacity-80 transition-opacity shrink-0"
        title="System root"
      >
        <span className="w-2.5 h-2.5 bg-[#15150F] flex items-center justify-center"><span className="w-1 h-1 bg-[#C3E54E]" /></span>
        <span className="hidden sm:flex flex-col text-left">
          <span className="text-[8px] opacity-50 tracking-tighter">SYSTEM ID</span>
          <span className="font-bold text-[10px]">{siteId}</span>
        </span>
      </button>

      <div className="flex flex-col">
        <span className="text-[8px] opacity-50 tracking-tighter">OWNER PROJECTS</span>
        <span>{activeProjectsCount.toString().padStart(2, '0')} PUBLIC REPOS</span>
      </div>

      <div className="hidden md:flex flex-col">
        <span className="text-[8px] opacity-50 tracking-tighter">OWNER SOURCE</span>
        <span className="flex items-center gap-1">
          <span className={`w-1.5 h-1.5 ${syncState === 'ready' ? 'bg-[#C3E54E]' : syncState === 'error' ? 'bg-[#CA885C]' : 'bg-[#8EA9DA] animate-pulse'}`} />
          {syncState === 'ready' ? `GITHUB // ${gitHubSource || 'READY'}` : syncState === 'error' ? 'CACHED // GITHUB UNAVAILABLE' : 'GITHUB // LOADING'}
        </span>
      </div>
    </div>

    <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
      <button onClick={onToggleTraceMode} className={`flex items-center gap-1 px-2 py-1 border border-[#15150F] ${traceModeActive ? 'bg-[#15150F] text-[#C3E54E]' : 'hover:bg-[#15150F] hover:text-[#D4CDA4]'}`} title="Toggle relationship traces">
        <Activity size={11} /><span className="hidden lg:inline">TRACE</span>
      </button>
      <button onClick={onResetView} className="p-1 border border-[#15150F] hover:bg-[#15150F] hover:text-[#D4CDA4]" title="Reset viewport"><RotateCcw size={11} /></button>
      <button onClick={onOpenResume} className="hidden sm:flex items-center gap-1 px-2 py-1 border border-[#15150F] bg-[#8EA9DA]/30 hover:bg-[#8EA9DA]/60" title="Open portfolio brief">
        <FileText size={11} /><span className="hidden lg:inline">BRIEF</span>
      </button>
      <button onClick={onOpenContact} className="flex items-center gap-1 px-2.5 py-1 border border-[#15150F] bg-[#C3E54E] hover:bg-[#15150F] hover:text-[#C3E54E]" title="Open contact page">
        <Mail size={11} /><span>CONTACT</span>
      </button>
    </div>
  </header>
);
