import { ProjectData, InfrastructureSkill } from '../types';
import {
  VERIFIED_PROJECTS as PROJECTS,
  VERIFIED_SKILLS as INFRASTRUCTURE_SKILLS
} from '../data/verifiedPortfolioData';
import { getTopologyProjectDimensions } from './projectTopologyGeometry';

export const GRID_SNAP_STEP = 25; // 25-unit architectural grid step

export interface BoundingBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Calculates 2D bounding footprint for any topology entity in 3D grid space.
 * Includes protective clearance margin to prevent visual/structural overlap.
 */
export const getNodeBounds = (
  type: 'project' | 'skill',
  id: string,
  pos: { x: number; y: number },
  projectsList: ProjectData[] = PROJECTS
): BoundingBox => {
  const PADDING = 14; // Clearance cushion

  if (type === 'project') {
    const proj = projectsList.find(p => p.id === id);
    const { width, depth } = getTopologyProjectDimensions(proj);
    return {
      minX: pos.x - PADDING,
      maxX: pos.x + width + PADDING,
      minY: pos.y - PADDING,
      maxY: pos.y + depth + PADDING,
    };
  } else {
    // Skill node
    const radius = 24 + PADDING;
    return {
      minX: pos.x - radius,
      maxX: pos.x + radius,
      minY: pos.y - radius,
      maxY: pos.y + radius,
    };
  }
};

/**
 * Axis-Aligned Bounding Box (AABB) intersection detection
 */
export const checkAABBOverlap = (boxA: BoundingBox, boxB: BoundingBox): boolean => {
  return (
    boxA.minX < boxB.maxX &&
    boxA.maxX > boxB.minX &&
    boxA.minY < boxB.maxY &&
    boxA.maxY > boxB.minY
  );
};

export interface CollisionCheckResult {
  hasCollision: boolean;
  collidingWith: string | null;
  collidingId: string | null;
  collidingType: 'project' | 'skill' | null;
}

/**
 * Checks whether placing an item at `targetPos` collides with any other entity on the topology map.
 */
export const checkCollisions = (
  dragType: 'project' | 'skill',
  dragId: string,
  targetPos: { x: number; y: number },
  customProjects: Record<string, { x: number; y: number }> = {},
  customSkills: Record<string, { x: number; y: number }> = {},
  projectsList: ProjectData[] = PROJECTS,
  skillsList: InfrastructureSkill[] = INFRASTRUCTURE_SKILLS
): CollisionCheckResult => {
  const targetBox = getNodeBounds(dragType, dragId, targetPos, projectsList);

  // 1. Check against all projects (except self)
  for (const p of projectsList) {
    if (dragType === 'project' && p.id === dragId) continue;
    const pPos = customProjects[p.id] || p.gridPosition;
    const pBox = getNodeBounds('project', p.id, pPos, projectsList);
    if (checkAABBOverlap(targetBox, pBox)) {
      return {
        hasCollision: true,
        collidingWith: p.code || p.title,
        collidingId: p.id,
        collidingType: 'project'
      };
    }
  }

  // 2. Check against all infrastructure skills (except self)
  for (const s of skillsList) {
    if (dragType === 'skill' && s.id === dragId) continue;
    const sPos = customSkills[s.id] || s.gridPosition;
    const sBox = getNodeBounds('skill', s.id, sPos, projectsList);
    if (checkAABBOverlap(targetBox, sBox)) {
      return {
        hasCollision: true,
        collidingWith: s.name,
        collidingId: s.id,
        collidingType: 'skill'
      };
    }
  }

  return {
    hasCollision: false,
    collidingWith: null,
    collidingId: null,
    collidingType: null
  };
};

export interface ResolvedPosition {
  x: number;
  y: number;
  wasAdjusted: boolean;
  collidingId: string | null;
  collidingWith: string | null;
  /**
   * True when the FIRST-CHOICE snapped candidate was already collision-free
   * against every current node, and was shifted purely because the optional
   * `isCandidateValid` predicate rejected it (e.g. PR23's future-orbital-
   * sweep motion-safety check on a detached project drop). Lets the caller
   * distinguish "moved because of a real node in the way right now" from
   * "moved because this spot will be swept through later" without guessing.
   */
  wasAdjustedForValidatorOnly?: boolean;
}

/**
 * Snaps raw coordinates to architectural grid increments (25px by default)
 * and uses an expanding spiral search to find the nearest non-overlapping grid slot.
 *
 * `isCandidateValid`, if provided, is an ADDITIONAL acceptance gate evaluated
 * alongside the ordinary collision check — a candidate must be both
 * collision-free AND pass this predicate to be accepted. Omitting it (the
 * default for every existing caller, including all skill placement) leaves
 * behavior completely unchanged.
 */
export const findNearestValidGridPosition = (
  dragType: 'project' | 'skill',
  dragId: string,
  rawPos: { x: number; y: number },
  customProjects: Record<string, { x: number; y: number }> = {},
  customSkills: Record<string, { x: number; y: number }> = {},
  projectsList: ProjectData[] = PROJECTS,
  skillsList: InfrastructureSkill[] = INFRASTRUCTURE_SKILLS,
  gridStep: number = GRID_SNAP_STEP,
  snapEnabled: boolean = true,
  isCandidateValid?: (pos: { x: number; y: number }) => boolean
): ResolvedPosition => {
  // Compute initial snapped coordinates
  const baseSnapX = snapEnabled ? Math.round(rawPos.x / gridStep) * gridStep : Math.round(rawPos.x);
  const baseSnapY = snapEnabled ? Math.round(rawPos.y / gridStep) * gridStep : Math.round(rawPos.y);

  // Check if primary position is collision-free
  const initialCheck = checkCollisions(
    dragType,
    dragId,
    { x: baseSnapX, y: baseSnapY },
    customProjects,
    customSkills,
    projectsList,
    skillsList
  );
  const initialValidatorOk = !isCandidateValid || isCandidateValid({ x: baseSnapX, y: baseSnapY });

  if (!initialCheck.hasCollision && initialValidatorOk) {
    return {
      x: baseSnapX,
      y: baseSnapY,
      wasAdjusted: false,
      collidingId: null,
      collidingWith: null
    };
  }

  const initialRejectedByValidatorOnly = !initialCheck.hasCollision && !initialValidatorOk;

  // Expanding concentric ring search on grid increments
  const maxRings = 14;
  const step = snapEnabled ? gridStep : 15;

  for (let ring = 1; ring <= maxRings; ring++) {
    const candidates: Array<{ x: number; y: number; dist: number }> = [];

    for (let dx = -ring; dx <= ring; dx++) {
      for (let dy = -ring; dy <= ring; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue; // Only perimeter of current ring
        const candX = baseSnapX + dx * step;
        const candY = baseSnapY + dy * step;
        const dist = Math.hypot(candX - rawPos.x, candY - rawPos.y);
        candidates.push({ x: candX, y: candY, dist });
      }
    }

    // Sort ring candidates by shortest distance to raw drag position
    candidates.sort((a, b) => a.dist - b.dist);

    for (const cand of candidates) {
      const check = checkCollisions(
        dragType,
        dragId,
        { x: cand.x, y: cand.y },
        customProjects,
        customSkills,
        projectsList,
        skillsList
      );
      if (!check.hasCollision && (!isCandidateValid || isCandidateValid({ x: cand.x, y: cand.y }))) {
        return {
          x: cand.x,
          y: cand.y,
          wasAdjusted: true,
          collidingId: initialCheck.collidingId,
          collidingWith: initialCheck.collidingWith,
          wasAdjustedForValidatorOnly: initialRejectedByValidatorOnly
        };
      }
    }
  }

  // Fallback if saturated
  return {
    x: baseSnapX,
    y: baseSnapY,
    wasAdjusted: true,
    collidingId: initialCheck.collidingId,
    collidingWith: initialCheck.collidingWith,
    wasAdjustedForValidatorOnly: initialRejectedByValidatorOnly
  };
};
