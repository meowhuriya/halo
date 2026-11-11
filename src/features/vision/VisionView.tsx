import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Eye,
  Grid,
  History,
  Info,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';
import { useMission } from '../../app/MissionContext';
import { db, type HealthReading, type HealthStatus } from '../../data/db';
import { BigButton } from '../../design/components/BigButton';
import { GlassCard } from '../../design/components/GlassCard';
import { StatusBadge } from '../../design/components/StatusBadge';
import {
  AMSLER_GRID_DIVISIONS,
  BANK_CARD_WIDTH_MM,
  DEFAULT_CSS_PX_PER_MM,
  STANDARD_VIEWING_DISTANCE_CM,
  TOTAL_AMSLER_CELLS,
  compareAmslerMaps,
  computeAmslerLayout,
  computePxPerMm,
  evaluateAmslerEye,
  loadAmslerCalibration,
  normalizeCellIndices,
  saveAmslerCalibration,
  type AmslerCalibration,
  type EyeSide,
} from './amslerLogic';

// Bank card ISO/IEC 7810 ID-1 proportions: 85.60 mm × 53.98 mm
const BANK_CARD_HEIGHT_RATIO = 53.98 / BANK_CARD_WIDTH_MM;
const MIN_CARD_WIDTH_PX = 180;
const MAX_CARD_WIDTH_PX = 520;
const CELLS = Array.from({ length: TOTAL_AMSLER_CELLS }, (_, idx) => idx);

interface ParsedAmslerRecord {
  id?: number;
  timestamp: number;
  missionDay: number;
  eye: EyeSide;
  markedCells: number[] | null;
  newCells: number[];
  newDistortionCount: number;
  suddenLargeLoss: boolean;
  gridWidthCm?: number;
  viewingDistanceCm?: number;
  status: HealthStatus;
  reasons: string[];
}

function parseAmslerReading(row: HealthReading): ParsedAmslerRecord | null {
  if (typeof row.value !== 'object' || row.value === null) return null;
  const val = row.value as Record<string, unknown>;
  const eye: EyeSide = val.eye === 'left' ? 'left' : 'right';

  const markedCells = Array.isArray(val.markedCells)
    ? normalizeCellIndices(val.markedCells.filter((n): n is number => typeof n === 'number'))
    : null;

  const newCells = Array.isArray(val.newCells)
    ? normalizeCellIndices(val.newCells.filter((n): n is number => typeof n === 'number'))
    : [];

  const newDistortionCount =
    typeof val.newDistortionCount === 'number' ? val.newDistortionCount : newCells.length;

  return {
    id: row.id,
    timestamp: row.timestamp,
    missionDay: row.missionDay,
    eye,
    markedCells,
    newCells,
    newDistortionCount,
    suddenLargeLoss: Boolean(val.suddenLargeLoss),
    gridWidthCm: typeof val.gridWidthCm === 'number' ? val.gridWidthCm : undefined,
    viewingDistanceCm: typeof val.viewingDistanceCm === 'number' ? val.viewingDistanceCm : undefined,
    status: row.status,
    reasons: row.reasons ?? [],
  };
}

function eyeDisplayName(eye: EyeSide): string {
  return eye === 'right' ? 'Right Eye (OD)' : 'Left Eye (OS)';
}

function formatShortTime(ts: number): string {
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Recorded';
  }
}

export const VisionView: React.FC = () => {
  const { crew, config, refreshMission } = useMission();

  // Calibration state (§7.6 one-time credit card width calibration)
  const [calibration, setCalibration] = useState<AmslerCalibration | null>(() =>
    loadAmslerCalibration()
  );
  const [showCalibration, setShowCalibration] = useState<boolean>(() => !loadAmslerCalibration());
  const [draftCardWidthPx, setDraftCardWidthPx] = useState<number>(() => {
    const saved = loadAmslerCalibration();
    return saved ? Math.round(saved.cardWidthPx) : Math.round(BANK_CARD_WIDTH_MM * DEFAULT_CSS_PX_PER_MM);
  });

  // Grid measurement via ResizeObserver for responsive standard/small-screen layout
  const gridStageRef = useRef<HTMLDivElement | null>(null);
  const [stageWidthPx, setStageWidthPx] = useState<number>(() =>
    typeof window !== 'undefined' ? Math.max(240, window.innerWidth - 72) : 320
  );

  // Per-eye screening state
  const [activeEye, setActiveEye] = useState<EyeSide>('right');
  const [draftCellsByEye, setDraftCellsByEye] = useState<Record<EyeSide, number[]>>({
    right: [],
    left: [],
  });
  const [suddenLossByEye, setSuddenLossByEye] = useState<Record<EyeSide, boolean>>({
    right: false,
    left: false,
  });

  // Persistence & feedback state
  const [history, setHistory] = useState<ParsedAmslerRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [lastSavedBanner, setLastSavedBanner] = useState<{
    eye: EyeSide;
    status: HealthStatus;
    reasons: string[];
    newCount: number;
    persistentCount: number;
  } | null>(null);

  // Pointer drag painting state for grid cells & card calibration drag handle
  const gridDragRef = useRef<{ active: boolean; paintOn: boolean; lastIdx: number | null }>({
    active: false,
    paintOn: true,
    lastIdx: null,
  });
  const cardDragStartRef = useRef<{ active: boolean; startX: number; startWidth: number }>({
    active: false,
    startX: 0,
    startWidth: 324,
  });

  const loadHistory = useCallback(async () => {
    if (!crew?.id) {
      setHistory([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const rows = await db.healthReadings
        .where('crewMemberId')
        .equals(crew.id)
        .filter((r) => r.indicator === 'amsler')
        .toArray();

      rows.sort((a, b) => b.timestamp - a.timestamp);
      const parsed = rows
        .map(parseAmslerReading)
        .filter((item): item is ParsedAmslerRecord => item !== null);
      setHistory(parsed);
    } catch (err) {
      console.error('Failed to load Amsler grid history:', err);
      setError('Unable to load saved Amsler screening records from local storage.');
    } finally {
      setIsLoading(false);
    }
  }, [crew?.id]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  // Measure available width for 20×20 grid stage cleanly at phone (380 px) and laptop widths
  useEffect(() => {
    const el = gridStageRef.current;
    if (!el) return;

    const updateWidth = () => {
      const measured = Math.floor(el.clientWidth);
      if (measured > 0) {
        setStageWidthPx(measured);
      }
    };

    updateWidth();

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver((entries) => {
        const width = entries[0]?.contentRect.width;
        if (width && width > 0) {
          setStageWidthPx(Math.floor(width));
        }
      });
      observer.observe(el);
    }

    window.addEventListener('resize', updateWidth);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, []);

  // Global pointer release cleanup for card edge resize and grid painting
  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      if (!cardDragStartRef.current.active) return;
      const delta = e.clientX - cardDragStartRef.current.startX;
      const next = Math.round(
        Math.min(MAX_CARD_WIDTH_PX, Math.max(MIN_CARD_WIDTH_PX, cardDragStartRef.current.startWidth + delta))
      );
      setDraftCardWidthPx(next);
    };

    const onPointerUp = () => {
      gridDragRef.current.active = false;
      gridDragRef.current.lastIdx = null;
      cardDragStartRef.current.active = false;
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, []);

  const effectivePxPerMm = calibration?.pxPerMm ?? DEFAULT_CSS_PX_PER_MM;
  const draftPxPerMm = useMemo(() => computePxPerMm(draftCardWidthPx), [draftCardWidthPx]);

  // Leave 4 px margin so outer grid frame border never exceeds container width on 380 px screens
  const maxGridWidthPx = Math.max(120, stageWidthPx - 4);
  const layout = useMemo(
    () => computeAmslerLayout(effectivePxPerMm, maxGridWidthPx),
    [effectivePxPerMm, maxGridWidthPx]
  );

  // Latest saved record & latest coordinate map per eye
  const latestRecordByEye = useMemo(() => {
    const right = history.find((item) => item.eye === 'right') ?? null;
    const left = history.find((item) => item.eye === 'left') ?? null;
    return { right, left };
  }, [history]);

  const previousMapByEye = useMemo(() => {
    const rightMap = history.find((item) => item.eye === 'right' && item.markedCells !== null)?.markedCells ?? null;
    const leftMap = history.find((item) => item.eye === 'left' && item.markedCells !== null)?.markedCells ?? null;
    return { right: rightMap, left: leftMap };
  }, [history]);

  const activeDraftCells = draftCellsByEye[activeEye];
  const activePreviousCells = previousMapByEye[activeEye];
  const activeSuddenLoss = suddenLossByEye[activeEye];

  const activeDraftSet = useMemo(() => new Set(activeDraftCells), [activeDraftCells]);
  const activePrevSet = useMemo(
    () => new Set(activePreviousCells ?? []),
    [activePreviousCells]
  );

  const liveDiff = useMemo(
    () => compareAmslerMaps(activeDraftCells, activePreviousCells),
    [activeDraftCells, activePreviousCells]
  );

  const headerStatus: HealthStatus = useMemo(() => {
    const rank: Record<HealthStatus, number> = {
      NOMINAL: 0,
      WATCH: 1,
      ALERT: 2,
      CRITICAL: 3,
    };
    const candidates: HealthStatus[] = [];
    if (latestRecordByEye.right) candidates.push(latestRecordByEye.right.status);
    if (latestRecordByEye.left) candidates.push(latestRecordByEye.left.status);
    if (lastSavedBanner) candidates.push(lastSavedBanner.status);
    if (candidates.length === 0) return 'NOMINAL';
    return candidates.reduce((best, cur) => (rank[cur] > rank[best] ? cur : best), 'NOMINAL');
  }, [lastSavedBanner, latestRecordByEye]);

  const applyCellState = useCallback(
    (idx: number, paintOn: boolean) => {
      if (idx < 0 || idx >= TOTAL_AMSLER_CELLS) return;
      setDraftCellsByEye((prev) => {
        const current = prev[activeEye];
        const exists = current.includes(idx);
        if (paintOn && !exists) {
          return { ...prev, [activeEye]: normalizeCellIndices([...current, idx]) };
        }
        if (!paintOn && exists) {
          return { ...prev, [activeEye]: current.filter((c) => c !== idx) };
        }
        return prev;
      });
    },
    [activeEye]
  );

  const handleCellPointerDown = useCallback(
    (idx: number, e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      const willPaintOn = !activeDraftSet.has(idx);
      gridDragRef.current = { active: true, paintOn: willPaintOn, lastIdx: idx };
      applyCellState(idx, willPaintOn);
    },
    [activeDraftSet, applyCellState]
  );

  const handleGridPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!gridDragRef.current.active) return;
      const hit = document.elementFromPoint(e.clientX, e.clientY);
      const cellEl = hit?.closest('[data-cell-index]');
      if (!cellEl) return;
      const rawIdx = cellEl.getAttribute('data-cell-index');
      if (rawIdx === null) return;
      const idx = Number(rawIdx);
      if (Number.isInteger(idx) && idx !== gridDragRef.current.lastIdx) {
        gridDragRef.current.lastIdx = idx;
        applyCellState(idx, gridDragRef.current.paintOn);
      }
    },
    [applyCellState]
  );

  const handleCellClick = useCallback(
    (idx: number, e: React.MouseEvent<HTMLButtonElement>) => {
      // Only handle keyboard / synthetic clicks (detail === 0); pointer clicks are handled in pointerdown
      if (e.detail === 0) {
        applyCellState(idx, !activeDraftSet.has(idx));
      }
    },
    [activeDraftSet, applyCellState]
  );

  const handleSaveCalibration = useCallback(() => {
    const saved = saveAmslerCalibration(draftCardWidthPx);
    setCalibration(saved);
    setShowCalibration(false);
  }, [draftCardWidthPx]);

  const handleClearEyeMarks = useCallback(() => {
    setDraftCellsByEye((prev) => ({ ...prev, [activeEye]: [] }));
    setSuddenLossByEye((prev) => ({ ...prev, [activeEye]: false }));
  }, [activeEye]);

  const handleCopyPreviousMap = useCallback(() => {
    if (!activePreviousCells) return;
    setDraftCellsByEye((prev) => ({
      ...prev,
      [activeEye]: normalizeCellIndices(activePreviousCells),
    }));
  }, [activeEye, activePreviousCells]);

  const handleSaveEyeScreening = useCallback(async () => {
    if (!crew?.id) {
      setError('Crew profile is required before saving an Amsler screening.');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const { diff, evaluation } = evaluateAmslerEye(
        activeDraftCells,
        activePreviousCells,
        activeSuddenLoss
      );

      const valuePayload: Record<string, unknown> = {
        eye: activeEye,
        markedCells: diff.currentCells,
        newCells: diff.newCells,
        newDistortionCount: diff.newCells.length,
        suddenLargeLoss: activeSuddenLoss,
        gridWidthCm: layout.gridWidthCm,
        viewingDistanceCm: layout.viewingDistanceCm,
      };

      await db.healthReadings.add({
        crewMemberId: crew.id,
        timestamp: Date.now(),
        missionDay: config?.missionDay ?? 1,
        indicator: 'amsler',
        value: valuePayload,
        unit: 'grid',
        status: evaluation.status,
        reasons: evaluation.reasons,
        source: 'amsler',
      });

      const pendingAmslerTasks = await db.tasks
        .where('crewMemberId')
        .equals(crew.id)
        .filter((t) => t.taskType === 'amsler' && t.status !== 'completed')
        .toArray();
      for (const task of pendingAmslerTasks) {
        if (task.id) {
          await db.tasks.update(task.id, {
            status: 'completed',
            completedAt: Date.now(),
          });
        }
      }

      setLastSavedBanner({
        eye: activeEye,
        status: evaluation.status,
        reasons: evaluation.reasons,
        newCount: diff.newCells.length,
        persistentCount: diff.persistentCells.length,
      });

      await refreshMission();
      await loadHistory();
    } catch (err) {
      console.error('Failed to save Amsler eye map:', err);
      setError('Unable to save this eye screening to IndexedDB.');
    } finally {
      setIsSaving(false);
    }
  }, [
    activeDraftCells,
    activeEye,
    activePreviousCells,
    activeSuddenLoss,
    config?.missionDay,
    crew?.id,
    layout.gridWidthCm,
    layout.viewingDistanceCm,
    loadHistory,
    refreshMission,
  ]);

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Eye size={16} className="text-cyan-400 shrink-0" />
            <span className="text-xs font-mono tracking-widest text-cyan-300 uppercase">
              NEURO-OCULAR SELF-SCREEN
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Amsler Grid Vision Check
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            Calibrated macular &amp; SANS distortion screen — check Right and Left eyes separately
          </p>
        </div>

        <div className="flex items-center gap-3">
          <StatusBadge status={headerStatus} />
          <BigButton
            variant="glass"
            size="md"
            icon={<SlidersHorizontal size={18} />}
            onClick={() => {
              setDraftCardWidthPx(
                calibration
                  ? Math.round(calibration.cardWidthPx)
                  : Math.round(BANK_CARD_WIDTH_MM * DEFAULT_CSS_PX_PER_MM)
              );
              setShowCalibration((open) => !open);
            }}
            data-testid="toggle-calibration-btn"
          >
            {calibration ? 'Recalibrate' : 'Calibrate'}
          </BigButton>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-red-500/10 border border-red-500/35 text-red-200 text-sm flex items-start gap-3"
        >
          <AlertTriangle size={18} className="shrink-0 mt-0.5 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Bank Card Calibration Panel (§7.6) */}
      {showCalibration && (
        <GlassCard variant="cyan" padded="md" className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-cyan-300 text-xs font-mono uppercase tracking-wider mb-1">
                <CreditCard size={16} />
                <span>Screen Calibration · ISO Bank Card (85.6 mm)</span>
              </div>
              <h2 className="text-lg font-bold text-white">
                Match rectangle to a physical bank or ID card
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 mt-1">
                Hold a standard credit/bank card against your display and adjust the width until the blue card matches its horizontal edges.
              </p>
            </div>
            <div className="text-right font-mono text-xs bg-slate-950/60 border border-cyan-500/30 rounded-xl px-3 py-2">
              <div className="text-cyan-300 font-bold" data-testid="calibration-px-per-mm">
                {draftPxPerMm.toFixed(2)} px/mm
              </div>
              <div className="text-slate-400">
                10 cm grid = {Math.round(100 * draftPxPerMm)} px
              </div>
            </div>
          </div>

          {/* Card calibration stage with horizontal scroll fallback inside card if resized wide on phones */}
          <div className="overflow-x-auto py-3 px-2 rounded-2xl bg-slate-950/75 border border-white/10">
            <div className="flex items-center justify-center min-w-fit">
              <div
                data-testid="calibration-card-rect"
                className="relative rounded-xl border-2 border-cyan-400 bg-gradient-to-br from-cyan-500/20 via-slate-900 to-indigo-500/20 shadow-[0_0_25px_rgba(34,211,238,0.2)] flex flex-col justify-between p-4 select-none shrink-0"
                style={{
                  width: `${draftCardWidthPx}px`,
                  height: `${Math.round(draftCardWidthPx * BANK_CARD_HEIGHT_RATIO)}px`,
                }}
              >
                <div className="flex items-center justify-between text-[11px] font-mono text-cyan-200/90">
                  <span>BANK / ID CARD</span>
                  <span>85.6 mm</span>
                </div>
                <div className="w-10 h-7 rounded bg-amber-300/30 border border-amber-300/60" />
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-300">
                  <span>Width: {draftCardWidthPx} px</span>
                  <span>Drag edge →</span>
                </div>

                {/* Draggable right edge handle */}
                <button
                  type="button"
                  aria-label="Drag right edge to match card width"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    cardDragStartRef.current = {
                      active: true,
                      startX: e.clientX,
                      startWidth: draftCardWidthPx,
                    };
                  }}
                  className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-14 rounded-lg bg-cyan-400 text-slate-950 font-bold flex items-center justify-center shadow-lg cursor-ew-resize touch-none"
                >
                  ‖
                </button>
              </div>
            </div>
          </div>

          {/* Slider + 56 px stepper buttons */}
          <div className="space-y-3">
            <label className="block text-xs font-mono uppercase tracking-wider text-slate-300">
              Card Width: <span className="text-white font-bold">{draftCardWidthPx} px</span>
            </label>
            <input
              type="range"
              aria-label="Bank card width in pixels"
              min={MIN_CARD_WIDTH_PX}
              max={MAX_CARD_WIDTH_PX}
              step={1}
              value={draftCardWidthPx}
              onChange={(e) => setDraftCardWidthPx(Number(e.target.value))}
              className="w-full h-11 accent-cyan-400 cursor-pointer"
              data-testid="calibration-slider"
            />

            <div className="grid grid-cols-4 gap-2">
              {([-5, -1, 1, 5] as const).map((delta) => (
                <button
                  key={delta}
                  type="button"
                  onClick={() =>
                    setDraftCardWidthPx((w) =>
                      Math.min(MAX_CARD_WIDTH_PX, Math.max(MIN_CARD_WIDTH_PX, w + delta))
                    )
                  }
                  className="min-h-[56px] rounded-xl bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/15 text-sm font-mono font-bold text-slate-100 transition-colors cursor-pointer"
                >
                  {delta > 0 ? `+${delta} px` : `${delta} px`}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <BigButton
              variant="primary"
              size="md"
              icon={<CheckCircle2 size={18} />}
              onClick={handleSaveCalibration}
              data-testid="save-calibration-btn"
              className="flex-1 min-w-[200px]"
            >
              Save Screen Calibration
            </BigButton>
            {calibration && (
              <BigButton
                variant="ghost"
                size="md"
                onClick={() => setShowCalibration(false)}
              >
                Cancel
              </BigButton>
            )}
          </div>
        </GlassCard>
      )}

      {/* Calibration notice if user bypassed/closed without calibrating */}
      {!calibration && !showCalibration && (
        <GlassCard variant="alert" padded="sm" className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs sm:text-sm text-amber-100">
            Using estimated default display scale ({DEFAULT_CSS_PX_PER_MM.toFixed(2)} px/mm). Calibrate with a bank card for accurate 5 mm grid sizing.
          </div>
          <BigButton
            variant="secondary"
            size="md"
            icon={<CreditCard size={18} />}
            onClick={() => setShowCalibration(true)}
          >
            Calibrate Now
          </BigButton>
        </GlassCard>
      )}

      {/* Main Screening Workspace */}
      <GlassCard variant="default" padded="md" className="space-y-5">
        {/* Right Eye / Left Eye selector */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(['right', 'left'] as const).map((eye) => {
            const isSelected = activeEye === eye;
            const latest = latestRecordByEye[eye];
            const draftCount = draftCellsByEye[eye].length;
            return (
              <button
                key={eye}
                type="button"
                onClick={() => setActiveEye(eye)}
                data-testid={`eye-tab-${eye}`}
                className={`min-h-[56px] p-3.5 rounded-2xl border text-left transition-colors flex items-center justify-between gap-3 cursor-pointer ${
                  isSelected
                    ? 'bg-cyan-400/15 border-cyan-400 text-white shadow-[0_0_20px_rgba(34,211,238,0.18)]'
                    : 'bg-white/[0.04] border-white/10 text-slate-300 hover:bg-white/[0.08]'
                }`}
              >
                <div>
                  <div className="font-bold text-sm sm:text-base">{eyeDisplayName(eye)}</div>
                  <div className="text-xs text-slate-400">
                    {eye === 'right' ? 'Cover left eye · Stare at center dot' : 'Cover right eye · Stare at center dot'}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {latest ? (
                    <StatusBadge status={latest.status} />
                  ) : (
                    <span className="text-[11px] font-mono text-slate-400 px-2 py-0.5 rounded bg-white/5 border border-white/10">
                      NO DATA
                    </span>
                  )}
                  {draftCount > 0 && (
                    <span className="text-[11px] font-mono text-cyan-300">
                      {draftCount} draft
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Geometry & Viewing Distance Rule Banner (§7.6 Standard vs Small-Screen 3 × width) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-2xl bg-slate-950/65 border border-cyan-500/20">
          <div>
            <div className="text-[11px] font-mono uppercase text-slate-400">Grid Size (20 × 20)</div>
            <div className="text-base font-bold text-white font-mono" data-testid="amsler-grid-size-label">
              {layout.gridWidthCm.toFixed(1)} cm × {layout.gridWidthCm.toFixed(1)} cm
            </div>
            <div className="text-xs text-slate-400">{layout.cellWidthMm.toFixed(1)} mm squares</div>
          </div>

          <div>
            <div className="text-[11px] font-mono uppercase text-slate-400">Hold Screen Distance</div>
            <div className="text-base font-bold text-cyan-300 font-mono" data-testid="amsler-distance-label">
              {layout.viewingDistanceCm} cm
            </div>
            <div className="text-xs text-slate-300">
              {layout.isScaledDown
                ? `Small screen rule: 3 × ${layout.gridWidthCm.toFixed(1)} cm grid width`
                : `Standard distance (3 × 10.0 cm = ${STANDARD_VIEWING_DISTANCE_CM} cm)`}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-mono uppercase text-slate-400">Calibration Scale</div>
            <div className="text-base font-bold text-white font-mono">
              {effectivePxPerMm.toFixed(2)} px/mm
            </div>
            <div className="text-xs text-slate-400">
              {calibration ? 'Bank-card calibrated' : 'Estimated CSS default'}
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="text-xs sm:text-sm text-slate-200 bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3">
          <strong>Instructions for {eyeDisplayName(activeEye)}:</strong>{' '}
          Hold the screen at <strong className="text-cyan-300">{layout.viewingDistanceCm} cm</strong>, cover your{' '}
          <strong>{activeEye === 'right' ? 'left' : 'right'}</strong> eye, fixate steadily on the center white dot, and{' '}
          <span className="text-cyan-200">tap or drag over any squares that look wavy, blurred, dark, or missing</span>.
        </div>

        {/* Interactive 20 × 20 Amsler Grid Stage */}
        <div ref={gridStageRef} className="w-full flex flex-col items-center">
          <div
            data-testid="amsler-grid"
            data-grid-px={Math.round(layout.gridPx)}
            data-grid-cm={layout.gridWidthCm.toFixed(1)}
            data-distance-cm={layout.viewingDistanceCm}
            data-scaled-down={layout.isScaledDown ? 'true' : 'false'}
            role="grid"
            aria-label={`Amsler grid 20 by 20 for ${eyeDisplayName(activeEye)}`}
            onPointerMove={handleGridPointerMove}
            className="relative grid border border-slate-300/70 bg-[#050811] select-none touch-none shadow-[0_0_30px_rgba(0,0,0,0.65)] box-content"
            style={{
              width: `${Math.round(layout.gridPx)}px`,
              height: `${Math.round(layout.gridPx)}px`,
              gridTemplateColumns: `repeat(${AMSLER_GRID_DIVISIONS}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${AMSLER_GRID_DIVISIONS}, minmax(0, 1fr))`,
            }}
          >
            {CELLS.map((idx) => {
              const row = Math.floor(idx / AMSLER_GRID_DIVISIONS);
              const col = idx % AMSLER_GRID_DIVISIONS;
              const isMarked = activeDraftSet.has(idx);
              const wasPrevious = activePrevSet.has(idx);

              let cellBgClass = 'bg-transparent hover:bg-cyan-400/15';
              if (isMarked && wasPrevious) {
                cellBgClass = 'bg-amber-400/60 hover:bg-amber-400/75';
              } else if (isMarked && !wasPrevious) {
                cellBgClass = 'bg-red-500/65 hover:bg-red-500/80';
              } else if (!isMarked && wasPrevious) {
                cellBgClass = 'bg-amber-500/15 ring-1 ring-inset ring-amber-400/65';
              }

              // Strengthen central meridian crosshairs (between col 9|10 and row 9|10)
              const borderClasses = [
                'border-[0.5px] border-slate-500/45',
                col === 9 ? 'border-r border-r-slate-300/75' : '',
                row === 9 ? 'border-b border-b-slate-300/75' : '',
              ].join(' ');

              return (
                <button
                  key={idx}
                  type="button"
                  role="gridcell"
                  data-cell-index={idx}
                  aria-pressed={isMarked}
                  aria-label={`Row ${row + 1} column ${col + 1}${
                    isMarked ? ', marked distorted' : wasPrevious ? ', previously distorted' : ''
                  }`}
                  onPointerDown={(e) => handleCellPointerDown(idx, e)}
                  onClick={(e) => handleCellClick(idx, e)}
                  className={`w-full h-full p-0 m-0 focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-300 cursor-crosshair ${borderClasses} ${cellBgClass}`}
                />
              );
            })}

            {/* Central Fixation Dot */}
            <div
              data-testid="amsler-fixation-dot"
              className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.95)] ring-2 ring-cyan-300/70"
            />
          </div>

          {/* Grid legend */}
          <div className="flex flex-wrap items-center justify-center gap-4 mt-3 text-xs text-slate-300">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-red-500/70 border border-red-300/70" />
              New distortion
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-amber-400/65 border border-amber-300/70" />
              Persistent distortion
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-amber-500/15 ring-1 ring-amber-400/70" />
              Previously marked
            </span>
          </div>
        </div>

        {/* Live map comparison metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
            <div className="text-lg font-extrabold font-mono text-white" data-testid="amsler-marked-count">
              {liveDiff.currentCells.length}
            </div>
            <div className="text-[11px] font-mono uppercase text-slate-400">Marked Cells</div>
          </div>
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
            <div className="text-lg font-extrabold font-mono text-red-300" data-testid="amsler-new-count">
              {liveDiff.newCells.length}
            </div>
            <div className="text-[11px] font-mono uppercase text-slate-400">New vs Prior</div>
          </div>
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
            <div className="text-lg font-extrabold font-mono text-amber-300" data-testid="amsler-persistent-count">
              {liveDiff.persistentCells.length}
            </div>
            <div className="text-[11px] font-mono uppercase text-slate-400">Persistent</div>
          </div>
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
            <div className="text-lg font-extrabold font-mono text-emerald-300">
              {liveDiff.resolvedCells.length}
            </div>
            <div className="text-[11px] font-mono uppercase text-slate-400">Cleared</div>
          </div>
        </div>

        {/* Sudden Central Vision Loss Toggle (CRITICAL flag per §6 / §7.6) */}
        <button
          type="button"
          role="switch"
          aria-checked={activeSuddenLoss}
          onClick={() =>
            setSuddenLossByEye((prev) => ({ ...prev, [activeEye]: !prev[activeEye] }))
          }
          data-testid="sudden-loss-toggle"
          className={`w-full min-h-[56px] px-4 py-3 rounded-2xl border text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
            activeSuddenLoss
              ? 'bg-red-500/20 border-red-400 text-red-100'
              : 'bg-white/[0.03] border-white/10 text-slate-300 hover:bg-white/[0.06]'
          }`}
        >
          <div className="flex items-center gap-3">
            <AlertTriangle
              size={18}
              className={activeSuddenLoss ? 'text-red-400 shrink-0' : 'text-slate-400 shrink-0'}
            />
            <div>
              <div className="text-sm font-semibold">
                Sudden large loss or blanking in central vision
              </div>
              <div className="text-xs text-slate-400">
                Flags immediate medical alert (CRITICAL) for {eyeDisplayName(activeEye)}
              </div>
            </div>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-mono font-bold shrink-0 ${
              activeSuddenLoss
                ? 'bg-red-500 text-white'
                : 'bg-white/10 text-slate-300'
            }`}
          >
            {activeSuddenLoss ? 'YES' : 'NO'}
          </span>
        </button>

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          <BigButton
            variant="primary"
            size="md"
            icon={<Grid size={18} />}
            disabled={isSaving}
            onClick={() => void handleSaveEyeScreening()}
            data-testid="save-amsler-btn"
            className="flex-1 min-w-[210px]"
          >
            {isSaving ? 'Saving...' : `Save ${eyeDisplayName(activeEye)} Screening`}
          </BigButton>

          {activePreviousCells && activePreviousCells.length > 0 && (
            <BigButton
              variant="secondary"
              size="md"
              onClick={handleCopyPreviousMap}
              data-testid="copy-prev-map-btn"
            >
              Match Prior Map ({activePreviousCells.length})
            </BigButton>
          )}

          <BigButton
            variant="ghost"
            size="md"
            icon={<RotateCcw size={18} />}
            onClick={handleClearEyeMarks}
            data-testid="clear-grid-btn"
          >
            Clear Marks
          </BigButton>
        </div>

        {/* Last Save Confirmation Banner */}
        {lastSavedBanner && (
          <div
            data-testid="amsler-save-result"
            className={`p-4 rounded-2xl border space-y-2 ${
              lastSavedBanner.status === 'NOMINAL'
                ? 'bg-emerald-500/10 border-emerald-400/35 text-emerald-100'
                : lastSavedBanner.status === 'WATCH'
                  ? 'bg-amber-500/10 border-amber-400/35 text-amber-100'
                  : 'bg-red-500/15 border-red-400/45 text-red-100'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold text-sm">
                Saved {eyeDisplayName(lastSavedBanner.eye)}
              </span>
              <StatusBadge status={lastSavedBanner.status} />
            </div>
            <p className="text-xs sm:text-sm">
              {lastSavedBanner.reasons[0] ?? 'Screening recorded.'}
            </p>
            <div className="text-xs font-mono opacity-85">
              New distorted cells: {lastSavedBanner.newCount} · Persistent: {lastSavedBanner.persistentCount}
            </div>
          </div>
        )}
      </GlassCard>

      {/* Per-Eye Latest Comparison & History */}
      <GlassCard variant="default" padded="md" className="space-y-4">
        <div className="flex items-center gap-2">
          <History size={18} className="text-cyan-400" />
          <h2 className="text-lg font-bold text-white">Per-Eye Comparison &amp; History</h2>
        </div>

        {isLoading ? (
          <div className="py-6 text-center text-sm text-slate-400">
            Loading local Amsler records...
          </div>
        ) : history.length === 0 ? (
          <div
            data-testid="amsler-empty-history"
            className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 text-center text-sm text-slate-400"
          >
            No Amsler screenings recorded yet for Right or Left eye. Complete both eyes to establish your reference maps.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(['right', 'left'] as const).map((eye) => {
                const latest = latestRecordByEye[eye];
                return (
                  <div
                    key={eye}
                    data-testid={`latest-eye-card-${eye}`}
                    className="p-4 rounded-2xl bg-slate-950/60 border border-white/10 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-white text-sm">{eyeDisplayName(eye)}</span>
                      {latest ? (
                        <StatusBadge status={latest.status} />
                      ) : (
                        <span className="text-xs font-mono text-slate-500">Not checked</span>
                      )}
                    </div>
                    {latest ? (
                      <>
                        <div className="text-xs font-mono text-slate-400">
                          Day {latest.missionDay} · {formatShortTime(latest.timestamp)}
                        </div>
                        <div className="text-xs text-slate-200">
                          {latest.markedCells !== null ? (
                            <>
                              {latest.markedCells.length} marked squares ({latest.newCells.length} new)
                            </>
                          ) : (
                            <>
                              Summary record: {latest.newDistortionCount} distorted region(s)
                            </>
                          )}
                        </div>
                        {latest.reasons[0] && (
                          <div className="text-xs text-slate-300">{latest.reasons[0]}</div>
                        )}
                      </>
                    ) : (
                      <div className="text-xs text-slate-400">
                        No reading logged yet for this eye.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Recent history list */}
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {history.slice(0, 10).map((entry, idx) => (
                <div
                  key={entry.id ?? `${entry.timestamp}-${idx}`}
                  className="p-3 rounded-xl bg-white/[0.03] border border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <span className="font-semibold text-white">{eyeDisplayName(entry.eye)}</span>
                    <span className="text-slate-400 font-mono ml-2">
                      Day {entry.missionDay} · {formatShortTime(entry.timestamp)}
                    </span>
                    <div className="text-slate-300 mt-0.5">
                      {entry.markedCells !== null
                        ? `${entry.markedCells.length} marked · ${entry.newCells.length} new`
                        : `${entry.newDistortionCount} distortion(s) reported`}
                      {entry.gridWidthCm && entry.viewingDistanceCm
                        ? ` · ${entry.gridWidthCm.toFixed(1)} cm @ ${entry.viewingDistanceCm} cm`
                        : ''}
                    </div>
                  </div>
                  <StatusBadge status={entry.status} />
                </div>
              ))}
            </div>
          </div>
        )}
      </GlassCard>

      {/* Mandatory SANS Clinical Context Card (§7.6) */}
      <GlassCard variant="subtle" padded="md" className="space-y-2">
        <div className="flex items-center gap-2 text-cyan-300 text-xs font-mono uppercase tracking-wider">
          <Info size={16} />
          <span>About SANS (Spaceflight Associated Neuro-ocular Syndrome)</span>
        </div>
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
          Microgravity causes fluid to shift toward the head, increasing pressure behind the eyes. Over weeks to months this can flatten the back of the globe and produce <strong className="text-white">optic disc swelling</strong> or <strong className="text-white">choroidal folds</strong>, which often show up early on an Amsler grid as wavy lines, blurred squares, or blind spots near the center.
        </p>
        <p className="text-xs text-amber-200/90 leading-relaxed">
          <strong>Clinical limit:</strong> This self-screen helps spot new symptoms between checkups and <strong>does not replace onboard OCT imaging or dilated fundoscopy</strong>.
        </p>
      </GlassCard>
    </div>
  );
};
