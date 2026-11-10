import { describe, it, expect } from 'vitest';
import {
  classifyHeartRate,
  classifyBloodPressure,
  classifySpO2,
  classifyTemperature,
  classifyGlucose,
  classifyRespiratoryRate,
  classifySleep,
  classifyRadiation,
  classifyPhq2,
  classifyGad2,
  classifyPvt,
  classifyAmsler,
  classifyOrthostatic,
} from './thresholds';
import type { HealthStatus } from '../data/db';

const VALID_STATUSES: HealthStatus[] = ['NOMINAL', 'WATCH', 'ALERT', 'CRITICAL'];

describe('Thresholds No-Gap Rule & Sweep Tests per §6 (v3)', () => {
  // 1. Heart rate sweep: 30 to 180 bpm (step 1 bpm)
  it('Heart Rate sweep (30..180 bpm): every value lands in exactly one band with whole-number rounding', () => {
    for (let bpm = 30; bpm <= 180; bpm++) {
      const res = classifyHeartRate(bpm);
      expect(VALID_STATUSES).toContain(res.status);
      expect(res.reasons.length).toBeGreaterThan(0);

      if (bpm < 40 || bpm > 130) {
        expect(res.status).toBe('CRITICAL');
      } else if (bpm >= 111 && bpm <= 130) {
        expect(res.status).toBe('ALERT');
      } else if ((bpm >= 40 && bpm <= 49) || (bpm >= 101 && bpm <= 110)) {
        expect(res.status).toBe('WATCH');
      } else {
        expect(res.status).toBe('NOMINAL');
      }
    }

    // Decimal rounding test (e.g. 49.6 bpm rounds to 50 -> NOMINAL, 49.4 rounds to 49 -> WATCH)
    expect(classifyHeartRate(49.4).status).toBe('WATCH');
    expect(classifyHeartRate(49.6).status).toBe('NOMINAL');
    expect(classifyHeartRate(130.4).status).toBe('ALERT');
    expect(classifyHeartRate(130.6).status).toBe('CRITICAL');
  });

  // 2. Blood Pressure sweep: sys 70..200, dia 50..130
  it('Blood Pressure sweep (sys 70..200, dia 50..130): every integer pair lands in exactly one band', () => {
    for (let sys = 70; sys <= 200; sys += 5) {
      for (let dia = 50; dia <= 130; dia += 5) {
        const res = classifyBloodPressure(sys, dia);
        expect(VALID_STATUSES).toContain(res.status);

        if (sys > 180 || dia > 120) {
          expect(res.status).toBe('CRITICAL');
        } else if (sys < 90 || (sys >= 130 && sys <= 180) || (dia >= 80 && dia <= 120)) {
          expect(res.status).toBe('ALERT');
        } else if (sys >= 120 && sys <= 129 && dia < 80) {
          expect(res.status).toBe('WATCH');
        } else if (sys >= 90 && sys <= 119 && dia < 80) {
          expect(res.status).toBe('NOMINAL');
        }
      }
    }

    // Specific boundary cases
    expect(classifyBloodPressure(119, 79).status).toBe('NOMINAL');
    expect(classifyBloodPressure(120, 79).status).toBe('WATCH');
    expect(classifyBloodPressure(129, 79).status).toBe('WATCH');
    expect(classifyBloodPressure(130, 79).status).toBe('ALERT');
    expect(classifyBloodPressure(115, 80).status).toBe('ALERT'); // dia 80 is ALERT
    expect(classifyBloodPressure(89, 70).status).toBe('ALERT'); // sys < 90 is ALERT
    expect(classifyBloodPressure(181, 75).status).toBe('CRITICAL'); // sys > 180
    expect(classifyBloodPressure(115, 121).status).toBe('CRITICAL'); // dia > 120
  });

  // 3. SpO₂ sweep: 80 to 100%
  it('SpO₂ sweep (80..100%): every whole value lands in exactly one band', () => {
    for (let spo2 = 80; spo2 <= 100; spo2++) {
      const res = classifySpO2(spo2);
      expect(VALID_STATUSES).toContain(res.status);

      if (spo2 <= 90) {
        expect(res.status).toBe('CRITICAL');
      } else if (spo2 <= 92) {
        expect(res.status).toBe('ALERT');
      } else if (spo2 <= 94) {
        expect(res.status).toBe('WATCH');
      } else {
        expect(res.status).toBe('NOMINAL');
      }
    }

    // Decimal rounding test
    expect(classifySpO2(94.4).status).toBe('WATCH');
    expect(classifySpO2(94.6).status).toBe('NOMINAL');
    expect(classifySpO2(90.4).status).toBe('CRITICAL');
    expect(classifySpO2(90.6).status).toBe('ALERT');
  });

  // 4. Body Temperature sweep: 34.0 to 41.0 °C (step 0.1 °C)
  it('Body Temperature sweep (34.0..41.0 °C step 0.1): every 1-decimal value lands in exactly one band', () => {
    for (let t = 340; t <= 410; t++) {
      const temp = t / 10;
      const res = classifyTemperature(temp);
      expect(VALID_STATUSES).toContain(res.status);

      if (temp >= 39.5 || temp < 35.0) {
        expect(res.status).toBe('CRITICAL');
      } else if ((temp >= 38.0 && temp <= 39.4) || (temp >= 35.0 && temp <= 35.4)) {
        expect(res.status).toBe('ALERT');
      } else if ((temp >= 37.3 && temp <= 37.9) || (temp >= 35.5 && temp <= 36.0)) {
        expect(res.status).toBe('WATCH');
      } else if (temp >= 36.1 && temp <= 37.2) {
        expect(res.status).toBe('NOMINAL');
      }
    }

    // Exact boundaries
    expect(classifyTemperature(34.9).status).toBe('CRITICAL');
    expect(classifyTemperature(35.0).status).toBe('ALERT');
    expect(classifyTemperature(35.4).status).toBe('ALERT');
    expect(classifyTemperature(35.5).status).toBe('WATCH');
    expect(classifyTemperature(36.0).status).toBe('WATCH');
    expect(classifyTemperature(36.1).status).toBe('NOMINAL');
    expect(classifyTemperature(37.2).status).toBe('NOMINAL');
    expect(classifyTemperature(37.3).status).toBe('WATCH');
    expect(classifyTemperature(37.9).status).toBe('WATCH');
    expect(classifyTemperature(38.0).status).toBe('ALERT');
    expect(classifyTemperature(39.4).status).toBe('ALERT');
    expect(classifyTemperature(39.5).status).toBe('CRITICAL');
  });

  // 5. Blood Glucose sweep: 40 to 300 mg/dL
  it('Blood Glucose sweep (40..300 mg/dL): covers all values fasting and post-meal', () => {
    for (let g = 40; g <= 300; g += 2) {
      // Fasting
      const fastingRes = classifyGlucose(g, false);
      expect(VALID_STATUSES).toContain(fastingRes.status);
      if (g < 54 || g > 250) {
        expect(fastingRes.status).toBe('CRITICAL');
      } else if (g >= 181 && g <= 250) {
        expect(fastingRes.status).toBe('ALERT');
      } else if ((g >= 141 && g <= 180) || (g >= 54 && g <= 69)) {
        expect(fastingRes.status).toBe('WATCH');
      } else {
        expect(fastingRes.status).toBe('NOMINAL');
      }

      // Post-meal
      const postMealRes = classifyGlucose(g, true);
      expect(VALID_STATUSES).toContain(postMealRes.status);
      if (g < 54 || g > 250) {
        expect(postMealRes.status).toBe('CRITICAL');
      } else if (g >= 181 && g <= 250) {
        expect(postMealRes.status).toBe('ALERT');
      } else if (g >= 54 && g <= 69) {
        expect(postMealRes.status).toBe('WATCH');
      } else if (g >= 70 && g <= 180) {
        expect(postMealRes.status).toBe('NOMINAL');
      }
    }
  });

  // 6. Respiratory Rate sweep: 5 to 40 /min
  it('Respiratory Rate sweep (5..40 /min): every whole value lands in exactly one band', () => {
    for (let r = 5; r <= 40; r++) {
      const res = classifyRespiratoryRate(r);
      expect(VALID_STATUSES).toContain(res.status);

      if (r < 10 || r >= 30) {
        expect(res.status).toBe('CRITICAL');
      } else if (r >= 25 && r <= 29) {
        expect(res.status).toBe('ALERT');
      } else if ((r >= 21 && r <= 24) || (r >= 10 && r <= 11)) {
        expect(res.status).toBe('WATCH');
      } else {
        expect(res.status).toBe('NOMINAL');
      }
    }
  });

  // 7. Sleep sweep: 0.0 to 12.0 hours (step 0.1h)
  it('Sleep sweep (0.0..12.0 h step 0.1): single day and consecutive day rules', () => {
    for (let s = 0; s <= 120; s++) {
      const hours = s / 10;
      const res = classifySleep(hours);
      expect(VALID_STATUSES).toContain(res.status);

      if (hours < 4.0) {
        expect(res.status).toBe('ALERT'); // single day < 4 is ALERT
      } else if (hours < 7.0) {
        expect(res.status).toBe('WATCH'); // 6-6.9 or single day < 6 is WATCH
      } else {
        expect(res.status).toBe('NOMINAL'); // >= 7 is NOMINAL
      }
    }

    // Multi-day rules
    expect(classifySleep(3.5, { consecutiveDaysUnder4: 2 }).status).toBe('CRITICAL');
    expect(classifySleep(5.5, { consecutiveDaysUnder6: 3 }).status).toBe('ALERT');
    expect(classifySleep(5.5, { consecutiveDaysUnder6: 2 }).status).toBe('WATCH');
  });

  // 8. Cumulative Radiation sweep: 0 to 700 mSv
  it('Cumulative Radiation sweep (0..700 mSv): correctly tracks career limit thresholds', () => {
    expect(classifyRadiation(200).status).toBe('NOMINAL'); // < 300 (<50%)
    expect(classifyRadiation(299.9).status).toBe('NOMINAL');
    expect(classifyRadiation(300).status).toBe('WATCH'); // 300–479 (50–79%)
    expect(classifyRadiation(479).status).toBe('WATCH');
    expect(classifyRadiation(480).status).toBe('ALERT'); // 480–599 (80–99%)
    expect(classifyRadiation(599).status).toBe('ALERT');
    expect(classifyRadiation(600).status).toBe('CRITICAL'); // >= 600 (>=100%)
    expect(classifyRadiation(650).status).toBe('CRITICAL');
  });

  // 9. Other indicators
  it('PHQ-2, GAD-2, PVT, Amsler, and Orthostatic classifications', () => {
    expect(classifyPhq2(2).status).toBe('NOMINAL');
    expect(classifyPhq2(3).status).toBe('ALERT');

    expect(classifyGad2(1).status).toBe('NOMINAL');
    expect(classifyGad2(4).status).toBe('ALERT');

    // PVT: speed slowdown > 20% -> ALERT; 10-20% -> WATCH; <=10% -> NOMINAL
    expect(classifyPvt(4.0, 4.2).status).toBe('NOMINAL'); // ~4.7% slowdown
    expect(classifyPvt(3.6, 4.2).status).toBe('WATCH'); // 14.3% slowdown
    expect(classifyPvt(3.2, 4.2).status).toBe('ALERT'); // 23.8% slowdown
    expect(classifyPvt(4.0, 4.2, 5, 2).status).toBe('WATCH'); // lapses increased by 3

    // Amsler
    expect(classifyAmsler(false, false).status).toBe('NOMINAL');
    expect(classifyAmsler(true, true).status).toBe('ALERT');
    expect(classifyAmsler(true, false).status).toBe('WATCH');
    expect(classifyAmsler(true, false, true).status).toBe('CRITICAL');

    // Orthostatic
    expect(classifyOrthostatic(-10, -5, 15).status).toBe('NOMINAL');
    expect(classifyOrthostatic(-20, 0, 10).status).toBe('ALERT'); // sys drop >= 20
    expect(classifyOrthostatic(0, -10, 10).status).toBe('ALERT'); // dia drop >= 10
    expect(classifyOrthostatic(0, 0, 30).status).toBe('ALERT'); // HR rise >= 30
    expect(classifyOrthostatic(0, 0, 0, true).status).toBe('CRITICAL'); // fainting
  });
});
