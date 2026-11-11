// Quality thresholds per §7.3 step 8
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

/** Check if brightness is acceptable per §7.3 step 1 */
export function isBrightnessAcceptable(brightness: number): boolean {
  return brightness >= QUALITY_THRESHOLDS.MIN_BRIGHTNESS
    && brightness <= QUALITY_THRESHOLDS.MAX_BRIGHTNESS;
}

/** Get human-readable quality advice */
export function getQualityAdvice(quality: SignalQuality, motionFraction: number, brightness: number): string {
  if (motionFraction > 0.20) return 'Too much movement. Hold still and try again.';
  if (brightness < QUALITY_THRESHOLDS.MIN_BRIGHTNESS) return 'Too dark. Face a light source.';
  if (brightness > QUALITY_THRESHOLDS.MAX_BRIGHTNESS) return 'Too bright. Avoid direct sunlight on your face.';
  if (quality === 'POOR') return 'Signal quality too low. Ensure good lighting and stay still.';
  if (quality === 'FAIR') return 'Acceptable signal. For better accuracy, improve lighting.';
  return 'Good signal quality.';
}
