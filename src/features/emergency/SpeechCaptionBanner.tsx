import React from 'react';
import { RotateCcw, Volume2, ArrowRight } from 'lucide-react';

interface SpeechCaptionBannerProps {
  caption: string;
  hasLocalVoice: boolean;
  isSpeaking: boolean;
  onRepeat: () => void;
  onNext?: () => void;
  nextLabel?: string;
  showNextButton?: boolean;
}

export const SpeechCaptionBanner: React.FC<SpeechCaptionBannerProps> = ({
  caption,
  hasLocalVoice,
  isSpeaking,
  onRepeat,
  onNext,
  nextLabel = 'NEXT STEP',
  showNextButton = false,
}) => {
  return (
    <div
      data-testid="speech-caption-banner"
      className="w-full max-w-4xl mx-auto rounded-2xl bg-black/80 border-2 border-red-500/50 p-4 sm:p-5 shadow-[0_0_30px_rgba(239,68,68,0.25)] flex flex-col md:flex-row items-center justify-between gap-4"
      role="region"
      aria-label="Voice instructions and caption"
    >
      {/* Caption Content */}
      <div className="flex-1 space-y-1.5 w-full">
        <div className="flex items-center gap-2">
          <Volume2
            size={18}
            className={`shrink-0 ${isSpeaking ? 'text-amber-400 animate-pulse' : 'text-red-400'}`}
          />
          <span className="text-[10px] font-mono uppercase tracking-widest text-red-300 font-bold">
            ON-SCREEN VOICE CAPTION · {hasLocalVoice ? 'OFFLINE LOCAL VOICE' : 'CAPTIONS ACTIVE (OFFLINE)'}
          </span>
        </div>
        <p className="text-base sm:text-lg font-bold text-slate-100 font-mono leading-snug">
          &ldquo;{caption}&rdquo;
        </p>
      </div>

      {/* Voice Guidance Actions: Minimum 72px glove-friendly targets per §7.11 & §2 */}
      <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
        <button
          type="button"
          onClick={onRepeat}
          data-testid="emergency-repeat-voice-btn"
          className="flex-1 md:flex-initial h-[72px] min-h-[72px] min-w-[130px] px-5 rounded-2xl bg-red-950/70 hover:bg-red-900 border-2 border-red-500/50 hover:border-red-400 text-white font-mono font-black text-sm flex items-center justify-center gap-2 active:scale-95 transition-all shadow-[0_0_15px_rgba(239,68,68,0.3)] glove-target"
          aria-label="Repeat spoken instruction"
        >
          <RotateCcw size={20} className="text-red-300 shrink-0" />
          <span>REPEAT</span>
        </button>

        {showNextButton && onNext && (
          <button
            type="button"
            onClick={onNext}
            data-testid="emergency-next-step-btn"
            className="flex-1 md:flex-initial h-[72px] min-h-[72px] min-w-[150px] px-6 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-mono font-black text-sm flex items-center justify-center gap-2 active:scale-95 transition-all shadow-[0_0_25px_rgba(239,68,68,0.6)] border-2 border-red-300 glove-target"
            aria-label={nextLabel}
          >
            <span>{nextLabel}</span>
            <ArrowRight size={20} className="text-white shrink-0" />
          </button>
        )}
      </div>
    </div>
  );
};
