import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMission } from '../../app/MissionContext';
import { seedDemoMission } from '../../data/seed/demoMission';
import {
  getLiveJudgeScriptData,
  buildJudgeTourSteps,
  playNarration,
  type JudgeScriptData,
  type JudgeTourStep,
} from './judgeScript';

interface JudgeContextValue {
  isTourActive: boolean;
  currentStepIndex: number;
  isPaused: boolean;
  isEndCardVisible: boolean;
  scriptData: JudgeScriptData | null;
  steps: JudgeTourStep[];
  currentStep: JudgeTourStep | null;
  stepElapsedMs: number;
  totalElapsedMs: number;
  startTour: () => Promise<void>;
  pauseTour: () => void;
  resumeTour: () => void;
  skipStep: () => void;
  exitTour: () => void;
  restartTour: () => Promise<void>;
}

const JudgeContext = createContext<JudgeContextValue | null>(null);

export const JudgeTourProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const { refreshMission } = useMission();

  const [isTourActive, setIsTourActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isEndCardVisible, setIsEndCardVisible] = useState(false);
  const [scriptData, setScriptData] = useState<JudgeScriptData | null>(null);
  const [steps, setSteps] = useState<JudgeTourStep[]>([]);
  const [stepElapsedMs, setStepElapsedMs] = useState(0);
  const [totalElapsedMs, setTotalElapsedMs] = useState(0);

  const speechHandleRef = useRef<{ stop: () => void; pause: () => void; resume: () => void } | null>(null);
  const timerRef = useRef<number | null>(null);

  const currentStep = isTourActive && steps.length > 0 && currentStepIndex < steps.length
    ? steps[currentStepIndex]
    : null;

  // Cleanup speech and timers
  const cleanupPlayback = useCallback(() => {
    if (speechHandleRef.current) {
      speechHandleRef.current.stop();
      speechHandleRef.current = null;
    }
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Exit tour
  const exitTour = useCallback(() => {
    cleanupPlayback();
    setIsTourActive(false);
    setIsEndCardVisible(false);
    setCurrentStepIndex(0);
    setStepElapsedMs(0);
    setTotalElapsedMs(0);
  }, [cleanupPlayback]);

  // Advance to next step or show end card
  const advanceStep = useCallback(
    (nextIdx: number) => {
      cleanupPlayback();
      setStepElapsedMs(0);

      if (nextIdx >= steps.length) {
        // Tour reached end
        setIsEndCardVisible(true);
        return;
      }

      setCurrentStepIndex(nextIdx);
      const nextStep = steps[nextIdx];
      if (nextStep) {
        navigate(nextStep.route);
      }
    },
    [steps, navigate, cleanupPlayback]
  );

  // Skip current step
  const skipStep = useCallback(() => {
    advanceStep(currentStepIndex + 1);
  }, [advanceStep, currentStepIndex]);

  // Pause tour
  const pauseTour = useCallback(() => {
    setIsPaused(true);
    if (speechHandleRef.current) {
      speechHandleRef.current.pause();
    }
  }, []);

  // Resume tour
  const resumeTour = useCallback(() => {
    setIsPaused(false);
    if (speechHandleRef.current) {
      speechHandleRef.current.resume();
    }
  }, []);

  // Play current step narration and run timer
  useEffect(() => {
    if (!isTourActive || isEndCardVisible || isPaused || !currentStep) return;

    // Start spoken narration
    const handle = playNarration(currentStep.spokenNarration, () => {
      // Speech finished
    });
    speechHandleRef.current = handle;

    // Run interval for countdown progress
    const startTime = Date.now() - stepElapsedMs;
    const interval = window.setInterval(() => {
      const elapsed = Date.now() - startTime;
      setStepElapsedMs(elapsed);

      // Compute total elapsed (sum of previous steps + elapsed)
      const prevDuration = steps
        .slice(0, currentStepIndex)
        .reduce((sum, s) => sum + s.durationMs, 0);
      setTotalElapsedMs(prevDuration + elapsed);

      if (elapsed >= currentStep.durationMs) {
        advanceStep(currentStepIndex + 1);
      }
    }, 200);

    timerRef.current = interval;

    return () => {
      window.clearInterval(interval);
      handle.stop();
    };
  }, [isTourActive, isEndCardVisible, isPaused, currentStepIndex, currentStep, advanceStep, steps]);

  // Start Tour
  const startTour = useCallback(async () => {
    cleanupPlayback();

    // 1. Seed deterministic demo mission per §7.15
    await seedDemoMission();
    await refreshMission();

    // 2. Load live data from real rules engine and demo telemetry
    const liveData = await getLiveJudgeScriptData();
    const tourSteps = buildJudgeTourSteps(liveData);

    setScriptData(liveData);
    setSteps(tourSteps);
    setCurrentStepIndex(0);
    setStepElapsedMs(0);
    setTotalElapsedMs(0);
    setIsPaused(false);
    setIsEndCardVisible(false);
    setIsTourActive(true);

    // 3. Navigate to Step 1 (Bridge)
    navigate('/');
  }, [cleanupPlayback, refreshMission, navigate]);

  const restartTour = useCallback(async () => {
    await startTour();
  }, [startTour]);

  return (
    <JudgeContext.Provider
      value={{
        isTourActive,
        currentStepIndex,
        isPaused,
        isEndCardVisible,
        scriptData,
        steps,
        currentStep,
        stepElapsedMs,
        totalElapsedMs,
        startTour,
        pauseTour,
        resumeTour,
        skipStep,
        exitTour,
        restartTour,
      }}
    >
      {children}
    </JudgeContext.Provider>
  );
};

export function useJudgeTour(): JudgeContextValue {
  const context = useContext(JudgeContext);
  if (!context) {
    throw new Error('useJudgeTour must be used within a JudgeTourProvider');
  }
  return context;
}
