/**
 * Twin3D — an orbitable 3D hologram of the astronaut, built procedurally
 * (no model file, works offline). The body is a lathed torso with tapered
 * limbs, drawn with a Fresnel "hologram glass" shader. Organs glow in their
 * live status colour and are clickable. Lazy-loaded from the Bridge.
 */
import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import type { BodyRegionTelemetry, BodySystemId } from './digitalTwin';
import type { HealthStatus } from '../../data/db';

const STATUS_COLOR: Record<HealthStatus, string> = {
  NOMINAL: '#22C55E', WATCH: '#F59E0B', ALERT: '#F97316', CRITICAL: '#EF4444',
};
const HOLO = '#73B3E7';
const NO_DATA = '#8FB3DC';

type Props = {
  regions: Record<BodySystemId, BodyRegionTelemetry>;
  selectedRegionId: BodySystemId | null;
  onSelectRegion: (id: BodySystemId) => void;
};

/* ---------- Fresnel hologram material ---------- */
function useHoloMaterial(color: string) {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uTime: { value: 0 } },
    vertexShader: `
      varying vec3 vN; varying vec3 vV; varying float vY;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vY = wp.y;
        vN = normalize(normalMatrix * normal);
        vec4 mv = viewMatrix * wp;
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uTime;
      varying vec3 vN; varying vec3 vV; varying float vY;
      void main() {
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
        float scan = 0.85 + 0.15 * sin(vY * 140.0 - uTime * 3.0);
        float sweep = smoothstep(0.0, 0.04, 0.04 - abs(fract(vY * 0.25 - uTime * 0.12) - 0.5) * 0.08);
        float a = (0.05 + f * 0.85) * scan + sweep * 0.25;
        gl_FragColor = vec4(uColor * (0.6 + f * 1.4), a);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
  }), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { mat.uniforms.uColor.value.set(color); }, [color, mat]);
  useFrame(({ clock }) => { mat.uniforms.uTime.value = clock.getElapsedTime(); });
  return mat;
}

/* ---------- geometry helpers ---------- */
const UP = new THREE.Vector3(0, 1, 0);
function Limb({ a, b, r1, r2, material }: { a: [number, number, number]; b: [number, number, number]; r1: number; r2: number; material: THREE.Material }) {
  const { pos, quat, len } = useMemo(() => {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
    const dir = vb.clone().sub(va);
    return { pos: va.clone().add(vb).multiplyScalar(0.5), quat: new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize()), len: dir.length() };
  }, [a, b]);
  return (
    <mesh position={pos} quaternion={quat} material={material}>
      <cylinderGeometry args={[r2, r1, len, 28, 1, true]} />
    </mesh>
  );
}
function Joint({ p, r, s = [1, 1, 1], material }: { p: [number, number, number]; r: number; s?: [number, number, number]; material: THREE.Material }) {
  return (
    <mesh position={p} scale={s} material={material}>
      <sphereGeometry args={[r, 28, 20]} />
    </mesh>
  );
}

/* ---------- the body ---------- */
function Body({ color, onClick }: { color: string; onClick: () => void }) {
  const mat = useHoloMaterial(color);
  // Torso silhouette (radius, height), lathed then flattened front-to-back.
  const torsoGeo = useMemo(() => {
    const pts = [
      [0.001, -0.02], [0.17, 0.0], [0.27, 0.07], [0.30, 0.20], [0.27, 0.40], [0.235, 0.58],
      [0.25, 0.75], [0.30, 0.95], [0.335, 1.12], [0.34, 1.24], [0.30, 1.33], [0.18, 1.41], [0.09, 1.45], [0.001, 1.46],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    return new THREE.LatheGeometry(pts, 48);
  }, []);
  const hit = (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onClick(); };
  return (
    <group onClick={hit}>
      <mesh geometry={torsoGeo} scale={[1, 1, 0.62]} material={mat} />
      {/* neck + head */}
      <Limb a={[0, 1.42, 0]} b={[0, 1.62, 0.01]} r1={0.075} r2={0.07} material={mat} />
      <Joint p={[0, 1.79, 0.015]} r={0.16} s={[0.88, 1.12, 1.0]} material={mat} />
      {/* shoulders */}
      {[-1, 1].map((sd) => (
        <group key={sd}>
          <Joint p={[sd * 0.36, 1.28, 0]} r={0.085} s={[1.1, 0.95, 1]} material={mat} />
          {/* arm */}
          <Limb a={[sd * 0.38, 1.25, 0]} b={[sd * 0.47, 0.90, 0.02]} r1={0.068} r2={0.054} material={mat} />
          <Joint p={[sd * 0.47, 0.90, 0.02]} r={0.052} material={mat} />
          <Limb a={[sd * 0.47, 0.90, 0.02]} b={[sd * 0.52, 0.56, 0.07]} r1={0.05} r2={0.036} material={mat} />
          {/* hand */}
          <Joint p={[sd * 0.535, 0.47, 0.08]} r={0.05} s={[0.75, 1.6, 0.45]} material={mat} />
          {/* leg */}
          <Joint p={[sd * 0.15, 0.03, 0]} r={0.11} material={mat} />
          <Limb a={[sd * 0.15, 0.02, 0]} b={[sd * 0.14, -0.76, 0.02]} r1={0.115} r2={0.075} material={mat} />
          <Joint p={[sd * 0.14, -0.76, 0.03]} r={0.072} material={mat} />
          <Limb a={[sd * 0.14, -0.76, 0.02]} b={[sd * 0.13, -1.55, -0.01]} r1={0.07} r2={0.045} material={mat} />
          {/* foot */}
          <Joint p={[sd * 0.13, -1.60, 0.07]} r={0.06} s={[0.75, 0.55, 1.9]} material={mat} />
        </group>
      ))}
    </group>
  );
}

/* ---------- organs ---------- */
function Organ({
  id, position, scale = [1, 1, 1], shape = 'sphere', status, selected, hasData, label, onSelect, showLabel = true,
}: {
  id: BodySystemId; position: [number, number, number]; scale?: [number, number, number];
  shape?: 'sphere' | 'capsule'; status: HealthStatus; selected: boolean; hasData: boolean; label: string;
  onSelect: (id: BodySystemId) => void; showLabel?: boolean;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const [hover, setHover] = useState(false);
  const color = hasData ? STATUS_COLOR[status] : NO_DATA;
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    const k = status === 'CRITICAL' && hasData ? 1 + Math.sin(t * 6) * 0.08 : selected ? 1 + Math.sin(t * 2.5) * 0.05 : 1;
    ref.current.scale.set(scale[0] * k, scale[1] * k, scale[2] * k);
  });
  return (
    <group position={position}>
      <mesh
        ref={ref}
        onClick={(e) => { e.stopPropagation(); onSelect(id); }}
        onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHover(false); document.body.style.cursor = ''; }}
      >
        {shape === 'capsule' ? <capsuleGeometry args={[0.075, 0.16, 8, 16]} /> : <sphereGeometry args={[0.08, 24, 18]} />}
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={selected || hover ? 1.8 : hasData ? 1.0 : 0.35} transparent opacity={hasData ? 0.9 : 0.55} roughness={0.35} />
      </mesh>
      <mesh scale={[scale[0] * 2.0, scale[1] * 2.0, scale[2] * 2.0]}>
        <sphereGeometry args={[0.08, 16, 12]} />
        <meshBasicMaterial color={color} transparent opacity={selected || hover ? 0.2 : hasData ? 0.08 : 0.03} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      {showLabel && (hover || selected) && (
        <Html distanceFactor={5} position={[0.16, 0.08, 0]} style={{ pointerEvents: 'none' }}>
          <div style={{
            background: 'rgba(11,22,40,0.92)', border: `1px solid ${color}`, color: '#E2E8F0',
            padding: '4px 9px', borderRadius: 8, fontSize: 12, whiteSpace: 'nowrap', fontWeight: 600,
            boxShadow: `0 0 14px ${color}55`,
          }}>
            {label} <span style={{ color }}>· {hasData ? status : 'no data yet'}</span>
          </div>
        </Html>
      )}
    </group>
  );
}

function Spine({ status, hasData, selected, onSelect }: { status: HealthStatus; hasData: boolean; selected: boolean; onSelect: (id: BodySystemId) => void }) {
  const color = hasData ? STATUS_COLOR[status] : NO_DATA;
  const ys = Array.from({ length: 12 }, (_, i) => 1.38 - i * 0.11);
  return (
    <group onClick={(e) => { e.stopPropagation(); onSelect('bones'); }}>
      {ys.map((y, i) => (
        <mesh key={i} position={[0, y, -0.13]}>
          <cylinderGeometry args={[0.032, 0.032, 0.06, 12]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={selected ? 1.5 : hasData ? 0.8 : 0.3} transparent opacity={0.85} />
        </mesh>
      ))}
      <mesh position={[0, 0.12, -0.05]} rotation={[Math.PI / 2.4, 0, 0]}>
        <torusGeometry args={[0.17, 0.028, 10, 28, Math.PI]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={selected ? 1.5 : hasData ? 0.8 : 0.3} transparent opacity={0.85} />
      </mesh>
    </group>
  );
}

function Projector() {
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => { if (ring.current) ring.current.rotation.z = clock.getElapsedTime() * 0.35; });
  return (
    <group position={[0, -1.68, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.72, 0.82, 72]} />
        <meshBasicMaterial color={HOLO} transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.9, 0.93, 72, 1, 0, Math.PI * 1.25]} />
        <meshBasicMaterial color="#BFE3FF" transparent opacity={0.75} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]}>
        <circleGeometry args={[0.8, 64]} />
        <meshBasicMaterial color={HOLO} transparent opacity={0.1} />
      </mesh>
      <mesh position={[0, 1.7, 0]}>
        <coneGeometry args={[0.85, 3.4, 48, 1, true]} />
        <meshBasicMaterial color={HOLO} transparent opacity={0.03} side={THREE.BackSide} depthWrite={false} />
      </mesh>
      <gridHelper args={[6, 24, '#1E3A5F', '#102238']} position={[0, -0.01, 0]} />
    </group>
  );
}

function Scene({ regions, selectedRegionId, onSelectRegion }: Props) {
  const float = useRef<THREE.Group>(null);
  useFrame(({ clock }) => { if (float.current) float.current.position.y = Math.sin(clock.getElapsedTime() * 0.8) * 0.025; });
  const r = (id: BodySystemId) => regions[id];
  const bodyColor = selectedRegionId === 'skin' && r('skin').hasData ? STATUS_COLOR[r('skin').effectiveStatus] : HOLO;
  const organ = (id: BodySystemId, key: string, position: [number, number, number], extra: Partial<React.ComponentProps<typeof Organ>> = {}) => (
    <Organ
      key={key} id={id} position={position}
      status={r(id).effectiveStatus} hasData={r(id).hasData} selected={selectedRegionId === id}
      label={r(id).shortName || r(id).name} onSelect={onSelectRegion} {...extra}
    />
  );
  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[2, 3, 3]} intensity={14} color="#BFE3FF" />
      <pointLight position={[-2, 0, -2]} intensity={5} color="#73B3E7" />
      <group ref={float}>
        <Body color={bodyColor} onClick={() => onSelectRegion('skin')} />
        <Spine status={r('bones').effectiveStatus} hasData={r('bones').hasData} selected={selectedRegionId === 'bones'} onSelect={onSelectRegion} />
        {organ('brain', 'brain', [0, 1.84, 0.01], { scale: [1.15, 0.95, 1.25] })}
        {organ('eyes', 'eyeL', [-0.055, 1.80, 0.13], { scale: [0.28, 0.28, 0.28] })}
        {organ('eyes', 'eyeR', [0.055, 1.80, 0.13], { scale: [0.28, 0.28, 0.28], showLabel: false })}
        {organ('lungs', 'lungL', [-0.12, 1.10, 0.02], { shape: 'capsule', scale: [1, 1.05, 0.9] })}
        {organ('lungs', 'lungR', [0.12, 1.10, 0.02], { shape: 'capsule', scale: [1, 1.05, 0.9], showLabel: false })}
        {organ('heart', 'heart', [0.04, 1.02, 0.09], { scale: [0.8, 0.85, 0.8] })}
        {organ('blood', 'blood', [0, 0.62, 0.05], { scale: [1.5, 0.9, 1.0] })}
      </group>
      <Projector />
      <OrbitControls
        target={[0, 0.15, 0]} enablePan={false} minDistance={2.6} maxDistance={7}
        autoRotate autoRotateSpeed={0.8} minPolarAngle={0.5} maxPolarAngle={2.3}
        enableDamping dampingFactor={0.08}
      />
    </>
  );
}

export const Twin3D: React.FC<Props> = (props) => (
  <div className="w-full h-full relative" data-testid="twin-3d">
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0.5, 4.4], fov: 40 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => { gl.setClearColor(0x000000, 0); }}
    >
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </Canvas>
    <div className="absolute left-4 bottom-4 text-xs text-cyan-200/75 font-medium tracking-wide pointer-events-none">
      Drag to turn · scroll to zoom · tap an organ
    </div>
  </div>
);

export default Twin3D;
