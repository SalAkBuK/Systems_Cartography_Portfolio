import type { ContactInput } from './contactValidation';
import { buildMailtoUrl, sanitizeHttpUrl } from './urlSecurity';

export const DEFAULT_CONTACT_REQUEST_TIMEOUT_MS = 15_000;

export interface ContactSubmissionLock {
  inFlight: boolean;
}

export type ContactDeliveryResult =
  | { outcome: 'delivered' }
  | { outcome: 'mail-client-opened'; mailtoUrl: string }
  | { outcome: 'duplicate' };

export class ContactDeliveryError extends Error {
  constructor(
    public readonly reason: 'invalid-owner-email' | 'timeout' | 'request-failed',
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
  const safeEndpoint = sanitizeHttpUrl(endpoint);
  return safeEndpoint && new URL(safeEndpoint).protocol === 'https:' ? safeEndpoint : undefined;
}

function createOutboundFormData(input: Required<ContactInput>): FormData {
  const data = new FormData();
  data.set('name', input.name);
  data.set('email', input.email);
  data.set('subject', input.subject);
  data.set('message', input.message);
  return data;
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
      const response = await (options.fetchImpl || globalThis.fetch)(safeEndpoint, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: createOutboundFormData(options.input),
        signal: controller.signal
      });
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
