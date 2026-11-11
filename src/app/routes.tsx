import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppLayout } from './layout/AppLayout';
import { BridgeView } from '../features/bridge/BridgeView';
import { ScanView } from '../features/scan/ScanView';
import { ChecksView } from '../features/checks/ChecksView';
import { CognitionView } from '../features/cognition/CognitionView';
import { VisionView } from '../features/vision/VisionView';
import { TrendsView } from '../features/trends/TrendsView';
import { EmergencyView } from '../features/emergency/EmergencyView';
import { GroundLinkView } from '../features/groundlink/GroundLinkView';
import { LearnView } from '../features/learn/LearnView';
import { ValidationView } from '../features/validation/ValidationView';
import { OnboardingView } from '../features/onboarding/OnboardingView';
import { GroundConsoleView } from '../ground/GroundConsoleView';
import { useMission } from './MissionContext';

export const AppRoutes: React.FC = () => {
  const { hasProfile, isLoading } = useMission();
  const location = useLocation();

  if (isLoading && !hasProfile) {
    return (
      <div className="min-h-screen bg-[#05070D] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-400 flex items-center justify-center animate-spin">
          <span className="font-mono font-extrabold text-cyan-300">H</span>
        </div>
        <div className="text-xs font-mono text-cyan-300 tracking-widest uppercase">
          INITIALIZING HALO OFF-LINE TELEMETRY...
        </div>
      </div>
    );
  }

  // If user hasn't completed onboarding yet and is not already on /onboarding, redirect
  if (!hasProfile && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<BridgeView />} />
        <Route path="/bridge" element={<Navigate to="/" replace />} />
        <Route path="/scan" element={<ScanView />} />
        <Route path="/checks" element={<ChecksView />} />
        <Route path="/cognition" element={<CognitionView />} />
        <Route path="/vision" element={<VisionView />} />
        <Route path="/trends" element={<TrendsView />} />
        <Route path="/groundlink" element={<GroundLinkView />} />
        <Route path="/learn" element={<LearnView />} />
        <Route path="/validation" element={<ValidationView />} />
        <Route path="/onboarding" element={<OnboardingView />} />
        <Route path="/ground" element={<GroundConsoleView />} />
      </Route>

      {/* Emergency is full-screen without standard top bar / nav */}
      <Route path="/emergency" element={<EmergencyView />} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
