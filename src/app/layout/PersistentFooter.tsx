import React from 'react';
import { HardDrive, WifiOff } from 'lucide-react';

export const PersistentFooter: React.FC = () => {
  return (
    <footer className="w-full border-t border-white/5 bg-[#05070D]/90 py-4 px-4 sm:px-8 mt-auto backdrop-blur-md">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
        
        {/* Left: Non-negotiable mandatory disclaimer per §2.8 */}
        <div className="flex items-center gap-2 text-center sm:text-left">
          <span className="w-2 h-2 rounded-full bg-cyan-400/60 inline-block shrink-0" />
          <p className="font-medium text-slate-300">
            Prototype for NASA Space Apps. Not a medical device.
          </p>
        </div>

        {/* Right: Offline & System Status */}
        <div className="flex items-center gap-4 text-[11px] font-mono">
          <div className="flex items-center gap-1.5 text-emerald-400/90" title="All processing occurs 100% on-device in browser IndexedDB">
            <HardDrive size={13} />
            <span>LOCAL WASM &amp; DB ACTIVE</span>
          </div>

          <div className="flex items-center gap-1.5 text-cyan-400/90" title="Offline-first PWA architecture with local models">
            <WifiOff size={13} />
            <span>OFFLINE AUTONOMY READY</span>
          </div>
        </div>

      </div>
    </footer>
  );
};
