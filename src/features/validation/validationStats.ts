/** Accuracy statistics for paired readings (§7.16). Pure functions, unit-tested. */
export interface Pair { appBpm: number; referenceBpm: number }

export interface ValidationStats {
  n: number;
  mae: number;          // mean absolute error, bpm
  rmse: number;         // root mean square error, bpm
  within5Pct: number;   // % of pairs with |error| ≤ 5 bpm
  meanBias: number;     // mean (app − reference)
  loaLow: number;       // Bland-Altman limits of agreement: bias ± 1.96·SD
  loaHigh: number;
}

export function computeValidationStats(pairs: Pair[]): ValidationStats {
  const n = pairs.length;
  if (n === 0) return { n: 0, mae: 0, rmse: 0, within5Pct: 0, meanBias: 0, loaLow: 0, loaHigh: 0 };
  const diffs = pairs.map((p) => p.appBpm - p.referenceBpm);
  const mae = diffs.reduce((s, d) => s + Math.abs(d), 0) / n;
  const rmse = Math.sqrt(diffs.reduce((s, d) => s + d * d, 0) / n);
  const within5Pct = (diffs.filter((d) => Math.abs(d) <= 5).length / n) * 100;
  const meanBias = diffs.reduce((s, d) => s + d, 0) / n;
  const sd = n > 1 ? Math.sqrt(diffs.reduce((s, d) => s + (d - meanBias) ** 2, 0) / (n - 1)) : 0;
  return { n, mae, rmse, within5Pct, meanBias, loaLow: meanBias - 1.96 * sd, loaHigh: meanBias + 1.96 * sd };
}

export function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return '';
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}
