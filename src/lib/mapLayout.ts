// Deterministic layout for the Formula Map: a 3D constellation and a flat 2D fallback, both computed once.
import { CALCS, CATEGORIES, EDGES, LEARNING_PATHS, calcsIn } from '@lotwise/engine';

export const CAT_COLOR: Record<string, string> = {
  process: '#6ea8fe', queue: '#34d3be', quality: '#f48fb1', forecast: '#c4a1ff', 'inv-order': '#8e9bff', 'inv-service': '#ffa35c', 'inv-perf': '#fbbf24',
  mrp: '#4ade80', logistics: '#38bdf8', sourcing: '#fb7185', finance: '#a3e635', project: '#f59e0b', decision: '#e879f9',
};
export interface MapNode { id: string; name: string; cat: string; p: [number, number, number]; x: number; y: number; deg: number }
export interface MapLayout { nodes: MapNode[]; index: Record<string, number>; cats: { id: string; name: string; p: [number, number, number]; x: number; y: number; r: number }[]; edges: [number, number][] }

const GOLD = Math.PI * (3 - Math.sqrt(5));
function fib(i: number, n: number): [number, number, number] { const y = n === 1 ? 0 : 1 - (2 * (i + 0.5)) / n; const r = Math.sqrt(Math.max(0, 1 - y * y)); const t = GOLD * i; return [Math.cos(t) * r, y, Math.sin(t) * r]; }

function build(): MapLayout {
  const index: Record<string, number> = {}; const nodes: MapNode[] = []; const R = 9.5;
  // 2D: clusters on a 5-4-4 honeycomb inside a 1200 x 800 canvas
  const rows = [5, 4, 4]; const flat: [number, number][] = []; rows.forEach((n, r) => { for (let c = 0; c < n; c++) flat.push([120 + (n === 5 ? 0 : 120) + c * 240, 150 + r * 250]); });
  const cats = CATEGORIES.map((c, ci) => {
    const center = fib(ci, CATEGORIES.length).map((v) => v * R) as [number, number, number]; const list = calcsIn(c.id); const spread = 1.25 + Math.sqrt(list.length) * 0.55; const [fx, fy] = flat[ci]; const fr = 26 + Math.sqrt(list.length) * 17;
    list.forEach((d, i) => {
      const o = fib(i, list.length); const a = GOLD * i; const rr = fr * Math.sqrt((i + 0.6) / list.length);
      index[d.id] = nodes.length;
      nodes.push({ id: d.id, name: d.name, cat: c.id, p: [center[0] + o[0] * spread, center[1] + o[1] * spread, center[2] + o[2] * spread], x: fx + Math.cos(a) * rr, y: fy + Math.sin(a) * rr, deg: 0 });
    });
    return { id: c.id, name: c.name, p: center.map((v) => v * 1.32) as [number, number, number], x: fx, y: fy, r: fr + 22 };
  });
  const edges: [number, number][] = EDGES.filter((e) => index[e.from] !== undefined && index[e.to] !== undefined).map((e) => [index[e.from], index[e.to]]);
  edges.forEach(([a, b]) => { nodes[a].deg++; nodes[b].deg++; });
  // A few relaxation passes: connected calculators lean toward each other, everything keeps its distance.
  for (let it = 0; it < 40; it++) {
    const f = nodes.map(() => [0, 0, 0]);
    for (const [a, b] of edges) { const pa = nodes[a].p; const pb = nodes[b].p; for (let k = 0; k < 3; k++) { const d = (pb[k] - pa[k]) * 0.012; f[a][k] += d; f[b][k] -= d; } }
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) { const pa = nodes[i].p; const pb = nodes[j].p; const dx = pa[0] - pb[0]; const dy = pa[1] - pb[1]; const dz = pa[2] - pb[2]; const d2 = dx * dx + dy * dy + dz * dz; if (d2 < 2.2 && d2 > 1e-6) { const s = (0.05 * (2.2 - d2)) / Math.sqrt(d2); f[i][0] += dx * s; f[i][1] += dy * s; f[i][2] += dz * s; f[j][0] -= dx * s; f[j][1] -= dy * s; f[j][2] -= dz * s; } }
    nodes.forEach((nd, i) => { nd.p = [nd.p[0] + f[i][0], nd.p[1] + f[i][1], nd.p[2] + f[i][2]]; });
  }
  return { nodes, index, cats, edges };
}
export const LAYOUT: MapLayout = build();
export const pathEdges = (pathId: string | null): [number, number][] => { const p = LEARNING_PATHS.find((x) => x.id === pathId); if (!p) return []; const out: [number, number][] = []; for (let i = 0; i + 1 < p.steps.length; i++) { const a = LAYOUT.index[p.steps[i]]; const b = LAYOUT.index[p.steps[i + 1]]; if (a !== undefined && b !== undefined) out.push([a, b]); } return out; };
export const TOTAL = CALCS.length;
