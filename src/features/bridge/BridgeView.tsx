import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  Camera,
  CheckCircle2,
  Inbox,
  Radiation,
  Radio,
  RotateCw,
  ShieldAlert,
  Sparkles,
  X,
  Play,
} from 'lucide-react';
import { useMission } from '../../app/MissionContext';
import { useJudgeTour } from '../judge/JudgeContext';
import { formatCommDelay } from '../../config/environments';
import { classifyRadiation, maxStatus } from '../../config/thresholds';
import {
  db,
  type HealthReading,
  type HealthStatus,
  type IncidentReport,
  type PersonalBaseline,
  type ScheduledTask,
} from '../../data/db';
import { BigButton } from '../../design/components/BigButton';
import { GlassCard } from '../../design/components/GlassCard';
import { ReadinessRing } from '../../design/components/ReadinessRing';
import { StatusBadge } from '../../design/components/StatusBadge';
import { computeAdherenceMetrics } from '../../engine/gamification';
import { computeReadinessFromReadings } from '../../engine/readiness';
import {
  getEffectiveTaskStatus,
  selectOrbitRingTasks,
  sendLocalNotificationIfPermitted,
  syncCrewRoutineTasks,
  type ScheduledTaskType,
} from '../../engine/scheduler';
import { DigitalTwinSvg } from './DigitalTwinSvg';
import {
  CAREER_RADIATION_LIMIT_MSV,
  buildDigitalTwinTelemetry,
  type BodySystemId,
} from './digitalTwin';
import { OrbitRing } from './OrbitRing';
import { RegionSideSheet } from './RegionSideSheet';
import { SpeShelterOverlay } from './SpeShelterOverlay';

const STARFIELD_COORDS = [
  { top: '8%', left: '12%', delay: '0s' },
  { top: '22%', left: '82%', delay: '1.1s' },
  { top: '42%', left: '26%', delay: '2.4s' },
  { top: '58%', left: '72%', delay: '0.7s' },
  { top: '76%', left: '18%', delay: '1.8s' },
  { top: '16%', left: '58%', delay: '2.9s' },
  { top: '69%', left: '88%', delay: '1.4s' },
  { top: '89%', left: '49%', delay: '0.4s' },
];

export const BridgeView: React.FC = () => {
  const {
    crew,
    config,
    environment,
    autonomyLevel,
    unreadGroundCount,
    isLoading: isMissionLoading,
    loadDemo,
    refreshMission,
  } = useMission();
  const { startTour, isTourActive, currentStepIndex } = useJudgeTour();

  // Telemetry state loaded from Dexie
  const [readings, setReadings] = useState<HealthReading[]>([]);
  const [baselines, setBaselines] = useState<PersonalBaseline[]>([]);
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [speIncidents, setSpeIncidents] = useState<IncidentReport[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Digital Twin side sheet state
  const [selectedRegionId, setSelectedRegionId] = useState<BodySystemId | null>(null);

  // Radiation manual dosimeter override & SPE shelter alert state
  const [showDosimeterInput, setShowDosimeterInput] = useState(false);
  const [dosimeterInput, setDosimeterInput] = useState('');
  const [dosimeterError, setDosimeterError] = useState('');
  const [speAlertOpen, setSpeAlertOpen] = useState(false);
  const [speStartedAt, setSpeStartedAt] = useState<number | null>(null);
  const [scheduledSpeCountdownSec, setScheduledSpeCountdownSec] = useState<number | null>(null);
  const radiationPanelRef = useRef<HTMLDivElement | null>(null);

  // In-app reminder toast banner
  const [reminderToast, setReminderToast] = useState<{
    title: string;
    message: string;
  } | null>(null);
  const autoReminderShownRef = useRef(false);
  const loadSeqRef = useRef(0);

  const missionDay = Math.max(1, config?.missionDay ?? 1);
  const delaySeconds = config?.oneWayDelaySeconds ?? environment.defaultDelaySeconds;
  const delayStr = formatCommDelay(delaySeconds);

  const loadBridgeTelemetry = useCallback(async () => {
    const seq = ++loadSeqRef.current;

    if (isMissionLoading) {
      setIsLoadingData(true);
      return;
    }

    if (!crew?.id || !config) {
      if (seq !== loadSeqRef.current) return;
      setReadings([]);
      setBaselines([]);
      setTasks([]);
      setSpeIncidents([]);
      setIsLoadingData(false);
      return;
    }

    setIsLoadingData(true);
    setLoadError('');

    try {
      const syncedTasks = await syncCrewRoutineTasks(crew.id, missionDay, environment);
      const [crewReadings, crewBaselines, stormIncidents] = await Promise.all([
        db.healthReadings.where('crewMemberId').equals(crew.id).toArray(),
        db.baselines.where('crewMemberId').equals(crew.id).toArray(),
        db.incidentReports
          .where('emergencyType')
          .equals('SOLAR_STORM')
          .reverse()
          .toArray(),
      ]);

      if (seq !== loadSeqRef.current) return;
      setTasks(syncedTasks);
      setReadings(crewReadings);
      setBaselines(crewBaselines);
      setSpeIncidents(stormIncidents);
    } catch (err) {
      if (seq !== loadSeqRef.current) return;
      console.error('Failed to load Bridge telemetry:', err);
      setLoadError('Unable to read mission telemetry from local IndexedDB.');
    } finally {
      if (seq === loadSeqRef.current) {
        setIsLoadingData(false);
      }
    }
  }, [isMissionLoading, crew?.id, config, environment, missionDay]);

  useEffect(() => {
    void loadBridgeTelemetry();
  }, [loadBridgeTelemetry]);

  // Scheduled demo SPE countdown timer
  useEffect(() => {
    if (scheduledSpeCountdownSec === null) return;
    if (scheduledSpeCountdownSec <= 0) {
      setScheduledSpeCountdownSec(null);
      setSpeStartedAt(Date.now());
      setSpeAlertOpen(true);
      return;
    }
    const timer = window.setTimeout(() => {
      setScheduledSpeCountdownSec((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [scheduledSpeCountdownSec]);

  // Live Digital Twin & Radiation computation via HALO rules engine
  const twin = useMemo(
    () =>
      buildDigitalTwinTelemetry({
        crew,
        readings,
        baselines,
        tasks,
        config,
        environment,
      }),
    [baselines, config, crew, environment, readings, tasks]
  );

  // Overdue checks & Orbit Ring selection
  const overdueTasks = useMemo(
    () => tasks.filter((t) => getEffectiveTaskStatus(t, missionDay) === 'overdue'),
    [missionDay, tasks]
  );

  const orbitRingTasks = useMemo(
    () => selectOrbitRingTasks(tasks, missionDay),
    [missionDay, tasks]
  );

  // Readiness Score & itemized deductions per §7.9
  const readiness = useMemo(
    () =>
      computeReadinessFromReadings(
        twin.allLatestReadings,
        overdueTasks.map((t) => ({ title: t.title, dueDay: t.dueDay }))
      ),
    [overdueTasks, twin.allLatestReadings]
  );

  // Adherence XP & daily "orbit" streak ONLY per Phase 5 scope (§7.10 trimmed per §7.19)
  const adherence = useMemo(
    () => computeAdherenceMetrics(tasks, missionDay, config?.missionStartDate),
    [config?.missionStartDate, missionDay, tasks]
  );

  // Overall system worst status for the Digital Twin panel badge
  const overallTwinStatus: HealthStatus = useMemo(() => {
    return twin.regionList.reduce<HealthStatus>(
      (worst, r) => (r.status ? maxStatus(worst, r.status) : worst),
      'NOMINAL'
    );
  }, [twin.regionList]);

  const selectedRegion = selectedRegionId ? twin.regions[selectedRegionId] : null;

  // Trigger in-app overdue reminder once cleanly on load if overdue checks exist
  useEffect(() => {
    if (isLoadingData || autoReminderShownRef.current) return;
    if (overdueTasks.length > 0) {
      autoReminderShownRef.current = true;
      setReminderToast({
        title: `${overdueTasks.length} Scheduled Check${overdueTasks.length > 1 ? 's' : ''} Overdue`,
        message: overdueTasks.map((t) => t.title).slice(0, 3).join(' · '),
      });
    }
  }, [isLoadingData, overdueTasks]);

  // Judge Mode Step 2 animation: readiness ring animates from day 110 value (92) down to today's value
  const [animatedScore, setAnimatedScore] = useState<number | null>(null);

  useEffect(() => {
    if (isTourActive && currentStepIndex === 1) {
      // Step 2 is active: animate from 92 down to readiness.score
      setAnimatedScore(92);
      const timer = setTimeout(() => {
        setAnimatedScore(readiness.score);
      }, 700);
      return () => clearTimeout(timer);
    } else {
      setAnimatedScore(null);
    }
  }, [isTourActive, currentStepIndex, readiness.score]);

  // Judge Mode Step 3: open Eyes region side sheet
  useEffect(() => {
    if (isTourActive && currentStepIndex === 2) {
      setSelectedRegionId('eyes');
    } else if (isTourActive && currentStepIndex !== 2 && selectedRegionId === 'eyes') {
      setSelectedRegionId(null);
    }
  }, [isTourActive, currentStepIndex, selectedRegionId]);

  const handleManualReminder = useCallback(async () => {
    const dueOrOverdue = orbitRingTasks.filter(
      (t) => getEffectiveTaskStatus(t, missionDay) !== 'completed'
    );
    const title =
      dueOrOverdue.length > 0
        ? `HALO Check Reminder (${dueOrOverdue.length} due)`
        : 'All Scheduled Checks Complete';
    const message =
      dueOrOverdue.length > 0
        ? `Next due: ${dueOrOverdue.map((t) => t.title).slice(0, 3).join(', ')}`
        : `Day ${missionDay} schedule verified (${adherence.totalXp} XP).`;

    // Offline Notification API trigger (local-only, gracefully falls back to in-app toast)
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        try {
          await Notification.requestPermission();
        } catch {
          // ignore denied/unsupported contexts
        }
      }
      sendLocalNotificationIfPermitted(title, message);
    }

    setReminderToast({ title, message });
  }, [adherence.totalXp, missionDay, orbitRingTasks]);

  const handleToggleTaskComplete = useCallback(
    async (task: ScheduledTask) => {
      if (!task.id) return;
      const nextCompleted = task.status !== 'completed';
      await db.tasks.update(task.id, {
        status: nextCompleted ? 'completed' : task.dueDay < missionDay ? 'overdue' : 'pending',
        completedAt: nextCompleted ? Date.now() : undefined,
      });
      await loadBridgeTelemetry();
      await refreshMission();
    },
    [loadBridgeTelemetry, missionDay, refreshMission]
  );

  const handleAddTask = useCallback(
    async (
      title: string,
      taskType: ScheduledTaskType,
      frequency: ScheduledTask['frequency']
    ) => {
      if (!crew?.id) return;
      await db.tasks.add({
        crewMemberId: crew.id,
        taskType,
        title,
        frequency,
        dueDay: missionDay,
        status: 'pending',
        xpAwarded: 30,
      });
      await loadBridgeTelemetry();
      await refreshMission();
    },
    [crew?.id, loadBridgeTelemetry, missionDay, refreshMission]
  );

  const handleUpdateTask = useCallback(
    async (taskId: number, updates: Partial<ScheduledTask>) => {
      await db.tasks.update(taskId, updates);
      await loadBridgeTelemetry();
      await refreshMission();
    },
    [loadBridgeTelemetry, refreshMission]
  );

  const handleDeleteTask = useCallback(
    async (taskId: number) => {
      await db.tasks.delete(taskId);
      await loadBridgeTelemetry();
      await refreshMission();
    },
    [loadBridgeTelemetry, refreshMission]
  );

  const handleSaveDosimeterOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!crew?.id) return;
    const parsed = parseFloat(dosimeterInput);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 2000) {
      setDosimeterError('Enter a valid cumulative dosimeter value (0–2000 mSv).');
      return;
    }

    setDosimeterError('');
    const evalRad = classifyRadiation(parsed);
    await db.healthReadings.add({
      crewMemberId: crew.id,
      timestamp: Date.now(),
      missionDay,
      indicator: 'radiation',
      value: Math.round(parsed * 10) / 10,
      unit: 'mSv',
      status: evalRad.status,
      reasons: evalRad.reasons,
      source: 'manual',
      notes: 'personal_dosimeter_override',
    });

    if (config) {
      await db.missionConfig.update('current', {
        dosimeterDoseMsv: Math.round(parsed * 10) / 10,
        updatedAt: Date.now(),
      });
    }

    setShowDosimeterInput(false);
    setDosimeterInput('');
    await loadBridgeTelemetry();
    await refreshMission();
  };

  const handleClearDosimeterOverride = async () => {
    if (!crew?.id) return;
    const manualRads = readings.filter(
      (r) => r.indicator === 'radiation' && r.source === 'manual' && r.id
    );
    for (const r of manualRads) {
      if (r.id) await db.healthReadings.delete(r.id);
    }
    if (config) {
      await db.missionConfig.update('current', {
        dosimeterDoseMsv: 0,
        updatedAt: Date.now(),
      });
    }
    setShowDosimeterInput(false);
    await loadBridgeTelemetry();
    await refreshMission();
  };

  const handleConfirmSpeAllClear = async (durationSeconds: number, shelterNotes: string) => {
    const startMs = speStartedAt ?? Date.now() - durationSeconds * 1000;
    const nowMs = Date.now();
    await db.incidentReports.add({
      timestamp: nowMs,
      missionDay,
      emergencyType: 'SOLAR_STORM',
      summary: `SPE Shelter completed (${durationSeconds}s in shielded bay)${shelterNotes ? ` — ${shelterNotes}` : ''}`,
      timeline: [
        { time: startMs, event: 'Solar Particle Event shelter alarm activated' },
        { time: nowMs, event: `All-clear confirmed after ${durationSeconds} s` },
      ],
      vitalsCaptured: {
        durationSeconds,
        environmentId: environment.id,
        estimatedCumulativeMsv: twin.radiation.doseMsv,
        shelterNotes,
      },
      status: 'resolved',
    });

    setSpeAlertOpen(false);
    setSpeStartedAt(null);
    setReminderToast({
      title: 'SPE Shelter Incident Logged',
      message: `Recorded ${durationSeconds} s shelter protocol on Day ${missionDay}.`,
    });
    await loadBridgeTelemetry();
  };

  const isSimulatedMission = Boolean(config?.customNotes?.includes('SIMULATED'));

  const readinessBannerTone =
    readiness.band === 'GO'
      ? 'text-emerald-400 border-emerald-500/35 bg-emerald-500/10'
      : readiness.band === 'GO WITH CAUTION'
        ? 'text-amber-300 border-amber-500/40 bg-amber-500/10'
        : 'text-red-300 border-red-500/50 bg-red-500/15';

  const radBarColor =
    twin.radiation.status === 'CRITICAL'
      ? 'bg-red-500'
      : twin.radiation.status === 'ALERT'
        ? 'bg-orange-500'
        : twin.radiation.status === 'WATCH'
          ? 'bg-amber-400'
          : 'bg-gradient-to-r from-cyan-400 to-emerald-400';

  return (
    <div className="relative space-y-6 pb-8">
      {/* Subtle Animated Starfield Background (§4 — Bridge only) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
        {STARFIELD_COORDS.map((s, idx) => (
          <div
            key={idx}
            className="absolute w-1 h-1 bg-cyan-200/50 rounded-full star-point"
            style={{ top: s.top, left: s.left, animationDelay: s.delay }}
          />
        ))}
      </div>

      {/* Hero Header */}
      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-xl">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="text-xs font-mono tracking-widest text-cyan-300 uppercase">
              FLIGHT DECK · {environment.name.toUpperCase()}
            </span>
            {isSimulatedMission && (
              <span className="px-2 py-0.5 rounded bg-cyan-500/15 border border-cyan-400/35 text-[10px] font-mono text-cyan-200 uppercase">
                SIMULATED DATA
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Astronaut Health Co-Pilot Bridge
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            Live physiological Digital Twin, deterministic rules readiness, and orbit adherence for{' '}
            <strong className="text-white">{crew?.name || 'Assigned Crew'}</strong>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <BigButton
            variant="primary"
            size="md"
            icon={<Play size={16} className="text-slate-950 fill-slate-950" />}
            onClick={() => void startTour()}
            data-testid="bridge-watch-judge-tour-btn"
            className="shadow-[0_0_20px_rgba(115, 179, 231,0.4)]"
          >
            ▶ Watch HALO save a crew (90 s)
          </BigButton>

          <Link to="/scan">
            <BigButton variant="secondary" size="md" icon={<Camera size={18} />}>
              Camera Scan (rPPG)
            </BigButton>
          </Link>

          <BigButton
            variant="glass"
            size="md"
            icon={<Sparkles size={17} className="text-cyan-400" />}
            onClick={async () => {
              autoReminderShownRef.current = false;
              await loadDemo();
            }}
            data-testid="bridge-load-demo-btn"
          >
            {isSimulatedMission ? 'Reset Demo' : 'Load Demo'}
          </BigButton>
        </div>
      </div>

      {/* Autonomous Operations Banner (§5 & §7.2) */}
      {autonomyLevel === 'Autonomous' && (
        <div
          data-testid="autonomous-delay-banner"
          className="relative z-10 p-3.5 sm:p-4 rounded-2xl bg-orange-500/12 border border-orange-400/40 text-xs sm:text-sm text-orange-100 flex items-start gap-3"
        >
          <Radio size={18} className="text-orange-300 shrink-0 mt-0.5" />
          <div>
            <strong className="text-orange-200 uppercase font-mono text-xs block mb-0.5">
              Autonomous Operations ({delayStr} one-way delay)
            </strong>
            Ground cannot respond in time for emergencies ({delayStr} latency). Follow HALO guidance and your crew medical officer.
          </div>
        </div>
      )}

      {/* Error & Reminder Banners */}
      {loadError && (
        <div
          role="alert"
          className="relative z-10 p-4 rounded-2xl bg-red-500/10 border border-red-500/35 text-red-200 text-sm flex items-start gap-3"
        >
          <AlertTriangle size={18} className="shrink-0 mt-0.5 text-red-400" />
          <span>{loadError}</span>
        </div>
      )}

      {reminderToast && (
        <div
          data-testid="reminder-toast"
          role="status"
          className="relative z-10 p-3.5 sm:p-4 rounded-2xl bg-cyan-500/10 border border-cyan-400/35 text-cyan-100 flex items-center justify-between gap-3"
        >
          <div className="flex items-start gap-3 min-w-0">
            <Bell size={18} className="text-cyan-300 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="text-xs font-mono font-bold uppercase text-cyan-200">
                {reminderToast.title}
              </div>
              <div className="text-xs sm:text-sm text-slate-200 truncate">
                {reminderToast.message}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setReminderToast(null)}
            aria-label="Dismiss reminder"
            className="min-w-[56px] min-h-[56px] rounded-xl hover:bg-white/10 flex items-center justify-center shrink-0 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoadingData ? (
        <GlassCard variant="default" padded="lg" className="relative z-10 text-center py-12">
          <div className="text-xs font-mono uppercase tracking-widest text-cyan-300">
            Evaluating live Digital Twin telemetry...
          </div>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
          {/* LEFT COLUMN (7 cols): Interactive Layered SVG Digital Twin */}
          <GlassCard variant="default" padded="md" className="lg:col-span-7 flex flex-col justify-between space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-white/10">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Activity size={18} className="text-cyan-400" />
                  <span>Astronaut Digital Twin</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Region colours driven live by HALO clinical rules &amp; personal baselines.
                </p>
              </div>
              <StatusBadge status={overallTwinStatus} />
            </div>

            <DigitalTwinSvg
              regions={twin.regions}
              regionList={twin.regionList}
              selectedRegionId={selectedRegionId}
              onSelectRegion={(id) => setSelectedRegionId(id)}
            />
          </GlassCard>

          {/* RIGHT COLUMN (5 cols): Readiness + Alerts + Orbit Ring + Radiation/SPE + Ground */}
          <div className="lg:col-span-5 space-y-6">
            {/* 1. Readiness Score & Breakdown (§7.9) */}
            <GlassCard variant="default" padded="md" className="space-y-4" data-testid="readiness-card">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                    CREW OPERATIONAL READINESS (§7.9)
                  </span>
                  <h2 className="text-xl font-extrabold text-white">Overall Readiness</h2>
                  <div
                    data-testid="readiness-band-label"
                    className={`inline-block mt-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono font-bold ${readinessBannerTone}`}
                  >
                    {readiness.bandLabel}
                  </div>
                </div>

                <ReadinessRing score={animatedScore ?? readiness.score} size="lg" />
              </div>

              {/* Visible Readiness Breakdown List (§7.9 & §8 Phase 5) */}
              <div className="pt-3 border-t border-white/10 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono uppercase text-slate-400">
                  <span>Score Breakdown</span>
                  <span className="text-slate-200">Base 100 → {readiness.score}</span>
                </div>

                {readiness.deductions.length === 0 ? (
                  <div
                    data-testid="readiness-no-deductions"
                    className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-200 flex items-center gap-2"
                  >
                    <CheckCircle2 size={15} className="shrink-0 text-emerald-400" />
                    <span>0 deductions — all measured indicators nominal and checks current.</span>
                  </div>
                ) : (
                  <ul
                    data-testid="readiness-breakdown-list"
                    className="space-y-1.5 max-h-48 overflow-y-auto pr-1"
                  >
                    {readiness.deductions.map((d, idx) => (
                      <li
                        key={`${d.indicator ?? d.kind ?? 'ded'}-${idx}`}
                        className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs flex items-start gap-2.5"
                      >
                        <span className="font-mono font-extrabold text-red-300 bg-red-500/15 border border-red-400/30 px-2 py-0.5 rounded-md shrink-0 tabular-nums">
                          −{d.points}
                        </span>
                        <span className="text-slate-200 leading-snug">{d.reason}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </GlassCard>

            {/* 2. Active Alerts List (§7.2) */}
            <GlassCard variant="default" padded="md" className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldAlert size={16} className="text-amber-400" />
                  <span>Active Telemetry Flags</span>
                </h2>
                <span className="text-xs font-mono text-slate-400">
                  {twin.alerts.length} {twin.alerts.length === 1 ? 'flag' : 'flags'}
                </span>
              </div>

              {twin.alerts.length === 0 ? (
                <div
                  data-testid="bridge-no-alerts"
                  className="p-3.5 rounded-xl bg-white/[0.02] border border-white/10 text-xs text-slate-400"
                >
                  No active WATCH, ALERT, or CRITICAL indicators flagged.
                </div>
              ) : (
                <div className="space-y-2">
                  {twin.alerts.map((alert) => (
                    <button
                      key={alert.id}
                      type="button"
                      data-testid={`active-alert-${alert.regionId}`}
                      onClick={() => setSelectedRegionId(alert.regionId)}
                      className="min-h-[56px] w-full p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 text-left flex items-center justify-between gap-3 transition-colors cursor-pointer"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-white">
                            {alert.indicatorLabel}
                          </span>
                          <span className="text-[11px] font-mono text-cyan-300">
                            {alert.valueLabel}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-300 truncate mt-0.5">
                          {alert.reason}
                        </div>
                      </div>
                      <StatusBadge status={alert.status} size="sm" />
                    </button>
                  ))}
                </div>
              )}
            </GlassCard>

            {/* 3. Today's Checks Orbit Ring & Gamification (§7.10 — XP + Streak only) */}
            <GlassCard variant="default" padded="md" className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <RotateCw size={15} className="text-cyan-400" />
                  <span>Today&apos;s Orbit Checks (Day {missionDay})</span>
                </h2>
                <span className="text-xs font-mono text-cyan-300">
                  {environment.shortName}
                </span>
              </div>

              <OrbitRing
                tasks={orbitRingTasks}
                missionDay={missionDay}
                adherence={adherence}
                onToggleTaskComplete={handleToggleTaskComplete}
                onAddTask={handleAddTask}
                onUpdateTask={handleUpdateTask}
                onDeleteTask={handleDeleteTask}
                onTriggerReminder={() => void handleManualReminder()}
              />
            </GlassCard>

            {/* 4. Radiation Dose Bar & Solar Particle Event (SPE) Alert (§7.8) */}
            <div id="radiation-panel" ref={radiationPanelRef}>
              <GlassCard variant="default" padded="md" className="space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase text-cyan-300">
                      <Radiation size={14} />
                      <span>Dosimetry vs 600 mSv Career Limit</span>
                    </div>
                    <h2 className="text-lg font-extrabold text-white mt-0.5">
                      Cumulative Radiation
                    </h2>
                  </div>
                  <StatusBadge status={twin.radiation.status} size="sm" />
                </div>

                {/* Progress Bar */}
                <div>
                  <div className="flex items-baseline justify-between text-xs mb-1.5">
                    <span className="font-mono font-bold text-white tabular-nums" data-testid="radiation-dose-readout">
                      {twin.radiation.doseMsv.toFixed(1)} / {CAREER_RADIATION_LIMIT_MSV} mSv
                    </span>
                    <span className="font-mono font-bold text-cyan-300 tabular-nums" data-testid="radiation-percent-readout">
                      {twin.radiation.percentOfLimit}% of limit
                    </span>
                  </div>
                  <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden border border-white/10">
                    <div
                      className={`h-full transition-all duration-500 ${radBarColor}`}
                      style={{ width: `${Math.min(100, twin.radiation.percentOfLimit)}%` }}
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-slate-400 mt-1.5 font-mono">
                    <span>
                      {twin.radiation.isManualOverride
                        ? 'Personal dosimeter override active'
                        : `Calculated: Day ${twin.radiation.missionDay} × ${twin.radiation.ratePerDay} mSv/d approx.`}
                    </span>
                    <span>NASA 2022 limit: 600 mSv</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Source note: {twin.radiation.sourceNote}
                  </div>
                </div>

                {/* Dosimeter Override Panel */}
                {showDosimeterInput ? (
                  <form onSubmit={(e) => void handleSaveDosimeterOverride(e)} className="space-y-2.5 pt-2 border-t border-white/10">
                    <label
                      htmlFor="dosimeter-override-input"
                      className="block text-[11px] font-mono uppercase text-slate-300"
                    >
                      Enter Personal Dosimeter Total (mSv)
                    </label>
                    <input
                      id="dosimeter-override-input"
                      type="number"
                      step="0.1"
                      min="0"
                      max="2000"
                      value={dosimeterInput}
                      onChange={(e) => setDosimeterInput(e.target.value)}
                      placeholder={`Current: ${twin.radiation.doseMsv.toFixed(1)}`}
                      className="w-full h-12 px-3 rounded-xl bg-black/50 border border-white/20 text-white font-mono text-sm focus:border-cyan-400 focus:outline-none"
                    />
                    {dosimeterError && (
                      <div className="text-xs text-red-300">{dosimeterError}</div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="submit"
                        className="min-h-[56px] flex-1 px-4 rounded-xl bg-cyan-400 text-slate-950 font-bold text-xs cursor-pointer"
                      >
                        Save Dosimeter
                      </button>
                      {twin.radiation.isManualOverride && (
                        <button
                          type="button"
                          onClick={() => void handleClearDosimeterOverride()}
                          className="min-h-[56px] px-3 rounded-xl bg-white/10 text-slate-200 text-xs font-semibold cursor-pointer"
                        >
                          Use Env Rate
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setShowDosimeterInput(false);
                          setDosimeterError('');
                        }}
                        className="min-h-[56px] px-3 rounded-xl bg-white/5 text-slate-300 text-xs cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowDosimeterInput(true)}
                      data-testid="edit-dosimeter-btn"
                      className="min-h-[56px] px-3.5 py-2 rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/15 text-xs font-semibold text-slate-200 cursor-pointer"
                    >
                      Enter Dosimeter
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setScheduledSpeCountdownSec(null);
                        setSpeStartedAt(Date.now());
                        setSpeAlertOpen(true);
                      }}
                      data-testid="trigger-spe-btn"
                      className="min-h-[56px] px-3.5 py-2 rounded-2xl bg-red-600/20 hover:bg-red-600/35 border border-red-500/45 text-xs font-bold text-red-200 inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Radiation size={15} />
                      <span>SPE Shelter Alert</span>
                    </button>
                  </div>
                )}

                {/* Scheduled Demo SPE Event Trigger & Incident Count */}
                <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <span className="font-mono text-slate-400">
                    Logged SPE shelter drills: <strong className="text-white">{speIncidents.length}</strong>
                  </span>
                  {scheduledSpeCountdownSec !== null ? (
                    <button
                      type="button"
                      onClick={() => setScheduledSpeCountdownSec(null)}
                      className="min-h-[56px] px-3 rounded-xl bg-red-500/20 border border-red-400/40 font-mono text-red-200 cursor-pointer"
                    >
                      SIMULATED SPE in {scheduledSpeCountdownSec}s · Cancel
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setScheduledSpeCountdownSec(5)}
                      data-testid="schedule-demo-spe-btn"
                      className="min-h-[56px] px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 font-mono text-cyan-300 cursor-pointer"
                    >
                      Schedule 5s Demo SPE
                    </button>
                  )}
                </div>
              </GlassCard>
            </div>

            {/* 5. Light-Delay, Autonomy & Ground Inbox Summary (§7.2) */}
            <GlassCard variant="default" padded="md" className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-slate-300">
                  <Radio size={15} className="text-cyan-400" />
                  <span>One-Way Earth Link</span>
                </div>
                <span className="font-mono font-bold text-white tabular-nums">{delayStr}</span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Autonomy Mode</span>
                <span className="font-mono font-bold text-cyan-300">{autonomyLevel}</span>
              </div>

              <Link
                to="/groundlink"
                className="min-h-[56px] w-full px-3.5 py-2.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 flex items-center justify-between gap-2 transition-colors"
              >
                <div className="flex items-center gap-2.5 text-xs font-semibold text-white">
                  <Inbox size={16} className="text-cyan-400" />
                  <span>Ground Link Inbox</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    data-testid="ground-unread-badge"
                    className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold ${
                      unreadGroundCount > 0
                        ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/40'
                        : 'bg-white/10 text-slate-300'
                    }`}
                  >
                    {unreadGroundCount} unread
                  </span>
                  <ArrowRight size={15} className="text-slate-400" />
                </div>
              </Link>
            </GlassCard>
          </div>
        </div>
      )}

      {/* Clickable Digital Twin Region Side Sheet (§7.2) */}
      <RegionSideSheet
        region={selectedRegion}
        onClose={() => setSelectedRegionId(null)}
        onJumpToRadiation={() => {
          radiationPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }}
      />

      {/* Full-Screen Solar Particle Event Shelter Protocol (§7.8) */}
      <SpeShelterOverlay
        isOpen={speAlertOpen}
        startedAt={speStartedAt}
        missionDay={missionDay}
        environmentName={environment.name}
        onConfirmAllClear={handleConfirmSpeAllClear}
        onDismiss={() => {
          setSpeAlertOpen(false);
          setSpeStartedAt(null);
        }}
      />
    </div>
  );
};
