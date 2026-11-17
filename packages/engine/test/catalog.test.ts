import { describe, it, expect } from 'vitest';
import { CALCS, byId, CATEGORIES, EDGES, related, search, isMiss, BUSINESS_WIZARD, LEARNER_WIZARD, reachable, wizardProblems, makeProblem, checkAnswer, parseProblem, run, defaults, symbols, NOTATIONS, LEARNING_PATHS } from '../src';

describe('catalog integrity', () => {
  it('has 93 calculators with unique ids', () => { expect(CALCS.length).toBe(93); expect(new Set(CALCS.map((c) => c.id)).size).toBe(93); });
  it('every calculator belongs to a known category and has complete content', () => {
    const cats = new Set(CATEGORIES.map((c) => c.id));
    for (const c of CALCS) {
      expect(cats.has(c.cat), c.id).toBe(true);
      expect(c.traps.length, c.id + ' traps').toBeGreaterThan(0); expect(c.analogy.length, c.id).toBeGreaterThan(20); expect(c.keywords.length, c.id).toBeGreaterThan(1); expect(c.symptoms.length, c.id).toBeGreaterThan(0);
      expect(c.outputs.some((o) => o.primary), c.id + ' primary output').toBe(true);
      for (const u of c.uses) expect(byId[u], `${c.id} uses unknown ${u}`).toBeTruthy();
      for (const a of c.practice.ask) expect(c.outputs.some((o) => o.id === a), `${c.id} practice asks unknown ${a}`).toBe(true);
    }
  });
  it('owner-voice copy has no em dashes', () => { for (const c of CALCS) { const r = run(c, {}); const text = JSON.stringify([c.name, c.bq, c.blurb, c.traps, c.analogy, c.convention, r.biz, r.steps.map((s) => [s.title, s.why, s.eli])]); expect(text.includes('—'), c.id).toBe(false); } });
  it('graph edges reference real calculators and learning paths resolve', () => { for (const e of EDGES) { expect(byId[e.from]).toBeTruthy(); expect(byId[e.to]).toBeTruthy(); } for (const p of LEARNING_PATHS) for (const s of p.steps) expect(byId[s], s).toBeTruthy(); expect(related('safety-stock-demand').length).toBeGreaterThan(3); });
  it('defaults run cleanly under every notation', () => { for (const n of NOTATIONS) for (const c of CALCS) { const r = run(c, defaults(c), { nota: n.id }); expect(r.errors, `${c.id}/${n.id}`).toEqual([]); for (const s of r.steps) if (s.tex) expect(s.tex.includes('undefined'), `${c.id} step "${s.title}"`).toBe(false); expect(c.formula(symbols(n.id)).includes('undefined')).toBe(false); } });
});

describe('wizards reach every calculator', () => {
  for (const [name, tree] of [['business', BUSINESS_WIZARD], ['learner', LEARNER_WIZARD]] as const) {
    it(`${name} wizard is well-formed`, () => { expect(wizardProblems(tree)).toEqual([]); });
    it(`${name} wizard reaches all 93 calculators`, () => { const r = reachable(tree); const missing = CALCS.filter((c) => !r.has(c.id)).map((c) => c.id); expect(missing).toEqual([]); });
  }
  it('learner wizard explains why at every leaf', () => { for (const n of LEARNER_WIZARD) for (const o of n.options) if (o.calc) expect(o.why, `${n.id}: ${o.label}`).toBeTruthy(); });
});

describe('search', () => {
  const top = (q: string) => search(q)[0]?.id;
  const cases: [string, string | string[]][] = [['EOQ', 'eoq'], ['running out of stock', ['safety-stock-demand', 'reorder-point', 'safety-stock-combined']], ['how many cashiers', 'mms'], ['sigma', ['dpmo-sigma', 'safety-stock-demand', 'process-capability', 'newsvendor', 'risk-pooling', 'safety-stock-combined', 'safety-stock-lead-time']], ['safty stock', ['safety-stock-demand', 'safety-stock-lead-time', 'safety-stock-combined']], ['newsboy', 'newsvendor'], ['critical path', 'cpm'], ['cpk', 'process-capability'], ['where should my warehouse go', 'center-of-gravity'], ['is this supplier actually cheaper', 'total-cost-of-ownership'], ['tracking signal', 'tracking-signal'], ['erlang c', 'mms'], ['bullwhip', 'bullwhip-ratio'], ['takt', 'takt-time'], ['cash conversion cycle', 'cash-to-cash'], ['how much should i order', 'eoq'], ['littles law', 'littles-law'], ['holt winters', 'holt-winters'], ['λ', ['mm1', 'mms', 'md1', 'queue-probabilities']]];
  for (const [q, want] of cases) it(`"${q}"`, () => { const got = top(q); expect(Array.isArray(want) ? want.includes(got!) : got === want, `got ${got}`).toBe(true); });
  it('every calculator is the top hit for its own name and short name', () => { for (const c of CALCS) { expect(search(c.name)[0]?.id, c.name).toBe(c.id); expect(search(c.short).slice(0, 3).map((h) => h.id), c.short).toContain(c.id); } });
  it('flags nonsense as a miss', () => { expect(isMiss(search('zzqx flibbertigibbet'))).toBe(true); expect(isMiss(search('reorder point'))).toBe(false); });
});

describe('practice', () => {
  it('generates a solvable, self-consistent problem for every calculator', () => {
    for (const c of CALCS) for (const seed of [1, 2, 3, 4, 5]) {
      const p = makeProblem(c, seed); expect(p.prompt.length, c.id).toBeGreaterThan(20); expect(p.prompt.includes('undefined'), c.id + ': ' + p.prompt).toBe(false); expect(p.prompt.includes('NaN'), c.id + ': ' + p.prompt).toBe(false);
      for (const a of p.answers) { expect(Number.isFinite(a.value), `${c.id} ${a.id}`).toBe(true); expect(checkAnswer(a.value, a.value * 1.004 + 0.001, a.fmt)).toBe(true); }
      expect(makeProblem(c, seed).prompt).toBe(p.prompt);
    }
  });
  it('checks answers with tolerance', () => { expect(checkAnswer(200, 201)).toBe(true); expect(checkAnswer(200, 205)).toBe(false); expect(checkAnswer(92.1, 0.921, 'pct')).toBe(true); expect(checkAnswer(0, 0.005)).toBe(true); expect(checkAnswer(5, NaN)).toBe(false); });
});

describe('paste your problem (rule-based parser)', () => {
  const P: [string, string, Record<string, any>][] = [
    ['A hospital uses 1,000 boxes of gloves per year. The ordering cost is $10 per order and the holding cost is $0.50 per box per year. What is the economic order quantity?', 'eoq', { D: 1000, S: 10, H: 0.5 }],
    ['Annual demand is 12,000 units. Ordering cost is $50 per order. Holding cost is 20% of the unit cost, and each unit costs $25. Find the EOQ.', 'eoq', { D: 12000, S: 50, hMode: 'percent', I: 20, C: 25 }],
    ['Daily demand averages 15 units with a standard deviation of demand of 5 units. Lead time is 2 days. The firm wants a 90% service level. What safety stock and reorder point should it use?', 'safety-stock-demand', { d: 15, sd: 5, L: 2, SL: 90 }],
    ['Average daily demand is 150 units with a standard deviation of demand of 16. Lead time averages 5 days with a standard deviation of lead time of 1 day. For a 95% service level, find the reorder point.', 'safety-stock-combined', { d: 150, sd: 16, L: 5, sL: 1, SL: 95 }],
    ['Customers arrive at a rate of 2 per hour and the single mechanic can serve 3 per hour. How long do customers wait in line?', 'mm1', { lambda: 2, mu: 3 }],
    ['Cars arrive at a rate of 40 per hour. There are three tellers and each can serve 15 customers per hour. Find the average wait.', 'mms', { lambda: 40, mu: 15, s: 3 }],
    ['A newspaper sells for $1.25 and costs $0.70. Unsold copies have a salvage value of $0.30. Mean demand is 120 with a standard deviation of 15. How many should be stocked?', 'newsvendor', { price: 1.25, cost: 0.7, salvage: 0.3, mu: 120, sigma: 15 }],
    ['Sales for the last six months were 42, 40, 43, 40, 41, 39. Compute the forecast using a 3-month moving average.', 'moving-average', { data: [42, 40, 43, 40, 41, 39], n: 3 }],
    ['Actual demand was 90, 95, 115, 100, 125, 140 and forecast demand was 100, 100, 100, 110, 110, 110. Compute the tracking signal.', 'tracking-signal', { actual: [90, 95, 115, 100, 125, 140], forecast: [100, 100, 100, 110, 110, 110] }],
    ['A process has an upper specification limit of 213 and a lower specification limit of 207. The process mean is 210 and the standard deviation is 0.516. Compute Cp and Cpk.', 'process-capability', { usl: 213, lsl: 207, mean: 210, sigma: 0.516 }],
    ['Fixed costs are $10,000, the variable cost is $2.25 per unit and the selling price is $4.00. What is the break-even point?', 'capacity-break-even', { F: 10000, V: 2.25, P: 4 }],
    ['The first unit took 100 hours. With an 80% learning curve, how long will the 8th unit take?', 'learning-curve', { T1: 100, rate: 80, n: 8 }],
    ['The expected completion time of the project is 15 weeks and the variance is 3.11. What is the probability the project finishes within 16 weeks?', 'pert-probability', { T: 15, variance: 3.11, deadline: 16 }],
    ['Demand is 8,000 units per year, the firm works 250 working days, and lead time is 3 days. What is the reorder point?', 'reorder-point', { d: 8000, d_u: 'year', L: 3, daysPerYear: 250 }],
  ];
  for (const [text, calc, want] of P) it(calc + ': ' + text.slice(0, 50), () => { const r = parseProblem(text); expect(r.calcId).toBe(calc); for (const [k, v] of Object.entries(want)) expect(r.values[k], `${k} in "${text.slice(0, 40)}"`).toEqual(v); expect(run(byId[calc], r.values).ok).toBe(true); });
  it('returns no calculator for unrelated text', () => { expect(parseProblem('The quick brown fox jumps over the lazy dog.').calcId).toBeNull(); });
});
