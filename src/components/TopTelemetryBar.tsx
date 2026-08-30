import React from 'react';
import { FileText, Mail, RotateCcw } from 'lucide-react';
import { ActiveView } from '../types';

interface TopTelemetryBarProps {
  setActiveView: (view: ActiveView) => void;
  onResetView: () => void;
  onOpenContact: () => void;
  onOpenResume: () => void;
  activeProjectsCount?: number;
  gitHubSource?: string | null;
  gitHubUrl: string;
  siteId: string;
  templateRepositoryUrl: string;
  syncState?: 'ready' | 'mismatch' | 'missing' | 'loading' | 'error';
}

export const TopTelemetryBar: React.FC<TopTelemetryBarProps> = ({
  setActiveView,
  onResetView,
  onOpenContact,
  onOpenResume,
  activeProjectsCount = 0,
  gitHubSource,
  siteId,
  syncState = 'ready'
}) => (
  <header className="h-12 bg-[#D4CDA4] border-b border-[#15150F] flex items-center px-3 sm:px-4 justify-between text-[11px] uppercase tracking-widest font-bold select-none z-30 shrink-0">
    <div className="flex items-center gap-3 sm:gap-6 overflow-hidden">
      <button
        onClick={() => {
          setActiveView('system_overview');
          onResetView();
        }}
        className="flex items-center gap-2 hover:opacity-80 transition-opacity shrink-0 cursor-pointer"
        title="System root"
      >
        <span className="w-2.5 h-2.5 bg-[#15150F] flex items-center justify-center"><span className="w-1 h-1 bg-[#C3E54E]" /></span>
        <span className="hidden sm:flex flex-col text-left">
          <span className="text-[10px] opacity-50 tracking-tighter">SYSTEM ID</span>
          <span className="font-bold text-[11px]">{siteId}</span>
        </span>
      </button>

      <div className="flex flex-col bg-[#15150F] text-[#C3E54E] px-2.5 py-1 sm:py-0.5 border border-[#15150F] shadow-[1px_1px_0px_#15150F]">
        <span className="text-[10px] text-[#D4CDA4] tracking-tighter opacity-70">OWNER PROJECTS</span>
        <span className="text-[#C3E54E] font-bold text-[12px] tracking-wider">{activeProjectsCount.toString().padStart(2, '0')} PUBLIC REPOS</span>
      </div>

      <div className="hidden lg:flex flex-col">
        <span className="text-[10px] opacity-50 tracking-tighter">OWNER SOURCE</span>
        <span className="flex items-center gap-1">
          <span className={`w-1.5 h-1.5 ${syncState === 'ready' ? 'bg-[#C3E54E]' : 'bg-[#CA885C]'}`} />
          {syncState === 'ready' ? `GITHUB SNAPSHOT // ${gitHubSource || 'READY'}` : 'SNAPSHOT // REFRESH REQUIRED'}
        </span>
      </div>
    </div>

    <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
      <button onClick={onResetView} className="min-h-[36px] min-w-[36px] sm:min-h-0 sm:min-w-0 flex items-center justify-center p-1.5 sm:p-1 border border-[#15150F] hover:bg-[#15150F] hover:text-[#D4CDA4] cursor-pointer" title="Reset viewport"><RotateCcw size={12} /></button>
      <button onClick={onOpenResume} className="hidden sm:flex items-center gap-1 px-2 py-1 border border-[#15150F] bg-[#8EA9DA]/30 hover:bg-[#8EA9DA]/60 cursor-pointer" title="Open portfolio brief">
        <FileText size={11} /><span className="hidden lg:inline">BRIEF</span>
      </button>
      <button onClick={onOpenContact} className="min-h-[36px] sm:min-h-0 flex items-center gap-1 px-3 py-1.5 sm:px-2.5 sm:py-1 border border-[#15150F] bg-[#C3E54E] hover:bg-[#15150F] hover:text-[#C3E54E] text-[11px] cursor-pointer" title="Open contact page">
        <Mail size={12} /><span>CONTACT</span>
      </button>
    </div>
  </header>
);
