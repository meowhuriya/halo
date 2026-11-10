import React from 'react';
import type { CheckFlowId } from './types';

export const CheckIllustration: React.FC<{ flowId: CheckFlowId }> = ({ flowId }) => {
  switch (flowId) {
    case 'bp':
      return (
        <svg viewBox="0 0 200 120" className="w-full h-28 text-cyan-400 stroke-current fill-none">
          {/* Upper Arm & Heart Level Line */}
          <line x1="20" y1="60" x2="180" y2="60" stroke="#38E1FF" strokeDasharray="3 3" opacity="0.3" strokeWidth="1" />
          <text x="25" y="55" fill="#38E1FF" fontSize="7" opacity="0.6" fontFamily="monospace">HEART LEVEL</text>
          {/* Arm outline */}
          <path d="M40 75 Q70 70 100 70 T160 75" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" />
          {/* BP Cuff */}
          <rect x="75" y="45" width="45" height="32" rx="4" fill="#0E2338" stroke="#38E1FF" strokeWidth="2" />
          <line x1="97" y1="45" x2="97" y2="77" stroke="#38E1FF" strokeWidth="1" strokeDasharray="2 2" />
          {/* Tube & Monitor */}
          <path d="M120 62 Q135 62 145 80" stroke="#38E1FF" strokeWidth="1.5" />
          <rect x="140" y="75" width="35" height="28" rx="3" fill="#070D18" stroke="#38E1FF" strokeWidth="1.5" />
          <text x="145" y="88" fill="#38E1FF" fontSize="8" fontWeight="bold" fontFamily="monospace">120/80</text>
          <text x="145" y="97" fill="#64748B" fontSize="6" fontFamily="monospace">SYS/DIA</text>
        </svg>
      );

    case 'spo2':
      return (
        <svg viewBox="0 0 200 120" className="w-full h-28 text-cyan-400 stroke-current fill-none">
          {/* Finger Outline */}
          <path d="M30 65 C50 65 70 60 110 60 C125 60 135 65 140 70 C140 78 125 80 110 80 C70 80 50 75 30 75" stroke="#94A3B8" strokeWidth="2.5" fill="#0B132B" />
          <path d="M120 63 Q130 63 135 68" stroke="#64748B" strokeWidth="1.5" />
          {/* Pulse Ox Clip */}
          <rect x="100" y="48" width="45" height="42" rx="6" fill="#0C2340" stroke="#38E1FF" strokeWidth="2" />
          {/* Sensor light beam */}
          <line x1="122" y1="50" x2="122" y2="88" stroke="#EF4444" strokeWidth="2" strokeDasharray="2 2" />
          {/* Display screen */}
          <rect x="107" y="52" width="30" height="15" rx="2" fill="#050B14" stroke="#38E1FF" strokeWidth="1" />
          <text x="111" y="63" fill="#22C55E" fontSize="9" fontWeight="bold" fontFamily="monospace">98%</text>
        </svg>
      );

    case 'temperature':
      return (
        <svg viewBox="0 0 200 120" className="w-full h-28 text-cyan-400 stroke-current fill-none">
          {/* Tympanic probe / infrared thermometer body */}
          <path d="M60 40 L120 40 L130 55 L135 60 L130 65 L120 80 L60 80 Z" stroke="#38E1FF" strokeWidth="2" fill="#0A192F" />
          <line x1="135" y1="60" x2="160" y2="60" stroke="#F59E0B" strokeWidth="2" strokeDasharray="3 3" />
          {/* Thermal radiation ripples */}
          <path d="M165 52 Q172 60 165 68" stroke="#F59E0B" strokeWidth="1.5" />
          <path d="M173 48 Q182 60 173 72" stroke="#F59E0B" strokeWidth="1" opacity="0.6" />
          {/* Display screen */}
          <rect x="75" y="50" width="35" height="20" rx="3" fill="#040914" stroke="#38E1FF" strokeWidth="1" />
          <text x="80" y="64" fill="#38E1FF" fontSize="9" fontWeight="bold" fontFamily="monospace">36.8°C</text>
        </svg>
      );

    case 'glucose':
      return (
        <svg viewBox="0 0 200 120" className="w-full h-28 text-cyan-400 stroke-current fill-none">
          {/* Glucometer device */}
          <rect x="40" y="35" width="55" height="65" rx="8" fill="#0A1E35" stroke="#38E1FF" strokeWidth="2" />
          <rect x="48" y="45" width="39" height="25" rx="3" fill="#050B14" stroke="#38E1FF" strokeWidth="1" />
          <text x="54" y="61" fill="#38E1FF" fontSize="10" fontWeight="bold" fontFamily="monospace">95</text>
          <text x="54" y="67" fill="#64748B" fontSize="5" fontFamily="monospace">mg/dL</text>
          {/* Test Strip */}
          <rect x="95" y="62" width="35" height="10" rx="2" fill="#1E293B" stroke="#38E1FF" strokeWidth="1" />
          <circle cx="127" cy="67" r="4" fill="#EF4444" stroke="#F87171" strokeWidth="1" />
          {/* Droplet guide */}
          <path d="M150 50 C145 60 142 66 142 70 A5 5 0 0 0 152 70 C152 66 149 60 145 50" fill="#EF4444" />
        </svg>
      );

    case 'heart_rate':
      return (
        <svg viewBox="0 0 200 120" className="w-full h-28 text-cyan-400 stroke-current fill-none">
          {/* Wrist & Radial Artery */}
          <path d="M40 75 Q90 70 160 70" stroke="#94A3B8" strokeWidth="3" strokeLinecap="round" />
          <path d="M40 95 Q90 95 160 90" stroke="#94A3B8" strokeWidth="3" strokeLinecap="round" />
          {/* Radial pulse point */}
          <circle cx="110" cy="72" r="5" fill="#EF4444" stroke="#F87171" strokeWidth="1.5" />
          <circle cx="110" cy="72" r="10" stroke="#EF4444" strokeWidth="1" opacity="0.4" strokeDasharray="2 2" />
          {/* Two fingers palpating */}
          <path d="M95 25 L95 65 Q95 72 102 72 Q110 72 110 65 L110 25" stroke="#38E1FF" strokeWidth="2" fill="#0C213B" />
          <path d="M112 25 L112 65 Q112 72 118 72 Q125 72 125 65 L125 30" stroke="#38E1FF" strokeWidth="2" fill="#0C213B" />
          <text x="135" y="55" fill="#38E1FF" fontSize="8" fontFamily="monospace">30s COUNT × 2</text>
        </svg>
      );

    case 'respiratory':
      return (
        <svg viewBox="0 0 200 120" className="w-full h-28 text-cyan-400 stroke-current fill-none">
          {/* Trachea & Bronchi */}
          <path d="M100 25 L100 50 L85 65 M100 50 L115 65" stroke="#38E1FF" strokeWidth="2" strokeLinecap="round" />
          {/* Left Lung */}
          <path d="M85 65 C65 65 50 80 60 100 C70 105 85 100 88 80 Z" stroke="#38E1FF" strokeWidth="1.5" fill="#0B2038" />
          {/* Right Lung */}
          <path d="M115 65 C135 65 150 80 140 100 C130 105 115 100 112 80 Z" stroke="#38E1FF" strokeWidth="1.5" fill="#0B2038" />
          {/* Breath Airflow Indicators */}
          <path d="M30 60 Q45 50 60 60" stroke="#38E1FF" strokeWidth="1" strokeDasharray="3 3" />
          <path d="M170 60 Q155 50 140 60" stroke="#38E1FF" strokeWidth="1" strokeDasharray="3 3" />
          <text x="75" y="115" fill="#64748B" fontSize="7" fontFamily="monospace">INHALATION CYCLES</text>
        </svg>
      );

    case 'sleep':
      return (
        <svg viewBox="0 0 200 120" className="w-full h-28 text-cyan-400 stroke-current fill-none">
          {/* Zero-G Sleep Bunk / Tether */}
          <rect x="40" y="35" width="120" height="55" rx="6" fill="#071326" stroke="#1E293B" strokeWidth="1.5" />
          {/* Sleeping Bag restraint */}
          <path d="M60 45 L140 45 L140 80 L60 80 Z" fill="#0B2340" stroke="#38E1FF" strokeWidth="1.5" />
          {/* Restraint Straps */}
          <line x1="85" y1="45" x2="85" y2="80" stroke="#F59E0B" strokeWidth="2" />
          <line x1="115" y1="45" x2="115" y2="80" stroke="#F59E0B" strokeWidth="2" />
          {/* Head & eye mask */}
          <circle cx="70" cy="62" r="9" fill="#94A3B8" />
          <rect x="66" y="59" width="8" height="4" rx="1" fill="#020617" />
          <text x="80" y="105" fill="#38E1FF" fontSize="8" fontFamily="monospace">24-HOUR SLEEP LOG</text>
        </svg>
      );

    case 'mood':
      return (
        <svg viewBox="0 0 200 120" className="w-full h-28 text-cyan-400 stroke-current fill-none">
          {/* 5 Mood Faces scale */}
          <g transform="translate(25, 45)">
            <circle cx="15" cy="15" r="12" stroke="#EF4444" strokeWidth="1.5" fill="#200A0A" />
            <path d="M11 20 Q15 16 19 20" stroke="#EF4444" strokeWidth="1.2" />
          </g>
          <g transform="translate(55, 45)">
            <circle cx="15" cy="15" r="12" stroke="#F97316" strokeWidth="1.5" fill="#221008" />
            <line x1="11" y1="18" x2="19" y2="18" stroke="#F97316" strokeWidth="1.2" />
          </g>
          <g transform="translate(85, 45)">
            <circle cx="15" cy="15" r="12" stroke="#F59E0B" strokeWidth="1.5" fill="#221B08" />
            <path d="M11 17 Q15 19 19 17" stroke="#F59E0B" strokeWidth="1.2" />
          </g>
          <g transform="translate(115, 45)">
            <circle cx="15" cy="15" r="12" stroke="#10B981" strokeWidth="1.5" fill="#082218" />
            <path d="M10 16 Q15 22 20 16" stroke="#10B981" strokeWidth="1.2" />
          </g>
          <g transform="translate(145, 45)">
            <circle cx="15" cy="15" r="12" stroke="#38E1FF" strokeWidth="1.5" fill="#081E2B" />
            <path d="M9 15 Q15 23 21 15" stroke="#38E1FF" strokeWidth="1.5" />
          </g>
          <text x="65" y="90" fill="#64748B" fontSize="8" fontFamily="monospace">1 TO 5 VALENCE SCALE</text>
        </svg>
      );

    case 'phq2_gad2':
      return (
        <svg viewBox="0 0 200 120" className="w-full h-28 text-cyan-400 stroke-current fill-none">
          {/* Clipboard */}
          <rect x="65" y="25" width="70" height="80" rx="5" fill="#081A2E" stroke="#38E1FF" strokeWidth="1.5" />
          <rect x="85" y="20" width="30" height="10" rx="2" fill="#1E293B" stroke="#38E1FF" strokeWidth="1" />
          {/* Checklist items */}
          <line x1="75" y1="45" x2="125" y2="45" stroke="#64748B" strokeWidth="1.5" />
          <line x1="75" y1="58" x2="125" y2="58" stroke="#64748B" strokeWidth="1.5" />
          <line x1="75" y1="71" x2="125" y2="71" stroke="#64748B" strokeWidth="1.5" />
          <line x1="75" y1="84" x2="115" y2="84" stroke="#64748B" strokeWidth="1.5" />
          {/* Checks */}
          <path d="M72 45 L74 48 L78 43" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M72 58 L74 61 L78 56" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" />
          <text x="50" y="115" fill="#38E1FF" fontSize="7" fontFamily="monospace">VALIDATED CLINICAL SCREENS</text>
        </svg>
      );

    case 'exercise':
      return (
        <svg viewBox="0 0 200 120" className="w-full h-28 text-cyan-400 stroke-current fill-none">
          {/* ARED / Countermeasure schematic */}
          <rect x="50" y="70" width="100" height="8" rx="2" fill="#1E293B" stroke="#64748B" strokeWidth="1" />
          {/* Weight bar & load canisters */}
          <line x1="60" y1="40" x2="140" y2="40" stroke="#38E1FF" strokeWidth="2.5" />
          <circle cx="65" cy="40" r="14" fill="#0A1D33" stroke="#38E1FF" strokeWidth="1.5" />
          <circle cx="135" cy="40" r="14" fill="#0A1D33" stroke="#38E1FF" strokeWidth="1.5" />
          <text x="58" y="43" fill="#38E1FF" fontSize="7" fontFamily="monospace">ARED</text>
          <text x="128" y="43" fill="#38E1FF" fontSize="7" fontFamily="monospace">LOAD</text>
          {/* Connecting pistons */}
          <line x1="75" y1="40" x2="75" y2="70" stroke="#64748B" strokeWidth="1.5" />
          <line x1="125" y1="40" x2="125" y2="70" stroke="#64748B" strokeWidth="1.5" />
          <text x="65" y="95" fill="#F59E0B" fontSize="8" fontFamily="monospace">2.5H DAILY COUNTERMEASURE</text>
        </svg>
      );

    default:
      return null;
  }
};
