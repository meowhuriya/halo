import type { HealthStatus } from '../data/db';
import {
  classifyBloodPressure,
  classifyGlucose,
  classifySleep,
  classifyPhq2,
  classifyGad2,
  classifyPvt,
  classifyAmsler,
  classifyOrthostatic,
  type RuleEvaluation,
} from '../config/thresholds';
import {
  evaluateWithBaseline,
  evaluateAbsoluteStatus,
  type BaselineProfile,
} from './baseline';

export type { RuleEvaluation };

export interface ActionGuidance {
  immediateAction: string;
  recommendedSteps: string[];
  cmoAlertRequired: boolean;
}

export interface ComprehensiveEvaluation extends RuleEvaluation {
  indicator: string;
  formattedValue: string;
  guidance: ActionGuidance;
  baselineComparison?: {
    mean: number;
    effectiveSd: number;
    zScore: number;
    isUnusual: boolean;
  };
}

export interface EvaluateReadingInput {
  indicator: string;
  value: number;
  options?: {
    dia?: number;
    isPostMeal?: boolean;
    consecutiveDaysUnder6?: number;
    consecutiveDaysUnder4?: number;
    currentSpeed?: number;
    baselineSpeed?: number;
    currentLapses?: number;
    baselineLapses?: number;
    hasDistortion?: boolean;
    isNewDistortion?: boolean;
    suddenLargeLoss?: boolean;
    sysChange?: number;
    diaChange?: number;
    hrChange?: number;
    nearFaint?: boolean;
    notes?: string;
  };
  baseline?: BaselineProfile | null;
  recentValues?: number[];
  recentHistory?: Array<{ day: number; value: number }>;
  gravityG?: number;
  missionDay?: number;
}

/**
 * Actionable operational recommendations for each indicator and clinical status per §7.4.
 */
export function getActionGuidance(
  indicator: string,
  status: HealthStatus,
  value: number,
  _options?: EvaluateReadingInput['options']
): ActionGuidance {
  if (status === 'CRITICAL') {
    if (indicator === 'blood_pressure') {
      return {
        immediateAction: 'Hypertensive emergency protocol. Rest supine with head elevated 30°.',
        recommendedSteps: [
          'Alert Crew Medical Officer (CMO) immediately.',
          'Re-check BP manually in 5 minutes on alternate arm.',
          'Check for acute neurological symptoms (headache, vision changes, chest pain).',
          'Downlink telemetry to Flight Surgeon on Earth.',
        ],
        cmoAlertRequired: true,
      };
    }
    if (indicator === 'spo2') {
      return {
        immediateAction: 'Acute severe hypoxemia. Don emergency oxygen mask immediately.',
        recommendedSteps: [
          'Switch oxygen delivery to emergency mask setting per habitat checklist.',
          'Alert CMO and verify module atmospheric pO2 and pCO2 readings.',
          'Maintain seated rest; re-evaluate SpO2 continuously.',
        ],
        cmoAlertRequired: true,
      };
    }
    if (indicator === 'heart_rate') {
      return {
        immediateAction: 'Severe tachycardia/bradycardia. Cease all physical activity immediately.',
        recommendedSteps: [
          'Lie down in medical restraint; maintain airway and calm breathing.',
          'Alert CMO and prepare Automated External Defibrillator (AED) in monitoring mode.',
          'Verify pulse rhythm and record 12-lead ECG if payload allows.',
        ],
        cmoAlertRequired: true,
      };
    }
    if (indicator === 'temperature') {
      return {
        immediateAction: 'Severe hyperthermia/hypothermia. Begin thermal stabilization.',
        recommendedSteps: [
          'If ≥ 39.5 °C: Active cooling, remove thermal flight layer, hydrate with cool fluids.',
          'If < 35.0 °C: Apply passive rewarming thermal blanket, drink warm liquids.',
          'Notify CMO for infectious / environmental workup.',
        ],
        cmoAlertRequired: true,
      };
    }
    if (indicator === 'glucose') {
      return {
        immediateAction: 'Critical glycemic crisis (< 54 or > 250 mg/dL).',
        recommendedSteps: [
          value < 54
            ? 'Consume 15–20g rapid-acting oral glucose gel or fruit juice immediately.'
            : 'Hydrate copiously with water. Re-check ketones if test strips available.',
          'Alert CMO immediately for medical protocol intervention.',
          'Re-test capillary glucose in 15 minutes.',
        ],
        cmoAlertRequired: true,
      };
    }
    return {
      immediateAction: 'Critical vital parameter detected. Rest and alert CMO immediately.',
      recommendedSteps: [
        'Cease current operations and rest in quarters.',
        'Notify Crew Medical Officer immediately.',
        'High-priority packet queued to Flight Surgeon.',
      ],
      cmoAlertRequired: true,
    };
  }

  if (status === 'ALERT') {
    if (indicator === 'blood_pressure') {
      return {
        immediateAction: 'Blood pressure in hypertension alert range. Rest quietly.',
        recommendedSteps: [
          'Sit quietly for 5 minutes with feet flat and arm supported at heart level.',
          'Ensure no recent caffeine, decongestants, or intense resistive exercise.',
          'Repeat measurement in 10 minutes; if sustained, inform CMO.',
        ],
        cmoAlertRequired: false,
      };
    }
    if (indicator === 'spo2') {
      return {
        immediateAction: 'Mild-to-moderate oxygen desaturation (91–92%).',
        recommendedSteps: [
          'Warm fingers and confirm proper sensor alignment.',
          'Take 5 slow, deep breaths and re-test.',
          'Check cabin ventilation airflow in your current module.',
        ],
        cmoAlertRequired: false,
      };
    }
    if (indicator === 'sleep') {
      return {
        immediateAction: 'Cumulative sleep debt detected (< 6h for 3+ days or acute < 4h).',
        recommendedSteps: [
          'Protect an 8.5-hour sleep opportunity in sound-insulated crew quarters.',
          'Shift non-critical mission tasks and review sleep hygiene.',
          'Cognitive vigilance may be compromised; avoid solo hazardous EVAs.',
        ],
        cmoAlertRequired: false,
      };
    }
    if (indicator === 'phq2' || indicator === 'gad2') {
      return {
        immediateAction: 'Elevated behavioral health screen score (≥ 3).',
        recommendedSteps: [
          'Schedule a private psychological conference with Flight Surgeon / CMO.',
          'Connect with Earth family audio downlink or crew peer support.',
          'Adjust workload pace and schedule sensory recreation.',
        ],
        cmoAlertRequired: false,
      };
    }
    return {
      immediateAction: 'Vital parameter in ALERT band. Monitor and repeat measurement.',
      recommendedSteps: [
        'Rest and eliminate external physical stressors.',
        'Re-test in 15 minutes to confirm trajectory.',
        'Notify CMO if readings remain elevated or symptoms emerge.',
      ],
      cmoAlertRequired: false,
    };
  }

  if (status === 'WATCH') {
    return {
      immediateAction: 'Borderline or unusual variation detected. Logged for trend tracking.',
      recommendedSteps: [
        'Compare with your personal baseline and in-flight trajectory.',
        'Maintain normal hydration and planned nutritional intake.',
        'Re-evaluate during your next routine scheduled protocol check.',
      ],
      cmoAlertRequired: false,
    };
  }

  // NOMINAL
  return {
    immediateAction: 'Nominal parameters. Physiological status optimal for flight duties.',
    recommendedSteps: [
      'Reading logged to mission health record.',
      'Maintain scheduled countermeasure exercise and hydration.',
      'Next check as scheduled on mission orbit ring.',
    ],
    cmoAlertRequired: false,
  };
}

/**
 * Unified evaluation function integrating clinical thresholds and personal baseline logic.
 */
export function evaluateReading(input: EvaluateReadingInput): ComprehensiveEvaluation {
  const { indicator, value, options, baseline, recentValues, recentHistory, gravityG = 0, missionDay = 1 } = input;

  let evalResult: RuleEvaluation;

  // If baseline is available and indicator supports personal baseline z-scores
  if (baseline && baseline.sampleCount >= 3) {
    evalResult = evaluateWithBaseline({
      indicator,
      currentValue: value,
      baseline,
      recentValues: recentValues && recentValues.length > 0 ? recentValues : [value],
      recentHistory,
      gravityG,
      missionDay,
    });
  } else {
    // Specialized multi-parameter indicators
    if (indicator === 'blood_pressure') {
      evalResult = classifyBloodPressure(value, options?.dia ?? 75);
    } else if (indicator === 'glucose') {
      evalResult = classifyGlucose(value, options?.isPostMeal ?? false);
    } else if (indicator === 'sleep') {
      evalResult = classifySleep(value, {
        consecutiveDaysUnder6: options?.consecutiveDaysUnder6,
        consecutiveDaysUnder4: options?.consecutiveDaysUnder4,
      });
    } else if (indicator === 'phq2') {
      evalResult = classifyPhq2(value);
    } else if (indicator === 'gad2') {
      evalResult = classifyGad2(value);
    } else if (indicator === 'pvt') {
      evalResult = classifyPvt(
        options?.currentSpeed ?? value,
        options?.baselineSpeed ?? 4.0,
        options?.currentLapses ?? 0,
        options?.baselineLapses ?? 0
      );
    } else if (indicator === 'amsler') {
      evalResult = classifyAmsler(
        options?.hasDistortion ?? false,
        options?.isNewDistortion ?? false,
        options?.suddenLargeLoss ?? false
      );
    } else if (indicator === 'orthostatic') {
      evalResult = classifyOrthostatic(
        options?.sysChange ?? 0,
        options?.diaChange ?? 0,
        options?.hrChange ?? 0,
        options?.nearFaint ?? false
      );
    } else {
      evalResult = evaluateAbsoluteStatus(indicator, value, options);
    }
  }

  // Format value for display
  let formattedValue = `${value}`;
  if (indicator === 'blood_pressure') {
    formattedValue = `${Math.round(value)}/${Math.round(options?.dia ?? 75)} mmHg`;
  } else if (indicator === 'heart_rate') {
    formattedValue = `${Math.round(value)} bpm`;
  } else if (indicator === 'spo2') {
    formattedValue = `${Math.round(value)}%`;
  } else if (indicator === 'temperature') {
    formattedValue = `${value.toFixed(1)} °C`;
  } else if (indicator === 'glucose') {
    formattedValue = `${Math.round(value)} mg/dL`;
  } else if (indicator === 'respiratory_rate') {
    formattedValue = `${Math.round(value)} /min`;
  } else if (indicator === 'sleep') {
    formattedValue = `${value.toFixed(1)} h`;
  } else if (indicator === 'radiation') {
    formattedValue = `${value.toFixed(1)} mSv`;
  }

  const guidance = getActionGuidance(indicator, evalResult.status, value, options);

  let baselineComparison: ComprehensiveEvaluation['baselineComparison'];
  if (baseline) {
    const z = (value - baseline.mean) / baseline.effectiveSd;
    baselineComparison = {
      mean: baseline.mean,
      effectiveSd: baseline.effectiveSd,
      zScore: Math.round(z * 10) / 10,
      isUnusual: Math.abs(z) >= 2,
    };
  }

  return {
    ...evalResult,
    indicator,
    formattedValue,
    guidance,
    baselineComparison,
  };
}

// Backwards-compatibility helper
export function evaluateVitalsStatus(
  indicator: string,
  value: number,
  options?: { dia?: number; isPostMeal?: boolean; consecutiveDaysUnder6?: number; consecutiveDaysUnder4?: number }
): RuleEvaluation {
  return evaluateAbsoluteStatus(indicator, value, options);
}
