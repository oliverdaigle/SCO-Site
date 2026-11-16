import type { CalcDef, Ctx, InputDef, NotationId, RunResult, Vals } from './types';
import { F } from './format';
import { symbols } from './notation';
import { normalize } from './units';
import { randStep, type Rng } from './math/util';

export function defaults(def: CalcDef): Vals {
  const v: Vals = {};
  for (const i of def.inputs) {
    v[i.id] = Array.isArray(i.def) ? JSON.parse(JSON.stringify(i.def)) : i.def;
    if (i.time) v[i.id + '_u'] = i.time.unit;
  }
  return v;
}

const visible = (i: InputDef, v: Vals) => !i.show || i.show(v);

export function validate(def: CalcDef, v: Vals): string[] {
  const errs: string[] = [];
  for (const i of def.inputs) {
    if (!visible(i, v)) continue;
    const x = v[i.id];
    if (i.kind === 'select' || i.kind === 'tree') continue;
    if (i.kind === 'table') {
      if (!Array.isArray(x) || x.length < (i.minRows ?? 1)) { errs.push(`${i.label}: add at least ${i.minRows ?? 1} row${(i.minRows ?? 1) > 1 ? 's' : ''}.`); continue; }
      for (const c of i.columns ?? []) if (c.kind === 'number' && x.some((r: any) => typeof r[c.id] !== 'number' || !Number.isFinite(r[c.id]))) { errs.push(`${i.label}: every row needs a number in "${c.label}".`); break; }
      continue;
    }
    if (i.kind === 'series') {
      if (!Array.isArray(x) || x.length < (i.minRows ?? 2)) { errs.push(`${i.label}: enter at least ${i.minRows ?? 2} numbers, separated by commas, spaces, or new lines.`); continue; }
      if (x.some((n: any) => typeof n !== 'number' || !Number.isFinite(n))) errs.push(`${i.label}: the list contains something that is not a number.`);
      continue;
    }
    if (typeof x !== 'number' || !Number.isFinite(x)) { errs.push(`${i.label}: enter a number.`); continue; }
    if (i.kind === 'int' && !Number.isInteger(x)) errs.push(`${i.label}: must be a whole number.`);
    if (i.min !== undefined && x < i.min) errs.push(i.min > 0 && i.min < 0.001 ? `${i.label}: must be greater than zero.` : `${i.label}: must be at least ${i.min}.`);
    if (i.max !== undefined && x > i.max) errs.push(`${i.label}: must be at most ${i.max}.`);
  }
  return errs;
}

export function ctxFor(nota: NotationId, unit: string): Ctx {
  return { s: symbols(nota), f: F, nota, u: unit };
}

/** Run a calculator end to end: defaults, unit normalization, validation, compute, presentation. */
export function run(def: CalcDef, raw: Vals, opts: { nota?: NotationId } = {}): RunResult {
  const nota = opts.nota ?? 'heizer';
  const merged = { ...defaults(def), ...raw };
  const base: RunResult = { ok: false, errors: [], warnings: [], v: merged, o: {}, steps: [], biz: null, viz: null, unit: '' };
  const pre = validate(def, merged);
  if (pre.length) return { ...base, errors: pre };
  const norm = normalize(def, merged);
  const post = def.check ? def.check(norm.v) : null;
  if (post) return { ...base, v: norm.v, errors: [post] };
  try {
    const o = def.compute(norm.v);
    const c = ctxFor(nota, norm.basis ?? '');
    const steps = def.steps(norm.v, o, c);
    if (norm.conversions.length) steps.unshift({ title: 'Put every input in the same time unit', why: norm.conversions.join(' '), eli: 'Before using any formula, make sure everything is measured over the same stretch of time. You cannot mix a yearly number with a weekly one.' });
    return { ok: true, errors: [], warnings: norm.warnings, v: norm.v, o, steps, biz: def.biz(norm.v, o, F), viz: def.viz(norm.v, o, F), unit: norm.basis ?? '' };
  } catch (e) {
    return { ...base, v: norm.v, errors: [`Could not compute with these inputs: ${(e as Error).message}`] };
  }
}

/** Compute only (normalized inputs in, raw outputs out). Used by cross-checks and practice. */
export function computeOnly(def: CalcDef, raw: Vals) {
  const merged = { ...defaults(def), ...raw };
  const norm = normalize(def, merged);
  return { v: norm.v, o: def.compute(norm.v) };
}

/** Random valid inputs for practice problems and randomized cross-checks. */
export function genValues(def: CalcDef, r: Rng, custom?: (r: Rng) => Vals): Vals {
  for (let attempt = 0; attempt < 200; attempt++) {
    const v = defaults(def);
    const g = custom ?? def.gen;
    if (g) Object.assign(v, g(r));
    else for (const i of def.inputs) if (i.rand) v[i.id] = randStep(r, i.rand[0], i.rand[1], i.rand[2] ?? 1);
    if (!validate(def, v).length) {
      try { const { v: nv, o } = computeOnly(def, v); if (def.check && def.check(nv)) continue; if (Object.values(o).every((x) => typeof x !== 'number' || !Number.isNaN(x))) return v; } catch { /* retry */ }
    }
  }
  return defaults(def);
}
