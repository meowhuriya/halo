/**
 * HALO assistant "brain": answers health questions from the Learn library and
 * the astronaut's own readings. Deterministic and offline — no cloud model.
 */
import { LEARN_LIBRARY, type LearnTopic } from '../../config/learnLibrary';
import { db, type HealthReading } from '../../data/db';
import { getActionGuidance } from '../../engine/rules';

export interface Answer { say: string; go?: string }

const SYNONYMS: Record<string, string[]> = {
  heart_rate: ['heart rate', 'pulse', 'heart', 'bpm', 'heartbeat'],
  blood_pressure: ['blood pressure', 'bp', 'pressure', 'systolic', 'diastolic'],
  spo2: ['oxygen', 'spo2', 'saturation', 'o2', 'sats'],
  temperature: ['temperature', 'temp', 'fever'],
  glucose: ['glucose', 'sugar', 'blood sugar'],
  respiratory_rate: ['breathing rate', 'respiratory', 'respiration', 'breaths'],
  sleep: ['sleep', 'slept', 'rest'],
  pvt: ['reaction', 'pvt', 'vigilance', 'fatigue', 'cognition', 'brain test', 'alertness'],
  amsler: ['eye', 'eyes', 'vision', 'amsler', 'sans', 'sight', 'grid'],
  mental_health: ['mood', 'stress', 'mental', 'anxiety', 'depression', 'lonely', 'phq', 'gad', 'feel'],
  orthostatic: ['stand test', 'orthostatic', 'dizzy', 'dizziness', 'standing'],
  hazard_radiation: ['radiation', 'dose', 'storm', 'solar', 'cosmic', 'msv'],
  hazard_isolation: ['isolation', 'confinement', 'confined', 'alone', 'crew mood'],
  hazard_distance: ['distance', 'delay', 'far from earth', 'communication', 'latency'],
  hazard_gravity: ['gravity', 'microgravity', 'bone', 'bones', 'muscle', 'weightless', 'fluid shift'],
  hazard_hostile_environment: ['hostile', 'closed environment', 'air quality', 'co2', 'carbon dioxide', 'cabin'],
};

const READING_KEY: Record<string, HealthReading['indicator'] | undefined> = {
  heart_rate: 'heart_rate', blood_pressure: 'blood_pressure', spo2: 'spo2', temperature: 'temperature',
  glucose: 'glucose', respiratory_rate: 'respiratory_rate', sleep: 'sleep', pvt: 'pvt', amsler: 'amsler',
  mental_health: 'mood', orthostatic: 'orthostatic', hazard_radiation: 'radiation',
};

export function findTopic(text: string): LearnTopic | null {
  const t = ` ${text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ')} `;
  let best: { topic: LearnTopic; len: number } | null = null;
  for (const topic of LEARN_LIBRARY) {
    for (const syn of SYNONYMS[topic.id] ?? []) {
      if (t.includes(` ${syn} `) && (!best || syn.length > best.len)) best = { topic, len: syn.length };
    }
  }
  return best?.topic ?? null;
}

function fmtValue(r: HealthReading): string {
  if (typeof r.value === 'number') return `${Math.round(r.value * 10) / 10} ${r.unit}`.trim();
  if (typeof r.value === 'string') return r.value;
  const v = r.value as Record<string, unknown>;
  if ('systolic' in v && 'diastolic' in v) return `${v.systolic} over ${v.diastolic} ${r.unit}`.trim();
  return 'recorded';
}

function statusWord(s: string): string {
  return s === 'NOMINAL' ? 'nominal' : s === 'WATCH' ? 'on watch' : s === 'ALERT' ? 'an alert' : 'critical';
}

async function latestReading(crewId: number | undefined, key: HealthReading['indicator']): Promise<HealthReading | undefined> {
  if (!crewId) return undefined;
  const rows = await db.healthReadings.where('crewMemberId').equals(crewId).and((r) => r.indicator === key).toArray();
  rows.sort((a, b) => b.timestamp - a.timestamp);
  return rows[0];
}

async function flagged(crewId: number | undefined): Promise<HealthReading[]> {
  if (!crewId) return [];
  const rows = await db.healthReadings.where('crewMemberId').equals(crewId).toArray();
  const latest = new Map<string, HealthReading>();
  for (const r of rows) {
    const cur = latest.get(r.indicator);
    if (!cur || r.timestamp > cur.timestamp) latest.set(r.indicator, r);
  }
  return [...latest.values()].filter((r) => r.status !== 'NOMINAL').sort((a, b) => (a.status === 'CRITICAL' ? -1 : 1) - (b.status === 'CRITICAL' ? -1 : 1));
}

/**
 * Answer a free-form question. Returns null if this isn't a health/knowledge
 * question (so the caller can fall through to navigation commands).
 */
export async function answerQuestion(text: string, crewId: number | undefined, screenText?: string): Promise<Answer | null> {
  const t = text.toLowerCase();
  const asks = (...w: string[]) => w.some((x) => new RegExp(`(^|\\s)${x}(\\s|$)`).test(t));

  // "read it out loud" / "read this"
  if (asks('read it', 'read this', 'read that', 'read out', 'read aloud', 'read the screen', 'read me')) {
    const body = (screenText ?? '').replace(/\s+/g, ' ').trim();
    if (!body) return { say: "There's nothing on this screen I can read yet." };
    const clipped = body.length > 700 ? body.slice(0, 700) + '. That is the main content.' : body;
    return { say: clipped };
  }

  // "what's wrong" / "why am I flagged" / "any alerts" / "what should I do"
  if (asks('wrong', 'flagged', 'alerts', 'alert', 'worried', 'concern', 'problems', 'issues') || t.includes('what should i do')) {
    const f = await flagged(crewId);
    if (f.length === 0) return { say: 'Nothing is flagged right now. All your latest readings are nominal.' };
    const parts = f.slice(0, 3).map((r) => {
      const topic = LEARN_LIBRARY.find((x) => READING_KEY[x.id] === r.indicator);
      const name = topic?.title.split(' &')[0].split(' (')[0] ?? r.indicator.replace('_', ' ');
      const why = r.reasons?.[0] ? ` ${r.reasons[0]}` : '';
      const guide = typeof r.value === 'number' ? getActionGuidance(r.indicator, r.status, r.value).immediateAction : '';
      return `${name} is ${statusWord(r.status)}.${why}${guide ? ` ${guide}` : ''}`;
    });
    const more = f.length > 3 ? ` And ${f.length - 3} more. Tap the Digital Twin for the full list.` : '';
    return { say: parts.join(' ') + more, go: '/' };
  }

  const topic = findTopic(t);
  if (!topic) return null;
  const name = topic.title.split(' &')[0].split(' (')[0];

  // "what's my X" / "how is my X" / "last X" -> live reading
  if (asks('my', 'latest', 'last', 'current', 'today') && READING_KEY[topic.id]) {
    const r = await latestReading(crewId, READING_KEY[topic.id]!);
    if (!r) return { say: `You haven't recorded ${name.toLowerCase()} yet. ${topic.howToMeasure}` };
    const ago = Math.max(0, Math.round((Date.now() - r.timestamp) / 3600000));
    const when = ago < 1 ? 'just now' : ago < 48 ? `${ago} hour${ago === 1 ? '' : 's'} ago` : `on mission day ${r.missionDay}`;
    const why = r.status !== 'NOMINAL' && r.reasons?.[0] ? ` ${r.reasons[0]}` : '';
    return { say: `Your last ${name.toLowerCase()} was ${fmtValue(r)}, ${when}. Status ${statusWord(r.status)}.${why}` };
  }
  if (asks('how do i', 'how to', 'measure', 'take', 'check')) return { say: `To measure ${name.toLowerCase()}: ${topic.howToMeasure}` };
  if (asks('normal', 'range', 'should be', 'healthy', 'ok', 'okay')) return { say: `Normal ${name.toLowerCase()} is ${topic.normalRange}` };
  if (asks('why', 'space', 'microgravity', 'change', 'affect', 'affects')) return { say: `${name} in space: ${topic.whyInSpace}` };
  if (asks('when', 'cmo', 'surgeon', 'doctor', 'worry', 'dangerous', 'emergency')) return { say: `Tell your medical officer when: ${topic.whenToAlertCmo}` };
  // generic "what is X" / "tell me about X"
  return { say: `${name}. ${topic.whatItIs} In space: ${topic.whyInSpace} Normal range: ${topic.normalRange}`, go: '/learn' };
}
