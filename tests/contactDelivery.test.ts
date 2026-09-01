import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ContactDeliveryError,
  deliverContact,
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
