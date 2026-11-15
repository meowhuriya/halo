/**
 * HALO buddy — the assistant's character, drawn as code so it can react.
 * The halo is a status ring (idle / listening / thinking / speaking) and the
 * visor eyes change with the state. All motion respects prefers-reduced-motion.
 */
import React from 'react';

export type BuddyState = 'idle' | 'listening' | 'thinking' | 'speaking';

export const HaloBuddy: React.FC<{ state?: BuddyState; size?: number; className?: string }> = ({ state = 'idle', size = 64, className = '' }) => (
  <svg
    viewBox="0 0 128 128"
    width={size}
    height={size}
    className={`halo-buddy halo-buddy--${state} ${className}`}
    role="img"
    aria-label={`HALO assistant, ${state}`}
  >
    <defs>
      <linearGradient id="hbShell" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#FFFFFF" />
        <stop offset="1" stopColor="#CBD9EF" />
      </linearGradient>
      <linearGradient id="hbShellSide" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#F3F7FF" />
        <stop offset="1" stopColor="#AFC2E0" />
      </linearGradient>
      <radialGradient id="hbVisor" cx="0.35" cy="0.25" r="0.9">
        <stop offset="0" stopColor="#223558" />
        <stop offset="0.55" stopColor="#0E182C" />
        <stop offset="1" stopColor="#060A14" />
      </radialGradient>
      <linearGradient id="hbGloss" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.55" />
        <stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.05" />
        <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
      </linearGradient>
      <radialGradient id="hbGlow" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#BFE3FF" stopOpacity="0.9" />
        <stop offset="1" stopColor="#73B3E7" stopOpacity="0" />
      </radialGradient>
    </defs>

    {/* ambient glow */}
    <circle cx="64" cy="66" r="52" fill="url(#hbGlow)" className="hb-ambient" />

    {/* halo: status ring (two passes so it reads as a ring of light) */}
    <g className="hb-halo" transform="rotate(-14 64 20)">
      <ellipse cx="64" cy="20" rx="30" ry="8" fill="none" className="hb-halo-base" strokeWidth="5" strokeLinecap="round" />
      <ellipse cx="64" cy="20" rx="30" ry="8" fill="none" className="hb-halo-light" strokeWidth="3" strokeLinecap="round" />
    </g>

    {/* shoulders / bust */}
    <path d="M30 128 C30 104 44 92 64 92 C84 92 98 104 98 128 Z" fill="url(#hbShell)" />
    <path d="M86 98 C94 104 98 114 98 128 L84 128 C84 116 82 106 78 98 Z" fill="url(#hbShellSide)" opacity="0.7" />
    {/* chest star (echoes the app icon) */}
    <path d="M64 102 L66.6 108.4 L73 111 L66.6 113.6 L64 120 L61.4 113.6 L55 111 L61.4 108.4 Z" fill="#6FA8E6" />
    {/* neck */}
    <rect x="56" y="84" width="16" height="10" rx="4" fill="#9FB4D6" />

    {/* ear pods */}
    <rect x="16" y="50" width="12" height="26" rx="6" fill="url(#hbShellSide)" />
    <rect x="100" y="50" width="12" height="26" rx="6" fill="url(#hbShellSide)" />
    <circle cx="106" cy="63" r="3.2" className="hb-ear-light" />

    {/* antenna nub */}
    <rect x="60" y="26" width="8" height="8" rx="4" fill="#B9CBE8" />
    <circle cx="64" cy="27" r="2.4" className="hb-antenna-light" />

    {/* helmet */}
    <rect x="24" y="30" width="80" height="60" rx="30" fill="url(#hbShell)" />
    {/* visor */}
    <rect x="31" y="37" width="66" height="44" rx="22" fill="url(#hbVisor)" />
    <path d="M38 44 C46 38 70 37 84 41 C76 44 56 46 40 52 Z" fill="url(#hbGloss)" />

    {/* eyes */}
    <g className="hb-eyes">
      {/* happy crescents (idle / speaking) */}
      <g className="hb-eyes-happy">
        <path d="M44 61 Q51 52 58 61" fill="none" stroke="#9CDCFF" strokeWidth="4" strokeLinecap="round" />
        <path d="M70 61 Q77 52 84 61" fill="none" stroke="#9CDCFF" strokeWidth="4" strokeLinecap="round" />
      </g>
      {/* attentive rounds (listening) */}
      <g className="hb-eyes-round">
        <circle cx="51" cy="58" r="5.5" fill="#9CDCFF" />
        <circle cx="77" cy="58" r="5.5" fill="#9CDCFF" />
        <circle cx="53" cy="56" r="1.8" fill="#FFFFFF" />
        <circle cx="79" cy="56" r="1.8" fill="#FFFFFF" />
      </g>
      {/* thinking: one narrowed eye + drifting dots */}
      <g className="hb-eyes-think">
        <path d="M44 59 L58 59" stroke="#9CDCFF" strokeWidth="4" strokeLinecap="round" />
        <circle cx="77" cy="58" r="5.5" fill="#9CDCFF" />
        <g className="hb-think-dots">
          <circle cx="56" cy="72" r="1.8" fill="#9CDCFF" />
          <circle cx="64" cy="72" r="1.8" fill="#9CDCFF" />
          <circle cx="72" cy="72" r="1.8" fill="#9CDCFF" />
        </g>
      </g>
      {/* blink lid */}
      <rect x="31" y="37" width="66" height="44" rx="22" fill="#0A1222" className="hb-lid" />
    </g>
  </svg>
);

export default HaloBuddy;
