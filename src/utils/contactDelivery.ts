import type { ContactInput } from './contactValidation';
import { buildMailtoUrl, sanitizeHttpUrl } from './urlSecurity';

export const DEFAULT_CONTACT_REQUEST_TIMEOUT_MS = 15_000;

/**
 * The one trusted same-origin relative path for the built-in first-party
 * contact function (`api/contact.ts`). `sanitizeContactEndpoint` accepts this
 * EXACT string in addition to safe absolute HTTPS endpoints -- it does not
 * open the door to arbitrary relative URLs.
 */
export const BUILTIN_CONTACT_ENDPOINT_PATH = '/api/contact';

export interface ContactSubmissionLock {
  inFlight: boolean;
}

export type ContactDeliveryResult =
  | { outcome: 'delivered' }
  | { outcome: 'mail-client-opened'; mailtoUrl: string }
  | { outcome: 'duplicate' };

export class ContactDeliveryError extends Error {
  constructor(
    public readonly reason: 'invalid-owner-email' | 'timeout' | 'request-failed' | 'rate-limited',
    message: string
  ) {
    super(message);
    this.name = 'ContactDeliveryError';
  }
}

interface ContactDeliveryOptions {
  input: Required<ContactInput>;
  ownerEmail?: string;
  formEndpoint?: string;
  lock: ContactSubmissionLock;
  fetchImpl?: typeof fetch;
  openMailClient: (mailtoUrl: string) => void;
  timeoutMs?: number;
}

export function sanitizeContactEndpoint(endpoint?: string | null): string | undefined {
  // The built-in first-party endpoint is the ONE trusted relative path.
  if (typeof endpoint === 'string' && endpoint.trim() === BUILTIN_CONTACT_ENDPOINT_PATH) {
    return BUILTIN_CONTACT_ENDPOINT_PATH;
  }
  // Everything else must still be a safe absolute HTTPS URL (template / fork
  // compatibility with hosted form providers). Arbitrary relative paths,
  // protocol-relative URLs, and non-HTTP schemes stay rejected.
  const safeEndpoint = sanitizeHttpUrl(endpoint);
  return safeEndpoint && new URL(safeEndpoint).protocol === 'https:' ? safeEndpoint : undefined;
}

/** True only for the built-in first-party `/api/contact` endpoint. */
export function isBuiltInContactEndpoint(endpoint?: string | null): boolean {
  return sanitizeContactEndpoint(endpoint) === BUILTIN_CONTACT_ENDPOINT_PATH;
}

function createOutboundFormData(input: Required<ContactInput>): FormData {
  const data = new FormData();
  data.set('name', input.name);
  data.set('email', input.email);
  data.set('subject', input.subject);
  data.set('message', input.message);
  return data;
}

/** JSON body for the built-in `/api/contact` endpoint (honeypot field always included, normally empty). */
function createBuiltInContactBody(input: Required<ContactInput>): string {
  return JSON.stringify({
    name: input.name,
    email: input.email,
    subject: input.subject,
    message: input.message,
    companyWebsite: input.companyWebsite,
  });
}

/** Delivers one validated contact request while keeping retry and duplicate behavior deterministic. */
export async function deliverContact(options: ContactDeliveryOptions): Promise<ContactDeliveryResult> {
  if (options.lock.inFlight) return { outcome: 'duplicate' };
  options.lock.inFlight = true;

  try {
    const safeEndpoint = sanitizeContactEndpoint(options.formEndpoint);
    if (!safeEndpoint) {
      const body = [
        `Name: ${options.input.name}`,
        `Reply-to: ${options.input.email}`,
        '',
        options.input.message
      ].join('\n');
      const mailtoUrl = buildMailtoUrl(options.ownerEmail, {
        subject: options.input.subject,
        body
      });
      if (!mailtoUrl) {
        throw new ContactDeliveryError(
          'invalid-owner-email',
          'The configured contact email is invalid.'
        );
      }

      options.openMailClient(mailtoUrl);
      // Hold the lock through the current microtask so duplicate same-tick
      // submissions are ignored, then release it for a deliberate retry.
      await Promise.resolve();
      return { outcome: 'mail-client-opened', mailtoUrl };
    }

    const controller = new AbortController();
    const timeoutMs = Math.max(1, options.timeoutMs ?? DEFAULT_CONTACT_REQUEST_TIMEOUT_MS);
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    try {
      const isBuiltIn = safeEndpoint === BUILTIN_CONTACT_ENDPOINT_PATH;
      const response = await (options.fetchImpl || globalThis.fetch)(safeEndpoint, {
        method: 'POST',
        headers: isBuiltIn
          ? { Accept: 'application/json', 'Content-Type': 'application/json' }
          : { Accept: 'application/json' },
        body: isBuiltIn
          ? createBuiltInContactBody(options.input)
          : createOutboundFormData(options.input),
        signal: controller.signal
      });
      if (response.status === 429) {
        throw new ContactDeliveryError(
          'rate-limited',
          'Too many contact attempts. Please wait a few minutes or use the direct email option.'
        );
      }
      if (!response.ok) {
        throw new ContactDeliveryError(
          'request-failed',
          `Contact endpoint returned ${response.status}.`
        );
      }
      return { outcome: 'delivered' };
    } catch (error) {
      if (error instanceof ContactDeliveryError) throw error;
      if (timedOut || controller.signal.aborted) {
        throw new ContactDeliveryError('timeout', 'The contact request timed out.');
      }
      throw new ContactDeliveryError('request-failed', 'The contact request failed.');
    } finally {
      clearTimeout(timeout);
    }
  } finally {
    options.lock.inFlight = false;
  }
}
