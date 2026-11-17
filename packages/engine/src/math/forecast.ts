// Forecasting methods as pure functions. `fc[i]` is the forecast for period i (0-based); NaN where no forecast exists.
import { mean, sum } from './util';

export interface Fit { fc: number[]; next: number; start: number }

export function sma(a: number[], n: number): Fit {
  const fc = a.map((_, i) => (i >= n ? mean(a.slice(i - n, i)) : NaN));
  return { fc, next: mean(a.slice(a.length - n)), start: n };
}

/** Weighted moving average. `w[0]` applies to the most recent period. */
export function wma(a: number[], w: number[]): Fit {
  const n = w.length, sw = sum(w);
  const at = (i: number) => { let s = 0; for (let k = 0; k < n; k++) s += w[k] * a[i - 1 - k]; return s / sw; };
  const fc = a.map((_, i) => (i >= n ? at(i) : NaN));
  return { fc, next: at(a.length), start: n };
}

/** Simple exponential smoothing: F(t+1) = F(t) + alpha (A(t) - F(t)). */
export function ses(a: number[], alpha: number, f1: number): Fit {
  const fc: number[] = [f1];
  for (let i = 1; i <= a.length; i++) fc.push(fc[i - 1] + alpha * (a[i - 1] - fc[i - 1]));
  const next = fc.pop()!;
  return { fc, next, start: 0 };
}

export interface HoltFit extends Fit { level: number[]; trend: number[] }
/** Trend-adjusted exponential smoothing (Holt). level[i] and trend[i] are the smoothed forecast and trend for period i; FIT = level + trend. */
export function holt(a: number[], alpha: number, beta: number, f1: number, t1: number, ahead = 1): HoltFit {
  const level = [f1], trend = [t1], fc = [f1 + t1];
  for (let i = 1; i <= a.length; i++) {
    const F = alpha * a[i - 1] + (1 - alpha) * (level[i - 1] + trend[i - 1]);
    const T = beta * (F - level[i - 1]) + (1 - beta) * trend[i - 1];
    level.push(F); trend.push(T); fc.push(F + T);
  }
  const n = a.length; const next = level[n] + ahead * trend[n];
  fc.pop();
  return { fc, next, start: 0, level, trend };
}

export interface HWFit extends Fit { level: number[]; trend: number[]; season: number[]; ahead: number[] }
/** Holt-Winters multiplicative. Initialised from the first two seasons: L = mean(season 1), T = (mean(season 2) - mean(season 1)) / m, S = A / L over season 1. */
export function holtWinters(a: number[], m: number, alpha: number, beta: number, gamma: number, horizon = m): HWFit {
  const n = a.length;
  const L0 = mean(a.slice(0, m)); const T0 = (mean(a.slice(m, 2 * m)) - L0) / m;
  const level: number[] = new Array(n).fill(NaN), trend: number[] = new Array(n).fill(NaN), season: number[] = new Array(n).fill(NaN), fc: number[] = new Array(n).fill(NaN);
  for (let i = 0; i < m; i++) season[i] = a[i] / L0;
  level[m - 1] = L0; trend[m - 1] = T0;
  for (let t = m; t < n; t++) {
    fc[t] = (level[t - 1] + trend[t - 1]) * season[t - m];
    level[t] = alpha * (a[t] / season[t - m]) + (1 - alpha) * (level[t - 1] + trend[t - 1]);
    trend[t] = beta * (level[t] - level[t - 1]) + (1 - beta) * trend[t - 1];
    season[t] = gamma * (a[t] / level[t]) + (1 - gamma) * season[t - m];
  }
  const ahead: number[] = [];
  for (let h = 1; h <= horizon; h++) ahead.push((level[n - 1] + h * trend[n - 1]) * season[n - m + ((h - 1) % m)]);
  return { fc, next: ahead[0], start: m, level, trend, season, ahead };
}

export interface Reg { a: number; b: number; r: number; r2: number; syx: number }
export function linreg(x: number[], y: number[]): Reg {
  const n = x.length, mx = mean(x), my = mean(y);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
  const b = sxy / sxx, a = my - b * mx;
  const r = syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0;
  let sse = 0; for (let i = 0; i < n; i++) sse += (y[i] - (a + b * x[i])) ** 2;
  return { a, b, r, r2: r * r, syx: n > 2 ? Math.sqrt(sse / (n - 2)) : 0 };
}

export interface Errs { n: number; mad: number; mse: number; mape: number; bias: number; rsfe: number; ts: number; e: number[]; runTs: number[] }
/** Forecast accuracy over periods where a forecast exists. sign 'AF': error = actual - forecast; 'FA': forecast - actual. */
export function errors(a: number[], fc: number[], start = 0, sign: 'AF' | 'FA' = 'AF'): Errs {
  const e: number[] = []; const runTs: number[] = [];
  let sa = 0, ss = 0, sp = 0, np = 0, rs = 0;
  for (let i = start; i < a.length; i++) {
    if (!Number.isFinite(fc[i])) continue;
    const d = sign === 'AF' ? a[i] - fc[i] : fc[i] - a[i];
    e.push(d); sa += Math.abs(d); ss += d * d; rs += d;
    if (a[i] !== 0) { sp += Math.abs(d / a[i]); np++; }
    const madSoFar = sa / e.length; runTs.push(madSoFar > 0 ? rs / madSoFar : 0);
  }
  const n = e.length; const mad = n ? sa / n : NaN;
  return { n, mad, mse: n ? ss / n : NaN, mape: np ? (sp / np) * 100 : NaN, bias: n ? rs / n : NaN, rsfe: rs, ts: mad > 0 ? rs / mad : 0, e, runTs };
}

/** Grid search for the smoothing constant (0.01 to 0.99) minimising MAD or MSE. Ties keep the smaller alpha. */
export function optimizeAlpha(a: number[], f1: number, start: number, crit: 'mad' | 'mse'): { alpha: number; value: number } {
  let best = { alpha: 0.01, value: Infinity };
  for (let k = 1; k <= 99; k++) {
    const alpha = k / 100; const er = errors(a, ses(a, alpha, f1).fc, start); const val = crit === 'mad' ? er.mad : er.mse;
    if (val < best.value - 1e-12) best = { alpha, value: val };
  }
  return best;
}
