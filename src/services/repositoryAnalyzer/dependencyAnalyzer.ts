import { AnalyzedDependencies, RawRepositoryInspection } from './types';
import { analyzeN8nWorkflows } from './n8nWorkflowAnalyzer';
import { analyzeVercelFunctions } from './vercelFunctionAnalyzer';

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
  let inDependenciesSection = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    // Check for section header [section] or [[section]]
    const sectionMatch = line.match(/^\[+([a-zA-Z0-9_.\-'"]+)\]+/);
    if (sectionMatch) {
      const sectionName = sectionMatch[1].toLowerCase().replace(/['"]/g, '');
      inDependenciesSection = /^(workspace\.)?(dev-|build-)?dependencies$/i.test(sectionName) ||
        /^target\..*\.(dev-|build-)?dependencies$/i.test(sectionName);
      continue;
    }

    if (!inDependenciesSection) continue;

    const eqIdx = line.indexOf('=');
    const depKey = (eqIdx >= 0 ? line.slice(0, eqIdx) : line).trim().toLowerCase().replace(/['"]/g, '');

    if (depKey === 'axum') addFramework(result, 'backend', 'Axum');
    else if (depKey === 'actix-web' || depKey === 'actix_web') addFramework(result, 'backend', 'Actix Web');
    else if (depKey === 'tokio') addFramework(result, 'backend', 'Tokio');
    else if (depKey === 'sqlx') addFramework(result, 'database', 'SQLx');
    else if (depKey === 'diesel') addFramework(result, 'database', 'Diesel');
    else if (depKey === 'tonic') addFramework(result, 'backend', 'Tonic (gRPC)');
    else if (depKey === 'serde') addFramework(result, 'tools', 'Serde');
  }
}

function parsePyprojectToml(content: string, result: AnalyzedDependencies): void {
  addFramework(result, 'backend', 'Python');
  if (result.primaryEcosystem === 'General') {
    result.primaryEcosystem = 'Python';
  }

  const lines = content.split('\n');
  let currentSection = '';
  let inArrayDependencies = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const sectionMatch = line.match(/^\[+([a-zA-Z0-9_.\-'"]+)\]+/);
    if (sectionMatch) {
      currentSection = sectionMatch[1].toLowerCase().replace(/['"]/g, '');
      inArrayDependencies = false;
      continue;
    }

    const isPoetryOrPdmOrFlitDepSection = 
      /^(tool\.poetry\.dependencies|tool\.poetry\.dev-dependencies|tool\.poetry\.group\..*\.dependencies)$/i.test(currentSection) ||
      /^(tool\.pdm\.(dev-)?dependencies|tool\.flit\.metadata\.requires)$/i.test(currentSection) ||
      /^(project\.dependencies|project\.optional-dependencies(\..*)?)$/i.test(currentSection);

    if (currentSection === 'project') {
      if (/^dependencies\s*=\s*\[/i.test(line)) {
        inArrayDependencies = true;
      }
      if (inArrayDependencies && line.includes(']')) {
        inArrayDependencies = false;
      }
    }

    if (!isPoetryOrPdmOrFlitDepSection && !inArrayDependencies && !currentSection.includes('dependencies')) {
      continue;
    }

    const cleanedLine = line.replace(/['",]/g, '').trim();
    const eqIdx = cleanedLine.indexOf('=');
    const rawPkg = eqIdx >= 0 && isPoetryOrPdmOrFlitDepSection ? cleanedLine.slice(0, eqIdx).trim() : cleanedLine;
    const pkgName = rawPkg.split(/[=><!~;]/)[0].trim().toLowerCase();

    if (pkgName === 'fastapi') addFramework(result, 'backend', 'FastAPI');
    else if (pkgName === 'django') addFramework(result, 'backend', 'Django');
    else if (pkgName === 'flask') addFramework(result, 'backend', 'Flask');
    else if (pkgName === 'sqlalchemy') addFramework(result, 'database', 'SQLAlchemy');
    else if (pkgName === 'psycopg' || pkgName === 'psycopg2' || pkgName === 'psycopg2-binary') addFramework(result, 'database', 'Psycopg');
    else if (pkgName === 'pytest') addFramework(result, 'testing', 'pytest');
    else if (pkgName === 'playwright') addFramework(result, 'testing', 'Playwright');
    else if (pkgName === 'requests') addFramework(result, 'tools', 'Requests');
    else if (pkgName === 'pydantic') addFramework(result, 'tools', 'Pydantic');
    else if (pkgName === 'celery') addFramework(result, 'backend', 'Celery');
  }
}

function parseRequirementsTxt(content: string, result: AnalyzedDependencies): void {
  addFramework(result, 'backend', 'Python');
  if (result.primaryEcosystem === 'General') {
    result.primaryEcosystem = 'Python';
  }

  const lines = content.split('\n');
  for (const rawLine of lines) {
    let line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('-r ') || line.startsWith('-i ')) continue;
    const hashIdx = line.indexOf('#');
    if (hashIdx >= 0) line = line.slice(0, hashIdx).trim();

    const pkgName = line.split(/[=><!~;\[]/)[0].trim().toLowerCase();

    if (pkgName === 'fastapi') addFramework(result, 'backend', 'FastAPI');
    else if (pkgName === 'django') addFramework(result, 'backend', 'Django');
    else if (pkgName === 'flask') addFramework(result, 'backend', 'Flask');
    else if (pkgName === 'sqlalchemy') addFramework(result, 'database', 'SQLAlchemy');
    else if (pkgName === 'psycopg' || pkgName === 'psycopg2' || pkgName === 'psycopg2-binary') addFramework(result, 'database', 'Psycopg');
    else if (pkgName === 'pytest') addFramework(result, 'testing', 'pytest');
    else if (pkgName === 'playwright') addFramework(result, 'testing', 'Playwright');
    else if (pkgName === 'requests') addFramework(result, 'tools', 'Requests');
    else if (pkgName === 'pydantic') addFramework(result, 'tools', 'Pydantic');
    else if (pkgName === 'celery') addFramework(result, 'backend', 'Celery');
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
      } else if (fileName === 'pyproject.toml') {
        parsePyprojectToml(content, result);
      } else if (fileName === 'requirements.txt') {
        parseRequirementsTxt(content, result);
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

  // 3b. n8n workflow exports (structured evidence: JSON node `type` strings).
  //     `n8n` leads so architecture analysis names the workflow subsystem after it.
  const n8n = analyzeN8nWorkflows(inspection.n8nWorkflowContents);
  if (n8n.isN8nProject) {
    if (result.primaryEcosystem === 'General' || !result.primaryEcosystem) {
      result.primaryEcosystem = 'n8n';
    }
    for (const tech of n8n.technologies) {
      addFramework(result, 'backend', tech);
    }
  }

  // 3c. Vercel Functions (structural evidence: a ROOT vercel.json PLUS at least
  //     one ROOT api/*.{ts,js,mjs,cjs} function file). The legacy now.json is
  //     not accepted (Vercel removed support 2026-03-31). Framework-agnostic --
  //     no Express/Fastify/Nest package required. Node.js leads so architecture
  //     / techStack read the runtime before the platform capability. Nothing
  //     here is repository-name aware.
  const vercel = analyzeVercelFunctions(inspection.treeFiles);
  if (vercel.isVercelServerlessProject) {
    if (result.primaryEcosystem === 'General' || !result.primaryEcosystem) {
      result.primaryEcosystem = 'Node.js';
    }
    for (const tech of vercel.technologies) {
      addFramework(result, 'backend', tech);
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

