import type { HealthStatus } from '../data/db';

export const READINESS_PENALTIES = {
  CRITICAL: 30,
  ALERT: 15,
  WATCH: 5,
  NOMINAL: 0,
  OVERDUE_CHECK: 3,
} as const;

export type ReadinessBand = 'GO' | 'GO WITH CAUTION' | 'HOLD';

export interface ReadinessDeduction {
  reason: string;
  points: number;
  indicator?: string;
  severity?: HealthStatus;
  kind?: 'indicator' | 'overdue';
}

export interface ReadinessScoreResult {
  score: number;
  band: ReadinessBand;
  bandLabel: string;
  deductions: ReadinessDeduction[];
}

export interface ReadinessReadingInput {
  indicator: string;
  status: HealthStatus;
  reasons?: string[];
  timestamp?: number;
  quality?: 'GOOD' | 'FAIR' | 'POOR';
}

export interface OverdueTaskInput {
  title: string;
  dueDay?: number;
}

/**
 * Human-readable operational readiness band label per HALO_SPEC §7.9:
 * ≥ 80 GO · 60–79 GO WITH CAUTION · < 60 HOLD — consult CMO
 */
export function getReadinessBandLabel(band: ReadinessBand): string {
  switch (band) {
    case 'GO':
      return 'GO';
    case 'GO WITH CAUTION':
      return 'GO WITH CAUTION';
    case 'HOLD':
      return 'HOLD — consult CMO';
  }
}

/**
 * Keep only the newest valid reading per indicator (ignoring POOR camera readings).
 */
export function pickLatestReadingsByIndicator<T extends ReadinessReadingInput>(
  readings: T[]
): T[] {
  const latest = new Map<string, T>();
  for (const r of readings) {
    if (r.quality === 'POOR') continue;
    const prev = latest.get(r.indicator);
    const rTs = r.timestamp ?? 0;
    const prevTs = prev?.timestamp ?? -1;
    if (!prev || rTs >= prevTs) {
      latest.set(r.indicator, r);
    }
  }
  return Array.from(latest.values());
}

/**
 * Compute readiness score from explicit deductions (§7.9):
 * Start 100 · clamp 0–100 · ≥ 80 GO, 60–79 GO WITH CAUTION, < 60 HOLD — consult CMO.
 */
export function calculateReadiness(deductions: ReadinessDeduction[]): ReadinessScoreResult {
  const totalDeductions = deductions.reduce((sum, d) => sum + Math.max(0, d.points), 0);
  const score = Math.max(0, Math.min(100, 100 - totalDeductions));

  let band: ReadinessBand = 'GO';
  if (score < 60) band = 'HOLD';
  else if (score < 80) band = 'GO WITH CAUTION';

  return {
    score,
    band,
    bandLabel: getReadinessBandLabel(band),
    deductions,
  };
}

/**
 * Compute readiness score from latest indicator evaluations and overdue scheduled checks (§7.9):
 * - Start 100
 * - Per indicator: CRITICAL −30, ALERT −15, WATCH −5
 * - Each overdue scheduled check −3
 * - Clamp 0–100
 */
export function computeReadinessFromReadings(
  readings: ReadinessReadingInput[],
  overdueChecks: number | OverdueTaskInput[] = 0
): ReadinessScoreResult {
  const deductions: ReadinessDeduction[] = [];
  const hasTimestamps = readings.some((r) => typeof r.timestamp === 'number');
  const latestReadings = hasTimestamps ? pickLatestReadingsByIndicator(readings) : readings;

  for (const r of latestReadings) {
    const points = READINESS_PENALTIES[r.status] ?? 0;
    if (points > 0) {
      deductions.push({
        points,
        indicator: r.indicator,
        severity: r.status,
        kind: 'indicator',
        reason: r.reasons?.[0] || `${r.indicator} is ${r.status}`,
      });
    }
  }

  if (Array.isArray(overdueChecks)) {
    for (const task of overdueChecks) {
      deductions.push({
        points: READINESS_PENALTIES.OVERDUE_CHECK,
        kind: 'overdue',
        reason:
          typeof task.dueDay === 'number'
            ? `Overdue check: ${task.title} (Due Day ${task.dueDay})`
            : `Overdue check: ${task.title}`,
      });
    }
  } else if (overdueChecks > 0) {
    for (let i = 0; i < overdueChecks; i++) {
      deductions.push({
        points: READINESS_PENALTIES.OVERDUE_CHECK,
        kind: 'overdue',
        reason:
          overdueChecks === 1
            ? 'Overdue scheduled check'
            : `Overdue scheduled check #${i + 1}`,
      });
    }
  }

  return calculateReadiness(deductions);
}
