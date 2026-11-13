import React, { useEffect, useState } from 'react';
import { AlertOctagon, Clock, Radio, User, Volume2, VolumeX, X } from 'lucide-react';
import type { CrewMember } from '../../data/db';
import { formatDelayRoundtrip, formatElapsedSeconds } from './emergencyLogic';

interface DecisionClockBarProps {
  startedAt: number;
  oneWayDelaySeconds: number;
  patient: CrewMember | null;
  isMuted: boolean;
  onToggleMute: () => void;
  onExitAndReport: () => void;
}

export const DecisionClockBar: React.FC<DecisionClockBarProps> = ({
  startedAt,
  oneWayDelaySeconds,
  patient,
  isMuted,
  onToggleMute,
  onExitAndReport,
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const update = () => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    };
    update();
    const interval = window.setInterval(update, 500);
    return () => window.clearInterval(interval);
  }, [startedAt]);

  const roundtripDelayStr = formatDelayRoundtrip(oneWayDelaySeconds);
  const elapsedStr = formatElapsedSeconds(elapsedSeconds);

  return (
    <header
      data-testid="emergency-decision-clock"
      className="sticky top-0 z-40 w-full bg-gradient-to-r from-red-950/95 via-[#1A0305]/95 to-red-950/95 backdrop-blur-md border-b-2 border-red-500/40 px-3 sm:px-6 py-2.5 shadow-[0_4px_25px_rgba(239,68,68,0.35)]"
      role="banner"
    >
      <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Left: Brand / Emergency Banner */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-red-600 flex items-center justify-center shadow-[0_0_15px_rgba(239,68,68,0.9)] animate-pulse">
            <AlertOctagon size={20} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono tracking-widest text-red-300 uppercase font-black">
                AUTONOMOUS MEDICAL RESCUE
              </span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-red-500/25 text-red-200 border border-red-500/40 uppercase">
                EMERGENCY MODE
              </span>
            </div>
            {patient && (
              <div className="flex items-center gap-1.5 text-xs text-slate-100 font-semibold">
                <User size={13} className="text-red-400" />
                <span>
                  Patient: <strong className="text-white">{patient.name}</strong>{' '}
                  <span className="text-red-300 font-mono text-[11px]">[{patient.callSign}]</span>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Center: Pinned Decision Clock (§7.11) */}
        <div className="flex items-center gap-2 sm:gap-4 bg-black/60 border border-red-500/40 rounded-xl px-3 sm:px-4 py-1.5 shadow-inner">
          {/* Earth Round-Trip Light Delay */}
          <div className="flex items-center gap-1.5 text-right sm:text-left">
            <Radio size={14} className="text-red-400 shrink-0" />
            <div>
              <div className="text-[9px] font-mono text-red-300 uppercase leading-none">
                Earliest answer from Earth (2× delay)
              </div>
              <div className="text-xs sm:text-sm font-black font-mono text-white tracking-wide">
                {roundtripDelayStr}
              </div>
            </div>
          </div>

          <div className="h-6 w-px bg-red-500/30" aria-hidden="true" />

          {/* Time Since Event Count-Up */}
          <div className="flex items-center gap-1.5">
            <Clock size={14} className="text-amber-400 shrink-0" />
            <div>
              <div className="text-[9px] font-mono text-amber-300 uppercase leading-none">
                Time since event
              </div>
              <div className="text-xs sm:text-sm font-black font-mono text-amber-200 tracking-wider">
                {elapsedStr}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Audio Toggle & Exit Button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={isMuted ? 'Unmute emergency voice guidance' : 'Mute emergency voice guidance'}
            className="p-2 sm:px-3 sm:py-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 border border-white/15 text-xs font-mono font-bold flex items-center gap-1.5 transition-colors glove-target min-h-[44px]"
            title={isMuted ? 'Unmute voice' : 'Mute voice'}
          >
            {isMuted ? <VolumeX size={16} className="text-red-400" /> : <Volume2 size={16} className="text-emerald-400" />}
            <span className="hidden sm:inline">{isMuted ? 'VOICE OFF' : 'VOICE ON'}</span>
          </button>

          <button
            type="button"
            data-testid="exit-sbar-report-btn"
            onClick={onExitAndReport}
            className="px-3 py-2 rounded-xl bg-red-600 hover:bg-red-500 active:bg-red-700 text-white border border-red-400 text-xs font-mono font-bold flex items-center gap-1.5 transition-colors shadow-[0_0_15px_rgba(239,68,68,0.5)] glove-target min-h-[44px]"
            aria-label="Exit emergency mode and generate SBAR report"
          >
            <X size={16} />
            <span>EXIT &amp; SBAR REPORT</span>
          </button>
        </div>
      </div>
    </header>
  );
};
