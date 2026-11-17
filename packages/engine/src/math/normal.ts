// Standard normal distribution: pdf, cdf, inverse cdf, and the unit normal loss function.
// cdf uses the Hart (1968) rational approximation in double precision (as popularised by G. West, 2005).
// inverse uses Acklam's algorithm plus one Halley refinement step (absolute error ~1e-15).

const SQRT2PI = 2.5066282746310002;

export function normPdf(z: number): number {
  return Math.exp(-0.5 * z * z) / SQRT2PI;
}

export function normCdf(x: number): number {
  if (Number.isNaN(x)) return NaN;
  const ax = Math.abs(x);
  let c: number;
  if (ax > 37) {
    c = 0;
  } else {
    const e = Math.exp((-ax * ax) / 2);
    if (ax < 7.07106781186547) {
      let b = 3.52624965998911e-2 * ax + 0.700383064443688;
      b = b * ax + 6.37396220353165;
      b = b * ax + 33.912866078383;
      b = b * ax + 112.079291497871;
      b = b * ax + 221.213596169931;
      b = b * ax + 220.206867912376;
      c = e * b;
      b = 8.83883476483184e-2 * ax + 1.75566716318264;
      b = b * ax + 16.064177579207;
      b = b * ax + 86.7807322029461;
      b = b * ax + 296.564248779674;
      b = b * ax + 637.333633378831;
      b = b * ax + 793.826512519948;
      b = b * ax + 440.413735824752;
      c = c / b;
    } else {
      let b = ax + 0.65;
      b = ax + 4 / b;
      b = ax + 3 / b;
      b = ax + 2 / b;
      b = ax + 1 / b;
      c = e / b / SQRT2PI;
    }
  }
  return x > 0 ? 1 - c : c;
}

export function normInv(p: number): number {
  if (Number.isNaN(p) || p < 0 || p > 1) return NaN;
  if (p === 0) return -Infinity;
  if (p === 1) return Infinity;
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  let x: number;
  if (p < pl) {
    const q = Math.sqrt(-2 * Math.log(p));
    x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= 1 - pl) {
    const q = p - 0.5;
    const r = q * q;
    x = ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  // Halley refinement (two passes for the far tails)
  for (let i = 0; i < 2; i++) {
    const e = normCdf(x) - p;
    const u = e * SQRT2PI * Math.exp((x * x) / 2);
    x = x - u / (1 + (x * u) / 2);
  }
  return x;
}

/** Unit normal loss function G(z) = phi(z) - z * (1 - Phi(z)). Expected units short per unit of sigma. */
export function lossG(z: number): number {
  if (z === Infinity) return 0;
  if (z === -Infinity) return Infinity;
  return Math.max(0, normPdf(z) - z * (1 - normCdf(z))); // floor at 0: far in the tail the subtraction can cancel to a tiny negative
}

/** Inverse of the loss function: find z with G(z) = g (G is strictly decreasing). */
export function lossInv(g: number): number {
  if (!(g > 0)) return Infinity;
  if (g > 30) return -g; // far left tail: G(z) = -z to machine precision
  let lo = -40, hi = 40;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (lossG(mid) > g) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

export type ZMode = 'exact' | 'table' | 'roundup';

/** z for a cumulative probability under a lookup convention.
 * exact: NORM.S.INV. table: closest entry of a printed 2-decimal z-table (ties round up). roundup: Cachon & Terwiesch round-up rule. */
export function zFor(p: number, mode: ZMode = 'exact'): number {
  const z = normInv(p);
  if (!Number.isFinite(z)) return z;
  if (mode === 'table') {
    // Closest printed-table entry by area (areas printed to 4 decimals); ties go to the larger z, as textbooks do for 95% -> 1.65.
    if (p < 0.5) return -zFor(1 - p, 'table');
    const zl = Math.floor(z * 100 + 1e-9) / 100, zh = Math.round((zl + 0.01) * 100) / 100;
    const r4 = (x: number) => Math.round(x * 10000) / 10000;
    const dl = Math.abs(r4(normCdf(zl)) - p), dh = Math.abs(r4(normCdf(zh)) - p);
    return dl < dh - 1e-9 ? zl : zh;
  }
  if (mode === 'roundup') return Math.ceil(z * 100 - 1e-9) / 100;
  return z;
}
