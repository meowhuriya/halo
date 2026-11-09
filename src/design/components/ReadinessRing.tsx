import React from 'react';

interface ReadinessRingProps {
  score: number; // 0 - 100
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export const ReadinessRing: React.FC<ReadinessRingProps> = ({
  score,
  size = 'md',
  showLabel = false,
  className = '',
}) => {
  const clampedScore = Math.max(0, Math.min(100, Math.round(score)));

  // §7.9 Bands: ≥ 80 GO (NOMINAL), 60–79 GO WITH CAUTION (WATCH), < 60 HOLD (ALERT/CRITICAL)
  const getBand = (s: number) => {
    if (s >= 80) return { label: 'GO', color: '#22C55E', textClass: 'text-emerald-400' };
    if (s >= 60) return { label: 'CAUTION', color: '#F59E0B', textClass: 'text-amber-400' };
    return { label: 'HOLD', color: '#EF4444', textClass: 'text-red-500' };
  };

  const band = getBand(clampedScore);

  const dimensions = {
    sm: { diameter: 36, stroke: 3.5, fontSize: 'text-[11px]' },
    md: { diameter: 56, stroke: 4.5, fontSize: 'text-sm font-bold' },
    lg: { diameter: 120, stroke: 8, fontSize: 'text-3xl font-extrabold' },
  }[size];

  const radius = (dimensions.diameter - dimensions.stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clampedScore / 100) * circumference;

  return (
    <div className={`relative inline-flex flex-col items-center justify-center ${className}`}>
      <div
        className="relative inline-flex items-center justify-center"
        style={{ width: dimensions.diameter, height: dimensions.diameter }}
        role="progressbar"
        aria-valuenow={clampedScore}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Readiness score ${clampedScore} out of 100, status ${band.label}`}
      >
        <svg
          width={dimensions.diameter}
          height={dimensions.diameter}
          className="-rotate-90 transform"
        >
          {/* Background circle */}
          <circle
            cx={dimensions.diameter / 2}
            cy={dimensions.diameter / 2}
            r={radius}
            stroke="rgba(255, 255, 255, 0.10)"
            strokeWidth={dimensions.stroke}
            fill="transparent"
          />
          {/* Progress circle */}
          <circle
            cx={dimensions.diameter / 2}
            cy={dimensions.diameter / 2}
            r={radius}
            stroke={band.color}
            strokeWidth={dimensions.stroke}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-700 ease-out"
            style={{
              filter: `drop-shadow(0 0 6px ${band.color}88)`,
            }}
          />
        </svg>

        {/* Center score readout */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`font-mono tabular-nums leading-none ${dimensions.fontSize} ${band.textClass}`}>
            {clampedScore}
          </span>
          {size === 'lg' && (
            <span className="text-[10px] uppercase tracking-wider text-slate-400 mt-1">
              {band.label}
            </span>
          )}
        </div>
      </div>

      {showLabel && size !== 'lg' && (
        <span className={`text-[10px] font-mono tracking-wider mt-1 uppercase ${band.textClass}`}>
          {band.label}
        </span>
      )}
    </div>
  );
};
