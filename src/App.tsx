import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { MissionProvider } from './app/MissionContext';
import { JudgeTourProvider } from './features/judge/JudgeContext';
import { JudgeTourModal } from './features/judge/JudgeTourModal';
import { AppRoutes } from './app/routes';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <MissionProvider>
        <JudgeTourProvider>
          <AppRoutes />
          <JudgeTourModal />
        </JudgeTourProvider>
      </MissionProvider>
    </BrowserRouter>
  );
};

export default App;
