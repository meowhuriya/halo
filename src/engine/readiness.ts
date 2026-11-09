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
 * CRITICAL -30, ALERT -15, WATCH -5. Overdue checks -3.
 * Bands: >= 80 GO, 60–79 GO WITH CAUTION, < 60 HOLD.
 */
export function calculateReadiness(deductions: ReadinessDeduction[]): ReadinessScoreResult {
  const totalDeductions = deductions.reduce((sum, d) => sum + d.points, 0);
  const score = Math.max(0, Math.min(100, 100 - totalDeductions));

  let band: 'GO' | 'GO WITH CAUTION' | 'HOLD' = 'GO';
  if (score < 60) band = 'HOLD';
  else if (score < 80) band = 'GO WITH CAUTION';

  return { score, band, deductions };
}
