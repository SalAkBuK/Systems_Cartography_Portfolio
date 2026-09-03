import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Regression coverage for the production console warning:
//
//   "Unable to preventDefault inside passive event listener invocation."
//
// Root cause: the topology canvas zoomed via a React `onWheel={handleWheel}`
// prop whose handler called `e.preventDefault()`. React attaches its synthetic
// wheel listener at the root as PASSIVE, so that `preventDefault()` was a
// silent no-op — it logged the warning on every wheel/trackpad tick AND still
// let the page scroll behind the canvas while zooming.
//
// Fix: a NATIVE `addEventListener('wheel', handler, { passive: false })` bound
// directly to the canvas container ref, with matching cleanup, preserving the
// exact previous zoom math (direction, 1.1 / 0.9 step, 0.45–2.5 clamp,
// center-relative zoom, no viewport translation).

const canvasSrc = readFileSync('src/components/TopologyCanvas.tsx', 'utf8');

test('the topology canvas no longer uses a React onWheel prop (structural prevention of a reintroduced passive-wheel preventDefault path)', () => {
  assert.ok(!/onWheel\s*=/.test(canvasSrc), 'TopologyCanvas.tsx must not contain a JSX onWheel={...} prop');
  assert.ok(!canvasSrc.includes('React.WheelEvent'), 'no React.WheelEvent handler signature should remain');
  assert.ok(
    !/\(\s*e\s*:\s*React\.WheelEvent\s*\)\s*=>/.test(canvasSrc),
    'no React synthetic wheel handler may remain',
  );
});

test('wheel zoom is installed as a native non-passive listener with { passive: false }', () => {
  assert.match(
    canvasSrc,
    /addEventListener\(\s*['"]wheel['"]\s*,\s*\w+\s*,\s*\{\s*passive:\s*false\s*\}\s*\)/,
    'must register a native wheel listener explicitly marked passive: false',
  );
});

test('the native wheel listener is cleaned up (removeEventListener) so it cannot leak or double-bind', () => {
  assert.match(
    canvasSrc,
    /removeEventListener\(\s*['"]wheel['"]\s*,\s*\w+\s*\)/,
    'the effect must return a cleanup that removes the same wheel listener',
  );
});

test('the wheel listener is bound to the canvas container ref, never to window or document', () => {
  // The listener target is derived from containerRef.current.
  const wheelBindIdx = canvasSrc.indexOf("addEventListener('wheel'");
  assert.ok(wheelBindIdx !== -1);
  const effectSlice = canvasSrc.slice(Math.max(0, wheelBindIdx - 400), wheelBindIdx + 200);
  assert.ok(
    effectSlice.includes('containerRef.current'),
    'the wheel listener must attach to the container ref element',
  );
  assert.ok(
    !/window\.addEventListener\(\s*['"]wheel['"]/.test(canvasSrc),
    'the wheel listener must not be attached to window',
  );
  assert.ok(
    !/document\.addEventListener\(\s*['"]wheel['"]/.test(canvasSrc),
    'the wheel listener must not be attached to document',
  );
});

test('the native wheel handler still calls preventDefault (page must not scroll while zooming the canvas)', () => {
  const wheelBindIdx = canvasSrc.indexOf("addEventListener('wheel'");
  const handlerSlice = canvasSrc.slice(Math.max(0, wheelBindIdx - 500), wheelBindIdx);
  assert.ok(handlerSlice.includes('e.preventDefault()'), 'the native wheel handler must preventDefault the page scroll');
});

test('zoom behavior is preserved exactly: same direction, same 1.1 / 0.9 step, same 0.45–2.5 clamp, no viewport translation', () => {
  const wheelBindIdx = canvasSrc.indexOf("addEventListener('wheel'");
  const handlerSlice = canvasSrc.slice(Math.max(0, wheelBindIdx - 500), wheelBindIdx);

  assert.match(handlerSlice, /e\.deltaY\s*<\s*0\s*\?\s*1\.1\s*:\s*0\.9/, 'zoom-in on scroll up (deltaY < 0) at 1.1x, zoom-out at 0.9x');
  assert.match(
    handlerSlice,
    /Math\.min\(\s*Math\.max\(\s*prev\.zoom\s*\*\s*zoomFactor\s*,\s*0\.45\s*\)\s*,\s*2\.5\s*\)/,
    'zoom stays clamped to the existing 0.45–2.5 range and multiplies the previous zoom',
  );
  // The wheel handler must only touch `zoom` — it must not pan (no x/y writes),
  // matching the pre-fix handler which had no pointer-anchored zoom.
  assert.ok(!/\bx:\s*[^,\n]*deltaX/.test(handlerSlice), 'the wheel handler must not translate the viewport on x');
  assert.ok(!/\by:\s*[^,\n]*deltaY/.test(handlerSlice), 'the wheel handler must not translate the viewport on y');
});

test('the zoom clamp bounds remain consistent with the keyboard/button zoom controls (0.45 floor, 2.5 ceiling)', () => {
  // Sanity anchor so a future change to the shared limits is caught here too.
  assert.ok(canvasSrc.includes('0.45'), 'the 0.45 zoom floor is still present');
  assert.ok(canvasSrc.includes('2.5'), 'the 2.5 zoom ceiling is still present');
});
