/**
 * Deterministic project-to-ring allocation. Pure, DOM-free, no dependency on
 * topology geometry, orbit motion, or React — the single canonical answer to
 * "which project ring owns project X" and "what rate does ring N move at."
 *
 * Canonical ring membership depends ONLY on the full ordered (canonically
 * sorted) project id collection and the ring-capacity rule below. It must
 * never depend on search/filter state, selection, topology view mode, drag
 * state, viewport size, owner identity, or runtime randomness — callers that
 * need a stable topology identity always pass the full unfiltered project
 * list here, never a filtered/reordered view of it.
 */

/** Ring capacity: a ring holds at most this many projects before a new ring is required. */
export const MAX_PROJECTS_PER_RING = 18;

export interface ProjectRingAssignment {
  ringId: string;
  ringIndex: number;
  indexWithinRing: number;
  ringProjectCount: number;
}

export interface ProjectRingAllocation {
  ringCount: number;
  /** Ring index -> ordered project ids assigned to that ring (canonical order preserved). */
  ringProjectIds: string[][];
  /** Project id -> its stable canonical ring assignment. */
  assignmentsByProjectId: Record<string, ProjectRingAssignment>;
}

/**
 * 0 projects -> 0 rings. Otherwise one ring per full/partial batch of
 * MAX_PROJECTS_PER_RING (18): 1-18 -> 1 ring, 19-36 -> 2 rings, 37-54 -> 3
 * rings, 55-72 -> 4 rings, and so on without a hard cap.
 */
export function getProjectRingCount(projectCount: number): number {
  if (projectCount <= 0) return 0;
  return Math.ceil(projectCount / MAX_PROJECTS_PER_RING);
}

export function getProjectRingId(ringIndex: number): string {
  return `project-ring-${ringIndex}`;
}

/**
 * Round-robin assignment across the computed ring count, preserving each
 * project's position in the supplied canonical order within its ring. E.g.
 * 33 projects / 2 rings -> project 0,2,4,...  -> ring 0 (17 projects) and
 * project 1,3,5,... -> ring 1 (16 projects). Balanced, stable, never
 * randomized: the same ordered input always produces the same allocation.
 */
export function allocateProjectRings(orderedProjectIds: readonly string[]): ProjectRingAllocation {
  const projectCount = orderedProjectIds.length;
  const ringCount = getProjectRingCount(projectCount);
  const ringProjectIds: string[][] = Array.from({ length: ringCount }, () => []);

  for (let i = 0; i < projectCount; i++) {
    ringProjectIds[i % ringCount].push(orderedProjectIds[i]);
  }

  const assignmentsByProjectId: Record<string, ProjectRingAssignment> = {};
  ringProjectIds.forEach((ids, ringIndex) => {
    ids.forEach((id, indexWithinRing) => {
      assignmentsByProjectId[id] = {
        ringId: getProjectRingId(ringIndex),
        ringIndex,
        indexWithinRing,
        ringProjectCount: ids.length,
      };
    });
  });

  return { ringCount, ringProjectIds, assignmentsByProjectId };
}

/**
 * Curated base rate multipliers for depth/parallax: each ring moves at a
 * subtly different fraction of the globally selected SYSTEMS rate. Ring 0
 * (innermost, backward-compatible with the original single-ring topology)
 * always runs at exactly 1.00x.
 */
const PROJECT_RING_BASE_RATE_MULTIPLIERS = [1, 0.75, 0.6, 0.5] as const;
/** Rings beyond the curated set decay by this much per additional ring, deterministically. */
const PROJECT_RING_RATE_DECAY_STEP = 0.05;
/** Never let a ring's base rate approach zero -- "slow mechanical cartography," not a stalled ring. */
const MIN_PROJECT_RING_BASE_RATE_MULTIPLIER = 0.35;

export function getProjectRingBaseRateMultiplier(ringIndex: number): number {
  if (ringIndex < 0) return PROJECT_RING_BASE_RATE_MULTIPLIERS[0];
  if (ringIndex < PROJECT_RING_BASE_RATE_MULTIPLIERS.length) {
    return PROJECT_RING_BASE_RATE_MULTIPLIERS[ringIndex];
  }
  const extraRings = ringIndex - (PROJECT_RING_BASE_RATE_MULTIPLIERS.length - 1);
  const decayed =
    PROJECT_RING_BASE_RATE_MULTIPLIERS[PROJECT_RING_BASE_RATE_MULTIPLIERS.length - 1] -
    extraRings * PROJECT_RING_RATE_DECAY_STEP;
  return Math.max(MIN_PROJECT_RING_BASE_RATE_MULTIPLIER, decayed);
}
