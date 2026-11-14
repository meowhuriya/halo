import { db, type GroundPacket } from '../../data/db';

export const DOWNLINK_CHANNEL_NAME = 'halo-downlink';

/**
 * Compute effective communication delay in milliseconds considering demo time compression.
 * Spec §7.12: Demo time compression: 1 minute of light delay = 2 seconds real time (30x speedup).
 */
export function computeEffectiveDelayMs(
  oneWayDelaySeconds: number,
  timeCompression: boolean
): number {
  if (oneWayDelaySeconds <= 0) return 0;
  if (timeCompression) {
    // 60 s delay -> 2000 ms real time
    return Math.round(oneWayDelaySeconds * (2000 / 60));
  }
  return Math.round(oneWayDelaySeconds * 1000);
}

/**
 * Format in-flight remaining time.
 */
export function formatRemainingSeconds(remainingMs: number): string {
  const safeSec = Math.max(0, Math.ceil(remainingMs / 1000));
  const mins = Math.floor(safeSec / 60);
  const secs = safeSec % 60;
  if (mins === 0) return `${secs} s`;
  return `${mins} min ${String(secs).padStart(2, '0')} s`;
}

/**
 * Calculate in-flight progress percentage (0 to 100).
 */
export function calculatePacketProgress(
  sentAt: number,
  arrivalAt: number,
  now: number = Date.now()
): number {
  if (arrivalAt <= sentAt) return 100;
  if (now >= arrivalAt) return 100;
  if (now <= sentAt) return 0;
  const elapsed = now - sentAt;
  const total = arrivalAt - sentAt;
  return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
}

let channelInstance: BroadcastChannel | null = null;

export function getGroundBroadcastChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || !('BroadcastChannel' in window)) {
    return null;
  }
  if (!channelInstance) {
    channelInstance = new BroadcastChannel(DOWNLINK_CHANNEL_NAME);
  }
  return channelInstance;
}

export function broadcastGroundEvent(event: {
  type: 'PACKET_TRANSMITTED' | 'PACKET_DELIVERED' | 'REPLY_SENT';
  packetId?: number;
  timestamp: number;
}): void {
  const channel = getGroundBroadcastChannel();
  if (channel) {
    try {
      channel.postMessage(event);
    } catch {
      // BroadcastChannel post failure graceful handle
    }
  }
}

/**
 * Timestamp-based packet delivery check per HALO_SPEC §7.12 (v3):
 * Delivers anything whose arrivalAt has passed. Never relies on long setTimeout.
 * A refresh will not lose or duplicate packets.
 */
export async function checkAndDeliverPackets(now: number = Date.now()): Promise<number> {
  const undelivered = await db.groundPackets
    .filter((p) => !p.delivered)
    .toArray();

  let newlyDeliveredCount = 0;

  for (const packet of undelivered) {
    const arrival = packet.arrivalAt ?? (packet as unknown as { arrivesAt?: number }).arrivesAt;
    if (arrival && now >= arrival) {
      await db.groundPackets.update(packet.id!, {
        delivered: true,
      });
      newlyDeliveredCount++;
      broadcastGroundEvent({
        type: 'PACKET_DELIVERED',
        packetId: packet.id,
        timestamp: now,
      });
    }
  }

  return newlyDeliveredCount;
}

/**
 * Transmit a Downlink packet from Ship to Earth.
 */
export async function transmitDownlinkPacket(params: {
  title: string;
  type: GroundPacket['type'];
  priority: GroundPacket['priority'];
  payload: Record<string, unknown>;
  oneWayDelaySeconds: number;
  timeCompression: boolean;
}): Promise<GroundPacket> {
  const now = Date.now();
  const delayMs = computeEffectiveDelayMs(params.oneWayDelaySeconds, params.timeCompression);
  const arrivalAt = now + delayMs;

  const packet: Omit<GroundPacket, 'id'> = {
    direction: 'downlink',
    priority: params.priority,
    type: params.type,
    title: params.title,
    payload: params.payload,
    sentAt: now,
    arrivalAt,
    delivered: delayMs === 0, // instantaneous if 0 delay
    read: false,
  };

  const id = await db.groundPackets.add(packet as GroundPacket);
  const fullPacket: GroundPacket = { ...packet, id: id as number };

  broadcastGroundEvent({
    type: 'PACKET_TRANSMITTED',
    packetId: id as number,
    timestamp: now,
  });

  return fullPacket;
}

/**
 * Transmit an Uplink reply packet from Earth Ground Console to Ship.
 */
export async function transmitUplinkReply(params: {
  title: string;
  message: string;
  author: string;
  oneWayDelaySeconds: number;
  timeCompression: boolean;
  priority?: GroundPacket['priority'];
}): Promise<GroundPacket> {
  const now = Date.now();
  const delayMs = computeEffectiveDelayMs(params.oneWayDelaySeconds, params.timeCompression);
  const arrivalAt = now + delayMs;

  const packet: Omit<GroundPacket, 'id'> = {
    direction: 'uplink',
    priority: params.priority || 'NORMAL',
    type: 'REPLY',
    title: params.title,
    payload: {
      author: params.author,
      message: params.message,
      sentAtDate: new Date(now).toISOString(),
    },
    sentAt: now,
    arrivalAt,
    delivered: delayMs === 0,
    read: false,
  };

  const id = await db.groundPackets.add(packet as GroundPacket);
  const fullPacket: GroundPacket = { ...packet, id: id as number };

  broadcastGroundEvent({
    type: 'REPLY_SENT',
    packetId: id as number,
    timestamp: now,
  });

  return fullPacket;
}
