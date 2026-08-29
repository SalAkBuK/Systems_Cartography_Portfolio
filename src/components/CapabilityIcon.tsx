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
 * Inherits topology emphasis/selected colors and renders deterministic fallbacks for unmapped concepts.
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
    // Vector icon centered at (x, y)
    const halfSize = size / 2;
    return (
      <g
        transform={`translate(${x - halfSize}, ${y - halfSize})`}
        className={className}
        aria-hidden="true"
      >
        <svg
          width={size}
          height={size}
          viewBox={icon.viewBox || '0 0 24 24'}
          fill={color}
          className="pointer-events-none"
        >
          <path d={icon.path} />
        </svg>
      </g>
    );
  }

  // Deterministic short alphanumeric glyph centered at (x, y)
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
