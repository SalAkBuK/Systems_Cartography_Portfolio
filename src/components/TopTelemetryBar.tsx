import React, { useState, useEffect } from 'react';
import { 
  Terminal, 
  RotateCcw, 
  FileText, 
  Mail, 
  Activity, 
  ShieldCheck,
  Zap,
  Github,
  CheckCircle2
} from 'lucide-react';
import { ActiveView } from '../types';

interface TopTelemetryBarProps {
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  selectedProjectId: string | null;
  onResetView: () => void;
  onToggleTraceMode: () => void;
  traceModeActive: boolean;
  onOpenContact: () => void;
  onOpenResume: () => void;
  onOpenGitHubSync?: () => void;
  onOpenCVUpload?: () => void;
  activeProjectsCount?: number;
  gitHubSource?: string | null;
  cvSource?: string | null;
}

export const TopTelemetryBar: React.FC<TopTelemetryBarProps> = ({
  activeView,
  setActiveView,
  selectedProjectId,
  onResetView,
  onToggleTraceMode,
  traceModeActive,
  onOpenContact,
  onOpenResume,
  onOpenGitHubSync,
  onOpenCVUpload,
  activeProjectsCount = 0,
  gitHubSource = null,
  cvSource = null
}) => {
  return (
    <header className="h-12 bg-[#D4CDA4] border-b border-[#15150F] flex items-center px-4 justify-between text-[10px] uppercase tracking-widest font-bold select-none z-30 shrink-0">
      {/* Left: System Telemetry Pairs */}
      <div className="flex items-center gap-4 sm:gap-6 lg:gap-8 overflow-x-auto">
        <button 
          onClick={() => {
            setActiveView('system_overview');
            onResetView();
          }}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity shrink-0"
          title="System Root"
        >
          <span className="w-2.5 h-2.5 bg-[#15150F] flex items-center justify-center">
            <span className="w-1 h-1 bg-[#C3E54E]"></span>
          </span>
          <div className="flex flex-col text-left">
            <span className="text-[8px] opacity-50 tracking-tighter">System ID</span>
            <span className="font-bold text-[10px] text-[#15150F]">
              {cvSource ? `CV//${cvSource.slice(0, 14).toUpperCase()}` : gitHubSource ? `GH//${gitHubSource.toUpperCase()}` : 'SALIH.SYSTEMS.PORTFOLIO'}
            </span>
          </div>
        </button>

        <div className="hidden sm:flex flex-col">
          <span className="text-[8px] opacity-50 tracking-tighter">Project Map</span>
          <span className="text-[#15150F]">{(activeProjectsCount ?? 0).toString().padStart(2, '0')} NODES ACTIVE</span>
        </div>

        <div className="hidden md:flex flex-col">
          <span className="text-[8px] opacity-50 tracking-tighter">Source</span>
          <span className="text-[#15150F] flex items-center gap-1">
            {cvSource ? (
              <>
                <span className="w-1.5 h-1.5 bg-[#8EA9DA] rounded-full animate-ping"></span>
                <span className="text-[#15150F] font-bold">CV SYNCHRONIZED</span>
              </>
            ) : gitHubSource ? (
              <>
                <span className="w-1.5 h-1.5 bg-[#C3E54E] rounded-full animate-ping"></span>
                <span className="text-[#15150F] font-bold">GITHUB LIVE</span>
              </>
            ) : (
              'CORE CATALOGUE'
            )}
          </span>
        </div>
      </div>

      {/* Right: Operational Status & Action Controls */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* CV Ingestion Button */}
        <button
          onClick={onOpenCVUpload}
          className={`flex items-center gap-1.5 px-2.5 py-1 border border-[#15150F] text-[9px] font-bold transition-colors ${
            cvSource 
              ? 'bg-[#15150F] text-[#8EA9DA] hover:bg-[#2A2920]' 
              : 'bg-[#E2DCB9] text-[#15150F] hover:bg-[#15150F] hover:text-[#D4CDA4]'
          }`}
          title="Upload or paste CV / Resume to synthesize topology"
        >
          <FileText size={12} className={cvSource ? 'text-[#8EA9DA]' : ''} />
          <span className="hidden sm:inline">{cvSource ? 'CV PARSED' : 'INGEST CV'}</span>
          <span className="sm:hidden">CV</span>
        </button>

        {/* GitHub Ingestion Button */}
        <button
          onClick={onOpenGitHubSync}
          className={`flex items-center gap-1.5 px-2.5 py-1 border border-[#15150F] text-[9px] font-bold transition-colors ${
            gitHubSource 
              ? 'bg-[#15150F] text-[#C3E54E] hover:bg-[#2A2920]' 
              : 'bg-[#15150F] text-[#D4CDA4] hover:bg-[#2A2920]'
          }`}
          title="Connect any GitHub repo or user account"
        >
          <Github size={12} className={gitHubSource ? 'text-[#C3E54E]' : ''} />
          <span className="hidden sm:inline">{gitHubSource ? `SYNC: ${gitHubSource}` : 'SYNC GITHUB'}</span>
          <span className="sm:hidden">GH</span>
        </button>

        {/* Action Controls */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          <button
            onClick={onToggleTraceMode}
            className={`flex items-center gap-1 px-2 py-1 border border-[#15150F] text-[9px] transition-colors ${
              traceModeActive 
                ? 'bg-[#15150F] text-[#C3E54E]' 
                : 'bg-[#D4CDA4] text-[#15150F] hover:bg-[#15150F] hover:text-[#D4CDA4]'
            }`}
            title="Toggle signal trace conduits (T)"
          >
            <Activity size={11} className={traceModeActive ? 'animate-pulse' : ''} />
            <span className="hidden sm:inline">TRACE</span>
          </button>

          <button
            onClick={onResetView}
            className="flex items-center gap-1 px-2 py-1 border border-[#15150F] text-[9px] bg-[#D4CDA4] text-[#15150F] hover:bg-[#15150F] hover:text-[#D4CDA4] transition-colors"
            title="Reset viewport (0)"
          >
            <RotateCcw size={11} />
            <span className="hidden sm:inline">RESET</span>
          </button>

          <button
            onClick={onOpenResume}
            className="flex items-center gap-1 px-2.5 py-1 border border-[#15150F] text-[9px] bg-[#8EA9DA]/30 hover:bg-[#8EA9DA]/60 text-[#15150F] transition-colors font-bold"
            title="View Technical Resume / CV (R)"
          >
            <FileText size={11} />
            <span className="hidden sm:inline">RESUME</span>
          </button>

          <button
            onClick={onOpenContact}
            className="flex items-center gap-1 px-2.5 py-1 border border-[#15150F] text-[9px] bg-[#C3E54E] text-[#15150F] hover:bg-[#B2D63B] transition-colors font-bold shadow-none"
            title="Open Contact Dispatcher (C)"
          >
            <Mail size={11} />
            <span>CONTACT</span>
          </button>
        </div>
      </div>
    </header>
  );
};
