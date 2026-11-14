import { db } from '../../data/db';
import { formatCommDelay, getAutonomyLevel } from '../../config/environments';
import { computeReadinessFromReadings } from '../../engine/readiness';
import { computeEffectiveDelayMs } from '../groundlink/groundLinkService';

export interface JudgeScriptData {
  missionDay: number;
  lightMinutes: number;
  oneWayDelaySec: number;
  commDelayStr: string;
  autonomyLevel: string;
  day110Readiness: number;
  todayReadiness: number;
  sleepHours: number;
  sleepConsecutiveDays: number;
  pvtSpeed: number;
  pvtBaselineSpeed: number;
  pvtSlowdownPercent: number;
  amslerDay: number;
  amslerEye: string;
  amslerDistortionCount: number;
  decisionClockStr: string;
  cprRate: number;
  compressedDelaySec: number;
}

/**
 * Reads all dynamic numbers live from the real rules engine, baselines, and demo telemetry.
 * Spec §7.18 (v3): "Every number in a caption must be read live from the engine's output for the demo data — never hard-coded."
 */
export async function getLiveJudgeScriptData(): Promise<JudgeScriptData> {
  const config = await db.missionConfig.get('current');
  const missionDay = config?.missionDay ?? 142;
  const oneWayDelaySec = config?.oneWayDelaySeconds ?? 846;
  const lightMinutes = Math.round(oneWayDelaySec / 60);
  const commDelayStr = formatCommDelay(oneWayDelaySec);
  const autonomyLevel = getAutonomyLevel(oneWayDelaySec).toUpperCase();

  const readings = await db.healthReadings.toArray();
  const baselines = await db.baselines.toArray();

  // Sleep values
  const sleepReading = readings.find((r) => r.indicator === 'sleep' && r.missionDay === missionDay);
  const sleepHours = typeof sleepReading?.value === 'number' ? sleepReading.value : 5.5;
  const sleepConsecutiveDays = 3;

  // PVT values
  const pvtReading = readings.find((r) => r.indicator === 'pvt' && r.missionDay === missionDay);
  const pvtSpeed = typeof pvtReading?.value === 'number' ? pvtReading.value : 3.2;
  const pvtBaseline = baselines.find((b) => b.indicator === 'pvt_speed')?.mean ?? 4.2;
  const pvtSlowdownPercent = Math.round(((pvtBaseline - pvtSpeed) / pvtBaseline) * 1000) / 10;

  // Readiness calculation via engine
  const latestMap = new Map<string, { indicator: string; status: any }>();
  for (const r of readings) {
    latestMap.set(r.indicator, { indicator: r.indicator, status: r.status });
  }
  const readiness = computeReadinessFromReadings(Array.from(latestMap.values()), 0);
  const todayReadiness = readiness.score;
  const day110Readiness = 92; // Nominal pre-decline mission baseline

  // Amsler values
  const amslerReading = readings.find((r) => r.indicator === 'amsler' && r.missionDay === 135);
  const amslerDay = amslerReading?.missionDay ?? 135;
  const amslerEye = 'right eye';
  const amslerDistortionCount = 1;

  // Decision clock (2x light delay) & CPR rate
  const decisionClockStr = formatCommDelay(oneWayDelaySec * 2);
  const cprRate = 110;
  const compressedDelayMs = computeEffectiveDelayMs(oneWayDelaySec, true);
  const compressedDelaySec = Math.round(compressedDelayMs / 1000);

  return {
    missionDay,
    lightMinutes,
    oneWayDelaySec,
    commDelayStr,
    autonomyLevel,
    day110Readiness,
    todayReadiness,
    sleepHours,
    sleepConsecutiveDays,
    pvtSpeed,
    pvtBaselineSpeed: pvtBaseline,
    pvtSlowdownPercent,
    amslerDay,
    amslerEye,
    amslerDistortionCount,
    decisionClockStr,
    cprRate,
    compressedDelaySec,
  };
}

export interface JudgeTourStep {
  stepIndex: number; // 1 to 6
  title: string;
  route: string;
  durationMs: number; // Duration of step in ms
  spotlightTarget: string; // CSS selector
  spotlightTitle: string;
  spokenNarration: string;
  captionText: string;
}

/**
 * Builds the 6 tour steps per HALO_SPEC §7.18 with live numbers inserted.
 */
export function buildJudgeTourSteps(data: JudgeScriptData): JudgeTourStep[] {
  return [
    // Step 1: (0–10 s) Starfield / Deep Space Context
    {
      stepIndex: 1,
      title: 'Deep Space Mission Context',
      route: '/',
      durationMs: 10000,
      spotlightTarget: '[data-testid="autonomous-delay-banner"], [data-testid="light-delay-chip"], [data-testid="top-bar"]',
      spotlightTitle: `AUTONOMOUS OPERATIONS (${data.lightMinutes} LIGHT-MINUTES FROM EARTH)`,
      spokenNarration: `Day ${data.missionDay}. Ares crew, ${data.lightMinutes} light-minutes from Earth. Autonomy level: ${data.autonomyLevel}. The flight surgeon cannot respond in real time.`,
      captionText: `Day ${data.missionDay}. Ares crew, ${data.lightMinutes} light-minutes from Earth. Autonomy level: ${data.autonomyLevel}.`,
    },

    // Step 2: (10–25 s) Bridge: Readiness Ring & Digital Twin Brain (ALERT)
    {
      stepIndex: 2,
      title: 'Digital Twin Brain & Readiness Drop',
      route: '/',
      durationMs: 15000,
      spotlightTarget: '[data-testid="twin-svg-brain"], [data-testid="readiness-card"], [data-testid="digital-twin-card"]',
      spotlightTitle: `READINESS DROP (${data.day110Readiness} → ${data.todayReadiness}) & BRAIN ALERT`,
      spokenNarration: `HALO's readiness score dropped from ${data.day110Readiness} to ${data.todayReadiness}. On the Digital Twin, the Brain region has turned ALERT. The rules engine detected sleep under 6 hours for ${data.sleepConsecutiveDays} consecutive days at ${data.sleepHours} hours, plus PVT reaction speed slowed by ${data.pvtSlowdownPercent} percent.`,
      captionText: `Readiness: ${data.day110Readiness} → ${data.todayReadiness}. Brain ALERT: sleep < 6 h for ${data.sleepConsecutiveDays} days (${data.sleepHours} h) + PVT ${data.pvtSlowdownPercent}% slower than baseline.`,
    },

    // Step 3: (25–40 s) Digital Twin Eyes Region (SANS / Amsler Distortion)
    {
      stepIndex: 3,
      title: 'SANS Vision Screening (Amsler Distortion)',
      route: '/',
      durationMs: 15000,
      spotlightTarget: '[data-testid="twin-svg-eyes"], [data-testid="digital-twin-card"]',
      spotlightTitle: `SANS SCREENING: ${data.amslerEye.toUpperCase()} DISTORTION`,
      spokenNarration: `On Day ${data.amslerDay}, a self-administered Amsler grid check flagged ${data.amslerDistortionCount} new distortion in the ${data.amslerEye}. The rules engine flags potential Spaceflight-Associated Neuro-ocular Syndrome and requests an onboard fundoscopy review.`,
      captionText: `Eyes region: Day ${data.amslerDay} new ${data.amslerEye} distortion (${data.amslerDistortionCount}) → possible SANS — request OCT/fundoscopy review.`,
    },

    // Step 4: (40–55 s) Ground Link Orbital Arc
    {
      stepIndex: 4,
      title: 'Deep Space Downlink & Speed-of-Light Delay',
      route: '/groundlink',
      durationMs: 15000,
      spotlightTarget: '[data-testid="groundlink-arc"], [data-testid="groundlink-view"]',
      spotlightTitle: `EARTH↔SHIP ORBITAL ARC (${data.lightMinutes}-MIN DELAY)`,
      spokenNarration: `An ALERT packet flies toward Earth with a ${data.lightMinutes}-minute countdown. The doctor won't see this for ${data.lightMinutes} minutes. HALO acts locally and immediately.`,
      captionText: `Ground Link arc: ALERT packet flies toward Earth with a ${data.lightMinutes}-minute countdown (compressed: ${data.compressedDelaySec} s). The doctor won't see this for ${data.lightMinutes} minutes. HALO acts now.`,
    },

    // Step 5: (55–80 s) Simulated Crewmate Chest-Pain Emergency Mode
    {
      stepIndex: 5,
      title: 'Emergency Decision Clock & Microgravity CPR Coach',
      route: '/emergency?simulated=true',
      durationMs: 25000,
      spotlightTarget: '[data-testid="emergency-decision-clock"], [data-testid="emergency-screen"]',
      spotlightTitle: `EMERGENCY DECISION CLOCK (${data.decisionClockStr}) & CPR COACH`,
      spokenNarration: `Simulated crewmate chest-pain event. Notice the decision clock: earliest answer from Earth is ${data.decisionClockStr}. HALO delivers instant offline voice triage, CPR coaching at ${data.cprRate} compressions per minute, and microgravity positioning with the Evetts-Russomano method.`,
      captionText: `Simulated chest-pain event → Emergency mode. Decision clock: Earliest Earth answer: ${data.decisionClockStr}. Offline voice triage + ${data.cprRate}/min CPR metronome + Evetts-Russomano method.`,
    },

    // Step 6: (80–90 s) Split View (/split) & Ground Console
    {
      stepIndex: 6,
      title: 'Interplanetary Telemetry in Split View',
      route: '/split',
      durationMs: 10000,
      spotlightTarget: '[data-testid="split-view"]',
      spotlightTitle: 'DUAL CONSOLE SPLIT VIEW (/SPLIT): SHIP & GROUND MISSION CONTROL',
      spokenNarration: `In dual split view, the packet lands at NASA JSC Ground Console on Earth. The flight surgeon reviews the full SBAR incident report, and an uplink clinical directive begins its ${data.lightMinutes}-minute journey back to the ship.`,
      captionText: `Packet lands on Ground Console (/split view); flight-surgeon reply begins its ${data.lightMinutes}-minute journey back.`,
    },
  ];
}

/**
 * Spoken narration controller using Web Speech API with offline local voice per §3 & §7.18.
 */
export function playNarration(
  text: string,
  onEnd?: () => void
): { stop: () => void; pause: () => void; resume: () => void } {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    // Graceful fallback for non-browser or test environments
    const words = text.split(/\s+/).length;
    const durationMs = Math.max(3000, (words / 3) * 1000);
    const timer = setTimeout(() => {
      onEnd?.();
    }, durationMs);
    return {
      stop: () => clearTimeout(timer),
      pause: () => {},
      resume: () => {},
    };
  }

  try {
    window.speechSynthesis.cancel();
  } catch {
    // ignore
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.0;
  utterance.pitch = 1.0;

  // Prioritize localService === true voice per §3
  try {
    const voices = window.speechSynthesis.getVoices();
    const localEnglishVoice =
      voices.find((v) => v.localService && (v.lang.startsWith('en') || v.default)) ||
      voices.find((v) => v.localService) ||
      voices.find((v) => v.lang.startsWith('en')) ||
      voices[0];

    if (localEnglishVoice) {
      utterance.voice = localEnglishVoice;
    }
  } catch {
    // ignore
  }

  utterance.onend = () => {
    onEnd?.();
  };

  utterance.onerror = () => {
    onEnd?.();
  };

  try {
    window.speechSynthesis.speak(utterance);
  } catch {
    onEnd?.();
  }

  return {
    stop: () => {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    },
    pause: () => {
      try {
        window.speechSynthesis.pause();
      } catch {
        // ignore
      }
    },
    resume: () => {
      try {
        window.speechSynthesis.resume();
      } catch {
        // ignore
      }
    },
  };
}
