import type { HealthStatus } from '../data/db';

export interface IndicatorRange {
  indicator: string;
  unit: string;
  nominal: string;
  watch: string;
  alert: string;
  critical: string;
}

export interface RuleEvaluation {
  status: HealthStatus;
  reasons: string[];
}

export const STATUS_PRECEDENCE: Record<HealthStatus, number> = {
  NOMINAL: 1,
  WATCH: 2,
  ALERT: 3,
  CRITICAL: 4,
};

export function maxStatus(a: HealthStatus, b: HealthStatus): HealthStatus {
  return STATUS_PRECEDENCE[a] >= STATUS_PRECEDENCE[b] ? a : b;
}

// Precision rounding helpers per §6 No-gap rule (v3)
export function roundWhole(val: number): number {
  return Math.round(val);
}

export function roundOneDecimal(val: number): number {
  return Math.round(val * 10) / 10;
}

export const CLINICAL_THRESHOLDS: Record<string, IndicatorRange> = {
  heartRate: {
    indicator: 'Resting heart rate',
    unit: 'bpm',
    nominal: '50–100',
    watch: '40–49 or 101–110',
    alert: '111–130',
    critical: '< 40 or > 130',
  },
  bloodPressure: {
    indicator: 'Blood pressure (sys/dia)',
    unit: 'mmHg',
    nominal: 'sys 90–119 and dia < 80',
    watch: 'sys 120–129 and dia < 80',
    alert: 'sys 130–180 or dia 80–120; or sys < 90',
    critical: 'sys > 180 or dia > 120',
  },
  spo2: {
    indicator: 'SpO₂',
    unit: '%',
    nominal: '≥ 95',
    watch: '93–94',
    alert: '91–92',
    critical: '≤ 90',
  },
  temperature: {
    indicator: 'Body temperature',
    unit: '°C',
    nominal: '36.1–37.2',
    watch: '37.3–37.9 or 35.5–36.0',
    alert: '38.0–39.4 or 35.0–35.4',
    critical: '≥ 39.5 or < 35.0',
  },
  glucose: {
    indicator: 'Blood glucose',
    unit: 'mg/dL',
    nominal: '70–140 (70–180 post-meal)',
    watch: '141–180 (not post-meal) or 54–69',
    alert: '181–250',
    critical: '< 54 or > 250',
  },
  respiratoryRate: {
    indicator: 'Respiratory rate',
    unit: '/min',
    nominal: '12–20',
    watch: '21–24 or 10–11',
    alert: '25–29',
    critical: '< 10 or ≥ 30',
  },
  sleep: {
    indicator: 'Sleep (24 h)',
    unit: 'hours',
    nominal: '≥ 7',
    watch: '6–6.9, or a single day < 6',
    alert: '< 6 for 3+ consecutive days, or a single day < 4',
    critical: '< 4 for 2+ consecutive days',
  },
  radiation: {
    indicator: 'Cumulative radiation',
    unit: 'mSv',
    nominal: '< 300 (< 50% limit)',
    watch: '300–479 (50–79% limit)',
    alert: '480–599 (80–99% limit)',
    critical: '≥ 600 (NASA 2022 career limit 600 mSv)',
  },
};

/**
 * 1. Resting Heart Rate
 * NOMINAL: 50–100
 * WATCH: 40–49 or 101–110
 * ALERT: 111–130
 * CRITICAL: < 40 or > 130
 */
export function classifyHeartRate(rawBpm: number): RuleEvaluation {
  const bpm = roundWhole(rawBpm);
  if (bpm < 40 || bpm > 130) {
    return {
      status: 'CRITICAL',
      reasons: [`Resting HR ${bpm} bpm is critical (< 40 or > 130 bpm)`],
    };
  }
  if (bpm >= 111 && bpm <= 130) {
    return {
      status: 'ALERT',
      reasons: [`Resting HR ${bpm} bpm is elevated in alert band (111–130 bpm)`],
    };
  }
  if ((bpm >= 40 && bpm <= 49) || (bpm >= 101 && bpm <= 110)) {
    return {
      status: 'WATCH',
      reasons: [`Resting HR ${bpm} bpm is in borderline watch band (40–49 or 101–110 bpm)`],
    };
  }
  return {
    status: 'NOMINAL',
    reasons: [`Resting HR ${bpm} bpm is within nominal clinical limits (50–100 bpm)`],
  };
}

/**
 * 2. Blood Pressure (sys/dia)
 * NOMINAL: sys 90–119 and dia < 80
 * WATCH: sys 120–129 and dia < 80
 * ALERT: sys 130–180 or dia 80–120; or sys < 90
 * CRITICAL: sys > 180 or dia > 120
 */
export function classifyBloodPressure(rawSys: number, rawDia: number): RuleEvaluation {
  const sys = roundWhole(rawSys);
  const dia = roundWhole(rawDia);

  // Status precedence: CRITICAL > ALERT > WATCH > NOMINAL
  if (sys > 180 || dia > 120) {
    return {
      status: 'CRITICAL',
      reasons: [`BP ${sys}/${dia} mmHg exceeds hypertensive emergency limit (sys > 180 or dia > 120)`],
    };
  }

  if (sys < 90) {
    return {
      status: 'ALERT',
      reasons: [`BP ${sys}/${dia} mmHg shows hypotension (systolic < 90 mmHg)`],
    };
  }

  if ((sys >= 130 && sys <= 180) || (dia >= 80 && dia <= 120)) {
    return {
      status: 'ALERT',
      reasons: [`BP ${sys}/${dia} mmHg is in stage 1/2 hypertension alert range (sys 130–180 or dia 80–120)`],
    };
  }

  if (sys >= 120 && sys <= 129 && dia < 80) {
    return {
      status: 'WATCH',
      reasons: [`BP ${sys}/${dia} mmHg is elevated watch range (sys 120–129 and dia < 80)`],
    };
  }

  if (sys >= 90 && sys <= 119 && dia < 80) {
    return {
      status: 'NOMINAL',
      reasons: [`BP ${sys}/${dia} mmHg is within nominal healthy limits (sys 90–119 and dia < 80)`],
    };
  }

  return {
    status: 'ALERT',
    reasons: [`BP ${sys}/${dia} mmHg is outside nominal boundaries`],
  };
}

/**
 * 3. SpO₂
 * NOMINAL: ≥ 95
 * WATCH: 93–94
 * ALERT: 91–92
 * CRITICAL: ≤ 90
 */
export function classifySpO2(rawSpo2: number): RuleEvaluation {
  const spo2 = roundWhole(rawSpo2);
  if (spo2 <= 90) {
    return {
      status: 'CRITICAL',
      reasons: [`SpO₂ ${spo2}% is critical hypoxemia (≤ 90%)`],
    };
  }
  if (spo2 >= 91 && spo2 <= 92) {
    return {
      status: 'ALERT',
      reasons: [`SpO₂ ${spo2}% is in alert range (91–92%)`],
    };
  }
  if (spo2 >= 93 && spo2 <= 94) {
    return {
      status: 'WATCH',
      reasons: [`SpO₂ ${spo2}% is in borderline watch range (93–94%)`],
    };
  }
  return {
    status: 'NOMINAL',
    reasons: [`SpO₂ ${spo2}% is nominal (≥ 95%)`],
  };
}

/**
 * 4. Body Temperature (°C)
 * NOMINAL: 36.1–37.2
 * WATCH: 37.3–37.9 or 35.5–36.0
 * ALERT: 38.0–39.4 or 35.0–35.4
 * CRITICAL: ≥ 39.5 or < 35.0
 */
export function classifyTemperature(rawTemp: number): RuleEvaluation {
  const temp = roundOneDecimal(rawTemp);
  if (temp >= 39.5 || temp < 35.0) {
    return {
      status: 'CRITICAL',
      reasons: [`Temperature ${temp} °C is critical (≥ 39.5 or < 35.0 °C)`],
    };
  }
  if ((temp >= 38.0 && temp <= 39.4) || (temp >= 35.0 && temp <= 35.4)) {
    return {
      status: 'ALERT',
      reasons: [`Temperature ${temp} °C is in alert range (38.0–39.4 or 35.0–35.4 °C)`],
    };
  }
  if ((temp >= 37.3 && temp <= 37.9) || (temp >= 35.5 && temp <= 36.0)) {
    return {
      status: 'WATCH',
      reasons: [`Temperature ${temp} °C is in watch range (37.3–37.9 or 35.5–36.0 °C)`],
    };
  }
  return {
    status: 'NOMINAL',
    reasons: [`Temperature ${temp} °C is nominal (36.1–37.2 °C)`],
  };
}

/**
 * 5. Blood Glucose (mg/dL)
 * NOMINAL: 70–140 (70–180 if post-meal)
 * WATCH: 141–180 (not post-meal) or 54–69
 * ALERT: 181–250
 * CRITICAL: < 54 or > 250
 */
export function classifyGlucose(rawGlucose: number, isPostMeal = false): RuleEvaluation {
  const glucose = roundWhole(rawGlucose);
  if (glucose < 54 || glucose > 250) {
    return {
      status: 'CRITICAL',
      reasons: [`Blood glucose ${glucose} mg/dL is critical (< 54 or > 250 mg/dL)`],
    };
  }
  if (glucose >= 181 && glucose <= 250) {
    return {
      status: 'ALERT',
      reasons: [`Blood glucose ${glucose} mg/dL is in alert range (181–250 mg/dL)`],
    };
  }
  if (glucose >= 54 && glucose <= 69) {
    return {
      status: 'WATCH',
      reasons: [`Blood glucose ${glucose} mg/dL is low watch range (54–69 mg/dL)`],
    };
  }
  if (isPostMeal) {
    if (glucose >= 70 && glucose <= 180) {
      return {
        status: 'NOMINAL',
        reasons: [`Post-meal blood glucose ${glucose} mg/dL is nominal (70–180 mg/dL)`],
      };
    }
  } else {
    if (glucose >= 141 && glucose <= 180) {
      return {
        status: 'WATCH',
        reasons: [`Fasting blood glucose ${glucose} mg/dL is elevated watch range (141–180 mg/dL)`],
      };
    }
    if (glucose >= 70 && glucose <= 140) {
      return {
        status: 'NOMINAL',
        reasons: [`Fasting blood glucose ${glucose} mg/dL is nominal (70–140 mg/dL)`],
      };
    }
  }

  return {
    status: 'WATCH',
    reasons: [`Blood glucose ${glucose} mg/dL is in watch range`],
  };
}

/**
 * 6. Respiratory Rate (/min)
 * NOMINAL: 12–20
 * WATCH: 21–24 or 10–11
 * ALERT: 25–29
 * CRITICAL: < 10 or ≥ 30
 */
export function classifyRespiratoryRate(rawRate: number): RuleEvaluation {
  const rate = roundWhole(rawRate);
  if (rate < 10 || rate >= 30) {
    return {
      status: 'CRITICAL',
      reasons: [`Respiratory rate ${rate} /min is critical (< 10 or ≥ 30 /min)`],
    };
  }
  if (rate >= 25 && rate <= 29) {
    return {
      status: 'ALERT',
      reasons: [`Respiratory rate ${rate} /min is in alert range (25–29 /min)`],
    };
  }
  if ((rate >= 21 && rate <= 24) || (rate >= 10 && rate <= 11)) {
    return {
      status: 'WATCH',
      reasons: [`Respiratory rate ${rate} /min is in watch range (10–11 or 21–24 /min)`],
    };
  }
  return {
    status: 'NOMINAL',
    reasons: [`Respiratory rate ${rate} /min is nominal (12–20 /min)`],
  };
}

/**
 * 7. Sleep (24 h)
 * NOMINAL: ≥ 7
 * WATCH: 6–6.9, or a single day < 6
 * ALERT: < 6 for 3+ consecutive days, or a single day < 4
 * CRITICAL: < 4 for 2+ consecutive days
 */
export function classifySleep(
  rawHours: number,
  options?: { consecutiveDaysUnder6?: number; consecutiveDaysUnder4?: number }
): RuleEvaluation {
  const hours = roundOneDecimal(rawHours);
  const daysUnder4 = options?.consecutiveDaysUnder4 ?? (hours < 4.0 ? 1 : 0);
  const daysUnder6 = options?.consecutiveDaysUnder6 ?? (hours < 6.0 ? 1 : 0);

  if (daysUnder4 >= 2) {
    return {
      status: 'CRITICAL',
      reasons: [`Sleep ${hours} h is critical (< 4 h for 2+ consecutive days)`],
    };
  }

  if (daysUnder6 >= 3 || hours < 4.0) {
    const reason = daysUnder6 >= 3
      ? `Sleep ${hours} h is alert (< 6 h for 3+ consecutive days)`
      : `Sleep ${hours} h is acute alert (single day < 4 h)`;
    return {
      status: 'ALERT',
      reasons: [reason],
    };
  }

  if ((hours >= 6.0 && hours <= 6.9) || hours < 6.0) {
    return {
      status: 'WATCH',
      reasons: [`Sleep ${hours} h is in watch band (6–6.9 h or single day < 6 h)`],
    };
  }

  return {
    status: 'NOMINAL',
    reasons: [`Sleep ${hours} h meets nominal flight requirement (≥ 7 h)`],
  };
}

/**
 * 8. Cumulative Radiation (mSv) - Career limit 600 mSv
 * NOMINAL: < 50% (< 300 mSv)
 * WATCH: 50–79% (300–479 mSv)
 * ALERT: 80–99% (480–599 mSv)
 * CRITICAL: ≥ 100% (≥ 600 mSv)
 */
export function classifyRadiation(rawDoseMsv: number): RuleEvaluation {
  const dose = roundOneDecimal(rawDoseMsv);
  if (dose >= 600) {
    return {
      status: 'CRITICAL',
      reasons: [`Cumulative radiation ${dose} mSv reaches or exceeds NASA career limit (600 mSv)`],
    };
  }
  if (dose >= 480) {
    return {
      status: 'ALERT',
      reasons: [`Cumulative radiation ${dose} mSv is 80–99% of career limit (480–599 mSv)`],
    };
  }
  if (dose >= 300) {
    return {
      status: 'WATCH',
      reasons: [`Cumulative radiation ${dose} mSv is 50–79% of career limit (300–479 mSv)`],
    };
  }
  return {
    status: 'NOMINAL',
    reasons: [`Cumulative radiation ${dose} mSv is nominal (< 50% of 600 mSv limit)`],
  };
}

/**
 * 9. PHQ-2 & GAD-2
 * NOMINAL: 0–2
 * ALERT: ≥ 3
 */
export function classifyPhq2(score: number): RuleEvaluation {
  const s = roundWhole(score);
  if (s >= 3) {
    return {
      status: 'ALERT',
      reasons: [`PHQ-2 depression screen score ${s}/6 suggests conference with CMO / flight surgeon`],
    };
  }
  return {
    status: 'NOMINAL',
    reasons: [`PHQ-2 score ${s}/6 is nominal (0–2)`],
  };
}

export function classifyGad2(score: number): RuleEvaluation {
  const s = roundWhole(score);
  if (s >= 3) {
    return {
      status: 'ALERT',
      reasons: [`GAD-2 anxiety screen score ${s}/6 suggests conference with CMO / flight surgeon`],
    };
  }
  return {
    status: 'NOMINAL',
    reasons: [`GAD-2 score ${s}/6 is nominal (0–2)`],
  };
}

/**
 * 10. PVT-B vs baseline
 * NOMINAL: within 10% speed of baseline
 * WATCH: 10–20% slower or lapses ≥ baseline + 3
 * ALERT: > 20% slower
 */
export function classifyPvt(
  currentSpeed: number,
  baselineSpeed: number,
  currentLapses = 0,
  baselineLapses = 0
): RuleEvaluation {
  if (baselineSpeed <= 0) {
    return { status: 'NOMINAL', reasons: ['Baseline pending'] };
  }

  const speedSlowdown = (baselineSpeed - currentSpeed) / baselineSpeed;

  if (speedSlowdown > 0.20) {
    return {
      status: 'ALERT',
      reasons: [`PVT-B response speed is ${(speedSlowdown * 100).toFixed(1)}% slower than your baseline (> 20% slowdown)`],
    };
  }

  if (speedSlowdown >= 0.10 || currentLapses >= baselineLapses + 3) {
    const reasons: string[] = [];
    if (speedSlowdown >= 0.10) {
      reasons.push(`PVT-B response speed is ${(speedSlowdown * 100).toFixed(1)}% slower than your baseline (10–20% slowdown)`);
    }
    if (currentLapses >= baselineLapses + 3) {
      reasons.push(`PVT-B lapses (${currentLapses}) increased by ≥ 3 over baseline (${baselineLapses})`);
    }
    return { status: 'WATCH', reasons };
  }

  return {
    status: 'NOMINAL',
    reasons: ['PVT-B reaction speed within 10% of personal baseline'],
  };
}

/**
 * 11. Amsler Grid
 * NOMINAL: no distortion
 * ALERT: any new distortion vs previous
 * CRITICAL: sudden large loss of central vision
 */
export function classifyAmsler(
  hasDistortion: boolean,
  isNewDistortion: boolean,
  suddenLargeLoss = false
): RuleEvaluation {
  if (suddenLargeLoss) {
    return {
      status: 'CRITICAL',
      reasons: ['Sudden large loss of central visual field reported on Amsler grid'],
    };
  }
  if (isNewDistortion) {
    return {
      status: 'ALERT',
      reasons: ['New visual distortion reported on Amsler grid vs previous baseline (request OCT/fundoscopy)'],
    };
  }
  if (hasDistortion) {
    return {
      status: 'WATCH',
      reasons: ['Persistent known visual distortion on Amsler grid (monitored SANS)'],
    };
  }
  return {
    status: 'NOMINAL',
    reasons: ['Amsler grid central visual field nominal (no distortion)'],
  };
}

/**
 * 12. Orthostatic Stand Test
 * CRITICAL: fainting / near-fainting
 * ALERT: systolic drop ≥ 20 or diastolic drop ≥ 10 within 3 min, or HR rise ≥ 30 bpm
 * NOMINAL: otherwise
 */
export function classifyOrthostatic(
  sysChange: number,
  diaChange: number,
  hrChange: number,
  nearFaint = false
): RuleEvaluation {
  if (nearFaint) {
    return {
      status: 'CRITICAL',
      reasons: ['Fainting or near-fainting episode during orthostatic transition'],
    };
  }
  if (sysChange <= -20 || diaChange <= -10 || hrChange >= 30) {
    return {
      status: 'ALERT',
      reasons: [
        `Orthostatic change exceeds limits: systolic change ${sysChange} mmHg, diastolic change ${diaChange} mmHg, HR change +${hrChange} bpm`,
      ],
    };
  }
  return {
    status: 'NOMINAL',
    reasons: ['Orthostatic adaptation within nominal limits'],
  };
}
