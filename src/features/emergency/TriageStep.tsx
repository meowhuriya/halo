import React from 'react';
import { AlertOctagon, Heart, ShieldAlert, Wind } from 'lucide-react';
import type { CrewMember } from '../../data/db';
import type { EmergencyType } from './emergencyLogic';

interface TriageStepProps {
  patient: CrewMember;
  onSelectUnresponsive: () => void;
  onSelectConsciousProtocol: (type: EmergencyType) => void;
}

export const TriageStep: React.FC<TriageStepProps> = ({
  patient,
  onSelectUnresponsive,
  onSelectConsciousProtocol,
}) => {
  return (
    <div className="w-full max-w-4xl mx-auto space-y-6" data-testid="emergency-triage-step">
      {/* Triage Banner */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-950/80 border border-red-500/50 text-red-300 font-mono text-xs uppercase tracking-widest font-black">
          <AlertOctagon size={14} className="text-red-400" />
          <span>TRIAGE QUESTION 1 · IMMEDIATE ASSESSMENT</span>
        </div>
        <h2 className="text-2xl sm:text-4xl font-black text-white tracking-wide">
          Is {patient.name} responsive and breathing normally?
        </h2>
        <p className="text-xs sm:text-sm text-red-200/90 max-w-xl mx-auto">
          Tap shoulders, shout &ldquo;{patient.callSign}, can you hear me?&rdquo; Look at the chest for 5–10 seconds for regular chest rise.
        </p>
      </div>

      {/* Primary Triage Branch: 2 Huge Buttons (>= 72px) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* NO -> Unresponsive / Not breathing -> Protocol 1 (CPR) */}
        <button
          type="button"
          data-testid="triage-unresponsive-btn"
          onClick={onSelectUnresponsive}
          className="h-[120px] min-h-[120px] p-5 rounded-2xl bg-gradient-to-br from-red-700 via-rose-700 to-red-800 hover:from-red-600 hover:to-rose-600 active:scale-98 transition-all border-2 border-red-300 flex flex-col justify-center items-start text-left shadow-[0_0_35px_rgba(239,68,68,0.7)] cursor-pointer glove-target group"
        >
          <div className="flex items-center gap-2 text-white">
            <AlertOctagon size={26} className="text-white shrink-0 group-hover:animate-bounce" />
            <span className="text-xl sm:text-2xl font-black tracking-wider">
              NO · UNRESPONSIVE
            </span>
          </div>
          <p className="text-xs text-red-100 mt-1 font-mono">
            No normal breathing or carotid pulse → Start CPR Coach &amp; AED Metronome
          </p>
        </button>

        {/* YES -> Conscious -> Choose clinical presentation */}
        <div className="h-[120px] min-h-[120px] p-5 rounded-2xl bg-black/60 border-2 border-red-500/40 flex flex-col justify-center items-start text-left">
          <div className="flex items-center gap-2 text-emerald-400">
            <Heart size={24} className="shrink-0" />
            <span className="text-xl sm:text-2xl font-black tracking-wider text-white">
              YES · CONSCIOUS
            </span>
          </div>
          <p className="text-xs text-red-200/80 mt-1 font-mono">
            Patient is breathing. Select clinical emergency symptom below:
          </p>
        </div>
      </div>

      {/* Conscious Emergency Protocol Options (>= 72px buttons) */}
      <div className="space-y-3">
        <label className="text-xs font-mono uppercase tracking-wider text-red-300 font-bold block">
          Select Conscious Clinical Protocol (§7.11):
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Protocol 2: Chest Pain */}
          <button
            type="button"
            data-testid="select-protocol-chest-pain"
            onClick={() => onSelectConsciousProtocol('CHEST_PAIN')}
            className="h-[84px] min-h-[84px] p-4 rounded-2xl bg-red-950/70 hover:bg-red-900/90 border-2 border-red-500/50 hover:border-red-400 flex items-center gap-3 text-left transition-all glove-target cursor-pointer shadow-md"
          >
            <div className="w-12 h-12 rounded-xl bg-red-600/30 border border-red-400/50 flex items-center justify-center text-rose-300 shrink-0">
              <Heart size={24} />
            </div>
            <div>
              <div className="text-sm font-black text-white tracking-wide">
                2. Acute Chest Pain
              </div>
              <div className="text-[11px] text-red-200/80 font-mono line-clamp-1">
                Pressure / Angina / DCS triage
              </div>
            </div>
          </button>

          {/* Protocol 3: Breathing / Toxic Atmosphere */}
          <button
            type="button"
            data-testid="select-protocol-toxic-breathing"
            onClick={() => onSelectConsciousProtocol('TOXIC_BREATHING')}
            className="h-[84px] min-h-[84px] p-4 rounded-2xl bg-red-950/70 hover:bg-red-900/90 border-2 border-red-500/50 hover:border-red-400 flex items-center gap-3 text-left transition-all glove-target cursor-pointer shadow-md"
          >
            <div className="w-12 h-12 rounded-xl bg-orange-600/30 border border-orange-400/50 flex items-center justify-center text-orange-300 shrink-0">
              <Wind size={24} />
            </div>
            <div>
              <div className="text-sm font-black text-white tracking-wide">
                3. Toxic / Smoke / Dyspnea
              </div>
              <div className="text-[11px] text-orange-200/80 font-mono line-clamp-1">
                Mask on · Module evacuation
              </div>
            </div>
          </button>

          {/* Protocol 4: Radiation Storm (SPE) */}
          <button
            type="button"
            data-testid="select-protocol-solar-storm"
            onClick={() => onSelectConsciousProtocol('SOLAR_STORM')}
            className="h-[84px] min-h-[84px] p-4 rounded-2xl bg-red-950/70 hover:bg-red-900/90 border-2 border-red-500/50 hover:border-red-400 flex items-center gap-3 text-left transition-all glove-target cursor-pointer shadow-md"
          >
            <div className="w-12 h-12 rounded-xl bg-amber-600/30 border border-amber-400/50 flex items-center justify-center text-amber-300 shrink-0">
              <ShieldAlert size={24} />
            </div>
            <div>
              <div className="text-sm font-black text-white tracking-wide">
                4. Radiation Storm (SPE)
              </div>
              <div className="text-[11px] text-amber-200/80 font-mono line-clamp-1">
                Storm shelter protocol
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
