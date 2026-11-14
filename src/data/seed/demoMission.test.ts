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

describe('Demo Mission Seed Verification per HALO_SPEC §7.15 (v3)', () => {
  beforeEach(async () => {
    await seedDemoMission();
  });

  it('asserts that the 142-day demo mission stories hold through the real rules engine', async () => {
    // 1. Verify Crew & Mission Day
    const activeCrew = await db.crewMembers.filter((c) => c.isCurrent).first();
    expect(activeCrew).toBeDefined();
    expect(activeCrew?.name).toBe('Dr. Alex Vance');

    const config = await db.missionConfig.get('current');
    expect(config?.missionDay).toBe(142);
    expect(config?.environmentId).toBe('transit');
    expect(config?.oneWayDelaySeconds).toBe(846); // 14 min 06 s
    expect(config?.timeCompression).toBe(true); // Default ON per §7.12

    // 2. Fetch seeded readings (142 days of history)
    const readings = await db.healthReadings.toArray();
    expect(readings.length).toBeGreaterThan(140); // 142 days of historical data

    // Verify Day 142 values
    const day142Readings = readings.filter((r) => r.missionDay === 142);
    const sleepReading = day142Readings.find((r) => r.indicator === 'sleep');
    const pvtReading = day142Readings.find((r) => r.indicator === 'pvt');
    const bpReading = day142Readings.find((r) => r.indicator === 'blood_pressure');
    const radReading = day142Readings.find((r) => r.indicator === 'radiation');
    const amslerDay135 = readings.find((r) => r.indicator === 'amsler' && r.missionDay === 135);

    expect(sleepReading).toBeDefined();
    expect(pvtReading).toBeDefined();
    expect(bpReading).toBeDefined();
    expect(radReading).toBeDefined();
    expect(amslerDay135).toBeDefined();

    // 3. Re-run real rules engine on each indicator to verify story holds:

    // Story 1 - Sleep: declining to ~5.5 h with 3+ consecutive days < 6 h -> ALERT
    const sleepEval = classifySleep(Number(sleepReading?.value), { consecutiveDaysUnder6: 3 });
    expect(sleepEval.status).toBe('ALERT');
    expect(sleepReading?.status).toBe('ALERT');

    // Story 2 - PVT: > 20% slower than baseline -> ALERT
    // Current value is 3.2 speed vs baseline 4.2 -> (4.2 - 3.2)/4.2 = 23.8% slower
    const pvtEval = classifyPvt(Number(pvtReading?.value), 4.2);
    expect(pvtEval.status).toBe('ALERT');
    expect(pvtReading?.status).toBe('ALERT');

    // Story 3 - BP: drifting upward last 10 days -> at least WATCH
    const bpVals = bpReading?.value as { systolic: number; diastolic: number };
    const bpEval = classifyBloodPressure(bpVals.systolic, bpVals.diastolic);
    expect(['WATCH', 'ALERT', 'CRITICAL']).toContain(bpEval.status);
    expect(bpReading?.status).toBe('WATCH');

    // Story 4 - Right-eye Amsler: new distortion on day 135 -> ALERT
    const amslerEval = classifyAmsler(true, true);
    expect(amslerEval.status).toBe('ALERT');
    expect(amslerDay135?.status).toBe('ALERT');

    // Story 5 - Radiation: nominal (< 50% career limit of 600 mSv) -> NOMINAL
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

  it('asserts that ground packets exist for Downlink outbox and Uplink inbox with arrival timestamps', async () => {
    const packets = await db.groundPackets.toArray();
    expect(packets.length).toBeGreaterThanOrEqual(4);

    // Downlink Packets
    const downlinks = packets.filter((p) => p.direction === 'downlink');
    expect(downlinks.length).toBeGreaterThanOrEqual(3);

    // Emergency SBAR incident packet exists
    const sbarPacket = downlinks.find((p) => p.type === 'INCIDENT');
    expect(sbarPacket).toBeDefined();
    expect(sbarPacket?.title).toContain('SBAR Incident');
    expect(sbarPacket?.priority).toBe('HIGH');
    expect(sbarPacket?.payload.sbar).toBeDefined();

    // Alert packet exists
    const alertPacket = downlinks.find((p) => p.type === 'ALERT');
    expect(alertPacket).toBeDefined();
    expect(alertPacket?.title).toContain('ALERT: Sleep Debt');

    // Daily summary packet exists
    const summaryPacket = downlinks.find((p) => p.type === 'SUMMARY');
    expect(summaryPacket).toBeDefined();
    expect(summaryPacket?.title).toContain('Daily Biometrics');

    // Uplink Inbox packet exists
    const uplinks = packets.filter((p) => p.direction === 'uplink');
    expect(uplinks.length).toBeGreaterThanOrEqual(1);
    const briefing = uplinks.find((p) => p.type === 'REPLY');
    expect(briefing).toBeDefined();
    expect(briefing?.title).toContain('Flight Surgeon Morning Briefing');

    // Every packet has sentAt and arrivalAt timestamps
    for (const p of packets) {
      expect(typeof p.sentAt).toBe('number');
      expect(typeof p.arrivalAt).toBe('number');
      expect(p.arrivalAt).toBeGreaterThanOrEqual(p.sentAt);
    }
  });
});
