import { describe, it, expect } from 'vitest';
import {
  BANK_CARD_WIDTH_MM,
  STANDARD_GRID_WIDTH_MM,
  AMSLER_GRID_DIVISIONS,
  TOTAL_AMSLER_CELLS,
  computePxPerMm,
  computeAmslerLayout,
  compareAmslerMaps,
  evaluateAmslerEye,
} from './amslerLogic';

describe('Amsler Grid Calibration, Small-Screen Scaling & Diffing (§7.6)', () => {
  it('uses exact ISO bank card width (85.6 mm) and 20×20 grid constants', () => {
    expect(BANK_CARD_WIDTH_MM).toBe(85.6);
    expect(STANDARD_GRID_WIDTH_MM).toBe(100);
    expect(AMSLER_GRID_DIVISIONS).toBe(20);
    expect(TOTAL_AMSLER_CELLS).toBe(400);
  });

  it('computes px/mm accurately from resized bank card rectangle', () => {
    // Typical 96 DPI display: 85.6 mm ≈ 323.5 px -> ~3.779 px/mm
    expect(computePxPerMm(323.52)).toBeCloseTo(3.779, 2);
    // Retinal/high-scale display: 428 px -> exactly 5.0 px/mm
    expect(computePxPerMm(428)).toBe(5);
  });

  it('renders true 10 cm × 10 cm grid at 30 cm when viewport has space', () => {
    const pxPerMm = 3.78;
    const layout = computeAmslerLayout(pxPerMm, 600);
    expect(layout.isScaledDown).toBe(false);
    expect(layout.gridPx).toBeCloseTo(378, 1); // 378 / 3.78 = 100 mm = 10.0 cm
    expect(layout.gridWidthCm).toBe(10.0);
    expect(layout.cellWidthMm).toBe(5.0);
    expect(layout.viewingDistanceCm).toBe(30);
  });

  it('applies small-screen rule (v3): scales to largest 20×20 grid that fits and shows 3 × grid width in cm', () => {
    // Example directly from §7.6: 6.6 cm grid → 20 cm viewing distance
    // At 4.0 px/mm: 6.6 cm = 66 mm = 264 px available
    const pxPerMm = 4.0;
    const layout = computeAmslerLayout(pxPerMm, 264);
    expect(layout.isScaledDown).toBe(true);
    expect(layout.gridPx).toBe(264);
    expect(layout.gridWidthCm).toBe(6.6);
    expect(layout.cellWidthMm).toBe(3.3);
    expect(layout.viewingDistanceCm).toBe(20); // Math.round(3 * 6.6) = 20 cm
  });

  it('compares per-eye maps and flags new distortion cells as ALERT', () => {
    // Baseline clean check -> NOMINAL
    const clean = evaluateAmslerEye([], null, false);
    expect(clean.evaluation.status).toBe('NOMINAL');
    expect(clean.diff.newCells).toEqual([]);

    // First distortion detected on cell 190 -> new vs normal baseline -> ALERT
    const firstDistortion = evaluateAmslerEye([190, 191], [], false);
    expect(firstDistortion.diff.newCells).toEqual([190, 191]);
    expect(firstDistortion.diff.isNewDistortion).toBe(true);
    expect(firstDistortion.evaluation.status).toBe('ALERT');

    // Repeat scan with identical marked cells -> persistent known distortion -> WATCH
    const repeatSame = evaluateAmslerEye([190, 191], [190, 191], false);
    expect(repeatSame.diff.newCells).toEqual([]);
    expect(repeatSame.diff.persistentCells).toEqual([190, 191]);
    expect(repeatSame.diff.isNewDistortion).toBe(false);
    expect(repeatSame.evaluation.status).toBe('WATCH');

    // Expand distortion with a new cell 210 -> ALERT
    const expanded = evaluateAmslerEye([190, 191, 210], [190, 191], false);
    expect(expanded.diff.newCells).toEqual([210]);
    expect(expanded.evaluation.status).toBe('ALERT');

    // Sudden large central vision loss -> CRITICAL
    const suddenLoss = evaluateAmslerEye([190, 191], [190, 191], true);
    expect(suddenLoss.evaluation.status).toBe('CRITICAL');
  });

  it('tracks resolved cells cleanly', () => {
    const diff = compareAmslerMaps([210], [190, 210]);
    expect(diff.newCells).toEqual([]);
    expect(diff.persistentCells).toEqual([210]);
    expect(diff.resolvedCells).toEqual([190]);
  });
});
