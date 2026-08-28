import { ProjectData, InfrastructureSkill } from '../types';
import { project3DToIso } from '../components/TopologyCanvas';
import { projectUsesCapability } from './capabilityAssociations';

export interface LayoutNode {
  id: string;
  type: 'project' | 'skill';
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
  sourceType: 'project' | 'skill';
  targetType: 'project' | 'skill';
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
  sourceType: 'project' | 'skill';
  targetType: 'project' | 'skill';
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
  customProjects: Record<string, { x: number; y: number }> = {},
  customSkills: Record<string, { x: number; y: number }> = {},
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

  // Build edges
  projects.forEach(project => {
    skills.forEach(skill => {
      if (projectUsesCapability(project, skill)) {
        const key = `${project.id}--${skill.id}`;
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          const isDep = project.infrastructureDeps.includes(skill.id);
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
  sourceType: 'project' | 'skill' = 'project',
  targetType: 'project' | 'skill' = 'skill'
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


