import { describe, it, expect } from 'vitest';
import {
  READINESS_PENALTIES,
  calculateReadiness,
  computeReadinessFromReadings,
} from './readiness';

describe('Readiness score engine per HALO_SPEC §7.9', () => {
  it('starts at 100 GO when all indicators are NOMINAL and zero checks are overdue', () => {
    const res = computeReadinessFromReadings(
      [
        { indicator: 'heart_rate', status: 'NOMINAL' },
        { indicator: 'spo2', status: 'NOMINAL' },
        { indicator: 'radiation', status: 'NOMINAL' },
      ],
      0
    );

    expect(res.score).toBe(100);
    expect(res.band).toBe('GO');
    expect(res.bandLabel).toBe('GO');
    expect(res.deductions).toHaveLength(0);
  });

  it('applies exact spec deductions: CRITICAL −30, ALERT −15, WATCH −5, overdue −3 each', () => {
    expect(READINESS_PENALTIES.CRITICAL).toBe(30);
    expect(READINESS_PENALTIES.ALERT).toBe(15);
    expect(READINESS_PENALTIES.WATCH).toBe(5);
    expect(READINESS_PENALTIES.OVERDUE_CHECK).toBe(3);

    const res = computeReadinessFromReadings(
      [
        { indicator: 'spo2', status: 'CRITICAL', reasons: ['SpO₂ 89% critically low'] },
        { indicator: 'sleep', status: 'ALERT', reasons: ['Sleep < 6 h for 3 days'] },
        { indicator: 'blood_pressure', status: 'WATCH', reasons: ['BP 126/78 mmHg borderline'] },
      ],
      [
        { title: 'PVT-B Reaction Task', dueDay: 141 },
        { title: 'Resting BP Check', dueDay: 140 },
      ]
    );

    // 100 - 30 - 15 - 5 - 3 - 3 = 44
    expect(res.score).toBe(44);
    expect(res.band).toBe('HOLD');
    expect(res.bandLabel).toBe('HOLD — consult CMO');
    expect(res.deductions).toHaveLength(5);
    expect(res.deductions.map((d) => d.points)).toEqual([30, 15, 5, 3, 3]);
    expect(res.deductions[1].reason).toBe('Sleep < 6 h for 3 days');
  });

  it('matches exact readiness bands: ≥80 GO, 60–79 GO WITH CAUTION, <60 HOLD', () => {
    // 100 - 15 - 5 = 80 -> GO
    const score80 = calculateReadiness([
      { points: 15, reason: 'ALERT' },
      { points: 5, reason: 'WATCH' },
    ]);
    expect(score80.score).toBe(80);
    expect(score80.band).toBe('GO');

    // 79 -> GO WITH CAUTION (100 - 15 - 6 = 79)
    const score79 = calculateReadiness([
      { points: 15, reason: 'ALERT' },
      { points: 3, reason: 'Overdue 1' },
      { points: 3, reason: 'Overdue 2' },
    ]);
    expect(score79.score).toBe(79);
    expect(score79.band).toBe('GO WITH CAUTION');
    expect(score79.bandLabel).toBe('GO WITH CAUTION');

    // 60 -> GO WITH CAUTION (100 - 30 - 5 - 5 = 60)
    const score60 = calculateReadiness([
      { points: 30, reason: 'CRITICAL' },
      { points: 5, reason: 'WATCH 1' },
      { points: 5, reason: 'WATCH 2' },
    ]);
    expect(score60.score).toBe(60);
    expect(score60.band).toBe('GO WITH CAUTION');

    // 59 -> HOLD (100 - 30 - 5 - 3 - 3 = 59)
    const score59 = calculateReadiness([
      { points: 30, reason: 'CRITICAL' },
      { points: 5, reason: 'WATCH' },
      { points: 3, reason: 'Overdue 1' },
      { points: 3, reason: 'Overdue 2' },
    ]);
    expect(score59.score).toBe(59);
    expect(score59.band).toBe('HOLD');
    expect(score59.bandLabel).toBe('HOLD — consult CMO');
  });

  it('clamps scores strictly within 0–100', () => {
    const low = computeReadinessFromReadings(
      [
        { indicator: 'heart_rate', status: 'CRITICAL' },
        { indicator: 'spo2', status: 'CRITICAL' },
        { indicator: 'blood_pressure', status: 'CRITICAL' },
        { indicator: 'radiation', status: 'CRITICAL' },
      ],
      5
    );
    expect(low.score).toBe(0);
    expect(low.band).toBe('HOLD');

    const high = calculateReadiness([]);
    expect(high.score).toBe(100);
  });

  it('uses only the latest valid reading per indicator and ignores POOR camera quality', () => {
    const res = computeReadinessFromReadings(
      [
        { indicator: 'heart_rate', status: 'ALERT', timestamp: 1000, reasons: ['Older transient spike'] },
        { indicator: 'heart_rate', status: 'NOMINAL', timestamp: 2000, reasons: ['Recovered to nominal'] },
        { indicator: 'heart_rate', status: 'CRITICAL', timestamp: 3000, quality: 'POOR', reasons: ['Motion artifact'] },
        { indicator: 'sleep', status: 'ALERT', timestamp: 2500, reasons: ['Sleep < 6 h for 3 days'] },
      ],
      1
    );

    // heart_rate resolved to NOMINAL (0), POOR ignored, sleep ALERT (-15), 1 overdue (-3) -> 82 GO
    expect(res.score).toBe(82);
    expect(res.band).toBe('GO');
    expect(res.deductions).toHaveLength(2);
  });
});
