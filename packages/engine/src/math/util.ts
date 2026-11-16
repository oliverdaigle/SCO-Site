export const sum = (a: number[]) => { let s = 0; for (const x of a) s += x; return s; };
export const mean = (a: number[]) => (a.length ? sum(a) / a.length : NaN);
/** Sample standard deviation (n - 1). */
export const stdev = (a: number[]) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  let s = 0; for (const x of a) s += (x - m) * (x - m);
  return Math.sqrt(s / (a.length - 1));
};
/** Population standard deviation (n). */
export const pstdev = (a: number[]) => {
  if (!a.length) return 0;
  const m = mean(a);
  let s = 0; for (const x of a) s += (x - m) * (x - m);
  return Math.sqrt(s / a.length);
};
export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
export const round = (x: number, dp = 0) => { const k = 10 ** dp; return Math.round((x + Number.EPSILON * Math.sign(x)) * k) / k; };
export const range = (n: number, start = 0) => Array.from({ length: n }, (_, i) => i + start);
export const cumsum = (a: number[]) => { let s = 0; return a.map((x) => (s += x)); };
export const max = (a: number[]) => a.reduce((m, x) => (x > m ? x : m), -Infinity);
export const min = (a: number[]) => a.reduce((m, x) => (x < m ? x : m), Infinity);
export const argmax = (a: number[]) => a.reduce((bi, x, i) => (x > a[bi] ? i : bi), 0);
export const argmin = (a: number[]) => a.reduce((bi, x, i) => (x < a[bi] ? i : bi), 0);
export const factorial = (n: number) => { let f = 1; for (let i = 2; i <= n; i++) f *= i; return f; };
export const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
export const toNums = (a: unknown): number[] => (Array.isArray(a) ? a.map(Number).filter((x) => Number.isFinite(x)) : []);

/** Small seeded PRNG (mulberry32) so practice problems and cross-check inputs are reproducible. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export type Rng = () => number;
export const pick = <T,>(r: Rng, a: T[]): T => a[Math.floor(r() * a.length)];
export const randStep = (r: Rng, lo: number, hi: number, step = 1) => {
  const n = Math.floor((hi - lo) / step + 1e-9);
  const k = Math.floor(r() * (n + 1));
  return round(lo + k * step, 6);
};
