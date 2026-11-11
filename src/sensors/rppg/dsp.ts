/**
 * Digital Signal Processing for rPPG — §7.3 steps 4, 5, 6, 7, 8
 *
 * - Resampling to uniform 30 Hz (linear interpolation)
 * - POS algorithm (Wang et al., 2017): sliding window 1.6 s, step 1 frame
 * - Detrend (subtract 1 s moving average)
 * - 4th-order Butterworth band-pass 0.7–3.0 Hz, forward-backward (zero phase)
 * - Hann-windowed FFT with zero-padding to ≥4096 points
 * - Parabolic interpolation for sub-bin peak precision
 * - SNR (de Haan & Jeanne): signal power at f0 ± 0.1 Hz and 2·f0 ± 0.1 Hz vs rest
 */

// ── Resampling (§7.3 step 4) ──────────────────────────────────────────────

export function resampleUniform(
  timestamps: number[],
  values: number[],
  targetRate: number
): number[] {
  if (timestamps.length < 2) return values.slice();
  const t0 = timestamps[0];
  const tEnd = timestamps[timestamps.length - 1];
  const dt = 1 / targetRate;
  const out: number[] = [];

  let j = 0;
  for (let t = t0; t <= tEnd + dt * 0.001; t += dt) {
    while (j < timestamps.length - 2 && timestamps[j + 1] < t) j++;
    const t1 = timestamps[j];
    const t2 = timestamps[j + 1];
    const v1 = values[j];
    const v2 = values[j + 1];
    const frac = t2 !== t1 ? (t - t1) / (t2 - t1) : 0;
    out.push(v1 + frac * (v2 - v1));
  }
  return out;
}

// ── Detrend: subtract 1-second moving average (§7.3 step 6) ───────────────

export function detrend(signal: number[], sampleRate: number): number[] {
  const winLen = Math.max(1, Math.round(sampleRate));
  const half = Math.floor(winLen / 2);
  const n = signal.length;
  const out = new Array<number>(n);

  for (let i = 0; i < n; i++) {
    const lo = Math.max(0, i - half);
    const hi = Math.min(n - 1, i + half);
    let s = 0;
    for (let k = lo; k <= hi; k++) s += signal[k];
    out[i] = signal[i] - s / (hi - lo + 1);
  }
  return out;
}

// ── 4th-order Butterworth band-pass via bilinear transform (§7.3 step 6) ──

export interface BiquadCoeffs {
  b0: number; b1: number; b2: number;
  a1: number; a2: number;
}

/**
 * Design a 4th-order Butterworth band-pass as two cascaded 2nd-order BPF
 * biquad sections using the Audio EQ Cookbook (Robert Bristow-Johnson).
 *
 * Each section is a 2nd-order BPF. Two in cascade give 4th-order roll-off.
 * The two sections use the Butterworth pole angles for N=2
 * (π/4 and 3π/4), mapped to Q factors for BPF sections.
 */
export function designButterworth4thBandpass(
  lowCut: number,
  highCut: number,
  sampleRate: number
): BiquadCoeffs[] {
  // Geometric center frequency and bandwidth
  const fc = Math.sqrt(lowCut * highCut);
  const bwOctaves = Math.log2(highCut / lowCut);

  // For a 2nd-order Butterworth LP, the pole angles are π/4 and 3π/4.
  // The Q of each BPF section relates to the prototype pole:
  // Q_k = 1 / (2 * cos(θ_k)) where θ_k are measured from the negative real axis.
  // For Butterworth N=2: θ = π/4 → Q = 1/(2·cos(π/4)) = 1/√2 ≈ 0.7071
  // But for BPF we also scale by the fractional bandwidth:
  // actual Q_section = Q_prototype / fractional_bw
  // where fractional_bw = bw / fc = (highCut - lowCut) / fc

  // Simpler: use the Audio EQ Cookbook BPF design at fc with Q values
  // chosen so the cascade gives a Butterworth-shaped passband.

  const sections: BiquadCoeffs[] = [];

  // Butterworth 2nd-order prototype pole angles: π(2k+1)/(2N) for k=0..N-1, N=2
  // → π/4 and 3π/4
  const protoAngles = [Math.PI / 4, 3 * Math.PI / 4];

  for (const theta of protoAngles) {
    // The prototype pole has real part -cos(π/2 - θ) = -sin(θ) in the left half
    // Q for this section based on the prototype pole:
    const qProto = 1 / (2 * Math.cos(theta));
    // Scale Q to account for the desired bandwidth
    const fractionalBw = bwOctaves;
    const Q = Math.abs(qProto) / (fractionalBw > 0 ? fractionalBw : 1) * 2;

    // Audio EQ Cookbook BPF (constant 0-dB peak gain)
    const w0 = 2 * Math.PI * fc / sampleRate;
    const sinW0 = Math.sin(w0);
    const cosW0 = Math.cos(w0);
    const alpha = sinW0 / (2 * Q);

    const b0 = alpha;
    const b1 = 0;
    const b2 = -alpha;
    const a0 = 1 + alpha;
    const a1 = -2 * cosW0;
    const a2 = 1 - alpha;

    sections.push({
      b0: b0 / a0,
      b1: b1 / a0,
      b2: b2 / a0,
      a1: a1 / a0,
      a2: a2 / a0,
    });
  }

  return sections;
}

/** Apply a single biquad section forward (Direct Form II Transposed) */
function applyBiquadForward(signal: number[], c: BiquadCoeffs): number[] {
  const n = signal.length;
  const out = new Array<number>(n);
  let z1 = 0, z2 = 0;

  for (let i = 0; i < n; i++) {
    const x = signal[i];
    const y = c.b0 * x + z1;
    z1 = c.b1 * x - c.a1 * y + z2;
    z2 = c.b2 * x - c.a2 * y;
    out[i] = y;
  }
  return out;
}

/**
 * Zero-phase band-pass filter: forward-backward through each biquad section.
 * 0.7–3.0 Hz (42–180 bpm) per §7.3 step 6.
 */
export function bandpassFilter(
  signal: number[],
  sampleRate: number,
  lowCut = 0.7,
  highCut = 3.0
): number[] {
  const sections = designButterworth4thBandpass(lowCut, highCut, sampleRate);
  let out = signal.slice();

  for (const section of sections) {
    // Forward pass
    out = applyBiquadForward(out, section);
    // Backward pass (reverse → filter → reverse) for zero phase
    out.reverse();
    out = applyBiquadForward(out, section);
    out.reverse();
  }
  return out;
}

/**
 * Full filtering: detrend + band-pass (§7.3 step 6).
 */
export function filterSignal(signal: number[], sampleRate = 30): number[] {
  const detrended = detrend(signal, sampleRate);
  return bandpassFilter(detrended, sampleRate);
}

// ── Hann window ────────────────────────────────────────────────────────────

export function hannWindow(n: number): number[] {
  const w = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
  }
  return w;
}

// ── FFT (radix-2 Cooley-Tukey, in-place) ───────────────────────────────────

function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

/**
 * In-place FFT. re and im arrays must have length that is a power of 2.
 */
function fftInPlace(re: number[], im: number[]): void {
  const n = re.length;
  // bit-reversal permutation
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) {
      j ^= bit;
    }
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }

  // Cooley-Tukey
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (2 * Math.PI) / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);

    for (let i = 0; i < n; i += len) {
      let curRe = 1, curIm = 0;
      for (let j = 0; j < len / 2; j++) {
        const uRe = re[i + j];
        const uIm = im[i + j];
        const vRe = re[i + j + len / 2] * curRe - im[i + j + len / 2] * curIm;
        const vIm = re[i + j + len / 2] * curIm + im[i + j + len / 2] * curRe;

        re[i + j] = uRe + vRe;
        im[i + j] = uIm + vIm;
        re[i + j + len / 2] = uRe - vRe;
        im[i + j + len / 2] = uIm - vIm;

        const newCurRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = newCurRe;
      }
    }
  }
}

/**
 * Compute power spectrum magnitude squared.
 * Returns { freqs, power } where freqs[i] is Hz and power[i] is |X[i]|^2.
 */
export function powerSpectrum(
  signal: number[],
  sampleRate: number,
  minFftSize = 4096
): { freqs: number[]; power: number[] } {
  const fftSize = Math.max(minFftSize, nextPow2(signal.length));
  const re = new Array<number>(fftSize).fill(0);
  const im = new Array<number>(fftSize).fill(0);

  // Apply Hann window
  const win = hannWindow(signal.length);
  for (let i = 0; i < signal.length; i++) {
    re[i] = signal[i] * win[i];
  }

  fftInPlace(re, im);

  const halfN = fftSize / 2;
  const freqs = new Array<number>(halfN);
  const power = new Array<number>(halfN);
  const df = sampleRate / fftSize;

  for (let i = 0; i < halfN; i++) {
    freqs[i] = i * df;
    power[i] = re[i] * re[i] + im[i] * im[i];
  }

  return { freqs, power };
}

// ── Peak detection with parabolic interpolation (§7.3 step 7) ──────────────

export interface PeakResult {
  frequencyHz: number;
  bpm: number;
  peakPower: number;
}

/**
 * Find the peak frequency in [lowHz, highHz] using parabolic interpolation
 * on log-magnitude for better accuracy.
 */
export function findPeakFrequency(
  freqs: number[],
  power: number[],
  lowHz = 0.7,
  highHz = 3.0
): PeakResult | null {
  let bestIdx = -1;
  let bestVal = -Infinity;

  for (let i = 0; i < freqs.length; i++) {
    if (freqs[i] >= lowHz && freqs[i] <= highHz) {
      if (power[i] > bestVal) {
        bestVal = power[i];
        bestIdx = i;
      }
    }
  }

  if (bestIdx < 0) return null;

  if (bestIdx < 1 || bestIdx >= freqs.length - 1) {
    return { frequencyHz: freqs[bestIdx], bpm: freqs[bestIdx] * 60, peakPower: bestVal };
  }

  // Parabolic interpolation on log-magnitude for sub-bin precision
  const alpha = Math.log(power[bestIdx - 1] + 1e-30);
  const beta = Math.log(power[bestIdx] + 1e-30);
  const gamma = Math.log(power[bestIdx + 1] + 1e-30);
  const denom = alpha - 2 * beta + gamma;

  let peakBin = bestIdx;
  if (Math.abs(denom) > 1e-12) {
    const shift = 0.5 * (alpha - gamma) / denom;
    if (Math.abs(shift) < 1) {
      peakBin = bestIdx + shift;
    }
  }

  const df = freqs[1] - freqs[0];
  const peakFreq = peakBin * df;
  const clampedFreq = Math.max(lowHz, Math.min(highHz, peakFreq));

  return {
    frequencyHz: clampedFreq,
    bpm: clampedFreq * 60,
    peakPower: bestVal,
  };
}

// ── SNR computation (de Haan & Jeanne method, §7.3 step 8) ─────────────────

export interface SnrResult {
  snrDb: number;
  f0Hz: number;
}

/**
 * SNR: signal power within ±0.1 Hz of f0 and 2·f0 vs remaining power in band.
 */
export function computeSnr(
  freqs: number[],
  power: number[],
  f0Hz: number,
  lowHz = 0.7,
  highHz = 3.0,
  halfWidth = 0.1
): SnrResult {
  let signalPower = 0;
  let noisePower = 0;

  for (let i = 0; i < freqs.length; i++) {
    const f = freqs[i];
    if (f < lowHz || f > highHz) continue;

    const isF0 = Math.abs(f - f0Hz) <= halfWidth;
    const is2F0 = Math.abs(f - 2 * f0Hz) <= halfWidth && 2 * f0Hz <= highHz;

    if (isF0 || is2F0) {
      signalPower += power[i];
    } else {
      noisePower += power[i];
    }
  }

  if (noisePower < 1e-15) {
    return { snrDb: 30, f0Hz };
  }

  const snrDb = 10 * Math.log10(signalPower / noisePower);
  return { snrDb, f0Hz };
}

// ── Full pipeline: estimate HR from a segment of filtered signal ────────────

export interface HrEstimate {
  bpm: number;
  snrDb: number;
  quality: 'GOOD' | 'FAIR' | 'POOR';
  peakFreqHz: number;
}

/**
 * Estimate heart rate from a filtered signal segment.
 * Steps 7-8 of §7.3.
 */
export function estimateHeartRate(
  filteredSignal: number[],
  sampleRate = 30,
  motionFraction = 0
): HrEstimate | null {
  if (filteredSignal.length < sampleRate * 3) return null;

  const { freqs, power } = powerSpectrum(filteredSignal, sampleRate, 4096);
  const peak = findPeakFrequency(freqs, power, 0.7, 3.0);

  if (!peak) return null;

  const snr = computeSnr(freqs, power, peak.frequencyHz);

  // Quality gate per §7.3 step 8
  let quality: 'GOOD' | 'FAIR' | 'POOR';
  if (motionFraction > 0.20 || snr.snrDb < 0) {
    quality = 'POOR';
  } else if (snr.snrDb >= 3.0) {
    quality = 'GOOD';
  } else {
    quality = 'FAIR';
  }

  return {
    bpm: peak.bpm,
    snrDb: snr.snrDb,
    quality,
    peakFreqHz: peak.frequencyHz,
  };
}

// ── POS Algorithm (Wang et al., 2017) — §7.3 step 5 ───────────────────────

function std(arr: number[]): number {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

/**
 * POS algorithm: sliding window 1.6 s, step 1 frame.
 * In each window: normalise by window mean, S1 = G-B, S2 = G+B-2R,
 * h = S1 + (σ(S1)/σ(S2))·S2, subtract mean, overlap-add.
 */
export function posAlgorithm(
  r: number[],
  g: number[],
  b: number[],
  sampleRate = 30
): number[] {
  const n = r.length;
  const winLen = Math.round(1.6 * sampleRate); // ~48 samples at 30 Hz
  const output = new Array<number>(n).fill(0);

  if (n < winLen) {
    // Fallback: process the whole signal as one window
    const meanR = r.reduce((a, v) => a + v, 0) / n;
    const meanG = g.reduce((a, v) => a + v, 0) / n;
    const meanB = b.reduce((a, v) => a + v, 0) / n;

    const s1: number[] = [];
    const s2: number[] = [];
    for (let i = 0; i < n; i++) {
      const rn = meanR > 0 ? r[i] / meanR : 0;
      const gn = meanG > 0 ? g[i] / meanG : 0;
      const bn = meanB > 0 ? b[i] / meanB : 0;
      s1.push(gn - bn);
      s2.push(gn + bn - 2 * rn);
    }

    const sigma1 = std(s1);
    const sigma2 = std(s2);
    const ratio = sigma2 > 1e-10 ? sigma1 / sigma2 : 1;

    for (let i = 0; i < n; i++) {
      output[i] = s1[i] + ratio * s2[i];
    }

    const mean = output.reduce((a, v) => a + v, 0) / n;
    for (let i = 0; i < n; i++) output[i] -= mean;

    return output;
  }

  // Sliding window with overlap-add
  const count = new Array<number>(n).fill(0);

  for (let start = 0; start <= n - winLen; start++) {
    let meanR = 0, meanG = 0, meanB = 0;
    for (let i = start; i < start + winLen; i++) {
      meanR += r[i]; meanG += g[i]; meanB += b[i];
    }
    meanR /= winLen; meanG /= winLen; meanB /= winLen;

    if (meanR < 1e-6 || meanG < 1e-6 || meanB < 1e-6) continue;

    const s1: number[] = [];
    const s2: number[] = [];
    for (let i = start; i < start + winLen; i++) {
      const rn = r[i] / meanR;
      const gn = g[i] / meanG;
      const bn = b[i] / meanB;
      s1.push(gn - bn);
      s2.push(gn + bn - 2 * rn);
    }

    const sigma1 = std(s1);
    const sigma2 = std(s2);
    const ratio = sigma2 > 1e-10 ? sigma1 / sigma2 : 1;

    const h: number[] = [];
    for (let i = 0; i < winLen; i++) {
      h.push(s1[i] + ratio * s2[i]);
    }
    const meanH = h.reduce((a, v) => a + v, 0) / winLen;

    for (let i = 0; i < winLen; i++) {
      output[start + i] += h[i] - meanH;
      count[start + i]++;
    }
  }

  // Normalize by overlap count
  for (let i = 0; i < n; i++) {
    if (count[i] > 0) output[i] /= count[i];
  }

  return output;
}

// ── Full rPPG pipeline: resample → POS → filter → estimate ─────────────────

export interface RppgPipelineResult {
  bpm: number;
  snrDb: number;
  quality: 'GOOD' | 'FAIR' | 'POOR';
  filteredSignal: number[];
  estimates: number[];
}

/**
 * Complete rPPG pipeline from raw RGB samples.
 * §7.3 steps 4-8.
 */
export function runRppgPipeline(
  timestamps: number[], // seconds
  rChannel: number[],
  gChannel: number[],
  bChannel: number[],
  motionFraction = 0,
  sampleRate = 30
): RppgPipelineResult | null {
  if (timestamps.length < sampleRate * 5) return null;

  // Step 4: Resample to uniform 30 Hz
  const rUniform = resampleUniform(timestamps, rChannel, sampleRate);
  const gUniform = resampleUniform(timestamps, gChannel, sampleRate);
  const bUniform = resampleUniform(timestamps, bChannel, sampleRate);

  // Step 5: POS algorithm
  const posSignal = posAlgorithm(rUniform, gUniform, bUniform, sampleRate);

  // Step 6: Detrend + bandpass filter
  const filtered = filterSignal(posSignal, sampleRate);

  // Step 7: Per-second estimates over last 10 s, take median
  const tenSec = sampleRate * 10;
  const segLen = Math.min(filtered.length, tenSec);
  const segment = filtered.slice(filtered.length - segLen);

  // Generate per-second estimates (each over the remaining window)
  const estimates: number[] = [];
  if (segment.length >= tenSec) {
    for (let sec = 0; sec < 10; sec++) {
      const subSeg = segment.slice(sec * sampleRate);
      if (subSeg.length >= sampleRate * 3) {
        const est = estimateHeartRate(subSeg, sampleRate, motionFraction);
        if (est) estimates.push(est.bpm);
      }
    }
  }

  // Final estimate from full segment
  const fullEstimate = estimateHeartRate(segment, sampleRate, motionFraction);
  if (!fullEstimate) return null;

  // Final result = median of per-second estimates (or full estimate if not enough)
  let finalBpm = fullEstimate.bpm;
  if (estimates.length >= 3) {
    const sorted = estimates.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    finalBpm = sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  return {
    bpm: finalBpm,
    snrDb: fullEstimate.snrDb,
    quality: fullEstimate.quality,
    filteredSignal: filtered,
    estimates,
  };
}

// ── Fingertip pipeline: RED channel only, reuses filter/FFT (§7.3 step 13) ──

export function runFingertipPipeline(
  timestamps: number[],
  redChannel: number[],
  motionFraction = 0,
  sampleRate = 30
): RppgPipelineResult | null {
  if (timestamps.length < sampleRate * 5) return null;

  // Resample RED to uniform rate
  const rUniform = resampleUniform(timestamps, redChannel, sampleRate);

  // No POS — use RED directly. Steps 6-8.
  const filtered = filterSignal(rUniform, sampleRate);

  const tenSec = sampleRate * 10;
  const segLen = Math.min(filtered.length, tenSec);
  const segment = filtered.slice(filtered.length - segLen);

  const estimates: number[] = [];
  if (segment.length >= tenSec) {
    for (let sec = 0; sec < 10; sec++) {
      const subSeg = segment.slice(sec * sampleRate);
      if (subSeg.length >= sampleRate * 3) {
        const est = estimateHeartRate(subSeg, sampleRate, motionFraction);
        if (est) estimates.push(est.bpm);
      }
    }
  }

  const fullEstimate = estimateHeartRate(segment, sampleRate, motionFraction);
  if (!fullEstimate) return null;

  let finalBpm = fullEstimate.bpm;
  if (estimates.length >= 3) {
    const sorted = estimates.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    finalBpm = sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  return {
    bpm: finalBpm,
    snrDb: fullEstimate.snrDb,
    quality: fullEstimate.quality,
    filteredSignal: filtered,
    estimates,
  };
}
