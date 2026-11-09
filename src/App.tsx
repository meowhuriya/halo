import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { MissionProvider } from './app/MissionContext';
import { AppRoutes } from './app/routes';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <MissionProvider>
        <AppRoutes />
      </MissionProvider>
    </BrowserRouter>
  );
};

export default App;
