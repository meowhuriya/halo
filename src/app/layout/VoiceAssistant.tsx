/**
 * HALO voice assistant — a Siri-style helper available on every screen.
 *
 * Tap the mic (or press "V"), say what you need, HALO answers aloud and acts:
 * "open the eye test", "start a heart scan", "how's my readiness",
 * "what's the delay to Earth", "emergency". Recognition uses the browser's
 * SpeechRecognition (Chrome/Edge); speech output is the local voice.
 * Everything it can do is also reachable by tapping, so nothing depends on it.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Mic, MicOff, Ear } from 'lucide-react';
import { useMission } from '../MissionContext';
import { speakOffline, unlockSpeech } from '../../utils/speech';
import { createVoiceListener, isVoiceCommandSupported, type VoiceListener } from '../../utils/voiceCommands';
import { chimeDone, chimeListen, chimeMiss } from '../../utils/chime';
import { answerQuestion } from './assistantBrain';

type Action = { say: string; go?: string; mode?: string };

export function planAssistantReply(
  transcript: string,
  ctx: {
    readiness: number;
    alerts: number;
    delaySeconds: number;
    missionDay: number;
    envName: string;
    crewName: string;
    unreadGround: number;
  }
): Action {
  const t = transcript.toLowerCase().replace(/[^a-z0-9'\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const esc = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // whole-word / whole-phrase match, so "hi" never matches "this" and "day" never matches "today"
  const has = (...words: string[]) => words.some((w) => new RegExp(`(^|\\s)${esc(w)}(s|es)?(\\s|$)`).test(t));
  const mins = Math.floor(ctx.delaySeconds / 60);
  const secs = Math.round(ctx.delaySeconds % 60);
  const delayText = ctx.delaySeconds >= 60 ? `${mins} minute${mins === 1 ? '' : 's'} ${secs ? `${secs} seconds` : ''}` : `${secs} seconds`;

  if (has('emergency', 'help me', 'collapsed', 'not breathing', 'cpr')) {
    return { say: 'Opening Emergency mode now.', go: '/emergency' };
  }
  if (has('eye', 'vision', 'amsler', 'grid', 'sight')) {
    return { say: 'Opening the eye test. Hold the screen at the distance shown and cover one eye.', go: '/vision' };
  }
  if (has('heart', 'pulse', 'scan', 'bpm', 'heart rate')) {
    return { say: 'Starting a heart rate scan. Place your fingertip over the rear camera and hold still for twenty seconds.', go: '/scan' };
  }
  if (has('reaction', 'cognition', 'pvt', 'brain test', 'vigilance', 'fatigue test', 'alert test')) {
    return { say: 'Opening the reaction time test. Tap as soon as the number appears. It takes three minutes.', go: '/cognition' };
  }
  if (has('blood pressure', 'temperature', 'glucose', 'sugar', 'oxygen', 'spo2', 'sleep', 'mood', 'check', 'check in', 'log a reading')) {
    return { say: 'Opening your guided checks.', go: '/checks' };
  }
  if (has('trend', 'chart', 'history', 'over time', 'graph')) {
    return { say: 'Opening your trends.', go: '/trends' };
  }
  if (has('ground', 'earth', 'flight surgeon', 'doctor', 'message', 'inbox', 'downlink')) {
    if (has('delay', 'how long', 'far')) {
      return { say: `Earth is ${delayText} away one way. A reply takes at least twice that.` };
    }
    const unread = ctx.unreadGround ? ` You have ${ctx.unreadGround} unread message${ctx.unreadGround === 1 ? '' : 's'} from Earth.` : '';
    return { say: `Opening Ground Link.${unread}`, go: '/groundlink' };
  }
  if (has('delay', 'light', 'how far', 'latency')) {
    return { say: `One-way light delay to Earth is ${delayText}.` };
  }
  if (has('readiness', 'how am i', "how's my", 'how is my', 'status', 'am i okay', 'am i ok', 'health')) {
    const band = ctx.readiness >= 80 ? 'GO' : ctx.readiness >= 60 ? 'GO with caution' : 'HOLD, consult your medical officer';
    const alerts = ctx.alerts ? ` There ${ctx.alerts === 1 ? 'is one active alert' : `are ${ctx.alerts} active alerts`}. Tap the Digital Twin to see why.` : ' No active alerts.';
    return { say: `Readiness is ${ctx.readiness} percent, ${band}.${alerts}`, go: '/' };
  }
  if (has('bridge', 'home', 'dashboard', 'twin', 'main screen')) {
    return { say: 'Going to the Bridge.', go: '/' };
  }
  if (has('learn', 'explain', 'what is', 'why does', 'teach', 'library', 'tell me about')) {
    return { say: 'Opening the Learn library.', go: '/learn' };
  }
  if (has('validation', 'accuracy', 'how accurate')) {
    return { say: 'Opening the validation page, where camera readings are compared with a reference device.', go: '/validation' };
  }
  if (has('what day', 'mission day', 'which day', 'the date', 'mission')) {
    return { say: `It is mission day ${ctx.missionDay}, ${ctx.envName}.` };
  }
  if (has('who am i', 'my name')) {
    return { say: `You are ${ctx.crewName}.` };
  }
  if (has('thank', 'thanks')) {
    return { say: "You're welcome. I'm here if you need anything." };
  }
  if (has('hello', 'hi', 'hey', 'hi halo', 'hey halo', 'good morning')) {
    return { say: `Hello ${ctx.crewName.split(' ')[0]}. Readiness is ${ctx.readiness} percent. What do you need?` };
  }
  return {
    say: "I didn't catch that. Try: open the eye test, start a heart scan, how's my readiness, what's my last heart rate, why is my sleep flagged, what is SANS, read this out loud, or emergency.",
  };
}

export const VoiceAssistant: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const mission = useMission();
  const supported = isVoiceCommandSupported();

  // 'off' = mic closed · 'listening' = waiting for you · 'thinking' = processing · 'speaking' = HALO talking
  const [state, setState] = useState<'off' | 'listening' | 'thinking' | 'speaking'>('off');
  const [heard, setHeard] = useState('');
  const [interim, setInterim] = useState('');
  const [reply, setReply] = useState('');
  const [wakeWord, setWakeWord] = useState(false);

  const listenerRef = useRef<VoiceListener | null>(null);
  const wakeRef = useRef<VoiceListener | null>(null);
  const hideTimer = useRef<number | null>(null);
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);
  const ctxRef = useRef(mission);
  useEffect(() => { ctxRef.current = mission; }, [mission]);

  const scheduleHide = useCallback(() => {
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => { setReply(''); setHeard(''); setInterim(''); }, 10000);
  }, []);

  const say = useCallback((text: string, onDone?: () => void) => {
    setReply(text);
    setState('speaking');
    const finish = () => { setState('off'); onDone?.(); };
    speakOffline(text, { onEnd: finish, onError: finish });
    scheduleHide();
  }, [scheduleHide]);

  const handle = useCallback((transcript: string) => {
    const m = ctxRef.current;
    setHeard(transcript);
    setInterim('');
    setState('thinking');
    listenerRef.current?.stop();
    void (async () => {
    // 1) Health / knowledge questions and "read it out loud" come first
    const main = document.querySelector('main');
    const screenText = main ? (main as HTMLElement).innerText : '';
    const qa = await answerQuestion(transcript, m.crew?.id, screenText).catch(() => null);
    if (qa) {
      chimeDone();
      say(qa.say);
      if (qa.go) navigate(qa.go);
      return;
    }
    // 2) Otherwise navigation / status commands
    const action = planAssistantReply(transcript, {
      readiness: m.readinessScore,
      alerts: m.activeAlertCount,
      delaySeconds: m.config?.oneWayDelaySeconds ?? 0,
      missionDay: m.config?.missionDay ?? 1,
      envName: m.environment?.name ?? 'in transit',
      crewName: m.crew?.name ?? 'crew member',
      unreadGround: m.unreadGroundCount,
    });
    const understood = Boolean(action.go) || !action.say.startsWith("I didn't catch");
    if (understood) chimeDone(); else chimeMiss();
    say(action.say);
    if (action.go) navigate(action.go);
    })();
  }, [navigate, say]);

  const listen = useCallback(() => {
    if (!supported) return;
    if (!listenerRef.current) {
      listenerRef.current = createVoiceListener({
        onTranscript: handle,
        onInterim: (p) => setInterim(p),
        onStateChange: (on) => { if (on) setState('listening'); else if (stateRef.current === 'listening') setState('off'); },
      });
    }
    setHeard(''); setReply(''); setInterim('');
    chimeListen();
    listenerRef.current?.start();
  }, [supported, handle]);

  const toggle = useCallback(() => {
    if (!supported) return;
    unlockSpeech();
    if (state === 'listening') { listenerRef.current?.stop(); setState('off'); return; }
    if (state === 'speaking') { window.speechSynthesis?.cancel(); setState('off'); return; }
    listen();
  }, [supported, state, listen]);

  // Optional "Hey HALO" wake word: a background listener that only looks for the phrase.
  useEffect(() => {
    if (!supported) return;
    if (wakeWord) {
      wakeRef.current = createVoiceListener({
        continuous: true,
        onTranscript: (t) => {
          if (stateRef.current !== 'off') return;
          const low = t.toLowerCase();
          if (/\b(hey|hi|ok|okay)\s+(halo|hello|hollow|hailo)\b/.test(low)) {
            const rest = low.replace(/^.*?(halo|hello|hollow|hailo)\b[,.!?]*\s*/, '').trim();
            wakeRef.current?.stop();
            if (rest.length > 2) handle(rest);
            else listen();
          }
        },
      });
      wakeRef.current?.start();
    } else {
      wakeRef.current?.stop();
      wakeRef.current = null;
    }
    return () => { wakeRef.current?.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wakeWord]);

  // After HALO finishes talking, resume the wake-word listener if it's on
  useEffect(() => {
    if (state === 'off' && wakeWord) wakeRef.current?.start();
  }, [state, wakeWord]);

  // Keyboard shortcut: V (when not typing in a field)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key.toLowerCase() === 'v' && !e.metaKey && !e.ctrlKey && tag !== 'INPUT' && tag !== 'TEXTAREA') toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  useEffect(() => () => { listenerRef.current?.stop(); wakeRef.current?.stop(); }, []);

  if (location.pathname === '/emergency' || location.pathname === '/ground' || location.pathname === '/split') return null;

  const label =
    !supported ? 'Voice needs Chrome or Edge'
    : state === 'listening' ? 'Listening…'
    : state === 'thinking' ? 'Thinking…'
    : state === 'speaking' ? 'HALO is speaking · tap to stop'
    : 'Tap to talk to HALO · press V';

  const ring =
    !supported ? 'bg-slate-700/60 border-slate-500 text-slate-400 cursor-not-allowed'
    : state === 'listening' ? 'bg-emerald-500 border-emerald-200 text-[#06251A] shadow-[0_0_0_10px_rgba(16,185,129,0.25),0_0_40px_rgba(16,185,129,0.8)] scale-110'
    : state === 'thinking' ? 'bg-amber-400 border-amber-200 text-[#2A1B00] shadow-[0_0_30px_rgba(251,191,36,0.7)]'
    : state === 'speaking' ? 'bg-cyan-400 border-cyan-100 text-[#0B1628] shadow-[0_0_30px_rgba(115,179,231,0.8)]'
    : 'bg-slate-600 border-slate-400 text-slate-200 hover:bg-slate-500 hover:text-white';

  return (
    <>
      {(heard || interim || reply || state !== 'off') && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-28 right-6 z-50 w-[min(92vw,22rem)] rounded-2xl border border-white/15 bg-[#12213A]/95 backdrop-blur px-4 py-3 shadow-2xl text-sm space-y-1"
        >
          <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-slate-300/80">
            <span className={`inline-block w-2 h-2 rounded-full ${state === 'listening' ? 'bg-emerald-400 animate-pulse' : state === 'thinking' ? 'bg-amber-400 animate-pulse' : state === 'speaking' ? 'bg-cyan-300 animate-pulse' : 'bg-slate-500'}`} />
            {label}
          </div>
          {state === 'listening' && (
            <div className="flex items-end gap-1 h-5" aria-hidden>
              {[0, 1, 2, 3, 4].map((i) => (
                <span key={i} className="w-1.5 rounded-full bg-emerald-400 animate-[bounce_1s_infinite]" style={{ height: `${8 + (i % 3) * 5}px`, animationDelay: `${i * 0.12}s` }} />
              ))}
              <span className="ml-2 text-emerald-100/80 italic">{interim || 'Go ahead…'}</span>
            </div>
          )}
          {heard && <div className="font-mono text-xs text-slate-300/80">You: "{heard}"</div>}
          {reply && <div className="text-slate-50">{reply}</div>}
          {supported && (
            <label className="flex items-center gap-2 pt-1 text-[11px] text-slate-400 cursor-pointer select-none">
              <input type="checkbox" checked={wakeWord} onChange={(e) => setWakeWord(e.target.checked)} className="accent-emerald-500" />
              <Ear size={12} /> Listen for "Hey HALO"
            </label>
          )}
        </div>
      )}
      <button
        type="button"
        data-testid="voice-assistant-button"
        onClick={toggle}
        disabled={!supported}
        aria-pressed={state === 'listening'}
        aria-label={label}
        title={label}
        className={`fixed bottom-6 right-[108px] z-50 w-[60px] h-[60px] rounded-full flex items-center justify-center border-2 transition-all duration-200 glove-target focus:outline-none focus:ring-4 focus:ring-emerald-400/40 ${ring}`}
      >
        {!supported ? <MicOff size={26} /> : <Mic size={26} />}
      </button>
    </>
  );
};
