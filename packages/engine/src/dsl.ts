import type { CalcDef, ColumnDef, InputDef, OutputDef, Vals, Outs, TimeUnit, XYSeries } from './types';
import { normCdf } from './math/normal';

type In = Partial<InputDef> & { label: string; def: any };
export const num = (id: string, o: In): InputDef => ({ kind: 'number', id, ...o });
export const money = (id: string, o: In): InputDef => ({ kind: 'money', unit: '$', min: 0, id, ...o });
export const pct = (id: string, o: In): InputDef => ({ kind: 'percent', unit: '%', min: 0, max: 100, id, ...o });
export const int = (id: string, o: In): InputDef => ({ kind: 'int', step: 1, id, ...o });
export const sel = (id: string, label: string, options: [string, string][], def: string, o: Partial<InputDef> = {}): InputDef =>
  ({ kind: 'select', id, label, def, options: options.map(([value, l]) => ({ value, label: l })), ...o });
export const series = (id: string, o: In): InputDef => ({ kind: 'series', id, ...o });
export const table = (id: string, label: string, columns: ColumnDef[], def: any[], o: Partial<InputDef> = {}): InputDef =>
  ({ kind: 'table', id, label, columns, def, ...o });
export const col = (id: string, label: string, kind: 'text' | 'number' = 'number', def?: any): ColumnDef => ({ id, label, kind, def: def ?? (kind === 'number' ? 0 : '') });

export const rate = (unit: TimeUnit) => ({ role: 'rate' as const, unit });
export const dur = (unit: TimeUnit) => ({ role: 'dur' as const, unit });
export const sdT = (unit: TimeUnit) => ({ role: 'sd' as const, unit });

export const out = (id: string, label: string, o: Partial<OutputDef> = {}): OutputDef => ({ id, label, fmt: 'num', ...o });

/** z-lookup convention input shared by the service-level calculators. */
export const zModeInput = (): InputDef => sel('zMode', 'z-value source', [['exact', 'Exact (Excel NORM.S.INV)'], ['table', 'Printed table, nearest 2 decimals'], ['roundup', 'Printed table, round-up rule (Cachon)']], 'exact',
  { adv: true, help: 'Printed z-tables only go to two decimals, so a table answer can differ slightly from Excel. Cachon & Terwiesch always round up to the next table entry.' });

/** Shared holding-cost inputs: either $/unit/period or % of unit cost. */
export const holdingInputs = (unit: TimeUnit = 'year', defH = 0.5): InputDef[] => [
  sel('hMode', 'Holding cost given as', [['amount', '$ per unit per period'], ['percent', '% of unit cost']], 'amount', { blabel: 'How do you know your holding cost?', help: 'Textbooks give holding cost either as dollars per unit per year (H) or as a percentage of the unit cost (H = I × P).' }),
  money('H', { sym: 'H', label: 'Holding cost per unit', blabel: 'Cost to hold one unit', def: defH, time: rate(unit), rand: [0.5, 20, 0.5], min: 0.0001, show: (v) => v.hMode !== 'percent', sens: true, cues: ['holding cost', 'carrying cost', 'cost to hold', 'storage cost'], help: 'Cost of keeping one unit in stock for one period: capital, storage, insurance, spoilage.' }),
  pct('I', { sym: 'I', label: 'Holding rate (% of unit cost)', blabel: 'Holding cost as % of item cost', def: 20, time: rate(unit), rand: [10, 35, 1], min: 0.0001, max: 1000, show: (v) => v.hMode === 'percent', cues: ['percent of unit cost', '% of the cost', 'carrying rate', 'holding rate', 'of the item value', 'of unit cost'], help: 'Annual holding cost as a percentage of what the item costs you. 20 to 30% is typical.' }),
  money('C', { sym: 'C', label: 'Unit cost', blabel: 'What one unit costs you', def: 2.5, rand: [2, 200, 1], min: 0.0001, show: (v) => v.hMode === 'percent', cues: ['unit cost', 'cost per unit', 'purchase price', 'price per unit', 'costs'], help: 'Purchase or production cost of one unit.' }),
];
/** Resolve H from the shared holding inputs. */
export const getH = (v: Vals): number => (v.hMode === 'percent' ? (v.I / 100) * v.C : v.H);

export function pts(fn: (x: number) => number, x0: number, x1: number, n = 80): [number, number][] {
  const a: [number, number][] = [];
  for (let i = 0; i <= n; i++) { const x = x0 + ((x1 - x0) * i) / n; const y = fn(x); if (Number.isFinite(y)) a.push([x, y]); }
  return a;
}

/** Standard normal-curve visual with a shaded region, in real units. */
export function normalViz(mu: number, sigma: number, cut: number, opts: { xlabel: string; cutLabel: string; shadeLabel: string; side?: 'left' | 'right'; extra?: { x: number; label: string }[] }) {
  const s = sigma > 0 ? sigma : Math.max(1, Math.abs(mu) * 0.01);
  const lo = Math.min(mu - 4 * s, cut - 0.5 * s), hi = Math.max(mu + 4 * s, cut + 0.5 * s);
  const curve: XYSeries = { name: 'Probability', style: 'line', tone: 'accent', pts: pts((x) => Math.exp(-0.5 * ((x - mu) / s) ** 2) / (s * 2.5066282746310002), lo, hi, 120) };
  return {
    kind: 'xy' as const, x: { label: opts.xlabel }, y: { label: 'Likelihood', zero: true }, series: [curve],
    shade: [{ x0: opts.side === 'right' ? cut : lo, x1: opts.side === 'right' ? hi : cut, series: 0, tone: 'accent' as const, label: opts.shadeLabel }],
    vlines: [{ x: mu, label: 'Mean', tone: 'muted' as const }, { x: cut, label: opts.cutLabel, tone: 'accent' as const }, ...(opts.extra ?? []).map((e) => ({ ...e, tone: 'warn' as const }))],
  };
}

/** Row and column of a printed z-table for a given z (for "table lookup shown"). */
export function zLookupText(z: number, p?: number): string {
  if (!Number.isFinite(z)) return 'A 100% service level has no finite z-value: the normal curve never reaches exactly 100%.';
  const a = Math.abs(z); const row = Math.floor(a * 10 + 1e-9) / 10; const colv = Math.round((a - row) * 100) / 100;
  const area = normCdf(Math.round(z * 100) / 100);
  return `Standard normal table: row ${z < 0 ? '-' : ''}${row.toFixed(1)}, column ${colv.toFixed(2)} gives area ${area.toFixed(4)}${p !== undefined ? ` (closest to the target ${p.toFixed(4)})` : ''}. z = ${z.toFixed(2)} to table precision; exact z = ${z.toFixed(4)}.`;
}

export const calc = (d: CalcDef): CalcDef => d;
export type { Vals, Outs };

export const fr = (a: string | number, b: string | number) => `\\frac{${a}}{${b}}`;
export const sq = (x: string | number) => `\\sqrt{${x}}`;
export const tx = (s: string) => `\\text{${s}}`;

/** Inventory sawtooth. demand rate d per time unit, order size Q, optional safety stock, reorder point and lead time. */
export function sawtooth(o: { Q: number; d: number; ss?: number; rop?: number; L?: number; unit: string; cycles?: number; ramp?: { p: number }; back?: number }) {
  const ss = o.ss ?? 0; const cycles = o.cycles ?? 3;
  const T = o.d > 0 ? o.Q / o.d : 1;
  const line: [number, number][] = [];
  const marks: { x: number; y: number; label: string; tone?: any }[] = [];
  const back = o.back ?? 0;
  for (let c = 0; c < cycles; c++) {
    const t0 = c * T;
    if (o.ramp && o.ramp.p > o.d) {
      const tp = o.Q / o.ramp.p; const peak = o.Q * (1 - o.d / o.ramp.p);
      line.push([t0, ss], [t0 + tp, ss + peak], [t0 + T, ss]);
    } else {
      line.push([t0, ss + o.Q - back], [t0 + T, ss - back]);
    }
    if (o.rop !== undefined && o.L !== undefined && o.L <= T && !o.ramp) marks.push({ x: t0 + T - o.L, y: o.rop, label: c === 0 ? 'Place order' : '', tone: 'accent' });
  }
  const top = o.ramp ? ss + o.Q * (1 - o.d / o.ramp.p) : ss + o.Q - back;
  return {
    kind: 'xy' as const, x: { label: `Time (${o.unit}s)` }, y: { label: 'Units on hand', zero: true },
    series: [{ name: 'Inventory', style: 'area' as const, tone: 'accent' as const, pts: line }],
    hlines: [
      ...(o.rop !== undefined ? [{ y: o.rop, label: 'Reorder point', tone: 'warn' as const }] : []),
      ...(ss > 0 ? [{ y: ss, label: 'Safety stock', tone: 'good' as const }] : []),
      ...(back > 0 ? [{ y: 0, label: 'Stockout line', tone: 'bad' as const }] : []),
    ],
    bands: ss > 0 ? [{ y0: 0, y1: ss, label: 'Safety stock', tone: 'good' as const }] : [],
    marks: [...marks, { x: 0, y: top, label: 'Order arrives', tone: 'muted' as const }],
  };
}

/** Holding / ordering / total cost curves against order quantity. */
export function costCurves(D: number, S: number, H: number, Qstar: number, mark?: { Q: number; label: string }) {
  const lo = Math.max(1, Qstar * 0.2), hi = Math.max(Qstar * 2.6, (mark?.Q ?? 0) * 1.2);
  const hold = pts((q) => (q / 2) * H, lo, hi, 60), order = pts((q) => (D / q) * S, lo, hi, 60), tot = pts((q) => (q / 2) * H + (D / q) * S, lo, hi, 60);
  return {
    kind: 'xy' as const, x: { label: 'Order quantity (units)' }, y: { label: 'Annual cost ($)', zero: true },
    series: [
      { name: 'Total cost', style: 'line' as const, tone: 'accent' as const, pts: tot },
      { name: 'Holding cost', style: 'dash' as const, tone: 'alt' as const, pts: hold },
      { name: 'Ordering cost', style: 'dash' as const, tone: 'alt2' as const, pts: order },
    ],
    vlines: [{ x: Qstar, label: 'EOQ', tone: 'accent' as const }, ...(mark ? [{ x: mark.Q, label: mark.label, tone: 'warn' as const }] : [])],
    marks: [{ x: Qstar, y: (Qstar / 2) * H + (D / Qstar) * S, label: 'Lowest cost', tone: 'accent' as const }],
  };
}
