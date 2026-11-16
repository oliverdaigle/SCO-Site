import { describe, it, expect } from 'vitest';
import { CALCS, run } from '../src';

/** A worked example passes when each expected value matches to its stated precision. */
export function matches(actual: number, expected: number, tol?: number): boolean {
  if (tol !== undefined) return Math.abs(actual - expected) <= tol * Math.max(1, Math.abs(expected));
  const s = String(expected); const dec = s.includes('.') ? s.split('.')[1].length : 0;
  if (dec === 0) return Math.abs(actual - expected) <= 1e-6 * Math.max(1, Math.abs(expected));
  return Math.abs(actual - expected) <= 0.5 * 10 ** -dec + 1e-9;
}

describe('Layer 1: textbook-style worked examples', () => {
  for (const def of CALCS) {
    describe(def.id, () => {
      it('has at least two worked examples', () => { expect(def.examples.length).toBeGreaterThanOrEqual(2); });
      for (const ex of def.examples) {
        it(ex.title, () => {
          const r = run(def, ex.v);
          expect(r.errors).toEqual([]);
          for (const [k, want] of Object.entries(ex.expect)) {
            const got = r.o[k];
            expect(typeof got, `${def.id}.${k} missing`).toBe('number');
            expect(matches(got, want, ex.tol), `${def.id} "${ex.title}" ${k}: got ${got}, expected ${want}`).toBe(true);
          }
          expect(r.steps.length).toBeGreaterThan(0);
          expect(r.biz!.headline.length).toBeGreaterThan(10);
          expect(r.viz).toBeTruthy();
        });
      }
    });
  }
});
