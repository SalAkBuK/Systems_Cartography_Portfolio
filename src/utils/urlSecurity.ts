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
export function isSafeHttpUrl(urlString?: string | null): boolean {
  if (!urlString || typeof urlString !== 'string') {
    return false;
  }

  const trimmed = urlString.trim();
  if (!trimmed) {
    return false;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    if (!parsed.hostname || parsed.hostname.trim().length === 0) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns trimmed URL if it safely adheres to http: or https: schemes, otherwise returns undefined.
 */
export function sanitizeHttpUrl(urlString?: string | null): string | undefined {
  if (isSafeHttpUrl(urlString)) {
    return urlString!.trim();
  }
  return undefined;
}
