import React from 'react';
import { resolveCapabilityIcon } from '../utils/capabilityIconRegistry';

export interface CapabilityIconProps {
  label: string;
  x: number;
  y: number;
  size?: number;
  color?: string;
  className?: string;
}

/**
 * Centrally manages technology vector mark rendering inside isometric capability nodes.
 * Inherits topology emphasis/selected colors and applies optical scale hints while maintaining exact node center (x, y).
 */
export const CapabilityIcon: React.FC<CapabilityIconProps> = ({
  label,
  x,
  y,
  size = 20,
  color = 'currentColor',
  className = ''
}) => {
  const icon = resolveCapabilityIcon(label);

  if (icon.type === 'vector') {
    // Optical scale applies only to vector geometry, maintaining center alignment at (x, y)
    const effectiveSize = size * (icon.scale ?? 1);
    const halfSize = effectiveSize / 2;
    return (
      <g
        transform={`translate(${x - halfSize}, ${y - halfSize})`}
        className={className}
        aria-hidden="true"
      >
        <svg
          width={effectiveSize}
          height={effectiveSize}
          viewBox={icon.viewBox || '0 0 24 24'}
          fill={color}
          className="pointer-events-none"
        >
          <path d={icon.path} />
        </svg>
      </g>
    );
  }

  // Deterministic short alphanumeric glyph centered at (x, y) without arbitrary brand scaling
  return (
    <text
      x={x}
      y={y + (size <= 20 ? 3 : 3.5)}
      textAnchor="middle"
      fill={color}
      fontSize={size <= 20 ? '8.5' : '9.5'}
      fontWeight="bold"
      fontFamily="monospace"
      letterSpacing="0.5"
      className={`pointer-events-none select-none ${className}`}
      aria-hidden="true"
    >
      {icon.text}
    </text>
  );
};
