import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  RotateCcw,
  ShieldCheck,
  Radio
} from 'lucide-react';
import { ViewportState } from '../types';
import { OPERATOR_METADATA } from '../data/portfolioData';

interface BottomCommandStripProps {
  viewport: ViewportState;
  traceModeActive: boolean;
  onToggleTraceMode: () => void;
  selectedProjectId: string | null;
  onResetView: () => void;
  onOpenResume: () => void;
  onOpenContact: () => void;
}

export const BottomCommandStrip: React.FC<BottomCommandStripProps> = ({
  viewport,
  traceModeActive,
  onToggleTraceMode,
  selectedProjectId,
  onResetView,
  onOpenResume,
  onOpenContact
}) => {
  const [localTime, setLocalTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setLocalTime(d.toTimeString().split(' ')[0]);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col select-none z-30 shrink-0">
      {/* 1. Primary Operating Command Strip */}
      <footer className="h-10 border-t border-[#15150F] flex items-center px-4 text-[9px] uppercase gap-4 sm:gap-6 font-bold bg-[#CBC59B] text-[#15150F] overflow-x-auto whitespace-nowrap justify-between">
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-1.5">
            <span className="opacity-50">[ACTIONS]:</span>
            <span>[CLICK] INSPECT</span>
            <span className="opacity-40">·</span>
            <span>[DBL-CLICK] DECOMPOSE</span>
            <span className="opacity-40">·</span>
            <span>[T] TRACE SIGNAL</span>
            <span className="opacity-40">·</span>
            <span>[0] RESET</span>
          </div>
        </div>

        <div className="flex items-center gap-3 ml-auto shrink-0">
          <div className="flex items-center gap-2 border-l border-[#15150F]/40 pl-3">
            <span className="opacity-50">COORD:</span>
            <span>X:{Math.round(viewport.x)} Y:{Math.round(viewport.y)} Z:{viewport.zoom.toFixed(2)}x</span>
          </div>

          <button
            onClick={onToggleTraceMode}
            className={`flex items-center gap-1 px-1.5 py-0.5 border border-[#15150F] transition-colors ${
              traceModeActive 
                ? 'bg-[#15150F] text-[#C3E54E]' 
                : 'bg-[#D4CDA4] hover:bg-[#15150F] hover:text-[#D4CDA4]'
            }`}
          >
            <Activity size={10} />
            <span>TRACE: {traceModeActive ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </footer>

      {/* 2. Immersive Terminal Status Footer */}
      <footer className="h-6 bg-[#15150F] text-[#D4CDA4] text-[8px] flex items-center px-4 justify-between tracking-widest font-mono shrink-0 select-none">
        <div className="truncate">SYSTEM OPERATOR: {OPERATOR_METADATA.name.toUpperCase()}</div>
        <div className="hidden md:block truncate">
          COORD: 37.7749° N, 122.4194° W // LOCAL TIME: {localTime}
        </div>
        <div className="flex items-center gap-1.5 text-[#C3E54E]">
          <span className="w-1.5 h-1.5 bg-[#C3E54E] rounded-full animate-ping"></span>
          <span className="tracking-widest">CONNECTED • ENCRYPTED</span>
        </div>
      </footer>
    </div>
  );
};
