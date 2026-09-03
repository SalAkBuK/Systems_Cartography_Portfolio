import test from 'node:test';
import assert from 'node:assert/strict';
import { CONTACT_FIELD_LIMITS, validateContactInput } from '../src/utils/contactValidation';

const validInput = {
  name: 'Visitor',
  email: 'visitor@example.com',
  subject: 'Portfolio inquiry',
  message: 'Hello there.',
  companyWebsite: ''
};

test('contact input is trimmed and accepted at the application boundary', () => {
  const result = validateContactInput({ ...validInput, name: '  Visitor  ' });
  assert.equal(result.valid, true);
  if (result.valid) assert.equal(result.value.name, 'Visitor');
});

test('contact validation rejects honeypot traffic and malformed reply addresses', () => {
  const bot = validateContactInput({ ...validInput, companyWebsite: 'https://spam.invalid' });
  assert.deepEqual(bot, { valid: false, error: 'Submission rejected.', isBot: true });
  assert.equal(validateContactInput({ ...validInput, email: 'victim@example.com\nBcc: attacker@example.com' }).valid, false);
});

test('contact validation enforces every server-independent field ceiling', () => {
  for (const field of ['name', 'email', 'subject', 'message'] as const) {
    const result = validateContactInput({
      ...validInput,
      [field]: 'x'.repeat(CONTACT_FIELD_LIMITS[field] + 1)
    });
    assert.equal(result.valid, false, `${field} must reject values beyond its limit`);
  }
});

test('contact validation rejects CR / LF / control characters in header-adjacent fields but allows newlines in the message body', () => {
  for (const injection of ['Real\nName', 'Real\r\nName', 'Name\x00', 'Name\x1b[0m']) {
    assert.equal(validateContactInput({ ...validInput, name: injection }).valid, false, `name: ${JSON.stringify(injection)}`);
    assert.equal(validateContactInput({ ...validInput, subject: injection }).valid, false, `subject: ${JSON.stringify(injection)}`);
  }
  // the message body legitimately contains newlines
  const ok = validateContactInput({ ...validInput, message: 'First line\nSecond line\n\nSignature' });
  assert.equal(ok.valid, true);
});
