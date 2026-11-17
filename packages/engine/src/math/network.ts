// Activity-on-node project networks: CPM forward/backward pass, PERT variance, and minimum-cost crashing (LP).
import { simplex, type Sense } from './simplex';

export interface Act { id: string; dur: number; preds: string[] }
export interface Cpm { es: number[]; ef: number[]; ls: number[]; lf: number[]; slack: number[]; critical: boolean[]; duration: number; order: number[]; path: string[] }

export function parseActs(rows: any[], durKey = 'dur'): Act[] {
  return rows.map((r, i) => ({ id: String(r.id ?? '').trim() || `A${i + 1}`, dur: Number(r[durKey]), preds: String(r.preds ?? '').split(/[,;\s]+/).map((s) => s.trim()).filter((s) => s && s !== '-' && s !== '—' && s.toLowerCase() !== 'none') }));
}

export function topo(acts: Act[]): number[] {
  const idx = new Map(acts.map((a, i) => [a.id, i])); const indeg = acts.map((a) => a.preds.length); const succ: number[][] = acts.map(() => []);
  acts.forEach((a, i) => a.preds.forEach((p) => succ[idx.get(p)!].push(i)));
  const q: number[] = []; indeg.forEach((d, i) => { if (d === 0) q.push(i); }); const order: number[] = [];
  while (q.length) { const i = q.shift()!; order.push(i); for (const s of succ[i]) if (--indeg[s] === 0) q.push(s); }
  return order;
}

export function cpm(acts: Act[]): Cpm {
  const n = acts.length; const idx = new Map(acts.map((a, i) => [a.id, i])); const order = topo(acts);
  const succ: number[][] = acts.map(() => []); acts.forEach((a, i) => a.preds.forEach((p) => succ[idx.get(p)!].push(i)));
  const es = new Array(n).fill(0), ef = new Array(n).fill(0);
  for (const i of order) { es[i] = Math.max(0, ...acts[i].preds.map((p) => ef[idx.get(p)!])); ef[i] = es[i] + acts[i].dur; }
  const duration = Math.max(0, ...ef); const lf = new Array(n).fill(duration), ls = new Array(n).fill(0);
  for (const i of [...order].reverse()) { lf[i] = succ[i].length ? Math.min(...succ[i].map((s) => ls[s])) : duration; ls[i] = lf[i] - acts[i].dur; }
  const slack = ls.map((x, i) => x - es[i]); const tol = 1e-9 * Math.max(1, duration);
  const critical = slack.map((s) => Math.abs(s) <= tol);
  // one critical path, start to finish
  const path: string[] = []; let cur = order.find((i) => critical[i] && Math.abs(es[i]) <= tol);
  while (cur !== undefined) { path.push(acts[cur].id); const c: number = cur; cur = succ[c].find((s) => critical[s] && Math.abs(es[s] - ef[c]) <= tol); }
  return { es, ef, ls, lf, slack, critical, duration, order, path };
}

/** Variance of the critical path. With several critical paths, the largest variance is reported. */
export function criticalVariance(acts: Act[], c: Cpm, variance: number[]): number {
  const idx = new Map(acts.map((a, i) => [a.id, i])); const tol = 1e-9 * Math.max(1, c.duration); const V = new Array(acts.length).fill(-Infinity);
  for (const i of c.order) { if (!c.critical[i]) continue; const cp = acts[i].preds.map((p) => idx.get(p)!).filter((p) => c.critical[p] && Math.abs(c.ef[p] - c.es[i]) <= tol); V[i] = variance[i] + (cp.length ? Math.max(...cp.map((p) => V[p])) : Math.abs(c.es[i]) <= tol ? 0 : -Infinity); }
  let best = 0; acts.forEach((_, i) => { if (c.critical[i] && Math.abs(c.ef[i] - c.duration) <= tol && V[i] > best) best = V[i]; });
  return best;
}

export function actsError(acts: Act[]): string | null {
  const ids = new Set<string>();
  for (const a of acts) { if (ids.has(a.id)) return `Activity "${a.id}" appears more than once. Give every activity a unique name.`; ids.add(a.id); if (!(a.dur >= 0) || !Number.isFinite(a.dur)) return `Activity "${a.id}" needs a duration of zero or more.`; }
  for (const a of acts) for (const p of a.preds) { if (!ids.has(p)) return `Activity "${a.id}" lists predecessor "${p}", which is not in the table.`; if (p === a.id) return `Activity "${a.id}" cannot be its own predecessor.`; }
  if (topo(acts).length !== acts.length) return 'The precedence relationships form a loop. An activity cannot come both before and after another.';
  return null;
}

export interface CrashAct extends Act { crashDur: number; normalCost: number; crashCost: number }
/** Minimum total crash cost to finish by `target`, solved as a linear program. */
export function crash(acts: CrashAct[], target: number): { feasible: boolean; cost: number; y: number[] } {
  const n = acts.length; const idx = new Map(acts.map((a, i) => [a.id, i]));
  const maxY = acts.map((a) => Math.max(0, a.dur - a.crashDur)); const slope = acts.map((a, i) => (maxY[i] > 0 ? (a.crashCost - a.normalCost) / maxY[i] : 0));
  // variables: y_0..y_{n-1}, s_0..s_{n-1}, T
  const nv = 2 * n + 1; const c = new Array(nv).fill(0); slope.forEach((s, i) => (c[i] = s));
  const A: number[][] = [], b: number[] = [], sense: Sense[] = [];
  const row = () => new Array(nv).fill(0);
  acts.forEach((a, i) => {
    a.preds.forEach((p) => { const pi = idx.get(p)!; const r = row(); r[n + i] = 1; r[n + pi] = -1; r[pi] = 1; A.push(r); b.push(acts[pi].dur); sense.push('>='); });
    const r = row(); r[2 * n] = 1; r[n + i] = -1; r[i] = 1; A.push(r); b.push(a.dur); sense.push('>=');
    const u = row(); u[i] = 1; A.push(u); b.push(maxY[i]); sense.push('<=');
  });
  const t = row(); t[2 * n] = 1; A.push(t); b.push(target); sense.push('<=');
  const res = simplex(c, A, b, sense);
  if (res.status !== 'optimal') return { feasible: false, cost: NaN, y: [] };
  return { feasible: true, cost: res.value, y: res.x.slice(0, n).map((v) => (Math.abs(v) < 1e-9 ? 0 : v)) };
}
