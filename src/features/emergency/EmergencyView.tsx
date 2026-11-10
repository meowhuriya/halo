import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  AlertOctagon, 
  Volume2, 
  Heart, 
  X
} from 'lucide-react';
import { BigButton } from '../../design/components/BigButton';
import { speakOffline } from '../../utils/speech';

export const EmergencyView: React.FC = () => {
  const navigate = useNavigate();
  const [testedVoice, setTestedVoice] = useState(false);
  const [caption, setCaption] = useState(
    'HALO Emergency Mode active. Is the crew member responsive and breathing normally?'
  );

  // Test Web Speech API speechSynthesis offline with local voice per §3 (v3)
  const handleSpeak = (text: string) => {
    setCaption(text);
    speakOffline(text, {
      onStart: () => setTestedVoice(true),
      onError: () => setTestedVoice(true), // Captions alone suffice if voice unavailable
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#1A0305] text-white flex flex-col p-4 sm:p-8 overflow-y-auto">
      
      {/* Top Emergency Header Bar */}
      <div className="max-w-4xl w-full mx-auto flex items-center justify-between pb-4 border-b border-red-500/30">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-red-600 flex items-center justify-center shadow-[0_0_25px_rgba(239,68,68,0.8)] animate-pulse">
            <AlertOctagon size={28} className="text-white" />
          </div>
          <div>
            <div className="text-[11px] font-mono tracking-widest text-red-300 uppercase">
              AUTONOMOUS MEDICAL RESCUE
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-wide">
              EMERGENCY PROTOCOL SYSTEM
            </h1>
          </div>
        </div>

        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-mono font-bold flex items-center gap-1.5 transition-colors"
        >
          <X size={16} />
          <span>EXIT TO BRIDGE</span>
        </button>
      </div>

      {/* Main Flow: First Triage Question per §7.11 */}
      <div className="max-w-3xl w-full mx-auto my-auto py-8 space-y-6">
        
        <div className="text-center space-y-3">
          <span className="text-xs font-mono text-red-400 uppercase tracking-widest px-3 py-1 rounded-full bg-red-950/60 border border-red-500/40">
            TRIAGE QUESTION 1
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
            Is the person responsive and breathing normally?
          </h2>
          <p className="text-xs sm:text-sm text-red-200/80">
            Check pulse, responsiveness to call, and chest rise. Emergency voice guidance will adapt instantly.
          </p>
        </div>

        {/* Live On-Screen Caption per §3 (v3) */}
        <div className="p-4 rounded-2xl bg-black/60 border border-red-500/30 text-center">
          <span className="text-[10px] font-mono uppercase text-red-400 tracking-wider block mb-1">
            VOICE CAPTION (OFFLINE LOCAL VOICE)
          </span>
          <p className="text-sm font-semibold text-slate-100 font-mono">
            &ldquo;{caption}&rdquo;
          </p>
        </div>

        {/* Huge Glove-Friendly Buttons per §7.11 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <BigButton
            variant="danger"
            size="xl"
            icon={<AlertOctagon size={24} />}
            onClick={() => handleSpeak('Patient unresponsive. Call crew and CMO immediately. Initiate microgravity CPR coach.')}
            className="flex-col py-6 min-h-[96px]"
          >
            <span className="text-xl font-black">NO · UNRESPONSIVE</span>
            <span className="text-xs opacity-80 font-normal">Initiates Microgravity CPR &amp; AED Metronome</span>
          </BigButton>

          <BigButton
            variant="secondary"
            size="xl"
            icon={<Heart size={24} className="text-red-400" />}
            onClick={() => handleSpeak('Patient is conscious. Assessing chest pain, trauma, and respiratory distress symptoms.')}
            className="flex-col py-6 min-h-[96px] bg-white/10 border-red-500/40 text-white"
          >
            <span className="text-xl font-black">YES · CONSCIOUS</span>
            <span className="text-xs opacity-80 font-normal">Chest Pain / Trauma / Toxic Atmosphere Triage</span>
          </BigButton>
        </div>

        {/* Voice Speech Synthesis Offline Test */}
        <div className="p-4 rounded-2xl bg-black/40 border border-red-500/30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Volume2 className="text-red-400 shrink-0" size={20} />
            <div className="text-xs text-red-200">
              <strong>Offline Voice Guidance (Web Speech API):</strong> Uses local offline voice (<code>localService: true</code>) with mandatory on-screen captions.
            </div>
          </div>
          <button
            onClick={() => handleSpeak('HALO voice synthesis test. Operating completely offline in deep space.')}
            className="px-4 py-2.5 rounded-xl bg-red-600/40 hover:bg-red-600/70 border border-red-400 text-xs font-mono font-bold shrink-0 text-white"
          >
            {testedVoice ? '✓ Audio Tested' : 'Test Speech'}
          </button>
        </div>

        {/* Protocol Previews */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-black/30 border border-white/10 space-y-1">
            <span className="font-bold text-red-400 font-mono">1. Microgravity CPR</span>
            <p className="text-[11px] text-slate-300">
              Evetts-Russomano torso wrap method with 110 bpm audio/visual metronome.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-black/30 border border-white/10 space-y-1">
            <span className="font-bold text-red-400 font-mono">2. Acute Chest Pain</span>
            <p className="text-[11px] text-slate-300">
              Structured red-flag symptom capture, telemetry logging, and AED staging.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-black/30 border border-white/10 space-y-1">
            <span className="font-bold text-red-400 font-mono">3. Toxic / SPE Protocol</span>
            <p className="text-[11px] text-slate-300">
              Module evacuation, storm shelter timing, and auto-downlinked incident report.
            </p>
          </div>
        </div>

      </div>

    </div>
  );
};
