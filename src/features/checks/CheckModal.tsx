import React, { useState, useEffect } from 'react';
import { 
  X, 
  ArrowLeft, 
  CheckCircle2, 
  HelpCircle, 
  Sparkles, 
  Send
} from 'lucide-react';
import { StatusBadge } from '../../design/components/StatusBadge';
import { useMission } from '../../app/MissionContext';
import { db, type HealthReading, type PersonalBaseline } from '../../data/db';
import { evaluateReading, type ComprehensiveEvaluation } from '../../engine/rules';
import { CHECK_DEFINITIONS, type CheckFlowId } from './types';
import { CheckIllustration } from './CheckIllustration';
import { RespiratoryTapCounter } from './RespiratoryTapCounter';

interface CheckModalProps {
  flowId: CheckFlowId;
  onClose: () => void;
  onSaved?: () => void;
}

type ModalStep = 'guide' | 'input' | 'result';

export const CheckModal: React.FC<CheckModalProps> = ({ flowId, onClose, onSaved }) => {
  const { crew, config, environment, refreshMission } = useMission();
  const def = CHECK_DEFINITIONS[flowId];

  const [step, setStep] = useState<ModalStep>('guide');
  const [baseline, setBaseline] = useState<PersonalBaseline | null>(null);
  const [recentReadings, setRecentReadings] = useState<HealthReading[]>([]);
  const [evaluation, setEvaluation] = useState<ComprehensiveEvaluation | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form Inputs State
  // 1. BP
  const [sysInput, setSysInput] = useState<string>('120');
  const [diaInput, setDiaInput] = useState<string>('80');
  // 2. SpO2
  const [spo2Input, setSpo2Input] = useState<string>('98');
  // 3. Temp
  const [tempInput, setTempInput] = useState<string>('36.8');
  // 4. Glucose
  const [glucoseInput, setGlucoseInput] = useState<string>('95');
  const [isPostMeal, setIsPostMeal] = useState<boolean>(false);
  // 5. Heart Rate
  const [hrInput, setHrInput] = useState<string>('68');
  // 6. Resp
  const [respInput, setRespInput] = useState<string>('16');
  // 7. Sleep
  const [sleepHoursInput, setSleepHoursInput] = useState<string>('7.5');
  const [sleepQuality, setSleepQuality] = useState<number>(4);
  // 8. Mood
  const [moodRating, setMoodRating] = useState<number>(4);
  const [energyRating, setEnergyRating] = useState<number>(4);
  const [stressRating, setStressRating] = useState<number>(2);
  const [lonelinessRating, setLonelinessRating] = useState<number>(1);
  const [moodNotes, setMoodNotes] = useState<string>('');
  // 9. PHQ-2 & GAD-2
  const [phqQ1, setPhqQ1] = useState<number>(0);
  const [phqQ2, setPhqQ2] = useState<number>(0);
  const [selfHarm, setSelfHarm] = useState<boolean>(false);
  const [gadQ1, setGadQ1] = useState<number>(0);
  const [gadQ2, setGadQ2] = useState<number>(0);
  // 10. Exercise
  const [resistanceMin, setResistanceMin] = useState<string>('60');
  const [aerobicMin, setAerobicMin] = useState<string>('60');
  const [rpeRating, setRpeRating] = useState<number>(7);

  // Load baseline & recent history from DB
  useEffect(() => {
    async function loadData() {
      if (!crew?.id) return;

      const indicatorMap: Record<CheckFlowId, string> = {
        bp: 'systolic_bp',
        spo2: 'spo2',
        temperature: 'temperature',
        glucose: 'glucose',
        heart_rate: 'heart_rate',
        respiratory: 'respiratory_rate',
        sleep: 'sleep',
        mood: 'mood',
        phq2_gad2: 'phq2',
        exercise: 'exercise',
      };

      const indName = indicatorMap[flowId];
      if (indName) {
        const bl = await db.baselines
          .where({ crewMemberId: crew.id, indicator: indName })
          .first();
        if (bl) setBaseline(bl);

        const recents = await db.healthReadings
          .where('crewMemberId')
          .equals(crew.id)
          .filter((r) => r.indicator === indName || r.indicator === flowId)
          .sortBy('timestamp');
        setRecentReadings(recents);
      }
    }
    loadData();
  }, [crew?.id, flowId]);

  // Sane-range validation and evaluation
  const handleEvaluate = () => {
    setErrorMessage(null);

    let val = 0;
    let evalIndicator = flowId as string;
    const options: Parameters<typeof evaluateReading>[0]['options'] = {};

    switch (flowId) {
      case 'bp': {
        const sys = parseFloat(sysInput);
        const dia = parseFloat(diaInput);
        if (isNaN(sys) || isNaN(dia)) {
          setErrorMessage('Please enter numeric values for Systolic and Diastolic pressure.');
          return;
        }
        if (sys < 50 || sys > 260) {
          setErrorMessage('Systolic pressure outside sane medical range (50–260 mmHg).');
          return;
        }
        if (dia < 30 || dia > 160) {
          setErrorMessage('Diastolic pressure outside sane medical range (30–160 mmHg).');
          return;
        }
        if (sys <= dia) {
          setErrorMessage('Systolic pressure must be greater than diastolic pressure.');
          return;
        }
        val = sys;
        evalIndicator = 'blood_pressure';
        options.dia = dia;
        break;
      }

      case 'spo2': {
        const spo2 = parseFloat(spo2Input);
        if (isNaN(spo2) || spo2 < 50 || spo2 > 100) {
          setErrorMessage('SpO₂ outside sane clinical range (50–100%).');
          return;
        }
        val = spo2;
        evalIndicator = 'spo2';
        break;
      }

      case 'temperature': {
        const temp = parseFloat(tempInput);
        if (isNaN(temp) || temp < 32.0 || temp > 43.0) {
          setErrorMessage('Body temperature outside sane clinical range (32.0–43.0 °C).');
          return;
        }
        val = temp;
        evalIndicator = 'temperature';
        break;
      }

      case 'glucose': {
        const g = parseFloat(glucoseInput);
        if (isNaN(g) || g < 20 || g > 500) {
          setErrorMessage('Blood glucose outside sane clinical range (20–500 mg/dL).');
          return;
        }
        val = g;
        evalIndicator = 'glucose';
        options.isPostMeal = isPostMeal;
        break;
      }

      case 'heart_rate': {
        const hr = parseFloat(hrInput);
        if (isNaN(hr) || hr < 20 || hr > 250) {
          setErrorMessage('Heart rate outside sane clinical range (20–250 bpm).');
          return;
        }
        val = hr;
        evalIndicator = 'heart_rate';
        break;
      }

      case 'respiratory': {
        const r = parseFloat(respInput);
        if (isNaN(r) || r < 4 || r > 60) {
          setErrorMessage('Respiratory rate outside sane clinical range (4–60 breaths/min).');
          return;
        }
        val = r;
        evalIndicator = 'respiratory_rate';
        break;
      }

      case 'sleep': {
        const s = parseFloat(sleepHoursInput);
        if (isNaN(s) || s < 0 || s > 24) {
          setErrorMessage('Sleep duration outside sane range (0–24 hours).');
          return;
        }
        val = s;
        evalIndicator = 'sleep';
        // Compute consecutive days under 6 / 4 from recent readings
        const pastSleeps = recentReadings
          .map((r) => (typeof r.value === 'number' ? r.value : parseFloat(`${r.value}`)))
          .filter((n) => !isNaN(n));
        const lastDays = [...pastSleeps, s];
        let under6Count = 0;
        for (let i = lastDays.length - 1; i >= 0; i--) {
          if (lastDays[i] < 6.0) under6Count++;
          else break;
        }
        let under4Count = 0;
        for (let i = lastDays.length - 1; i >= 0; i--) {
          if (lastDays[i] < 4.0) under4Count++;
          else break;
        }
        options.consecutiveDaysUnder6 = under6Count;
        options.consecutiveDaysUnder4 = under4Count;
        break;
      }

      case 'mood': {
        val = moodRating;
        evalIndicator = 'mood';
        options.notes = moodNotes;
        break;
      }

      case 'phq2_gad2': {
        const phqTotal = phqQ1 + phqQ2;
        val = phqTotal;
        evalIndicator = 'phq2';
        break;
      }

      case 'exercise': {
        const res = parseFloat(resistanceMin);
        const aero = parseFloat(aerobicMin);
        if (isNaN(res) || res < 0 || res > 300 || isNaN(aero) || aero < 0 || aero > 300) {
          setErrorMessage('Exercise minutes outside sane range (0–300 minutes).');
          return;
        }
        val = res + aero;
        evalIndicator = 'exercise';
        break;
      }
    }

    // Prepare recent values and history for 7-day trend
    const recentNumeric = recentReadings
      .map((r) => (typeof r.value === 'number' ? r.value : parseFloat(`${r.value}`)))
      .filter((n) => !isNaN(n));
    recentNumeric.push(val);

    const recentHistory = recentReadings.map((r, i) => ({
      day: r.missionDay || i + 1,
      value: typeof r.value === 'number' ? r.value : parseFloat(`${r.value}`) || val,
    }));
    recentHistory.push({ day: config?.missionDay || 1, value: val });

    const baselineProfile = baseline
      ? {
          indicator: baseline.indicator,
          mean: baseline.mean,
          sd: baseline.sd,
          effectiveSd: baseline.sd,
          sampleCount: baseline.sampleCount,
          source: 'nominal-flight' as const,
        }
      : null;

    const res = evaluateReading({
      indicator: evalIndicator,
      value: val,
      options,
      baseline: baselineProfile,
      recentValues: recentNumeric,
      recentHistory,
      gravityG: environment.gravityG,
      missionDay: config?.missionDay || 1,
    });

    // Special check for PHQ-2 self-harm screening
    if (flowId === 'phq2_gad2' && selfHarm) {
      res.status = 'CRITICAL';
      res.reasons.unshift(
        'Self-harm thoughts flagged on psychological screen: immediate private support recommended.'
      );
      res.guidance.immediateAction =
        'Support protocol active. Private direct voice/text channel to flight surgeon available.';
      res.guidance.cmoAlertRequired = true;
    }

    setEvaluation(res);
    setStep('result');
  };

  // Persist measurement to IndexedDB
  const handleSaveToLog = async () => {
    if (!evaluation || !crew?.id) return;

    let storedValue: number | string | Record<string, unknown> = evaluation.formattedValue;
    if (flowId === 'bp') {
      storedValue = { sys: parseFloat(sysInput), dia: parseFloat(diaInput) };
    } else if (flowId === 'sleep') {
      storedValue = parseFloat(sleepHoursInput);
    } else if (flowId === 'mood') {
      storedValue = {
        mood: moodRating,
        energy: energyRating,
        stress: stressRating,
        loneliness: lonelinessRating,
        notes: moodNotes,
      };
    } else if (flowId === 'phq2_gad2') {
      storedValue = {
        phq2: phqQ1 + phqQ2,
        gad2: gadQ1 + gadQ2,
        selfHarmFlagged: selfHarm,
      };
    } else if (flowId === 'exercise') {
      storedValue = {
        resistanceMinutes: parseFloat(resistanceMin),
        aerobicMinutes: parseFloat(aerobicMin),
        rpe: rpeRating,
      };
    } else {
      storedValue = parseFloat(evaluation.formattedValue);
      if (isNaN(storedValue as number)) {
        storedValue = evaluation.formattedValue;
      }
    }

    const reading: HealthReading = {
      crewMemberId: crew.id,
      timestamp: Date.now(),
      missionDay: config?.missionDay || 1,
      indicator: flowId as HealthReading['indicator'],
      value: storedValue,
      unit: def.unit,
      status: evaluation.status,
      reasons: evaluation.reasons,
      source: 'manual',
      quality: 'GOOD',
      notes: errorMessage || undefined,
    };

    await db.healthReadings.add(reading);

    // Update scheduled tasks
    const taskTypeMap: Record<CheckFlowId, string> = {
      bp: 'bp',
      spo2: 'mood_sleep',
      temperature: 'mood_sleep',
      glucose: 'glucose',
      heart_rate: 'camera_hr',
      respiratory: 'mood_sleep',
      sleep: 'mood_sleep',
      mood: 'mood_sleep',
      phq2_gad2: 'phq2_gad2',
      exercise: 'exercise',
    };

    const taskType = taskTypeMap[flowId];
    if (taskType) {
      await db.tasks
        .where({ crewMemberId: crew.id })
        .filter((t) => t.taskType === taskType && t.status !== 'completed')
        .modify({ status: 'completed', completedAt: Date.now() });
    }

    // If ALERT or CRITICAL, queue downlink packet per §7.12
    if (evaluation.status === 'ALERT' || evaluation.status === 'CRITICAL') {
      const delay = config?.oneWayDelaySeconds ?? 840;
      await db.groundPackets.add({
        direction: 'downlink',
        priority: evaluation.status === 'CRITICAL' ? 'HIGH' : 'NORMAL',
        type: 'ALERT',
        title: `${evaluation.status}: ${def.shortTitle} (${evaluation.formattedValue})`,
        payload: {
          crewName: crew.name,
          missionDay: config?.missionDay,
          indicator: flowId,
          value: storedValue,
          status: evaluation.status,
          reasons: evaluation.reasons,
        },
        sentAt: Date.now(),
        arrivalAt: Date.now() + delay * 1000,
        delivered: false,
        read: false,
      });
    }

    await refreshMission();
    setSaveSuccess(true);
    setTimeout(() => {
      if (onSaved) onSaved();
      onClose();
    }, 1200);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-[#080E1C] border border-cyan-500/30 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl shadow-cyan-950/80 overflow-y-auto max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold uppercase">
                {def.category}
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                +{def.xp} XP
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              {def.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 rounded-xl bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X size={20} />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-between text-xs font-mono text-slate-400 px-1">
          <button
            onClick={() => setStep('guide')}
            className={`flex items-center gap-1.5 transition-colors ${
              step === 'guide' ? 'text-cyan-400 font-bold' : 'hover:text-slate-200'
            }`}
          >
            <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] bg-white/10">1</span>
            <span>How to Measure</span>
          </button>
          <span>→</span>
          <button
            onClick={() => setStep('input')}
            className={`flex items-center gap-1.5 transition-colors ${
              step === 'input' ? 'text-cyan-400 font-bold' : 'hover:text-slate-200'
            }`}
          >
            <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] bg-white/10">2</span>
            <span>Input Reading</span>
          </button>
          <span>→</span>
          <div
            className={`flex items-center gap-1.5 ${
              step === 'result' ? 'text-cyan-400 font-bold' : 'opacity-40'
            }`}
          >
            <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] bg-white/10">3</span>
            <span>Instant Result</span>
          </div>
        </div>

        {/* STEP 1: How To Measure Card */}
        {step === 'guide' && (
          <div className="space-y-5 animate-fade-in">
            {/* SVG Illustration */}
            <div className="p-4 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-center">
              <CheckIllustration flowId={flowId} />
            </div>

            {/* Step-by-Step Instructions */}
            <div className="space-y-3">
              <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider block">
                Standardized Clinical Procedure:
              </span>
              <ol className="space-y-2 text-xs sm:text-sm text-slate-200">
                {def.guideSteps.map((s, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-cyan-500/10 text-cyan-400 font-mono text-xs flex items-center justify-center shrink-0 border border-cyan-500/20">
                      {idx + 1}
                    </span>
                    <span className="leading-relaxed">{s}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Why it Matters in Space */}
            <div className="p-4 rounded-2xl bg-cyan-950/20 border border-cyan-500/20 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-mono text-cyan-400 uppercase">
                <HelpCircle size={14} />
                <span>Why It Matters in Space</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed pt-1">
                {def.whyItMatters}
              </p>
            </div>

            {/* Navigation Button */}
            <button
              onClick={() => setStep('input')}
              className="w-full py-4 rounded-2xl bg-cyan-500 text-black font-extrabold text-sm uppercase tracking-wider hover:bg-cyan-400 transition-all shadow-lg shadow-cyan-500/20 min-h-[56px] flex items-center justify-center gap-2"
            >
              <span>Begin Measurement Entry</span>
              <span>→</span>
            </button>
          </div>
        )}

        {/* STEP 2: Input & Sane-Range Validation */}
        {step === 'input' && (
          <div className="space-y-5 animate-fade-in">
            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/40 text-red-200 text-xs font-medium animate-shake">
                ⚠️ {errorMessage}
              </div>
            )}

            {/* Dynamic Input based on flowId */}
            {flowId === 'bp' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-slate-300 uppercase">
                      Systolic (mmHg)
                    </label>
                    <input
                      type="number"
                      value={sysInput}
                      onChange={(e) => setSysInput(e.target.value)}
                      placeholder="120"
                      className="w-full px-4 py-3.5 rounded-xl bg-black/50 border border-white/10 text-xl font-mono text-white focus:outline-none focus:border-cyan-400 min-h-[56px]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-slate-300 uppercase">
                      Diastolic (mmHg)
                    </label>
                    <input
                      type="number"
                      value={diaInput}
                      onChange={(e) => setDiaInput(e.target.value)}
                      placeholder="80"
                      className="w-full px-4 py-3.5 rounded-xl bg-black/50 border border-white/10 text-xl font-mono text-white focus:outline-none focus:border-cyan-400 min-h-[56px]"
                    />
                  </div>
                </div>
                <p className="text-[11px] font-mono text-slate-400">
                  Sane Range: Systolic 50–260 mmHg, Diastolic 30–160 mmHg.
                </p>
              </div>
            )}

            {flowId === 'spo2' && (
              <div className="space-y-3">
                <label className="text-xs font-mono text-slate-300 uppercase">
                  SpO₂ Blood Oxygen (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={spo2Input}
                    onChange={(e) => setSpo2Input(e.target.value)}
                    placeholder="98"
                    className="w-full px-4 py-3.5 rounded-xl bg-black/50 border border-white/10 text-2xl font-mono text-white focus:outline-none focus:border-cyan-400 min-h-[56px]"
                  />
                  <span className="absolute right-4 top-4 text-base font-mono text-slate-400">%</span>
                </div>
                <p className="text-[11px] font-mono text-slate-400">
                  Sane Range: 50–100%. Clinical Nominal: ≥ 95%.
                </p>
              </div>
            )}

            {flowId === 'temperature' && (
              <div className="space-y-3">
                <label className="text-xs font-mono text-slate-300 uppercase">
                  Core Body Temperature (°C)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    value={tempInput}
                    onChange={(e) => setTempInput(e.target.value)}
                    placeholder="36.8"
                    className="w-full px-4 py-3.5 rounded-xl bg-black/50 border border-white/10 text-2xl font-mono text-white focus:outline-none focus:border-cyan-400 min-h-[56px]"
                  />
                  <span className="absolute right-4 top-4 text-base font-mono text-slate-400">°C</span>
                </div>
                <p className="text-[11px] font-mono text-slate-400">
                  Sane Range: 32.0–43.0 °C. Nominal: 36.1–37.2 °C.
                </p>
              </div>
            )}

            {flowId === 'glucose' && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300 uppercase">
                    Capillary Blood Glucose (mg/dL)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={glucoseInput}
                      onChange={(e) => setGlucoseInput(e.target.value)}
                      placeholder="95"
                      className="w-full px-4 py-3.5 rounded-xl bg-black/50 border border-white/10 text-2xl font-mono text-white focus:outline-none focus:border-cyan-400 min-h-[56px]"
                    />
                    <span className="absolute right-4 top-4 text-sm font-mono text-slate-400">mg/dL</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300 uppercase block">
                    Prandial State
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setIsPostMeal(false)}
                      className={`py-3 rounded-xl text-xs font-semibold font-mono transition-all min-h-[48px] ${
                        !isPostMeal
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400'
                          : 'bg-white/5 text-slate-400 border border-white/5 hover:text-white'
                      }`}
                    >
                      Fasting (≥ 8h)
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsPostMeal(true)}
                      className={`py-3 rounded-xl text-xs font-semibold font-mono transition-all min-h-[48px] ${
                        isPostMeal
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400'
                          : 'bg-white/5 text-slate-400 border border-white/5 hover:text-white'
                      }`}
                    >
                      Post-Meal (&lt; 2h)
                    </button>
                  </div>
                </div>
              </div>
            )}

            {flowId === 'heart_rate' && (
              <div className="space-y-3">
                <label className="text-xs font-mono text-slate-300 uppercase">
                  Resting Heart Rate (bpm)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={hrInput}
                    onChange={(e) => setHrInput(e.target.value)}
                    placeholder="68"
                    className="w-full px-4 py-3.5 rounded-xl bg-black/50 border border-white/10 text-2xl font-mono text-white focus:outline-none focus:border-cyan-400 min-h-[56px]"
                  />
                  <span className="absolute right-4 top-4 text-sm font-mono text-slate-400">bpm</span>
                </div>
                <p className="text-[11px] font-mono text-slate-400">
                  Sane Range: 20–250 bpm. Clinical Nominal: 50–100 bpm.
                </p>
              </div>
            )}

            {flowId === 'respiratory' && (
              <div className="space-y-4">
                <RespiratoryTapCounter
                  onComplete={(calculatedBpm) => {
                    setRespInput(`${calculatedBpm}`);
                  }}
                />

                <div className="space-y-1.5 pt-2">
                  <label className="text-xs font-mono text-slate-300 uppercase">
                    Or Enter Breaths/min Manually:
                  </label>
                  <input
                    type="number"
                    value={respInput}
                    onChange={(e) => setRespInput(e.target.value)}
                    placeholder="16"
                    className="w-full px-4 py-3 rounded-xl bg-black/50 border border-white/10 text-xl font-mono text-white focus:outline-none focus:border-cyan-400 min-h-[56px]"
                  />
                </div>
              </div>
            )}

            {flowId === 'sleep' && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300 uppercase">
                    Hours Slept in Past 24h
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      value={sleepHoursInput}
                      onChange={(e) => setSleepHoursInput(e.target.value)}
                      placeholder="7.5"
                      className="w-full px-4 py-3.5 rounded-xl bg-black/50 border border-white/10 text-2xl font-mono text-white focus:outline-none focus:border-cyan-400 min-h-[56px]"
                    />
                    <span className="absolute right-4 top-4 text-sm font-mono text-slate-400">hours</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300 uppercase block">
                    Sleep Quality Rating (1–5)
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setSleepQuality(star)}
                        className={`py-3 rounded-xl font-mono text-sm font-bold min-h-[48px] ${
                          sleepQuality === star
                            ? 'bg-cyan-500 text-black border border-cyan-400'
                            : 'bg-white/5 text-slate-400 border border-white/5 hover:text-white'
                        }`}
                      >
                        {star} ★
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {flowId === 'mood' && (
              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-300">Emotional Valence:</span>
                    <span className="text-cyan-400 font-bold">{moodRating} / 5</span>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {['😫', '😕', '😐', '🙂', '🚀'].map((emoji, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setMoodRating(idx + 1)}
                        className={`py-2 text-xl rounded-xl min-h-[48px] ${
                          moodRating === idx + 1
                            ? 'bg-cyan-500/20 border-2 border-cyan-400'
                            : 'bg-white/5 border border-white/5 hover:bg-white/10'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-300">Energy Level:</span>
                    <span className="text-cyan-400 font-bold">{energyRating} / 5</span>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5].map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setEnergyRating(lvl)}
                        className={`py-2 text-xs font-mono font-bold rounded-xl min-h-[44px] ${
                          energyRating === lvl
                            ? 'bg-cyan-500 text-black'
                            : 'bg-white/5 text-slate-300 border border-white/5'
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-300">Operational Stress:</span>
                    <span className="text-cyan-400 font-bold">{stressRating} / 5</span>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5].map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setStressRating(lvl)}
                        className={`py-2 text-xs font-mono font-bold rounded-xl min-h-[44px] ${
                          stressRating === lvl
                            ? 'bg-amber-500 text-black'
                            : 'bg-white/5 text-slate-300 border border-white/5'
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-300">Confinement / Loneliness:</span>
                    <span className="text-cyan-400 font-bold">{lonelinessRating} / 5</span>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5].map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setLonelinessRating(lvl)}
                        className={`py-2 text-xs font-mono font-bold rounded-xl min-h-[44px] ${
                          lonelinessRating === lvl
                            ? 'bg-purple-500 text-white'
                            : 'bg-white/5 text-slate-300 border border-white/5'
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300 uppercase">
                    Personal Log Note (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={moodNotes}
                    onChange={(e) => setMoodNotes(e.target.value)}
                    placeholder="Log reflections, cabin noise, tether comfort..."
                    className="w-full px-4 py-2.5 rounded-xl bg-black/50 border border-white/10 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>
            )}

            {flowId === 'phq2_gad2' && (
              <div className="space-y-5 text-xs sm:text-sm">
                <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-500/20 text-xs text-cyan-200">
                  Over the <strong>last 2 weeks</strong>, how often have you been bothered by the following problems?
                </div>

                {/* PHQ-2 Q1 */}
                <div className="space-y-2">
                  <span className="text-white font-medium block">
                    1. Little interest or pleasure in doing things:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {['Not at all (0)', 'Several days (1)', '> Half days (2)', 'Nearly every day (3)'].map((opt, val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setPhqQ1(val)}
                        className={`p-2.5 rounded-xl text-xs font-mono text-center min-h-[48px] ${
                          phqQ1 === val
                            ? 'bg-cyan-500 text-black font-bold'
                            : 'bg-white/5 text-slate-300 border border-white/5 hover:text-white'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* PHQ-2 Q2 */}
                <div className="space-y-2">
                  <span className="text-white font-medium block">
                    2. Feeling down, depressed, or hopeless:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {['Not at all (0)', 'Several days (1)', '> Half days (2)', 'Nearly every day (3)'].map((opt, val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setPhqQ2(val)}
                        className={`p-2.5 rounded-xl text-xs font-mono text-center min-h-[48px] ${
                          phqQ2 === val
                            ? 'bg-cyan-500 text-black font-bold'
                            : 'bg-white/5 text-slate-300 border border-white/5 hover:text-white'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* GAD-2 Q1 */}
                <div className="space-y-2 pt-2 border-t border-white/10">
                  <span className="text-white font-medium block">
                    3. Feeling nervous, anxious, or on edge:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {['Not at all (0)', 'Several days (1)', '> Half days (2)', 'Nearly every day (3)'].map((opt, val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setGadQ1(val)}
                        className={`p-2.5 rounded-xl text-xs font-mono text-center min-h-[48px] ${
                          gadQ1 === val
                            ? 'bg-cyan-500 text-black font-bold'
                            : 'bg-white/5 text-slate-300 border border-white/5 hover:text-white'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* GAD-2 Q2 */}
                <div className="space-y-2">
                  <span className="text-white font-medium block">
                    4. Not being able to stop or control worrying:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {['Not at all (0)', 'Several days (1)', '> Half days (2)', 'Nearly every day (3)'].map((opt, val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setGadQ2(val)}
                        className={`p-2.5 rounded-xl text-xs font-mono text-center min-h-[48px] ${
                          gadQ2 === val
                            ? 'bg-cyan-500 text-black font-bold'
                            : 'bg-white/5 text-slate-300 border border-white/5 hover:text-white'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Safety Prompt */}
                <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/30 space-y-2">
                  <span className="text-xs font-semibold text-amber-200 block">
                    Confidential Safety Screening:
                  </span>
                  <p className="text-xs text-slate-300">
                    Thoughts that you would be better off dead, or of hurting yourself in any way?
                  </p>
                  <div className="flex gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setSelfHarm(false)}
                      className={`px-4 py-2 rounded-xl text-xs font-mono min-h-[44px] ${
                        !selfHarm
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                          : 'bg-white/5 text-slate-400'
                      }`}
                    >
                      No
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelfHarm(true)}
                      className={`px-4 py-2 rounded-xl text-xs font-mono min-h-[44px] ${
                        selfHarm
                          ? 'bg-red-500/30 text-red-300 border border-red-500/60 font-bold'
                          : 'bg-white/5 text-slate-400'
                      }`}
                    >
                      Yes (Immediate Support)
                    </button>
                  </div>
                </div>
              </div>
            )}

            {flowId === 'exercise' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-slate-300 uppercase">
                      Resistance (ARED) Min
                    </label>
                    <input
                      type="number"
                      value={resistanceMin}
                      onChange={(e) => setResistanceMin(e.target.value)}
                      placeholder="60"
                      className="w-full px-4 py-3.5 rounded-xl bg-black/50 border border-white/10 text-xl font-mono text-white focus:outline-none focus:border-cyan-400 min-h-[56px]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-slate-300 uppercase">
                      Aerobic (T2) Min
                    </label>
                    <input
                      type="number"
                      value={aerobicMin}
                      onChange={(e) => setAerobicMin(e.target.value)}
                      placeholder="60"
                      className="w-full px-4 py-3.5 rounded-xl bg-black/50 border border-white/10 text-xl font-mono text-white focus:outline-none focus:border-cyan-400 min-h-[56px]"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-300">Perceived Exertion (RPE 1–10):</span>
                    <span className="text-cyan-400 font-bold">{rpeRating} / 10</span>
                  </div>
                  <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((rpe) => (
                      <button
                        key={rpe}
                        type="button"
                        onClick={() => setRpeRating(rpe)}
                        className={`py-2 text-xs font-mono font-bold rounded-lg min-h-[44px] ${
                          rpeRating === rpe
                            ? 'bg-cyan-500 text-black'
                            : 'bg-white/5 text-slate-300 border border-white/5'
                        }`}
                      >
                        {rpe}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep('guide')}
                className="px-5 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-mono uppercase tracking-wider min-h-[56px] flex items-center gap-1.5"
              >
                <ArrowLeft size={14} />
                <span>Guide</span>
              </button>

              <button
                type="button"
                onClick={handleEvaluate}
                className="flex-1 py-4 rounded-xl bg-cyan-500 text-black font-extrabold text-xs sm:text-sm uppercase tracking-wider hover:bg-cyan-400 transition-all shadow-lg shadow-cyan-500/20 min-h-[56px] flex items-center justify-center gap-2"
              >
                <span>Evaluate &amp; Review Result</span>
                <span>→</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Instant Result Card */}
        {step === 'result' && evaluation && (
          <div className="space-y-5 animate-fade-in">
            {/* Primary Status Banner */}
            <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
                  {def.title}
                </span>
                <StatusBadge status={evaluation.status} />
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-black font-mono text-white">
                  {evaluation.formattedValue}
                </span>
              </div>

              {/* Baseline comparison note */}
              {evaluation.baselineComparison && (
                <div className="text-xs font-mono text-slate-400 pt-1 border-t border-white/5">
                  Astronaut Baseline: {evaluation.baselineComparison.mean} ± {evaluation.baselineComparison.effectiveSd} (z-score: {evaluation.baselineComparison.zScore >= 0 ? `+${evaluation.baselineComparison.zScore}` : evaluation.baselineComparison.zScore})
                </div>
              )}
            </div>

            {/* Reasons List */}
            <div className="space-y-2">
              <span className="text-xs font-mono uppercase tracking-wider text-cyan-400 block">
                Clinical Rule Evaluation:
              </span>
              <div className="space-y-2">
                {evaluation.reasons.map((reason, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-xs sm:text-sm text-slate-200 leading-relaxed flex items-start gap-2.5"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 shrink-0" />
                    <span>{reason}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* What to do now */}
            <div className="p-4 rounded-2xl bg-cyan-950/20 border border-cyan-500/30 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-mono text-cyan-300 uppercase tracking-wider">
                <Sparkles size={14} />
                <span>What to do now</span>
              </div>
              <p className="text-xs text-white font-medium">
                {evaluation.guidance.immediateAction}
              </p>
              <ul className="space-y-1.5 pt-1 text-xs text-slate-300">
                {evaluation.guidance.recommendedSteps.map((stepStr, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-cyan-400 font-mono">▸</span>
                    <span>{stepStr}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Special Confidential Safety Channel for self-harm */}
            {selfHarm && (
              <div className="p-4 rounded-2xl bg-red-950/40 border border-red-500/40 space-y-2 text-xs">
                <div className="text-red-300 font-bold uppercase tracking-wider">
                  Private Earth Flight Surgeon Channel Available
                </div>
                <p className="text-slate-200">
                  Your psychological health and safety are paramount. A confidential 1-on-1 audio conference with mission behavioral health support is ready on request.
                </p>
                <button
                  type="button"
                  onClick={() => alert('Encrypted psychological conference request queued to Flight Surgeon.')}
                  className="px-4 py-2.5 rounded-xl bg-red-500 text-white font-bold text-xs uppercase min-h-[44px]"
                >
                  Initiate Private CMO / Surgeon Request
                </button>
              </div>
            )}

            {/* Buttons: Back / Save to Log */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep('input')}
                className="px-5 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-mono uppercase tracking-wider min-h-[56px] flex items-center gap-1.5"
              >
                <ArrowLeft size={14} />
                <span>Edit</span>
              </button>

              <button
                type="button"
                onClick={handleSaveToLog}
                disabled={saveSuccess}
                className={`flex-1 py-4 rounded-xl text-black font-extrabold text-xs sm:text-sm uppercase tracking-wider transition-all min-h-[56px] flex items-center justify-center gap-2 ${
                  saveSuccess
                    ? 'bg-emerald-400 shadow-lg shadow-emerald-500/30'
                    : 'bg-cyan-500 hover:bg-cyan-400 shadow-lg shadow-cyan-500/20'
                }`}
              >
                {saveSuccess ? (
                  <>
                    <CheckCircle2 size={18} />
                    <span>Logged to Mission DB!</span>
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    <span>Save to Health Record (+{def.xp} XP)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
