import { AnalyzedDependencies, RawRepositoryInspection } from './types';

/**
 * Known Node/TypeScript packages dictionary with layer mappings
 */
const PACKAGE_LAYER_MAP: Record<string, { layer: 'frontend' | 'backend' | 'database' | 'devops' | 'testing' | 'tools'; label: string }> = {
  // Frontend
  'react': { layer: 'frontend', label: 'React' },
  'react-dom': { layer: 'frontend', label: 'React DOM' },
  'vue': { layer: 'frontend', label: 'Vue' },
  'svelte': { layer: 'frontend', label: 'Svelte' },
  'next': { layer: 'frontend', label: 'Next.js' },
  'nuxt': { layer: 'frontend', label: 'Nuxt' },
  'astro': { layer: 'frontend', label: 'Astro' },
  '@remix-run/react': { layer: 'frontend', label: 'Remix' },
  'tailwindcss': { layer: 'frontend', label: 'Tailwind CSS' },
  'zustand': { layer: 'frontend', label: 'Zustand' },
  'redux': { layer: 'frontend', label: 'Redux' },
  '@reduxjs/toolkit': { layer: 'frontend', label: 'Redux Toolkit' },
  '@tanstack/react-query': { layer: 'frontend', label: 'TanStack Query' },
  'expo': { layer: 'frontend', label: 'Expo' },
  'react-native': { layer: 'frontend', label: 'React Native' },
  'three': { layer: 'frontend', label: 'Three.js' },
  'lucide-react': { layer: 'frontend', label: 'Lucide Icons' },
  'framer-motion': { layer: 'frontend', label: 'Framer Motion' },
  'motion': { layer: 'frontend', label: 'Motion' },
  'gsap': { layer: 'frontend', label: 'GSAP' },

  // Backend
  'express': { layer: 'backend', label: 'Express' },
  'fastify': { layer: 'backend', label: 'Fastify' },
  '@nestjs/core': { layer: 'backend', label: 'NestJS' },
  '@nestjs/common': { layer: 'backend', label: 'NestJS' },
  'koa': { layer: 'backend', label: 'Koa' },
  'hono': { layer: 'backend', label: 'Hono' },
  'socket.io': { layer: 'backend', label: 'Socket.IO' },
  'ws': { layer: 'backend', label: 'WebSocket (ws)' },
  'bullmq': { layer: 'backend', label: 'BullMQ' },
  'passport': { layer: 'backend', label: 'Passport' },
  'argon2': { layer: 'backend', label: 'Argon2' },
  'bcrypt': { layer: 'backend', label: 'Bcrypt' },
  '@trpc/server': { layer: 'backend', label: 'tRPC' },
  '@grpc/grpc-js': { layer: 'backend', label: 'gRPC' },
  'nodemailer': { layer: 'backend', label: 'Nodemailer' },

  // Database
  'prisma': { layer: 'database', label: 'Prisma' },
  '@prisma/client': { layer: 'database', label: 'Prisma Client' },
  'drizzle-orm': { layer: 'database', label: 'Drizzle ORM' },
  'typeorm': { layer: 'database', label: 'TypeORM' },
  'sequelize': { layer: 'database', label: 'Sequelize' },
  'mongoose': { layer: 'database', label: 'Mongoose' },
  'pg': { layer: 'database', label: 'PostgreSQL (pg)' },
  'mysql2': { layer: 'database', label: 'MySQL2' },
  'better-sqlite3': { layer: 'database', label: 'better-sqlite3' },
  'sqlite3': { layer: 'database', label: 'SQLite3' },
  'redis': { layer: 'database', label: 'Redis' },
  'ioredis': { layer: 'database', label: 'ioredis' },
  '@supabase/supabase-js': { layer: 'database', label: 'Supabase' },
  'firebase': { layer: 'database', label: 'Firebase' },
  'firebase-admin': { layer: 'database', label: 'Firebase Admin' },

  // Testing
  'vitest': { layer: 'testing', label: 'Vitest' },
  'jest': { layer: 'testing', label: 'Jest' },
  '@playwright/test': { layer: 'testing', label: 'Playwright' },
  'playwright': { layer: 'testing', label: 'Playwright' },
  'cypress': { layer: 'testing', label: 'Cypress' },
  'supertest': { layer: 'testing', label: 'Supertest' },
  'autocannon': { layer: 'testing', label: 'Autocannon (Load)' },
  '@testing-library/react': { layer: 'testing', label: 'React Testing Library' },
  'msw': { layer: 'testing', label: 'Mock Service Worker' },

  // DevOps & Tooling
  'vite': { layer: 'devops', label: 'Vite' },
  'esbuild': { layer: 'devops', label: 'esbuild' },
  'webpack': { layer: 'devops', label: 'Webpack' },
  'turbo': { layer: 'devops', label: 'Turborepo' },
  'typescript': { layer: 'tools', label: 'TypeScript' },
  'eslint': { layer: 'tools', label: 'ESLint' },
  'prettier': { layer: 'tools', label: 'Prettier' },
  'biome': { layer: 'tools', label: 'Biome' }
};

function addFramework(result: AnalyzedDependencies, layer: 'frontend' | 'backend' | 'database' | 'devops' | 'testing' | 'tools', label: string): void {
  if (!result.frameworks[layer].includes(label)) {
    result.frameworks[layer].push(label);
  }
}

function parsePackageJson(content: string, isRoot: boolean, result: AnalyzedDependencies): void {
  try {
    const pkg = JSON.parse(content);
    const allDeps: Record<string, string> = {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
      ...(pkg.peerDependencies || {})
    };

    for (const [depName] of Object.entries(allDeps)) {
      const mapped = PACKAGE_LAYER_MAP[depName];
      if (mapped) {
        addFramework(result, mapped.layer, mapped.label);
      }
    }

    if (isRoot) {
      if (pkg.scripts && typeof pkg.scripts === 'object') {
        result.packageScripts = pkg.scripts;
      }
      if (Array.isArray(pkg.workspaces)) {
        result.workspaces = pkg.workspaces;
        result.isMonorepo = true;
      } else if (pkg.workspaces && Array.isArray(pkg.workspaces.packages)) {
        result.workspaces = pkg.workspaces.packages;
        result.isMonorepo = true;
      }
    }
  } catch {
    // Non-fatal on invalid JSON
  }
}

function parseComposerJson(content: string, result: AnalyzedDependencies): void {
  try {
    const composer = JSON.parse(content);
    const deps: Record<string, string> = {
      ...(composer.require || {}),
      ...(composer['require-dev'] || {})
    };

    for (const dep of Object.keys(deps)) {
      const lower = dep.toLowerCase();
      if (lower === 'laravel/framework') addFramework(result, 'backend', 'Laravel');
      else if (lower === 'phpunit/phpunit') addFramework(result, 'testing', 'PHPUnit');
      else if (lower === 'guzzlehttp/guzzle') addFramework(result, 'tools', 'Guzzle');
      else if (lower === 'doctrine/orm' || lower.startsWith('doctrine/')) addFramework(result, 'database', 'Doctrine');
      else if (lower.startsWith('symfony/')) addFramework(result, 'backend', 'Symfony');
      else if (lower === 'livewire/livewire') addFramework(result, 'frontend', 'Livewire');
      else if (lower === 'filament/filament') addFramework(result, 'tools', 'Filament');
    }

    if (result.primaryEcosystem === 'General') {
      result.primaryEcosystem = 'PHP';
    }
  } catch {
    // Non-fatal
  }
}

function parseGoMod(content: string, result: AnalyzedDependencies): void {
  addFramework(result, 'backend', 'Go Module');
  result.primaryEcosystem = 'Go';

  const lines = content.split('\n');
  for (const rawLine of lines) {
    const line = rawLine.trim().toLowerCase();
    if (line.includes('github.com/gin-gonic/gin')) addFramework(result, 'backend', 'Gin');
    if (line.includes('google.golang.org/grpc') || line.includes('github.com/grpc/grpc-go')) addFramework(result, 'backend', 'gRPC');
    if (line.includes('github.com/lib/pq') || line.includes('github.com/jackc/pgx')) addFramework(result, 'database', 'PostgreSQL Driver');
    if (line.includes('github.com/go-redis/redis') || line.includes('github.com/redis/go-redis')) addFramework(result, 'database', 'Redis Client');
    if (line.includes('github.com/gofiber/fiber')) addFramework(result, 'backend', 'Fiber');
    if (line.includes('github.com/labstack/echo')) addFramework(result, 'backend', 'Echo');
    if (line.includes('gorm.io/gorm')) addFramework(result, 'database', 'GORM');
    if (line.includes('github.com/stretchr/testify')) addFramework(result, 'testing', 'Testify');
  }
}

function parseCargoToml(content: string, result: AnalyzedDependencies): void {
  addFramework(result, 'backend', 'Cargo / Rust');
  result.primaryEcosystem = 'Rust';

  const lines = content.split('\n');
  for (const rawLine of lines) {
    const line = rawLine.trim().toLowerCase();
    if (line.startsWith('axum') || line.includes('"axum"')) addFramework(result, 'backend', 'Axum');
    if (line.startsWith('actix-web') || line.includes('"actix-web"')) addFramework(result, 'backend', 'Actix Web');
    if (line.startsWith('tokio') || line.includes('"tokio"')) addFramework(result, 'backend', 'Tokio');
    if (line.startsWith('sqlx') || line.includes('"sqlx"')) addFramework(result, 'database', 'SQLx');
    if (line.startsWith('diesel') || line.includes('"diesel"')) addFramework(result, 'database', 'Diesel');
    if (line.startsWith('tonic') || line.includes('"tonic"')) addFramework(result, 'backend', 'Tonic (gRPC)');
    if (line.startsWith('serde') || line.includes('"serde"')) addFramework(result, 'tools', 'Serde');
  }
}

function parsePythonManifest(content: string, result: AnalyzedDependencies): void {
  addFramework(result, 'backend', 'Python');
  if (result.primaryEcosystem === 'General') {
    result.primaryEcosystem = 'Python';
  }

  const lines = content.split('\n');
  for (const rawLine of lines) {
    const line = rawLine.trim().toLowerCase();
    if (line.includes('fastapi')) addFramework(result, 'backend', 'FastAPI');
    if (line.includes('django')) addFramework(result, 'backend', 'Django');
    if (line.includes('flask')) addFramework(result, 'backend', 'Flask');
    if (line.includes('sqlalchemy')) addFramework(result, 'database', 'SQLAlchemy');
    if (line.includes('psycopg')) addFramework(result, 'database', 'Psycopg');
    if (line.includes('pytest')) addFramework(result, 'testing', 'pytest');
    if (line.includes('playwright')) addFramework(result, 'testing', 'Playwright');
    if (line.includes('requests')) addFramework(result, 'tools', 'Requests');
    if (line.includes('pydantic')) addFramework(result, 'tools', 'Pydantic');
    if (line.includes('celery')) addFramework(result, 'backend', 'Celery');
  }
}

export function analyzeDependencies(inspection: RawRepositoryInspection): AnalyzedDependencies {
  const result: AnalyzedDependencies = {
    frameworks: {
      frontend: [],
      backend: [],
      database: [],
      devops: [],
      testing: [],
      tools: []
    },
    workspaces: [],
    packageScripts: {},
    isMonorepo: false,
    primaryEcosystem: inspection.language || 'General'
  };

  // 1. Process root package.json if present
  if (inspection.packageJsonContent) {
    parsePackageJson(inspection.packageJsonContent, true, result);
  }

  // 2. Process bounded manifestContents if present
  if (inspection.manifestContents) {
    for (const [manifestPath, content] of Object.entries(inspection.manifestContents)) {
      const fileName = manifestPath.split('/').pop()?.toLowerCase() || '';
      const isRoot = manifestPath === 'package.json' || !manifestPath.includes('/');

      if (fileName === 'package.json') {
        parsePackageJson(content, isRoot, result);
      } else if (fileName === 'composer.json') {
        parseComposerJson(content, result);
      } else if (fileName === 'go.mod') {
        parseGoMod(content, result);
      } else if (fileName === 'cargo.toml') {
        parseCargoToml(content, result);
      } else if (fileName === 'requirements.txt' || fileName === 'pyproject.toml') {
        parsePythonManifest(content, result);
      } else if (fileName === 'turbo.json' || fileName === 'pnpm-workspace.yaml') {
        result.isMonorepo = true;
        if (fileName === 'turbo.json') addFramework(result, 'devops', 'Turborepo');
      }
    }
  }

  // 3. Check pnpm-workspace / turbo fallback
  if (inspection.pnpmWorkspaceYaml || inspection.turboJson) {
    result.isMonorepo = true;
    if (inspection.turboJson) {
      addFramework(result, 'devops', 'Turborepo');
    }
  }

  // 4. Scan tree files for monorepos, docker, and other ecosystems
  if (inspection.treeFiles && inspection.treeFiles.length > 0) {
    const files = inspection.treeFiles;

    const hasApps = files.some(f => f.startsWith('apps/') || f.startsWith('packages/'));
    if (hasApps) {
      result.isMonorepo = true;
    }

    if (files.some(f => f.includes('Dockerfile') || f.includes('docker-compose') || f.includes('compose.yml'))) {
      addFramework(result, 'devops', 'Docker');
    }

    if (files.some(f => f.includes('prisma/schema.prisma'))) {
      addFramework(result, 'database', 'Prisma');
    }

    if (files.some(f => f.includes('.github/workflows/'))) {
      addFramework(result, 'devops', 'GitHub Actions');
    }

    // Go ecosystem fallback
    if (files.some(f => f.endsWith('go.mod'))) {
      result.primaryEcosystem = 'Go';
      addFramework(result, 'backend', 'Go Module');
    }

    // Rust ecosystem fallback
    if (files.some(f => f.endsWith('Cargo.toml'))) {
      result.primaryEcosystem = 'Rust';
      addFramework(result, 'backend', 'Cargo / Rust');
    }

    // Python ecosystem fallback
    if (files.some(f => f.endsWith('requirements.txt') || f.endsWith('pyproject.toml'))) {
      result.primaryEcosystem = 'Python';
      addFramework(result, 'backend', 'Python');
    }
  }

  return result;
}

