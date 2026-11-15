/**
 * Twin3D — orbitable 3D anatomical hologram.
 *
 * Model: BodyParts3D, (c) 2008 Life Science Integrated Database Center (DBCLS),
 * licensed CC BY-SA 2.1 Japan. Skin, skeleton and organs were simplified for the
 * web by the HALO team (public/models/human.glb). Organs glow in their live status
 * colour and are clickable. Lazy-loaded from the Bridge; fully offline.
 */
import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Html, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { BodyRegionTelemetry, BodySystemId } from './digitalTwin';
import type { HealthStatus } from '../../data/db';

const MODEL_URL = '/models/human.glb';
const STATUS_COLOR: Record<HealthStatus, string> = {
  NOMINAL: '#22C55E', WATCH: '#F59E0B', ALERT: '#F97316', CRITICAL: '#EF4444',
};
const HOLO = '#73B3E7';
const BONE = '#DCEBFF';
const NO_DATA = '#8FB3DC';

type Props = {
  regions: Record<BodySystemId, BodyRegionTelemetry>;
  selectedRegionId: BodySystemId | null;
  onSelectRegion: (id: BodySystemId) => void;
};

/* Fresnel "hologram glass": glows at the silhouette, faint scanlines. */
function makeHolo(color: string, base: number, edge: number) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uTime: { value: 0 }, uBase: { value: base }, uEdge: { value: edge } },
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
      uniform vec3 uColor; uniform float uTime; uniform float uBase; uniform float uEdge;
      varying vec3 vN; varying vec3 vV; varying float vY;
      void main() {
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.6);
        float scan = 0.86 + 0.14 * sin(vY * 140.0 - uTime * 3.0);
        float band = smoothstep(0.08, 0.0, abs(fract(vY * 0.22 - uTime * 0.10) - 0.5));
        float a = (uBase + f * uEdge) * scan + band * 0.06;
        gl_FragColor = vec4(uColor * (0.6 + f * 1.4), a);
      }`,
    transparent: true, depthWrite: false, depthFunc: THREE.LessEqualDepth, blending: THREE.AdditiveBlending,
  });
}

const ORGANS: Array<{ mesh: string; id: BodySystemId }> = [
  { mesh: 'brain', id: 'brain' },
  { mesh: 'eyes', id: 'eyes' },
  { mesh: 'lungs', id: 'lungs' },
  { mesh: 'heart', id: 'heart' },
  { mesh: 'blood', id: 'blood' },
];

function Organ({ geometry, id, region, selected, onSelect }: {
  geometry: THREE.BufferGeometry; id: BodySystemId; region: BodyRegionTelemetry; selected: boolean; onSelect: (id: BodySystemId) => void;
}) {
  const [hover, setHover] = useState(false);
  const color = region.hasData ? STATUS_COLOR[region.effectiveStatus] : NO_DATA;
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ transparent: true, depthWrite: false, roughness: 0.4 }), []);
  const center = useMemo(() => { geometry.computeBoundingSphere(); return geometry.boundingSphere!.center.clone(); }, [geometry]);
  useEffect(() => { mat.color.set(color); mat.emissive.set(color); }, [color, mat]);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const critical = region.hasData && region.effectiveStatus === 'CRITICAL';
    const pulse = critical ? 0.5 + 0.5 * Math.sin(t * 6) : selected ? 0.5 + 0.5 * Math.sin(t * 2.5) : 0;
    mat.emissiveIntensity = (selected || hover ? 1.3 : region.hasData ? 0.7 : 0.3) + pulse * 0.6;
    mat.opacity = selected || hover ? 0.85 : region.hasData ? 0.5 : 0.25;
  });
  return (
    <group>
      <mesh
        geometry={geometry}
        material={mat}
        renderOrder={2}
        onClick={(e) => { e.stopPropagation(); onSelect(id); }}
        onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHover(false); document.body.style.cursor = ''; }}
      />
      {(hover || selected) && (
        <Html position={center} distanceFactor={5} style={{ pointerEvents: 'none' }}>
          <div style={{
            transform: 'translate(14px,-50%)', background: 'rgba(11,22,40,0.92)', border: `1px solid ${color}`,
            color: '#E2E8F0', padding: '4px 9px', borderRadius: 8, fontSize: 12, whiteSpace: 'nowrap', fontWeight: 600,
            boxShadow: `0 0 14px ${color}55`,
          }}>
            {region.shortName || region.name} <span style={{ color }}>· {region.hasData ? region.effectiveStatus : 'no data yet'}</span>
          </div>
        </Html>
      )}
    </group>
  );
}

function Human({ regions, selectedRegionId, onSelectRegion }: Props) {
  const { nodes } = useGLTF(MODEL_URL) as unknown as { nodes: Record<string, THREE.Mesh> };
  const geo = (name: string) => nodes[name]?.geometry as THREE.BufferGeometry | undefined;

  const skinColor = selectedRegionId === 'skin' && regions.skin.hasData ? STATUS_COLOR[regions.skin.effectiveStatus] : HOLO;
  const boneColor = selectedRegionId === 'bones' && regions.bones.hasData ? STATUS_COLOR[regions.bones.effectiveStatus] : BONE;
  const skinMat = useMemo(() => makeHolo(HOLO, 0.02, 0.95), []);
  const boneMat = useMemo(() => makeHolo(BONE, 0.10, 0.9), []);
  // Depth-only pre-pass: only the outermost skin surface gets the glow.
  const skinDepth = useMemo(() => new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true, transparent: true, opacity: 0 }), []);
  useEffect(() => { skinMat.uniforms.uColor.value.set(skinColor); }, [skinColor, skinMat]);
  useEffect(() => { boneMat.uniforms.uColor.value.set(boneColor); }, [boneColor, boneMat]);

  const float = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    skinMat.uniforms.uTime.value = t; boneMat.uniforms.uTime.value = t;
    if (float.current) float.current.position.y = Math.sin(t * 0.8) * 0.025;
  });

  // The skin is the outermost surface, so it is hit first: only select it when no organ/bone is under the pointer.
  const onSkin = (e: ThreeEvent<MouseEvent>) => {
    const deeper = e.intersections.some((h) => h.object.userData.region && h.object.userData.region !== 'skin');
    if (!deeper) { e.stopPropagation(); onSelectRegion('skin'); }
  };

  return (
    <group ref={float}>
      {geo('bones') && (
        <mesh geometry={geo('bones')} material={boneMat} renderOrder={1} userData={{ region: 'bones' }}
          onClick={(e) => { e.stopPropagation(); onSelectRegion('bones'); }} />
      )}
      {ORGANS.map(({ mesh, id }) => {
        const g = geo(mesh);
        return g ? (
          <group key={mesh} userData={{ region: id }}>
            <Organ geometry={g} id={id} region={regions[id]} selected={selectedRegionId === id} onSelect={onSelectRegion} />
          </group>
        ) : null;
      })}
      {geo('skin') && (
        <>
          <mesh geometry={geo('skin')} material={skinDepth} renderOrder={3} raycast={() => null} />
          <mesh geometry={geo('skin')} material={skinMat} renderOrder={4} userData={{ region: 'skin' }} onClick={onSkin} />
        </>
      )}
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
      <gridHelper args={[6, 24, '#1E3A5F', '#102238']} position={[0, -0.01, 0]} />
    </group>
  );
}

function Loading() {
  return (
    <Html center>
      <div style={{ color: '#BFE3FF', fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
        Projecting hologram…
      </div>
    </Html>
  );
}

export const Twin3D: React.FC<Props> = (props) => (
  <div className="w-full h-full relative" data-testid="twin-3d">
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0.4, 5.2], fov: 38 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => { gl.setClearColor(0x000000, 0); }}
    >
      <ambientLight intensity={0.6} />
      <pointLight position={[2, 3, 3]} intensity={16} color="#BFE3FF" />
      <pointLight position={[-2, 0, -2]} intensity={5} color="#73B3E7" />
      <Suspense fallback={<Loading />}>
        <Human {...props} />
      </Suspense>
      <Projector />
      <OrbitControls
        target={[0, 0.15, 0]} enablePan={false} minDistance={1.2} maxDistance={8}
        autoRotate autoRotateSpeed={0.8} minPolarAngle={0.35} maxPolarAngle={2.4}
        enableDamping dampingFactor={0.08}
      />
    </Canvas>
    <div className="absolute left-4 bottom-4 text-xs text-cyan-200/75 font-medium tracking-wide pointer-events-none">
      Drag to turn · scroll to zoom in on an organ · tap it for details
    </div>
    <div className="absolute right-4 bottom-4 text-[10px] text-slate-400/80 pointer-events-none">
      Anatomy: BodyParts3D © DBCLS, CC BY-SA 2.1 JP
    </div>
  </div>
);

useGLTF.preload(MODEL_URL);
export default Twin3D;
