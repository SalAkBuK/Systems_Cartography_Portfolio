import React, { useRef, useState } from 'react';
import { Check, Copy, ExternalLink, Github, Linkedin, Mail, Send } from 'lucide-react';
import { OperatorMetadata } from '../types';
import { buildMailtoUrl, isSafeHttpUrl, sanitizeEmailAddress } from '../utils/urlSecurity';
import { CONTACT_FIELD_LIMITS, validateContactInput } from '../utils/contactValidation';
import { ContactDeliveryError, deliverContact, sanitizeContactEndpoint, type ContactSubmissionLock } from '../utils/contactDelivery';

interface ContactPageProps {
  operator: OperatorMetadata;
  formEndpoint: string;
}

type SubmissionState = 'idle' | 'sending' | 'sent' | 'error';

export const ContactPage: React.FC<ContactPageProps> = ({ operator, formEndpoint }) => {
  const [copied, setCopied] = useState(false);
  const [submissionState, setSubmissionState] = useState<SubmissionState>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const submissionLockRef = useRef<ContactSubmissionLock>({ inFlight: false });
  const safeOwnerEmail = sanitizeEmailAddress(operator.contact.email);
  const directMailtoUrl = buildMailtoUrl(safeOwnerEmail);
  const safeFormEndpoint = sanitizeContactEndpoint(formEndpoint);

  const copyEmail = async () => {
    if (!safeOwnerEmail) return;
    try {
      await navigator.clipboard.writeText(safeOwnerEmail);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setSubmissionState('error');
      setStatusMessage('Clipboard access was unavailable. Select and copy the published address instead.');
    }
  };

  const submitContact = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const validation = validateContactInput({
      name: String(data.get('name') || ''),
      email: String(data.get('email') || ''),
      subject: String(data.get('subject') || ''),
      message: String(data.get('message') || ''),
      companyWebsite: String(data.get('company_website') || '')
    });

    if (validation.valid === false) {
      if (validation.isBot) return;
      setSubmissionState('error');
      setStatusMessage(validation.error);
      return;
    }
    if (submissionLockRef.current.inFlight) return;
    if (safeFormEndpoint) setSubmissionState('sending');
    setStatusMessage('');
    try {
      const result = await deliverContact({
        input: validation.value,
        ownerEmail: safeOwnerEmail,
        formEndpoint,
        lock: submissionLockRef.current,
        openMailClient: mailtoUrl => {
          window.location.href = mailtoUrl;
        }
      });
      if (result.outcome === 'duplicate') return;
      if (result.outcome === 'delivered') {
        form.reset();
        setStatusMessage('Message delivered. Thank you for reaching out.');
      } else {
        setStatusMessage('Your default email application was opened. You may submit again if needed.');
      }
      setSubmissionState('sent');
    } catch (error) {
      setSubmissionState('error');
      if (error instanceof ContactDeliveryError && error.reason === 'invalid-owner-email') {
        setStatusMessage('The configured contact email is invalid. Use another published contact channel.');
      } else if (error instanceof ContactDeliveryError && error.reason === 'timeout') {
        setStatusMessage('The contact service timed out. Try again or use the direct email option.');
      } else {
        setStatusMessage('The form could not deliver this message. Use the direct email option instead.');
      }
    }
  };

  return (
    <section className="flex-1 overflow-y-auto p-4 sm:p-7 lg:p-10 select-text" aria-labelledby="contact-heading">
      <div className="max-w-5xl mx-auto border-2 border-[#15150F] bg-[#D4CDA4] shadow-[8px_8px_0px_#15150F]">
        <header className="bg-[#15150F] text-[#D4CDA4] p-5 sm:p-7 border-b-2 border-[#15150F]">
          <div className="text-[10px] text-[#C3E54E] font-bold tracking-[0.25em] mb-2">EXTERNAL INTERFACE // 06</div>
          <h1 id="contact-heading" className="text-2xl sm:text-4xl font-bold tracking-tight">CONTACT {operator.name.toUpperCase()}</h1>
          <p className="mt-3 max-w-2xl text-[11px] sm:text-sm text-[#CBC59B] leading-relaxed">
            For engineering roles, product collaborations, or questions about a public repository, send a concise message with the relevant context.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[0.8fr_1.2fr]">
          <aside className="p-5 sm:p-7 border-b-2 lg:border-b-0 lg:border-r-2 border-[#15150F] bg-[#CBC59B]/45">
            <div className="text-[11px] font-bold tracking-[0.2em] text-[#5C5946] mb-4">VERIFIED CHANNELS</div>
            <div className="space-y-3">
              <div className="border border-[#15150F] bg-[#E2DCB9] p-3">
                <div className="text-[11px] font-bold text-[#5C5946] mb-1">DIRECT EMAIL</div>
                <div className="flex items-center justify-between gap-3">
                  {directMailtoUrl && safeOwnerEmail ? (
                    <a className="font-bold text-[10px] sm:text-xs break-all hover:underline" href={directMailtoUrl}>
                      {safeOwnerEmail}
                    </a>
                  ) : (
                    <span className="font-bold text-[10px] sm:text-xs">UNAVAILABLE</span>
                  )}
                  <button disabled={!safeOwnerEmail} type="button" onClick={copyEmail} className="shrink-0 p-2 bg-[#15150F] text-[#D4CDA4] hover:bg-[#C3E54E] hover:text-[#15150F] disabled:opacity-40" aria-label="Copy email address">
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                </div>
              </div>

              {operator.contact.github && isSafeHttpUrl(operator.contact.github) && (
                <a href={operator.contact.github} target="_blank" rel="noopener noreferrer" className="border border-[#15150F] bg-[#E2DCB9] p-3 flex items-center justify-between hover:bg-[#15150F] hover:text-[#D4CDA4] group">
                  <span className="flex items-center gap-2 font-bold text-[10px]"><Github size={14} /> GITHUB</span>
                  <ExternalLink size={13} />
                </a>
              )}

              {operator.contact.linkedin && isSafeHttpUrl(operator.contact.linkedin) && (
                <a href={operator.contact.linkedin} target="_blank" rel="noopener noreferrer" className="border border-[#15150F] bg-[#E2DCB9] p-3 flex items-center justify-between hover:bg-[#15150F] hover:text-[#D4CDA4]">
                  <span className="flex items-center gap-2 font-bold text-[10px]"><Linkedin size={14} /> LINKEDIN</span>
                  <ExternalLink size={13} />
                </a>
              )}
            </div>

            <dl className="mt-6 border-t border-[#15150F] pt-4 text-[11px] space-y-3">
              <div><dt className="font-bold text-[#5C5946]">LOCATION</dt><dd>{operator.location}</dd></div>
              <div><dt className="font-bold text-[#5C5946]">AVAILABILITY</dt><dd>{operator.contact.availability}</dd></div>
              <div><dt className="font-bold text-[#5C5946]">RESPONSE CHANNEL</dt><dd>Email</dd></div>
            </dl>
          </aside>

          <form onSubmit={submitContact} className="p-5 sm:p-7 space-y-4" aria-describedby="contact-status">
            <div className="text-[11px] font-bold tracking-[0.2em] text-[#5C5946]">SEND AN INQUIRY</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="text-[11px] font-bold">NAME
                <input required maxLength={CONTACT_FIELD_LIMITS.name} name="name" autoComplete="name" className="mt-1.5 w-full p-3 bg-[#E2DCB9] border-2 border-[#15150F] text-[11px] focus:outline-none focus:bg-[#EFEAD0]" />
              </label>
              <label className="text-[11px] font-bold">REPLY EMAIL
                <input required maxLength={CONTACT_FIELD_LIMITS.email} name="email" type="email" autoComplete="email" className="mt-1.5 w-full p-3 bg-[#E2DCB9] border-2 border-[#15150F] text-[11px] focus:outline-none focus:bg-[#EFEAD0]" />
              </label>
            </div>
            <label className="block text-[11px] font-bold">SUBJECT
              <input required maxLength={CONTACT_FIELD_LIMITS.subject} name="subject" className="mt-1.5 w-full p-3 bg-[#E2DCB9] border-2 border-[#15150F] text-[11px] focus:outline-none focus:bg-[#EFEAD0]" />
            </label>
            <label className="block text-[11px] font-bold">MESSAGE
              <textarea required maxLength={CONTACT_FIELD_LIMITS.message} name="message" rows={7} className="mt-1.5 w-full p-3 bg-[#E2DCB9] border-2 border-[#15150F] text-[11px] focus:outline-none focus:bg-[#EFEAD0] resize-y" />
            </label>
            <label className="absolute -left-[10000px]" aria-hidden="true">Company website
              <input name="company_website" tabIndex={-1} autoComplete="off" />
            </label>

            <button disabled={submissionState === 'sending'} type="submit" className="w-full p-3 bg-[#C3E54E] border-2 border-[#15150F] font-bold text-[10px] tracking-[0.18em] hover:bg-[#15150F] hover:text-[#C3E54E] disabled:opacity-60 flex items-center justify-center gap-2">
              <Send size={14} /> {submissionState === 'sending' ? 'SENDING…' : safeFormEndpoint ? 'SEND MESSAGE' : 'OPEN EMAIL CLIENT'}
            </button>

            <div id="contact-status" role="status" className={`min-h-5 text-[11px] font-bold ${submissionState === 'error' ? 'text-[#7A3E2E]' : 'text-[#2E6B3A]'}`}>
              {statusMessage}
            </div>
            <p className="text-[10px] text-[#5C5946] leading-relaxed flex items-start gap-1.5">
              <Mail size={11} className="shrink-0 mt-0.5" />
              {safeFormEndpoint ? 'This form sends through the configured deployment endpoint.' : 'No valid form endpoint is configured, so submission opens your email application. No message is stored by this site.'}
            </p>
          </form>
        </div>
      </div>
    </section>
  );
};
