import { 
  ProjectData, 
  SubsystemNode, 
  SystemCategory, 
  SystemStatus, 
  InfrastructureSkill, 
  ExperienceNode, 
  OperatorMetadata 
} from '../types';
import { getRepositoryEvidence } from '../data/repositoryEvidence';

export interface GitHubUser {
  login: string;
  name: string | null;
  avatar_url: string;
  bio: string | null;
  html_url: string;
  public_repos: number;
  followers: number;
  following: number;
  company: string | null;
  location: string | null;
  blog: string | null;
}

export interface GitHubRepoRaw {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  watchers_count: number;
  language: string | null;
  topics: string[];
  size: number; // in KB
  created_at: string;
  updated_at: string;
  pushed_at: string;
  archived: boolean;
  fork: boolean;
  default_branch: string;
  license: { key: string; name: string; spdx_id: string } | null;
  owner: {
    login: string;
    avatar_url: string;
    html_url: string;
  };
}

export interface GitHubSyncResult {
  sourceType: 'user' | 'repo';
  sourceIdentifier: string;
  user: GitHubUser | null;
  projects: ProjectData[];
  skills: InfrastructureSkill[];
  operator: OperatorMetadata;
  experience: ExperienceNode[];
  rawCount: number;
}

/**
 * Determine category with deep multi-tier analysis of language, topics, and description
 */
export function inferCategory(language: string | null, topics: string[] = [], description: string = ''): SystemCategory {
  const text = `${language || ''} ${topics.join(' ')} ${description}`.toLowerCase();
  
  // 1. Infrastructure / Cloud Orchestration / Network
  const infraKeywords = ['k8s', 'kubernetes', 'docker', 'terraform', 'ansible', 'helm', 'infrastructure', 'consensus', 'p2p', 'network', 'daemon', 'proxy', 'ebpf', 'nginx', 'envoy', 'cluster', 'mesh', 'cloud-native', 'sysadmin'];
  if (infraKeywords.some(kw => text.includes(kw))) {
    return 'infrastructure';
  }

  // 2. Tooling / Compilers / CLIs / Linters
  const toolingKeywords = ['cli', 'linter', 'compiler', 'interpreter', 'tool', 'bundler', 'vite', 'webpack', 'babel', 'esbuild', 'plugin', 'generator', 'sdk', 'devtools', 'parser', 'transpiler', 'macro', 'boilerplate', 'starter'];
  if (toolingKeywords.some(kw => text.includes(kw))) {
    return 'tooling';
  }

  // 3. Frontend vs Backend vs Full-Stack Multi-factor Detection
  const frontendMarkers = ['react', 'vue', 'svelte', 'angular', 'tailwind', 'css', 'html', 'sass', 'styled-components', 'ui', 'frontend', 'front-end', 'component', 'web-component', 'browser', 'canvas', 'threejs', 'three.js', 'd3', 'dom', 'client'];
  const backendMarkers = ['api', 'rest', 'graphql', 'grpc', 'backend', 'back-end', 'server', 'microservice', 'express', 'nestjs', 'fastapi', 'django', 'flask', 'gin', 'actix', 'axum', 'spring', 'rails', 'laravel', 'postgres', 'postgresql', 'mysql', 'mongodb', 'sqlite', 'redis', 'prisma', 'drizzle', 'supabase', 'firebase', 'dynamodb', 'orm', 'auth', 'jwt', 'oauth'];
  const fullstackExplicit = ['fullstack', 'full-stack', 'mern', 'mean', 'mevn', 't3', 'nextjs', 'next.js', 'remix', 'nuxt', 'sveltekit', 'astro', 'blitz', 'redwood', 'saas', 'web-app', 'webapp', 'dashboard', 'portal', 'platform', 'ecommerce', 'e-commerce', 'marketplace'];

  const hasFrontend = frontendMarkers.some(m => text.includes(m));
  const hasBackend = backendMarkers.some(m => text.includes(m));
  const hasFullstack = fullstackExplicit.some(m => text.includes(m));

  if (hasFullstack || (hasFrontend && hasBackend)) {
    return 'fullstack';
  }

  if (hasFrontend) {
    return 'frontend';
  }

  if (hasBackend) {
    return 'backend';
  }

  // 4. Fallback on primary language heuristics
  const lang = (language || '').toLowerCase();
  if (['go', 'rust', 'c', 'c++', 'zig', 'java', 'kotlin', 'scala', 'c#', 'elixir', 'erlang', 'haskell', 'clojure'].includes(lang)) {
    return 'backend';
  }
  if (['typescript', 'javascript'].includes(lang)) {
    return 'fullstack';
  }
  if (['python', 'ruby', 'php'].includes(lang)) {
    return 'backend';
  }
  if (['html', 'css', 'vue', 'svelte', 'dart'].includes(lang)) {
    return 'frontend';
  }
  if (['shell', 'bash', 'makefile', 'nix', 'lua', 'powershell', 'dockerfile'].includes(lang)) {
    return 'tooling';
  }

  return 'fullstack';
}

/**
 * Breakdown tech stack into specific layers (Frontend, Backend, Database, Infrastructure/DevOps)
 */
export function categorizeTechStack(techStack: string[], primaryLang: string | null): {
  frontend: string[];
  backend: string[];
  database: string[];
  devops: string[];
} {
  const fe: string[] = [];
  const be: string[] = [];
  const db: string[] = [];
  const dev: string[] = [];

  const feTerms = ['react', 'vue', 'svelte', 'angular', 'next', 'nuxt', 'tailwind', 'css', 'html', 'vite', 'ui', 'redux', 'zustand', 'three', 'd3', 'client'];
  const beTerms = ['node', 'express', 'nest', 'fastapi', 'django', 'flask', 'go', 'golang', 'rust', 'actix', 'axum', 'gin', 'grpc', 'graphql', 'api', 'server', 'trpc', 'python', 'java', 'c#', 'spring', 'ruby', 'rails'];
  const dbTerms = ['postgres', 'postgresql', 'sql', 'sqlite', 'mysql', 'mongo', 'mongodb', 'redis', 'prisma', 'drizzle', 'supabase', 'firebase', 'dynamo', 'orm'];
  const devTerms = ['docker', 'k8s', 'kubernetes', 'terraform', 'ci/cd', 'github actions', 'git', 'aws', 'gcp', 'linux', 'bash', 'shell', 'nginx'];

  techStack.forEach(item => {
    const lower = item.toLowerCase();
    let assigned = false;

    if (feTerms.some(t => lower.includes(t))) {
      fe.push(item);
      assigned = true;
    }
    if (beTerms.some(t => lower.includes(t))) {
      be.push(item);
      assigned = true;
    }
    if (dbTerms.some(t => lower.includes(t))) {
      db.push(item);
      assigned = true;
    }
    if (devTerms.some(t => lower.includes(t))) {
      dev.push(item);
      assigned = true;
    }

    if (!assigned) {
      if (['typescript', 'javascript'].includes(lower)) {
        fe.push(item);
        be.push(item);
      } else {
        be.push(item);
      }
    }
  });

  if (fe.length === 0 && primaryLang) {
    if (['javascript', 'typescript', 'html', 'css'].includes(primaryLang.toLowerCase())) {
      fe.push(primaryLang);
    }
  }

  if (be.length === 0 && primaryLang) {
    be.push(primaryLang);
  }

  if (db.length === 0) {
    db.push('Schema Store', 'State Cache');
  }

  if (dev.length === 0) {
    dev.push('GitHub Actions CI', 'Container Ready');
  }

  return {
    frontend: Array.from(new Set(fe)),
    backend: Array.from(new Set(be)),
    database: Array.from(new Set(db)),
    devops: Array.from(new Set(dev))
  };
}

/**
 * Infer accent color from language or category
 */
export function inferAccentColor(language: string | null, index: number): string {
  const palette = ['#8EA9DA', '#C3E54E', '#E5534E', '#8CD1C8', '#E2A96B', '#A78BFA', '#F59E0B', '#34D399'];
  const lang = (language || '').toLowerCase();

  if (lang.includes('typescript') || lang.includes('javascript')) return '#8EA9DA';
  if (lang.includes('rust')) return '#E5534E';
  if (lang.includes('go')) return '#8CD1C8';
  if (lang.includes('python')) return '#F59E0B';
  if (lang.includes('react') || lang.includes('vue')) return '#C3E54E';
  if (lang.includes('c++') || lang.includes('c')) return '#A78BFA';
  if (lang.includes('shell') || lang.includes('docker')) return '#E2A96B';

  return palette[index % palette.length];
}

/**
 * Match tech stack to existing or new infrastructure skill plinths
 */
export function inferInfrastructureDeps(techStack: string[]): string[] {
  const deps: string[] = [];
  const text = techStack.join(' ').toLowerCase();

  if (text.includes('typescript') || text.includes('javascript')) deps.push('infra-ts');
  if (text.includes('go') || text.includes('golang')) deps.push('infra-go');
  if (text.includes('rust')) deps.push('infra-rust');
  if (text.includes('docker') || text.includes('container')) deps.push('infra-docker');
  if (text.includes('postgres') || text.includes('sql') || text.includes('sqlite') || text.includes('prisma') || text.includes('drizzle')) deps.push('infra-postgres');
  if (text.includes('react') || text.includes('next') || text.includes('vite') || text.includes('tailwind')) deps.push('infra-react');
  if (text.includes('kubernetes') || text.includes('k8s') || text.includes('terraform')) deps.push('infra-k8s');
  if (text.includes('kafka') || text.includes('redis') || text.includes('rabbitmq') || text.includes('queue')) deps.push('infra-kafka');
  if (text.includes('ebpf') || text.includes('linux') || text.includes('kernel')) deps.push('infra-ebpf');
  if (text.includes('distributed') || text.includes('raft') || text.includes('crdt') || text.includes('p2p') || text.includes('webrtc')) deps.push('infra-dist');

  return Array.from(new Set(deps));
}

/**
 * Generate modular subsystem decomposition nodes tailored to the project's exact architecture category
 */
export function generateSubsystems(repo: GitHubRepoRaw, category: SystemCategory, techStack: string[]): SubsystemNode[] {
  const primaryLang = repo.language || 'Codebase';
  const repoName = repo.name;
  const categorized = categorizeTechStack(techStack, primaryLang);

  if (category === 'fullstack') {
    return [
      {
        id: `${repo.name.toLowerCase()}-sub-ui`,
        name: `${repoName} Client / UI Matrix`,
        category: 'frontend',
        role: 'Client-side component rendering, reactive state management, and user interaction dispatch',
        protocol: 'DOM Events / WebSockets / Fetch API',
        description: `Modern reactive presentation layer powered by ${categorized.frontend.join(', ') || primaryLang}. Handles dynamic client views and responsive layouts.`,
        tech: categorized.frontend.length > 0 ? categorized.frontend : [primaryLang, 'UI Engine', 'Tailwind'],
        coordinates: { x: -45, y: -25, z: 40 },
        dimensions: { width: 60, height: 35, depth: 45 },
        metrics: [
          { label: 'Client Tier', value: categorized.frontend[0] || 'Modern UI' },
          { label: 'Asset Footprint', value: `${(repo.size / 1024).toFixed(1)} MB` }
        ]
      },
      {
        id: `${repo.name.toLowerCase()}-sub-api`,
        name: 'API & Business Logic Gateway',
        category: 'backend',
        role: 'Ingress routing, authentication tokens, request validation, and orchestrating business transactions',
        protocol: 'REST / JSON / gRPC / GraphQL',
        description: `Backend application service in ${categorized.backend.join(', ') || primaryLang}. Dispatches authenticated requests to persistence and external services.`,
        tech: categorized.backend.length > 0 ? categorized.backend : [primaryLang, 'REST API', 'Auth Pipeline'],
        coordinates: { x: 40, y: -30, z: 25 },
        dimensions: { width: 55, height: 28, depth: 40 },
        metrics: [
          { label: 'Transport Protocol', value: 'HTTP/2 / REST' },
          { label: 'Default Branch', value: repo.default_branch || 'main' }
        ]
      },
      {
        id: `${repo.name.toLowerCase()}-sub-db`,
        name: 'Persistence & Schema Store',
        category: 'database',
        role: 'Relational or document schema definition, transaction management, and cache indexing',
        protocol: 'TCP Wire Protocol / SQL / Memory Pool',
        description: `Manages state persistence, query optimization, and schema integrity utilizing ${categorized.database.join(', ')}.`,
        tech: categorized.database,
        coordinates: { x: 35, y: 40, z: 15 },
        dimensions: { width: 50, height: 25, depth: 38 },
        metrics: [
          { label: 'Schema Validation', value: 'Strict Types' },
          { label: 'License Format', value: repo.license?.spdx_id || 'Open Source' }
        ]
      },
      {
        id: `${repo.name.toLowerCase()}-sub-ops`,
        name: 'CI/CD & Deployment Pipeline',
        category: 'telemetry',
        role: 'Continuous integration verification, unit test matrix, and release distribution',
        protocol: 'GitHub Actions / Webhooks',
        description: `Automated test runner, static code analysis, and artifact containerization pipelines.`,
        tech: categorized.devops,
        coordinates: { x: -35, y: 35, z: 10 },
        dimensions: { width: 45, height: 20, depth: 30 },
        metrics: [
          { label: 'Community Rating', value: `${repo.stargazers_count} ★` },
          { label: 'Issue Tracker', value: `${repo.open_issues_count} open` }
        ]
      }
    ];
  }

  if (category === 'frontend') {
    return [
      {
        id: `${repo.name.toLowerCase()}-sub-comp`,
        name: `${repoName} UI Component Surface`,
        category: 'frontend',
        role: 'Component hierarchy, visual presentation system, and layout composition',
        protocol: 'Virtual DOM / Canvas Pipeline',
        description: `Encapsulates reusable user interface elements, animations, and accessible styling in ${primaryLang}.`,
        tech: [primaryLang, 'Component Tree', 'Tailwind/CSS'],
        coordinates: { x: -45, y: -25, z: 35 },
        dimensions: { width: 60, height: 35, depth: 45 },
        metrics: [
          { label: 'UI Architecture', value: primaryLang },
          { label: 'Bundle Size', value: `${(repo.size / 1024).toFixed(1)} MB` }
        ]
      },
      {
        id: `${repo.name.toLowerCase()}-sub-state`,
        name: 'Reactive Client State Store',
        category: 'frontend',
        role: 'Client-side state synchronization, cache invalidation, and action dispatchers',
        protocol: 'Unidirectional State Flow',
        description: `Manages interactive UI state, optimistic updates, and offline state caching.`,
        tech: ['Reactive Store', 'Local Cache', 'Context Provider'],
        coordinates: { x: 40, y: -30, z: 20 },
        dimensions: { width: 50, height: 25, depth: 40 },
        metrics: [
          { label: 'State Model', value: 'Immutable Dispatch' },
          { label: 'Stars', value: `${repo.stargazers_count} ★` }
        ]
      },
      {
        id: `${repo.name.toLowerCase()}-sub-transport`,
        name: 'Data Fetching & Transport Client',
        category: 'backend',
        role: 'HTTP client, error boundary recovery, and serialization layer',
        protocol: 'Async HTTP / WebSockets',
        description: 'Handles upstream API calls, query caching, and stream decoding.',
        tech: ['Fetch Client', 'JSON Decoder', 'Query Cache'],
        coordinates: { x: 35, y: 40, z: 15 },
        dimensions: { width: 55, height: 28, depth: 38 },
        metrics: [
          { label: 'Branch Target', value: repo.default_branch || 'main' },
          { label: 'Forks', value: `${repo.forks_count}` }
        ]
      },
      {
        id: `${repo.name.toLowerCase()}-sub-ci`,
        name: 'Visual Regression & Build Matrix',
        category: 'telemetry',
        role: 'Static typing, automated lint matrix, and production bundling',
        protocol: 'GitHub Actions / Bundler',
        description: 'Zero-regression continuous integration and bundle optimization.',
        tech: ['GitHub Actions', 'Bundler / Vite', 'Linter'],
        coordinates: { x: -35, y: 35, z: 10 },
        dimensions: { width: 45, height: 20, depth: 30 },
        metrics: [
          { label: 'License', value: repo.license?.spdx_id || 'Open Source' },
          { label: 'Status', value: repo.archived ? 'ARCHIVED' : 'ACTIVE' }
        ]
      }
    ];
  }

  // Backend / Infrastructure / Tooling fallback
  return [
    {
      id: `${repo.name.toLowerCase()}-sub-engine`,
      name: `${repoName} Core Runtime Engine`,
      category: 'backend',
      role: 'Primary algorithmic execution pipeline, state machine, and data processing',
      protocol: 'Internal Event Bus / Native FFI',
      description: `High-throughput core processing logic written in ${primaryLang}. Enforces strict failure isolation.`,
      tech: [primaryLang, ...techStack.slice(0, 2)],
      coordinates: { x: -45, y: -25, z: 35 },
      dimensions: { width: 60, height: 35, depth: 45 },
      metrics: [
        { label: 'Codebase Footprint', value: `${(repo.size / 1024).toFixed(1)} MB` },
        { label: 'Core Language', value: primaryLang }
      ]
    },
    {
      id: `${repo.name.toLowerCase()}-sub-api`,
      name: category === 'tooling' ? 'CLI & Interface Surface' : 'Network Ingress & Protocol Handler',
      category: category === 'tooling' ? 'frontend' : 'backend',
      role: category === 'tooling' ? 'Command-line parsing, flags, and stdio output' : 'TCP/HTTP Ingress routing and RPC dispatcher',
      protocol: category === 'tooling' ? 'POSIX CLI / Flags' : 'REST / gRPC / JSON-RPC',
      description: `Public interface exposing system capabilities to consumers and integrations.`,
      tech: [primaryLang, category === 'tooling' ? 'CLI Parser' : 'HTTP/2', 'Protobuf/JSON'],
      coordinates: { x: 40, y: -30, z: 20 },
      dimensions: { width: 50, height: 25, depth: 40 },
      metrics: [
        { label: 'Default Branch', value: repo.default_branch || 'main' },
        { label: 'Forks Count', value: `${repo.forks_count}` }
      ]
    },
    {
      id: `${repo.name.toLowerCase()}-sub-storage`,
      name: 'Storage Invariants & Configuration Tier',
      category: 'database',
      role: 'Configuration schema validation, state snapshots, and storage engines',
      protocol: 'WAL / File Store / Structured DB',
      description: 'Durable data handling, memory mapping, and persistence integrity.',
      tech: categorized.database,
      coordinates: { x: 35, y: 40, z: 15 },
      dimensions: { width: 55, height: 28, depth: 38 },
      metrics: [
        { label: 'License Spec', value: repo.license?.spdx_id || 'Open Source' },
        { label: 'Open Issues', value: `${repo.open_issues_count} open` }
      ]
    },
    {
      id: `${repo.name.toLowerCase()}-sub-ci`,
      name: 'Automated Test & Verification Harness',
      category: 'telemetry',
      role: 'Automated test suite, benchmarks, and release pipeline',
      protocol: 'GitHub Actions / Test Matrix',
      description: 'Zero-regression continuous integration and performance telemetry.',
      tech: ['GitHub Actions', 'Unit Tests', 'Benchmark Harness'],
      coordinates: { x: -35, y: 35, z: 10 },
      dimensions: { width: 45, height: 20, depth: 30 },
      metrics: [
        { label: 'Stars Rating', value: `${repo.stargazers_count} ★` },
        { label: 'Status', value: repo.archived ? 'ARCHIVED' : 'ACTIVE' }
      ]
    }
  ];
}

/**
 * Grid coordinates layout generator to arrange imported GitHub projects across the isometric workplane
 */
export function getGridCoordinatesForIndex(index: number, total: number): { x: number; y: number } {
  // Balanced radial spiral / matrix layout across the landscape
  const positions: Array<{ x: number; y: number }> = [
    { x: -160, y: -90 },
    { x: 140, y: -110 },
    { x: -210, y: 120 },
    { x: 160, y: 100 },
    { x: -30, y: -200 },
    { x: 260, y: -40 },
    { x: -280, y: -40 },
    { x: 0, y: 190 },
    { x: -160, y: 240 },
    { x: 220, y: 220 },
    { x: -330, y: 180 },
    { x: 320, y: -180 },
  ];

  if (index < positions.length) {
    return positions[index];
  }

  // Generate expanding concentric ring for larger counts
  const ring = Math.floor(index / 8) + 1;
  const angle = (index % 8) * (Math.PI / 4);
  const radius = 240 + ring * 120;
  return {
    x: Math.round((Math.cos(angle) * radius) / 25) * 25,
    y: Math.round((Math.sin(angle) * radius * 0.7) / 25) * 25
  };
}

/**
 * Transform a raw GitHub repository into our architectural ProjectData specification
 */
export function transformGitHubRepoToProject(repo: GitHubRepoRaw, index: number, total: number): ProjectData {
  const code = `GH-${(index + 1).toString().padStart(2, '0')}`;
  const category = inferCategory(repo.language, repo.topics, repo.description || '');
  const accentColor = inferAccentColor(repo.language, index);

  // Tech stack aggregation
  const techStack: string[] = [];
  if (repo.language) techStack.push(repo.language);
  if (repo.topics && repo.topics.length > 0) {
    repo.topics.slice(0, 5).forEach(t => {
      // Capitalize nicely
      const formatted = t.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
      if (!techStack.includes(formatted)) techStack.push(formatted);
    });
  }
  if (techStack.length === 0) techStack.push('Metadata unavailable');

  const infraDeps = inferInfrastructureDeps(techStack);
  const year = repo.pushed_at ? new Date(repo.pushed_at).getFullYear().toString() : new Date().getFullYear().toString();
  
  // Status
  let status: SystemStatus = 'ACTIVE';
  if (repo.archived) status = 'ARCHIVED';

  // 3D Building Dimensions calculated from repo scope
  const sizeFactor = Math.min(Math.max(repo.size / 1000, 1), 10);
  const starFactor = Math.min(Math.max(Math.log10(repo.stargazers_count + 1) * 1.5, 1), 4);
  
  const width = Math.round(85 + Math.min(sizeFactor * 4, 35));
  const height = Math.round(65 + Math.min(starFactor * 12, 45));
  const levels = Math.min(Math.max(Math.round(starFactor + 1), 2), 5);

  // Repository metadata cannot prove internal subsystem boundaries. Keep this
  // empty until a future repository-content analysis can cite actual files.
  const subsystems: SubsystemNode[] = [];

  const formatNumber = (num: number) => {
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toString();
  };

  const metrics = [
    { label: 'Stargazers', value: `${formatNumber(repo.stargazers_count)} ★`, note: 'GitHub community stars' },
    { label: 'Forks', value: `${formatNumber(repo.forks_count)} ⑂`, note: 'Public downstream forks' },
    { label: 'Repo Footprint', value: `${(repo.size / 1024).toFixed(1)} MB`, note: 'Source code & assets' },
    { label: 'Open Issues', value: `${repo.open_issues_count} open`, note: 'Issue tracker backlog' },
    { label: 'Primary Language', value: repo.language || 'Mixed Stack', note: 'Dominant language' },
    { label: 'License Spec', value: repo.license?.spdx_id || 'Not reported', note: 'GitHub repository metadata' }
  ];

  const project: ProjectData = {
    id: `gh-${repo.id}`,
    code,
    title: repo.name,
    tagline: repo.description || `Public ${category} repository; no description supplied on GitHub.`,
    category,
    status,
    year,
    dimensions: { width, height, levels },
    gridPosition: getGridCoordinatesForIndex(index, total),
    accentColor,
    summary: repo.description
      ? `${repo.description} GitHub reports ${repo.stargazers_count} stars, ${repo.forks_count} forks, and ${repo.open_issues_count} open issues.`
      : `Public repository owned by ${repo.owner.login}. GitHub does not provide a project description.`,
    problem: 'Not established by GitHub repository metadata.',
    solution: 'Inspect the repository and owner-approved case study before publishing implementation claims.',
    architectureNotes: `Verified metadata only: primary language ${repo.language || 'not reported'}, default branch ${repo.default_branch || 'not reported'}, license ${repo.license?.spdx_id || 'not reported'}.`,
    techStack,
    infrastructureDeps: infraDeps,
    subsystems,
    metrics,
    keyDecisions: [],
    resilienceTesting: 'Not established by GitHub repository metadata.',
    links: {
      github: repo.html_url,
      demo: repo.homepage || undefined,
      caseStudy: false
    }
  };

  const repositoryEvidence = getRepositoryEvidence(repo.name);
  if (!repositoryEvidence) return project;

  return {
    ...project,
    ...repositoryEvidence,
    architectureNotes: `${repositoryEvidence.architectureNotes} GitHub metadata: primary language ${repo.language || 'not reported'}, default branch ${repo.default_branch || 'not reported'}, license ${repo.license?.spdx_id || 'not reported'}.`,
    metrics,
    links: project.links
  };
}

/**
 * Generate dynamic infrastructure skills, operator profile, and experience history from GitHub data
 */
export function generateGitHubProfileDetails(
  projects: ProjectData[], 
  user: GitHubUser | null, 
  sourceIdentifier: string
): { skills: InfrastructureSkill[]; operator: OperatorMetadata; experience: ExperienceNode[] } {
  const username = user?.login || sourceIdentifier.split('/')[0] || 'operator';
  const name = user?.name || username;
  const role = user?.bio ? user.bio.split('\n')[0].slice(0, 60) : 'GitHub profile';
  const location = user?.location || 'Not provided on GitHub';

  // 1. Synthesize Languages & Technologies across all projects
  const langCountMap: Record<string, number> = {};
  const topicCountMap: Record<string, number> = {};

  projects.forEach(p => {
    p.techStack.forEach(t => {
      langCountMap[t] = (langCountMap[t] || 0) + 1;
    });
  });

  const sortedTech = Object.keys(langCountMap).sort((a, b) => langCountMap[b] - langCountMap[a]);
  const primaryStack = sortedTech.slice(0, 7);

  // 2. Generate 3D Infrastructure Plinths in Center Hexagonal Array
  const skills: InfrastructureSkill[] = primaryStack.slice(0, 6).map((tech, idx) => {
    const angle = (idx / Math.min(primaryStack.length, 6)) * Math.PI * 2;
    const radius = 90;
    const gridX = Math.round((Math.cos(angle) * radius) / 20) * 20;
    const gridY = Math.round((Math.sin(angle) * (radius * 0.7)) / 20) * 20;
    const cat = inferCategory(tech, [], '');

    const matchingProjects = projects.filter(p => p.techStack.includes(tech)).map(p => p.id);

    return {
      id: `gh-infra-${idx + 1}`,
      code: `INF-${(idx + 1).toString().padStart(2, '0')}`,
      name: `${tech} & Application Architecture`,
      category: cat,
      yearsActive: 0,
      proficiencyScore: 0,
      gridPosition: { x: gridX, y: gridY },
      systemCount: matchingProjects.length || 1,
      usedInProjects: matchingProjects,
      primaryUseCases: [`Detected in ${matchingProjects.length} public GitHub ${matchingProjects.length === 1 ? 'repository' : 'repositories'}`],
      technicalHighlights: ['No proficiency score or years inferred from repository metadata'],
      samplePattern: '// Evidence source: public GitHub repository metadata'
    };
  });

  // Re-link projects to these skills
  projects.forEach((p, pIdx) => {
    if (skills.length > 0) {
      const linked = skills.filter(s => p.techStack.some(t => s.name.includes(t))).map(s => s.id);
      p.infrastructureDeps = linked.length > 0 ? linked : [skills[pIdx % skills.length].id];
    }
  });

  // 3. Generate Experience Log Nodes
  const experience: ExperienceNode[] = [
    {
      id: 'gh-exp-1',
      code: 'BUILD-01',
      yearRange: 'PUBLIC GITHUB SNAPSHOT',
      role: role,
      organization: user?.company ? user.company.replace(/^@/, '') : 'GitHub repositories',
      location: location,
      systemDomain: 'Public repository metadata',
      keyOutputs: [
        `Mapped ${projects.length} public repositories returned by GitHub.`,
        `Detected repository languages and topics: ${primaryStack.slice(0, 5).join(', ') || 'none reported'}.`,
        'No employment history or performance claims inferred.'
      ],
      systemsArchitected: projects.slice(0, 3).map(p => p.title),
      technologies: primaryStack.slice(0, 5),
      gridPosition: { x: -260, y: 140 }
    }
  ];

  // 4. Operator Profile
  const operator: OperatorMetadata = {
    name,
    handle: `@${username}`,
    role,
    location,
    status: 'ACTIVE_BUILD // GITHUB SYNCHRONIZED',
    focus: user?.bio || `Public GitHub repositories using ${primaryStack.slice(0, 4).join(', ') || 'unreported technologies'}`,
    yearsActive: 0,
    commitsIndexed: 'Not indexed',
    productionUptime: 'Not claimed',
    primaryStack,
    systemManifesto: user?.bio || 'Profile synthesized from public GitHub repository metadata. Verify personal and architectural claims before publication.',
    contact: {
      email: '',
      github: user?.html_url || `https://github.com/${username}`,
      linkedin: '',
      pgpKeyId: '',
      pgpFingerprint: '',
      matrix: '',
      availability: 'Not provided on GitHub'
    }
  };

  return { skills, operator, experience };
}

/**
 * Fetch GitHub user or organization repositories
 */
export async function fetchGitHubUserData(username: string): Promise<GitHubSyncResult> {
  const cleanUser = username.trim().replace(/^@/, '');
  
  // 1. Fetch User Profile
  const userRes = await fetch(`https://api.github.com/users/${encodeURIComponent(cleanUser)}`, {
    headers: {
      'Accept': 'application/vnd.github.v3+json'
    }
  });

  if (!userRes.ok) {
    if (userRes.status === 404) {
      throw new Error(`GitHub user or organization "@${cleanUser}" was not found.`);
    } else if (userRes.status === 403) {
      throw new Error(`GitHub API rate limit reached. Please wait a moment or try a specific repository.`);
    } else {
      throw new Error(`Failed to fetch GitHub profile: ${userRes.statusText}`);
    }
  }

  const user: GitHubUser = await userRes.json();

  // 2. Fetch Repositories (sorted by recently updated, up to 15)
  const reposRes = await fetch(`https://api.github.com/users/${encodeURIComponent(cleanUser)}/repos?sort=updated&per_page=15`, {
    headers: {
      'Accept': 'application/vnd.github.v3+json'
    }
  });

  if (!reposRes.ok) {
    throw new Error(`Failed to fetch repositories for "${cleanUser}".`);
  }

  const rawRepos: GitHubRepoRaw[] = await reposRes.json();

  if (rawRepos.length === 0) {
    throw new Error(`User "@${cleanUser}" has no public repositories to visualize.`);
  }

  // Filter out forks if there are enough original repos, or include non-empty repos
  const nonForkRepos = rawRepos.filter(r => !r.fork && r.size > 0);
  const candidateRepos = nonForkRepos.length >= 3 ? nonForkRepos : rawRepos.filter(r => r.size > 0);
  const finalRepos = candidateRepos.slice(0, 10);

  const projects = finalRepos.map((repo, idx) => transformGitHubRepoToProject(repo, idx, finalRepos.length));
  const { skills, operator, experience } = generateGitHubProfileDetails(projects, user, cleanUser);

  return {
    sourceType: 'user',
    sourceIdentifier: cleanUser,
    user,
    projects,
    skills,
    operator,
    experience,
    rawCount: rawRepos.length
  };
}

/**
 * Fetch a single GitHub repository
 */
export async function fetchGitHubRepoData(owner: string, repoName: string): Promise<GitHubSyncResult> {
  const cleanOwner = owner.trim();
  const cleanRepo = repoName.trim();

  const repoRes = await fetch(`https://api.github.com/repos/${encodeURIComponent(cleanOwner)}/${encodeURIComponent(cleanRepo)}`, {
    headers: {
      'Accept': 'application/vnd.github.v3+json'
    }
  });

  if (!repoRes.ok) {
    if (repoRes.status === 404) {
      throw new Error(`Repository "${cleanOwner}/${cleanRepo}" was not found or is private.`);
    } else if (repoRes.status === 403) {
      throw new Error(`GitHub API rate limit reached. Please wait a moment.`);
    } else {
      throw new Error(`Failed to fetch repository: ${repoRes.statusText}`);
    }
  }

  const rawRepo: GitHubRepoRaw = await repoRes.json();

  // Try fetching user profile of repo owner
  let user: GitHubUser | null = null;
  try {
    const userRes = await fetch(`https://api.github.com/users/${encodeURIComponent(cleanOwner)}`);
    if (userRes.ok) {
      user = await userRes.json();
    }
  } catch (e) {
    // Non-fatal
  }

  const project = transformGitHubRepoToProject(rawRepo, 0, 1);
  const { skills, operator, experience } = generateGitHubProfileDetails([project], user, `${cleanOwner}/${cleanRepo}`);

  return {
    sourceType: 'repo',
    sourceIdentifier: `${cleanOwner}/${cleanRepo}`,
    user,
    projects: [project],
    skills,
    operator,
    experience,
    rawCount: 1
  };
}

/**
 * Smart URL parser: accepts "torvalds/linux", "https://github.com/torvalds/linux", or "torvalds"
 */
export async function connectGitHubTarget(input: string): Promise<GitHubSyncResult> {
  const cleaned = input.trim().replace(/\/+$/, '');
  
  if (!cleaned) {
    throw new Error('Please enter a GitHub username, org, or repository link.');
  }

  // Case 1: Full URL https://github.com/owner/repo or https://github.com/user
  if (cleaned.includes('github.com')) {
    const url = cleaned.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
    const parts = url.split('/').filter(Boolean);
    // parts[0] is 'github.com'
    const owner = parts[1];
    const repo = parts[2];

    if (owner && repo) {
      return fetchGitHubRepoData(owner, repo);
    } else if (owner) {
      return fetchGitHubUserData(owner);
    }
  }

  // Case 2: Shorthand owner/repo
  if (cleaned.includes('/')) {
    const [owner, repo] = cleaned.split('/');
    if (owner && repo) {
      return fetchGitHubRepoData(owner, repo);
    }
  }

  // Case 3: Pure username or org name
  return fetchGitHubUserData(cleaned);
}
