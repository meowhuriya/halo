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
import { Mic, MicOff, Ear, Send, X } from 'lucide-react';
import { useMission } from '../MissionContext';
import { speakOffline, unlockSpeech } from '../../utils/speech';
import { createVoiceListener, isVoiceCommandSupported, type VoiceListener } from '../../utils/voiceCommands';
import { chimeDone, chimeListen, chimeMiss } from '../../utils/chime';
import { answerQuestion } from './assistantBrain';
import { HaloBuddy } from '../../design/components/HaloBuddy';
import { logSpokenReading, symptomAction, waitIntent } from './assistantActions';

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
    return { say: `Hello ${ctx.crewName.split(' ').filter((w) => w && !/^(dr|cdr|col|capt|maj|lt|mr|mrs|ms|prof)\.?$/i.test(w))[0] ?? 'there'}. Readiness is ${ctx.readiness} percent. What do you need?` };
  }
  return {
    say: "I didn't catch that. You can tell me a reading like 'blood pressure 118 over 76' or 'I slept 5 hours', a symptom like 'my vision is blurry', or ask: how's my readiness, what is SANS, read the message from Earth, or say emergency.",
  };
}

type Turn = { who: 'you' | 'halo'; text: string };

const SUGGESTIONS = [
  "How's my readiness?",
  'Log blood pressure 118 over 76',
  'I slept 5 hours',
  'Open the eye test',
  'Start a heart scan',
  "What's my last heart rate?",
  'What is SANS?',
  "What's the delay to Earth?",
];

export const VoiceAssistant: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const mission = useMission();
  const voiceSupported = isVoiceCommandSupported();

  const [open, setOpen] = useState(false);
  // 'off' = mic closed · 'listening' = waiting for you · 'thinking' = processing · 'speaking' = HALO talking
  const [state, setState] = useState<'off' | 'listening' | 'thinking' | 'speaking'>('off');
  const [interim, setInterim] = useState('');
  const [typed, setTyped] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [wakeWord, setWakeWord] = useState(false);

  const listenerRef = useRef<VoiceListener | null>(null);
  const wakeRef = useRef<VoiceListener | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);
  const ctxRef = useRef(mission);
  useEffect(() => { ctxRef.current = mission; }, [mission]);
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' }); }, [turns, interim]);

  const say = useCallback((text: string) => {
    setTurns((t) => [...t.slice(-11), { who: 'halo', text }]);
    setState('speaking');
    const finish = () => setState('off');
    speakOffline(text, { onEnd: finish, onError: finish });
  }, []);

  const handle = useCallback((transcript: string) => {
    const m = ctxRef.current;
    setTurns((t) => [...t.slice(-11), { who: 'you', text: transcript }]);
    setInterim('');
    setState('thinking');
    listenerRef.current?.stop();
    void (async () => {
      // 0) "wait" / "stop" / "I'm back" — pause without nagging
      const w = waitIntent(transcript);
      if (w === 'stop') { window.speechSynthesis?.cancel(); setTurns((t) => [...t.slice(-11), { who: 'halo', text: 'Okay.' }]); setState('off'); return; }
      if (w === 'wait') { window.speechSynthesis?.cancel(); say("Of course. Take your time, I'm here. Tap the mic or type when you're ready."); return; }
      if (w === 'resume') { say("I'm listening. What do you need?"); return; }

      // 1) Symptoms and emergencies come before anything else
      const sym = symptomAction(transcript);
      if (sym) { chimeDone(); say(sym.say); if (sym.go) navigate(sym.go); return; }

      // 2) Spoken readings: evaluate with the rules engine and save
      const logged = await logSpokenReading(transcript, m.crew?.id, m.config?.missionDay ?? 1, m.environment?.gravityG ?? 0).catch(() => null);
      if (logged) { chimeDone(); say(logged.say); if (logged.logged) { void m.refreshMission?.(); if (logged.go) navigate(logged.go); } return; }

      // 3) Health / knowledge questions
      const main = document.querySelector('main');
      const screenText = main ? (main as HTMLElement).innerText : '';
      const qa = await answerQuestion(transcript, m.crew?.id, screenText).catch(() => null);
      if (qa) {
        chimeDone();
        say(qa.say);
        if (qa.go) navigate(qa.go);
        return;
      }
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

  // Wait for the person to finish: keep listening, and only answer after a
  // pause of PAUSE_MS with no new speech. Tapping the mic sends immediately.
  const PAUSE_MS = 2000;
  const bufRef = useRef('');
  const interimRef = useRef('');
  const silenceRef = useRef<number | null>(null);
  const handleRef = useRef(handle);
  useEffect(() => { handleRef.current = handle; }, [handle]);

  const flush = useCallback(() => {
    if (silenceRef.current) { window.clearTimeout(silenceRef.current); silenceRef.current = null; }
    const text = `${bufRef.current} ${interimRef.current}`.replace(/\s+/g, ' ').trim();
    bufRef.current = ''; interimRef.current = '';
    listenerRef.current?.stop();
    if (text) handleRef.current(text);
    else { setInterim(''); setState('off'); }
  }, []);
  const flushRef = useRef(flush);
  useEffect(() => { flushRef.current = flush; }, [flush]);

  const armSilence = useCallback(() => {
    if (silenceRef.current) window.clearTimeout(silenceRef.current);
    silenceRef.current = window.setTimeout(() => flushRef.current(), PAUSE_MS);
  }, []);

  const listen = useCallback(() => {
    if (!voiceSupported) return;
    unlockSpeech();
    if (!listenerRef.current) {
      listenerRef.current = createVoiceListener({
        continuous: true,
        onTranscript: (t) => {
          bufRef.current = `${bufRef.current} ${t}`.trim();
          interimRef.current = '';
          setInterim(bufRef.current);
          armSilence();
        },
        onInterim: (p) => {
          interimRef.current = p;
          setInterim(`${bufRef.current} ${p}`.trim());
          armSilence();
        },
        onStateChange: (on) => { if (on) setState('listening'); },
      });
    }
    bufRef.current = ''; interimRef.current = '';
    setInterim('');
    chimeListen();
    listenerRef.current?.start();
    setState('listening');
  }, [voiceSupported, armSilence]);

  const toggleMic = useCallback(() => {
    if (state === 'listening') { flush(); return; }          // tap again = "I'm done, answer now"
    if (state === 'speaking') { window.speechSynthesis?.cancel(); setState('off'); return; }
    listen();
  }, [state, listen, flush]);

  useEffect(() => () => { if (silenceRef.current) window.clearTimeout(silenceRef.current); }, []);

  const submitTyped = useCallback(() => {
    const q = typed.trim();
    if (!q) return;
    unlockSpeech();
    setTyped('');
    handle(q);
  }, [typed, handle]);

  const openPanel = useCallback(() => {
    unlockSpeech();
    setOpen(true);
    if (turns.length === 0) {
      const parts = (ctxRef.current.crew?.name ?? '').split(' ').filter((w) => w && !/^(dr|cdr|col|capt|maj|lt|mr|mrs|ms|prof)\.?$/i.test(w));
      const name = parts[0] ?? 'there';
      setTurns([{ who: 'halo', text: `Hi ${name}. I'm HALO. Ask me anything about your health, or tell me where to go.` }]);
    }
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [turns.length]);

  const closePanel = useCallback(() => {
    listenerRef.current?.stop();
    window.speechSynthesis?.cancel();
    setState('off');
    setOpen(false);
  }, []);

  // Optional "Hey HALO" wake word
  useEffect(() => {
    if (!voiceSupported) return;
    if (wakeWord) {
      wakeRef.current = createVoiceListener({
        continuous: true,
        onTranscript: (t) => {
          if (stateRef.current !== 'off') return;
          const low = t.toLowerCase();
          if (/\b(hey|hi|ok|okay)\s+(halo|hello|hollow|hailo)\b/.test(low)) {
            const rest = low.replace(/^.*?(halo|hello|hollow|hailo)\b[,.!?]*\s*/, '').trim();
            wakeRef.current?.stop();
            setOpen(true);
            if (rest.length > 2) handle(rest); else listen();
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
  useEffect(() => { if (state === 'off' && wakeWord) wakeRef.current?.start(); }, [state, wakeWord]);

  // Keyboard: V opens the panel and starts listening; Esc closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') { if (e.key === 'Escape') closePanel(); return; }
      if (e.key.toLowerCase() === 'v' && !e.metaKey && !e.ctrlKey) { if (!open) openPanel(); toggleMic(); }
      if (e.key === 'Escape') closePanel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, openPanel, toggleMic, closePanel]);

  useEffect(() => () => { listenerRef.current?.stop(); wakeRef.current?.stop(); }, []);

  if (location.pathname === '/emergency' || location.pathname === '/ground' || location.pathname === '/split') return null;

  const statusLabel =
    state === 'listening' ? "Listening, take your time · I'll answer when you pause" : state === 'thinking' ? 'Thinking…' : state === 'speaking' ? 'Speaking · tap mic to stop' : voiceSupported ? 'Type, or tap the mic' : 'Type your question (voice needs Chrome or Edge)';
  const micClass =
    !voiceSupported ? 'bg-slate-700/60 border-slate-500 text-slate-400 cursor-not-allowed'
    : state === 'listening' ? 'bg-emerald-500 border-emerald-200 text-[#06251A] shadow-[0_0_0_8px_rgba(16,185,129,0.25),0_0_30px_rgba(16,185,129,0.8)] scale-105'
    : state === 'thinking' ? 'bg-amber-400 border-amber-200 text-[#2A1B00]'
    : state === 'speaking' ? 'bg-cyan-400 border-cyan-100 text-[#0B1628] shadow-[0_0_24px_rgba(115,179,231,0.8)]'
    : 'bg-slate-600 border-slate-400 text-slate-100 hover:bg-slate-500';

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-label="HALO assistant"
          className="fixed bottom-24 right-4 sm:right-6 z-50 w-[min(94vw,24rem)] max-h-[70vh] flex flex-col rounded-3xl border border-white/15 bg-[#0F1B31]/97 backdrop-blur-xl shadow-2xl overflow-hidden"
        >
          <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
            <HaloBuddy state={state === 'off' ? 'idle' : state} size={40} />
            <div className="min-w-0">
              <div className="text-sm font-bold text-white leading-tight">HALO</div>
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${state === 'listening' ? 'bg-emerald-400 animate-pulse' : state === 'thinking' ? 'bg-amber-400 animate-pulse' : state === 'speaking' ? 'bg-cyan-300 animate-pulse' : 'bg-slate-500'}`} />
                {statusLabel}
              </div>
            </div>
            <button type="button" onClick={closePanel} aria-label="Close assistant" className="ml-auto w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center text-slate-300"><X size={18} /></button>
          </div>

          <div ref={logRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2 text-sm">
            {turns.map((t, i) => (
              <div key={i} className={`flex ${t.who === 'you' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3.5 py-2 rounded-2xl leading-snug ${t.who === 'you' ? 'bg-cyan-500/25 text-cyan-50 rounded-br-md' : 'bg-white/10 text-slate-100 rounded-bl-md'}`}>{t.text}</div>
              </div>
            ))}
            {state === 'listening' && (
              <div className="flex justify-end"><div className="max-w-[85%] px-3.5 py-2 rounded-2xl rounded-br-md bg-emerald-500/15 text-emerald-100 italic">{interim || 'Go ahead…'}</div></div>
            )}
          </div>

          <div className="px-3 pb-2 flex gap-2 overflow-x-auto no-scrollbar">
            {SUGGESTIONS.map((sug) => (
              <button key={sug} type="button" onClick={() => { unlockSpeech(); handle(sug); }} className="shrink-0 min-h-[36px] px-3 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 text-xs text-slate-200 whitespace-nowrap">{sug}</button>
            ))}
          </div>

          <form onSubmit={(e) => { e.preventDefault(); submitTyped(); }} className="flex items-center gap-2 p-3 border-t border-white/10">
            <input
              ref={inputRef}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Ask HALO…"
              aria-label="Ask HALO"
              className="flex-1 min-h-[48px] rounded-full bg-black/40 border border-white/15 px-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
            />
            {typed.trim() ? (
              <button type="submit" aria-label="Send" className="w-12 h-12 rounded-full bg-cyan-500 text-[#0B1628] flex items-center justify-center hover:bg-cyan-400"><Send size={18} /></button>
            ) : (
              <button type="button" onClick={toggleMic} disabled={!voiceSupported} aria-pressed={state === 'listening'} aria-label={voiceSupported ? 'Talk to HALO' : 'Voice needs Chrome or Edge'} className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all ${micClass}`}>
                {voiceSupported ? <Mic size={20} /> : <MicOff size={20} />}
              </button>
            )}
          </form>

          {voiceSupported && (
            <label className="flex items-center gap-2 px-4 pb-3 text-[11px] text-slate-400 cursor-pointer select-none">
              <input type="checkbox" checked={wakeWord} onChange={(e) => setWakeWord(e.target.checked)} className="accent-emerald-500" />
              <Ear size={12} /> Listen for "Hey HALO"
            </label>
          )}
        </div>
      )}

      <button
        type="button"
        data-testid="voice-assistant-button"
        onClick={() => (open ? closePanel() : openPanel())}
        aria-expanded={open}
        aria-label={open ? 'Close HALO assistant' : 'Open HALO assistant (press V)'}
        title="Talk to HALO · press V"
        className={`fixed bottom-6 right-[108px] z-50 w-[64px] h-[64px] rounded-full border-2 flex items-center justify-center transition-all duration-200 glove-target focus:outline-none focus:ring-4 focus:ring-cyan-400/40 bg-[#0B1628]/90 backdrop-blur ${
          state === 'listening' ? 'border-emerald-300 shadow-[0_0_0_8px_rgba(16,185,129,0.25),0_0_30px_rgba(16,185,129,0.8)]'
          : state === 'speaking' ? 'border-cyan-200 shadow-[0_0_24px_rgba(115,179,231,0.8)]'
          : open ? 'border-cyan-300 shadow-lg' : 'border-slate-500/70 hover:border-cyan-300 shadow-lg'
        }`}
      >
        <HaloBuddy state={state === 'off' ? 'idle' : state} size={58} className="pointer-events-none" />
      </button>
    </>
  );
};
