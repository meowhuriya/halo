import { evaluateReading, type ComprehensiveEvaluation } from '../../engine/rules';

// ── Amsler Grid & Calibration Constants per HALO_SPEC.md §7.6 ───────────────

export const BANK_CARD_WIDTH_MM = 85.6; // ISO/IEC 7810 ID-1 bank card width
export const STANDARD_GRID_WIDTH_MM = 100; // 10 cm × 10 cm clinical chart
export const AMSLER_GRID_DIVISIONS = 20; // 20 × 20 squares (5 mm each at 10 cm)
export const TOTAL_AMSLER_CELLS = AMSLER_GRID_DIVISIONS * AMSLER_GRID_DIVISIONS; // 400
export const STANDARD_VIEWING_DISTANCE_CM = 30; // 3 × 10 cm
export const DEFAULT_CSS_PX_PER_MM = 96 / 25.4; // ~3.7795 fallback before card calibration

export type EyeSide = 'right' | 'left';

export interface AmslerLayoutSpec {
  gridPx: number;
  gridWidthCm: number;
  cellWidthMm: number;
  viewingDistanceCm: number;
  isScaledDown: boolean;
}

export interface AmslerDiffResult {
  currentCells: number[];
  newCells: number[];
  persistentCells: number[];
  resolvedCells: number[];
  hasDistortion: boolean;
  isNewDistortion: boolean;
}

export interface StoredAmslerEyeReading {
  eye: EyeSide;
  markedCells: number[];
  newCells: number[];
  newDistortionCount: number;
  suddenLargeLoss?: boolean;
  gridWidthCm?: number;
  viewingDistanceCm?: number;
}

export interface AmslerCalibration {
  pxPerMm: number;
  cardWidthPx: number;
  calibratedAt: number;
}

const CALIBRATION_STORAGE_KEY = 'halo_amsler_calibration';

/**
 * Compute px per mm from resized bank card rectangle width (85.6 mm).
 */
export function computePxPerMm(cardWidthPx: number): number {
  const safePx = Math.max(85.6, cardWidthPx);
  return Math.round((safePx / BANK_CARD_WIDTH_MM) * 1000) / 1000;
}

/**
 * Compute rendered 20×20 Amsler grid size & viewing distance per §7.6 (v3):
 * - Standard: 10 cm × 10 cm of 5 mm squares, hold at 30 cm.
 * - Small screen rule: if 10 cm does not fit, render the largest 20 × 20 grid
 *   that fits and compute viewing distance = 3 × grid width (cm) to preserve
 *   1° visual angle per square (e.g., 6.6 cm grid → 20 cm).
 */
export function computeAmslerLayout(
  pxPerMm: number,
  maxAvailablePx: number
): AmslerLayoutSpec {
  const safePxPerMm = pxPerMm > 0 ? pxPerMm : DEFAULT_CSS_PX_PER_MM;
  const standardPx = STANDARD_GRID_WIDTH_MM * safePxPerMm;
  const safeAvailable = Math.max(120, Math.floor(maxAvailablePx));

  if (standardPx <= safeAvailable) {
    return {
      gridPx: standardPx,
      gridWidthCm: 10.0,
      cellWidthMm: 5.0,
      viewingDistanceCm: STANDARD_VIEWING_DISTANCE_CM,
      isScaledDown: false,
    };
  }

  const gridPx = safeAvailable;
  const widthMm = gridPx / safePxPerMm;
  const widthCmExact = widthMm / 10;

  return {
    gridPx,
    gridWidthCm: Math.round(widthCmExact * 10) / 10,
    cellWidthMm: Math.round((widthMm / AMSLER_GRID_DIVISIONS) * 10) / 10,
    viewingDistanceCm: Math.round(3 * widthCmExact),
    isScaledDown: true,
  };
}

/**
 * Normalize a list of cell indices (0..399): unique, sorted ascending, valid bounds.
 */
export function normalizeCellIndices(cells: number[]): number[] {
  const valid = new Set<number>();
  for (const c of cells) {
    if (Number.isInteger(c) && c >= 0 && c < TOTAL_AMSLER_CELLS) {
      valid.add(c);
    }
  }
  return Array.from(valid).sort((a, b) => a - b);
}

/**
 * Compare current marked cells against the previous saved map for the same eye (§7.6).
 */
export function compareAmslerMaps(
  currentCells: number[],
  previousCells: number[] | null
): AmslerDiffResult {
  const current = normalizeCellIndices(currentCells);

  if (previousCells === null) {
    return {
      currentCells: current,
      newCells: current,
      persistentCells: [],
      resolvedCells: [],
      hasDistortion: current.length > 0,
      isNewDistortion: current.length > 0,
    };
  }

  const previous = normalizeCellIndices(previousCells);
  const prevSet = new Set(previous);
  const currSet = new Set(current);

  const newCells = current.filter((c) => !prevSet.has(c));
  const persistentCells = current.filter((c) => prevSet.has(c));
  const resolvedCells = previous.filter((c) => !currSet.has(c));

  return {
    currentCells: current,
    newCells,
    persistentCells,
    resolvedCells,
    hasDistortion: current.length > 0,
    isNewDistortion: newCells.length > 0,
  };
}

/**
 * Evaluate a single eye Amsler map against previous map using the §6 rules engine.
 */
export function evaluateAmslerEye(
  currentCells: number[],
  previousCells: number[] | null,
  suddenLargeLoss = false
): { diff: AmslerDiffResult; evaluation: ComprehensiveEvaluation } {
  const diff = compareAmslerMaps(currentCells, previousCells);
  const evaluation = evaluateReading({
    indicator: 'amsler',
    value: diff.newCells.length,
    baseline: null,
    options: {
      hasDistortion: diff.hasDistortion,
      isNewDistortion: diff.isNewDistortion,
      suddenLargeLoss,
    },
  });

  return { diff, evaluation };
}

/**
 * Load persisted calibration from localStorage if available.
 */
export function loadAmslerCalibration(): AmslerCalibration | null {
  try {
    const raw = window.localStorage.getItem(CALIBRATION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AmslerCalibration>;
    if (
      parsed &&
      typeof parsed.pxPerMm === 'number' &&
      parsed.pxPerMm > 0 &&
      typeof parsed.cardWidthPx === 'number'
    ) {
      return {
        pxPerMm: parsed.pxPerMm,
        cardWidthPx: parsed.cardWidthPx,
        calibratedAt: parsed.calibratedAt ?? Date.now(),
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Save screen calibration to localStorage (§7.6 "Screen calibration once").
 */
export function saveAmslerCalibration(cardWidthPx: number): AmslerCalibration {
  const pxPerMm = computePxPerMm(cardWidthPx);
  const record: AmslerCalibration = {
    pxPerMm,
    cardWidthPx: Math.round(cardWidthPx),
    calibratedAt: Date.now(),
  };
  try {
    window.localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // ignore storage errors
  }
  return record;
}
