import { describe, it, expect } from 'vitest';
import type { CrewMember, PersonalBaseline } from '../../data/db';
import {
  formatDelayRoundtrip,
  formatElapsedSeconds,
  formatVitalsWithBaseline,
  evaluateChestPain,
  buildSbarReport,
  formatSbarPlainText,
  type ChestPainAssessmentInput,
} from './emergencyLogic';

const MOCK_PATIENT: CrewMember = {
  id: 1,
  name: 'Dr. Alex Vance',
  callSign: 'AEGIS',
  age: 38,
  sex: 'M',
  role: 'CMO',
  isCmo: true,
  isCurrent: true,
  createdAt: 1000,
};

const MOCK_BASELINES: PersonalBaseline[] = [
  { id: 1, crewMemberId: 1, indicator: 'heart_rate', mean: 58, sd: 4, sampleCount: 15, updatedAt: 1000 },
  { id: 2, crewMemberId: 1, indicator: 'blood_pressure', mean: 118, sd: 6, sampleCount: 12, updatedAt: 1000 },
  { id: 3, crewMemberId: 1, indicator: 'spo2', mean: 98, sd: 1, sampleCount: 20, updatedAt: 1000 },
];

describe('Emergency Decision Clock & Baseline Helpers (§7.11)', () => {
  it('computes 2x roundtrip delay for pinned decision clock', () => {
    // Transit to Mars (14 min 06 s = 846 s) -> 28 min 12 s roundtrip
    expect(formatDelayRoundtrip(846)).toBe('28 min 12 s');
    // Lunar surface (1.3 s) -> 2 s or 3 s roundtrip
    expect(formatDelayRoundtrip(1.3)).toBe('3 s');
    // LEO / ISS (< 1 s) -> ground supported
    expect(formatDelayRoundtrip(0.5)).toBe('< 2 s (Ground-supported)');
  });

  it('formats elapsed time count-up in MM:SS and HH:MM:SS', () => {
    expect(formatElapsedSeconds(0)).toBe('00:00');
    expect(formatElapsedSeconds(65)).toBe('01:05');
    expect(formatElapsedSeconds(3665)).toBe('01:01:05');
  });

  it('formats vitals against personal baseline with delta', () => {
    const hrEval = formatVitalsWithBaseline('heart_rate', 124, MOCK_BASELINES[0], 'M');
    expect(hrEval.display).toBe('124 bpm');
    expect(hrEval.comparison).toContain('58 ± 4 bpm');
    expect(hrEval.comparison).toContain('+66 above');
    expect(hrEval.isAbnormal).toBe(true);

    const spo2Eval = formatVitalsWithBaseline('spo2', 88, MOCK_BASELINES[2], 'M');
    expect(spo2Eval.display).toBe('88%');
    expect(spo2Eval.comparison).toContain('hypoxia threshold < 90%');
    expect(spo2Eval.isAbnormal).toBe(true);
  });
});

describe('Chest Pain Red-Flag Logic per HALO_SPEC §7.11', () => {
  const baseInput: ChestPainAssessmentInput = {
    onset: 'sudden',
    character: 'sharp',
    radiation: { leftArm: false, jaw: false, neck: false, back: false, none: true },
    shortnessOfBreath: false,
    sweating: false,
    recentEvaOrSuitPressureChange: false,
    recentTrauma: false,
    vitals: { heartRate: 72, systolicBp: 120, diastolicBp: 78, spo2: 97 },
  };

  it('flags acute oxygen requirement when SpO2 < 90% or severe dyspnea', () => {
    const hypoxicInput: ChestPainAssessmentInput = {
      ...baseInput,
      vitals: { ...baseInput.vitals, spo2: 88 },
    };
    const res = evaluateChestPain(hypoxicInput);
    expect(res.isOxygenRequired).toBe(true);
    expect(res.isCritical).toBe(true);
    expect(res.actions.some((a) => a.toLowerCase().includes('supplemental oxygen'))).toBe(true);
    expect(res.redFlags.some((r) => r.includes('88%'))).toBe(true);

    const dyspneicInput: ChestPainAssessmentInput = {
      ...baseInput,
      shortnessOfBreath: true,
      vitals: { ...baseInput.vitals, spo2: 94 },
    };
    const res2 = evaluateChestPain(dyspneicInput);
    expect(res2.isOxygenRequired).toBe(true);
    expect(res2.actions.some((a) => a.toLowerCase().includes('supplemental oxygen'))).toBe(true);
  });

  it('identifies classic cardiac ischemia signs (pressure, radiation, diaphoresis)', () => {
    const cardiacInput: ChestPainAssessmentInput = {
      ...baseInput,
      character: 'pressure',
      radiation: { leftArm: true, jaw: true, neck: false, back: false, none: false },
      sweating: true,
      vitals: { heartRate: 112, systolicBp: 148, diastolicBp: 94, spo2: 96 },
    };
    const res = evaluateChestPain(cardiacInput);
    expect(res.isCardiacRisk).toBe(true);
    expect(res.isCritical).toBe(true);
    expect(res.redFlags.some((r) => r.includes('coronary syndrome'))).toBe(true);
    expect(res.redFlags.some((r) => r.includes('left arm'))).toBe(true);
    expect(res.redFlags.some((r) => r.includes('Diaphoresis'))).toBe(true);
    expect(res.actions.some((a) => a.includes('AED'))).toBe(true);
    expect(res.actions.some((a) => a.includes('absolute physical rest'))).toBe(true);
  });

  it('detects acute tearing sensation as aortic emergency risk', () => {
    const aorticInput: ChestPainAssessmentInput = {
      ...baseInput,
      character: 'tearing',
      radiation: { leftArm: false, jaw: false, neck: false, back: true, none: false },
    };
    const res = evaluateChestPain(aorticInput);
    expect(res.isCardiacRisk).toBe(true);
    expect(res.redFlags.some((r) => r.includes('aortic dissection'))).toBe(true);
    expect(res.redFlags.some((r) => r.includes('interscapular back'))).toBe(true);
  });

  it('detects Decompression Sickness (DCS) risk post-EVA or suit pressure drop', () => {
    const dcsInput: ChestPainAssessmentInput = {
      ...baseInput,
      recentEvaOrSuitPressureChange: true,
      shortnessOfBreath: true,
    };
    const res = evaluateChestPain(dcsInput);
    expect(res.isDcsRisk).toBe(true);
    expect(res.isCritical).toBe(true);
    expect(res.redFlags.some((r) => r.includes('Decompression Sickness'))).toBe(true);
    expect(res.actions.some((a) => a.includes('100% normobaric oxygen'))).toBe(true);
  });

  it('sets 5-minute re-check timer interval', () => {
    const res = evaluateChestPain(baseInput);
    expect(res.recheckIntervalSeconds).toBe(300);
  });

  it('CRITICAL: Never hard-codes any drug names or doses anywhere', () => {
    const severeInput: ChestPainAssessmentInput = {
      onset: 'sudden',
      character: 'pressure',
      radiation: { leftArm: true, jaw: true, neck: true, back: true, none: false },
      shortnessOfBreath: true,
      sweating: true,
      recentEvaOrSuitPressureChange: true,
      recentTrauma: true,
      vitals: { heartRate: 135, systolicBp: 165, diastolicBp: 102, spo2: 86 },
    };
    const res = evaluateChestPain(severeInput);
    const fullText = JSON.stringify(res).toLowerCase();

    // Verify forbidden drugs are NOT hardcoded
    const forbiddenDrugs = ['aspirin', 'nitro', 'morphine', 'heparin', 'clopidogrel', 'plavix', 'epinephrine', 'atropine', 'mg', 'mcg'];
    for (const drug of forbiddenDrugs) {
      // Ensure drug names do not appear as prescription terms
      expect(fullText).not.toContain(` ${drug} `);
      expect(fullText).not.toContain(`"${drug}"`);
      expect(fullText).not.toContain(`${drug} `);
    }

    // Verify it directs to the medical checklist & flight-surgeon protocol
    expect(res.actions.some((a) => a.includes('onboard medical checklist and emergency medications per flight-surgeon protocol'))).toBe(true);
  });
});

describe('SBAR Clinical Incident Report Builder (§7.11)', () => {
  it('constructs a complete SBAR data structure with all 4 clinical sections', () => {
    const started = Date.now() - 360000; // 6 mins ago
    const sbar = buildSbarReport({
      patient: MOCK_PATIENT,
      emergencyType: 'CHEST_PAIN',
      startedAt: started,
      endedAt: Date.now(),
      missionDay: 142,
      environmentName: 'Deep-Space Transit to Mars',
      oneWayDelaySeconds: 846,
      summary: 'Acute retrosternal chest pressure post-exercise with shortness of breath.',
      baselines: MOCK_BASELINES,
      recentFlags: [
        { day: 140, indicator: 'sleep', status: 'ALERT', note: 'Sleep < 5.5 h' },
        { day: 141, indicator: 'blood_pressure', status: 'WATCH', note: '126/78 mmHg' },
      ],
      recentEva: true,
      triageAnswers: {
        onset: 'sudden (10 min ago)',
        character: 'squeezing pressure',
        radiation: 'left arm and jaw',
        dyspnea: true,
        sweating: true,
      },
      redFlags: [
        'Squeezing pressure character',
        'Radiation to left arm and jaw',
        'SpO₂ 91% with tachypnea',
      ],
      vitalsTimeline: [
        { timestamp: started + 60000, heartRate: 118, systolicBp: 146, diastolicBp: 92, spo2: 91 },
        { timestamp: started + 300000, heartRate: 104, systolicBp: 138, diastolicBp: 88, spo2: 94 },
      ],
      protocolStepsCompleted: [
        { timestamp: started + 120000, step: 'Patient placed at absolute rest with head elevated 30°' },
        { timestamp: started + 180000, step: 'Supplemental O2 initiated via mask per checklist' },
        { timestamp: started + 240000, step: 'AED staged and electrodes placed on chest' },
      ],
    });

    expect(sbar.id).toMatch(/^SBAR-142-/);
    expect(sbar.situation.patientName).toBe('Dr. Alex Vance');
    expect(sbar.situation.patientCallSign).toBe('AEGIS');
    expect(sbar.situation.emergencyType).toBe('CHEST_PAIN');
    expect(sbar.situation.durationSeconds).toBeGreaterThanOrEqual(350);

    expect(sbar.background.patientAge).toBe(38);
    expect(sbar.background.patientSex).toBe('M');
    expect(sbar.background.baselines).toHaveLength(3);
    expect(sbar.background.recentFlags).toHaveLength(2);
    expect(sbar.background.recentEva).toBe(true);

    expect(sbar.assessment.vitalsTimeline).toHaveLength(2);
    expect(sbar.assessment.vitalsTimeline[0].timeOffset).toBe('+01:00');
    expect(sbar.assessment.vitalsTimeline[0].status).toBe('ALERT');
    expect(sbar.assessment.protocolStepsCompleted).toHaveLength(3);
    expect(sbar.assessment.redFlags).toHaveLength(3);

    expect(sbar.request.downlinkPriority).toBe('HIGH');
    expect(sbar.request.immediateNeeds.length).toBeGreaterThan(0);
  });

  it('formats SBAR into clean plain text for printing and ground transmission', () => {
    const sbar = buildSbarReport({
      patient: MOCK_PATIENT,
      emergencyType: 'CPR',
      startedAt: Date.now() - 120000,
      missionDay: 142,
      environmentName: 'Deep-Space Transit',
      oneWayDelaySeconds: 846,
      summary: 'Unresponsive crewmember with absent normal breathing. CPR initiated.',
      protocolStepsCompleted: [
        { timestamp: Date.now() - 60000, step: 'Evetts-Russomano microgravity CPR cycle 1 completed' },
      ],
    });

    const text = formatSbarPlainText(sbar);
    expect(text).toContain('[S] SITUATION');
    expect(text).toContain('[B] BACKGROUND');
    expect(text).toContain('[A] ASSESSMENT');
    expect(text).toContain('[R] REQUEST');
    expect(text).toContain('Dr. Alex Vance (AEGIS)');
    expect(text).toContain('Priority: HIGH DOWNLINK PACKET');
    expect(text).toContain('Evetts-Russomano');

    // Confirm no drug names
    expect(text.toLowerCase()).not.toContain('aspirin');
    expect(text.toLowerCase()).not.toContain('nitroglycerin');
  });
});
