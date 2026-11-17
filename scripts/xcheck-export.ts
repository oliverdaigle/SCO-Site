// Layer 2 export: for every calculator, generate N seeded random inputs (raw, with randomized time units),
// run the TypeScript engine, and write inputs + outputs for the independent Python reference to compare.
import fs from 'node:fs';
import path from 'node:path';
import { CALCS, genValues, normalize, validate, mathx, type CalcDef, type TimeUnit } from '../packages/engine/src';

const N = Number(process.argv[2] ?? 2000);
const outDir = path.resolve(process.argv[3] ?? 'verification/.cache/xcheck');
fs.mkdirSync(outDir, { recursive: true });
const UNITS: TimeUnit[] = ['day', 'week', 'month', 'year'];

function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function clean(x: any): any {
  if (typeof x === 'number') return Number.isFinite(x) ? x : x > 0 ? 'inf' : x < 0 ? '-inf' : 'nan';
  if (Array.isArray(x)) return x.map(clean);
  if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, clean(v)]));
  return x;
}
function cases(def: CalcDef) {
  const r = mathx.rng(hash(def.id) ^ 0x9e3779b9); const list: any[] = []; let guard = 0;
  while (list.length < N && guard++ < N * 20) {
    const raw = genValues(def, r);
    // Randomize mode selects (when the calculator has no custom generator) so every branch is cross-checked.
    if (!def.gen) { for (const i of def.inputs) if (i.kind === 'select' && r() < 0.5) raw[i.id] = i.options![Math.floor(r() * i.options!.length)].value; if (validate(def, raw).length) continue; }
    // Randomize time units on a third of the cases so unit conversion is cross-checked too.
    if (r() < 0.33) for (const i of def.inputs) if (i.time && (!i.show || i.show(raw))) raw[i.id + '_u'] = UNITS[Math.floor(r() * 4)];
    if (def.inputs.some((i) => i.id === 'daysPerYear') && r() < 0.3) raw.daysPerYear = [250, 260, 300, 360, 365][Math.floor(r() * 5)];
    const norm = normalize(def, raw);
    if (def.check && def.check(norm.v)) continue;
    let o: any; try { o = def.compute(norm.v); } catch { continue; }
    list.push({ v: clean(raw), o: clean(o) });
  }
  return list;
}

const schema = CALCS.map((d) => ({ id: d.id, name: d.name, cat: d.cat, basis: d.basis ?? null, claim: d.claim ?? null, primary: d.outputs.filter((o) => o.primary).map((o) => o.id), outputs: d.outputs.map((o) => o.id), inputs: d.inputs.map((i) => ({ id: i.id, kind: i.kind, time: i.time ?? null, def: i.kind === 'tree' ? null : i.def })), examples: d.examples.length }));
fs.writeFileSync(path.join(outDir, '_schema.json'), JSON.stringify(schema));
let total = 0;
for (const d of CALCS) { const c = cases(d); total += c.length; fs.writeFileSync(path.join(outDir, d.id + '.json'), JSON.stringify(c)); }
console.log(`exported ${total} cases for ${CALCS.length} calculators to ${outDir}`);
