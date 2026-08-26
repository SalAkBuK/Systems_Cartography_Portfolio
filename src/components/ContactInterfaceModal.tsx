import React, { useState } from 'react';
import { 
  X, 
  Mail, 
  Github, 
  Linkedin, 
  Key, 
  Copy, 
  Check, 
  Send, 
  Terminal, 
  Radio,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import { OperatorMetadata } from '../types';
import { VERIFIED_OPERATOR_METADATA as OPERATOR_METADATA } from '../data/verifiedPortfolioData';

interface ContactInterfaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  operator?: OperatorMetadata;
}

export const ContactInterfaceModal: React.FC<ContactInterfaceModalProps> = ({
  isOpen,
  onClose,
  operator = OPERATOR_METADATA
}) => {
  const [copiedPgp, setCopiedPgp] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [dispatchStatus, setDispatchStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopyPgp = () => {
    navigator.clipboard.writeText(operator.contact.pgpFingerprint);
    setCopiedPgp(true);
    setTimeout(() => setCopiedPgp(false), 2000);
  };

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(operator.contact.email);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  const handleDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    const mailtoUrl = `mailto:${operator.contact.email}?subject=${encodeURIComponent(
      `[SYSTEM INQUIRY] ${subject || 'Engineering Connection'}`
    )}&body=${encodeURIComponent(
      `OPERATOR: ${senderName || 'Anonymous'}\nREPLY_TO: ${senderEmail || 'N/A'}\n\nTRANSMISSION:\n${message}`
    )}`;

    window.location.href = mailtoUrl;
    setDispatchStatus('TRANSMISSION_DISPATCHED_TO_DEFAULT_CLIENT');
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#15150F]/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto select-none">
      <div 
        className="relative w-full max-w-2xl bg-[#D4CDA4] border-2 border-precision text-[#15150F] flex flex-col shadow-[8px_8px_0px_#15150F] font-mono text-[11px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-3 bg-[#CBC59B] border-b border-precision flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Radio size={13} className="text-[#15150F] animate-pulse" />
            <span className="font-bold text-[12px] tracking-wider uppercase">
              EXTERNAL INTERFACE // OPERATOR DISPATCHER
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 bg-[#15150F] text-[#D4CDA4] hover:bg-[#C3E54E] hover:text-[#15150F] flex items-center justify-center transition-colors border border-precision"
            title="Close (Esc)"
          >
            <X size={14} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 flex flex-col gap-5 leading-relaxed overflow-y-auto max-h-[80vh]">
          {/* Status banner */}
          <div className="p-3 border border-precision bg-[#E2DCB9] flex items-center justify-between">
            <div>
              <span className="text-[8.5px] uppercase font-bold text-[#5C5946] block">CONNECTION STATUS // {operator.name.toUpperCase()}</span>
              <span className="text-[12px] font-bold text-[#15150F]">{operator.status}</span>
            </div>
            <span className="text-[8px] px-2 py-1 bg-[#15150F] text-[#C3E54E] font-bold">
              OPEN FOR DIRECT CHAT
            </span>
          </div>

          {/* Primary Verified Channels */}
          <div>
            <div className="text-[9px] font-bold text-[#5C5946] uppercase tracking-wider mb-2">
              01 // VERIFIED CHANNELS
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Email */}
              <div className="p-2.5 border border-precision bg-[#DCD6B2]/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail size={13} className="text-[#15150F]" />
                  <div>
                    <div className="text-[8px] text-[#5C5946]">DIRECT EMAIL</div>
                    <div className="font-bold text-[9.5px] truncate max-w-[160px]">
                      {operator.contact.email}
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleCopyEmail}
                  className="px-2 py-1 bg-[#15150F] text-[#D4CDA4] text-[8.5px] font-bold hover:bg-[#C3E54E] hover:text-[#15150F] transition-colors"
                >
                  {copiedEmail ? <Check size={11} /> : <Copy size={11} />}
                </button>
              </div>

              {/* GitHub */}
              <a
                href={operator.contact.github}
                target="_blank"
                rel="noreferrer"
                className="p-2.5 border border-precision bg-[#DCD6B2]/60 flex items-center justify-between hover:bg-[#15150F] hover:text-[#D4CDA4] transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <Github size={13} />
                  <div>
                    <div className="text-[8px] text-[#5C5946] group-hover:text-[#C3E54E]">SOURCE REPOSITORY</div>
                    <div className="font-bold text-[9.5px] truncate max-w-[160px]">{operator.contact.github.replace(/^https?:\/\//, '')}</div>
                  </div>
                </div>
                <ExternalLink size={12} className="text-[#5C5946] group-hover:text-[#D4CDA4]" />
              </a>

              {/* LinkedIn */}
              {operator.contact.linkedin && <a
                href={operator.contact.linkedin}
                target="_blank"
                rel="noreferrer"
                className="p-2.5 border border-precision bg-[#DCD6B2]/60 flex items-center justify-between hover:bg-[#15150F] hover:text-[#D4CDA4] transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <Linkedin size={13} />
                  <div>
                    <div className="text-[8px] text-[#5C5946] group-hover:text-[#C3E54E]">PROFESSIONAL NETWORK</div>
                    <div className="font-bold text-[9.5px] truncate max-w-[160px]">{operator.contact.linkedin.replace(/^https?:\/\//, '')}</div>
                  </div>
                </div>
                <ExternalLink size={12} className="text-[#5C5946] group-hover:text-[#D4CDA4]" />
              </a>}

              {/* Matrix */}
              {operator.contact.matrix && <div className="p-2.5 border border-precision bg-[#DCD6B2]/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={13} />
                  <div>
                    <div className="text-[8px] text-[#5C5946]">MATRIX DECENTRALIZED</div>
                    <div className="font-bold text-[9.5px] truncate max-w-[160px]">{operator.contact.matrix}</div>
                  </div>
                </div>
              </div>}
            </div>
          </div>

          {/* PGP Key Fingerprint */}
          {operator.contact.pgpFingerprint && <div className="p-3 border border-precision bg-[#E2DCB9]/80 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[9px] font-bold text-[#5C5946] uppercase">
                <Key size={12} />
                <span>PGP SIGNATURE // KEY_ID: {operator.contact.pgpKeyId}</span>
              </div>
              <button
                onClick={handleCopyPgp}
                className="flex items-center gap-1 px-2 py-0.5 bg-[#15150F] text-[#D4CDA4] text-[8.5px] font-bold hover:bg-[#C3E54E] hover:text-[#15150F] transition-colors"
              >
                {copiedPgp ? <Check size={10} /> : <Copy size={10} />}
                <span>{copiedPgp ? 'COPIED' : 'COPY FINGERPRINT'}</span>
              </button>
            </div>
            <code className="text-[8.5px] bg-[#15150F] text-[#D4CDA4] p-1.5 border border-precision overflow-x-auto">
              {operator.contact.pgpFingerprint}
            </code>
          </div>}

          {/* Direct Terminal Dispatcher Form */}
          <form onSubmit={handleDispatch} className="flex flex-col gap-2.5">
            <div className="text-[9px] font-bold text-[#5C5946] uppercase tracking-wider">
              02 // DISPATCH INQUIRY PACKET
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-[8px] uppercase font-bold text-[#5C5946]">SENDER / ORG</label>
                <input
                  type="text"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="e.g. Engineering Lead @ Company"
                  className="p-1.5 bg-[#E2DCB9] border border-precision text-[10px] focus:outline-none focus:bg-[#EFEAD0]"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[8px] uppercase font-bold text-[#5C5946]">REPLY-TO EMAIL</label>
                <input
                  type="email"
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                  placeholder="name@organization.com"
                  className="p-1.5 bg-[#E2DCB9] border border-precision text-[10px] focus:outline-none focus:bg-[#EFEAD0]"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[8px] uppercase font-bold text-[#5C5946]">SUBJECT // SYSTEM TOPIC</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Systems Architecture / Engineering Collaboration"
                className="p-1.5 bg-[#E2DCB9] border border-precision text-[10px] focus:outline-none focus:bg-[#EFEAD0]"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[8px] uppercase font-bold text-[#5C5946]">MESSAGE PAYLOAD</label>
              <textarea
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe your technical requirements, team topology, or project scope..."
                className="p-2 bg-[#E2DCB9] border border-precision text-[10px] focus:outline-none focus:bg-[#EFEAD0] resize-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-[#C3E54E] text-[#15150F] font-bold text-[10px] uppercase tracking-widest border border-precision hover:bg-[#B2D63B] transition-colors flex items-center justify-center gap-1.5 mt-1 cursor-pointer"
            >
              <Send size={12} />
              <span>DISPATCH TO DEFAULT MAIL CLIENT</span>
            </button>

            {dispatchStatus && (
              <div className="text-[8.5px] text-[#2E6B3A] font-bold text-center">
                ● {dispatchStatus}
              </div>
            )}
          </form>
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-[#CBC59B] border-t border-precision flex items-center justify-between shrink-0 text-[9px] text-[#5C5946]">
          <span>LOCATION: {operator.location}</span>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-[#D4CDA4] text-[#15150F] hover:bg-[#15150F] hover:text-[#D4CDA4] transition-colors border border-precision font-bold cursor-pointer"
          >
            CLOSE [ESC]
          </button>
        </div>
      </div>
    </div>
  );
};
