import React from 'react';
import { 
  ClipboardCheck, 
  Lock, 
  CheckCircle2, 
  ArrowRight
} from 'lucide-react';
import { useMission } from '../../app/MissionContext';
import { GlassCard } from '../../design/components/GlassCard';
import { StatusBadge } from '../../design/components/StatusBadge';

interface CheckItem {
  id: string;
  title: string;
  category: string;
  equipmentRequired: string | null;
  isAvailable: boolean;
  schedule: string;
  xp: number;
}

export const ChecksView: React.FC = () => {
  const { environment } = useMission();
  const eq = environment.equipment;

  const checks: CheckItem[] = [
    {
      id: 'bp',
      title: 'Resting Blood Pressure Cuff',
      category: 'Cardiovascular',
      equipmentRequired: 'bpCuff',
      isAvailable: eq.bpCuff,
      schedule: 'Every 3 days',
      xp: 35,
    },
    {
      id: 'spo2',
      title: 'SpO₂ Blood Oxygenation',
      category: 'Pulmonary',
      equipmentRequired: 'pulseOx',
      isAvailable: eq.pulseOx,
      schedule: 'Daily (or post-exercise)',
      xp: 25,
    },
    {
      id: 'temp',
      title: 'Core Body Temperature',
      category: 'Metabolic & Thermal',
      equipmentRequired: 'thermometer',
      isAvailable: eq.thermometer,
      schedule: 'As needed / Weekly',
      xp: 20,
    },
    {
      id: 'glucose',
      title: 'Blood Glucose (Fasting / Post-meal)',
      category: 'Metabolism',
      equipmentRequired: 'glucometer',
      isAvailable: eq.glucometer,
      schedule: 'Weekly check',
      xp: 40,
    },
    {
      id: 'resp',
      title: 'Respiratory Rate (30s Tap Counter)',
      category: 'Pulmonary',
      equipmentRequired: null, // manual built-in counter
      isAvailable: true,
      schedule: 'On demand / Weekly',
      xp: 20,
    },
    {
      id: 'sleep',
      title: 'Daily Sleep Log & Architecture',
      category: 'Neuropsychology',
      equipmentRequired: null,
      isAvailable: true,
      schedule: 'Daily morning',
      xp: 30,
    },
    {
      id: 'mood',
      title: 'Psychological Well-being & Stress Check',
      category: 'Behavioral Health',
      equipmentRequired: null,
      isAvailable: true,
      schedule: 'Daily morning',
      xp: 30,
    },
    {
      id: 'exercise',
      title: 'Exercise Countermeasure Log (ARED / T2)',
      category: 'Musculoskeletal',
      equipmentRequired: null,
      isAvailable: true,
      schedule: 'Daily target 2.5h',
      xp: 50,
    },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <ClipboardCheck size={16} className="text-cyan-400" />
            <span className="text-xs font-mono tracking-widest text-cyan-300 uppercase">
              BIOMETRIC PROTOCOLS · {environment.shortName}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Guided Manual Vitals Checks
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            Standardized NASA clinical protocols. Equipment availability adapts to current habitat payload.
          </p>
        </div>
        <StatusBadge status="NOMINAL" />
      </div>

      {/* Equipment availability note per §5 */}
      <div className="p-4 rounded-2xl bg-cyan-950/20 border border-cyan-500/20 flex items-center justify-between text-xs text-slate-300">
        <div>
          <strong>Environment Hardware Status:</strong> Showing diagnostic tools available in <em>{environment.name}</em>.
        </div>
        <span className="font-mono text-cyan-400">Phase 2 Full Check Flows</span>
      </div>

      {/* Checks Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {checks.map((chk) => (
          <GlassCard
            key={chk.id}
            variant={chk.isAvailable ? 'default' : 'subtle'}
            padded="md"
            className={`flex flex-col justify-between transition-all ${
              !chk.isAvailable ? 'opacity-60 grayscale' : 'hover:border-cyan-400/40'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-300">
                  {chk.category}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 text-white">
                  +{chk.xp} XP
                </span>
              </div>

              <h3 className="text-base font-bold text-white mb-1">
                {chk.title}
              </h3>

              <div className="text-xs text-slate-400">
                Frequency: {chk.schedule}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
              {chk.isAvailable ? (
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
                  <CheckCircle2 size={13} />
                  <span>EQUIPMENT READY</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                  <Lock size={13} />
                  <span>NOT IN HABITAT INVENTORY</span>
                </div>
              )}

              <button
                disabled={!chk.isAvailable}
                className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 disabled:opacity-30 disabled:pointer-events-none"
              >
                <span>Launch Flow</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </GlassCard>
        ))}
      </div>

    </div>
  );
};
