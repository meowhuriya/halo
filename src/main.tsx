import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Register PWA service worker for deep-space offline operation
const updateSW = registerSW({
  onNeedRefresh() {
    console.log('[HALO PWA] New version available, reloading offline cache...');
    updateSW(true);
  },
  onOfflineReady() {
    console.log('[HALO PWA] All assets, fonts, and models cached for 100% offline flight autonomy.');
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
