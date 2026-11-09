import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertOctagon } from 'lucide-react';

export const EmergencyFloatingButton: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // If already on the emergency protocol screen, don't show the duplicate floating button
  if (location.pathname === '/emergency') {
    return null;
  }

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.94 }}
      onClick={() => navigate('/emergency')}
      className="fixed bottom-6 right-6 z-50 w-[72px] h-[72px] rounded-full bg-gradient-to-br from-red-600 to-rose-700 text-white flex flex-col items-center justify-center p-1 shadow-[0_0_35px_rgba(239,68,68,0.7)] border-2 border-red-300 hover:border-white focus:outline-none focus:ring-4 focus:ring-red-500/50 cursor-pointer select-none glove-target animate-pulse-fast"
      aria-label="Emergency medical guidance and protocols"
      title="ACTIVATE EMERGENCY MEDICAL PROTOCOLS"
    >
      <AlertOctagon size={26} className="text-white drop-shadow-md" />
      <span className="text-[9px] font-extrabold tracking-wider uppercase text-white font-mono leading-tight">
        EMERGENCY
      </span>
    </motion.button>
  );
};
