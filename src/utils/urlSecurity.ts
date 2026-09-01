/**
 * URL Security Utilities
 *
 * Provides strict protocol validation to prevent stored and DOM-based Cross-Site
 * Scripting (XSS) via javascript:, data:, vbscript:, or other non-HTTP schemes
 * returned from external APIs or local override configurations.
 */

/**
 * Validates that a URL string is well-formed and strictly uses either the 'http:' or 'https:' protocol.
 * Rejects javascript:, data:, file:, blob:, protocol-relative (//evil.com), and malformed strings.
 */
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F]/;
const EMAIL_PATTERN = /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i;

export const MAX_PUBLIC_EMAIL_LENGTH = 254;

export function sanitizeHttpUrl(urlString?: string | null): string | undefined {
  if (!urlString || typeof urlString !== 'string') {
    return undefined;
  }

  const trimmed = urlString.trim();
  if (!trimmed || CONTROL_CHARACTER_PATTERN.test(trimmed)) {
    return undefined;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return undefined;
    }
    if (!parsed.hostname || parsed.hostname.trim().length === 0) {
      return undefined;
    }
    if (parsed.username || parsed.password) {
      return undefined;
    }
    return trimmed;
  } catch {
    return undefined;
  }
}

/**
 * Reports whether a value is a safe public HTTP(S) navigation target.
 */
export function isSafeHttpUrl(urlString?: string | null): boolean {
  return sanitizeHttpUrl(urlString) !== undefined;
}

/** Accepts one mailbox only; header/query injection syntax is rejected. */
export function sanitizeEmailAddress(email?: string | null): string | undefined {
  if (!email || typeof email !== 'string') return undefined;
  const trimmed = email.trim();
  if (
    !trimmed
    || trimmed.length > MAX_PUBLIC_EMAIL_LENGTH
    || CONTROL_CHARACTER_PATTERN.test(trimmed)
    || !EMAIL_PATTERN.test(trimmed)
  ) {
    return undefined;
  }

  const [localPart] = trimmed.split('@');
  if (!localPart || localPart.length > 64) return undefined;
  return trimmed;
}

export function buildMailtoUrl(
  email?: string | null,
  fields: { subject?: string; body?: string } = {}
): string | undefined {
  const safeEmail = sanitizeEmailAddress(email);
  if (!safeEmail) return undefined;

  const query: string[] = [];
  if (fields.subject) query.push(`subject=${encodeURIComponent(fields.subject)}`);
  if (fields.body) query.push(`body=${encodeURIComponent(fields.body)}`);
  return `mailto:${safeEmail}${query.length > 0 ? `?${query.join('&')}` : ''}`;
}
