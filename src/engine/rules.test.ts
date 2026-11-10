import { describe, it, expect } from 'vitest';
import { evaluateReading, getActionGuidance } from './rules';
import type { BaselineProfile } from './baseline';

describe('Rules Engine & Guidance per §6 and §7.4', () => {
  it('Phase 2 Acceptance Criterion: entering BP 150/95 shows ALERT with a reason', () => {
    const result = evaluateReading({
      indicator: 'blood_pressure',
      value: 150,
      options: { dia: 95 },
    });

    expect(result.status).toBe('ALERT');
    expect(result.reasons.length).toBeGreaterThan(0);
    expect(result.reasons.some((r) => r.includes('150/95'))).toBe(true);
    expect(result.formattedValue).toBe('150/95 mmHg');
    expect(result.guidance.recommendedSteps.length).toBeGreaterThan(0);
  });

  it('Phase 2 Acceptance Criterion: 5 normal HR entries then 85 bpm (baseline 62 ± 3) shows WATCH "unusual for you"', () => {
    const baseline: BaselineProfile = {
      indicator: 'heart_rate',
      mean: 62,
      sd: 2,
      effectiveSd: 3.0, // Per-indicator SD floor = 3 bpm
      sampleCount: 5,
      source: 'nominal-flight',
    };

    const result = evaluateReading({
      indicator: 'heart_rate',
      value: 85,
      baseline,
      recentValues: [62, 62, 63, 62, 85],
    });

    expect(result.status).toBe('WATCH');
    expect(result.reasons.some((r) => r.includes('unusual for you'))).toBe(true);
    expect(result.baselineComparison?.zScore).toBeCloseTo(7.7, 1);
    expect(result.baselineComparison?.isUnusual).toBe(true);
  });

  it('generates appropriate clinical guidance per status and indicator', () => {
    const critBp = getActionGuidance('blood_pressure', 'CRITICAL', 190, { dia: 125 });
    expect(critBp.cmoAlertRequired).toBe(true);
    expect(critBp.immediateAction).toContain('Hypertensive emergency');

    const alertSpo2 = getActionGuidance('spo2', 'ALERT', 92);
    expect(alertSpo2.cmoAlertRequired).toBe(false);
    expect(alertSpo2.immediateAction).toContain('oxygen desaturation');

    const nominalHr = getActionGuidance('heart_rate', 'NOMINAL', 72);
    expect(nominalHr.cmoAlertRequired).toBe(false);
    expect(nominalHr.immediateAction).toContain('Nominal parameters');
  });

  it('evaluates complex indicators with options', () => {
    // Fasting glucose 150 -> WATCH
    const fastingGluc = evaluateReading({
      indicator: 'glucose',
      value: 150,
      options: { isPostMeal: false },
    });
    expect(fastingGluc.status).toBe('WATCH');

    // Post-meal glucose 150 -> NOMINAL
    const postMealGluc = evaluateReading({
      indicator: 'glucose',
      value: 150,
      options: { isPostMeal: true },
    });
    expect(postMealGluc.status).toBe('NOMINAL');

    // Sleep 5.5h with 3 consecutive days under 6 -> ALERT
    const sleepAlert = evaluateReading({
      indicator: 'sleep',
      value: 5.5,
      options: { consecutiveDaysUnder6: 3 },
    });
    expect(sleepAlert.status).toBe('ALERT');

    // PHQ-2 score 3 -> ALERT
    const phqAlert = evaluateReading({
      indicator: 'phq2',
      value: 3,
    });
    expect(phqAlert.status).toBe('ALERT');
  });
});
