import React, { useState, useMemo } from 'react';
import { 
  X, 
  Printer, 
  Download, 
  Copy, 
  Check, 
  FileText, 
  ExternalLink
} from 'lucide-react';
import { OperatorMetadata, ProjectData, InfrastructureSkill, ExperienceNode } from '../types';
import { VERIFIED_OPERATOR_METADATA as OPERATOR_METADATA } from '../data/verifiedPortfolioData';
import { PORTFOLIO_CONFIG } from '../config/portfolioConfig';
import { resolveFlagshipProjects } from '../utils/portfolioUtils';
import { sanitizeHttpUrl } from '../utils/urlSecurity';

interface ResumeModalProps {
  isOpen: boolean;
  onClose: () => void;
  operator?: OperatorMetadata;
  projects?: ProjectData[];
  skills?: InfrastructureSkill[];
  experience?: ExperienceNode[];
  flagshipProjectIds?: string[];
}

function groupSkillsByFamily(skills: InfrastructureSkill[]) {
  const families: Record<string, { label: string; skills: InfrastructureSkill[] }> = {
    frontend: { label: 'FRONTEND // PRODUCT ARCHITECTURE', skills: [] },
    backend: { label: 'BACKEND // SERVICES & DISTRIBUTED SYSTEMS', skills: [] },
    data: { label: 'DATA // PERSISTENCE & ACCESS LAYERS', skills: [] },
    infra: { label: 'TESTING // DELIVERY & INFRASTRUCTURE', skills: [] },
  };

  for (const s of skills) {
    const nameLower = s.name.toLowerCase();
    if (
      nameLower.includes('postgres') ||
      nameLower.includes('mongo') ||
      nameLower.includes('mysql') ||
      nameLower.includes('sqlite') ||
      nameLower.includes('redis') ||
      nameLower.includes('prisma') ||
      nameLower.includes('database') ||
      nameLower.includes('storage')
    ) {
      families.data.skills.push(s);
    } else if (
      s.category === 'infrastructure' ||
      s.category === 'tooling' ||
      nameLower.includes('docker') ||
      nameLower.includes('test') ||
      nameLower.includes('jest') ||
      nameLower.includes('vitest') ||
      nameLower.includes('playwright')
    ) {
      families.infra.skills.push(s);
    } else if (s.category === 'frontend' || nameLower.includes('tailwind') || nameLower.includes('native')) {
      families.frontend.skills.push(s);
    } else {
      families.backend.skills.push(s);
    }
  }

  return Object.values(families).filter(f => f.skills.length > 0);
}

export const ResumeModal: React.FC<ResumeModalProps> = ({
  isOpen,
  onClose,
  operator = OPERATOR_METADATA,
  projects = [],
  skills = [],
  experience = [],
  flagshipProjectIds
}) => {
  const [copied, setCopied] = useState(false);

  const activeOperator = operator || OPERATOR_METADATA;
  const activeProjects = projects;
  const activeSkills = skills;
  const activeExperience = experience;

  const resolvedFlagships = useMemo(() => {
    const configuredIds = (flagshipProjectIds && flagshipProjectIds.length > 0)
      ? flagshipProjectIds
      : PORTFOLIO_CONFIG.flagshipProjectIds;
    return resolveFlagshipProjects(activeProjects, configuredIds, 4);
  }, [activeProjects, flagshipProjectIds]);

  const totalDeliveredSystems = useMemo(() => {
    return activeExperience.reduce((sum, e) => sum + (e.systemsDelivered?.length || 0), 0);
  }, [activeExperience]);

  const capabilityFamilies = useMemo(() => {
    return groupSkillsByFamily(activeSkills);
  }, [activeSkills]);

  if (!isOpen) return null;

  const generateMarkdownResume = () => {
    const contactLinks = [
      `Location: ${activeOperator.location}`,
      `Email: ${activeOperator.contact.email}`,
      activeOperator.contact.github ? `GitHub: ${activeOperator.contact.github.replace(/^https?:\/\//, '')}` : null,
      activeOperator.contact.linkedin ? `LinkedIn: ${activeOperator.contact.linkedin.replace(/^https?:\/\//, '')}` : null,
    ].filter(Boolean).join(' | ');

    return `# ${activeOperator.name.toUpperCase()}
${activeOperator.role.toUpperCase()}
${contactLinks}

---

## 01 // ENGINEERING PROFILE
${activeOperator.systemManifesto}

**VERIFIED EVIDENCE STATUS:**
- Repositories Indexed: ${activeProjects.length}
- Technical Capabilities: ${activeSkills.length}
- Professional Systems Delivered: ${totalDeliveredSystems}
- Selected Flagship Systems: ${resolvedFlagships.length}

---

## 02 // TECHNICAL OPERATING RANGE

${capabilityFamilies.map(fam => `### ${fam.label}
${fam.skills.map(s => `- **${s.name}** (${s.systemCount} systems): ${s.primaryUseCases.join(' · ')}`).join('\n')}`).join('\n\n')}

---

## 03 // SYSTEM BUILD HISTORY

${activeExperience.map(exp => `### ${exp.role} — ${exp.organization}
*${exp.yearRange} | ${exp.location}*
**Domain:** ${exp.systemDomain}
${exp.progressionRoles && exp.progressionRoles.length > 1 ? `**Career Progression:**\n${exp.progressionRoles.map(r => `  - ${r.role} (${r.yearRange})${r.endDate === null ? ' [CURRENT]' : ''}${r.promotionNote ? ` [${r.promotionNote}]` : ''}`).join('\n')}\n` : ''}${exp.systemsDelivered && exp.systemsDelivered.length > 0 ? `**Delivered Systems:**\n${exp.systemsDelivered.map(d => `  - **${d.name}**: ${d.tagline}`).join('\n')}\n` : ''}${exp.systemsArchitected && exp.systemsArchitected.length > 0 ? `**Systems Architected:** ${exp.systemsArchitected.join(', ')}\n` : ''}**Key Outputs & Contributions:**
${exp.keyOutputs.map(out => `- ${out}`).join('\n')}
**Stack:** ${exp.technologies.join(', ')}
`).join('\n')}

---

## 04 // SELECTED FLAGSHIP SYSTEMS

${resolvedFlagships.map(p => `### ${p.code}: ${p.title} (${p.year}) [${p.status}]
*${p.tagline || p.summary}*
- **Challenge:** ${p.problem || p.summary}
- **Architecture:** ${p.solution || p.architectureNotes}
${p.validationEvidence?.summary ? `- **Verification:** ${p.validationEvidence.summary}\n` : ''}- **Stack:** ${p.techStack.join(', ')}
${p.links?.github ? `- **Repository:** ${p.links.github}\n` : ''}`).join('\n')}

---
*Generated from verified repository and employment metadata via Systems Cartography.*
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
              className="flex items-center gap-1 px-2.5 py-1 bg-[#15150F] text-[#D4CDA4] hover:bg-[#C3E54E] hover:text-[#15150F] transition-colors border border-precision text-[11px] font-bold"
            >
              {copied ? <Check size={11} /> : <Copy size={11} />}
              <span>{copied ? 'COPIED MD' : 'COPY .MD'}</span>
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1 px-2.5 py-1 bg-[#15150F] text-[#D4CDA4] hover:bg-[#C3E54E] hover:text-[#15150F] transition-colors border border-precision text-[11px] font-bold"
            >
              <Download size={11} />
              <span>DOWNLOAD</span>
            </button>
            <button
              onClick={handlePrint}
              className="hidden sm:flex items-center gap-1 px-2.5 py-1 bg-[#15150F] text-[#D4CDA4] hover:bg-[#C3E54E] hover:text-[#15150F] transition-colors border border-precision text-[11px] font-bold"
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
              <span className="text-[10px] px-2 py-0.5 bg-[#15150F] text-[#C3E54E] font-bold">
                {activeOperator.role.toUpperCase()}
              </span>
            </div>
            <div className="text-[11px] font-medium text-[#3D3A2C]">
              {activeOperator.focus}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[10px] text-[#5C5946] mt-1 font-mono">
              <span>LOC: {activeOperator.location}</span>
              <span>·</span>
              <span>EMAIL: {activeOperator.contact.email}</span>
              {activeOperator.contact.github && (
                <>
                  <span>·</span>
                  <span>GITHUB: {activeOperator.contact.github.replace(/^https?:\/\//, '')}</span>
                </>
              )}
              {activeOperator.contact.linkedin && (
                <>
                  <span>·</span>
                  <span>LINKEDIN: {activeOperator.contact.linkedin.replace(/^https?:\/\//, '')}</span>
                </>
              )}
            </div>
          </div>

          {/* 01 // Engineering Profile */}
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-bold text-[#5C5946] uppercase tracking-widest">
              01 // ENGINEERING PROFILE
            </span>
            <div className="bg-[#E2DCB9] p-3.5 border border-precision flex flex-col gap-3">
              <p className="text-[12.5px] text-[#22211A] leading-relaxed">
                {activeOperator.systemManifesto}
              </p>
              {/* Evidence Status Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2.5 border-t border-precision/40 text-[10px] font-mono">
                <div className="flex flex-col">
                  <span className="text-[#6B664F]">REPOSITORIES</span>
                  <span className="font-bold text-[#15150F]">{activeProjects.length} INDEXED</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[#6B664F]">CAPABILITIES</span>
                  <span className="font-bold text-[#15150F]">{activeSkills.length} VERIFIED</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[#6B664F]">DELIVERED SYSTEMS</span>
                  <span className="font-bold text-[#15150F]">{totalDeliveredSystems} RECORDED</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[#6B664F]">FLAGSHIPS</span>
                  <span className="font-bold text-[#15150F]">{resolvedFlagships.length} CURATED</span>
                </div>
              </div>
            </div>
          </div>

          {/* 02 // Technical Operating Range */}
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-bold text-[#5C5946] uppercase tracking-widest">
              02 // TECHNICAL OPERATING RANGE
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {capabilityFamilies.map(family => (
                <div key={family.label} className="p-3 border border-precision bg-[#E2DCB9]/70 flex flex-col gap-2">
                  <span className="font-bold text-[10px] text-[#5C5946] tracking-wider uppercase border-b border-precision/30 pb-1">
                    {family.label}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {family.skills.map(skill => (
                      <span
                        key={skill.id}
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-[#DCD6B2] border border-precision/40 text-[11px]"
                        title={skill.primaryUseCases.join(' · ')}
                      >
                        <span className="font-bold text-[#15150F]">{skill.name.split('&')[0].trim()}</span>
                        <span className="text-[9.5px] text-[#5C5946]">({skill.systemCount})</span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 03 // System Build History */}
          <div className="flex flex-col gap-3">
            <span className="text-[11px] font-bold text-[#5C5946] uppercase tracking-widest">
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
                    <span className="text-[10px] bg-[#15150F] text-[#C3E54E] px-1.5 py-0.5 font-bold">
                      {exp.yearRange}
                    </span>
                  </div>
                  <div className="text-[11px] font-semibold text-[#4A4736]">
                    DOMAIN: {exp.systemDomain}
                  </div>

                  {/* Multi-role progression */}
                  {exp.progressionRoles && exp.progressionRoles.length > 1 && (
                    <div className="p-2 bg-[#DCD6B2]/70 border border-precision/40 flex flex-col gap-1 text-[11px]">
                      <span className="text-[11px] font-bold opacity-60 uppercase">CAREER PROGRESSION:</span>
                      {exp.progressionRoles.map((r, ri) => (
                        <div key={ri} className="flex items-center justify-between">
                          <span className="font-bold text-[#15150F]">{r.role}</span>
                          <div className="flex items-center gap-1">
                            {r.promotionNote && (
                              <span className="text-[10px] px-1 bg-[#2E6B3A] text-[#D4CDA4] font-bold">
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
                    <div className="flex flex-col gap-1 text-[11px]">
                      <span className="text-[11px] font-bold opacity-60 uppercase">DELIVERED SYSTEMS:</span>
                      {exp.systemsDelivered.map((d, di) => (
                        <div key={di} className="flex flex-col gap-0.5 bg-[#D4CDA4]/50 p-1.5 border border-precision/20">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[#15150F]">{d.name}</span>
                            {d.status && <span className="text-[10px] font-bold opacity-75">{d.status}</span>}
                          </div>
                          <span className="text-[12.5px] text-[#5C5946]">{d.tagline}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <ul className="flex flex-col gap-1 text-[12.5px] text-[#22211A]">
                    {exp.keyOutputs.map((out, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-[#5C5946] font-bold">▪</span>
                        <span>{out}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap gap-1 pt-1 mt-1 border-t border-precision/40">
                    {exp.technologies.map(t => (
                      <span key={t} className="text-[10px] px-1 bg-[#D4CDA4] border border-precision/40">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 04 // Selected Flagship Systems */}
          <div className="flex flex-col gap-2.5">
            <span className="text-[11px] font-bold text-[#5C5946] uppercase tracking-widest">
              04 // SELECTED FLAGSHIP SYSTEMS
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {resolvedFlagships.map(p => {
                const verifiedMetrics = p.metrics.filter(
                  m => m.value && m.value !== '0 ★' && m.value !== '0 ⑂' && m.value !== '0 open' && m.value !== 'Not reported'
                );
                return (
                  <div key={p.id} className="p-3.5 border border-precision bg-[#E2DCB9] flex flex-col gap-2">
                    <div className="flex items-center justify-between border-b border-precision pb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[12px] text-[#15150F]">{p.code} // {p.title}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9.5px] bg-[#15150F] text-[#C3E54E] px-1.5 py-0.5 font-bold">
                          {p.status}
                        </span>
                        <span className="text-[10px] text-[#5C5946] font-mono">{p.year}</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1 text-[11.5px] text-[#22211A] leading-snug">
                      <div>
                        <strong className="font-bold text-[10px] tracking-wide uppercase text-[#5C5946] block mb-0.5">
                          CHALLENGE //
                        </strong>
                        <span>{p.problem || p.summary}</span>
                      </div>
                      <div className="mt-1">
                        <strong className="font-bold text-[10px] tracking-wide uppercase text-[#5C5946] block mb-0.5">
                          ARCHITECTURE //
                        </strong>
                        <span>{p.solution || p.architectureNotes}</span>
                      </div>
                    </div>

                    {/* Verification / Metrics */}
                    {p.validationEvidence?.summary && (
                      <div className="text-[10px] text-[#5C5946] bg-[#DCD6B2]/60 p-1.5 border border-precision/30 font-mono">
                        <span className="font-bold text-[#15150F]">VERIFICATION: </span>
                        {p.validationEvidence.summary}
                      </div>
                    )}

                    {verifiedMetrics.length > 0 && (
                      <div className="flex flex-wrap gap-2 text-[10px] font-mono text-[#5C5946]">
                        {verifiedMetrics.slice(0, 2).map(m => (
                          <span key={m.label} className="bg-[#DCD6B2]/80 px-1.5 py-0.5 border border-precision/30">
                            {m.label}: <strong className="text-[#15150F]">{m.value}</strong>
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 mt-auto border-t border-precision/30">
                      <div className="flex flex-wrap gap-1">
                        {p.techStack.slice(0, 6).map(t => (
                          <span key={t} className="text-[9.5px] px-1 bg-[#D4CDA4] border border-precision/40">
                            {t}
                          </span>
                        ))}
                      </div>
                      {sanitizeHttpUrl(p.links?.github) && (
                        <a
                          href={sanitizeHttpUrl(p.links?.github)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-[#15150F] hover:text-[#2E6B3A] transition-colors"
                        >
                          <span>REPO</span>
                          <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-[#CBC59B] border-t border-precision flex items-center justify-between shrink-0 text-[10px] text-[#5C5946]">
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
