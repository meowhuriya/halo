import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  HelpCircle,
  Info,
  ShieldAlert,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BigButton } from '../../design/components/BigButton';
import { StatusBadge } from '../../design/components/StatusBadge';
import type { BodyRegionTelemetry } from './digitalTwin';

interface RegionSideSheetProps {
  region: BodyRegionTelemetry | null;
  onClose: () => void;
  onJumpToRadiation?: () => void;
}

export const RegionSideSheet: React.FC<RegionSideSheetProps> = ({
  region,
  onClose,
  onJumpToRadiation,
}) => {
  useEffect(() => {
    if (!region) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [region, onClose]);

  if (!region) return null;

  const strokeColor =
    region.status === 'CRITICAL'
      ? '#EF4444'
      : region.status === 'ALERT'
        ? '#F97316'
        : region.status === 'WATCH'
          ? '#F59E0B'
          : region.status === 'NOMINAL'
            ? '#22C55E'
            : '#38E1FF';

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="region-sheet-title"
      data-testid="region-side-sheet"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-lg h-full bg-[#070B14] border-l border-cyan-500/25 shadow-[0_0_50px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden">
        {/* Top Sticky Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-start justify-between gap-3 bg-[#05070D]/90 shrink-0">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-[11px] font-mono uppercase tracking-widest text-cyan-300">
                PHYSIOLOGY SYSTEM SHEET
              </span>
              {region.status ? (
                <StatusBadge status={region.status} size="sm" />
              ) : (
                <span
                  role="status"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono uppercase bg-cyan-500/10 border border-cyan-400/30 text-cyan-300"
                >
                  <HelpCircle size={12} />
                  <span>NO DATA</span>
                </span>
              )}
            </div>
            <h2 id="region-sheet-title" className="text-xl font-extrabold text-white truncate">
              {region.name}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">{region.subtitle}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close region details"
            data-testid="close-region-sheet-btn"
            className="min-w-[56px] min-h-[56px] rounded-2xl bg-white/5 hover:bg-white/15 border border-white/15 text-slate-200 flex items-center justify-center shrink-0 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {/* Latest Readings Section */}
          <section className="space-y-3">
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Activity size={14} className="text-cyan-400" />
              <span>Latest Telemetry Readings</span>
            </h3>

            {!region.hasData ? (
              <div
                data-testid="region-sheet-empty"
                className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 text-xs sm:text-sm text-slate-300"
              >
                No verified measurements logged yet for {region.shortName}. Run a check below to establish baseline telemetry.
              </div>
            ) : (
              <div className="space-y-2.5">
                {region.indicators.map((ind) => (
                  <div
                    key={ind.indicator}
                    className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-1.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-bold text-white">{ind.label}</span>
                      <StatusBadge status={ind.status} size="sm" />
                    </div>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-lg font-mono font-extrabold text-cyan-300 tabular-nums">
                        {ind.formattedValue}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        Day {ind.missionDay} · {ind.source}
                      </span>
                    </div>
                    {ind.baselineNote && (
                      <div className="text-[11px] font-mono text-slate-300">
                        {ind.baselineNote}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Trend Sparkline */}
          {region.primarySparkline.length > 0 && (
            <section className="p-4 rounded-2xl bg-slate-950/75 border border-white/10 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono uppercase text-slate-300 flex items-center gap-1.5">
                  <TrendingUp size={14} className="text-cyan-400" />
                  {region.sparklineTitle}
                </span>
                <span className="font-mono text-slate-400">{region.sparklineUnit}</span>
              </div>
              <div className="w-full h-32" data-testid="region-sheet-sparkline">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={region.primarySparkline}
                    margin={{ top: 8, right: 12, left: -16, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: '#94A3B8', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: '#94A3B8', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      domain={['auto', 'auto']}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0B111E',
                        borderColor: 'rgba(56,225,255,0.3)',
                        borderRadius: '12px',
                        fontSize: '12px',
                        color: '#F1F5F9',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke={strokeColor}
                      strokeWidth={2.5}
                      dot={{ r: 3.5, fill: strokeColor }}
                      activeDot={{ r: 5 }}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}

          {/* Rules Engine Reasons */}
          <section className="space-y-2">
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <ShieldAlert size={14} className="text-cyan-400" />
              <span>Rules Engine Assessment</span>
            </h3>
            <ul className="space-y-1.5">
              {region.reasons.map((reason, idx) => (
                <li
                  key={idx}
                  className="p-3 rounded-xl bg-white/[0.03] border border-white/10 text-xs sm:text-sm text-slate-200 leading-relaxed"
                >
                  {reason}
                </li>
              ))}
            </ul>
          </section>

          {/* What it does & Spaceflight Physiology (§7.2) */}
          <section className="p-4 rounded-2xl bg-cyan-500/[0.05] border border-cyan-500/20 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-cyan-300">
              <Info size={14} />
              <span>Physiology &amp; Spaceflight Adaptation</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
              <strong className="text-white">System Role:</strong> {region.whatItDoes}
            </p>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              <strong className="text-cyan-200">How Spaceflight Affects It:</strong>{' '}
              {region.spaceflightEffect}
            </p>
          </section>

          {/* Recommended Actions */}
          <section className="space-y-2">
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400">
              Recommended Actions
            </h3>
            <ul className="space-y-1.5">
              {region.recommendedActions.map((step, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-200 p-2.5 rounded-xl bg-white/[0.02] border border-white/5"
                >
                  <span className="font-mono text-cyan-400 font-bold shrink-0">{i + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Sticky Footer Primary Action */}
        <div className="p-4 border-t border-white/10 bg-[#05070D]/95 shrink-0">
          {region.id === 'skin' && onJumpToRadiation ? (
            <BigButton
              variant="primary"
              size="md"
              fullWidth
              icon={<ArrowRight size={18} />}
              iconPosition="right"
              onClick={() => {
                onClose();
                onJumpToRadiation();
              }}
            >
              {region.primaryActionLabel}
            </BigButton>
          ) : (
            <Link to={region.primaryActionRoute} onClick={onClose} className="block">
              <BigButton
                variant="primary"
                size="md"
                fullWidth
                icon={<ArrowRight size={18} />}
                iconPosition="right"
              >
                {region.primaryActionLabel}
              </BigButton>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};
