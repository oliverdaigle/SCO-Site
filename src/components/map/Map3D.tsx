'use client';
// The 3D Formula Map. Loaded only when WebGL is available and the visitor has not asked for reduced motion.
import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { CAT_COLOR, LAYOUT, pathEdges } from '@/lib/mapLayout';

export interface MapProps { filter: string | null; path: string | null; pathSteps: string[]; selected: string | null; light: boolean; onHover: (id: string | null, x?: number, y?: number) => void; onPick: (id: string, viaMouse: boolean) => void; onSlow?: () => void }

function glowTexture(): THREE.Texture { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d')!; const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64); grad.addColorStop(0, 'rgba(255,255,255,0.9)'); grad.addColorStop(0.25, 'rgba(255,255,255,0.35)'); grad.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = grad; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); }
function labelTexture(text: string, color: string): { tex: THREE.Texture; aspect: number } { const c = document.createElement('canvas'); const g = c.getContext('2d')!; const font = '600 44px ui-sans-serif, system-ui, sans-serif'; g.font = font; const w = Math.ceil(g.measureText(text).width) + 24; c.width = w; c.height = 64; const g2 = c.getContext('2d')!; g2.font = font; g2.fillStyle = color; g2.textBaseline = 'middle'; g2.fillText(text, 12, 34); const tex = new THREE.CanvasTexture(c); tex.anisotropy = 4; return { tex, aspect: w / 64 }; }

function Scene({ filter, path, pathSteps, selected, light, onHover, onPick, onSlow }: MapProps) {
  const perf = useRef({ frames: 0, time: 0, done: false });
  const group = useRef<THREE.Group>(null); const { camera, gl, size } = useThree();
  const drag = useRef({ on: false, x: 0, y: 0, moved: 0, vx: 0, vy: 0 }); const hovering = useRef(false); const zoom = useRef(30);
  const glow = useMemo(glowTexture, []); const sphere = useMemo(() => new THREE.SphereGeometry(1, 20, 20), []);
  const labels = useMemo(() => LAYOUT.cats.map((c) => ({ ...c, ...labelTexture(c.name, light ? '#0e1118' : '#edeff5') })), [light]);
  const inPath = useMemo(() => new Set(pathSteps), [pathSteps]);
  const active = (i: number) => { const n = LAYOUT.nodes[i]; return path ? inPath.has(n.id) : !filter || n.cat === filter; };
  const edgeGeo = useMemo(() => {
    const pos: number[] = []; const col: number[] = []; const c = new THREE.Color();
    for (const [a, b] of LAYOUT.edges) { const on = active(a) && active(b) && !path; const na = LAYOUT.nodes[a]; const nb = LAYOUT.nodes[b]; pos.push(...na.p, ...nb.p); const k = on ? (light ? 0.75 : 0.5) : light ? 0.16 : 0.07; for (const n of [na, nb]) { c.set(CAT_COLOR[n.cat]); if (light) c.multiplyScalar(0.7); col.push(c.r * k + (light ? 1 - k : 0), c.g * k + (light ? 1 - k : 0), c.b * k + (light ? 1 - k : 0)); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, path, light, inPath]);
  const pathGeo = useMemo(() => { const pos: number[] = []; for (const [a, b] of pathEdges(path)) pos.push(...LAYOUT.nodes[a].p, ...LAYOUT.nodes[b].p); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); return g; }, [path]);
  const stars = useMemo(() => { let s = 7; const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; const pos: number[] = []; for (let i = 0; i < 420; i++) { const u = r() * 2 - 1; const t = r() * Math.PI * 2; const q = Math.sqrt(1 - u * u); const d = 30 + r() * 24; pos.push(q * Math.cos(t) * d, u * d, q * Math.sin(t) * d); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); return g; }, []);

  useEffect(() => {
    const el = gl.domElement; const d = drag.current;
    const down = (e: PointerEvent) => { d.on = true; d.x = e.clientX; d.y = e.clientY; d.moved = 0; };
    const move = (e: PointerEvent) => { if (!d.on || !group.current) return; const dx = e.clientX - d.x; const dy = e.clientY - d.y; d.x = e.clientX; d.y = e.clientY; d.moved += Math.abs(dx) + Math.abs(dy); d.vx = dx * 0.006; d.vy = dy * 0.006; group.current.rotation.y += d.vx; group.current.rotation.x = Math.max(-1.2, Math.min(1.2, group.current.rotation.x + d.vy)); };
    const up = () => { d.on = false; };
    const wheel = (e: WheelEvent) => { if (!e.ctrlKey && !e.metaKey && Math.abs(e.deltaY) < 40 && e.deltaMode === 0 && !e.shiftKey) { /* trackpad scroll: let the page scroll */ return; } e.preventDefault(); zoom.current = Math.max(12, Math.min(44, zoom.current + e.deltaY * 0.02)); };
    el.addEventListener('pointerdown', down); window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); el.addEventListener('wheel', wheel, { passive: false });
    const onZoom = (e: Event) => { zoom.current = Math.max(12, Math.min(44, zoom.current + (e as CustomEvent).detail)); }; window.addEventListener('lotwise-map-zoom', onZoom);
    return () => { el.removeEventListener('pointerdown', down); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); el.removeEventListener('wheel', wheel); window.removeEventListener('lotwise-map-zoom', onZoom); };
  }, [gl]);
  useFrame((_, dt) => {
    // Frame-rate check over the first ~2 seconds (skipping the first frames, which include setup work).
    const pf = perf.current; if (!pf.done) { pf.frames++; if (pf.frames > 10) pf.time += dt; if (pf.frames >= 70) { pf.done = true; if (pf.time / 60 > 0.05) onSlow?.(); } }
    const g = group.current; if (!g) return; const d = drag.current;
    if (!d.on) { if (!hovering.current) g.rotation.y += Math.min(dt, 0.05) * 0.045 + d.vx; d.vx *= 0.92; }
    const aspect = size.width / Math.max(1, size.height); const target = zoom.current / Math.min(1, aspect * 0.85); camera.position.z += (target - camera.position.z) * 0.12;
  });
  const over = (id: string) => (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); hovering.current = true; gl.domElement.style.cursor = 'pointer'; onHover(id, e.clientX, e.clientY); };
  const out = () => { hovering.current = false; gl.domElement.style.cursor = 'grab'; onHover(null); };
  const click = (id: string) => (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); if (drag.current.moved > 6) return; onPick(id, (e.nativeEvent as PointerEvent).pointerType === 'mouse'); };

  return (
    <group ref={group} rotation={[0.25, 0.6, 0]}>
      {!light && <points geometry={stars}><pointsMaterial size={0.09} color="#8b94ad" transparent opacity={0.55} sizeAttenuation /></points>}
      <lineSegments geometry={edgeGeo}><lineBasicMaterial vertexColors transparent opacity={0.95} /></lineSegments>
      {path && <lineSegments geometry={pathGeo}><lineBasicMaterial color={light ? '#9c3c07' : '#ffd9b8'} linewidth={2} /></lineSegments>}
      {LAYOUT.nodes.map((n, i) => { const on = active(i); const sel = selected === n.id; const r = (0.2 + Math.min(n.deg, 6) * 0.028) * (sel ? 1.55 : path && on ? 1.3 : 1); const color = CAT_COLOR[n.cat]; return (
        <group key={n.id} position={n.p}>
          <mesh geometry={sphere} scale={r} onPointerOver={over(n.id)} onPointerOut={out} onClick={click(n.id)}><meshBasicMaterial color={on ? color : light ? '#c9cedb' : '#3a4152'} transparent opacity={on ? 1 : 0.5} /></mesh>
          <mesh geometry={sphere} scale={Math.max(r * 2.1, 0.5)} visible={false} onPointerOver={over(n.id)} onPointerOut={out} onClick={click(n.id)} />
          {on && !light && <sprite scale={[r * (sel ? 9 : 5.5), r * (sel ? 9 : 5.5), 1]}><spriteMaterial map={glow} color={color} transparent opacity={sel ? 0.95 : 0.55} depthWrite={false} blending={THREE.AdditiveBlending} /></sprite>}
          {sel && light && <mesh geometry={sphere} scale={r * 1.5}><meshBasicMaterial color={color} transparent opacity={0.25} /></mesh>}
        </group>); })}
      {labels.map((l) => (<sprite key={l.id} position={l.p} scale={[0.62 * l.aspect, 0.62, 1]}><spriteMaterial map={l.tex} transparent opacity={path ? 0.25 : !filter || filter === l.id ? 0.92 : 0.22} depthWrite={false} /></sprite>))}
    </group>
  );
}
export default function Map3D(props: MapProps) {
  return (<Canvas camera={{ position: [0, 0, 30], fov: 50, near: 0.1, far: 200 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }} style={{ touchAction: 'pan-y', cursor: 'grab' }} aria-hidden><Scene {...props} /></Canvas>);
}
