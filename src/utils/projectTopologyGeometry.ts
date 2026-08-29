// Single source of truth for a project structure's rendered footprint/height, so
// rendering, canonical layout, collision detection, drag-landing previews, and
// conduit anchoring never disagree about a project's size.

/**
 * Deliberate presentation scale applied to every project's rendered structure so
 * projects read as subordinate to the technical capability nucleus rather than
 * visually dominating it. Does NOT mutate ProjectData.dimensions.
 */
export const ORBIT_PROJECT_SCALE = 0.84;

const BASE_PROJECT_DEPTH = 55;
const DEFAULT_PROJECT_WIDTH = 100;
const DEFAULT_PROJECT_HEIGHT = 60;

export interface TopologyProjectDimensions {
  width: number;
  depth: number;
  height: number;
}

export interface ProjectDimensionsSource {
  dimensions?: { width: number; height: number; levels?: number };
}

/**
 * Returns the ground-footprint width/depth and vertical height for a project
 * structure at the given presentation scale (defaults to ORBIT_PROJECT_SCALE).
 */
export function getTopologyProjectDimensions(
  project: ProjectDimensionsSource | null | undefined,
  scale: number = ORBIT_PROJECT_SCALE
): TopologyProjectDimensions {
  const rawWidth = project?.dimensions?.width ?? DEFAULT_PROJECT_WIDTH;
  const rawHeight = project?.dimensions?.height ?? DEFAULT_PROJECT_HEIGHT;
  return {
    width: rawWidth * 0.75 * scale,
    depth: BASE_PROJECT_DEPTH * scale,
    height: rawHeight * 0.75 * scale,
  };
}
