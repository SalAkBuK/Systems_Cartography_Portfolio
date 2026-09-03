import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {defineConfig, loadEnv, type Plugin} from 'vite';
import {runDeploymentReadinessCheck} from './scripts/check-deployment-readiness';

/**
 * Local-development adapter for the runtime live-GitHub endpoint.
 *
 * On Vercel, `api/github-live.ts` is auto-deployed as a serverless function.
 * `vite dev` does not execute Vercel functions, so this dev-only plugin serves
 * the SAME transport-agnostic core (`handleLiveGitHubRequest`) at the same
 * path, keeping `npm run dev` working and the endpoint testable locally. It is
 * only registered for `command === 'serve'` and is dynamically imported inside
 * `configureServer` so it adds nothing to a production build. A local `.env`
 * `GITHUB_TOKEN` (non-`VITE_` prefixed, so never bundled) is picked up here.
 */
function githubLiveDevEndpointPlugin(): Plugin {
  const ROUTE = '/api/github-live';
  return {
    name: 'systems-cartography:github-live-dev-endpoint',
    apply: 'serve',
    configureServer(server) {
      const localEnv = loadEnv(server.config.mode, process.cwd(), '');
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        const pathname = (req.url || '').split('?')[0];
        if (pathname !== ROUTE) {
          next();
          return;
        }
        try {
          const { handleLiveGitHubRequest } = await import('./src/services/githubLiveInventory');
          const result = await handleLiveGitHubRequest({
            method: req.method,
            // Real process env wins over .env files (e.g. `GITHUB_TOKEN=x npm run dev`).
            env: { ...localEnv, ...process.env },
          });
          res.statusCode = result.status;
          for (const [key, value] of Object.entries(result.headers)) {
            res.setHeader(key, value);
          }
          res.end(JSON.stringify(result.body));
        } catch {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
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
        }
      });
    },
  };
}

/**
 * Local-development adapter for the first-party contact endpoint. Same rationale
 * as the live-GitHub dev plugin above: `vite dev` does not run Vercel
 * functions, so this serves the SAME transport-agnostic core
 * (`handleContactRequest`) at `/api/contact`, reusing its bounded body reader.
 * Server-only `.env` values (`RESEND_API_KEY`, `CONTACT_TO_EMAIL`,
 * `CONTACT_FROM_EMAIL`; non-`VITE_` prefixed, so never bundled) are picked up
 * here. No contact business logic is duplicated in this file.
 */
function contactDevEndpointPlugin(): Plugin {
  const ROUTE = '/api/contact';
  return {
    name: 'systems-cartography:contact-dev-endpoint',
    apply: 'serve',
    configureServer(server) {
      const localEnv = loadEnv(server.config.mode, process.cwd(), '');
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        const pathname = (req.url || '').split('?')[0];
        if (pathname !== ROUTE) {
          next();
          return;
        }
        try {
          const { handleContactRequest, readBoundedRequestBody, CONTACT_MAX_BODY_BYTES } =
            await import('./src/services/contactService');
          const { body, tooLarge } = await readBoundedRequestBody(req, CONTACT_MAX_BODY_BYTES);
          const headerString = (value: string | string[] | undefined) =>
            Array.isArray(value) ? value[0] : value;
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
            // Real process env wins over .env files.
            env: { ...localEnv, ...process.env },
          });
          res.statusCode = result.status;
          for (const [key, value] of Object.entries(result.headers)) {
            res.setHeader(key, value);
          }
          res.end(JSON.stringify(result.body));
        } catch {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.setHeader('X-Robots-Tag', 'noindex');
          res.end(JSON.stringify({ ok: false, error: 'The contact service encountered an unexpected error.' }));
        }
      });
    },
  };
}

export default defineConfig(({command}) => {
  // Fork-safety gate, enforced inside the Vite build pipeline itself so it
  // cannot be bypassed by invoking `vite build`/`npx vite build` directly
  // instead of `npm run build` (which already chained this same check as a
  // separate npm script). Reuses the existing deployment-readiness source of
  // truth (src/utils/deploymentReadiness.ts via scripts/deployment-readiness.ts)
  // -- no owner-comparison logic is duplicated here. Gated on `command === 'build'`
  // only, so `vite`/`vite dev` (the local dev server) and the standalone
  // `npm run setup:portfolio` wizard (which never loads this config) are
  // both left unaffected.
  if (command === 'build' && !runDeploymentReadinessCheck()) {
    throw new Error('Deployment readiness check failed -- see output above. Production build blocked.');
  }

  return {
    plugins: [
      react(),
      tailwindcss(),
      ...(command === 'serve' ? [githubLiveDevEndpointPlugin(), contactDevEndpointPlugin()] : []),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
