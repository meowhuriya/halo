import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertOctagon,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import type { CrewMember } from '../../data/db';
import type { MissionEnvironment } from '../../config/environments';
import { CprMetronome, type MetronomeTickEvent } from './cprMetronome';

interface CprCoachProtocolProps {
  patient: CrewMember;
  environment: MissionEnvironment;
  onLogStep: (step: string) => void;
  speak: (text: string) => void;
}

export const CprCoachProtocol: React.FC<CprCoachProtocolProps> = ({
  patient,
  environment,
  onLogStep,
  speak,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [compressionCount, setCompressionCount] = useState(0);
  const [cycleCount, setCycleCount] = useState(1);
  const [phase, setPhase] = useState<'compression' | 'breath'>('compression');
  const [breathNumber, setBreathNumber] = useState<1 | 2 | undefined>(undefined);
  const [pulseActive, setPulseActive] = useState(false);
  const [aedStaged, setAedStaged] = useState(false);
  const [selectedMethodTab, setSelectedMethodTab] = useState<'evetts' | 'restraint' | 'handstand'>('evetts');

  const metronomeRef = useRef<CprMetronome | null>(null);

  useEffect(() => {
    const metro = new CprMetronome((e: MetronomeTickEvent) => {
      setCompressionCount(e.compressionCount);
      setCycleCount(e.cycleCount);
      setPhase(e.phase);
      setBreathNumber(e.breathNumber);

      // Trigger visual pulse
      setPulseActive(true);
      window.setTimeout(() => setPulseActive(false), 120);

      if (e.phase === 'breath' && e.breathNumber === 1) {
        speak('Stop compressions. Deliver two rescue breaths now.');
      } else if (e.phase === 'compression' && e.compressionCount === 1) {
        onLogStep(`Completed CPR cycle ${e.cycleCount - 1}. Starting cycle ${e.cycleCount}.`);
      }
    });

    metronomeRef.current = metro;

    return () => {
      metro.stop();
    };
  }, [onLogStep, speak]);

  const handleToggleMetronome = () => {
    if (!metronomeRef.current) return;
    if (isRunning) {
      metronomeRef.current.stop();
      setIsRunning(false);
      onLogStep(`CPR metronome paused at cycle ${cycleCount}, compression ${compressionCount}.`);
    } else {
      metronomeRef.current.setMuted(isAudioMuted);
      metronomeRef.current.start();
      setIsRunning(true);
      onLogStep(`CPR metronome started at 110 bpm (Cycle ${cycleCount}).`);
      speak('Starting CPR metronome at 110 compressions per minute. Push hard and fast, 5 to 6 centimeters depth.');
    }
  };

  const handleReset = () => {
    metronomeRef.current?.reset();
    setIsRunning(false);
    setCompressionCount(0);
    setCycleCount(1);
    setPhase('compression');
    onLogStep('CPR metronome reset to cycle 1.');
  };

  const handleToggleMute = () => {
    const nextMuted = !isAudioMuted;
    setIsAudioMuted(nextMuted);
    metronomeRef.current?.setMuted(nextMuted);
  };

  const handleToggleAed = () => {
    const next = !aedStaged;
    setAedStaged(next);
    if (next) {
      onLogStep('Onboard AED retrieved and pads applied to patient chest.');
      speak('AED pads applied. Stand clear for rhythm analysis whenever AED announces.');
    }
  };

  const isMicrogravity = environment.gravityG === 0;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6" data-testid="cpr-coach-protocol">
      {/* Protocol Alert & Critical Warning Line per §7.11 & §8 */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-red-950 via-rose-950 to-red-950 border-2 border-red-500/60 shadow-[0_0_30px_rgba(239,68,68,0.4)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center shrink-0 shadow-md">
            <AlertOctagon size={22} className="text-white animate-pulse" />
          </div>
          <div>
            <div className="text-[11px] font-mono tracking-widest uppercase text-red-300 font-black">
              PROTOCOL 1 · RESUSCITATION COACH
            </div>
            <h3 className="text-xl font-black text-white">
              Cardiopulmonary Resuscitation (CPR) · 110/min Metronome
            </h3>
            {/* The exact line required by §7.11 & user prompt */}
            <p className="text-xs sm:text-sm font-bold text-amber-300 mt-1 font-mono">
              &ldquo;Without CPR, brain injury can begin in about 4–6 minutes.&rdquo;
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleToggleAed}
          data-testid="cpr-aed-button"
          className={`h-[56px] px-4 rounded-xl border-2 font-mono font-bold text-xs flex items-center gap-2 shrink-0 transition-all glove-target cursor-pointer ${
            aedStaged
              ? 'bg-emerald-600 border-white text-white shadow-[0_0_20px_rgba(34,197,94,0.6)]'
              : 'bg-black/60 hover:bg-black/90 border-amber-400 text-amber-200'
          }`}
        >
          <Zap size={18} className={aedStaged ? 'text-white' : 'text-amber-400'} />
          <span>{aedStaged ? '✓ AED PADS APPLIED' : 'GET AED & APPLY PADS'}</span>
        </button>
      </div>

      {/* Main Resuscitation Display: Metronome Pulse + Counter (110 bpm) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
        {/* Left: Metronome Dial & Visual Pulse */}
        <div className="md:col-span-7 p-6 rounded-3xl bg-black/80 border-2 border-red-500/50 flex flex-col items-center justify-center text-center space-y-4 shadow-2xl relative overflow-hidden">
          {/* Background Beat Flash */}
          <div
            className={`absolute inset-0 bg-red-600 transition-opacity pointer-events-none duration-75 ${
              pulseActive ? 'opacity-25' : 'opacity-0'
            }`}
          />

          <div className="flex items-center justify-between w-full border-b border-red-500/30 pb-2">
            <span className="text-xs font-mono uppercase text-red-300 font-bold">
              Web Audio Clock Metronome (110 BPM)
            </span>
            <span className="text-xs font-mono font-bold text-white px-2.5 py-0.5 rounded bg-red-950 border border-red-500/40">
              CYCLE {cycleCount}
            </span>
          </div>

          {/* Central Beat Pulse Circle */}
          <div
            data-testid="cpr-visual-pulse-indicator"
            className={`w-44 h-44 sm:w-52 sm:h-52 rounded-full border-4 flex flex-col items-center justify-center transition-all duration-100 select-none ${
              phase === 'breath'
                ? 'bg-cyan-950/80 border-cyan-400 shadow-[0_0_40px_rgba(56,225,255,0.6)]'
                : pulseActive
                ? 'scale-105 bg-red-600 border-white shadow-[0_0_50px_rgba(239,68,68,1)]'
                : 'bg-red-950/60 border-red-500/70 shadow-[0_0_25px_rgba(239,68,68,0.4)]'
            }`}
          >
            {phase === 'compression' ? (
              <>
                <span className="text-5xl sm:text-6xl font-black font-mono text-white tracking-tighter">
                  {compressionCount}
                </span>
                <span className="text-[11px] font-mono uppercase tracking-widest text-red-200 font-bold mt-1">
                  OF 30 COMPRESSIONS
                </span>
              </>
            ) : (
              <>
                <span className="text-3xl sm:text-4xl font-black font-mono text-cyan-200">
                  BREATH {breathNumber || 1}
                </span>
                <span className="text-[11px] font-mono uppercase tracking-widest text-cyan-300 font-bold mt-1">
                  DELIVER 2 RESCUE BREATHS
                </span>
              </>
            )}
          </div>

          {/* Target Depth & Recoil Reminder */}
          <div className="flex items-center gap-4 text-xs font-mono text-slate-200">
            <div className="flex items-center gap-1.5">
              <Activity size={14} className="text-red-400" />
              <span>Target Depth: <strong className="text-white">5–6 cm (2–2.4 in)</strong></span>
            </div>
            <div className="h-4 w-px bg-white/20" />
            <span className="text-emerald-300">Allow full chest recoil</span>
          </div>

          {/* Huge Metronome Controls (>= 72px) */}
          <div className="flex items-center gap-3 w-full pt-2">
            <button
              type="button"
              data-testid="toggle-metronome-btn"
              onClick={handleToggleMetronome}
              className={`flex-1 h-[76px] min-h-[76px] rounded-2xl font-mono font-black text-lg tracking-wider flex items-center justify-center gap-3 transition-all glove-target cursor-pointer shadow-lg border-2 ${
                isRunning
                  ? 'bg-amber-600 hover:bg-amber-500 text-white border-amber-300 shadow-[0_0_25px_rgba(217,119,6,0.6)]'
                  : 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white border-white shadow-[0_0_35px_rgba(239,68,68,0.8)]'
              }`}
            >
              {isRunning ? <Pause size={24} /> : <Play size={24} />}
              <span>{isRunning ? 'PAUSE METRONOME' : 'START 110/MIN METRONOME'}</span>
            </button>

            <button
              type="button"
              onClick={handleToggleMute}
              className="h-[76px] w-[76px] min-h-[76px] min-w-[76px] rounded-2xl bg-black/60 hover:bg-black/80 border-2 border-red-500/40 text-white flex items-center justify-center transition-all glove-target cursor-pointer shrink-0"
              aria-label={isAudioMuted ? 'Unmute metronome click' : 'Mute metronome click'}
              title={isAudioMuted ? 'Unmute click' : 'Mute click'}
            >
              {isAudioMuted ? <VolumeX size={22} className="text-red-400" /> : <Volume2 size={22} className="text-emerald-400" />}
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="h-[76px] w-[76px] min-h-[76px] min-w-[76px] rounded-2xl bg-black/60 hover:bg-black/80 border-2 border-red-500/40 text-slate-300 hover:text-white flex items-center justify-center transition-all glove-target cursor-pointer shrink-0"
              aria-label="Reset CPR cycle"
              title="Reset cycle counter"
            >
              <RotateCcw size={22} />
            </button>
          </div>
        </div>

        {/* Right: Environment-Aware Positioning Guidance (§7.11) */}
        <div className="md:col-span-5 p-5 rounded-3xl bg-black/70 border-2 border-red-500/40 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between border-b border-red-500/30 pb-2">
              <span className="text-xs font-mono uppercase text-red-300 font-bold">
                Positioning · {environment.name} ({environment.gravityG}g)
              </span>
              <span className="text-[10px] font-mono text-amber-300 font-bold px-2 py-0.5 rounded bg-amber-950/60 border border-amber-500/40">
                {isMicrogravity ? '0g MICROGRAVITY' : 'PARTIAL GRAVITY'}
              </span>
            </div>

            {isMicrogravity ? (
              <div className="space-y-3 mt-3">
                {/* Microgravity Method Tabs */}
                <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-black/60 border border-red-500/30 text-[11px] font-mono font-bold">
                  <button
                    type="button"
                    onClick={() => setSelectedMethodTab('evetts')}
                    className={`py-2 rounded-lg transition-all ${
                      selectedMethodTab === 'evetts'
                        ? 'bg-red-600 text-white shadow'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Evetts-Russomano
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedMethodTab('restraint')}
                    className={`py-2 rounded-lg transition-all ${
                      selectedMethodTab === 'restraint'
                        ? 'bg-red-600 text-white shadow'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Restraint Table
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedMethodTab('handstand')}
                    className={`py-2 rounded-lg transition-all ${
                      selectedMethodTab === 'handstand'
                        ? 'bg-red-600 text-white shadow'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Handstand
                  </button>
                </div>

                {/* Method Description Content */}
                {selectedMethodTab === 'evetts' && (
                  <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/30 space-y-2">
                    <div className="text-sm font-black text-white">
                      Evetts-Russomano Method (Recommended)
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed">
                      Rescuer straddles patient, wrapping legs firmly around patient&apos;s torso to anchor against the equal-and-opposite reaction force of compressions. Rescuer locks elbows and compresses sternum with arm strength.
                    </p>
                    <div className="text-[11px] font-mono text-red-300">
                      Developed by Dr. Michael Evetts &amp; Dr. Thais Russomano for weightless CPR without straps.
                    </div>
                  </div>
                )}

                {selectedMethodTab === 'restraint' && (
                  <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/30 space-y-2">
                    <div className="text-sm font-black text-white">
                      Medical Restraint Method
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed">
                      Secure patient to crew medical restraint system (CMRS) with back flat against a rigid bulkhead. Rescuer straps knees into floor foot-loops to provide downward purchase.
                    </p>
                    <div className="text-[11px] font-mono text-red-300">
                      Standard ISS procedure when equipment and medical rack are immediately accessible.
                    </div>
                  </div>
                )}

                {selectedMethodTab === 'handstand' && (
                  <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/30 space-y-2">
                    <div className="text-sm font-black text-white">
                      Handstand Method
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed">
                      Rescuer places hands on patient&apos;s sternum and braces feet firmly against the opposite wall or ceiling bulkhead. Compressing by extending legs and pushing down against the opposite structure.
                    </p>
                    <div className="text-[11px] font-mono text-red-300">
                      Ideal in narrow transit corridor or module where ceiling is within leg reach (~2.0 m).
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Moon or Mars Surface CPR */
              <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/40 space-y-2.5 mt-3">
                <div className="text-sm font-black text-amber-200">
                  Standard Ground CPR (Reduced Weight Note)
                </div>
                <p className="text-xs text-slate-100 leading-relaxed">
                  Place {patient.name} supine on a rigid flat surface. Rescuer kneels beside chest.
                </p>
                <div className="p-3 rounded-lg bg-black/60 border border-amber-400/30 text-xs text-amber-100 space-y-1">
                  <strong className="block text-amber-300 font-mono">⚠️ REDUCED BODY WEIGHT COMPENSATION:</strong>
                  <span>
                    In {environment.gravityG}g gravity, your body weight produces only {Math.round(environment.gravityG * 100)}% of downward Earth force. You cannot rely on passive upper-body weight alone: use active shoulder and triceps contraction to achieve 5–6 cm depth.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Quick Resuscitation Checklist */}
          <div className="p-3.5 rounded-xl bg-black/50 border border-white/10 text-xs space-y-1.5 font-mono">
            <div className="font-bold text-red-300 uppercase">Resuscitation Sequence:</div>
            <div className="flex items-center gap-2 text-slate-200">
              <span className="w-4 h-4 rounded bg-red-600/40 text-center font-bold text-[10px]">1</span>
              <span>Shout for crew &amp; CMO assistance</span>
            </div>
            <div className="flex items-center gap-2 text-slate-200">
              <span className="w-4 h-4 rounded bg-red-600/40 text-center font-bold text-[10px]">2</span>
              <span>Retrieve AED · Attach pads immediately</span>
            </div>
            <div className="flex items-center gap-2 text-slate-200">
              <span className="w-4 h-4 rounded bg-red-600/40 text-center font-bold text-[10px]">3</span>
              <span>Compress 30 times at 110/min → Give 2 breaths</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
