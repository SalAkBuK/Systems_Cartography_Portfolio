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
      ...(command === 'serve' ? [githubLiveDevEndpointPlugin()] : []),
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
