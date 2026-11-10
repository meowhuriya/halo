import { describe, it, expect } from 'vitest';
import {
  computeBaseline,
  evaluateWithBaseline,
  getSdFloor,
  SD_FLOORS,
  type ReadingSample,
  type BaselineProfile,
} from './baseline';

describe('Personal Baseline Layer & Rules Engine per §6 (v3)', () => {
  it('enforces per-indicator SD floors in real units (v3)', () => {
    expect(SD_FLOORS.heart_rate).toBe(3.0);
    expect(SD_FLOORS.systolic_bp).toBe(5.0);
    expect(SD_FLOORS.diastolic_bp).toBe(4.0);
    expect(SD_FLOORS.spo2).toBe(1.0);
    expect(SD_FLOORS.temperature).toBe(0.2);
    expect(SD_FLOORS.glucose).toBe(8.0);
    expect(SD_FLOORS.respiratory_rate).toBe(1.5);
    expect(SD_FLOORS.sleep).toBe(0.5);

    // PVT: 5% of baseline mean
    expect(getSdFloor('pvt_rt', 200)).toBe(10); // 0.05 * 200 = 10ms
  });

  it('computes baseline from pre-flight readings if >= 3 exist', () => {
    const readings: ReadingSample[] = [
      { value: 60, timestamp: 1, isPreFlight: true },
      { value: 62, timestamp: 2, isPreFlight: true },
      { value: 64, timestamp: 3, isPreFlight: true },
      { value: 120, timestamp: 4, isPreFlight: false }, // should be ignored
    ];

    const baseline = computeBaseline('heart_rate', readings);
    expect(baseline).not.toBeNull();
    expect(baseline?.source).toBe('pre-flight');
    expect(baseline?.mean).toBe(62);
    expect(baseline?.sampleCount).toBe(3);
  });

  it('computes baseline from first 5 NOMINAL readings, excluding abnormal ones', () => {
    const readings: ReadingSample[] = [
      { value: 60, timestamp: 1 },
      { value: 62, timestamp: 2 },
      { value: 140, timestamp: 3 }, // CRITICAL - must be excluded!
      { value: 64, timestamp: 4 },
      { value: 115, timestamp: 5 }, // ALERT - must be excluded!
      { value: 63, timestamp: 6 },
      { value: 61, timestamp: 7 },
      { value: 70, timestamp: 8 }, // 6th nominal, ignored
    ];

    const baseline = computeBaseline('heart_rate', readings);
    expect(baseline).not.toBeNull();
    expect(baseline?.source).toBe('nominal-flight');
    expect(baseline?.sampleCount).toBe(5);
    // Values: 60, 62, 64, 63, 61 -> Mean 62
    expect(baseline?.mean).toBe(62);
  });

  it('applies SD floor when sample variation is extremely small', () => {
    // 5 identical readings (raw SD = 0)
    const readings: ReadingSample[] = [
      { value: 62, timestamp: 1 },
      { value: 62, timestamp: 2 },
      { value: 62, timestamp: 3 },
      { value: 62, timestamp: 4 },
      { value: 62, timestamp: 5 },
    ];

    const baseline = computeBaseline('heart_rate', readings);
    expect(baseline?.sd).toBe(0);
    // Effective SD clamped to floor of 3 bpm
    expect(baseline?.effectiveSd).toBe(3.0);
  });

  it('triggers WATCH "unusual for you" on 5 normal HR entries then 85 bpm (baseline 62 ± 3) per §8', () => {
    const baseline: BaselineProfile = {
      indicator: 'heart_rate',
      mean: 62,
      sd: 2,
      effectiveSd: 3.0, // Floor 3 bpm
      sampleCount: 5,
      source: 'nominal-flight',
    };

    // 85 bpm: clinically 85 bpm is NOMINAL (50–100 bpm),
    // BUT z = (85 - 62)/3.0 = +7.67 (>= 3)
    const evalResult = evaluateWithBaseline({
      indicator: 'heart_rate',
      currentValue: 85,
      baseline,
      recentValues: [62, 62, 63, 62, 85],
    });

    expect(evalResult.status).toBe('WATCH');
    expect(evalResult.reasons.some((r) => r.includes('unusual for you'))).toBe(true);
  });

  it('triggers WATCH if |z| >= 2 on 2 of the last 3 readings', () => {
    const baseline: BaselineProfile = {
      indicator: 'heart_rate',
      mean: 60,
      sd: 3.0,
      effectiveSd: 3.0,
      sampleCount: 5,
      source: 'nominal-flight',
    };

    // z = +2.0 at 66 bpm.
    // 66 is clinically NOMINAL, and |z| = 2.0 (< 3, so single reading alone won't trigger).
    // But with 2 of last 3 readings at 67 and 66 bpm (|z| >= 2.0), it triggers WATCH.
    const evalResult = evaluateWithBaseline({
      indicator: 'heart_rate',
      currentValue: 66,
      baseline,
      recentValues: [60, 67, 66],
    });

    expect(evalResult.status).toBe('WATCH');
    expect(evalResult.reasons.some((r) => r.includes('unusual for you'))).toBe(true);
  });

  it('enforces downward-only rule for SpO₂ and sleep (upward deviations do not flag)', () => {
    const sleepBaseline: BaselineProfile = {
      indicator: 'sleep',
      mean: 7.5,
      sd: 0.5,
      effectiveSd: 0.5,
      sampleCount: 5,
      source: 'nominal-flight',
    };

    // Upward deviation: slept 9.5 hours (z = +4.0)
    // Should NOT flag as anomalous because upward sleep deviation is not a risk
    const upwardSleep = evaluateWithBaseline({
      indicator: 'sleep',
      currentValue: 9.5,
      baseline: sleepBaseline,
      recentValues: [7.5, 7.5, 9.5],
    });
    expect(upwardSleep.status).toBe('NOMINAL');

    // Downward deviation: slept 5.8 hours (z = (5.8 - 7.5)/0.5 = -3.4 <= -3)
    // Triggers WATCH "unusual for you"
    const downwardSleep = evaluateWithBaseline({
      indicator: 'sleep',
      currentValue: 5.8,
      baseline: sleepBaseline,
      recentValues: [7.5, 7.5, 5.8],
    });
    expect(downwardSleep.status).toBe('WATCH');
    expect(downwardSleep.reasons.some((r) => r.includes('unusual for you'))).toBe(true);
  });

  it('appends space-normal note for temperature when 0g, mission day > 30 in 37.3–37.9 WATCH band', () => {
    const tempBaseline: BaselineProfile = {
      indicator: 'temperature',
      mean: 36.6,
      sd: 0.2,
      effectiveSd: 0.2,
      sampleCount: 5,
      source: 'nominal-flight',
    };

    const evalResult = evaluateWithBaseline({
      indicator: 'temperature',
      currentValue: 37.5,
      baseline: tempBaseline,
      gravityG: 0,
      missionDay: 45,
    });

    expect(evalResult.status).toBe('WATCH');
    expect(
      evalResult.reasons.some((r) =>
        r.includes('A slightly raised resting temperature is common in long-duration flight')
      )
    ).toBe(true);
  });

  it('detects 7-day linear trend heading toward ALERT boundary', () => {
    const bpBaseline: BaselineProfile = {
      indicator: 'systolic_bp',
      mean: 115,
      sd: 5,
      effectiveSd: 5,
      sampleCount: 5,
      source: 'nominal-flight',
    };

    // Current systolic 122 (NOMINAL clinically if dia < 80, but drifting upward by 1.5 mmHg/day)
    // In 7 days: 122 + 1.5*7 = 132.5 mmHg (hits ALERT boundary >= 130)
    const history = [
      { day: 1, value: 116 },
      { day: 3, value: 119 },
      { day: 5, value: 122 },
    ];

    const evalResult = evaluateWithBaseline({
      indicator: 'systolic_bp',
      currentValue: 122,
      baseline: bpBaseline,
      recentHistory: history,
    });

    expect(evalResult.status).toBe('WATCH');
    expect(evalResult.reasons.some((r) => r.includes('Trending toward alert boundary'))).toBe(true);
  });

  it('ensures absolute CRITICAL always overrides baseline status', () => {
    const hrBaseline: BaselineProfile = {
      indicator: 'heart_rate',
      mean: 62,
      sd: 4,
      effectiveSd: 4,
      sampleCount: 5,
      source: 'nominal-flight',
    };

    // HR 135 bpm is absolute CRITICAL (> 130)
    const evalResult = evaluateWithBaseline({
      indicator: 'heart_rate',
      currentValue: 135,
      baseline: hrBaseline,
    });

    expect(evalResult.status).toBe('CRITICAL');
  });
});
