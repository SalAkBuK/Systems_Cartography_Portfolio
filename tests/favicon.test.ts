// Favicon regression coverage. Production previously requested favicon.ico
// and received a 404 -- index.html had no <link rel="icon"> and public/ held
// only _headers. Fix: a tiny local brutalist SVG favicon in public/, wired
// via a real <link rel="icon"> in index.html (no external favicon service,
// no generated variants). Matches this codebase's established convention
// (pure source-text/filesystem node:test assertions, no build invocation --
// see tests/topologyPersistentMount.test.ts).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const indexHtmlSource = fs.readFileSync(path.resolve('index.html'), 'utf8');
const faviconPath = path.resolve('public/favicon.svg');

test('index.html references a local SVG favicon via <link rel="icon">', () => {
  assert.match(
    indexHtmlSource,
    /<link\s+rel="icon"\s+type="image\/svg\+xml"\s+href="\/favicon\.svg"\s*\/?>/,
    'expected a <link rel="icon" type="image/svg+xml" href="/favicon.svg"> tag in index.html'
  );
});

test('the favicon link is same-origin (no external favicon service)', () => {
  const linkMatch = indexHtmlSource.match(/<link\s+rel="icon"[^>]*>/);
  assert.ok(linkMatch, 'expected a rel="icon" link tag');
  assert.ok(linkMatch![0].includes('href="/favicon.svg"'), 'favicon href must be a local, root-relative path');
  assert.ok(!/https?:\/\//.test(linkMatch![0]), 'favicon link must not point at an external host/service');
});

test('exactly one favicon link exists (no redundant/generated variants)', () => {
  const occurrences = indexHtmlSource.match(/<link\s+rel="icon"/g) ?? [];
  assert.equal(occurrences.length, 1, 'expected exactly one favicon <link> -- no unnecessary variants');
});

test('public/favicon.svg exists and is a real, non-empty SVG document', () => {
  assert.ok(fs.existsSync(faviconPath), 'public/favicon.svg must exist');
  const svg = fs.readFileSync(faviconPath, 'utf8');
  assert.match(svg, /<svg[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.ok(svg.trim().endsWith('</svg>'), 'must be a complete, well-formed SVG document');
});

test('the favicon uses the portfolio\'s own brutalist palette (background tan / ink), not arbitrary colors', () => {
  const svg = fs.readFileSync(faviconPath, 'utf8');
  // The same background/ink pair index.css and index.html's <body> already use.
  assert.ok(svg.includes('#D4CDA4'), 'favicon must use the portfolio background color');
  assert.ok(svg.includes('#15150F'), 'favicon must use the portfolio ink color');
});

test('the favicon stays simple: no embedded raster data, external references, or scripts', () => {
  const svg = fs.readFileSync(faviconPath, 'utf8');
  assert.ok(!svg.includes('data:image'), 'must not embed a raster image');
  // The standard xmlns="http://www.w3.org/2000/svg" namespace declaration is
  // not a fetched resource -- strip it before checking for real external
  // references (e.g. an <image>/xlink:href pointing off-origin).
  const withoutNamespaceDeclaration = svg.replace(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/, '');
  assert.ok(!/https?:\/\//.test(withoutNamespaceDeclaration), 'must not reference any external resource');
  assert.ok(!/<script/i.test(svg), 'a favicon must never contain script content');
});

test('no favicon-generation package or external favicon service was introduced', () => {
  const packageJson = fs.readFileSync(path.resolve('package.json'), 'utf8');
  assert.ok(!/favicon/i.test(packageJson), 'no favicon-related dependency should be needed for a hand-authored SVG favicon');
});

test('public/ was not otherwise restructured -- _headers remains alongside the new favicon', () => {
  const publicFiles = fs.readdirSync(path.resolve('public')).sort();
  assert.deepEqual(publicFiles, ['_headers', 'favicon.svg']);
});
