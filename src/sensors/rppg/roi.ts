/**
 * Face ROI extraction from MediaPipe FaceLandmarker — §7.3 step 2
 *
 * Canonical face-mesh landmark indices for forehead and both cheeks.
 * These are drawn on the preview so the human can verify they sit on skin.
 */

export interface LandmarkPoint {
  x: number;
  y: number;
  z?: number;
}

export interface FaceRois {
  forehead: LandmarkPoint[];
  leftCheek: LandmarkPoint[];
  rightCheek: LandmarkPoint[];
}

/**
 * Canonical MediaPipe face-mesh landmark indices.
 *
 * Forehead: upper central region (above eyebrows, below hairline).
 * Cheeks: mid-cheek regions avoiding nose, mouth, and jaw edges.
 *
 * These polygons are convex hulls of the listed landmarks.
 */
export const FOREHEAD_INDICES = [10, 67, 109, 108, 151, 337, 338, 297];
export const LEFT_CHEEK_INDICES = [116, 117, 118, 119, 100, 36, 205, 187];
export const RIGHT_CHEEK_INDICES = [345, 346, 347, 348, 329, 266, 425, 411];

/** Nose tip landmark for motion tracking (§7.3 step 3) */
export const NOSE_TIP_INDEX = 1;

/**
 * Extract ROI polygons from a FaceLandmarker result.
 * Landmarks are normalised [0,1] in the input image space.
 */
export function extractFaceRois(
  landmarks: LandmarkPoint[]
): FaceRois | null {
  if (landmarks.length < 468) return null;

  return {
    forehead: FOREHEAD_INDICES.map(i => landmarks[i]),
    leftCheek: LEFT_CHEEK_INDICES.map(i => landmarks[i]),
    rightCheek: RIGHT_CHEEK_INDICES.map(i => landmarks[i]),
  };
}

/**
 * Get nose tip position for motion tracking.
 */
export function getNoseTip(landmarks: LandmarkPoint[]): LandmarkPoint | null {
  if (landmarks.length <= NOSE_TIP_INDEX) return null;
  return landmarks[NOSE_TIP_INDEX];
}

/**
 * Calculate inter-frame nose displacement (normalised coordinates).
 * Returns the Euclidean distance.
 */
export function noseDisplacement(
  prev: LandmarkPoint,
  curr: LandmarkPoint
): number {
  const dx = curr.x - prev.x;
  const dy = curr.y - prev.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Motion threshold in normalised coordinates (~2% of frame dimension) */
export const MOTION_THRESHOLD = 0.02;

/**
 * Compute mean R, G, B for an ROI polygon on an ImageData.
 * Excludes pixels with any channel < 20 or > 245 (§7.3 step 3).
 *
 * Uses a simple point-in-polygon approach: scan the bounding box of
 * the polygon and test each pixel. For small ROIs on a small canvas
 * this is efficient enough.
 */
export function computeRoiMeanRgb(
  imageData: ImageData,
  roiNormalized: LandmarkPoint[],
  width: number,
  height: number
): { r: number; g: number; b: number; count: number } | null {
  if (roiNormalized.length < 3) return null;

  // Convert normalised ROI to pixel coordinates
  const roi = roiNormalized.map(p => ({
    x: p.x * width,
    y: p.y * height,
  }));

  // Bounding box
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of roi) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  minX = Math.max(0, Math.floor(minX));
  maxX = Math.min(width - 1, Math.ceil(maxX));
  minY = Math.max(0, Math.floor(minY));
  maxY = Math.min(height - 1, Math.ceil(maxY));

  const data = imageData.data;
  let sumR = 0, sumG = 0, sumB = 0, count = 0;

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (!pointInPolygon(x, y, roi)) continue;

      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      // Exclude clipped pixels (§7.3 step 3)
      if (r < 20 || r > 245 || g < 20 || g > 245 || b < 20 || b > 245) continue;

      sumR += r;
      sumG += g;
      sumB += b;
      count++;
    }
  }

  if (count === 0) return null;

  return {
    r: sumR / count,
    g: sumG / count,
    b: sumB / count,
    count,
  };
}

/**
 * Point-in-polygon using ray casting algorithm.
 */
function pointInPolygon(
  px: number,
  py: number,
  polygon: { x: number; y: number }[]
): boolean {
  let inside = false;
  const n = polygon.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;

    if (
      (yi > py) !== (yj > py) &&
      px < ((xj - xi) * (py - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Compute mean brightness over all ROIs (for brightness pre-check).
 * §7.3 step 1: must be within 60–200.
 */
export function computeMeanBrightness(
  imageData: ImageData,
  rois: FaceRois,
  width: number,
  height: number
): number {
  const allRois = [rois.forehead, rois.leftCheek, rois.rightCheek];
  let totalBrightness = 0;
  let totalCount = 0;

  for (const roi of allRois) {
    const result = computeRoiMeanRgb(imageData, roi, width, height);
    if (result) {
      // Approximate brightness as (R + G + B) / 3
      totalBrightness += ((result.r + result.g + result.b) / 3) * result.count;
      totalCount += result.count;
    }
  }

  return totalCount > 0 ? totalBrightness / totalCount : 0;
}

/**
 * Draw ROI polygons on a canvas context for visualization (§7.3 step 2).
 */
export function drawRoiOverlay(
  ctx: CanvasRenderingContext2D,
  rois: FaceRois,
  width: number,
  height: number
): void {
  const drawPoly = (
    points: LandmarkPoint[],
    color: string,
    label: string
  ) => {
    if (points.length < 3) return;

    ctx.beginPath();
    ctx.moveTo(points[0].x * width, points[0].y * height);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x * width, points[i].y * height);
    }
    ctx.closePath();

    ctx.fillStyle = color.replace('1)', '0.15)');
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Label
    const cx = points.reduce((s, p) => s + p.x, 0) / points.length * width;
    const cy = points.reduce((s, p) => s + p.y, 0) / points.length * height;
    ctx.fillStyle = color;
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(label, cx, cy);
  };

  drawPoly(rois.forehead, 'rgba(56, 225, 255, 1)', 'FOREHEAD');
  drawPoly(rois.leftCheek, 'rgba(34, 197, 94, 1)', 'L-CHEEK');
  drawPoly(rois.rightCheek, 'rgba(34, 197, 94, 1)', 'R-CHEEK');
}
