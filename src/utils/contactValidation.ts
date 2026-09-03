// Explicit `.js` specifier: this module is part of the runtime dependency
// graph of the `api/contact.ts` Vercel function (via `contactService.ts`),
// which runs under Node's native ESM loader with no extension inference.
import { sanitizeEmailAddress } from './urlSecurity.js';

export const CONTACT_FIELD_LIMITS = {
  name: 100,
  email: 254,
  subject: 160,
  message: 5000
} as const;

/**
 * Characters that must never appear in a header-adjacent value (name, subject).
 * Rejecting CR / LF / NUL / other C0 controls + DEL keeps hostile
 * header-injection payloads ("Foo\nBcc: attacker@x") from ever reaching the
 * mail provider. The message body itself is NOT subject to this -- it may
 * legitimately contain newlines.
 */
const HEADER_UNSAFE_CHARACTER_PATTERN = /[\u0000-\u001F\u007F]/;

export interface ContactInput {
  name: string;
  email: string;
  subject: string;
  message: string;
  companyWebsite?: string;
}

export type ContactValidationResult =
  | { valid: true; value: Required<ContactInput> }
  | { valid: false; error: string; isBot?: boolean };

export function validateContactInput(input: ContactInput): ContactValidationResult {
  const value: Required<ContactInput> = {
    name: String(input.name || '').trim(),
    email: String(input.email || '').trim(),
    subject: String(input.subject || '').trim(),
    message: String(input.message || '').trim(),
    companyWebsite: String(input.companyWebsite || '').trim()
  };

  if (value.companyWebsite) return { valid: false, error: 'Submission rejected.', isBot: true };
  if (!value.name || !value.email || !value.subject || !value.message) {
    return { valid: false, error: 'Complete every required field before sending.' };
  }
  if (value.name.length > CONTACT_FIELD_LIMITS.name) {
    return { valid: false, error: `Name must be ${CONTACT_FIELD_LIMITS.name} characters or fewer.` };
  }
  if (HEADER_UNSAFE_CHARACTER_PATTERN.test(value.name)) {
    return { valid: false, error: 'Name contains invalid characters.' };
  }
  if (value.email.length > CONTACT_FIELD_LIMITS.email || !sanitizeEmailAddress(value.email)) {
    return { valid: false, error: 'Enter a valid reply email address.' };
  }
  if (value.subject.length > CONTACT_FIELD_LIMITS.subject) {
    return { valid: false, error: `Subject must be ${CONTACT_FIELD_LIMITS.subject} characters or fewer.` };
  }
  if (HEADER_UNSAFE_CHARACTER_PATTERN.test(value.subject)) {
    return { valid: false, error: 'Subject contains invalid characters.' };
  }
  if (value.message.length > CONTACT_FIELD_LIMITS.message) {
    return { valid: false, error: `Message must be ${CONTACT_FIELD_LIMITS.message} characters or fewer.` };
  }

  return { valid: true, value };
}
