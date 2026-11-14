import React, { useState } from 'react';
import { Split, Radio, Monitor, Zap, ArrowLeft, Send } from 'lucide-react';
import { GroundLinkView } from '../features/groundlink/GroundLinkView';
import { GroundConsoleView } from './GroundConsoleView';
import { useMission } from '../app/MissionContext';
import { transmitDownlinkPacket } from '../features/groundlink/groundLinkService';
import { formatCommDelay } from '../config/environments';

export const SplitView: React.FC = () => {
  const { config, environment, crew } = useMission();
  const [isTriggering, setIsTriggering] = useState(false);

  const oneWayDelaySeconds = config?.oneWayDelaySeconds ?? environment.defaultDelaySeconds;
  const timeCompression = config?.timeCompression ?? true;
  const delayDisplay = formatCommDelay(oneWayDelaySeconds);

  // Quick button for judges / testers to fire a real downlink packet from Ship to Earth
  const handleTriggerTestTelemetry = async () => {
    try {
      setIsTriggering(true);
      await transmitDownlinkPacket({
        title: 'ALERT: Sleep Debt & Fatigue Telemetry (Day 142)',
        type: 'ALERT',
        priority: 'HIGH',
        payload: {
          crew: crew?.name || 'Dr. Alex Vance',
          missionDay: config?.missionDay ?? 142,
          indicator: 'sleep',
          value: 5.4,
          unit: 'h',
          note: 'Consecutive nights < 6h. PVT response slowing > 20% vs baseline.',
          timestamp: Date.now(),
        },
        oneWayDelaySeconds,
        timeCompression,
      });
    } finally {
      setIsTriggering(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#05070D] text-slate-100 flex flex-col font-sans" data-testid="split-view">
      {/* Top Split View Controller Header */}
      <header className="sticky top-0 z-40 bg-[#070b14]/90 backdrop-blur-xl border-b border-white/10 px-4 py-3 shadow-lg">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <a
              href="/"
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-all"
              title="Return to Bridge"
            >
              <ArrowLeft size={16} />
            </a>

            <div>
              <div className="flex items-center gap-2">
                <Split size={16} className="text-purple-400" />
                <h1 className="text-sm sm:text-base font-extrabold text-white tracking-tight font-mono uppercase">
                  HALO Deep Space Telemetry · Dual Console Split Screen (§7.12)
                </h1>
              </div>
              <p className="text-[11px] text-slate-400">
                Synchronized interplanetary telemetry simulation over BroadcastChannel (&lsquo;halo-downlink&rsquo;) with speed-of-light delay ({delayDisplay}).
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleTriggerTestTelemetry}
              disabled={isTriggering}
              data-testid="trigger-test-downlink-btn"
              className="px-3.5 py-1.5 rounded-xl bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-400/50 text-cyan-200 text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow-md"
            >
              <Send size={13} />
              <span>{isTriggering ? 'Transmitting...' : 'Transmit Test Alert from Ship'}</span>
            </button>

            <div className="px-3 py-1.5 rounded-xl bg-purple-950/50 border border-purple-500/30 text-[11px] font-mono text-purple-200 flex items-center gap-1.5">
              <Zap size={13} className="text-amber-400 fill-amber-400" />
              <span>{timeCompression ? '30x Time Compression' : '1x Real Time'}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Split Body: 2 Columns on Desktop, Stacked on Mobile */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-white/10 overflow-x-hidden">
        {/* Left Side: Ship View (Astronaut Telemetry Outbox & Inbox) */}
        <section className="p-3 sm:p-5 overflow-y-auto bg-gradient-to-b from-cyan-950/10 to-transparent">
          <div className="mb-4 flex items-center justify-between pb-2 border-b border-cyan-500/20">
            <div className="flex items-center gap-2">
              <Radio size={16} className="text-cyan-400" />
              <span className="text-xs font-mono font-bold text-cyan-300 tracking-wider uppercase">
                Ship Console · Ares Transit Vehicle
              </span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
              ASTRONAUT VIEW
            </span>
          </div>

          <GroundLinkView isSplitView={true} />
        </section>

        {/* Right Side: Earth View (Flight Surgeon Mission Control) */}
        <section className="p-3 sm:p-5 overflow-y-auto bg-gradient-to-b from-blue-950/10 to-transparent">
          <div className="mb-4 flex items-center justify-between pb-2 border-b border-blue-500/20">
            <div className="flex items-center gap-2">
              <Monitor size={16} className="text-blue-400" />
              <span className="text-xs font-mono font-bold text-blue-300 tracking-wider uppercase">
                Earth Operations · NASA JSC Mission Control
              </span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
              FLIGHT SURGEON VIEW
            </span>
          </div>

          <GroundConsoleView isSplitView={true} />
        </section>
      </main>
    </div>
  );
};
