import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMailtoUrl, isSafeHttpUrl, sanitizeEmailAddress, sanitizeHttpUrl } from '../src/utils/urlSecurity';
import { applyProjectLinkOverrides } from '../src/utils/portfolioUtils';
import type { ProjectData } from '../src/types';

test('1. isSafeHttpUrl allows valid HTTPS and HTTP URLs', () => {
  assert.equal(isSafeHttpUrl('https://github.com/SalAkBuK'), true);
  assert.equal(isSafeHttpUrl('http://localhost:3000'), true);
  assert.equal(isSafeHttpUrl('https://example.com/sub/path?param=value#hash'), true);
  assert.equal(isSafeHttpUrl('https://subdomain.domain.org:8443/app'), true);
  assert.equal(isSafeHttpUrl('  https://example.com  '), true); // trims whitespace
});

test('2. isSafeHttpUrl strictly rejects javascript: schemes (XSS prevention)', () => {
  assert.equal(isSafeHttpUrl('javascript:alert(1)'), false);
  assert.equal(isSafeHttpUrl('JAVASCRIPT:alert(1)'), false);
  assert.equal(isSafeHttpUrl('JavaScript:void(0)'), false);
  assert.equal(isSafeHttpUrl('javascript://example.com/%0Aalert(1)'), false);
  assert.equal(isSafeHttpUrl('  javascript:/*comment*/alert(1)  '), false);
});

test('3. isSafeHttpUrl strictly rejects other dangerous or non-HTTP schemes', () => {
  assert.equal(isSafeHttpUrl('data:text/html,<script>alert(1)</script>'), false);
  assert.equal(isSafeHttpUrl('data:image/svg+xml;base64,...'), false);
  assert.equal(isSafeHttpUrl('vbscript:msgbox(1)'), false);
  assert.equal(isSafeHttpUrl('file:///etc/passwd'), false);
  assert.equal(isSafeHttpUrl('blob:https://example.com/uuid'), false);
  assert.equal(isSafeHttpUrl('ftp://ftp.example.com'), false);
});

test('4. isSafeHttpUrl rejects relative, protocol-relative, and empty inputs', () => {
  assert.equal(isSafeHttpUrl(''), false);
  assert.equal(isSafeHttpUrl('   '), false);
  assert.equal(isSafeHttpUrl(null), false);
  assert.equal(isSafeHttpUrl(undefined), false);
  assert.equal(isSafeHttpUrl('/relative/path'), false);
  assert.equal(isSafeHttpUrl('//example.com'), false);
  assert.equal(isSafeHttpUrl('example.com/demo'), false);
  assert.equal(isSafeHttpUrl('http://'), false); // no hostname
  assert.equal(isSafeHttpUrl('https://'), false); // no hostname
});

test('5. sanitizeHttpUrl trims valid URLs and returns undefined for unsafe ones', () => {
  assert.equal(sanitizeHttpUrl('  https://example.com/app  '), 'https://example.com/app');
  assert.equal(sanitizeHttpUrl('javascript:alert(1)'), undefined);
  assert.equal(sanitizeHttpUrl(null), undefined);
  assert.equal(sanitizeHttpUrl('not a url'), undefined);
});

test('6. applyProjectLinkOverrides strips malicious demo URLs from projects', () => {
  const mockProjects: ProjectData[] = [
    {
      id: 'proj-1',
      code: 'GH-01',
      title: 'malicious-repo',
      tagline: 'Test tagline',
      status: 'ACTIVE',
      category: 'backend',
      year: '2025',
      dimensions: { width: 100, height: 100, levels: 1 },
      infrastructureDeps: [],
      summary: 'Test summary',
      problem: 'Test problem',
      solution: 'Test solution',
      architectureNotes: 'Architecture notes',
      resilienceTesting: 'Resilience testing',
      accentColor: '#C3E54E',
      metrics: [],
      subsystems: [],
      keyDecisions: [],
      techStack: ['Node.js'],
      links: {
        github: 'https://github.com/SalAkBuK/malicious-repo',
        demo: 'javascript:alert("pwned")',
        caseStudy: false
      },
      gridPosition: { x: 0, y: 0 },
      provenance: {
        summary: 'VERIFIED',
        problem: 'VERIFIED',
        solution: 'VERIFIED',
        subsystems: 'VERIFIED',
        keyDecisions: 'VERIFIED',
        resilienceTesting: 'VERIFIED'
      }
    }
  ];

  const sanitized = applyProjectLinkOverrides(mockProjects, {});
  assert.equal(sanitized[0].links.demo, undefined, 'Malicious javascript: demo link must be stripped');

  // Override with a safe URL works
  const withSafeOverride = applyProjectLinkOverrides(mockProjects, {
    'malicious-repo': 'https://safe-demo.com'
  });
  assert.equal(withSafeOverride[0].links.demo, 'https://safe-demo.com');

  // Override with another dangerous URL is stripped
  const withDangerousOverride = applyProjectLinkOverrides(mockProjects, {
    'malicious-repo': 'data:text/html,<script>alert(1)</script>'
  });
  assert.equal(withDangerousOverride[0].links.demo, undefined);
});

test('7. HTTP URL validation rejects credentials and control-character normalization tricks', () => {
  assert.equal(sanitizeHttpUrl('https://user:password@example.com/private'), undefined);
  assert.equal(sanitizeHttpUrl('http:\n//example.com'), undefined);
  assert.equal(sanitizeHttpUrl('https://example.com/path\u007fmore'), undefined);
  assert.equal(sanitizeHttpUrl('https://example.com/%0Ajavascript:alert(1)'), 'https://example.com/%0Ajavascript:alert(1)');
});

test('8. email and mailto builders reject header injection and encode user-supplied fields', () => {
  assert.equal(sanitizeEmailAddress('owner@example.com'), 'owner@example.com');
  assert.equal(sanitizeEmailAddress('owner@example.com\r\nBcc: attacker@example.com'), undefined);
  assert.equal(sanitizeEmailAddress('not-an-email'), undefined);
  assert.equal(buildMailtoUrl('owner@example.com', {
    subject: 'Hello & review',
    body: 'Line one\nLine two'
  }), 'mailto:owner@example.com?subject=Hello%20%26%20review&body=Line%20one%0ALine%20two');
  assert.equal(buildMailtoUrl('owner@example.com\nBcc: attacker@example.com'), undefined);
});
