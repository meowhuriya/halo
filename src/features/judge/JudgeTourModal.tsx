import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play,
  Pause,
  SkipForward,
  X,
  Sparkles,
  Heart,
  RotateCcw,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { useJudgeTour } from './JudgeContext';
import { BigButton } from '../../design/components/BigButton';

interface TargetRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const JudgeTourModal: React.FC = () => {
  const navigate = useNavigate();
  const {
    isTourActive,
    currentStep,
    steps,
    isPaused,
    isEndCardVisible,
    pauseTour,
    resumeTour,
    skipStep,
    exitTour,
    restartTour,
    stepElapsedMs,
    totalElapsedMs,
    scriptData,
  } = useJudgeTour();

  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);

  // Measure target element position for spotlight cutout
  const updateTargetRect = useCallback(() => {
    if (!currentStep) {
      setTargetRect(null);
      return;
    }

    // Try finding element matching target selector
    const selectors = currentStep.spotlightTarget.split(',').map((s) => s.trim());
    let element: HTMLElement | null = null;

    for (const sel of selectors) {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (el) {
        element = el;
        break;
      }
    }

    if (element) {
      const rect = element.getBoundingClientRect();
      setTargetRect({
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
      });

      // Scroll into view if offscreen (essential for 380px phone width)
      const inView =
        rect.top >= 0 &&
        rect.bottom <= window.innerHeight &&
        rect.left >= 0 &&
        rect.right <= window.innerWidth;

      if (!inView) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } else {
      // Fallback: centered focus rectangle if target not currently rendered
      setTargetRect({
        x: Math.max(20, window.innerWidth / 2 - 200),
        y: Math.max(80, window.innerHeight / 2 - 120),
        width: Math.min(400, window.innerWidth - 40),
        height: 240,
      });
    }
  }, [currentStep]);

  // Update target rect on step change, resize, and scroll
  useEffect(() => {
    if (!isTourActive || isEndCardVisible) return;

    // Small delay to allow route view transition to complete
    const timer = setTimeout(() => {
      updateTargetRect();
    }, 250);

    const handleResize = () => updateTargetRect();
    const handleScroll = () => updateTargetRect();

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isTourActive, isEndCardVisible, currentStep, updateTargetRect]);

  if (!isTourActive && !isEndCardVisible) return null;

  // Total tour duration (approx 90s)
  const totalDurationMs = steps.reduce((sum, s) => sum + s.durationMs, 90000);
  const totalProgressPercent = Math.min(100, Math.round((totalElapsedMs / totalDurationMs) * 100));

  const stepDurationMs = currentStep?.durationMs || 10000;
  const stepProgressPercent = Math.min(100, Math.round((stepElapsedMs / stepDurationMs) * 100));

  const padding = 10;

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden pointer-events-auto animate-fade-in"
      data-testid="judge-tour-modal"
    >
      {/* 1. Animated Spotlight Overlay */}
      {!isEndCardVisible && (
        <svg className="fixed inset-0 w-full h-full pointer-events-none z-30">
          <defs>
            <mask id="spotlight-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              {targetRect && (
                <rect
                  x={Math.max(0, targetRect.x - padding)}
                  y={Math.max(0, targetRect.y - padding)}
                  width={targetRect.width + padding * 2}
                  height={targetRect.height + padding * 2}
                  rx="18"
                  ry="18"
                  fill="black"
                />
              )}
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="rgba(5, 7, 13, 0.78)"
            mask="url(#spotlight-mask)"
          />
        </svg>
      )}

      {/* 2. Glowing Target Frame & Tag */}
      {!isEndCardVisible && targetRect && (
        <div
          style={{
            position: 'fixed',
            left: Math.max(4, targetRect.x - padding),
            top: Math.max(4, targetRect.y - padding),
            width: targetRect.width + padding * 2,
            height: targetRect.height + padding * 2,
          }}
          className="pointer-events-none z-40 border-2 border-cyan-400 rounded-2xl shadow-[0_0_35px_rgba(115, 179, 231,0.7)] animate-pulse"
        >
          {/* Spotlight Title Tag */}
          <div className="absolute -top-7 left-0 max-w-[90vw] truncate px-2.5 py-0.5 rounded-lg bg-cyan-950/95 border border-cyan-400 text-[10px] font-mono text-cyan-200 font-extrabold uppercase tracking-wider shadow-lg">
            {currentStep?.spotlightTitle}
          </div>
        </div>
      )}

      {/* 3. Bottom Pinned Control & Caption Bar */}
      {!isEndCardVisible && currentStep && (
        <div className="fixed bottom-3 inset-x-3 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 max-w-3xl w-full z-50 pointer-events-auto">
          <div className="p-4 sm:p-5 rounded-3xl bg-[#090d16]/95 border border-cyan-500/40 backdrop-blur-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] space-y-3">
            {/* Header / Step Tracker */}
            <div className="flex items-center justify-between gap-2 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
                <span className="font-bold text-white uppercase tracking-wider">
                  JUDGE MODE (90s TOUR) · STEP {currentStep.stepIndex} OF {steps.length}
                </span>
                <span className="hidden sm:inline-block text-slate-400">·</span>
                <span className="hidden sm:inline-block text-cyan-300">{currentStep.title}</span>
              </div>

              <div className="text-slate-400 font-bold">
                {Math.round(totalElapsedMs / 1000)}s / 90s
              </div>
            </div>

            {/* Overall & Step Progress Bars */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span>90s Storyline ({totalProgressPercent}%)</span>
                <span>Step {currentStep.stepIndex} ({stepProgressPercent}%)</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full transition-all duration-200"
                  style={{ width: `${totalProgressPercent}%` }}
                />
              </div>
              <div className="w-full h-1 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full bg-cyan-400/80 rounded-full transition-all duration-200"
                  style={{ width: `${stepProgressPercent}%` }}
                />
              </div>
            </div>

            {/* Captions Text (§7.18) */}
            <div className="p-3 rounded-2xl bg-black/60 border border-white/10 text-xs sm:text-sm font-sans leading-relaxed text-slate-100">
              <p className="font-medium text-white">{currentStep.captionText}</p>
            </div>

            {/* Controls Bar: Pause/Play, Skip, Exit */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/10">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={isPaused ? resumeTour : pauseTour}
                  data-testid="judge-pause-btn"
                  className="h-9 px-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-mono font-bold flex items-center gap-1.5 transition-all"
                  title={isPaused ? 'Resume tour playback' : 'Pause tour playback'}
                >
                  {isPaused ? <Play size={14} className="text-emerald-400 fill-emerald-400" /> : <Pause size={14} />}
                  <span>{isPaused ? 'Resume' : 'Pause'}</span>
                </button>

                <button
                  type="button"
                  onClick={skipStep}
                  data-testid="judge-skip-btn"
                  className="h-9 px-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-mono font-bold flex items-center gap-1.5 transition-all"
                  title="Skip to next step"
                >
                  <span>Skip</span>
                  <SkipForward size={14} />
                </button>
              </div>

              <button
                type="button"
                onClick={exitTour}
                data-testid="judge-exit-btn"
                className="h-9 px-3.5 rounded-xl bg-red-600/20 hover:bg-red-600/40 border border-red-500/30 text-red-300 text-xs font-mono font-bold flex items-center gap-1.5 transition-all"
                title="Exit Judge Mode"
              >
                <X size={14} />
                <span>Exit Tour</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. End Card Modal (§7.18) */}
      {isEndCardVisible && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-4"
          data-testid="judge-end-card"
        >
          <div className="max-w-xl w-full rounded-3xl bg-[#090d16] border border-cyan-400/50 p-6 sm:p-8 space-y-6 shadow-[0_0_60px_rgba(115, 179, 231,0.25)] text-center animate-scale-up">
            <div className="w-16 h-16 rounded-3xl bg-cyan-500/20 border border-cyan-400 mx-auto flex items-center justify-center text-cyan-300 shadow-[0_0_20px_rgba(115, 179, 231,0.4)]">
              <Sparkles size={32} />
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-cyan-300">
                TOUR COMPLETE · NASA SPACE APPS 2026
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                HALO Autonomous Health Co-Pilot
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
                Offline-first, camera-and-touch astronaut health monitoring that becomes more autonomous the farther the crew is from Earth.
              </p>
            </div>

            {/* Demonstrated Features Highlights */}
            <div className="grid grid-cols-2 gap-2.5 text-left text-xs font-mono">
              <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 size={13} />
                  142-Day Telemetry
                </span>
                <span className="text-slate-400 text-[11px] block">
                  Deterministic seeded data with sleep decline and PVT slowing.
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
                <span className="text-cyan-400 font-bold flex items-center gap-1">
                  <CheckCircle2 size={13} />
                  Speed-of-Light Delay
                </span>
                <span className="text-slate-400 text-[11px] block">
                  {scriptData?.commDelayStr || '14 min 06 s'} delay modeled via BroadcastChannel.
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
                <span className="text-amber-400 font-bold flex items-center gap-1">
                  <CheckCircle2 size={13} />
                  Digital Twin &amp; SANS
                </span>
                <span className="text-slate-400 text-[11px] block">
                  Layered SVG body with live status colors and Amsler grid self-screening.
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
                <span className="text-red-400 font-bold flex items-center gap-1">
                  <CheckCircle2 size={13} />
                  Emergency CPR Coach
                </span>
                <span className="text-slate-400 text-[11px] block">
                  110/min metronome, decision clock, and Evetts-Russomano method.
                </span>
              </div>
            </div>

            {/* Primary Action Button (§7.18 End Card: "Try it yourself: scan your heart rate →") */}
            <div className="pt-2 space-y-3">
              <BigButton
                variant="primary"
                size="xl"
                icon={<Heart size={20} className="text-slate-950 fill-red-500" />}
                onClick={() => {
                  exitTour();
                  navigate('/scan');
                }}
                data-testid="judge-try-scan-btn"
                className="w-full text-base font-extrabold shadow-[0_0_30px_rgba(115, 179, 231,0.4)]"
              >
                Try it yourself: scan your heart rate →
              </BigButton>

              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={restartTour}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-slate-300 hover:text-white flex items-center gap-1.5 transition-all"
                >
                  <RotateCcw size={13} />
                  <span>Replay Tour</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    exitTour();
                    navigate('/');
                  }}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-slate-300 hover:text-white flex items-center gap-1.5 transition-all"
                >
                  <span>Explore Ship Bridge</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
