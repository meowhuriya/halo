import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  TrendingUp,
  Heart,
  Activity,
  Moon,
  Clock,
  Thermometer,
  Droplets,
  Calendar,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceArea,
} from 'recharts';
import { db, type HealthReading, type PersonalBaseline } from '../../data/db';
import { useMission } from '../../app/MissionContext';
import { GlassCard } from '../../design/components/GlassCard';
import { StatusBadge } from '../../design/components/StatusBadge';

export type TrendRange = '7' | '30' | '90' | '142';

interface IndicatorConfig {
  id: string;
  label: string;
  unit: string;
  icon: React.ReactNode;
  baselineKey: string;
  clinicalNominal: { min: number; max: number; label: string };
  defaultMin: number;
  defaultMax: number;
}

const INDICATORS: IndicatorConfig[] = [
  {
    id: 'heart_rate',
    label: 'Resting Heart Rate',
    unit: 'bpm',
    icon: <Heart size={16} className="text-red-400" />,
    baselineKey: 'heart_rate',
    clinicalNominal: { min: 50, max: 100, label: '50–100 bpm' },
    defaultMin: 40,
    defaultMax: 120,
  },
  {
    id: 'blood_pressure',
    label: 'Blood Pressure',
    unit: 'mmHg',
    icon: <Activity size={16} className="text-cyan-400" />,
    baselineKey: 'systolic_bp',
    clinicalNominal: { min: 90, max: 120, label: 'Sys 90–119 / Dia < 80 mmHg' },
    defaultMin: 60,
    defaultMax: 150,
  },
  {
    id: 'sleep',
    label: 'Sleep Duration',
    unit: 'hours',
    icon: <Moon size={16} className="text-indigo-400" />,
    baselineKey: 'sleep',
    clinicalNominal: { min: 7.0, max: 10.0, label: '≥ 7.0 h' },
    defaultMin: 4.0,
    defaultMax: 10.0,
  },
  {
    id: 'pvt',
    label: 'PVT-B Reaction Speed',
    unit: '1/s',
    icon: <Clock size={16} className="text-amber-400" />,
    baselineKey: 'pvt_speed',
    clinicalNominal: { min: 3.78, max: 5.0, label: 'Within 10% of baseline (≥ 3.78 1/s)' },
    defaultMin: 2.5,
    defaultMax: 5.0,
  },
  {
    id: 'spo2',
    label: 'Blood Oxygen (SpO₂)',
    unit: '%',
    icon: <Droplets size={16} className="text-blue-400" />,
    baselineKey: 'spo2',
    clinicalNominal: { min: 95, max: 100, label: '≥ 95%' },
    defaultMin: 88,
    defaultMax: 100,
  },
  {
    id: 'temperature',
    label: 'Body Temperature',
    unit: '°C',
    icon: <Thermometer size={16} className="text-orange-400" />,
    baselineKey: 'temperature',
    clinicalNominal: { min: 36.1, max: 37.2, label: '36.1–37.2 °C' },
    defaultMin: 35.0,
    defaultMax: 38.5,
  },
  {
    id: 'glucose',
    label: 'Blood Glucose',
    unit: 'mg/dL',
    icon: <Activity size={16} className="text-emerald-400" />,
    baselineKey: 'glucose',
    clinicalNominal: { min: 70, max: 140, label: '70–140 mg/dL' },
    defaultMin: 50,
    defaultMax: 180,
  },
];

export const TrendsView: React.FC = () => {
  const { crew, config } = useMission();
  const [selectedIndicator, setSelectedIndicator] = useState<string>('heart_rate');
  const [selectedRange, setSelectedRange] = useState<TrendRange>('30');
  const [readings, setReadings] = useState<HealthReading[]>([]);
  const [baselines, setBaselines] = useState<PersonalBaseline[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const activeCrewId = crew?.id || 1;
  const currentMissionDay = config?.missionDay ?? 142;

  // Load readings and baselines from Dexie
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [allReadings, allBaselines] = await Promise.all([
        db.healthReadings
          .where('crewMemberId')
          .equals(activeCrewId)
          .toArray(),
        db.baselines
          .where('crewMemberId')
          .equals(activeCrewId)
          .toArray(),
      ]);
      setReadings(allReadings);
      setBaselines(allBaselines);
    } finally {
      setIsLoading(false);
    }
  }, [activeCrewId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const activeConfig = useMemo(
    () => INDICATORS.find((i) => i.id === selectedIndicator) || INDICATORS[0],
    [selectedIndicator]
  );

  // Find personal baseline for active indicator
  const baseline = useMemo(() => {
    return baselines.find((b) => b.indicator === activeConfig.baselineKey);
  }, [baselines, activeConfig.baselineKey]);

  // Baseline ribbon bounds (mean ± 2 SD) per §7.13
  const baselineBounds = useMemo(() => {
    if (!baseline) return null;
    const lower = Math.max(0, Math.round((baseline.mean - 2 * baseline.sd) * 10) / 10);
    const upper = Math.round((baseline.mean + 2 * baseline.sd) * 10) / 10;
    return {
      mean: Math.round(baseline.mean * 10) / 10,
      sd: Math.round(baseline.sd * 10) / 10,
      lower,
      upper,
    };
  }, [baseline]);

  // Filter readings by selected range and indicator
  const chartData = useMemo(() => {
    const rangeDays = selectedRange === '142' ? 142 : parseInt(selectedRange, 10);
    const minDay = Math.max(1, currentMissionDay - rangeDays + 1);

    const filtered = readings.filter(
      (r) => r.indicator === activeConfig.id && r.missionDay >= minDay && r.missionDay <= currentMissionDay
    );

    filtered.sort((a, b) => a.missionDay - b.missionDay || a.timestamp - b.timestamp);

    return filtered.map((r) => {
      let val = 0;
      let valSec: number | undefined = undefined;

      if (typeof r.value === 'number') {
        val = r.value;
      } else if (typeof r.value === 'object' && r.value !== null) {
        const bpObj = r.value as { systolic?: number; diastolic?: number };
        val = bpObj.systolic ?? 0;
        valSec = bpObj.diastolic;
      }

      return {
        missionDay: r.missionDay,
        value: val,
        valueSecondary: valSec,
        unit: r.unit,
        status: r.status,
        reasons: r.reasons,
        source: r.source,
        timestamp: r.timestamp,
      };
    });
  }, [readings, activeConfig.id, selectedRange, currentMissionDay]);

  // Latest reading in the active set
  const latestReading = chartData[chartData.length - 1];

  // Render status-colored dot per §7.13
  const renderStatusDot = (props: any): React.ReactElement<SVGElement> => {
    const { cx = 0, cy = 0, payload } = props;
    const statusColors: Record<string, string> = {
      NOMINAL: '#22c55e',
      WATCH: '#f59e0b',
      ALERT: '#f97316',
      CRITICAL: '#ef4444',
    };

    const status = payload?.status || 'NOMINAL';
    const color = statusColors[status] || '#38e1ff';
    const isAlert = status === 'ALERT' || status === 'CRITICAL';

    return (
      <circle
        key={`dot-${cx}-${cy}`}
        cx={cx}
        cy={cy}
        r={isAlert ? 5 : 3.5}
        fill={color}
        stroke={isAlert ? '#ffffff' : '#05070d'}
        strokeWidth={isAlert ? 2 : 1.5}
      />
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in" data-testid="trends-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-xl shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <TrendingUp size={18} className="text-cyan-400" />
            <span className="text-xs font-mono tracking-widest text-cyan-300 uppercase font-bold">
              ANALYTICS &amp; BASELINE TRAJECTORY (§7.13)
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Vitals Trends &amp; Baseline Comparison
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
            Per-indicator clinical trajectories with shaded personal baseline ribbons (mean ± 2 SD) and clinical reference envelopes.
          </p>
        </div>

        {/* Range Selector (§7.13) */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-black/40 border border-white/10 text-xs font-mono self-start sm:self-auto">
          {(['7', '30', '90', '142'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setSelectedRange(r)}
              data-testid={`range-${r}-btn`}
              className={`px-3.5 py-1.5 rounded-xl font-bold transition-all ${
                selectedRange === r
                  ? 'bg-cyan-500/30 text-cyan-200 border border-cyan-400/50 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {r === '142' ? 'Full MET (142D)' : `${r}D`}
            </button>
          ))}
        </div>
      </div>

      {/* Indicator Selection Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {INDICATORS.map((ind) => {
          const isSelected = selectedIndicator === ind.id;
          return (
            <button
              key={ind.id}
              type="button"
              onClick={() => setSelectedIndicator(ind.id)}
              data-testid={`indicator-${ind.id}-btn`}
              className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                isSelected
                  ? 'bg-cyan-500/20 border-cyan-400/60 shadow-[0_0_15px_rgba(56,225,255,0.15)]'
                  : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/10'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                {ind.icon}
                <span className="text-[10px] font-mono text-slate-400">{ind.unit}</span>
              </div>
              <div className="mt-2 text-xs font-bold text-white leading-tight">{ind.label}</div>
            </button>
          );
        })}
      </div>

      {/* Main Trends Chart Card */}
      <GlassCard variant="default" padded="lg" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-bold text-white font-mono">{activeConfig.label}</h2>
              <span className="text-xs font-mono text-slate-400">({activeConfig.unit})</span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 font-mono mt-1">
              {baselineBounds ? (
                <span>
                  Personal Baseline: <strong className="text-cyan-300">{baselineBounds.mean} ± {baselineBounds.sd}</strong> {activeConfig.unit}
                </span>
              ) : (
                <span>Personal Baseline: Not calibrated</span>
              )}
              <span>·</span>
              <span>
                Clinical Nominal: <strong className="text-emerald-400">{activeConfig.clinicalNominal.label}</strong>
              </span>
            </div>
          </div>

          {latestReading && (
            <div className="flex items-center gap-3">
              <div className="text-right font-mono">
                <div className="text-[10px] text-slate-400 uppercase">Latest (Day {latestReading.missionDay})</div>
                <div className="text-base font-bold text-white">
                  {latestReading.value}
                  {latestReading.valueSecondary !== undefined ? ` / ${latestReading.valueSecondary}` : ''}{' '}
                  <span className="text-xs font-normal text-slate-400">{latestReading.unit}</span>
                </div>
              </div>
              <StatusBadge status={latestReading.status} />
            </div>
          )}
        </div>

        {/* Legend / Info Chips */}
        <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-400/30 text-cyan-300">
            <span className="w-2.5 h-2.5 rounded bg-cyan-400/40 border border-cyan-400" />
            <span>Personal Baseline Ribbon (mean ± 2 SD)</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-400/30 text-emerald-300">
            <span className="w-2.5 h-2.5 rounded bg-emerald-400/30 border border-emerald-400" />
            <span>Clinical Nominal Envelope</span>
          </div>

          <div className="flex items-center gap-2 ml-auto text-slate-400">
            <span>Points:</span>
            <span className="text-emerald-400">● NOMINAL</span>
            <span className="text-amber-400">● WATCH</span>
            <span className="text-orange-400">● ALERT</span>
            <span className="text-red-400">● CRITICAL</span>
          </div>
        </div>

        {/* Recharts Canvas */}
        <div className="h-80 w-full pt-2">
          {isLoading ? (
            <div className="h-full flex items-center justify-center text-slate-400 font-mono text-xs">
              Loading telemetry trends...
            </div>
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 15, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="missionDay"
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(val) => `D${val}`}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      const statusColors: Record<string, string> = {
                        NOMINAL: 'text-emerald-400',
                        WATCH: 'text-amber-400',
                        ALERT: 'text-orange-400',
                        CRITICAL: 'text-red-400',
                      };
                      return (
                        <div className="p-3.5 rounded-2xl bg-[#090d16] border border-cyan-500/40 text-xs font-mono shadow-2xl space-y-1.5 backdrop-blur-md">
                          <div className="flex items-center justify-between gap-4 text-slate-400 font-bold border-b border-white/10 pb-1">
                            <span>Mission Elapsed Day {label}</span>
                            <span className={statusColors[data.status] || 'text-cyan-300'}>
                              ● {data.status}
                            </span>
                          </div>
                          <div className="text-white font-bold text-base">
                            {data.value}
                            {data.valueSecondary !== undefined ? ` / ${data.valueSecondary}` : ''}{' '}
                            <span className="text-xs font-normal text-slate-400">{data.unit}</span>
                          </div>
                          {data.reasons && data.reasons.length > 0 && (
                            <div className="text-[11px] text-slate-300 max-w-xs leading-relaxed pt-1 border-t border-white/5">
                              {data.reasons[0]}
                            </div>
                          )}
                          <div className="text-[10px] text-slate-500 uppercase">
                            Source: {data.source}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />

                {/* 1. Shaded Clinical Nominal Band (§7.13) */}
                <ReferenceArea
                  y1={activeConfig.clinicalNominal.min}
                  y2={activeConfig.clinicalNominal.max}
                  fill="#22c55e"
                  fillOpacity={0.05}
                  stroke="#22c55e"
                  strokeOpacity={0.2}
                  strokeDasharray="4 4"
                />

                {/* 2. Shaded Personal Baseline Band (mean ± 2 SD) (§7.13) */}
                {baselineBounds && (
                  <ReferenceArea
                    y1={baselineBounds.lower}
                    y2={baselineBounds.upper}
                    fill="#38e1ff"
                    fillOpacity={0.08}
                    stroke="#38e1ff"
                    strokeOpacity={0.3}
                    strokeDasharray="3 3"
                  />
                )}

                {/* Primary Metric Line with status-colored dots */}
                <Line
                  type="monotone"
                  dataKey="value"
                  name={activeConfig.id === 'blood_pressure' ? 'Systolic' : activeConfig.label}
                  stroke="#38e1ff"
                  strokeWidth={2.5}
                  dot={renderStatusDot}
                  activeDot={{ r: 6, stroke: '#ffffff', strokeWidth: 2 }}
                />

                {/* Secondary metric line for Blood Pressure (diastolic) */}
                {activeConfig.id === 'blood_pressure' && (
                  <Line
                    type="monotone"
                    dataKey="valueSecondary"
                    name="Diastolic"
                    stroke="#818cf8"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={renderStatusDot}
                    activeDot={{ r: 5, stroke: '#ffffff', strokeWidth: 2 }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 font-mono text-xs">
              <Calendar size={24} className="text-slate-600 mb-2" />
              <span>No readings available for {activeConfig.label} in selected range.</span>
            </div>
          )}
        </div>

        {/* Clinical Statistics Summary Footer */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs text-slate-300 font-mono pt-3 border-t border-white/5">
          <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
            <span className="text-slate-400 block text-[10px] uppercase">Sampling Window</span>
            <span className="font-bold text-white">
              {chartData.length} Readings over {selectedRange === '142' ? '142' : selectedRange} Days
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
            <span className="text-slate-400 block text-[10px] uppercase">Personal Baseline Ribbon</span>
            <span className="font-bold text-cyan-300">
              {baselineBounds ? `${baselineBounds.lower} – ${baselineBounds.upper} ${activeConfig.unit}` : 'N/A'}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
            <span className="text-slate-400 block text-[10px] uppercase">Clinical Nominal Envelope</span>
            <span className="font-bold text-emerald-400">{activeConfig.clinicalNominal.label}</span>
          </div>

          <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
            <span className="text-slate-400 block text-[10px] uppercase">Latest Trajectory Evaluation</span>
            <span
              className={`font-bold ${
                latestReading?.status === 'ALERT'
                  ? 'text-orange-400'
                  : latestReading?.status === 'WATCH'
                  ? 'text-amber-400'
                  : latestReading?.status === 'CRITICAL'
                  ? 'text-red-400'
                  : 'text-emerald-400'
              }`}
            >
              {latestReading?.status || 'NOMINAL'} (Day {latestReading?.missionDay ?? currentMissionDay})
            </span>
          </div>
        </div>
      </GlassCard>
    </div>
  );
};
