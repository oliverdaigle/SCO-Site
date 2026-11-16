import type { Fmt } from './types';

function auto(x: number): number {
  const a = Math.abs(x);
  if (a === 0) return 0;
  if (a >= 10000) return 0;
  if (a >= 100) return 1;
  if (a >= 1) return 2;
  if (a >= 0.01) return 4;
  return 6;
}

export function fmtNum(x: number, dp?: number): string {
  if (x === Infinity) return '∞';
  if (x === -Infinity) return '-∞';
  if (!Number.isFinite(x)) return '—';
  const d = dp ?? auto(x);
  const r = Number(x.toFixed(d));
  const s = (Object.is(r, -0) ? 0 : r).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: 0 });
  return s;
}

export function fmtMoney(x: number, dp?: number): string {
  if (!Number.isFinite(x)) return '—';
  const a = Math.abs(x);
  const d = dp ?? (a >= 10000 || Number.isInteger(Number(a.toFixed(2))) ? 0 : 2);
  const s = a.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
  return (x < 0 ? '-$' : '$') + s;
}

export function fmtPct(x: number, dp?: number): string {
  if (!Number.isFinite(x)) return '—';
  const d = dp ?? (Math.abs(x) >= 99 && Math.abs(x) < 100 ? 2 : 1);
  return fmtNum(x, d) + '%';
}

export const F: Fmt = {
  num: fmtNum,
  int: (x) => fmtNum(Math.round(x), 0),
  money: fmtMoney,
  pct: fmtPct,
  t: (x, dp) => fmtNum(x, dp),
};
