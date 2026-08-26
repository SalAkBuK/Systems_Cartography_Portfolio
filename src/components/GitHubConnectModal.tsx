import React, { useState } from 'react';
import { 
  Github, 
  X, 
  ArrowRight, 
  CheckCircle2, 
  AlertTriangle, 
  RotateCcw, 
  Layers, 
  Cpu, 
  ExternalLink,
  Sparkles,
  Terminal,
  Compass,
  Check
} from 'lucide-react';
import { GitHubSyncResult, connectGitHubTarget } from '../services/githubService';

interface GitHubConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplySync: (result: GitHubSyncResult) => void;
  onResetToDefault: () => void;
  currentSync: GitHubSyncResult | null;
}

export const GitHubConnectModal: React.FC<GitHubConnectModalProps> = ({
  isOpen,
  onClose,
  onApplySync,
  onResetToDefault,
  currentSync
}) => {
  const [inputValue, setInputValue] = useState('https://github.com/SalAkBuK');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusLog, setStatusLog] = useState<string | null>(null);

  if (!isOpen) return null;

  const presets = [
    { label: 'SalAkBuK', value: 'https://github.com/SalAkBuK', desc: 'Portfolio repository profile' }
  ];

  const handleConnect = async (targetToConnect?: string) => {
    const target = (targetToConnect || inputValue).trim();
    if (!target) {
      setError('Please provide a GitHub username, org, or repository link.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setStatusLog(`Connecting to GitHub API [${target}]...`);

    try {
      setTimeout(() => setStatusLog(`Fetching repository manifests & languages...`), 400);
      setTimeout(() => setStatusLog(`Mapping verified metadata and reviewed repository evidence...`), 800);

      const result = await connectGitHubTarget(target);
      
      setStatusLog(`Mapped ${result.projects.length} public repositories successfully!`);
      setTimeout(() => {
        onApplySync(result);
        setIsLoading(false);
        setStatusLog(null);
        onClose();
      }, 500);
    } catch (err: any) {
      setIsLoading(false);
      setStatusLog(null);
      setError(err.message || 'Failed to connect to GitHub. Please check the username or repository name.');
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#15150F]/80 backdrop-blur-xs font-mono select-none animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-xl bg-[#D4CDA4] border-2 border-[#15150F] text-[#15150F] shadow-[10px_10px_0px_#15150F] flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-3 bg-[#15150F] text-[#D4CDA4] flex items-center justify-between border-b border-[#15150F]">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-[#C3E54E] text-[#15150F] flex items-center justify-center font-bold">
              <Github size={13} />
            </div>
            <div>
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#C3E54E]">
                GITHUB LIVE INGESTION ENGINE
              </h2>
              <p className="text-[8px] opacity-60 tracking-widest">
                BRING ANY GITHUB PROFILE OR REPO DIRECTLY INTO 3D TOPOLOGY
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-[#D4CDA4] hover:text-[#15150F] transition-colors"
            title="Close (Esc)"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Current Active Source Status */}
          {currentSync ? (
            <div className="p-3 bg-[#15150F] text-[#D4CDA4] border border-[#15150F] flex items-center justify-between">
              <div className="flex items-center gap-3">
                {currentSync.user?.avatar_url ? (
                  <img 
                    src={currentSync.user.avatar_url} 
                    alt={currentSync.sourceIdentifier} 
                    className="w-8 h-8 rounded-none border border-[#C3E54E]"
                  />
                ) : (
                  <div className="w-8 h-8 bg-[#2A2920] border border-[#C3E54E] flex items-center justify-center text-[#C3E54E]">
                    <Github size={16} />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-1.5 text-[9px] text-[#C3E54E] font-bold">
                    <CheckCircle2 size={11} />
                    <span>ACTIVE SYNC: {currentSync.sourceType.toUpperCase()} // {currentSync.sourceIdentifier}</span>
                  </div>
                  <div className="text-[8.5px] opacity-70">
                    {currentSync.projects.length} 3D Architectural Nodes Loaded
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  onResetToDefault();
                  onClose();
                }}
                className="px-2 py-1 bg-[#D4CDA4] text-[#15150F] hover:bg-[#E5534E] hover:text-white transition-colors text-[8.5px] font-bold flex items-center gap-1"
                title="Revert to original portfolio"
              >
                <RotateCcw size={10} />
                <span>RESTORE DEFAULT</span>
              </button>
            </div>
          ) : (
            <div className="p-2.5 bg-[#CBC59B]/50 border border-[#15150F] text-[9.5px] leading-relaxed">
              <span className="font-bold">HOW IT WORKS: </span>
              Enter any public GitHub username, organization, or specific repository URL below. 
              The engine automatically analyzes the languages, stars, topics, and code complexity to proceduralize 
              real axonometric 3D building structures, subsystem schematics, and signal conduits in real-time!
            </div>
          )}

          {/* Input Form */}
          <div className="space-y-1.5">
            <label className="text-[9px] font-bold uppercase tracking-wider block opacity-70">
              TARGET GITHUB USERNAME, ORG, OR REPO LINK
            </label>
            <div className="flex gap-1.5">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isLoading) {
                      handleConnect();
                    }
                  }}
                  placeholder="e.g. torvalds, facebook/react, antfu, or your username"
                  className="w-full bg-[#E2DCB9] border-2 border-[#15150F] px-3 py-2 text-[11px] font-mono text-[#15150F] placeholder-[#15150F]/40 focus:outline-none focus:bg-[#FFFDE8]"
                  disabled={isLoading}
                  autoFocus
                />
              </div>
              <button
                onClick={() => handleConnect()}
                disabled={isLoading}
                className="px-4 py-2 bg-[#15150F] text-[#C3E54E] hover:bg-[#2A2920] disabled:opacity-50 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 transition-colors border border-[#15150F]"
              >
                {isLoading ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-[#C3E54E] animate-ping"></span>
                    <span>SYNCING...</span>
                  </>
                ) : (
                  <>
                    <span>INGEST</span>
                    <ArrowRight size={12} />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Live Progress Logs */}
          {statusLog && (
            <div className="p-2 bg-[#15150F] text-[#C3E54E] text-[9px] font-mono border border-[#15150F] flex items-center gap-2 animate-pulse">
              <Terminal size={12} className="shrink-0" />
              <span>{statusLog}</span>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-2.5 bg-[#E5534E]/15 border border-[#E5534E] text-[#B91C1C] text-[9.5px] font-mono flex items-start gap-2">
              <AlertTriangle size={13} className="shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">CONNECTION FAILED: </span>
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* Quick-Try Preset Repositories */}
          <div className="space-y-1.5 pt-1">
            <div className="text-[8.5px] font-bold uppercase tracking-wider opacity-60 flex items-center justify-between">
              <span>OR TEST WITH ONE-CLICK PRESET REPOSITORIES</span>
              <Sparkles size={10} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {presets.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => {
                    setInputValue(preset.value);
                    handleConnect(preset.value);
                  }}
                  disabled={isLoading}
                  className="p-2 bg-[#E2DCB9] border border-[#15150F] text-left hover:bg-[#15150F] hover:text-[#D4CDA4] transition-colors group disabled:opacity-50"
                >
                  <div className="text-[9.5px] font-bold group-hover:text-[#C3E54E] flex items-center justify-between">
                    <span>{preset.label}</span>
                    <ArrowRight size={9} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="text-[7.5px] opacity-60 font-mono mt-0.5 truncate">
                    {preset.value}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-[#CBC59B] border-t border-[#15150F] flex items-center justify-between text-[9px]">
          <span className="opacity-60">PUBLIC GITHUB REST API // ZERO AUTH REQUIRED</span>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-[#15150F] text-[#D4CDA4] text-[9px] font-bold hover:bg-[#2A2920] transition-colors"
          >
            DISMISS
          </button>
        </div>
      </div>
    </div>
  );
};
