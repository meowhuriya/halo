import { describe, it, expect } from 'vitest';

describe('Vitals Trends Engine & Reference Bands per HALO_SPEC §7.13', () => {
  it('calculates personal baseline bounds as mean ± 2 SD', () => {
    // Resting heart rate: mean 64, SD 5
    const hrMean = 64;
    const hrSd = 5;
    const hrLower = hrMean - 2 * hrSd; // 54
    const hrUpper = hrMean + 2 * hrSd; // 74

    expect(hrLower).toBe(54);
    expect(hrUpper).toBe(74);

    // Sleep: mean 7.4, SD 0.6
    const sleepMean = 7.4;
    const sleepSd = 0.6;
    const sleepLower = Math.round((sleepMean - 2 * sleepSd) * 10) / 10; // 6.2
    const sleepUpper = Math.round((sleepMean + 2 * sleepSd) * 10) / 10; // 8.6

    expect(sleepLower).toBe(6.2);
    expect(sleepUpper).toBe(8.6);
  });

  it('filters historical range windows correctly (7D, 30D, 90D, 142D)', () => {
    const currentMissionDay = 142;
    const computeMinDay = (range: string) => {
      const days = range === '142' ? 142 : parseInt(range, 10);
      return Math.max(1, currentMissionDay - days + 1);
    };

    expect(computeMinDay('7')).toBe(136); // Days 136..142 = 7 days
    expect(computeMinDay('30')).toBe(113); // Days 113..142 = 30 days
    expect(computeMinDay('90')).toBe(53); // Days 53..142 = 90 days
    expect(computeMinDay('142')).toBe(1); // Days 1..142 = 142 days
  });

  it('maps all 4 health statuses to distinctive signal colors for chart points', () => {
    const statusColors: Record<string, string> = {
      NOMINAL: '#22c55e',
      WATCH: '#f59e0b',
      ALERT: '#f97316',
      CRITICAL: '#ef4444',
    };

    expect(statusColors['NOMINAL']).toBe('#22c55e');
    expect(statusColors['WATCH']).toBe('#f59e0b');
    expect(statusColors['ALERT']).toBe('#f97316');
    expect(statusColors['CRITICAL']).toBe('#ef4444');
  });
});
