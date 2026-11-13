import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  Clock,
  Heart,
  Save,
  Wind,
  Zap,
} from 'lucide-react';
import type { CrewMember, PersonalBaseline } from '../../data/db';
import { db } from '../../data/db';
import {
  evaluateChestPain,
  formatVitalsWithBaseline,
  type ChestPainAssessmentInput,
  type RedFlagAssessmentResult,
  type VitalsSnapshot,
} from './emergencyLogic';

interface ChestPainProtocolProps {
  patient: CrewMember;
  missionDay: number;
  baselines: PersonalBaseline[];
  onLogStep: (step: string) => void;
  onRecordVitals: (snapshot: VitalsSnapshot) => void;
  speak: (text: string) => void;
}

export const ChestPainProtocol: React.FC<ChestPainProtocolProps> = ({
  patient,
  missionDay,
  baselines,
  onLogStep,
  onRecordVitals,
  speak,
}) => {
  // Symptom Questionnaire State per §7.11
  const [onset, setOnset] = useState<'sudden' | 'gradual'>('sudden');
  const [character, setCharacter] = useState<'pressure' | 'sharp' | 'tearing' | 'dull' | 'other'>('pressure');
  const [radArm, setRadArm] = useState(true);
  const [radJaw, setRadJaw] = useState(false);
  const [radNeck, setRadNeck] = useState(false);
  const [radBack, setRadBack] = useState(false);
  const [shortnessOfBreath, setShortnessOfBreath] = useState(true);
  const [sweating, setSweating] = useState(true);
  const [recentEva, setRecentEva] = useState(false);
  const [recentTrauma, setRecentTrauma] = useState(false);

  // Vitals inputs
  const [hrInput, setHrInput] = useState('118');
  const [sysInput, setSysInput] = useState('142');
  const [diaInput, setDiaInput] = useState('92');
  const [spo2Input, setSpo2Input] = useState('91');
  const [vitalsSaved, setVitalsSaved] = useState(false);

  // 5-Minute Re-check Timer (300 s)
  const [recheckSecondsLeft, setRecheckSecondsLeft] = useState(300);
  const [timerRunning, setTimerRunning] = useState(true);

  // AED & O2 checklists
  const [aedPrepared, setAedPrepared] = useState(false);
  const [oxygenDelivered, setOxygenDelivered] = useState(false);

  const hrBaseline = baselines.find((b) => b.indicator === 'heart_rate');
  const bpBaseline = baselines.find((b) => b.indicator === 'blood_pressure');
  const spo2Baseline = baselines.find((b) => b.indicator === 'spo2');

  const assessmentInput: ChestPainAssessmentInput = {
    onset,
    character,
    radiation: {
      leftArm: radArm,
      jaw: radJaw,
      neck: radNeck,
      back: radBack,
      none: !radArm && !radJaw && !radNeck && !radBack,
    },
    shortnessOfBreath,
    sweating,
    recentEvaOrSuitPressureChange: recentEva,
    recentTrauma,
    vitals: {
      heartRate: hrInput ? Number(hrInput) : undefined,
      systolicBp: sysInput ? Number(sysInput) : undefined,
      diastolicBp: diaInput ? Number(diaInput) : undefined,
      spo2: spo2Input ? Number(spo2Input) : undefined,
    },
  };

  const evaluation: RedFlagAssessmentResult = evaluateChestPain(assessmentInput);

  // Run 5-Minute Timer
  useEffect(() => {
    if (!timerRunning || recheckSecondsLeft <= 0) return;
    const interval = window.setInterval(() => {
      setRecheckSecondsLeft((prev) => {
        if (prev <= 1) {
          speak('Five-minute recheck interval elapsed. Re-measure patient vitals and reassess pain immediately.');
          onLogStep('5-minute recheck timer reached zero. Prompted for repeat vitals.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [timerRunning, recheckSecondsLeft, onLogStep, speak]);

  const handleSaveVitals = async () => {
    const hr = Number(hrInput);
    const sys = Number(sysInput);
    const dia = Number(diaInput);
    const spo2 = Number(spo2Input);

    if (patient.id && Number.isFinite(hr) && hr > 0) {
      await db.healthReadings.add({
        crewMemberId: patient.id,
        timestamp: Date.now(),
        missionDay,
        indicator: 'heart_rate',
        value: hr,
        unit: 'bpm',
        status: hr > 100 || hr < 50 ? 'ALERT' : 'NOMINAL',
        reasons: [`Emergency chest pain triage resting HR ${hr} bpm`],
        source: 'manual',
        quality: 'GOOD',
      });
    }

    if (patient.id && Number.isFinite(sys) && Number.isFinite(dia)) {
      await db.healthReadings.add({
        crewMemberId: patient.id,
        timestamp: Date.now(),
        missionDay,
        indicator: 'blood_pressure',
        value: { systolic: sys, diastolic: dia },
        unit: 'mmHg',
        status: sys >= 140 || dia >= 90 ? 'ALERT' : 'NOMINAL',
        reasons: [`Emergency chest pain triage BP ${sys}/${dia} mmHg`],
        source: 'manual',
      });
    }

    if (patient.id && Number.isFinite(spo2) && spo2 > 0) {
      await db.healthReadings.add({
        crewMemberId: patient.id,
        timestamp: Date.now(),
        missionDay,
        indicator: 'spo2',
        value: spo2,
        unit: '%',
        status: spo2 < 90 ? 'CRITICAL' : spo2 < 95 ? 'ALERT' : 'NOMINAL',
        reasons: [`Emergency chest pain triage SpO2 ${spo2}%`],
        source: 'manual',
      });
    }

    onRecordVitals({
      heartRate: hr,
      systolicBp: sys,
      diastolicBp: dia,
      spo2,
      timestamp: Date.now(),
    });

    setVitalsSaved(true);
    onLogStep(`Vitals recorded for ${patient.name}: HR ${hr} bpm, BP ${sys}/${dia} mmHg, SpO₂ ${spo2}%.`);
    speak(`Vitals recorded: Heart rate ${hr}, blood pressure ${sys} over ${dia}, oxygen saturation ${spo2} percent.`);
  };

  const handleResetTimer = () => {
    setRecheckSecondsLeft(300);
    setTimerRunning(true);
    onLogStep('5-minute vitals re-check timer reset.');
  };

  const timerMins = Math.floor(recheckSecondsLeft / 60);
  const timerSecs = recheckSecondsLeft % 60;
  const timerStr = `${String(timerMins).padStart(2, '0')}:${String(timerSecs).padStart(2, '0')}`;

  // Evaluate current inputs against patient baselines
  const hrEval = formatVitalsWithBaseline('heart_rate', Number(hrInput) || 0, hrBaseline, patient.sex);
  const bpEval = formatVitalsWithBaseline(
    'blood_pressure',
    { sys: Number(sysInput) || 0, dia: Number(diaInput) || 0 },
    bpBaseline,
    patient.sex
  );
  const spo2Eval = formatVitalsWithBaseline('spo2', Number(spo2Input) || 0, spo2Baseline, patient.sex);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6" data-testid="chest-pain-protocol">
      {/* Protocol Banner & 5-Min Timer Header */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-red-950 via-rose-950 to-red-950 border-2 border-red-500/60 shadow-[0_0_30px_rgba(239,68,68,0.4)] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center shrink-0 shadow-md">
            <Heart size={22} className="text-white animate-pulse" />
          </div>
          <div>
            <div className="text-[11px] font-mono tracking-widest uppercase text-red-300 font-black">
              PROTOCOL 2 · CONSCIOUS CHEST PAIN TRIAGE
            </div>
            <h3 className="text-xl font-black text-white">
              Acute Thoracic &amp; Coronary Symptom Capture
            </h3>
            <p className="text-xs text-red-200/90 font-mono">
              Patient: {patient.name} [{patient.callSign}] · {patient.age}{patient.sex}
            </p>
          </div>
        </div>

        {/* 5-Minute Re-Check Timer (§7.11) */}
        <div className="flex items-center gap-3 bg-black/70 border-2 border-red-500/40 rounded-2xl px-4 py-2 shadow-inner">
          <Clock size={20} className={recheckSecondsLeft === 0 ? 'text-red-400 animate-ping' : 'text-amber-400'} />
          <div>
            <div className="text-[9px] font-mono text-amber-300 uppercase leading-none font-bold">
              5-MIN RE-CHECK TIMER
            </div>
            <div className="text-lg font-black font-mono text-white tracking-widest">
              {timerStr}
            </div>
          </div>
          <button
            type="button"
            onClick={handleResetTimer}
            className="text-[10px] font-mono font-bold px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-slate-200 border border-white/20"
            title="Reset 5 min timer"
          >
            RESET
          </button>
        </div>
      </div>

      {/* Structured Symptom Questionnaire (§7.11) */}
      <div className="p-5 sm:p-6 rounded-3xl bg-black/80 border-2 border-red-500/40 space-y-5">
        <div className="flex items-center justify-between border-b border-red-500/30 pb-2">
          <span className="text-xs font-mono uppercase text-red-300 font-black">
            1. Clinical Symptom Screening (NASA Space Apps Challenge Scenario)
          </span>
          <span className="text-[11px] font-mono text-slate-400">Tap to toggle answers</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          {/* Onset */}
          <div className="space-y-1.5 p-3 rounded-xl bg-red-950/30 border border-red-500/30">
            <span className="text-slate-300 font-bold block">Onset:</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOnset('sudden')}
                className={`flex-1 py-2 rounded-lg font-bold border transition-all ${
                  onset === 'sudden' ? 'bg-red-600 text-white border-white' : 'bg-black/50 text-slate-300 border-white/10'
                }`}
              >
                Sudden (&lt; 30 min)
              </button>
              <button
                type="button"
                onClick={() => setOnset('gradual')}
                className={`flex-1 py-2 rounded-lg font-bold border transition-all ${
                  onset === 'gradual' ? 'bg-red-600 text-white border-white' : 'bg-black/50 text-slate-300 border-white/10'
                }`}
              >
                Gradual Drift
              </button>
            </div>
          </div>

          {/* Pain Character */}
          <div className="space-y-1.5 p-3 rounded-xl bg-red-950/30 border border-red-500/30">
            <span className="text-slate-300 font-bold block">Pain Character:</span>
            <div className="grid grid-cols-3 gap-1.5">
              {(['pressure', 'sharp', 'tearing'] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCharacter(c)}
                  className={`py-2 rounded-lg font-bold uppercase text-[11px] border transition-all ${
                    character === c ? 'bg-red-600 text-white border-white shadow' : 'bg-black/50 text-slate-300 border-white/10'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Radiation */}
          <div className="space-y-1.5 p-3 rounded-xl bg-red-950/30 border border-red-500/30 md:col-span-2">
            <span className="text-slate-300 font-bold block">Radiation of Discomfort:</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: 'Left Arm / Shoulder', state: radArm, set: setRadArm },
                { label: 'Jaw / Throat', state: radJaw, set: setRadJaw },
                { label: 'Neck', state: radNeck, set: setRadNeck },
                { label: 'Back (Interscapular)', state: radBack, set: setRadBack },
              ].map((r) => (
                <button
                  key={r.label}
                  type="button"
                  onClick={() => r.set(!r.state)}
                  className={`py-2 px-3 rounded-lg font-bold border text-xs transition-all flex items-center justify-between ${
                    r.state ? 'bg-red-600 text-white border-white' : 'bg-black/50 text-slate-400 border-white/10'
                  }`}
                >
                  <span>{r.label}</span>
                  <span>{r.state ? '✓' : '+'}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Associated Symptoms */}
          <div className="space-y-1.5 p-3 rounded-xl bg-red-950/30 border border-red-500/30">
            <span className="text-slate-300 font-bold block">Associated Symptoms:</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShortnessOfBreath(!shortnessOfBreath)}
                className={`flex-1 py-2 px-2.5 rounded-lg font-bold border text-xs transition-all ${
                  shortnessOfBreath ? 'bg-red-600 text-white border-white' : 'bg-black/50 text-slate-400 border-white/10'
                }`}
              >
                Dyspnea / Breathless: {shortnessOfBreath ? 'YES' : 'NO'}
              </button>
              <button
                type="button"
                onClick={() => setSweating(!sweating)}
                className={`flex-1 py-2 px-2.5 rounded-lg font-bold border text-xs transition-all ${
                  sweating ? 'bg-red-600 text-white border-white' : 'bg-black/50 text-slate-400 border-white/10'
                }`}
              >
                Diaphoresis / Sweats: {sweating ? 'YES' : 'NO'}
              </button>
            </div>
          </div>

          {/* Space Flight Specific Hazards */}
          <div className="space-y-1.5 p-3 rounded-xl bg-red-950/30 border border-red-500/30">
            <span className="text-amber-300 font-bold block">Space Hazards &amp; Trauma:</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRecentEva(!recentEva)}
                className={`flex-1 py-2 px-2.5 rounded-lg font-bold border text-xs transition-all ${
                  recentEva ? 'bg-amber-600 text-white border-white' : 'bg-black/50 text-slate-400 border-white/10'
                }`}
              >
                Recent EVA / Suit Drop: {recentEva ? 'YES (DCS)' : 'NO'}
              </button>
              <button
                type="button"
                onClick={() => setRecentTrauma(!recentTrauma)}
                className={`flex-1 py-2 px-2.5 rounded-lg font-bold border text-xs transition-all ${
                  recentTrauma ? 'bg-amber-600 text-white border-white' : 'bg-black/50 text-slate-400 border-white/10'
                }`}
              >
                Recent Trauma / Impact: {recentTrauma ? 'YES' : 'NO'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Vitals Capture & Baseline Comparison (§7.11) */}
      <div className="p-5 sm:p-6 rounded-3xl bg-black/80 border-2 border-red-500/40 space-y-4">
        <div className="flex items-center justify-between border-b border-red-500/30 pb-2">
          <span className="text-xs font-mono uppercase text-red-300 font-black">
            2. Prompt For Vitals (Save directly to {patient.name} record)
          </span>
          <span className="text-[11px] font-mono text-emerald-400">
            {vitalsSaved ? '✓ Recorded to IndexedDB' : 'Pending Save'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Heart Rate */}
          <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/30 space-y-2">
            <label className="text-[11px] font-mono uppercase text-red-300 font-bold flex items-center justify-between">
              <span>Heart Rate (bpm)</span>
              <Heart size={14} className="text-rose-400" />
            </label>
            <input
              type="number"
              value={hrInput}
              onChange={(e) => {
                setHrInput(e.target.value);
                setVitalsSaved(false);
              }}
              data-testid="emergency-hr-input"
              className="w-full text-2xl font-black font-mono bg-black/70 border border-red-400/50 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-red-400"
              placeholder="e.g. 118"
            />
            <div className="text-[10px] font-mono text-slate-300">
              {hrEval.comparison}
            </div>
          </div>

          {/* Blood Pressure */}
          <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/30 space-y-2">
            <label className="text-[11px] font-mono uppercase text-cyan-300 font-bold flex items-center justify-between">
              <span>Blood Pressure (mmHg)</span>
              <Activity size={14} className="text-cyan-400" />
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={sysInput}
                onChange={(e) => {
                  setSysInput(e.target.value);
                  setVitalsSaved(false);
                }}
                data-testid="emergency-sys-input"
                className="w-1/2 text-2xl font-black font-mono bg-black/70 border border-red-400/50 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-red-400"
                placeholder="142"
              />
              <span className="text-slate-400 font-mono text-lg font-bold">/</span>
              <input
                type="number"
                value={diaInput}
                onChange={(e) => {
                  setDiaInput(e.target.value);
                  setVitalsSaved(false);
                }}
                data-testid="emergency-dia-input"
                className="w-1/2 text-2xl font-black font-mono bg-black/70 border border-red-400/50 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-red-400"
                placeholder="92"
              />
            </div>
            <div className="text-[10px] font-mono text-slate-300">
              {bpEval.comparison}
            </div>
          </div>

          {/* SpO2 */}
          <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/30 space-y-2">
            <label className="text-[11px] font-mono uppercase text-emerald-300 font-bold flex items-center justify-between">
              <span>SpO₂ Pulse Ox (%)</span>
              <span className="text-[10px] text-emerald-400 font-mono font-bold">O₂</span>
            </label>
            <input
              type="number"
              value={spo2Input}
              onChange={(e) => {
                setSpo2Input(e.target.value);
                setVitalsSaved(false);
              }}
              data-testid="emergency-spo2-input"
              className="w-full text-2xl font-black font-mono bg-black/70 border border-red-400/50 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-red-400"
              placeholder="e.g. 91"
            />
            <div className="text-[10px] font-mono text-slate-300">
              {spo2Eval.comparison}
            </div>
          </div>
        </div>

        {/* Save Vitals Button (Min 56px) */}
        <button
          type="button"
          onClick={handleSaveVitals}
          data-testid="save-emergency-vitals-btn"
          className="w-full h-[56px] min-h-[56px] rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-mono font-black text-sm flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(239,68,68,0.5)] border border-red-300 cursor-pointer glove-target"
        >
          <Save size={18} />
          <span>SAVE VITALS TO {patient.name.toUpperCase()} MEDICAL RECORD</span>
        </button>
      </div>

      {/* Red-Flag Assessment & Emergency Actions Card (§7.11) */}
      <div className="p-5 sm:p-6 rounded-3xl bg-black/90 border-2 border-red-500 shadow-2xl space-y-4">
        <div className="flex items-center gap-2.5">
          <AlertOctagon size={22} className="text-red-400 animate-pulse" />
          <h4 className="text-base sm:text-lg font-black text-white uppercase font-mono tracking-wide">
            {evaluation.isCardiacRisk
              ? 'Possible Cardiac / Acute Coronary Emergency'
              : evaluation.isDcsRisk
              ? 'Suspected Decompression Sickness (Chokes / DCS)'
              : 'Thoracic Discomfort Assessment'}
          </h4>
        </div>

        {/* Active Red Flags */}
        <div className="space-y-1.5" data-testid="emergency-red-flags-list">
          {evaluation.redFlags.map((flag, idx) => (
            <div
              key={idx}
              className="p-3 rounded-xl bg-red-950/60 border border-red-500/50 text-xs sm:text-sm text-red-100 font-mono flex items-start gap-2.5"
            >
              <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
              <span>{flag}</span>
            </div>
          ))}
        </div>

        {/* Action Checklist per §7.11 (No hardcoded drugs!) */}
        <div className="space-y-2 pt-2 border-t border-red-500/30">
          <span className="text-xs font-mono uppercase text-red-300 font-bold block">
            Emergency Medical Action Protocol:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
            {/* Action 1: Oxygen */}
            <button
              type="button"
              onClick={() => {
                const next = !oxygenDelivered;
                setOxygenDelivered(next);
                onLogStep(`Supplemental oxygen ${next ? 'administered' : 'stopped'}.`);
              }}
              className={`p-3.5 rounded-xl border-2 flex items-center justify-between text-left transition-all glove-target cursor-pointer ${
                oxygenDelivered
                  ? 'bg-emerald-950/70 border-emerald-400 text-emerald-200'
                  : evaluation.isOxygenRequired
                  ? 'bg-red-950/80 border-red-400 text-red-100 shadow-[0_0_20px_rgba(239,68,68,0.5)]'
                  : 'bg-black/60 border-white/10 text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Wind size={20} className={oxygenDelivered ? 'text-emerald-400' : 'text-red-400'} />
                <div>
                  <strong className="block text-white">Supplemental Oxygen</strong>
                  <span>{evaluation.isOxygenRequired ? 'REQUIRED (SpO₂ < 90% or dyspnea)' : 'Keep mask ready'}</span>
                </div>
              </div>
              <span>{oxygenDelivered ? '✓ ON' : 'START'}</span>
            </button>

            {/* Action 2: AED Preparation */}
            <button
              type="button"
              onClick={() => {
                const next = !aedPrepared;
                setAedPrepared(next);
                onLogStep(`Automated External Defibrillator (AED) ${next ? 'staged and pads prepared' : 'standby'}.`);
              }}
              className={`p-3.5 rounded-xl border-2 flex items-center justify-between text-left transition-all glove-target cursor-pointer ${
                aedPrepared
                  ? 'bg-emerald-950/70 border-emerald-400 text-emerald-200'
                  : 'bg-red-950/80 border-amber-400 text-amber-100 shadow-[0_0_20px_rgba(245,158,11,0.5)]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Zap size={20} className={aedPrepared ? 'text-emerald-400' : 'text-amber-400'} />
                <div>
                  <strong className="block text-white">Prepare Onboard AED</strong>
                  <span>Place pads nearby for immediate rhythm check</span>
                </div>
              </div>
              <span>{aedPrepared ? '✓ READY' : 'PREPARE'}</span>
            </button>
          </div>

          <div className="p-3.5 rounded-xl bg-black/60 border border-white/10 text-xs text-slate-200 space-y-1 font-mono">
            <div className="font-bold text-amber-300">Mandatory Flight-Surgeon Directive:</div>
            <p>
              Follow onboard medical checklist and emergency medications strictly per flight-surgeon protocol. Keep patient at absolute physical rest and notify Ground Link with high-priority downlink packet.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
