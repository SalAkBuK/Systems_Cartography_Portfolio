// Neutral isometric/axonometric projection math shared by rendering and layout utilities.
// 30 degree axonometric angle: cos(30°) ≈ 0.8660254, sin(30°) = 0.5
export const ISO_COS = 0.86602540378;
export const ISO_SIN = 0.5;

export const project3DToIso = (x: number, y: number, z: number = 0): { x: number; y: number } => {
  return {
    x: (x - y) * ISO_COS,
    y: (x + y) * ISO_SIN - z,
  };
};

export const projectIsoTo3D = (isoX: number, isoY: number): { x: number; y: number } => {
  const term1 = isoX / ISO_COS;
  const term2 = isoY / ISO_SIN;
  return {
    x: 0.5 * (term1 + term2),
    y: 0.5 * (term2 - term1),
  };
};
