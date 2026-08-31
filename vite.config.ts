import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {runDeploymentReadinessCheck} from './scripts/check-deployment-readiness';

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
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
