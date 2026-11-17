import { factorial } from './util';

export interface QueueStats { rho: number; P0: number; Lq: number; Ls: number; Wq: number; Ws: number; Pw: number }

/** M/M/s (s = 1 gives M/M/1). Uses a numerically stable Erlang-C recursion. */
export function mms(lambda: number, mu: number, s: number): QueueStats {
  const r = lambda / mu, rho = r / s;
  // Erlang B recursion, then convert to Erlang C
  let B = 1;
  for (let k = 1; k <= s; k++) B = (r * B) / (k + r * B);
  const Pw = B / (1 - rho * (1 - B));
  const Lq = (Pw * rho) / (1 - rho);
  let sumTerms = 0; let term = 1;
  for (let n = 0; n < s; n++) { if (n > 0) term *= r / n; sumTerms += term; }
  const last = (term * r) / s / (1 - rho); // r^s / s! / (1 - rho)
  const P0 = 1 / (sumTerms + last);
  return { rho, P0, Lq, Ls: Lq + r, Wq: Lq / lambda, Ws: Lq / lambda + 1 / mu, Pw };
}

/** Probability of exactly n in an M/M/s system. */
export function mmsPn(lambda: number, mu: number, s: number, n: number, P0: number): number {
  const r = lambda / mu;
  if (n <= s) return (P0 * Math.pow(r, n)) / factorial(n);
  return (P0 * Math.pow(r, n)) / (factorial(s) * Math.pow(s, n - s));
}

export function md1(lambda: number, mu: number): QueueStats {
  const rho = lambda / mu; const Lq = (lambda * lambda) / (2 * mu * (mu - lambda));
  return { rho, P0: 1 - rho, Lq, Ls: Lq + rho, Wq: Lq / lambda, Ws: Lq / lambda + 1 / mu, Pw: rho };
}

/** Kingman / Sakasegawa approximation for G/G/m. a = mean interarrival time, p = mean service time. */
export function kingman(a: number, p: number, m: number, cva: number, cvs: number) {
  const u = p / (a * m);
  const Wq = (p / m) * (Math.pow(u, Math.sqrt(2 * (m + 1)) - 1) / (1 - u)) * ((cva * cva + cvs * cvs) / 2);
  const lambda = 1 / a;
  return { u, Wq, Lq: lambda * Wq, Ws: Wq + p, Ls: lambda * (Wq + p) };
}
