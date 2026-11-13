import React, { useEffect, useState } from 'react';
import { CheckCircle2, Clock, Radiation, ShieldAlert } from 'lucide-react';
import type { CrewMember } from '../../data/db';
import { formatElapsedSeconds } from './emergencyLogic';

interface RadiationStormProtocolProps {
  patient: CrewMember;
  missionDay: number;
  onLogStep: (step: string) => void;
  speak: (text: string) => void;
}

export const RadiationStormProtocol: React.FC<RadiationStormProtocolProps> = ({
  patient,
  missionDay,
  onLogStep,
  speak,
}) => {
  const [shelteredAt] = useState<number>(Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [inShelter, setInShelter] = useState(false);
  const [waterWallSealed, setWaterWallSealed] = useState(false);
  const [dosimeterActive, setDosimeterActive] = useState(false);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - shelteredAt) / 1000)));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [shelteredAt]);

  const handleStep = (stepName: string, state: boolean, setState: (val: boolean) => void) => {
    const next = !state;
    setState(next);
    if (next) {
      onLogStep(`${stepName} verified.`);
      speak(`${stepName} confirmed.`);
    }
  };

  const elapsedStr = formatElapsedSeconds(elapsedSeconds);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6" data-testid="radiation-storm-protocol">
      {/* Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-950 via-red-950 to-amber-950 border-2 border-amber-500/60 shadow-[0_0_30px_rgba(245,158,11,0.4)] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-600 flex items-center justify-center shrink-0 shadow-md">
            <Radiation size={22} className="text-white animate-pulse" />
          </div>
          <div>
            <div className="text-[11px] font-mono tracking-widest uppercase text-amber-300 font-black">
              PROTOCOL 4 · SOLAR PARTICLE EVENT (SPE) SHELTER
            </div>
            <h3 className="text-xl font-black text-white">
              Space Radiation Storm Emergency Protocol
            </h3>
            <p className="text-xs text-amber-200/90 font-mono">
              Patient / Crew: {patient.name} · Day {missionDay} Active Solar Storm
            </p>
          </div>
        </div>

        {/* Shelter Timer */}
        <div className="flex items-center gap-3 bg-black/70 border-2 border-amber-500/40 rounded-2xl px-4 py-2 shadow-inner">
          <Clock size={20} className="text-amber-400 animate-pulse" />
          <div>
            <div className="text-[9px] font-mono text-amber-300 uppercase leading-none font-bold">
              STORM SHELTER ELAPSED
            </div>
            <div className="text-lg font-black font-mono text-white tracking-widest">
              {elapsedStr}
            </div>
          </div>
        </div>
      </div>

      {/* Checklist */}
      <div className="p-5 sm:p-6 rounded-3xl bg-black/80 border-2 border-amber-500/40 space-y-4">
        <div className="border-b border-amber-500/30 pb-2">
          <span className="text-xs font-mono uppercase text-amber-300 font-black">
            Solar Storm Shelter Checklist (§7.8 &amp; §7.11)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
          <button
            type="button"
            onClick={() => handleStep('Moved to highest-density storm shelter core (water storage / logistics wall)', inShelter, setInShelter)}
            className={`p-4 rounded-2xl border-2 flex items-center justify-between text-left transition-all glove-target cursor-pointer min-h-[76px] ${
              inShelter ? 'bg-emerald-950/80 border-emerald-400 text-emerald-200' : 'bg-red-950/80 border-red-500 text-white'
            }`}
          >
            <div className="space-y-1">
              <span className="text-[10px] text-amber-300 font-bold block">STEP 1 · EVACUATION</span>
              <strong className="text-sm block">Move to Core Storm Shelter</strong>
              <span className="text-[11px] opacity-80">Surround crew with water tanks &amp; dense logistics bags</span>
            </div>
            {inShelter ? <CheckCircle2 size={24} className="text-emerald-400 shrink-0" /> : <ShieldAlert size={24} className="text-red-400 shrink-0" />}
          </button>

          <button
            type="button"
            onClick={() => handleStep('Deploy water shield curtain and radiation blast hatches', waterWallSealed, setWaterWallSealed)}
            className={`p-4 rounded-2xl border-2 flex items-center justify-between text-left transition-all glove-target cursor-pointer min-h-[76px] ${
              waterWallSealed ? 'bg-emerald-950/80 border-emerald-400 text-emerald-200' : 'bg-black/60 border-amber-500/40 text-slate-200'
            }`}
          >
            <div className="space-y-1">
              <span className="text-[10px] text-amber-300 font-bold block">STEP 2 · SHIELDING</span>
              <strong className="text-sm block">Deploy Water Shield Curtains</strong>
              <span className="text-[11px] opacity-80">Close heavy shielding barriers around shelter</span>
            </div>
            {waterWallSealed ? <CheckCircle2 size={24} className="text-emerald-400 shrink-0" /> : <ShieldAlert size={24} className="text-amber-400 shrink-0" />}
          </button>

          <button
            type="button"
            onClick={() => handleStep('Personal electronic dosimeter powered on and recording cumulative mSv', dosimeterActive, setDosimeterActive)}
            className={`p-4 rounded-2xl border-2 flex items-center justify-between text-left transition-all glove-target cursor-pointer min-h-[76px] sm:col-span-2 ${
              dosimeterActive ? 'bg-emerald-950/80 border-emerald-400 text-emerald-200' : 'bg-black/60 border-amber-500/40 text-slate-200'
            }`}
          >
            <div className="space-y-1">
              <span className="text-[10px] text-amber-300 font-bold block">STEP 3 · DOSIMETRY MONITORING</span>
              <strong className="text-sm block">Monitor Electronic Dosimeter mSv</strong>
              <span className="text-[11px] opacity-80">Track personal cumulative exposure against NASA 600 mSv career limit</span>
            </div>
            {dosimeterActive ? <CheckCircle2 size={24} className="text-emerald-400 shrink-0" /> : <Radiation size={24} className="text-amber-400 shrink-0" />}
          </button>
        </div>
      </div>
    </div>
  );
};
