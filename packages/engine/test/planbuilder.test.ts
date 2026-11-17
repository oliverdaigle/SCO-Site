import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { buildPlan, parseCsv, parseDate, wrappedCards, normInv } from '../src';

const sample = (f: string) => fs.readFileSync(`public/samples/${f}.csv`, 'utf8');
describe('plan builder', () => {
  it('parses CSV with quotes, embedded commas, BOM, and other delimiters', () => {
    expect(parseCsv('﻿a,b\n"x, y",2\n"he said ""hi""",3\n')).toEqual([['a', 'b'], ['x, y', '2'], ['he said "hi"', '3']]);
    expect(parseCsv('a;b\n1;2')).toEqual([['a', 'b'], ['1', '2']]); expect(parseCsv('a\tb\r\n1\t2\r\n\r\n')).toEqual([['a', 'b'], ['1', '2']]);
  });
  it('reads common date formats and rejects impossible dates', () => {
    const d = parseDate('2026-03-14'); expect(parseDate('3/14/2026')).toBe(d); expect(parseDate('14-Mar-2026')).toBe(d); expect(parseDate('Mar 14, 2026')).toBe(d); expect(parseDate('14/03/2026')).toBe(d);
    expect(parseDate('2026-02-30')).toBeNaN(); expect(parseDate('2026-13-01')).toBeNaN(); expect(parseDate('yesterday')).toBeNaN(); expect(parseDate('')).toBeNaN();
  });
  for (const f of ['coffee-shop', 'sneaker-resale', 'small-manufacturer']) it(`builds a complete, internally consistent plan for ${f}`, () => {
    const p = buildPlan(sample(f)); expect(p.ok).toBe(true); if (!p.ok) return;
    expect(p.skus.length).toBeGreaterThanOrEqual(10); expect(p.report.rowsDropped).toBeGreaterThan(0); expect(p.report.issues.length).toBeGreaterThan(0); expect(p.summary.excessValue).toBeGreaterThan(0);
    expect(p.summary.classCount.A + p.summary.classCount.B + p.summary.classCount.C).toBe(p.skus.length); expect(p.summary.classShare.A + p.summary.classShare.B + p.summary.classShare.C).toBeCloseTo(100, 6);
    for (const s of p.skus) {
      expect(s.weekly.length).toBe(p.report.weeks); expect(s.forecast).toBeGreaterThanOrEqual(0); expect(Number.isFinite(s.sigma)).toBe(true);
      expect(s.z).toBeCloseTo(normInv(s.service / 100), 12); expect(s.safetyStock).toBe(Math.ceil(s.z * s.sigma * Math.sqrt(s.leadDays / 7) - 1e-9)); expect(s.rop).toBe(Math.ceil(s.forecast * (s.leadDays / 7) + s.safetyStock - 1e-9));
      if (s.eoq > 0) expect(s.eoq).toBe(Math.max(1, Math.round(Math.sqrt((2 * s.annualDemand * s.orderCost) / s.holdingCost))));
      expect(s.annualCost).toBeCloseTo(s.ordersPerYear * s.orderCost + s.avgInventory * s.holdingCost, 6);
      if (s.onHand !== null) expect(s.status).toBe(s.onHand <= s.rop ? 'Reorder now' : s.onHand > s.rop + s.eoq ? 'Overstocked' : 'Healthy');
    }
    const cards = wrappedCards(p); expect(cards.length).toBeGreaterThanOrEqual(8); for (const c of cards) { expect(c.big.length).toBeGreaterThan(0); expect((c.kicker + c.big + c.line + c.sub).includes('—')).toBe(false); expect((c.big + c.line + c.sub)).not.toMatch(/NaN|undefined/); }
  });
  it('explains missing columns, empty files, and too little history', () => {
    const a = buildPlan('when,thing,amount\n2026-01-01,x,3'); expect(a.ok).toBe(false); if (!a.ok) expect(a.error).toMatch(/Could not find a column/);
    const b = buildPlan(''); expect(b.ok).toBe(false); const c = buildPlan('date,sku,units\n2026-01-05,A,3\n2026-01-06,A,4'); expect(c.ok).toBe(false); if (!c.ok) expect(c.error).toMatch(/at least 4 weeks/);
    const d = buildPlan('date,sku,units\nnot a date,A,x'); expect(d.ok).toBe(false); if (!d.ok) expect(d.error).toMatch(/No usable rows/);
  });
  it('accepts alternative header names and uses defaults for missing optional columns', () => {
    const rows = ['Order Date,Product,Qty']; for (let w = 0; w < 10; w++) for (let d = 0; d < 7; d++) rows.push(`${new Date(Date.UTC(2026, 0, 5 + w * 7 + d)).toISOString().slice(0, 10)},Widget,${5 + (d % 3)}`);
    const p = buildPlan(rows.join('\n'), { unitCost: 20, leadTimeDays: 7 }); expect(p.ok).toBe(true); if (p.ok) { expect(p.skus[0].unitCost).toBe(20); expect(p.skus[0].leadDays).toBe(7); expect(p.skus[0].status).toBe('No stock data'); expect(p.skus[0].forecast).toBeCloseTo(41, 0); }
  });
});
