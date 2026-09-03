import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const appSrc = readFileSync('src/App.tsx', 'utf8');
const hookSrc = readFileSync('src/hooks/useLiveGitHubInventory.ts', 'utf8');
const telemetrySrc = readFileSync('src/components/TopTelemetryBar.tsx', 'utf8');
const vercelJson = JSON.parse(readFileSync('vercel.json', 'utf8'));
const viteConfigSrc = readFileSync('vite.config.ts', 'utf8');
const indexHtml = readFileSync('index.html', 'utf8');

// ---------------------------------------------------------------------------
// App integration
// ---------------------------------------------------------------------------
test('App still initializes the project inventory from the committed owner-scoped snapshot', () => {
  assert.ok(appSrc.includes('resolveGitHubSnapshotForTarget'), 'snapshot resolution retained');
  assert.ok(appSrc.includes('useLiveGitHubInventory('), 'live inventory hook wired in');
  assert.ok(
    appSrc.includes('snapshotProjects: configuredSnapshot?.projects ?? EMPTY_PROJECTS'),
    'the hook is seeded from the committed snapshot, not a network call',
  );
  assert.ok(appSrc.includes('enabled: Boolean(configuredSnapshot)'), 'live sync only runs when the owner-scoped snapshot is present');
});

test('App does NOT pull the deep GitHub pipeline into the visitor bundle', () => {
  assert.ok(!appSrc.includes('connectGitHubTarget'), 'App.tsx must not call connectGitHubTarget');
  assert.ok(!appSrc.includes('fetchGitHubUserData'), 'App.tsx must not call fetchGitHubUserData');
  assert.ok(!/from ['"][^'"]*githubService['"]/.test(appSrc), 'App.tsx must not import githubService');
  assert.ok(!/from ['"][^'"]*repositoryAnalyzer/.test(appSrc), 'App.tsx must not import the repository analyzer');
});

test('App clears a selected/drilled project that a live reconciliation removed', () => {
  assert.ok(appSrc.includes('projectIdStillPresent(projects, selectedProjectId)'));
  assert.ok(appSrc.includes('projectIdStillPresent(projects, drilledProjectId)'));
  assert.ok(appSrc.includes('setSelectedProjectId(null)'));
  assert.ok(appSrc.includes('setDrilledProjectId(null)'));
});

test('App renders exactly one persistent TopologyCanvas (no remount for live updates)', () => {
  const occurrences = appSrc.match(/<TopologyCanvas/g) ?? [];
  assert.equal(occurrences.length, 1);
});

test('App performs no client-side persistence of the live inventory', () => {
  assert.ok(!appSrc.includes('localStorage') && !appSrc.includes('sessionStorage'));
});

// ---------------------------------------------------------------------------
// Hook lifecycle contract
// ---------------------------------------------------------------------------
test('the hook seeds projects SYNCHRONOUSLY from the snapshot and only fetches after mount', () => {
  assert.ok(
    hookSrc.includes('useState<ProjectData[]>(snapshotWithLinks)'),
    'initial project state is the snapshot, available on first render',
  );
  assert.ok(/useEffect\(\(\) => \{\s*mountedRef\.current = true;\s*runSync\('initial'\)/.test(hookSrc), 'the live fetch is kicked off from a mount effect');
  assert.ok(hookSrc.includes('fetchLiveGitHubInventory('), 'uses the same-origin client');
  assert.ok(!hookSrc.includes('connectGitHubTarget') && !hookSrc.includes('api.github.com'), 'never talks to GitHub directly');
});

test('the hook applies project-link overrides AFTER reconciliation, and keeps the snapshot on failure', () => {
  assert.ok(
    hookSrc.includes('applyProjectLinkOverrides(reconciled.projects, projectLinks)'),
    'link overrides run on reconciled output so a live homepage can feed resolveDeploymentLink',
  );
  assert.ok(hookSrc.includes("setStatus('fallback')"), 'failure path sets a fallback status');
  assert.ok(!hookSrc.includes('localStorage') && !hookSrc.includes('sessionStorage'));
});

test('the hook ignores a stale in-flight response after unmount or a newer request', () => {
  assert.ok(hookSrc.includes('seq !== requestSeqRef.current'), 'stale responses are discarded');
  assert.ok(hookSrc.includes('abortRef.current?.abort()'), 'in-flight requests are aborted');
});

// ---------------------------------------------------------------------------
// Telemetry states (subtle, reuses the existing brutalist language)
// ---------------------------------------------------------------------------
test('the telemetry bar communicates LIVE / CACHED / SNAPSHOT FALLBACK without redesigning the header', () => {
  assert.ok(telemetrySrc.includes('GITHUB // LIVE'));
  assert.ok(telemetrySrc.includes('GITHUB // CACHED'));
  assert.ok(telemetrySrc.includes('GITHUB // SNAPSHOT FALLBACK'));
  // Preserved existing states / obsolete-state guards from githubSnapshot.test.ts:
  assert.ok(telemetrySrc.includes('GITHUB SNAPSHOT //'));
  assert.ok(telemetrySrc.includes('SNAPSHOT // REFRESH REQUIRED'));
  assert.ok(!telemetrySrc.includes('GITHUB // LOADING'));
  assert.ok(!telemetrySrc.includes('CACHED // GITHUB UNAVAILABLE'));
});

test('the telemetry bar exposes a manual refresh that does not reload the page', () => {
  assert.ok(telemetrySrc.includes('onRefresh'));
  assert.ok(telemetrySrc.includes('Re-check live GitHub inventory'));
  assert.ok(!telemetrySrc.includes('location.reload') && !telemetrySrc.includes('window.location'));
});

// ---------------------------------------------------------------------------
// Deployment surface
// ---------------------------------------------------------------------------
test('the existing static app + security headers are unchanged by adding the API route', () => {
  // vercel.json still only defines headers (no rewrites that could shadow /api or the SPA).
  assert.deepEqual(Object.keys(vercelJson), ['headers']);
  const routeHeaders = vercelJson.headers.find((h: { source: string }) => h.source === '/(.*)');
  const csp = routeHeaders.headers.find((h: { key: string }) => h.key === 'Content-Security-Policy').value;
  // Same-origin fetch to /api/github-live is already allowed by connect-src 'self'.
  assert.match(csp, /connect-src 'self'/);
});

test('index.html CSP still permits the same-origin API call with no loosening', () => {
  assert.match(indexHtml, /connect-src 'self'/);
});

test('the Vite dev server serves the same live endpoint core for `npm run dev`', () => {
  assert.ok(viteConfigSrc.includes('/api/github-live'), 'dev middleware mounts the endpoint path');
  assert.ok(viteConfigSrc.includes('handleLiveGitHubRequest'), 'dev middleware reuses the shared core');
  assert.ok(viteConfigSrc.includes("apply: 'serve'"), 'dev middleware never runs in a production build');
  assert.ok(viteConfigSrc.includes("command === 'build'"), 'the existing build-gate is untouched');
});
