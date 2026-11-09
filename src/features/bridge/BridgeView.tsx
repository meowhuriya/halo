import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Camera, 
  Activity, 
  Brain, 
  Eye, 
  Heart, 
  Wind, 
  Droplet, 
  Bone, 
  Sun, 
  Radio, 
  CheckCircle2, 
  RotateCw,
  Sparkles
} from 'lucide-react';
import { useMission } from '../../app/MissionContext';
import { GlassCard } from '../../design/components/GlassCard';
import { BigButton } from '../../design/components/BigButton';
import { ReadinessRing } from '../../design/components/ReadinessRing';
import { StatusBadge } from '../../design/components/StatusBadge';
import { formatCommDelay } from '../../config/environments';

type BodySystem = 'brain' | 'eyes' | 'heart' | 'lungs' | 'blood' | 'bones' | 'skin';

interface SystemDetail {
  id: BodySystem;
  title: string;
  status: 'NOMINAL' | 'WATCH' | 'ALERT' | 'CRITICAL';
  vitals: string;
  spaceflightEffect: string;
  actions: string;
}

const BODY_SYSTEMS: Record<BodySystem, SystemDetail> = {
  brain: {
    id: 'brain',
    title: 'Cognition & Central Nervous System',
    status: 'WATCH',
    vitals: 'Sleep: 5.6h (Accumulating debt) · PVT-B: 232ms',
    spaceflightEffect: 'Sleep architecture disruption, circadian desynchrony, high cognitive workload, and neurovestibular adaptation.',
    actions: 'Review circadian sleep schedule and run PVT-B reaction test before high-risk operations.',
  },
  eyes: {
    id: 'eyes',
    title: 'Visual System & Optic Nerve (SANS)',
    status: 'NOMINAL',
    vitals: 'Amsler Grid: No central distortion reported',
    spaceflightEffect: 'Spaceflight-Associated Neuro-ocular Syndrome (SANS): cephalad fluid shifts cause posterior globe flattening and choroidal folds.',
    actions: 'Perform weekly Amsler self-grid test; confirm fundoscopy schedule with flight surgeon.',
  },
  heart: {
    id: 'heart',
    title: 'Cardiovascular Dynamics',
    status: 'NOMINAL',
    vitals: 'Resting HR: 64 bpm · BP: 116/76 mmHg',
    spaceflightEffect: 'Cephalad blood redistribution, stroke volume shifts, baroreceptor reset, and post-flight orthostatic intolerance.',
    actions: 'Daily contactless rPPG scan; maintain 2.5 hours countermeasure aerobic and resistance training.',
  },
  lungs: {
    id: 'lungs',
    title: 'Pulmonary & Oxygenation',
    status: 'NOMINAL',
    vitals: 'SpO₂: 98% · Resp Rate: 15 breaths/min',
    spaceflightEffect: 'Changes in ventilation/perfusion ratio without gravity; cabin trace atmosphere and CO₂ scrubbing sensitivity.',
    actions: 'Monitor cabin CO₂ levels and pulse oximetry during intensive exercise sessions.',
  },
  blood: {
    id: 'blood',
    title: 'Metabolic & Immune Panel',
    status: 'NOMINAL',
    vitals: 'Fasting Glucose: 92 mg/dL · Temp: 36.6 °C',
    spaceflightEffect: 'Immune system dysregulation, latent herpesvirus reactivation, altered carbohydrate metabolism.',
    actions: 'Weekly glucometer check; maintain scheduled nutrient intake and immune hygiene protocols.',
  },
  bones: {
    id: 'bones',
    title: 'Musculoskeletal & Bone Density',
    status: 'WATCH',
    vitals: 'Estimated Hip BMD: −1.1%/mo without countermeasure',
    spaceflightEffect: 'Microgravity unloading causes 1–1.5% bone mineral density loss per month at hip/spine and muscle atrophy.',
    actions: 'Log resistance exercise sessions; ensure daily intake of 800 IU vitamin D and calcium target.',
  },
  skin: {
    id: 'skin',
    title: 'Whole-Body Radiation Dosimetry',
    status: 'NOMINAL',
    vitals: 'Dose: 255.6 mSv (42.6% of 600 mSv career limit)',
    spaceflightEffect: 'Galactic cosmic radiation (GCR) and solar particle events increase carcinogenesis and tissue damage risks.',
    actions: 'Verify habitat shielding integrity; report any visual phosphene/light flashes to medical log.',
  },
};

export const BridgeView: React.FC = () => {
  const { 
    crew, 
    config, 
    environment, 
    readinessScore, 
    loadDemo 
  } = useMission();

  const [selectedSystem, setSelectedSystem] = useState<SystemDetail>(BODY_SYSTEMS.brain);

  const delayStr = formatCommDelay(config?.oneWayDelaySeconds ?? environment.defaultDelaySeconds);

  // Subtle star coordinates for mission-control atmosphere
  const stars = [
    { top: '10%', left: '15%', delay: '0s' },
    { top: '25%', left: '80%', delay: '1.2s' },
    { top: '45%', left: '30%', delay: '2.5s' },
    { top: '65%', left: '70%', delay: '0.7s' },
    { top: '85%', left: '20%', delay: '1.9s' },
    { top: '15%', left: '60%', delay: '3.1s' },
    { top: '75%', left: '85%', delay: '1.5s' },
  ];

  return (
    <div className="relative space-y-6">
      
      {/* Subtle Starfield Background (Bridge only per §4) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {stars.map((s, idx) => (
          <div
            key={idx}
            className="absolute w-1 h-1 bg-cyan-200/50 rounded-full star-point"
            style={{ top: s.top, left: s.left, animationDelay: s.delay }}
          />
        ))}
      </div>

      {/* Hero Mission Control Header */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-mono tracking-widest text-cyan-300 uppercase">
              FLIGHT DECK · {environment.name.toUpperCase()}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Astronaut Health Co-Pilot Bridge
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            Real-time biometric telemetry, personal baseline analysis, and autonomous guidance for {crew?.name || 'Assigned Crew'}.
          </p>
        </div>

        {/* Quick Actions & Demo loader */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Link to="/scan">
            <BigButton variant="primary" size="md" icon={<Camera size={18} />}>
              Camera Scan (rPPG)
            </BigButton>
          </Link>
          <button
            onClick={() => loadDemo()}
            className="px-4 py-3 rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/15 text-slate-200 text-xs font-semibold flex items-center gap-2 transition-colors min-h-[56px]"
            title="Reload full 142-day Mars Transit demo state"
          >
            <Sparkles size={16} className="text-cyan-400" />
            <span>Reset Demo Mission</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Left Digital Twin / Right Telemetry Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
        
        {/* Left Column: Digital Twin (7 cols) */}
        <GlassCard variant="default" padded="lg" className="lg:col-span-7 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Activity size={18} className="text-cyan-400" />
                Astronaut Digital Twin
              </h2>
              <p className="text-xs text-slate-400">
                Interactive physiological model. Select any body system to inspect spaceflight adaptations.
              </p>
            </div>
            <StatusBadge status={selectedSystem.status} />
          </div>

          {/* SVG Digital Twin & Interactive Body Points */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center py-2">
            
            {/* SVG Visual Body Map */}
            <div className="sm:col-span-5 flex justify-center">
              <div className="relative w-48 h-80 flex items-center justify-center">
                
                {/* SVG Silhouette */}
                <svg viewBox="0 0 200 400" className="w-full h-full drop-shadow-[0_0_15px_rgba(56,225,255,0.15)]">
                  {/* Outer subtle glow outline */}
                  <path
                    d="M 100 20 C 115 20, 125 35, 125 50 C 125 62, 118 70, 110 75 L 145 100 L 175 180 L 160 185 L 135 125 L 135 210 L 145 340 L 130 380 L 115 380 L 110 240 L 100 240 L 90 240 L 85 380 L 70 380 L 55 340 L 65 210 L 65 125 L 40 185 L 25 180 L 55 100 L 90 75 C 82 70, 75 62, 75 50 C 75 35, 85 20, 100 20 Z"
                    fill="rgba(56, 225, 255, 0.05)"
                    stroke="rgba(56, 225, 255, 0.4)"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                  {/* Head outline */}
                  <ellipse cx="100" cy="50" rx="22" ry="26" fill="rgba(56,225,255,0.08)" stroke="#38E1FF" strokeWidth="1.5" />
                  {/* Torso ribs / heart contour */}
                  <path d="M 80 120 Q 100 135 120 120" stroke="rgba(255,255,255,0.2)" fill="none" />
                  <path d="M 82 140 Q 100 155 118 140" stroke="rgba(255,255,255,0.2)" fill="none" />
                  <path d="M 85 160 Q 100 175 115 160" stroke="rgba(255,255,255,0.2)" fill="none" />
                  {/* Central Spine */}
                  <line x1="100" y1="80" x2="100" y2="210" stroke="rgba(56,225,255,0.3)" strokeDasharray="3 3" />
                </svg>

                {/* Hotspot: Brain */}
                <button
                  onClick={() => setSelectedSystem(BODY_SYSTEMS.brain)}
                  className={`absolute top-7 left-[86px] w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                    selectedSystem.id === 'brain'
                      ? 'bg-amber-500 text-black ring-4 ring-amber-400/50 scale-125'
                      : 'bg-amber-500/30 text-amber-300 hover:scale-110'
                  }`}
                  title="Brain: Cognition & Sleep"
                >
                  <Brain size={14} />
                </button>

                {/* Hotspot: Eyes */}
                <button
                  onClick={() => setSelectedSystem(BODY_SYSTEMS.eyes)}
                  className={`absolute top-12 left-[88px] w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                    selectedSystem.id === 'eyes'
                      ? 'bg-emerald-500 text-black ring-4 ring-emerald-400/50 scale-125'
                      : 'bg-emerald-500/30 text-emerald-300 hover:scale-110'
                  }`}
                  title="Eyes: SANS Optic Screen"
                >
                  <Eye size={13} />
                </button>

                {/* Hotspot: Heart */}
                <button
                  onClick={() => setSelectedSystem(BODY_SYSTEMS.heart)}
                  className={`absolute top-[108px] left-[102px] w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                    selectedSystem.id === 'heart'
                      ? 'bg-cyan-400 text-black ring-4 ring-cyan-400/50 scale-125'
                      : 'bg-cyan-500/30 text-cyan-300 hover:scale-110'
                  }`}
                  title="Heart: Cardiovascular & rPPG"
                >
                  <Heart size={14} />
                </button>

                {/* Hotspot: Lungs */}
                <button
                  onClick={() => setSelectedSystem(BODY_SYSTEMS.lungs)}
                  className={`absolute top-[108px] left-[66px] w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                    selectedSystem.id === 'lungs'
                      ? 'bg-cyan-400 text-black ring-4 ring-cyan-400/50 scale-125'
                      : 'bg-cyan-500/30 text-cyan-300 hover:scale-110'
                  }`}
                  title="Lungs: Respiration & SpO2"
                >
                  <Wind size={13} />
                </button>

                {/* Hotspot: Blood / Metabolism */}
                <button
                  onClick={() => setSelectedSystem(BODY_SYSTEMS.blood)}
                  className={`absolute top-[145px] left-[88px] w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                    selectedSystem.id === 'blood'
                      ? 'bg-emerald-500 text-black ring-4 ring-emerald-400/50 scale-125'
                      : 'bg-emerald-500/30 text-emerald-300 hover:scale-110'
                  }`}
                  title="Blood: Glucose & Temperature"
                >
                  <Droplet size={13} />
                </button>

                {/* Hotspot: Bones & Muscle */}
                <button
                  onClick={() => setSelectedSystem(BODY_SYSTEMS.bones)}
                  className={`absolute top-[205px] left-[88px] w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                    selectedSystem.id === 'bones'
                      ? 'bg-amber-500 text-black ring-4 ring-amber-400/50 scale-125'
                      : 'bg-amber-500/30 text-amber-300 hover:scale-110'
                  }`}
                  title="Bones: Hip BMD Loss & Exercise Countermeasures"
                >
                  <Bone size={13} />
                </button>

                {/* Hotspot: Radiation & Skin */}
                <button
                  onClick={() => setSelectedSystem(BODY_SYSTEMS.skin)}
                  className={`absolute top-[75px] left-[138px] w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                    selectedSystem.id === 'skin'
                      ? 'bg-cyan-400 text-black ring-4 ring-cyan-400/50 scale-125'
                      : 'bg-cyan-500/30 text-cyan-300 hover:scale-110'
                  }`}
                  title="Dosimetry: Cosmic Radiation"
                >
                  <Sun size={13} />
                </button>

              </div>
            </div>

            {/* System Breakdown List & Buttons */}
            <div className="sm:col-span-7 space-y-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
                Body Subsystems Telemetry
              </span>
              <div className="grid grid-cols-2 gap-2">
                {(Object.values(BODY_SYSTEMS)).map((sys) => {
                  const isSelected = selectedSystem.id === sys.id;
                  return (
                    <button
                      key={sys.id}
                      onClick={() => setSelectedSystem(sys)}
                      className={`text-left p-2.5 rounded-xl border text-xs transition-all ${
                        isSelected
                          ? 'bg-cyan-500/15 border-cyan-400 text-white font-semibold shadow-sm'
                          : 'bg-white/[0.03] border-white/5 hover:border-white/20 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="truncate">{sys.title.split(' ')[0]}</span>
                        <span className={`w-2 h-2 rounded-full ${
                          sys.status === 'NOMINAL' ? 'bg-emerald-400' : 'bg-amber-400'
                        }`} />
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-0.5 truncate font-mono">
                        {sys.status}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Body System Detail Drawer / Card */}
          <div className="mt-4 p-4 rounded-2xl bg-black/40 border border-white/10 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-cyan-300">
                {selectedSystem.title}
              </span>
              <span className="text-xs font-mono text-slate-400">
                {selectedSystem.vitals}
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              <strong>Spaceflight Physiology:</strong> {selectedSystem.spaceflightEffect}
            </p>
            <div className="text-xs text-cyan-200/90 pt-1 border-t border-white/5">
              <strong>Countermeasure:</strong> {selectedSystem.actions}
            </div>
          </div>
        </GlassCard>

        {/* Right Column: Readiness Ring, Orbit Ring, Active Alerts, Delay (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Readiness Score Card */}
          <GlassCard variant="default" padded="md">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  CREW OPERATIONAL STATUS
                </span>
                <h3 className="text-xl font-extrabold text-white">Overall Readiness</h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Algorithmic score (§7.9) based on vitals, sleep, and completed checks.
                </p>
              </div>
              <ReadinessRing score={readinessScore} size="md" showLabel />
            </div>

            <div className="mt-4 pt-3 border-t border-white/10 grid grid-cols-3 gap-2 text-center text-xs font-mono">
              <div className="p-2 rounded-xl bg-white/[0.03]">
                <span className="text-slate-400 block text-[10px]">CLINICAL</span>
                <span className="font-bold text-emerald-400">NOMINAL</span>
              </div>
              <div className="p-2 rounded-xl bg-white/[0.03]">
                <span className="text-slate-400 block text-[10px]">BASELINE</span>
                <span className="font-bold text-amber-400">WATCH (1)</span>
              </div>
              <div className="p-2 rounded-xl bg-white/[0.03]">
                <span className="text-slate-400 block text-[10px]">BAND</span>
                <span className="font-bold text-emerald-400">GO (88%)</span>
              </div>
            </div>
          </GlassCard>

          {/* Today's Checks Orbit Ring (§7.2, §7.10) */}
          <GlassCard variant="default" padded="md">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <RotateCw size={15} className="text-cyan-400" />
                Today's Orbit Checks (Day {config?.missionDay ?? 142})
              </h3>
              <span className="text-xs font-mono text-cyan-300">1 / 4 Complete</span>
            </div>

            <div className="space-y-2.5">
              <Link to="/scan" className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 transition-colors">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                  <span className="text-xs font-semibold text-slate-200">Contactless HR Scan (rPPG)</span>
                </div>
                <span className="text-[10px] font-mono text-cyan-300 uppercase px-2 py-0.5 rounded bg-cyan-500/20">
                  Pending +50 XP
                </span>
              </Link>

              <Link to="/cognition" className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 transition-colors">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                  <span className="text-xs font-semibold text-slate-200">PVT-B Reaction Speed</span>
                </div>
                <span className="text-[10px] font-mono text-cyan-300 uppercase px-2 py-0.5 rounded bg-cyan-500/20">
                  Pending +75 XP
                </span>
              </Link>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-950/20 border border-emerald-500/20">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 size={13} className="text-emerald-400" />
                  <span className="text-xs font-semibold text-slate-200">Sleep &amp; Mood Check</span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 uppercase">
                  Logged (5.6h)
                </span>
              </div>
            </div>
          </GlassCard>

          {/* Radiation & Comm Latency Quick Bar */}
          <GlassCard variant="default" padded="md" className="space-y-3">
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-300 font-medium">Cumulative Cosmic Radiation</span>
                <span className="font-mono text-cyan-300 tabular-nums">255.6 / 600 mSv (42.6%)</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-cyan-400 to-amber-400 rounded-full" style={{ width: '42.6%' }} />
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                NASA 2022 career limit: 600 mSv. Dose rate: {environment.radiationDoseRatePerDay} mSv/d approx.
              </span>
            </div>

            <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <Radio size={14} className="text-cyan-400" />
                <span>One-Way Light Delay:</span>
              </div>
              <span className="font-mono font-bold text-white tabular-nums">
                {delayStr}
              </span>
            </div>
          </GlassCard>

        </div>
      </div>

    </div>
  );
};
