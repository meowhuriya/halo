import React from 'react';
import { STATUS_MAP } from '../tokens';
import type { HealthStatus } from '../../data/db';

interface StatusBadgeProps {
  status: HealthStatus;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  showLabel = true,
  className = '',
}) => {
  const meta = STATUS_MAP[status] || STATUS_MAP.NOMINAL;
  const IconComponent = meta.icon;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-sm px-3 py-1 gap-1.5 font-medium',
    lg: 'text-base px-4 py-1.5 gap-2 font-semibold',
  }[size];

  const iconSizes = {
    sm: 12,
    md: 15,
    lg: 18,
  }[size];

  return (
    <span
      className={`inline-flex items-center rounded-full border transition-colors ${meta.pulseClass || ''} ${sizeClasses} ${className}`}
      style={{
        backgroundColor: meta.bgColor,
        borderColor: meta.borderColor,
        color: meta.color,
      }}
      role="status"
      aria-label={`Health status: ${meta.label}`}
    >
      <IconComponent size={iconSizes} className="shrink-0" />
      {showLabel && <span className="tracking-wider uppercase">{meta.label}</span>}
    </span>
  );
};
