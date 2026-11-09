import React from 'react';
import { Brain, Play, Clock } from 'lucide-react';
import { GlassCard } from '../../design/components/GlassCard';
import { BigButton } from '../../design/components/BigButton';
import { StatusBadge } from '../../design/components/StatusBadge';

export const CognitionView: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Brain size={16} className="text-cyan-400" />
            <span className="text-xs font-mono tracking-widest text-cyan-300 uppercase">
              NASA COGNITION BATTERY
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Psychomotor Vigilance Test (PVT-B)
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            Brief 3-minute sustained-attention reaction time task. Detects operational fatigue before subjective awareness.
          </p>
        </div>
        <StatusBadge status="WATCH" />
      </div>

      {/* Test Preview Arena */}
      <GlassCard variant="default" padded="lg" className="flex flex-col items-center justify-center py-12 relative overflow-hidden bg-black/50 border-cyan-500/20">
        <div className="max-w-md w-full text-center space-y-6">
          
          <div className="w-20 h-20 rounded-3xl bg-cyan-500/10 border border-cyan-400/40 flex items-center justify-center mx-auto text-cyan-300 shadow-[0_0_30px_rgba(56,225,255,0.2)]">
            <Clock size={36} className="animate-pulse" />
          </div>

          <div>
            <h2 className="text-xl font-bold text-white">3-Minute Standardized PVT-B</h2>
            <p className="text-xs text-slate-300 mt-1">
              Random inter-stimulus interval (1–4 s). Tap screen or press spacebar immediately when millisecond counter starts.
            </p>
          </div>

          {/* Stimulus Target Simulation */}
          <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 font-mono text-4xl font-extrabold text-cyan-300 tracking-wider tabular-nums">
            000 ms
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs font-mono text-slate-400 text-left">
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
              <span className="text-slate-400 block text-[10px]">LAPSE CRITERION</span>
              <span className="font-bold text-amber-400">RT ≥ 355 ms</span>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
              <span className="text-slate-400 block text-[10px]">CLOCK ACCURACY</span>
              <span className="font-bold text-cyan-300">rAF + High-Res</span>
            </div>
          </div>

          <BigButton variant="primary" size="lg" fullWidth icon={<Play size={18} />} disabled>
            Test Protocol Active in Phase 4
          </BigButton>
        </div>
      </GlassCard>

      {/* Educational Note */}
      <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 text-xs text-slate-400">
        <strong>Why it matters on deep space missions:</strong> PVT-B was developed specifically for NASA flight operations to evaluate astronaut neurobehavioral vulnerability, microgravity sleep loss, and cumulative circadian desynchrony before EVAs or docking.
      </div>

    </div>
  );
};
