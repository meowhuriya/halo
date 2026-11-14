/**
 * Hands-free voice commands for Emergency mode.
 *
 * Uses the browser's SpeechRecognition (Chrome / Edge; Safari and Firefox
 * fall back to buttons). Recognition is only reliable for short, expected
 * phrases, so every command is matched against a small intent table.
 * Buttons remain the primary, always-available control.
 */

export type VoiceIntent =
  | 'YES'
  | 'NO'
  | 'ME'
  | 'CREWMATE'
  | 'CHEST_PAIN'
  | 'BREATHING'
  | 'RADIATION'
  | 'REPEAT'
  | 'NEXT'
  | 'CONFIRM';

const INTENTS: Array<{ intent: VoiceIntent; patterns: RegExp[] }> = [
  { intent: 'NO', patterns: [/\b(no|not|isn'?t|unresponsive|not breathing|no pulse|collapsed|unconscious)\b/] },
  { intent: 'YES', patterns: [/\b(yes|yeah|yep|conscious|awake|responsive|breathing|talking|alive)\b/] },
  { intent: 'CHEST_PAIN', patterns: [/\b(chest|heart|angina|pressure)\b/] },
  { intent: 'BREATHING', patterns: [/\b(smoke|toxic|fumes|can'?t breathe|breathing (trouble|difficulty|problem)|choking|gas)\b/] },
  { intent: 'RADIATION', patterns: [/\b(radiation|storm|solar|shelter|spe)\b/] },
  { intent: 'CREWMATE', patterns: [/\b(crewmate|crew ?member|someone else|him|her|them|another)\b/] },
  { intent: 'ME', patterns: [/\b(me|myself|i am|i'm|it'?s me)\b/] },
  { intent: 'REPEAT', patterns: [/\b(repeat|again|say that again|what)\b/] },
  { intent: 'NEXT', patterns: [/\b(next|done|okay|ok|continue|go on|ready)\b/] },
  { intent: 'CONFIRM', patterns: [/\b(confirm|start|begin|go)\b/] },
];

/** Match a transcript to an intent. Order matters: "no, not breathing" must win over "breathing". */
export function matchIntent(transcript: string): VoiceIntent | null {
  const t = transcript.toLowerCase().trim();
  if (!t) return null;
  for (const { intent, patterns } of INTENTS) {
    if (patterns.some((p) => p.test(t))) return intent;
  }
  return null;
}

type RecognitionCtor = new () => SpeechRecognitionLike;
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

export function isVoiceCommandSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export interface VoiceListener {
  start: () => void;
  stop: () => void;
}

/**
 * Create a listener that keeps listening and reports each final transcript.
 * The caller decides what to do with it (and pauses it while HALO speaks,
 * so HALO doesn't hear itself).
 */
export function createVoiceListener(
  onTranscript: (transcript: string) => void,
  onStateChange?: (listening: boolean) => void
): VoiceListener | null {
  if (!isVoiceCommandSupported()) return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  const Ctor = (w.SpeechRecognition || w.webkitSpeechRecognition)!;

  let active = false;
  let rec: SpeechRecognitionLike | null = null;

  const spin = () => {
    if (!active) return;
    try {
      rec = new Ctor();
      rec.lang = 'en-US';
      rec.continuous = false;
      rec.interimResults = false;
      rec.maxAlternatives = 3;
      rec.onresult = (e) => {
        const alts = e.results[0];
        for (let i = 0; i < alts.length; i++) {
          const text = alts[i]?.transcript ?? '';
          if (text) {
            onTranscript(text);
            if (matchIntent(text)) break;
          }
        }
      };
      rec.onerror = () => { /* no-speech / aborted are routine; onend restarts */ };
      rec.onend = () => {
        if (active) setTimeout(spin, 250);
        else onStateChange?.(false);
      };
      rec.start();
      onStateChange?.(true);
    } catch {
      active = false;
      onStateChange?.(false);
    }
  };

  return {
    start: () => {
      if (active) return;
      active = true;
      spin();
    },
    stop: () => {
      active = false;
      try { rec?.abort(); } catch { /* ignore */ }
      onStateChange?.(false);
    },
  };
}
