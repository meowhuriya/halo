/**
 * Web Speech API helper for offline-first speech synthesis per §3 (v3):
 * - Chooses a voice where voice.localService === true (network voices fail offline in deep space).
 * - Every spoken line must also appear as an on-screen caption.
 * - If no voice exists, captions alone must be enough.
 */

/**
 * Rank the installed voices and return the best one for the emergency coach.
 * Only local voices qualify (network voices fail offline). Among those, prefer
 * natural-sounding premium/enhanced/neural American English voices, then any
 * en-US voice, then any English voice, then anything.
 */
export function getLocalVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return null;
  }

  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) {
    return null;
  }

  const score = (v: SpeechSynthesisVoice): number => {
    const name = v.name.toLowerCase();
    const lang = v.lang.toLowerCase().replace('_', '-');
    let s = 0;
    if (v.localService) s += 1000; else s -= 1000;
    if (lang === 'en-us') s += 300;
    else if (lang.startsWith('en')) s += 150;
    // Quality tiers by how vendors label their better voices
    if (name.includes('premium')) s += 120;
    if (name.includes('enhanced')) s += 100;
    if (name.includes('neural') || name.includes('natural')) s += 100;
    if (name.includes('siri')) s += 90;
    if (name.includes('google') && lang.startsWith('en')) s += 60;
    if (name.includes('microsoft') && (name.includes('aria') || name.includes('jenny') || name.includes('guy'))) s += 80;
    // Well-known good Apple voices
    for (const good of ['ava', 'zoe', 'samantha', 'allison', 'evan', 'nathan', 'tom']) {
      if (name.startsWith(good) || name.includes(`${good} `)) s += 40;
    }
    // Known robotic / novelty voices
    for (const bad of ['fred', 'albert', 'bad news', 'bahh', 'bells', 'boing', 'bubbles', 'cellos', 'deranged', 'good news', 'hysterical', 'jester', 'organ', 'trinoids', 'whisper', 'wobble', 'zarvox', 'junior', 'ralph', 'kathy', 'eddy', 'flo', 'grandma', 'grandpa', 'reed', 'rocko', 'sandy', 'shelley', 'compact']) {
      if (name.includes(bad)) s -= 200;
    }
    return s;
  };

  return [...voices].sort((a, b) => score(b) - score(a))[0] ?? null;
}

export interface SpeakOptions {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: unknown) => void;
  rate?: number;
  pitch?: number;
}

/**
 * Chrome populates speechSynthesis.getVoices() asynchronously; the first
 * utterance after page load can fire before the list exists and falls back
 * to the default voice. Resolve once voices are available (or after a short
 * timeout, so speech never hangs).
 */
let voicesReady: Promise<void> | null = null;
export function waitForVoices(timeoutMs = 1500): Promise<void> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return Promise.resolve();
  if (window.speechSynthesis.getVoices().length > 0) return Promise.resolve();
  if (!voicesReady) {
    voicesReady = new Promise<void>((resolve) => {
      const done = () => { window.speechSynthesis.onvoiceschanged = null; resolve(); };
      window.speechSynthesis.onvoiceschanged = done;
      setTimeout(done, timeoutMs);
      // Some builds need a poke before onvoiceschanged fires
      window.speechSynthesis.getVoices();
    });
  }
  return voicesReady;
}

/**
 * Chrome only lets a page speak after a user gesture. Call this from the
 * tap/keypress that starts a listening session: it speaks a silent utterance,
 * which unlocks speechSynthesis for the replies that follow asynchronously.
 */
let unlocked = false;
export function unlockSpeech(): void {
  if (unlocked || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    window.speechSynthesis.speak(u);
    window.speechSynthesis.getVoices();
    unlocked = true;
  } catch { /* ignore */ }
}

export function speakOffline(
  text: string,
  options: SpeakOptions = {}
): { spoken: boolean; text: string } {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    options.onError?.(new Error('SpeechSynthesis not supported'));
    return { spoken: false, text };
  }

  const begin = () => {
    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = options.rate ?? 0.95;
    utterance.pitch = options.pitch ?? 1.0;

    const voice = getLocalVoice();
    if (voice) {
      utterance.voice = voice;
    }

    if (options.onStart) utterance.onstart = () => options.onStart!();
    if (options.onEnd) utterance.onend = () => options.onEnd!();
    if (options.onError) utterance.onerror = (e) => options.onError!(e);

    window.speechSynthesis.speak(utterance);
  };

  try {
    // Speak synchronously when voices are already loaded (keeps the user-gesture
    // activation Chrome requires); only wait on the very first call after load.
    if (window.speechSynthesis.getVoices().length > 0) {
      begin();
    } else {
      void waitForVoices().then(begin).catch((err) => options.onError?.(err));
    }
    return { spoken: true, text };
  } catch (err) {
    options.onError?.(err);
    return { spoken: false, text };
  }
}
