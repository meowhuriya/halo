/**
 * Twin3D — an orbitable 3D hologram of the astronaut, built from primitives
 * (no model file, works offline). Organs glow in their live status colour and
 * are clickable. Loaded lazily; the 2D SVG twin remains the default view.
 */
import React, { Suspense, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import type { BodyRegionTelemetry, BodySystemId } from './digitalTwin';
import type { HealthStatus } from '../../data/db';

const STATUS_COLOR: Record<HealthStatus, string> = {
  NOMINAL: '#22C55E', WATCH: '#F59E0B', ALERT: '#F97316', CRITICAL: '#EF4444',
};
const HOLO = '#73B3E7';

type Props = {
  regions: Record<BodySystemId, BodyRegionTelemetry>;
  selectedRegionId: BodySystemId | null;
  onSelectRegion: (id: BodySystemId) => void;
};

/* ---------- body shell: translucent skin + wireframe ---------- */
function Shell({ status, selected, onClick }: { status: HealthStatus; selected: boolean; onClick: () => void }) {
  const color = selected ? STATUS_COLOR[status] : HOLO;
  const parts: Array<{ pos: [number, number, number]; rot?: [number, number, number]; r: number; len: number }> = [
    { pos: [0, 0.95, 0], r: 0.40, len: 0.75 },                 // torso
    { pos: [0, 0.30, 0], r: 0.36, len: 0.10 },                 // pelvis
    { pos: [-0.62, 1.05, 0], rot: [0, 0, 0.18], r: 0.12, len: 0.50 },  // upper arms
    { pos: [0.62, 1.05, 0], rot: [0, 0, -0.18], r: 0.12, len: 0.50 },
    { pos: [-0.74, 0.42, 0.05], rot: [0, 0, 0.10], r: 0.10, len: 0.50 }, // forearms
    { pos: [0.74, 0.42, 0.05], rot: [0, 0, -0.10], r: 0.10, len: 0.50 },
    { pos: [-0.22, -0.45, 0], r: 0.16, len: 0.70 },            // thighs
    { pos: [0.22, -0.45, 0], r: 0.16, len: 0.70 },
    { pos: [-0.22, -1.30, 0.02], r: 0.12, len: 0.70 },         // shins
    { pos: [0.22, -1.30, 0.02], r: 0.12, len: 0.70 },
  ];
  return (
    <group onClick={(e) => { e.stopPropagation(); onClick(); }}>
      {/* head */}
      <mesh position={[0, 1.78, 0]}>
        <sphereGeometry args={[0.30, 32, 24]} />
        <meshPhysicalMaterial color={color} transparent opacity={0.14} roughness={0.2} metalness={0.1} transmission={0.4} emissive={color} emissiveIntensity={0.25} depthWrite={false} />
      </mesh>
      <mesh position={[0, 1.78, 0]}>
        <sphereGeometry args={[0.305, 16, 12]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.22} />
      </mesh>
      {/* neck */}
      <mesh position={[0, 1.48, 0]}>
        <cylinderGeometry args={[0.10, 0.12, 0.18, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.18} />
      </mesh>
      {parts.map((p, i) => (
        <group key={i} position={p.pos} rotation={p.rot ?? [0, 0, 0]}>
          <mesh>
            <capsuleGeometry args={[p.r, p.len, 8, 20]} />
            <meshPhysicalMaterial color={color} transparent opacity={0.12} roughness={0.25} transmission={0.4} emissive={color} emissiveIntensity={0.2} depthWrite={false} />
          </mesh>
          <mesh>
            <capsuleGeometry args={[p.r + 0.004, p.len, 4, 12]} />
            <meshBasicMaterial color={color} wireframe transparent opacity={0.18} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ---------- a glowing organ ---------- */
function Organ({
  id, position, scale = [1, 1, 1], geometry = 'sphere', status, selected, hasData, label, onSelect,
}: {
  id: BodySystemId; position: [number, number, number]; scale?: [number, number, number];
  geometry?: 'sphere' | 'capsule'; status: HealthStatus; selected: boolean; hasData: boolean; label: string;
  onSelect: (id: BodySystemId) => void;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const [hover, setHover] = useState(false);
  const color = hasData ? STATUS_COLOR[status] : '#94A3B8';
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    const pulse = status === 'CRITICAL' ? 1 + Math.sin(t * 6) * 0.08 : selected ? 1 + Math.sin(t * 2.5) * 0.04 : 1;
    ref.current.scale.set(scale[0] * pulse, scale[1] * pulse, scale[2] * pulse);
  });
  return (
    <group position={position}>
      <mesh
        ref={ref}
        onClick={(e) => { e.stopPropagation(); onSelect(id); }}
        onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHover(false); document.body.style.cursor = ''; }}
      >
        {geometry === 'capsule' ? <capsuleGeometry args={[0.12, 0.22, 8, 16]} /> : <sphereGeometry args={[0.13, 24, 18]} />}
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={selected || hover ? 1.6 : 0.9} transparent opacity={0.92} roughness={0.3} />
      </mesh>
      {/* halo glow */}
      <mesh scale={[scale[0] * 1.9, scale[1] * 1.9, scale[2] * 1.9]}>
        <sphereGeometry args={[0.13, 16, 12]} />
        <meshBasicMaterial color={color} transparent opacity={selected || hover ? 0.22 : 0.10} depthWrite={false} />
      </mesh>
      {(hover || selected) && (
        <Html distanceFactor={6} position={[0.22, 0.12, 0]} style={{ pointerEvents: 'none' }}>
          <div style={{
            background: 'rgba(11,22,40,0.9)', border: `1px solid ${color}`, color: '#E2E8F0',
            padding: '4px 8px', borderRadius: 8, fontSize: 12, whiteSpace: 'nowrap', fontWeight: 600,
            boxShadow: `0 0 12px ${color}66`,
          }}>
            {label} <span style={{ color }}>· {hasData ? status : 'no data'}</span>
          </div>
        </Html>
      )}
    </group>
  );
}

/* ---------- spine (bones) ---------- */
function Spine({ status, selected, hasData, onSelect }: { status: HealthStatus; selected: boolean; hasData: boolean; onSelect: (id: BodySystemId) => void }) {
  const color = hasData ? STATUS_COLOR[status] : '#94A3B8';
  const segs = Array.from({ length: 10 }, (_, i) => 1.40 - i * 0.12);
  return (
    <group onClick={(e) => { e.stopPropagation(); onSelect('bones'); }}>
      {segs.map((y, i) => (
        <mesh key={i} position={[0, y, -0.12]}>
          <cylinderGeometry args={[0.045, 0.045, 0.07, 12]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={selected ? 1.4 : 0.7} transparent opacity={0.9} />
        </mesh>
      ))}
      {/* pelvis + femur hints */}
      <mesh position={[0, 0.28, -0.08]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.22, 0.035, 10, 24, Math.PI]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={selected ? 1.4 : 0.7} transparent opacity={0.9} />
      </mesh>
    </group>
  );
}

function Projector() {
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => { if (ring.current) ring.current.rotation.z = clock.getElapsedTime() * 0.3; });
  return (
    <group position={[0, -1.78, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.9, 1.05, 64]} />
        <meshBasicMaterial color={HOLO} transparent opacity={0.45} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.12, 1.16, 64, 1, 0, Math.PI * 1.3]} />
        <meshBasicMaterial color="#BFE3FF" transparent opacity={0.7} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <circleGeometry args={[1.0, 64]} />
        <meshBasicMaterial color={HOLO} transparent opacity={0.08} />
      </mesh>
      {/* light cone */}
      <mesh position={[0, 1.6, 0]}>
        <coneGeometry args={[1.0, 3.2, 48, 1, true]} />
        <meshBasicMaterial color={HOLO} transparent opacity={0.035} side={THREE.BackSide} depthWrite={false} />
      </mesh>
      <gridHelper args={[6, 18, '#1E3A5F', '#132743']} position={[0, -0.02, 0]} />
    </group>
  );
}

function Scene({ regions, selectedRegionId, onSelectRegion }: Props) {
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => { if (group.current) group.current.position.y = Math.sin(clock.getElapsedTime() * 0.8) * 0.03; });
  const r = (id: BodySystemId) => regions[id];
  const organ = (id: BodySystemId, position: [number, number, number], extra: Partial<React.ComponentProps<typeof Organ>> = {}) => (
    <Organ
      key={id} id={id} position={position}
      status={r(id).effectiveStatus} hasData={r(id).hasData} selected={selectedRegionId === id}
      label={r(id).shortName || r(id).name} onSelect={onSelectRegion} {...extra}
    />
  );
  return (
    <>
      <ambientLight intensity={0.6} />
      <pointLight position={[2, 3, 3]} intensity={18} color="#BFE3FF" />
      <pointLight position={[-2, -1, -2]} intensity={6} color="#73B3E7" />
      <group ref={group}>
        <Shell status={r('skin').effectiveStatus} selected={selectedRegionId === 'skin'} onClick={() => onSelectRegion('skin')} />
        <Spine status={r('bones').effectiveStatus} hasData={r('bones').hasData} selected={selectedRegionId === 'bones'} onSelect={onSelectRegion} />
        {organ('brain', [0, 1.84, 0.02], { scale: [1.25, 1.0, 1.25] })}
        {organ('eyes', [-0.11, 1.76, 0.24], { scale: [0.4, 0.4, 0.4] })}
        {organ('eyes', [0.11, 1.76, 0.24], { scale: [0.4, 0.4, 0.4] })}
        {organ('lungs', [-0.17, 1.08, 0.08], { geometry: 'capsule', scale: [1, 1.1, 1] })}
        {organ('lungs', [0.17, 1.08, 0.08], { geometry: 'capsule', scale: [1, 1.1, 1] })}
        {organ('heart', [0.06, 1.02, 0.17], { scale: [0.9, 0.9, 0.9] })}
        {organ('blood', [0.02, 0.62, 0.12], { scale: [1.1, 0.8, 0.9] })}
      </group>
      <Projector />
      <OrbitControls enablePan={false} minDistance={2.8} maxDistance={7} autoRotate autoRotateSpeed={0.7} minPolarAngle={0.6} maxPolarAngle={2.2} />
    </>
  );
}

export const Twin3D: React.FC<Props> = (props) => (
  <div className="w-full h-full relative" data-testid="twin-3d">
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 0.4, 4.6], fov: 38 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => { gl.setClearColor(0x000000, 0); }}
    >
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </Canvas>
    <div className="absolute left-3 bottom-3 text-[11px] text-cyan-200/70 font-semibold tracking-wide pointer-events-none">
      Drag to turn · scroll to zoom · click an organ
    </div>
  </div>
);

export default Twin3D;
