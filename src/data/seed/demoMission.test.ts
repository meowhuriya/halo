import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db';
import { seedDemoMission } from './demoMission';
import {
  classifySleep,
  classifyPvt,
  classifyBloodPressure,
  classifyAmsler,
  classifyRadiation,
} from '../../config/thresholds';
import { computeReadinessFromReadings } from '../../engine/readiness';

describe('Demo Mission Seed Verification per §7.15 (v3)', () => {
  beforeEach(async () => {
    await seedDemoMission();
  });

  it('asserts that the demo mission stories hold through the real rules engine (v3)', async () => {
    // 1. Verify Crew & Mission Day
    const activeCrew = await db.crewMembers.filter((c) => c.isCurrent).first();
    expect(activeCrew).toBeDefined();
    expect(activeCrew?.name).toBe('Dr. Alex Vance');

    const config = await db.missionConfig.get('current');
    expect(config?.missionDay).toBe(142);
    expect(config?.environmentId).toBe('transit');
    expect(config?.oneWayDelaySeconds).toBe(846); // 14 min 06 s

    // 2. Fetch seeded readings
    const readings = await db.healthReadings.toArray();
    expect(readings.length).toBeGreaterThan(0);

    const sleepReading = readings.find((r) => r.indicator === 'sleep');
    const pvtReading = readings.find((r) => r.indicator === 'pvt');
    const bpReading = readings.find((r) => r.indicator === 'blood_pressure');
    const amslerReading = readings.find((r) => r.indicator === 'amsler');
    const radReading = readings.find((r) => r.indicator === 'radiation');

    expect(sleepReading).toBeDefined();
    expect(pvtReading).toBeDefined();
    expect(bpReading).toBeDefined();
    expect(amslerReading).toBeDefined();
    expect(radReading).toBeDefined();

    // 3. Re-run real rules engine on each indicator to verify story holds:

    // Sleep: declining to ~5.5 h with 3+ consecutive days < 6 h -> ALERT
    const sleepEval = classifySleep(Number(sleepReading?.value), { consecutiveDaysUnder6: 3 });
    expect(sleepEval.status).toBe('ALERT');
    expect(sleepReading?.status).toBe('ALERT');

    // PVT: > 20% slower than baseline -> ALERT
    // Current value is 3.2 speed vs baseline 4.2 -> (4.2 - 3.2)/4.2 = 23.8% slower
    const pvtEval = classifyPvt(Number(pvtReading?.value), 4.2);
    expect(pvtEval.status).toBe('ALERT');
    expect(pvtReading?.status).toBe('ALERT');

    // BP: drifting upward last 10 days -> at least WATCH
    const bpVals = bpReading?.value as { systolic: number; diastolic: number };
    const bpEval = classifyBloodPressure(bpVals.systolic, bpVals.diastolic);
    expect(['WATCH', 'ALERT', 'CRITICAL']).toContain(bpEval.status);
    expect(bpReading?.status).toBe('WATCH');

    // Right-eye Amsler: new distortion on day 135 -> ALERT
    const amslerEval = classifyAmsler(true, true);
    expect(amslerEval.status).toBe('ALERT');
    expect(amslerReading?.status).toBe('ALERT');

    // Radiation: nominal (< 50% career limit of 600 mSv) -> NOMINAL
    const radEval = classifyRadiation(Number(radReading?.value));
    expect(radEval.status).toBe('NOMINAL');
    expect(radReading?.status).toBe('NOMINAL');

    // 4. Readiness score: with ALERTs in sleep, PVT, amsler, and WATCH in BP, readiness must be below 80
    const latestMap = new Map<string, { indicator: string; status: any }>();
    for (const r of readings) {
      latestMap.set(r.indicator, { indicator: r.indicator, status: r.status });
    }
    const readiness = computeReadinessFromReadings(Array.from(latestMap.values()), 0);
    expect(readiness.score).toBeLessThan(80);
    expect(readiness.score).toBeGreaterThan(0);
    expect(readiness.band).not.toBe('GO'); // Below 80 cannot be 'GO'
  });
});
