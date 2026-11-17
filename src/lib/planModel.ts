// Spreadsheet model for the Plan Builder export. Pure data (no Excel library) so it can be tested:
// every calculated cell is a formula with its expected value attached.
import { METHOD_NAME, type PlanResult, type SkuPlan } from '@lotwise/engine';

export type Cell = string | number | null | { f: string; v: number | string };
export interface SheetModel { name: string; rows: Cell[][]; widths: number[]; freeze?: [number, number]; headerRows?: number[]; formats?: Record<number, string> }
const colName = (i: number): string => { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
const q = (sheet: string) => (/[^A-Za-z0-9_]/.test(sheet) ? `'${sheet}'` : sheet);
const F = (f: string, v: number | string): Cell => ({ f, v });
const BLOCK = 7; // columns per SKU on the Forecast sheet: Actual, Level, Trend, Forecast, Error, Abs % error, spacer

export function planWorkbook(p: PlanResult): SheetModel[] {
  const n = p.weekStarts.length; const o = p.options; const S = 'Settings';
  const settings: SheetModel = { name: S, widths: [44, 14, 60], rows: [
    ['Lotwise Plan Builder settings', null, 'Change a value in column B and every sheet recalculates.'],
    ['Holding cost rate (per year, share of unit cost)', o.holdingRate / 100, 'Typical range 0.20 to 0.30'],
    ['Service level, A items', o.serviceA / 100, 'Probability of no stockout in a replenishment cycle'], ['Service level, B items', o.serviceB / 100, null], ['Service level, C items', o.serviceC / 100, null],
    ['A class covers the first (share of annual $ volume)', o.cutA / 100, 'The item that crosses the cutoff is placed in the higher class'], ['A + B classes cover the first', o.cutB / 100, null], ['Weeks per year', 52, null],
  ], headerRows: [0], formats: { 1: '0%' } };
  const history: SheetModel = { name: 'Sales history', widths: [14, ...p.skus.map(() => 16)], freeze: [1, 1], headerRows: [0], rows: [['Week starting', ...p.skus.map((s) => s.sku)], ...p.weekStarts.map((w, t) => [w, ...p.skus.map((s) => s.weekly[t])])] };

  // Forecast sheet: one block per SKU, formulas that mirror the fitted method.
  const fRows: Cell[][] = Array.from({ length: 6 + n }, () => new Array(1 + p.skus.length * BLOCK).fill(null));
  fRows[0][0] = 'SKU'; fRows[1][0] = 'Method'; fRows[2][0] = 'Smoothing constants'; fRows[3][0] = 'Week starting'; p.weekStarts.forEach((w, t) => (fRows[4 + t][0] = w)); fRows[4 + n][0] = 'Next week';
  const loc: { next: string; err: string; ape: string }[] = [];
  p.skus.forEach((s, k) => {
    const c0 = 1 + k * BLOCK; const [A, L, T, Fc, E, P] = [0, 1, 2, 3, 4, 5].map((d) => colName(c0 + d)); const r = (t: number) => 5 + t; // spreadsheet row of week t (1-based)
    const start = offsetOf(s); const m = n - start;
    fRows[0][c0] = s.sku; fRows[1][c0] = METHOD_NAME[s.method]; fRows[2][c0] = 'alpha'; fRows[2][c0 + 1] = s.alpha; fRows[2][c0 + 2] = 'beta'; fRows[2][c0 + 3] = s.beta;
    ['Actual', 'Level', 'Trend', 'Forecast', 'Error', 'Abs % error'].forEach((h, d) => (fRows[3][c0 + d] = h));
    const alpha = `$${colName(c0 + 1)}$3`, beta = `$${colName(c0 + 3)}$3`; const first4 = `${A}${r(start)}:${A}${r(start + Math.min(4, m) - 1)}`, last4 = `${A}${r(n - 4)}:${A}${r(n - 1)}`;
    for (let t = 0; t < n; t++) {
      fRows[4 + t][c0] = F(`${q('Sales history')}!${colName(1 + k)}${t + 2}`, s.weekly[t]); if (t < start) continue; const fit = s.fitted[t];
      if (s.method === 'ses') fRows[4 + t][c0 + 3] = t === start ? F(`AVERAGE(${first4})`, fit) : F(`${Fc}${r(t - 1)}+${alpha}*(${A}${r(t - 1)}-${Fc}${r(t - 1)})`, fit);
      else if (s.method === 'sma4' || s.method === 'sma8') { const w = s.method === 'sma4' ? 4 : 8; if (t - start >= w) fRows[4 + t][c0 + 3] = F(`AVERAGE(${A}${r(t - w)}:${A}${r(t - 1)})`, fit); }
      else { const lv = holtState(s, start); fRows[4 + t][c0 + 1] = t === start ? F(`AVERAGE(${first4})-${T}${r(t)}`, lv.level[0]) : F(`${alpha}*${A}${r(t - 1)}+(1-${alpha})*(${L}${r(t - 1)}+${T}${r(t - 1)})`, lv.level[t - start]); fRows[4 + t][c0 + 2] = t === start ? F(`(AVERAGE(${last4})-AVERAGE(${first4}))/MAX(1,${m}-4)`, lv.trend[0]) : F(`${beta}*(${L}${r(t)}-${L}${r(t - 1)})+(1-${beta})*${T}${r(t - 1)}`, lv.trend[t - start]); fRows[4 + t][c0 + 3] = F(`${L}${r(t)}+${T}${r(t)}`, fit); }
      if (t >= s.evalStart && Number.isFinite(fit)) { fRows[4 + t][c0 + 4] = F(`${A}${r(t)}-${Fc}${r(t)}`, s.weekly[t] - fit); fRows[4 + t][c0 + 5] = F(`IF(${A}${r(t)}>0,ABS(${E}${r(t)})/${A}${r(t)},"")`, s.weekly[t] > 0 ? Math.abs(s.weekly[t] - fit) / s.weekly[t] : ''); }
    }
    const nr = r(n); // "next week" row
    if (s.method === 'ses') fRows[4 + n][c0 + 3] = F(`MAX(0,${Fc}${r(n - 1)}+${alpha}*(${A}${r(n - 1)}-${Fc}${r(n - 1)}))`, s.forecast);
    else if (s.method === 'sma4' || s.method === 'sma8') { const w = s.method === 'sma4' ? 4 : 8; fRows[4 + n][c0 + 3] = F(`MAX(0,AVERAGE(${A}${r(n - w)}:${A}${r(n - 1)}))`, s.forecast); }
    else { const lv = holtState(s, start); fRows[4 + n][c0 + 1] = F(`${alpha}*${A}${r(n - 1)}+(1-${alpha})*(${L}${r(n - 1)}+${T}${r(n - 1)})`, lv.level[m]); fRows[4 + n][c0 + 2] = F(`${beta}*(${L}${nr}-${L}${r(n - 1)})+(1-${beta})*${T}${r(n - 1)}`, lv.trend[m]); fRows[4 + n][c0 + 3] = F(`MAX(0,${L}${nr}+${T}${nr})`, s.forecast); }
    loc.push({ next: `${q('Forecast')}!${Fc}${nr}`, err: `${q('Forecast')}!${E}${r(s.evalStart)}:${E}${r(n - 1)}`, ape: `${q('Forecast')}!${P}${r(s.evalStart)}:${P}${r(n - 1)}` });
  });
  const forecast: SheetModel = { name: 'Forecast', widths: [14, ...p.skus.flatMap(() => [11, 11, 11, 11, 11, 12, 3])], freeze: [4, 1], headerRows: [0, 3], rows: fRows };

  // Policy sheet: every number is a formula.
  const head = ['SKU', 'Forecast method', 'Weekly forecast', 'Forecast error (std dev)', 'MAPE', 'Unit cost', 'Order cost', 'Lead time (days)', 'Annual demand', 'Annual $ volume', 'Share ranked above', 'ABC class', 'Service level', 'z', 'Holding cost per unit per year', 'Order quantity (EOQ)', 'Safety stock', 'Reorder point', 'Average inventory', 'Orders per year', 'Annual ordering + holding cost', 'Average inventory value', 'On hand', 'Excess units', 'Excess value', 'Status'];
  const r0 = 2, r1 = p.skus.length + 1; const rng = (c: string) => `$${c}$${r0}:$${c}$${r1}`; const set = (row: number) => `${S}!$B$${row}`; let cumBefore = 0;
  const pRows: Cell[][] = [head, ...p.skus.map((s, i) => {
    const R = i + 2; const before = p.summary.totalVolume > 0 ? cumBefore / p.summary.totalVolume : 0; cumBefore += s.annualVolume; const has = s.onHand !== null;
    return [s.sku, METHOD_NAME[s.method], F(loc[i].next, s.forecast), F(`IFERROR(SQRT(SUMSQ(${loc[i].err})/COUNT(${loc[i].err})),0)`, s.sigma), F(`IFERROR(AVERAGE(${loc[i].ape}),0)`, s.mape / 100), s.unitCost, s.orderCost, s.leadDays,
      F(`C${R}*${set(8)}`, s.annualDemand), F(`I${R}*F${R}`, s.annualVolume), F(`IF(SUM(${rng('J')})>0,SUMIF(${rng('J')},">"&J${R})/SUM(${rng('J')}),0)`, before), F(`IF(K${R}<${set(6)},"A",IF(K${R}<${set(7)},"B","C"))`, s.abc),
      F(`IF(L${R}="A",${set(3)},IF(L${R}="B",${set(4)},${set(5)}))`, s.service / 100), F(`NORM.S.INV(M${R})`, s.z), F(`${set(2)}*F${R}`, s.holdingCost), F(`IF(AND(I${R}>0,O${R}>0),MAX(1,ROUND(SQRT(2*I${R}*G${R}/O${R}),0)),0)`, s.eoq),
      F(`ROUNDUP(N${R}*D${R}*SQRT(H${R}/7)-0.000000001,0)`, s.safetyStock), F(`ROUNDUP(C${R}*H${R}/7+Q${R}-0.000000001,0)`, s.rop), F(`P${R}/2+Q${R}`, s.avgInventory), F(`IF(P${R}>0,I${R}/P${R},0)`, s.ordersPerYear), F(`T${R}*G${R}+S${R}*O${R}`, s.annualCost), F(`S${R}*F${R}`, s.inventoryValue),
      has ? s.onHand : null, has ? F(`MAX(0,W${R}-(R${R}+P${R}))`, s.excessUnits) : null, has ? F(`X${R}*F${R}`, s.excessValue) : null, has ? F(`IF(W${R}<=R${R},"Reorder now",IF(X${R}>0,"Overstocked","Healthy"))`, s.status) : 'No stock data'] as Cell[];
  })];
  const tr = r1 + 2; const sm = p.summary;
  pRows.push([], ['Total', null, null, null, null, null, null, null, F(`SUM(I${r0}:I${r1})`, p.skus.reduce((a, s) => a + s.annualDemand, 0)), F(`SUM(J${r0}:J${r1})`, sm.totalVolume), null, null, null, null, null, null, null, null, null, null, F(`SUM(U${r0}:U${r1})`, sm.annualCost), F(`SUM(V${r0}:V${r1})`, sm.inventoryValue), null, null, F(`SUM(Y${r0}:Y${r1})`, sm.excessValue), null]);
  const policy: SheetModel = { name: 'Policy', widths: [30, 30, 12, 12, 9, 10, 10, 10, 12, 14, 10, 8, 9, 8, 12, 12, 10, 10, 11, 10, 14, 14, 10, 10, 12, 16], freeze: [1, 1], headerRows: [0, tr - 1], rows: pRows };
  const P = q('Policy'); const pr = (c: string) => `${P}!${c}${r0}:${c}${r1}`;
  const summary: SheetModel = { name: 'Summary', widths: [46, 18, 70], headerRows: [0], rows: [
    ['Lotwise inventory plan', null, 'Every number on this sheet and the Policy sheet is a live formula.'], ['History analysed', `${p.report.start} to ${p.report.end}`, `${p.report.weeks} weekly buckets, ${p.report.rowsKept} sales rows`], [],
    ['Products planned', F(`COUNTA(${pr('A')})`, sm.skus), null], ['Annual sales value at cost', F(`SUM(${pr('J')})`, sm.totalVolume), 'Forecast weekly demand x 52 x unit cost'], ['Recommended average inventory value', F(`SUM(${pr('V')})`, sm.inventoryValue), 'Half an order plus safety stock, at cost'],
    ['Safety stock value', F(`SUMPRODUCT(${pr('Q')},${pr('F')})`, sm.safetyStockValue), null], ['Annual ordering + holding cost', F(`SUM(${pr('U')})`, sm.annualCost), null], ['Excess stock value', F(`SUM(${pr('Y')})`, sm.excessValue), 'On hand above reorder point plus one order quantity'],
    ['Products to reorder now', F(`COUNTIF(${pr('Z')},"Reorder now")`, sm.reorderNow.length), null], ['A items', F(`COUNTIF(${pr('L')},"A")`, sm.classCount.A), null], ['B items', F(`COUNTIF(${pr('L')},"B")`, sm.classCount.B), null], ['C items', F(`COUNTIF(${pr('L')},"C")`, sm.classCount.C), null], [],
    ['Generated by Lotwise. Decision support for planning, not professional advice.', null, null],
  ] };
  return [summary, policy, forecast, history, settings];
}
function offsetOf(s: SkuPlan): number { const i = s.fitted.findIndex((x) => Number.isFinite(x)); const w = s.method === 'sma4' ? 4 : s.method === 'sma8' ? 8 : 0; return Math.max(0, (i < 0 ? 0 : i) - w); }
/** Recompute the Holt level and trend series for a SKU so each formula cell carries its expected value. */
function holtState(s: SkuPlan, start: number) {
  const a = s.weekly.slice(start); const n = a.length; const mean = (x: number[]) => x.reduce((p2, c) => p2 + c, 0) / x.length;
  const f1 = mean(a.slice(0, Math.min(4, n))); const t1 = (mean(a.slice(-4)) - f1) / Math.max(1, n - 4); const level = [f1 - t1], trend = [t1];
  for (let i = 1; i <= n; i++) { const Fv = s.alpha * a[i - 1] + (1 - s.alpha) * (level[i - 1] + trend[i - 1]); trend.push(s.beta * (Fv - level[i - 1]) + (1 - s.beta) * trend[i - 1]); level.push(Fv); }
  return { level, trend };
}
