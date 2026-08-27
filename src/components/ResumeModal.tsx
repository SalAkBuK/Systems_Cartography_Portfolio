import React, { useState } from 'react';
import { 
  X, 
  Printer, 
  Download, 
  Copy, 
  Check, 
  FileText, 
  Terminal, 
  ExternalLink
} from 'lucide-react';
import { OperatorMetadata, ProjectData, InfrastructureSkill, ExperienceNode } from '../types';
import { VERIFIED_OPERATOR_METADATA as OPERATOR_METADATA } from '../data/verifiedPortfolioData';

interface ResumeModalProps {
  isOpen: boolean;
  onClose: () => void;
  operator?: OperatorMetadata;
  projects?: ProjectData[];
  skills?: InfrastructureSkill[];
  experience?: ExperienceNode[];
}

export const ResumeModal: React.FC<ResumeModalProps> = ({
  isOpen,
  onClose,
  operator = OPERATOR_METADATA,
  projects = [],
  skills = [],
  experience = []
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const activeOperator = operator || OPERATOR_METADATA;
  const activeProjects = projects;
  const activeSkills = skills;
  const activeExperience = experience;

  const generateMarkdownResume = () => {
    return `# ${activeOperator.name.toUpperCase()}
${activeOperator.role}
Location: ${activeOperator.location} | Email: ${activeOperator.contact.email}
GitHub: ${activeOperator.contact.github || 'Not provided'} | LinkedIn: ${activeOperator.contact.linkedin || 'Not provided'}

---

## EXECUTIVE SUMMARY
${activeOperator.systemManifesto}

---

## CORE TECHNICAL CAPABILITIES
${activeSkills.map(s => `- **${s.name}** (${s.category}): ${s.primaryUseCases.join(', ')}`).join('\n')}

---

## PROFESSIONAL EXPERIENCE LOG

${activeExperience.map(exp => `### ${exp.role} — ${exp.organization}
*${exp.yearRange} | ${exp.location}*
**Domain:** ${exp.systemDomain}
${exp.progressionRoles && exp.progressionRoles.length > 1 ? `**Career Progression:**\n${exp.progressionRoles.map(r => `  - ${r.role} (${r.yearRange})${r.endDate === null ? ' [CURRENT]' : ''}${r.promotionNote ? ` [${r.promotionNote}]` : ''}`).join('\n')}\n` : ''}${exp.systemsDelivered && exp.systemsDelivered.length > 0 ? `**Delivered Systems:**\n${exp.systemsDelivered.map(d => `  - **${d.name}**: ${d.tagline}`).join('\n')}\n` : ''}${exp.systemsArchitected && exp.systemsArchitected.length > 0 ? `**Systems Architected:** ${exp.systemsArchitected.join(', ')}\n` : ''}**Key Outputs & Contributions:**
${exp.keyOutputs.map(out => `- ${out}`).join('\n')}
**Stack:** ${exp.technologies.join(', ')}
`).join('\n')}

---

## SELECTED FLAGSHIP SYSTEM IMPLEMENTATIONS

${activeProjects.slice(0, 4).map(p => `### ${p.code}: ${p.title} (${p.year})
*${p.tagline}*
- **Problem:** ${p.problem}
- **Architecture:** ${p.solution}
- **Key Benchmarks:** ${p.metrics.map(m => `${m.label}: ${m.value}`).join(' | ')}
- **Stack:** ${p.techStack.join(', ')}
`).join('\n')}

---
*Generated from public GitHub metadata via Systems Cartography.*
`;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generateMarkdownResume());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const element = document.createElement('a');
    const file = new Blob([generateMarkdownResume()], { type: 'text/markdown' });
    element.href = URL.createObjectURL(file);
    element.download = `${activeOperator.name.replace(/\s+/g, '_')}_Systems_Architect_Resume.md`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#15150F]/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto select-none">
      <div 
        className="relative w-full max-w-4xl bg-[#D4CDA4] border-2 border-precision text-[#15150F] flex flex-col max-h-[90vh] shadow-[8px_8px_0px_#15150F] font-mono text-[11px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-3 bg-[#CBC59B] border-b border-precision flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <FileText size={13} className="text-[#15150F]" />
            <span className="font-bold text-[12px] tracking-wider uppercase">
              TECHNICAL SPECIFICATION // PORTFOLIO BRIEF
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-2.5 py-1 bg-[#15150F] text-[#D4CDA4] hover:bg-[#C3E54E] hover:text-[#15150F] transition-colors border border-precision text-[9.5px] font-bold"
            >
              {copied ? <Check size={11} /> : <Copy size={11} />}
              <span>{copied ? 'COPIED MD' : 'COPY .MD'}</span>
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1 px-2.5 py-1 bg-[#15150F] text-[#D4CDA4] hover:bg-[#C3E54E] hover:text-[#15150F] transition-colors border border-precision text-[9.5px] font-bold"
            >
              <Download size={11} />
              <span>DOWNLOAD</span>
            </button>
            <button
              onClick={handlePrint}
              className="hidden sm:flex items-center gap-1 px-2.5 py-1 bg-[#15150F] text-[#D4CDA4] hover:bg-[#C3E54E] hover:text-[#15150F] transition-colors border border-precision text-[9.5px] font-bold"
            >
              <Printer size={11} />
              <span>PRINT</span>
            </button>
            <button
              onClick={onClose}
              className="w-7 h-7 bg-[#15150F] text-[#D4CDA4] hover:bg-[#C3E54E] hover:text-[#15150F] flex items-center justify-center transition-colors border border-precision"
              title="Close (Esc)"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Content */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 flex flex-col gap-6 leading-relaxed bg-[#DCD6B2]/40 text-[#15150F]">
          {/* Header Block */}
          <div className="border-b-2 border-precision pb-4 flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[18px] font-bold tracking-tight text-[#15150F]">
                {activeOperator.name}
              </span>
              <span className="text-[9.5px] px-2 py-0.5 bg-[#15150F] text-[#C3E54E] font-bold">
                {activeOperator.role.toUpperCase()}
              </span>
            </div>
            <div className="text-[11px] font-medium text-[#3D3A2C]">
              {activeOperator.focus}
            </div>
            <div className="flex flex-wrap gap-4 text-[9.5px] text-[#5C5946] mt-1 font-mono">
              <span>LOC: {activeOperator.location}</span>
              <span>·</span>
              <span>EMAIL: {activeOperator.contact.email}</span>
              <span>·</span>
              <span>GITHUB: {activeOperator.contact.github.replace(/^https?:\/\//, '') || 'Not provided'}</span>
            </div>
          </div>

          {/* Executive Architectural Summary */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[9.5px] font-bold text-[#5C5946] uppercase tracking-widest">
              01 // EXECUTIVE ARCHITECTURAL SUMMARY
            </span>
            <p className="text-[10.5px] text-[#22211A] bg-[#E2DCB9] p-3 border border-precision leading-relaxed">
              {activeOperator.systemManifesto}
            </p>
          </div>

          {/* Technical Infrastructure Skills Matrix */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[9.5px] font-bold text-[#5C5946] uppercase tracking-widest">
              02 // CORE INFRASTRUCTURE CAPABILITIES
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {activeSkills.map(skill => (
                <div key={skill.id} className="p-2.5 border border-precision bg-[#E2DCB9]/60 flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[10.5px]">{skill.name}</span>
                    <span className="text-[8px] bg-[#15150F] text-[#D4CDA4] px-1">{skill.systemCount} SYSTEMS</span>
                  </div>
                  <div className="text-[9px] text-[#5C5946] leading-snug">
                    {skill.primaryUseCases.slice(0, 2).join(' · ')}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Professional Experience History */}
          <div className="flex flex-col gap-3">
            <span className="text-[9.5px] font-bold text-[#5C5946] uppercase tracking-widest">
              03 // SYSTEM BUILD HISTORY
            </span>
            <div className="flex flex-col gap-3.5">
              {activeExperience.map(exp => (
                <div key={exp.id} className="p-3.5 border border-precision bg-[#E2DCB9] flex flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between border-b border-precision pb-1.5 gap-1">
                    <div>
                      <span className="font-bold text-[12px] text-[#15150F]">{exp.role}</span>
                      <span className="text-[#5C5946]"> @ </span>
                      <span className="font-bold text-[12px]">{exp.organization}</span>
                    </div>
                    <span className="text-[9px] bg-[#15150F] text-[#C3E54E] px-1.5 py-0.5 font-bold">
                      {exp.yearRange}
                    </span>
                  </div>
                  <div className="text-[9.5px] font-semibold text-[#4A4736]">
                    DOMAIN: {exp.systemDomain}
                  </div>

                  {/* Multi-role progression */}
                  {exp.progressionRoles && exp.progressionRoles.length > 1 && (
                    <div className="p-2 bg-[#DCD6B2]/70 border border-precision/40 flex flex-col gap-1 text-[9px]">
                      <span className="text-[8px] font-bold opacity-60 uppercase">CAREER PROGRESSION:</span>
                      {exp.progressionRoles.map((r, ri) => (
                        <div key={ri} className="flex items-center justify-between">
                          <span className="font-bold text-[#15150F]">{r.role}</span>
                          <div className="flex items-center gap-1">
                            {r.promotionNote && (
                              <span className="text-[7.5px] px-1 bg-[#2E6B3A] text-[#D4CDA4] font-bold">
                                ↑ PROMOTED
                              </span>
                            )}
                            <span className="text-[#5C5946]">{r.yearRange}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Delivered Systems */}
                  {exp.systemsDelivered && exp.systemsDelivered.length > 0 && (
                    <div className="flex flex-col gap-1 text-[9.5px]">
                      <span className="text-[8px] font-bold opacity-60 uppercase">DELIVERED SYSTEMS:</span>
                      {exp.systemsDelivered.map((d, di) => (
                        <div key={di} className="flex flex-col gap-0.5 bg-[#D4CDA4]/50 p-1.5 border border-precision/20">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[#15150F]">{d.name}</span>
                            {d.status && <span className="text-[7.5px] font-bold opacity-75">{d.status}</span>}
                          </div>
                          <span className="text-[8.5px] text-[#5C5946]">{d.tagline}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <ul className="flex flex-col gap-1 text-[10px] text-[#22211A]">
                    {exp.keyOutputs.map((out, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-[#5C5946] font-bold">▪</span>
                        <span>{out}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap gap-1 pt-1 mt-1 border-t border-precision/40">
                    {exp.technologies.map(t => (
                      <span key={t} className="text-[8px] px-1 bg-[#D4CDA4] border border-precision/40">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Selected Flagship Systems */}
          <div className="flex flex-col gap-3">
            <span className="text-[9.5px] font-bold text-[#5C5946] uppercase tracking-widest">
              04 // SELECTED FLAGSHIP SYSTEMS ARCHITECTED
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {activeProjects.slice(0, 4).map(p => (
                <div key={p.id} className="p-3 border border-precision bg-[#E2DCB9]/80 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between border-b border-precision pb-1">
                    <span className="font-bold text-[11px]">{p.code} // {p.title}</span>
                    <span className="text-[8px] bg-[#15150F] text-[#C3E54E] px-1 font-bold">{p.status}</span>
                  </div>
                  <p className="text-[9.5px] text-[#3D3A2C] leading-snug">
                    {p.summary}
                  </p>
                  <div className="flex flex-wrap gap-1 pt-1 mt-auto">
                    {p.techStack.map(t => (
                      <span key={t} className="text-[7.5px] px-1 bg-[#D4CDA4] border border-precision/40">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-[#CBC59B] border-t border-precision flex items-center justify-between shrink-0 text-[9px] text-[#5C5946]">
          <span>VERIFIED SPEC // COMPILED 2026</span>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-[#D4CDA4] text-[#15150F] hover:bg-[#15150F] hover:text-[#D4CDA4] transition-colors border border-precision font-bold"
          >
            CLOSE [ESC]
          </button>
        </div>
      </div>
    </div>
  );
};
