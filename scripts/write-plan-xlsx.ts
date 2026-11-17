// Writes the Plan Builder Excel export for a sample dataset, plus the plan's own values for every formula cell.
// Used by verification/xlsx_libreoffice.py to check the file in a real spreadsheet application.
// Usage: npx tsx scripts/write-plan-xlsx.ts <sample-id> <out.xlsx> <out-expected.json>
import { readFileSync, writeFileSync } from 'node:fs';
import { buildPlan } from '../packages/engine/src/index';
import { planWorkbook } from '../src/lib/planModel';
import { planToXlsx } from '../src/lib/planExcel';

const [id, outXlsx, outJson] = process.argv.slice(2);
const plan = buildPlan(readFileSync(`public/samples/${id}.csv`, 'utf8')); if (!plan.ok) throw new Error(plan.error);
const expected = planWorkbook(plan).map((s) => ({ name: s.name, cells: s.rows.flatMap((r, ri) => r.flatMap((c: any, ci) => (c && typeof c === 'object' ? [{ r: ri, c: ci, f: c.f, v: c.v }] : []))) }));
planToXlsx(plan).then(async (b) => { writeFileSync(outXlsx, Buffer.from(await b.arrayBuffer())); writeFileSync(outJson, JSON.stringify(expected)); console.log(`wrote ${outXlsx}`); });
