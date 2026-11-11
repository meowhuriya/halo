import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Radiation, ShieldAlert, X } from 'lucide-react';
import { BigButton } from '../../design/components/BigButton';

interface SpeShelterOverlayProps {
  isOpen: boolean;
  startedAt: number | null;
  missionDay: number;
  environmentName: string;
  onConfirmAllClear: (durationSeconds: number, shelterNotes: string) => Promise<void>;
  onDismiss: () => void;
}

function formatDurationMMSS(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const SpeShelterOverlay: React.FC<SpeShelterOverlayProps> = ({
  isOpen,
  startedAt,
  missionDay,
  environmentName,
  onConfirmAllClear,
  onDismiss,
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [notes, setNotes] = useState('');
  const [isLogging, setIsLogging] = useState(false);

  useEffect(() => {
    if (!isOpen || !startedAt) {
      setElapsedSeconds(0);
      return;
    }

    const tick = () => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [isOpen, startedAt]);

  if (!isOpen) return null;

  const handleLogAndClear = async () => {
    setIsLogging(true);
    try {
      await onConfirmAllClear(Math.max(1, elapsedSeconds), notes.trim());
      setNotes('');
    } finally {
      setIsLogging(false);
    }
  };

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="spe-shelter-heading"
      data-testid="spe-shelter-overlay"
      className="fixed inset-0 z-[70] bg-gradient-to-b from-[#2A0408] via-[#170306] to-[#080203] text-white overflow-y-auto p-4 sm:p-8 flex flex-col justify-between"
    >
      <div className="max-w-3xl w-full mx-auto space-y-6 my-auto">
        {/* Top Alarm Header */}
        <div className="flex items-start justify-between gap-4 border-b border-red-500/40 pb-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-600/30 border border-red-400/60 text-xs font-mono font-bold uppercase tracking-widest text-red-200 animate-pulse">
              <Radiation size={14} />
              <span>SOLAR PARTICLE EVENT (SPE) · DAY {missionDay}</span>
            </div>
            <h1
              id="spe-shelter-heading"
              className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white"
            >
              STORM SHELTER PROTOCOL ACTIVE
            </h1>
            <p className="text-sm text-red-200/90">
              Habitat: {environmentName} · High-energy solar proton flux detected. Move to maximum shielding immediately.
            </p>
          </div>

          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss SPE shelter alert"
            data-testid="dismiss-spe-btn"
            className="min-w-[56px] min-h-[56px] rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center shrink-0 cursor-pointer"
          >
            <X size={22} />
          </button>
        </div>

        {/* Live Elapsed Shelter Clock */}
        <div className="p-5 sm:p-6 rounded-3xl bg-black/55 border-2 border-red-500/60 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-[0_0_50px_rgba(239,68,68,0.28)]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-red-600/30 border border-red-400/50 flex items-center justify-center text-red-200 shrink-0">
              <Clock size={24} />
            </div>
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-red-200/80">
                Elapsed Shelter Duration
              </div>
              <div
                data-testid="spe-shelter-timer"
                className="text-3xl sm:text-4xl font-mono font-extrabold text-white tabular-nums"
              >
                {formatDurationMMSS(elapsedSeconds)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-red-500/20 border border-red-400/40 text-xs font-mono text-red-100">
            <AlertTriangle size={16} className="text-red-300 shrink-0" />
            <span>STAY SHELTERED UNTIL ALL-CLEAR</span>
          </div>
        </div>

        {/* Step-by-step Storm Shelter Checklist */}
        <div className="p-5 rounded-3xl bg-white/[0.05] border border-red-400/30 space-y-3">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-red-200">
            <ShieldAlert size={16} />
            <span>Immediate Crew Protective Actions (§7.8)</span>
          </div>
          <ol className="space-y-2.5 text-sm text-slate-100">
            <li className="flex items-start gap-3">
              <span className="font-mono font-bold text-red-300">1.</span>
              <span>Move all crew immediately to the designated storm shelter or most heavily shielded core (water bladders, supply racks, polyethylene wall liner).</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="font-mono font-bold text-red-300">2.</span>
              <span>Abort any external EVA or unshielded corridor operations and verify hatch seals.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="font-mono font-bold text-red-300">3.</span>
              <span>Keep personal electronic dosimeters clipped to chest pocket and log post-storm cumulative dose.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="font-mono font-bold text-red-300">4.</span>
              <span>Remain in shelter until radiation flux drops to background levels and confirm All-Clear below to log total exposure shelter time.</span>
            </li>
          </ol>
        </div>

        {/* Shelter Log Notes */}
        <div className="space-y-2">
          <label
            htmlFor="spe-shelter-note"
            className="block text-xs font-mono uppercase tracking-wider text-red-200/85"
          >
            Shelter Location / Dosimeter Log Note (Optional)
          </label>
          <input
            id="spe-shelter-note"
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g., Central water-wall rack bay · Personal badge read +0.8 mSv"
            className="w-full h-12 px-4 rounded-2xl bg-black/50 border border-red-400/35 text-sm text-white placeholder-slate-400 focus:border-red-300 focus:outline-none"
          />
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-1">
          <BigButton
            variant="danger"
            size="lg"
            fullWidth
            icon={<CheckCircle2 size={20} />}
            disabled={isLogging}
            onClick={() => void handleLogAndClear()}
            data-testid="confirm-spe-all-clear-btn"
          >
            {isLogging ? 'Logging Shelter Incident...' : 'Confirm All-Clear & Log Shelter Time'}
          </BigButton>

          <BigButton
            variant="secondary"
            size="lg"
            onClick={onDismiss}
            className="sm:w-auto shrink-0"
          >
            Close Alert
          </BigButton>
        </div>
      </div>
    </div>
  );
};
