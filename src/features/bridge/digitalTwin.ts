import type { MissionEnvironment } from '../../config/environments';
import {
  classifyRadiation,
  maxStatus,
  roundOneDecimal,
  roundWhole,
} from '../../config/thresholds';

export const CAREER_RADIATION_LIMIT_MSV = 600; // NASA 2022 career limit per HALO_SPEC §6 & §7.8
import type {
  CrewMember,
  HealthReading,
  HealthStatus,
  MissionConfig,
  PersonalBaseline,
  ScheduledTask,
} from '../../data/db';
import { computeBaseline, getSdFloor, type BaselineProfile } from '../../engine/baseline';
import { evaluateReading, getActionGuidance } from '../../engine/rules';

export type BodySystemId =
  | 'brain'
  | 'eyes'
  | 'heart'
  | 'lungs'
  | 'blood'
  | 'bones'
  | 'skin';

export interface SparklinePoint {
  day: number;
  label: string;
  value: number;
  unit: string;
}

export interface IndicatorDetailSummary {
  indicator: string;
  label: string;
  formattedValue: string;
  unit: string;
  status: HealthStatus;
  reasons: string[];
  timestamp: number;
  missionDay: number;
  baselineNote?: string;
  source: HealthReading['source'];
  sparkline: SparklinePoint[];
}

export interface BodyRegionTelemetry {
  id: BodySystemId;
  name: string;
  shortName: string;
  subtitle: string;
  hasData: boolean;
  status: HealthStatus | null; // null when no readings logged yet (never fake NOMINAL)
  effectiveStatus: HealthStatus;
  indicators: IndicatorDetailSummary[];
  reasons: string[];
  whatItDoes: string;
  spaceflightEffect: string;
  recommendedActions: string[];
  primaryActionRoute: string;
  primaryActionLabel: string;
  primarySparkline: SparklinePoint[];
  sparklineTitle: string;
  sparklineUnit: string;
}

export interface RadiationStatusSummary {
  doseMsv: number;
  careerLimitMsv: number;
  percentOfLimit: number;
  ratePerDay: number;
  sourceNote: string;
  isManualOverride: boolean;
  missionDay: number;
  status: HealthStatus;
  reasons: string[];
}

export interface ActiveAlertItem {
  id: string;
  regionId: BodySystemId;
  regionName: string;
  indicatorLabel: string;
  status: 'WATCH' | 'ALERT' | 'CRITICAL';
  valueLabel: string;
  reason: string;
  actionRoute: string;
}

const REGION_SYSTEM_ORDER: BodySystemId[] = [
  'brain',
  'eyes',
  'heart',
  'lungs',
  'blood',
  'bones',
  'skin',
];

const INDICATOR_LABELS: Record<string, string> = {
  pvt: 'PVT-B Reaction Speed',
  sleep: 'Sleep (24 h)',
  mood: 'Daily Mood & Stress',
  phq2: 'PHQ-2 Screen',
  gad2: 'GAD-2 Screen',
  phq2_gad2: 'Behavioral Screen (PHQ-2 / GAD-2)',
  amsler: 'Amsler Grid (SANS)',
  heart_rate: 'Resting Heart Rate',
  blood_pressure: 'Blood Pressure',
  spo2: 'Oxygen Saturation (SpO₂)',
  respiratory_rate: 'Respiratory Rate',
  glucose: 'Blood Glucose',
  temperature: 'Core Body Temperature',
  exercise: 'Countermeasure Exercise',
  radiation: 'Cumulative Radiation Dose',
};

function toBaselineProfile(
  indicator: string,
  dbBaselines: PersonalBaseline[],
  numericHistory: Array<{ value: number; timestamp: number }>
): BaselineProfile | null {
  const key = indicator === 'blood_pressure' ? 'systolic_bp' : indicator;
  const stored = dbBaselines.find((b) => b.indicator === key);
  if (stored && stored.sampleCount >= 3) {
    const floor = getSdFloor(key, stored.mean);
    return {
      indicator: key,
      mean: stored.mean,
      sd: stored.sd,
      effectiveSd: Math.max(stored.sd, floor),
      sampleCount: stored.sampleCount,
      source: 'pre-flight',
    };
  }
  return computeBaseline(key, numericHistory);
}

function extractPrimaryNumeric(r: HealthReading): number | null {
  if (typeof r.value === 'number' && Number.isFinite(r.value)) {
    return r.value;
  }
  if (typeof r.value === 'object' && r.value !== null) {
    const obj = r.value as Record<string, unknown>;
    const ind: string = r.indicator;
    if (ind === 'blood_pressure') {
      const sys = obj.sys ?? obj.systolic;
      return typeof sys === 'number' && Number.isFinite(sys) ? sys : null;
    }
    if (ind === 'exercise') {
      const res = typeof obj.resistanceMinutes === 'number' ? obj.resistanceMinutes : 0;
      const aero = typeof obj.aerobicMinutes === 'number' ? obj.aerobicMinutes : 0;
      return res + aero;
    }
    if (ind === 'mood') {
      return typeof obj.mood === 'number' ? obj.mood : null;
    }
    if (ind === 'amsler') {
      if (Array.isArray(obj.markedCells)) return obj.markedCells.length;
      if (typeof obj.newDistortionCount === 'number') return obj.newDistortionCount;
      return 0;
    }
    if (typeof obj.phq2 === 'number') {
      return Math.max(obj.phq2, typeof obj.gad2 === 'number' ? obj.gad2 : 0);
    }
  }
  if (typeof r.value === 'string') {
    const parsed = parseFloat(r.value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatReadingValue(r: HealthReading): string {
  if (r.indicator === 'heart_rate' && typeof r.value === 'number') {
    return `${roundWhole(r.value)} bpm`;
  }
  if (r.indicator === 'blood_pressure' && typeof r.value === 'object' && r.value !== null) {
    const obj = r.value as Record<string, unknown>;
    const sys = Number(obj.sys ?? obj.systolic ?? 0);
    const dia = Number(obj.dia ?? obj.diastolic ?? 0);
    return `${Math.round(sys)}/${Math.round(dia)} mmHg`;
  }
  if (r.indicator === 'spo2' && typeof r.value === 'number') {
    return `${roundWhole(r.value)} %`;
  }
  if (r.indicator === 'respiratory_rate' && typeof r.value === 'number') {
    return `${roundWhole(r.value)} /min`;
  }
  if (r.indicator === 'temperature' && typeof r.value === 'number') {
    return `${roundOneDecimal(r.value).toFixed(1)} °C`;
  }
  if (r.indicator === 'glucose' && typeof r.value === 'number') {
    return `${roundWhole(r.value)} mg/dL`;
  }
  if (r.indicator === 'sleep' && typeof r.value === 'number') {
    return `${roundOneDecimal(r.value).toFixed(1)} h`;
  }
  if (r.indicator === 'pvt' && typeof r.value === 'number') {
    const medianMs = r.value > 0 ? Math.round(1000 / r.value) : 0;
    return `${r.value.toFixed(2)} s⁻¹ (${medianMs} ms)`;
  }
  if (r.indicator === 'radiation' && typeof r.value === 'number') {
    return `${r.value.toFixed(1)} mSv`;
  }
  if (r.indicator === 'amsler' && typeof r.value === 'object' && r.value !== null) {
    const obj = r.value as Record<string, unknown>;
    const eye = obj.eye === 'left' ? 'Left (OS)' : 'Right (OD)';
    const newCount = typeof obj.newDistortionCount === 'number' ? obj.newDistortionCount : 0;
    if (obj.suddenLargeLoss) return `${eye}: Sudden central vision loss`;
    return newCount > 0 ? `${eye}: ${newCount} new distorted` : `${eye}: Monitored`;
  }
  if (r.indicator === 'mood' && typeof r.value === 'object' && r.value !== null) {
    const obj = r.value as Record<string, unknown>;
    return `Mood ${obj.mood ?? '–'}/5 · Stress ${obj.stress ?? '–'}/5`;
  }
  const ind: string = r.indicator;
  if (ind === 'exercise' && typeof r.value === 'object' && r.value !== null) {
    const obj = r.value as Record<string, unknown>;
    const res = Number(obj.resistanceMinutes ?? 0);
    const aero = Number(obj.aerobicMinutes ?? 0);
    return `${Math.round(res + aero)} min (${res} res / ${aero} aero)`;
  }
  if (typeof r.value === 'object' && r.value !== null) {
    const obj = r.value as Record<string, unknown>;
    if (typeof obj.phq2 === 'number') {
      return `PHQ-2 ${obj.phq2}/6 · GAD-2 ${obj.gad2 ?? 0}/6`;
    }
  }
  return `${String(r.value)}${r.unit ? ` ${r.unit}` : ''}`;
}

/**
 * Compute cumulative radiation dose vs 600 mSv career limit per HALO_SPEC §7.8 & §6:
 * Dose = Σ(environment rate × days), overridden if user enters a personal dosimeter reading.
 */
export function computeCumulativeRadiationStatus(
  readings: HealthReading[],
  config: MissionConfig | null,
  environment: MissionEnvironment
): RadiationStatusSummary {
  const missionDay = Math.max(1, config?.missionDay ?? 1);
  const radReadings = readings
    .filter((r) => r.indicator === 'radiation')
    .sort((a, b) => b.timestamp - a.timestamp);

  const latestManual = radReadings.find((r) => r.source === 'manual' && typeof r.value === 'number');

  let doseMsv: number;
  let isManualOverride = false;

  if (latestManual && typeof latestManual.value === 'number') {
    doseMsv = Math.max(0, roundOneDecimal(latestManual.value));
    isManualOverride = true;
  } else if (typeof config?.dosimeterDoseMsv === 'number' && config.dosimeterDoseMsv > 0) {
    // Handles Demo Mission config.dosimeterDoseMsv override
    doseMsv = roundOneDecimal(config.dosimeterDoseMsv);
  } else {
    doseMsv = roundOneDecimal(missionDay * environment.radiationDoseRatePerDay);
  }

  const evalRes = classifyRadiation(doseMsv);
  const percentOfLimit = Math.min(100, Math.round((doseMsv / CAREER_RADIATION_LIMIT_MSV) * 1000) / 10);

  return {
    doseMsv,
    careerLimitMsv: CAREER_RADIATION_LIMIT_MSV,
    percentOfLimit,
    ratePerDay: environment.radiationDoseRatePerDay,
    sourceNote: environment.radiationSourceNote,
    isManualOverride,
    missionDay,
    status: evalRes.status,
    reasons: evalRes.reasons,
  };
}

/**
 * Re-evaluate a stored reading via the HALO rules engine (thresholds + personal baseline),
 * preserving contextual multi-day / device-specific statuses where applicable.
 */
function evaluateStoredIndicator(
  indicator: string,
  historyAsc: HealthReading[],
  dbBaselines: PersonalBaseline[],
  gravityG: number,
  missionDay: number
): { status: HealthStatus; reasons: string[]; baselineNote?: string } {
  const latest = historyAsc[historyAsc.length - 1];
  const numericVal = extractPrimaryNumeric(latest);

  const baselineIndicators = new Set([
    'heart_rate',
    'spo2',
    'temperature',
    'glucose',
    'respiratory_rate',
    'sleep',
  ]);

  if (numericVal === null || indicator === 'amsler' || indicator === 'pvt' || indicator === 'mood' || indicator === 'exercise') {
    return {
      status: latest.status,
      reasons: latest.reasons && latest.reasons.length > 0 ? latest.reasons : [`${INDICATOR_LABELS[indicator] || indicator}: ${latest.status}`],
    };
  }

  const options: Record<string, unknown> = {};
  if (indicator === 'blood_pressure' && typeof latest.value === 'object' && latest.value !== null) {
    const obj = latest.value as Record<string, unknown>;
    options.dia = Number(obj.dia ?? obj.diastolic ?? 75);
  }

  const absEval = evaluateReading({
    indicator,
    value: numericVal,
    options,
    baseline: null,
    gravityG,
    missionDay,
  });

  let combinedStatus = maxStatus(absEval.status, latest.status);
  const mergedReasons = new Set<string>([...absEval.reasons, ...(latest.reasons ?? [])]);
  let baselineNote: string | undefined;

  if (baselineIndicators.has(indicator)) {
    const samples = historyAsc
      .map((r) => ({ value: extractPrimaryNumeric(r) ?? NaN, timestamp: r.timestamp }))
      .filter((s) => Number.isFinite(s.value));

    const profile = toBaselineProfile(indicator, dbBaselines, samples);
    if (profile && profile.sampleCount >= 3) {
      const baseEval = evaluateReading({
        indicator,
        value: numericVal,
        options,
        baseline: profile,
        recentValues: samples.map((s) => s.value),
        recentHistory: historyAsc.map((r, i) => ({
          day: r.missionDay || i + 1,
          value: extractPrimaryNumeric(r) ?? numericVal,
        })),
        gravityG,
        missionDay,
      });

      combinedStatus = maxStatus(combinedStatus, baseEval.status);
      for (const reason of baseEval.reasons) {
        mergedReasons.add(reason);
      }
      baselineNote = `Baseline: ${profile.mean} ± ${roundOneDecimal(profile.effectiveSd)}`;
    }
  }

  return {
    status: combinedStatus,
    reasons: Array.from(mergedReasons).slice(0, 4),
    baselineNote,
  };
}

interface RegionStaticMeta {
  name: string;
  shortName: string;
  subtitle: string;
  indicators: string[];
  whatItDoes: string;
  spaceflightEffect: string;
  primaryActionRoute: string;
  primaryActionLabel: string;
  defaultSteps: string[];
}

const REGION_META: Record<BodySystemId, RegionStaticMeta> = {
  brain: {
    name: 'Brain & Neuro-Cognition',
    shortName: 'Brain',
    subtitle: 'Vigilance · Sleep · Mood · Behavioral',
    indicators: ['pvt', 'sleep', 'mood', 'phq2', 'gad2', 'phq2_gad2'],
    whatItDoes:
      'Governs reaction speed, sustained attention, circadian sleep recovery, mood stability, and mission decision-making.',
    spaceflightEffect:
      'Circadian disruption, elevated CO₂, confinement, and workload sleep debt erode vigilance before crewmembers feel fatigued.',
    primaryActionRoute: '/cognition',
    primaryActionLabel: 'Run PVT-B / Log Sleep',
    defaultSteps: [
      'Complete daily morning sleep & mood check-in.',
      'Run standardized 3-minute PVT-B before safety-critical operations.',
      'Prioritize dark, quiet sleep period if total sleep falls below 6 h.',
    ],
  },
  eyes: {
    name: 'Visual System & Optic Nerve (SANS)',
    shortName: 'Eyes',
    subtitle: 'Amsler Macular Map · Right & Left Eyes',
    indicators: ['amsler'],
    whatItDoes:
      'Delivers central macular acuity and preserves optic nerve head perfusion during flight.',
    spaceflightEffect:
      'Spaceflight Associated Neuro-ocular Syndrome (SANS): headward fluid shifts raise pressure behind the globe, leading to optic disc swelling and choroidal folds.',
    primaryActionRoute: '/vision',
    primaryActionLabel: 'Open Amsler Grid Screen',
    defaultSteps: [
      'Calibrate screen with a bank card and test Right Eye (OD) and Left Eye (OS) weekly.',
      'Compare any new wavy/blurred cells against prior eye maps.',
      'Note: Self-screen does not replace onboard OCT imaging or fundoscopy.',
    ],
  },
  heart: {
    name: 'Heart & Cardiovascular',
    shortName: 'Heart',
    subtitle: 'Resting HR · Blood Pressure',
    indicators: ['heart_rate', 'blood_pressure'],
    whatItDoes:
      'Pumps oxygenated blood through systemic circulation and maintains arterial perfusion pressure.',
    spaceflightEffect:
      'Headward fluid redistribution alters stroke volume and plasma volume; resting BP elevation increases intracranial and ocular strain.',
    primaryActionRoute: '/scan',
    primaryActionLabel: 'Run Camera HR Scan',
    defaultSteps: [
      'Perform daily 20-second contactless camera rPPG or fingertip HR scan.',
      'Measure resting cuff blood pressure every 3 days after 5 minutes seated rest.',
      'Maintain scheduled hydration and aerobic/resistance countermeasures.',
    ],
  },
  lungs: {
    name: 'Lungs & Oxygenation',
    shortName: 'Lungs',
    subtitle: 'SpO₂ · Respiratory Rate',
    indicators: ['spo2', 'respiratory_rate'],
    whatItDoes:
      'Exchanges cabin oxygen across alveolar membranes into hemoglobin while clearing metabolic CO₂.',
    spaceflightEffect:
      'Gravity-driven ventilation/perfusion gradients vanish in 0g; stagnant air pockets require steady cabin airflow to prevent hypercapnia.',
    primaryActionRoute: '/checks',
    primaryActionLabel: 'Log SpO₂ / Resp Rate',
    defaultSteps: [
      'Verify pulse oximetry SpO₂ ≥ 95% and count 60-second resting breaths.',
      'Verify habitat fan airflow and CO₂ scrubbing telemetry if breath rate rises.',
      'Report acute dyspnea or SpO₂ ≤ 90% via Emergency mode immediately.',
    ],
  },
  blood: {
    name: 'Blood, Metabolism & Immune',
    shortName: 'Blood',
    subtitle: 'Glucose · Core Temp · Immune',
    indicators: ['glucose', 'temperature'],
    whatItDoes:
      'Regulates glucose fuel delivery, core body thermoregulation, and innate/adaptive immune defenses.',
    spaceflightEffect:
      'Microgravity impairs skeletal muscle insulin sensitivity, blunts convective cooling (~1 °C resting temperature rise after day 30 in 0g), and triggers immune dysregulation.',
    primaryActionRoute: '/checks',
    primaryActionLabel: 'Log Glucose / Temp',
    defaultSteps: [
      'Log weekly capillary blood glucose (mark fasting vs post-meal).',
      'Compare slight temperature rises in > 30 day 0g flight with personal trend.',
      'Maintain hygiene and balanced caloric/micronutrient intake.',
    ],
  },
  bones: {
    name: 'Bones & Muscle Countermeasures',
    shortName: 'Bones / Muscle',
    subtitle: 'Resistance & Aerobic Adherence',
    indicators: ['exercise'],
    whatItDoes:
      'Supports skeletal mechanical strength, posture, and functional muscle power for EVA and planetary operations.',
    spaceflightEffect:
      'Skeletal unloading in 0g/partial gravity accelerates bone resorption and muscle deconditioning unless countered by daily resistance and aerobic training.',
    primaryActionRoute: '/checks',
    primaryActionLabel: 'Log Exercise Countermeasure',
    defaultSteps: [
      'Complete daily high-load resistance and aerobic countermeasure protocol.',
      'Log resistance minutes, aerobic minutes, and perceived exertion (RPE).',
      'Coordinate nutrition (vitamin D and calcium intake) per flight crew plan.',
    ],
  },
  skin: {
    name: 'Skin & Whole-Body Radiation',
    shortName: 'Radiation',
    subtitle: 'Cumulative mSv vs 600 mSv Career Limit',
    indicators: ['radiation'],
    whatItDoes:
      'Monitors whole-body ionizing exposure from cosmic rays and sudden Solar Particle Events.',
    spaceflightEffect:
      'Outside Earth’s magnetic shielding, Galactic Cosmic Radiation (GCR) and Solar Particle Events accumulate ionizing dose across tissues and marrow.',
    primaryActionRoute: '#radiation-panel',
    primaryActionLabel: 'Inspect Dosimetry & SPE Protocol',
    defaultSteps: [
      'Track cumulative mission mSv against NASA’s 600 mSv career limit.',
      'Enter personal electronic dosimeter overrides whenever available.',
      'On SPE alert, move immediately to highest-mass shielded shelter until All-Clear.',
    ],
  },
};

export interface DigitalTwinBuildResult {
  regions: Record<BodySystemId, BodyRegionTelemetry>;
  regionList: BodyRegionTelemetry[];
  radiation: RadiationStatusSummary;
  alerts: ActiveAlertItem[];
  allLatestReadings: Array<{ indicator: string; status: HealthStatus; reasons: string[] }>;
}

/**
 * Compute full live Digital Twin state by evaluating crew HealthReadings, Baselines,
 * ScheduledTasks, MissionConfig, and Environment through HALO's rules engine.
 */
export function buildDigitalTwinTelemetry(params: {
  crew: CrewMember | null;
  readings: HealthReading[];
  baselines: PersonalBaseline[];
  tasks: ScheduledTask[];
  config: MissionConfig | null;
  environment: MissionEnvironment;
}): DigitalTwinBuildResult {
  const { crew, readings, baselines, tasks, config, environment } = params;
  const missionDay = Math.max(1, config?.missionDay ?? 1);

  // Filter out POOR quality scans (Spec §7.3 & §2: never display/use POOR readings for clinical status)
  const validCrewReadings = readings
    .filter((r) => (!crew?.id || r.crewMemberId === crew.id) && r.quality !== 'POOR')
    .sort((a, b) => a.timestamp - b.timestamp);

  // Group readings chronologically per indicator
  const byIndicator = new Map<string, HealthReading[]>();
  for (const r of validCrewReadings) {
    const arr = byIndicator.get(r.indicator) ?? [];
    arr.push(r);
    byIndicator.set(r.indicator, arr);
  }

  // Evaluate radiation live via §7.8 + §6
  const radiation = computeCumulativeRadiationStatus(validCrewReadings, config, environment);

  const regions = {} as Record<BodySystemId, BodyRegionTelemetry>;
  const alerts: ActiveAlertItem[] = [];
  const allLatestReadings: Array<{ indicator: string; status: HealthStatus; reasons: string[] }> = [];

  for (const regionId of REGION_SYSTEM_ORDER) {
    const meta = REGION_META[regionId];
    const indicatorSummaries: IndicatorDetailSummary[] = [];

    if (regionId === 'skin') {
      // Radiation is always computable from missionDay * env rate (or dosimeter override)
      const radReadings = byIndicator.get('radiation') ?? [];
      const sparkline: SparklinePoint[] = radReadings.slice(-10).map((r) => ({
        day: r.missionDay,
        label: `Day ${r.missionDay}`,
        value: extractPrimaryNumeric(r) ?? radiation.doseMsv,
        unit: 'mSv',
      }));
      if (sparkline.length === 0) {
        sparkline.push({
          day: radiation.missionDay,
          label: `Day ${radiation.missionDay}`,
          value: radiation.doseMsv,
          unit: 'mSv',
        });
      }

      indicatorSummaries.push({
        indicator: 'radiation',
        label: 'Cumulative Radiation Dose',
        formattedValue: `${radiation.doseMsv.toFixed(1)} / ${CAREER_RADIATION_LIMIT_MSV} mSv (${radiation.percentOfLimit}%)`,
        unit: 'mSv',
        status: radiation.status,
        reasons: radiation.reasons,
        timestamp: Date.now(),
        missionDay,
        source: radiation.isManualOverride ? 'manual' : 'calculated',
        baselineNote: `${radiation.ratePerDay} mSv/day approx. · ${radiation.sourceNote}`,
        sparkline,
      });

      allLatestReadings.push({
        indicator: 'radiation',
        status: radiation.status,
        reasons: radiation.reasons,
      });
    } else {
      for (const ind of meta.indicators) {
        const list = byIndicator.get(ind);
        if (!list || list.length === 0) continue;

        // Special handling for Amsler: keep latest per eye so both eyes surface cleanly
        if (ind === 'amsler') {
          const latestPerEye = new Map<string, HealthReading>();
          for (const item of list) {
            const obj =
              typeof item.value === 'object' && item.value !== null
                ? (item.value as Record<string, unknown>)
                : {};
            const eyeKey = obj.eye === 'left' ? 'left' : 'right';
            latestPerEye.set(eyeKey, item);
          }

          let worstAmslerStatus: HealthStatus = 'NOMINAL';
          const amslerReasons: string[] = [];
          for (const item of latestPerEye.values()) {
            worstAmslerStatus = maxStatus(worstAmslerStatus, item.status);
            if (item.reasons?.[0]) amslerReasons.push(item.reasons[0]);
          }

          const latestAny = list[list.length - 1];
          const sparkline = list.slice(-10).map((r) => ({
            day: r.missionDay,
            label: `Day ${r.missionDay}`,
            value: extractPrimaryNumeric(r) ?? 0,
            unit: 'cells',
          }));

          indicatorSummaries.push({
            indicator: 'amsler',
            label: INDICATOR_LABELS.amsler,
            formattedValue: Array.from(latestPerEye.values())
              .map((item) => formatReadingValue(item))
              .join(' · '),
            unit: 'grid',
            status: worstAmslerStatus,
            reasons: amslerReasons.length > 0 ? amslerReasons : ['Amsler macular check recorded'],
            timestamp: latestAny.timestamp,
            missionDay: latestAny.missionDay,
            source: latestAny.source,
            sparkline,
          });

          allLatestReadings.push({
            indicator: 'amsler',
            status: worstAmslerStatus,
            reasons: amslerReasons,
          });
          continue;
        }

        const latest = list[list.length - 1];
        const evaluated = evaluateStoredIndicator(
          ind,
          list,
          baselines,
          environment.gravityG,
          missionDay
        );

        const sparkline: SparklinePoint[] = list
          .slice(-12)
          .map((r) => {
            const val = extractPrimaryNumeric(r);
            return val === null
              ? null
              : {
                  day: r.missionDay,
                  label: `Day ${r.missionDay}`,
                  value: val,
                  unit: r.unit,
                };
          })
          .filter((p): p is SparklinePoint => p !== null);

        indicatorSummaries.push({
          indicator: ind,
          label: INDICATOR_LABELS[ind] ?? ind,
          formattedValue: formatReadingValue(latest),
          unit: latest.unit,
          status: evaluated.status,
          reasons: evaluated.reasons,
          timestamp: latest.timestamp,
          missionDay: latest.missionDay,
          baselineNote: evaluated.baselineNote,
          source: latest.source,
          sparkline,
        });

        allLatestReadings.push({
          indicator: ind,
          status: evaluated.status,
          reasons: evaluated.reasons,
        });
      }
    }

    // Exercise overdue countermeasure check for Bones/Muscle if no recent exercise logged & overdue task exists
    if (regionId === 'bones' && indicatorSummaries.length === 0) {
      const overdueExercise = tasks.find(
        (t) =>
          t.taskType === 'exercise' &&
          t.status !== 'completed' &&
          (t.status === 'overdue' || t.dueDay < missionDay)
      );
      if (overdueExercise) {
        indicatorSummaries.push({
          indicator: 'exercise',
          label: 'Countermeasure Exercise',
          formattedValue: 'Overdue (0 min logged)',
          unit: 'min',
          status: 'WATCH',
          reasons: ['Scheduled resistance/aerobic countermeasure overdue'],
          timestamp: Date.now(),
          missionDay,
          source: 'manual',
          sparkline: [],
        });
      }
    }

    const hasData = indicatorSummaries.length > 0;
    let regionStatus: HealthStatus | null = null;
    if (hasData) {
      regionStatus = indicatorSummaries.reduce<HealthStatus>(
        (worst, item) => maxStatus(worst, item.status),
        'NOMINAL'
      );
    }

    const effectiveStatus: HealthStatus = regionStatus ?? 'NOMINAL';

    // Build sorted reasons & rules guidance
    const regionReasons = indicatorSummaries
      .slice()
      .sort((a, b) => {
        const rank = { CRITICAL: 4, ALERT: 3, WATCH: 2, NOMINAL: 1 };
        return rank[b.status] - rank[a.status];
      })
      .flatMap((s) => s.reasons);

    // Choose worst indicator guidance when elevated, otherwise region default steps
    let recommendedActions = meta.defaultSteps;
    if (hasData && regionStatus && regionStatus !== 'NOMINAL') {
      const worstInd = indicatorSummaries
        .slice()
        .sort((a, b) => {
          const rank = { CRITICAL: 4, ALERT: 3, WATCH: 2, NOMINAL: 1 };
          return rank[b.status] - rank[a.status];
        })[0];
      const latestNum = worstInd.sparkline[worstInd.sparkline.length - 1]?.value ?? 0;
      const guidance = getActionGuidance(worstInd.indicator, regionStatus, latestNum);
      recommendedActions = [guidance.immediateAction, ...guidance.recommendedSteps];
    }

    const primaryWithSpark =
      indicatorSummaries.find((s) => s.sparkline.length > 0) ?? indicatorSummaries[0];

    regions[regionId] = {
      id: regionId,
      name: meta.name,
      shortName: meta.shortName,
      subtitle: meta.subtitle,
      hasData,
      status: regionStatus,
      effectiveStatus,
      indicators: indicatorSummaries,
      reasons:
        regionReasons.length > 0
          ? Array.from(new Set(regionReasons))
          : ['No readings logged for this system yet.'],
      whatItDoes: meta.whatItDoes,
      spaceflightEffect: meta.spaceflightEffect,
      recommendedActions,
      primaryActionRoute: meta.primaryActionRoute,
      primaryActionLabel: meta.primaryActionLabel,
      primarySparkline: primaryWithSpark?.sparkline ?? [],
      sparklineTitle: primaryWithSpark ? `${primaryWithSpark.label} Trend` : 'Trend',
      sparklineUnit: primaryWithSpark?.unit ?? '',
    };

    // Collect non-NOMINAL indicators for Bridge Active Alerts list
    for (const item of indicatorSummaries) {
      if (item.status !== 'NOMINAL') {
        alerts.push({
          id: `${regionId}-${item.indicator}`,
          regionId,
          regionName: meta.shortName,
          indicatorLabel: item.label,
          status: item.status,
          valueLabel: item.formattedValue,
          reason: item.reasons[0] ?? `${item.label} flagged ${item.status}`,
          actionRoute: meta.primaryActionRoute,
        });
      }
    }
  }

  // Sort alerts by severity: CRITICAL > ALERT > WATCH
  alerts.sort((a, b) => {
    const rank = { CRITICAL: 3, ALERT: 2, WATCH: 1 };
    return rank[b.status] - rank[a.status];
  });

  return {
    regions,
    regionList: REGION_SYSTEM_ORDER.map((id) => regions[id]),
    radiation,
    alerts,
    allLatestReadings,
  };
}
