/**
 * VERCEL SERVERLESS FUNCTION DETECTOR  (deep / setup-time evidence only).
 *
 * A repository ships real server-side code on Vercel when it BOTH:
 *
 *   1. carries Vercel deployment configuration at its ROOT -- `vercel.json`, AND
 *   2. contains at least one source file under a ROOT `api/` directory with a
 *      Node-executable extension in the JavaScript/TypeScript family
 *      (`.ts`, `.js`, `.mjs`, `.cjs`), including nested routes such as
 *      `api/users/[id].ts`.
 *
 * The legacy `now.json` is NOT accepted: Vercel dropped support for it on
 * 2026-03-31, so its presence in a current repository is not proof of a live
 * Vercel deployment. This analyzer reports current repository architecture, not
 * historical configuration -- there is deliberately no deprecated-config mode.
 *
 * Both are STRUCTURAL repository facts read from the Git tree
 * (`inspection.treeFiles`) -- never README / description / topic prose. No
 * dependency on Express / Fastify / Nest / etc.: a repository can expose
 * genuine Vercel functions with nothing in `package.json` but `@types/node`.
 *
 * Requiring BOTH signals keeps the detector CONSERVATIVE:
 *   - a Vercel-hosted pure frontend (config present, no root `api/`) is rejected;
 *   - an arbitrary directory that merely happens to be named `api` (functions
 *     present, no Vercel config) is rejected;
 *   - `src/api/`, `docs/api/`, `examples/api/`, `packages/x/api/` and any other
 *     non-root `api/` are rejected -- only a ROOT `api/` counts.
 *
 * This runs only in the deep repository-analysis pipeline
 * (`analyzeRepository` -> `analyzeDependencies`). The lightweight runtime
 * live-inventory path never inspects repository file contents.
 *
 * Nothing here is repository-name aware. Any repository with this structure
 * gets the same treatment.
 */

/** Node-executable source extensions Vercel treats as functions in the JS/TS family. */
const SERVERLESS_SOURCE_EXTENSIONS = ['.ts', '.js', '.mjs', '.cjs'] as const;

/**
 * The current root-level Vercel deployment configuration filename. The legacy
 * `now.json` is intentionally absent -- Vercel removed support for it on
 * 2026-03-31.
 */
const VERCEL_DEPLOYMENT_CONFIG_FILE = 'vercel.json';

/** Hard cap so a pathological tree cannot balloon the reported evidence. */
const MAX_REPORTED_FUNCTION_PATHS = 50;

/** Normalizes a tree path for matching: trims and drops a leading `./`. */
function normalizeTreePath(path: string): string {
  return path.trim().replace(/^\.\//, '');
}

/**
 * True for a ROOT `vercel.json` (no directory prefix). A nested
 * `apps/web/vercel.json` or `config/vercel.json` is deliberately NOT accepted
 * -- Vercel deployment configuration is only authoritative at the repository
 * root. The legacy `now.json` is NOT accepted at all (support removed
 * 2026-03-31).
 */
export function isVercelDeploymentConfigPath(path: string): boolean {
  if (typeof path !== 'string' || !path) return false;
  const normalized = normalizeTreePath(path);
  if (!normalized || normalized.includes('/')) return false;
  return normalized.toLowerCase() === VERCEL_DEPLOYMENT_CONFIG_FILE;
}

/**
 * True for a candidate Vercel serverless function file: a `.ts` / `.js` /
 * `.mjs` / `.cjs` source directly under a ROOT `api/` directory or nested
 * beneath it (`api/users/[id].ts`). Type-declaration files (`*.d.ts`) and
 * co-located test files (`*.test.*`, `*.spec.*`) are excluded -- they are not
 * deployable functions.
 */
export function isVercelServerlessFunctionPath(path: string): boolean {
  if (typeof path !== 'string' || !path) return false;
  const normalized = normalizeTreePath(path);

  // Must live under a ROOT `api/` directory. `src/api/...`, `docs/api/...`,
  // `examples/api/...`, `packages/x/api/...`, and a bare file named `api` all
  // fail this check. `apiv2/...` fails too -- the `/` is required.
  if (!normalized.startsWith('api/')) return false;

  const segments = normalized.split('/');
  if (segments.length < 2) return false;

  const fileName = segments[segments.length - 1].toLowerCase();
  if (!fileName || fileName.startsWith('.')) return false;
  if (fileName.endsWith('.d.ts')) return false;
  if (/\.(test|spec)\.[a-z0-9]+$/.test(fileName)) return false;

  return SERVERLESS_SOURCE_EXTENSIONS.some((ext) => fileName.endsWith(ext));
}

export interface VercelFunctionAnalysis {
  /** True only when BOTH a root `vercel.json` AND >=1 valid root `api/` function exist. */
  isVercelServerlessProject: boolean;
  /** Whether a root `vercel.json` was seen (independent of `api/`). */
  hasVercelDeploymentConfig: boolean;
  /** The detected root `api/` function paths (sorted, capped). Populated even when the config is absent. */
  functionPaths: string[];
  /** Canonical technologies proven by the structure. Empty unless `isVercelServerlessProject`. */
  technologies: string[];
}

const EMPTY_ANALYSIS: VercelFunctionAnalysis = {
  isVercelServerlessProject: false,
  hasVercelDeploymentConfig: false,
  functionPaths: [],
  technologies: [],
};

/**
 * Structural detection of Vercel serverless functions from a repository's Git
 * tree. `technologies` is non-empty only when both required signals are
 * present, and always leads with `Node.js` (the runtime) before
 * `Vercel Functions` (the platform capability) so downstream techStack /
 * architecture ordering reads naturally.
 */
export function analyzeVercelFunctions(treeFiles: string[] | undefined): VercelFunctionAnalysis {
  if (!Array.isArray(treeFiles) || treeFiles.length === 0) return { ...EMPTY_ANALYSIS };

  const hasVercelDeploymentConfig = treeFiles.some(isVercelDeploymentConfigPath);
  const functionPaths = Array.from(
    new Set(treeFiles.filter(isVercelServerlessFunctionPath).map(normalizeTreePath)),
  )
    .sort()
    .slice(0, MAX_REPORTED_FUNCTION_PATHS);

  if (!hasVercelDeploymentConfig || functionPaths.length === 0) {
    return { ...EMPTY_ANALYSIS, hasVercelDeploymentConfig, functionPaths };
  }

  return {
    isVercelServerlessProject: true,
    hasVercelDeploymentConfig: true,
    functionPaths,
    technologies: ['Node.js', 'Vercel Functions'],
  };
}
