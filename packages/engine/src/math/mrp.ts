// MRP record logic and lot-sizing rules. Holding cost is charged on end-of-period inventory.
export type LotRule = 'l4l' | 'foq' | 'poq' | 'ppb';
export interface LotPlan { net: number[]; receipts: number[]; end: number[]; orders: number; setupCost: number; holdCost: number; total: number; units: number }

export function planLots(gross: number[], onHand: number, rule: LotRule, p: { Q?: number; P?: number; S?: number; h?: number; ss?: number; sched?: number[] } = {}): LotPlan {
  const n = gross.length; const ss = p.ss ?? 0; const sched = Array.from({ length: n }, (_, i) => p.sched?.[i] ?? 0);
  // Step 1: lot-for-lot net requirements (what must arrive each period to keep inventory at safety stock).
  const l4l: number[] = []; let inv = onHand;
  for (let t = 0; t < n; t++) { const avail = inv + sched[t]; const need = Math.max(0, gross[t] + ss - avail); l4l.push(need); inv = avail + need - gross[t]; }
  // Step 2: apply the lot rule.
  const receipts = new Array(n).fill(0);
  if (rule === 'l4l') l4l.forEach((x, t) => (receipts[t] = x));
  else if (rule === 'foq') {
    const Q = Math.max(p.Q ?? 1, 1e-9); inv = onHand;
    for (let t = 0; t < n; t++) { const avail = inv + sched[t]; const need = gross[t] + ss - avail; if (need > 1e-9) receipts[t] = Math.ceil(need / Q - 1e-9) * Q; inv = avail + receipts[t] - gross[t]; }
  } else if (rule === 'poq') {
    const P = Math.max(1, Math.round(p.P ?? 1)); let t = 0;
    while (t < n) { if (l4l[t] > 1e-9) { let q = 0; for (let k = t; k < Math.min(n, t + P); k++) q += l4l[k]; receipts[t] = q; t += P; } else t++; }
  } else {
    const epp = (p.S ?? 0) / Math.max(p.h ?? 1, 1e-12); let t = 0;
    while (t < n) {
      if (l4l[t] <= 1e-9) { t++; continue; }
      let bestEnd = t, bestDiff = Math.abs(0 - epp), pp = 0;
      for (let k = t + 1; k < n; k++) { pp += l4l[k] * (k - t); const d = Math.abs(pp - epp); if (d < bestDiff - 1e-9) { bestDiff = d; bestEnd = k; } if (pp > epp) break; }
      let q = 0; for (let k = t; k <= bestEnd; k++) q += l4l[k]; receipts[t] = q; t = bestEnd + 1;
    }
  }
  // Step 3: projected ending inventory and costs.
  const end: number[] = []; const net: number[] = []; inv = onHand; let orders = 0, held = 0, units = 0;
  for (let t = 0; t < n; t++) { const avail = inv + sched[t]; net.push(Math.max(0, gross[t] + ss - avail)); inv = avail + receipts[t] - gross[t]; end.push(inv); if (receipts[t] > 1e-9) { orders++; units += receipts[t]; } held += Math.max(0, inv); }
  const setupCost = orders * (p.S ?? 0), holdCost = held * (p.h ?? 0);
  return { net, receipts, end, orders, setupCost, holdCost, total: setupCost + holdCost, units };
}

/** Offset planned receipts by the lead time to get planned order releases. Releases that would fall before period 1 are counted as past due. */
export function releases(receipts: number[], lead: number): { rel: number[]; pastDue: number } {
  const rel = new Array(receipts.length).fill(0); let pastDue = 0;
  receipts.forEach((q, t) => { if (q <= 0) return; const r = t - lead; if (r < 0) pastDue += q; else rel[r] += q; });
  return { rel, pastDue };
}

export interface AggPlan { cost: number; labor: number; holding: number; backorder: number; change: number; sub: number; prod: number[]; inv: number[] }
export interface AggInput { demand: number[]; days: number[]; hrs: number; wage: number; hire: number; fire: number; hold: number; back: number; subCost: number; begInv: number; round: boolean }
export function aggLevel(a: AggInput): AggPlan {
  const totalDays = a.days.reduce((s, x) => s + x, 0); const rate = (a.demand.reduce((s, x) => s + x, 0) - a.begInv) / totalDays;
  let inv = a.begInv, holding = 0, backorder = 0, units = 0; const prod: number[] = [], invs: number[] = [];
  a.demand.forEach((d, t) => { const p = rate * a.days[t]; prod.push(p); units += p; inv += p - d; if (Math.abs(inv) < 1e-9) inv = 0; invs.push(inv); if (inv > 0) holding += inv * a.hold; else backorder += -inv * a.back; });
  const labor = units * a.hrs * a.wage; return { cost: labor + holding + backorder, labor, holding, backorder, change: 0, sub: 0, prod, inv: invs };
}
export function aggChase(a: AggInput): AggPlan {
  let inv = a.begInv, hire = 0, fire = 0, units = 0, prev = NaN; const prod: number[] = [], invs: number[] = [];
  a.demand.forEach((d, t) => { const p = Math.max(0, d - inv); inv = inv + p - d; prod.push(p); invs.push(inv); units += p; const r = a.round ? Math.round(p / a.days[t]) : p / a.days[t]; if (!Number.isNaN(prev)) { if (r > prev) hire += (r - prev) * a.hire; else fire += (prev - r) * a.fire; } prev = r; });
  const labor = units * a.hrs * a.wage; return { cost: labor + hire + fire, labor, holding: 0, backorder: 0, change: hire + fire, sub: 0, prod, inv: invs };
}
export function aggHybrid(a: AggInput): AggPlan {
  const minRate = Math.min(...a.demand.map((d, t) => d / a.days[t])); const base = a.round ? Math.floor(minRate + 1e-9) : minRate;
  let inv = a.begInv, holding = 0, sub = 0, units = 0; const prod: number[] = [], invs: number[] = [];
  a.demand.forEach((d, t) => { const p = base * a.days[t]; units += p; prod.push(p); const short = Math.max(0, d - p - inv); sub += short; inv = inv + p + short - d; if (Math.abs(inv) < 1e-9) inv = 0; invs.push(inv); holding += inv * a.hold; });
  const labor = units * a.hrs * a.wage; return { cost: labor + sub * a.subCost + holding, labor, holding, backorder: 0, change: 0, sub: sub * a.subCost, prod, inv: invs };
}
