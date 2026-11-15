import { describe, it, expect } from 'vitest';
import { computeValidationStats, toCsv } from './validationStats';

describe('validation statistics (§7.16)', () => {
  it('returns zeros with no data instead of inventing numbers', () => {
    const s = computeValidationStats([]);
    expect(s.n).toBe(0);
    expect(s.mae).toBe(0);
  });
  it('computes MAE, RMSE and % within ±5 bpm', () => {
    const s = computeValidationStats([
      { appBpm: 103, referenceBpm: 100 },
      { appBpm: 103, referenceBpm: 104 },
      { appBpm: 80, referenceBpm: 90 },
    ]);
    expect(s.n).toBe(3);
    expect(s.mae).toBeCloseTo((3 + 1 + 10) / 3, 5);
    expect(s.rmse).toBeCloseTo(Math.sqrt((9 + 1 + 100) / 3), 5);
    expect(s.within5Pct).toBeCloseTo(66.666, 1);
  });
  it('Bland-Altman limits bracket the bias', () => {
    const s = computeValidationStats([
      { appBpm: 72, referenceBpm: 70 },
      { appBpm: 68, referenceBpm: 70 },
    ]);
    expect(s.meanBias).toBeCloseTo(0, 5);
    expect(s.loaLow).toBeLessThan(0);
    expect(s.loaHigh).toBeGreaterThan(0);
  });
  it('exports CSV with a header row', () => {
    const csv = toCsv([{ a: 1, b: 'x,y' }]);
    expect(csv.split('\n')[0]).toBe('a,b');
    expect(csv).toContain('"x,y"');
  });
});
