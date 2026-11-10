import type { HealthStatus } from '../data/db';
import {
  maxStatus,
  roundWhole,
  roundOneDecimal,
  classifyHeartRate,
  classifyBloodPressure,
  classifySpO2,
  classifyTemperature,
  classifyGlucose,
  classifyRespiratoryRate,
  classifySleep,
  classifyRadiation,
  type RuleEvaluation,
} from '../config/thresholds';

export interface ReadingSample {
  value: number;
  timestamp: number; // ms timestamp or day
  isPreFlight?: boolean;
}

export interface BaselineProfile {
  indicator: string;
  mean: number;
  sd: number;
  effectiveSd: number;
  sampleCount: number;
  source: 'pre-flight' | 'nominal-flight';
}

/**
 * SD floors per indicator in real units per §6 (v3).
 * A percentage floor breaks temperature, so real units are mandatory.
 */
export const SD_FLOORS: Record<string, number> = {
  heart_rate: 3.0, // bpm
  resting_hr: 3.0,
  systolic_bp: 5.0, // mmHg
  diastolic_bp: 4.0, // mmHg
  spo2: 1.0, // %
  temperature: 0.2, // °C
  glucose: 8.0, // mg/dL
  respiratory_rate: 1.5, // /min
  sleep: 0.5, // hours
};

export function getSdFloor(indicator: string, baselineMean: number): number {
  if (indicator === 'pvt' || indicator === 'pvt_rt' || indicator === 'pvt_speed') {
    return 0.05 * baselineMean; // 5% of baseline mean
  }
  return SD_FLOORS[indicator] ?? 1.0;
}

/**
 * Compute personal baseline from historical readings per §6 (v3):
 * - Readings tagged "pre-flight" if at least 3 exist;
 * - Otherwise the first 5 readings that are themselves NOMINAL by the absolute table
 *   (an abnormal reading must never become part of "normal for you").
 */
export function computeBaseline(
  indicator: string,
  readings: ReadingSample[]
): BaselineProfile | null {
  if (!readings || readings.length === 0) return null;

  // 1. Check pre-flight readings
  const preFlightReadings = readings.filter((r) => r.isPreFlight);
  if (preFlightReadings.length >= 3) {
    return calculateProfile(indicator, preFlightReadings, 'pre-flight');
  }

  // 2. Otherwise filter for first 5 NOMINAL readings
  const nominalReadings: ReadingSample[] = [];
  for (const r of readings) {
    const absStatus = evaluateAbsoluteStatus(indicator, r.value);
    if (absStatus.status === 'NOMINAL') {
      nominalReadings.push(r);
      if (nominalReadings.length === 5) break;
    }
  }

  if (nominalReadings.length >= 3) {
    return calculateProfile(indicator, nominalReadings, 'nominal-flight');
  }

  return null;
}

function calculateProfile(
  indicator: string,
  samples: ReadingSample[],
  source: 'pre-flight' | 'nominal-flight'
): BaselineProfile {
  const values = samples.map((s) => s.value);
  const n = values.length;
  const mean = values.reduce((sum, v) => sum + v, 0) / n;

  // Sample standard deviation
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / Math.max(1, n - 1);
  const rawSd = Math.sqrt(variance);

  const floor = getSdFloor(indicator, mean);
  const effectiveSd = Math.max(rawSd, floor);

  return {
    indicator,
    mean: indicator === 'temperature' || indicator === 'sleep' ? roundOneDecimal(mean) : roundWhole(mean),
    sd: rawSd,
    effectiveSd,
    sampleCount: n,
    source,
  };
}

export function evaluateAbsoluteStatus(
  indicator: string,
  value: number,
  options?: { dia?: number; isPostMeal?: boolean; consecutiveDaysUnder6?: number; consecutiveDaysUnder4?: number }
): RuleEvaluation {
  switch (indicator) {
    case 'heart_rate':
    case 'resting_hr':
      return classifyHeartRate(value);
    case 'blood_pressure':
    case 'systolic_bp':
      return classifyBloodPressure(value, options?.dia ?? 75);
    case 'spo2':
      return classifySpO2(value);
    case 'temperature':
      return classifyTemperature(value);
    case 'glucose':
      return classifyGlucose(value, options?.isPostMeal);
    case 'respiratory_rate':
      return classifyRespiratoryRate(value);
    case 'sleep':
      return classifySleep(value, options);
    case 'radiation':
      return classifyRadiation(value);
    default:
      return { status: 'NOMINAL', reasons: [`${indicator} within nominal range`] };
  }
}

export interface BaselineEvaluationContext {
  indicator: string;
  currentValue: number;
  baseline: BaselineProfile;
  recentValues?: number[]; // last readings including current value
  recentHistory?: Array<{ day: number; value: number }>; // for 7-day linear trend
  gravityG?: number; // 0 for microgravity
  missionDay?: number;
}

/**
 * 7-Day linear trend calculation (least squares):
 * If projected value hits an ALERT boundary within 7 days → WATCH "trending toward...".
 */
export function calculate7DayTrend(
  history: Array<{ day: number; value: number }>
): { slope: number; projectedIn7Days: number } | null {
  if (!history || history.length < 3) return null;

  // Sort by day ascending
  const sorted = [...history].sort((a, b) => a.day - b.day);
  const n = sorted.length;
  const sumX = sorted.reduce((sum, p) => sum + p.day, 0);
  const sumY = sorted.reduce((sum, p) => sum + p.value, 0);
  const sumXY = sorted.reduce((sum, p) => sum + p.day * p.value, 0);
  const sumX2 = sorted.reduce((sum, p) => sum + p.day * p.day, 0);

  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return null;

  const slope = (n * sumXY - sumX * sumY) / denom;
  const lastVal = sorted[sorted.length - 1].value;
  const projectedIn7Days = lastVal + slope * 7;

  return { slope, projectedIn7Days };
}

/**
 * Full Personal Baseline Evaluation per §6 (v3):
 * - z = (value - mean) / SD (using per-indicator SD floor)
 * - WATCH "unusual for you" if |z| >= 3 on latest, OR |z| >= 2 on 2 of last 3 readings.
 * - For SpO2 and sleep only downward deviations count.
 * - Space-normal note for temperature at 0g, mission day > 30 in 37.3–37.9 WATCH band.
 * - 7-day linear trend projection hitting ALERT boundary -> WATCH "trending toward...".
 * - finalStatus = max(absolute status, baseline status).
 */
export function evaluateWithBaseline(context: BaselineEvaluationContext): RuleEvaluation {
  const { indicator, currentValue, baseline, recentValues = [currentValue], gravityG = 0, missionDay = 1 } = context;

  // 1. Compute absolute clinical status
  const absEval = evaluateAbsoluteStatus(indicator, currentValue);

  let baselineStatus: HealthStatus = 'NOMINAL';
  const baselineReasons: string[] = [];

  const z = (currentValue - baseline.mean) / baseline.effectiveSd;
  const zLatest = roundOneDecimal(z);

  // Direction rule: for SpO2 and sleep only downward deviations count
  const isDownwardOnly = indicator === 'spo2' || indicator === 'sleep';

  const isAnomaly = (val: number, threshold: number) => {
    const valZ = (val - baseline.mean) / baseline.effectiveSd;
    if (isDownwardOnly) {
      return valZ <= -threshold;
    }
    return Math.abs(valZ) >= threshold;
  };

  // Check |z| >= 3 on latest OR |z| >= 2 on 2 of last 3
  const latestAnomalous = isAnomaly(currentValue, 3);

  const last3 = recentValues.slice(-3);
  const countZ2 = last3.filter((v) => isAnomaly(v, 2)).length;
  const multiReadingAnomalous = countZ2 >= 2;

  if (latestAnomalous || multiReadingAnomalous) {
    baselineStatus = 'WATCH';
    const sign = zLatest >= 0 ? '+' : '';
    baselineReasons.push(
      `Resting ${indicator.replace('_', ' ')} ${currentValue} is unusual for you (baseline ${baseline.mean} ± ${roundOneDecimal(baseline.effectiveSd)}, z = ${sign}${zLatest})`
    );
  }

  // 2. 7-Day Linear Trend check
  if (context.recentHistory && context.recentHistory.length >= 3) {
    const trend = calculate7DayTrend(context.recentHistory);
    if (trend) {
      const proj = trend.projectedIn7Days;
      const projAbs = evaluateAbsoluteStatus(indicator, proj);
      if (projAbs.status === 'ALERT' || projAbs.status === 'CRITICAL') {
        if (baselineStatus === 'NOMINAL') {
          baselineStatus = 'WATCH';
        }
        baselineReasons.push(
          `Trending toward alert boundary within 7 days (projected: ${proj > 0 ? proj.toFixed(1) : proj})`
        );
      }
    }
  }

  // 3. Final status = max(absolute status, baseline status)
  const finalStatus = maxStatus(absEval.status, baselineStatus);
  const reasons = [...absEval.reasons, ...baselineReasons];

  // 4. Space-normal note per §6 (v3):
  // resting core temperature rises gradually by ~1 °C in long-duration flight.
  // When gravity is 0 g, mission day > 30 and temperature is in the 37.3–37.9 WATCH band:
  if (
    indicator === 'temperature' &&
    gravityG === 0 &&
    missionDay > 30 &&
    currentValue >= 37.3 &&
    currentValue <= 37.9
  ) {
    reasons.push(
      'A slightly raised resting temperature is common in long-duration flight — compare with your in-flight trend.'
    );
  }

  return {
    status: finalStatus,
    reasons,
  };
}
