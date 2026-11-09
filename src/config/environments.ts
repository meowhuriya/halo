export interface EquipmentFlags {
  bpCuff: boolean;
  glucometer: boolean;
  thermometer: boolean;
  pulseOx: boolean;
  ultrasound: boolean;
  oct: boolean;
  aed: boolean;
}

export type EnvironmentId = 'iss' | 'transit' | 'moon' | 'mars' | 'rover';

export type AutonomyLevel = 'Ground-supported' | 'Delayed support' | 'Autonomous';

export interface MissionEnvironment {
  id: EnvironmentId;
  name: string;
  shortName: string;
  gravityG: number; // in g
  defaultDelaySeconds: number; // in seconds
  minDelaySeconds?: number;
  maxDelaySeconds?: number;
  isVariableDelay: boolean;
  radiationDoseRatePerDay: number; // mSv/day approx
  radiationSourceNote: string;
  equipment: EquipmentFlags;
  hasGravityTransitionCheck: boolean;
  description: string;
}

export const ENVIRONMENTS: Record<EnvironmentId, MissionEnvironment> = {
  iss: {
    id: 'iss',
    name: 'Space Station (LEO)',
    shortName: 'ISS (LEO)',
    gravityG: 0,
    defaultDelaySeconds: 1, // < 1 s
    isVariableDelay: false,
    radiationDoseRatePerDay: 0.5,
    radiationSourceNote: 'Approx. 0.5 mSv/day published ISS average',
    equipment: {
      bpCuff: true,
      glucometer: true,
      thermometer: true,
      pulseOx: true,
      ultrasound: true,
      oct: true,
      aed: true,
    },
    hasGravityTransitionCheck: false,
    description: 'Low Earth Orbit microgravity habitat with real-time ground flight surgeon telemetry link.',
  },
  transit: {
    id: 'transit',
    name: 'Deep-Space Transit to Mars',
    shortName: 'Mars Transit',
    gravityG: 0,
    defaultDelaySeconds: 840, // 14 min default (3 - 22 min range)
    minDelaySeconds: 180, // 3 min
    maxDelaySeconds: 1320, // 22 min
    isVariableDelay: true,
    radiationDoseRatePerDay: 1.8,
    radiationSourceNote: 'Approx. 1.8 mSv/day (Curiosity RAD cruise phase measurement)',
    equipment: {
      bpCuff: true,
      glucometer: true,
      thermometer: true,
      pulseOx: true,
      ultrasound: true,
      oct: false,
      aed: true,
    },
    hasGravityTransitionCheck: false,
    description: 'Interplanetary cruise in deep space with zero gravity, high galactic cosmic radiation, and significant speed-of-light comms latency.',
  },
  moon: {
    id: 'moon',
    name: 'Lunar Surface Base',
    shortName: 'Moon Base',
    gravityG: 0.166,
    defaultDelaySeconds: 1.3,
    isVariableDelay: false,
    radiationDoseRatePerDay: 1.37,
    radiationSourceNote: "Approx. 1.37 mSv/day (Chang'e-4 LND surface measurement)",
    equipment: {
      bpCuff: true,
      glucometer: true,
      thermometer: true,
      pulseOx: true,
      ultrasound: false,
      oct: false,
      aed: true,
    },
    hasGravityTransitionCheck: true,
    description: 'Lunar south pole habitat with 1/6th Earth gravity, extreme regolith dust, and 1.3s one-way ground communication.',
  },
  mars: {
    id: 'mars',
    name: 'Mars Surface Base',
    shortName: 'Mars Surface',
    gravityG: 0.38,
    defaultDelaySeconds: 840, // 14 min (3-22 min range)
    minDelaySeconds: 180,
    maxDelaySeconds: 1320,
    isVariableDelay: true,
    radiationDoseRatePerDay: 0.64,
    radiationSourceNote: 'Approx. 0.64 mSv/day (Curiosity RAD surface measurement)',
    equipment: {
      bpCuff: true,
      glucometer: true,
      thermometer: true,
      pulseOx: true,
      ultrasound: true,
      oct: false,
      aed: true,
    },
    hasGravityTransitionCheck: true,
    description: 'Permanent outpost on the Martian surface with 0.38g gravity, thin CO2 atmosphere, and variable planetary alignment delay.',
  },
  rover: {
    id: 'rover',
    name: 'Pressurized Rover Sortie',
    shortName: 'Rover Sortie',
    gravityG: 0.38, // inherits either moon or mars, default mars
    defaultDelaySeconds: 840,
    minDelaySeconds: 180,
    maxDelaySeconds: 1320,
    isVariableDelay: true,
    radiationDoseRatePerDay: 0.64,
    radiationSourceNote: 'Sortie expedition dosimeter average',
    equipment: {
      bpCuff: false,
      glucometer: false,
      thermometer: true,
      pulseOx: true,
      ultrasound: false,
      oct: false,
      aed: false,
    },
    hasGravityTransitionCheck: true,
    description: 'Field exploration vehicle beyond habitat perimeter. Portable equipment only: thermometer and pulse oximeter.',
  },
};

/**
 * Autonomy level calculator based on one-way comms delay:
 * - delay < 5 s → "Ground-supported": ALERTs auto-notify ground.
 * - 5 s–5 min (300 s) → "Delayed support": HALO gives full local guidance first, ground notified.
 * - > 5 min → "Autonomous": Ground cannot respond in time for emergencies.
 */
export function getAutonomyLevel(delaySeconds: number): AutonomyLevel {
  if (delaySeconds < 5) {
    return 'Ground-supported';
  }
  if (delaySeconds <= 300) {
    return 'Delayed support';
  }
  return 'Autonomous';
}

export function formatCommDelay(delaySeconds: number): string {
  if (delaySeconds < 60) {
    return `${delaySeconds < 1 ? '< 1' : delaySeconds.toFixed(1)} s`;
  }
  const mins = Math.floor(delaySeconds / 60);
  const secs = Math.round(delaySeconds % 60);
  return `${mins} min ${secs.toString().padStart(2, '0')} s`;
}
