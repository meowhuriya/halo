import { evaluateReading, type ComprehensiveEvaluation } from '../../engine/rules';

// ── PVT-B Constants per HALO_SPEC.md §7.5 ───────────────────────────────────

export const PVT_DURATION_MS = 180_000; // Exact 3-minute session
export const PVT_ISI_MIN_MS = 1000; // 1 s minimum inter-stimulus interval
export const PVT_ISI_MAX_MS = 4000; // 4 s maximum inter-stimulus interval
export const PVT_LAPSE_THRESHOLD_MS = 355; // RT >= 355 ms
export const PVT_FALSE_START_THRESHOLD_MS = 100; // RT < 100 ms (or no stimulus)
export const PVT_BASELINE_SESSION_COUNT = 3; // Mean of first 3 same-device sessions

export type PvtTrialKind =
  | 'valid'
  | 'lapse'
  | 'false_start_early'
  | 'false_start_nostim';

export interface PvtTrialRecord {
  onsetTs: number | null;
  responseTs: number;
  rtMs: number | null;
  kind: PvtTrialKind;
}

export interface PvtSessionMetrics {
  meanSpeed: number; // mean(1 / RT_seconds), in 1/s
  medianRtMs: number;
  meanRtMs: number;
  lapses: number;
  falseStarts: number;
  lapsesAndFalseStarts: number;
  validTrialCount: number;
  totalResponses: number;
  durationMs: number;
  deviceId: string;
}

export interface PvtSessionSummary extends PvtSessionMetrics {
  id?: number;
  timestamp: number;
  missionDay: number;
  status: 'NOMINAL' | 'WATCH' | 'ALERT' | 'CRITICAL';
  reasons: string[];
}

export interface PvtDeviceBaseline {
  deviceId: string;
  baselineSpeed: number;
  baselineLapses: number;
  baselineMedianRtMs: number;
  sessionCount: number;
}

/**
 * Generate a random uniform Inter-Stimulus Interval between 1,000 and 4,000 ms (§7.5).
 */
export function generateRandomIsiMs(rng: () => number = Math.random): number {
  return Math.round(PVT_ISI_MIN_MS + rng() * (PVT_ISI_MAX_MS - PVT_ISI_MIN_MS));
}

/**
 * Classify a single pointerdown / keydown response against the rAF stimulus onset timestamp.
 * Both timestamps share the performance.now() clock (§7.5).
 */
export function classifyPvtResponse(
  onsetTs: number | null,
  responseTs: number
): PvtTrialRecord {
  if (onsetTs === null) {
    return {
      onsetTs: null,
      responseTs,
      rtMs: null,
      kind: 'false_start_nostim',
    };
  }

  const rtMs = Math.round((responseTs - onsetTs) * 100) / 100;

  if (rtMs < PVT_FALSE_START_THRESHOLD_MS) {
    return {
      onsetTs,
      responseTs,
      rtMs,
      kind: 'false_start_early',
    };
  }

  if (rtMs >= PVT_LAPSE_THRESHOLD_MS) {
    return {
      onsetTs,
      responseTs,
      rtMs,
      kind: 'lapse',
    };
  }

  return {
    onsetTs,
    responseTs,
    rtMs,
    kind: 'valid',
  };
}

/**
 * Compute all PVT-B session metrics from recorded trials (§7.5):
 * - mean speed (1/RT in s^-1) across valid + lapse trials (excluding false starts)
 * - median RT (ms)
 * - lapses (RT >= 355 ms)
 * - false starts (RT < 100 ms or response without stimulus)
 * - lapses + false starts
 */
export function scorePvtSession(
  trials: PvtTrialRecord[],
  deviceId: string,
  durationMs: number = PVT_DURATION_MS
): PvtSessionMetrics {
  const responseRts: number[] = [];
  let lapses = 0;
  let falseStarts = 0;

  for (const t of trials) {
    if (t.kind === 'false_start_early' || t.kind === 'false_start_nostim') {
      falseStarts++;
    } else if (t.rtMs !== null && t.rtMs >= PVT_FALSE_START_THRESHOLD_MS) {
      responseRts.push(t.rtMs);
      if (t.kind === 'lapse' || t.rtMs >= PVT_LAPSE_THRESHOLD_MS) {
        lapses++;
      }
    }
  }

  const validTrialCount = responseRts.length;
  let meanSpeed = 0;
  let medianRtMs = 0;
  let meanRtMs = 0;

  if (validTrialCount > 0) {
    const speedSum = responseRts.reduce((sum, rt) => sum + 1000 / rt, 0);
    meanSpeed = Math.round((speedSum / validTrialCount) * 1000) / 1000;

    const rtSum = responseRts.reduce((sum, rt) => sum + rt, 0);
    meanRtMs = Math.round((rtSum / validTrialCount) * 10) / 10;

    const sorted = [...responseRts].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const rawMedian =
      sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
    medianRtMs = Math.round(rawMedian * 10) / 10;
  }

  return {
    meanSpeed,
    medianRtMs,
    meanRtMs,
    lapses,
    falseStarts,
    lapsesAndFalseStarts: lapses + falseStarts,
    validTrialCount,
    totalResponses: trials.length,
    durationMs,
    deviceId,
  };
}

/**
 * Filter prior sessions strictly by matching deviceId and compute the
 * personal PVT-B baseline from the first 3 same-device sessions (§7.5).
 * Touch & display latencies differ across devices, so other devices are excluded.
 */
export function computePvtDeviceBaseline(
  sessions: PvtSessionSummary[],
  deviceId: string
): PvtDeviceBaseline | null {
  const sameDevice = sessions
    .filter((s) => s.deviceId === deviceId && s.meanSpeed > 0)
    .sort((a, b) => a.timestamp - b.timestamp);

  if (sameDevice.length < PVT_BASELINE_SESSION_COUNT) {
    return null;
  }

  const firstThree = sameDevice.slice(0, PVT_BASELINE_SESSION_COUNT);
  const avgSpeed =
    firstThree.reduce((sum, s) => sum + s.meanSpeed, 0) / firstThree.length;
  const avgLapses =
    firstThree.reduce((sum, s) => sum + s.lapses, 0) / firstThree.length;
  const avgMedianRt =
    firstThree.reduce((sum, s) => sum + s.medianRtMs, 0) / firstThree.length;

  return {
    deviceId,
    baselineSpeed: Math.round(avgSpeed * 1000) / 1000,
    baselineLapses: Math.round(avgLapses * 10) / 10,
    baselineMedianRtMs: Math.round(avgMedianRt * 10) / 10,
    sessionCount: firstThree.length,
  };
}

/**
 * Evaluate a completed PVT-B session against the same-device baseline via rules engine (§6 & §7.5).
 */
export function evaluatePvtSession(
  metrics: PvtSessionMetrics,
  baseline: PvtDeviceBaseline | null
): ComprehensiveEvaluation {
  return evaluateReading({
    indicator: 'pvt',
    value: metrics.meanSpeed,
    baseline: null, // Use §6 classifyPvt speed-vs-baseline + lapse criterion directly
    options: {
      currentSpeed: metrics.meanSpeed,
      baselineSpeed: baseline ? baseline.baselineSpeed : 0,
      currentLapses: metrics.lapses,
      baselineLapses: baseline ? baseline.baselineLapses : 0,
    },
  });
}

/**
 * Parse a stored HealthReading `notes` string safely into PvtSessionMetrics if it came from Phase 4 PVT-B.
 */
export function parsePvtNotes(notes?: string): Partial<PvtSessionMetrics> | null {
  if (!notes) return null;
  try {
    const parsed = JSON.parse(notes) as Partial<PvtSessionMetrics>;
    if (parsed && typeof parsed.deviceId === 'string') {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Return or create a persistent device identifier stored in localStorage (§7.5).
 */
export function getOrCreateDeviceId(): string {
  const STORAGE_KEY = 'halo_device_id';
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing && existing.length > 0) {
      return existing;
    }
    const generated =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? `dev-${crypto.randomUUID().slice(0, 8)}`
        : `dev-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(STORAGE_KEY, generated);
    return generated;
  } catch {
    return 'dev-local-fallback';
  }
}
