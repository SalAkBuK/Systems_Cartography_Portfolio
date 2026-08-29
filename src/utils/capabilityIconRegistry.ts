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

export interface VectorIconDescriptor {
  type: 'vector';
  path: string;
  viewBox?: string;
  title: string;
  scale?: number;
}

export interface FallbackIconDescriptor {
  type: 'fallback';
  text: string;
  title: string;
}

export type CapabilityIconDescriptor = VectorIconDescriptor | FallbackIconDescriptor;

/**
 * Direct mapping of normalized technology keys to their verified Simple Icons exports.
 * Only technologies present in the current capability inventory are mapped.
 * Note: React Native reuses the verified React family atom mark from Simple Icons under its distinct identity.
 * Optional optical scale compensates for varying intrinsic whitespace/aspect ratios.
 */
const VECTOR_ICON_MAP: Record<string, { path: string; title: string; viewBox?: string; scale?: number }> = {
  react: { path: siReact.path, title: siReact.title },
  typescript: { path: siTypescript.path, title: siTypescript.title },
  tailwindcss: { path: siTailwindcss.path, title: siTailwindcss.title },
  nodejs: { path: siNodedotjs.path, title: siNodedotjs.title },
  express: { path: siExpress.path, title: siExpress.title, scale: 1.15 },
  javascript: { path: siJavascript.path, title: siJavascript.title },
  nextjs: { path: siNextdotjs.path, title: siNextdotjs.title },
  vitest: { path: siVitest.path, title: siVitest.title },
  jest: { path: siJest.path, title: siJest.title, scale: 1.05 },
  socketdotio: { path: siSocketdotio.path, title: siSocketdotio.title },
  docker: { path: siDocker.path, title: siDocker.title },
  postgresql: { path: siPostgresql.path, title: siPostgresql.title },
  python: { path: siPython.path, title: siPython.title },
  reactnative: { path: siReact.path, title: 'React Native' },
  fastify: { path: siFastify.path, title: siFastify.title, scale: 1.10 },
  mongodb: { path: siMongodb.path, title: siMongodb.title },
  mysql: { path: siMysql.path, title: siMysql.title, scale: 1.24 },
  nestjs: { path: siNestjs.path, title: siNestjs.title },
  php: { path: siPhp.path, title: siPhp.title, scale: 1.20 },
  prisma: { path: siPrisma.path, title: siPrisma.title },
  redis: { path: siRedis.path, title: siRedis.title },
  sqlite: { path: siSqlite.path, title: siSqlite.title, scale: 1.12 }
};

/**
 * Normalizes raw capability labels or technology identifiers into a canonical icon key.
 */
export function normalizeCapabilityIconKey(rawLabel: string): string {
  if (!rawLabel || typeof rawLabel !== 'string') return '';

  const trimmed = rawLabel.trim();
  // Strip compound capability titles if passed full name (e.g. "Node.js & Application Architecture" -> "Node.js")
  const baseName = trimmed.split(/\s+&\s+|\s+\/\s+/)[0].trim().toLowerCase();

  // Explicit aliases
  if (baseName === 'node' || baseName === 'node.js' || baseName === 'nodejs' || baseName === 'node js' || baseName.startsWith('node.')) {
    return 'nodejs';
  }
  if (baseName === 'postgres' || baseName === 'postgresql' || baseName === 'postgresql (pg)' || baseName === 'pg') {
    return 'postgresql';
  }
  if (baseName === 'typescript' || baseName === 'ts') {
    return 'typescript';
  }
  if (baseName === 'javascript' || baseName === 'js') {
    return 'javascript';
  }
  if (baseName === 'next' || baseName === 'next.js' || baseName === 'nextjs') {
    return 'nextjs';
  }
  if (baseName === 'nest' || baseName === 'nestjs' || baseName === 'nest.js' || baseName.startsWith('@nestjs/')) {
    return 'nestjs';
  }
  if (baseName === 'react native' || baseName === 'react-native' || baseName === 'reactnative') {
    return 'reactnative';
  }
  if (baseName === 'react' || baseName === 'react.js' || baseName === 'reactjs' || baseName === 'react dom' || baseName === 'react-dom') {
    return 'react';
  }
  if (baseName === 'tailwind' || baseName === 'tailwindcss' || baseName === 'tailwind css') {
    return 'tailwindcss';
  }
  if (baseName === 'docker' || baseName === 'dockerfile' || baseName === 'docker-compose') {
    return 'docker';
  }
  if (baseName === 'redis' || baseName === 'ioredis') {
    return 'redis';
  }
  if (baseName === 'prisma' || baseName === 'prisma orm' || baseName === 'prisma client' || baseName.startsWith('@prisma/')) {
    return 'prisma';
  }
  if (baseName === 'express' || baseName === 'express.js' || baseName === 'expressjs') {
    return 'express';
  }
  if (baseName === 'fastify') {
    return 'fastify';
  }
  if (baseName === 'socket.io' || baseName === 'socketio' || baseName === 'socket.io client') {
    return 'socketdotio';
  }
  if (baseName === 'mongodb' || baseName === 'mongo' || baseName === 'mongoose') {
    return 'mongodb';
  }
  if (baseName === 'mysql' || baseName === 'mysql2') {
    return 'mysql';
  }
  if (baseName === 'sqlite' || baseName === 'sqlite3' || baseName === 'better-sqlite3') {
    return 'sqlite';
  }
  if (baseName === 'php' || baseName.startsWith('php ') || baseName.startsWith('php/') || baseName === 'pdo') {
    return 'php';
  }
  if (baseName === 'python' || baseName.startsWith('python ') || baseName.startsWith('python/')) {
    return 'python';
  }
  if (baseName === 'vitest') {
    return 'vitest';
  }
  if (baseName === 'jest' || baseName === 'jest-expo') {
    return 'jest';
  }
  if (baseName === 'playwright' || baseName.startsWith('@playwright/')) {
    return 'playwright';
  }
  if (baseName === 'bullmq') {
    return 'bullmq';
  }

  // Generic clean alphanumeric fallback key
  return baseName.replace(/[^a-z0-9]/g, '');
}

/**
 * Generates a deterministic short uppercase text glyph for unmapped concepts or unavailable technology brands.
 */
export function deriveFallbackGlyph(label: string): string {
  if (!label || typeof label !== 'string') return 'SYS';

  const clean = label.trim().toUpperCase();
  const lower = clean.toLowerCase();

  // Explicit mappings for unavailable brands & known concepts
  if (lower.includes('playwright')) return 'PW';
  if (lower.includes('bullmq') || lower.includes('bull-mq')) return 'BMQ';
  if (lower === 'react native' || lower === 'react-native') return 'RN';

  if (lower.includes('api') || lower.includes('endpoint') || lower.includes('rest')) return 'API';
  if (lower.includes('auth') || lower.includes('rbac') || lower.includes('oauth') || lower.includes('jwt')) return 'AUTH';
  if (lower.includes('websocket') || lower.includes('gateway')) return 'WS';
  if (lower.includes('ci/cd') || lower === 'ci' || lower.includes('pipeline')) return 'CI';
  if (lower.includes('architecture') || lower.includes('architect')) return 'ARCH';
  if (lower.includes('queue') || lower.includes('buffer')) return 'QUEUE';
  if (lower.includes('database') || lower.includes('storage')) return 'DB';
  if (lower.includes('testing') || lower.includes('test')) return 'TEST';
  if (lower.includes('infra') || lower.includes('cloud')) return 'INFRA';
  if (lower.includes('state') || lower.includes('store')) return 'STATE';

  // Words breakdown
  const words = clean.split(/[\s\-_\/]+/).filter(w => w.length > 0);
  if (words.length >= 2) {
    // 2-3 letter acronym from first letters
    const initials = words.map(w => w[0]).join('').slice(0, 3);
    return initials || 'SYS';
  }

  // Single word: take first 3-4 chars
  if (clean.length <= 4) return clean;
  return clean.slice(0, 3);
}

/**
 * Resolves any technology label into a verified vector icon or deterministic fallback.
 * Guaranteed never to throw, never to return null/undefined, and never to require network assets.
 */
export function resolveCapabilityIcon(rawLabel: string): CapabilityIconDescriptor {
  const normalizedKey = normalizeCapabilityIconKey(rawLabel);
  const mapped = VECTOR_ICON_MAP[normalizedKey];

  if (mapped) {
    return {
      type: 'vector',
      path: mapped.path,
      viewBox: mapped.viewBox || '0 0 24 24',
      title: mapped.title,
      scale: mapped.scale
    };
  }

  const fallbackText = deriveFallbackGlyph(rawLabel);
  return {
    type: 'fallback',
    text: fallbackText,
    title: rawLabel ? rawLabel.trim() : 'System Capability'
  };
}
