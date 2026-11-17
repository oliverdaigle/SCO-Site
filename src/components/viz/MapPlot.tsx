'use client';
import { useRef, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import type { VizSpec } from '@lotwise/engine';
import { useWidth } from '../ui';
import { tick } from './XYChart';

type M = Extract<VizSpec, { kind: 'map' }>;
/** Location map. Drag any point (or use arrow keys) and the answer follows. */
export function MapPlot({ spec, onMove }: { spec: M; onMove?: (index: number, x: number, y: number) => void }) {
  const [ref, w] = useWidth<HTMLDivElement>(600); const H = Math.min(380, Math.max(260, w * 0.6)); const m = 34;
  const [drag, setDrag] = useState<number | null>(null); const svg = useRef<SVGSVGElement>(null);
  const frozen = useRef<{ x: [number, number]; y: [number, number] } | null>(null);
  const all = [...spec.points, ...(spec.candidates ?? []), ...(spec.center ? [spec.center] : [])];
  const ext = (k: 'x' | 'y'): [number, number] => { const v = all.map((p) => p[k]); let lo = Math.min(...v), hi = Math.max(...v); if (lo === hi) { lo -= 1; hi += 1; } const pad = (hi - lo) * 0.14; return [lo - pad, hi + pad]; };
  const dom = drag !== null && frozen.current ? frozen.current : { x: ext('x'), y: ext('y') };
  const xs = scaleLinear().domain(dom.x).range([m, w - 14]), ys = scaleLinear().domain(dom.y).range([H - m, 14]);
  const wmax = Math.max(...spec.points.map((p) => p.w), 1e-9); const rad = (wt: number) => 7 + 15 * Math.sqrt(wt / wmax);
  const step = Math.max((dom.x[1] - dom.x[0]) / 60, 1e-6); const round = (v: number) => { const p = Math.pow(10, Math.max(0, 2 - Math.floor(Math.log10(Math.max(dom.x[1] - dom.x[0], 1e-9))))); return Math.round(v * p) / p; };
  const move = (e: React.PointerEvent) => { if (drag === null || !svg.current || !onMove) return; const r = svg.current.getBoundingClientRect(); onMove(drag, round(xs.invert(e.clientX - r.left)), round(ys.invert(e.clientY - r.top))); };
  const hub = spec.center ?? spec.candidates?.find((c) => c.best);
  return (
    <div ref={ref}>
      <svg ref={svg} width={w} height={H} className="block touch-none rounded-xl border border-line bg-sunken" role="application" aria-label="Location map. Drag points to move them." onPointerMove={move} onPointerUp={() => setDrag(null)} onPointerLeave={() => setDrag(null)}>
        {xs.ticks(6).map((t) => (<g key={'x' + t}><line x1={xs(t)} x2={xs(t)} y1={14} y2={H - m} stroke="var(--line)" /><text x={xs(t)} y={H - m + 15} fontSize="10.5" textAnchor="middle" fill="var(--faint)" className="num">{tick(t)}</text></g>))}
        {ys.ticks(5).map((t) => (<g key={'y' + t}><line x1={m} x2={w - 14} y1={ys(t)} y2={ys(t)} stroke="var(--line)" /><text x={m - 6} y={ys(t)} dy="0.32em" fontSize="10.5" textAnchor="end" fill="var(--faint)" className="num">{tick(t)}</text></g>))}
        {hub && spec.points.map((p, i) => <line key={i} x1={xs(hub.x)} y1={ys(hub.y)} x2={xs(p.x)} y2={ys(p.y)} stroke="var(--accent)" strokeOpacity={0.3} strokeWidth={1 + 3 * (p.w / wmax)} strokeDasharray="2 5" />)}
        {spec.points.map((p, i) => (
          <g key={i} transform={`translate(${xs(p.x)},${ys(p.y)})`} tabIndex={onMove ? 0 : -1} role="button" aria-label={`${p.name}: x ${p.x}, y ${p.y}, volume ${p.w}. Use arrow keys to move.`} style={{ cursor: onMove ? (drag === i ? 'grabbing' : 'grab') : 'default', outline: 'none' }}
            onPointerDown={(e) => { if (!onMove) return; (e.target as Element).setPointerCapture?.(e.pointerId); frozen.current = { x: ext('x'), y: ext('y') }; setDrag(i); }}
            onKeyDown={(e) => { if (!onMove) return; const d = e.key === 'ArrowLeft' ? [-1, 0] : e.key === 'ArrowRight' ? [1, 0] : e.key === 'ArrowUp' ? [0, 1] : e.key === 'ArrowDown' ? [0, -1] : null; if (d) { e.preventDefault(); onMove(i, round(p.x + d[0] * step), round(p.y + d[1] * step)); } }}>
            <circle r={rad(p.w)} fill="var(--alt)" fillOpacity={drag === i ? 0.5 : 0.28} stroke="var(--alt)" strokeWidth={1.6} className="transition-[fill-opacity]" />
            <circle r={3} fill="var(--alt)" />
            <text y={-rad(p.w) - 5} textAnchor="middle" fontSize="11" fontWeight={600} fill="var(--fg)" paintOrder="stroke" stroke="var(--sunken)" strokeWidth={3} pointerEvents="none">{p.name}</text>
          </g>))}
        {spec.candidates?.map((c, i) => (<g key={i} transform={`translate(${xs(c.x)},${ys(c.y)})`}><rect x={-8} y={-8} width={16} height={16} rx={3} transform="rotate(45)" fill={c.best ? 'var(--accent)' : 'var(--surface)'} stroke={c.best ? 'var(--accent)' : 'var(--muted)'} strokeWidth={2} style={c.best ? { filter: 'drop-shadow(0 0 6px var(--accent))' } : undefined} /><text y={25} textAnchor="middle" fontSize="11" fontWeight={600} fill={c.best ? 'var(--accent)' : 'var(--muted)'} paintOrder="stroke" stroke="var(--sunken)" strokeWidth={3}>{c.name} · {tick(c.score)}</text></g>))}
        {spec.center && (<g transform={`translate(${xs(spec.center.x)},${ys(spec.center.y)})`} style={{ transition: drag === null ? 'transform .25s ease-out' : undefined }}>
          <circle r={16} fill="none" stroke="var(--accent)" strokeOpacity={0.5}><animate attributeName="r" values="10;22;10" dur="2.4s" repeatCount="indefinite" /><animate attributeName="stroke-opacity" values="0.7;0;0.7" dur="2.4s" repeatCount="indefinite" /></circle>
          <circle r={7} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2.5} /><path d="M-13 0h-6M13 0h6M0-13v-6M0 13v6" stroke="var(--accent)" strokeWidth={2} strokeLinecap="round" />
          <text y={-24} textAnchor="middle" fontSize="11.5" fontWeight={700} fill="var(--accent)" paintOrder="stroke" stroke="var(--sunken)" strokeWidth={3.5}>{spec.center.label} ({tick(spec.center.x)}, {tick(spec.center.y)})</text>
        </g>)}
      </svg>
      {onMove && <p className="mt-2 text-xs text-muted">Drag a location to move it. Circle size shows volume.</p>}
    </div>
  );
}
