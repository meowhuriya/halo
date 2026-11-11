import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  Camera, Activity, Heart, Hand, AlertTriangle, CheckCircle,
  XCircle, Play, Square, Save, RotateCcw, Fingerprint,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from '../../design/components/GlassCard';
import { BigButton } from '../../design/components/BigButton';
import { StatusBadge } from '../../design/components/StatusBadge';
import {
  startCamera, stopCamera, attemptExposureLock, enableTorch,
  createReadbackCanvas, getFrameTimestamp,
  DEFAULT_CAPTURE_CONFIG, FINGERTIP_CAPTURE_CONFIG,
  isFingerDetected, getFingertipRedMean,
} from '../../sensors/rppg/capture';
import {
  extractFaceRois, getNoseTip, noseDisplacement,
  drawRoiOverlay, computeRoiMeanRgb, computeMeanBrightness,
  MOTION_THRESHOLD,
  type LandmarkPoint,
} from '../../sensors/rppg/roi';
import {
  isBrightnessAcceptable, getQualityAdvice,
} from '../../sensors/rppg/quality';
import type { RppgPipelineResult } from '../../sensors/rppg/dsp';
import type { WorkerMessageIn, WorkerMessageOut } from '../../sensors/rppg/worker';
import { db } from '../../data/db';
import { useMission } from '../../app/MissionContext';
import { evaluateReading } from '../../engine/rules';

type ScanMode = 'face' | 'fingertip';
type ScanPhase = 'idle' | 'preparing' | 'scanning' | 'done';

// FaceLandmarker types (loaded dynamically)
interface FaceLandmarkerInstance {
  detectForVideo(video: HTMLVideoElement, timestampMs: number): {
    faceLandmarks: Array<LandmarkPoint[]>;
  };
  close(): void;
}

const SCAN_DURATION_S = 20;
const MIN_SCAN_S = 10;

export const ScanView: React.FC = () => {
  const { crew, config, refreshMission } = useMission();
  const currentCrew = crew;

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const landmarkerRef = useRef<FaceLandmarkerInstance | null>(null);
  const readbackRef = useRef<{ canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null>(null);
  const frameIdRef = useRef<number>(0);
  const frameUsingRvfcRef = useRef<boolean>(false);
  const prevNoseRef = useRef<LandmarkPoint | null>(null);
  const scanStartRef = useRef<number>(0);
  const lastResultSecRef = useRef<number>(-1);
  const lastDetectTsRef = useRef<number>(0);
  const latestResultRef = useRef<RppgPipelineResult | null>(null);
  const motionFramesRef = useRef<number>(0);
  const totalFramesRef = useRef<number>(0);
  const lastBrightnessRef = useRef<number>(128);
  const exposureLockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // State
  const [mode, setMode] = useState<ScanMode>('face');
  const [phase, setPhase] = useState<ScanPhase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<RppgPipelineResult | null>(null);
  const [faceResult, setFaceResult] = useState<RppgPipelineResult | null>(null);
  const [fingertipResult, setFingertipResult] = useState<RppgPipelineResult | null>(null);
  const [guidance, setGuidance] = useState('');
  const [error, setError] = useState('');
  const [poorFaceCount, setPoorFaceCount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [liveWaveform, setLiveWaveform] = useState<number[]>([]);
  const [liveBpm, setLiveBpm] = useState<number | null>(null);
  const [liveQuality, setLiveQuality] = useState<'GOOD' | 'FAIR' | 'POOR' | null>(null);
  const [motionWarning, setMotionWarning] = useState(false);
  const [fingerDetected, setFingerDetected] = useState(false);

  // Initialize worker
  useEffect(() => {
    const worker = new Worker(
      new URL('../../sensors/rppg/worker.ts', import.meta.url),
      { type: 'module' }
    );
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent<WorkerMessageOut>) => {
      if (e.data.type === 'RESULT') {
        const res = e.data.result;
        latestResultRef.current = res;
        setResult(res);
        if (res) {
          setLiveBpm(Math.round(res.bpm));
          setLiveQuality(res.quality);
          if (res.filteredSignal.length > 0) {
            setLiveWaveform(res.filteredSignal.slice(-150)); // last 5 s
          }
        }
      }
    };

    return () => {
      worker.terminate();
    };
  }, []);

  // Load FaceLandmarker
  const loadFaceLandmarker = useCallback(async () => {
    try {
      const vision = await import('@mediapipe/tasks-vision');
      const { FaceLandmarker, FilesetResolver } = vision;

      const filesetResolver = await FilesetResolver.forVisionTasks(
        '/mediapipe/wasm'
      );

      const landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath: '/mediapipe/face_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
      });

      landmarkerRef.current = landmarker as unknown as FaceLandmarkerInstance;
    } catch (err) {
      console.warn('GPU delegate failed, trying CPU', err);
      try {
        const vision = await import('@mediapipe/tasks-vision');
        const { FaceLandmarker, FilesetResolver } = vision;

        const filesetResolver = await FilesetResolver.forVisionTasks(
          '/mediapipe/wasm'
        );

        const landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: '/mediapipe/face_landmarker.task',
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          numFaces: 1,
        });

        landmarkerRef.current = landmarker as unknown as FaceLandmarkerInstance;
      } catch (cpuErr) {
        console.error('FaceLandmarker failed to load', cpuErr);
        setError('Could not load face detection model. Ensure /mediapipe/ files are present.');
      }
    }
  }, []);

  const cancelPendingFrame = useCallback(() => {
    const videoEl = videoRef.current as (HTMLVideoElement & {
      cancelVideoFrameCallback?: (id: number) => void;
    }) | null;
    if (frameUsingRvfcRef.current && videoEl?.cancelVideoFrameCallback) {
      videoEl.cancelVideoFrameCallback(frameIdRef.current);
    } else {
      cancelAnimationFrame(frameIdRef.current);
    }
    frameUsingRvfcRef.current = false;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) stopCamera(streamRef.current);
      if (landmarkerRef.current) landmarkerRef.current.close();
      if (exposureLockTimerRef.current) clearTimeout(exposureLockTimerRef.current);
      cancelPendingFrame();
    };
  }, [cancelPendingFrame]);

  // Start scan
  const startScan = useCallback(async (scanMode: ScanMode) => {
    cancelPendingFrame();
    setError('');
    setResult(null);
    latestResultRef.current = null;
    setSaved(false);
    setPhase('preparing');
    setMode(scanMode);
    setMotionWarning(false);
    setFingerDetected(false);
    setLiveBpm(null);
    setLiveQuality(null);
    setLiveWaveform([]);
    prevNoseRef.current = null;
    lastResultSecRef.current = -1;
    motionFramesRef.current = 0;
    totalFramesRef.current = 0;
    lastBrightnessRef.current = 128;

    // Reset worker
    workerRef.current?.postMessage({ type: 'RESET' } satisfies WorkerMessageIn);

    try {
      // Load face model if face mode
      if (scanMode === 'face' && !landmarkerRef.current) {
        setGuidance('Loading face detection model...');
        await loadFaceLandmarker();
      }

      // Start camera
      setGuidance(scanMode === 'face'
        ? 'Starting camera... Face the light, stay still.'
        : 'Starting rear camera... Cover lens with fingertip.');
      const videoEl = videoRef.current!;
      const captureConfig = scanMode === 'face' ? DEFAULT_CAPTURE_CONFIG : FINGERTIP_CAPTURE_CONFIG;
      const stream = await startCamera(videoEl, captureConfig);
      streamRef.current = stream;

      // Create readback canvas and align overlay canvas dimensions
      const actualWidth = videoEl.videoWidth || captureConfig.width;
      const actualHeight = videoEl.videoHeight || captureConfig.height;
      readbackRef.current = createReadbackCanvas(actualWidth, actualHeight);
      if (overlayCanvasRef.current) {
        overlayCanvasRef.current.width = actualWidth;
        overlayCanvasRef.current.height = actualHeight;
      }

      // Enable torch for fingertip mode
      if (scanMode === 'fingertip') {
        await enableTorch(stream);
      }

      // Exposure lock attempt after 2 s (§7.3 step 12)
      exposureLockTimerRef.current = setTimeout(() => {
        if (streamRef.current) {
          attemptExposureLock(streamRef.current);
        }
      }, 2000);

      // Begin scanning
      setPhase('scanning');
      setGuidance(scanMode === 'face'
        ? 'Face the light, stay still, 20 s'
        : 'Keep fingertip pressed on lens');
      scanStartRef.current = performance.now();

      // Start frame capture loop
      captureFrameLoop(scanMode, actualWidth, actualHeight);
    } catch (err) {
      console.error('Scan start error:', err);
      setError(
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Camera permission denied. Allow camera access and try again.'
          : `Camera error: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
      setPhase('idle');
    }
  }, [loadFaceLandmarker]);

  // Frame capture loop
  const captureFrameLoop = useCallback((
    scanMode: ScanMode,
    width: number,
    height: number,
  ) => {
    const videoEl = videoRef.current;
    if (!videoEl || !readbackRef.current) return;

    const processFrame = (
      _now?: DOMHighResTimeStamp,
      metadata?: { captureTime?: number; mediaTime?: number }
    ) => {
      if (!videoRef.current || !readbackRef.current) return;

      const timestamp = getFrameTimestamp(metadata as { captureTime?: number; mediaTime?: number } | undefined);
      const elapsedMs = performance.now() - scanStartRef.current;
      const elapsedS = elapsedMs / 1000;
      setElapsed(Math.min(elapsedS, SCAN_DURATION_S));

      // Draw video frame to readback canvas
      const { ctx } = readbackRef.current;
      ctx.drawImage(videoRef.current, 0, 0, width, height);
      const imageData = ctx.getImageData(0, 0, width, height);

      if (scanMode === 'face') {
        processFaceFrame(imageData, width, height, timestamp);
      } else {
        processFingertipFrame(imageData, width, height, timestamp);
      }

      // Request result from worker every second after MIN_SCAN_S
      const currentSec = Math.floor(elapsedS);
      if (currentSec >= MIN_SCAN_S && currentSec > lastResultSecRef.current) {
        lastResultSecRef.current = currentSec;
        workerRef.current?.postMessage({
          type: 'GET_RESULT',
          mode: scanMode,
        } satisfies WorkerMessageIn);
      }

      // Check if scan is complete
      if (elapsedS >= SCAN_DURATION_S) {
        // Final result request
        workerRef.current?.postMessage({
          type: 'GET_RESULT',
          mode: scanMode,
        } satisfies WorkerMessageIn);

        // Stop scanning
        setTimeout(() => finishScan(scanMode), 300);
        return;
      }

      // Continue capture with requestVideoFrameCallback or requestAnimationFrame
      if ('requestVideoFrameCallback' in videoRef.current) {
        frameUsingRvfcRef.current = true;
        frameIdRef.current = (videoRef.current as HTMLVideoElement & {
          requestVideoFrameCallback(cb: (now: DOMHighResTimeStamp, metadata: object) => void): number;
        }).requestVideoFrameCallback(processFrame as (now: DOMHighResTimeStamp, metadata: object) => void);
      } else {
        frameUsingRvfcRef.current = false;
        frameIdRef.current = requestAnimationFrame(() => processFrame());
      }
    };

    // Start the loop
    if ('requestVideoFrameCallback' in videoEl) {
      frameUsingRvfcRef.current = true;
      frameIdRef.current = (videoEl as HTMLVideoElement & {
        requestVideoFrameCallback(cb: (now: DOMHighResTimeStamp, metadata: object) => void): number;
      }).requestVideoFrameCallback(processFrame as (now: DOMHighResTimeStamp, metadata: object) => void);
    } else {
      frameUsingRvfcRef.current = false;
      frameIdRef.current = requestAnimationFrame(() => processFrame());
    }
  }, []);

  // Process face frame
  const processFaceFrame = useCallback((
    imageData: ImageData,
    width: number,
    height: number,
    timestamp: number,
  ) => {
    const landmarker = landmarkerRef.current;
    if (!landmarker || !videoRef.current) return;

    // Run face detection with strictly increasing timestamp
    const detectTs = Math.max(lastDetectTsRef.current + 0.1, performance.now());
    lastDetectTsRef.current = detectTs;
    const detections = landmarker.detectForVideo(videoRef.current, detectTs);
    const overlayCtx = overlayCanvasRef.current?.getContext('2d');
    if (!detections.faceLandmarks || detections.faceLandmarks.length === 0) {
      if (overlayCtx && overlayCanvasRef.current) {
        overlayCtx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
      }
      setGuidance('No face detected. Position your face in the frame.');
      return;
    }

    const landmarks = detections.faceLandmarks[0];
    const rois = extractFaceRois(landmarks);
    if (!rois) return;

    // Draw ROI overlay
    if (overlayCtx && overlayCanvasRef.current) {
      overlayCtx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
      drawRoiOverlay(overlayCtx, rois, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
    }

    // Motion detection via nose tip (§7.3 step 3)
    const noseTip = getNoseTip(landmarks);
    let isMotion = false;
    if (noseTip && prevNoseRef.current) {
      const disp = noseDisplacement(prevNoseRef.current, noseTip);
      if (disp > MOTION_THRESHOLD) {
        isMotion = true;
        motionFramesRef.current++;
        setMotionWarning(true);
        setGuidance('Hold still');
      } else {
        setMotionWarning(false);
      }
    }
    totalFramesRef.current++;
    prevNoseRef.current = noseTip;

    // Brightness pre-check
    const brightness = computeMeanBrightness(imageData, rois, width, height);
    lastBrightnessRef.current = brightness;
    if (!isBrightnessAcceptable(brightness)) {
      if (brightness < 60) setGuidance('Too dark. Face a light source.');
      else setGuidance('Too bright. Avoid direct light.');
    } else if (!isMotion) {
      setGuidance('Face the light, stay still, 20 s');
    }

    // Compute mean RGB for each ROI and average
    const roiArrays = [rois.forehead, rois.leftCheek, rois.rightCheek];
    let sumR = 0, sumG = 0, sumB = 0, totalCount = 0;

    for (const roi of roiArrays) {
      const rgbResult = computeRoiMeanRgb(imageData, roi, width, height);
      if (rgbResult) {
        sumR += rgbResult.r * rgbResult.count;
        sumG += rgbResult.g * rgbResult.count;
        sumB += rgbResult.b * rgbResult.count;
        totalCount += rgbResult.count;
      }
    }

    if (totalCount > 0) {
      workerRef.current?.postMessage({
        type: 'ADD_FRAME',
        timestamp,
        r: sumR / totalCount,
        g: sumG / totalCount,
        b: sumB / totalCount,
        isMotion,
      } satisfies WorkerMessageIn);
    }
  }, []);

  // Process fingertip frame
  const processFingertipFrame = useCallback((
    imageData: ImageData,
    width: number,
    height: number,
    timestamp: number,
  ) => {
    const detected = isFingerDetected(imageData, width, height);
    setFingerDetected(detected);

    if (!detected) {
      setGuidance('Press fingertip firmly over the camera lens.');
      return;
    }

    const redMean = getFingertipRedMean(imageData, width, height);

    workerRef.current?.postMessage({
      type: 'ADD_FINGERTIP_FRAME',
      timestamp,
      red: redMean,
      isMotion: false,
    } satisfies WorkerMessageIn);
  }, []);

  // Finish scan
  const finishScan = useCallback((scanMode: ScanMode) => {
    cancelPendingFrame();
    if (streamRef.current) {
      stopCamera(streamRef.current);
      streamRef.current = null;
    }
    if (exposureLockTimerRef.current) {
      clearTimeout(exposureLockTimerRef.current);
    }

    const finalRes = latestResultRef.current;
    setPhase('done');

    // Store for comparison
    if (scanMode === 'face') {
      setFaceResult(finalRes);
      if (!finalRes || finalRes.quality === 'POOR') {
        setPoorFaceCount(prev => prev + 1);
      }
    } else {
      setFingertipResult(finalRes);
    }
  }, [cancelPendingFrame]);

  // Stop scan early
  const stopScan = useCallback(() => {
    cancelPendingFrame();
    if (streamRef.current) {
      stopCamera(streamRef.current);
      streamRef.current = null;
    }
    if (exposureLockTimerRef.current) {
      clearTimeout(exposureLockTimerRef.current);
    }

    // Get final result
    workerRef.current?.postMessage({
      type: 'GET_RESULT',
      mode,
    } satisfies WorkerMessageIn);

    setTimeout(() => {
      const finalRes = latestResultRef.current;
      setPhase('done');
      if (mode === 'face') {
        setFaceResult(finalRes);
        if (!finalRes || finalRes.quality === 'POOR') {
          setPoorFaceCount(prev => prev + 1);
        }
      } else {
        setFingertipResult(finalRes);
      }
    }, 300);
  }, [mode, cancelPendingFrame]);

  // Save reading
  const saveReading = useCallback(async () => {
    if (!result || result.quality === 'POOR' || !currentCrew?.id) return;

    setIsSaving(true);
    try {
      const hrValue = Math.round(result.bpm);
      const evalResult = evaluateReading({
        indicator: 'heart_rate',
        value: hrValue,
      });

      await db.healthReadings.add({
        crewMemberId: currentCrew.id,
        timestamp: Date.now(),
        missionDay: config?.missionDay ?? 1,
        indicator: 'heart_rate',
        value: hrValue,
        unit: 'bpm',
        status: evalResult.status,
        reasons: evalResult.reasons,
        source: 'camera',
        quality: result.quality,
        snrDb: result.snrDb,
        notes: mode === 'fingertip' ? 'Method: fingertip' : undefined,
      });

      await refreshMission();
      setSaved(true);
    } catch (err) {
      console.error('Save error:', err);
      setError('Failed to save reading.');
    } finally {
      setIsSaving(false);
    }
  }, [result, currentCrew, config, mode, refreshMission]);

  // Quality color
  const qualityColor = (q: 'GOOD' | 'FAIR' | 'POOR' | null) => {
    if (q === 'GOOD') return 'text-emerald-400';
    if (q === 'FAIR') return 'text-amber-400';
    if (q === 'POOR') return 'text-red-400';
    return 'text-slate-500';
  };

  const qualityBg = (q: 'GOOD' | 'FAIR' | 'POOR' | null) => {
    if (q === 'GOOD') return 'bg-emerald-500/20 border-emerald-500/30';
    if (q === 'FAIR') return 'bg-amber-500/20 border-amber-500/30';
    if (q === 'POOR') return 'bg-red-500/20 border-red-500/30';
    return 'bg-white/5 border-white/10';
  };

  // "Two methods agree" comparison (§7.3 step 13)
  const comparisonText = (() => {
    if (!faceResult || !fingertipResult) return null;
    const faceBpm = Math.round(faceResult.bpm);
    const ftBpm = Math.round(fingertipResult.bpm);
    const delta = Math.abs(faceBpm - ftBpm);
    if (delta <= 5) {
      return `Face ${faceBpm} · Finger ${ftBpm} — two methods agree (Δ ${delta} bpm)`;
    }
    return `Face ${faceBpm} · Finger ${ftBpm} — methods disagree (Δ ${delta} bpm) — repeat the scan`;
  })();

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-20">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Camera size={16} className="text-cyan-400" />
            <span className="text-xs font-mono tracking-widest text-cyan-300 uppercase">
              OPTICAL REMOTE SENSOR
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Heart Rate Scan
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            {mode === 'face'
              ? 'rPPG — contactless heart rate from face'
              : 'Fingertip — photoplethysmography via camera'}
          </p>
        </div>
        {result && phase === 'done' && (
          <StatusBadge status={
            result.quality === 'POOR' ? 'WATCH'
              : result.bpm > 100 ? 'ALERT'
              : 'NOMINAL'
          } />
        )}
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-start gap-3"
          >
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

        {/* Camera preview */}
        <GlassCard variant="default" padded="none" className="md:col-span-7 overflow-hidden flex flex-col min-h-[380px] relative bg-black/60 border-cyan-500/20">

          {/* Video */}
          <div className="relative flex-1 min-h-[300px] bg-black flex items-center justify-center">
            <video
              ref={videoRef}
              className={`w-full h-full object-cover ${phase === 'idle' || phase === 'done' ? 'hidden' : ''}`}
              playsInline
              muted
              style={{ transform: mode === 'face' ? 'scaleX(-1)' : 'none' }}
            />
            <canvas
              ref={overlayCanvasRef}
              className={`absolute inset-0 w-full h-full object-cover pointer-events-none ${phase !== 'scanning' || mode !== 'face' ? 'hidden' : ''}`}
              width={640}
              height={480}
              style={{ transform: mode === 'face' ? 'scaleX(-1)' : 'none' }}
            />

            {/* Idle state */}
            {phase === 'idle' && (
              <div className="text-center space-y-4 p-8">
                <div className="w-20 h-24 mx-auto border-2 border-dashed border-cyan-400/40 rounded-full flex items-center justify-center">
                  {mode === 'face'
                    ? <Camera size={32} className="text-cyan-400" />
                    : <Fingerprint size={32} className="text-cyan-400" />
                  }
                </div>
                <div className="text-sm text-slate-300">
                  {mode === 'face'
                    ? 'Position your face in good lighting and stay still for 20 seconds.'
                    : 'Cover the rear camera lens with your fingertip.'}
                </div>
              </div>
            )}

            {/* Preparing state */}
            {phase === 'preparing' && (
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center space-y-3 z-10">
                <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                <div className="text-sm font-mono text-cyan-300">{guidance}</div>
              </div>
            )}

            {/* Scanning overlay */}
            {phase === 'scanning' && (
              <>
                {/* Countdown */}
                <div className="absolute top-3 left-3 px-3 py-1.5 rounded-xl bg-black/60 border border-white/20 backdrop-blur-sm">
                  <div className="text-xs font-mono text-cyan-300">
                    {Math.max(0, Math.ceil(SCAN_DURATION_S - elapsed))}s remaining
                  </div>
                  <div className="mt-1 h-1 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-cyan-400 transition-all duration-200"
                      style={{ width: `${(elapsed / SCAN_DURATION_S) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Motion warning */}
                <AnimatePresence>
                  {motionWarning && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute top-3 right-3 px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-mono flex items-center gap-2"
                    >
                      <Hand size={14} /> HOLD STILL
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Fingertip detection */}
                {mode === 'fingertip' && (
                  <div className={`absolute top-3 right-3 px-3 py-1.5 rounded-xl border text-xs font-mono flex items-center gap-2 ${
                    fingerDetected
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                      : 'bg-red-500/20 border-red-500/40 text-red-300'
                  }`}>
                    <Fingerprint size={14} />
                    {fingerDetected ? 'FINGER DETECTED' : 'NO FINGER'}
                  </div>
                )}

                {/* Live BPM */}
                {liveBpm !== null && (
                  <div className="absolute bottom-3 left-3 px-4 py-2 rounded-xl bg-black/60 border border-white/20 backdrop-blur-sm">
                    <div className="flex items-baseline gap-2">
                      <Heart size={16} className={`${qualityColor(liveQuality)} ${liveQuality === 'GOOD' ? 'animate-pulse' : ''}`} />
                      <span className="text-2xl font-extrabold text-white font-mono">{liveBpm}</span>
                      <span className="text-xs text-slate-400">bpm</span>
                    </div>
                    <div className={`text-[10px] font-mono mt-0.5 ${qualityColor(liveQuality)}`}>
                      {liveQuality ?? '---'}
                    </div>
                  </div>
                )}

                {/* Guidance */}
                <div className="absolute bottom-3 right-3 px-3 py-1.5 rounded-xl bg-black/60 border border-white/20 text-xs text-slate-300 font-mono max-w-[180px] text-right">
                  {guidance}
                </div>
              </>
            )}

            {/* Done state overlay */}
            {phase === 'done' && result && (
              <div className="text-center space-y-4 p-8">
                {result.quality === 'POOR' ? (
                  <XCircle size={48} className="mx-auto text-red-400" />
                ) : (
                  <CheckCircle size={48} className="mx-auto text-emerald-400" />
                )}
                <div className="text-3xl font-extrabold text-white font-mono">
                  {result.quality === 'POOR' ? '---' : `${Math.round(result.bpm)} bpm`}
                </div>
                <div className={`text-sm font-mono ${qualityColor(result.quality)}`}>
                  Quality: {result.quality}
                  {result.snrDb !== undefined && ` (SNR ${result.snrDb.toFixed(1)} dB)`}
                </div>
                {result.quality === 'POOR' && (
                  <p className="text-xs text-red-300/80">
                    {getQualityAdvice(
                      result.quality,
                      totalFramesRef.current > 0 ? motionFramesRef.current / totalFramesRef.current : 0,
                      lastBrightnessRef.current
                    )}
                  </p>
                )}
              </div>
            )}

            {/* Done but no result */}
            {phase === 'done' && !result && (
              <div className="text-center space-y-3 p-8">
                <XCircle size={40} className="mx-auto text-red-400" />
                <div className="text-sm font-mono text-red-300">Quality: POOR</div>
                <div className="text-sm text-slate-300">
                  Could not get a reading. Try again with better lighting and hold still.
                </div>
              </div>
            )}
          </div>

          {/* Live waveform */}
          {phase === 'scanning' && liveWaveform.length > 10 && (
            <div className="h-16 border-t border-white/10 bg-white/[0.02] px-2 flex items-center">
              <svg viewBox={`0 0 ${liveWaveform.length} 100`} className="w-full h-full" preserveAspectRatio="none">
                <polyline
                  points={liveWaveform.map((v, i) => {
                    const maxAbs = Math.max(...liveWaveform.map(Math.abs), 0.001);
                    const y = 50 - (v / maxAbs) * 40;
                    return `${i},${y}`;
                  }).join(' ')}
                  fill="none"
                  stroke="rgba(56, 225, 255, 0.8)"
                  strokeWidth="1.5"
                />
              </svg>
            </div>
          )}

          {/* Bottom bar */}
          <div className="p-4 border-t border-white/10 bg-white/[0.02] flex flex-wrap items-center justify-between gap-3">
            {phase === 'idle' && (
              <>
                <BigButton
                  variant="primary"
                  size="md"
                  icon={<Play size={16} />}
                  onClick={() => startScan(mode)}
                >
                  {mode === 'face' ? 'Start Face Scan' : 'Start Fingertip Scan'}
                </BigButton>
                {poorFaceCount >= 2 && (
                  <BigButton
                    variant="glass"
                    size="md"
                    icon={<Fingerprint size={16} />}
                    onClick={() => startScan('fingertip')}
                  >
                    Try Fingertip
                  </BigButton>
                )}
              </>
            )}

            {phase === 'scanning' && (
              <BigButton
                variant="danger"
                size="md"
                icon={<Square size={16} />}
                onClick={stopScan}
              >
                Stop
              </BigButton>
            )}

            {phase === 'done' && (
              <div className="flex flex-wrap gap-3 w-full">
                {result && result.quality !== 'POOR' && !saved && (
                  <BigButton
                    variant="primary"
                    size="md"
                    icon={<Save size={16} />}
                    onClick={saveReading}
                    disabled={isSaving}
                  >
                    {isSaving ? 'Saving...' : `Save ${Math.round(result.bpm)} bpm`}
                  </BigButton>
                )}
                {saved && (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm font-mono">
                    <CheckCircle size={16} /> Saved
                  </div>
                )}
                <BigButton
                  variant="glass"
                  size="md"
                  icon={<RotateCcw size={16} />}
                  onClick={() => {
                    setPhase('idle');
                    setResult(null);
                    setSaved(false);
                    setLiveBpm(null);
                    setLiveQuality(null);
                    setLiveWaveform([]);
                  }}
                >
                  Scan Again
                </BigButton>
                {mode === 'face' && result?.quality === 'POOR' && (
                  <BigButton
                    variant="glass"
                    size="md"
                    icon={<Fingerprint size={16} />}
                    onClick={() => {
                      setPhase('idle');
                      setMode('fingertip');
                      setTimeout(() => startScan('fingertip'), 100);
                    }}
                  >
                    Try Fingertip
                  </BigButton>
                )}
              </div>
            )}
          </div>
        </GlassCard>

        {/* Side panel */}
        <div className="md:col-span-5 space-y-4">

          {/* Quality meter */}
          {(phase === 'scanning' || phase === 'done') && (() => {
            const displayQuality = liveQuality ?? result?.quality ?? (phase === 'done' ? 'POOR' : null);
            const motionFrac = totalFramesRef.current > 0 ? motionFramesRef.current / totalFramesRef.current : 0;
            return (
              <GlassCard variant="default" padded="md" className="space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Activity size={16} className="text-cyan-400" />
                  Signal Quality
                </h3>
                <div className={`p-3 rounded-xl border ${qualityBg(displayQuality)}`}>
                  <div className={`text-lg font-bold font-mono ${qualityColor(displayQuality)}`}>
                    {displayQuality ?? '---'}
                  </div>
                  {displayQuality && (
                    <div className="text-xs text-slate-400 mt-1">
                      {getQualityAdvice(
                        displayQuality,
                        motionFrac,
                        lastBrightnessRef.current
                      )}
                    </div>
                  )}
                </div>
                {result?.snrDb !== undefined && (
                  <div className="text-xs font-mono text-slate-400">
                    SNR: {result.snrDb.toFixed(1)} dB
                    {result.snrDb >= 3 && ' ✓'}
                  </div>
                )}
              </GlassCard>
            );
          })()}

          {/* Two methods comparison (§7.3 step 13) */}
          {comparisonText && (
            <GlassCard variant="cyan" padded="md" className="space-y-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Heart size={16} className="text-cyan-400" />
                Method Comparison
              </h3>
              <p className={`text-sm font-mono ${
                comparisonText.includes('agree') ? 'text-emerald-300' : 'text-amber-300'
              }`}>
                {comparisonText}
              </p>
            </GlassCard>
          )}

          {/* Mode selector (when idle) */}
          {phase === 'idle' && (
            <GlassCard variant="default" padded="md" className="space-y-3">
              <h3 className="text-sm font-bold text-white">Scan Mode</h3>
              <div className="space-y-2">
                <button
                  onClick={() => setMode('face')}
                  className={`w-full p-3 rounded-xl border text-left text-sm transition-colors min-h-[56px] flex items-center gap-3 ${
                    mode === 'face'
                      ? 'bg-cyan-500/10 border-cyan-500/30 text-white'
                      : 'bg-white/[0.03] border-white/10 text-slate-300 hover:border-white/20'
                  }`}
                >
                  <Camera size={18} />
                  <div>
                    <div className="font-semibold">Face (rPPG)</div>
                    <div className="text-[11px] text-slate-400">Contactless, front camera</div>
                  </div>
                </button>
                <button
                  onClick={() => setMode('fingertip')}
                  className={`w-full p-3 rounded-xl border text-left text-sm transition-colors min-h-[56px] flex items-center gap-3 ${
                    mode === 'fingertip'
                      ? 'bg-cyan-500/10 border-cyan-500/30 text-white'
                      : 'bg-white/[0.03] border-white/10 text-slate-300 hover:border-white/20'
                  }`}
                >
                  <Fingerprint size={18} />
                  <div>
                    <div className="font-semibold">Fingertip</div>
                    <div className="text-[11px] text-slate-400">Rear camera + torch</div>
                  </div>
                </button>
              </div>
            </GlassCard>
          )}

          {/* Info card */}
          <GlassCard variant="subtle" padded="md" className="space-y-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">How it works</h3>
            <p className="text-xs text-slate-400">
              {mode === 'face'
                ? 'Analyses subtle colour changes in your face caused by blood flow (rPPG). Uses the POS algorithm with a 4th-order Butterworth filter. Works best in steady, even lighting.'
                : 'Measures blood volume changes through your fingertip pressed against the camera. The red channel captures pulsatile blood flow directly.'}
            </p>
            <p className="text-[10px] text-slate-500 italic">
              This is not a medical device. Readings are estimates only.
            </p>
          </GlassCard>
        </div>
      </div>
    </div>
  );
};
