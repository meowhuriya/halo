import React from 'react';
import { Camera, Activity } from 'lucide-react';
import { GlassCard } from '../../design/components/GlassCard';
import { BigButton } from '../../design/components/BigButton';
import { StatusBadge } from '../../design/components/StatusBadge';

export const ScanView: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Camera size={16} className="text-cyan-400" />
            <span className="text-xs font-mono tracking-widest text-cyan-300 uppercase">
              OPTICAL REMOTE SENSOR
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Contactless Heart Rate Scan (rPPG)
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            Plane-Orthogonal-to-Skin (POS) facial blood volume pulse extraction via camera. No wearable required.
          </p>
        </div>
        <StatusBadge status="NOMINAL" />
      </div>

      {/* Main Scan Simulation & Spec Architecture Container */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Camera Preview Simulation / Placeholder */}
        <GlassCard variant="default" padded="none" className="md:col-span-7 overflow-hidden flex flex-col items-center justify-center min-h-[380px] relative bg-black/60 border-cyan-500/20">
          <div className="absolute inset-0 bg-[radial-gradient(#38e1ff_1px,transparent_1px)] [background-size:16px_16px] opacity-15" />
          
          {/* Target Face Mesh Reticle */}
          <div className="relative w-52 h-64 border-2 border-dashed border-cyan-400/40 rounded-full flex flex-col items-center justify-between p-4 my-8">
            <span className="text-[10px] font-mono text-cyan-300 uppercase px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/30">
              ROI: Forehead &amp; Cheeks
            </span>

            <div className="text-center space-y-1">
              <Camera size={36} className="mx-auto text-cyan-400 animate-pulse" />
              <div className="text-xs font-semibold text-white">Face the light &amp; stay still</div>
              <div className="text-[11px] font-mono text-slate-400">Phase 3 DSP Pipeline Ready</div>
            </div>

            <div className="flex items-center gap-2 text-[10px] font-mono text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>QUALITY: GOOD (SNR 4.2 dB)</span>
            </div>
          </div>

          <div className="w-full p-4 border-t border-white/10 bg-white/[0.02] flex items-center justify-between">
            <div className="text-xs font-mono text-slate-300">
              Framerate: <span className="text-cyan-300">30 fps</span> · Resolution: <span className="text-cyan-300">640×480</span>
            </div>
            <BigButton variant="primary" size="md" icon={<Camera size={16} />} disabled>
              Scan Active in Phase 3
            </BigButton>
          </div>
        </GlassCard>

        {/* Algorithm Pipeline Description (§7.3) */}
        <GlassCard variant="default" padded="md" className="md:col-span-5 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Activity size={16} className="text-cyan-400" />
            Accuracy-Critical rPPG Engine (§7.3)
          </h3>

          <div className="space-y-3 text-xs text-slate-300">
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
              <div className="font-semibold text-cyan-300">1. MediaPipe FaceLandmarker</div>
              <p className="text-[11px] text-slate-400">
                WASM and models bundled 100% locally in <code>/public/mediapipe/</code> for offline deep space operations.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
              <div className="font-semibold text-cyan-300">2. POS Chrominance Algorithm</div>
              <p className="text-[11px] text-slate-400">
                Wang et al. (2017) sliding window projection <code>S1 = G - B</code> and <code>S2 = G + B - 2R</code> with 4th-order Butterworth bandpass (0.7–3.0 Hz).
              </p>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
              <div className="font-semibold text-cyan-300">3. Signal-to-Noise Ratio Gate</div>
              <p className="text-[11px] text-slate-400">
                de Haan &amp; Jeanne SNR evaluation. If motion &gt; 20% or SNR &lt; 0 dB, saves NO reading instead of guessing.
              </p>
            </div>
          </div>
        </GlassCard>

      </div>
    </div>
  );
};
