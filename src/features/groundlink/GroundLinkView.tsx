import React from 'react';
import { Radio, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { useMission } from '../../app/MissionContext';
import { GlassCard } from '../../design/components/GlassCard';
import { formatCommDelay } from '../../config/environments';

export const GroundLinkView: React.FC = () => {
  const { config, environment } = useMission();
  const delayStr = formatCommDelay(config?.oneWayDelaySeconds ?? environment.defaultDelaySeconds);

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Radio size={16} className="text-cyan-400" />
            <span className="text-xs font-mono tracking-widest text-cyan-300 uppercase">
              DEEP SPACE TELEMETRY LINK
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Ground Link &amp; Flight Surgeon Queue
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            Simulated speed-of-light propagation delay via BroadcastChannel to Ground Console.
          </p>
        </div>

        <div className="px-4 py-2 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 font-mono text-xs text-right">
          <div className="text-slate-400 text-[10px]">CURRENT ONE-WAY LATENCY</div>
          <div className="text-cyan-300 font-bold text-base">{delayStr}</div>
        </div>
      </div>

      {/* Earth <-> Ship Orbit Arc Visualization Preview (§7.12) */}
      <GlassCard variant="default" padded="lg" className="flex flex-col items-center justify-center py-8 relative overflow-hidden bg-black/60 border-cyan-500/20">
        <div className="w-full flex items-center justify-between px-6 mb-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-400 flex items-center justify-center font-mono text-xs text-cyan-300">
              🚀
            </div>
            <div>
              <div className="text-xs font-bold text-white">Ares Habitat</div>
              <div className="text-[10px] font-mono text-slate-400">{environment.name}</div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-right">
            <div>
              <div className="text-xs font-bold text-white">NASA Johnson (Earth)</div>
              <div className="text-[10px] font-mono text-slate-400">Flight Surgeon Console</div>
            </div>
            <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-400 flex items-center justify-center font-mono text-xs text-blue-300">
              🌍
            </div>
          </div>
        </div>

        {/* Arc Path Graphic */}
        <div className="w-full max-w-lg h-24 relative flex items-center justify-center">
          <svg viewBox="0 0 400 80" className="w-full h-full">
            <path
              d="M 20 60 Q 200 10 380 60"
              fill="none"
              stroke="rgba(56, 225, 255, 0.25)"
              strokeWidth="2"
              strokeDasharray="6 4"
            />
            {/* In-flight telemetry packet dot */}
            <circle cx="200" cy="35" r="5" fill="#38E1FF" className="animate-ping" />
            <circle cx="200" cy="35" r="4" fill="#FFFFFF" />
          </svg>
        </div>

        <div className="text-center space-y-1">
          <span className="text-xs font-mono text-cyan-300">Telemetry Packet In-Flight</span>
          <p className="text-[11px] text-slate-400">
            Open Ground Console (<code>/ground</code>) in another window to test bidirectional latency communication.
          </p>
        </div>
      </GlassCard>

      {/* Packet Queues */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <GlassCard variant="default" padded="md" className="space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <ArrowUpRight size={14} className="text-cyan-400" />
              Downlink Outbox (Ship → Earth)
            </span>
            <span className="text-[10px] font-mono text-slate-400">1 Packet</span>
          </div>

          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-200">Daily Health Telemetry Summary</span>
              <span className="text-[10px] font-mono text-cyan-400">In Transit</span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              Arriving in approx. {delayStr}
            </div>
          </div>
        </GlassCard>

        <GlassCard variant="default" padded="md" className="space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <ArrowDownLeft size={14} className="text-emerald-400" />
              Uplink Inbox (Earth → Ship)
            </span>
            <span className="text-[10px] font-mono text-emerald-400">1 New</span>
          </div>

          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-200">Flight Surgeon Morning Briefing</span>
              <span className="text-[10px] font-mono text-emerald-400">Delivered</span>
            </div>
            <div className="text-[11px] text-slate-400">
              Dr. M. Stone: "Radiation nominal for next 48h. Keep up resistance training."
            </div>
          </div>
        </GlassCard>
      </div>

    </div>
  );
};
