import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GITHUB_SNAPSHOT } from '../src/data/githubSnapshot.generated';
import { getCapabilityCoreTechnology, projectUsesCapability } from '../src/utils/capabilityAssociations';
import {
  normalizeCapabilityIconKey,
  resolveCapabilityIcon,
  deriveFallbackGlyph
} from '../src/utils/capabilityIconRegistry';

// ---------------------------------------------------------------------------
// 1. Coverage: Every Active Capability Node Resolves to Valid Icon Descriptor
// ---------------------------------------------------------------------------
test('1. Every capability node in the active snapshot resolves to a valid vector icon or deterministic fallback', () => {
  const skills = GITHUB_SNAPSHOT.skills;
  assert.ok(skills.length > 0, 'Snapshot must contain capability skills');

  for (const skill of skills) {
    const coreTech = getCapabilityCoreTechnology(skill);
    assert.ok(coreTech.length > 0, `Skill ${skill.code} must have a valid core technology name`);

    const icon = resolveCapabilityIcon(coreTech);
    assert.ok(icon, `Icon descriptor for ${coreTech} must not be null/undefined`);
    assert.ok(icon.type === 'vector' || icon.type === 'fallback', `Icon for ${coreTech} must be vector or fallback`);

    if (icon.type === 'vector') {
      assert.ok(icon.path && icon.path.length > 10, `Vector icon for ${coreTech} must contain SVG path data`);
      assert.ok(icon.title && icon.title.length > 0, `Vector icon for ${coreTech} must have a title`);
    } else {
      assert.ok(icon.text && icon.text.length > 0, `Fallback icon for ${coreTech} must have fallback glyph text`);
    }
  }
});

// ---------------------------------------------------------------------------
// 2. Normalization: Canonical Alias Resolution
// ---------------------------------------------------------------------------
test('2. normalizeCapabilityIconKey correctly normalizes technology aliases and casing', () => {
  // Node.js
  assert.equal(normalizeCapabilityIconKey('Node.js'), 'nodejs');
  assert.equal(normalizeCapabilityIconKey('NodeJS'), 'nodejs');
  assert.equal(normalizeCapabilityIconKey('node.js'), 'nodejs');
  assert.equal(normalizeCapabilityIconKey('node js'), 'nodejs');
  assert.equal(normalizeCapabilityIconKey('Node.js & Application Architecture'), 'nodejs');

  // PostgreSQL
  assert.equal(normalizeCapabilityIconKey('PostgreSQL'), 'postgresql');
  assert.equal(normalizeCapabilityIconKey('Postgres'), 'postgresql');
  assert.equal(normalizeCapabilityIconKey('postgresql (pg)'), 'postgresql');
  assert.equal(normalizeCapabilityIconKey('pg'), 'postgresql');

  // TypeScript / JavaScript
  assert.equal(normalizeCapabilityIconKey('TypeScript'), 'typescript');
  assert.equal(normalizeCapabilityIconKey('TS'), 'typescript');
  assert.equal(normalizeCapabilityIconKey('JavaScript'), 'javascript');
  assert.equal(normalizeCapabilityIconKey('JS'), 'javascript');

  // Next.js / NestJS
  assert.equal(normalizeCapabilityIconKey('Next.js'), 'nextjs');
  assert.equal(normalizeCapabilityIconKey('NextJS'), 'nextjs');
  assert.equal(normalizeCapabilityIconKey('NestJS'), 'nestjs');
  assert.equal(normalizeCapabilityIconKey('Nest.js'), 'nestjs');

  // React / React Native
  assert.equal(normalizeCapabilityIconKey('React'), 'react');
  assert.equal(normalizeCapabilityIconKey('React.js'), 'react');
  assert.equal(normalizeCapabilityIconKey('React Native'), 'reactnative');
  assert.equal(normalizeCapabilityIconKey('react-native'), 'reactnative');

  // Docker, Redis, Tailwind, Prisma
  assert.equal(normalizeCapabilityIconKey('Docker'), 'docker');
  assert.equal(normalizeCapabilityIconKey('docker-compose'), 'docker');
  assert.equal(normalizeCapabilityIconKey('Redis'), 'redis');
  assert.equal(normalizeCapabilityIconKey('ioredis'), 'redis');
  assert.equal(normalizeCapabilityIconKey('Tailwind CSS'), 'tailwindcss');
  assert.equal(normalizeCapabilityIconKey('Prisma'), 'prisma');
  assert.equal(normalizeCapabilityIconKey('Prisma ORM'), 'prisma');
});

// ---------------------------------------------------------------------------
// 3. Fallback System: Deterministic Glyphs for Unmapped Concepts
// ---------------------------------------------------------------------------
test('3. deriveFallbackGlyph generates expected uppercase glyphs for known engineering concepts', () => {
  assert.equal(deriveFallbackGlyph('REST API'), 'API');
  assert.equal(deriveFallbackGlyph('API Architecture'), 'API');
  assert.equal(deriveFallbackGlyph('Authentication'), 'AUTH');
  assert.equal(deriveFallbackGlyph('RBAC'), 'AUTH');
  assert.equal(deriveFallbackGlyph('WebSockets Gateway'), 'WS');
  assert.equal(deriveFallbackGlyph('CI/CD Pipeline'), 'CI');
  assert.equal(deriveFallbackGlyph('System Architecture'), 'ARCH');
  assert.equal(deriveFallbackGlyph('Message Queue'), 'QUEUE');
  assert.equal(deriveFallbackGlyph('Distributed Database'), 'DB');
  assert.equal(deriveFallbackGlyph('Unit Testing'), 'TEST');
  assert.equal(deriveFallbackGlyph('Cloud Infrastructure'), 'INFRA');
  assert.equal(deriveFallbackGlyph('State Management'), 'STATE');
});

test('4. Unknown technology produces deterministic initials and never throws or returns blank', () => {
  const unknown1 = resolveCapabilityIcon('Quantum Computing Architecture');
  assert.equal(unknown1.type, 'fallback');
  if (unknown1.type === 'fallback') {
    assert.equal(unknown1.text, 'ARCH'); // keyword match
  }

  const unknown2 = resolveCapabilityIcon('Hyper Dimensional Matrix');
  assert.equal(unknown2.type, 'fallback');
  if (unknown2.type === 'fallback') {
    assert.equal(unknown2.text, 'HDM'); // initials
  }

  const empty = resolveCapabilityIcon('');
  assert.equal(empty.type, 'fallback');
  if (empty.type === 'fallback') {
    assert.equal(empty.text, 'SYS');
  }

  // Fallback stability
  const res1 = resolveCapabilityIcon('Specialized Neural Mesh');
  const res2 = resolveCapabilityIcon('Specialized Neural Mesh');
  assert.deepEqual(res1, res2, 'Same input must produce identical fallback on repeated calls');
});

// ---------------------------------------------------------------------------
// 5. Representative Mapped Technologies
// ---------------------------------------------------------------------------
test('5. Primary technology identities resolve to recognized vector representations', () => {
  const expectedVectors = [
    { label: 'React', title: 'React' },
    { label: 'TypeScript', title: 'TypeScript' },
    { label: 'Node.js', title: 'Node.js' },
    { label: 'PostgreSQL', title: 'PostgreSQL' },
    { label: 'Docker', title: 'Docker' },
    { label: 'Redis', title: 'Redis' },
    { label: 'Prisma', title: 'Prisma' },
    { label: 'Next.js', title: 'Next.js' },
    { label: 'NestJS', title: 'NestJS' },
    { label: 'Express', title: 'Express' },
    { label: 'Fastify', title: 'Fastify' },
    { label: 'MongoDB', title: 'MongoDB' },
    { label: 'MySQL', title: 'MySQL' },
    { label: 'SQLite', title: 'SQLite' },
    { label: 'PHP', title: 'PHP' },
    { label: 'Python', title: 'Python' },
    { label: 'Tailwind CSS', title: 'Tailwind CSS' },
    { label: 'Vitest', title: 'Vitest' },
    { label: 'Jest', title: 'Jest' },
    { label: 'Socket.IO', title: 'Socket.IO' },
    { label: 'Go', title: 'Go' },
    { label: 'Rust', title: 'Rust' }
  ];

  for (const exp of expectedVectors) {
    const icon = resolveCapabilityIcon(exp.label);
    assert.equal(icon.type, 'vector', `${exp.label} must resolve to a vector icon`);
    if (icon.type === 'vector') {
      assert.equal(icon.title, exp.title);
      assert.ok(icon.path && icon.path.length > 20, `${exp.label} must have valid path string`);
    }
  }
});

// ---------------------------------------------------------------------------
// 6. Presentation Safety: Association Logic & Data Remains Pure
// ---------------------------------------------------------------------------
test('6. projectUsesCapability and underlying association logic remain unmodified', () => {
  const sampleProject = GITHUB_SNAPSHOT.projects[0];
  assert.ok(sampleProject, 'Sample project must exist');

  const reactSkill = GITHUB_SNAPSHOT.skills.find(s => s.name.includes('React'));
  assert.ok(reactSkill, 'React skill must exist');

  // towerdesk-mobile-app uses React
  const usesReact = projectUsesCapability(sampleProject, reactSkill);
  assert.equal(usesReact, true, 'Association evaluation must remain valid and unmodified');
});

// ---------------------------------------------------------------------------
// 7. Source Invariant: TopologyCanvas Renders CapabilityIcon Component
// ---------------------------------------------------------------------------
test('7. TopologyCanvas.tsx renders CapabilityIcon inside capability plinth', () => {
  const canvasSource = readFileSync(resolve(process.cwd(), 'src/components/TopologyCanvas.tsx'), 'utf8');

  // Verify CapabilityIcon import
  assert.ok(canvasSource.includes("import { CapabilityIcon } from './CapabilityIcon';"), 'TopologyCanvas must import CapabilityIcon');

  // Verify CapabilityIcon usage
  assert.ok(canvasSource.includes('<CapabilityIcon'), 'TopologyCanvas must render CapabilityIcon');
  assert.ok(canvasSource.includes('label={getCapabilityCoreTechnology(skill)}'), 'CapabilityIcon must receive core technology label');

  // Verify concentric circles bullseye glyph is replaced
  assert.ok(!canvasSource.includes('Inner architectural hatch ring'), 'Generic bullseye comment must be replaced');

  // Verify capability text labels remain intact
  assert.ok(canvasSource.includes('{getCapabilityCoreTechnology(skill)}'), 'Capability core technology text label must remain rendered');
  assert.ok(canvasSource.includes('{skill.systemCount} SYSTEMS'), 'System count text label must remain rendered');
});

// ---------------------------------------------------------------------------
// 8. Accessibility & Zero Network Runtime
// ---------------------------------------------------------------------------
test('8. CapabilityIcon and icon registry introduce zero runtime network fetch or remote URLs', () => {
  const registrySource = readFileSync(resolve(process.cwd(), 'src/utils/capabilityIconRegistry.ts'), 'utf8');
  const iconSource = readFileSync(resolve(process.cwd(), 'src/components/CapabilityIcon.tsx'), 'utf8');

  assert.ok(!registrySource.includes('fetch('), 'Registry must not perform runtime fetch');
  assert.ok(!registrySource.includes('http://'), 'Registry must not contain http URLs');
  assert.ok(!registrySource.includes('https://'), 'Registry must not contain https URLs');

  assert.ok(iconSource.includes('aria-hidden="true"'), 'CapabilityIcon must specify aria-hidden="true"');
});
