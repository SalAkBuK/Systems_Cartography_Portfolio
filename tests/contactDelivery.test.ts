import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BUILTIN_CONTACT_ENDPOINT_PATH,
  ContactDeliveryError,
  deliverContact,
  isBuiltInContactEndpoint,
  sanitizeContactEndpoint,
  type ContactSubmissionLock
} from '../src/utils/contactDelivery';

const input = {
  name: 'Visitor',
  email: 'visitor@example.com',
  subject: 'Portfolio inquiry',
  message: 'Hello there.',
  companyWebsite: ''
};

test('mail-client fallback blocks same-tick duplicates, then releases the lock for deliberate retry', async () => {
  const lock: ContactSubmissionLock = { inFlight: false };
  const opened: string[] = [];
  const options = {
    input,
    ownerEmail: 'owner@example.com',
    formEndpoint: '',
    lock,
    openMailClient: (url: string) => opened.push(url)
  };

  const first = deliverContact(options);
  const duplicate = await deliverContact(options);
  assert.equal(duplicate.outcome, 'duplicate');
  assert.equal((await first).outcome, 'mail-client-opened');
  assert.equal(lock.inFlight, false);

  const retry = await deliverContact(options);
  assert.equal(retry.outcome, 'mail-client-opened');
  assert.equal(opened.length, 2);
  assert.match(opened[0], /^mailto:owner@example\.com\?/);
});

test('an invalid configured endpoint falls back to mail and is never fetched', async () => {
  const opened: string[] = [];
  let fetchCalls = 0;
  const result = await deliverContact({
    input,
    ownerEmail: 'owner@example.com',
    formEndpoint: 'javascript:alert(1)',
    lock: { inFlight: false },
    fetchImpl: (async () => {
      fetchCalls++;
      return new Response(null, { status: 204 });
    }) as typeof fetch,
    openMailClient: url => opened.push(url)
  });

  assert.equal(result.outcome, 'mail-client-opened');
  assert.equal(fetchCalls, 0);
  assert.equal(opened.length, 1);

  const insecure = await deliverContact({
    input,
    ownerEmail: 'owner@example.com',
    formEndpoint: 'http://forms.example.com/contact',
    lock: { inFlight: false },
    fetchImpl: (async () => {
      fetchCalls++;
      return new Response(null, { status: 204 });
    }) as typeof fetch,
    openMailClient: url => opened.push(url)
  });
  assert.equal(insecure.outcome, 'mail-client-opened');
  assert.equal(fetchCalls, 0);
});

test('a stalled hosted endpoint times out, aborts, and releases the submission lock', async () => {
  const lock: ContactSubmissionLock = { inFlight: false };
  let observedAbort = false;
  const stalledFetch = ((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => {
      observedAbort = true;
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  })) as typeof fetch;

  await assert.rejects(
    deliverContact({
      input,
      ownerEmail: 'owner@example.com',
      formEndpoint: 'https://forms.example.com/contact',
      lock,
      fetchImpl: stalledFetch,
      openMailClient: () => undefined,
      timeoutMs: 5
    }),
    (error: unknown) => {
      assert.ok(error instanceof ContactDeliveryError);
      assert.equal(error.reason, 'timeout');
      return true;
    }
  );

  assert.equal(observedAbort, true);
  assert.equal(lock.inFlight, false);
});

test('a valid HTTPS endpoint posts the validated fields and completes normally', async () => {
  let request: { url: string; init?: RequestInit } | undefined;
  const result = await deliverContact({
    input,
    ownerEmail: 'owner@example.com',
    formEndpoint: 'https://forms.example.com/contact',
    lock: { inFlight: false },
    fetchImpl: (async (url: RequestInfo | URL, init?: RequestInit) => {
      request = { url: url.toString(), init };
      return new Response(null, { status: 204 });
    }) as typeof fetch,
    openMailClient: () => assert.fail('valid endpoints must not open the mail client')
  });

  assert.equal(result.outcome, 'delivered');
  assert.equal(request?.url, 'https://forms.example.com/contact');
  assert.equal(request?.init?.method, 'POST');
  assert.ok(request?.init?.signal instanceof AbortSignal);
  assert.equal((request?.init?.body as FormData).get('email'), input.email);
});

// ---------------------------------------------------------------------------
// First-party /api/contact endpoint
// ---------------------------------------------------------------------------
test('17. sanitizeContactEndpoint accepts the exact built-in /api/contact path', () => {
  assert.equal(sanitizeContactEndpoint('/api/contact'), BUILTIN_CONTACT_ENDPOINT_PATH);
  assert.equal(sanitizeContactEndpoint('  /api/contact  '), BUILTIN_CONTACT_ENDPOINT_PATH);
  assert.equal(isBuiltInContactEndpoint('/api/contact'), true);
  // a real HTTPS endpoint still works (template / fork compatibility)
  assert.equal(sanitizeContactEndpoint('https://formspree.io/f/abc'), 'https://formspree.io/f/abc');
  assert.equal(isBuiltInContactEndpoint('https://formspree.io/f/abc'), false);
});

test('18. arbitrary relative paths remain rejected', () => {
  for (const bad of ['/api/other', '/api/contact/extra', 'contact', '../api/contact', '/api', 'api/contact', '/API/CONTACT', '/api/contact?x=1']) {
    assert.equal(sanitizeContactEndpoint(bad), undefined, bad);
  }
});

test('19. javascript / data / protocol-relative endpoints remain rejected', () => {
  for (const bad of ['javascript:alert(1)', 'data:text/html,x', '//evil.example', '//evil.example/api/contact', 'http://forms.example.com/contact', 'vbscript:x', '']) {
    assert.equal(sanitizeContactEndpoint(bad), undefined, bad);
  }
});

test('20. a built-in /api/contact submission POSTs JSON including the (empty) companyWebsite honeypot key', async () => {
  let request: { url: string; init?: RequestInit } | undefined;
  const result = await deliverContact({
    input,
    ownerEmail: 'owner@example.com',
    formEndpoint: '/api/contact',
    lock: { inFlight: false },
    fetchImpl: (async (url: RequestInfo | URL, init?: RequestInit) => {
      request = { url: url.toString(), init };
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch,
    openMailClient: () => assert.fail('the built-in endpoint must not open the mail client')
  });

  assert.equal(result.outcome, 'delivered');
  assert.equal(request?.url, '/api/contact');
  assert.equal(request?.init?.method, 'POST');
  assert.equal((request?.init?.headers as Record<string, string>)['Content-Type'], 'application/json');
  assert.ok(!(request?.init?.body instanceof FormData), 'the built-in endpoint sends JSON, not multipart FormData');
  const sent = JSON.parse(request?.init?.body as string);
  assert.deepEqual(sent, {
    name: input.name,
    email: input.email,
    subject: input.subject,
    message: input.message,
    companyWebsite: ''
  });
  assert.ok(Object.prototype.hasOwnProperty.call(sent, 'companyWebsite'), 'the honeypot field is always present');
});

test('21. an HTTP 429 maps to a rate-limited ContactDeliveryError (not a generic failure)', async () => {
  await assert.rejects(
    deliverContact({
      input,
      ownerEmail: 'owner@example.com',
      formEndpoint: '/api/contact',
      lock: { inFlight: false },
      fetchImpl: (async () => new Response(JSON.stringify({ ok: false }), { status: 429 })) as typeof fetch,
      openMailClient: () => assert.fail('a 429 must not open the mail client')
    }),
    (error: unknown) => {
      assert.ok(error instanceof ContactDeliveryError);
      assert.equal(error.reason, 'rate-limited');
      return true;
    }
  );
});

test('21b. a non-429 server error stays a generic request-failed error (not rate-limited)', async () => {
  await assert.rejects(
    deliverContact({
      input,
      ownerEmail: 'owner@example.com',
      formEndpoint: '/api/contact',
      lock: { inFlight: false },
      fetchImpl: (async () => new Response(JSON.stringify({ ok: false }), { status: 502 })) as typeof fetch,
      openMailClient: () => undefined
    }),
    (error: unknown) => {
      assert.ok(error instanceof ContactDeliveryError);
      assert.equal(error.reason, 'request-failed');
      return true;
    }
  );
});

test('22. the in-flight submission lock still blocks same-tick duplicates for the built-in endpoint', async () => {
  const lock: ContactSubmissionLock = { inFlight: false };
  let fetchCalls = 0;
  const options = {
    input,
    ownerEmail: 'owner@example.com',
    formEndpoint: '/api/contact',
    lock,
    fetchImpl: (async () => {
      fetchCalls++;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as typeof fetch,
    openMailClient: () => assert.fail('the built-in endpoint must not open the mail client')
  };
  const first = deliverContact(options);
  const duplicate = await deliverContact(options);
  assert.equal(duplicate.outcome, 'duplicate');
  assert.equal((await first).outcome, 'delivered');
  assert.equal(fetchCalls, 1, 'the duplicate never reached the network');
  assert.equal(lock.inFlight, false);
});

test('23. an empty VITE_CONTACT_FORM_ENDPOINT still falls back to the mail client, unchanged', async () => {
  const opened: string[] = [];
  let fetchCalls = 0;
  const result = await deliverContact({
    input,
    ownerEmail: 'owner@example.com',
    formEndpoint: '',
    lock: { inFlight: false },
    fetchImpl: (async () => {
      fetchCalls++;
      return new Response(null, { status: 200 });
    }) as typeof fetch,
    openMailClient: url => opened.push(url)
  });
  assert.equal(result.outcome, 'mail-client-opened');
  assert.equal(fetchCalls, 0);
  assert.match(opened[0], /^mailto:owner@example\.com\?/);
});

test('ContactPage surfaces a distinct message for the rate-limited outcome and keeps the mailto fallback for an empty endpoint', () => {
  const src = readFileSync('src/components/ContactPage.tsx', 'utf8');
  assert.match(src, /error\.reason === 'rate-limited'/, 'ContactPage handles the rate-limited reason explicitly');
  assert.match(src, /Too many contact attempts/i, 'ContactPage shows a wait-and-retry message');
  // the no-endpoint mailto fallback path is untouched
  assert.match(src, /openMailClient/);
  assert.match(src, /No valid form endpoint is configured/);
});
