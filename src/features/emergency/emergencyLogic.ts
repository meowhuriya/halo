import type { CrewMember, PersonalBaseline } from '../../data/db';

export type EmergencyType = 'CPR' | 'CHEST_PAIN' | 'TOXIC_BREATHING' | 'SOLAR_STORM' | 'GENERAL';

export interface VitalsSnapshot {
  heartRate?: number;
  systolicBp?: number;
  diastolicBp?: number;
  spo2?: number;
  respiratoryRate?: number;
  timestamp: number;
}

export interface ChestPainAssessmentInput {
  onset: 'sudden' | 'gradual';
  character: 'pressure' | 'sharp' | 'tearing' | 'dull' | 'other';
  radiation: {
    leftArm: boolean;
    jaw: boolean;
    neck: boolean;
    back: boolean;
    none: boolean;
  };
  shortnessOfBreath: boolean;
  sweating: boolean; // Diaphoresis
  recentEvaOrSuitPressureChange: boolean;
  recentTrauma: boolean;
  vitals?: {
    heartRate?: number;
    systolicBp?: number;
    diastolicBp?: number;
    spo2?: number;
  };
}

export interface RedFlagAssessmentResult {
  isCritical: boolean;
  isCardiacRisk: boolean;
  isDcsRisk: boolean;
  isOxygenRequired: boolean;
  redFlags: string[];
  actions: string[];
  recheckIntervalSeconds: number;
}

/**
 * Pinned Decision Clock calculations per HALO_SPEC §7.11:
 * - Earliest possible answer from Earth: 2 × current one-way light delay
 * - Time since event: MM:SS
 */
export function formatDelayRoundtrip(oneWayDelaySeconds: number): string {
  if (oneWayDelaySeconds < 1) {
    return '< 2 s (Ground-supported)';
  }
  const roundtrip = Math.round(oneWayDelaySeconds * 2);
  const mins = Math.floor(roundtrip / 60);
  const secs = roundtrip % 60;
  if (mins === 0) {
    return `${secs} s`;
  }
  return `${mins} min ${String(secs).padStart(2, '0')} s`;
}

export function formatElapsedSeconds(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Format patient vitals alongside their personal baseline.
 * E.g., "HR 124 — her normal is 58 ± 4 bpm"
 */
export function formatVitalsWithBaseline(
  indicator: 'heart_rate' | 'blood_pressure' | 'spo2',
  value: number | { sys: number; dia: number },
  baseline?: PersonalBaseline | null,
  patientSex?: 'M' | 'F' | 'Other'
): { display: string; comparison: string; isAbnormal: boolean } {
  const pronoun = patientSex === 'F' ? 'her' : patientSex === 'M' ? 'his' : 'their';

  if (indicator === 'heart_rate' && typeof value === 'number') {
    const display = `${Math.round(value)} bpm`;
    if (!baseline || baseline.sampleCount < 3) {
      return {
        display,
        comparison: 'Normal resting range: 60–100 bpm (no baseline yet)',
        isAbnormal: value > 100 || value < 50,
      };
    }
    const mean = Math.round(baseline.mean);
    const sd = Math.max(3, Math.round(baseline.sd));
    const diff = Math.round(value - baseline.mean);
    const diffText = diff > 0 ? `+${diff} above` : `${diff} below`;
    return {
      display,
      comparison: `${pronoun} normal is ${mean} ± ${sd} bpm (${diffText} baseline)`,
      isAbnormal: Math.abs(value - baseline.mean) > 2 * sd || value > 100 || value < 50,
    };
  }

  if (indicator === 'blood_pressure' && typeof value === 'object') {
    const display = `${Math.round(value.sys)}/${Math.round(value.dia)} mmHg`;
    if (!baseline || baseline.sampleCount < 3) {
      return {
        display,
        comparison: 'Normal resting limit: < 120/80 mmHg',
        isAbnormal: value.sys >= 130 || value.dia >= 85 || value.sys <= 90,
      };
    }
    const mean = Math.round(baseline.mean);
    return {
      display,
      comparison: `${pronoun} baseline systolic is ${mean} mmHg`,
      isAbnormal: value.sys >= 130 || value.dia >= 85 || value.sys <= 90,
    };
  }

  if (indicator === 'spo2' && typeof value === 'number') {
    const display = `${Math.round(value)}%`;
    if (!baseline || baseline.sampleCount < 3) {
      return {
        display,
        comparison: 'Normal space cabin pulse oximetry: ≥ 95%',
        isAbnormal: value < 95,
      };
    }
    const mean = Math.round(baseline.mean);
    return {
      display,
      comparison: `${pronoun} baseline is ${mean}% (hypoxia threshold < 90%)`,
      isAbnormal: value < 95,
    };
  }

  return {
    display: String(value),
    comparison: 'Baseline not established',
    isAbnormal: false,
  };
}

/**
 * Deterministic Chest Pain Red-Flag Evaluation per HALO_SPEC §7.11:
 * Evaluates symptoms, trauma, DCS risk, and vitals.
 * IMPORTANT: NEVER hard-codes drug names or doses.
 */
export function evaluateChestPain(input: ChestPainAssessmentInput): RedFlagAssessmentResult {
  const redFlags: string[] = [];
  const actions: string[] = [];

  const spo2 = input.vitals?.spo2;
  const hr = input.vitals?.heartRate;
  const sys = input.vitals?.systolicBp;
  const dia = input.vitals?.diastolicBp;

  // 1. Oxygenation & Dyspnea Gate
  const isHypoxic = typeof spo2 === 'number' && spo2 < 90;
  const isDyspneic = input.shortnessOfBreath;
  const isOxygenRequired = isHypoxic || isDyspneic;

  if (isHypoxic) {
    redFlags.push(`Severe arterial hypoxia: SpO₂ ${spo2}% is critically below 90% threshold`);
  }
  if (isDyspneic) {
    redFlags.push('Acute shortness of breath / respiratory distress accompanying chest pain');
  }
  if (isOxygenRequired) {
    actions.push('Administer supplemental oxygen immediately per onboard medical checklist');
  }

  // 2. Cardiac Risk Gate
  let isCardiacRisk = false;
  if (input.character === 'pressure') {
    isCardiacRisk = true;
    redFlags.push('Squeezing / substernal pressure character: classic acute coronary syndrome presentation');
  } else if (input.character === 'tearing') {
    isCardiacRisk = true;
    redFlags.push('Severe tearing pain: acute thoracic aortic dissection must be considered');
  }

  const radParts: string[] = [];
  if (input.radiation.leftArm) radParts.push('left arm');
  if (input.radiation.jaw) radParts.push('jaw');
  if (input.radiation.neck) radParts.push('neck');
  if (input.radiation.back) radParts.push('interscapular back');

  if (radParts.length > 0) {
    isCardiacRisk = true;
    redFlags.push(`Anginal pain radiation reported to: ${radParts.join(', ')}`);
  }

  if (input.sweating) {
    isCardiacRisk = true;
    redFlags.push('Diaphoresis (cold sweats) present alongside thoracic pain');
  }

  if (typeof hr === 'number') {
    if (hr > 100) {
      isCardiacRisk = true;
      redFlags.push(`Tachycardia present: resting heart rate ${hr} bpm (> 100 bpm)`);
    } else if (hr < 50) {
      isCardiacRisk = true;
      redFlags.push(`Bradycardia present: resting heart rate ${hr} bpm (< 50 bpm)`);
    }
  }

  if (typeof sys === 'number' && typeof dia === 'number') {
    if (sys >= 140 || dia >= 90) {
      redFlags.push(`Hypertensive response: blood pressure ${sys}/${dia} mmHg`);
    } else if (sys <= 90) {
      isCardiacRisk = true;
      redFlags.push(`Hypotension present: systolic blood pressure ${sys} mmHg (shock / low perfusion)`);
    }
  }

  // 3. Decompression Sickness (DCS) / Barotrauma Gate
  let isDcsRisk = false;
  if (input.recentEvaOrSuitPressureChange) {
    isDcsRisk = true;
    redFlags.push('Recent EVA or suit/cabin pressure drop: Decompression Sickness (pulmonary chokes) risk');
    actions.push('Deliver 100% normobaric oxygen via sealed mask and assess for joint pain / neurological deficits');
  }

  // 4. Trauma Gate
  if (input.recentTrauma) {
    redFlags.push('Recent physical trauma or blunt impact to chest: evaluate for pneumothorax / contusion');
    actions.push('Palpate for chest wall tenderness, rib crepitus, and auscultate breath sounds bilaterally');
  }

  // Core Clinical Actions for Cardiac / Thoracic Emergency
  actions.push('Keep patient at absolute physical rest (seated or recumbent, avoiding all exertion)');
  actions.push('Stage and prepare Automated External Defibrillator (AED) with pads ready for immediate application');
  actions.push('Follow onboard medical checklist and emergency medications per flight-surgeon protocol');
  actions.push('Notify Ground Link immediately with high-priority downlink packet');

  const isCritical = isCardiacRisk || isDcsRisk || isHypoxic;

  return {
    isCritical,
    isCardiacRisk,
    isDcsRisk,
    isOxygenRequired,
    redFlags,
    actions,
    recheckIntervalSeconds: 300, // 5-minute re-check timer
  };
}

/**
 * Structured Clinical SBAR Incident Report Data Model per HALO_SPEC §7.11 (v3):
 * Situation · Background · Assessment · Request
 */
export interface SbarReportData {
  id: string;
  timestamp: number;
  missionDay: number;
  environmentName: string;
  oneWayDelaySeconds: number;
  situation: {
    patientName: string;
    patientCallSign: string;
    patientRole: string;
    emergencyType: EmergencyType;
    startedAt: number;
    durationSeconds: number;
    summary: string;
  };
  background: {
    patientAge: number;
    patientSex: 'M' | 'F' | 'Other';
    baselines: Array<{ indicator: string; label: string; normal: string }>;
    recentFlags: Array<{ day: number; indicator: string; status: string; note: string }>;
    recentEva: boolean;
  };
  assessment: {
    triageAnswers: Record<string, string | boolean | number>;
    redFlags: string[];
    vitalsTimeline: Array<{
      timestamp: number;
      timeOffset: string;
      heartRate?: number;
      bloodPressure?: string;
      spo2?: number;
      respiratoryRate?: number;
      status: string;
    }>;
    protocolStepsCompleted: Array<{
      timestamp: number;
      timeOffset: string;
      step: string;
    }>;
  };
  request: {
    immediateNeeds: string[];
    flightSurgeonAction: string;
    downlinkPriority: 'HIGH';
  };
}

export function buildSbarReport(params: {
  patient: CrewMember;
  emergencyType: EmergencyType;
  startedAt: number;
  endedAt?: number;
  missionDay: number;
  environmentName: string;
  oneWayDelaySeconds: number;
  summary: string;
  baselines?: PersonalBaseline[];
  recentFlags?: Array<{ day: number; indicator: string; status: string; note: string }>;
  recentEva?: boolean;
  triageAnswers?: Record<string, string | boolean | number>;
  redFlags?: string[];
  vitalsTimeline?: VitalsSnapshot[];
  protocolStepsCompleted?: Array<{ timestamp: number; step: string }>;
  customRequest?: string;
}): SbarReportData {
  const {
    patient,
    emergencyType,
    startedAt,
    endedAt = Date.now(),
    missionDay,
    environmentName,
    oneWayDelaySeconds,
    summary,
    baselines = [],
    recentFlags = [],
    recentEva = false,
    triageAnswers = {},
    redFlags = [],
    vitalsTimeline = [],
    protocolStepsCompleted = [],
    customRequest,
  } = params;

  const durationSeconds = Math.max(1, Math.round((endedAt - startedAt) / 1000));

  const baselineList = baselines.map((b) => ({
    indicator: b.indicator,
    label: b.indicator.replace(/_/g, ' ').toUpperCase(),
    normal: `${Math.round(b.mean)} ± ${Math.max(1, Math.round(b.sd))}`,
  }));

  const formattedTimeline = vitalsTimeline.map((v) => {
    const offsetSec = Math.max(0, Math.round((v.timestamp - startedAt) / 1000));
    const mins = Math.floor(offsetSec / 60);
    const secs = offsetSec % 60;
    const timeOffset = `+${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    let status = 'NOMINAL';
    if ((v.spo2 && v.spo2 < 90) || (v.heartRate && (v.heartRate > 120 || v.heartRate < 45))) {
      status = 'CRITICAL';
    } else if ((v.spo2 && v.spo2 < 95) || (v.heartRate && (v.heartRate > 100 || v.heartRate < 50))) {
      status = 'ALERT';
    }

    return {
      timestamp: v.timestamp,
      timeOffset,
      heartRate: v.heartRate,
      bloodPressure: v.systolicBp && v.diastolicBp ? `${v.systolicBp}/${v.diastolicBp} mmHg` : undefined,
      spo2: v.spo2,
      respiratoryRate: v.respiratoryRate,
      status,
    };
  });

  const formattedSteps = protocolStepsCompleted.map((p) => {
    const offsetSec = Math.max(0, Math.round((p.timestamp - startedAt) / 1000));
    const mins = Math.floor(offsetSec / 60);
    const secs = offsetSec % 60;
    return {
      timestamp: p.timestamp,
      timeOffset: `+${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`,
      step: p.step,
    };
  });

  const immediateNeeds: string[] = [
    'Flight Surgeon review of downlinked vitals timeline and autonomous protocol actions.',
    'Authorization of advanced medical kit medications per clinical protocol.',
  ];
  if (emergencyType === 'CPR') {
    immediateNeeds.unshift('URGENT: CPR resuscitation in progress. Immediate CMO / Flight Surgeon guidance requested.');
  } else if (emergencyType === 'CHEST_PAIN') {
    immediateNeeds.push('Telemetry review for acute coronary syndrome vs decompression sickness triage.');
  }

  const id = `SBAR-${missionDay}-${Date.now().toString(36).toUpperCase()}`;

  return {
    id,
    timestamp: endedAt,
    missionDay,
    environmentName,
    oneWayDelaySeconds,
    situation: {
      patientName: patient.name,
      patientCallSign: patient.callSign,
      patientRole: patient.role,
      emergencyType,
      startedAt,
      durationSeconds,
      summary,
    },
    background: {
      patientAge: patient.age,
      patientSex: patient.sex,
      baselines: baselineList,
      recentFlags,
      recentEva,
    },
    assessment: {
      triageAnswers,
      redFlags,
      vitalsTimeline: formattedTimeline,
      protocolStepsCompleted: formattedSteps,
    },
    request: {
      immediateNeeds,
      flightSurgeonAction:
        customRequest ||
        'Flight surgeon recommendations for continued observation, medication release, and habitat return/abort planning if condition deteriorates.',
      downlinkPriority: 'HIGH',
    },
  };
}

/**
 * Format SBAR report into standardized clinical handover text for print / clipboard.
 */
export function formatSbarPlainText(sbar: SbarReportData): string {
  const roundtripStr = formatDelayRoundtrip(sbar.oneWayDelaySeconds);
  const durationStr = formatElapsedSeconds(sbar.situation.durationSeconds);

  return `================================================================================
NASA SPACE APPS / HALO AUTONOMOUS EMERGENCY MEDICAL HANDOVER (SBAR)
Report ID: ${sbar.id}  ·  Mission Day ${sbar.missionDay}  ·  ${sbar.environmentName}
Round-Trip Ground Delay: ${roundtripStr}  ·  Event Duration: ${durationStr}
Priority: HIGH DOWNLINK PACKET
================================================================================

[S] SITUATION
Patient: ${sbar.situation.patientName} (${sbar.situation.patientCallSign}) · Age ${sbar.background.patientAge}${sbar.background.patientSex} · ${sbar.situation.patientRole}
Emergency: ${sbar.situation.emergencyType.replace(/_/g, ' ')}
Summary: ${sbar.situation.summary}

[B] BACKGROUND
Personal Baselines:
${sbar.background.baselines.length > 0 ? sbar.background.baselines.map((b) => `  - ${b.label}: ${b.normal}`).join('\n') : '  - No baseline data available'}
Recent 7-Day Flags:
${sbar.background.recentFlags.length > 0 ? sbar.background.recentFlags.map((f) => `  - Day ${f.day}: [${f.status}] ${f.indicator} — ${f.note}`).join('\n') : '  - None (nominal pre-event baseline)'}
Recent EVA Activity: ${sbar.background.recentEva ? 'YES (within past 24–48 hours)' : 'None reported'}

[A] ASSESSMENT
Active Red Flags:
${sbar.assessment.redFlags.length > 0 ? sbar.assessment.redFlags.map((r) => `  [!] ${r}`).join('\n') : '  - No acute red flags flagged'}
Triage Observations:
${Object.entries(sbar.assessment.triageAnswers).map(([k, v]) => `  - ${k}: ${String(v)}`).join('\n') || '  - Direct emergency protocol initiated'}
Vitals Log:
${sbar.assessment.vitalsTimeline.length > 0 ? sbar.assessment.vitalsTimeline.map((v) => `  ${v.timeOffset} · HR: ${v.heartRate ?? '—'} bpm · BP: ${v.bloodPressure ?? '—'} · SpO₂: ${v.spo2 ?? '—'}% [${v.status}]`).join('\n') : '  - Pending post-event vitals'}
Protocol Steps Executed:
${sbar.assessment.protocolStepsCompleted.length > 0 ? sbar.assessment.protocolStepsCompleted.map((p) => `  ${p.timeOffset} · ${p.step}`).join('\n') : '  - Initial assessment phase'}

[R] REQUEST
Flight Surgeon Actions Requested:
${sbar.request.immediateNeeds.map((n) => `  1. ${n}`).join('\n')}
Follow-up:
  ${sbar.request.flightSurgeonAction}
================================================================================
Generated offline by HALO Astronaut Health Co-Pilot · Prototype for NASA Space Apps`;
}
