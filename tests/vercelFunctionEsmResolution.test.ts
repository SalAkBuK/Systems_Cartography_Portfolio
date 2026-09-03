/**
 * REGRESSION TEST for the production Vercel failure:
 *
 *   Error [ERR_MODULE_NOT_FOUND]:
 *   Cannot find module '/var/task/src/services/githubLiveInventory'
 *   imported from /var/task/api/github-live.js
 *
 * Root cause: the project is `"type": "module"`. Vercel transpiles
 * `api/github-live.ts` (and its local dependency graph) to individual `.js`
 * files WITHOUT bundling and WITHOUT rewriting import specifiers, then runs the
 * function under Node's native ESM loader. Node ESM does not do `.js` extension
 * inference for relative specifiers, so an extensionless local import
 * (`../src/services/githubLiveInventory`) fails at module-load time -- before
 * the handler's own try/catch can run. Vite / tsx / `tsc --moduleResolution
 * bundler` all mask this locally because they DO resolve extensionless
 * TypeScript imports.
 *
 * This test reproduces Vercel's build+run faithfully:
 *   1. Transpile the exact runtime import graph rooted at `api/github-live.ts`
 *      the way a per-file serverless transpile does -- strip types, keep every
 *      import specifier byte-for-byte, no bundling.
 *   2. Materialize it to a temp dir with a `"type": "module"` package.json
 *      (mirroring this repo).
 *   3. Load + run it in a CLEAN `node` child process (no tsx loader hooks), so
 *      Node's real ESM resolver is what decides whether the graph loads.
 *
 * Against commit 2be037c (extensionless local imports) the child process exits
 * non-zero with ERR_MODULE_NOT_FOUND and the load/run test fails; the static
 * "no extensionless specifier" check fails too. With explicit `.js` specifiers
 * on the local runtime imports every assertion passes.
 */

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const REPO_ROOT = process.cwd();
/** The Vercel serverless function whose emitted graph must be Node-ESM-safe. */
const ENTRY = 'api/github-live.ts';
/** Every other `api/*.ts` function whose emitted graph must ALSO be Node-ESM-safe. */
const OTHER_ENTRIES = ['api/contact.ts'];

interface EmittedFile {
  /** Repo-relative source path, e.g. `src/services/githubLiveInventory.ts`. */
  rel: string;
  /** JavaScript emitted by a types-only transpile (specifiers untouched). */
  js: string;
}

/**
 * Transpiles ONE TypeScript source file to JavaScript exactly the way a
 * per-file serverless transpile (esbuild transform / `tsc` emit) does: strip
 * types, elide type-only imports, and keep every remaining import specifier
 * byte-for-byte. No `.js` injection, no path rewriting, no bundling.
 */
function transpileFileToEsm(absPath: string): string {
  const source = readFileSync(absPath, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    fileName: absPath,
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      isolatedModules: true,
      verbatimModuleSyntax: false,
    },
  });
  return outputText;
}

/** Every relative specifier that actually survives into an emitted JS file. */
function relativeSpecifiers(js: string): string[] {
  const specs = new Set<string>();
  const patterns = [
    /\bfrom\s*['"](\.[^'"]+)['"]/g,
    /\bimport\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g,
  ];
  for (const re of patterns) {
    let match: RegExpExecArray | null;
    while ((match = re.exec(js))) specs.add(match[1]);
  }
  return [...specs];
}

/**
 * Resolves a relative specifier (extensionless OR `.js`) to its real `.ts`
 * source, mirroring how a bundler-style resolver maps `./x.js` -> `./x.ts`.
 * Returns null when nothing matches.
 */
function resolveToSource(importerAbsPath: string, spec: string): string | null {
  const raw = path.resolve(path.dirname(importerAbsPath), spec);
  const stem = raw.endsWith('.js') ? raw.slice(0, -'.js'.length) : raw;
  const candidates = [
    raw,
    `${stem}.ts`,
    `${stem}.tsx`,
    path.join(stem, 'index.ts'),
    path.join(stem, 'index.tsx'),
  ];
  for (const candidate of candidates) {
    if (/\.tsx?$/.test(candidate) && existsSync(candidate)) return candidate;
  }
  return null;
}

interface GraphResult {
  files: EmittedFile[];
  /** `importer -> specifier` pairs that could not be resolved to a source file. */
  unresolved: string[];
}

/** Walks the emitted runtime import graph starting from `entryRel`. */
function buildEmittedGraph(entryRel: string): GraphResult {
  const entryAbs = path.resolve(REPO_ROOT, entryRel);
  const byAbs = new Map<string, EmittedFile>();
  const unresolved: string[] = [];
  const queue: string[] = [entryAbs];

  while (queue.length) {
    const abs = queue.shift()!;
    if (byAbs.has(abs)) continue;
    const js = transpileFileToEsm(abs);
    const rel = path.relative(REPO_ROOT, abs).split(path.sep).join('/');
    byAbs.set(abs, { rel, js });

    for (const spec of relativeSpecifiers(js)) {
      const resolved = resolveToSource(abs, spec);
      if (resolved) queue.push(resolved);
      else unresolved.push(`${rel} -> ${spec}`);
    }
  }

  return { files: [...byAbs.values()], unresolved };
}

/**
 * Writes the emitted graph to a fresh temp dir as `.js` files under a
 * `"type": "module"` package, preserving the repo's relative directory layout
 * (so `api/` and `src/` sit side by side exactly as on Vercel).
 */
function materialize(files: EmittedFile[]): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'scp-vercel-esm-'));
  writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'vercel-emit-fixture', private: true, type: 'module' }, null, 2),
  );
  for (const { rel, js } of files) {
    const outAbs = path.join(dir, rel.replace(/\.tsx?$/, '.js'));
    mkdirSync(path.dirname(outAbs), { recursive: true });
    writeFileSync(outAbs, js);
  }
  return dir;
}

/**
 * A standalone ESM script (run by a clean `node`, so ONLY Node's native
 * resolver applies) that: imports the emitted Vercel function module, imports
 * the emitted core, drives the core with a stub GitHub transport, and prints
 * the outcome as JSON. Any module-resolution failure aborts it before output.
 */
const SMOKE_RUNNER = `
import vercelFn from './api/github-live.js';
import { handleLiveGitHubRequest } from './src/services/githubLiveInventory.js';

const fakeFetch = async (input) => {
  const url = String(input);
  const page = Number((url.match(/[?&]page=(\\d+)/) || [])[1] || '1');
  const body = page === 1 ? [{
    id: 42,
    name: 'demo',
    full_name: 'example/demo',
    html_url: 'https://github.com/example/demo',
    homepage: 'https://demo.example.com',
    description: 'fixture repo',
    language: 'TypeScript',
    topics: ['systems'],
    stargazers_count: 3,
    forks_count: 1,
    open_issues_count: 0,
    size: 128,
    archived: false,
    fork: false,
    default_branch: 'main',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-06-01T00:00:00Z',
    pushed_at: '2025-06-01T00:00:00Z',
    owner: { login: 'example' },
  }] : [];
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
};

const result = await handleLiveGitHubRequest({
  method: 'GET',
  env: {},
  fetchImpl: fakeFetch,
  githubTarget: 'https://github.com/example',
  schedulerOptions: { minSpacingMs: 0, maxRetries: 0 },
  now: () => 1700000000000,
});

process.stdout.write(JSON.stringify({
  vercelFnType: typeof vercelFn,
  status: result.status,
  body: result.body,
}));
`;

const graph = buildEmittedGraph(ENTRY);
const emitDir = materialize(graph.files);
after(() => rmSync(emitDir, { recursive: true, force: true }));

// ---------------------------------------------------------------------------
// Graph shape
// ---------------------------------------------------------------------------
test('every relative specifier in the emitted serverless graph resolves to a source file', () => {
  assert.deepEqual(graph.unresolved, []);
  // Sanity: the entry really did pull in the live-inventory core + its deps.
  const rels = graph.files.map((f) => f.rel).sort();
  assert.ok(rels.includes('api/github-live.ts'));
  assert.ok(rels.includes('src/services/githubLiveInventory.ts'));
  assert.ok(rels.includes('src/services/githubRequestScheduler.ts'));
  assert.ok(rels.includes('src/data/ownerProfile.generated.ts'));
  assert.ok(rels.includes('src/utils/ownerScope.ts'));
  assert.ok(rels.includes('src/utils/urlSecurity.ts'));
});

test('no emitted file keeps an extensionless local import (Node ESM has no `.js` inference)', () => {
  const offenders: string[] = [];
  for (const { rel, js } of graph.files) {
    for (const spec of relativeSpecifiers(js)) {
      if (!/\.(js|mjs|cjs|json)$/.test(spec)) offenders.push(`${rel}: "${spec}"`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `extensionless local runtime imports fail on Vercel with ERR_MODULE_NOT_FOUND:\n${offenders.join('\n')}`,
  );
});

// ---------------------------------------------------------------------------
// The SAME guarantees for every OTHER api/*.ts function (contact, ...).
// The runtime smoke-run above is github-live-specific; the graph checks are
// generic, so run them per additional entry.
// ---------------------------------------------------------------------------
for (const otherEntry of OTHER_ENTRIES) {
  const otherGraph = buildEmittedGraph(otherEntry);
  const otherEmitDir = materialize(otherGraph.files);
  after(() => rmSync(otherEmitDir, { recursive: true, force: true }));

  test(`${otherEntry}: every relative specifier in the emitted graph resolves to a source file`, () => {
    assert.deepEqual(otherGraph.unresolved, []);
    const rels = otherGraph.files.map((f) => f.rel).sort();
    assert.ok(rels.includes(otherEntry));
  });

  test(`${otherEntry}: no emitted file keeps an extensionless local import`, () => {
    const offenders: string[] = [];
    for (const { rel, js } of otherGraph.files) {
      for (const spec of relativeSpecifiers(js)) {
        if (!/\.(js|mjs|cjs|json)$/.test(spec)) offenders.push(`${rel}: "${spec}"`);
      }
    }
    assert.deepEqual(offenders, [], `extensionless local imports:\n${offenders.join('\n')}`);
  });

  test(`${otherEntry}: emitted entry default-exports a handler and imports cleanly under native Node ESM`, () => {
    const probe = path.join(otherEmitDir, 'probe.mjs');
    const entryUrl = pathToFileURL(path.join(otherEmitDir, otherEntry.replace(/\.tsx?$/, '.js'))).href;
    writeFileSync(probe, `const m = await import(${JSON.stringify(entryUrl)});\nprocess.stdout.write(typeof m.default);\n`);
    let out: string;
    try {
      out = execFileSync(process.execPath, [probe], { encoding: 'utf8', env: { ...process.env, NODE_OPTIONS: '' } });
    } catch (err) {
      const e = err as { stderr?: string; stdout?: string; message: string };
      assert.fail(`native Node ESM could not load ${otherEntry}:\n${e.stderr || e.stdout || e.message}`);
    }
    assert.equal(out, 'function');
  });
}

// ---------------------------------------------------------------------------
// Node native ESM load + run  (the exact production failure surface)
// ---------------------------------------------------------------------------
test('the emitted Vercel function graph loads and runs under a clean Node ESM process', () => {
  const runnerPath = path.join(emitDir, 'smoke-runner.mjs');
  writeFileSync(runnerPath, SMOKE_RUNNER);

  let stdout: string;
  try {
    stdout = execFileSync(process.execPath, [runnerPath], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      // Strip any inherited loader hooks (e.g. tsx) so ONLY Node's native ESM
      // resolver decides whether the emitted graph loads -- exactly as on Vercel.
      env: { ...process.env, NODE_OPTIONS: '' },
    });
  } catch (err) {
    const e = err as { stderr?: string; stdout?: string; message: string };
    assert.fail(
      `Node native ESM could not load/run the emitted Vercel function graph ` +
        `(this is the production ERR_MODULE_NOT_FOUND):\n${e.stderr || e.stdout || e.message}`,
    );
  }

  const parsed = JSON.parse(stdout) as {
    vercelFnType: string;
    status: number;
    body: {
      ok: boolean;
      reason: string;
      owner: string;
      repositoryCount: number;
      repositories: Array<{ name: string }>;
    };
  };

  assert.equal(parsed.vercelFnType, 'function', 'api/github-live.js default-exports its handler');
  assert.equal(parsed.status, 200);
  assert.equal(parsed.body.ok, true);
  assert.equal(parsed.body.reason, 'ok');
  assert.equal(parsed.body.owner, 'example');
  assert.equal(parsed.body.repositoryCount, 1);
  assert.equal(parsed.body.repositories[0].name, 'demo');
});

// A second, independent guarantee that the emitted files really are ES modules
// Node loads natively (not accidentally CJS), addressed by URL.
test('emitted entry is importable by file URL from a clean Node process', () => {
  const probe = path.join(emitDir, 'import-probe.mjs');
  const entryUrl = pathToFileURL(path.join(emitDir, 'api/github-live.js')).href;
  writeFileSync(
    probe,
    `const m = await import(${JSON.stringify(entryUrl)});\n` +
      `process.stdout.write(typeof m.default);\n`,
  );
  const out = execFileSync(process.execPath, [probe], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_OPTIONS: '' },
  });
  assert.equal(out.trim(), 'function');
});
