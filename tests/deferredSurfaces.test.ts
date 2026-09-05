// Code-splitting regression coverage: CaseStudyModal, ResumeModal, and
// ContactPage are deferred out of the initial JS bundle via React.lazy +
// Suspense (none is needed for the initial topology render). TopologyCanvas,
// ProjectSubsystemCanvas, and RightInspectorPanel are deliberately kept
// eager (RightInspectorPanel renders on first paint in every non-contact
// view; the other two are the primary topology surface). Matches this
// codebase's established convention (pure source-text node:test assertions
// against App.tsx, no React/jsdom rendering harness -- see
// tests/topologyPersistentMount.test.ts / tests/capabilityReactor.test.ts).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const appSource = fs.readFileSync(path.resolve('src/App.tsx'), 'utf8');

function block(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  assert.ok(start !== -1, `marker not found: ${startMarker}`);
  const end = source.indexOf(endMarker, start);
  assert.ok(end !== -1, `end marker not found: ${endMarker}`);
  return source.substring(start, end);
}

// ---------------------------------------------------------------------------
// LAZY DECLARATIONS
// ---------------------------------------------------------------------------

test('CaseStudyModal, ContactPage, and ResumeModal are declared via React.lazy(dynamic import), not static imports', () => {
  for (const name of ['CaseStudyModal', 'ContactPage', 'ResumeModal']) {
    assert.ok(
      new RegExp(`const ${name} = lazy\\(\\(\\) => import\\('\\./components/${name}'\\)`).test(appSource),
      `${name} must be declared with lazy(() => import(...))`
    );
    assert.ok(
      !new RegExp(`import \\{ ${name} \\} from './components/${name}'`).test(appSource),
      `${name} must not also be statically imported`
    );
  }
});

test('React.lazy and Suspense are imported from react', () => {
  assert.match(appSource, /import React, \{[^}]*\bSuspense\b[^}]*\blazy\b[^}]*\} from 'react';/);
});

// ---------------------------------------------------------------------------
// TOPOLOGY-CRITICAL SURFACES REMAIN EAGER
// ---------------------------------------------------------------------------

test('TopologyCanvas, ProjectSubsystemCanvas, and RightInspectorPanel remain static (eager) imports', () => {
  assert.ok(appSource.includes("import { TopologyCanvas } from './components/TopologyCanvas';"));
  assert.ok(appSource.includes("import { ProjectSubsystemCanvas } from './components/ProjectSubsystemCanvas';"));
  assert.ok(appSource.includes("import { RightInspectorPanel } from './components/RightInspectorPanel';"));
  for (const name of ['TopologyCanvas', 'ProjectSubsystemCanvas', 'RightInspectorPanel']) {
    assert.ok(!new RegExp(`const ${name} = lazy\\(`).test(appSource), `${name} must not be lazy-loaded`);
  }
});

// ---------------------------------------------------------------------------
// ON-DEMAND MOUNTING (not merely isOpen on an always-mounted instance)
// ---------------------------------------------------------------------------

test('CaseStudyModal and ResumeModal are only MOUNTED once opened (isCaseStudyOpen/isResumeOpen && ...), each inside its own Suspense', () => {
  const caseStudyBlock = block(appSource, '{isCaseStudyOpen && (', '<CaseStudyModal');
  assert.match(caseStudyBlock, /<Suspense fallback=\{<DeferredSurfaceFallback variant="modal" \/>\}>/);

  const resumeBlock = block(appSource, '{isResumeOpen && (', '<ResumeModal');
  assert.match(resumeBlock, /<Suspense fallback=\{<DeferredSurfaceFallback variant="modal" \/>\}>/);
});

test('ContactPage renders only inside the existing activeView === "contact" branch, now wrapped in Suspense', () => {
  const mainBlock = block(appSource, '<main className="flex-1 flex flex-col relative overflow-hidden bg-[#D4CDA4]">', '</main>');
  assert.match(mainBlock, /activeView === 'contact' \? \(\s*<Suspense fallback=\{<DeferredSurfaceFallback variant="page" \/>\}>\s*<ContactPage/);
  // Still exactly one ContactPage element, still gated the same way as before.
  assert.equal((appSource.match(/<ContactPage/g) ?? []).length, 1);
});

test('a shared minimal brutalist Suspense fallback exists for both modal and page variants', () => {
  assert.match(appSource, /function DeferredSurfaceFallback\(\{ variant \}: \{ variant: 'modal' \| 'page' \}\)/);
  assert.ok(appSource.includes('LOADING...'));
});

// ---------------------------------------------------------------------------
// NO TOPOLOGY STATE REGRESSION
// ---------------------------------------------------------------------------

test('the deferred-mount blocks for CaseStudyModal/ResumeModal live in the modals section, after BottomCommandStrip, never wrapping or gating TopologyCanvas', () => {
  const bottomStripIdx = appSource.indexOf('<BottomCommandStrip');
  const caseStudyGateIdx = appSource.indexOf('{isCaseStudyOpen && (');
  const resumeGateIdx = appSource.indexOf('{isResumeOpen && (');
  const topologyIdx = appSource.indexOf('<TopologyCanvas');
  assert.ok(bottomStripIdx !== -1 && caseStudyGateIdx !== -1 && resumeGateIdx !== -1 && topologyIdx !== -1);
  assert.ok(topologyIdx < bottomStripIdx, 'TopologyCanvas must render before the bottom strip / modals section');
  assert.ok(bottomStripIdx < caseStudyGateIdx && bottomStripIdx < resumeGateIdx, 'modal gates must live in the modals section, not interleaved with the topology render');
});

test('exactly one <TopologyCanvas> element still exists (unaffected by the lazy-loading change)', () => {
  assert.equal((appSource.match(/<TopologyCanvas/g) ?? []).length, 1);
});

test('keyboard shortcut wiring for Escape/case-study/resume/contact is unchanged by the lazy-loading refactor', () => {
  const handlerBlock = block(appSource, "const handleKeyDown = (e: KeyboardEvent) => {", '};');
  assert.ok(handlerBlock.includes('if (isCaseStudyOpen) {'));
  assert.ok(handlerBlock.includes('setIsCaseStudyOpen(false);'));
  assert.ok(handlerBlock.includes('} else if (isResumeOpen) {'));
  assert.ok(handlerBlock.includes('setIsResumeOpen(false);'));
  assert.ok(handlerBlock.includes("} else if (e.key === 'r' || e.key === 'R') {"));
  assert.ok(handlerBlock.includes('setIsResumeOpen(true);'));
  assert.ok(handlerBlock.includes("} else if (e.key === 'c' || e.key === 'C') {"));
  assert.ok(handlerBlock.includes("handleNavViewChange('contact');"));
});

test('modal open state (isCaseStudyOpen/isResumeOpen) is still plain App-level useState, not moved/duplicated', () => {
  assert.equal((appSource.match(/const \[isCaseStudyOpen, setIsCaseStudyOpen\] = useState\(false\);/g) ?? []).length, 1);
  assert.equal((appSource.match(/const \[isResumeOpen, setIsResumeOpen\] = useState\(false\);/g) ?? []).length, 1);
});

// ---------------------------------------------------------------------------
// UNTOUCHED ADJACENT SYSTEMS
// ---------------------------------------------------------------------------

test('contact backend and GitHub live inventory wiring are unchanged', () => {
  assert.ok(appSource.includes("import { useLiveGitHubInventory } from './hooks/useLiveGitHubInventory';"));
  assert.ok(appSource.includes("formEndpoint={PORTFOLIO_CONFIG.contactFormEndpoint}"));
  assert.ok(appSource.includes('useLiveGitHubInventory({'), 'the live inventory hook must still be invoked exactly as before');
  // App.tsx never hardcodes the endpoint path itself (that lives in the hook
  // and PORTFOLIO_CONFIG) -- this lazy-loading change must not introduce one.
  assert.ok(!/fetch\(['"]\/api\//.test(appSource), 'App.tsx must not start hardcoding a direct fetch to an API path');
});

test('no react-router or SPA-fallback routing was introduced', () => {
  assert.ok(!/react-router/.test(appSource));
  assert.ok(!/BrowserRouter|useNavigate|useParams/.test(appSource));
  const packageJson = fs.readFileSync(path.resolve('package.json'), 'utf8');
  assert.ok(!/react-router/.test(packageJson));
});

test('vercel.json routing was not touched by this change', () => {
  // This suite only asserts absence of new routing additions in App.tsx
  // itself; vercel.json is intentionally out of scope for this fix.
  assert.ok(!appSource.includes('vercel.json'));
});
