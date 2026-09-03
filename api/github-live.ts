/**
 * VERCEL SERVERLESS FUNCTION  ->  GET /api/github-live
 *
 * Same-origin endpoint the deployed portfolio calls at runtime to reflect the
 * CURRENT public repository inventory of its configured GitHub owner. The
 * browser never calls GitHub directly and never supplies the owner -- the owner
 * is resolved server-side from committed owner configuration
 * (`src/services/githubLiveInventory.ts` -> `resolveConfiguredOwner`).
 *
 * Deployment: this file requires no configuration on Vercel. With the Vite
 * framework preset, any `api/*.ts` file is automatically built and served as a
 * Node serverless function; the rest of the site is the static `dist/` output.
 * `vercel.json` only defines security headers (which also apply here, harmless
 * for a JSON response). On hosts without serverless functions the route simply
 * 404s and the portfolio renders the committed snapshot -- the documented
 * fallback.
 *
 * Local development: `vite dev` does not execute this file. `vite.config.ts`
 * registers a dev-only middleware that serves the SAME
 * `handleLiveGitHubRequest` core at `/api/github-live`, so `npm run dev` keeps
 * working and the endpoint is testable locally.
 *
 * Credentials: a server-side `GITHUB_TOKEN` (or `GH_TOKEN`) Vercel environment
 * variable is used when present. It is never placed in a `VITE_*` variable,
 * never serialized into any response, and never logged.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  handleLiveGitHubRequest,
  LIVE_TOTAL_BUDGET_MS,
} from '../src/services/githubLiveInventory';

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const controller = new AbortController();
  // A little beyond the core's own whole-operation budget, so the core returns
  // a structured `timeout` payload rather than being hard-aborted first.
  const timeout = setTimeout(() => controller.abort(), LIVE_TOTAL_BUDGET_MS + 1_500);
  const onClose = () => controller.abort();
  req.on('close', onClose);

  try {
    const result = await handleLiveGitHubRequest({
      method: req.method,
      env: process.env,
      signal: controller.signal,
    });

    res.statusCode = result.status;
    for (const [key, value] of Object.entries(result.headers)) {
      res.setHeader(key, value);
    }
    res.end(JSON.stringify(result.body));
  } catch {
    // The core is designed not to throw; this is a last-resort guard so a
    // deployed instance still returns valid JSON the client treats as "keep
    // the snapshot".
    if (!res.headersSent) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=600');
      res.setHeader('X-Robots-Tag', 'noindex');
    }
    res.end(
      JSON.stringify({
        ok: false,
        owner: '',
        complete: false,
        truncated: false,
        fetchedAt: new Date().toISOString(),
        authenticated: false,
        repositoryCount: 0,
        repositories: [],
        reason: 'upstream_error',
      }),
    );
  } finally {
    clearTimeout(timeout);
    req.off('close', onClose);
  }
}
