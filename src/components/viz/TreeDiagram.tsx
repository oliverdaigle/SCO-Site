'use client';
import { useMemo } from 'react';
import type { TreeViz, VizSpec } from '@lotwise/engine';
import { tick } from './XYChart';

type T = Extract<VizSpec, { kind: 'tree' }>;
interface Pos { n: TreeViz; x: number; y: number; depth: number; parent?: Pos; onBest: boolean }
/** Decision tree: squares are decisions, circles are chance events, triangles are outcomes. The best strategy is highlighted. */
export function TreeDiagram({ spec }: { spec: T }) {
  const { nodes, W, H } = useMemo(() => {
    const out: Pos[] = []; let leaf = 0; const DX = 168, DY = 46;
    const walk = (n: TreeViz, depth: number, parent: Pos | undefined, onBest: boolean): Pos => {
      const p: Pos = { n, x: 26 + depth * DX, y: 0, depth, parent, onBest }; out.push(p);
      if (!n.children?.length) { p.y = 28 + leaf * DY; leaf++; } else { const kids = n.children.map((c) => walk(c, depth + 1, p, onBest && (n.type !== 'decision' || !!c.best))); p.y = kids.reduce((s, k) => s + k.y, 0) / kids.length; }
      return p;
    };
    walk(spec.root, 0, undefined, true);
    return { nodes: out, W: Math.max(...out.map((p) => p.x)) + 150, H: 28 + leaf * DY + 6 };
  }, [spec]);
  return (
    <div>
      <div className="scroll-x rounded-xl border border-line bg-sunken p-2">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ minWidth: W, display: 'block' }} role="img" aria-label={`Decision tree. Expected value of the best strategy: ${tick(spec.root.value)}.`}>
          {nodes.filter((p) => p.parent).map((p, i) => { const a = p.parent!; const pruned = a.n.type === 'decision' && !p.n.best; const hot = p.onBest; const mx = a.x + 34;
            return (<g key={i} opacity={pruned ? 0.45 : 1}>
              <path d={`M${a.x + 11},${a.y} L${mx},${a.y} L${mx + 16},${p.y} L${p.x - 12},${p.y}`} fill="none" stroke={hot ? 'var(--accent)' : 'var(--line-strong)'} strokeWidth={hot ? 2.4 : 1.3} strokeLinejoin="round" />
              {pruned && <path d={`M${mx + 34},${p.y - 6}l5,12M${mx + 40},${p.y - 6}l5,12`} stroke="var(--bad)" strokeWidth={1.6} strokeLinecap="round" />}
              <text x={mx + 22} y={p.y - 6} fontSize="10.5" fill={hot ? 'var(--fg)' : 'var(--muted)'} fontWeight={hot ? 600 : 400}>{p.n.label.length > 19 ? p.n.label.slice(0, 18) + '…' : p.n.label}{a.n.type === 'chance' && p.n.prob !== undefined ? ` (${+(p.n.prob * 100).toFixed(1)}%)` : ''}</text>
            </g>); })}
          {nodes.map((p, i) => { const hot = p.onBest; const col = hot ? 'var(--accent)' : 'var(--muted)';
            return (<g key={i} transform={`translate(${p.x},${p.y})`} opacity={p.parent && p.parent.n.type === 'decision' && !p.n.best ? 0.5 : 1}>
              {p.n.type === 'decision' ? <rect x={-10} y={-10} width={20} height={20} rx={3} fill="var(--surface)" stroke={col} strokeWidth={2} /> : p.n.type === 'chance' ? <circle r={10.5} fill="var(--surface)" stroke={col} strokeWidth={2} /> : <path d="M-9,0 L8,-9 L8,9 Z" fill={hot ? 'var(--accent)' : 'var(--surface)'} stroke={col} strokeWidth={2} strokeLinejoin="round" />}
              <text x={p.n.type === 'end' ? 15 : 0} y={p.n.type === 'end' ? 4 : 24} textAnchor={p.n.type === 'end' ? 'start' : 'middle'} fontSize="11.5" fontWeight={700} className="num" fill={hot ? 'var(--accent)' : 'var(--fg)'} paintOrder="stroke" stroke="var(--sunken)" strokeWidth={3}>{tick(p.n.value)}</text>
            </g>); })}
        </svg>
      </div>
      <p className="mt-2 text-xs text-muted">□ decision · ○ chance · ◁ outcome. Numbers are rolled-back expected values. Crossed-out branches are rejected.</p>
    </div>
  );
}
