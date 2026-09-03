import { ExperienceNode, InfrastructureSkill, ProjectData, SystemCategory } from '../types';
import { getRepositoryEvidence } from '../data/repositoryEvidence';
import { formatIsoYearMonth, isProjectLinkedToExperience } from './portfolioUtils';
import { getGithubOwnerIdentity } from './ownerScope';

/**
 * Explicit canonical normalization dictionary.
 * Maps variations, package names, and version suffixes to their canonical names.
 */
const CANONICAL_TECH_MAP: Record<string, string> = {
  // Node.js runtime & aliases
  'node': 'Node.js',
  'node.js': 'Node.js',
  'nodejs': 'Node.js',
  'node js': 'Node.js',
  'node.js runtime': 'Node.js',

  // NestJS
  'nestjs': 'NestJS',
  'nest.js': 'NestJS',
  'nest': 'NestJS',
  '@nestjs/core': 'NestJS',
  '@nestjs/common': 'NestJS',

  // Express
  'express': 'Express',
  'express.js': 'Express',
  'expressjs': 'Express',

  // Fastify
  'fastify': 'Fastify',

  // Koa & Hono
  'koa': 'Koa',
  'hono': 'Hono',

  // Vercel Functions. Eligible ONLY from STRUCTURED evidence -- the deep
  // analyzer's vercelFunctionAnalyzer proves a root vercel.json plus a valid
  // root api/ function path. The spelled-out legacy variants normalize to the
  // current product name. Bare "vercel" (a common "deployed on Vercel" topic on
  // frontend repos) is deliberately NOT mapped.
  'vercel functions': 'Vercel Functions',
  'vercel function': 'Vercel Functions',
  'vercel serverless functions': 'Vercel Functions',
  'vercel serverless function': 'Vercel Functions',
  'vercel serverless': 'Vercel Functions',
  'vercel serverless api': 'Vercel Functions',

  // React & Web UI
  'react': 'React',
  'react.js': 'React',
  'reactjs': 'React',
  'react dom': 'React',
  'react-dom': 'React',

  // React Native & Mobile
  'react native': 'React Native',
  'react-native': 'React Native',
  'reactnative': 'React Native',

  // Next.js
  'next': 'Next.js',
  'next.js': 'Next.js',
  'nextjs': 'Next.js',
  'next.js app router': 'Next.js',
  'next.js api routes': 'Next.js',

  // PostgreSQL
  'postgres': 'PostgreSQL',
  'postgresql': 'PostgreSQL',
  'postgresql (pg)': 'PostgreSQL',
  'pg': 'PostgreSQL',

  // MySQL
  'mysql': 'MySQL',
  'mysql2': 'MySQL',

  // SQLite
  'sqlite': 'SQLite',
  'sqlite3': 'SQLite',
  'better-sqlite3': 'SQLite',

  // MongoDB
  'mongodb': 'MongoDB',
  'mongo': 'MongoDB',
  'mongoose': 'MongoDB',

  // Prisma
  'prisma': 'Prisma',
  'prisma orm': 'Prisma',
  'prisma client': 'Prisma',
  '@prisma/client': 'Prisma',

  // PHP & Ecosystem
  'php': 'PHP',
  'php 8': 'PHP',
  'php8': 'PHP',
  'php 7': 'PHP',
  'php7': 'PHP',
  'pdo': 'PDO',

  // Python
  'python': 'Python',
  'python3': 'Python',
  'python 3': 'Python',

  // Languages
  'typescript': 'TypeScript',
  'ts': 'TypeScript',
  'javascript': 'JavaScript',
  'js': 'JavaScript',
  'go': 'Go',
  'golang': 'Go',
  'rust': 'Rust',

  // Redis & Queues
  'redis': 'Redis',
  'ioredis': 'Redis',
  'bullmq': 'BullMQ',

  // Socket.IO
  'socket.io': 'Socket.IO',
  'socket.io client': 'Socket.IO',
  'socketio': 'Socket.IO',

  // Expo
  'expo': 'Expo',
  'expo router': 'Expo Router',
  'expo securestore': 'Expo SecureStore',
  'expo notifications': 'Expo Notifications',

  // Docker & Containers
  'docker': 'Docker',
  'dockerfile': 'Docker',
  'docker-compose': 'Docker',

  // Tailwind CSS
  'tailwind': 'Tailwind CSS',
  'tailwindcss': 'Tailwind CSS',
  'tailwind css': 'Tailwind CSS',

  // Testing Frameworks
  'playwright': 'Playwright',
  '@playwright/test': 'Playwright',
  'jest': 'Jest',
  'jest-expo': 'Jest',
  'vitest': 'Vitest',
  'cypress': 'Cypress',

  // Workflow automation & integration (evidence: n8n workflow JSON node types,
  // or an exact GitHub topic). n8n workflow exports are structured evidence --
  // each node carries a machine-readable `type` -- so the technologies below
  // are derived from node types, never from README/description prose.
  'n8n': 'n8n',
  'n8n.io': 'n8n',
  'n8n workflow': 'n8n',
  'n8n-workflow': 'n8n',
  'n8n-nodes-base': 'n8n',
  'google sheets': 'Google Sheets',
  'google-sheets': 'Google Sheets',
  'googlesheets': 'Google Sheets',
  'gsheets': 'Google Sheets',
  'google sheets api': 'Google Sheets',
  'whatsapp cloud api': 'WhatsApp Cloud API',
  'whatsapp-cloud-api': 'WhatsApp Cloud API',
  'whatsapp business api': 'WhatsApp Cloud API',
  'whatsapp business cloud': 'WhatsApp Cloud API',
  'whatsapp api': 'WhatsApp Cloud API',
  'webhook': 'Webhooks',
  'webhooks': 'Webhooks',

  // Utilities / Data
  'curl': 'cURL',
  'json': 'JSON',
  'json cache': 'JSON Cache',
  'jsonl': 'JSONL',
  'bootstrap': 'Bootstrap',
  'zustand': 'Zustand',
  'tanstack query': 'TanStack Query',
  '@tanstack/react-query': 'TanStack Query',
  'react query': 'TanStack Query',
  'rbac': 'RBAC'
};

/**
 * Explicit technology family and runtime ancestry map.
 * Used to establish verified relationships (e.g. NestJS is a Node.js framework).
 * NOTE: TypeScript/JavaScript alone DO NOT map to Node.js.
 */
const TECHNOLOGY_FAMILY_MAP: Record<string, string[]> = {
  // Node.js backend/runtime family
  'NestJS': ['Node.js'],
  'Express': ['Node.js'],
  'Fastify': ['Node.js'],
  'Koa': ['Node.js'],
  'BullMQ': ['Node.js'],
  // NOTE: 'Vercel Functions' is deliberately NOT mapped to Node.js here. Vercel
  // Functions run on multiple runtimes (Node.js, Python, Go, Ruby, Edge); the
  // platform name alone proves no runtime. The deep analyzer's
  // vercelFunctionAnalyzer emits an explicit 'Node.js' tech alongside it ONLY
  // for JS/TS (.ts/.js/.mjs/.cjs) function files, so a JS/TS Vercel project
  // still satisfies the Node.js capability -- through direct evidence, not
  // through global family ancestry.

  // React ecosystem
  'React Native': ['React'],
  'Expo Router': ['React Native', 'React', 'Expo'],
  'Expo': ['React Native', 'React'],
  'Next.js': ['React'],

  // Database / ORM families
  'Prisma Client': ['Prisma'],
  'Prisma ORM': ['Prisma'],
  'MySQL2': ['MySQL'],
  'PostgreSQL (pg)': ['PostgreSQL'],
  'better-sqlite3': ['SQLite'],
  'SQLite3': ['SQLite'],
  'Mongoose': ['MongoDB'],
  'ioredis': ['Redis'],

  // PHP family
  'PHP 8': ['PHP'],
  'PHP 7': ['PHP'],
  'PDO': ['PHP']
};

/**
 * Normalizes any raw technology name conservatively into canonical form.
 */
export function normalizeTechnologyName(tech: string): string {
  if (!tech || typeof tech !== 'string') return '';
  const trimmed = tech.trim();
  const lower = trimmed.toLowerCase();
  
  if (CANONICAL_TECH_MAP[lower]) {
    return CANONICAL_TECH_MAP[lower];
  }

  // Handle common version suffixes cleanly (e.g., "PHP 8.2" -> "PHP", "Python 3.11" -> "Python")
  if (lower.startsWith('php ') || lower.startsWith('php/')) return 'PHP';
  if (lower.startsWith('python ') || lower.startsWith('python/')) return 'Python';
  if (lower.startsWith('node ') || lower.startsWith('node/')) return 'Node.js';

  return trimmed;
}

/**
 * Retrieves all technology families / ancestors for a normalized technology name.
 */
export function getTechnologyFamilies(normalizedTech: string): string[] {
  const families = new Set<string>();
  if (!normalizedTech) return [];

  families.add(normalizedTech);

  const directFamilies = TECHNOLOGY_FAMILY_MAP[normalizedTech] || [];
  for (const parent of directFamilies) {
    const normalizedParent = normalizeTechnologyName(parent);
    families.add(normalizedParent);
    const higherFamilies = TECHNOLOGY_FAMILY_MAP[normalizedParent] || [];
    for (const higher of higherFamilies) {
      families.add(normalizeTechnologyName(higher));
    }
  }

  return Array.from(families);
}

/**
 * Extracts the core technology string from a capability object or skill name.
 * e.g., "Node.js & Application Architecture" -> "Node.js"
 */
export function getCapabilityCoreTechnology(capability: InfrastructureSkill | string): string {
  if (!capability) return '';
  const rawName = typeof capability === 'string' ? capability : capability.name;
  if (!rawName) return '';

  // Extract text before " & " or " / " if present
  const baseName = rawName.split(/\s+&\s+|\s+\/\s+/)[0].trim();
  return normalizeTechnologyName(baseName);
}

/**
 * Extracts all verified structured technology evidence attached to a ProjectData node.
 */
export function getProjectTechnologyEvidence(project: Partial<ProjectData>): string[] {
  if (!project) return [];
  const techSet = new Set<string>();

  // 1. Direct techStack
  (project.techStack || []).forEach(t => {
    if (t && typeof t === 'string') techSet.add(t.trim());
  });

  // 2. Subsystem technologies
  (project.subsystems || []).forEach(sub => {
    (sub.tech || []).forEach(t => {
      if (t && typeof t === 'string') techSet.add(t.trim());
    });
  });

  // 3. Fallback to reviewed repositoryEvidence if subsystems were not yet populated.
  // Owner-scoped via the project's own GitHub link so a foreign project never
  // inherits this owner's curated evidence merely by sharing a repo name.
  if ((!project.subsystems || project.subsystems.length === 0) && project.title) {
    const ownerIdentity = getGithubOwnerIdentity(project.links?.github);
    const curated = getRepositoryEvidence(project.title, ownerIdentity);
    if (curated?.subsystems) {
      curated.subsystems.forEach(sub => {
        (sub.tech || []).forEach(t => {
          if (t && typeof t === 'string') techSet.add(t.trim());
        });
      });
    }
  }

  // 4. Structured validation evidence
  if (project.validationEvidence) {
    const val = project.validationEvidence;
    (val.testFrameworks || []).forEach(t => techSet.add(t.trim()));
    (val.buildTools || []).forEach(t => techSet.add(t.trim()));
    (val.e2eHarnesses || []).forEach(t => techSet.add(t.trim()));
    (val.lintersAndFormatters || []).forEach(t => techSet.add(t.trim()));
  }

  return Array.from(techSet);
}

/**
 * Unified semantic predicate: checks if a project uses a capability based on normalized technology evidence.
 * Consumed by TopologyCanvas, RightInspectorPanel, forceLayout, and githubService.
 */
export function projectUsesCapability(
  project: Partial<ProjectData>,
  capability: InfrastructureSkill | string
): boolean {
  if (!project || !capability) return false;

  const targetCoreTech = getCapabilityCoreTechnology(capability);
  if (!targetCoreTech) return false;

  const skillId = typeof capability === 'object' ? capability.id : null;
  const projectId = project.id || null;

  // 1. Check explicit ID links if already established on both objects
  if (skillId && project.infrastructureDeps && project.infrastructureDeps.includes(skillId)) {
    return true;
  }
  if (projectId && typeof capability === 'object' && capability.usedInProjects && capability.usedInProjects.includes(projectId)) {
    return true;
  }

  // 2. Evaluate project technology evidence surface
  const evidenceList = getProjectTechnologyEvidence(project);
  for (const rawTech of evidenceList) {
    const normalized = normalizeTechnologyName(rawTech);
    if (normalized === targetCoreTech) {
      return true;
    }

    // Check family ancestry (e.g. NestJS -> Node.js, PHP 8 -> PHP)
    const families = getTechnologyFamilies(normalized);
    if (families.includes(targetCoreTech)) {
      return true;
    }
  }

  return false;
}

export interface CapabilityRolePeriod {
  roleId: string;
  role: string;
  organization: string;
  startDate?: string;
  endDate?: string | null;
  formattedPeriod: string;
}

export interface CapabilityProfessionalHistory {
  hasEvidence: boolean;
  timeSpan: string; // e.g. "JUL 2024 → SEP 2024 · DEC 2025 → PRESENT", "JUL 2024 → SEP 2024", or "UNAVAILABLE"
  roleCount: number;
  periodCount: number;
  periods: CapabilityRolePeriod[];
  matchingRoles: ExperienceNode[];
  provenance: 'DERIVED' | 'UNAVAILABLE';
}

/**
 * Formats a single role's chronology safely without ever synthesizing PRESENT for undefined end dates.
 */
export function formatRolePeriod(role: ExperienceNode): string {
  const start = role.startDate ? formatIsoYearMonth(role.startDate) : null;
  
  if (role.endDate === null) {
    // Explicitly current role
    return start ? `${start} → PRESENT` : 'PRESENT';
  }
  
  if (typeof role.endDate === 'string' && role.endDate.trim().length > 0) {
    const end = formatIsoYearMonth(role.endDate);
    return start ? `${start} → ${end}` : end;
  }
  
  // endDate is undefined or empty: structured end date is UNKNOWN - NEVER synthesize PRESENT
  if (role.yearRange) {
    return role.yearRange.toUpperCase().replace(' - ', ' → ');
  }
  
  return start || 'UNDATED';
}

/**
 * Derives chronological professional history evidence for a capability from dated role records.
 * NEVER collapses separate/discontiguous role periods into a continuous duration.
 * NEVER synthesizes "PRESENT" for undefined end dates.
 * NEVER fabricates years of continuous duration or proficiency claims.
 */
export function getCapabilityProfessionalHistory(
  capability: InfrastructureSkill | string,
  experience: ExperienceNode[]
): CapabilityProfessionalHistory {
  const targetCoreTech = getCapabilityCoreTechnology(capability);
  if (!targetCoreTech || !experience || experience.length === 0) {
    return {
      hasEvidence: false,
      timeSpan: 'UNAVAILABLE',
      roleCount: 0,
      periodCount: 0,
      periods: [],
      matchingRoles: [],
      provenance: 'UNAVAILABLE'
    };
  }

  // Find all role records where this capability technology is evidenced
  const matchingRoles = experience.filter(role => {
    const roleTechs = role.technologies || [];
    return roleTechs.some(rawTech => {
      const normalized = normalizeTechnologyName(rawTech);
      if (normalized === targetCoreTech) return true;
      const families = getTechnologyFamilies(normalized);
      return families.includes(targetCoreTech);
    });
  });

  if (matchingRoles.length === 0) {
    return {
      hasEvidence: false,
      timeSpan: 'UNAVAILABLE',
      roleCount: 0,
      periodCount: 0,
      periods: [],
      matchingRoles: [],
      provenance: 'UNAVAILABLE'
    };
  }

  // Sort matching roles chronologically (earliest first)
  const sortedRoles = [...matchingRoles].sort((a, b) => {
    const dateA = a.startDate || a.yearRange || '';
    const dateB = b.startDate || b.yearRange || '';
    return dateA.localeCompare(dateB);
  });

  // Extract structured periods for each role
  const periods: CapabilityRolePeriod[] = sortedRoles.map(role => ({
    roleId: role.id,
    role: role.role,
    organization: role.organization,
    startDate: role.startDate,
    endDate: role.endDate,
    formattedPeriod: formatRolePeriod(role)
  }));

  // Collect distinct chronological period strings (preserving discontiguous gaps)
  const uniquePeriodStrings: string[] = [];
  periods.forEach(p => {
    if (!uniquePeriodStrings.includes(p.formattedPeriod)) {
      uniquePeriodStrings.push(p.formattedPeriod);
    }
  });

  const formattedTimeSpan = uniquePeriodStrings.join(' · ');

  return {
    hasEvidence: true,
    timeSpan: formattedTimeSpan,
    roleCount: sortedRoles.length,
    periodCount: uniquePeriodStrings.length,
    periods,
    matchingRoles: sortedRoles,
    provenance: 'DERIVED'
  };
}

/**
 * Recognized engineering technology families eligible to generate top-level capability nodes.
 * Utility libraries (e.g. axios, dotenv, lodash) or generic words (e.g. Codebase) are excluded.
 */
export const RECOGNIZED_CAPABILITY_TAXONOMY: Record<string, { category: SystemCategory; titleSuffix: string }> = {
  'Node.js': { category: 'backend', titleSuffix: 'Application Architecture' },
  'TypeScript': { category: 'fullstack', titleSuffix: 'Typed Systems & Architecture' },
  'JavaScript': { category: 'fullstack', titleSuffix: 'Application Engineering' },
  'React': { category: 'frontend', titleSuffix: 'Component Architecture' },
  'React Native': { category: 'frontend', titleSuffix: 'Mobile Architecture' },
  'Next.js': { category: 'fullstack', titleSuffix: 'Full-Stack Architecture' },
  'NestJS': { category: 'backend', titleSuffix: 'Modular Monolith Architecture' },
  'Express': { category: 'backend', titleSuffix: 'API Architecture' },
  'Fastify': { category: 'backend', titleSuffix: 'High-Throughput Services' },
  'Vercel Functions': { category: 'backend', titleSuffix: 'Serverless API Architecture' },
  'PostgreSQL': { category: 'backend', titleSuffix: 'Relational Database Architecture' },
  'MySQL': { category: 'backend', titleSuffix: 'Relational Database Architecture' },
  'SQLite': { category: 'backend', titleSuffix: 'Embedded Storage Architecture' },
  'MongoDB': { category: 'backend', titleSuffix: 'Document Storage Architecture' },
  'Prisma': { category: 'backend', titleSuffix: 'Data Access & Schema Architecture' },
  'Redis': { category: 'infrastructure', titleSuffix: 'In-Memory & Caching Systems' },
  'BullMQ': { category: 'backend', titleSuffix: 'Distributed Queue Architecture' },
  'Socket.IO': { category: 'backend', titleSuffix: 'Realtime WebSocket Gateway' },
  'PHP': { category: 'backend', titleSuffix: 'Web Application Architecture' },
  'Python': { category: 'backend', titleSuffix: 'Data & Service Engineering' },
  'Docker': { category: 'infrastructure', titleSuffix: 'Container & Deployment Architecture' },
  'Tailwind CSS': { category: 'frontend', titleSuffix: 'Design Systems & UI' },
  'Playwright': { category: 'tooling', titleSuffix: 'End-to-End Test Architecture' },
  'Jest': { category: 'tooling', titleSuffix: 'Automated Test Harness' },
  'Vitest': { category: 'tooling', titleSuffix: 'Unit & Integration Testing' },
  'Go': { category: 'backend', titleSuffix: 'Systems & Concurrent Services' },
  'Rust': { category: 'backend', titleSuffix: 'Systems Architecture' },

  // Workflow automation & integration. Eligible for a capability node only from
  // STRUCTURED evidence -- an n8n workflow JSON node type, or an exact GitHub
  // topic that normalizes here -- never from free-form description text.
  'n8n': { category: 'infrastructure', titleSuffix: 'Workflow Automation & Orchestration' },
  'Webhooks': { category: 'backend', titleSuffix: 'Event-Driven Integration' },
  'Google Sheets': { category: 'backend', titleSuffix: 'Spreadsheet Data Integration' },
  'WhatsApp Cloud API': { category: 'backend', titleSuffix: 'Messaging Platform Integration' }
};

/**
 * Pure helper deriving the set of InfrastructureSkill IDs used by projects linked to an ExperienceNode.
 * Uses canonical association logic and projectUsesCapability.
 */
export function getCapabilitiesLinkedToExperience(
  exp: ExperienceNode,
  projects: ProjectData[],
  skills: InfrastructureSkill[]
): Set<string> {
  const linkedSkillIds = new Set<string>();
  if (!exp || !Array.isArray(projects) || !Array.isArray(skills)) {
    return linkedSkillIds;
  }

  const linkedProjects = projects.filter(p => isProjectLinkedToExperience(p, exp));
  for (const skill of skills) {
    if (linkedProjects.some(p => projectUsesCapability(p, skill))) {
      linkedSkillIds.add(skill.id);
    }
  }

  return linkedSkillIds;
}
