import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');

test('1. public/_headers defines comprehensive HTTP security headers', () => {
  const headersPath = path.join(ROOT, 'public/_headers');
  assert.ok(fs.existsSync(headersPath), 'public/_headers must exist');

  const content = fs.readFileSync(headersPath, 'utf8');

  // Verify route matching
  assert.ok(content.includes('/*'), 'Must apply to all routes /*');

  // Verify all 6 mandatory security headers
  assert.ok(content.includes('Content-Security-Policy:'), 'Must define Content-Security-Policy');
  assert.ok(content.includes('X-Frame-Options: DENY'), 'Must define X-Frame-Options: DENY');
  assert.ok(content.includes('X-Content-Type-Options: nosniff'), 'Must define X-Content-Type-Options: nosniff');
  assert.ok(content.includes('Referrer-Policy: strict-origin-when-cross-origin'), 'Must define Referrer-Policy');
  assert.ok(content.includes('Permissions-Policy:'), 'Must define Permissions-Policy');
  assert.ok(content.includes('Strict-Transport-Security:'), 'Must define Strict-Transport-Security');

  // Verify CSP security constraints
  assert.ok(content.includes("frame-ancestors 'none'"), "CSP must forbid iframe embedding via frame-ancestors 'none'");
  assert.ok(content.includes("object-src 'none'"), "CSP must forbid plugins via object-src 'none'");
  assert.ok(content.includes("base-uri 'self'"), "CSP must restrict base-uri to 'self'");
  assert.ok(content.includes("script-src 'self'"), "CSP must restrict script-src to 'self'");
  assert.ok(content.includes("https://fonts.googleapis.com"), "CSP must allow Google Fonts styles");
  assert.ok(content.includes("https://fonts.gstatic.com"), "CSP must allow Google Fonts font files");
});

test('2. netlify.toml defines matching security headers for Netlify deployments', () => {
  const netlifyPath = path.join(ROOT, 'netlify.toml');
  assert.ok(fs.existsSync(netlifyPath), 'netlify.toml must exist');

  const content = fs.readFileSync(netlifyPath, 'utf8');
  assert.ok(content.includes('[[headers]]'), 'Must define [[headers]] block');
  assert.ok(content.includes('for = "/*"'), 'Must target all routes /*');
  assert.ok(content.includes('Content-Security-Policy'), 'Must define Content-Security-Policy in netlify.toml');
  assert.ok(content.includes('X-Frame-Options = "DENY"'), 'Must define X-Frame-Options in netlify.toml');
  assert.ok(content.includes('X-Content-Type-Options = "nosniff"'), 'Must define X-Content-Type-Options in netlify.toml');
  assert.ok(content.includes('Referrer-Policy = "strict-origin-when-cross-origin"'), 'Must define Referrer-Policy in netlify.toml');
  assert.ok(content.includes('Permissions-Policy'), 'Must define Permissions-Policy in netlify.toml');
  assert.ok(content.includes('Strict-Transport-Security'), 'Must define Strict-Transport-Security in netlify.toml');
});

test('3. vercel.json defines matching security headers for Vercel deployments', () => {
  const vercelPath = path.join(ROOT, 'vercel.json');
  assert.ok(fs.existsSync(vercelPath), 'vercel.json must exist');

  const parsed = JSON.parse(fs.readFileSync(vercelPath, 'utf8'));
  assert.ok(Array.isArray(parsed.headers), 'vercel.json must contain headers array');
  const routeHeaders = parsed.headers.find((h: any) => h.source === '/(.*)');
  assert.ok(routeHeaders, 'vercel.json must define headers for /(.*)');

  const headerMap = new Map<string, string>();
  for (const h of routeHeaders.headers) {
    headerMap.set(h.key, h.value);
  }

  assert.ok(headerMap.has('Content-Security-Policy'), 'Must include Content-Security-Policy in vercel.json');
  assert.equal(headerMap.get('X-Frame-Options'), 'DENY');
  assert.equal(headerMap.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(headerMap.get('Referrer-Policy'), 'strict-origin-when-cross-origin');
  assert.ok(headerMap.has('Permissions-Policy'), 'Must include Permissions-Policy in vercel.json');
  assert.ok(headerMap.has('Strict-Transport-Security'), 'Must include Strict-Transport-Security in vercel.json');
});

test('4. index.html includes fallback CSP and Referrer meta tags', () => {
  const htmlPath = path.join(ROOT, 'index.html');
  const content = fs.readFileSync(htmlPath, 'utf8');

  assert.ok(content.includes('<meta http-equiv="Content-Security-Policy"'), 'Must include fallback CSP meta tag');
  assert.ok(content.includes('default-src \'self\''), 'Fallback CSP must include default-src self');
  assert.ok(content.includes('script-src \'self\''), 'Fallback CSP must restrict scripts to self');
  assert.ok(content.includes('<meta name="referrer" content="strict-origin-when-cross-origin"'), 'Must include Referrer meta tag');
});
