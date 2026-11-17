// Built-in fuzzy search over calculator names, synonyms, symptoms, and symbols. No external service.
import { CALCS } from './registry';
import { symbols } from './notation';
import type { CalcDef, Mode } from './types';

const STOP = new Set(['the', 'a', 'an', 'of', 'to', 'for', 'and', 'or', 'in', 'on', 'is', 'my', 'i', 'how', 'do', 'what', 'should', 'much', 'many', 'need', 'calculate', 'calculator', 'find', 'compute', 'formula', 'me', 'we', 'our', 'it', 'with', 'are', 'does', 'can', 'be', 'at', 'from', 'this', 'that', 'vs']);
const SYMBOL_WORDS: Record<string, string[]> = { sigma: ['σ', 'sigma', 'standard deviation'], lambda: ['λ', 'lambda', 'arrival rate'], mu: ['μ', 'mu', 'service rate'], alpha: ['α', 'alpha', 'smoothing constant'], beta: ['β', 'beta'], rho: ['ρ', 'rho', 'utilization'], z: ['z', 'z-value', 'z score'] };
const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, '').replace(/[^a-z0-9σλμαβρ%/+*.-]+/g, ' ').trim();
const toks = (s: string) => norm(s).split(' ').filter((t) => t && !STOP.has(t));

function lev1(a: string, b: string): boolean {
  if (a === b) return true; const la = a.length, lb = b.length; if (Math.abs(la - lb) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < la && j < lb) { if (a[i] === b[j]) { i++; j++; continue; } if (++edits > 1) return false; if (la > lb) i++; else if (lb > la) j++; else { i++; j++; } }
  return edits + (la - i) + (lb - j) <= 1;
}
const stem = (t: string) => (t.length > 4 ? t.replace(/(ing|ies|es|s|ed)$/, '') : t);
function tokenMatch(q: string, f: string): number {
  if (q === f) return 1; if (f.startsWith(q) && q.length >= 2) return 0.9; if (stem(q) === stem(f)) return 0.9;
  if (q.length >= 4 && f.includes(q)) return 0.7; if (q.length >= 5 && lev1(q, f)) return 0.75; return 0;
}
function fieldScore(q: string, qt: string[], field: string): number {
  const f = norm(field); if (!f) return 0; if (f === q) return 1; if (f.startsWith(q + ' ') || f.startsWith(q)) return q.length >= 3 ? 0.93 : 0.6;
  if ((' ' + f + ' ').includes(' ' + q + ' ')) return 0.88; if (q.length >= 4 && f.includes(q)) return 0.78;
  if (!qt.length) return 0; const ft = f.split(' ').filter((t) => !STOP.has(t)); if (!ft.length) return 0;
  let s = 0; for (const t of qt) s += Math.max(0, ...ft.map((x) => tokenMatch(t, x)));
  const cover = s / qt.length; const precision = Math.min(1, qt.length / ft.length);
  return cover >= 0.5 ? cover * (0.55 + 0.2 * precision) : 0;
}

interface Entry { def: CalcDef; fields: [string, number][]; syms: string[] }
let INDEX: Entry[] | null = null;
function index(): Entry[] {
  if (INDEX) return INDEX;
  const sy = symbols('heizer');
  INDEX = CALCS.map((def) => ({
    def,
    fields: [[def.short, 1], [def.name, 1], ...def.keywords.map((k) => [k, 0.95] as [string, number]), ...def.symptoms.map((k) => [k, 0.9] as [string, number]), [def.bq, 0.8], [def.blurb, 0.45]],
    syms: [...new Set(def.inputs.concat(def.outputs as any).map((i: any) => (i.sym ? (sy[i.sym] ?? i.sym) : '')).filter(Boolean).map((s: string) => s.replace(/[\\{}^_*]/g, '').toLowerCase()))],
  }));
  return INDEX;
}

export interface Hit { id: string; score: number; matched: string }
export function search(query: string, opts: { limit?: number; mode?: Mode } = {}): Hit[] {
  const q = norm(query); if (!q) return [];
  const qt = toks(query); const hits: Hit[] = [];
  const symQ = Object.entries(SYMBOL_WORDS).find(([, words]) => words.includes(q))?.[0];
  for (const e of index()) {
    let best = 0, matched = '', sumTop = 0;
    for (const [text, w] of e.fields) { const s = fieldScore(q, qt, text) * w; if (s > best) { best = s; matched = text; } if (s > 0.5) sumTop += 0.02; }
    if (symQ && e.syms.some((s) => s === symQ || s.startsWith(symQ))) { if (0.7 > best) { best = 0.7; matched = `uses ${SYMBOL_WORDS[symQ][0]}`; } }
    else if (q.length <= 4 && e.syms.includes(q) && best < 0.6) { best = 0.6; matched = `symbol ${query}`; }
    const score = Math.min(1, best + Math.min(0.06, sumTop));
    if (score >= 0.3) hits.push({ id: e.def.id, score, matched });
  }
  hits.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return hits.slice(0, opts.limit ?? 8);
}
/** True when nothing in the catalog is a good answer to the query (logged to guide new calculators). */
export const isMiss = (hits: Hit[]) => !hits.length || hits[0].score < 0.45;
