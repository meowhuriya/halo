import React, { useState } from 'react';
import { Monitor, Send, Users, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { useMission } from '../app/MissionContext';
import { GlassCard } from '../design/components/GlassCard';
import { BigButton } from '../design/components/BigButton';
import { formatCommDelay } from '../config/environments';

export const GroundConsoleView: React.FC = () => {
  const { crew, config, environment } = useMission();
  const [replyText, setReplyText] = useState('');
  const [sentNotice, setSentNotice] = useState(false);

  const delayStr = formatCommDelay(config?.oneWayDelaySeconds ?? environment.defaultDelaySeconds);

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    setSentNotice(true);
    setReplyText('');
    setTimeout(() => setSentNotice(false), 4000);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      
      {/* Flight Surgeon Mission Control Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-blue-950/40 via-white/[0.03] to-slate-900/50 border border-blue-500/30 backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Monitor size={16} className="text-blue-400" />
            <span className="text-xs font-mono tracking-widest text-blue-300 uppercase">
              NASA JSC · FLIGHT SURGEON CONSOLE (EARTH)
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Earth Ground Operations Console
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            Simulated deep-space medical monitoring console. Telemetry packets arrive subject to speed-of-light comm delay.
          </p>
        </div>

        <div className="px-4 py-2.5 rounded-2xl bg-blue-950/50 border border-blue-400/30 text-right font-mono text-xs">
          <div className="text-slate-400 text-[10px]">DOWNLINK PROPAGATION DELAY</div>
          <div className="text-blue-300 font-bold text-base">{delayStr}</div>
        </div>
      </div>

      {/* Crew Overview Card */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Left: Active Crew Telemetry Card */}
        <GlassCard variant="default" padded="md" className="md:col-span-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Users size={14} className="text-cyan-400" />
              Expedition Crew List
            </span>
            <span className="text-[10px] font-mono text-cyan-300">Ares Transit (4)</span>
          </div>

          <div className="space-y-2">
            <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-400/30 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">{crew?.name || 'Dr. Alex Vance'}</span>
                <span className="text-[10px] font-mono text-cyan-300 px-1.5 py-0.2 rounded bg-cyan-500/20">CMO</span>
              </div>
              <div className="text-[11px] text-slate-300 font-mono">
                HR: 64 bpm · BP: 116/76 · SpO₂: 98%
              </div>
              <div className="text-[10px] text-emerald-400 font-mono">
                Telemetry Link Active (Simulated)
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 opacity-80 text-xs">
              <div className="font-semibold text-slate-200">Cdr. Sarah Chen</div>
              <div className="text-[10px] text-slate-400 font-mono">Status: Nominal (Day 142)</div>
            </div>

            <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 opacity-80 text-xs">
              <div className="font-semibold text-slate-200">Marcus Bell</div>
              <div className="text-[10px] text-slate-400 font-mono">Status: Nominal (Day 142)</div>
            </div>

            <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 opacity-80 text-xs">
              <div className="font-semibold text-slate-200">Dr. Elena Rostova</div>
              <div className="text-[10px] text-slate-400 font-mono">Status: Nominal (Day 142)</div>
            </div>
          </div>
        </GlassCard>

        {/* Right: Downlinked Packets & Flight Surgeon Reply Box */}
        <div className="md:col-span-8 space-y-6">
          
          {/* Incoming Packets Queue */}
          <GlassCard variant="default" padded="md" className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <ArrowDownLeft size={14} className="text-blue-400" />
                Incoming Telemetry Packets (Ship → Earth)
              </span>
              <span className="text-[10px] font-mono text-blue-300">BroadcastChannel: 'halo-downlink'</span>
            </div>

            <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white">Daily Health &amp; Sleep Telemetry Summary</span>
                <span className="text-[10px] font-mono text-cyan-300 px-2 py-0.5 rounded bg-cyan-950 border border-cyan-500/30">
                  MET DAY 142
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Vitals summary received. Heart rate stable (64 bpm). Sleep debt noted (5.6h consecutive nights). No acute distress flags reported.
              </p>
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1 border-t border-white/5">
                <span>Transmitted: MET 142 08:30:00</span>
                <span className="text-emerald-400">Arrived via speed-of-light link</span>
              </div>
            </div>
          </GlassCard>

          {/* Flight Surgeon Reply Box */}
          <GlassCard variant="default" padded="md" className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <ArrowUpRight size={14} className="text-cyan-400" />
                Transmit Clinical Advisory (Earth → Ship)
              </span>
              <span className="text-[10px] font-mono text-slate-400">One-way delay: {delayStr}</span>
            </div>

            <form onSubmit={handleSendReply} className="space-y-3">
              <textarea
                rows={3}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Enter flight surgeon medical notes or protocol instructions..."
                className="w-full p-3 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 resize-none font-mono"
              />

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400 font-mono">
                  Transmits packet with {delayStr} simulated propagation latency.
                </span>

                <BigButton type="submit" variant="primary" size="md" icon={<Send size={15} />}>
                  Queue to Deep Space Link
                </BigButton>
              </div>

              {sentNotice && (
                <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs font-mono">
                  ✓ Packet queued to deep space link. Arriving on HALO Bridge in {delayStr}.
                </div>
              )}
            </form>
          </GlassCard>

        </div>

      </div>

    </div>
  );
};
