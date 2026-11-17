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

// The formula model above is only half the proof: the real .xlsx must also be writable and keep its formulas.
// Build the actual file with ExcelJS, read it back, and recalculate the formulas found in the file.
describe('Plan Builder .xlsx file', () => {
  it('uses sheet names Excel accepts', () => {
    const plan = buildPlan(fs.readFileSync('public/samples/coffee-shop.csv', 'utf8')); if (!plan.ok) throw new Error('plan failed');
    for (const s of planWorkbook(plan)) { expect(s.name.length).toBeLessThanOrEqual(31); expect(s.name).not.toMatch(/[\\/?*[\]:]/); expect(s.name.toLowerCase()).not.toBe('history'); }
  });
  for (const f of ['coffee-shop', 'sneaker-resale', 'small-manufacturer']) it(`writes a real workbook whose formulas recalculate for ${f}`, async () => {
    const plan = buildPlan(fs.readFileSync(`public/samples/${f}.csv`, 'utf8')); if (!plan.ok) throw new Error('plan failed');
    const { planToXlsx } = await import('@/lib/planExcel');
    const blob = await planToXlsx(plan); expect(blob.size).toBeGreaterThan(5000);
    const ExcelJS: any = (await import('exceljs')).default ?? (await import('exceljs'));
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.from(await blob.arrayBuffer()));
    const names: string[] = wb.worksheets.map((w: any) => w.name); expect(names).toEqual(planWorkbook(plan).map((s) => s.name));
    // Rebuild every sheet from the file itself: formulas as formulas, everything else as values.
    // (ExcelJS's reader drops a cached result of 0, so the expected values come from the plan model, cell by cell.)
    const model = Object.fromEntries(planWorkbook(plan).map((s) => [s.name, s.rows]));
    const sheets: Record<string, unknown[][]> = {}; const cached: { s: string; r: number; c: number; v: unknown }[] = [];
    for (const ws of wb.worksheets) { const rows: unknown[][] = []; ws.eachRow({ includeEmpty: true }, (row: any, rn: number) => { const out: unknown[] = []; row.eachCell({ includeEmpty: true }, (cell: any, cn: number) => { const v = cell.value; if (v && typeof v === 'object' && 'formula' in v) { expect(v.formula).not.toMatch(/(^|[^.])\bNORM\.S\.INV\(/); out[cn - 1] = '=' + String(v.formula).replace(/_xlfn\./g, ''); const m = model[ws.name]?.[rn - 1]?.[cn - 1] as any; cached.push({ s: ws.name, r: rn - 1, c: cn - 1, v: m?.v }); } else out[cn - 1] = v instanceof Date ? v.toISOString().slice(0, 10) : v; }); rows[rn - 1] = out; }); sheets[ws.name] = rows.map((r) => r ?? []); }
    const hf = HyperFormula.buildFromSheets(sheets as any, { licenseKey: 'gpl-v3' }); const bad: string[] = [];
    for (const k of cached) { const got = hf.getCellValue({ sheet: hf.getSheetId(k.s)!, row: k.r, col: k.c }); const ok = typeof k.v === 'number' ? typeof got === 'number' && Math.abs(got - k.v) <= 1e-6 * Math.max(1, Math.abs(k.v)) : String(got ?? '') === String(k.v ?? ''); if (!ok && bad.length < 6) bad.push(`${k.s} R${k.r + 1}C${k.c + 1}: ${JSON.stringify(got)} vs ${JSON.stringify(k.v)}`); }
    expect(bad).toEqual([]); expect(cached.length).toBeGreaterThan(plan.skus.length * 25);
  });
});
