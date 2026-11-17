'use client';
import { useMemo, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { line as d3line, area as d3area, curveStepAfter, curveLinear } from 'd3-shape';
import type { Tone, VizSpec } from '@lotwise/engine';
import { useWidth } from '../ui';

type XY = Extract<VizSpec, { kind: 'xy' }>;
export const toneVar = (t?: Tone) => (t === 'alt' ? 'var(--alt)' : t === 'alt2' ? 'var(--alt2)' : t === 'muted' ? 'var(--muted)' : t === 'good' ? 'var(--good)' : t === 'warn' ? 'var(--warn)' : t === 'bad' ? 'var(--bad)' : 'var(--accent)');
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
export const tick = (x: number) => (Math.abs(x) >= 10000 ? compact.format(x) : Math.abs(x) >= 100 ? Math.round(x).toLocaleString('en-US') : Math.abs(x) >= 1 || x === 0 ? String(+x.toFixed(2)) : String(+x.toPrecision(2)));
const fin = (x: number) => Number.isFinite(x);

function interp(pts: [number, number][], x: number): number | null {
  if (!pts.length) return null; if (x <= pts[0][0]) return pts[0][1]; if (x >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; return x1 === x0 ? y1 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0); }
  return null;
}

export function XYChart({ spec, height = 300 }: { spec: XY; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>(640);
  const [hover, setHover] = useState<number | null>(null);
  const cats = spec.x.cats; const small = width < 480;
  const m = { t: 22, r: small ? 12 : 18, b: cats ? (cats.some((c) => c.length > 7) && cats.length > 4 ? 62 : 44) : 42, l: small ? 44 : 56 };
  const H = small ? Math.min(height, 250) : height; const iw = Math.max(40, width - m.l - m.r), ih = H - m.t - m.b;

  const { xs, ys, bw } = useMemo(() => {
    const allX: number[] = [], allY: number[] = [];
    for (const s of spec.series) for (const [x, y] of s.pts) { if (fin(x)) allX.push(x); if (fin(y)) allY.push(y); }
    spec.vlines?.forEach((v) => fin(v.x) && allX.push(v.x)); spec.marks?.forEach((k) => { if (fin(k.x)) allX.push(k.x); if (fin(k.y)) allY.push(k.y); });
    spec.hlines?.forEach((h) => fin(h.y) && allY.push(h.y)); spec.bands?.forEach((b) => allY.push(b.y0, b.y1));
    spec.ribbon?.upper.forEach((p) => allY.push(p[1])); spec.ribbon?.lower.forEach((p) => allY.push(p[1]));
    const hasBars = spec.series.some((s) => s.style === 'bars');
    let x0 = Math.min(...allX), x1 = Math.max(...allX); if (!fin(x0)) { x0 = 0; x1 = 1; }
    if (cats) { x0 = -0.5; x1 = cats.length - 0.5; } else if (hasBars) { const pad = (x1 - x0) / Math.max(1, spec.series.find((s) => s.style === 'bars')!.pts.length - 1) / 2 || 0.5; x0 -= pad; x1 += pad; } else if (x0 === x1) { x0 -= 1; x1 += 1; }
    let y0 = Math.min(...allY), y1 = Math.max(...allY); if (!fin(y0)) { y0 = 0; y1 = 1; }
    if (spec.y.zero || hasBars) { y0 = Math.min(0, y0); y1 = Math.max(0, y1); }
    if (y0 === y1) { y0 -= 1; y1 += 1; }
    const padY = (y1 - y0) * 0.08; const ysc = scaleLinear().domain([y0 === 0 ? 0 : y0 - padY, y1 + padY]).range([ih, 0]).nice(5);
    const xsc = scaleLinear().domain([x0, x1]).range([0, iw]);
    const nb = spec.series.find((s) => s.style === 'bars')?.pts.length ?? 1;
    return { xs: xsc, ys: ysc, bw: Math.max(3, Math.min(48, (iw / Math.max(nb, 1)) * 0.62)) };
  }, [spec, iw, ih, cats]);

  const yTicks = ys.ticks(5); const xTicks = cats ? cats.map((_, i) => i) : xs.ticks(small ? 4 : 7);
  const base = ys(Math.max(ys.domain()[0], Math.min(0, ys.domain()[1])));
  const hx = hover === null ? null : xs.invert(hover);
  const snap = useMemo(() => {
    if (hx === null) return null; let best: number | null = null;
    for (const s of spec.series) for (const [x] of s.pts) if (best === null || Math.abs(x - hx) < Math.abs(best - hx)) best = x;
    const dense = spec.series.some((s) => s.pts.length > 40);
    return cats ? Math.max(0, Math.min(cats.length - 1, Math.round(hx))) : dense ? hx : best;
  }, [hx, spec, cats]);
  const legend = spec.series.filter((s) => s.name && s.pts.length);

  return (
    <div ref={ref} className="w-full select-none">
      <div className="relative">
        <svg width={width} height={H} role="img" aria-label={`Chart: ${spec.y.label}${spec.x.label ? ' by ' + spec.x.label : ''}. ${legend.map((l) => l.name).join(', ')}.`} className="block touch-pan-y"
          onPointerMove={(e) => { const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect(); const px = e.clientX - r.left - m.l; setHover(px >= 0 && px <= iw ? px : null); }} onPointerLeave={() => setHover(null)}>
          <defs>
            {spec.series.map((s, i) => (<linearGradient key={i} id={`xy-g-${i}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={toneVar(s.tone)} stopOpacity="0.32" /><stop offset="1" stopColor={toneVar(s.tone)} stopOpacity="0.02" /></linearGradient>))}
          </defs>
          <g transform={`translate(${m.l},${m.t})`}>
            {yTicks.map((t) => (<g key={t}><line x1={0} x2={iw} y1={ys(t)} y2={ys(t)} stroke="var(--line)" /><text x={-8} y={ys(t)} dy="0.32em" textAnchor="end" fontSize="11" fill="var(--faint)" className="num">{tick(t)}</text></g>))}
            {spec.bands?.map((b, i) => (<rect key={i} x={0} width={iw} y={ys(Math.max(b.y0, b.y1))} height={Math.abs(ys(b.y0) - ys(b.y1))} fill={toneVar(b.tone)} opacity={0.1} />))}
            {spec.ribbon && (<path d={d3area<[number, number]>().x((p) => xs(p[0])).y0((_, i) => ys(spec.ribbon!.lower[i]?.[1] ?? 0)).y1((p) => ys(p[1]))(spec.ribbon.upper) ?? ''} fill={toneVar(spec.ribbon.tone)} opacity={0.12} />)}
            {spec.shade?.map((sh, i) => {
              const src = spec.series[sh.series]?.pts ?? []; const a = Math.max(sh.x0, src[0]?.[0] ?? sh.x0), b = Math.min(sh.x1, src[src.length - 1]?.[0] ?? sh.x1); if (!(b > a)) return null;
              const inner = src.filter((p) => p[0] > a && p[0] < b); const poly: [number, number][] = [[a, interp(src, a) ?? 0], ...inner, [b, interp(src, b) ?? 0]];
              return <path key={i} d={d3area<[number, number]>().x((p) => xs(p[0])).y0(base).y1((p) => ys(p[1]))(poly) ?? ''} fill={toneVar(sh.tone)} opacity={0.26} />;
            })}
            {spec.series.map((s, i) => {
              const col = toneVar(s.tone); const P = s.pts.filter((p) => fin(p[0]) && fin(p[1])); if (!P.length) return null;
              if (s.style === 'bars') return (<g key={i}>{P.map(([x, y], k) => (<rect key={k} x={xs(x) - bw / 2} width={bw} y={Math.min(ys(y), base)} height={Math.max(1, Math.abs(ys(y) - base))} rx={Math.min(5, bw / 4)} fill={spec.flagged?.includes(k) ? 'var(--bad)' : col} opacity={snap !== null && cats && Math.round(snap) !== x ? 0.55 : 0.92} />))}</g>);
              if (s.style === 'dots') return (<g key={i}>{P.map(([x, y], k) => <circle key={k} cx={xs(x)} cy={ys(y)} r={4} fill={col} stroke="var(--surface)" strokeWidth={1.5} />)}</g>);
              const gen = d3line<[number, number]>().x((p) => xs(p[0])).y((p) => ys(p[1])).curve(s.style === 'step' ? curveStepAfter : curveLinear);
              return (<g key={i}>
                {s.style === 'area' && <path d={d3area<[number, number]>().x((p) => xs(p[0])).y0(base).y1((p) => ys(p[1])).curve(curveLinear)(P) ?? ''} fill={`url(#xy-g-${i})`} />}
                <path d={gen(P) ?? ''} fill="none" stroke={col} strokeWidth={s.style === 'dash' ? 1.6 : 2.2} strokeDasharray={s.style === 'dash' ? '5 4' : undefined} strokeLinejoin="round" strokeLinecap="round" />
                {P.length <= 40 && s.style !== 'dash' && s.style !== 'area' && P.map(([x, y], k) => (<circle key={k} cx={xs(x)} cy={ys(y)} r={i === 0 && spec.flagged?.includes(k) ? 5.5 : 3} fill={i === 0 && spec.flagged?.includes(k) ? 'var(--bad)' : col} stroke="var(--surface)" strokeWidth={1.5} />))}
              </g>);
            })}
            {spec.hlines?.map((h, i) => (<g key={i}><line x1={0} x2={iw} y1={ys(h.y)} y2={ys(h.y)} stroke={toneVar(h.tone)} strokeWidth={1.4} strokeDasharray="6 4" />{h.label && <text x={iw - 4} y={ys(h.y) - 5} textAnchor="end" fontSize="11" fontWeight={600} fill={toneVar(h.tone)} paintOrder="stroke" stroke="var(--surface)" strokeWidth={3}>{h.label}</text>}</g>))}
            {spec.vlines?.map((v, i) => { const x = xs(v.x); const right = x > iw * 0.72; return (<g key={i}><line x1={x} x2={x} y1={-6} y2={ih} stroke={toneVar(v.tone)} strokeWidth={1.4} strokeDasharray="6 4" />{v.label && <text x={x + (right ? -5 : 5)} y={4 + (i % 3) * 13} textAnchor={right ? 'end' : 'start'} fontSize="11" fontWeight={600} fill={toneVar(v.tone)} paintOrder="stroke" stroke="var(--surface)" strokeWidth={3}>{v.label}</text>}</g>); })}
            {spec.marks?.map((k, i) => { const x = xs(k.x), y = ys(k.y); const right = x > iw * 0.7; return (<g key={i}><circle cx={x} cy={y} r={9} fill={toneVar(k.tone)} opacity={0.2} /><circle cx={x} cy={y} r={4.5} fill={toneVar(k.tone)} stroke="var(--surface)" strokeWidth={2} />{k.label && <text x={x + (right ? -10 : 10)} y={y - 9} textAnchor={right ? 'end' : 'start'} fontSize="11" fontWeight={600} fill="var(--fg)" paintOrder="stroke" stroke="var(--surface)" strokeWidth={3}>{k.label}</text>}</g>); })}
            <line x1={0} x2={iw} y1={ih} y2={ih} stroke="var(--line-strong)" />
            {xTicks.map((t, i) => { const lab = cats ? cats[t] : tick(t); const rot = cats && cats.some((c) => c.length > 7) && cats.length > 4; const skip = cats && cats.length > 14 && i % Math.ceil(cats.length / 12) !== 0; return skip ? null : (<text key={i} x={xs(t)} y={ih + 16} textAnchor={rot ? 'end' : 'middle'} transform={rot ? `rotate(-32 ${xs(t)} ${ih + 16})` : undefined} fontSize="11" fill="var(--faint)" className={cats ? '' : 'num'}>{lab.length > 16 ? lab.slice(0, 15) + '…' : lab}</text>); })}
            {spec.x.label && <text x={iw / 2} y={ih + m.b - 6} textAnchor="middle" fontSize="11" fill="var(--muted)">{spec.x.label}</text>}
            <text x={-m.l + 4} y={-9} fontSize="11" fill="var(--muted)">{spec.y.label}</text>
            {snap !== null && <line x1={xs(snap)} x2={xs(snap)} y1={0} y2={ih} stroke="var(--fg)" strokeOpacity={0.35} strokeWidth={1} pointerEvents="none" />}
            {snap !== null && spec.series.map((s, i) => { if (s.style === 'bars') return null; const y = s.pts.length > 40 || s.style === 'dash' || s.style === 'area' || s.style === 'line' ? interp(s.pts, snap) : s.pts.find((p) => p[0] === snap)?.[1] ?? null; return y === null || !fin(y) ? null : <circle key={i} cx={xs(snap)} cy={ys(y)} r={4} fill={toneVar(s.tone)} stroke="var(--surface)" strokeWidth={2} pointerEvents="none" />; })}
          </g>
        </svg>
        {snap !== null && (
          <div className="pointer-events-none absolute top-1 z-10 min-w-28 rounded-lg border border-line-strong bg-raised/95 px-2.5 py-1.5 text-xs shadow-xl backdrop-blur" style={xs(snap) > iw * 0.55 ? { right: width - m.l - xs(snap) + 10 } : { left: m.l + xs(snap) + 10 }}>
            <div className="mb-0.5 text-faint">{cats ? cats[Math.round(snap)] : `${spec.x.label.split(' (')[0] || 'x'}: ${tick(snap)}`}</div>
            {spec.series.map((s, i) => { const exact = s.pts.find((p) => Math.abs(p[0] - snap) < 1e-9)?.[1]; const y = exact ?? (s.style === 'bars' || s.style === 'dots' ? null : interp(s.pts, snap)); return y === null || !fin(y) ? null : (<div key={i} className="flex items-center justify-between gap-3"><span className="flex items-center gap-1.5"><i className="inline-block h-2 w-2 rounded-full" style={{ background: toneVar(s.tone) }} />{s.name}</span><span className="num font-semibold">{tick(y)}</span></div>); })}
          </div>
        )}
      </div>
      {(legend.length > 1 || spec.ribbon || spec.shade?.some((s) => s.label)) && (
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs text-muted">
          {legend.length > 1 && legend.map((s, i) => (<span key={i} className="flex items-center gap-1.5"><i className="inline-block h-0.5 w-4 rounded" style={{ background: toneVar(s.tone), height: s.style === 'bars' ? 8 : 2, width: s.style === 'bars' ? 8 : 16 }} />{s.name}</span>))}
          {spec.shade?.filter((s) => s.label).map((s, i) => (<span key={'s' + i} className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: toneVar(s.tone), opacity: 0.45 }} />{s.label}</span>))}
          {spec.ribbon && <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-4 rounded-sm" style={{ background: toneVar(spec.ribbon.tone), opacity: 0.3 }} />{spec.ribbon.label}</span>}
          {spec.flagged && spec.flagged.length > 0 && <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-full bg-bad" />Out of control</span>}
        </div>
      )}
    </div>
  );
}
