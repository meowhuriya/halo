import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  UserPlus, 
  Rocket, 
  Sparkles, 
  Globe, 
  Clock, 
  Activity, 
  CheckCircle, 
  Info,
  Radio,
  Play
} from 'lucide-react';
import { db } from '../../data/db';
import { useMission } from '../../app/MissionContext';
import { useJudgeTour } from '../judge/JudgeContext';
import { ENVIRONMENTS, formatCommDelay, type EnvironmentId } from '../../config/environments';
import { GlassCard } from '../../design/components/GlassCard';
import { BigButton } from '../../design/components/BigButton';

export const OnboardingView: React.FC = () => {
  const navigate = useNavigate();
  const { refreshMission, loadDemo, crew: existingCrew, config: existingConfig } = useMission();
  const { startTour } = useJudgeTour();

  // Form states
  const [name, setName] = useState(existingCrew?.name || 'Dr. Alex Vance');
  const [callSign, setCallSign] = useState(existingCrew?.callSign || 'AEGIS');
  const [age, setAge] = useState(existingCrew?.age || 38);
  const [sex, setSex] = useState<'M' | 'F' | 'Other'>(existingCrew?.sex || 'M');
  const [role, setRole] = useState(existingCrew?.role || 'Crew Medical Officer / Flight Surgeon');
  const [isCmo, setIsCmo] = useState(existingCrew?.isCmo ?? true);

  const [selectedEnv, setSelectedEnv] = useState<EnvironmentId>(
    existingConfig?.environmentId || 'transit'
  );

  const [startDate, setStartDate] = useState(
    existingConfig?.missionStartDate || new Date().toISOString().split('T')[0]
  );

  const envConfig = ENVIRONMENTS[selectedEnv];
  const [commDelay, setCommDelay] = useState<number>(
    existingConfig?.oneWayDelaySeconds ?? envConfig.defaultDelaySeconds
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);

  // Compute calculated mission day
  const calculateMissionDay = (dateStr: string) => {
    const start = new Date(dateStr).getTime();
    const now = Date.now();
    return Math.max(1, Math.floor((now - start) / (1000 * 60 * 60 * 24)) + 1);
  };

  const calculatedDay = calculateMissionDay(startDate);

  const handleEnvSelect = (envId: EnvironmentId) => {
    setSelectedEnv(envId);
    setCommDelay(ENVIRONMENTS[envId].defaultDelaySeconds);
  };

  const handleSaveAndStart = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const now = Date.now();

      // Clear or update crew member
      let crewId: number;
      if (existingCrew?.id) {
        await db.crewMembers.update(existingCrew.id, {
          name,
          callSign: callSign.toUpperCase(),
          age: Number(age),
          sex,
          role,
          isCmo,
          isCurrent: true,
        });
        crewId = existingCrew.id;
      } else {
        crewId = (await db.crewMembers.add({
          name,
          callSign: callSign.toUpperCase(),
          age: Number(age),
          sex,
          role,
          isCmo,
          isCurrent: true,
          createdAt: now,
        })) as number;
      }

      // Save mission configuration
      await db.missionConfig.put({
        id: 'current',
        missionName: `${ENVIRONMENTS[selectedEnv].name} Expedition`,
        environmentId: selectedEnv,
        oneWayDelaySeconds: commDelay,
        missionStartDate: startDate,
        missionDay: calculatedDay,
        timeCompression: true,
        dosimeterDoseMsv: 0,
        updatedAt: now,
      });

      // Initialize default tasks if none exist
      const taskCount = await db.tasks.count();
      if (taskCount === 0) {
        await db.tasks.bulkAdd([
          {
            crewMemberId: crewId,
            taskType: 'camera_hr',
            title: 'Daily Contactless Heart Rate Scan',
            frequency: 'daily',
            dueDay: calculatedDay,
            status: 'pending',
            xpAwarded: 50,
          },
          {
            crewMemberId: crewId,
            taskType: 'mood_sleep',
            title: 'Morning Sleep & Psychological Well-being Check',
            frequency: 'daily',
            dueDay: calculatedDay,
            status: 'pending',
            xpAwarded: 30,
          },
          {
            crewMemberId: crewId,
            taskType: 'pvt',
            title: 'Psychomotor Vigilance Test (PVT-B)',
            frequency: 'daily',
            dueDay: calculatedDay,
            status: 'pending',
            xpAwarded: 75,
          },
        ]);
      }

      await refreshMission();
      navigate('/');
    } catch (err) {
      console.error('Failed to initialize mission profile:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLoadDemo = async () => {
    setLoadingDemo(true);
    try {
      await loadDemo();
      navigate('/');
    } catch (err) {
      console.error('Failed to load demo:', err);
    } finally {
      setLoadingDemo(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in py-4">
      
      {/* Top Banner & Quick Demo Loader */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-br from-cyan-950/40 via-white/[0.03] to-blue-950/30 border border-cyan-500/30 shadow-[0_0_30px_-5px_rgba(115, 179, 231,0.15)]">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs font-mono font-semibold uppercase tracking-wider mb-2">
            <Rocket size={13} />
            Autonomous Deep-Space Health System
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Astronaut Onboarding &amp; Mission Config
          </h1>
          <p className="text-sm text-slate-300 mt-1">
            Configure your crew biometric profile, gravitational environment, and speed-of-light telemetry delay.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
          <BigButton
            variant="primary"
            size="md"
            icon={<Play size={16} className="text-slate-950 fill-slate-950" />}
            onClick={() => void startTour()}
            data-testid="onboarding-watch-judge-tour-btn"
            className="shadow-[0_0_20px_rgba(115, 179, 231,0.4)]"
          >
            ▶ Watch HALO save a crew (90 s)
          </BigButton>

          <BigButton
            variant="secondary"
            size="md"
            icon={<Sparkles size={17} className="text-cyan-400" />}
            onClick={handleLoadDemo}
            disabled={loadingDemo}
            data-testid="onboarding-load-demo-btn"
          >
            {loadingDemo ? 'Loading...' : 'Load Demo Mission'}
          </BigButton>
        </div>
      </div>

      <form onSubmit={handleSaveAndStart} className="space-y-8">
        
        {/* Step 1: Astronaut Identity */}
        <GlassCard variant="default" padded="lg">
          <div className="flex items-center gap-3 pb-4 border-b border-white/10 mb-6">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center text-cyan-300 font-mono">
              <UserPlus size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide">
                1. Astronaut Biometric Profile
              </h2>
              <p className="text-xs text-slate-400">
                Used to personalize medical ranges, baseline calculations, and flight surgeon logs.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/15 focus:border-cyan-400 focus:outline-none text-white text-sm"
                placeholder="e.g. Dr. Alex Vance"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                Call Sign
              </label>
              <input
                type="text"
                required
                value={callSign}
                onChange={(e) => setCallSign(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/15 focus:border-cyan-400 focus:outline-none text-white font-mono text-sm uppercase tracking-wider"
                placeholder="e.g. AEGIS"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                Age
              </label>
              <input
                type="number"
                min={20}
                max={75}
                required
                value={age}
                onChange={(e) => setAge(Number(e.target.value))}
                className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/15 focus:border-cyan-400 focus:outline-none text-white font-mono text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                Biological Sex
              </label>
              <select
                value={sex}
                onChange={(e) => setSex(e.target.value as 'M' | 'F' | 'Other')}
                className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/15 focus:border-cyan-400 focus:outline-none text-white text-sm"
              >
                <option value="M">Male (M)</option>
                <option value="F">Female (F)</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                Mission Role
              </label>
              <input
                type="text"
                required
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/15 focus:border-cyan-400 focus:outline-none text-white text-sm"
                placeholder="e.g. Flight Surgeon / Commander"
              />
            </div>
          </div>

          {/* CMO Toggle */}
          <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="isCmo"
                checked={isCmo}
                onChange={(e) => setIsCmo(e.target.checked)}
                className="w-5 h-5 rounded accent-cyan-400 cursor-pointer"
              />
              <label htmlFor="isCmo" className="text-sm font-semibold text-slate-200 cursor-pointer">
                Designated Crew Medical Officer (CMO)
              </label>
            </div>
            <span className="text-xs text-slate-400 hidden sm:inline">
              Grants clinical protocol override authority during communication blackouts
            </span>
          </div>
        </GlassCard>

        {/* Step 2: Environment Selection */}
        <GlassCard variant="default" padded="lg">
          <div className="flex items-center gap-3 pb-4 border-b border-white/10 mb-6">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center text-cyan-300 font-mono">
              <Globe size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide">
                2. Mission Operational Environment
              </h2>
              <p className="text-xs text-slate-400">
                Determines gravitational physiology checks, radiation accumulation rate, and equipment availability.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(Object.keys(ENVIRONMENTS) as EnvironmentId[]).map((envId) => {
              const env = ENVIRONMENTS[envId];
              const isSelected = selectedEnv === envId;
              return (
                <div
                  key={envId}
                  onClick={() => handleEnvSelect(envId)}
                  className={`p-5 rounded-2xl border cursor-pointer transition-all duration-200 relative ${
                    isSelected
                      ? 'bg-cyan-500/15 border-cyan-400 shadow-[0_0_25px_-5px_rgba(115, 179, 231,0.4)]'
                      : 'bg-white/[0.03] border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-white text-base">{env.name}</span>
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-white/10 text-cyan-300">
                      {env.gravityG}g
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 line-clamp-2 mb-3">
                    {env.description}
                  </p>

                  <div className="space-y-1 text-[11px] font-mono border-t border-white/10 pt-2 text-slate-400">
                    <div>Radiation: <span className="text-slate-200">{env.radiationDoseRatePerDay} mSv/d</span> (approx.)</div>
                    <div>Comms: <span className="text-cyan-300">{env.isVariableDelay ? '3–22 min variable' : `${env.defaultDelaySeconds}s`}</span></div>
                  </div>

                  {isSelected && (
                    <div className="absolute top-3 right-3 text-cyan-400">
                      <CheckCircle size={18} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Comm Delay Slider if variable */}
          {envConfig.isVariableDelay && (
            <div className="mt-6 p-5 rounded-2xl bg-black/40 border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Radio size={16} className="text-cyan-400 animate-pulse" />
                  <span className="text-sm font-semibold text-white">One-Way Earth Latency Delay</span>
                </div>
                <span className="font-mono text-base font-bold text-cyan-300 tabular-nums">
                  {formatCommDelay(commDelay)}
                </span>
              </div>
              <input
                type="range"
                min={envConfig.minDelaySeconds ?? 180}
                max={envConfig.maxDelaySeconds ?? 1320}
                step={15}
                value={commDelay}
                onChange={(e) => setCommDelay(Number(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
              />
              <div className="flex justify-between text-[11px] font-mono text-slate-400">
                <span>3 min (Conjunction)</span>
                <span>14 min (Ares Day 142)</span>
                <span>22 min (Opposition)</span>
              </div>
            </div>
          )}
        </GlassCard>

        {/* Step 3: Mission Date & Baseline Layer Explanation */}
        <GlassCard variant="default" padded="lg">
          <div className="flex items-center gap-3 pb-4 border-b border-white/10 mb-6">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center text-cyan-300 font-mono">
              <Clock size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide">
                3. Mission Elapsed Time &amp; Baseline Layer
              </h2>
              <p className="text-xs text-slate-400">
                Configures mission day calculations and baseline variance detection.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                Mission Launch Date
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/15 focus:border-cyan-400 focus:outline-none text-white font-mono text-sm"
              />
              <div className="text-xs text-slate-400 mt-2 font-mono">
                Calculated Elapsed Time: <span className="text-cyan-300 font-bold">MET Day {calculatedDay}</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-cyan-300 uppercase tracking-wider">
                <Activity size={14} />
                Personal Baseline Layer (§6)
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                HALO uses your first 5 readings per indicator (or pre-flight checks) to compute your statistical baseline (mean ± SD). Any reading with <code className="text-cyan-300 font-mono">|z| ≥ 2</code> triggers an explainable WATCH flag: <em>"unusual for you"</em>, catching health drift before clinical emergency.
              </p>
            </div>
          </div>
        </GlassCard>

        {/* Submit Button */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <Info size={14} className="text-cyan-400 shrink-0" />
            <span>Settings persist offline in browser IndexedDB (Dexie). No cloud sync required.</span>
          </div>

          <BigButton
            type="submit"
            variant="primary"
            size="lg"
            disabled={isSubmitting}
            className="w-full sm:w-auto min-w-[260px]"
          >
            {isSubmitting ? 'Initializing Mission...' : 'INITIALIZE MISSION & ENTER BRIDGE →'}
          </BigButton>
        </div>

      </form>
    </div>
  );
};
