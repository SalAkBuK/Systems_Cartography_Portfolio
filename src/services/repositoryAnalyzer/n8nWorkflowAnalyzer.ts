/**
 * n8n WORKFLOW JSON ANALYZER  (deep / setup-time evidence only).
 *
 * An n8n workflow export is a JSON document with a machine-readable structure:
 * a top-level `nodes` array where every node carries a `type` such as
 * `n8n-nodes-base.webhook` or `n8n-nodes-base.googleSheets`, plus a
 * `connections` map. That structure is STRUCTURED evidence -- the same class as
 * a `package.json` dependency list -- so the technologies this module reports
 * are derived from node `type` strings, never from README or description prose.
 *
 * This runs only in the deep repository-analysis pipeline
 * (`analyzeRepository` -> `analyzeDependencies`). The lightweight runtime
 * `/api/github-live` path never fetches or inspects repository file contents.
 *
 * Nothing here is repository-name aware. Any repository that commits an n8n
 * workflow export gets the same treatment.
 */

/** A node `type` belongs to n8n if it is in the `n8n-nodes-*` namespace (core or community/scoped). */
export function isN8nNodeType(type: unknown): boolean {
  if (typeof type !== 'string' || !type) return false;
  const normalized = type.trim().toLowerCase();
  return (
    normalized.startsWith('n8n-nodes-') ||
    normalized.includes('/n8n-nodes-') ||
    normalized.startsWith('@n8n/')
  );
}

/**
 * True when a parsed JSON value is a genuine n8n workflow export: an object
 * with a non-empty `nodes` array in which at least one node has an
 * `n8n-nodes-*` type. (A bare `{ nodes: [...] }` with no n8n node types is
 * rejected -- it is not enough to prove n8n.)
 */
export function isN8nWorkflowDocument(parsed: unknown): boolean {
  if (!parsed || typeof parsed !== 'object') return false;
  const doc = parsed as Record<string, unknown>;
  const nodes = doc.nodes;
  if (!Array.isArray(nodes) || nodes.length === 0) return false;
  return nodes.some(
    (node) => node && typeof node === 'object' && isN8nNodeType((node as Record<string, unknown>).type),
  );
}

/**
 * Path-shape heuristic for DISCOVERY only (which files to fetch during
 * inspection). A candidate must still pass `isN8nWorkflowDocument` on its
 * content before it counts. Deliberately narrow so it does not collide with
 * ordinary config/data JSON in unrelated repositories.
 */
export function isCandidateN8nWorkflowPath(path: string): boolean {
  if (typeof path !== 'string') return false;
  const lower = path.toLowerCase();
  if (!lower.endsWith('.json')) return false;

  const segments = lower.split('/');
  const fileName = segments[segments.length - 1];
  const dirs = segments.slice(0, -1);

  // Never treat a recognized manifest / tool config as an n8n candidate.
  const EXCLUDED = new Set([
    'package.json',
    'package-lock.json',
    'composer.json',
    'tsconfig.json',
    'turbo.json',
    'biome.json',
    'components.json',
    'manifest.json',
    'nx.json',
    'lerna.json',
    'renovate.json',
    'vercel.json',
    'app.json',
    'now.json',
  ]);
  if (EXCLUDED.has(fileName)) return false;
  if (/\.(config|schema|eslintrc|prettierrc|babelrc)\.json$/.test(fileName)) return false;
  if (/tsconfig\..*\.json$/.test(fileName)) return false;

  // Accept: a file living under a workflow/automation directory, ...
  const dirMatch = dirs.some((d) =>
    ['workflows', 'workflow', 'n8n', '.n8n', 'flows', 'flow', 'automations', 'automation'].includes(d),
  );
  // ... or a root/near-root file whose name signals a workflow export.
  const nameMatch =
    /(^|[-_. ])(n8n|workflow|flow|automation)s?([-_. ].*)?\.json$/.test(fileName) ||
    fileName === 'workflow.json';

  return dirMatch || nameMatch;
}

export interface N8nWorkflowAnalysis {
  isN8nProject: boolean;
  workflowCount: number;
  /** Distinct node `type` strings seen across all validated workflows. */
  nodeTypes: string[];
  /** Canonical technologies proven by node types (never inferred from prose). */
  technologies: string[];
}

const EMPTY_ANALYSIS: N8nWorkflowAnalysis = {
  isN8nProject: false,
  workflowCount: 0,
  nodeTypes: [],
  technologies: [],
};

/** Trailing segment of an n8n node type, lowercased: `n8n-nodes-base.googleSheetsTrigger` -> `googlesheetstrigger`. */
function nodeLeaf(type: string): string {
  const parts = type.trim().toLowerCase().split('.');
  return parts[parts.length - 1] || '';
}

/**
 * Maps validated n8n workflow JSON bodies to canonical technologies. `n8n`
 * itself is always included when at least one valid workflow is present; the
 * integration technologies require a matching node type.
 */
export function analyzeN8nWorkflows(contents: Record<string, string> | undefined): N8nWorkflowAnalysis {
  if (!contents || Object.keys(contents).length === 0) return { ...EMPTY_ANALYSIS };

  const nodeTypes = new Set<string>();
  let workflowCount = 0;

  for (const body of Object.values(contents)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      continue;
    }
    if (!isN8nWorkflowDocument(parsed)) continue;
    workflowCount++;
    for (const node of (parsed as { nodes: unknown[] }).nodes) {
      const type = node && typeof node === 'object' ? (node as Record<string, unknown>).type : null;
      if (typeof type === 'string' && isN8nNodeType(type)) nodeTypes.add(type.trim());
    }
  }

  if (workflowCount === 0) return { ...EMPTY_ANALYSIS };

  const technologies = new Set<string>(['n8n']);
  const leaves = Array.from(nodeTypes).map(nodeLeaf);

  if (leaves.some((l) => /^webhook/.test(l) || l === 'respondtowebhook')) {
    technologies.add('Webhooks');
  }
  if (leaves.some((l) => l.startsWith('googlesheets'))) {
    technologies.add('Google Sheets');
  }
  if (leaves.some((l) => l.startsWith('whatsapp'))) {
    technologies.add('WhatsApp Cloud API');
  }

  return {
    isN8nProject: true,
    workflowCount,
    nodeTypes: Array.from(nodeTypes).sort(),
    technologies: Array.from(technologies),
  };
}
