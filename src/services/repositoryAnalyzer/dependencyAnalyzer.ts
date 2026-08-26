import { AnalyzedDependencies, RawRepositoryInspection } from './types';

/**
 * Known packages dictionary with layer mappings
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

  // 1. Analyze package.json if present
  if (inspection.packageJsonContent) {
    try {
      const pkg = JSON.parse(inspection.packageJsonContent);
      
      const allDeps: Record<string, string> = {
        ...(pkg.dependencies || {}),
        ...(pkg.devDependencies || {}),
        ...(pkg.peerDependencies || {})
      };

      for (const [depName] of Object.entries(allDeps)) {
        const mapped = PACKAGE_LAYER_MAP[depName];
        if (mapped) {
          if (!result.frameworks[mapped.layer].includes(mapped.label)) {
            result.frameworks[mapped.layer].push(mapped.label);
          }
        }
      }

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
    } catch {
      // Invalid JSON
    }
  }

  // 2. Check pnpm-workspace / turbo
  if (inspection.pnpmWorkspaceYaml || inspection.turboJson) {
    result.isMonorepo = true;
    if (!result.frameworks.devops.includes('Turborepo') && inspection.turboJson) {
      result.frameworks.devops.push('Turborepo');
    }
  }

  // 3. Scan tree files for monorepos, docker, and other ecosystems
  if (inspection.treeFiles && inspection.treeFiles.length > 0) {
    const files = inspection.treeFiles;

    const hasApps = files.some(f => f.startsWith('apps/') || f.startsWith('packages/'));
    if (hasApps) {
      result.isMonorepo = true;
    }

    if (files.some(f => f.includes('Dockerfile') || f.includes('docker-compose') || f.includes('compose.yml'))) {
      if (!result.frameworks.devops.includes('Docker')) {
        result.frameworks.devops.push('Docker');
      }
    }

    if (files.some(f => f.includes('prisma/schema.prisma'))) {
      if (!result.frameworks.database.includes('Prisma')) {
        result.frameworks.database.push('Prisma');
      }
    }

    if (files.some(f => f.includes('.github/workflows/'))) {
      if (!result.frameworks.devops.includes('GitHub Actions')) {
        result.frameworks.devops.push('GitHub Actions');
      }
    }

    // Go ecosystem
    if (files.some(f => f.endsWith('go.mod'))) {
      result.primaryEcosystem = 'Go';
      if (!result.frameworks.backend.includes('Go Module')) result.frameworks.backend.push('Go Module');
    }

    // Rust ecosystem
    if (files.some(f => f.endsWith('Cargo.toml'))) {
      result.primaryEcosystem = 'Rust';
      if (!result.frameworks.backend.includes('Cargo / Rust')) result.frameworks.backend.push('Cargo / Rust');
    }

    // Python ecosystem
    if (files.some(f => f.endsWith('requirements.txt') || f.endsWith('pyproject.toml'))) {
      result.primaryEcosystem = 'Python';
      if (!result.frameworks.backend.includes('Python')) result.frameworks.backend.push('Python');
    }
  }

  return result;
}
