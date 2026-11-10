export interface ReadinessDeduction {
  reason: string;
  points: number;
}

export interface ReadinessScoreResult {
  score: number;
  band: 'GO' | 'GO WITH CAUTION' | 'HOLD';
  deductions: ReadinessDeduction[];
}

/**
 * Readiness score (§7.9):
 * Start 100.
 * Per indicator: CRITICAL −30, ALERT −15, WATCH −5.
 * Each overdue scheduled check −3.
 * Clamp 0–100.
 * Bands: ≥ 80 GO, 60–79 GO WITH CAUTION, < 60 HOLD — consult CMO.
 */
export function calculateReadiness(deductions: ReadinessDeduction[]): ReadinessScoreResult {
  const totalDeductions = deductions.reduce((sum, d) => sum + d.points, 0);
  const score = Math.max(0, Math.min(100, 100 - totalDeductions));

  let band: 'GO' | 'GO WITH CAUTION' | 'HOLD' = 'GO';
  if (score < 60) band = 'HOLD';
  else if (score < 80) band = 'GO WITH CAUTION';

  return { score, band, deductions };
}

export function computeReadinessFromReadings(
  readings: Array<{ indicator: string; status: 'NOMINAL' | 'WATCH' | 'ALERT' | 'CRITICAL'; reasons?: string[] }>,
  overdueTasksCount = 0
): ReadinessScoreResult {
  const deductions: ReadinessDeduction[] = [];

  for (const r of readings) {
    if (r.status === 'CRITICAL') {
      deductions.push({ points: 30, reason: r.reasons?.[0] || `${r.indicator} is CRITICAL (−30)` });
    } else if (r.status === 'ALERT') {
      deductions.push({ points: 15, reason: r.reasons?.[0] || `${r.indicator} is ALERT (−15)` });
    } else if (r.status === 'WATCH') {
      deductions.push({ points: 5, reason: r.reasons?.[0] || `${r.indicator} is WATCH (−5)` });
    }
  }

  if (overdueTasksCount > 0) {
    deductions.push({
      points: overdueTasksCount * 3,
      reason: `${overdueTasksCount} overdue scheduled check(s) (−${overdueTasksCount * 3})`,
    });
  }

  return calculateReadiness(deductions);
}
