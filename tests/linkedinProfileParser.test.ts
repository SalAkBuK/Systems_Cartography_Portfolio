import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGeneratedOwnerProfile, parseLinkedInProfileText, toExperienceNodes } from '../scripts/linkedinProfileParser';

const mainLines = [
  'Example Engineer',
  'Full Stack Engineer | React Native, Next.js, Node.js',
  'Islamabad, Pakistan',
  'Summary',
  'Builds reliable web and mobile systems with React Native, Next.js, Node.js, and PostgreSQL.',
  'Experience',
  'ExampleCo',
  '1 year',
  'Full Stack Engineer',
  'December 2025 - Present (9 months)',
  'Islamabad, Pakistan',
  '• Promoted from React Developer based on contributions across the stack.',
  '• Built backend APIs with Next.js and PostgreSQL.',
  'React Developer',
  'September 2025 - November 2025 (3 months)',
  'Islamabad, Pakistan',
  '• Developed mobile features with React Native and JavaScript.',
  'Earlier Co',
  'Web Development Intern (MERN Stack)',
  'July 2024 - September 2024 (3 months)',
  'Islamabad, Pakistan',
  '• Developed MERN applications using MongoDB, Express.js, React, and Node.js.',
  'Education',
  'Example University',
  'Bachelor, Computer Science'
];

const sidebarLines = [
  'Contact',
  'engineer@example.com',
  'www.linkedin.com/in/example-',
  'engineer (LinkedIn)',
  'Top Skills',
  'TypeScript',
  'PostgreSQL',
  'Certifications',
  'Example Data Certificate',
  'Specialization',
  'Example Data Certificate',
  'Specialization'
];

test('parses LinkedIn PDF text into chronological owner experience', () => {
  const parsed = parseLinkedInProfileText(mainLines, sidebarLines);
  const nodes = toExperienceNodes(parsed.experience);

  assert.equal(parsed.name, 'Example Engineer');
  assert.equal(parsed.linkedin, 'https://www.linkedin.com/in/example-engineer');
  assert.equal(parsed.experience.length, 3);
  assert.equal(nodes[0].role, 'Full Stack Engineer');
  assert.equal(nodes[0].endDate, null);
  assert.equal(nodes[0].progressionGroup, 'exampleco');
  assert.equal(nodes[0].progressionOrder, 2);
  assert.equal(nodes[0].promotionNote, 'PROMOTED FROM PREVIOUS ROLE');
  assert.equal(nodes[1].progressionOrder, 1);
  assert.equal(nodes[2].organization, 'Earlier Co');
});

test('deduplicates certifications and keeps ambiguous education raw', () => {
  const parsed = parseLinkedInProfileText(mainLines, sidebarLines);

  assert.deepEqual(parsed.certifications, ['Example Data Certificate Specialization']);
  assert.ok(parsed.warnings.some(warning => warning.includes('Duplicate certification')));
  assert.ok(parsed.warnings.some(warning => warning.includes('Education entries are retained as raw lines')));
  assert.deepEqual(parsed.education, ['Example University', 'Bachelor, Computer Science']);
});

test('builds a source-controlled profile snapshot from reviewed import data', () => {
  const parsed = parseLinkedInProfileText(mainLines, sidebarLines);
  const generated = buildGeneratedOwnerProfile(parsed, 'https://github.com/example', '2026-08-27T00:00:00.000Z');

  assert.equal(generated.githubTarget, 'https://github.com/example');
  assert.equal(generated.operator.role, 'Full Stack Engineer');
  assert.equal(generated.experience[0].code, 'EXP-01');
  assert.equal(generated.source.kind, 'linkedin_pdf');
  assert.equal(generated.source.reviewed, true);
});
