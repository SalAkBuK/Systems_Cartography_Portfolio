import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import {
  handleContactRequest,
  readBoundedRequestBody,
  isDisallowedCrossSiteRequest,
  CONTACT_MAX_BODY_BYTES,
  CONTACT_SUBJECT_PREFIX,
  RESEND_EMAILS_ENDPOINT,
  type ContactServiceEnv,
} from '../src/services/contactService.ts';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const VALID_ENV: Required<ContactServiceEnv> = {
  RESEND_API_KEY: 're_test_key_do_not_use',
  CONTACT_TO_EMAIL: 'owner@example.com',
  CONTACT_FROM_EMAIL: 'Portfolio Contact <contact@portfolio.example>',
};

const VALID_FIELDS = {
  name: 'Visitor Name',
  email: 'visitor@example.com',
  subject: 'Engineering role',
  message: 'Hello,\n\nI would like to discuss a role.\n\nRegards',
  companyWebsite: '',
};

function sameOriginHeaders(overrides: Record<string, string | undefined> = {}) {
  return {
    'content-type': 'application/json',
    origin: 'https://portfolio.example',
    host: 'portfolio.example',
    'sec-fetch-site': 'same-origin',
    ...overrides,
  };
}

interface CapturedResend {
  calls: Array<{ url: string; init: RequestInit | undefined }>;
  fetchImpl: typeof fetch;
}
function captureResend(status = 200): CapturedResend {
  const calls: CapturedResend['calls'] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: input.toString(), init });
    return new Response(JSON.stringify({ id: 'email_123' }), { status, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return { calls, fetchImpl };
}

function post(body: unknown, opts: Partial<Parameters<typeof handleContactRequest>[0]> = {}) {
  return handleContactRequest({
    method: 'POST',
    headers: sameOriginHeaders(),
    rawBody: typeof body === 'string' ? body : JSON.stringify(body),
    env: VALID_ENV,
    ...opts,
  });
}

// ---------------------------------------------------------------------------
// 1. Happy path
// ---------------------------------------------------------------------------
test('1/15. a valid same-origin POST calls Resend exactly once with the correct email shape and returns 200', async () => {
  const resend = captureResend();
  const res = await post(VALID_FIELDS, { fetchImpl: resend.fetchImpl });

  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { ok: true });
  assert.equal(resend.calls.length, 1);

  const call = resend.calls[0];
  assert.equal(call.url, RESEND_EMAILS_ENDPOINT);
  assert.equal(call.init?.method, 'POST');
  const headers = call.init?.headers as Record<string, string>;
  assert.equal(headers.Authorization, `Bearer ${VALID_ENV.RESEND_API_KEY}`);
  assert.equal(headers['Content-Type'], 'application/json');

  const sent = JSON.parse(call.init?.body as string);
  assert.equal(sent.from, VALID_ENV.CONTACT_FROM_EMAIL, 'from = configured server sender');
  assert.deepEqual(sent.to, [VALID_ENV.CONTACT_TO_EMAIL], 'to = configured owner recipient');
  assert.equal(sent.reply_to, VALID_FIELDS.email, 'reply_to = visitor email');
  assert.equal(sent.subject, `${CONTACT_SUBJECT_PREFIX}${VALID_FIELDS.subject}`, 'fixed subject prefix');
  assert.equal(sent.from.includes(VALID_FIELDS.email), false, 'visitor email is never the from address');
  assert.match(sent.text, /^Portfolio contact inquiry\n/);
  assert.match(sent.text, /Name: Visitor Name/);
  assert.match(sent.text, /Reply-To: visitor@example\.com/);
  assert.match(sent.text, /Subject: Engineering role/);
  assert.match(sent.text, /Message:\nHello,/);
  assert.equal(sent.html, undefined, 'plain text only, no HTML rendering of user input');
});

test('16. every response is Cache-Control: no-store and X-Robots-Tag: noindex', async () => {
  const resend = captureResend();
  const ok = await post(VALID_FIELDS, { fetchImpl: resend.fetchImpl });
  assert.equal(ok.headers['Cache-Control'], 'no-store');
  assert.equal(ok.headers['X-Robots-Tag'], 'noindex');

  const bad = await handleContactRequest({ method: 'GET' });
  assert.equal(bad.headers['Cache-Control'], 'no-store');
  assert.equal(bad.headers['X-Robots-Tag'], 'noindex');
  assert.doesNotMatch(bad.headers['Cache-Control'], /s-maxage/, 'must NOT reuse the /api/github-live caching policy');
});

// ---------------------------------------------------------------------------
// 2-8, 11: method / content-type / body / origin / validation gates
// ---------------------------------------------------------------------------
test('2. a non-POST method is 405 with Allow: POST and never calls Resend', async () => {
  const resend = captureResend();
  for (const method of ['GET', 'PUT', 'DELETE', 'OPTIONS']) {
    const res = await handleContactRequest({ method, headers: sameOriginHeaders(), env: VALID_ENV, fetchImpl: resend.fetchImpl });
    assert.equal(res.status, 405, method);
    assert.equal(res.headers.Allow, 'POST');
  }
  assert.equal(resend.calls.length, 0);
});

test('3. an unsupported content type is 415; a charset parameter on application/json is tolerated', async () => {
  const res = await handleContactRequest({
    method: 'POST',
    headers: sameOriginHeaders({ 'content-type': 'application/x-www-form-urlencoded' }),
    rawBody: 'name=x',
    env: VALID_ENV,
  });
  assert.equal(res.status, 415);
  assert.equal((await handleContactRequest({ method: 'POST', headers: sameOriginHeaders({ 'content-type': 'text/plain' }), rawBody: '{}', env: VALID_ENV })).status, 415);

  const resend = captureResend();
  const withCharset = await handleContactRequest({
    method: 'POST',
    headers: sameOriginHeaders({ 'content-type': 'application/json; charset=utf-8' }),
    rawBody: JSON.stringify(VALID_FIELDS),
    env: VALID_ENV,
    fetchImpl: resend.fetchImpl,
  });
  assert.equal(withCharset.status, 200);
  assert.equal(resend.calls.length, 1);
});

test('4. malformed JSON is 400', async () => {
  const res = await post('{ not json', {});
  assert.equal(res.status, 400);
});

test('5. an oversized body (adapter flag) is 413 and never calls Resend', async () => {
  const resend = captureResend();
  const res = await handleContactRequest({
    method: 'POST',
    headers: sameOriginHeaders(),
    bodyTooLarge: true,
    env: VALID_ENV,
    fetchImpl: resend.fetchImpl,
  });
  assert.equal(res.status, 413);
  assert.equal(resend.calls.length, 0);
});

test('6. a missing field is 400', async () => {
  for (const field of ['name', 'email', 'subject', 'message'] as const) {
    const res = await post({ ...VALID_FIELDS, [field]: '' });
    assert.equal(res.status, 400, `${field} missing`);
  }
});

test('6b. a non-string field (invalid payload shape) is 400', async () => {
  assert.equal((await post({ ...VALID_FIELDS, name: 123 })).status, 400);
  assert.equal((await post(JSON.stringify(['array']))).status, 400);
  assert.equal((await post(JSON.stringify(null))).status, 400);
});

test('7. an invalid email is 400', async () => {
  assert.equal((await post({ ...VALID_FIELDS, email: 'not-an-email' })).status, 400);
});

test('8. an oversized field is 400', async () => {
  assert.equal((await post({ ...VALID_FIELDS, name: 'x'.repeat(101) })).status, 400);
  assert.equal((await post({ ...VALID_FIELDS, subject: 'x'.repeat(161) })).status, 400);
  assert.equal((await post({ ...VALID_FIELDS, message: 'x'.repeat(5001) })).status, 400);
});

test('10. CR/LF or control-character abuse in a header-adjacent field is rejected', async () => {
  const resend = captureResend();
  const bad = await post(
    { ...VALID_FIELDS, subject: 'Hi\r\nBcc: attacker@evil.example' },
    { fetchImpl: resend.fetchImpl },
  );
  assert.equal(bad.status, 400);
  const badName = await post({ ...VALID_FIELDS, name: 'Real\nName' }, { fetchImpl: resend.fetchImpl });
  assert.equal(badName.status, 400);
  assert.equal(resend.calls.length, 0);
  // the message body itself may contain newlines
  const okMultiline = await post({ ...VALID_FIELDS, message: 'Line one\nLine two\n\nLine four' }, { fetchImpl: captureResend().fetchImpl });
  assert.equal(okMultiline.status, 200);
});

test('11. a cross-site request is rejected (403) and never calls Resend', async () => {
  const resend = captureResend();
  const secFetch = await handleContactRequest({
    method: 'POST',
    headers: sameOriginHeaders({ 'sec-fetch-site': 'cross-site' }),
    rawBody: JSON.stringify(VALID_FIELDS),
    env: VALID_ENV,
    fetchImpl: resend.fetchImpl,
  });
  assert.equal(secFetch.status, 403);

  const foreignOrigin = await handleContactRequest({
    method: 'POST',
    headers: sameOriginHeaders({ origin: 'https://evil.example', host: 'portfolio.example' }),
    rawBody: JSON.stringify(VALID_FIELDS),
    env: VALID_ENV,
    fetchImpl: resend.fetchImpl,
  });
  assert.equal(foreignOrigin.status, 403);
  assert.equal(resend.calls.length, 0);

  // No CORS is emitted for any response.
  assert.equal(foreignOrigin.headers['Access-Control-Allow-Origin'], undefined);
});

test('11b. isDisallowedCrossSiteRequest: same-origin / same-site / no-signal pass; cross-site / foreign-origin / opaque fail', () => {
  assert.equal(isDisallowedCrossSiteRequest({ 'sec-fetch-site': 'same-origin', origin: 'https://a.example', host: 'a.example' }), false);
  assert.equal(isDisallowedCrossSiteRequest({ 'sec-fetch-site': 'same-site', origin: 'https://a.example', host: 'a.example' }), false);
  assert.equal(isDisallowedCrossSiteRequest({ 'x-forwarded-host': 'a.example', origin: 'https://a.example' }), false, 'x-forwarded-host is honored');
  assert.equal(isDisallowedCrossSiteRequest({}), false, 'a non-browser client with no signal is left to the edge');
  assert.equal(isDisallowedCrossSiteRequest({ 'sec-fetch-site': 'cross-site' }), true);
  assert.equal(isDisallowedCrossSiteRequest({ origin: 'https://evil.example', host: 'a.example' }), true);
  assert.equal(isDisallowedCrossSiteRequest({ origin: 'null', host: 'a.example' }), true);
});

// ---------------------------------------------------------------------------
// 9. Honeypot
// ---------------------------------------------------------------------------
test('9. a populated honeypot returns a generic success and Resend is NEVER invoked', async () => {
  const resend = captureResend();
  const res = await post({ ...VALID_FIELDS, companyWebsite: 'http://spam.example' }, { fetchImpl: resend.fetchImpl });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { ok: true }, 'no "isBot" flag is exposed to the requester');
  assert.equal(resend.calls.length, 0, 'the Resend transport must never run for a honeypot hit');
});

// ---------------------------------------------------------------------------
// 12. Missing server configuration
// ---------------------------------------------------------------------------
test('12. missing server configuration is 503 and leaks no secret / recipient', async () => {
  const resend = captureResend();
  for (const env of [
    {},
    { RESEND_API_KEY: 're_x' },
    { RESEND_API_KEY: 're_x', CONTACT_TO_EMAIL: 'owner@example.com' },
    { RESEND_API_KEY: 're_x', CONTACT_TO_EMAIL: 'not-an-email', CONTACT_FROM_EMAIL: 'a@b.example' },
  ] as ContactServiceEnv[]) {
    const res = await handleContactRequest({
      method: 'POST',
      headers: sameOriginHeaders(),
      rawBody: JSON.stringify(VALID_FIELDS),
      env,
      fetchImpl: resend.fetchImpl,
    });
    assert.equal(res.status, 503, JSON.stringify(env));
    const text = JSON.stringify(res.body);
    assert.doesNotMatch(text, /re_x|owner@example\.com|RESEND/i, 'no secret / recipient in the body');
  }
  assert.equal(resend.calls.length, 0);
});

// ---------------------------------------------------------------------------
// 13-14. Provider failure / timeout
// ---------------------------------------------------------------------------
test('13. a Resend non-2xx is a generic 502 and the raw provider body is NOT exposed', async () => {
  const fetchImpl = (async () =>
    new Response(JSON.stringify({ name: 'validation_error', message: 'secret internal detail' }), { status: 422 })) as typeof fetch;
  const res = await post(VALID_FIELDS, { fetchImpl });
  assert.equal(res.status, 502);
  assert.doesNotMatch(JSON.stringify(res.body), /validation_error|secret internal detail/);
});

test('14. a Resend timeout is a bounded generic failure (503), not a hang', async () => {
  const stalled = ((_i: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    })) as typeof fetch;
  const started = Date.now();
  const res = await post(VALID_FIELDS, { fetchImpl: stalled, timeoutMs: 20 });
  assert.equal(res.status, 503);
  assert.ok(Date.now() - started < 2_000, 'must not hang waiting on the provider');
});

// ---------------------------------------------------------------------------
// Bounded body reader (adapter seam)
// ---------------------------------------------------------------------------
function fakeStream(chunks: Array<Uint8Array | string>, headers: Record<string, string> = {}) {
  let destroyed = false;
  return {
    headers,
    destroy() {
      destroyed = true;
    },
    get destroyed() {
      return destroyed;
    },
    async *[Symbol.asyncIterator]() {
      for (const c of chunks) {
        if (destroyed) return;
        yield c;
      }
    },
  };
}

test('readBoundedRequestBody returns the body when under the cap', async () => {
  const { body, tooLarge } = await readBoundedRequestBody(fakeStream(['{"a":', '1}']), CONTACT_MAX_BODY_BYTES);
  assert.equal(tooLarge, false);
  assert.equal(body, '{"a":1}');
});

test('readBoundedRequestBody rejects an over-cap Content-Length before reading any body', async () => {
  const stream = fakeStream(['x'.repeat(100)], { 'content-length': String(CONTACT_MAX_BODY_BYTES + 1) });
  const { body, tooLarge } = await readBoundedRequestBody(stream, CONTACT_MAX_BODY_BYTES);
  assert.equal(tooLarge, true);
  assert.equal(body, null);
});

test('readBoundedRequestBody aborts the stream the moment accumulated bytes exceed the cap', async () => {
  const big = 'x'.repeat(1024);
  const stream = fakeStream(Array.from({ length: 40 }, () => big)); // 40 KiB total, cap 16 KiB
  const { body, tooLarge } = await readBoundedRequestBody(stream, 16 * 1024);
  assert.equal(tooLarge, true);
  assert.equal(body, null);
  assert.equal(stream.destroyed, true, 'the underlying stream is destroyed, not drained');
});

// ---------------------------------------------------------------------------
// Vercel Node-ESM safety of the emitted api/contact graph
// ---------------------------------------------------------------------------
test('api/contact.ts and its runtime graph use explicit .js specifiers that resolve to real sources', () => {
  const files = ['api/contact.ts', 'src/services/contactService.ts', 'src/utils/contactValidation.ts'];
  for (const rel of files) {
    const src = readFileSync(path.resolve(rel), 'utf8');
    const specifiers = [...src.matchAll(/^\s*import\s[^'"]*['"](\.[^'"]+)['"]/gm)].map((m) => m[1]);
    for (const spec of specifiers) {
      assert.match(spec, /\.js$/, `${rel}: relative import "${spec}" must carry an explicit .js extension for Node ESM`);
      const resolved = path.resolve(path.dirname(path.resolve(rel)), spec.replace(/\.js$/, '.ts'));
      assert.ok(existsSync(resolved), `${rel}: "${spec}" does not resolve to a source file`);
    }
  }
});

// ---------------------------------------------------------------------------
// No server secret is reachable from browser-side configuration
// ---------------------------------------------------------------------------
test('no browser-side source references a VITE_-prefixed contact secret or reads a raw server secret from import.meta.env', () => {
  const browserFiles = [
    'src/utils/contactDelivery.ts',
    'src/components/ContactPage.tsx',
    'src/config/portfolioConfig.ts',
    'src/utils/contactValidation.ts',
  ];
  const forbidden = [
    /VITE_RESEND_API_KEY/,
    /VITE_CONTACT_TO_EMAIL/,
    /VITE_CONTACT_FROM_EMAIL/,
    /import\.meta\.env[^;\n]*\bRESEND_API_KEY\b/,
    /import\.meta\.env[^;\n]*\bCONTACT_TO_EMAIL\b/,
    /import\.meta\.env[^;\n]*\bCONTACT_FROM_EMAIL\b/,
  ];
  for (const rel of browserFiles) {
    const src = readFileSync(path.resolve(rel), 'utf8');
    for (const pattern of forbidden) {
      assert.doesNotMatch(src, pattern, `${rel} must not reference ${pattern}`);
    }
  }
  // The server core is the ONLY place these names live, and it reads them from
  // an injected env object, never import.meta.env.
  const serviceSrc = readFileSync(path.resolve('src/services/contactService.ts'), 'utf8');
  assert.doesNotMatch(serviceSrc, /import\.meta\.env/, 'the server core must not touch import.meta.env');
});
