import React from 'react';
import { Outlet } from 'react-router-dom';
import { TopBar } from './TopBar';
import { NavigationBar } from './NavigationBar';
import { EmergencyFloatingButton } from './EmergencyFloatingButton';
import { PersistentFooter } from './PersistentFooter';

export const AppLayout: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-[#0B1628] text-slate-100 relative">
      <TopBar />
      <NavigationBar />
      
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-24 relative">
        <Outlet />
      </main>

      <EmergencyFloatingButton />
      <PersistentFooter />
    </div>
  );
};
