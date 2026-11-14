/** Tiny earcons (Siri-style) using WebAudio; silent if audio is unavailable. */
let ctx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch { return null; }
}
function tone(freq: number, startOffset: number, duration: number, gain = 0.08) {
  const c = getCtx(); if (!c) return;
  const o = c.createOscillator(); const g = c.createGain();
  o.type = 'sine'; o.frequency.value = freq;
  g.gain.setValueAtTime(0, c.currentTime + startOffset);
  g.gain.linearRampToValueAtTime(gain, c.currentTime + startOffset + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + startOffset + duration);
  o.connect(g).connect(c.destination);
  o.start(c.currentTime + startOffset); o.stop(c.currentTime + startOffset + duration + 0.05);
}
/** Rising two-note: "I'm listening". */
export function chimeListen() { tone(660, 0, 0.12); tone(880, 0.12, 0.16); }
/** Falling two-note: "got it". */
export function chimeDone() { tone(880, 0, 0.1); tone(660, 0.1, 0.14); }
/** Soft single note: "didn't catch that". */
export function chimeMiss() { tone(440, 0, 0.18, 0.06); }
