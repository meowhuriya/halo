import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Brain,
  Play,
  Square,
  RotateCcw,
  Clock,
  Smartphone,
  Info,
  AlertTriangle,
  CheckCircle2,
  Activity,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { useReducedMotion } from 'framer-motion';
import { GlassCard } from '../../design/components/GlassCard';
import { BigButton } from '../../design/components/BigButton';
import { StatusBadge } from '../../design/components/StatusBadge';
import { db, type HealthReading } from '../../data/db';
import { useMission } from '../../app/MissionContext';
import type { ComprehensiveEvaluation } from '../../engine/rules';
import {
  PVT_DURATION_MS,
  PVT_LAPSE_THRESHOLD_MS,
  PVT_FALSE_START_THRESHOLD_MS,
  PVT_BASELINE_SESSION_COUNT,
  generateRandomIsiMs,
  classifyPvtResponse,
  scorePvtSession,
  computePvtDeviceBaseline,
  evaluatePvtSession,
  parsePvtNotes,
  getOrCreateDeviceId,
  type PvtTrialRecord,
  type PvtSessionMetrics,
  type PvtSessionSummary,
} from './pvtScoring';

type PvtPhase = 'idle' | 'running' | 'complete';

function formatCountdown(msRemaining: number): string {
  const clamped = Math.max(0, Math.ceil(msRemaining / 1000));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export const CognitionView: React.FC = () => {
  const { crew, config, refreshMission } = useMission();
  const prefersReducedMotion = useReducedMotion();
  const deviceId = useMemo(() => getOrCreateDeviceId(), []);

  // History state
  const [sameDeviceHistory, setSameDeviceHistory] = useState<PvtSessionSummary[]>([]);
  const [otherDeviceCount, setOtherDeviceCount] = useState(0);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState('');

  // Test runner state
  const [phase, setPhase] = useState<PvtPhase>('idle');
  const [remainingMs, setRemainingMs] = useState(PVT_DURATION_MS);
  const [stimulusActive, setStimulusActive] = useState(false);
  const [feedback, setFeedback] = useState<{ label: string; tone: 'cyan' | 'amber' | 'red' } | null>(null);
  const [liveStats, setLiveStats] = useState({ valid: 0, lapses: 0, falseStarts: 0 });
  const [lastMetrics, setLastMetrics] = useState<PvtSessionMetrics | null>(null);
  const [lastEvaluation, setLastEvaluation] = useState<ComprehensiveEvaluation | null>(null);
  const [saveError, setSaveError] = useState('');

  // High-resolution timing refs (performance.now() clock per §7.5)
  const testActiveRef = useRef(false);
  const testStartRef = useRef(0);
  const onsetTsRef = useRef<number | null>(null);
  const lastResponseLockRef = useRef(0);
  const trialsRef = useRef<PvtTrialRecord[]>([]);
  const isiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rafShowRef = useRef<number>(0);
  const rafTickRef = useRef<number>(0);
  const counterElRef = useRef<HTMLDivElement | null>(null);
  const saveAttemptedRef = useRef(false);

  const loadHistory = useCallback(async () => {
    if (!crew?.id) {
      setIsLoadingHistory(false);
      return;
    }
    try {
      setIsLoadingHistory(true);
      setHistoryError('');
      const allPvt: HealthReading[] = await db.healthReadings
        .where('crewMemberId')
        .equals(crew.id)
        .filter((r) => r.indicator === 'pvt')
        .toArray();

      const same: PvtSessionSummary[] = [];
      let others = 0;

      for (const r of allPvt) {
        const parsed = parsePvtNotes(r.notes);
        if (parsed && parsed.deviceId === deviceId) {
          const numericVal = typeof r.value === 'number' ? r.value : 0;
          same.push({
            id: r.id,
            timestamp: r.timestamp,
            missionDay: r.missionDay,
            deviceId: parsed.deviceId,
            meanSpeed: parsed.meanSpeed ?? numericVal,
            medianRtMs: parsed.medianRtMs ?? (numericVal > 0 ? Math.round(1000 / numericVal) : 0),
            meanRtMs: parsed.meanRtMs ?? (numericVal > 0 ? Math.round(1000 / numericVal) : 0),
            lapses: parsed.lapses ?? 0,
            falseStarts: parsed.falseStarts ?? 0,
            lapsesAndFalseStarts: parsed.lapsesAndFalseStarts ?? ((parsed.lapses ?? 0) + (parsed.falseStarts ?? 0)),
            validTrialCount: parsed.validTrialCount ?? 0,
            totalResponses: parsed.totalResponses ?? 0,
            durationMs: parsed.durationMs ?? PVT_DURATION_MS,
            status: r.status,
            reasons: r.reasons ?? [],
          });
        } else {
          others++;
        }
      }

      same.sort((a, b) => a.timestamp - b.timestamp);
      setSameDeviceHistory(same);
      setOtherDeviceCount(others);
    } catch (err) {
      console.error('Failed to load PVT history:', err);
      setHistoryError('Could not load local PVT-B history from IndexedDB.');
    } finally {
      setIsLoadingHistory(false);
    }
  }, [crew?.id, deviceId]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const deviceBaseline = useMemo(
    () => computePvtDeviceBaseline(sameDeviceHistory, deviceId),
    [sameDeviceHistory, deviceId]
  );

  const latestStatus = useMemo(() => {
    if (lastEvaluation) return lastEvaluation.status;
    if (sameDeviceHistory.length > 0) {
      return sameDeviceHistory[sameDeviceHistory.length - 1].status;
    }
    return 'NOMINAL' as const;
  }, [lastEvaluation, sameDeviceHistory]);

  const clearAllTimers = useCallback(() => {
    testActiveRef.current = false;
    if (isiTimerRef.current) {
      clearTimeout(isiTimerRef.current);
      isiTimerRef.current = null;
    }
    if (endTimerRef.current) {
      clearTimeout(endTimerRef.current);
      endTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (rafShowRef.current) {
      cancelAnimationFrame(rafShowRef.current);
      rafShowRef.current = 0;
    }
    if (rafTickRef.current) {
      cancelAnimationFrame(rafTickRef.current);
      rafTickRef.current = 0;
    }
    onsetTsRef.current = null;
  }, []);

  useEffect(() => {
    return () => clearAllTimers();
  }, [clearAllTimers]);

  const scheduleNextStimulus = useCallback(() => {
    if (!testActiveRef.current) return;

    const elapsed = performance.now() - testStartRef.current;
    if (elapsed >= PVT_DURATION_MS) return;

    const isi = generateRandomIsiMs();
    if (elapsed + isi >= PVT_DURATION_MS) {
      // Remaining time shorter than randomized ISI; test finishes cleanly at 3:00
      return;
    }

    isiTimerRef.current = setTimeout(() => {
      if (!testActiveRef.current) return;

      // Record stimulus onset via the rAF timestamp of the frame that first paints it (§7.5)
      rafShowRef.current = requestAnimationFrame((paintTs) => {
        if (!testActiveRef.current) return;
        onsetTsRef.current = paintTs;
        setFeedback(null);
        setStimulusActive(true);
        if (counterElRef.current) {
          counterElRef.current.textContent = '000 ms';
        }

        const tickCounter = (nowTs: number) => {
          if (!testActiveRef.current || onsetTsRef.current === null) return;
          if (counterElRef.current) {
            const elapsedTrial = Math.max(0, Math.round(nowTs - onsetTsRef.current));
            counterElRef.current.textContent = `${elapsedTrial.toString().padStart(3, '0')} ms`;
          }
          rafTickRef.current = requestAnimationFrame(tickCounter);
        };
        rafTickRef.current = requestAnimationFrame(tickCounter);
      });
    }, isi);
  }, []);

  const completeSession = useCallback(async () => {
    if (saveAttemptedRef.current) return;
    saveAttemptedRef.current = true;

    const actualDuration = Math.max(PVT_DURATION_MS, Math.round(performance.now() - testStartRef.current));
    clearAllTimers();
    setStimulusActive(false);
    setRemainingMs(0);

    const metrics = scorePvtSession(trialsRef.current, deviceId, actualDuration);
    const evalResult = evaluatePvtSession(metrics, deviceBaseline);

    setLastMetrics(metrics);
    setLastEvaluation(evalResult);
    setPhase('complete');
    setSaveError('');

    if (!crew?.id) return;

    try {
      await db.healthReadings.add({
        crewMemberId: crew.id,
        timestamp: Date.now(),
        missionDay: config?.missionDay ?? 1,
        indicator: 'pvt',
        value: metrics.meanSpeed,
        unit: 'speed (1/s)',
        status: evalResult.status,
        reasons: evalResult.reasons,
        source: 'pvt',
        notes: JSON.stringify(metrics),
      });

      const pendingPvtTasks = await db.tasks
        .where('crewMemberId')
        .equals(crew.id)
        .filter((t) => t.taskType === 'pvt' && t.status !== 'completed')
        .toArray();
      for (const task of pendingPvtTasks) {
        if (task.id) {
          await db.tasks.update(task.id, {
            status: 'completed',
            completedAt: Date.now(),
          });
        }
      }

      await refreshMission();
      await loadHistory();
    } catch (err) {
      console.error('Failed to save PVT session:', err);
      setSaveError('Session completed, but saving to IndexedDB failed.');
    }
  }, [clearAllTimers, config?.missionDay, crew?.id, deviceBaseline, deviceId, loadHistory, refreshMission]);

  const startSession = useCallback(() => {
    clearAllTimers();
    saveAttemptedRef.current = false;
    trialsRef.current = [];
    lastResponseLockRef.current = 0;

    setSaveError('');
    setLastMetrics(null);
    setLastEvaluation(null);
    setFeedback(null);
    setStimulusActive(false);
    setLiveStats({ valid: 0, lapses: 0, falseStarts: 0 });
    setRemainingMs(PVT_DURATION_MS);
    setPhase('running');

    const startTs = performance.now();
    testStartRef.current = startTs;
    testActiveRef.current = true;

    countdownIntervalRef.current = setInterval(() => {
      if (!testActiveRef.current) return;
      const rem = PVT_DURATION_MS - (performance.now() - testStartRef.current);
      setRemainingMs(Math.max(0, rem));
      if (rem <= 0) {
        void completeSession();
      }
    }, 200);

    endTimerRef.current = setTimeout(() => {
      void completeSession();
    }, PVT_DURATION_MS);

    scheduleNextStimulus();
  }, [clearAllTimers, completeSession, scheduleNextStimulus]);

  const cancelSession = useCallback(() => {
    clearAllTimers();
    trialsRef.current = [];
    setStimulusActive(false);
    setFeedback(null);
    setPhase('idle');
    setRemainingMs(PVT_DURATION_MS);
  }, [clearAllTimers]);

  const handleResponse = useCallback(
    (responseTs: number) => {
      if (!testActiveRef.current) return;
      // Guard accidental duplicate hardware bounce inside 120 ms
      if (responseTs - lastResponseLockRef.current < 120) return;
      lastResponseLockRef.current = responseTs;

      const currentOnset = onsetTsRef.current;
      const record = classifyPvtResponse(currentOnset, responseTs);
      trialsRef.current.push(record);

      if (currentOnset !== null) {
        // Active stimulus responded to: clear stimulus and schedule next ISI
        onsetTsRef.current = null;
        if (rafTickRef.current) {
          cancelAnimationFrame(rafTickRef.current);
          rafTickRef.current = 0;
        }
        setStimulusActive(false);

        if (record.kind === 'false_start_early') {
          setFeedback({ label: `FALSE START (${Math.round(record.rtMs ?? 0)} ms < 100 ms)`, tone: 'red' });
          setLiveStats((prev) => ({ ...prev, falseStarts: prev.falseStarts + 1 }));
        } else if (record.kind === 'lapse') {
          setFeedback({ label: `${Math.round(record.rtMs ?? 0)} ms — LAPSE`, tone: 'amber' });
          setLiveStats((prev) => ({ ...prev, valid: prev.valid + 1, lapses: prev.lapses + 1 }));
        } else {
          setFeedback({ label: `${Math.round(record.rtMs ?? 0)} ms`, tone: 'cyan' });
          setLiveStats((prev) => ({ ...prev, valid: prev.valid + 1 }));
        }

        scheduleNextStimulus();
      } else {
        // Premature response before stimulus appeared (§7.5)
        setFeedback({ label: 'FALSE START — WAIT FOR COUNTER', tone: 'red' });
        setLiveStats((prev) => ({ ...prev, falseStarts: prev.falseStarts + 1 }));
      }
    },
    [scheduleNextStimulus]
  );

  // Spacebar support via keydown event.timeStamp (§7.5)
  useEffect(() => {
    if (phase !== 'running') return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        if (e.repeat) return;
        handleResponse(e.timeStamp);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, handleResponse]);

  const chartData = useMemo(
    () =>
      sameDeviceHistory.map((s, idx) => ({
        session: `#${idx + 1}`,
        speed: s.meanSpeed,
        medianRt: s.medianRtMs,
        lapses: s.lapses,
      })),
    [sameDeviceHistory]
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-xl">
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
            3-minute sustained attention &amp; reaction-speed test calibrated strictly to this device.
          </p>
        </div>
        <div className="flex flex-col sm:items-end gap-2">
          <StatusBadge status={latestStatus} />
          <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-slate-400 bg-white/[0.04] px-2.5 py-1 rounded-lg border border-white/10">
            <Smartphone size={12} className="text-cyan-400" />
            ID: {deviceId}
          </span>
        </div>
      </div>

      {/* Errors */}
      {(historyError || saveError) && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-start gap-3">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <span>{saveError || historyError}</span>
        </div>
      )}

      {/* Main Test Arena */}
      <GlassCard variant="default" padded="lg" className="relative overflow-hidden bg-black/50 border-cyan-500/20">
        {phase === 'idle' && (
          <div className="max-w-lg mx-auto text-center space-y-6 py-4">
            <div className="w-20 h-20 rounded-3xl bg-cyan-500/10 border border-cyan-400/40 flex items-center justify-center mx-auto text-cyan-300 shadow-[0_0_30px_rgba(56,225,255,0.2)]">
              <Clock size={36} className={prefersReducedMotion ? '' : 'animate-pulse'} />
            </div>

            <div>
              <h2 className="text-xl font-bold text-white">3-Minute Standardized PVT-B</h2>
              <p className="text-xs sm:text-sm text-slate-300 mt-1.5 leading-relaxed">
                Wait for the millisecond counter to appear at random 1–4 s intervals. Respond immediately by tapping the target box or pressing <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/20 font-mono text-cyan-300">Space</kbd>.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono text-slate-300 text-left">
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
                <span className="text-slate-400 block text-[10px]">DURATION</span>
                <span className="font-bold text-white">3:00 (180 s)</span>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
                <span className="text-slate-400 block text-[10px]">LAPSE THRESHOLD</span>
                <span className="font-bold text-amber-400">RT ≥ {PVT_LAPSE_THRESHOLD_MS} ms</span>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
                <span className="text-slate-400 block text-[10px]">FALSE START</span>
                <span className="font-bold text-red-400">&lt; {PVT_FALSE_START_THRESHOLD_MS} ms / early</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-cyan-500/[0.06] border border-cyan-500/20 text-xs text-slate-200 flex items-center justify-between gap-3 text-left">
              <div>
                <span className="font-mono text-[10px] uppercase tracking-wider text-cyan-300 block">
                  THIS DEVICE BASELINE ({deviceId})
                </span>
                {deviceBaseline ? (
                  <span className="font-semibold text-white">
                    {deviceBaseline.baselineSpeed.toFixed(2)} s⁻¹ ({deviceBaseline.baselineMedianRtMs} ms median · {deviceBaseline.baselineLapses} avg lapses)
                  </span>
                ) : (
                  <span>
                    Collecting baseline: {sameDeviceHistory.length}/{PVT_BASELINE_SESSION_COUNT} sessions completed on this device
                  </span>
                )}
              </div>
              {deviceBaseline && <CheckCircle2 size={20} className="text-emerald-400 shrink-0" />}
            </div>

            <BigButton
              variant="primary"
              size="lg"
              fullWidth
              icon={<Play size={18} />}
              onClick={startSession}
            >
              Start 3-Minute PVT-B
            </BigButton>
          </div>
        )}

        {phase === 'running' && (
          <div className="space-y-5">
            {/* Top Status Strip */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 font-mono text-lg font-extrabold text-cyan-300 tabular-nums">
                  {formatCountdown(remainingMs)}
                </span>
                <span className="text-xs font-mono text-slate-400">
                  Valid: <strong className="text-white">{liveStats.valid}</strong> · Lapses:{' '}
                  <strong className="text-amber-400">{liveStats.lapses}</strong> · Early:{' '}
                  <strong className="text-red-400">{liveStats.falseStarts}</strong>
                </span>
              </div>
              <BigButton
                variant="secondary"
                size="md"
                icon={<Square size={15} />}
                onClick={cancelSession}
              >
                Cancel
              </BigButton>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-cyan-400 transition-[width] duration-200"
                style={{ width: `${Math.min(100, ((PVT_DURATION_MS - remainingMs) / PVT_DURATION_MS) * 100)}%` }}
              />
            </div>

            {/* Interactive Tap Target Zone */}
            <div
              role="button"
              tabIndex={0}
              aria-label="PVT-B Stimulus Target Zone — tap or press Spacebar when counter appears"
              onPointerDown={(e) => {
                e.preventDefault();
                handleResponse(e.timeStamp);
              }}
              className={`min-h-[260px] sm:min-h-[300px] w-full rounded-3xl border-2 flex flex-col items-center justify-center select-none touch-manipulation cursor-pointer transition-colors ${
                stimulusActive
                  ? 'border-cyan-400 bg-cyan-500/[0.12] shadow-[0_0_40px_rgba(56,225,255,0.25)]'
                  : 'border-white/15 bg-[#070B14] hover:border-white/25'
              }`}
            >
              {stimulusActive ? (
                <div className="text-center space-y-2 pointer-events-none">
                  <span className="text-xs font-mono uppercase tracking-widest text-cyan-300">
                    TAP NOW / SPACE
                  </span>
                  <div
                    ref={counterElRef}
                    className="font-mono text-5xl sm:text-6xl font-extrabold text-cyan-300 tracking-wider tabular-nums"
                  >
                    000 ms
                  </div>
                </div>
              ) : feedback ? (
                <div
                  className={`font-mono text-xl sm:text-2xl font-bold pointer-events-none px-4 text-center ${
                    feedback.tone === 'cyan'
                      ? 'text-cyan-300'
                      : feedback.tone === 'amber'
                        ? 'text-amber-400'
                        : 'text-red-400'
                  }`}
                >
                  {feedback.label}
                </div>
              ) : (
                <div className="text-center space-y-2 pointer-events-none px-4">
                  <div className="w-3 h-3 rounded-full bg-slate-600 mx-auto" />
                  <p className="text-xs sm:text-sm font-mono text-slate-400">
                    Keep eyes on center · Tap or press Spacebar when timer starts
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {phase === 'complete' && lastMetrics && lastEvaluation && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-mono text-emerald-400 uppercase tracking-wider">
                  SESSION LOGGED · DEVICE {lastMetrics.deviceId}
                </span>
                <h2 className="text-2xl font-extrabold text-white mt-0.5">PVT-B Session Complete</h2>
              </div>
              <StatusBadge status={lastEvaluation.status} />
            </div>

            {/* 5 Spec Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 font-mono">
              <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10">
                <span className="text-[10px] text-slate-400 block">MEAN SPEED (1/RT)</span>
                <span className="text-xl font-extrabold text-cyan-300">{lastMetrics.meanSpeed.toFixed(2)} s⁻¹</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10">
                <span className="text-[10px] text-slate-400 block">MEDIAN RT</span>
                <span className="text-xl font-extrabold text-white">{lastMetrics.medianRtMs} ms</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10">
                <span className="text-[10px] text-slate-400 block">LAPSES (≥355 ms)</span>
                <span className="text-xl font-extrabold text-amber-400">{lastMetrics.lapses}</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10">
                <span className="text-[10px] text-slate-400 block">FALSE STARTS</span>
                <span className="text-xl font-extrabold text-red-400">{lastMetrics.falseStarts}</span>
              </div>
              <div className="col-span-2 sm:col-span-1 p-3.5 rounded-2xl bg-white/[0.04] border border-white/10">
                <span className="text-[10px] text-slate-400 block">LAPSES + FALSE</span>
                <span className="text-xl font-extrabold text-white">{lastMetrics.lapsesAndFalseStarts}</span>
              </div>
            </div>

            {/* Reasons & Action */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2 text-xs text-slate-200">
              {lastEvaluation.reasons.map((r, i) => (
                <div key={i} className="font-medium">• {r}</div>
              ))}
              <div className="text-slate-400 pt-1">{lastEvaluation.guidance.immediateAction}</div>
            </div>

            <BigButton
              variant="primary"
              size="md"
              icon={<RotateCcw size={16} />}
              onClick={() => setPhase('idle')}
            >
              Run Another Session
            </BigButton>
          </div>
        )}
      </GlassCard>

      {/* Chart History (§7.5) */}
      <GlassCard variant="default" padded="md" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Activity size={18} className="text-cyan-400" />
            <h3 className="text-sm sm:text-base font-bold text-white">
              Same-Device Response Speed History ({deviceId})
            </h3>
          </div>
          {otherDeviceCount > 0 && (
            <span className="text-[11px] font-mono text-slate-400">
              {otherDeviceCount} reading(s) from other/simulated devices excluded
            </span>
          )}
        </div>

        {isLoadingHistory ? (
          <div className="h-48 flex items-center justify-center text-xs font-mono text-slate-400">
            Loading device telemetry...
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-40 rounded-2xl border border-dashed border-white/10 flex flex-col items-center justify-center text-center p-4 space-y-1">
            <span className="text-sm font-semibold text-slate-300">No sessions recorded on this device yet</span>
            <span className="text-xs text-slate-400">
              Complete 3 sessions on {deviceId} to establish your hardware-matched baseline.
            </span>
          </div>
        ) : (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 16, left: -12, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="session" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0B111E',
                    borderColor: 'rgba(56,225,255,0.3)',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                />
                {deviceBaseline && (
                  <ReferenceLine
                    y={deviceBaseline.baselineSpeed}
                    stroke="#22C55E"
                    strokeDasharray="4 4"
                    label={{ value: 'Baseline', fill: '#22C55E', fontSize: 10 }}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="speed"
                  name="Mean Speed (1/s)"
                  stroke="#38E1FF"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#38E1FF' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </GlassCard>

      {/* Mandatory Info Card per §7.5 */}
      <GlassCard variant="subtle" padded="md" className="space-y-2 text-xs text-slate-300 leading-relaxed">
        <div className="flex items-center gap-2 font-bold text-white">
          <Info size={16} className="text-cyan-400 shrink-0" />
          <span>Why PVT-B Matters &amp; Device-Locked Timing</span>
        </div>
        <p>
          <strong>Fatigue and sleep debt show up here before you feel them.</strong> Sustained-attention micro-lapses (RT ≥ 355 ms) and slowed response speed (1/RT) are the earliest objective markers of sleep loss and circadian misalignment prior to EVA or critical piloting tasks.
        </p>
        <p className="text-slate-400">
          <strong>Same-device comparison only ({deviceId}):</strong> Touch-screen scan rates and display refresh latency differ by tens of milliseconds between phones, tablets, and laptops. HALO stores a Device ID with every session and builds your baseline exclusively from the first 3 sessions recorded on this device. Stimulus onset uses <code className="text-cyan-300">requestAnimationFrame</code> timestamps and responses use <code className="text-cyan-300">event.timeStamp</code> on the <code className="text-cyan-300">performance.now()</code> clock.
        </p>
      </GlassCard>
    </div>
  );
};
