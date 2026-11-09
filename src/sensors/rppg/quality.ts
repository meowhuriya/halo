// Quality thresholds per §7.3
export const QUALITY_THRESHOLDS = {
  GOOD_SNR_DB: 3.0,
  FAIR_SNR_DB: 0.0,
  MAX_MOTION_PERCENT: 20,
  MIN_BRIGHTNESS: 60,
  MAX_BRIGHTNESS: 200,
};

export type SignalQuality = 'GOOD' | 'FAIR' | 'POOR';

export function evaluateQuality(snrDb: number, motionFraction: number): SignalQuality {
  if (motionFraction > 0.20 || snrDb < QUALITY_THRESHOLDS.FAIR_SNR_DB) {
    return 'POOR';
  }
  if (snrDb >= QUALITY_THRESHOLDS.GOOD_SNR_DB) {
    return 'GOOD';
  }
  return 'FAIR';
}
