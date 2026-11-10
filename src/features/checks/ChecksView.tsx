import React, { useState, useEffect } from 'react';
import { 
  ClipboardCheck, 
  Lock, 
  CheckCircle2, 
  ArrowRight,
  Sparkles,
  Heart,
  Activity,
  Thermometer,
  Droplet,
  Wind,
  Moon,
  Smile,
  FileText,
  Dumbbell
} from 'lucide-react';
import { useMission } from '../../app/MissionContext';
import { GlassCard } from '../../design/components/GlassCard';
import { StatusBadge } from '../../design/components/StatusBadge';
import { db, type HealthReading } from '../../data/db';
import { CHECK_DEFINITIONS, type CheckFlowId } from './types';
import { CheckModal } from './CheckModal';

const ICON_MAP: Record<CheckFlowId, React.ReactNode> = {
  bp: <Activity size={20} className="text-cyan-400" />,
  spo2: <Activity size={20} className="text-cyan-400" />,
  temperature: <Thermometer size={20} className="text-amber-400" />,
  glucose: <Droplet size={20} className="text-rose-400" />,
  heart_rate: <Heart size={20} className="text-red-400" />,
  respiratory: <Wind size={20} className="text-teal-400" />,
  sleep: <Moon size={20} className="text-indigo-400" />,
  mood: <Smile size={20} className="text-emerald-400" />,
  phq2_gad2: <FileText size={20} className="text-purple-400" />,
  exercise: <Dumbbell size={20} className="text-orange-400" />,
};

export const ChecksView: React.FC = () => {
  const { environment, crew } = useMission();
  const eq = environment.equipment;

  const [activeFlowId, setActiveFlowId] = useState<CheckFlowId | null>(null);
  const [latestReadings, setLatestReadings] = useState<Record<string, HealthReading>>({});

  const loadLatest = async () => {
    if (!crew?.id) return;
    const all = await db.healthReadings
      .where('crewMemberId')
      .equals(crew.id)
      .sortBy('timestamp');

    const map: Record<string, HealthReading> = {};
    for (const r of all) {
      map[r.indicator] = r;
    }
    setLatestReadings(map);
  };

  useEffect(() => {
    loadLatest();
  }, [crew?.id]);

  const flows = Object.values(CHECK_DEFINITIONS).map((def) => {
    let isAvailable = true;
    if (def.equipmentRequired) {
      isAvailable = !!eq[def.equipmentRequired];
    }
    const latest = latestReadings[def.id] || latestReadings[def.category.toLowerCase()];
    return {
      ...def,
      isAvailable,
      latest,
    };
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in pb-12">
      
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
            Standardized NASA clinical protocols. Hardware availability adapts dynamically to current habitat payload.
          </p>
        </div>
        <StatusBadge status="NOMINAL" />
      </div>

      {/* Equipment availability banner per §5 */}
      <div className="p-4 rounded-2xl bg-cyan-950/20 border border-cyan-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-300">
        <div className="flex items-center gap-2">
          <Sparkles size={15} className="text-cyan-400 shrink-0" />
          <span>
            <strong>Habitat Inventory:</strong> Showing diagnostic flows configured for <em>{environment.name}</em> (G: {environment.gravityG}g).
          </span>
        </div>
        <span className="font-mono text-cyan-400 text-[11px] uppercase tracking-wider shrink-0">
          Glove-Friendly Min 56px Tap
        </span>
      </div>

      {/* Checks Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {flows.map((chk) => (
          <GlassCard
            key={chk.id}
            variant={chk.isAvailable ? 'default' : 'subtle'}
            padded="md"
            className={`flex flex-col justify-between transition-all ${
              !chk.isAvailable ? 'opacity-50 grayscale' : 'hover:border-cyan-400/40'
            }`}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                    {ICON_MAP[chk.id]}
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-300 block">
                      {chk.category}
                    </span>
                    <h3 className="text-base font-bold text-white">
                      {chk.title}
                    </h3>
                  </div>
                </div>

                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 text-white shrink-0">
                  +{chk.xp} XP
                </span>
              </div>

              {/* Frequency and Sane Range */}
              <div className="text-xs text-slate-400 space-y-1">
                <div>Frequency: <strong className="text-slate-300">{chk.frequency}</strong></div>
                <div className="text-[11px] font-mono text-slate-500">{chk.saneRangeDescription}</div>
              </div>

              {/* Latest logged reading if exists */}
              {chk.latest && (
                <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400">Latest Log:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-bold">
                      {typeof chk.latest.value === 'object'
                        ? JSON.stringify(chk.latest.value)
                        : `${chk.latest.value} ${chk.latest.unit}`}
                    </span>
                    <StatusBadge status={chk.latest.status} />
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Status & Launch Button (Glove-Friendly Min 56px Target) */}
            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between gap-3">
              {chk.isAvailable ? (
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
                  <CheckCircle2 size={13} />
                  <span>READY</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                  <Lock size={13} />
                  <span>NOT IN INVENTORY</span>
                </div>
              )}

              <button
                disabled={!chk.isAvailable}
                onClick={() => setActiveFlowId(chk.id)}
                className="px-5 py-3.5 rounded-xl bg-cyan-500 text-black font-extrabold text-xs uppercase tracking-wider hover:bg-cyan-400 transition-all flex items-center gap-1.5 disabled:opacity-20 disabled:pointer-events-none min-h-[56px] shadow-lg shadow-cyan-500/10"
              >
                <span>Launch Flow</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Check Flow Modal */}
      {activeFlowId && (
        <CheckModal
          flowId={activeFlowId}
          onClose={() => setActiveFlowId(null)}
          onSaved={() => {
            loadLatest();
          }}
        />
      )}

    </div>
  );
};
