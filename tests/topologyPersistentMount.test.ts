import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Regression coverage for a lifecycle bug: App.tsx used to conditionally
// swap TopologyCanvas out for ProjectSubsystemCanvas whenever a project was
// drilled into (`drilledProject ? <ProjectSubsystemCanvas /> : <TopologyCanvas />`).
// Since ALL of TopologyCanvas's magnetic-docking/orbit-rate/grid-snap state
// is component-local (useState/useRef, never lifted to App.tsx and never
// persisted to storage), unmounting it on every drill-in and remounting it
// fresh on every return silently wiped detached project identities/positions,
// interactiveOrbitOrder, custom skill positions, orbit rate/phase, and grid
// snap — and even reset the shared viewport, because a fresh mount re-armed
// TopologyCanvas's own one-time auto-fit-on-mount effect. The fix keeps
// TopologyCanvas permanently mounted for the whole topology/project
// lifetime, hiding it (not removing it) while drilled in.

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

  assert.match(wrapperOpenTag, /className=\{drilledProject \? 'hidden' : 'contents'\}/, 'must toggle between display:none (hidden) and display:contents based on drilledProject');
  assert.match(wrapperOpenTag, /inert=\{Boolean\(drilledProject\)\}/, 'must mark the hidden instance inert so it cannot be focused/interacted with');
  assert.match(wrapperOpenTag, /aria-hidden=\{drilledProject \? true : undefined\}/, 'must be hidden from the accessibility tree while drilled in');
});

test('ProjectSubsystemCanvas is conditionally rendered as a sibling (&&), never as the alternate branch of a ternary that would unmount TopologyCanvas', () => {
  const subsystemIdx = mainBlock.indexOf('<ProjectSubsystemCanvas');
  assert.ok(subsystemIdx !== -1);
  const before = mainBlock.substring(Math.max(0, subsystemIdx - 60), subsystemIdx);
  assert.match(before, /\{drilledProject\s*&&\s*\(?\s*$/, 'ProjectSubsystemCanvas must be gated with drilledProject && (...), a pure conditional-render addition, not a replacement');
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
