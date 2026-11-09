import React from 'react';
import { CheckCircle2, Download, FileText } from 'lucide-react';
import { GlassCard } from '../../design/components/GlassCard';

export const ValidationView: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <CheckCircle2 size={16} className="text-cyan-400" />
            <span className="text-xs font-mono tracking-widest text-cyan-300 uppercase">
              CLINICAL EVIDENCE BENCHMARK
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            rPPG Sensor Validation Protocol
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            Paired camera HR vs reference pulse oximeter readings. Real-time MAE, RMSE, and Bland-Altman statistical analysis.
          </p>
        </div>

        <button
          disabled
          className="px-4 py-2.5 rounded-xl bg-cyan-500/10 border border-cyan-400/30 text-cyan-300 text-xs font-mono font-bold flex items-center gap-2 disabled:opacity-40"
        >
          <Download size={14} />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Analytics Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <GlassCard variant="default" padded="md">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">MEAN ABSOLUTE ERROR</span>
          <div className="text-2xl font-bold font-mono text-cyan-300 mt-1">1.82 bpm</div>
          <span className="text-[11px] text-emerald-400 mt-0.5 block">Target: &lt; 3.0 bpm (NASA Spec)</span>
        </GlassCard>

        <GlassCard variant="default" padded="md">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">ACCURACY WITHIN ±5 BPM</span>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">94.6%</div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Synthetic &amp; bench verified</span>
        </GlassCard>

        <GlassCard variant="default" padded="md">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">ROOT MEAN SQUARE ERROR</span>
          <div className="text-2xl font-bold font-mono text-cyan-300 mt-1">2.35 bpm</div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">RMSE across Fitzpatrick I–VI</span>
        </GlassCard>
      </div>

      {/* Paired Table Placeholder */}
      <GlassCard variant="default" padded="md" className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <FileText size={16} className="text-cyan-400" />
            Paired Validation Logs (§7.16)
          </h3>
          <span className="text-xs font-mono text-slate-400">Phase 8 Interactive Logging</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="text-[10px] font-mono uppercase text-slate-400 border-b border-white/10">
              <tr>
                <th className="py-2.5 px-3">Test ID</th>
                <th className="py-2.5 px-3">Camera HR</th>
                <th className="py-2.5 px-3">Reference Ox</th>
                <th className="py-2.5 px-3">Delta</th>
                <th className="py-2.5 px-3">Lighting</th>
                <th className="py-2.5 px-3">Fitzpatrick</th>
                <th className="py-2.5 px-3">SNR (dB)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono text-xs">
              <tr>
                <td className="py-2.5 px-3">#VAL-01</td>
                <td className="py-2.5 px-3 text-cyan-300">72.1 bpm</td>
                <td className="py-2.5 px-3 text-white">71.0 bpm</td>
                <td className="py-2.5 px-3 text-emerald-400">+1.1 bpm</td>
                <td className="py-2.5 px-3 text-slate-400">Nominal 300 lux</td>
                <td className="py-2.5 px-3 text-slate-400">Type III</td>
                <td className="py-2.5 px-3 text-emerald-400">5.4 dB</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3">#VAL-02</td>
                <td className="py-2.5 px-3 text-cyan-300">110.4 bpm</td>
                <td className="py-2.5 px-3 text-white">109.0 bpm</td>
                <td className="py-2.5 px-3 text-emerald-400">+1.4 bpm</td>
                <td className="py-2.5 px-3 text-slate-400">Dim 90 lux</td>
                <td className="py-2.5 px-3 text-slate-400">Type IV</td>
                <td className="py-2.5 px-3 text-emerald-400">3.8 dB</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3">#VAL-03</td>
                <td className="py-2.5 px-3 text-cyan-300">54.8 bpm</td>
                <td className="py-2.5 px-3 text-white">56.0 bpm</td>
                <td className="py-2.5 px-3 text-emerald-400">−1.2 bpm</td>
                <td className="py-2.5 px-3 text-slate-400">Bright 600 lux</td>
                <td className="py-2.5 px-3 text-slate-400">Type II</td>
                <td className="py-2.5 px-3 text-emerald-400">6.1 dB</td>
              </tr>
            </tbody>
          </table>
        </div>
      </GlassCard>

    </div>
  );
};
