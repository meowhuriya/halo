import React from 'react';
import { Eye, CreditCard, Grid } from 'lucide-react';
import { GlassCard } from '../../design/components/GlassCard';
import { BigButton } from '../../design/components/BigButton';
import { StatusBadge } from '../../design/components/StatusBadge';

export const VisionView: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Eye size={16} className="text-cyan-400" />
            <span className="text-xs font-mono tracking-widest text-cyan-300 uppercase">
              OPHTHALMIC MONITORING
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Amsler Grid SANS Self-Screen
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            Standardized central visual field test for Spaceflight-Associated Neuro-ocular Syndrome (SANS).
          </p>
        </div>
        <StatusBadge status="NOMINAL" />
      </div>

      {/* Calibration and Grid Preview */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Physical Screen Calibration (§7.6) */}
        <GlassCard variant="default" padded="md" className="md:col-span-5 space-y-4">
          <div className="flex items-center gap-2 text-cyan-300 font-semibold text-sm">
            <CreditCard size={18} />
            <h3>Physical mm Calibration (§7.6)</h3>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Displays a true 10 cm × 10 cm clinical grid with 5 mm squares by calibrating against a standard ID or credit card (exact 85.6 mm ISO width).
          </p>

          <div className="p-4 rounded-xl bg-black/40 border border-white/10 text-center space-y-2">
            <div className="w-full h-16 rounded-lg bg-gradient-to-r from-slate-700 to-slate-800 border border-white/20 flex items-center justify-center text-xs font-mono text-slate-300">
              [ Standard ID Card: 85.6 mm ]
            </div>
            <span className="text-[10px] font-mono text-slate-400">
              Stored calibration: 3.78 px/mm
            </span>
          </div>

          <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-500/20 text-xs text-slate-300">
            <strong>SANS Context:</strong> Long-duration microgravity causes upward fluid shifts, optic disc swelling, and choroidal folds.
          </div>
        </GlassCard>

        {/* Grid Preview Display */}
        <GlassCard variant="default" padded="lg" className="md:col-span-7 flex flex-col items-center justify-center relative bg-black/60 border-cyan-500/20">
          <div className="w-64 h-64 border border-cyan-400/30 rounded-xl relative bg-black/80 flex items-center justify-center p-2">
            {/* Grid Lines */}
            <div className="w-full h-full grid grid-cols-8 grid-rows-8 border border-white/10">
              {Array.from({ length: 64 }).map((_, i) => (
                <div key={i} className="border border-white/10 flex items-center justify-center" />
              ))}
            </div>
            {/* Central Fixation Dot */}
            <div className="absolute w-3 h-3 bg-cyan-400 rounded-full shadow-[0_0_8px_#38E1FF]" />
          </div>

          <div className="mt-4 text-center space-y-1">
            <span className="text-xs font-mono text-slate-300">10 cm × 10 cm true retinal angle target</span>
            <div className="text-[11px] text-slate-400">Hold at ~30 cm, cover one eye, fixate on center dot.</div>
          </div>

          <div className="mt-6">
            <BigButton variant="primary" size="md" icon={<Grid size={16} />} disabled>
              Screening Flow Active in Phase 4
            </BigButton>
          </div>
        </GlassCard>

      </div>
    </div>
  );
};
