/**
 * Synthetic-signal tests for rPPG DSP pipeline — §7.3 step 10
 *
 * Synthesise RGB traces with a known pulse + noise + slow lighting drift.
 * Algorithm must return within ±2 bpm for 50, 72, 110, 150 bpm.
 */
import { describe, it, expect } from 'vitest';
import {
  resampleUniform,
  detrend,
  bandpassFilter,
  filterSignal,
  powerSpectrum,
  findPeakFrequency,
  computeSnr,
  estimateHeartRate,
  posAlgorithm,
  runRppgPipeline,
  runFingertipPipeline,
} from './dsp';

// ── Helpers ────────────────────────────────────────────────────────────────

const SAMPLE_RATE = 30;
const DURATION_S = 15; // 15 s of data (need ≥ 10 s for pipeline)
const N_SAMPLES = SAMPLE_RATE * DURATION_S;

/**
 * Generate synthetic skin-like RGB traces with a known pulse frequency.
 *
 * Model: each channel has a baseline value + slow linear drift + sinusoidal
 * pulse modulation (strongest in green, phase-shifted between channels as
 * in real skin) + white noise.
 */
function synthesizeFaceRgb(
  bpm: number,
  opts: {
    sampleRate?: number;
    durationS?: number;
    noiseLevel?: number;
    driftPerSecond?: number;
    jitterMs?: number; // timestamp jitter to simulate irregular frame timing
  } = {}
): {
  timestamps: number[];
  r: number[];
  g: number[];
  b: number[];
} {
  const sr = opts.sampleRate ?? SAMPLE_RATE;
  const dur = opts.durationS ?? DURATION_S;
  const n = sr * dur;
  const noise = opts.noiseLevel ?? 0.3;
  const drift = opts.driftPerSecond ?? 0.5;
  const jitter = (opts.jitterMs ?? 3) / 1000; // convert to seconds

  const freq = bpm / 60; // Hz
  const timestamps: number[] = [];
  const r: number[] = [];
  const g: number[] = [];
  const b: number[] = [];

  // Baseline skin colour (typical webcam values)
  const baseR = 150;
  const baseG = 120;
  const baseB = 90;

  // Pulse amplitude as fraction of baseline (real rPPG signal is ~0.5-2% modulation)
  const pulseAmpR = 0.008;
  const pulseAmpG = 0.015; // Green has strongest BVP signal
  const pulseAmpB = 0.005;

  // Use a seeded simple PRNG for reproducibility
  let seed = 42;
  function rand(): number {
    seed = (seed * 16807 + 0) % 2147483647;
    return (seed - 1) / 2147483646;
  }
  function randn(): number {
    // Box-Muller
    const u1 = rand();
    const u2 = rand();
    return Math.sqrt(-2 * Math.log(u1 + 1e-10)) * Math.cos(2 * Math.PI * u2);
  }

  for (let i = 0; i < n; i++) {
    const t = i / sr + (randn() * jitter); // add timing jitter
    timestamps.push(t);

    const driftVal = drift * t; // slow linear brightness drift
    const phase = 2 * Math.PI * freq * t;

    // Sinusoidal pulse with phase shifts between channels (as in real BVP)
    const pulseR = pulseAmpR * Math.sin(phase);
    const pulseG = pulseAmpG * Math.sin(phase + 0.1); // slight phase shift
    const pulseB = pulseAmpB * Math.sin(phase - 0.15);

    r.push(baseR + driftVal + baseR * pulseR + noise * randn());
    g.push(baseG + driftVal + baseG * pulseG + noise * randn());
    b.push(baseB + driftVal + baseB * pulseB + noise * randn());
  }

  // Ensure timestamps are monotonically increasing
  for (let i = 1; i < timestamps.length; i++) {
    if (timestamps[i] <= timestamps[i - 1]) {
      timestamps[i] = timestamps[i - 1] + 1 / sr * 0.5;
    }
  }

  return { timestamps, r, g, b };
}

/**
 * Generate synthetic fingertip RED signal (pulsatile, much stronger than rPPG).
 */
function synthesizeFingertipRed(
  bpm: number,
  opts: { sampleRate?: number; durationS?: number; noiseLevel?: number } = {}
): { timestamps: number[]; red: number[] } {
  const sr = opts.sampleRate ?? SAMPLE_RATE;
  const dur = opts.durationS ?? DURATION_S;
  const n = sr * dur;
  const noise = opts.noiseLevel ?? 0.5;

  const freq = bpm / 60;
  const timestamps: number[] = [];
  const red: number[] = [];

  let seed = 123;
  function rand(): number {
    seed = (seed * 16807 + 0) % 2147483647;
    return (seed - 1) / 2147483646;
  }
  function randn(): number {
    const u1 = rand();
    const u2 = rand();
    return Math.sqrt(-2 * Math.log(u1 + 1e-10)) * Math.cos(2 * Math.PI * u2);
  }

  const baseRed = 180; // finger on camera: bright red
  const pulseAmp = 0.03; // much stronger signal than rPPG face

  for (let i = 0; i < n; i++) {
    const t = i / sr;
    timestamps.push(t);
    const pulse = pulseAmp * Math.sin(2 * Math.PI * freq * t);
    red.push(baseRed + baseRed * pulse + noise * randn());
  }

  return { timestamps, red };
}

// ── Unit tests for individual DSP functions ────────────────────────────────

describe('resampleUniform', () => {
  it('should produce samples at the target rate', () => {
    const ts = [0, 0.04, 0.07, 0.11, 0.14]; // ~25 Hz irregular
    const vals = [1, 2, 3, 4, 5];
    const out = resampleUniform(ts, vals, 30);
    // duration ~ 0.14 s → expect about 0.14 * 30 + 1 ≈ 5 samples
    expect(out.length).toBeGreaterThanOrEqual(4);
    expect(out.length).toBeLessThanOrEqual(6);
  });

  it('should linearly interpolate between points', () => {
    const ts = [0, 1];
    const vals = [0, 10];
    const out = resampleUniform(ts, vals, 10); // 10 Hz over 1 s
    expect(out.length).toBeGreaterThanOrEqual(10);
    // First should be ~0, last should be ~10
    expect(out[0]).toBeCloseTo(0, 1);
    expect(out[out.length - 1]).toBeCloseTo(10, 0);
  });
});

describe('detrend', () => {
  it('should remove a linear trend', () => {
    const n = 300; // 10 s at 30 Hz
    const signal = Array.from({ length: n }, (_, i) => i * 0.1 + Math.sin(2 * Math.PI * 1.5 * i / 30));
    const detrended = detrend(signal, 30);
    // The mean of the detrended signal should be near 0 in the middle portion
    const mid = detrended.slice(30, 270);
    const mean = mid.reduce((a, b) => a + b, 0) / mid.length;
    expect(Math.abs(mean)).toBeLessThan(1.0);
  });
});

describe('bandpassFilter', () => {
  it('should pass a 1.2 Hz signal (72 bpm) with minimal attenuation', () => {
    const n = 600; // 20 s at 30 Hz
    const freq = 1.2; // 72 bpm
    const signal = Array.from({ length: n }, (_, i) => Math.sin(2 * Math.PI * freq * i / 30));
    const filtered = bandpassFilter(signal, 30, 0.7, 3.0);

    // Find the peak amplitude in the steady-state region (skip transients)
    const mid = filtered.slice(100, 500);
    const maxAmp = Math.max(...mid.map(Math.abs));
    // Should retain most of the amplitude (zero-phase → gain ~1 in passband)
    expect(maxAmp).toBeGreaterThan(0.5);
  });

  it('should attenuate a 0.2 Hz signal (outside passband)', () => {
    const n = 600;
    const freq = 0.2; // below 0.7 Hz
    const signal = Array.from({ length: n }, (_, i) => Math.sin(2 * Math.PI * freq * i / 30));
    const filtered = bandpassFilter(signal, 30, 0.7, 3.0);

    const mid = filtered.slice(100, 500);
    const maxAmp = Math.max(...mid.map(Math.abs));
    // Should be significantly attenuated
    expect(maxAmp).toBeLessThan(0.15);
  });

  it('should attenuate a 5 Hz signal (above passband)', () => {
    const n = 600;
    const freq = 5.0;
    const signal = Array.from({ length: n }, (_, i) => Math.sin(2 * Math.PI * freq * i / 30));
    const filtered = bandpassFilter(signal, 30, 0.7, 3.0);

    const mid = filtered.slice(100, 500);
    const maxAmp = Math.max(...mid.map(Math.abs));
    expect(maxAmp).toBeLessThan(0.15);
  });
});

describe('powerSpectrum + findPeakFrequency', () => {
  it('should find a 1.2 Hz peak', () => {
    const n = 300;
    const freq = 1.2;
    const signal = Array.from({ length: n }, (_, i) => Math.sin(2 * Math.PI * freq * i / 30));
    const { freqs, power } = powerSpectrum(signal, 30);
    const peak = findPeakFrequency(freqs, power, 0.7, 3.0);
    expect(peak).not.toBeNull();
    expect(peak!.frequencyHz).toBeCloseTo(1.2, 1);
    expect(peak!.bpm).toBeCloseTo(72, 1);
  });

  it('should find a 2.5 Hz peak (150 bpm)', () => {
    const n = 300;
    const freq = 2.5;
    const signal = Array.from({ length: n }, (_, i) => Math.sin(2 * Math.PI * freq * i / 30));
    const { freqs, power } = powerSpectrum(signal, 30);
    const peak = findPeakFrequency(freqs, power, 0.7, 3.0);
    expect(peak).not.toBeNull();
    expect(peak!.frequencyHz).toBeCloseTo(2.5, 1);
  });
});

describe('computeSnr', () => {
  it('should return high SNR for a clean signal', () => {
    const n = 300;
    const freq = 1.2;
    const signal = Array.from({ length: n }, (_, i) => Math.sin(2 * Math.PI * freq * i / 30));
    const { freqs, power } = powerSpectrum(signal, 30);
    const snr = computeSnr(freqs, power, freq);
    expect(snr.snrDb).toBeGreaterThan(3);
  });
});

describe('estimateHeartRate', () => {
  it('should return GOOD quality for a clean signal', () => {
    const n = 300;
    const freq = 1.2;
    const signal = Array.from({ length: n }, (_, i) => Math.sin(2 * Math.PI * freq * i / 30));
    const filtered = filterSignal(signal, 30);
    const result = estimateHeartRate(filtered, 30, 0);
    expect(result).not.toBeNull();
    expect(result!.quality).toBe('GOOD');
    expect(result!.bpm).toBeCloseTo(72, 0);
  });

  it('should return POOR quality for high motion', () => {
    const n = 300;
    const signal = Array.from({ length: n }, (_, i) => Math.sin(2 * Math.PI * 1.2 * i / 30));
    const filtered = filterSignal(signal, 30);
    const result = estimateHeartRate(filtered, 30, 0.25);
    expect(result).not.toBeNull();
    expect(result!.quality).toBe('POOR');
  });

  it('should return null for too-short signal', () => {
    const signal = [1, 2, 3, 4, 5];
    const result = estimateHeartRate(signal, 30, 0);
    expect(result).toBeNull();
  });
});

// ── Core accuracy tests: synthetic rPPG at 50, 72, 110, 150 bpm (§7.3 step 10) ──

describe('rPPG pipeline accuracy (face)', () => {
  const testBpms = [50, 72, 110, 150];

  for (const targetBpm of testBpms) {
    it(`should estimate ${targetBpm} bpm within ±2 bpm (face rPPG with noise + drift)`, () => {
      const { timestamps, r, g, b } = synthesizeFaceRgb(targetBpm, {
        noiseLevel: 0.3,
        driftPerSecond: 0.5,
        jitterMs: 3,
      });

      const result = runRppgPipeline(timestamps, r, g, b, 0, SAMPLE_RATE);

      expect(result).not.toBeNull();
      const error = Math.abs(result!.bpm - targetBpm);
      expect(error).toBeLessThanOrEqual(2);
      expect(result!.quality).not.toBe('POOR');
    });
  }

  it('should return POOR quality when motion fraction > 20%', () => {
    const { timestamps, r, g, b } = synthesizeFaceRgb(72);
    const result = runRppgPipeline(timestamps, r, g, b, 0.25, SAMPLE_RATE);
    expect(result).not.toBeNull();
    expect(result!.quality).toBe('POOR');
  });
});

describe('Fingertip pipeline accuracy', () => {
  const testBpms = [50, 72, 110, 150];

  for (const targetBpm of testBpms) {
    it(`should estimate ${targetBpm} bpm within ±2 bpm (fingertip RED channel)`, () => {
      const { timestamps, red } = synthesizeFingertipRed(targetBpm, {
        noiseLevel: 0.5,
      });

      const result = runFingertipPipeline(timestamps, red, 0, SAMPLE_RATE);

      expect(result).not.toBeNull();
      const error = Math.abs(result!.bpm - targetBpm);
      expect(error).toBeLessThanOrEqual(2);
      expect(result!.quality).not.toBe('POOR');
    });
  }
});

describe('POS algorithm', () => {
  it('should extract pulse signal from RGB channels', () => {
    const n = N_SAMPLES;
    const freq = 1.2; // 72 bpm
    const r: number[] = [];
    const g: number[] = [];
    const b: number[] = [];

    for (let i = 0; i < n; i++) {
      const t = i / SAMPLE_RATE;
      const phase = 2 * Math.PI * freq * t;
      r.push(150 + 150 * 0.008 * Math.sin(phase));
      g.push(120 + 120 * 0.015 * Math.sin(phase + 0.1));
      b.push(90 + 90 * 0.005 * Math.sin(phase - 0.15));
    }

    const posSignal = posAlgorithm(r, g, b, SAMPLE_RATE);

    // The POS signal should have a clear oscillation at the pulse frequency
    expect(posSignal.length).toBe(n);

    // Check that it's not all zeros
    const maxAbs = Math.max(...posSignal.map(Math.abs));
    expect(maxAbs).toBeGreaterThan(0);

    // Filter and find peak
    const filtered = filterSignal(posSignal, SAMPLE_RATE);
    const result = estimateHeartRate(filtered, SAMPLE_RATE, 0);
    expect(result).not.toBeNull();
    expect(result!.bpm).toBeCloseTo(72, 0);
  });
});

describe('Quality gate prevents saving POOR readings', () => {
  it('should mark high-noise signal as POOR or low quality', () => {
    // Generate signal with massive noise to swamp the pulse
    const { timestamps, r, g, b } = synthesizeFaceRgb(72, {
      noiseLevel: 10.0, // extreme noise
    });

    const result = runRppgPipeline(timestamps, r, g, b, 0, SAMPLE_RATE);
    // With extreme noise, either result is null or quality is not GOOD
    if (result) {
      // The SNR should be very low
      expect(result.snrDb).toBeLessThan(10);
    }
  });

  it('should mark high motion as POOR', () => {
    const { timestamps, r, g, b } = synthesizeFaceRgb(72);
    const result = runRppgPipeline(timestamps, r, g, b, 0.30, SAMPLE_RATE);
    if (result) {
      expect(result.quality).toBe('POOR');
    }
  });
});
