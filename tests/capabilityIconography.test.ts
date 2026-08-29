import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  siDocker,
  siExpress,
  siFastify,
  siJavascript,
  siJest,
  siMongodb,
  siMysql,
  siNestjs,
  siNextdotjs,
  siNodedotjs,
  siPhp,
  siPostgresql,
  siPrisma,
  siPython,
  siReact,
  siRedis,
  siSocketdotio,
  siSqlite,
  siTailwindcss,
  siTypescript,
  siVitest
} from 'simple-icons';
import { GITHUB_SNAPSHOT } from '../src/data/githubSnapshot.generated';
import { getCapabilityCoreTechnology, projectUsesCapability } from '../src/utils/capabilityAssociations';
import {
  normalizeCapabilityIconKey,
  resolveCapabilityIcon,
  deriveFallbackGlyph
} from '../src/utils/capabilityIconRegistry';

// ---------------------------------------------------------------------------
// 1. Direct Provenance: Mapped Icons Strictly Match Simple Icons Package Exports
// ---------------------------------------------------------------------------
test('1. Verified Simple Icons exports are directly returned for all mapped capability technologies', () => {
  const verifiedMappings = [
    { label: 'React', expectedExport: siReact },
    { label: 'TypeScript', expectedExport: siTypescript },
    { label: 'Tailwind CSS', expectedExport: siTailwindcss },
    { label: 'Node.js', expectedExport: siNodedotjs },
    { label: 'Express', expectedExport: siExpress },
    { label: 'JavaScript', expectedExport: siJavascript },
    { label: 'Next.js', expectedExport: siNextdotjs },
    { label: 'Vitest', expectedExport: siVitest },
    { label: 'Jest', expectedExport: siJest },
    { label: 'Socket.IO', expectedExport: siSocketdotio },
    { label: 'Docker', expectedExport: siDocker },
    { label: 'PostgreSQL', expectedExport: siPostgresql },
    { label: 'Python', expectedExport: siPython },
    { label: 'Fastify', expectedExport: siFastify },
    { label: 'MongoDB', expectedExport: siMongodb },
    { label: 'MySQL', expectedExport: siMysql },
    { label: 'NestJS', expectedExport: siNestjs },
    { label: 'PHP', expectedExport: siPhp },
    { label: 'Prisma', expectedExport: siPrisma },
    { label: 'Redis', expectedExport: siRedis },
    { label: 'SQLite', expectedExport: siSqlite }
  ];

  for (const { label, expectedExport } of verifiedMappings) {
    const icon = resolveCapabilityIcon(label);
    assert.equal(icon.type, 'vector', `${label} must resolve to a vector icon`);
    if (icon.type === 'vector') {
      assert.equal(
        icon.path,
        expectedExport.path,
        `Path for ${label} must exactly match official Simple Icons export ${expectedExport.title}`
      );
      assert.equal(
        icon.title,
        expectedExport.title,
        `Title for ${label} must exactly match official Simple Icons title ${expectedExport.title}`
      );
    }
  }
});

// ---------------------------------------------------------------------------
// 2. Verified Handling of Unavailable Brands (Playwright, BullMQ, React Native)
// ---------------------------------------------------------------------------
test('2. Technologies unavailable in Simple Icons resolve to deterministic fallbacks or documented family marks', () => {
  // Playwright -> Unavailable in simple-icons -> Deterministic PW fallback
  const pw = resolveCapabilityIcon('Playwright');
  assert.equal(pw.type, 'fallback');
  if (pw.type === 'fallback') {
    assert.equal(pw.text, 'PW');
    assert.equal(pw.title, 'Playwright');
  }

  // BullMQ -> Unavailable in simple-icons -> Deterministic BMQ fallback
  const bullmq = resolveCapabilityIcon('BullMQ');
  assert.equal(bullmq.type, 'fallback');
  if (bullmq.type === 'fallback') {
    assert.equal(bullmq.text, 'BMQ');
    assert.equal(bullmq.title, 'BullMQ');
  }

  // React Native -> Distinct key 'reactnative' and title 'React Native', reusing verified siReact.path
  assert.equal(normalizeCapabilityIconKey('React Native'), 'reactnative');
  const rn = resolveCapabilityIcon('React Native');
  assert.equal(rn.type, 'vector');
  if (rn.type === 'vector') {
    assert.equal(rn.path, siReact.path, 'React Native reuses verified React atom vector mark');
    assert.equal(rn.title, 'React Native', 'React Native maintains its distinct identity title');
  }
});

// ---------------------------------------------------------------------------
// 3. Complete Snapshot Coverage: All 24 Active Capability Nodes Resolve
// ---------------------------------------------------------------------------
test('3. Every capability node in the active snapshot resolves to a valid descriptor', () => {
  const skills = GITHUB_SNAPSHOT.skills;
  assert.equal(skills.length, 24, 'Snapshot must contain exactly 24 capability skills');

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
// 4. Normalization: Canonical Alias Resolution
// ---------------------------------------------------------------------------
test('4. normalizeCapabilityIconKey correctly normalizes technology aliases and casing', () => {
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
// 5. Fallback System: Deterministic Glyphs for Unmapped Concepts
// ---------------------------------------------------------------------------
test('5. deriveFallbackGlyph generates expected uppercase glyphs for known engineering concepts', () => {
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

test('6. Unknown technology produces deterministic initials and never throws or returns blank', () => {
  const unknown = resolveCapabilityIcon('Hyper Dimensional Matrix');
  assert.equal(unknown.type, 'fallback');
  if (unknown.type === 'fallback') {
    assert.equal(unknown.text, 'HDM');
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
// 7. Provenance Invariant: Registry Imports Simple Icons & Has No Hardcoded Paths
// ---------------------------------------------------------------------------
test('7. capabilityIconRegistry.ts imports directly from simple-icons without hardcoded SVG paths', () => {
  const registrySource = readFileSync(resolve(process.cwd(), 'src/utils/capabilityIconRegistry.ts'), 'utf8');

  // Verify import from 'simple-icons'
  assert.ok(registrySource.includes("from 'simple-icons'"), 'Registry must import directly from simple-icons');

  // Verify no hardcoded SVG path strings (e.g. M12..., M14...) in VECTOR_ICON_MAP
  assert.ok(!registrySource.includes("path: 'M"), 'Registry must not contain hardcoded raw SVG path strings');
  assert.ok(!registrySource.includes('path: "M'), 'Registry must not contain hardcoded raw SVG path strings');

  // Verify no speculative future icons
  assert.ok(!registrySource.includes('siGo'), 'Registry must not contain unused speculative siGo icon');
  assert.ok(!registrySource.includes('siRust'), 'Registry must not contain unused speculative siRust icon');
  assert.ok(!registrySource.includes('siLinux'), 'Registry must not contain unused speculative siLinux icon');
});

// ---------------------------------------------------------------------------
// 8. Presentation Safety: Association Logic & Data Remains Pure
// ---------------------------------------------------------------------------
test('8. projectUsesCapability and underlying association logic remain unmodified', () => {
  const sampleProject = GITHUB_SNAPSHOT.projects[0];
  assert.ok(sampleProject, 'Sample project must exist');

  const reactSkill = GITHUB_SNAPSHOT.skills.find(s => s.name.includes('React'));
  assert.ok(reactSkill, 'React skill must exist');

  // towerdesk-mobile-app uses React
  const usesReact = projectUsesCapability(sampleProject, reactSkill);
  assert.equal(usesReact, true, 'Association evaluation must remain valid and unmodified');
});

// ---------------------------------------------------------------------------
// 9. Source Invariant: TopologyCanvas Renders CapabilityIcon Component
// ---------------------------------------------------------------------------
test('9. TopologyCanvas.tsx renders CapabilityIcon inside capability plinth', () => {
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
// 10. Accessibility & Zero Network Runtime
// ---------------------------------------------------------------------------
test('10. CapabilityIcon and icon registry introduce zero runtime network fetch or remote URLs', () => {
  const registrySource = readFileSync(resolve(process.cwd(), 'src/utils/capabilityIconRegistry.ts'), 'utf8');
  const iconSource = readFileSync(resolve(process.cwd(), 'src/components/CapabilityIcon.tsx'), 'utf8');

  assert.ok(!registrySource.includes('fetch('), 'Registry must not perform runtime fetch');
  assert.ok(!registrySource.includes('http://'), 'Registry must not contain http URLs');
  assert.ok(!registrySource.includes('https://'), 'Registry must not contain https URLs');

  assert.ok(iconSource.includes('aria-hidden="true"'), 'CapabilityIcon must specify aria-hidden="true"');
});
