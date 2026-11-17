// Small dense two-phase simplex (Bland's rule). Minimise c·x subject to A x (<=, >=, =) b, x >= 0.
export type Sense = '<=' | '>=' | '=';
export interface LpResult { status: 'optimal' | 'infeasible' | 'unbounded'; x: number[]; value: number }
const EPS = 1e-9;

export function simplex(c: number[], A: number[][], b: number[], sense: Sense[]): LpResult {
  const m = A.length, n = c.length;
  const rows = A.map((r, i) => (b[i] < 0 ? r.map((x) => -x) : r.slice()));
  const rhs = b.map((x) => Math.abs(x));
  const sn = sense.map((s, i) => (b[i] < 0 ? (s === '<=' ? '>=' : s === '>=' ? '<=' : '=') : s));
  let ncol = n; const slackCol: number[] = [], artCol: number[] = [];
  sn.forEach((s) => { slackCol.push(s === '=' ? -1 : ncol++); });
  sn.forEach((s) => { artCol.push(s === '<=' ? -1 : ncol++); });
  const T: number[][] = rows.map((r, i) => { const row = new Array(ncol + 1).fill(0); for (let j = 0; j < n; j++) row[j] = r[j]; if (slackCol[i] >= 0) row[slackCol[i]] = sn[i] === '<=' ? 1 : -1; if (artCol[i] >= 0) row[artCol[i]] = 1; row[ncol] = rhs[i]; return row; });
  const basis = sn.map((s, i) => (s === '<=' ? slackCol[i] : artCol[i]));
  const isArt = new Array(ncol).fill(false); artCol.forEach((j) => { if (j >= 0) isArt[j] = true; });

  const pivot = (r: number, col: number) => {
    const pv = T[r][col]; for (let j = 0; j <= ncol; j++) T[r][j] /= pv;
    for (let i = 0; i < m; i++) { if (i === r) continue; const f = T[i][col]; if (Math.abs(f) < 1e-14) continue; for (let j = 0; j <= ncol; j++) T[i][j] -= f * T[r][j]; }
    basis[r] = col;
  };
  const run = (cost: number[], allow: (j: number) => boolean): 'optimal' | 'unbounded' => {
    for (let iter = 0; iter < 20000; iter++) {
      let enter = -1;
      for (let j = 0; j < ncol; j++) { if (!allow(j)) continue; let rc = cost[j]; for (let i = 0; i < m; i++) rc -= cost[basis[i]] * T[i][j]; if (rc < -EPS) { enter = j; break; } }
      if (enter < 0) return 'optimal';
      let leave = -1, best = Infinity;
      for (let i = 0; i < m; i++) { if (T[i][enter] > EPS) { const ratio = T[i][ncol] / T[i][enter]; if (ratio < best - 1e-12 || (Math.abs(ratio - best) <= 1e-12 && basis[i] < basis[leave])) { best = ratio; leave = i; } } }
      if (leave < 0) return 'unbounded';
      pivot(leave, enter);
    }
    return 'optimal';
  };
  // Phase 1
  if (artCol.some((j) => j >= 0)) {
    const c1 = new Array(ncol).fill(0); isArt.forEach((a, j) => { if (a) c1[j] = 1; });
    run(c1, () => true);
    let infeas = 0; for (let i = 0; i < m; i++) if (isArt[basis[i]]) infeas += T[i][ncol];
    if (infeas > 1e-7) return { status: 'infeasible', x: [], value: NaN };
    for (let i = 0; i < m; i++) if (isArt[basis[i]]) { for (let j = 0; j < ncol; j++) if (!isArt[j] && Math.abs(T[i][j]) > 1e-9) { pivot(i, j); break; } }
  }
  // Phase 2
  const c2 = new Array(ncol).fill(0); for (let j = 0; j < n; j++) c2[j] = c[j];
  const st = run(c2, (j) => !isArt[j]);
  if (st === 'unbounded') return { status: 'unbounded', x: [], value: -Infinity };
  const x = new Array(n).fill(0); for (let i = 0; i < m; i++) if (basis[i] < n) x[basis[i]] = T[i][ncol];
  return { status: 'optimal', x, value: c.reduce((s, cj, j) => s + cj * x[j], 0) };
}
