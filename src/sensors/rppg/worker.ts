/**
 * Web Worker for rPPG DSP processing — §7.3
 *
 * Runs the DSP pipeline (POS + filter + FFT) off the main thread.
 * Receives frame data, accumulates, and periodically runs the pipeline.
 */
import {
  runRppgPipeline,
  runFingertipPipeline,
  type RppgPipelineResult,
} from './dsp';

export type WorkerMessageIn =
  | { type: 'ADD_FRAME'; timestamp: number; r: number; g: number; b: number; isMotion: boolean }
  | { type: 'ADD_FINGERTIP_FRAME'; timestamp: number; red: number; isMotion: boolean }
  | { type: 'GET_RESULT'; mode: 'face' | 'fingertip' }
  | { type: 'RESET' }
  | { type: 'PING' };

export type WorkerMessageOut =
  | { type: 'RESULT'; result: RppgPipelineResult | null; mode: 'face' | 'fingertip' }
  | { type: 'PONG' };

// Accumulation buffers
let timestamps: number[] = [];
let rChannel: number[] = [];
let gChannel: number[] = [];
let bChannel: number[] = [];
let motionFrames = 0;
let totalFrames = 0;

// Fingertip buffers
let ftTimestamps: number[] = [];
let ftRedChannel: number[] = [];
let ftMotionFrames = 0;
let ftTotalFrames = 0;

const MAX_BUFFER = 30 * 25; // 25 seconds at 30 fps

self.onmessage = (e: MessageEvent<WorkerMessageIn>) => {
  const msg = e.data;

  switch (msg.type) {
    case 'ADD_FRAME': {
      timestamps.push(msg.timestamp);
      rChannel.push(msg.r);
      gChannel.push(msg.g);
      bChannel.push(msg.b);
      totalFrames++;
      if (msg.isMotion) motionFrames++;

      // Trim old data beyond max buffer
      if (timestamps.length > MAX_BUFFER) {
        const trim = timestamps.length - MAX_BUFFER;
        timestamps = timestamps.slice(trim);
        rChannel = rChannel.slice(trim);
        gChannel = gChannel.slice(trim);
        bChannel = bChannel.slice(trim);
      }
      break;
    }

    case 'ADD_FINGERTIP_FRAME': {
      ftTimestamps.push(msg.timestamp);
      ftRedChannel.push(msg.red);
      ftTotalFrames++;
      if (msg.isMotion) ftMotionFrames++;

      if (ftTimestamps.length > MAX_BUFFER) {
        const trim = ftTimestamps.length - MAX_BUFFER;
        ftTimestamps = ftTimestamps.slice(trim);
        ftRedChannel = ftRedChannel.slice(trim);
      }
      break;
    }

    case 'GET_RESULT': {
      if (msg.mode === 'face') {
        const motionFraction = totalFrames > 0 ? motionFrames / totalFrames : 0;
        const result = runRppgPipeline(
          timestamps, rChannel, gChannel, bChannel,
          motionFraction, 30
        );
        self.postMessage({ type: 'RESULT', result, mode: 'face' } satisfies WorkerMessageOut);
      } else {
        const motionFraction = ftTotalFrames > 0 ? ftMotionFrames / ftTotalFrames : 0;
        const result = runFingertipPipeline(
          ftTimestamps, ftRedChannel,
          motionFraction, 30
        );
        self.postMessage({ type: 'RESULT', result, mode: 'fingertip' } satisfies WorkerMessageOut);
      }
      break;
    }

    case 'RESET': {
      timestamps = [];
      rChannel = [];
      gChannel = [];
      bChannel = [];
      motionFrames = 0;
      totalFrames = 0;
      ftTimestamps = [];
      ftRedChannel = [];
      ftMotionFrames = 0;
      ftTotalFrames = 0;
      break;
    }

    case 'PING': {
      self.postMessage({ type: 'PONG' } satisfies WorkerMessageOut);
      break;
    }
  }
};

export {};
