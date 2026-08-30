import { 
  ProjectData, 
  SubsystemNode, 
  SystemCategory, 
  SystemStatus, 
  InfrastructureSkill, 
  ExperienceNode, 
  OperatorMetadata
} from '../types';
import { getCanonicalRepositoryKey, getRepositoryEvidence } from '../data/repositoryEvidence';
import { analyzeRepository, RawRepositoryInspection } from './repositoryAnalyzer';
import { 
  getProjectTechnologyEvidence, 
  normalizeTechnologyName, 
  getTechnologyFamilies, 
  projectUsesCapability, 
  RECOGNIZED_CAPABILITY_TAXONOMY 
} from '../utils/capabilityAssociations';
import { parseGitHubTarget } from '../utils/portfolioUtils';

export const DEFAULT_INSPECTION_CONCURRENCY = 3;
export const MAX_MANIFEST_DEPTH = 4;
export const MAX_MANIFEST_FILES_PER_REPO = 15;
export const MAX_RAW_README_BYTES = 1024 * 1024;
export const MAX_RAW_MANIFEST_BYTES = 512 * 1024;

const RAW_GITHUB_ORIGIN = 'https://raw.githubusercontent.com';
const README_FILE_PRIORITY = [
  'readme.md',
  'readme.markdown',
  'readme.rst',
  'readme.txt',
  'readme'
] as const;

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

export function sanitizeGitHubUser(raw: any): GitHubUser {
  if (!raw || typeof raw !== 'object') {
    return {
      login: '',
      name: null,
      avatar_url: '',
      bio: null,
      html_url: '',
      public_repos: 0,
      followers: 0,
      following: 0,
      company: null,
      location: null,
      blog: null
    };
  }
  return {
    login: typeof raw.login === 'string' ? raw.login : '',
    name: typeof raw.name === 'string' ? raw.name : null,
    avatar_url: typeof raw.avatar_url === 'string' ? raw.avatar_url : '',
    bio: typeof raw.bio === 'string' ? raw.bio : null,
    html_url: typeof raw.html_url === 'string' ? raw.html_url : '',
    public_repos: typeof raw.public_repos === 'number' ? raw.public_repos : 0,
    followers: typeof raw.followers === 'number' ? raw.followers : 0,
    following: typeof raw.following === 'number' ? raw.following : 0,
    company: typeof raw.company === 'string' ? raw.company : null,
    location: typeof raw.location === 'string' ? raw.location : null,
    blog: typeof raw.blog === 'string' ? raw.blog : null
  };
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
  size: number;
  created_at: string;
  updated_at: string;
  pushed_at?: string;
  archived: boolean;
  fork: boolean;
  default_branch: string;
  license: {
    key?: string;
    name?: string;
    spdx_id?: string;
  } | null;
  owner: {
    login: string;
    avatar_url: string;
    html_url: string;
  };
}

export interface RepositoryInspectionSummary {
  canonicalRepositoryCount: number;
  inspectedRepositoryCount: number;
  warnings: string[];
}

export interface GitHubSyncResult {
  sourceType: 'user' | 'repo';
  sourceIdentifier: string;
  user: GitHubUser;
  projects: ProjectData[];
  skills: InfrastructureSkill[];
  operator: OperatorMetadata;
  experience: ExperienceNode[];
  rawCount?: number;
  inspectionSummary?: RepositoryInspectionSummary;
}

export interface GitHubFetchOptions {
  token?: string;
  inspectionConcurrency?: number;
  /** GitHub REST API transport. Retained as fetchImpl for backwards compatibility. */
  fetchImpl?: typeof fetch;
  /** Public raw-content transport. Defaults to fetchImpl when injected, otherwise global fetch. */
  rawFetchImpl?: typeof fetch;
}

/**
 * Executes an array of async tasks with bounded concurrency, preserving input order.
 */
export async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];
  const boundedLimit = Math.max(1, Math.min(limit, items.length));
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  async function processNext(): Promise<void> {
    while (currentIndex < items.length) {
      const idx = currentIndex++;
      results[idx] = await worker(items[idx], idx);
    }
  }

  const workers: Promise<void>[] = [];
  for (let i = 0; i < boundedLimit; i++) {
    workers.push(processNext());
  }

  await Promise.all(workers);
  return results;
}

function getGitHubHeaders(options?: GitHubFetchOptions, acceptHeader = 'application/vnd.github.v3+json'): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept': acceptHeader
  };
  if (options?.token && options.token.trim()) {
    headers['Authorization'] = `Bearer ${options.token.trim()}`;
  }
  return headers;
}

function encodeRawPath(path: string): string {
  return path.split('/').map(segment => encodeURIComponent(segment)).join('/');
}

/**
 * Build a public raw-content URL without consulting the Contents API.
 * Every path component is encoded independently so repository refs and file names
 * cannot change the fixed HTTPS raw.githubusercontent.com origin.
 */
export function buildGitHubRawContentUrl(
  owner: string,
  repo: string,
  ref: string,
  filePath: string
): string {
  const cleanOwner = owner.trim();
  const cleanRepo = repo.trim();
  const cleanRef = ref.trim();
  const cleanPath = filePath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!cleanOwner || !cleanRepo || !cleanRef || !cleanPath) {
    throw new Error('Cannot build GitHub raw-content URL from an empty owner, repository, ref, or path.');
  }

  const url = new URL(
    `${RAW_GITHUB_ORIGIN}/${encodeURIComponent(cleanOwner)}/${encodeURIComponent(cleanRepo)}/${encodeURIComponent(cleanRef)}/${encodeRawPath(cleanPath)}`
  );
  if (url.protocol !== 'https:' || url.hostname !== 'raw.githubusercontent.com') {
    throw new Error('Refusing to fetch GitHub raw content from an untrusted host.');
  }
  return url.toString();
}

/** Select one supported repository README using GitHub's location precedence. */
export function discoverRepositoryReadme(treeFiles: string[]): string | undefined {
  const locationCandidates: string[][] = [[], [], []];
  for (const file of treeFiles) {
    const segments = file.split('/');
    if (segments.length === 1 && segments[0]) {
      locationCandidates[1].push(file);
    } else if (segments.length === 2) {
      const directory = segments[0].toLowerCase();
      if (directory === '.github') locationCandidates[0].push(file);
      else if (directory === 'docs') locationCandidates[2].push(file);
    }
  }

  for (const candidates of locationCandidates) {
    for (const supportedName of README_FILE_PRIORITY) {
      const matches = candidates
        .filter(file => file.split('/').pop()?.toLowerCase() === supportedName)
        .sort((a, b) => a.localeCompare(b));
      if (matches.length > 0) return matches[0];
    }
  }
  return undefined;
}

async function readBoundedResponseText(res: Response, maxBytes: number, context: string): Promise<string> {
  const contentLength = res.headers?.get?.('content-length');
  if (contentLength && Number.isFinite(Number(contentLength)) && Number(contentLength) > maxBytes) {
    throw new Error(`${context} exceeds the ${maxBytes}-byte raw-content limit.`);
  }

  if (!res.body) {
    const text = await res.text();
    if (new TextEncoder().encode(text).byteLength > maxBytes) {
      throw new Error(`${context} exceeds the ${maxBytes}-byte raw-content limit.`);
    }
    return text;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel();
        throw new Error(`${context} exceeds the ${maxBytes}-byte raw-content limit.`);
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return text;
  } finally {
    reader.releaseLock();
  }
}

async function fetchPublicRawText(
  owner: string,
  repo: string,
  ref: string,
  filePath: string,
  maxBytes: number,
  options?: GitHubFetchOptions
): Promise<{ status: number; statusText: string; text?: string }> {
  const rawFetchImpl = options?.rawFetchImpl || options?.fetchImpl || globalThis.fetch;
  const rawUrl = buildGitHubRawContentUrl(owner, repo, ref, filePath);
  const res = await rawFetchImpl(rawUrl, {
    headers: { Accept: 'text/plain' },
    redirect: 'error'
  });

  if (res.url) {
    const finalUrl = new URL(res.url);
    if (finalUrl.protocol !== 'https:' || finalUrl.hostname !== 'raw.githubusercontent.com') {
      throw new Error('Refusing a GitHub raw-content response from an untrusted host.');
    }
  }

  if (!res.ok) {
    return { status: res.status, statusText: res.statusText };
  }
  return {
    status: res.status,
    statusText: res.statusText,
    text: await readBoundedResponseText(res, maxBytes, `Raw file "${filePath}" for "${owner}/${repo}"`)
  };
}

export function handleGitHubHttpError(res: Response, contextMessage: string): never {
  const status = res.status;
  const remaining = res?.headers?.get ? res.headers.get('x-ratelimit-remaining') : null;
  const reset = res?.headers?.get ? res.headers.get('x-ratelimit-reset') : null;
  const retryAfter = res?.headers?.get ? res.headers.get('retry-after') : null;

  let resetInfo = '';
  if (reset) {
    const resetDate = new Date(parseInt(reset, 10) * 1000);
    resetInfo = ` (reset: ${resetDate.toISOString()})`;
  } else if (retryAfter) {
    resetInfo = ` (retry after: ${retryAfter}s)`;
  }

  // 1. Explicit 429 Too Many Requests
  if (status === 429) {
    throw new Error(`GitHub API rate limit exceeded while ${contextMessage}${resetInfo}. Provide GITHUB_TOKEN or retry later.`);
  }

  // 2. Primary rate-limit exhaustion (403 + x-ratelimit-remaining === "0")
  if (status === 403 && remaining === '0') {
    throw new Error(`GitHub API primary rate limit exhausted while ${contextMessage}${resetInfo}. Provide GITHUB_TOKEN or retry later.`);
  }

  // 3. Secondary rate-limit (403 + Retry-After)
  if (status === 403 && retryAfter) {
    throw new Error(`GitHub API secondary rate limit reached while ${contextMessage}${resetInfo}. Retry later.`);
  }

  // 4. Other 403 Forbidden / Rejected (e.g. repo restricted, auth mismatch)
  if (status === 403) {
    throw new Error(`GitHub API request forbidden/rejected while ${contextMessage}: ${res.statusText || 'Forbidden'}.`);
  }

  throw new Error(`Failed to fetch ${contextMessage}: ${res.statusText || res.status}`);
}

/**
 * Determine category with deep multi-tier analysis of language, topics, and description
 */
export function inferCategory(language: string | null, topics: string[] = [], description: string = ''): SystemCategory {
  const text = `${topics.join(' ')} ${description}`.toLowerCase();
  
  // 1. Tooling / Compilers / CLIs / Linters / Testing Workbenches (Strong purpose signals)
  const strongToolingTopics = [
    'cli', 'devtools', 'developer-tools', 'linter', 'compiler', 'parser',
    'generator', 'fuzzer', 'test-runner', 'resilience-testing', 'workbench',
    'testing-tool', 'benchmarking'
  ];
  const strongToolingPhrases = [
    'testing workbench', 'resilience-testing', 'resilience testing',
    'chaos engineering', 'developer tool', 'developer tooling', 'devtools',
    'dev tool', 'cli tool', 'cli utility', 'command line tool', 'command-line interface',
    'code generator', 'code generation', 'scaffolding tool', 'compiler',
    'transpiler', 'linter', 'parser', 'ast parser', 'fuzzer', 'profiler',
    'test runner', 'benchmarking harness'
  ];

  const hasToolingTopic = topics.some(t => strongToolingTopics.includes(t.toLowerCase()));
  const hasToolingPhrase = strongToolingPhrases.some(phrase => text.includes(phrase));
  const isToolingLang = ['shell', 'bash', 'makefile', 'nix', 'lua', 'powershell', 'dockerfile'].includes((language || '').toLowerCase());

  if (hasToolingTopic || hasToolingPhrase) {
    return 'tooling';
  }

  // 2. Infrastructure / Cloud Orchestration / Network
  const infraKeywords = ['k8s', 'kubernetes', 'docker', 'terraform', 'ansible', 'helm', 'infrastructure', 'consensus', 'p2p', 'ebpf', 'cluster', 'mesh', 'cloud-native'];
  if (infraKeywords.some(kw => text.includes(kw) || topics.some(t => t.toLowerCase().includes(kw)))) {
    return 'infrastructure';
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

  if (isToolingLang) {
    return 'tooling';
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

  return 'fullstack';
}

export function inferClassifications(language: string | null, topics: string[] = [], description: string = ''): SystemCategory[] {
  const primary = inferCategory(language, topics, description);
  const text = `${topics.join(' ')} ${description}`.toLowerCase();
  const list: SystemCategory[] = [primary];

  const strongToolingTopics = [
    'cli', 'devtools', 'developer-tools', 'linter', 'compiler', 'parser',
    'generator', 'fuzzer', 'test-runner', 'resilience-testing', 'workbench',
    'testing-tool', 'benchmarking'
  ];
  const strongToolingPhrases = [
    'testing workbench', 'resilience-testing', 'resilience testing',
    'chaos engineering', 'developer tool', 'developer tooling', 'devtools',
    'dev tool', 'cli tool', 'cli utility', 'command line tool', 'command-line interface',
    'code generator', 'code generation', 'scaffolding tool', 'compiler',
    'transpiler', 'linter', 'parser', 'ast parser', 'fuzzer', 'profiler',
    'test runner', 'benchmarking harness'
  ];
  if (topics.some(t => strongToolingTopics.includes(t.toLowerCase())) || strongToolingPhrases.some(phrase => text.includes(phrase))) {
    list.push('tooling');
  }

  const infraKeywords = ['k8s', 'kubernetes', 'docker', 'terraform', 'ansible', 'helm', 'infrastructure'];
  if (infraKeywords.some(kw => text.includes(kw))) list.push('infrastructure');

  const frontendMarkers = ['react', 'vue', 'svelte', 'tailwind', 'ui', 'frontend', 'dashboard', 'client', 'nextjs', 'next.js'];
  if (frontendMarkers.some(m => text.includes(m))) list.push('frontend');

  const backendMarkers = ['api', 'backend', 'server', 'nestjs', 'fastify', 'express', 'database', 'postgres', 'sqlite', 'prisma'];
  if (backendMarkers.some(m => text.includes(m))) list.push('backend');

  const hasFe = frontendMarkers.some(m => text.includes(m));
  const hasBe = backendMarkers.some(m => text.includes(m));
  if ((hasFe && hasBe) || text.includes('fullstack') || text.includes('webapp') || text.includes('platform')) {
    list.push('fullstack');
  }

  return Array.from(new Set(list));
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
 * Attempt to fetch repository inspection artifacts (README, git tree, bounded manifests)
 */
export async function fetchRepoInspection(
  owner: string, 
  repo: string, 
  defaultBranch = 'main',
  options?: GitHubFetchOptions
): Promise<RawRepositoryInspection> {
  const fetchImpl = options?.fetchImpl || globalThis.fetch;
  const cleanOwner = owner.trim();
  const cleanRepo = repo.trim();

  const inspection: RawRepositoryInspection = {
    repoName: cleanRepo,
    owner: cleanOwner,
    defaultBranch,
    manifestContents: {},
    dockerFiles: [],
    workflowFiles: [],
    docsFiles: [],
    testFiles: [],
    configFiles: []
  };

  // 1. Fetch the recursive Git tree. It remains authoritative for all discovery.
  const treeRes = await fetchImpl(`https://api.github.com/repos/${encodeURIComponent(cleanOwner)}/${encodeURIComponent(cleanRepo)}/git/trees/${encodeURIComponent(defaultBranch)}?recursive=1`, {
    headers: getGitHubHeaders(options, 'application/vnd.github.v3+json')
  });

  if (!treeRes.ok) {
    handleGitHubHttpError(treeRes, `fetching git tree for "${cleanOwner}/${cleanRepo}"`);
  }

  const treeData = await treeRes.json();
  if (treeData.truncated === true) {
    throw new Error(`Tree truncated for "${cleanOwner}/${cleanRepo}". Deep inspection incomplete.`);
  }
  if (!treeData || !Array.isArray(treeData.tree)) {
    throw new Error(`Incomplete inspection for "${cleanOwner}/${cleanRepo}": Git tree payload is missing or not an array.`);
  }
  inspection.treeFiles = treeData.tree
    .filter((entry: { path?: unknown; type?: unknown }) => typeof entry.path === 'string' && (!entry.type || entry.type === 'blob'))
    .map((entry: { path: string }) => entry.path);

  // Raw content uses the repository's authoritative default branch. The tree
  // payload SHA identifies a Git tree object, not necessarily a raw-content ref.
  const rawRef = defaultBranch;

  // 2. Scan tree paths for README, categorized artifacts, and manifest candidates.
  if (inspection.treeFiles && inspection.treeFiles.length > 0) {
    const files = inspection.treeFiles;

    const readmePath = discoverRepositoryReadme(files);
    if (readmePath) {
      const readmeResult = await fetchPublicRawText(
        cleanOwner,
        cleanRepo,
        rawRef,
        readmePath,
        MAX_RAW_README_BYTES,
        options
      );
      if (readmeResult.status >= 200 && readmeResult.status < 300) {
        inspection.readmeContent = readmeResult.text;
      } else if (readmeResult.status !== 404) {
        throw new Error(
          `Failed to fetch raw README "${readmePath}" for "${cleanOwner}/${cleanRepo}": ${readmeResult.statusText || readmeResult.status}.`
        );
      }
    }

    inspection.dockerFiles = files.filter(f => /dockerfile|docker-compose|compose\.ya?ml/i.test(f.split('/').pop() || ''));
    inspection.workflowFiles = files.filter(f => f.startsWith('.github/workflows/'));
    inspection.docsFiles = files.filter(f => (f.startsWith('docs/') || f.startsWith('doc/') || f.endsWith('.md')) && f.toLowerCase() !== 'readme.md');
    inspection.testFiles = files.filter(f => /(\.|_)(test|spec)\.[a-zA-Z0-9]+$|^tests?\/|^__tests__\/|^e2e\//i.test(f));
    inspection.configFiles = files.filter(f => /tsconfig.*\.json|vite\.config|next\.config|tailwind\.config|eslint|\.prettier|webpack\.config|biome\.json/i.test(f.split('/').pop() || ''));

    // Bounded manifest candidate discovery
    const recognizedManifests = new Set([
      'package.json',
      'pnpm-workspace.yaml',
      'turbo.json',
      'composer.json',
      'go.mod',
      'cargo.toml',
      'pyproject.toml',
      'requirements.txt'
    ]);

    const isIgnoredPath = (path: string) => {
      const lower = path.toLowerCase();
      return (
        lower.includes('/node_modules/') ||
        lower.startsWith('node_modules/') ||
        lower.includes('/vendor/') ||
        lower.startsWith('vendor/') ||
        lower.includes('/.git/') ||
        lower.startsWith('.git/') ||
        lower.includes('/dist/') ||
        lower.startsWith('dist/') ||
        lower.includes('/build/') ||
        lower.startsWith('build/') ||
        lower.includes('/.next/') ||
        lower.startsWith('.next/') ||
        lower.includes('/target/') ||
        lower.startsWith('target/')
      );
    };

    const manifestCandidates = files.filter(f => {
      if (isIgnoredPath(f)) return false;
      const segments = f.split('/');
      if (segments.length > MAX_MANIFEST_DEPTH) return false;
      const fileName = segments[segments.length - 1].toLowerCase();
      return recognizedManifests.has(fileName);
    });

    // Sort: root manifests first, then lexicographically
    manifestCandidates.sort((a, b) => {
      const aIsRoot = !a.includes('/');
      const bIsRoot = !b.includes('/');
      if (aIsRoot && !bIsRoot) return -1;
      if (!aIsRoot && bIsRoot) return 1;
      return a.localeCompare(b);
    });

    // Cap at MAX_MANIFEST_FILES_PER_REPO
    const cappedManifests = manifestCandidates.slice(0, MAX_MANIFEST_FILES_PER_REPO);

    // Fetch recognized manifest contents directly from the public raw host.
    for (const manifestPath of cappedManifests) {
      const manifestResult = await fetchPublicRawText(
        cleanOwner,
        cleanRepo,
        rawRef,
        manifestPath,
        MAX_RAW_MANIFEST_BYTES,
        options
      );

      if (manifestResult.status < 200 || manifestResult.status >= 300) {
        if (manifestResult.status === 404) {
          throw new Error(`Manifest file "${manifestPath}" listed in tree for "${cleanOwner}/${cleanRepo}" was not found (404). Inconsistent repository state.`);
        }
        throw new Error(
          `Failed to fetch raw manifest "${manifestPath}" for "${cleanOwner}/${cleanRepo}": ${manifestResult.statusText || manifestResult.status}.`
        );
      } else {
        const content = manifestResult.text || '';
        if (inspection.manifestContents) {
          inspection.manifestContents[manifestPath] = content;
        }
        if (manifestPath === 'package.json') {
          inspection.packageJsonContent = content;
        } else if (manifestPath === 'pnpm-workspace.yaml') {
          inspection.pnpmWorkspaceYaml = content;
        } else if (manifestPath === 'turbo.json') {
          inspection.turboJson = content;
        }
      }
    }
  }

  return inspection;
}

/**
 * Transform a raw GitHub repository into our architectural ProjectData specification via repository analyzer
 */
export function transformGitHubRepoToProject(
  repo: GitHubRepoRaw, 
  index = 0, 
  total = 1,
  inspection?: RawRepositoryInspection
): ProjectData {
  return analyzeRepository({
    repo,
    inspection,
    index,
    total
  });
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

  // 1. Synthesize recognized technologies across all projects using evidence & family mapping
  const techProjectMap = new Map<string, Set<string>>();

  projects.forEach(p => {
    const evidence = getProjectTechnologyEvidence(p);
    evidence.forEach(rawTech => {
      const canonicalName = normalizeTechnologyName(rawTech);
      if (!canonicalName) return;

      if (!techProjectMap.has(canonicalName)) {
        techProjectMap.set(canonicalName, new Set());
      }
      techProjectMap.get(canonicalName)!.add(p.id);

      const families = getTechnologyFamilies(canonicalName);
      families.forEach(fam => {
        if (!techProjectMap.has(fam)) {
          techProjectMap.set(fam, new Set());
        }
        techProjectMap.get(fam)!.add(p.id);
      });
    });
  });

  // Filter to recognized technology families that have at least 1 matching project
  const eligibleTechs = Array.from(techProjectMap.keys()).filter(tech => {
    return Boolean(RECOGNIZED_CAPABILITY_TAXONOMY[tech]);
  });

  eligibleTechs.sort((a, b) => {
    const countA = techProjectMap.get(a)?.size || 0;
    const countB = techProjectMap.get(b)?.size || 0;
    if (countB !== countA) return countB - countA;
    return a.localeCompare(b);
  });

  const primaryStack = eligibleTechs.slice(0, 7);

  // 2. Generate 3D Infrastructure Plinths in Center Hexagonal/Radial Array
  const skills: InfrastructureSkill[] = eligibleTechs.map((tech, idx) => {
    const totalSkills = Math.max(eligibleTechs.length, 1);
    const angle = (idx / totalSkills) * Math.PI * 2;
    const radius = 90 + Math.floor(idx / 8) * 35;
    const gridX = Math.round((Math.cos(angle) * radius) / 20) * 20;
    const gridY = Math.round((Math.sin(angle) * (radius * 0.7)) / 20) * 20;
    const taxonomyMeta = RECOGNIZED_CAPABILITY_TAXONOMY[tech];
    const cat = taxonomyMeta?.category || inferCategory(tech, [], '');
    const titleSuffix = taxonomyMeta?.titleSuffix || 'Application Architecture';

    const matchingProjects = projects.filter(p => projectUsesCapability(p, tech)).map(p => p.id);

    return {
      id: `gh-infra-${idx + 1}`,
      code: `INF-${(idx + 1).toString().padStart(2, '0')}`,
      name: `${tech} & ${titleSuffix}`,
      category: cat,
      yearsActive: 0,
      proficiencyScore: 0,
      gridPosition: { x: gridX, y: gridY },
      systemCount: matchingProjects.length,
      usedInProjects: matchingProjects,
      primaryUseCases: [`Detected in ${matchingProjects.length} public GitHub ${matchingProjects.length === 1 ? 'repository' : 'repositories'}`],
      technicalHighlights: ['No proficiency score or years inferred from repository metadata'],
      samplePattern: '// Evidence source: public GitHub repository metadata'
    };
  });

  // Symmetrically re-link projects to these skills using the unified predicate
  projects.forEach((p) => {
    p.infrastructureDeps = skills.filter(s => projectUsesCapability(p, s)).map(s => s.id);
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
    status: 'ACTIVE_BUILD // GITHUB SNAPSHOT',
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
 * Stage 1: Discover inventory (Profile + all paginated repositories)
 */
export async function discoverGitHubInventory(
  username: string,
  options?: GitHubFetchOptions
): Promise<{ user: GitHubUser; repos: GitHubRepoRaw[]; rawCount: number }> {
  const fetchImpl = options?.fetchImpl || globalThis.fetch;
  const cleanUser = username.trim().replace(/^@/, '');

  // 1. Fetch User Profile
  const userRes = await fetchImpl(`https://api.github.com/users/${encodeURIComponent(cleanUser)}`, {
    headers: getGitHubHeaders(options, 'application/vnd.github.v3+json')
  });

  if (!userRes.ok) {
    if (userRes.status === 404) {
      throw new Error(`GitHub user or organization "@${cleanUser}" was not found.`);
    }
    handleGitHubHttpError(userRes, `fetching GitHub profile for "@${cleanUser}"`);
  }

  const rawUser = await userRes.json();
  const user = sanitizeGitHubUser(rawUser);

  // 2. Fetch Repositories with pagination
  const allRawRepos: GitHubRepoRaw[] = [];
  let page = 1;

  while (true) {
    const reposRes = await fetchImpl(`https://api.github.com/users/${encodeURIComponent(cleanUser)}/repos?sort=updated&per_page=100&page=${page}`, {
      headers: getGitHubHeaders(options, 'application/vnd.github.v3+json')
    });

    if (!reposRes.ok) {
      if (page === 1) {
        handleGitHubHttpError(reposRes, `fetching repositories for "${cleanUser}"`);
      } else {
        handleGitHubHttpError(reposRes, `fetching all repositories for "${cleanUser}" while requesting page ${page}`);
      }
    }

    const pageRepos: GitHubRepoRaw[] = await reposRes.json();
    if (!Array.isArray(pageRepos) || pageRepos.length === 0) {
      break;
    }

    allRawRepos.push(...pageRepos);

    if (pageRepos.length < 100) {
      break;
    }
    page++;
  }

  if (allRawRepos.length === 0) {
    throw new Error(`User "@${cleanUser}" has no public repositories to visualize.`);
  }

  return { user, repos: allRawRepos, rawCount: allRawRepos.length };
}

/**
 * Stage 2: Filter eligible repositories (non-fork, non-empty, non-empty candidate fallback)
 */
export function filterEligibleRepositories(repos: GitHubRepoRaw[]): GitHubRepoRaw[] {
  const nonForkRepos = repos.filter(r => !r.fork && r.size > 0);
  const candidateRepos = nonForkRepos.length >= 3 ? nonForkRepos : repos.filter(r => r.size > 0);
  return candidateRepos.length > 0 ? candidateRepos : repos;
}

/**
 * Stage 3: Deduplicate repositories belonging to the same canonical cluster BEFORE deep inspection.
 * Canonical clustering is owner-curated data, so each repository is resolved
 * against its OWN `owner.login` -- a foreign owner's distinct repositories
 * are never merged together merely because their names coincidentally match
 * this owner's cluster aliases.
 */
export function canonicalizeRepositories(repos: GitHubRepoRaw[]): GitHubRepoRaw[] {
  const seenClusters = new Map<string, GitHubRepoRaw>();
  for (const repo of repos) {
    const clusterKey = getCanonicalRepositoryKey(repo.name, repo.owner?.login);
    if (!seenClusters.has(clusterKey)) {
      seenClusters.set(clusterKey, repo);
    } else {
      const existing = seenClusters.get(clusterKey)!;
      if (existing.name.toLowerCase() !== clusterKey && repo.name.toLowerCase() === clusterKey) {
        seenClusters.set(clusterKey, repo);
      }
    }
  }
  return Array.from(seenClusters.values());
}

/**
 * Stage 4: Deep inspect ALL canonical candidate repositories with bounded concurrency
 */
export async function inspectCanonicalRepositories(
  canonicalRepos: GitHubRepoRaw[],
  options?: GitHubFetchOptions
): Promise<{ inspections: (RawRepositoryInspection | undefined)[]; summary: RepositoryInspectionSummary }> {
  const concurrency = options?.inspectionConcurrency ?? DEFAULT_INSPECTION_CONCURRENCY;
  let successfulInspections = 0;

  const inspections = await runWithConcurrency(
    canonicalRepos,
    concurrency,
    async (repo) => {
      const insp = await fetchRepoInspection(repo.owner.login, repo.name, repo.default_branch, options);
      successfulInspections++;
      return insp;
    }
  );

  const summary: RepositoryInspectionSummary = {
    canonicalRepositoryCount: canonicalRepos.length,
    inspectedRepositoryCount: successfulInspections,
    warnings: []
  };

  return { inspections, summary };
}

/**
 * Stage 5: Analyze inspected canonical repositories and synthesize systems cartography snapshot
 */
export function analyzeGitHubSnapshot(
  user: GitHubUser | null,
  canonicalRepos: GitHubRepoRaw[],
  inspections: (RawRepositoryInspection | undefined)[],
  sourceIdentifier: string,
  _options?: GitHubFetchOptions
): GitHubSyncResult {
  const projects = canonicalRepos.map((repo, idx) => 
    transformGitHubRepoToProject(repo, idx, canonicalRepos.length, inspections[idx])
  );
  const { skills, operator, experience } = generateGitHubProfileDetails(projects, user, sourceIdentifier);

  return {
    sourceType: 'user',
    sourceIdentifier,
    user: user || sanitizeGitHubUser(null),
    projects,
    skills,
    operator,
    experience,
    rawCount: canonicalRepos.length
  };
}

/**
 * Fetch GitHub user or organization repositories and deep inspect ALL canonical repositories
 */
export async function fetchGitHubUserData(
  username: string, 
  options?: GitHubFetchOptions
): Promise<GitHubSyncResult> {
  const { user, repos, rawCount } = await discoverGitHubInventory(username, options);
  const eligibleRepos = filterEligibleRepositories(repos);
  const canonicalRepos = canonicalizeRepositories(eligibleRepos);
  const { inspections, summary } = await inspectCanonicalRepositories(canonicalRepos, options);
  const result = analyzeGitHubSnapshot(user, canonicalRepos, inspections, user.login || username, options);
  result.rawCount = rawCount;
  result.inspectionSummary = summary;
  return result;
}

/**
 * Fetch a single GitHub repository with inspection data
 */
export async function fetchGitHubRepoData(
  owner: string, 
  repoName: string, 
  options?: GitHubFetchOptions
): Promise<GitHubSyncResult> {
  const fetchImpl = options?.fetchImpl || globalThis.fetch;
  const cleanOwner = owner.trim();
  const cleanRepo = repoName.trim();

  const repoRes = await fetchImpl(`https://api.github.com/repos/${encodeURIComponent(cleanOwner)}/${encodeURIComponent(cleanRepo)}`, {
    headers: getGitHubHeaders(options, 'application/vnd.github.v3+json')
  });

  if (!repoRes.ok) {
    if (repoRes.status === 404) {
      throw new Error(`Repository "${cleanOwner}/${cleanRepo}" was not found or is private.`);
    }
    handleGitHubHttpError(repoRes, `fetching repository "${cleanOwner}/${cleanRepo}"`);
  }

  const rawRepo: GitHubRepoRaw = await repoRes.json();

  // Try fetching user profile of repo owner
  let user: GitHubUser | null = null;
  try {
    const userRes = await fetchImpl(`https://api.github.com/users/${encodeURIComponent(cleanOwner)}`, {
      headers: getGitHubHeaders(options, 'application/vnd.github.v3+json')
    });
    if (userRes.ok) {
      user = sanitizeGitHubUser(await userRes.json());
    }
  } catch {
    // Non-fatal
  }

  const inspection = await fetchRepoInspection(cleanOwner, cleanRepo, rawRepo.default_branch, options);
  const summary: RepositoryInspectionSummary = {
    canonicalRepositoryCount: 1,
    inspectedRepositoryCount: inspection ? 1 : 0,
    warnings: []
  };

  const project = transformGitHubRepoToProject(rawRepo, 0, 1, inspection);
  const { skills, operator, experience } = generateGitHubProfileDetails([project], user, `${cleanOwner}/${cleanRepo}`);

  return {
    sourceType: 'repo',
    sourceIdentifier: `${cleanOwner}/${cleanRepo}`,
    user: user || sanitizeGitHubUser(null),
    projects: [project],
    skills,
    operator,
    experience,
    rawCount: 1,
    inspectionSummary: summary
  };
}

/**
 * Deterministic target connector: accepts URL or shorthand handle/repo
 */
export async function connectGitHubTarget(
  input: string, 
  options?: GitHubFetchOptions
): Promise<GitHubSyncResult> {
  const parsed = parseGitHubTarget(input);
  if (parsed.type === 'repo' && parsed.repo) {
    return fetchGitHubRepoData(parsed.owner, parsed.repo, options);
  }
  return fetchGitHubUserData(parsed.owner, options);
}
