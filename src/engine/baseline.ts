export interface BaselineStats {
  mean: number;
  sd: number;
  sampleCount: number;
}

/**
 * Personal baseline calculation per §6:
 * - First 5 readings form baseline: mean and SD (SD floor = 5% of mean).
 * - z = (value - mean) / SD.
 */
export function calculateZScore(value: number, baseline: BaselineStats): number {
  const sdFloor = Math.max(baseline.sd, baseline.mean * 0.05);
  return (value - baseline.mean) / sdFloor;
}
