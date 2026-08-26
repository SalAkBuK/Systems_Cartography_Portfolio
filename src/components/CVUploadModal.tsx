import React, { useState, useRef } from 'react';
import { 
  FileText, 
  Upload, 
  Check, 
  AlertTriangle, 
  X, 
  Layers, 
  Cpu, 
  User, 
  Briefcase, 
  Code2, 
  ArrowRight, 
  Sparkles,
  RefreshCw,
  FileCheck
} from 'lucide-react';
import { parseCVText, ParsedCVSyncResult, SAMPLE_CV_TEXT } from '../services/cvParserService';
import { OperatorMetadata, ProjectData, InfrastructureSkill, ExperienceNode } from '../types';

interface CVUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyCVSync: (result: ParsedCVSyncResult) => void;
  onResetToDefault: () => void;
  currentOperator?: OperatorMetadata;
}

export const CVUploadModal: React.FC<CVUploadModalProps> = ({
  isOpen,
  onClose,
  onApplyCVSync,
  onResetToDefault,
  currentOperator
}) => {
  const [inputText, setInputText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedResult, setParsedResult] = useState<ParsedCVSyncResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'input' | 'preview'>('input');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleProcessText = (text: string, sourceName?: string) => {
    if (!text.trim()) {
      setParseError('Please provide CV or resume content to parse.');
      return;
    }

    setIsParsing(true);
    setParseError(null);

    try {
      const result = parseCVText(text, sourceName || fileName || 'Uploaded Document');
      setParsedResult(result);
      setActiveTab('preview');
    } catch (err: unknown) {
      setParseError(err instanceof Error ? err.message : 'Failed to parse document text.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileUpload = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();

    if (file.type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.md') || file.name.endsWith('.json')) {
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setInputText(text);
        handleProcessText(text, file.name);
      };
      reader.readAsText(file);
    } else {
      // For binary or other file formats (PDF, DOCX) where raw browser extraction is attempted
      reader.onload = (e) => {
        const content = e.target?.result as string;
        // Clean non-printable characters for simple text fallback
        const sanitized = content.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ' ');
        if (sanitized.trim().length > 50) {
          setInputText(sanitized);
          handleProcessText(sanitized, file.name);
        } else {
          setParseError('Could not extract plaintext from this file type. Please paste the CV text or upload a .txt/.md file.');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleApply = () => {
    if (parsedResult) {
      onApplyCVSync(parsedResult);
      onClose();
    }
  };

  const handleLoadSample = () => {
    setInputText(SAMPLE_CV_TEXT);
    setFileName('sample_systems_architect_cv.txt');
    handleProcessText(SAMPLE_CV_TEXT, 'sample_systems_architect_cv.txt');
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#15150F]/70 backdrop-blur-xs select-none"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-4xl max-h-[92vh] bg-[#D4CDA4] border-[3px] border-[#15150F] flex flex-col font-mono shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Strip */}
        <div className="px-4 py-2.5 bg-[#15150F] text-[#D4CDA4] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText size={15} className="text-[#C3E54E]" />
            <span className="font-bold text-[12px] tracking-wider uppercase">
              RESUME / CV INGESTION &amp; ARCHITECTURAL SYNTHESIS
            </span>
          </div>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-[#D4CDA4] hover:text-[#15150F] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Sub-Header Tabs */}
        <div className="flex border-b border-[#15150F] bg-[#CBC59B] text-[10px] font-bold divide-x divide-[#15150F]">
          <button
            onClick={() => setActiveTab('input')}
            className={`flex-1 py-2 px-3 text-center uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'input' ? 'bg-[#15150F] text-[#D4CDA4]' : 'hover:bg-[#15150F]/10 text-[#15150F]'
            }`}
          >
            <Upload size={12} />
            <span>01 // SOURCE INGESTION (FILE / TEXT)</span>
          </button>
          <button
            onClick={() => {
              if (parsedResult) setActiveTab('preview');
              else if (inputText.trim()) handleProcessText(inputText);
            }}
            className={`flex-1 py-2 px-3 text-center uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'preview' ? 'bg-[#15150F] text-[#D4CDA4]' : 'hover:bg-[#15150F]/10 text-[#15150F]'
            }`}
          >
            <Sparkles size={12} className={parsedResult ? 'text-[#C3E54E]' : ''} />
            <span>02 // SYNTHESIZED TOPOLOGY PREVIEW {parsedResult ? `(${parsedResult.projects.length} SYSTEMS)` : ''}</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 p-4 overflow-y-auto min-h-[380px] max-h-[60vh] flex flex-col gap-4 text-[#15150F]">
          {activeTab === 'input' && (
            <div className="flex flex-col gap-4">
              <div className="bg-[#CBC59B]/40 p-3 border border-[#15150F] text-[10.5px] leading-relaxed">
                <span className="font-bold text-[#15150F] block mb-1">AUTOMATED SYSTEM CARTOGRAPHY CONVERSION:</span>
                Upload your CV or paste raw text from your resume. Our parsing engine extracts your identity, decomposes your engineering skills into 3D isometric infrastructure plinths, and links your career milestones and projects into the visual topology map.
              </div>

              {/* Drag & Drop File Zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed p-6 text-center cursor-pointer transition-colors flex flex-col items-center justify-center gap-2 ${
                  isDragOver ? 'border-[#15150F] bg-[#C3E54E]/20' : 'border-[#15150F]/40 bg-[#E2DCB9]/40 hover:bg-[#E2DCB9]'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md,.json,.pdf,.doc,.docx"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                />
                <Upload size={24} className="text-[#15150F]/70" />
                <div className="text-[11px] font-bold uppercase tracking-wider">
                  {fileName ? `LOADED: ${fileName}` : 'DRAG & DROP CV FILE OR CLICK TO BROWSE'}
                </div>
                <div className="text-[9px] opacity-60">
                  Supports plain text (.txt, .md, .json) or paste your resume text below
                </div>
              </div>

              {/* Raw Text Box */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[9.5px] font-bold opacity-75 uppercase">
                  <span>OR PASTE CV / RESUME TEXT DIRECTLY</span>
                  <button
                    type="button"
                    onClick={handleLoadSample}
                    className="text-[#15150F] underline hover:text-[#666] font-bold"
                  >
                    [LOAD SAMPLE SYSTEMS CV]
                  </button>
                </div>
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Paste your CV text here: Experience, Projects, Skills, Contact Info, Education..."
                  className="w-full h-40 p-3 bg-[#E2DCB9] border border-[#15150F] font-mono text-[10px] leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-[#15150F]"
                />
              </div>

              {parseError && (
                <div className="p-2.5 bg-[#FF6B6B]/20 border border-[#FF6B6B] text-[#900] text-[10px] flex items-center gap-2">
                  <AlertTriangle size={14} className="shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}
            </div>
          )}

          {activeTab === 'preview' && parsedResult && (
            <div className="flex flex-col gap-4">
              {/* Operator Header Card */}
              <div className="p-3 bg-[#15150F] text-[#D4CDA4] flex flex-col gap-2">
                <div className="flex items-center justify-between border-b border-[#D4CDA4]/20 pb-2">
                  <div className="flex items-center gap-2">
                    <User size={16} className="text-[#C3E54E]" />
                    <span className="font-bold text-[13px]">{parsedResult.operator.name}</span>
                    <span className="text-[9px] bg-[#C3E54E] text-[#15150F] px-1.5 py-0.5 font-bold">
                      {parsedResult.operator.status.split('//')[0]}
                    </span>
                  </div>
                  <span className="text-[10px] text-[#C3E54E] font-bold">
                    {parsedResult.operator.yearsActive} YEARS ARCHITECTURAL LOG
                  </span>
                </div>
                <div className="text-[10.5px] font-semibold text-[#CBC59B]">
                  {parsedResult.operator.role} // {parsedResult.operator.location}
                </div>
                <div className="text-[9px] opacity-80 leading-relaxed">
                  {parsedResult.operator.focus}
                </div>
              </div>

              {/* Synthesized 4-Column Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* 1. Infrastructure Capabilities (Skills) */}
                <div className="p-3 bg-[#E2DCB9] border border-[#15150F] flex flex-col gap-2">
                  <div className="flex items-center gap-1.5 font-bold text-[10px] uppercase border-b border-[#15150F]/20 pb-1.5">
                    <Cpu size={12} className="text-[#15150F]" />
                    <span>INFRASTRUCTURE ({parsedResult.skills.length})</span>
                  </div>
                  <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
                    {parsedResult.skills.map((skill) => (
                      <div key={skill.id} className="p-1.5 bg-[#D4CDA4] border border-[#15150F]/40 text-[9px] flex items-center justify-between">
                        <span className="font-bold">{skill.name}</span>
                        <span className="text-[8px] bg-[#15150F] text-[#C3E54E] px-1 font-mono">
                          {skill.proficiencyScore}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Decomposed Systems (Projects) */}
                <div className="p-3 bg-[#E2DCB9] border border-[#15150F] flex flex-col gap-2">
                  <div className="flex items-center gap-1.5 font-bold text-[10px] uppercase border-b border-[#15150F]/20 pb-1.5">
                    <Layers size={12} className="text-[#15150F]" />
                    <span>MAPPED SYSTEMS ({parsedResult.projects.length})</span>
                  </div>
                  <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
                    {parsedResult.projects.map((proj) => (
                      <div key={proj.id} className="p-1.5 bg-[#D4CDA4] border border-[#15150F]/40 text-[9px]">
                        <div className="font-bold flex items-center justify-between">
                          <span>{proj.code} // {proj.title}</span>
                        </div>
                        <div className="text-[8px] opacity-75 mt-0.5 line-clamp-1">
                          {proj.techStack.join(' • ')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. Career Timeline (Experience) */}
                <div className="p-3 bg-[#E2DCB9] border border-[#15150F] flex flex-col gap-2">
                  <div className="flex items-center gap-1.5 font-bold text-[10px] uppercase border-b border-[#15150F]/20 pb-1.5">
                    <Briefcase size={12} className="text-[#15150F]" />
                    <span>CAREER LOGS ({parsedResult.experience.length})</span>
                  </div>
                  <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
                    {parsedResult.experience.map((exp) => (
                      <div key={exp.id} className="p-1.5 bg-[#D4CDA4] border border-[#15150F]/40 text-[9px]">
                        <div className="font-bold">{exp.role}</div>
                        <div className="text-[8px] opacity-75">{exp.organization} ({exp.yearRange})</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Topology Connection Notice */}
              <div className="p-2.5 bg-[#C3E54E]/20 border border-[#15150F] text-[9.5px] flex items-center gap-2">
                <FileCheck size={14} className="shrink-0 text-[#15150F]" />
                <span>
                  <strong>Topology Invariants Ready:</strong> All projects have been connected to extracted infrastructure plinths with orthogonal isometric signal cables.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3 bg-[#CBC59B] border-t border-[#15150F] flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              onResetToDefault();
              onClose();
            }}
            className="px-3 py-1.5 text-[9.5px] font-bold text-[#15150F] hover:bg-[#15150F]/10 border border-[#15150F]/30 uppercase"
          >
            RESTORE DEFAULT PORTFOLIO
          </button>

          <div className="flex items-center gap-2">
            {activeTab === 'input' ? (
              <button
                type="button"
                onClick={() => handleProcessText(inputText)}
                disabled={isParsing || !inputText.trim()}
                className="px-4 py-1.5 bg-[#15150F] text-[#C3E54E] font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5 hover:bg-[#2A2920] disabled:opacity-50"
              >
                {isParsing ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />}
                <span>ANALYZE &amp; SYNTHESIZE CV</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('input')}
                  className="px-3 py-1.5 bg-[#E2DCB9] text-[#15150F] font-bold text-[9.5px] uppercase border border-[#15150F]"
                >
                  ← EDIT SOURCE
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  className="px-4 py-1.5 bg-[#15150F] text-[#C3E54E] font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5 hover:bg-[#2A2920]"
                >
                  <Check size={13} />
                  <span>COMMIT &amp; INJECT TOPOLOGY</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
