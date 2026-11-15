/**
 * Voice/typed actions for the HALO assistant: log a reading by speaking it,
 * react to a symptom, or pause. Readings go through the same rules engine as
 * the manual check flows and are saved in the same shape.
 */
import { db, type HealthReading } from '../../data/db';
import { evaluateReading } from '../../engine/rules';

export interface ActionResult { say: string; go?: string; logged?: boolean }

type Parsed =
  | { kind: 'blood_pressure'; sys: number; dia: number }
  | { kind: 'heart_rate' | 'spo2' | 'temperature' | 'glucose' | 'respiratory_rate' | 'sleep'; value: number; postMeal?: boolean };

const UNITS: Record<string, string> = {
  blood_pressure: 'mmHg', heart_rate: 'bpm', spo2: '%', temperature: '°C', glucose: 'mg/dL', respiratory_rate: '/min', sleep: 'hours',
};
const NAMES: Record<string, string> = {
  blood_pressure: 'blood pressure', heart_rate: 'heart rate', spo2: 'oxygen saturation', temperature: 'temperature', glucose: 'blood glucose', respiratory_rate: 'breathing rate', sleep: 'sleep',
};

const num = (s: string) => parseFloat(s.replace(',', '.'));

/** Pull a reading out of a sentence. Returns null when nothing measurable is present. */
export function parseReading(text: string): Parsed | null {
  const t = text.toLowerCase().replace(/[^a-z0-9.,/%°\s-]/g, ' ');
  const has = (...w: string[]) => w.some((x) => new RegExp(`(^|\\s)${x}(\\s|$)`).test(t));

  // Blood pressure: "120 over 80", "120/80", "bp 118 by 76"
  const bp = t.match(/(\d{2,3})\s*(?:over|\/|by|on)\s*(\d{2,3})/);
  if (bp && (has('pressure', 'bp', 'systolic', 'blood') || /\d{2,3}\s*(over|\/)\s*\d{2,3}/.test(t))) {
    return { kind: 'blood_pressure', sys: num(bp[1]), dia: num(bp[2]) };
  }
  // Sleep: "slept 6 hours", "sleep was 5 and a half hours", "6.5 hours of sleep"
  if (has('slept', 'sleep', 'hours of sleep')) {
    const half = /half/.test(t) ? 0.5 : 0;
    const m = t.match(/(\d{1,2}(?:[.,]\d)?)\s*(?:hours?|hrs?|h)\b/) || t.match(/(\d{1,2}(?:[.,]\d)?)/);
    if (m) return { kind: 'sleep', value: num(m[1]) + half };
  }
  // Temperature: "37.6", "98.8 fahrenheit", "temperature is 37 degrees"
  if (has('temperature', 'temp', 'fever', 'degrees', 'celsius', 'fahrenheit')) {
    const m = t.match(/(\d{2,3}(?:[.,]\d+)?)/);
    if (m) {
      let v = num(m[1]);
      if (/fahrenheit|\bf\b/.test(t) || v > 45) v = Math.round(((v - 32) * 5) / 9 * 10) / 10;
      return { kind: 'temperature', value: v };
    }
  }
  // SpO2: "oxygen 96", "sats 97 percent", "spo2 is 95"
  if (has('oxygen', 'spo2', 'sats', 'saturation', 'o2')) {
    const m = t.match(/(\d{2,3})\s*(?:%|percent)?/);
    if (m) return { kind: 'spo2', value: num(m[1]) };
  }
  // Glucose: "sugar 110", "glucose 5.8" (mmol/L → mg/dL), "after a meal"
  if (has('glucose', 'sugar')) {
    const m = t.match(/(\d{1,3}(?:[.,]\d+)?)/);
    if (m) {
      let v = num(m[1]);
      if (v < 30) v = Math.round(v * 18);
      return { kind: 'glucose', value: v, postMeal: /after (a )?(meal|eating|lunch|dinner|breakfast)|post ?meal/.test(t) };
    }
  }
  // Respiratory rate: "breathing rate 18", "16 breaths"
  if (has('breaths', 'breathing rate', 'respiratory', 'respiration')) {
    const m = t.match(/(\d{1,2})/);
    if (m) return { kind: 'respiratory_rate', value: num(m[1]) };
  }
  // Heart rate: "pulse 88", "heart rate is 72", "72 bpm"
  if (has('pulse', 'heart rate', 'heartrate', 'bpm', 'heart', 'beats')) {
    const m = t.match(/(\d{2,3})\s*(?:bpm|beats)?/);
    if (m) return { kind: 'heart_rate', value: num(m[1]) };
  }
  return null;
}

const SANE: Record<string, [number, number]> = {
  heart_rate: [20, 250], spo2: [50, 100], temperature: [30, 45], glucose: [20, 600], respiratory_rate: [4, 60], sleep: [0, 16],
};

export async function logSpokenReading(text: string, crewId: number | undefined, missionDay: number, gravityG: number): Promise<ActionResult | null> {
  const parsed = parseReading(text);
  if (!parsed) return null;
  if (!crewId) return { say: 'I can log that once a crew profile is set up.' };

  if (parsed.kind === 'blood_pressure') {
    if (parsed.sys < 50 || parsed.sys > 260 || parsed.dia < 30 || parsed.dia > 160 || parsed.dia >= parsed.sys) {
      return { say: `${parsed.sys} over ${parsed.dia} doesn't look like a valid blood pressure. Could you say it again?` };
    }
    const ev = evaluateReading({ indicator: 'blood_pressure', value: parsed.sys, options: { dia: parsed.dia }, gravityG, missionDay });
    await db.healthReadings.add({
      crewMemberId: crewId, timestamp: Date.now(), missionDay, indicator: 'blood_pressure',
      value: { sys: parsed.sys, dia: parsed.dia }, unit: 'mmHg', status: ev.status, reasons: ev.reasons, source: 'manual', quality: 'GOOD', notes: 'logged by voice',
    } as HealthReading);
    return { say: `Logged blood pressure ${parsed.sys} over ${parsed.dia}. ${phrase(ev.status)} ${ev.reasons[0] ?? ''}`.trim(), logged: true, go: '/' };
  }

  const [lo, hi] = SANE[parsed.kind];
  if (parsed.value < lo || parsed.value > hi) {
    return { say: `${parsed.value} ${UNITS[parsed.kind]} is outside the range I can accept for ${NAMES[parsed.kind]}. Could you repeat it?` };
  }
  const ev = evaluateReading({ indicator: parsed.kind, value: parsed.value, options: parsed.postMeal ? { isPostMeal: true } : undefined, gravityG, missionDay });
  await db.healthReadings.add({
    crewMemberId: crewId, timestamp: Date.now(), missionDay, indicator: parsed.kind as HealthReading['indicator'],
    value: parsed.value, unit: UNITS[parsed.kind], status: ev.status, reasons: ev.reasons, source: 'manual', quality: 'GOOD', notes: 'logged by voice',
  } as HealthReading);
  const shown = parsed.kind === 'temperature' ? parsed.value.toFixed(1) : String(Math.round(parsed.value * 10) / 10);
  return { say: `Logged ${NAMES[parsed.kind]} ${shown} ${UNITS[parsed.kind]}. ${phrase(ev.status)} ${ev.reasons[0] ?? ''}`.trim(), logged: true, go: '/' };
}

function phrase(status: string): string {
  return status === 'NOMINAL' ? 'That is nominal.' : status === 'WATCH' ? 'That is on watch.' : status === 'ALERT' ? 'That is an alert.' : 'That is critical. Consider Emergency mode.';
}

/** Symptom statements → the right screen and a plain next step. */
export function symptomAction(text: string): ActionResult | null {
  const t = text.toLowerCase();
  const any = (...w: string[]) => w.some((x) => t.includes(x));

  if (any('chest pain', 'chest hurts', 'pressure in my chest', 'heart attack', 'crushing')) {
    return { say: 'Chest pain is an emergency. Sit down and stay still. Opening Emergency mode with the chest pain protocol.', go: '/emergency' };
  }
  if (any("can't breathe", 'cannot breathe', 'short of breath', 'hard to breathe', 'smoke', 'fumes')) {
    return { say: 'Breathing trouble. Mask on if the air may be bad. Opening Emergency mode.', go: '/emergency' };
  }
  if (any('collapsed', 'unconscious', 'not responding', 'passed out', 'fainted')) {
    return { say: 'Opening Emergency mode now. Check for breathing and start the CPR coach if there is none.', go: '/emergency' };
  }
  if (any('vision', 'blurry', 'blurred', 'can\'t see', 'cannot see', 'seeing wavy', 'eyes feel', 'eye feels', 'eyesight', 'see clearly')) {
    return { say: "Let's check your eyes. Vision changes are common on long missions and worth tracking. I'm opening the Amsler grid: cover one eye, look at the centre dot, and tap any squares that look wavy or missing. If this came on suddenly, tell your medical officer today.", go: '/vision' };
  }
  if (any('dizzy', 'dizziness', 'lightheaded', 'light-headed', 'faint when i stand', 'room is spinning')) {
    return { say: 'Sit or anchor yourself now. Dizziness on standing is common after fluid shifts. When you feel steady, log your heart rate and blood pressure so I can compare them with your baseline, and tell your medical officer if it keeps happening.', go: '/checks' };
  }
  if (any("can't sleep", 'cannot sleep', 'insomnia', 'not sleeping', 'barely slept', 'exhausted', 'so tired', 'fatigued')) {
    return { say: "Thanks for telling me. Log last night's hours so I can track it, and do the 3-minute reaction test; fatigue shows there before you feel it. I'll flag it to your medical officer if it continues.", go: '/cognition' };
  }
  if (any('headache', 'head hurts', 'migraine')) {
    return { say: 'Headaches often go with fluid shift and high cabin CO2. Log your blood pressure and oxygen, drink water, and tell your medical officer if it is severe or sudden.', go: '/checks' };
  }
  if (any('anxious', 'anxiety', 'stressed', 'lonely', 'homesick', 'feeling low', 'depressed', 'sad')) {
    return { say: "I'm glad you said it. Let's do a quick mood check-in; it stays private to the crew medical officer. You can also send a private note to the flight surgeon from Ground Link.", go: '/checks' };
  }
  if (any('nausea', 'nauseous', 'vomit', 'throwing up', 'sick to my stomach')) {
    return { say: 'Space motion sickness is common in the first days and after gravity changes. Keep your head still, sip fluids, and log temperature and heart rate. Tell your medical officer if it lasts more than a day.', go: '/checks' };
  }
  return null;
}

/** "wait", "hold on", "stop" → pause without nagging. */
export function waitIntent(text: string): 'wait' | 'stop' | 'resume' | null {
  const t = text.toLowerCase().trim();
  if (/^(stop|quiet|shut up|be quiet|cancel|never ?mind|enough)\b/.test(t)) return 'stop';
  if (/\b(wait|hold on|hang on|one (sec|second|minute|moment)|give me a (sec|second|minute|moment)|just a (sec|second|minute|moment)|standby|stand by|not now|later)\b/.test(t)) return 'wait';
  if (/^(ok(ay)?|continue|go on|i'?m (back|ready)|carry on|resume)\b/.test(t)) return 'resume';
  return null;
}
