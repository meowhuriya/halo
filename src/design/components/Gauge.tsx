import React from 'react';

interface GaugeProps {
  value: number;
  min: number;
  max: number;
  unit: string;
  label: string;
  color?: string;
  size?: number;
}

export const Gauge: React.FC<GaugeProps> = ({
  value,
  min,
  max,
  unit,
  label,
  color = '#38E1FF',
  size = 140,
}) => {
  const percentage = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  // Arc angle 240 degrees (leaving 120 open at bottom)
  const arcLength = circumference * (240 / 360);
  const strokeDashoffset = arcLength - (percentage / 100) * arcLength;

  return (
    <div className="flex flex-col items-center justify-center" style={{ width: size }}>
      <div className="relative" style={{ width: size, height: size * 0.85 }}>
        <svg
          width={size}
          height={size}
          className="rotate-[150deg] transform"
          viewBox={`0 0 ${size} ${size}`}
        >
          {/* Background Arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgba(255, 255, 255, 0.10)"
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeLinecap="round"
            fill="none"
          />
          {/* Progress Arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="none"
            className="transition-all duration-500 ease-out"
            style={{ filter: `drop-shadow(0 0 6px ${color}80)` }}
          />
        </svg>

        {/* Center reading */}
        <div className="absolute inset-0 top-3 flex flex-col items-center justify-center">
          <span className="font-mono text-2xl font-bold tracking-tight text-white tabular-nums">
            {value}
          </span>
          <span className="text-xs uppercase tracking-wider text-slate-400 font-mono">
            {unit}
          </span>
        </div>
      </div>
      <span className="text-xs font-medium text-slate-300 mt-1 uppercase tracking-wider">
        {label}
      </span>
    </div>
  );
};
