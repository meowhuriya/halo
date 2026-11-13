import React from 'react';
import { User, Users, Check, Heart, Activity } from 'lucide-react';
import type { CrewMember, PersonalBaseline } from '../../data/db';

interface PatientSelectStepProps {
  currentCrew: CrewMember | null;
  allCrew: CrewMember[];
  selectedPatient: CrewMember | null;
  baselines: PersonalBaseline[];
  onSelectPatient: (patient: CrewMember) => void;
  onConfirm: () => void;
}

export const PatientSelectStep: React.FC<PatientSelectStepProps> = ({
  currentCrew,
  allCrew,
  selectedPatient,
  baselines,
  onSelectPatient,
  onConfirm,
}) => {
  const isMe = selectedPatient?.id === currentCrew?.id;

  const hrBaseline = baselines.find((b) => b.indicator === 'heart_rate');
  const bpBaseline = baselines.find((b) => b.indicator === 'blood_pressure');
  const spo2Baseline = baselines.find((b) => b.indicator === 'spo2');

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6" data-testid="emergency-step-0">
      {/* Step Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-950/80 border border-red-500/50 text-red-300 font-mono text-xs uppercase tracking-widest font-black">
          <Users size={14} className="text-red-400" />
          <span>STEP 0 · PATIENT IDENTIFICATION</span>
        </div>
        <h2 className="text-2xl sm:text-4xl font-black text-white tracking-wide">
          Who needs emergency help?
        </h2>
        <p className="text-xs sm:text-sm text-red-200/90 max-w-lg mx-auto">
          All vitals, ECG rhythms, and protocol decisions are tied to the patient’s personal baseline and downlinked medical record.
        </p>
      </div>

      {/* Main Choice: Me vs Crewmate (Min 72px buttons) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {currentCrew && (
          <button
            type="button"
            data-testid="patient-choice-me"
            onClick={() => onSelectPatient(currentCrew)}
            className={`h-[84px] min-h-[84px] p-4 rounded-2xl flex items-center justify-between border-2 transition-all cursor-pointer glove-target text-left shadow-lg ${
              isMe
                ? 'bg-gradient-to-r from-red-600 to-rose-700 border-white text-white shadow-[0_0_30px_rgba(239,68,68,0.7)]'
                : 'bg-black/50 hover:bg-black/75 border-red-500/40 text-slate-100 hover:border-red-400'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold font-mono text-lg shrink-0 ${isMe ? 'bg-white text-red-700' : 'bg-red-950 text-red-300 border border-red-500/40'}`}>
                ME
              </div>
              <div>
                <div className="text-base font-black tracking-wide leading-tight">
                  I Need Help ({currentCrew.name})
                </div>
                <div className="text-xs opacity-80 font-mono">
                  {currentCrew.role} · [{currentCrew.callSign}]
                </div>
              </div>
            </div>
            {isMe && <Check size={22} className="text-white shrink-0 ml-2" />}
          </button>
        )}

        <div className="h-[84px] min-h-[84px] p-4 rounded-2xl bg-black/40 border-2 border-red-500/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-red-950/70 border border-red-500/40 flex items-center justify-center text-red-300 font-bold shrink-0">
              <Users size={22} />
            </div>
            <div>
              <div className="text-sm font-black text-white leading-tight">
                A Crewmate Needs Help
              </div>
              <div className="text-xs text-red-200/80">
                Select patient below to load baseline
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Crewmate Picker List (§7.11) */}
      <div className="space-y-2">
        <label className="text-xs font-mono uppercase tracking-wider text-red-300 font-bold block">
          All Mission Crew Members ({allCrew.length})
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {allCrew.map((member) => {
            const isSelected = selectedPatient?.id === member.id;
            return (
              <button
                key={member.id}
                type="button"
                data-testid={`select-crew-${member.id}`}
                onClick={() => onSelectPatient(member)}
                className={`min-h-[72px] p-3 rounded-xl border-2 flex items-center justify-between text-left transition-all glove-target cursor-pointer ${
                  isSelected
                    ? 'bg-red-600 border-white text-white shadow-[0_0_20px_rgba(239,68,68,0.6)]'
                    : 'bg-black/60 hover:bg-black/90 border-red-500/30 text-slate-200 hover:border-red-400'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs font-mono shrink-0 ${isSelected ? 'bg-white text-red-700' : 'bg-red-950 text-red-300 border border-red-500/40'}`}>
                    {member.callSign.slice(0, 3)}
                  </div>
                  <div>
                    <div className="text-sm font-bold leading-tight line-clamp-1">
                      {member.name}
                    </div>
                    <div className="text-[11px] opacity-75 font-mono">
                      {member.role} {member.isCmo ? '· CMO' : ''}
                    </div>
                  </div>
                </div>
                {isSelected && <Check size={18} className="text-white shrink-0 ml-1.5" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Patient Baseline Card */}
      {selectedPatient && (
        <div
          data-testid="patient-baseline-preview"
          className="p-4 sm:p-5 rounded-2xl bg-black/70 border-2 border-red-500/40 shadow-inner space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-red-500/30 pb-2.5">
            <div className="flex items-center gap-2">
              <User size={16} className="text-red-400" />
              <span className="text-xs font-mono uppercase text-red-200 font-bold">
                Patient Baseline Ready: <strong className="text-white">{selectedPatient.name}</strong> ({selectedPatient.age}{selectedPatient.sex})
              </span>
            </div>
            <span className="text-[11px] font-mono text-slate-300">
              Assigned Call Sign: <span className="text-amber-300 font-bold">{selectedPatient.callSign}</span>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 flex items-center gap-2.5">
              <Heart size={18} className="text-rose-400 shrink-0" />
              <div>
                <div className="text-[10px] font-mono text-red-300 uppercase">Resting HR Baseline</div>
                <div className="text-sm font-bold font-mono text-white">
                  {hrBaseline ? `${Math.round(hrBaseline.mean)} ± ${Math.round(hrBaseline.sd)} bpm` : '60–100 bpm (Nominal)'}
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 flex items-center gap-2.5">
              <Activity size={18} className="text-cyan-400 shrink-0" />
              <div>
                <div className="text-[10px] font-mono text-cyan-300 uppercase">Blood Pressure Baseline</div>
                <div className="text-sm font-bold font-mono text-white">
                  {bpBaseline ? `${Math.round(bpBaseline.mean)} mmHg systolic` : '< 120/80 mmHg'}
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 flex items-center gap-2.5">
              <div className="w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-[9px] font-mono font-bold text-emerald-300 shrink-0">
                O₂
              </div>
              <div>
                <div className="text-[10px] font-mono text-emerald-300 uppercase">SpO₂ Pulse Ox Baseline</div>
                <div className="text-sm font-bold font-mono text-white">
                  {spo2Baseline ? `${Math.round(spo2Baseline.mean)}%` : '≥ 95% (Nominal)'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Button (Min 72px glove target) */}
      <button
        type="button"
        disabled={!selectedPatient}
        onClick={onConfirm}
        data-testid="confirm-patient-btn"
        className="w-full h-[76px] min-h-[76px] rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-500 hover:to-rose-500 disabled:opacity-50 text-white font-mono font-black text-lg sm:text-xl tracking-wider flex items-center justify-center gap-3 shadow-[0_0_35px_rgba(239,68,68,0.7)] border-2 border-red-300 active:scale-98 transition-all glove-target cursor-pointer"
      >
        <span>CONFIRM PATIENT &amp; START EMERGENCY TRIAGE</span>
      </button>
    </div>
  );
};
