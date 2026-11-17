// Practice problems: fresh randomized inputs, a worded prompt, tolerance-based checking, worked solution.
import type { CalcDef, NotationId, Vals } from './types';
import { rng } from './math/util';
import { genValues, run } from './run';
import { F } from './format';

export interface PracticeAnswer { id: string; label: string; value: number; unit: string; fmt: string }
export interface PracticeProblem { calcId: string; seed: number; values: Vals; prompt: string; answers: PracticeAnswer[] }

export function makeProblem(def: CalcDef, seed: number): PracticeProblem {
  const r = rng(seed * 2654435761 + def.id.length * 97 + def.id.charCodeAt(0));
  for (let attempt = 0; attempt < 50; attempt++) {
    const values = genValues(def, r, def.practice.gen);
    const res = run(def, values);
    if (!res.ok) continue;
    const answers = def.practice.ask.map((id) => { const o = def.outputs.find((x) => x.id === id); return { id, label: o?.label ?? id, value: res.o[id] as number, unit: o?.unit ?? (o?.fmt === 'pct' ? '%' : o?.fmt === 'money' ? '$' : ''), fmt: o?.fmt ?? 'num' }; });
    if (answers.every((a) => typeof a.value === 'number' && Number.isFinite(a.value))) return { calcId: def.id, seed, values, prompt: def.practice.prompt(res.v, F), answers };
  }
  const res = run(def, {});
  return { calcId: def.id, seed, values: res.v, prompt: def.practice.prompt(res.v, F), answers: def.practice.ask.map((id) => ({ id, label: id, value: res.o[id], unit: '', fmt: 'num' })) };
}

/** Correct when within 1% of the answer (or within 0.01 for values near zero). Percent answers may be entered as a fraction. */
export function checkAnswer(expected: number, given: number, fmt = 'num'): boolean {
  if (!Number.isFinite(given)) return false;
  const ok = (g: number) => Math.abs(g - expected) <= Math.max(0.01 * Math.abs(expected), 0.01);
  if (ok(given)) return true;
  if (fmt === 'pct' && ok(given * 100)) return true;
  if (fmt === 'int' && Math.round(given) === Math.round(expected)) return true;
  return false;
}

export function solution(def: CalcDef, values: Vals, nota: NotationId = 'heizer') { return run(def, values, { nota }); }
