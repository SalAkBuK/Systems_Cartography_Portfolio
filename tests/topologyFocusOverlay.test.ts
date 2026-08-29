import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const canvasSource = readFileSync(resolve(process.cwd(), 'src/components/TopologyCanvas.tsx'), 'utf8');
const appSource = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');
const focusResolver = canvasSource.substring(
  canvasSource.indexOf('const selectedFocusLabel ='),
  canvasSource.indexOf('// Static orbital lattice')
);
const focusOverlay = canvasSource.substring(
  canvasSource.indexOf('Screen-positioned focus status'),
  canvasSource.indexOf('Snap / Collision Toast Notification')
);

test('selected project shows its code and title in the canvas focus overlay', () => {
  assert.ok(focusResolver.includes('if (selectedProjectId)'), 'Focus resolver must react to selectedProjectId');
  assert.ok(focusResolver.includes('projects.find(item => item.id === selectedProjectId)'), 'Selected project must resolve from canvas project data');
  assert.ok(focusResolver.includes('`${project.code} · ${project.title}`'), 'Project focus label must include code and title');
  assert.ok(focusOverlay.includes('FOCUS LOCK // {selectedFocusLabel}'), 'Resolved project label must render in the focus overlay');
});

test('selected capability shows its code and name in the canvas focus overlay', () => {
  assert.ok(focusResolver.includes('if (selectedSkillId)'), 'Focus resolver must react to selectedSkillId');
  assert.ok(focusResolver.includes('activeSkills.find(item => item.id === selectedSkillId)'), 'Selected capability must resolve from active skill data');
  assert.ok(focusResolver.includes('`${skill.code} · ${skill.name}`'), 'Capability focus label must include code and name');
});

test('release button uses the shared clear-selection callback', () => {
  const topologyInvocation = appSource.substring(
    appSource.indexOf('<TopologyCanvas'),
    appSource.indexOf('/>', appSource.indexOf('<TopologyCanvas'))
  );

  assert.ok(canvasSource.includes('onClearSelection: () => void;'), 'TopologyCanvas must require the shared clear callback');
  assert.ok(topologyInvocation.includes('onClearSelection={handleClearSelection}'), 'App must pass its shared clear callback to TopologyCanvas');
  assert.ok(focusOverlay.includes('onClearSelection();'), 'Release button must invoke the shared clear callback');
  assert.ok(focusOverlay.includes('aria-label="Release topology focus"'), 'Release button must expose an accessible action label');
  assert.ok(focusOverlay.includes('focus-visible:outline'), 'Release button must retain a visible keyboard focus treatment');
});

test('canvas focus overlay disappears when no selection resolves', () => {
  assert.ok(focusResolver.includes('return null;'), 'Focus resolver must return null with no selected topology object');
  assert.ok(focusOverlay.includes('{selectedFocusLabel && ('), 'Overlay must render conditionally from the resolved selection label');
  assert.ok(!focusOverlay.includes('selectedFocusLabel ||'), 'Overlay must not have an always-visible fallback label');
});

test('focus overlay is panel-positioned outside the moving SVG topology scene', () => {
  const overlayPosition = canvasSource.indexOf('id="topology-focus-status"');
  const svgPosition = canvasSource.indexOf('Main SVG Render Surface');
  const scenePosition = canvasSource.indexOf('id="scene-root"');
  const snapNotice = canvasSource.substring(
    canvasSource.indexOf('Snap / Collision Toast Notification'),
    canvasSource.indexOf('Bottom-Left Controls & Status')
  );

  assert.ok(overlayPosition !== -1 && overlayPosition < svgPosition, 'Focus overlay must render before and outside the SVG surface');
  assert.ok(svgPosition < scenePosition, 'Moving scene-root must remain nested later inside the SVG surface');
  assert.ok(focusOverlay.includes('hidden lg:flex absolute top-12 left-1/2'), 'Overlay must use responsive panel coordinates below the top telemetry row');
  assert.ok(snapNotice.includes("selectedFocusLabel ? 'top-24' : 'top-12'"), 'Transient canvas notices must shift below an active focus overlay');
  assert.ok(focusOverlay.includes('onMouseDown={(event) => event.stopPropagation()}'), 'Pointer interaction must not start mouse canvas pan handling');
  assert.ok(focusOverlay.includes('onTouchStart={(event) => event.stopPropagation()}'), 'Pointer interaction must not start touch canvas pan handling');
});
