import { describe, it, expect } from 'vitest';
import { getAutonomyLevel, formatCommDelay, ENVIRONMENTS } from './environments';

describe('Mission Environments & Autonomy Engine', () => {
  it('correctly categorizes autonomy levels per §5', () => {
    // delay < 5 s → "Ground-supported"
    expect(getAutonomyLevel(0.8)).toBe('Ground-supported');
    expect(getAutonomyLevel(4.9)).toBe('Ground-supported');

    // 5 s–5 min (300 s) → "Delayed support"
    expect(getAutonomyLevel(5)).toBe('Delayed support');
    expect(getAutonomyLevel(120)).toBe('Delayed support');
    expect(getAutonomyLevel(300)).toBe('Delayed support');

    // > 5 min → "Autonomous"
    expect(getAutonomyLevel(301)).toBe('Autonomous');
    expect(getAutonomyLevel(846)).toBe('Autonomous'); // Mars Transit 14 min 06 s
    expect(getAutonomyLevel(1320)).toBe('Autonomous'); // Mars 22 min
  });

  it('formats one-way communication delay accurately for UI chips', () => {
    expect(formatCommDelay(0.5)).toBe('< 1 s');
    expect(formatCommDelay(1.3)).toBe('1.3 s');
    expect(formatCommDelay(45)).toBe('45.0 s');
    expect(formatCommDelay(846)).toBe('14 min 06 s');
    expect(formatCommDelay(180)).toBe('3 min 00 s');
  });

  it('contains valid configurations for all 5 mission environments', () => {
    const envIds = ['iss', 'transit', 'moon', 'mars', 'rover'] as const;
    
    for (const id of envIds) {
      const env = ENVIRONMENTS[id];
      expect(env).toBeDefined();
      expect(env.id).toBe(id);
      expect(typeof env.gravityG).toBe('number');
      expect(typeof env.radiationDoseRatePerDay).toBe('number');
      expect(env.equipment).toBeDefined();
    }

    // Verify Rover sortie equipment restrictions per §5
    expect(ENVIRONMENTS.rover.equipment.bpCuff).toBe(false);
    expect(ENVIRONMENTS.rover.equipment.glucometer).toBe(false);
    expect(ENVIRONMENTS.rover.equipment.thermometer).toBe(true);
    expect(ENVIRONMENTS.rover.equipment.pulseOx).toBe(true);
  });
});
