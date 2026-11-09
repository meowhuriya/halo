import React, { useState } from 'react';
import { LineChart } from 'lucide-react';
import { GlassCard } from '../../design/components/GlassCard';
import { StatusBadge } from '../../design/components/StatusBadge';

export const TrendsView: React.FC = () => {
  const [selectedRange, setSelectedRange] = useState<'7' | '30' | '90' | '142'>('30');
  const [showOsdrCohort, setShowOsdrCohort] = useState(false);

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <LineChart size={16} className="text-cyan-400" />
            <span className="text-xs font-mono tracking-widest text-cyan-300 uppercase">
              ANALYTICS &amp; BASELINE TRAJECTORY
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Vitals Trends &amp; Baseline Comparison
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            Recharts engine with shaded personal baseline ribbons (mean ± 2 SD) and clinical reference envelopes.
          </p>
        </div>

        {/* Range Selector */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-black/40 border border-white/10 text-xs font-mono">
          {(['7', '30', '90', '142'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setSelectedRange(r)}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                selectedRange === r
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {r === '142' ? 'Full MET' : `${r}D`}
            </button>
          ))}
        </div>
      </div>

      {/* Inspiration4 OSDR Toggle Card (§7.17) */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-950/30 to-purple-950/30 border border-cyan-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-purple-300 font-mono text-xs">
            OSDR
          </div>
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-2">
              Compare with real astronauts (Inspiration4, NASA OSDR)
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                §7.17
              </span>
            </div>
            <p className="text-[11px] text-slate-300">
              NASA Open Science Data Repository reference cohort ribbon (n = 4, not a diagnosis).
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowOsdrCohort(!showOsdrCohort)}
          className={`px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all min-h-[44px] ${
            showOsdrCohort
              ? 'bg-purple-600 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]'
              : 'bg-white/10 text-slate-300 hover:bg-white/15'
          }`}
        >
          {showOsdrCohort ? '✓ COHORT OVERLAY ON' : '+ ENABLE COHORT OVERLAY'}
        </button>
      </div>

      {/* Main Trends Graph Placeholder / Architecture */}
      <GlassCard variant="default" padded="lg" className="space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div>
            <h3 className="text-base font-bold text-white">Resting Heart Rate &amp; Autonomic Drift</h3>
            <span className="text-xs text-slate-400 font-mono">Personal Baseline: 64 ± 5 bpm</span>
          </div>
          <StatusBadge status="NOMINAL" />
        </div>

        {/* Visual mock of graph area */}
        <div className="h-64 rounded-2xl bg-black/40 border border-white/5 flex flex-col items-center justify-center p-6 relative overflow-hidden">
          <div className="absolute inset-x-0 top-1/3 h-1/3 bg-cyan-500/[0.04] border-y border-dashed border-cyan-400/20" />
          <span className="text-xs font-mono text-cyan-300/80 mb-1 z-10">Personal Baseline Ribbon (mean ± 2 SD: 54–74 bpm)</span>
          <span className="text-xs text-slate-400 z-10 text-center max-w-sm">
            Interactive Recharts rendering with dual-axis overlay (Sleep vs PVT, Stress vs HR) active in Phase 7.
          </span>
          {showOsdrCohort && (
            <div className="mt-3 px-3 py-1 rounded-full bg-purple-950/60 border border-purple-400/40 text-[10px] font-mono text-purple-300 z-10">
              NASA OSDR Inspiration4 Cohort Ribbon Enabled (n = 4)
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-300">
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
            <span className="text-slate-400 block text-[10px] font-mono">7-DAY LINEAR TREND</span>
            <span className="font-bold text-emerald-400 font-mono">Stable (+0.2 bpm/wk)</span>
          </div>
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
            <span className="text-slate-400 block text-[10px] font-mono">BASELINE VARIANCE (z)</span>
            <span className="font-bold text-cyan-300 font-mono">z = +0.40 (Nominal)</span>
          </div>
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
            <span className="text-slate-400 block text-[10px] font-mono">CLINICAL ENVELOPE</span>
            <span className="font-bold text-slate-200 font-mono">50 – 100 bpm</span>
          </div>
        </div>
      </GlassCard>

    </div>
  );
};
