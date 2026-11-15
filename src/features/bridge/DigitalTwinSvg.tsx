import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';

const Twin3D = lazy(() => import('./Twin3D'));
import {
  AlertTriangle,
  Bone,
  Brain,
  Check,
  Droplet,
  Eye,
  Heart,
  HelpCircle,
  Octagon,
  Sun,
  Wind,
} from 'lucide-react';
import type { HealthStatus } from '../../data/db';
import type { BodyRegionTelemetry, BodySystemId } from './digitalTwin';

interface DigitalTwinSvgProps {
  regions: Record<BodySystemId, BodyRegionTelemetry>;
  regionList: BodyRegionTelemetry[];
  selectedRegionId: BodySystemId | null;
  onSelectRegion: (regionId: BodySystemId) => void;
}

type IconComp = React.ComponentType<{ size?: number | string; className?: string }>;

const REGION_ICONS: Record<BodySystemId, IconComp> = {
  brain: Brain,
  eyes: Eye,
  heart: Heart,
  lungs: Wind,
  blood: Droplet,
  bones: Bone,
  skin: Sun,
};

function getRegionVisual(status: HealthStatus | null): {
  stroke: string;
  fill: string;
  glow: string;
  badgeText: string;
  badgeBg: string;
  badgeBorder: string;
  label: string;
  StatusIcon: IconComp;
  isCritical: boolean;
} {
  if (status === null) {
    return {
      stroke: '#73B3E7',
      fill: 'rgba(115, 179, 231, 0.14)',
      glow: 'rgba(115, 179, 231, 0.35)',
      badgeText: '#67E8F9',
      badgeBg: 'rgba(115, 179, 231, 0.10)',
      badgeBorder: 'rgba(115, 179, 231, 0.30)',
      label: 'NO DATA',
      StatusIcon: HelpCircle,
      isCritical: false,
    };
  }
  switch (status) {
    case 'CRITICAL':
      return {
        stroke: '#EF4444',
        fill: 'rgba(239, 68, 68, 0.34)',
        glow: 'rgba(239, 68, 68, 0.85)',
        badgeText: '#FCA5A5',
        badgeBg: 'rgba(239, 68, 68, 0.22)',
        badgeBorder: 'rgba(239, 68, 68, 0.65)',
        label: 'CRITICAL',
        StatusIcon: Octagon,
        isCritical: true,
      };
    case 'ALERT':
      return {
        stroke: '#F97316',
        fill: 'rgba(249, 115, 22, 0.28)',
        glow: 'rgba(249, 115, 22, 0.70)',
        badgeText: '#FDBA74',
        badgeBg: 'rgba(249, 115, 22, 0.18)',
        badgeBorder: 'rgba(249, 115, 22, 0.55)',
        label: 'ALERT',
        StatusIcon: AlertTriangle,
        isCritical: false,
      };
    case 'WATCH':
      return {
        stroke: '#F59E0B',
        fill: 'rgba(245, 158, 11, 0.26)',
        glow: 'rgba(245, 158, 11, 0.65)',
        badgeText: '#FDE68A',
        badgeBg: 'rgba(245, 158, 11, 0.16)',
        badgeBorder: 'rgba(245, 158, 11, 0.45)',
        label: 'WATCH',
        StatusIcon: Eye,
        isCritical: false,
      };
    case 'NOMINAL':
    default:
      return {
        stroke: '#22C55E',
        fill: 'rgba(34, 197, 94, 0.22)',
        glow: 'rgba(34, 197, 94, 0.55)',
        badgeText: '#86EFAC',
        badgeBg: 'rgba(34, 197, 94, 0.14)',
        badgeBorder: 'rgba(34, 197, 94, 0.40)',
        label: 'NOMINAL',
        StatusIcon: Check,
        isCritical: false,
      };
  }
}

export const DigitalTwinSvg: React.FC<DigitalTwinSvgProps> = ({
  regions,
  regionList,
  selectedRegionId,
  onSelectRegion,
}) => {
  const skinVis = getRegionVisual(regions.skin.status);
  const brainVis = getRegionVisual(regions.brain.status);
  const eyesVis = getRegionVisual(regions.eyes.status);
  const lungsVis = getRegionVisual(regions.lungs.status);
  const heartVis = getRegionVisual(regions.heart.status);
  const bloodVis = getRegionVisual(regions.blood.status);
  const bonesVis = getRegionVisual(regions.bones.status);

  // ---- Hologram: perspective tilt that follows the pointer, idle turn, expand on click ----
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [hover, setHover] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [threeD, setThreeD] = useState(false);
  const webglOk = typeof document !== 'undefined' && (() => { try { const c = document.createElement('canvas'); return Boolean(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } })();
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const el = stageRef.current; if (!el || reduceMotion) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;   // -0.5 .. 0.5
    const py = (e.clientY - r.top) / r.height - 0.5;
    const max = expanded ? 22 : 14;
    setTilt({ x: -py * max, y: px * max });
  }, [expanded, reduceMotion]);
  const onPointerLeave = useCallback(() => { setHover(false); setTilt({ x: 0, y: 0 }); }, []);

  // Device tilt on phones (no permission prompt on Android; iOS needs a gesture, so we just try quietly)
  useEffect(() => {
    if (reduceMotion || typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) return;
    const onTilt = (e: DeviceOrientationEvent) => {
      if (hover) return;
      const g = e.gamma ?? 0, b = e.beta ?? 0;
      setTilt({ x: Math.max(-12, Math.min(12, (b - 45) * -0.25)), y: Math.max(-12, Math.min(12, g * 0.3)) });
    };
    window.addEventListener('deviceorientation', onTilt);
    return () => window.removeEventListener('deviceorientation', onTilt);
  }, [hover, reduceMotion]);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpanded(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

  const handleSvgKeyDown = (regionId: BodySystemId, e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelectRegion(regionId);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
      {/* Left: Layered Anatomical Hologram SVG */}
      <div className={`md:col-span-6 flex justify-center ${expanded ? 'holo-expanded-slot' : ''}`}>
        {expanded && <button type="button" aria-label="Close hologram" className="holo-backdrop" onClick={() => setExpanded(false)} />}
        <div
          ref={stageRef}
          className={`holo-stage relative w-full max-w-[340px] aspect-[340/480] rounded-3xl ${expanded ? 'holo-stage--expanded' : ''} ${hover ? 'holo-stage--hover' : ''}`}
          onPointerMove={onPointerMove}
          onPointerEnter={() => setHover(true)}
          onPointerLeave={onPointerLeave}
          onDoubleClick={() => { setExpanded((v) => !v); setThreeD(webglOk); }}
          title={expanded ? 'Double-click or press Esc to close' : 'Move to turn · double-click to enlarge'}
        >
          <div className="holo-scanlines" aria-hidden />
          {expanded && threeD && webglOk ? (
            <div className="absolute inset-0 rounded-3xl overflow-hidden">
              <Suspense fallback={<div className="w-full h-full flex items-center justify-center text-xs text-cyan-200/80 tracking-widest uppercase">Projecting hologram…</div>}>
                <Twin3D regions={regions} selectedRegionId={selectedRegionId} onSelectRegion={onSelectRegion} />
              </Suspense>
            </div>
          ) : null}
          <div
            className="holo-body"
            style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`, visibility: expanded && threeD && webglOk ? 'hidden' : 'visible' }}
            data-hidden={expanded && threeD && webglOk ? 'true' : undefined}
          >
          <div className="holo-spin">
          <svg
            viewBox="0 0 340 480"
            className={`w-full h-full select-none overflow-visible holo-svg ${selectedRegionId ? 'holo-has-selection' : ''}`}
            role="img"
            aria-label="Interactive Astronaut Digital Twin physiological hologram"
          >
            <defs>
              <radialGradient id="hudBgAura" cx="50%" cy="46%" r="52%">
                <stop offset="0%" stopColor="rgba(115, 179, 231, 0.15)" />
                <stop offset="65%" stopColor="rgba(115, 179, 231, 0.04)" />
                <stop offset="100%" stopColor="rgba(5, 7, 13, 0)" />
              </radialGradient>

              <linearGradient id="bodyShellGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(115, 179, 231, 0.14)" />
                <stop offset="50%" stopColor="rgba(15, 23, 42, 0.55)" />
                <stop offset="100%" stopColor="rgba(115, 179, 231, 0.08)" />
              </linearGradient>

              <filter id="regionGlow" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              <filter id="softGlow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="2.2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Telemetry Coordinate Backdrop */}
            <circle cx="170" cy="240" r="145" fill="url(#hudBgAura)" pointerEvents="none" />
            <circle
              cx="170"
              cy="240"
              r="142"
              fill="none"
              stroke="rgba(115, 179, 231, 0.12)"
              strokeWidth="1"
              strokeDasharray="4 6"
              pointerEvents="none"
            />
            <line
              x1="25"
              y1="240"
              x2="315"
              y2="240"
              stroke="rgba(115, 179, 231,0.08)"
              strokeDasharray="3 5"
              pointerEvents="none"
            />
            <line
              x1="170"
              y1="18"
              x2="170"
              y2="465"
              stroke="rgba(115, 179, 231,0.1)"
              strokeDasharray="2 6"
              pointerEvents="none"
            />

            {/* Base Silhouette Reference */}
            <path
              d="M 170 28 C 192 28, 206 44, 206 67 C 206 83, 198 94, 188 100 L 191 112 L 236 127 C 248 131, 256 142, 260 156 L 284 252 C 287 264, 276 271, 267 267 L 258 263 L 236 172 L 228 242 L 235 436 C 236 449, 221 456, 211 452 L 204 449 L 194 282 L 170 278 L 146 282 L 136 449 C 134 456, 118 456, 108 452 L 105 436 L 112 242 L 104 172 L 82 263 C 73 271, 56 266, 56 252 L 80 156 C 84 142, 92 131, 104 127 L 149 112 L 152 100 C 142 94, 134 83, 134 67 C 134 44, 148 28, 170 28 Z"
              fill="url(#bodyShellGrad)"
              stroke="rgba(148, 163, 184, 0.35)"
              strokeWidth="1.5"
              strokeLinejoin="round"
              pointerEvents="none"
            />

            {/* Outer Dermal Radiation Aura Contour (stroke-only hit target so torso organs remain unobscured) */}
            <path
              d="M 170 23 C 196 23, 212 42, 212 67 C 212 84, 203 97, 193 103 L 240 121 C 254 126, 263 139, 268 156 L 291 253 C 294 270, 274 280, 258 272 L 241 186 L 235 245 L 241 440 C 242 456, 219 464, 203 458 L 194 290 L 170 286 L 146 290 L 137 458 C 121 464, 98 456, 99 440 L 105 245 L 99 186 L 82 272 C 66 280, 46 270, 49 253 L 72 156 C 77 139, 86 126, 100 121 L 147 103 C 137 97, 128 84, 128 67 C 128 42, 144 23, 170 23 Z"
              fill="none"
              stroke={skinVis.stroke}
              strokeWidth={selectedRegionId === 'skin' ? 3 : 2}
              strokeOpacity={selectedRegionId === 'skin' ? 0.95 : 0.72}
              strokeDasharray="6 3"
              pointerEvents="stroke"
              onClick={() => onSelectRegion('skin')}
              className={`cursor-pointer ${skinVis.isCritical ? 'critical-region-pulse' : ''}`}
              filter="url(#softGlow)"
            />

            {/* LAYER 1: SKIN / RADIATION (Interactive Shoulder Dosimeter Sensor & Callout) */}
            <g
              data-testid="twin-svg-skin"
              data-region="skin"
              data-selected={selectedRegionId === 'skin' ? 'true' : undefined}
              role="button"
              tabIndex={0}
              aria-label={`Skin and Radiation region, status ${skinVis.label}`}
              onClick={() => onSelectRegion('skin')}
              onKeyDown={(e) => handleSvgKeyDown('skin', e)}
              className={`cursor-pointer focus:outline-none ${skinVis.isCritical ? 'critical-region-pulse' : ''}`}
              filter="url(#softGlow)"
            >
              {/* Contiguous transparent hit-target spanning dosimeter node + RAD pill */}
              <rect x="224" y="114" width="102" height="46" rx="12" fill="transparent" />
              {/* Shoulder sensor & clickable pill */}
              <circle
                cx="240"
                cy="144"
                r="14"
                fill={skinVis.fill}
                stroke={skinVis.stroke}
                strokeWidth="2"
              />
              <circle cx="240" cy="144" r="4.5" fill={skinVis.stroke} />
              <line x1="254" y1="140" x2="288" y2="128" stroke={skinVis.stroke} strokeWidth="1" strokeDasharray="2 2" />
              <rect
                x="288"
                y="117"
                width="36"
                height="20"
                rx="6"
                fill="#0A1224"
                stroke={skinVis.stroke}
                strokeWidth="1.2"
              />
              <text x="306" y="130" textAnchor="middle" fill={skinVis.badgeText} fontSize="9.5" fontFamily="monospace">
                RAD
              </text>
            </g>

            {/* LAYER 2: BONES & MUSCLE (Skeletal Frame, Pelvis, Femurs, Clavicles) */}
            <g
              data-testid="twin-svg-bones"
              data-region="bones"
              data-selected={selectedRegionId === 'bones' ? 'true' : undefined}
              role="button"
              tabIndex={0}
              aria-label={`Bones and Muscle region, status ${bonesVis.label}`}
              onClick={() => onSelectRegion('bones')}
              onKeyDown={(e) => handleSvgKeyDown('bones', e)}
              className={`cursor-pointer focus:outline-none ${bonesVis.isCritical ? 'critical-region-pulse' : ''}`}
              filter="url(#softGlow)"
            >
              {/* Clavicles & Humeri */}
              <path
                d="M 124 127 Q 170 118 216 127 M 120 130 L 92 200 M 220 130 L 248 200"
                fill="none"
                stroke={bonesVis.stroke}
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeOpacity="0.8"
              />
              {/* Spine & Pelvis */}
              <line
                x1="170"
                y1="104"
                x2="170"
                y2="255"
                stroke={bonesVis.stroke}
                strokeWidth="4"
                strokeDasharray="5 3"
                strokeLinecap="round"
              />
              <path
                d="M 134 252 Q 170 278 206 252 L 200 274 Q 170 288 140 274 Z"
                fill={bonesVis.fill}
                stroke={bonesVis.stroke}
                strokeWidth="2"
              />
              {/* Left & Right Femurs + Tibiae */}
              <path
                d="M 142 272 L 130 356 L 122 436 M 198 272 L 210 356 L 218 436"
                fill="none"
                stroke={bonesVis.stroke}
                strokeWidth="5"
                strokeLinecap="round"
                strokeOpacity="0.88"
              />
              {/* Knee & Hip Joint Glow Nodes */}
              <circle cx="142" cy="272" r="5" fill={bonesVis.stroke} />
              <circle cx="198" cy="272" r="5" fill={bonesVis.stroke} />
              <circle cx="130" cy="356" r="4.5" fill={bonesVis.stroke} />
              <circle cx="210" cy="356" r="4.5" fill={bonesVis.stroke} />
            </g>

            {/* LAYER 3: BLOOD & METABOLIC SYSTEM (Arterial Trunk & Core Portal Plexus) */}
            <g
              data-testid="twin-svg-blood"
              data-region="blood"
              data-selected={selectedRegionId === 'blood' ? 'true' : undefined}
              role="button"
              tabIndex={0}
              aria-label={`Blood and Metabolic region, status ${bloodVis.label}`}
              onClick={() => onSelectRegion('blood')}
              onKeyDown={(e) => handleSvgKeyDown('blood', e)}
              className={`cursor-pointer focus:outline-none ${bloodVis.isCritical ? 'critical-region-pulse' : ''}`}
              filter="url(#regionGlow)"
            >
              {/* Descending Aorta & Iliac Bifurcation */}
              <path
                d="M 170 175 L 170 250 M 170 250 L 148 310 M 170 250 L 192 310 M 148 138 L 108 188 M 192 138 L 232 188"
                fill="none"
                stroke={bloodVis.stroke}
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeOpacity="0.85"
              />
              {/* Metabolic / Glycemic Core Node */}
              <ellipse
                cx="170"
                cy="218"
                rx="22"
                ry="16"
                fill={bloodVis.fill}
                stroke={bloodVis.stroke}
                strokeWidth={selectedRegionId === 'blood' ? 2.8 : 1.8}
              />
              <circle cx="170" cy="218" r="4.5" fill={bloodVis.stroke} />
            </g>

            {/* LAYER 4: LUNGS (Bilateral Pulmonary Lobes + Trachea) */}
            <g
              data-testid="twin-svg-lungs"
              data-region="lungs"
              data-selected={selectedRegionId === 'lungs' ? 'true' : undefined}
              role="button"
              tabIndex={0}
              aria-label={`Lungs and Oxygenation region, status ${lungsVis.label}`}
              onClick={() => onSelectRegion('lungs')}
              onKeyDown={(e) => handleSvgKeyDown('lungs', e)}
              className={`cursor-pointer focus:outline-none ${lungsVis.isCritical ? 'critical-region-pulse' : ''}`}
              filter="url(#regionGlow)"
            >
              {/* Trachea & Bronchi */}
              <path
                d="M 170 105 L 170 138 M 170 135 L 146 150 M 170 135 L 194 150"
                fill="none"
                stroke={lungsVis.stroke}
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              {/* Right anatomical lung (viewer left) */}
              <path
                d="M 163 132 C 142 130, 124 148, 123 174 C 122 192, 134 202, 152 198 C 161 196, 165 184, 165 162 Z"
                fill={lungsVis.fill}
                stroke={lungsVis.stroke}
                strokeWidth={selectedRegionId === 'lungs' ? 2.8 : 1.8}
              />
              {/* Left anatomical lung (viewer right) */}
              <path
                d="M 177 132 C 198 130, 216 148, 217 174 C 218 192, 206 202, 188 198 C 179 196, 175 184, 175 162 Z"
                fill={lungsVis.fill}
                stroke={lungsVis.stroke}
                strokeWidth={selectedRegionId === 'lungs' ? 2.8 : 1.8}
              />
            </g>

            {/* LAYER 5: HEART (Myocardial Silhouette & Aortic Curve) */}
            <g
              data-testid="twin-svg-heart"
              data-region="heart"
              data-selected={selectedRegionId === 'heart' ? 'true' : undefined}
              role="button"
              tabIndex={0}
              aria-label={`Heart and Cardiovascular region, status ${heartVis.label}`}
              onClick={() => onSelectRegion('heart')}
              onKeyDown={(e) => handleSvgKeyDown('heart', e)}
              className={`cursor-pointer focus:outline-none ${heartVis.isCritical ? 'critical-region-pulse' : ''}`}
              filter="url(#regionGlow)"
            >
              <circle
                cx="178"
                cy="163"
                r="20"
                fill="none"
                stroke={heartVis.glow}
                strokeWidth="1.2"
                strokeDasharray="3 3"
              />
              <path
                d="M 178 180 C 165 170, 160 158, 166 151 C 171 146, 177 149, 178 153 C 180 149, 187 146, 192 152 C 197 159, 191 171, 178 180 Z"
                fill={heartVis.fill}
                stroke={heartVis.stroke}
                strokeWidth={selectedRegionId === 'heart' ? 3 : 2.2}
              />
              <circle cx="178" cy="162" r="3" fill={heartVis.stroke} />
            </g>

            {/* LAYER 6: BRAIN (Cortical Hemispheres & Neural Network) */}
            <g
              data-testid="twin-svg-brain"
              data-region="brain"
              data-selected={selectedRegionId === 'brain' ? 'true' : undefined}
              role="button"
              tabIndex={0}
              aria-label={`Brain and Neuro-Cognition region, status ${brainVis.label}`}
              onClick={() => onSelectRegion('brain')}
              onKeyDown={(e) => handleSvgKeyDown('brain', e)}
              className={`cursor-pointer focus:outline-none ${brainVis.isCritical ? 'critical-region-pulse' : ''}`}
              filter="url(#regionGlow)"
            >
              <path
                d="M 170 35 C 151 35, 141 47, 142 60 C 143 68, 152 72, 168 72 L 172 72 C 188 72, 197 68, 198 60 C 199 47, 189 35, 170 35 Z"
                fill={brainVis.fill}
                stroke={brainVis.stroke}
                strokeWidth={selectedRegionId === 'brain' ? 2.8 : 2}
              />
              <line x1="170" y1="36" x2="170" y2="71" stroke={brainVis.stroke} strokeWidth="1.2" strokeOpacity="0.8" />
              <path
                d="M 152 49 Q 160 44 166 52 M 188 49 Q 180 44 174 52"
                fill="none"
                stroke={brainVis.stroke}
                strokeWidth="1.4"
              />
            </g>

            {/* LAYER 7: EYES (Optic Nodes & SANS Visor Plane) */}
            <g
              data-testid="twin-svg-eyes"
              data-region="eyes"
              data-selected={selectedRegionId === 'eyes' ? 'true' : undefined}
              role="button"
              tabIndex={0}
              aria-label={`Eyes and Optic Nerve region, status ${eyesVis.label}`}
              onClick={() => onSelectRegion('eyes')}
              onKeyDown={(e) => handleSvgKeyDown('eyes', e)}
              className={`cursor-pointer focus:outline-none ${eyesVis.isCritical ? 'critical-region-pulse' : ''}`}
              filter="url(#regionGlow)"
            >
              <rect
                x="146"
                y="62"
                width="48"
                height="16"
                rx="8"
                fill={eyesVis.fill}
                stroke={eyesVis.stroke}
                strokeWidth={selectedRegionId === 'eyes' ? 2.4 : 1.5}
              />
              <circle cx="158" cy="70" r="4.5" fill="#0B1628" stroke={eyesVis.stroke} strokeWidth="1.8" />
              <circle cx="182" cy="70" r="4.5" fill="#0B1628" stroke={eyesVis.stroke} strokeWidth="1.8" />
              <circle cx="158" cy="70" r="1.8" fill={eyesVis.stroke} />
              <circle cx="182" cy="70" r="1.8" fill={eyesVis.stroke} />
            </g>
          </svg>
          </div>
          </div>
          <div className="holo-base" aria-hidden><span /></div>
          <div className="absolute right-2.5 top-2.5 z-[3] flex gap-1.5">
            {expanded && webglOk && (
              <button type="button" onClick={() => setThreeD((v) => !v)} className="holo-expand-btn" aria-pressed={threeD}>
                {threeD ? '2D' : '3D'}
              </button>
            )}
            <button
              type="button"
              onClick={() => { if (expanded) { setExpanded(false); } else { setExpanded(true); setThreeD(webglOk); } }}
              className="holo-expand-btn"
              aria-pressed={expanded}
            >
              {expanded ? 'Close' : '3D Hologram'}
            </button>
          </div>
        </div>
      </div>

      {/* Right: Accessible Clickable Region Chips (Every status = Colour + Icon + Word, ≥ 56px) */}
      <div className="md:col-span-6 space-y-2.5">
        <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
          Tap any body system or region pill to inspect
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 gap-2.5">
          {regionList.map((region) => {
            const visual = getRegionVisual(region.status);
            const RegionIcon = REGION_ICONS[region.id];
            const StatusIcon = visual.StatusIcon;
            const isSelected = selectedRegionId === region.id;
            const firstSummary = region.indicators[0];

            return (
              <button
                key={region.id}
                type="button"
                data-testid={`twin-chip-${region.id}`}
                onClick={() => onSelectRegion(region.id)}
                className={`min-h-[56px] w-full px-3.5 py-2.5 rounded-2xl border text-left transition-all flex items-center justify-between gap-2 cursor-pointer ${
                  isSelected
                    ? 'bg-cyan-500/15 border-cyan-400 shadow-[0_0_20px_rgba(115, 179, 231,0.22)]'
                    : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.08] hover:border-white/25'
                } ${visual.isCritical ? 'animate-pulse' : ''}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border"
                    style={{
                      backgroundColor: visual.badgeBg,
                      borderColor: visual.badgeBorder,
                      color: visual.stroke,
                    }}
                  >
                    <RegionIcon size={17} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white truncate">
                      {region.shortName}
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 truncate">
                      {firstSummary ? firstSummary.formattedValue : 'No check logged'}
                    </div>
                  </div>
                </div>

                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-mono font-bold uppercase shrink-0"
                  style={{
                    backgroundColor: visual.badgeBg,
                    borderColor: visual.badgeBorder,
                    color: visual.badgeText,
                  }}
                >
                  <StatusIcon size={12} className="shrink-0" />
                  <span>{visual.label}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
