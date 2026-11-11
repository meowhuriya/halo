import { describe, it, expect } from 'vitest';
import {
  PVT_DURATION_MS,
  PVT_LAPSE_THRESHOLD_MS,
  PVT_FALSE_START_THRESHOLD_MS,
  generateRandomIsiMs,
  classifyPvtResponse,
  scorePvtSession,
  computePvtDeviceBaseline,
  evaluatePvtSession,
  type PvtTrialRecord,
  type PvtSessionSummary,
} from './pvtScoring';

describe('PVT-B Scoring & Same-Device Baseline (§7.5)', () => {
  it('enforces exact 3-minute test duration and spec threshold constants', () => {
    expect(PVT_DURATION_MS).toBe(180_000);
    expect(PVT_LAPSE_THRESHOLD_MS).toBe(355);
    expect(PVT_FALSE_START_THRESHOLD_MS).toBe(100);
  });

  it('generates inter-stimulus intervals within 1,000–4,000 ms', () => {
    expect(generateRandomIsiMs(() => 0)).toBe(1000);
    expect(generateRandomIsiMs(() => 1)).toBe(4000);
    expect(generateRandomIsiMs(() => 0.5)).toBe(2500);
  });

  it('classifies responses around the 100 ms false-start and 355 ms lapse boundaries', () => {
    // No stimulus active -> false start
    expect(classifyPvtResponse(null, 500)).toMatchObject({
      kind: 'false_start_nostim',
      rtMs: null,
    });

    // < 100 ms -> anticipatory false start
    expect(classifyPvtResponse(1000, 1099.9)).toMatchObject({
      kind: 'false_start_early',
      rtMs: 99.9,
    });

    // Exactly 100 ms -> valid response (not false start)
    expect(classifyPvtResponse(1000, 1100)).toMatchObject({
      kind: 'valid',
      rtMs: 100,
    });

    // 354.9 ms -> valid (just under 355 ms lapse cutoff)
    expect(classifyPvtResponse(1000, 1354.9)).toMatchObject({
      kind: 'valid',
      rtMs: 354.9,
    });

    // Exactly 355 ms -> lapse (RT >= 355 ms)
    expect(classifyPvtResponse(1000, 1355)).toMatchObject({
      kind: 'lapse',
      rtMs: 355,
    });

    // 620 ms -> lapse
    expect(classifyPvtResponse(2000, 2620)).toMatchObject({
      kind: 'lapse',
      rtMs: 620,
    });
  });

  it('computes mean speed (1/RT), median RT, lapses, false starts, and lapses+false starts accurately', () => {
    const trials: PvtTrialRecord[] = [
      classifyPvtResponse(null, 300), // false start (no stimulus)
      classifyPvtResponse(1000, 1080), // 80 ms -> false start (early)
      classifyPvtResponse(2000, 2200), // 200 ms -> valid (speed = 5.0 1/s)
      classifyPvtResponse(4000, 4250), // 250 ms -> valid (speed = 4.0 1/s)
      classifyPvtResponse(6000, 6400), // 400 ms -> lapse (speed = 2.5 1/s)
      classifyPvtResponse(9000, 9500), // 500 ms -> lapse (speed = 2.0 1/s)
    ];

    const metrics = scorePvtSession(trials, 'dev-laptop-1');
    // Valid + lapse RTs: [200, 250, 400, 500]
    // Mean speed = (5.0 + 4.0 + 2.5 + 2.0) / 4 = 3.375
    // Median RT = (250 + 400) / 2 = 325 ms
    // Mean RT = (200 + 250 + 400 + 500) / 4 = 337.5 ms
    expect(metrics.validTrialCount).toBe(4);
    expect(metrics.lapses).toBe(2);
    expect(metrics.falseStarts).toBe(2);
    expect(metrics.lapsesAndFalseStarts).toBe(4);
    expect(metrics.meanSpeed).toBe(3.375);
    expect(metrics.medianRtMs).toBe(325);
    expect(metrics.meanRtMs).toBe(337.5);
    expect(metrics.deviceId).toBe('dev-laptop-1');
  });

  it('excludes sessions from other devices when computing baseline', () => {
    const makeSession = (
      timestamp: number,
      deviceId: string,
      meanSpeed: number,
      lapses: number
    ): PvtSessionSummary => ({
      timestamp,
      missionDay: 1,
      deviceId,
      meanSpeed,
      medianRtMs: Math.round(1000 / meanSpeed),
      meanRtMs: Math.round(1000 / meanSpeed),
      lapses,
      falseStarts: 0,
      lapsesAndFalseStarts: lapses,
      validTrialCount: 25,
      totalResponses: 25,
      durationMs: PVT_DURATION_MS,
      status: 'NOMINAL',
      reasons: [],
    });

    const sessions: PvtSessionSummary[] = [
      // 3 fast sessions on phone
      makeSession(100, 'dev-phone-a', 4.8, 0),
      makeSession(200, 'dev-phone-a', 4.7, 0),
      makeSession(300, 'dev-phone-a', 4.6, 1),
      // Only 2 sessions on tablet so far -> not enough baseline yet
      makeSession(400, 'dev-tablet-b', 3.5, 1),
      makeSession(500, 'dev-tablet-b', 3.6, 1),
    ];

    expect(computePvtDeviceBaseline(sessions, 'dev-tablet-b')).toBeNull();

    // Add 3rd and 4th sessions on tablet
    sessions.push(makeSession(600, 'dev-tablet-b', 3.7, 1));
    sessions.push(makeSession(700, 'dev-tablet-b', 2.0, 6)); // 4th session should NOT alter first-3 baseline

    const tabletBaseline = computePvtDeviceBaseline(sessions, 'dev-tablet-b');
    expect(tabletBaseline).not.toBeNull();
    expect(tabletBaseline?.deviceId).toBe('dev-tablet-b');
    expect(tabletBaseline?.baselineSpeed).toBe(3.6); // (3.5 + 3.6 + 3.7) / 3
    expect(tabletBaseline?.baselineLapses).toBe(1);
  });

  it('evaluates status via §6 rules against same-device baseline', () => {
    const baseline = {
      deviceId: 'dev-1',
      baselineSpeed: 4.0,
      baselineLapses: 1,
      baselineMedianRtMs: 250,
      sessionCount: 3,
    };

    // Pending baseline (<3 sessions) -> NOMINAL
    const pendingMetrics = scorePvtSession(
      [classifyPvtResponse(1000, 1450)],
      'dev-1'
    );
    expect(evaluatePvtSession(pendingMetrics, null).status).toBe('NOMINAL');

    // Within 10% speed (3.8 vs 4.0 = 5% slower), lapses 1 -> NOMINAL
    const nominalEval = evaluatePvtSession(
      { ...pendingMetrics, meanSpeed: 3.8, lapses: 1 },
      baseline
    );
    expect(nominalEval.status).toBe('NOMINAL');

    // 15% slower (3.4 vs 4.0) -> WATCH
    const watchSpeedEval = evaluatePvtSession(
      { ...pendingMetrics, meanSpeed: 3.4, lapses: 1 },
      baseline
    );
    expect(watchSpeedEval.status).toBe('WATCH');

    // Normal speed but lapses >= baseline + 3 (4 >= 1 + 3) -> WATCH
    const watchLapseEval = evaluatePvtSession(
      { ...pendingMetrics, meanSpeed: 3.9, lapses: 4 },
      baseline
    );
    expect(watchLapseEval.status).toBe('WATCH');

    // >20% slower (3.1 vs 4.0 = 22.5% slower) -> ALERT
    const alertEval = evaluatePvtSession(
      { ...pendingMetrics, meanSpeed: 3.1, lapses: 2 },
      baseline
    );
    expect(alertEval.status).toBe('ALERT');
  });
});
