import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  ChevronDown, 
  Globe, 
  Radio, 
  User, 
  AlertTriangle,
  Info
} from 'lucide-react';
import { useMission } from '../MissionContext';
import { formatCommDelay, ENVIRONMENTS, type EnvironmentId } from '../../config/environments';
import { ReadinessRing } from '../../design/components/ReadinessRing';
import { GlassCard } from '../../design/components/GlassCard';
import { BigButton } from '../../design/components/BigButton';

export const TopBar: React.FC = () => {
  const { 
    crew, 
    config, 
    environment, 
    autonomyLevel, 
    readinessScore, 
    updateDelay, 
    setEnvironment 
  } = useMission();
  
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [delaySliderVal, setDelaySliderVal] = useState<number>(
    config?.oneWayDelaySeconds ?? environment.defaultDelaySeconds
  );

  const delayFormatted = formatCommDelay(config?.oneWayDelaySeconds ?? environment.defaultDelaySeconds);

  const handleDelayChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setDelaySliderVal(val);
    await updateDelay(val);
  };

  const handleEnvSelect = async (envId: EnvironmentId) => {
    await setEnvironment(envId);
    const newEnv = ENVIRONMENTS[envId];
    setDelaySliderVal(newEnv.defaultDelaySeconds);
  };

  // Autonomy badge styling
  const autonomyBadgeColor = {
    'Ground-supported': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    'Delayed support': 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    'Autonomous': 'bg-orange-500/15 text-orange-400 border-orange-500/40',
  }[autonomyLevel];

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-[#05070D]/85 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-4">
          
          {/* Left: Logo & Crew Badge */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Link to="/" className="flex items-center gap-2 group focus:outline-none">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400/20 to-blue-600/30 border border-cyan-400/40 flex items-center justify-center shadow-[0_0_15px_-3px_rgba(56,225,255,0.3)] group-hover:border-cyan-300 transition-colors">
                <span className="font-mono font-extrabold text-cyan-300 text-sm tracking-wider">H</span>
              </div>
              <div className="hidden md:flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-base tracking-widest text-white leading-none">HALO</span>
                  <span className="text-[10px] uppercase font-mono px-1 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">v1.0</span>
                </div>
                <span className="text-[10px] text-slate-400 tracking-wider">NASA HEALTH COPILOT</span>
              </div>
            </Link>

            {/* Crew Chip */}
            <div className="h-6 w-px bg-white/10 hidden sm:block mx-1" />
            <Link 
              to="/onboarding" 
              title="Crew Profile & Mission Settings" 
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 hover:border-cyan-400/30 transition-colors"
            >
              <div className="w-6 h-6 rounded-lg bg-cyan-500/15 text-cyan-300 flex items-center justify-center font-mono text-xs">
                <User size={13} />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-xs font-semibold text-slate-200 truncate max-w-[110px] sm:max-w-[150px]">
                  {crew ? crew.name : 'Unassigned Crew'}
                </span>
                <span className="text-[10px] font-mono text-cyan-400/80">
                  {crew?.callSign ? `[${crew.callSign}]` : 'SETUP'}
                  {crew?.isCmo ? ' · CMO' : ''}
                </span>
              </div>
            </Link>
          </div>

          {/* Center: Mission Day & Environment & Light Delay */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            {/* Mission Day */}
            <div className="flex items-center px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/5 font-mono text-xs">
              <span className="text-slate-400 mr-1.5 text-[10px]">MET:</span>
              <span className="font-bold text-white tabular-nums">
                DAY {config?.missionDay ?? 1}
              </span>
            </div>

            {/* Environment Chip (Clickable to adjust / view) */}
            <button
              onClick={() => setShowConfigModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-cyan-400/40 text-xs transition-colors"
              title="Click to view/change environment & latency"
            >
              <Globe size={13} className="text-cyan-400 shrink-0" />
              <span className="font-medium text-slate-200 hidden lg:inline">{environment.shortName}</span>
              <span className="font-mono text-[11px] text-slate-300">({environment.gravityG}g)</span>
              <ChevronDown size={11} className="text-slate-400" />
            </button>

            {/* Light-delay chip (Exact spec requirement: "Earth: 14 min 06 s one-way") */}
            <button
              onClick={() => setShowConfigModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-950/40 border border-cyan-500/30 text-cyan-300 hover:border-cyan-400 transition-colors text-xs font-mono"
              title="Speed of light one-way comm latency to Earth"
            >
              <Radio size={12} className="text-cyan-400 animate-pulse" />
              <span className="tabular-nums font-semibold">
                Earth: {delayFormatted} one-way
              </span>
            </button>

            {/* Autonomy Level Pill */}
            <div className={`hidden xl:inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-mono tracking-wide ${autonomyBadgeColor}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping" />
              <span>{autonomyLevel.toUpperCase()}</span>
            </div>
          </div>

          {/* Right: Readiness Ring */}
          <div className="flex items-center gap-3 shrink-0">
            <Link 
              to="/trends" 
              className="flex items-center gap-2 group" 
              title={`Crew Readiness Score: ${readinessScore}/100`}
            >
              <div className="hidden sm:flex flex-col items-end leading-none">
                <span className="text-[10px] tracking-wider text-slate-400 uppercase">Readiness</span>
                <span className="text-xs font-mono font-bold text-white tabular-nums">{readinessScore}%</span>
              </div>
              <ReadinessRing score={readinessScore} size="sm" />
            </Link>
          </div>
        </div>

        {/* Autonomous Banner for Delay > 5 min (Per §5 spec requirement) */}
        {autonomyLevel === 'Autonomous' && (
          <div className="w-full bg-orange-950/70 border-y border-orange-500/30 px-4 py-1.5 flex items-center justify-center gap-2 text-xs text-orange-200">
            <AlertTriangle size={14} className="text-orange-400 shrink-0" />
            <span className="text-center font-medium">
              <strong>Autonomous Operations:</strong> Ground cannot respond in time for emergencies ({delayFormatted} latency). Follow HALO guidance and your crew medical officer.
            </span>
          </div>
        )}
      </header>

      {/* Environment & Latency Configuration Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <GlassCard variant="cyan" padded="lg" className="w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
              <div className="flex items-center gap-2">
                <Globe className="text-cyan-400" size={20} />
                <h3 className="text-lg font-bold text-white">Mission Environment & Delay Control</h3>
              </div>
              <button 
                onClick={() => setShowConfigModal(false)}
                className="text-slate-400 hover:text-white text-xl p-1 font-mono"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-slate-300">
                Select your mission station or vessel. Gravity, radiation dose rate, available diagnostic tools, and speed-of-light comm delay automatically adjust.
              </p>

              {/* Environment Selection Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {(Object.keys(ENVIRONMENTS) as EnvironmentId[]).map((envId) => {
                  const item = ENVIRONMENTS[envId];
                  const isSelected = environment.id === envId;
                  return (
                    <button
                      key={envId}
                      onClick={() => handleEnvSelect(envId)}
                      className={`text-left p-3 rounded-xl border transition-all ${
                        isSelected
                          ? 'bg-cyan-500/15 border-cyan-400 text-white shadow-[0_0_15px_-4px_rgba(56,225,255,0.4)]'
                          : 'bg-white/[0.03] border-white/10 hover:border-white/20 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between font-semibold text-sm">
                        <span>{item.name}</span>
                        <span className="font-mono text-xs text-cyan-300">
                          {item.gravityG}g
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        Rad: {item.radiationDoseRatePerDay} mSv/d (approx.)
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                        Delay: {item.isVariableDelay ? '3–22 min variable' : `${item.defaultDelaySeconds}s`}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Comm-Delay Slider (For variable transit/mars/rover) */}
              {environment.isVariableDelay && (
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 mt-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-200">Planetary Alignment Comms Delay</span>
                    <span className="font-mono text-cyan-400 font-bold tabular-nums">
                      {formatCommDelay(delaySliderVal)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={environment.minDelaySeconds ?? 180}
                    max={environment.maxDelaySeconds ?? 1320}
                    step={15}
                    value={delaySliderVal}
                    onChange={handleDelayChange}
                    className="w-full accent-cyan-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-slate-400">
                    <span>3 min (Conjunction)</span>
                    <span>14 min (Ares Day 142)</span>
                    <span>22 min (Opposition)</span>
                  </div>
                </div>
              )}

              {/* Radiation source disclaimer per §5 */}
              <div className="flex items-start gap-2 p-3 rounded-lg bg-white/[0.02] border border-white/5 text-[11px] text-slate-400">
                <Info size={14} className="text-cyan-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Published Reference Note:</strong> {environment.radiationSourceNote}. Values are approximate published averages.
                </span>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <BigButton variant="primary" size="md" onClick={() => setShowConfigModal(false)}>
                Confirm & Close
              </BigButton>
            </div>
          </GlassCard>
        </div>
      )}
    </>
  );
};
