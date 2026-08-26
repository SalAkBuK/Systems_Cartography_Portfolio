import { ProjectData, InfrastructureSkill, ExperienceNode } from '../types';
import { project3DToIso } from '../components/TopologyCanvas';

export interface LayoutNode {
  id: string;
  type: 'project' | 'skill' | 'experience';
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number; // depth on the 3D plane
  mass: number;
  isPinned: boolean;
  targetZoneY?: number;
}

export interface LayoutEdge {
  id: string;
  sourceId: string;
  targetId: string;
  sourceType: 'project' | 'skill' | 'experience';
  targetType: 'project' | 'skill' | 'experience';
  restLength: number;
  stiffness: number;
}

export interface ConduitPoint {
  x: number;
  y: number;
}

export interface ConduitPathGeometry {
  id: string;
  sourceId: string;
  targetId: string;
  sourceType: 'project' | 'skill' | 'experience';
  targetType: 'project' | 'skill' | 'experience';
  start3D: { x: number; y: number; z: number };
  end3D: { x: number; y: number; z: number };
  startIso: ConduitPoint;
  midIso: ConduitPoint;
  endIso: ConduitPoint;
  pathData: string;
  length: number;
  tension: number; // 0 (slack/normal) to 1 (high tension)
}

/**
 * Builds the graph representation (nodes & edges) from portfolio data and custom positions
 */
export function createTopologyGraph(
  projects: ProjectData[],
  skills: InfrastructureSkill[],
  experience: ExperienceNode[],
  customProjects: Record<string, { x: number; y: number }>,
  customSkills: Record<string, { x: number; y: number }>,
  customExps: Record<string, { x: number; y: number }>,
  draggingNode: { type: string; id: string; currentPos: { x: number; y: number } } | null = null
): { nodes: Map<string, LayoutNode>; edges: LayoutEdge[] } {
  const nodes = new Map<string, LayoutNode>();
  const edges: LayoutEdge[] = [];
  const edgeSet = new Set<string>();

  // 1. Projects
  projects.forEach(p => {
    const isDragged = draggingNode?.type === 'project' && draggingNode.id === p.id;
    const pos = isDragged ? draggingNode.currentPos : (customProjects[p.id] || p.gridPosition);
    const width = (p.dimensions?.width || 100) * 0.75;
    const depth = 55;

    nodes.set(p.id, {
      id: p.id,
      type: 'project',
      x: pos.x,
      y: pos.y,
      vx: 0,
      vy: 0,
      width,
      height: depth,
      mass: 2.5,
      isPinned: isDragged,
      targetZoneY: -120
    });
  });

  // 2. Skills
  skills.forEach(s => {
    const isDragged = draggingNode?.type === 'skill' && draggingNode.id === s.id;
    const pos = isDragged ? draggingNode.currentPos : (customSkills[s.id] || s.gridPosition);

    nodes.set(s.id, {
      id: s.id,
      type: 'skill',
      x: pos.x,
      y: pos.y,
      vx: 0,
      vy: 0,
      width: 48,
      height: 48,
      mass: 1.2,
      isPinned: isDragged,
      targetZoneY: 220
    });
  });

  // 3. Experience nodes
  experience.forEach(e => {
    const isDragged = draggingNode?.type === 'experience' && draggingNode.id === e.id;
    const pos = isDragged ? draggingNode.currentPos : (customExps[e.id] || e.gridPosition);

    nodes.set(e.id, {
      id: e.id,
      type: 'experience',
      x: pos.x,
      y: pos.y,
      vx: 0,
      vy: 0,
      width: 36,
      height: 36,
      mass: 1.0,
      isPinned: isDragged,
      targetZoneY: 360
    });
  });

  // Build edges
  projects.forEach(project => {
    skills.forEach(skill => {
      const isDep = project.infrastructureDeps.includes(skill.id);
      const isUsed = skill.usedInProjects.includes(project.id);
      const techMatch = project.techStack.some(t => {
        const firstWord = skill.name.toLowerCase().split(' ')[0];
        return t.toLowerCase().includes(firstWord) || firstWord.includes(t.toLowerCase());
      });

      if (isDep || isUsed || techMatch) {
        const key = `${project.id}--${skill.id}`;
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          edges.push({
            id: key,
            sourceId: project.id,
            targetId: skill.id,
            sourceType: 'project',
            targetType: 'skill',
            restLength: 180,
            stiffness: isDep ? 0.045 : 0.025
          });
        }
      }
    });
  });

  return { nodes, edges };
}

/**
 * Calculates optimal 3D attachment ports and isometric coordinates for connection conduits
 */
export function calculateConduitGeometry(
  sourceNode: LayoutNode | { x: number; y: number; width?: number; height?: number; type: string },
  targetNode: LayoutNode | { x: number; y: number; width?: number; height?: number; type: string },
  edgeId: string,
  sourceId: string,
  targetId: string,
  sourceType: 'project' | 'skill' | 'experience' = 'project',
  targetType: 'project' | 'skill' | 'experience' = 'skill'
): ConduitPathGeometry {
  const sWidth = sourceNode.width || 75;
  const sHeight = sourceNode.height || 55;
  const tWidth = targetNode.width || 48;
  const tHeight = targetNode.height || 48;

  // Compute centers
  const sCenterX = sourceNode.x + sWidth / 2;
  const sCenterY = sourceNode.y + sHeight / 2;
  const tCenterX = targetNode.x + tWidth / 2;
  const tCenterY = targetNode.y + tHeight / 2;

  // Determine smart exit port on the perimeter of the project box
  let startX = sCenterX;
  let startY = sCenterY;

  if (sourceType === 'project') {
    const dx = tCenterX - sCenterX;
    const dy = tCenterY - sCenterY;

    if (Math.abs(dy) > Math.abs(dx)) {
      if (dy > 0) {
        // Exit from front face
        startX = sCenterX;
        startY = sourceNode.y + sHeight;
      } else {
        // Exit from rear face
        startX = sCenterX;
        startY = sourceNode.y;
      }
    } else {
      if (dx > 0) {
        // Exit from right side
        startX = sourceNode.x + sWidth;
        startY = sCenterY;
      } else {
        // Exit from left side
        startX = sourceNode.x;
        startY = sCenterY;
      }
    }
  }

  const endX = tCenterX;
  const endY = tCenterY;

  // Project to isometric screen space
  const startIso = project3DToIso(startX, startY, 0);
  const endIso = project3DToIso(endX, endY, 0);

  // Orthogonal routing midpoint with offset
  const mid3D = { x: startX, y: endY, z: 0 };
  const midIso = project3DToIso(mid3D.x, mid3D.y, 0);

  // Measure 3D Euclidean distance and compute spring tension metric
  const dist3D = Math.hypot(endX - startX, endY - startY);
  const tension = Math.min(Math.max((dist3D - 140) / 250, 0), 1);

  const pathData = `M ${startIso.x} ${startIso.y} L ${midIso.x} ${midIso.y} L ${endIso.x} ${endIso.y}`;

  return {
    id: edgeId,
    sourceId,
    targetId,
    sourceType,
    targetType,
    start3D: { x: startX, y: startY, z: 0 },
    end3D: { x: endX, y: endY, z: 0 },
    startIso,
    midIso,
    endIso,
    pathData,
    length: dist3D,
    tension
  };
}

/**
 * Executes a single physics simulation tick using Hooke's Law, Coulomb Repulsion,
 * Zone Gravity, and Hard Overlap Constraints.
 */
export function stepForceSimulation(
  nodes: Map<string, LayoutNode>,
  edges: LayoutEdge[],
  options: {
    damping?: number;
    repulsionStrength?: number;
    springStrengthMultiplier?: number;
    zoneGravityStrength?: number;
    minDistance?: number;
    resolveCollisions?: boolean;
  } = {}
): { maxVelocity: number; totalKineticEnergy: number } {
  const damping = options.damping ?? 0.84;
  const repulsionStrength = options.repulsionStrength ?? 3600;
  const springMultiplier = options.springStrengthMultiplier ?? 1.0;
  const zoneGravityStrength = options.zoneGravityStrength ?? 0.008;
  const minDistance = options.minDistance ?? 60;
  const resolveCollisions = options.resolveCollisions ?? true;

  const nodeList = Array.from(nodes.values());

  // 1. Reset acceleration & apply zone gravity
  nodeList.forEach(node => {
    if (node.isPinned) {
      node.vx = 0;
      node.vy = 0;
      return;
    }

    if (node.targetZoneY !== undefined) {
      const deltaY = node.targetZoneY - node.y;
      node.vy += deltaY * zoneGravityStrength;
    }
  });

  // 2. Node-to-node Repulsion (Coulomb's Law with minimum distance clamp)
  for (let i = 0; i < nodeList.length; i++) {
    const nodeA = nodeList[i];
    for (let j = i + 1; j < nodeList.length; j++) {
      const nodeB = nodeList[j];

      const centerAX = nodeA.x + nodeA.width / 2;
      const centerAY = nodeA.y + nodeA.height / 2;
      const centerBX = nodeB.x + nodeB.width / 2;
      const centerBY = nodeB.y + nodeB.height / 2;

      const dx = centerBX - centerAX;
      const dy = centerBY - centerAY;
      const dist = Math.hypot(dx, dy) || 1;

      // Clearance buffer based on dimensions
      const requiredClearance = (nodeA.width + nodeB.width) / 2 + 20;

      if (dist < 450) {
        const effectiveDist = Math.max(dist, minDistance);
        let force = repulsionStrength / (effectiveDist * effectiveDist);

        // Exponential push if overlapping clearance boundary
        if (dist < requiredClearance) {
          const overlap = requiredClearance - dist;
          force += (overlap * 0.35);
        }

        const nx = dx / dist;
        const ny = dy / dist;

        if (!nodeA.isPinned) {
          nodeA.vx -= (nx * force) / nodeA.mass;
          nodeA.vy -= (ny * force) / nodeA.mass;
        }
        if (!nodeB.isPinned) {
          nodeB.vx += (nx * force) / nodeB.mass;
          nodeB.vy += (ny * force) / nodeB.mass;
        }
      }
    }
  }

  // 3. Spring Forces along Connected Edges (Hooke's Law)
  edges.forEach(edge => {
    const source = nodes.get(edge.sourceId);
    const target = nodes.get(edge.targetId);
    if (!source || !target) return;

    const sCenterX = source.x + source.width / 2;
    const sCenterY = source.y + source.height / 2;
    const tCenterX = target.x + target.width / 2;
    const tCenterY = target.y + target.height / 2;

    const dx = tCenterX - sCenterX;
    const dy = tCenterY - sCenterY;
    const dist = Math.hypot(dx, dy) || 1;

    const displacement = dist - edge.restLength;
    const force = displacement * edge.stiffness * springMultiplier;

    const nx = dx / dist;
    const ny = dy / dist;

    if (!source.isPinned) {
      source.vx += (nx * force) / source.mass;
      source.vy += (ny * force) / source.mass;
    }
    if (!target.isPinned) {
      target.vx -= (nx * force) / target.mass;
      target.vy -= (ny * force) / target.mass;
    }
  });

  // 4. Integrate Velocities and Positions with Friction & Velocity Clamping
  let maxVelocity = 0;
  let totalKineticEnergy = 0;

  nodeList.forEach(node => {
    if (node.isPinned) return;

    // Apply damping
    node.vx *= damping;
    node.vy *= damping;

    // Clamp max velocity for numerical stability
    const speed = Math.hypot(node.vx, node.vy);
    const maxSpeed = 18;
    if (speed > maxSpeed) {
      node.vx = (node.vx / speed) * maxSpeed;
      node.vy = (node.vy / speed) * maxSpeed;
    }

    node.x += node.vx;
    node.y += node.vy;

    const curSpeed = Math.hypot(node.vx, node.vy);
    if (curSpeed > maxVelocity) maxVelocity = curSpeed;
    totalKineticEnergy += 0.5 * node.mass * (curSpeed * curSpeed);
  });

  // 5. Hard Non-Penetration Constraint Solver (AABB overlap push)
  if (resolveCollisions) {
    for (let i = 0; i < nodeList.length; i++) {
      const a = nodeList[i];
      for (let j = i + 1; j < nodeList.length; j++) {
        const b = nodeList[j];

        const padding = 15;
        const aMinX = a.x - padding;
        const aMaxX = a.x + a.width + padding;
        const aMinY = a.y - padding;
        const aMaxY = a.y + a.height + padding;

        const bMinX = b.x - padding;
        const bMaxX = b.x + b.width + padding;
        const bMinY = b.y - padding;
        const bMaxY = b.y + b.height + padding;

        const overlapX = Math.min(aMaxX - bMinX, bMaxX - aMinX);
        const overlapY = Math.min(aMaxY - bMinY, bMaxY - aMinY);

        if (overlapX > 0 && overlapY > 0) {
          // Push along axis of least overlap
          if (overlapX < overlapY) {
            const push = (overlapX / 2);
            if (a.x < b.x) {
              if (!a.isPinned) a.x -= push;
              if (!b.isPinned) b.x += push;
            } else {
              if (!a.isPinned) a.x += push;
              if (!b.isPinned) b.x -= push;
            }
          } else {
            const push = (overlapY / 2);
            if (a.y < b.y) {
              if (!a.isPinned) a.y -= push;
              if (!b.isPinned) b.y += push;
            } else {
              if (!a.isPinned) a.y += push;
              if (!b.isPinned) b.y -= push;
            }
          }
        }
      }
    }
  }

  return { maxVelocity, totalKineticEnergy };
}

/**
 * Computes an optimal harmonic layout equilibrium by running relaxation iterations
 */
export function computeEquilibriumLayout(
  projects: ProjectData[],
  skills: InfrastructureSkill[],
  experience: ExperienceNode[],
  customProjects: Record<string, { x: number; y: number }>,
  customSkills: Record<string, { x: number; y: number }>,
  customExps: Record<string, { x: number; y: number }>,
  pinnedId: string | null = null,
  iterations: number = 60
): {
  projectPositions: Record<string, { x: number; y: number }>;
  skillPositions: Record<string, { x: number; y: number }>;
  expPositions: Record<string, { x: number; y: number }>;
} {
  const { nodes, edges } = createTopologyGraph(
    projects,
    skills,
    experience,
    customProjects,
    customSkills,
    customExps
  );

  if (pinnedId && nodes.has(pinnedId)) {
    const node = nodes.get(pinnedId)!;
    node.isPinned = true;
  }

  for (let i = 0; i < iterations; i++) {
    stepForceSimulation(nodes, edges, {
      damping: 0.82,
      repulsionStrength: 4200,
      springStrengthMultiplier: 1.2,
      zoneGravityStrength: 0.012,
      resolveCollisions: true
    });
  }

  const projectPositions: Record<string, { x: number; y: number }> = {};
  const skillPositions: Record<string, { x: number; y: number }> = {};
  const expPositions: Record<string, { x: number; y: number }> = {};

  nodes.forEach(node => {
    const roundedPos = {
      x: Math.round(node.x),
      y: Math.round(node.y)
    };

    if (node.type === 'project') {
      projectPositions[node.id] = roundedPos;
    } else if (node.type === 'skill') {
      skillPositions[node.id] = roundedPos;
    } else if (node.type === 'experience') {
      expPositions[node.id] = roundedPos;
    }
  });

  return { projectPositions, skillPositions, expPositions };
}
