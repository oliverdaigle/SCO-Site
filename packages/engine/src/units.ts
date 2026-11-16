import type { CalcDef, TimeUnit, Vals } from './types';

export const TIME_UNITS: TimeUnit[] = ['day', 'week', 'month', 'year'];
export const TIME_LABEL: Record<TimeUnit, string> = { day: 'day', week: 'week', month: 'month', year: 'year' };

/** Number of `unit` periods in a year. Weeks: 52, months: 12, days: `dpy` (365 unless the problem states operating days). */
function perYear(u: TimeUnit, dpy: number): number {
  return u === 'day' ? dpy : u === 'week' ? 52 : u === 'month' ? 12 : 1;
}

/** How many `to` periods fit in one `from` period. A week is always exactly 7 days. */
export function periodsRatio(from: TimeUnit, to: TimeUnit, dpy = 365): number {
  if (from === to) return 1;
  if (from === 'week' && to === 'day') return 7;
  if (from === 'day' && to === 'week') return 1 / 7;
  return perYear(to, dpy) / perYear(from, dpy);
}

/** Convert a time-dimensioned value between units.
 * rate: amount per period. dur: a length of time. sd: std dev of a per-period amount (variances add, so it scales with the square root). */
export function convertTime(value: number, role: 'rate' | 'dur' | 'sd', from: TimeUnit, to: TimeUnit, dpy = 365): number {
  if (from === to) return value;
  const k = periodsRatio(from, to, dpy); // number of `to` periods in one `from` period
  if (role === 'dur') return value * k;
  if (role === 'rate') return value / k;
  return value / Math.sqrt(k);
}

export interface Normalized { v: Vals; basis: TimeUnit | null; warnings: string[]; conversions: string[] }

/** Convert every time-dimensioned input to the calculator's basis unit and report mismatches. */
export function normalize(def: CalcDef, raw: Vals): Normalized {
  const v: Vals = { ...raw };
  const timed = def.inputs.filter((i) => i.time && (!i.show || i.show(raw)));
  if (!timed.length || !def.basis) return { v, basis: null, warnings: [], conversions: [] };
  const unitOf = (id: string, d: TimeUnit): TimeUnit => (raw[id + '_u'] as TimeUnit) || d;
  const basis: TimeUnit = typeof def.basis === 'string' ? def.basis : unitOf(def.basis.from, def.inputs.find((i) => i.id === (def.basis as any).from)!.time!.unit);
  const dpy = Number(raw.daysPerYear) > 0 ? Number(raw.daysPerYear) : 365;
  const conversions: string[] = [];
  const units = new Set<TimeUnit>();
  for (const i of timed) {
    const u = unitOf(i.id, i.time!.unit);
    units.add(u);
    if (u !== basis && typeof raw[i.id] === 'number') {
      const nv = convertTime(raw[i.id], i.time!.role, u, basis, dpy);
      v[i.id] = nv;
      const how = i.time!.role === 'sd' ? `standard deviations scale with the square root of time` : i.time!.role === 'dur' ? `a length of time` : `a per-period amount`;
      const word = i.time!.role === 'dur' ? `${u}s to ${basis}s` : `per ${u} to per ${basis}`;
      conversions.push(`${i.label}: ${trim(raw[i.id])} (${i.time!.role === 'dur' ? u + 's' : 'per ' + u}) = ${trim(nv)} (${i.time!.role === 'dur' ? basis + 's' : 'per ' + basis}). Converted ${word} because it is ${how}.`);
    }
    v[i.id + '_u'] = basis;
  }
  const warnings: string[] = [];
  if (units.size > 1) {
    warnings.push(`Unit mismatch: your inputs mix ${[...units].map((u) => u + 's').join(' and ')}. Every time-based input must use the same period before it goes into the formula, so everything was converted to ${basis}s.`);
  }
  v._basis = basis;
  return { v, basis, warnings, conversions };
}

function trim(x: number): string {
  return Number(x.toPrecision(6)).toLocaleString('en-US', { maximumFractionDigits: 4 });
}
