import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { HyperFormula } from 'hyperformula';
import { buildPlan } from '@lotwise/engine';
import { planWorkbook, type Cell } from '@/lib/planModel';

// Proof that the Excel export is "live": load every sheet into a spreadsheet engine, let it calculate
// the formulas from the raw history, and require every calculated cell to equal the app's number.
describe('Plan Builder Excel export', () => {
  for (const f of ['coffee-shop', 'sneaker-resale', 'small-manufacturer']) it(`formulas recalculate to the plan values for ${f}`, () => {
    const plan = buildPlan(fs.readFileSync(`public/samples/${f}.csv`, 'utf8')); expect(plan.ok).toBe(true); if (!plan.ok) return;
    const model = planWorkbook(plan);
    const sheets = Object.fromEntries(model.map((s) => [s.name, s.rows.map((r) => r.map((c: Cell) => (c && typeof c === 'object' ? '=' + c.f : c)))]));
    const hf = HyperFormula.buildFromSheets(sheets, { licenseKey: 'gpl-v3' }); let checked = 0, formulas = 0; const bad: string[] = [];
    for (const s of model) { const id = hf.getSheetId(s.name)!; s.rows.forEach((r, ri) => r.forEach((c, ci) => { if (!c || typeof c !== 'object') return; formulas++; const got = hf.getCellValue({ sheet: id, row: ri, col: ci }); const want = c.v; checked++;
      const ok = typeof want === 'number' ? typeof got === 'number' && Math.abs(got - want) <= 1e-6 * Math.max(1, Math.abs(want)) : String(got ?? '') === String(want);
      if (!ok && bad.length < 8) bad.push(`${s.name}!R${ri + 1}C${ci + 1} =${c.f} -> ${JSON.stringify(got)} expected ${want}`); })); }
    expect(bad).toEqual([]); expect(checked).toBeGreaterThan(plan.skus.length * 25);
    // No hard-coded results on the Policy sheet: every numeric policy column is a formula.
    const policy = model.find((s) => s.name === 'Policy')!; for (const row of policy.rows.slice(1, plan.skus.length + 1)) for (const col of [2, 3, 4, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]) expect(typeof row[col]).toBe('object');
    // Changing a setting recalculates the plan (holding rate 25% -> 50% shrinks every EOQ).
    const sid = hf.getSheetId('Settings')!, pid = hf.getSheetId('Policy')!; const before = hf.getCellValue({ sheet: pid, row: 1, col: 15 }) as number; hf.setCellContents({ sheet: sid, row: 1, col: 1 }, 0.5); const after = hf.getCellValue({ sheet: pid, row: 1, col: 15 }) as number; expect(after).toBeLessThan(before);
  });
});
