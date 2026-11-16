import type { NotationId } from './types';

export const NOTATIONS: { id: NotationId; name: string; short: string; note: string }[] = [
  { id: 'heizer', name: 'Heizer, Render & Munson', short: 'Heizer', note: 'Operations Management. D, S, H, ROP, ss; error = actual − forecast.' },
  { id: 'chopra', name: 'Chopra & Meindl', short: 'Chopra', note: 'Supply Chain Management. Holding cost as hC, CSL, ESC, fr; error = forecast − demand.' },
  { id: 'cachon', name: 'Cachon & Terwiesch', short: 'Cachon', note: 'Matching Supply with Demand. K, h, I = R × T, u, Tq; round-up rule for z lookups.' },
  { id: 'jacobs', name: 'Jacobs & Chase', short: 'Jacobs', note: 'Operations and Supply Chain Management. Qopt, R for reorder point, SS.' },
];

type Row = string | Partial<Record<NotationId, string>> & { heizer: string };

/** Canonical symbol keys and how each textbook writes them (mini-TeX). */
const TABLE: Record<string, Row> = {
  D: { heizer: 'D', chopra: 'D', cachon: 'R', jacobs: 'D' },
  d: { heizer: 'd', chopra: 'D', cachon: '\\mu', jacobs: '\\bar{d}' },
  S: { heizer: 'S', chopra: 'S', cachon: 'K', jacobs: 'S' },
  H: { heizer: 'H', chopra: 'hC', cachon: 'h', jacobs: 'H' },
  I: { heizer: 'I', chopra: 'h', cachon: 'h\\%', jacobs: 'i' },
  C: { heizer: 'P', chopra: 'C', cachon: 'c', jacobs: 'C' },
  Q: 'Q',
  Qopt: { heizer: 'Q^*', chopra: 'Q^*', cachon: 'Q^*', jacobs: 'Q_{opt}' },
  N: { heizer: 'N', chopra: 'n', cachon: 'N', jacobs: 'N' },
  T: 'T',
  TC: 'TC',
  ROP: { heizer: 'ROP', chopra: 'ROP', cachon: 'ROP', jacobs: 'R' },
  L: { heizer: 'L', chopra: 'L', cachon: 'l', jacobs: 'L' },
  ss: { heizer: 'ss', chopra: 'ss', cachon: 'I_s', jacobs: 'SS' },
  sigd: { heizer: '\\sigma_d', chopra: '\\sigma_D', cachon: '\\sigma', jacobs: '\\sigma_d' },
  sigL: { heizer: '\\sigma_{LT}', chopra: 's_L', cachon: '\\sigma_l', jacobs: '\\sigma_{LT}' },
  sigdLT: { heizer: '\\sigma_{dLT}', chopra: '\\sigma_L', cachon: '\\sigma_{l}', jacobs: '\\sigma_L' },
  z: 'z',
  CSL: { heizer: 'SL', chopra: 'CSL', cachon: 'SL', jacobs: 'P' },
  fr: { heizer: 'FR', chopra: 'fr', cachon: 'FR', jacobs: 'FR' },
  ESC: { heizer: 'ESC', chopra: 'ESC', cachon: 'E[LS]', jacobs: 'E(z)\\sigma_L' },
  G: { heizer: 'L(z)', chopra: 'L(z)', cachon: 'L(z)', jacobs: 'E(z)' },
  Cu: { heizer: 'C_s', chopra: 'C_u', cachon: 'C_u', jacobs: 'C_u' },
  Co: { heizer: 'C_o', chopra: 'C_o', cachon: 'C_o', jacobs: 'C_o' },
  At: { heizer: 'A_t', chopra: 'D_t', cachon: 'y_t', jacobs: 'A_t' },
  Ft: 'F_t',
  alpha: '\\alpha', beta: { heizer: '\\beta', chopra: '\\beta', cachon: '\\beta', jacobs: '\\delta' }, gamma: '\\gamma',
  lam: '\\lambda', mu: '\\mu',
  rho: { heizer: '\\rho', chopra: '\\rho', cachon: 'u', jacobs: '\\rho' },
  M: { heizer: 'M', chopra: 's', cachon: 'm', jacobs: 'S' },
  Lq: { heizer: 'L_q', chopra: 'L_q', cachon: 'I_q', jacobs: 'L_q' },
  Ls: { heizer: 'L_s', chopra: 'L', cachon: 'I', jacobs: 'L_s' },
  Wq: { heizer: 'W_q', chopra: 'W_q', cachon: 'T_q', jacobs: 'W_q' },
  Ws: { heizer: 'W_s', chopra: 'W', cachon: 'T', jacobs: 'W_s' },
  P0: 'P_0',
  WIP: { heizer: 'WIP', chopra: 'I', cachon: 'I', jacobs: 'WIP' },
  TH: { heizer: 'TH', chopra: 'D', cachon: 'R', jacobs: 'TH' },
  FT: { heizer: 'CT', chopra: 'T', cachon: 'T', jacobs: 'FT' },
  p: 'p', pd: { heizer: 'd', chopra: 'D', cachon: 'R', jacobs: 'd' },
};

const cache = new Map<NotationId, Record<string, string>>();

export function symbols(n: NotationId): Record<string, string> {
  let m = cache.get(n);
  if (!m) {
    m = {};
    for (const [k, row] of Object.entries(TABLE)) m[k] = typeof row === 'string' ? row : row[n] ?? row.heizer;
    cache.set(n, m);
  }
  return m;
}

/** Resolve an input/output symbol: notation key if known, else raw TeX. */
export function sym(key: string | undefined, n: NotationId): string {
  if (!key) return '';
  const m = symbols(n);
  return m[key] ?? key;
}

/** Default forecast-error sign convention per textbook. */
export function defaultErrSign(n: NotationId): 'AF' | 'FA' {
  return n === 'chopra' ? 'FA' : 'AF';
}
export function defaultZMode(n: NotationId): 'exact' | 'roundup' {
  return n === 'cachon' ? 'roundup' : 'exact';
}
