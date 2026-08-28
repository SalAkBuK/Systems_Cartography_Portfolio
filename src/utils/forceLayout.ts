import { project3DToIso } from '../components/TopologyCanvas';

export interface ConduitEndpointNode {
  x: number;
  y: number;
  width?: number;
  height?: number;
  type?: string;
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
 * Calculates optimal 3D attachment ports and isometric coordinates for connection conduits
 */
export function calculateConduitGeometry(
  sourceNode: ConduitEndpointNode,
  targetNode: ConduitEndpointNode,
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


