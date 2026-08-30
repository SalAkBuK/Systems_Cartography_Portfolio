/**
 * EXAMPLE: src/data/repositoryEvidence.ts customization pattern.
 *
 * This file is documentation only -- it is not imported by the app. Copy the
 * SHAPE shown here into your own src/data/repositoryEvidence.ts entries. Do
 * not copy the current owner's actual evidence records; write your own,
 * describing YOUR repositories.
 *
 * ---------------------------------------------------------------------------
 * HOW THIS FITS TOGETHER
 * ---------------------------------------------------------------------------
 *
 * `src/data/repositoryEvidence.ts` is PERSISTENT OWNER-CURATED DATA. It is
 * never touched by `npm run setup` (the LinkedIn importer) or `npm run
 * sync:github` (the GitHub snapshot generator) -- you own it, and it
 * survives re-running either tool.
 *
 * The repository analyzer (src/services/repositoryAnalyzer) always computes
 * generic, GitHub-metadata-derived facts for every repository first
 * (languages, topics, dependency manifests, test/CI signals, an inferred
 * category). `repositoryEvidence.ts` lets you OVERLAY reviewed, first-person
 * architecture notes on top of that generic analysis for repositories you
 * have personally reviewed.
 *
 * OWNER SCOPE: this evidence only applies to repositories whose GitHub
 * owner matches `REPOSITORY_EVIDENCE_OWNER_GITHUB_TARGET` in your own
 * repositoryEvidence.ts (which is set to your own configured GitHub target).
 * A repository owned by anyone else -- even one with an identical name --
 * never receives this evidence. See src/utils/ownerScope.ts.
 *
 * ---------------------------------------------------------------------------
 * PROVENANCE
 * ---------------------------------------------------------------------------
 *
 * Every field you set here is labeled CURATED at runtime (you are asserting
 * it, not the engine inferring it). Only write what you can actually stand
 * behind having reviewed the repository yourself. If you are not sure,
 * leave the field out -- the generic analyzer's own inference (labeled
 * VERIFIED/DERIVED/UNAVAILABLE) will be shown instead. CURATED is not a way
 * to claim something is more certain than VERIFIED; it simply means "the
 * repository owner explicitly wrote this."
 */

import { ProjectData, SubsystemNode } from '../../src/types';

type Evidence = Pick<
  ProjectData,
  'problem' | 'solution' | 'architectureNotes' | 'subsystems' | 'keyDecisions' | 'resilienceTesting'
>;

const subsystem = (
  id: string,
  name: string,
  category: SubsystemNode['category'],
  role: string,
  description: string,
  tech: string[],
  x: number,
  y: number,
  protocol?: string
): SubsystemNode => ({
  id,
  name,
  category,
  role,
  protocol,
  description,
  tech,
  coordinates: { x, y, z: 28 },
  dimensions: { width: 48, height: 26, depth: 34 }
});

/**
 * Example entry for a fictional repository named "example-api", owned by
 * a fictional GitHub account "example-owner". Replace with your own
 * repository name (the exact GitHub repo name, lowercased) and your own
 * reviewed notes.
 */
export const exampleEvidenceByRepository: Record<string, Evidence> = {
  'example-api': {
    problem: 'Describe, in one or two sentences, the real engineering problem this repository solves. Be specific and honest -- this is not marketing copy.',
    solution: 'Describe the actual solution shape: the frameworks, the data flow, the key architectural choice that makes this work.',
    architectureNotes: 'Cite what you reviewed to write this: "Repository README: ..." or "Repository source: <file/module> ...". Do not assert claims you have not personally verified against the code.',
    subsystems: [
      subsystem(
        'example-api-gateway',
        'Public API Gateway',
        'backend',
        'Validate requests and dispatch to domain services',
        'Framework-level routing, request validation, and auth middleware sitting in front of the domain logic.',
        ['Node.js', 'Express'],
        -50,
        -25,
        'HTTPS / REST'
      ),
      subsystem(
        'example-api-store',
        'Primary Data Store',
        'database',
        'Persist domain records',
        'Relational schema for the core domain entities.',
        ['PostgreSQL'],
        45,
        20
      )
    ],
    keyDecisions: [
      {
        decision: 'Describe an actual architectural decision you made.',
        rationale: 'Why you made it -- the real constraint or goal it addresses.',
        tradeoff: 'What it costs you in exchange (be honest about downsides).'
      }
    ],
    resilienceTesting: 'Describe what testing/validation evidence actually exists in the repository (test frameworks, CI workflows) -- do not claim coverage you have not verified.'
  }
};

/**
 * Example canonical cluster mapping: if you have multiple repositories that
 * present as ONE logical project (e.g. a sanitized/showcase fork of a
 * private original, or a rename you kept an alias for), map the alias name
 * to the canonical key used in `exampleEvidenceByRepository` above.
 *
 * Leave this empty (`{}`) if every one of your repositories is its own
 * standalone project -- most fork owners will not need this at all.
 */
export const exampleRepositoryCanonicalClusters: Record<string, string> = {
  'example-api-showcase': 'example-api'
};

/**
 * In your real src/data/repositoryEvidence.ts, declare your own owner
 * boundary near the top of the file:
 *
 *   export const REPOSITORY_EVIDENCE_OWNER_GITHUB_TARGET = 'https://github.com/<your-username>';
 *
 * `getRepositoryEvidence(repositoryName, ownerGithubTarget)` and
 * `getCanonicalRepositoryKey(repositoryName, ownerGithubTarget)` already
 * enforce that boundary for you -- you do not need to check it yourself in
 * every call site. See src/data/repositoryEvidence.ts for the full,
 * currently-configured implementation.
 */
