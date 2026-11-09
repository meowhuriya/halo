/**
 * Plane-Orthogonal-to-Skin (POS) algorithm (Wang et al., 2017)
 * S1 = G - B; S2 = G + B - 2R;
 * h = S1 + (std(S1) / std(S2)) * S2
 */
export function computePosSignal(_r: number[], g: number[], b: number[]): number[] {
  // Skeleton implementation for Phase 1
  return g.map((val, i) => val - (b[i] || 0));
}
