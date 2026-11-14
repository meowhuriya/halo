import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../data/db';
import {
  computeEffectiveDelayMs,
  calculatePacketProgress,
  formatRemainingSeconds,
  transmitUplinkReply,
  checkAndDeliverPackets,
} from '../features/groundlink/groundLinkService';

describe('Ground Console & Split Link Telemetry (§7.12)', () => {
  beforeEach(async () => {
    await db.groundPackets.clear();
  });

  it('generates an Uplink directive from Earth flight surgeon with valid timestamps and delay', async () => {
    const oneWaySec = 846; // 14m 06s
    const sentAt = Date.now();
    const packet = await transmitUplinkReply({
      title: 'Flight Surgeon Advisory: Melatonin Authorized',
      message: 'Prescribe 0.5 mg melatonin. Enforce 8h sleep window.',
      author: 'Dr. Evelyn Reed (Flight Surgeon, NASA JSC)',
      oneWayDelaySeconds: oneWaySec,
      timeCompression: true,
      priority: 'NORMAL',
    });

    expect(packet.direction).toBe('uplink');
    expect(packet.type).toBe('REPLY');
    expect(packet.title).toContain('Flight Surgeon Advisory');
    expect(packet.payload.author).toBe('Dr. Evelyn Reed (Flight Surgeon, NASA JSC)');
    expect(packet.payload.message).toContain('0.5 mg melatonin');
    expect(packet.delivered).toBe(false);

    // With 30x compression: 846s * (2000/60) = 28200ms
    const expectedDelayMs = computeEffectiveDelayMs(oneWaySec, true);
    expect(expectedDelayMs).toBe(28200);
    expect(packet.arrivalAt).toBeGreaterThanOrEqual(sentAt + expectedDelayMs - 50);
  });

  it('tracks in-flight progress along Earth-Ship orbital arc from 0% to 100%', () => {
    const start = 100000;
    const end = 200000; // 100s duration

    expect(calculatePacketProgress(start, end, 100000)).toBe(0);
    expect(calculatePacketProgress(start, end, 150000)).toBe(50);
    expect(calculatePacketProgress(start, end, 175000)).toBe(75);
    expect(calculatePacketProgress(start, end, 200000)).toBe(100);
    expect(calculatePacketProgress(start, end, 250000)).toBe(100); // clamped at 100%

    expect(formatRemainingSeconds(65000)).toBe('1 min 05 s');
    expect(formatRemainingSeconds(25000)).toBe('25 s');
  });

  it('delivers uplink reply to ship inbox upon arrival timestamp passing', async () => {
    const now = Date.now();
    // Create an uplink packet that arrives 500ms in future
    await db.groundPackets.add({
      direction: 'uplink',
      priority: 'HIGH',
      type: 'REPLY',
      title: 'Emergency Response Order',
      payload: { message: 'Oxygen 4 L/min authorized.' },
      sentAt: now - 2000,
      arrivalAt: now + 500,
      delivered: false,
      read: false,
    });

    // Before arrival time: not delivered
    let delivered = await checkAndDeliverPackets(now);
    expect(delivered).toBe(0);

    // After arrival time: delivered
    delivered = await checkAndDeliverPackets(now + 600);
    expect(delivered).toBe(1);

    const saved = await db.groundPackets.filter((p) => p.direction === 'uplink').first();
    expect(saved?.delivered).toBe(true);
  });
});
