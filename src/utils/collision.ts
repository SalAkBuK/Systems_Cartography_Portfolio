import { ProjectData, InfrastructureSkill, ExperienceNode } from '../types';
import { PROJECTS, INFRASTRUCTURE_SKILLS, EXPERIENCE_HISTORY } from '../data/portfolioData';

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
  type: 'project' | 'skill' | 'experience',
  id: string,
  pos: { x: number; y: number },
  projectsList: ProjectData[] = PROJECTS
): BoundingBox => {
  const PADDING = 14; // Clearance cushion

  if (type === 'project') {
    const proj = projectsList.find(p => p.id === id);
    const width = (proj?.dimensions.width || 100) * 0.75;
    const depth = 55;
    return {
      minX: pos.x - PADDING,
      maxX: pos.x + width + PADDING,
      minY: pos.y - PADDING,
      maxY: pos.y + depth + PADDING,
    };
  } else if (type === 'skill') {
    const radius = 24 + PADDING;
    return {
      minX: pos.x - radius,
      maxX: pos.x + radius,
      minY: pos.y - radius,
      maxY: pos.y + radius,
    };
  } else {
    // Experience timeline node
    const radius = 18 + PADDING;
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
  collidingType: 'project' | 'skill' | 'experience' | null;
}

/**
 * Checks whether placing an item at `targetPos` collides with any other entity on the topology map.
 */
export const checkCollisions = (
  dragType: 'project' | 'skill' | 'experience',
  dragId: string,
  targetPos: { x: number; y: number },
  customProjects: Record<string, { x: number; y: number }>,
  customSkills: Record<string, { x: number; y: number }>,
  customExps: Record<string, { x: number; y: number }>,
  projectsList: ProjectData[] = PROJECTS,
  skillsList: InfrastructureSkill[] = INFRASTRUCTURE_SKILLS,
  expsList: ExperienceNode[] = EXPERIENCE_HISTORY
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

  // 3. Check against all experience timeline nodes (except self)
  for (const e of expsList) {
    if (dragType === 'experience' && e.id === dragId) continue;
    const ePos = customExps[e.id] || e.gridPosition;
    const eBox = getNodeBounds('experience', e.id, ePos, projectsList);
    if (checkAABBOverlap(targetBox, eBox)) {
      return {
        hasCollision: true,
        collidingWith: e.code,
        collidingId: e.id,
        collidingType: 'experience'
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
}

/**
 * Snaps raw coordinates to architectural grid increments (25px by default)
 * and uses an expanding spiral search to find the nearest non-overlapping grid slot.
 */
export const findNearestValidGridPosition = (
  dragType: 'project' | 'skill' | 'experience',
  dragId: string,
  rawPos: { x: number; y: number },
  customProjects: Record<string, { x: number; y: number }>,
  customSkills: Record<string, { x: number; y: number }>,
  customExps: Record<string, { x: number; y: number }>,
  projectsList: ProjectData[] = PROJECTS,
  skillsList: InfrastructureSkill[] = INFRASTRUCTURE_SKILLS,
  expsList: ExperienceNode[] = EXPERIENCE_HISTORY,
  gridStep: number = GRID_SNAP_STEP,
  snapEnabled: boolean = true
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
    customExps,
    projectsList,
    skillsList,
    expsList
  );

  if (!initialCheck.hasCollision) {
    return {
      x: baseSnapX,
      y: baseSnapY,
      wasAdjusted: false,
      collidingId: null,
      collidingWith: null
    };
  }

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
        customExps,
        projectsList,
        skillsList,
        expsList
      );
      if (!check.hasCollision) {
        return {
          x: cand.x,
          y: cand.y,
          wasAdjusted: true,
          collidingId: initialCheck.collidingId,
          collidingWith: initialCheck.collidingWith
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
    collidingWith: initialCheck.collidingWith
  };
};
