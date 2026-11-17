// Regression tests for the issues found by the independent reviewer (see DECISIONS.md, "Independent review").
import { describe, expect, it } from 'vitest';
import { byId, defaults, run } from '../src/index';

const go = (id: string, v: Record<string, unknown>) => { const def = byId[id]; const r = run(def, { ...defaults(def), ...v }); if (!r.ok) throw new Error(r.errors.join(' ')); return r; };

describe('independent review findings stay fixed', () => {
  it('level aggregate plan never gets free shortages', () => {
    const base = { demand: [1500, 1100, 900, 700], days: [20, 20, 20, 20], hrs: 1, wage: 10, hire: 300, fire: 600, hold: 5, subCost: 20 };
    const r = go('aggregate-planning', base);
    expect(r.o.level).toBeCloseTo(76000, 6); expect(r.o.chase).toBeCloseTo(66000, 6); expect(r.o.hybrid).toBeCloseTo(56000, 6); expect(r.o.bestIdx).toBe(3);
    expect(Math.min(...(r.o.levelInv as number[]))).toBeGreaterThanOrEqual(0);
    expect(go('aggregate-planning', { ...base, back: 10 }).o.level).toBeCloseTo(55000, 6); // shortages allowed only when they are priced
  });
  it('a sigma stated for the whole lead time is never rescaled', () => {
    const v = { d: 350, d_u: 'week', L: 1, L_u: 'week', sd: 10, sdGiven: 'leadtime', SL: 95, zMode: 'table' };
    expect(go('safety-stock-demand', { ...v, sd_u: 'day' }).o.ss).toBeCloseTo(16.5, 9);
    expect(go('safety-stock-demand', { ...v, sd_u: 'week' }).o.ss).toBeCloseTo(16.5, 9);
  });
  it('one week equals five working days in a 250-day year, and seven days in a calendar year', () => {
    const w = { d: 25000, d_u: 'year', daysPerYear: 250 };
    expect(go('reorder-point', { ...w, L: 1, L_u: 'week' }).o.dlt).toBeCloseTo(500, 9);
    expect(go('reorder-point', { ...w, L: 5, L_u: 'day' }).o.dlt).toBeCloseTo(500, 9);
    expect(go('reorder-point', { d: 100, d_u: 'day', L: 1, L_u: 'week' }).o.dlt).toBeCloseTo(700, 9);
    expect(go('reorder-point', { d: 5200, d_u: 'year', L: 1, L_u: 'week' }).o.dlt).toBeCloseTo(100, 9);
  });
  it('M/M/s waiting cost can be charged on the system or on the line', () => {
    const v = { lambda: 2, mu: 3, s: 1, cw: 15, cs: 11 };
    expect(go('mms', v).o.cost).toBeCloseTo(41, 9);
    expect(go('mms', { ...v, costOn: 'queue' }).o.cost).toBeCloseTo(31, 9); // Heizer, Golden Muffler
  });
  it('quantity discount savings are measured against the best order at the base price', () => {
    const r = go('quantity-discount', { D: 2400, S: 100, I: 25, breaks: [{ min: 0, price: 20 }, { min: 300, price: 19.5 }, { min: 600, price: 19 }] });
    expect(r.o.TC).toBeCloseTo(47425, 6); expect(r.o.baseQ).toBe(299); expect(r.o.savings).toBeCloseTo(49550.18 - 47425, 1);
    const flat = go('quantity-discount', { D: 5000, S: 49, hMode: 'amount', H: 1, breaks: [{ min: 0, price: 5 }, { min: 1000, price: 4.8 }] });
    expect(flat.o.tierQs[0]).toBeCloseTo(flat.o.tierQs[1], 9); // a fixed dollar holding cost gives the same EOQ at every price
  });
  it('fill rate is never negative', () => {
    expect(go('fill-rate', { d: 2500, sd: 500, L: 2, ROP: 1000, Q: 1000 }).o.fillRate).toBe(0);
  });
  it('the usual textbook unit mix is explained, not flagged as a mistake', () => {
    const d = byId['continuous-review']; const r = run(d, defaults(d));
    expect(r.warnings.some((w) => /mismatch/i.test(w))).toBe(false);
    const r2 = run(d, { ...defaults(d), L_u: 'week' });
    expect(r2.warnings.some((w) => /mismatch/i.test(w))).toBe(true);
  });
  it('continuous review accepts holding cost as a percentage of unit cost', () => {
    const a = go('continuous-review', { H: 5 }); const b = go('continuous-review', { hMode: 'percent', I: 25, C: 20 });
    expect(b.o.Q).toBeCloseTo(a.o.Q as number, 9);
  });
});
