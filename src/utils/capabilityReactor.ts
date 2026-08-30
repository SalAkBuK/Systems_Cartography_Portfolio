import { project3DToIso, projectIsoTo3D } from './isometricProjection';

const TWO_PI = Math.PI * 2;
const TRACK_CLEARANCE_X = 32;
const TRACK_CLEARANCE_Y = 28;
const MIN_RADIUS_X = 80;
const MIN_RADIUS_Y = 55;
const MOUNTED_VISUAL_HEIGHT = 58;
const MOUNTED_CLEARANCE = 2;

/** Canonical twelve-o'clock start shared by every capability constellation. */
export const CAPABILITY_REACTOR_START_ANGLE = -Math.PI / 2;

export interface CapabilityReactorSource {
  id: string;
  technologyLabel: string;
  systemCount: number;
}

export interface CapabilityReactorGeometry {
  centerIso: { x: number; y: number };
  radiusX: number;
  radiusY: number;
  canonicalVisualBounds: { minX: number; maxX: number; minY: number; maxY: number };
}

export interface CapabilityReactorMarker {
  x: number;
  y: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function getCapabilityVisualHalfWidth(capability: CapabilityReactorSource): number {
  // Mirrors the existing 10px technology and 8.5px system-count labels in
  // TopologyCanvas, while retaining the 48px plinth as the minimum footprint.
  const technologyHalfWidth = capability.technologyLabel.length * 6.1 / 2;
  const countHalfWidth = `${capability.systemCount} SYSTEMS`.length * 5.2 / 2;
  return Math.max(24, technologyHalfWidth, countHalfWidth);
}

/**
 * The full, unfiltered activeSkills sequence is the canonical identity order.
 * Keeping this tiny helper explicit prevents search/focus/render subsets from
 * ever becoming an accidental slot authority.
 */
export function getDeterministicCapabilityOrder(
  capabilities: CapabilityReactorSource[]
): string[] {
  return capabilities.map(capability => capability.id);
}

/**
 * Returns the world-coordinate center expected by TopologyCanvas for one
 * capability mounted on the fixed reactor ellipse. reactorPhase already
 * carries the counterclockwise sign, so it is applied exactly once here.
 */
export function getMountedCapabilityPosition(
  index: number,
  count: number,
  geometry: CapabilityReactorGeometry,
  reactorPhase: number
): { x: number; y: number } {
  const safeCount = Math.max(1, Math.floor(count));
  const safeIndex = Number.isFinite(index) ? index : 0;
  const safePhase = Number.isFinite(reactorPhase) ? reactorPhase : 0;
  const angle = CAPABILITY_REACTOR_START_ANGLE + (safeIndex / safeCount) * TWO_PI + safePhase;
  const isoX = geometry.centerIso.x + geometry.radiusX * Math.cos(angle);
  const isoY = geometry.centerIso.y + geometry.radiusY * Math.sin(angle);
  return projectIsoTo3D(isoX, isoY);
}

/** Runtime drag overrides are the only layer allowed to supersede mounting. */
export function getEffectiveCapabilityPositions(
  mountedPositions: Record<string, { x: number; y: number }>,
  customPositions: Record<string, { x: number; y: number }>
): Record<string, { x: number; y: number }> {
  return { ...mountedPositions, ...customPositions };
}

/**
 * Derives a fixed reactor ellipse from canonical capability positions and the
 * actual plinth/label footprint. Runtime drag overrides are deliberately not
 * accepted, so moving a capability can never reshape the reactor.
 */
export function deriveCapabilityReactorGeometry(
  capabilities: CapabilityReactorSource[],
  canonicalPositions: Record<string, { x: number; y: number }>
): CapabilityReactorGeometry {
  if (capabilities.length === 0) {
    return {
      centerIso: { x: 0, y: 0 },
      radiusX: MIN_RADIUS_X,
      radiusY: MIN_RADIUS_Y,
      canonicalVisualBounds: { minX: -24, maxX: 24, minY: -20, maxY: 38 },
    };
  }

  const bounds = capabilities.map(capability => {
    const canonicalPosition = canonicalPositions[capability.id] ?? { x: 0, y: 0 };
    const center = project3DToIso(canonicalPosition.x, canonicalPosition.y, 0);
    const halfWidth = getCapabilityVisualHalfWidth(capability);
    return {
      minX: center.x - halfWidth,
      maxX: center.x + halfWidth,
      minY: center.y - 20,
      maxY: center.y + 38,
    };
  });

  const canonicalVisualBounds = {
    minX: Math.min(...bounds.map(bound => bound.minX)),
    maxX: Math.max(...bounds.map(bound => bound.maxX)),
    minY: Math.min(...bounds.map(bound => bound.minY)),
    maxY: Math.max(...bounds.map(bound => bound.maxY)),
  };
  const centerIso = {
    x: (canonicalVisualBounds.minX + canonicalVisualBounds.maxX) / 2,
    y: (canonicalVisualBounds.minY + canonicalVisualBounds.maxY) / 2,
  };

  const baseRadiusX = Math.max(
    MIN_RADIUS_X,
    (canonicalVisualBounds.maxX - canonicalVisualBounds.minX) / 2 + TRACK_CLEARANCE_X
  );
  const baseRadiusY = Math.max(
    MIN_RADIUS_Y,
    (canonicalVisualBounds.maxY - canonicalVisualBounds.minY) / 2 + TRACK_CLEARANCE_Y
  );

  // Twenty-four mounted labels do not quite clear one another on the approved
  // base ellipse. Grow both reactor-only radii by the smallest uniform scale
  // that separates every canonical adjacent pair throughout a full rotation.
  // For adjacent slot chord components A*sin(theta), B*cos(theta), the exact
  // worst-case scale is hypot(requiredWidth/A, requiredHeight/B).
  const count = capabilities.length;
  const halfSlotChord = Math.sin(Math.PI / count);
  let mountedClearanceScale = 1;
  for (let index = 0; count > 1 && index < count; index++) {
    const nextIndex = (index + 1) % count;
    const requiredWidth =
      getCapabilityVisualHalfWidth(capabilities[index]) +
      getCapabilityVisualHalfWidth(capabilities[nextIndex]) +
      MOUNTED_CLEARANCE;
    const requiredHeight = MOUNTED_VISUAL_HEIGHT + MOUNTED_CLEARANCE;
    mountedClearanceScale = Math.max(
      mountedClearanceScale,
      Math.hypot(
        requiredWidth / (2 * baseRadiusX * halfSlotChord),
        requiredHeight / (2 * baseRadiusY * halfSlotChord)
      )
    );
  }

  return {
    centerIso,
    radiusX: baseRadiusX * mountedClearanceScale,
    radiusY: baseRadiusY * mountedClearanceScale,
    canonicalVisualBounds,
  };
}

/** Fixed four-quadrant track geometry with small cardinal registration gaps. */
export function buildCapabilityReactorSegmentPaths(
  geometry: CapabilityReactorGeometry,
  gapRadians: number = 0.075
): string[] {
  return Array.from({ length: 4 }, (_, index) => {
    const startAngle = index * Math.PI / 2 + gapRadians;
    const endAngle = (index + 1) * Math.PI / 2 - gapRadians;
    const startX = geometry.centerIso.x + geometry.radiusX * Math.cos(startAngle);
    const startY = geometry.centerIso.y + geometry.radiusY * Math.sin(startAngle);
    const endX = geometry.centerIso.x + geometry.radiusX * Math.cos(endAngle);
    const endY = geometry.centerIso.y + geometry.radiusY * Math.sin(endAngle);
    return `M ${startX} ${startY} A ${geometry.radiusX} ${geometry.radiusY} 0 0 1 ${endX} ${endY}`;
  });
}

/** Places a phase-driven structural tick along the fixed ellipse. */
export function getCapabilityReactorMarker(
  geometry: CapabilityReactorGeometry,
  phase: number,
  markerIndex: number,
  markerCount: number,
  halfLength: number
): CapabilityReactorMarker {
  const safeCount = Math.max(1, Math.floor(markerCount));
  const angle = (markerIndex / safeCount) * TWO_PI + phase;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const x = geometry.centerIso.x + geometry.radiusX * cos;
  const y = geometry.centerIso.y + geometry.radiusY * sin;
  const normalX = geometry.radiusY * cos;
  const normalY = geometry.radiusX * sin;
  const normalLength = Math.hypot(normalX, normalY) || 1;
  const nx = normalX / normalLength;
  const ny = normalY / normalLength;
  return {
    x,
    y,
    x1: x - halfLength * nx,
    y1: y - halfLength * ny,
    x2: x + halfLength * nx,
    y2: y + halfLength * ny,
  };
}

/** Maps radians to SVG's normalized pathLength=100 dash-offset vocabulary. */
export function getCapabilityReactorDashOffset(phase: number): number {
  if (!Number.isFinite(phase)) return 0;
  return (phase / TWO_PI) * 100;
}
