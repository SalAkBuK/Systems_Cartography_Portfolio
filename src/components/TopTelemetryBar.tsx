import React from 'react';
import { FileText, Mail, RotateCcw, RefreshCw } from 'lucide-react';
import { ActiveView } from '../types';

export type LiveGitHubStatus = 'snapshot' | 'syncing' | 'live' | 'cached' | 'fallback';

export interface LiveGitHubSyncTelemetry {
  /** Whether runtime live-inventory sync is active for this deployment. */
  available: boolean;
  status: LiveGitHubStatus;
  /** ISO timestamp of the last successful live payload (fresh or cached). */
  lastRefreshedAt: string | null;
  repositoryCount: number;
  isRefreshing: boolean;
  onRefresh: () => void;
}

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
  liveSync?: LiveGitHubSyncTelemetry;
}

/** Short, non-ticking "HH:MM UTC" stamp for the last live refresh. */
function formatRefreshStamp(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const hh = date.getUTCHours().toString().padStart(2, '0');
  const mm = date.getUTCMinutes().toString().padStart(2, '0');
  return `${hh}:${mm}Z`;
}

function liveSourceLabel(
  status: LiveGitHubStatus,
  gitHubSource?: string | null,
): string {
  switch (status) {
    case 'syncing':
      return 'GITHUB // SYNCING';
    case 'live':
      return 'GITHUB // LIVE';
    case 'cached':
      return 'GITHUB // CACHED';
    case 'fallback':
      return 'GITHUB // SNAPSHOT FALLBACK';
    default:
      return `GITHUB SNAPSHOT // ${gitHubSource || 'READY'}`;
  }
}

function liveStatusDotClass(status: LiveGitHubStatus): string {
  switch (status) {
    case 'live':
      return 'bg-[#C3E54E]';
    case 'cached':
      return 'bg-[#8EA9DA]';
    case 'syncing':
      return 'bg-[#E2A96B] animate-pulse';
    case 'fallback':
      return 'bg-[#CA885C]';
    default:
      return 'bg-[#C3E54E]';
  }
}

export const TopTelemetryBar: React.FC<TopTelemetryBarProps> = ({
  setActiveView,
  onResetView,
  onOpenContact,
  onOpenResume,
  activeProjectsCount = 0,
  gitHubSource,
  siteId,
  syncState = 'ready',
  liveSync,
}) => {
  const refreshStamp = formatRefreshStamp(liveSync?.lastRefreshedAt ?? null);

  return (
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
          {syncState === 'ready' ? (
            <span className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 shrink-0 ${liveStatusDotClass(liveSync?.status ?? 'snapshot')}`} />
              <span>{liveSourceLabel(liveSync?.status ?? 'snapshot', gitHubSource)}</span>
              {liveSync?.available && (
                <>
                  <span className="opacity-40">·</span>
                  <span className="opacity-70 tracking-normal">
                    {liveSync.repositoryCount.toString().padStart(2, '0')} REPOS
                    {refreshStamp ? ` · ${refreshStamp}` : ''}
                  </span>
                  <button
                    type="button"
                    onClick={liveSync.onRefresh}
                    disabled={liveSync.isRefreshing}
                    aria-label="Re-check live GitHub inventory"
                    title="Re-check live GitHub inventory"
                    className="ml-0.5 flex items-center justify-center p-0.5 border border-[#15150F] hover:bg-[#15150F] hover:text-[#D4CDA4] disabled:opacity-40 disabled:cursor-default cursor-pointer"
                  >
                    <RefreshCw size={10} className={liveSync.isRefreshing ? 'animate-spin' : ''} />
                  </button>
                </>
              )}
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-[#CA885C]" />
              SNAPSHOT // REFRESH REQUIRED
            </span>
          )}
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
};
