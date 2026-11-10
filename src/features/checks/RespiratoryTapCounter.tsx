import React, { useState, useEffect, useRef } from 'react';
import { Play, RotateCcw, Wind } from 'lucide-react';

interface RespiratoryTapCounterProps {
  onComplete: (calculatedRate: number) => void;
  onCancel?: () => void;
}

export const RespiratoryTapCounter: React.FC<RespiratoryTapCounterProps> = ({ onComplete }) => {
  const [isActive, setIsActive] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(30);
  const [breathCount, setBreathCount] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (isActive && secondsRemaining > 0) {
      timerRef.current = window.setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            setIsActive(false);
            setIsFinished(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, secondsRemaining]);

  useEffect(() => {
    if (isFinished) {
      const calculatedBpm = breathCount * 2;
      onComplete(calculatedBpm);
    }
  }, [isFinished, breathCount, onComplete]);

  const handleStart = () => {
    setBreathCount(0);
    setSecondsRemaining(30);
    setIsFinished(false);
    setIsActive(true);
  };

  const handleReset = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsActive(false);
    setIsFinished(false);
    setSecondsRemaining(30);
    setBreathCount(0);
  };

  const handleTap = () => {
    if (!isActive) {
      // First tap starts the timer automatically
      handleStart();
      setBreathCount(1);
    } else {
      setBreathCount((prev) => prev + 1);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-black/40 border border-white/10 space-y-5">
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2">
          <Wind size={16} className="text-cyan-400" />
          <span className="text-xs font-mono uppercase tracking-wider text-cyan-300">
            30-Second Breath Tap Timer
          </span>
        </div>
        <span className="text-sm font-mono text-slate-300">
          {secondsRemaining}s remaining
        </span>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
        <div
          className="bg-cyan-400 h-full transition-all duration-1000 ease-linear"
          style={{ width: `${((30 - secondsRemaining) / 30) * 100}%` }}
        />
      </div>

      {/* Big Interactive Tap Target */}
      <button
        onClick={handleTap}
        disabled={isFinished}
        className={`w-44 h-44 rounded-full flex flex-col items-center justify-center gap-2 transition-all transform active:scale-95 shadow-xl min-h-[56px] min-w-[56px] ${
          isActive
            ? 'bg-cyan-500/20 border-4 border-cyan-400 hover:bg-cyan-500/30 shadow-cyan-500/30 animate-pulse'
            : isFinished
            ? 'bg-emerald-500/20 border-4 border-emerald-400 opacity-90'
            : 'bg-white/5 border-2 border-dashed border-white/20 hover:border-cyan-400 hover:bg-white/10'
        }`}
      >
        <Wind
          size={36}
          className={
            isActive
              ? 'text-cyan-300 animate-bounce'
              : isFinished
              ? 'text-emerald-400'
              : 'text-slate-400'
          }
        />
        <div className="text-center">
          <span className="text-2xl font-black font-mono text-white block">
            {breathCount}
          </span>
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-300">
            {isActive
              ? 'Tap On Each Inhale'
              : isFinished
              ? 'Count Complete'
              : 'Tap to Start'}
          </span>
        </div>
      </button>

      {/* Live readout / controls */}
      <div className="flex items-center gap-4 text-xs font-mono">
        <span className="text-slate-400">
          Breaths Counted: <strong className="text-white">{breathCount}</strong>
        </span>
        <span className="text-slate-500">|</span>
        <span className="text-cyan-300">
          Estimated Rate: <strong className="text-white">{breathCount * 2}</strong> /min
        </span>
      </div>

      {/* Reset / Restart Controls */}
      <div className="flex items-center gap-3">
        {isActive && (
          <button
            onClick={handleReset}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-mono text-slate-300 flex items-center gap-1.5 min-h-[44px]"
          >
            <RotateCcw size={14} />
            <span>Reset</span>
          </button>
        )}
        {isFinished && (
          <button
            onClick={handleStart}
            className="px-4 py-2 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30 text-xs font-mono flex items-center gap-1.5 min-h-[44px]"
          >
            <Play size={14} />
            <span>Repeat Test</span>
          </button>
        )}
      </div>
    </div>
  );
};
