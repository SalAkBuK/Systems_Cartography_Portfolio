import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Regression coverage for a lifecycle bug (two rounds):
//
// Round 1 — App.tsx used to conditionally swap TopologyCanvas out for
// ProjectSubsystemCanvas whenever a project was drilled into
// (`drilledProject ? <ProjectSubsystemCanvas /> : <TopologyCanvas />`). Since
// ALL of TopologyCanvas's magnetic-docking/orbit-rate/grid-snap state is
// component-local (useState/useRef, never lifted to App.tsx and never
// persisted to storage), unmounting it on every drill-in and remounting it
// fresh on every return silently wiped detached project identities/
// positions, interactiveOrbitOrder, custom skill positions, orbit rate/
// phase, and grid snap — and even reset the shared viewport, because a
// fresh mount re-armed TopologyCanvas's one-time auto-fit-on-mount effect.
//
// Round 2 — the first fix kept it mounted but hid it via `hidden`
// (display:none). TopologyCanvas's own ResizeObserver reads
// containerRef.current.clientWidth/clientHeight to derive isCompactViewport,
// and isCompact is itself an autonomous-orbit pause authority — so
// display:none collapsed the mounted instance to 0x0 and silently paused the
// continuous machine while the schematic was open. The fix hides it purely
// VISUALLY instead: `absolute inset-0` keeps its real box (and therefore its
// real measured dimensions) unchanged, toggling only invisible/
// pointer-events-none/inert.

const appSource = fs.readFileSync(path.resolve('src/App.tsx'), 'utf8');

function block(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  assert.ok(start !== -1, `marker not found: ${startMarker}`);
  const end = source.indexOf(endMarker, start);
  assert.ok(end !== -1, `end marker not found: ${endMarker}`);
  return source.substring(start, end);
}

const mainBlock = block(appSource, '<main className="flex-1 flex flex-col relative overflow-hidden bg-[#D4CDA4]">', '</main>');

test('TopologyCanvas is rendered exactly once in App.tsx (a single persistent instance, not one per branch)', () => {
  const occurrences = appSource.match(/<TopologyCanvas/g) ?? [];
  assert.equal(occurrences.length, 1, 'there must be exactly one <TopologyCanvas> element in the whole file');
});

test('TopologyCanvas is never gated behind a drilledProject ternary that swaps it out — the old unmounting bug pattern is gone', () => {
  const ternaryReplacesTopology = /drilledProject\s*\?\s*\(?\s*<ProjectSubsystemCanvas[\s\S]*?\)\s*:\s*\(?\s*<TopologyCanvas/;
  assert.ok(!ternaryReplacesTopology.test(mainBlock), 'TopologyCanvas must not be the false-branch of a drilledProject ternary');
});

test('TopologyCanvas renders unconditionally whenever activeView is not "contact", regardless of drilledProject', () => {
  const contactBranchStart = mainBlock.indexOf("activeView === 'contact'");
  assert.ok(contactBranchStart !== -1);
  const elseBranchStart = mainBlock.indexOf(') : (', contactBranchStart);
  assert.ok(elseBranchStart !== -1, 'must have a single else-branch after the contact check, not a further drilledProject branch');

  const elseBranch = mainBlock.substring(elseBranchStart);
  assert.ok(elseBranch.includes('<TopologyCanvas'), 'TopologyCanvas must be present in the non-contact branch');
  assert.ok(elseBranch.includes('<ProjectSubsystemCanvas'), 'ProjectSubsystemCanvas must also be present in the non-contact branch (as a sibling, not a replacement)');

  // The wrapping div around TopologyCanvas must not itself be conditional on
  // drilledProject in a way that removes TopologyCanvas from the tree — only
  // its className/inert/aria-hidden may depend on drilledProject.
  const wrapperStart = elseBranch.indexOf('<div');
  const topologyIdx = elseBranch.indexOf('<TopologyCanvas');
  const wrapperOpenTag = elseBranch.substring(wrapperStart, elseBranch.indexOf('>', wrapperStart) + 1);
  assert.ok(wrapperStart !== -1 && wrapperStart < topologyIdx, 'TopologyCanvas must be nested inside a wrapper div, not directly conditional');
  assert.ok(!wrapperOpenTag.includes('&&'), 'the wrapper div itself must not be short-circuited away by drilledProject &&');
});

test('the TopologyCanvas wrapper toggles visibility/inertness via drilledProject, but never unmounts it (no conditional && or ternary around the element itself)', () => {
  const wrapperStart = mainBlock.indexOf('<div');
  const wrapperTagEnd = mainBlock.indexOf('>', wrapperStart) + 1;
  const wrapperOpenTag = mainBlock.substring(wrapperStart, wrapperTagEnd);

  assert.match(wrapperOpenTag, /className=\{`absolute inset-0 \$\{drilledProject \? 'invisible pointer-events-none' : 'visible'\}`\}/, 'must stay geometry-preserving (absolute inset-0) and toggle only invisible/pointer-events-none, never display:none');
  assert.match(wrapperOpenTag, /inert=\{Boolean\(drilledProject\)\}/, 'must mark the hidden instance inert so it cannot be focused/interacted with');
  assert.match(wrapperOpenTag, /aria-hidden=\{drilledProject \? true : undefined\}/, 'must be hidden from the accessibility tree while drilled in');
});

test('the TopologyCanvas wrapper never uses display:none / Tailwind `hidden`, and always keeps a real absolute inset-0 box (geometry-preserving visibility, not layout removal)', () => {
  const wrapperStart = mainBlock.indexOf('<div');
  const wrapperTagEnd = mainBlock.indexOf('>', wrapperStart) + 1;
  const wrapperOpenTag = mainBlock.substring(wrapperStart, wrapperTagEnd);

  // Strip the aria-hidden attribute (which legitimately contains the
  // substring "hidden" as part of its accessibility-attribute NAME, not a
  // Tailwind class) before checking for the `hidden` utility class itself.
  const withoutAriaHidden = wrapperOpenTag.replace(/aria-hidden=\{[^}]*\}/, '');
  assert.ok(!/\bhidden\b/.test(withoutAriaHidden), 'the TopologyCanvas wrapper must never use the `hidden` (display:none) utility class');
  assert.ok(!wrapperOpenTag.includes("? 'hidden'"), 'must not conditionally apply display:none based on drilledProject');
  assert.match(wrapperOpenTag, /absolute inset-0/, 'must keep an absolutely-positioned, full-size box regardless of drilledProject so ResizeObserver never measures 0x0');
  assert.match(wrapperOpenTag, /invisible/, 'must use the `invisible` (visibility:hidden) utility, which preserves layout, not display:none');
  assert.match(wrapperOpenTag, /pointer-events-none/, 'must disable hit-testing while hidden so it cannot be interacted with');
});

test('ProjectSubsystemCanvas overlay is also absolutely positioned (inset-0) so it visually covers the still-full-size TopologyCanvas beneath it', () => {
  const subsystemDivStart = mainBlock.indexOf('<div className="absolute inset-0 z-10">');
  assert.ok(subsystemDivStart !== -1, 'ProjectSubsystemCanvas must be wrapped in its own absolute inset-0 overlay container, stacked above the topology instance');
  const subsystemIdxInWrapper = mainBlock.indexOf('<ProjectSubsystemCanvas', subsystemDivStart);
  assert.ok(subsystemIdxInWrapper !== -1 && subsystemIdxInWrapper - subsystemDivStart < 200);
});

test('ProjectSubsystemCanvas is conditionally rendered as a sibling (&&), never as the alternate branch of a ternary that would unmount TopologyCanvas', () => {
  const overlayDivIdx = mainBlock.indexOf('<div className="absolute inset-0 z-10">');
  assert.ok(overlayDivIdx !== -1);
  const before = mainBlock.substring(Math.max(0, overlayDivIdx - 60), overlayDivIdx);
  assert.match(before, /\{drilledProject\s*&&\s*\(?\s*$/, 'the ProjectSubsystemCanvas overlay must be gated with drilledProject && (...), a pure conditional-render addition, not a replacement');
});

test('the wrapper div is positioned before ProjectSubsystemCanvas in source order, matching "same instance underneath, overlay revealed above it"', () => {
  const wrapperIdx = mainBlock.indexOf('<div');
  const topologyIdx = mainBlock.indexOf('<TopologyCanvas');
  const subsystemIdx = mainBlock.indexOf('<ProjectSubsystemCanvas');
  assert.ok(wrapperIdx < topologyIdx && topologyIdx < subsystemIdx);
});

test('no localStorage/sessionStorage was introduced to work around this — persistence comes purely from not unmounting', () => {
  assert.ok(!appSource.includes('localStorage') && !appSource.includes('sessionStorage'));
});
