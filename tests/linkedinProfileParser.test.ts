import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildGeneratedOwnerProfile,
  NO_EXPERIENCE_WARNING,
  parseLinkedInProfileText,
  toExperienceNodes,
  parseDateRange,
  partitionSections
} from '../scripts/linkedinProfileParser';
import {
  zeroExperienceLinkedInMainLines,
  zeroExperienceLinkedInSidebarLines
} from './fixtures/linkedinProfileZeroExperience';

const standardMainLines = [
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

const standardSidebarLines = [
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

test('1. parses LinkedIn PDF text into chronological owner experience', () => {
  const parsed = parseLinkedInProfileText(standardMainLines, standardSidebarLines);
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

test('2. deduplicates certifications and keeps ambiguous education raw', () => {
  const parsed = parseLinkedInProfileText(standardMainLines, standardSidebarLines);

  assert.deepEqual(parsed.certifications, ['Example Data Certificate Specialization']);
  assert.ok(parsed.warnings.some(warning => warning.includes('Duplicate certification')));
  assert.ok(parsed.warnings.some(warning => warning.includes('Education entries are retained as raw lines')));
  assert.deepEqual(parsed.education, ['Example University', 'Bachelor, Computer Science']);
});

test('3. builds a source-controlled profile snapshot from reviewed import data', () => {
  const parsed = parseLinkedInProfileText(standardMainLines, standardSidebarLines);
  const generated = buildGeneratedOwnerProfile(parsed, 'https://github.com/example', '2026-08-27T00:00:00.000Z');

  assert.equal(generated.githubTarget, 'https://github.com/example');
  assert.equal(generated.operator.role, 'Full Stack Engineer');
  assert.equal(generated.experience[0].code, 'EXP-01');
  assert.equal(generated.source.kind, 'linkedin_pdf');
  assert.equal(generated.source.reviewed, true);
});

test('4. parses modern abbreviated date formats and middle-dot duration suffixes', () => {
  const modernMainLines = [
    'Alice Smith',
    'Principal Distributed Systems Engineer',
    'Austin, Texas, United States',
    'Experience',
    'CloudScale Inc.',
    '2 yrs 3 mos',
    'Principal Engineer',
    'Dec 2024 - Present · 4 mos',
    'Austin, Texas',
    '• Designed distributed consensus protocols.',
    'Senior Systems Engineer',
    'Jan 2023 - Nov 2024 · 1 yr 11 mos',
    'Austin, Texas',
    '• Maintained high throughput RPC services.'
  ];

  const parsed = parseLinkedInProfileText(modernMainLines, ['Contact', 'alice@cloudscale.com']);
  assert.equal(parsed.name, 'Alice Smith');
  assert.equal(parsed.headline, 'Principal Distributed Systems Engineer');
  assert.equal(parsed.experience.length, 2);
  assert.equal(parsed.experience[0].startDate, '2024-12');
  assert.equal(parsed.experience[0].endDate, null);
  assert.equal(parsed.experience[1].startDate, '2023-01');
  assert.equal(parsed.experience[1].endDate, '2024-11');
});

test('5. handles extra whitespace, casing variations, and colons in headings', () => {
  const casingLines = [
    'Bob Vance',
    'Vance Refrigeration Lead',
    'Scranton, PA',
    '   PROFESSIONAL EXPERIENCE:   ',
    'Vance Refrigeration',
    'Lead Engineer',
    '2021 - 2024',
    'Scranton, PA',
    '• Led refrigeration automation.',
    'EDUCATION:',
    'Scranton Technical Institute'
  ];

  const parsed = parseLinkedInProfileText(casingLines, []);
  assert.equal(parsed.name, 'Bob Vance');
  assert.equal(parsed.experience.length, 1);
  assert.equal(parsed.experience[0].organization, 'Vance Refrigeration');
  assert.equal(parsed.education.length, 1);
});

test('6. correctly parses profiles without a Summary section directly into Experience', () => {
  const noSummaryLines = [
    'Charlie Delta',
    'Software Architect',
    'Berlin, Germany',
    'Work Experience',
    'Alpha Corp',
    'Architect',
    'June 2022 - Present',
    '• Designed core infrastructure.'
  ];

  const parsed = parseLinkedInProfileText(noSummaryLines, []);
  assert.equal(parsed.name, 'Charlie Delta');
  assert.equal(parsed.headline, 'Software Architect');
  assert.equal(parsed.location, 'Berlin, Germany');
  assert.equal(parsed.summary, '');
  assert.equal(parsed.experience.length, 1);
});

test('7. handles section re-ordering such as Education appearing before Experience', () => {
  const reorderedLines = [
    'Diana Prince',
    'Security Engineer',
    'London, UK',
    'Education',
    'Oxford University',
    'MSc Cybersecurity',
    'Experience',
    'Shield Systems',
    'Lead Security Analyst',
    'Mar 2020 - Dec 2023',
    '• Audited infrastructure.'
  ];

  const parsed = parseLinkedInProfileText(reorderedLines, []);
  assert.equal(parsed.name, 'Diana Prince');
  assert.equal(parsed.education.length, 2);
  assert.equal(parsed.experience.length, 1);
  assert.equal(parsed.experience[0].organization, 'Shield Systems');
});

test('8. throws honest diagnostic error when no extractable text is present', () => {
  assert.throws(
    () => parseLinkedInProfileText([], []),
    (err: Error) => {
      assert.ok(err.message.includes('No extractable text found in PDF'));
      return true;
    }
  );
});

test('9. throws honest diagnostic error when identity is missing', () => {
  assert.throws(
    () => parseLinkedInProfileText(['   '], []),
    (err: Error) => {
      assert.ok(err.message.includes('Profile identity') || err.message.includes('No extractable text'));
      return true;
    }
  );
});

test('10. rejects a document without Experience when it lacks recognizable LinkedIn export structure', () => {
  const linesWithoutExperience = [
    'Evan Wright',
    'Technical Writer',
    'Summary',
    'Wrote books.',
    'Education',
    'Columbia University'
  ];

  assert.throws(
    () => parseLinkedInProfileText(linesWithoutExperience, []),
    (err: Error) => {
      assert.ok(err.message.includes('does not contain enough recognizable LinkedIn profile structure'));
      return true;
    }
  );
});

test('11. throws honest diagnostic error when Experience heading exists but 0 roles are parsed', () => {
  const emptyExperienceLines = [
    'Fiona Gallagher',
    'Operations Manager',
    'Chicago, IL',
    'Experience',
    'No valid job date entries here just unstructured text that has no dates'
  ];

  assert.throws(
    () => parseLinkedInProfileText(emptyExperienceLines, []),
    (err: Error) => {
      assert.ok(err.message.includes('no valid role or date records could be parsed'));
      return true;
    }
  );
});

test('12. parses a recognizable LinkedIn profile with no Experience section', () => {
  const parsed = parseLinkedInProfileText(
    zeroExperienceLinkedInMainLines,
    zeroExperienceLinkedInSidebarLines
  );

  assert.equal(parsed.name, 'Jordan Candidate');
  assert.equal(parsed.headline, 'Full-stack Web Development Student');
  assert.equal(parsed.location, 'Lorton, Virginia, United States');
  assert.equal(parsed.linkedin, 'https://www.linkedin.com/in/jordan-candidate');
  assert.deepEqual(parsed.experience, []);
  assert.deepEqual(parsed.education, [
    'The George Washington University',
    'Full-stack Web Development',
    'University of Portsmouth',
    'Bachelor of Science in Computing'
  ]);
  assert.deepEqual(parsed.topSkills, ['Software Projects', 'IT Projects']);
  assert.deepEqual(parsed.certifications, ['Certificate in Programming']);
  assert.ok(parsed.warnings.includes(NO_EXPERIENCE_WARNING));
});

test('13. builds a generated owner profile without inventing employment for zero-experience imports', () => {
  const parsed = parseLinkedInProfileText(
    zeroExperienceLinkedInMainLines,
    zeroExperienceLinkedInSidebarLines
  );
  const generated = buildGeneratedOwnerProfile(parsed, 'https://github.com/jordan-candidate', '2026-08-30T00:00:00.000Z');

  assert.deepEqual(generated.experience, []);
  assert.deepEqual(generated.education, [
    { raw: 'The George Washington University' },
    { raw: 'Full-stack Web Development' },
    { raw: 'University of Portsmouth' },
    { raw: 'Bachelor of Science in Computing' }
  ]);
  assert.ok(generated.source.warnings.includes(NO_EXPERIENCE_WARNING));
});

test('14. unrelated document text still fails LinkedIn profile recognition', () => {
  const unrelatedMain = [
    'Quarterly Operations Report',
    'Prepared for Example Holdings',
    'New York, New York',
    'Summary',
    'Revenue and operating metrics for the second quarter.'
  ];
  const unrelatedSidebar = [
    'Contact',
    'analyst@example.com',
    'www.linkedin.com/in/example-analyst'
  ];

  assert.throws(
    () => parseLinkedInProfileText(unrelatedMain, unrelatedSidebar),
    (err: Error) => {
      assert.ok(err.message.includes('does not contain enough recognizable LinkedIn profile structure'));
      return true;
    }
  );
});

test('15. profiles with Experience retain the existing parse behavior and no zero-experience warning', () => {
  const parsed = parseLinkedInProfileText(standardMainLines, standardSidebarLines);

  assert.equal(parsed.experience.length, 3);
  assert.equal(parsed.experience[0].organization, 'ExampleCo');
  assert.equal(parsed.experience[0].role, 'Full Stack Engineer');
  assert.ok(!parsed.warnings.includes(NO_EXPERIENCE_WARNING));
});
