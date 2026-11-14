import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Monitor,
  Send,
  Users,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  FileText,
  Activity,
  Split,
  Zap,
  ShieldAlert,
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
import { db, type CrewMember, type GroundPacket, type HealthReading } from '../data/db';
import { GlassCard } from '../design/components/GlassCard';
import { BigButton } from '../design/components/BigButton';
import { formatCommDelay } from '../config/environments';
import {
  calculatePacketProgress,
  checkAndDeliverPackets,
  computeEffectiveDelayMs,
  formatRemainingSeconds,
  getGroundBroadcastChannel,
  transmitUplinkReply,
} from '../features/groundlink/groundLinkService';

export interface GroundConsoleViewProps {
  isSplitView?: boolean;
}

export const GroundConsoleView: React.FC<GroundConsoleViewProps> = ({ isSplitView = false }) => {
  const [crewMembers, setCrewMembers] = useState<CrewMember[]>([]);
  const [selectedCrewId, setSelectedCrewId] = useState<number | null>(null);
  const [packets, setPackets] = useState<GroundPacket[]>([]);
  const [readings, setReadings] = useState<HealthReading[]>([]);
  const [now, setNow] = useState<number>(Date.now());
  const [oneWayDelaySec, setOneWayDelaySec] = useState<number>(846); // 14m 06s default (Ares transit)
  const [timeCompression, setTimeCompression] = useState<boolean>(true);
  const [selectedPacketType, setSelectedPacketType] = useState<'ALL' | 'INCIDENT' | 'ALERT' | 'SUMMARY'>('ALL');
  const [activeChartIndicator, setActiveChartIndicator] = useState<'heart_rate' | 'blood_pressure' | 'spo2' | 'sleep'>('heart_rate');
  const [replyText, setReplyText] = useState('');
  const [replyPriority, setReplyPriority] = useState<GroundPacket['priority']>('NORMAL');
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [selectedSbarPacket, setSelectedSbarPacket] = useState<GroundPacket | null>(null);

  // Load mission config from Dexie
  const loadMissionConfig = useCallback(async () => {
    try {
      const cfg = await db.missionConfig.get('current');
      if (cfg) {
        setOneWayDelaySec(cfg.oneWayDelaySeconds || 846);
        setTimeCompression(cfg.timeCompression ?? true);
      }
    } catch {
      // fallback to default
    }
  }, []);

  // Load crew members
  const loadCrew = useCallback(async () => {
    try {
      const members = await db.crewMembers.toArray();
      setCrewMembers(members);
      if (members.length > 0 && selectedCrewId === null) {
        setSelectedCrewId(members[0].id || 1);
      }
    } catch {
      // ignore
    }
  }, [selectedCrewId]);

  // Load packets from Dexie
  const loadPackets = useCallback(async () => {
    try {
      const all = await db.groundPackets.toArray();
      setPackets(all.sort((a, b) => b.sentAt - a.sentAt));
    } catch {
      // ignore
    }
  }, []);

  // Load historical health readings for the selected crew member
  const loadReadings = useCallback(async () => {
    if (!selectedCrewId) return;
    try {
      const r = await db.healthReadings
        .where('crewMemberId')
        .equals(selectedCrewId)
        .toArray();
      setReadings(r.sort((a, b) => a.missionDay - b.missionDay || a.timestamp - b.timestamp));
    } catch {
      // ignore
    }
  }, [selectedCrewId]);

  // Initial load
  useEffect(() => {
    void loadMissionConfig();
    void loadCrew();
    void loadPackets();
  }, [loadMissionConfig, loadCrew, loadPackets]);

  useEffect(() => {
    void loadReadings();
  }, [loadReadings]);

  // Tick clock every second and check timestamp delivery per §7.12 (v3)
  useEffect(() => {
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

    const handleMessage = async () => {
      await loadPackets();
      await loadReadings();
      await checkAndDeliverPackets();
    };

    channel.addEventListener('message', handleMessage);
    return () => {
      channel.removeEventListener('message', handleMessage);
    };
  }, [loadPackets, loadReadings]);

  // Toggle Time Compression
  const handleToggleCompression = async () => {
    const nextVal = !timeCompression;
    setTimeCompression(nextVal);
    try {
      const cfg = await db.missionConfig.get('current');
      if (cfg) {
        await db.missionConfig.update('current', { timeCompression: nextVal });
      }
    } catch {
      // ignore
    }
  };

  // Transmit Flight Surgeon Reply (Earth -> Ship)
  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || isSendingReply) return;

    try {
      setIsSendingReply(true);
      await transmitUplinkReply({
        title: 'Flight Surgeon Clinical Advisory',
        message: replyText.trim(),
        author: 'Dr. Evelyn Reed (Flight Surgeon, NASA JSC)',
        oneWayDelaySeconds: oneWayDelaySec,
        timeCompression,
        priority: replyPriority,
      });

      setReplyText('');
      await loadPackets();
    } finally {
      setIsSendingReply(false);
    }
  };

  // Quick preset replies
  const handlePresetReply = (preset: string, priority: GroundPacket['priority'] = 'NORMAL') => {
    setReplyText(preset);
    setReplyPriority(priority);
  };

  // Filtered packets
  const downlinkPackets = useMemo(
    () => packets.filter((p) => p.direction === 'downlink'),
    [packets]
  );
  const uplinkPackets = useMemo(
    () => packets.filter((p) => p.direction === 'uplink'),
    [packets]
  );

  const inFlightDownlinks = useMemo(
    () => downlinkPackets.filter((p) => !p.delivered),
    [downlinkPackets]
  );
  const deliveredDownlinks = useMemo(
    () =>
      downlinkPackets
        .filter((p) => p.delivered)
        .filter((p) => {
          if (selectedPacketType === 'ALL') return true;
          return p.type === selectedPacketType;
        }),
    [downlinkPackets, selectedPacketType]
  );

  const inFlightUplinks = useMemo(
    () => uplinkPackets.filter((p) => !p.delivered),
    [uplinkPackets]
  );

  // Active in-flight packet for orbital arc animation
  const primaryInFlight = inFlightDownlinks[0] || inFlightUplinks[0];
  const arcProgress = primaryInFlight
    ? calculatePacketProgress(primaryInFlight.sentAt, primaryInFlight.arrivalAt, now)
    : 0;

  const effectiveDelayMs = computeEffectiveDelayMs(oneWayDelaySec, timeCompression);
  const effectiveDelaySec = Math.round(effectiveDelayMs / 1000);
  const delayDisplay = formatCommDelay(oneWayDelaySec);

  // Selected crew member object
  const selectedCrew = crewMembers.find((c) => c.id === selectedCrewId) || crewMembers[0];

  // Prepare chart data for selected crew member
  const chartData = useMemo(() => {
    const filtered = readings.filter((r) => r.indicator === activeChartIndicator);
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
        status: r.status,
        timestamp: r.timestamp,
      };
    });
  }, [readings, activeChartIndicator]);

  return (
    <div
      className={`max-w-6xl mx-auto space-y-6 animate-fade-in ${isSplitView ? 'p-2 text-xs' : 'p-4 sm:p-6'}`}
      data-testid="ground-console-view"
    >
      {/* Flight Surgeon Mission Control Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-blue-950/60 via-slate-900/60 to-cyan-950/40 border border-blue-500/30 backdrop-blur-xl shadow-2xl">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Monitor size={18} className="text-blue-400" />
            <span className="text-xs font-mono tracking-widest text-blue-300 uppercase font-bold">
              NASA JSC · FLIGHT SURGEON CONSOLE (EARTH)
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-blue-500/20 text-blue-300 border border-blue-400/30">
              §7.12
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
            Earth Ground Operations Console
          </h1>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            Deep-space clinical telemetry and advisory uplink. Speed-of-light propagation via BroadcastChannel (&lsquo;halo-downlink&rsquo;).
          </p>
        </div>

        {/* Right Header Status / Links */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="px-3.5 py-2 rounded-2xl bg-blue-950/70 border border-blue-400/40 text-right font-mono">
            <div className="text-[10px] text-slate-400 uppercase">Speed-of-Light Comm Delay</div>
            <div className="text-blue-300 font-bold text-base leading-none mt-0.5">{delayDisplay}</div>
            {timeCompression && (
              <div className="text-[10px] text-amber-300 font-semibold mt-0.5">
                Compressed: {effectiveDelaySec} s demo
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleToggleCompression}
            data-testid="toggle-time-compression-btn"
            className={`px-3 py-2 rounded-xl border text-xs font-mono font-semibold transition-all flex items-center gap-1.5 ${
              timeCompression
                ? 'bg-amber-500/20 border-amber-400/50 text-amber-200'
                : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
            }`}
            title="Toggle 1 min delay = 2 s real time demo compression"
          >
            <Zap size={14} className={timeCompression ? 'text-amber-400 fill-amber-400' : 'text-slate-400'} />
            <span>{timeCompression ? '30x Demo Speed' : 'Real-Time'}</span>
          </button>

          {!isSplitView && (
            <a
              href="/split"
              className="px-3 py-2 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 border border-purple-400/40 text-purple-200 text-xs font-mono font-bold flex items-center gap-1.5 transition-all"
              title="Open dual Ship & Ground split screen"
            >
              <Split size={14} />
              <span>Split View</span>
            </a>
          )}
        </div>
      </div>

      {/* Earth <-> Ship Orbital Arc Visualization (§7.12) */}
      <GlassCard variant="default" padded="md" className="space-y-3 bg-black/40 border-blue-500/20">
        <div className="flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-400 shadow-[0_0_8px_#60a5fa]" />
            <span className="text-blue-200 font-bold">EARTH · NASA JSC</span>
          </div>
          <div className="text-slate-400 text-[11px]">
            {primaryInFlight ? (
              <span className="text-cyan-300 font-semibold">
                In Transit ({primaryInFlight.direction === 'downlink' ? 'Downlink Ship → Earth' : 'Uplink Earth → Ship'}):{' '}
                {formatRemainingSeconds(primaryInFlight.arrivalAt - now)} remaining ({arcProgress}%)
              </span>
            ) : (
              <span>Orbital Comm Link Idle · Ready for Transmissions</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-cyan-200 font-bold">ARES VEHICLE · TRANSIT</span>
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
          </div>
        </div>

        {/* SVG Orbital Arc */}
        <div className="relative h-20 w-full overflow-hidden rounded-2xl bg-gradient-to-b from-blue-950/20 to-black/60 border border-white/5">
          <svg className="w-full h-full" viewBox="0 0 1000 80" preserveAspectRatio="none">
            <defs>
              <linearGradient id="groundArcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
                <stop offset="50%" stopColor="#38e1ff" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.4" />
              </linearGradient>
            </defs>

            {/* Arc Curve */}
            <path
              d="M 40,65 Q 500,5 960,65"
              fill="none"
              stroke="url(#groundArcGrad)"
              strokeWidth="2.5"
              strokeDasharray="6,4"
            />

            {/* Earth Station Node */}
            <circle cx="40" cy="65" r="9" fill="#1e3a8a" stroke="#60a5fa" strokeWidth="2.5" />
            <circle cx="40" cy="65" r="4" fill="#93c5fd" />

            {/* Ares Ship Node */}
            <circle cx="960" cy="65" r="9" fill="#083344" stroke="#22d3ee" strokeWidth="2.5" />
            <circle cx="960" cy="65" r="4" fill="#67e8f9" />

            {/* In-Flight Packet Dot */}
            {primaryInFlight && (
              <g
                style={{
                  transform: `translate(${
                    primaryInFlight.direction === 'downlink'
                      ? 960 - (arcProgress / 100) * 920
                      : 40 + (arcProgress / 100) * 920
                  }px, ${
                    65 - Math.sin((arcProgress / 100) * Math.PI) * 50
                  }px)`,
                  transition: 'transform 1s linear',
                }}
              >
                <circle cx="0" cy="0" r="10" fill="#38e1ff" opacity="0.3" className="animate-ping" />
                <circle cx="0" cy="0" r="6" fill="#38e1ff" stroke="#ffffff" strokeWidth="2" />
              </g>
            )}
          </svg>
        </div>
      </GlassCard>

      {/* Main Grid: Crew Telemetry & Packets */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Expedition Crew Roster */}
        <div className="lg:col-span-4 space-y-4">
          <GlassCard variant="default" padded="md" className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Users size={15} className="text-cyan-400" />
                Expedition Crew Roster (4)
              </span>
              <span className="text-[10px] font-mono text-cyan-300">MET DAY 142</span>
            </div>

            <div className="space-y-2">
              {crewMembers.map((member) => {
                const isSelected = selectedCrewId === member.id;
                // Highlight flags for demo crew
                const isAlex = member.name.includes('Alex');
                const isSarah = member.name.includes('Sarah');

                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => setSelectedCrewId(member.id || 1)}
                    className={`w-full text-left p-3 rounded-2xl border transition-all ${
                      isSelected
                        ? 'bg-blue-600/20 border-cyan-400/60 shadow-[0_0_15px_rgba(56,225,255,0.15)]'
                        : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/15'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">{member.name}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                        {member.role || 'Crew'}
                      </span>
                    </div>

                    <div className="text-[11px] font-mono text-slate-300 mt-1">
                      {isAlex ? (
                        <span className="text-amber-300">ALERT: Sleep 5.4h · PVT Slow · BP 138/88</span>
                      ) : isSarah ? (
                        <span className="text-emerald-400">NOMINAL: HR 62 · BP 114/74 · SpO₂ 99%</span>
                      ) : (
                        <span className="text-slate-400">NOMINAL: Telemetry synched</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mt-1.5 pt-1 border-t border-white/5">
                      <span>Age {member.age || 38} · {member.sex || 'M'}</span>
                      <span className={isSelected ? 'text-cyan-300 font-bold' : 'text-slate-500'}>
                        {isSelected ? 'Viewing Telemetry' : 'Select'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </GlassCard>

          {/* Quick Stats on Selected Crew */}
          {selectedCrew && (
            <GlassCard variant="default" padded="md" className="space-y-2 bg-slate-900/40">
              <div className="text-xs font-bold text-slate-200">Patient File: {selectedCrew.name}</div>
              <div className="text-[11px] text-slate-400 space-y-1">
                <div>Mission Environment: Deep Space Transit (0 g, 1.8 mSv/day)</div>
                <div>Downlink Channel: Verified BroadcastChannel (&lsquo;halo-downlink&rsquo;)</div>
                <div>Clinical Protocol: Autonomous Level 3 (Delay &gt; 5 min)</div>
              </div>
            </GlassCard>
          )}
        </div>

        {/* Right Column: Telemetry Charts & Downlink Queue */}
        <div className="lg:col-span-8 space-y-6">
          {/* Flight Surgeon Vitals Telemetry Chart */}
          <GlassCard variant="default" padded="md" className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-white/10">
              <div>
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Activity size={15} className="text-cyan-400" />
                  Telemetry Trends · {selectedCrew?.name || 'Selected Crew'}
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  MET Days 120–142 Clinical Telemetry
                </span>
              </div>

              {/* Indicator Switcher */}
              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActiveChartIndicator('heart_rate')}
                  className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition-all ${
                    activeChartIndicator === 'heart_rate'
                      ? 'bg-cyan-500/30 text-cyan-200 border border-cyan-400/50'
                      : 'bg-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  Heart Rate
                </button>
                <button
                  type="button"
                  onClick={() => setActiveChartIndicator('blood_pressure')}
                  className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition-all ${
                    activeChartIndicator === 'blood_pressure'
                      ? 'bg-cyan-500/30 text-cyan-200 border border-cyan-400/50'
                      : 'bg-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  Blood Pressure
                </button>
                <button
                  type="button"
                  onClick={() => setActiveChartIndicator('spo2')}
                  className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition-all ${
                    activeChartIndicator === 'spo2'
                      ? 'bg-cyan-500/30 text-cyan-200 border border-cyan-400/50'
                      : 'bg-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  SpO₂
                </button>
                <button
                  type="button"
                  onClick={() => setActiveChartIndicator('sleep')}
                  className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition-all ${
                    activeChartIndicator === 'sleep'
                      ? 'bg-cyan-500/30 text-cyan-200 border border-cyan-400/50'
                      : 'bg-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  Sleep
                </button>
              </div>
            </div>

            {/* Recharts Telemetry Line Chart */}
            <div className="h-52 w-full pt-2">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis
                      dataKey="missionDay"
                      stroke="#64748b"
                      fontSize={10}
                      tickLine={false}
                      tickFormatter={(val) => `D${val}`}
                    />
                    <YAxis stroke="#64748b" fontSize={10} tickLine={false} domain={['auto', 'auto']} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0a101f',
                        border: '1px solid rgba(56,225,255,0.3)',
                        borderRadius: '0.75rem',
                        fontSize: '11px',
                        fontFamily: 'monospace',
                        color: '#ffffff',
                      }}
                    />
                    {/* Clinical Reference nominal bands */}
                    {activeChartIndicator === 'heart_rate' && (
                      <ReferenceArea y1={50} y2={100} fill="#22c55e" fillOpacity={0.06} />
                    )}
                    {activeChartIndicator === 'spo2' && (
                      <ReferenceArea y1={95} y2={100} fill="#22c55e" fillOpacity={0.06} />
                    )}
                    {activeChartIndicator === 'sleep' && (
                      <ReferenceArea y1={7} y2={10} fill="#22c55e" fillOpacity={0.06} />
                    )}

                    <Line
                      type="monotone"
                      dataKey="value"
                      name={activeChartIndicator}
                      stroke="#38e1ff"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#38e1ff' }}
                      activeDot={{ r: 5, stroke: '#ffffff', strokeWidth: 2 }}
                    />
                    {activeChartIndicator === 'blood_pressure' && (
                      <Line
                        type="monotone"
                        dataKey="valueSecondary"
                        name="diastolic"
                        stroke="#60a5fa"
                        strokeWidth={1.5}
                        strokeDasharray="4 4"
                        dot={{ r: 2.5, fill: '#60a5fa' }}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 font-mono text-xs">
                  <span>No readings recorded for {activeChartIndicator}</span>
                </div>
              )}
            </div>
          </GlassCard>

          {/* Incoming Downlink Packets (Ship -> Earth) */}
          <GlassCard variant="default" padded="md" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <ArrowDownLeft size={16} className="text-blue-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Downlinked Telemetry Queue (Ship → Earth)
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300">
                  {deliveredDownlinks.length} Delivered
                </span>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1 text-[10px] font-mono">
                {(['ALL', 'INCIDENT', 'ALERT', 'SUMMARY'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSelectedPacketType(t)}
                    className={`px-2 py-1 rounded-md transition-all ${
                      selectedPacketType === t
                        ? 'bg-blue-600 text-white font-bold'
                        : 'bg-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* In-Flight Downlink Packets Section */}
            {inFlightDownlinks.length > 0 && (
              <div className="space-y-2 p-3 rounded-2xl bg-cyan-950/20 border border-cyan-500/30">
                <div className="text-[11px] font-bold text-cyan-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Clock size={13} className="animate-spin text-cyan-400" />
                    In-Flight Transmissions Through Deep Space ({inFlightDownlinks.length})
                  </span>
                  <span className="text-[10px] font-mono text-cyan-400">
                    Speed of light delay: {delayDisplay}
                  </span>
                </div>

                {inFlightDownlinks.map((p) => {
                  const progress = calculatePacketProgress(p.sentAt, p.arrivalAt, now);
                  const remainingMs = p.arrivalAt - now;
                  return (
                    <div key={p.id} className="p-2.5 rounded-xl bg-black/40 border border-cyan-500/20 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-white">{p.title}</span>
                        <span className="text-[10px] font-mono text-cyan-300">
                          {formatRemainingSeconds(remainingMs)} remaining ({progress}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full bg-cyan-400 rounded-full transition-all duration-1000"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Delivered Packets List */}
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {deliveredDownlinks.length === 0 ? (
                <div className="p-6 text-center text-slate-500 font-mono text-xs">
                  No delivered packets match the current filter.
                </div>
              ) : (
                deliveredDownlinks.map((pkt) => {
                  const isIncident = pkt.type === 'INCIDENT';
                  const isAlert = pkt.type === 'ALERT';

                  return (
                    <div
                      key={pkt.id}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        isIncident
                          ? 'bg-red-950/20 border-red-500/40'
                          : isAlert
                          ? 'bg-amber-950/20 border-amber-500/40'
                          : 'bg-white/[0.02] border-white/10'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                        <div className="flex items-center gap-2">
                          {isIncident ? (
                            <AlertOctagon size={15} className="text-red-400 shrink-0" />
                          ) : isAlert ? (
                            <AlertTriangle size={15} className="text-amber-400 shrink-0" />
                          ) : (
                            <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                          )}
                          <span className="font-bold text-white">{pkt.title}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[9px] font-mono px-2 py-0.5 rounded-full border ${
                              pkt.priority === 'HIGH'
                                ? 'bg-red-500/20 border-red-400/40 text-red-300'
                                : 'bg-slate-800 border-slate-700 text-slate-300'
                            }`}
                          >
                            {pkt.priority}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            Sent {new Date(pkt.sentAt).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>

                      {/* Summary or SBAR quick preview */}
                      <div className="mt-2 text-xs text-slate-300 leading-relaxed font-mono">
                        {isIncident && (
                          <div className="text-red-200">
                            Emergency Incident Report generated per HALO §7.11 SBAR clinical handover.
                          </div>
                        )}
                        {typeof pkt.payload?.summary === 'string' && (
                          <div className="text-slate-300 mt-1">{pkt.payload.summary}</div>
                        )}
                        {typeof pkt.payload?.note === 'string' && (
                          <div className="text-slate-400 mt-1 text-[11px]">{pkt.payload.note}</div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="mt-3 pt-2 border-t border-white/5 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[10px] font-mono text-emerald-400">
                          ✓ Delivered via Speed-of-Light Downlink
                        </span>

                        <div className="flex items-center gap-2">
                          {isIncident && (
                            <button
                              type="button"
                              onClick={() => setSelectedSbarPacket(pkt)}
                              className="px-2.5 py-1 rounded-lg bg-red-600/30 hover:bg-red-600/50 border border-red-400/50 text-red-200 text-[11px] font-mono font-bold flex items-center gap-1"
                            >
                              <FileText size={12} />
                              <span>Inspect SBAR Report</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setReplyText(`Acknowledging packet #${pkt.id}: ${pkt.title}. Follow standard protocol.`);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-[11px] font-mono"
                          >
                            Reply to Packet
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </GlassCard>

          {/* Flight Surgeon Reply Box (Earth -> Ship Uplink) */}
          <GlassCard variant="default" padded="md" className="space-y-4 border-blue-500/30 bg-blue-950/10">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <ArrowUpRight size={15} className="text-cyan-400" />
                Transmit Clinical Advisory &amp; Directive (Earth → Ship)
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                Uplink Propagation Delay: {delayDisplay}
              </span>
            </div>

            {/* Quick Clinical Presets */}
            <div className="space-y-1.5">
              <div className="text-[10px] font-mono text-slate-400 uppercase">Flight Surgeon Protocol Presets:</div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    handlePresetReply(
                      'Acknowledge SBAR Incident: Administer supplemental O2 per checklist. Maintain bed rest; re-check vitals Q15M.',
                      'HIGH'
                    )
                  }
                  className="px-2.5 py-1 rounded-lg bg-red-950/40 hover:bg-red-900/50 border border-red-500/30 text-red-200 text-[10px] font-mono transition-all text-left"
                >
                  Emergency Directive: O2 &amp; Vitals Q15M
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handlePresetReply(
                      'Clinical Advisory: Sleep debt and PVT lapse confirmed. Prescribe 0.5 mg melatonin, enforce 8-hour crew rest cycle.',
                      'NORMAL'
                    )
                  }
                  className="px-2.5 py-1 rounded-lg bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-500/30 text-cyan-200 text-[10px] font-mono transition-all text-left"
                >
                  Advisory: Melatonin &amp; Sleep Hygiene
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handlePresetReply(
                      'Vision Alert: Right-eye central distortion noted. Schedule onboard fundoscopy / OCT exam within 24 hours.',
                      'HIGH'
                    )
                  }
                  className="px-2.5 py-1 rounded-lg bg-amber-950/40 hover:bg-amber-900/50 border border-amber-500/30 text-amber-200 text-[10px] font-mono transition-all text-left"
                >
                  Directive: Onboard Fundoscopy Exam
                </button>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSendReply} className="space-y-3">
              <textarea
                rows={3}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type flight surgeon clinical directive, medication advice or protocol order to transmit to the deep space crew..."
                className="w-full p-3 rounded-2xl bg-black/50 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 resize-none font-mono"
              />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-mono text-slate-400">Priority:</span>
                  <label className="flex items-center gap-1 text-xs text-slate-300 font-mono cursor-pointer">
                    <input
                      type="radio"
                      name="priority"
                      checked={replyPriority === 'NORMAL'}
                      onChange={() => setReplyPriority('NORMAL')}
                      className="accent-cyan-400"
                    />
                    <span>NORMAL</span>
                  </label>
                  <label className="flex items-center gap-1 text-xs text-red-300 font-mono cursor-pointer">
                    <input
                      type="radio"
                      name="priority"
                      checked={replyPriority === 'HIGH'}
                      onChange={() => setReplyPriority('HIGH')}
                      className="accent-red-400"
                    />
                    <span>HIGH</span>
                  </label>
                </div>

                <BigButton
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={!replyText.trim() || isSendingReply}
                  icon={<Send size={15} />}
                  data-testid="transmit-uplink-directive-btn"
                >
                  {isSendingReply ? 'Transmitting to DSN...' : 'Transmit Uplink Directive'}
                </BigButton>
              </div>
            </form>

            {/* In-Flight Uplink Packets Section */}
            {inFlightUplinks.length > 0 && (
              <div className="mt-3 p-3 rounded-2xl bg-blue-950/30 border border-blue-500/30 space-y-2">
                <div className="text-[11px] font-bold text-blue-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Clock size={13} className="animate-spin text-blue-400" />
                    Uplink In Transit to Ship ({inFlightUplinks.length})
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    Will land in Astronaut Inbox on arrival
                  </span>
                </div>

                {inFlightUplinks.map((p) => {
                  const progress = calculatePacketProgress(p.sentAt, p.arrivalAt, now);
                  const remainingMs = p.arrivalAt - now;
                  return (
                    <div key={p.id} className="p-2.5 rounded-xl bg-black/40 border border-blue-500/20 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-white">{p.title}</span>
                        <span className="text-[10px] font-mono text-blue-300">
                          {formatRemainingSeconds(remainingMs)} remaining ({progress}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full bg-blue-400 rounded-full transition-all duration-1000"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </GlassCard>
        </div>
      </div>

      {/* SBAR Incident Report Inspection Modal */}
      {selectedSbarPacket && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-2xl w-full max-h-[85vh] overflow-y-auto rounded-3xl bg-[#090d16] border border-red-500/40 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <ShieldAlert size={18} className="text-red-400" />
                <h3 className="text-base font-bold text-white font-mono uppercase">
                  SBAR Clinical Handover Report (Earth Inspection)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSbarPacket(null)}
                className="text-slate-400 hover:text-white font-mono text-sm px-2 py-1 rounded-lg bg-white/5"
              >
                ✕ Close
              </button>
            </div>

            <div className="space-y-4 text-xs font-mono">
              {/* Situation */}
              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/10 space-y-1">
                <div className="text-red-300 font-bold uppercase tracking-wider text-[11px]">S — Situation</div>
                <div className="text-slate-200">
                  {String(
                    (selectedSbarPacket.payload?.sbar as { situation?: { summary?: string } })?.situation?.summary ||
                      selectedSbarPacket.title
                  )}
                </div>
              </div>

              {/* Background */}
              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/10 space-y-1">
                <div className="text-amber-300 font-bold uppercase tracking-wider text-[11px]">B — Background</div>
                <div className="text-slate-300">
                  Patient baseline and history verified from onboard Dexie database.
                </div>
              </div>

              {/* Assessment */}
              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/10 space-y-1">
                <div className="text-cyan-300 font-bold uppercase tracking-wider text-[11px]">A — Assessment</div>
                <div className="text-slate-300">
                  Local HALO autonomous triage completed. Vitals captured and telemetry queued.
                </div>
              </div>

              {/* Request */}
              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/10 space-y-1">
                <div className="text-emerald-300 font-bold uppercase tracking-wider text-[11px]">R — Request</div>
                <div className="text-slate-300">
                  Flight surgeon review requested. Telemetry link subject to speed-of-light delay ({delayDisplay}).
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <BigButton
                variant="primary"
                size="md"
                onClick={() => {
                  setReplyText(
                    `Acknowledge SBAR incident report for ${selectedSbarPacket.title}. Proceed with IV support and bed rest; keep telemetry active.`
                  );
                  setSelectedSbarPacket(null);
                }}
              >
                Pre-fill Directive in Reply Box
              </BigButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
