import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Radio,
  ArrowUpRight,
  ArrowDownLeft,
  Send,
  ExternalLink,
  Split,
  FileText,
} from 'lucide-react';
import { useMission } from '../../app/MissionContext';
import { db, type GroundPacket } from '../../data/db';
import { GlassCard } from '../../design/components/GlassCard';
import { formatCommDelay } from '../../config/environments';
import {
  calculatePacketProgress,
  checkAndDeliverPackets,
  computeEffectiveDelayMs,
  formatRemainingSeconds,
  getGroundBroadcastChannel,
  transmitDownlinkPacket,
} from './groundLinkService';

export interface GroundLinkViewProps {
  isSplitView?: boolean;
}

export const GroundLinkView: React.FC<GroundLinkViewProps> = ({ isSplitView = false }) => {
  const { crew, config, environment } = useMission();
  const [packets, setPackets] = useState<GroundPacket[]>([]);
  const [now, setNow] = useState<number>(Date.now());
  const [isSending, setIsSending] = useState(false);
  const [selectedSbarPacket, setSelectedSbarPacket] = useState<GroundPacket | null>(null);

  const oneWayDelaySeconds = config?.oneWayDelaySeconds ?? environment.defaultDelaySeconds;
  const timeCompression = config?.timeCompression ?? true;

  // Real-time propagation delay string
  const baseDelayStr = formatCommDelay(oneWayDelaySeconds);
  const effectiveDelayMs = computeEffectiveDelayMs(oneWayDelaySeconds, timeCompression);
  const effectiveDelaySec = Math.round(effectiveDelayMs / 1000);
  const effectiveDelayStr = `${effectiveDelaySec} s`;

  // Fetch packets from Dexie
  const loadPackets = useCallback(async () => {
    const all = await db.groundPackets.toArray();
    setPackets(all.sort((a, b) => b.sentAt - a.sentAt));
  }, []);

  // Tick clock every second and check timestamp delivery per §7.12 (v3)
  useEffect(() => {
    void loadPackets();
    void checkAndDeliverPackets();

    const interval = window.setInterval(async () => {
      const current = Date.now();
      setNow(current);
      const deliveredCount = await checkAndDeliverPackets(current);
      if (deliveredCount > 0) {
        await loadPackets();
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [loadPackets]);

  // Listen for BroadcastChannel events between Ship and Ground
  useEffect(() => {
    const channel = getGroundBroadcastChannel();
    if (!channel) return;

    const handleMessage = () => {
      void loadPackets();
      void checkAndDeliverPackets();
    };

    channel.addEventListener('message', handleMessage);
    return () => channel.removeEventListener('message', handleMessage);
  }, [loadPackets]);

  // Toggle Time Compression
  const handleToggleCompression = async () => {
    if (!config) return;
    const nextVal = !timeCompression;
    await db.missionConfig.update('current', {
      timeCompression: nextVal,
      updatedAt: Date.now(),
    });
    // Update local state if needed via context reload or wait for next load
    window.location.reload();
  };

  // Transmit on-demand telemetry summary packet
  const handleTransmitTelemetry = async () => {
    setIsSending(true);
    try {
      await transmitDownlinkPacket({
        title: `Telemetry Sync · Day ${config?.missionDay ?? 142} Snapshot`,
        type: 'SUMMARY',
        priority: 'NORMAL',
        payload: {
          crew: crew?.name || 'Dr. Alex Vance',
          missionDay: config?.missionDay ?? 142,
          environment: environment.name,
          note: 'Routine biometric and environmental telemetry downlink packet.',
          timestamp: Date.now(),
        },
        oneWayDelaySeconds,
        timeCompression,
      });
      await loadPackets();
    } finally {
      setIsSending(false);
    }
  };

  // Categorize packets
  const downlinkOutbox = useMemo(
    () => packets.filter((p) => p.direction === 'downlink'),
    [packets]
  );
  const uplinkInbox = useMemo(
    () => packets.filter((p) => p.direction === 'uplink'),
    [packets]
  );

  // In-flight packets
  const inFlightDownlinks = downlinkOutbox.filter((p) => !p.delivered);
  const inFlightUplinks = uplinkInbox.filter((p) => !p.delivered);
  const hasInFlight = inFlightDownlinks.length > 0 || inFlightUplinks.length > 0;

  // Active in-flight packet for arc animation
  const primaryInFlight = inFlightDownlinks[0] || inFlightUplinks[0];
  const arcProgress = primaryInFlight
    ? calculatePacketProgress(primaryInFlight.sentAt, primaryInFlight.arrivalAt, now)
    : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in" data-testid="groundlink-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Radio size={16} className="text-cyan-400" />
            <span className="text-xs font-mono tracking-widest text-cyan-300 uppercase">
              DEEP SPACE TELEMETRY LINK (§7.12)
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Ground Link &amp; Flight Surgeon Queue
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            Deterministic speed-of-light propagation delay via BroadcastChannel (&lsquo;halo-downlink&rsquo;).
          </p>
        </div>

        {/* Delay Indicator & Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="px-4 py-2 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 font-mono text-xs text-right">
            <div className="text-slate-400 text-[10px]">SPEED-OF-LIGHT ONE-WAY DELAY</div>
            <div className="text-cyan-300 font-bold text-base">{baseDelayStr}</div>
            {timeCompression && (
              <div className="text-[10px] text-amber-300 font-semibold">
                Compressed: {effectiveDelayStr} real time
              </div>
            )}
          </div>

          <a
            href="/ground"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="open-ground-console-btn"
            className="h-[46px] px-3.5 rounded-xl bg-blue-600/30 hover:bg-blue-600/50 border border-blue-400/50 text-blue-200 text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow-md"
            title="Open Flight Surgeon Console in second window"
          >
            <span>GROUND CONSOLE</span>
            <ExternalLink size={14} />
          </a>

          {!isSplitView && (
            <a
              href="/split"
              data-testid="open-split-view-btn"
              className="h-[46px] px-3.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 border border-purple-400/50 text-purple-200 text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow-md"
              title="Open side-by-side split screen"
            >
              <Split size={14} />
              <span>SPLIT VIEW</span>
            </a>
          )}
        </div>
      </div>

      {/* Demo Time Compression Toggle Banner (§7.12) */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/40 via-black to-cyan-950/40 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 font-mono text-xs">
            ⚡
          </div>
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-2">
              Demo Time Compression Mode
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                1 min light delay = 2 s real time
              </span>
            </div>
            <p className="text-[11px] text-slate-300">
              Accelerates 14-minute propagation into ~28 seconds so judges can verify bidirectional telemetry within demo time.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleToggleCompression}
          data-testid="toggle-time-compression-btn"
          className={`h-[42px] px-4 rounded-xl text-xs font-mono font-bold transition-all glove-target ${
            timeCompression
              ? 'bg-amber-600 text-white shadow-[0_0_15px_rgba(245,158,11,0.5)]'
              : 'bg-white/10 hover:bg-white/20 text-slate-300'
          }`}
        >
          {timeCompression ? '✓ COMPRESSION ON (30× SPEED)' : 'COMPRESSION OFF (REAL TIME)'}
        </button>
      </div>

      {/* Earth <-> Ship Orbit Arc Visualization with Animated Dot (§7.12) */}
      <GlassCard
        variant="default"
        padded="lg"
        data-testid="groundlink-arc"
        className="flex flex-col items-center justify-center py-6 relative overflow-hidden bg-black/70 border-cyan-500/30"
      >
        <div className="w-full flex items-center justify-between px-4 sm:px-8 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-400 flex items-center justify-center text-lg shadow-[0_0_15px_rgba(115, 179, 231,0.4)]">
              🚀
            </div>
            <div>
              <div className="text-sm font-black text-white">Ares Habitat (Ship)</div>
              <div className="text-[10px] font-mono text-cyan-300">{environment.name} (MET Day 142)</div>
            </div>
          </div>

          <div className="text-center font-mono">
            <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
              PROPAGATION MEDIUM
            </div>
            <div className="text-xs text-cyan-200">
              {hasInFlight ? 'Active Transmission in Progress' : 'Radio Carrier Standby'}
            </div>
          </div>

          <div className="flex items-center gap-2.5 text-right">
            <div>
              <div className="text-sm font-black text-white">NASA JSC (Earth)</div>
              <div className="text-[10px] font-mono text-blue-300">Houston Flight Surgeon</div>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-blue-500/20 border border-blue-400 flex items-center justify-center text-lg shadow-[0_0_15px_rgba(59,130,246,0.4)]">
              🌍
            </div>
          </div>
        </div>

        {/* Arc Path Graphic */}
        <div className="w-full max-w-xl h-28 relative flex items-center justify-center">
          <svg viewBox="0 0 500 100" className="w-full h-full overflow-visible">
            <defs>
              <linearGradient id="arcGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#73B3E7" />
                <stop offset="100%" stopColor="#3B82F6" />
              </linearGradient>
            </defs>

            {/* Orbit Arc Guide */}
            <path
              d="M 30 80 Q 250 15 470 80"
              fill="none"
              stroke="url(#arcGradient)"
              strokeWidth="2.5"
              strokeDasharray="6 5"
              className="opacity-40"
            />

            {/* In-Flight Packet Dot (Positioned via quadratic Bézier interpolation) */}
            {hasInFlight && (
              <g>
                {/* Approximate point on quadratic curve: B(t) = (1-t)^2 P0 + 2(1-t)t P1 + t^2 P2 */}
                {(() => {
                  const t = primaryInFlight.direction === 'downlink' ? arcProgress / 100 : 1 - arcProgress / 100;
                  const x = (1 - t) * (1 - t) * 30 + 2 * (1 - t) * t * 250 + t * t * 470;
                  const y = (1 - t) * (1 - t) * 80 + 2 * (1 - t) * t * 15 + t * t * 80;
                  return (
                    <g transform={`translate(${x}, ${y})`}>
                      <circle r="9" fill="#73B3E7" className="animate-ping opacity-75" />
                      <circle r="6" fill="#73B3E7" stroke="#FFFFFF" strokeWidth="2" />
                      <text
                        y="-12"
                        textAnchor="middle"
                        fill="#FFFFFF"
                        fontSize="10"
                        fontFamily="monospace"
                        fontWeight="bold"
                      >
                        {Math.round(arcProgress)}%
                      </text>
                    </g>
                  );
                })()}
              </g>
            )}
          </svg>
        </div>

        <div className="text-center space-y-1">
          <span className="text-xs font-mono text-cyan-300 font-bold">
            {hasInFlight
              ? `In-Flight Packet: ${primaryInFlight.title} (${Math.round(arcProgress)}%)`
              : 'All Packets Delivered · Link Idle'}
          </span>
          <p className="text-[11px] text-slate-400 max-w-md mx-auto">
            Packets are persisted in Dexie with timestamps (<code>sentAt</code> and <code>arrivesAt</code>); refreshing the page never drops or duplicates in-flight telemetry.
          </p>
        </div>
      </GlassCard>

      {/* Downlink Outbox & Uplink Inbox Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Downlink Outbox (Ship -> Earth) */}
        <GlassCard variant="default" padded="md" className="space-y-4">
          <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
            <span className="text-sm font-bold text-white flex items-center gap-1.5">
              <ArrowUpRight size={16} className="text-cyan-400" />
              Downlink Outbox (Ship → Earth)
            </span>
            <button
              type="button"
              disabled={isSending}
              onClick={handleTransmitTelemetry}
              data-testid="send-telemetry-btn"
              className="px-2.5 py-1.5 rounded-lg bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-400/40 text-[11px] font-mono font-bold text-cyan-200 flex items-center gap-1 disabled:opacity-50"
            >
              <Send size={12} />
              <span>{isSending ? 'Sending...' : '+ SEND TELEMETRY'}</span>
            </button>
          </div>

          {downlinkOutbox.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400 font-mono">
              Outbox empty. Emergency SBAR reports and alerts automatically appear here.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
              {downlinkOutbox.map((packet) => {
                const isDelivered = packet.delivered || now >= packet.arrivalAt;
                const remainingMs = Math.max(0, packet.arrivalAt - now);
                const progress = calculatePacketProgress(packet.sentAt, packet.arrivalAt, now);

                return (
                  <div
                    key={packet.id}
                    data-testid={`outbox-packet-${packet.id}`}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      packet.priority === 'HIGH'
                        ? 'bg-red-950/40 border-red-500/50'
                        : 'bg-white/[0.03] border-white/10'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          {packet.priority === 'HIGH' && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-black bg-red-600 text-white">
                              HIGH PRIORITY
                            </span>
                          )}
                          <span className="text-[10px] font-mono text-cyan-400 uppercase">
                            [{packet.type}]
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-white leading-tight">
                          {packet.title}
                        </h4>
                      </div>

                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                          isDelivered
                            ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40'
                            : 'bg-amber-950/80 text-amber-300 border border-amber-500/40 animate-pulse'
                        }`}
                      >
                        {isDelivered ? 'DELIVERED' : `IN TRANSIT (${formatRemainingSeconds(remainingMs)})`}
                      </span>
                    </div>

                    {/* Progress Bar for In-Flight */}
                    {!isDelivered && (
                      <div className="w-full bg-black/60 rounded-full h-1.5 overflow-hidden my-2 border border-white/10">
                        <div
                          className="bg-cyan-400 h-full transition-all duration-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    )}

                    {/* SBAR View button if packet payload contains SBAR */}
                    {packet.type === 'INCIDENT' && packet.payload && (
                      <button
                        type="button"
                        onClick={() => setSelectedSbarPacket(packet)}
                        className="mt-2 w-full py-1.5 rounded-lg bg-red-600/30 hover:bg-red-600/50 border border-red-400/40 text-[11px] font-mono font-bold text-red-200 flex items-center justify-center gap-1.5"
                      >
                        <FileText size={12} />
                        <span>INSPECT SBAR CLINICAL HANDOVER</span>
                      </button>
                    )}

                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mt-2 pt-1.5 border-t border-white/5">
                      <span>Sent: {new Date(packet.sentAt).toLocaleTimeString()}</span>
                      <span>Arrives: {new Date(packet.arrivalAt).toLocaleTimeString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>

        {/* Uplink Inbox (Earth -> Ship) */}
        <GlassCard variant="default" padded="md" className="space-y-4">
          <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
            <span className="text-sm font-bold text-white flex items-center gap-1.5">
              <ArrowDownLeft size={16} className="text-emerald-400" />
              Uplink Inbox (Earth → Ship)
            </span>
            <span className="text-[10px] font-mono text-emerald-300">
              {uplinkInbox.filter((p) => p.delivered).length} Received
            </span>
          </div>

          {uplinkInbox.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400 font-mono">
              Inbox empty. Replies from the Houston Flight Surgeon console arrive here.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
              {uplinkInbox.map((packet) => {
                const isDelivered = packet.delivered || now >= packet.arrivalAt;
                const remainingMs = Math.max(0, packet.arrivalAt - now);
                const progress = calculatePacketProgress(packet.sentAt, packet.arrivalAt, now);
                const author = String(packet.payload?.author || 'Flight Surgeon');
                const message = String(packet.payload?.message || packet.title);

                return (
                  <div
                    key={packet.id}
                    data-testid={`inbox-packet-${packet.id}`}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      isDelivered
                        ? 'bg-emerald-950/20 border-emerald-500/30'
                        : 'bg-white/[0.03] border-white/10 opacity-75'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div>
                        <div className="text-[10px] font-mono text-emerald-400 font-bold uppercase">
                          FROM: {author}
                        </div>
                        <h4 className="text-xs font-bold text-white">{packet.title}</h4>
                      </div>

                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                          isDelivered
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                            : 'bg-amber-950 text-amber-300 border border-amber-500/40'
                        }`}
                      >
                        {isDelivered ? 'RECEIVED' : `IN FLIGHT (${formatRemainingSeconds(remainingMs)})`}
                      </span>
                    </div>

                    {!isDelivered ? (
                      <div className="w-full bg-black/60 rounded-full h-1.5 overflow-hidden my-2 border border-white/10">
                        <div
                          className="bg-emerald-400 h-full transition-all duration-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    ) : (
                      <p className="text-xs text-slate-200 mt-2 p-2.5 rounded-xl bg-black/40 border border-white/5 leading-relaxed font-sans">
                        &ldquo;{message}&rdquo;
                      </p>
                    )}

                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mt-2 pt-1 border-t border-white/5">
                      <span>Sent from Earth: {new Date(packet.sentAt).toLocaleTimeString()}</span>
                      <span>Arrived at Ship: {new Date(packet.arrivalAt).toLocaleTimeString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>
      </div>

      {/* SBAR Packet Modal Viewer */}
      {selectedSbarPacket && (
        <div
          data-testid="sbar-packet-modal"
          className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4 overflow-y-auto"
        >
          <div className="max-w-2xl w-full p-6 rounded-3xl bg-[#120204] border-2 border-red-500/60 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-red-500/30 pb-3">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-red-400" />
                <h3 className="text-base font-black text-white font-mono uppercase">
                  {selectedSbarPacket.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSbarPacket(null)}
                className="text-slate-400 hover:text-white font-mono font-bold text-sm px-2 py-1 rounded-lg bg-white/10"
              >
                ✕ CLOSE
              </button>
            </div>

            <pre className="p-4 rounded-xl bg-black/80 border border-red-500/30 text-[11px] font-mono text-red-100 overflow-x-auto max-h-[350px] whitespace-pre-wrap leading-relaxed">
              {JSON.stringify(selectedSbarPacket.payload, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
