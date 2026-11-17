'use client';
import { useMemo } from 'react';
import type { VizSpec } from '@lotwise/engine';

type N = Extract<VizSpec, { kind: 'network' }>;
const STATION = ['var(--accent)', 'var(--alt)', 'var(--alt2)', 'var(--warn)', 'var(--good)', 'var(--bad)', 'var(--muted)'];
const f = (x?: number) => (x === undefined ? '' : String(+x.toFixed(2)));

/** Activity-on-node diagram. CPM: ES / EF / LS / LF in the corners with the critical path glowing. Line balancing: nodes coloured by station. */
export function NetworkDiagram({ spec }: { spec: N }) {
  const L = useMemo(() => {
    const idx = new Map(spec.nodes.map((n, i) => [n.id, i])); const preds: number[][] = spec.nodes.map(() => []);
    spec.edges.forEach(([a, b]) => { const i = idx.get(a), j = idx.get(b); if (i !== undefined && j !== undefined) preds[j].push(i); });
    const depth = new Array(spec.nodes.length).fill(-1); const d = (i: number, guard = 0): number => (depth[i] >= 0 || guard > 60 ? Math.max(depth[i], 0) : (depth[i] = preds[i].length ? Math.max(...preds[i].map((p) => d(p, guard + 1))) + 1 : 0));
    spec.nodes.forEach((_, i) => d(i));
    const layers: number[][] = []; depth.forEach((dp, i) => (layers[dp] ??= []).push(i));
    const y = new Array(spec.nodes.length).fill(0);
    layers.forEach((layer, li) => { if (li > 0) layer.sort((a, b) => avg(preds[a].map((p) => y[p])) - avg(preds[b].map((p) => y[p]))); layer.forEach((i, k) => (y[i] = k - (layer.length - 1) / 2)); });
    return { depth, y, layers, maxRows: Math.max(...layers.map((l) => l.length)) };
  }, [spec]);
  const cpm = spec.variant === 'cpm'; const nw = cpm ? 112 : 78, nh = cpm ? 66 : 50, gx = cpm ? 54 : 44, gy = 22;
  const W = L.layers.length * (nw + gx) - gx + 24, H = L.maxRows * (nh + gy) - gy + 28;
  const px = (i: number) => 12 + L.depth[i] * (nw + gx), py = (i: number) => H / 2 + L.y[i] * (nh + gy) - nh / 2;
  const idx = new Map(spec.nodes.map((n, i) => [n.id, i]));
  const stations = [...new Set(spec.nodes.map((n) => n.group).filter((g): g is number => g !== undefined))].sort((a, b) => a - b);
  return (
    <div>
      <div className="scroll-x rounded-xl border border-line bg-sunken p-2">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={cpm ? `Project network. Duration ${f(spec.total)}. Critical activities: ${spec.nodes.filter((n) => n.critical).map((n) => n.id).join(', ')}.` : `Precedence diagram with ${stations.length} stations.`} style={{ minWidth: W, display: 'block', margin: '0 auto' }}>
          {spec.edges.map(([a, b], k) => { const i = idx.get(a)!, j = idx.get(b)!; if (i === undefined || j === undefined) return null; const x1 = px(i) + nw, y1 = py(i) + nh / 2, x2 = px(j), y2 = py(j) + nh / 2; const crit = cpm && spec.nodes[i].critical && spec.nodes[j].critical && Math.abs((spec.nodes[i].ef ?? 0) - (spec.nodes[j].es ?? 0)) < 1e-9; const mx = (x1 + x2) / 2;
            return <path key={k} d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2 - 5},${y2}`} fill="none" stroke={crit ? 'var(--accent)' : 'var(--line-strong)'} strokeWidth={crit ? 2.4 : 1.4} className={crit ? 'critical-edge' : ''} markerEnd={`url(#arr-${crit ? 'c' : 'n'})`} />; })}
          <defs><marker id="arr-n" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1l5 3-5 3" fill="none" stroke="var(--muted)" strokeWidth="1.4" strokeLinecap="round" /></marker><marker id="arr-c" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1l5 3-5 3" fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" /></marker></defs>
          {spec.nodes.map((n, i) => { const x = px(i), y = py(i); const col = cpm ? (n.critical ? 'var(--accent)' : 'var(--line-strong)') : STATION[((n.group ?? 1) - 1) % STATION.length];
            return (<g key={n.id} transform={`translate(${x},${y})`}>
              <rect width={nw} height={nh} rx={10} fill={cpm ? (n.critical ? 'color-mix(in oklab, var(--accent) 16%, var(--surface))' : 'var(--surface)') : `color-mix(in oklab, ${col} 18%, var(--surface))`} stroke={col} strokeWidth={n.critical || !cpm ? 2 : 1.2} style={n.critical ? { filter: 'drop-shadow(0 0 6px var(--accent))' } : undefined} />
              {cpm ? (<>
                <line x1={0} x2={nw} y1={20} y2={20} stroke="var(--line)" /><line x1={0} x2={nw} y1={nh - 20} y2={nh - 20} stroke="var(--line)" />
                <text x={8} y={14} fontSize="10.5" fill="var(--muted)" className="num">{f(n.es)}</text><text x={nw / 2} y={14} fontSize="10.5" textAnchor="middle" fill="var(--faint)" className="num">{f(n.dur)}</text><text x={nw - 8} y={14} fontSize="10.5" textAnchor="end" fill="var(--muted)" className="num">{f(n.ef)}</text>
                <text x={nw / 2} y={nh / 2 + 5} fontSize="14" fontWeight={700} textAnchor="middle" fill="var(--fg)">{n.label.length > 11 ? n.label.slice(0, 10) + '…' : n.label}</text>
                <text x={8} y={nh - 6} fontSize="10.5" fill="var(--muted)" className="num">{f(n.ls)}</text><text x={nw / 2} y={nh - 6} fontSize="10.5" textAnchor="middle" fill={n.critical ? 'var(--accent)' : 'var(--faint)'} className="num">{n.critical ? 'critical' : 'slack ' + f(n.slack)}</text><text x={nw - 8} y={nh - 6} fontSize="10.5" textAnchor="end" fill="var(--muted)" className="num">{f(n.lf)}</text>
              </>) : (<>
                <text x={nw / 2} y={21} fontSize="14" fontWeight={700} textAnchor="middle" fill="var(--fg)">{n.label.length > 8 ? n.label.slice(0, 7) + '…' : n.label}</text>
                <text x={nw / 2} y={38} fontSize="10.5" textAnchor="middle" fill="var(--muted)" className="num">{f(n.dur)} · station {n.group}</text>
              </>)}
            </g>); })}
        </svg>
      </div>
      {cpm ? <p className="mt-2 text-xs text-muted">Each box shows <span className="num">ES | duration | EF</span> on top and <span className="num">LS | slack | LF</span> below. The glowing path is critical.</p>
        : <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">{stations.map((s) => (<span key={s} className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: STATION[(s - 1) % STATION.length] }} />Station {s}: {spec.nodes.filter((n) => n.group === s).map((n) => n.id).join(', ')}</span>))}</div>}
    </div>
  );
}
const avg = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
