/**
 * Web Speech API helper for offline-first speech synthesis per §3 (v3):
 * - Chooses a voice where voice.localService === true (network voices fail offline in deep space).
 * - Every spoken line must also appear as an on-screen caption.
 * - If no voice exists, captions alone must be enough.
 */

export function getLocalVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return null;
  }

  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) {
    return null;
  }

  // Filter for localService === true
  const localVoices = voices.filter((v) => v.localService === true);
  const candidates = localVoices.length > 0 ? localVoices : voices;

  // Prefer English local voice if available
  const englishLocal = candidates.find(
    (v) => v.lang.startsWith('en') && v.localService === true
  );
  if (englishLocal) return englishLocal;

  const anyEnglish = candidates.find((v) => v.lang.startsWith('en'));
  if (anyEnglish) return anyEnglish;

  return candidates[0] || null;
}

export interface SpeakOptions {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: unknown) => void;
  rate?: number;
  pitch?: number;
}

export function speakOffline(
  text: string,
  options: SpeakOptions = {}
): { spoken: boolean; text: string } {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    options.onError?.(new Error('SpeechSynthesis not supported'));
    return { spoken: false, text };
  }

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = options.rate ?? 1.0;
    utterance.pitch = options.pitch ?? 1.0;

    const voice = getLocalVoice();
    if (voice) {
      utterance.voice = voice;
    }

    if (options.onStart) utterance.onstart = () => options.onStart!();
    if (options.onEnd) utterance.onend = () => options.onEnd!();
    if (options.onError) utterance.onerror = (e) => options.onError!(e);

    window.speechSynthesis.speak(utterance);
    return { spoken: true, text };
  } catch (err) {
    options.onError?.(err);
    return { spoken: false, text };
  }
}
