/**
 * VERCEL SERVERLESS FUNCTION  ->  POST /api/contact
 *
 * First-party contact-form delivery for the portfolio's own browser client.
 * The heavy lifting (method / origin / body-size / content-type gates, shared
 * server-side field validation, honeypot enforcement, and the bounded Resend
 * REST call) lives in the transport-agnostic core
 * `src/services/contactService.ts` -- this file is only the Vercel adapter,
 * mirroring `api/github-live.ts` / `src/services/githubLiveInventory.ts`.
 *
 * Deployment: no configuration on Vercel. With the Vite framework preset any
 * `api/*.ts` file is built and served as a Node serverless function. On hosts
 * without serverless functions the route 404s and the contact form falls back
 * to the visitor's own mail client (the documented default).
 *
 * Local development: `vite dev` does not execute this file. `vite.config.ts`
 * registers a dev-only middleware that serves the SAME `handleContactRequest`
 * core at `/api/contact`.
 *
 * Secrets: `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, and `CONTACT_FROM_EMAIL` are
 * Vercel server environment variables. They are never in a `VITE_*` variable,
 * never serialized into any response, and never logged.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
// Explicit `.js` specifier: Vercel transpiles this file to `api/contact.js`
// and runs it under Node's native ESM loader (`"type": "module"`), which does
// NOT infer `.js` for relative specifiers. TypeScript / Vite / tsx still
// resolve this to the `.ts` source.
import {
  handleContactRequest,
  readBoundedRequestBody,
  CONTACT_MAX_BODY_BYTES,
  CONTACT_RESEND_TIMEOUT_MS,
} from '../src/services/contactService.js';

function headerString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const controller = new AbortController();
  // A little beyond the core's own Resend deadline so the core returns a
  // structured generic failure rather than being hard-aborted first.
  const timeout = setTimeout(() => controller.abort(), CONTACT_RESEND_TIMEOUT_MS + 1_500);
  const onClose = () => controller.abort();
  req.on('close', onClose);

  try {
    const { body, tooLarge } = await readBoundedRequestBody(req, CONTACT_MAX_BODY_BYTES);

    const result = await handleContactRequest({
      method: req.method,
      headers: {
        'content-type': headerString(req.headers['content-type']),
        origin: headerString(req.headers.origin),
        'sec-fetch-site': headerString(req.headers['sec-fetch-site']),
        host: headerString(req.headers.host),
        'x-forwarded-host': headerString(req.headers['x-forwarded-host']),
      },
      rawBody: body,
      bodyTooLarge: tooLarge,
      env: process.env,
      signal: controller.signal,
    });

    res.statusCode = result.status;
    for (const [key, value] of Object.entries(result.headers)) {
      res.setHeader(key, value);
    }
    res.end(JSON.stringify(result.body));
  } catch {
    // The core is designed not to throw; this is a last-resort guard. Nothing
    // about the error is logged or returned -- it could reference configuration.
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Robots-Tag', 'noindex');
    }
    res.end(JSON.stringify({ ok: false, error: 'The contact service encountered an unexpected error.' }));
  } finally {
    clearTimeout(timeout);
    req.off('close', onClose);
  }
}
