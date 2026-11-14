import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../data/db';
import {
  computeEffectiveDelayMs,
  formatRemainingSeconds,
  calculatePacketProgress,
  checkAndDeliverPackets,
  transmitDownlinkPacket,
  transmitUplinkReply,
} from './groundLinkService';

describe('Ground Link Service & Time Compression per HALO_SPEC §7.12', () => {
  beforeEach(async () => {
    await db.groundPackets.clear();
  });

  it('computes effective delay accurately with and without demo time compression', () => {
    // Standard real-time delay (14 min 06 s = 846 s)
    expect(computeEffectiveDelayMs(846, false)).toBe(846000);

    // Spec §7.12: Demo time compression toggle: 1 min of light delay = 2 s real time
    // 60 s delay -> 2000 ms real time
    expect(computeEffectiveDelayMs(60, true)).toBe(2000);

    // 846 s delay -> 846 * (2 / 60) * 1000 = 28200 ms (28.2 s)
    expect(computeEffectiveDelayMs(846, true)).toBe(28200);

    // Zero delay
    expect(computeEffectiveDelayMs(0, false)).toBe(0);
    expect(computeEffectiveDelayMs(0, true)).toBe(0);
  });

  it('formats remaining seconds cleanly', () => {
    expect(formatRemainingSeconds(0)).toBe('0 s');
    expect(formatRemainingSeconds(15000)).toBe('15 s');
    expect(formatRemainingSeconds(75000)).toBe('1 min 15 s');
    expect(formatRemainingSeconds(125000)).toBe('2 min 05 s');
  });

  it('calculates in-flight packet progress percentage', () => {
    const sentAt = 100000;
    const arrivalAt = 200000;

    expect(calculatePacketProgress(sentAt, arrivalAt, 90000)).toBe(0);
    expect(calculatePacketProgress(sentAt, arrivalAt, 100000)).toBe(0);
    expect(calculatePacketProgress(sentAt, arrivalAt, 150000)).toBe(50);
    expect(calculatePacketProgress(sentAt, arrivalAt, 175000)).toBe(75);
    expect(calculatePacketProgress(sentAt, arrivalAt, 200000)).toBe(100);
    expect(calculatePacketProgress(sentAt, arrivalAt, 250000)).toBe(100);
  });

  it('delivers packets by timestamp on load/tick without losing in-flight packets (§7.12 v3)', async () => {
    const now = 1000000;

    // Packet 1: already arrived
    await db.groundPackets.add({
      direction: 'downlink',
      priority: 'HIGH',
      type: 'INCIDENT',
      title: 'Emergency SBAR',
      payload: { note: 'Chest pain' },
      sentAt: now - 30000,
      arrivalAt: now - 5000, // Arrived 5 s ago
      delivered: false,
      read: false,
    });

    // Packet 2: still in flight
    await db.groundPackets.add({
      direction: 'downlink',
      priority: 'NORMAL',
      type: 'SUMMARY',
      title: 'Daily Telemetry',
      payload: { note: 'Vitals nominal' },
      sentAt: now - 10000,
      arrivalAt: now + 20000, // Arrives in 20 s
      delivered: false,
      read: false,
    });

    // Check delivery at `now`
    const deliveredCount = await checkAndDeliverPackets(now);
    expect(deliveredCount).toBe(1);

    const p1 = (await db.groundPackets.toArray()).find((p) => p.title === 'Emergency SBAR');
    const p2 = (await db.groundPackets.toArray()).find((p) => p.title === 'Daily Telemetry');

    expect(p1?.delivered).toBe(true);
    expect(p2?.delivered).toBe(false);

    // Fast-forward 25 seconds: Packet 2 should now be delivered
    const secondPass = await checkAndDeliverPackets(now + 25000);
    expect(secondPass).toBe(1);

    const p2Updated = (await db.groundPackets.toArray()).find((p) => p.title === 'Daily Telemetry');
    expect(p2Updated?.delivered).toBe(true);
  });

  it('transmits downlink and uplink packets to Dexie with calculated arrival timestamps', async () => {
    const downlink = await transmitDownlinkPacket({
      title: 'Alert Notification: Sleep & PVT',
      type: 'ALERT',
      priority: 'HIGH',
      payload: { alertCount: 2 },
      oneWayDelaySeconds: 846,
      timeCompression: true,
    });

    expect(downlink.id).toBeDefined();
    expect(downlink.direction).toBe('downlink');
    expect(downlink.priority).toBe('HIGH');
    expect(downlink.delivered).toBe(false);
    expect(downlink.arrivalAt - downlink.sentAt).toBe(28200);

    const uplink = await transmitUplinkReply({
      title: 'Flight Surgeon Clinical Reply',
      message: 'Acknowledged SBAR. Release oral nitroglycerin protocol if available.',
      author: 'Dr. M. Stone (Flight Surgeon)',
      oneWayDelaySeconds: 846,
      timeCompression: true,
    });

    expect(uplink.id).toBeDefined();
    expect(uplink.direction).toBe('uplink');
    expect(uplink.type).toBe('REPLY');
    expect(uplink.arrivalAt - uplink.sentAt).toBe(28200);
  });
});
