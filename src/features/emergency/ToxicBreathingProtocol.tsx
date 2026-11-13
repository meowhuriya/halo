import React, { useState } from 'react';
import { AlertOctagon, CheckCircle2, ShieldAlert, Wind } from 'lucide-react';
import type { CrewMember } from '../../data/db';

interface ToxicBreathingProtocolProps {
  patient: CrewMember;
  onLogStep: (step: string) => void;
  speak: (text: string) => void;
}

export const ToxicBreathingProtocol: React.FC<ToxicBreathingProtocolProps> = ({
  patient,
  onLogStep,
  speak,
}) => {
  const [maskDonned, setMaskDonned] = useState(false);
  const [moduleEvacuated, setModuleEvacuated] = useState(false);
  const [ventilationIsolated, setVentilationIsolated] = useState(false);
  const [pulseOxAttached, setPulseOxAttached] = useState(false);

  const handleStep = (stepName: string, state: boolean, setState: (val: boolean) => void) => {
    const next = !state;
    setState(next);
    if (next) {
      onLogStep(`${stepName} verified.`);
      speak(`${stepName} confirmed. Proceed with next action.`);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6" data-testid="toxic-breathing-protocol">
      {/* Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-orange-950 via-red-950 to-orange-950 border-2 border-orange-500/60 shadow-[0_0_30px_rgba(249,115,22,0.4)] flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center shrink-0 shadow-md">
          <Wind size={22} className="text-white animate-pulse" />
        </div>
        <div>
          <div className="text-[11px] font-mono tracking-widest uppercase text-orange-300 font-black">
            PROTOCOL 3 · ATMOSPHERIC CONTAMINATION &amp; DYSPNEA
          </div>
          <h3 className="text-xl font-black text-white">
            Toxic Atmosphere, Smoke Inhalation &amp; Acute Dyspnea
          </h3>
          <p className="text-xs text-orange-200/90 font-mono">
            Patient: {patient.name} [{patient.callSign}] · Immediate isolation protocol
          </p>
        </div>
      </div>

      {/* Critical Action Sequence per §7.11 */}
      <div className="p-5 sm:p-6 rounded-3xl bg-black/80 border-2 border-orange-500/40 space-y-4">
        <div className="border-b border-orange-500/30 pb-2">
          <span className="text-xs font-mono uppercase text-orange-300 font-black">
            Immediate Life-Safety Checklist (Execute in Sequence)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
          {/* Step 1: Oxygen Mask First */}
          <button
            type="button"
            onClick={() => handleStep('Emergency breathing apparatus / oxygen mask donned', maskDonned, setMaskDonned)}
            className={`p-4 rounded-2xl border-2 flex items-center justify-between text-left transition-all glove-target cursor-pointer min-h-[76px] ${
              maskDonned
                ? 'bg-emerald-950/80 border-emerald-400 text-emerald-200'
                : 'bg-red-950/80 border-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.5)]'
            }`}
          >
            <div className="space-y-1">
              <span className="text-[10px] text-orange-300 font-bold block">STEP 1 · IMMEDIATE</span>
              <strong className="text-sm block">Don Emergency Oxygen Mask</strong>
              <span className="text-[11px] opacity-80">Do not inhale ambient cabin air</span>
            </div>
            {maskDonned ? <CheckCircle2 size={24} className="text-emerald-400 shrink-0" /> : <AlertOctagon size={24} className="text-red-400 shrink-0" />}
          </button>

          {/* Step 2: Evacuate Module */}
          <button
            type="button"
            onClick={() => handleStep('Affected module evacuated and hatch sealed', moduleEvacuated, setModuleEvacuated)}
            className={`p-4 rounded-2xl border-2 flex items-center justify-between text-left transition-all glove-target cursor-pointer min-h-[76px] ${
              moduleEvacuated
                ? 'bg-emerald-950/80 border-emerald-400 text-emerald-200'
                : 'bg-red-950/80 border-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.5)]'
            }`}
          >
            <div className="space-y-1">
              <span className="text-[10px] text-orange-300 font-bold block">STEP 2 · EVACUATION</span>
              <strong className="text-sm block">Evacuate &amp; Seal Hatch</strong>
              <span className="text-[11px] opacity-80">Move to safe compartment; close pressure door</span>
            </div>
            {moduleEvacuated ? <CheckCircle2 size={24} className="text-emerald-400 shrink-0" /> : <AlertOctagon size={24} className="text-red-400 shrink-0" />}
          </button>

          {/* Step 3: Isolate Ventilation */}
          <button
            type="button"
            onClick={() => handleStep('Cabin ventilation loop isolated and scrubbers enabled', ventilationIsolated, setVentilationIsolated)}
            className={`p-4 rounded-2xl border-2 flex items-center justify-between text-left transition-all glove-target cursor-pointer min-h-[76px] ${
              ventilationIsolated
                ? 'bg-emerald-950/80 border-emerald-400 text-emerald-200'
                : 'bg-black/60 border-orange-500/40 text-slate-200'
            }`}
          >
            <div className="space-y-1">
              <span className="text-[10px] text-orange-300 font-bold block">STEP 3 · LIFE SUPPORT</span>
              <strong className="text-sm block">Isolate Cabin Airflow</strong>
              <span className="text-[11px] opacity-80">Engage emergency toxic contaminant scrubber</span>
            </div>
            {ventilationIsolated ? <CheckCircle2 size={24} className="text-emerald-400 shrink-0" /> : <ShieldAlert size={24} className="text-orange-400 shrink-0" />}
          </button>

          {/* Step 4: SpO2 Monitoring */}
          <button
            type="button"
            onClick={() => handleStep('Pulse oximeter attached for continuous SpO2 and respiration tracking', pulseOxAttached, setPulseOxAttached)}
            className={`p-4 rounded-2xl border-2 flex items-center justify-between text-left transition-all glove-target cursor-pointer min-h-[76px] ${
              pulseOxAttached
                ? 'bg-emerald-950/80 border-emerald-400 text-emerald-200'
                : 'bg-black/60 border-orange-500/40 text-slate-200'
            }`}
          >
            <div className="space-y-1">
              <span className="text-[10px] text-orange-300 font-bold block">STEP 4 · TELEMETRY</span>
              <strong className="text-sm block">Continuous SpO₂ &amp; Resp Tracking</strong>
              <span className="text-[11px] opacity-80">Target SpO₂ ≥ 95% on supplemental O₂</span>
            </div>
            {pulseOxAttached ? <CheckCircle2 size={24} className="text-emerald-400 shrink-0" /> : <Wind size={24} className="text-orange-400 shrink-0" />}
          </button>
        </div>
      </div>
    </div>
  );
};
