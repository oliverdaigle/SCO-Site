// Supply Chain Plan Builder: sales history CSV in, one inventory policy per SKU out.
import { ses, holt, sma, optimizeAlpha } from './math/forecast';
import { normInv } from './math/normal';
import { mean, stdev } from './math/util';

export interface PlanOptions { holdingRate: number; orderCost: number; leadTimeDays: number; unitCost: number; serviceA: number; serviceB: number; serviceC: number; cutA: number; cutB: number }
export const DEFAULT_OPTIONS: PlanOptions = { holdingRate: 25, orderCost: 50, leadTimeDays: 14, unitCost: 10, serviceA: 98, serviceB: 95, serviceC: 90, cutA: 80, cutB: 95 };
export interface Issue { kind: string; count: number; example?: string }
export interface CleanReport { rowsRead: number; rowsKept: number; rowsDropped: number; issues: Issue[]; skus: number; start: string; end: string; weeks: number; columns: Record<string, string>; hasOnHand: boolean }
export type Method = 'sma4' | 'sma8' | 'ses' | 'holt';
export const METHOD_NAME: Record<Method, string> = { sma4: '4-week moving average', sma8: '8-week moving average', ses: 'Exponential smoothing', holt: 'Trend-adjusted smoothing (Holt)' };
export interface SkuPlan {
  sku: string; weekly: number[]; method: Method; alpha: number; beta: number; fitted: number[]; evalStart: number; forecast: number; mad: number; mape: number; bias: number; sigma: number; cv: number; trendPct: number;
  unitCost: number; orderCost: number; leadDays: number; annualDemand: number; annualVolume: number; abc: 'A' | 'B' | 'C'; service: number; z: number; holdingCost: number;
  eoq: number; safetyStock: number; rop: number; avgInventory: number; ordersPerYear: number; annualCost: number; inventoryValue: number;
  onHand: number | null; excessUnits: number; excessValue: number; daysOfCover: number | null; status: 'Reorder now' | 'Healthy' | 'Overstocked' | 'No stock data'; limitedHistory: boolean;
}
export interface PlanSummary { skus: number; totalVolume: number; top3: string[]; top3Share: number; mape: number; safetyStockValue: number; cycleStockValue: number; inventoryValue: number; excessValue: number; excessSku: string | null; reorderNow: string[]; annualCost: number; classCount: Record<'A' | 'B' | 'C', number>; classShare: Record<'A' | 'B' | 'C', number>; methodCount: Record<Method, number>; fastest: string; fastestWeekly: number; wildest: string; wildestCv: number; steadiest: string; bestForecast: string; bestForecastMape: number; worstForecast: string; worstForecastMape: number; growing: string | null; growingPct: number; onHandValue: number }
export interface PlanResult { ok: true; report: CleanReport; options: PlanOptions; weekStarts: string[]; skus: SkuPlan[]; summary: PlanSummary }
export interface PlanError { ok: false; error: string; report?: Partial<CleanReport> }

/** RFC-4180-style CSV parser (quotes, embedded commas and newlines, tabs or semicolons as alternative delimiters). */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, ''); const first = src.split(/\r?\n/, 1)[0] ?? '';
  const delim = (first.match(/\t/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? '\t' : (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = []; let row: string[] = [], cell = '', q = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) { if (c === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
    if (c === '"') q = true; else if (c === delim) { row.push(cell); cell = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && src[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some((x) => x.trim() !== '')) rows.push(row); row = []; } else cell += c;
  }
  row.push(cell); if (row.some((x) => x.trim() !== '')) rows.push(row);
  return rows.map((r) => r.map((x) => x.trim()));
}

const COLS: Record<string, string[]> = {
  date: ['date', 'day', 'order date', 'orderdate', 'sale date', 'sold on', 'transaction date', 'invoice date', 'week', 'period'],
  sku: ['sku', 'item', 'product', 'product name', 'item name', 'item id', 'product id', 'part', 'part number', 'part no', 'description', 'style'],
  units: ['units', 'qty', 'quantity', 'units sold', 'qty sold', 'quantity sold', 'sold', 'sales', 'demand', 'volume'],
  unitCost: ['unit cost', 'unit_cost', 'cost', 'cogs', 'cost per unit', 'unitcost'],
  leadTime: ['lead time', 'lead_time', 'leadtime', 'lead time days', 'lead_time_days', 'lead days'],
  orderCost: ['order cost', 'order_cost', 'ordering cost', 'setup cost', 'ordercost'],
  onHand: ['on hand', 'on_hand', 'onhand', 'stock', 'inventory', 'qty on hand', 'stock on hand', 'current stock'],
};
const normH = (h: string) => h.toLowerCase().replace(/[_\-.]+/g, ' ').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
const MONTHS: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
/** Parse common date spellings to a UTC day number. Returns NaN when unreadable. */
export function parseDate(s: string): number {
  const t = s.trim(); let m: RegExpMatchArray | null; let y = 0, mo = 0, d = 0;
  if ((m = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/))) { y = +m[1]; mo = +m[2] - 1; d = +m[3]; }
  else if ((m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/))) { mo = +m[1] - 1; d = +m[2]; y = +m[3]; if (y < 100) y += 2000; if (mo > 11 && d <= 12) { const sw = mo + 1; mo = d - 1; d = sw; } }
  else if ((m = t.match(/^(\d{1,2})[-\s]([A-Za-z]{3})[A-Za-z]*[-\s,]+(\d{2,4})$/))) { d = +m[1]; mo = MONTHS[m[2].toLowerCase()] ?? -1; y = +m[3]; if (y < 100) y += 2000; }
  else if ((m = t.match(/^([A-Za-z]{3})[A-Za-z]*\s+(\d{1,2}),?\s+(\d{4})$/))) { mo = MONTHS[m[1].toLowerCase()] ?? -1; d = +m[2]; y = +m[3]; }
  else return NaN;
  if (mo < 0 || mo > 11 || d < 1 || d > 31 || y < 1990 || y > 2100) return NaN;
  const ms = Date.UTC(y, mo, d); const dt = new Date(ms); if (dt.getUTCMonth() !== mo || dt.getUTCDate() !== d) return NaN;
  return Math.floor(ms / 864e5);
}
const dayToIso = (day: number) => new Date(day * 864e5).toISOString().slice(0, 10);
const weekOf = (day: number) => Math.floor((day + 3) / 7); // weeks start on Monday (1970-01-01 was a Thursday)
const weekStartDay = (w: number) => w * 7 - 3;
const toNum = (s: string | undefined) => { if (s === undefined) return NaN; const t = s.replace(/[$,\s]/g, ''); return t === '' ? NaN : Number(t); };

function pickMethod(a: number[]): { method: Method; alpha: number; beta: number; fitted: number[]; start: number; next: number } {
  const n = a.length; const start = Math.min(Math.max(4, Math.floor(n / 3)), Math.max(1, n - 3));
  const madOf = (fc: number[]) => { let s = 0, k = 0; for (let i = start; i < n; i++) if (Number.isFinite(fc[i])) { s += Math.abs(a[i] - fc[i]); k++; } return k ? s / k : Infinity; };
  const f1 = mean(a.slice(0, Math.min(4, n))); const cands: { method: Method; alpha: number; beta: number; fitted: number[]; next: number; mad: number }[] = [];
  const al = optimizeAlpha(a, f1, start, 'mad').alpha; const s1 = ses(a, al, f1); cands.push({ method: 'ses', alpha: al, beta: 0, fitted: s1.fc, next: s1.next, mad: madOf(s1.fc) });
  if (n >= 6) { const m4 = sma(a, 4); cands.push({ method: 'sma4', alpha: 0, beta: 0, fitted: m4.fc, next: m4.next, mad: madOf(m4.fc) }); }
  if (n >= 12) { const m8 = sma(a, 8); cands.push({ method: 'sma8', alpha: 0, beta: 0, fitted: m8.fc, next: m8.next, mad: madOf(m8.fc) }); }
  if (n >= 10) { const t1 = (mean(a.slice(-4)) - f1) / Math.max(1, n - 4); let best: (typeof cands)[number] | null = null; for (const A of [0.1, 0.2, 0.3, 0.5]) for (const B of [0.05, 0.1, 0.2, 0.3]) { const h = holt(a, A, B, f1 - t1, t1); const md = madOf(h.fc); if (!best || md < best.mad - 1e-12) best = { method: 'holt', alpha: A, beta: B, fitted: h.fc, next: h.next, mad: md }; } if (best) cands.push(best); }
  // Prefer the simpler method unless a more complex one is at least 2% better.
  let pick = cands[0]; for (const c of cands.slice(1)) if (c.mad < pick.mad * 0.98) pick = c;
  return { method: pick.method, alpha: pick.alpha, beta: pick.beta, fitted: pick.fitted, start, next: Math.max(0, pick.next) };
}

export function buildPlan(csv: string, opts: Partial<PlanOptions> = {}): PlanResult | PlanError {
  const options = { ...DEFAULT_OPTIONS, ...opts }; const grid = parseCsv(csv);
  if (grid.length < 2) return { ok: false, error: 'The file looks empty. It needs a header row and at least one row of sales (date, SKU, units).' };
  const header = grid[0].map(normH); const col: Record<string, number> = {}; const columns: Record<string, string> = {};
  for (const [key, names] of Object.entries(COLS)) { const i = header.findIndex((h) => names.includes(h)); if (i >= 0) { col[key] = i; columns[key] = grid[0][i]; } }
  const missing = ['date', 'sku', 'units'].filter((k) => col[k] === undefined);
  if (missing.length) return { ok: false, error: `Could not find a column for ${missing.map((m) => (m === 'sku' ? 'SKU (item or product name)' : m === 'units' ? 'units sold (quantity)' : 'date')).join(' or ')}. The file has these columns: ${grid[0].join(', ')}. Rename the matching column to ${missing.join(' / ')} and upload again.`, report: { columns } };
  const count: Record<string, { n: number; ex?: string }> = {}; const note = (k: string, ex?: string) => { (count[k] ??= { n: 0, ex }).n++; };
  const today = Math.floor(Date.now() / 864e5) + 1; const per = new Map<string, { w: Map<number, number>; unitCost?: number; lead?: number; order?: number; onHand?: number }>();
  let kept = 0, minDay = Infinity, maxDay = -Infinity;
  for (let r = 1; r < grid.length; r++) {
    const row = grid[r]; const sku = (row[col.sku] ?? '').trim(); const day = parseDate(row[col.date] ?? ''); const units = toNum(row[col.units]);
    if (!sku) { note('Rows with no SKU were skipped', `row ${r + 1}`); continue; }
    if (Number.isNaN(day)) { note('Rows with an unreadable date were skipped', `row ${r + 1}: "${row[col.date] ?? ''}"`); continue; }
    if (day > today) { note('Rows dated in the future were skipped', `row ${r + 1}: ${row[col.date]}`); continue; }
    if (!Number.isFinite(units)) { note('Rows with a missing or non-numeric quantity were skipped', `row ${r + 1}: "${row[col.units] ?? ''}"`); continue; }
    if (units < 0) note('Negative quantities were treated as returns and netted against sales', `row ${r + 1}: ${units}`);
    let e = per.get(sku); if (!e) { e = { w: new Map() }; per.set(sku, e); }
    const wk = weekOf(day); e.w.set(wk, (e.w.get(wk) ?? 0) + units); kept++; minDay = Math.min(minDay, day); maxDay = Math.max(maxDay, day);
    const uc = toNum(row[col.unitCost]); if (uc > 0) e.unitCost = uc; const lt = toNum(row[col.leadTime]); if (lt >= 0) e.lead = lt; const oc = toNum(row[col.orderCost]); if (oc > 0) e.order = oc; const oh = toNum(row[col.onHand]); if (oh >= 0) e.onHand = oh;
  }
  if (!kept) return { ok: false, error: 'No usable rows were found. Check that dates look like 2026-03-14 or 3/14/2026 and that quantities are numbers.', report: { columns } };
  // Weekly buckets; drop partial first and last weeks when there is plenty of history.
  let w0 = weekOf(minDay), w1 = weekOf(maxDay);
  if (w1 - w0 + 1 >= 12) { if (minDay !== weekStartDay(w0)) { w0++; note('The partial first week was left out so weeks compare fairly'); } if (maxDay !== weekStartDay(w1) + 6) { w1--; note('The partial last week was left out so weeks compare fairly'); } }
  const nW = w1 - w0 + 1;
  if (nW < 4) return { ok: false, error: `Only ${Math.max(nW, 1)} week${nW === 1 ? '' : 's'} of history was found. The Plan Builder needs at least 4 weeks, and 12 or more gives much better forecasts.`, report: { columns } };
  const skus: SkuPlan[] = [];
  for (const [sku, e] of per) {
    const weekly = Array.from({ length: nW }, (_, i) => Math.max(0, e.w.get(w0 + i) ?? 0)); if (weekly.every((x) => x === 0)) { note('SKUs with no sales in the period were left out', sku); continue; }
    const first = weekly.findIndex((x) => x > 0); const a = nW - first >= 6 ? weekly.slice(first) : weekly; // start at launch for items introduced mid-history
    const fit = pickMethod(a); const errs: number[] = []; let absPct = 0, nPct = 0;
    for (let i = fit.start; i < a.length; i++) if (Number.isFinite(fit.fitted[i])) { const er = a[i] - fit.fitted[i]; errs.push(er); if (a[i] > 0) { absPct += Math.abs(er) / a[i]; nPct++; } }
    const mad = errs.length ? mean(errs.map(Math.abs)) : 0; const sigma = errs.length ? Math.sqrt(mean(errs.map((x) => x * x))) : stdev(a);
    const spike = a.some((x) => x > mean(a) + 6 * (stdev(a) || 1)); if (spike) note('Unusually large weeks were kept but are worth checking for typos', sku);
    const unitCost = e.unitCost ?? options.unitCost, orderCost = e.order ?? options.orderCost, leadDays = e.lead ?? options.leadTimeDays; const forecast = fit.next;
    const half = Math.floor(a.length / 2); const early = mean(a.slice(0, half)), late = mean(a.slice(half));
    skus.push({ sku, weekly, method: fit.method, alpha: fit.alpha, beta: fit.beta, fitted: [...new Array(weekly.length - a.length).fill(NaN), ...fit.fitted], evalStart: weekly.length - a.length + fit.start, forecast, mad, mape: nPct ? (absPct / nPct) * 100 : 0, bias: errs.length ? mean(errs) : 0, sigma, cv: mean(a) > 0 ? stdev(a) / mean(a) : 0, trendPct: early > 0 ? ((late - early) / early) * 100 : 0,
      unitCost, orderCost, leadDays, annualDemand: forecast * 52, annualVolume: forecast * 52 * unitCost, abc: 'C', service: 0, z: 0, holdingCost: (options.holdingRate / 100) * unitCost, eoq: 0, safetyStock: 0, rop: 0, avgInventory: 0, ordersPerYear: 0, annualCost: 0, inventoryValue: 0, onHand: e.onHand ?? null, excessUnits: 0, excessValue: 0, daysOfCover: null, status: 'No stock data', limitedHistory: a.length < 8 });
  }
  if (!skus.length) return { ok: false, error: 'Every SKU had zero sales in the period, so there is nothing to plan.', report: { columns } };
  // ABC by annual dollar volume (the item that crosses a cutoff belongs to the higher class).
  skus.sort((x, y) => y.annualVolume - x.annualVolume || x.sku.localeCompare(y.sku)); const totalVolume = skus.reduce((s, x) => s + x.annualVolume, 0); let cum = 0;
  for (const s of skus) {
    const before = totalVolume > 0 ? (cum / totalVolume) * 100 : 0; cum += s.annualVolume; s.abc = before < options.cutA ? 'A' : before < options.cutB ? 'B' : 'C';
    s.service = s.abc === 'A' ? options.serviceA : s.abc === 'B' ? options.serviceB : options.serviceC; s.z = normInv(s.service / 100);
    const D = s.annualDemand, H = s.holdingCost, Lw = s.leadDays / 7;
    s.eoq = D > 0 && H > 0 ? Math.max(1, Math.round(Math.sqrt((2 * D * s.orderCost) / H))) : 0; s.safetyStock = Math.ceil(s.z * s.sigma * Math.sqrt(Lw) - 1e-9); s.rop = Math.ceil(s.forecast * Lw + s.safetyStock - 1e-9);
    s.avgInventory = s.eoq / 2 + s.safetyStock; s.ordersPerYear = s.eoq > 0 ? D / s.eoq : 0; s.annualCost = s.ordersPerYear * s.orderCost + s.avgInventory * H; s.inventoryValue = s.avgInventory * s.unitCost;
    if (s.onHand !== null) { s.excessUnits = Math.max(0, s.onHand - (s.rop + s.eoq)); s.excessValue = s.excessUnits * s.unitCost; s.daysOfCover = s.forecast > 0 ? (s.onHand / s.forecast) * 7 : null; s.status = s.onHand <= s.rop ? 'Reorder now' : s.excessUnits > 0 ? 'Overstocked' : 'Healthy'; }
  }
  const by = <T,>(f: (s: SkuPlan) => T, cmp: (a: T, b: T) => boolean) => skus.reduce((b, s) => (cmp(f(s), f(b)) ? s : b), skus[0]);
  const wm = skus.filter((s) => s.mape > 0); const fastest = by((s) => s.forecast, (a, b) => a > b); const wild = by((s) => s.cv, (a, b) => a > b); const steady = by((s) => s.cv, (a, b) => a < b);
  const bestF = wm.length ? wm.reduce((b, s) => (s.mape < b.mape ? s : b)) : skus[0], worstF = wm.length ? wm.reduce((b, s) => (s.mape > b.mape ? s : b)) : skus[0]; const grow = skus.filter((s) => !s.limitedHistory && s.forecast > 0).reduce<SkuPlan | null>((b, s) => (!b || s.trendPct > b.trendPct ? s : b), null);
  const excess = skus.filter((s) => s.excessValue > 0).sort((a, b) => b.excessValue - a.excessValue); const cls = (k: 'A' | 'B' | 'C') => skus.filter((s) => s.abc === k);
  const summary: PlanSummary = {
    skus: skus.length, totalVolume, top3: skus.slice(0, 3).map((s) => s.sku), top3Share: totalVolume > 0 ? (skus.slice(0, 3).reduce((s, x) => s + x.annualVolume, 0) / totalVolume) * 100 : 0,
    mape: totalVolume > 0 ? skus.reduce((s, x) => s + x.mape * x.annualVolume, 0) / totalVolume : mean(skus.map((s) => s.mape)),
    safetyStockValue: skus.reduce((s, x) => s + x.safetyStock * x.unitCost, 0), cycleStockValue: skus.reduce((s, x) => s + (x.eoq / 2) * x.unitCost, 0), inventoryValue: skus.reduce((s, x) => s + x.inventoryValue, 0),
    excessValue: excess.reduce((s, x) => s + x.excessValue, 0), excessSku: excess[0]?.sku ?? null, reorderNow: skus.filter((s) => s.status === 'Reorder now').map((s) => s.sku), annualCost: skus.reduce((s, x) => s + x.annualCost, 0),
    classCount: { A: cls('A').length, B: cls('B').length, C: cls('C').length }, classShare: { A: totalVolume ? (cls('A').reduce((s, x) => s + x.annualVolume, 0) / totalVolume) * 100 : 0, B: totalVolume ? (cls('B').reduce((s, x) => s + x.annualVolume, 0) / totalVolume) * 100 : 0, C: totalVolume ? (cls('C').reduce((s, x) => s + x.annualVolume, 0) / totalVolume) * 100 : 0 },
    methodCount: { sma4: skus.filter((s) => s.method === 'sma4').length, sma8: skus.filter((s) => s.method === 'sma8').length, ses: skus.filter((s) => s.method === 'ses').length, holt: skus.filter((s) => s.method === 'holt').length },
    fastest: fastest.sku, fastestWeekly: fastest.forecast, wildest: wild.sku, wildestCv: wild.cv, steadiest: steady.sku, bestForecast: bestF.sku, bestForecastMape: bestF.mape, worstForecast: worstF.sku, worstForecastMape: worstF.mape, growing: grow && grow.trendPct > 5 ? grow.sku : null, growingPct: grow?.trendPct ?? 0, onHandValue: skus.reduce((s, x) => s + (x.onHand ?? 0) * x.unitCost, 0),
  };
  const issues = Object.entries(count).map(([kind, v]) => ({ kind, count: v.n, example: v.ex }));
  return { ok: true, options, weekStarts: Array.from({ length: nW }, (_, i) => dayToIso(weekStartDay(w0 + i))), skus, summary,
    report: { rowsRead: grid.length - 1, rowsKept: kept, rowsDropped: grid.length - 1 - kept, issues, skus: skus.length, start: dayToIso(minDay), end: dayToIso(maxDay), weeks: nW, columns, hasOnHand: skus.some((s) => s.onHand !== null) } };
}

export interface WrappedCard { id: string; kicker: string; big: string; line: string; sub: string; tone: 'accent' | 'alt' | 'alt2' | 'warn' | 'good' | 'bad' }
const usd = (x: number) => '$' + (x >= 1e6 ? (x / 1e6).toFixed(1) + 'M' : x >= 10000 ? Math.round(x / 1000) + 'K' : Math.round(x).toLocaleString('en-US'));
/** "Your Supply Chain, Wrapped": bold story cards built only from the user's own numbers. */
export function wrappedCards(p: PlanResult): WrappedCard[] {
  const s = p.summary; const cards: WrappedCard[] = [];
  cards.push({ id: 'intro', kicker: 'Your Supply Chain, Wrapped', big: `${p.report.weeks} weeks`, line: `${s.skus} products. ${p.report.rowsKept.toLocaleString('en-US')} sales records.`, sub: `${p.report.start} to ${p.report.end}. Here is what your numbers say.`, tone: 'accent' });
  cards.push({ id: 'top3', kicker: 'Your heavy hitters', big: `${Math.round(s.top3Share)}%`, line: `of your sales value comes from just ${Math.min(3, s.skus)} products.`, sub: s.top3.join('  ·  '), tone: 'alt' });
  cards.push({ id: 'fastest', kicker: 'Your fastest mover', big: `${Math.round(s.fastestWeekly).toLocaleString('en-US')} a week`, line: `${s.fastest} never sits still.`, sub: `That is about ${Math.round(s.fastestWeekly * 52).toLocaleString('en-US')} a year at the current pace.`, tone: 'good' });
  cards.push({ id: 'forecast', kicker: 'Your crystal ball', big: `${Math.round(s.mape)}% off`, line: 'is how far a good forecast misses your weekly sales, on average.', sub: `Most predictable: ${s.bestForecast} (${Math.round(s.bestForecastMape)}%). Least: ${s.worstForecast} (${Math.round(s.worstForecastMape)}%).`, tone: 'alt2' });
  if (p.report.hasOnHand && s.excessValue > 0) cards.push({ id: 'excess', kicker: 'Cash on the shelf', big: usd(s.excessValue), line: 'is sitting in stock you do not need yet.', sub: s.excessSku ? `The biggest pile: ${s.excessSku}.` : '', tone: 'warn' });
  if (p.report.hasOnHand && s.reorderNow.length > 0) cards.push({ id: 'reorder', kicker: 'On thin ice', big: `${s.reorderNow.length} to reorder`, line: s.reorderNow.length === 1 ? 'One product is at or below its reorder point today.' : 'products are at or below their reorder point today.', sub: s.reorderNow.slice(0, 4).join('  ·  ') + (s.reorderNow.length > 4 ? '  ·  and more' : ''), tone: 'bad' });
  if (s.growing) cards.push({ id: 'growing', kicker: 'Your rising star', big: `+${Math.round(s.growingPct)}%`, line: `${s.growing} sold that much more in the second half of the period.`, sub: 'Its forecast and reorder point already account for the trend.', tone: 'good' });
  cards.push({ id: 'wild', kicker: 'Your wild card', big: s.wildest, line: `Its sales swing ${Math.round(s.wildestCv * 100)}% around the average from week to week.`, sub: `Your steadiest seller is ${s.steadiest}.`, tone: 'alt2' });
  cards.push({ id: 'buffer', kicker: 'Your safety net', big: usd(s.safetyStockValue), line: 'of safety stock keeps your shelves full when demand surprises you.', sub: `A items are protected at ${p.options.serviceA}%, B at ${p.options.serviceB}%, C at ${p.options.serviceC}%.`, tone: 'accent' });
  const persona = s.classCount.A <= Math.max(1, s.skus * 0.2) && s.top3Share > 60 ? ['The Specialist', 'A few stars carry the show. Guard them well.'] : s.mape < 20 ? ['The Steady Hand', 'Predictable demand, calm shelves. Lean in and trim the buffers.'] : s.growingPct > 30 ? ['The Trend Chaser', 'Demand is moving fast. Reorder often and watch the leaders.'] : ['The Juggler', 'Lots of products, lots of variety. Let the policies do the remembering.'];
  cards.push({ id: 'persona', kicker: 'Your inventory personality', big: persona[0], line: persona[1], sub: `${s.classCount.A} A items, ${s.classCount.B} B items, ${s.classCount.C} C items. Policy cost to run: ${usd(s.annualCost)} a year.`, tone: 'alt' });
  return cards;
}
