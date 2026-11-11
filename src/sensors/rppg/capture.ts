/**
 * Camera capture for rPPG — §7.3 steps 1, 11, 12
 *
 * - getUserMedia 640×480 @ 30 fps, front camera (step 1)
 * - requestVideoFrameCallback with metadata timestamps (step 11)
 * - Small canvas with willReadFrequently for pixel readback (step 11)
 * - Exposure lock attempt ~2 s after stream start (step 12)
 */

export interface VideoCaptureConfig {
  width: number;
  height: number;
  frameRate: number;
  facingMode: 'user' | 'environment';
}

export const DEFAULT_CAPTURE_CONFIG: VideoCaptureConfig = {
  width: 640,
  height: 480,
  frameRate: 30,
  facingMode: 'user',
};

export const FINGERTIP_CAPTURE_CONFIG: VideoCaptureConfig = {
  width: 640,
  height: 480,
  frameRate: 30,
  facingMode: 'environment',
};

/**
 * Start the camera and return the video element and stream.
 * §7.3 step 1: getUserMedia 640×480 @ 30 fps.
 */
export async function startCamera(
  videoEl: HTMLVideoElement,
  config: VideoCaptureConfig = DEFAULT_CAPTURE_CONFIG
): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      width: { ideal: config.width },
      height: { ideal: config.height },
      frameRate: { ideal: config.frameRate },
      facingMode: config.facingMode,
    },
    audio: false,
  });

  videoEl.srcObject = stream;
  videoEl.playsInline = true;
  videoEl.muted = true;

  await new Promise<void>((resolve) => {
    videoEl.onloadedmetadata = () => {
      videoEl.play();
      resolve();
    };
  });

  return stream;
}

/**
 * Stop the camera stream.
 */
export function stopCamera(stream: MediaStream): void {
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

/**
 * Attempt to lock exposure and white balance ~2 s after stream start.
 * §7.3 step 12: try/catch, continue silently if unsupported.
 */
export async function attemptExposureLock(stream: MediaStream): Promise<boolean> {
  try {
    const track = stream.getVideoTracks()[0];
    if (!track) return false;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (track as any).applyConstraints({
      advanced: [{
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        exposureMode: 'manual' as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        whiteBalanceMode: 'manual' as any,
      }],
    });
    return true;
  } catch {
    // Unsupported — continue silently per §7.3 step 12
    return false;
  }
}

/**
 * Enable torch for fingertip mode (§7.3 step 13).
 * Uses try/catch — torch may not be supported.
 */
export async function enableTorch(stream: MediaStream): Promise<boolean> {
  try {
    const track = stream.getVideoTracks()[0];
    if (!track) return false;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (track as any).applyConstraints({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      advanced: [{ torch: true } as any],
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Create a small canvas for pixel readback with willReadFrequently.
 * §7.3 step 11: draw only the face bounding box for efficiency.
 */
export function createReadbackCanvas(
  width: number,
  height: number
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  return { canvas, ctx };
}

/**
 * Get frame timestamp from VideoFrameCallbackMetadata.
 * §7.3 step 11: use captureTime if present, else mediaTime.
 */
export function getFrameTimestamp(
  metadata?: { captureTime?: number; mediaTime?: number }
): number {
  if (metadata) {
    if (typeof metadata.captureTime === 'number') return metadata.captureTime / 1000;
    if (typeof metadata.mediaTime === 'number') return metadata.mediaTime;
  }
  return performance.now() / 1000;
}

/**
 * Check if a fingertip is covering the camera.
 * §7.3 step 13: R > 1.5 × G AND R > 1.5 × B AND R mean 60–250.
 */
export function isFingerDetected(
  imageData: ImageData,
  width: number,
  height: number
): boolean {
  // Sample the centre region (middle 50% of frame)
  const x0 = Math.floor(width * 0.25);
  const x1 = Math.floor(width * 0.75);
  const y0 = Math.floor(height * 0.25);
  const y1 = Math.floor(height * 0.75);

  let sumR = 0, sumG = 0, sumB = 0, count = 0;
  const data = imageData.data;

  for (let y = y0; y < y1; y += 2) { // sample every other pixel for speed
    for (let x = x0; x < x1; x += 2) {
      const idx = (y * width + x) * 4;
      sumR += data[idx];
      sumG += data[idx + 1];
      sumB += data[idx + 2];
      count++;
    }
  }

  if (count === 0) return false;

  const meanR = sumR / count;
  const meanG = sumG / count;
  const meanB = sumB / count;

  return meanR > 1.5 * meanG && meanR > 1.5 * meanB && meanR >= 60 && meanR <= 250;
}

/**
 * Get mean RED channel from the centre region for fingertip mode.
 * §7.3 step 13: signal = mean RED channel of the centre region.
 */
export function getFingertipRedMean(
  imageData: ImageData,
  width: number,
  height: number
): number {
  const x0 = Math.floor(width * 0.25);
  const x1 = Math.floor(width * 0.75);
  const y0 = Math.floor(height * 0.25);
  const y1 = Math.floor(height * 0.75);

  let sumR = 0, count = 0;
  const data = imageData.data;

  for (let y = y0; y < y1; y += 2) {
    for (let x = x0; x < x1; x += 2) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      // Exclude clipped pixels
      if (r >= 20 && r <= 245) {
        sumR += r;
        count++;
      }
    }
  }

  return count > 0 ? sumR / count : 0;
}
