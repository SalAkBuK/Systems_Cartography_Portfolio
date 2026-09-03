/**
 * RUNTIME REPOSITORY RECONCILIATION.
 *
 * Merges the LIVE public GitHub inventory (from the same-origin
 * `/api/github-live` endpoint) with the COMMITTED GitHub snapshot to produce
 * the project inventory the topology renders.
 *
 *   committed snapshot  (authoritative for curated engineering evidence)
 *         +
 *   live public inventory  (authoritative for CURRENT public repository
 *                           membership + GitHub-owned metadata)
 *         ->  reconciled ProjectData[]
 *
 * Design rules (see the feature brief):
 *
 *  - A matched project keeps ALL its rich snapshot-derived content
 *    (architecture, subsystems, capabilities, decisions, curated copy). Only
 *    clearly GitHub-owned facts are overlaid (repo URL, homepage, stars,
 *    forks, open issues, push year, current public/archived status, and the
 *    repository name on a rename).
 *
 *  - A public repo present live but absent from the snapshot appears as a
 *    MINIMAL, honest project and stays shallow. It does NOT inherit deep or
 *    owner-curated repository evidence -- a brand-new repository must not pick
 *    up architecture from a *different*, since-deleted repository that merely
 *    shared its name. Deep/curated evidence attaches only when a later
 *    `npm run sync:github` folds it into the committed snapshot (matched there
 *    by stable GitHub id). Missing sections use the existing UNAVAILABLE
 *    presentation. Its `techStack` is the primary GitHub language plus only
 *    those exact GitHub topics that normalize to a recognized capability
 *    technology.
 *
 *  - A snapshot project absent from the live inventory is removed ONLY when
 *    the live inventory is known to be COMPLETE (`ok && complete`). A partial,
 *    truncated, errored, rate-limited, or malformed inventory never deletes a
 *    snapshot project.
 *
 *  - Forks and empty repositories are NOT promoted to new projects (parity
 *    with the snapshot generator's `filterEligibleRepositories`). Archived
 *    repositories are kept and shown as ARCHIVED (also parity).
 *
 *  - The topology is never emptied by reconciliation: if the merge would
 *    yield zero projects while the snapshot had some, the snapshot is kept.
 *
 * This module is PURE and browser-safe: no network, no React, no time or
 * randomness of its own. It imports only lightweight owner-scope / URL / type
 * helpers -- never the deep-inspection analyzer stack.
 */

import type {
  EvidenceProvenance,
  ProjectData,
  SystemCategory,
  SystemStatus,
} from '../types';
import { getCanonicalRepositoryKey } from '../data/repositoryEvidence';
import { getGithubOwnerIdentity, parseGitHubTarget } from './ownerScope';
import { normalizeTechnologyName, RECOGNIZED_CAPABILITY_TAXONOMY } from './capabilityAssociations';
import { sanitizeHttpUrl } from './urlSecurity';
import type { LiveInventoryResponse, LiveRepository } from '../services/githubLiveTypes';

export interface ReconcileOptions {
  /** The portfolio's configured GitHub target (PORTFOLIO_CONFIG.githubTarget). */
  configuredGithubTarget: string;
}

export interface ReconcileStats {
  /** True when live data was actually applied (vs. a safe fallback to the snapshot). */
  applied: boolean;
  /** Why a fallback happened, when it did. */
  fallbackReason?:
    | 'no_response'
    | 'not_ok'
    | 'owner_mismatch'
    | 'no_repositories_field'
    | 'would_empty_topology';
  matched: number;
  /** Matched projects whose GitHub-owned metadata actually changed. */
  overlaid: number;
  /** New live-only projects added. */
  added: number;
  /** Snapshot projects removed because they are no longer public (complete inventory only). */
  removed: number;
  /** Snapshot projects retained despite being absent, because the inventory was incomplete. */
  retainedOnIncomplete: number;
  /** Whether the live inventory was a complete, authoritative membership list. */
  complete: boolean;
  truncated: boolean;
}

export interface ReconcileResult {
  projects: ProjectData[];
  /** Reference-changed vs. the input array (lets callers skip a no-op state update). */
  changed: boolean;
  stats: ReconcileStats;
}

const GH_ID_PATTERN = /^gh-(\d+)$/;

const UNAVAILABLE_PROBLEM = 'Not established by GitHub repository metadata.';
const UNAVAILABLE_SOLUTION =
  'Inspect the repository and owner-approved case study before publishing implementation claims.';
const UNAVAILABLE_RESILIENCE = 'Not established by GitHub repository metadata.';

function fallback(snapshotProjects: ProjectData[], reason: ReconcileStats['fallbackReason']): ReconcileResult {
  return {
    projects: snapshotProjects,
    changed: false,
    stats: {
      applied: false,
      fallbackReason: reason,
      matched: 0,
      overlaid: 0,
      added: 0,
      removed: 0,
      retainedOnIncomplete: 0,
      complete: false,
      truncated: false,
    },
  };
}

/** GitHub numeric repository id encoded in a snapshot project id (`gh-<id>`). */
export function extractSnapshotRepoId(project: ProjectData): number | null {
  const match = GH_ID_PATTERN.exec(project.id || '');
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isFinite(id) && id > 0 ? id : null;
}

/** `{ owner, repo }` parsed from a snapshot project's own `links.github`. */
export function extractProjectOwnerRepo(project: ProjectData): { owner: string; repo: string } | null {
  const github = project.links?.github;
  if (!github) return null;
  try {
    const parsed = parseGitHubTarget(github);
    if (parsed.type === 'repo' && parsed.repo) {
      return { owner: parsed.owner.toLowerCase(), repo: parsed.repo.toLowerCase() };
    }
  } catch {
    /* not a usable repo URL */
  }
  return null;
}

function deriveYear(...isoCandidates: (string | null | undefined)[]): string {
  for (const iso of isoCandidates) {
    if (!iso) continue;
    const year = new Date(iso).getUTCFullYear();
    if (Number.isFinite(year) && year >= 2000 && year <= 2100) return String(year);
  }
  return String(new Date().getUTCFullYear());
}

/**
 * Live-only `techStack` topic rule: keep ONLY exact GitHub topics that
 * normalize to an explicitly recognized capability technology. Generic tags
 * (`healthcare`, `portfolio`, `automation`, `open-source`, ...) are not
 * technologies and never enter `ProjectData.techStack` -- they stay solely in
 * the live response's `topics` array. Returns canonical names.
 */
export function recognizedTopicTechnologies(topics: string[]): string[] {
  const out: string[] = [];
  for (const raw of topics) {
    if (typeof raw !== 'string' || !raw.trim()) continue;
    const canonical = normalizeTechnologyName(raw.trim());
    if (RECOGNIZED_CAPABILITY_TAXONOMY[canonical] && !out.includes(canonical)) {
      out.push(canonical);
    }
  }
  return out;
}

/**
 * GitHub-owned status: an archived repo is ARCHIVED; a repo that is no longer
 * archived reverts an ARCHIVED snapshot to ACTIVE; any other curated/derived
 * status (PRODUCTION, EXPERIMENTAL, ...) is preserved.
 */
export function resolveLiveStatus(snapshotStatus: SystemStatus, archived: boolean): SystemStatus {
  if (archived) return 'ARCHIVED';
  if (snapshotStatus === 'ARCHIVED') return 'ACTIVE';
  return snapshotStatus;
}

function overlayMetricValues(
  metrics: ProjectData['metrics'],
  updates: Record<string, string>,
): { metrics: ProjectData['metrics']; changed: boolean } {
  let changed = false;
  const next = metrics.map((metric) => {
    const replacement = updates[metric.label];
    if (replacement !== undefined && replacement !== metric.value) {
      changed = true;
      return { ...metric, value: replacement };
    }
    return metric;
  });
  return { metrics: changed ? next : metrics, changed };
}

/**
 * Returns a project with ONLY GitHub-owned metadata overlaid from the live
 * repository. Returns the SAME reference when nothing changed.
 */
export function overlayLiveMetadata(project: ProjectData, repo: LiveRepository): ProjectData {
  const nextGithub = sanitizeHttpUrl(repo.htmlUrl) || project.links.github;
  const liveHomepage = sanitizeHttpUrl(repo.homepage) || undefined;
  const nextDemo = liveHomepage ?? project.links.demo;
  const nextTitle = repo.name || project.title;
  const nextYear = deriveYear(repo.pushedAt, repo.updatedAt, project.year);
  const nextStatus = resolveLiveStatus(project.status, repo.archived);

  const { metrics: nextMetrics, changed: metricsChanged } = overlayMetricValues(project.metrics, {
    Stargazers: `${repo.stars} ★`,
    Forks: `${repo.forks} ⑂`,
    'Open Issues': `${repo.openIssues} open`,
  });

  const linksChanged = nextGithub !== project.links.github || nextDemo !== project.links.demo;
  const changed =
    linksChanged ||
    metricsChanged ||
    nextTitle !== project.title ||
    nextYear !== project.year ||
    nextStatus !== project.status;

  if (!changed) return project;

  return {
    ...project,
    title: nextTitle,
    year: nextYear,
    status: nextStatus,
    metrics: nextMetrics,
    links: { ...project.links, github: nextGithub, demo: nextDemo },
  };
}

/**
 * Conservative category inference from live language + topics only. A much
 * smaller heuristic than the snapshot pipeline's `inferCategory` -- it never
 * runs description phrase-matching, and it stays browser-light.
 */
export function inferConservativeCategory(language: string | null, topics: string[]): SystemCategory {
  const lang = (language || '').toLowerCase();
  const topicText = topics.join(' ').toLowerCase();

  if (/\b(cli|command-line|devtools|developer-tools|linter|compiler|parser)\b/.test(topicText)) {
    return 'tooling';
  }
  if (/\b(kubernetes|k8s|terraform|ansible|helm|infrastructure|docker)\b/.test(topicText)) {
    return 'infrastructure';
  }

  const feTopic = /\b(react|vue|svelte|angular|frontend|tailwind|ui|nextjs|next-js)\b/.test(topicText);
  const beTopic = /\b(api|backend|server|graphql|grpc|database|postgres|prisma|nestjs)\b/.test(topicText);
  if (feTopic && beTopic) return 'fullstack';
  if (feTopic) return 'frontend';
  if (beTopic) return 'backend';

  if (['shell', 'dockerfile', 'makefile', 'hcl', 'nix', 'powershell'].includes(lang)) return 'infrastructure';
  if (['html', 'css', 'scss', 'vue', 'svelte'].includes(lang)) return 'frontend';
  if (['typescript', 'javascript'].includes(lang)) return 'fullstack';
  if (
    ['go', 'rust', 'c', 'c++', 'c#', 'java', 'kotlin', 'scala', 'python', 'ruby', 'php', 'elixir'].includes(lang)
  ) {
    return 'backend';
  }
  return 'backend';
}

function languageAccent(language: string | null): string {
  const lang = (language || '').toLowerCase();
  if (lang.includes('typescript') || lang.includes('javascript')) return '#8EA9DA';
  if (lang.includes('rust')) return '#E5534E';
  if (lang.includes('go')) return '#8CD1C8';
  if (lang.includes('python')) return '#F59E0B';
  if (lang.includes('c++') || lang === 'c') return '#A78BFA';
  if (lang.includes('shell') || lang.includes('docker')) return '#E2A96B';
  return '#8EA9DA';
}

/**
 * Builds the minimal honest `ProjectData` for a public repository that exists
 * live but is NOT in the committed snapshot.
 *
 * A live-only repository is ALWAYS shallow: it uses only the lightweight live
 * payload. It deliberately does NOT consult `repositoryEvidence.ts` -- a
 * genuinely new repository must not inherit deep/curated architecture just
 * because the configured owner once had a *different* repository of the same
 * name. Curated and deep evidence attach only when a future
 * `npm run sync:github` folds this repository into the committed snapshot (at
 * which point it is matched by stable GitHub id, not synthesized here).
 *
 * `techStack` is the primary GitHub language plus only those exact GitHub
 * topics that normalize to a recognized capability technology; generic tags
 * are excluded. Every inspector section that needs deep evidence stays
 * `UNAVAILABLE`.
 */
export function synthesizeLiveOnlyProject(
  repo: LiveRepository,
  index: number,
): ProjectData {
  const language = repo.language;

  const techStack = Array.from(
    new Set(
      [language || undefined, ...recognizedTopicTechnologies(repo.topics)].filter(
        (t): t is string => Boolean(t),
      ),
    ),
  );
  if (techStack.length === 0) techStack.push('Codebase');

  const category = inferConservativeCategory(language, repo.topics);

  const summary = repo.description
    ? `${repo.description} GitHub reports ${repo.stars} stars, ${repo.forks} forks, and ${repo.openIssues} open issues.`
    : `Public repository owned by ${repo.ownerLogin}. Primary language: ${language || 'unreported'}.`;

  const architectureNotes = `Verified GitHub metadata only: primary language ${language || 'not reported'}, default branch ${repo.defaultBranch || 'main'}. Deep repository inspection is pending the next committed snapshot refresh (npm run sync:github).`;

  const unavailable: EvidenceProvenance = 'UNAVAILABLE';

  const status: SystemStatus = repo.archived ? 'ARCHIVED' : 'ACTIVE';
  const githubUrl =
    sanitizeHttpUrl(repo.htmlUrl) ||
    `https://github.com/${encodeURIComponent(repo.ownerLogin)}/${encodeURIComponent(repo.name)}`;

  return {
    id: `gh-${repo.id}`,
    code: `GH-L${String(index + 1).padStart(2, '0')}`,
    title: repo.name,
    tagline: repo.description || 'Public repository; no description supplied on GitHub.',
    category,
    classifications: [category],
    status,
    year: deriveYear(repo.pushedAt, repo.updatedAt, repo.createdAt),
    dimensions: { width: 104, height: 72, levels: 2 },
    gridPosition: { x: 0, y: 0 },
    accentColor: languageAccent(language),
    summary,
    problem: UNAVAILABLE_PROBLEM,
    solution: UNAVAILABLE_SOLUTION,
    architectureNotes,
    techStack,
    infrastructureDeps: [],
    subsystems: [],
    metrics: [
      { label: 'Stargazers', value: `${repo.stars} ★`, note: 'GitHub community stars', provenance: 'VERIFIED' },
      { label: 'Forks', value: `${repo.forks} ⑂`, note: 'Public downstream forks', provenance: 'VERIFIED' },
      { label: 'Open Issues', value: `${repo.openIssues} open`, note: 'Issue tracker backlog', provenance: 'VERIFIED' },
      {
        label: 'Primary Language',
        value: language || 'Mixed Stack',
        note: 'Dominant language',
        provenance: 'VERIFIED',
      },
      {
        label: 'Repository Source',
        value: 'LIVE // AWAITING SNAPSHOT REFRESH',
        note: 'Discovered via runtime GitHub inventory; not yet in the committed snapshot',
        provenance: 'VERIFIED',
      },
    ],
    keyDecisions: [],
    resilienceTesting: UNAVAILABLE_RESILIENCE,
    provenance: {
      summary: 'VERIFIED',
      problem: unavailable,
      solution: unavailable,
      architectureNotes: 'VERIFIED',
      subsystems: unavailable,
      keyDecisions: unavailable,
      resilienceTesting: unavailable,
      metrics: 'VERIFIED',
    },
    performanceEvidence: {
      claimed: false,
      notes: 'No runtime benchmarks or production telemetry claimed in repository.',
    },
    links: {
      github: githubUrl,
      demo: sanitizeHttpUrl(repo.homepage) || undefined,
      caseStudy: false,
    },
  };
}

interface LiveIndex {
  byId: Map<number, LiveRepository>;
  byOwnerRepo: Map<string, LiveRepository>;
  byCanonical: Map<string, LiveRepository>;
}

function buildLiveIndex(repos: LiveRepository[], configuredOwnerId: string): LiveIndex {
  const byId = new Map<number, LiveRepository>();
  const byOwnerRepo = new Map<string, LiveRepository>();
  const byCanonical = new Map<string, LiveRepository>();

  for (const repo of repos) {
    // Fail closed on a structurally malformed entry (defense in depth -- the
    // client already shape-validates the payload).
    if (
      !repo ||
      typeof repo !== 'object' ||
      typeof repo.id !== 'number' ||
      !Number.isFinite(repo.id) ||
      repo.id <= 0 ||
      typeof repo.name !== 'string' ||
      !repo.name ||
      typeof repo.ownerLogin !== 'string' ||
      !repo.ownerLogin
    ) {
      continue;
    }
    // Defense in depth: the endpoint already scopes to the owner.
    if (configuredOwnerId && repo.ownerLogin.toLowerCase() !== configuredOwnerId) continue;
    byId.set(repo.id, repo);
    const ownerRepoKey = `${repo.ownerLogin.toLowerCase()}/${repo.name.toLowerCase()}`;
    byOwnerRepo.set(ownerRepoKey, repo);
    const canonicalKey = getCanonicalRepositoryKey(repo.name, repo.ownerLogin);
    if (!byCanonical.has(canonicalKey)) byCanonical.set(canonicalKey, repo);
  }

  return { byId, byOwnerRepo, byCanonical };
}

export function matchSnapshotProjectToLive(
  project: ProjectData,
  index: LiveIndex,
): LiveRepository | null {
  const repoId = extractSnapshotRepoId(project);
  if (repoId !== null) {
    const byId = index.byId.get(repoId);
    if (byId) return byId;
  }

  const ownerRepo = extractProjectOwnerRepo(project);
  if (ownerRepo) {
    const direct = index.byOwnerRepo.get(`${ownerRepo.owner}/${ownerRepo.repo}`);
    if (direct) return direct;

    const canonical = getCanonicalRepositoryKey(ownerRepo.repo, ownerRepo.owner);
    const canonicalMatch = index.byCanonical.get(canonical);
    if (canonicalMatch) return canonicalMatch;
  }

  // Last resort: exact repository-name match against the project title.
  const titleKey = (project.title || '').toLowerCase().trim();
  if (titleKey) {
    for (const repo of index.byOwnerRepo.values()) {
      if (repo.name.toLowerCase() === titleKey) return repo;
    }
  }

  return null;
}

/**
 * Reconciles the committed snapshot projects with a live inventory response.
 * Never throws; falls back to the snapshot on any doubt.
 */
export function reconcileLiveRepositories(
  snapshotProjects: ProjectData[],
  live: LiveInventoryResponse | null | undefined,
  options: ReconcileOptions,
): ReconcileResult {
  if (!live) return fallback(snapshotProjects, 'no_response');
  if (!live.ok) return fallback(snapshotProjects, 'not_ok');
  if (!Array.isArray(live.repositories)) return fallback(snapshotProjects, 'no_repositories_field');

  const configuredOwnerId = getGithubOwnerIdentity(options.configuredGithubTarget);
  if (!configuredOwnerId || getGithubOwnerIdentity(live.owner) !== configuredOwnerId) {
    return fallback(snapshotProjects, 'owner_mismatch');
  }

  const index = buildLiveIndex(live.repositories, configuredOwnerId);
  const complete = live.complete === true;

  const matchedLiveIds = new Set<number>();
  const reconciled: ProjectData[] = [];
  let overlaid = 0;
  let removed = 0;
  let retainedOnIncomplete = 0;

  for (const project of snapshotProjects) {
    const match = matchSnapshotProjectToLive(project, index);
    if (match) {
      matchedLiveIds.add(match.id);
      const overlaidProject = overlayLiveMetadata(project, match);
      if (overlaidProject !== project) overlaid++;
      reconciled.push(overlaidProject);
      continue;
    }

    if (complete) {
      // Proven absent from a complete public inventory -> deleted or private.
      removed++;
      continue;
    }

    // Incomplete inventory: absence proves nothing. Keep the snapshot project.
    retainedOnIncomplete++;
    reconciled.push(project);
  }

  // Newly-created public repositories not represented in the snapshot.
  const additions: LiveRepository[] = [];
  for (const repo of index.byId.values()) {
    if (matchedLiveIds.has(repo.id)) continue;
    if (repo.fork) continue; // parity: forks are not promoted to projects
    if (repo.sizeKb <= 0) continue; // parity: empty repositories are skipped
    additions.push(repo);
  }
  additions.sort((a, b) => {
    const at = a.pushedAt || a.updatedAt || '';
    const bt = b.pushedAt || b.updatedAt || '';
    if (at !== bt) return bt.localeCompare(at);
    return a.name.localeCompare(b.name);
  });
  const synthesized = additions.map((repo, i) => synthesizeLiveOnlyProject(repo, i));

  const combined = [...reconciled, ...synthesized];

  // Never let reconciliation empty the topology.
  if (combined.length === 0 && snapshotProjects.length > 0) {
    return fallback(snapshotProjects, 'would_empty_topology');
  }

  const changed =
    overlaid > 0 || synthesized.length > 0 || removed > 0 || combined.length !== snapshotProjects.length;

  return {
    projects: changed ? combined : snapshotProjects,
    changed,
    stats: {
      applied: true,
      matched: matchedLiveIds.size,
      overlaid,
      added: synthesized.length,
      removed,
      retainedOnIncomplete,
      complete,
      truncated: live.truncated === true,
    },
  };
}

/**
 * Section 13.5 helper: given the currently selected / drilled project ids and
 * the reconciled project list, returns which ids are still valid. A caller
 * clears any id this reports as gone so a disappeared project cannot strand
 * the inspector or subsystem view.
 */
export function projectIdStillPresent(projects: ProjectData[], id: string | null): boolean {
  if (!id) return true;
  return projects.some((project) => project.id === id);
}
