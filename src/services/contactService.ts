/**
 * SERVER-SIDE CONTACT DELIVERY CORE  (Node runtime only -- never import this
 * from browser code; the browser posts to the same-origin `/api/contact`
 * endpoint via `src/utils/contactDelivery.ts`).
 *
 * This is the transport-agnostic core behind the Vercel serverless function
 * `api/contact.ts` and the local Vite dev middleware -- the same architectural
 * split as `api/github-live.ts` / `src/services/githubLiveInventory.ts`. It:
 *
 *   1. Accepts ONLY same-origin `POST application/json` from the portfolio's
 *      own browser client (method / content-type / body-size / origin gates).
 *   2. Re-validates every field server-side with the SHARED `validateContactInput`
 *      rules -- the browser's validation is never trusted.
 *   3. Enforces the hidden `companyWebsite` honeypot; a populated honeypot is
 *      answered with a generic-looking success and Resend is never contacted.
 *   4. Delivers the message to the owner via the Resend REST API over a bounded
 *      HTTPS request, with the visitor's address in `reply_to` (never `from`).
 *
 * Secrets (`RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL`) are read
 * from server environment only. They are never returned to the browser, never
 * logged, and never bundled into client JavaScript. Provider error payloads are
 * never forwarded to the requester.
 *
 * There is deliberately NO in-memory rate limiter here: request-rate abuse is
 * handled at Vercel's edge (WAF). This core only needs to translate a browser
 * `429` into a clean client-visible outcome, which it does by never masking a
 * `429` (WAF answers before the function runs) and by keeping every response
 * `Cache-Control: no-store`.
 */

// Explicit `.js` specifiers on every LOCAL RUNTIME import: this module is part
// of the dependency graph Vercel emits for the `api/contact` serverless
// function, which runs under Node's native ESM loader (`"type": "module"`),
// with no `.js` extension inference. TypeScript / Vite / tsx still resolve
// these to the `.ts` sources.
import { validateContactInput, CONTACT_FIELD_LIMITS, type ContactInput } from '../utils/contactValidation.js';
import { sanitizeEmailAddress } from '../utils/urlSecurity.js';

/** Hard request-body ceiling enforced BEFORE JSON parsing. Legitimate submissions are a few KB at most. */
export const CONTACT_MAX_BODY_BYTES = 16 * 1024;

/** Bounded deadline for the outbound Resend API call. */
export const CONTACT_RESEND_TIMEOUT_MS = 9_000;

/** The immutable subject prefix applied to every delivered inquiry. */
export const CONTACT_SUBJECT_PREFIX = '[Portfolio] ';

/** The Resend transactional-email REST endpoint. */
export const RESEND_EMAILS_ENDPOINT = 'https://api.resend.com/emails';

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F]/;

export interface ContactServiceEnv {
  RESEND_API_KEY?: string;
  CONTACT_TO_EMAIL?: string;
  CONTACT_FROM_EMAIL?: string;
}

/** Lowercased request headers the core inspects. Adapters pass a bounded subset. */
export interface ContactRequestHeaders {
  'content-type'?: string;
  origin?: string;
  'sec-fetch-site'?: string;
  host?: string;
  'x-forwarded-host'?: string;
}

export interface HandleContactRequestOptions {
  method?: string;
  headers?: ContactRequestHeaders;
  /** UTF-8 request body already read within the size cap, or null when unreadable/empty. */
  rawBody?: string | null;
  /** True when the adapter's bounded read hit `CONTACT_MAX_BODY_BYTES`. */
  bodyTooLarge?: boolean;
  env?: ContactServiceEnv;
  /** Injectable transport for the Resend call (tests). */
  fetchImpl?: typeof fetch;
  /** Upstream abort signal (platform request cancellation). */
  signal?: AbortSignal;
  /** Resend call deadline override (tests). */
  timeoutMs?: number;
}

export interface ContactHttpResult {
  status: number;
  headers: Record<string, string>;
  body: { ok: true } | { ok: false; error: string };
}

const BASE_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex',
};

function result(
  status: number,
  body: ContactHttpResult['body'],
  extraHeaders: Record<string, string> = {},
): ContactHttpResult {
  return { status, headers: { ...BASE_HEADERS, ...extraHeaders }, body };
}

/** First value of a possibly comma-listed forwarded header. */
function firstHeaderValue(value?: string): string {
  return (value || '').split(',')[0].trim();
}

/**
 * Conservative same-origin gate. Rejects a request only when a browser-supplied
 * signal PROVES it is cross-site:
 *   - `Sec-Fetch-Site: cross-site`, or
 *   - an `Origin` whose host does not equal the request host.
 * A request with neither signal (non-browser client) is left for the edge / WAF
 * -- this gate never hard-codes a hostname, so preview and custom domains work.
 */
export function isDisallowedCrossSiteRequest(headers: ContactRequestHeaders): boolean {
  const secFetchSite = (headers['sec-fetch-site'] || '').trim().toLowerCase();
  if (secFetchSite === 'cross-site') return true;

  const origin = (headers.origin || '').trim();
  if (!origin) return false;

  const requestHost = firstHeaderValue(headers['x-forwarded-host'] || headers.host).toLowerCase();
  if (!requestHost) return true;

  let originHost = '';
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    return true; // opaque / "null" / malformed Origin
  }
  return originHost !== requestHost;
}

function isJsonContentType(contentType?: string): boolean {
  // Tolerate a `; charset=...` parameter; reject any other media type.
  return firstHeaderValue(contentType).split(';')[0].trim().toLowerCase() === 'application/json';
}

interface ResolvedConfig {
  apiKey: string;
  to: string;
  from: string;
}

/** Reads + shape-checks the server contact configuration. Returns null when unusable. */
function resolveContactConfig(env: ContactServiceEnv): ResolvedConfig | null {
  const apiKey = (env.RESEND_API_KEY || '').trim();
  const toRaw = (env.CONTACT_TO_EMAIL || '').trim();
  const from = (env.CONTACT_FROM_EMAIL || '').trim();

  if (!apiKey || !toRaw || !from) return null;
  const to = sanitizeEmailAddress(toRaw);
  if (!to) return null;
  // `from` may be a bare address or a `Display Name <addr>` header value; reject
  // only clearly hostile content (control chars) or an obvious non-address.
  if (CONTROL_CHARACTER_PATTERN.test(from) || !from.includes('@')) return null;

  return { apiKey, to, from };
}

function buildPlainTextEmail(value: Required<ContactInput>): string {
  return [
    'Portfolio contact inquiry',
    '',
    `Name: ${value.name}`,
    `Reply-To: ${value.email}`,
    `Subject: ${value.subject}`,
    '',
    'Message:',
    value.message,
  ].join('\n');
}

type ResendOutcome = 'ok' | 'provider-error' | 'timeout';

async function deliverViaResend(
  config: ResolvedConfig,
  value: Required<ContactInput>,
  options: HandleContactRequestOptions,
): Promise<ResendOutcome> {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const controller = new AbortController();
  const timeoutMs = Math.max(1, options.timeoutMs ?? CONTACT_RESEND_TIMEOUT_MS);
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const onUpstreamAbort = () => controller.abort();
  if (options.signal) {
    if (options.signal.aborted) controller.abort();
    else options.signal.addEventListener('abort', onUpstreamAbort, { once: true });
  }

  try {
    const response = await fetchImpl(RESEND_EMAILS_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: config.from,
        to: [config.to],
        reply_to: value.email,
        subject: `${CONTACT_SUBJECT_PREFIX}${value.subject}`,
        text: buildPlainTextEmail(value),
      }),
      signal: controller.signal,
    });
    // Never read or forward the provider response body.
    return response.status >= 200 && response.status < 300 ? 'ok' : 'provider-error';
  } catch {
    if (timedOut || controller.signal.aborted) return 'timeout';
    return 'provider-error';
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onUpstreamAbort);
  }
}

/**
 * Transport-agnostic contact request handler. Adapters (Vercel function, Vite
 * dev middleware) only translate their platform request/response to/from this.
 * Never throws.
 */
export async function handleContactRequest(
  options: HandleContactRequestOptions = {},
): Promise<ContactHttpResult> {
  const method = (options.method || 'GET').toUpperCase();
  const headers = options.headers || {};

  if (method !== 'POST') {
    return result(405, { ok: false, error: 'Method not allowed.' }, { Allow: 'POST' });
  }

  if (isDisallowedCrossSiteRequest(headers)) {
    return result(403, { ok: false, error: 'This endpoint only accepts submissions from the portfolio itself.' });
  }

  if (options.bodyTooLarge) {
    return result(413, { ok: false, error: 'The message is too large.' });
  }

  if (!isJsonContentType(headers['content-type'])) {
    return result(415, { ok: false, error: 'Send the submission as application/json.' });
  }

  const rawBody = options.rawBody;
  if (typeof rawBody !== 'string' || rawBody.length === 0) {
    return result(400, { ok: false, error: 'The submission could not be processed.' });
  }
  // Defensive char-length ceiling in case an adapter did not enforce bytes.
  if (rawBody.length > CONTACT_MAX_BODY_BYTES) {
    return result(413, { ok: false, error: 'The message is too large.' });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return result(400, { ok: false, error: 'The submission could not be processed.' });
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return result(400, { ok: false, error: 'The submission could not be processed.' });
  }
  const payload = parsed as Record<string, unknown>;
  const isString = (v: unknown): v is string => typeof v === 'string';
  if (!isString(payload.name) || !isString(payload.email) || !isString(payload.subject) || !isString(payload.message)) {
    return result(400, { ok: false, error: 'The submission could not be processed.' });
  }
  if (payload.companyWebsite !== undefined && !isString(payload.companyWebsite)) {
    return result(400, { ok: false, error: 'The submission could not be processed.' });
  }

  const validation = validateContactInput({
    name: payload.name,
    email: payload.email,
    subject: payload.subject,
    message: payload.message,
    companyWebsite: isString(payload.companyWebsite) ? payload.companyWebsite : '',
  });

  if (validation.valid === false) {
    // Honeypot: answer like an ordinary success and never contact Resend.
    if (validation.isBot) {
      return result(200, { ok: true });
    }
    return result(400, { ok: false, error: 'The submission could not be processed.' });
  }

  const config = resolveContactConfig(options.env || {});
  if (!config) {
    return result(503, { ok: false, error: 'Contact delivery is not configured on this deployment.' });
  }

  const outcome = await deliverViaResend(config, validation.value, options);
  if (outcome === 'ok') {
    return result(200, { ok: true });
  }
  if (outcome === 'timeout') {
    return result(503, { ok: false, error: 'The contact service did not respond in time. Please use the direct email option.' });
  }
  return result(502, { ok: false, error: 'The contact service is temporarily unavailable. Please use the direct email option.' });
}

/** Re-exported so adapters and tests share one authoritative field-limit source. */
export { CONTACT_FIELD_LIMITS };

/**
 * Minimal shape of a Node HTTP request needed to bound-read its body. Kept
 * structural (no `node:http` import) so this module stays transport-agnostic;
 * a real `IncomingMessage` satisfies it.
 */
export interface BoundedBodyRequest {
  headers: Record<string, string | string[] | undefined>;
  [Symbol.asyncIterator](): AsyncIterableIterator<Uint8Array | string>;
  destroy?: (error?: Error) => void;
}

/**
 * Reads a request body while enforcing a hard byte ceiling BEFORE anything
 * parses it. Rejects early on an over-limit `Content-Length`, and aborts the
 * stream the moment accumulated bytes exceed `maxBytes` -- an arbitrarily large
 * request is never buffered. Adapters (`api/contact.ts`, the Vite dev
 * middleware) call this and pass the result straight into `handleContactRequest`.
 */
export async function readBoundedRequestBody(
  req: BoundedBodyRequest,
  maxBytes: number = CONTACT_MAX_BODY_BYTES,
): Promise<{ body: string | null; tooLarge: boolean }> {
  const clHeader = req.headers['content-length'];
  const declared = Number(Array.isArray(clHeader) ? clHeader[0] : clHeader);
  if (Number.isFinite(declared) && declared > maxBytes) {
    return { body: null, tooLarge: true };
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for await (const chunk of req) {
      const bytes = typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk;
      total += bytes.byteLength;
      if (total > maxBytes) {
        try {
          req.destroy?.();
        } catch {
          /* stream already closed */
        }
        return { body: null, tooLarge: true };
      }
      chunks.push(bytes);
    }
  } catch {
    return { body: null, tooLarge: false };
  }

  if (chunks.length === 0) return { body: '', tooLarge: false };
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { body: new TextDecoder('utf-8').decode(merged), tooLarge: false };
}
