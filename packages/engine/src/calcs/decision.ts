// Decision analysis: expected value, decision trees, EVPI, decisions under uncertainty.
import { calc, num, int, sel, series, table, col, out, fr, tx } from '../dsl';
import { sum, type Rng } from '../math/util';
import type { CalcDef, InputDef, TreeViz, Vals } from '../types';

const CAT = 'decision';
const GETZ = [{ alt: 'Large plant', s1: 200000, s2: -180000, s3: 0, s4: 0 }, { alt: 'Small plant', s1: 100000, s2: -20000, s3: 0, s4: 0 }, { alt: 'Do nothing', s1: 0, s2: 0, s3: 0, s4: 0 }];
const THREE = [{ alt: 'A', s1: 50, s2: 20, s3: -10, s4: 0 }, { alt: 'B', s1: 35, s2: 25, s3: 5, s4: 0 }, { alt: 'C', s1: 10, s2: 10, s3: 10, s4: 0 }];
const payoffIn = (def = GETZ) => table('payoffs', 'Payoff table', [col('alt', 'Alternative', 'text'), col('s1', 'State 1'), col('s2', 'State 2'), col('s3', 'State 3'), col('s4', 'State 4')], def, { minRows: 2, help: 'One row per alternative. Only the first "number of states" columns are used.' });
const nIn = (def = 2) => int('nStates', { label: 'Number of states of nature', blabel: 'Number of possible outcomes', def, min: 2, max: 4, cues: ['states of nature', 'outcomes'] });
const senseIn = () => sel('sense', 'Payoffs are', [['max', 'Profits (higher is better)'], ['min', 'Costs (lower is better)']], 'max');
const probIn = (def = [0.5, 0.5]) => series('probs', { sym: 'P', label: 'Probabilities of the states', blabel: 'Chance of each outcome', def, minRows: 2, help: 'One probability per state, in the same order as the columns. They must add to 1.', cues: ['probabilities', 'probability of'] });
const M = (v: Vals): number[][] => (v.payoffs as any[]).map((r) => [r.s1, r.s2, r.s3, r.s4].slice(0, v.nStates).map(Number));
const sgn = (v: Vals) => (v.sense === 'min' ? -1 : 1);
const probCheck = (v: Vals) => (v.probs.length !== v.nStates ? `Enter exactly ${v.nStates} probabilities, one for each state.` : (v.probs as number[]).some((p) => p < 0 || p > 1) ? 'Each probability must be between 0 and 1.' : Math.abs(sum(v.probs) - 1) > 1e-6 ? `Probabilities must add to 1. Yours add to ${Number(sum(v.probs).toFixed(6))}.` : null);
const argBest = (a: number[], s: number) => a.reduce((b, x, i) => (s * x > s * a[b] + 1e-12 ? i : b), 0);
const genTable = (r: Rng) => { const k = 2 + Math.floor(r() * 3), n = 2 + Math.floor(r() * 4); const raw = Array.from({ length: k }, () => 0.05 + r()); const tot = sum(raw); const probs = raw.map((x) => +(x / tot).toFixed(3)); probs[k - 1] = +(1 - sum(probs.slice(0, k - 1))).toFixed(3); return { nStates: k, sense: r() < 0.7 ? 'max' : 'min', probs, payoffs: Array.from({ length: n }, (_, i) => ({ alt: `Alt ${i + 1}`, s1: Math.round((r() - 0.3) * 400), s2: Math.round((r() - 0.3) * 400), s3: Math.round((r() - 0.3) * 400), s4: Math.round((r() - 0.3) * 400) })) }; };
const altName = (v: Vals, i: number) => String((v.payoffs as any[])[i].alt);
const evCore = (v: Vals) => { const m = M(v), s = sgn(v); const emv = m.map((r) => sum(r.map((x, j) => x * v.probs[j]))); const bi = argBest(emv, s); const colBest = Array.from({ length: v.nStates }, (_, j) => s * Math.max(...m.map((r) => s * r[j]))); const evwpi = sum(colBest.map((x, j) => x * v.probs[j])); return { emv, bestIdx: bi + 1, best: emv[bi], colBest, evwpi, evpi: Math.abs(evwpi - emv[bi]) }; };
const payoffViz = (v: Vals, cells: number[][], bestRow: number, tags?: string[]) => ({ kind: 'matrix' as const, rows: (v.payoffs as any[]).map((r) => String(r.alt)), cols: Array.from({ length: v.nStates }, (_, j) => `State ${j + 1}`), cells, best: Array.from({ length: v.nStates }, (_, j) => [bestRow, j] as [number, number]), rowTags: tags, fmt: 'num' as const });
const evTable = (v: Vals, o: any, c: any) => ({ columns: ['Alternative', ...Array.from({ length: v.nStates }, (_, j) => `State ${j + 1} (P = ${v.probs[j]})`), 'Expected value'], rows: M(v).map((r, i) => [altName(v, i), ...r.map((x) => c.f.num(x)), c.f.num(o.emv[i], 2)]), highlight: [o.bestIdx - 1] });

export const expectedValue: CalcDef = calc({
  id: 'expected-value', name: 'Expected Monetary Value (EMV)', short: 'Expected value', cat: CAT,
  bq: 'Which option pays off best on average?',
  blurb: 'Weights each alternative’s payoffs by the probability of each outcome and picks the best average.',
  keywords: ['expected value', 'emv', 'expected monetary value', 'decision under risk', 'payoff table', 'expected payoff'],
  symptoms: ['which option is best on average', 'decision with probabilities', 'risky decision', 'weigh the outcomes'],
  formula: () => `EMV_i = \\sum_j P_j \\times ${tx('Payoff')}_{ij}`,
  inputs: [payoffIn(), nIn(), probIn(), senseIn()],
  outputs: [out('best', 'Best expected value', { primary: true, dp: 2 }), out('bestIdx', 'Best alternative number', { fmt: 'int' }), out('evwpi', 'Expected value with perfect information', { dp: 2 }), out('evpi', 'Expected value of perfect information', { dp: 2 })],
  check: probCheck, compute: evCore,
  steps: (v, o, c) => [
    { title: 'Multiply each payoff by its probability and add across states', tex: `EMV_i = \\sum_j P_j \\times ${tx('Payoff')}_{ij}`, why: 'The expected value is the long-run average payoff if the same decision were faced many times.', eli: 'If a coin flip pays $10 for heads and $0 for tails, it is worth $5 on average.', table: evTable(v, o, c) },
    { title: `Choose the ${v.sense === 'min' ? 'lowest expected cost' : 'highest expected value'}`, tex: `${tx(altName(v, o.bestIdx - 1))}: \; EMV = ${c.f.t(o.best, 2)}`, why: 'The best alternative under risk is the one with the best expected value.' },
  ],
  biz: (v, o, f) => ({ headline: `"${altName(v, o.bestIdx - 1)}" is the best bet, with an expected ${v.sense === 'min' ? 'cost' : 'payoff'} of ${f.num(o.best, 0)}.`, meaning: [`Expected values: ${M(v).map((_, i) => `${altName(v, i)} ${f.num(o.emv[i], 0)}`).join(', ')}.`, 'This is an average over many repetitions. Any single outcome can be better or worse.', `Perfect advance knowledge of the outcome would be worth up to ${f.num(o.evpi, 0)}.`], actions: ['Check the worst case for the chosen option: can the business survive it?', 'Nudge the probabilities to see how sure you must be before the answer changes.', 'Before paying for research or a forecast, compare its price with the value of perfect information.'] }),
  viz: (v, o) => payoffViz(v, M(v), o.bestIdx - 1, o.emv.map((x: number) => 'EMV ' + Math.round(x * 100) / 100)),
  traps: ['Probabilities must add to 1.', 'Expected value is not the payoff you will actually receive. It is an average.', 'For cost tables, choose the lowest expected value, not the highest.'],
  analogy: 'A lottery ticket’s fair price: each prize times its chance of winning, added together.',
  examples: [
    { title: 'New plant decision', story: 'A large plant earns $200,000 in a favorable market and loses $180,000 in an unfavorable one. A small plant earns $100,000 or loses $20,000. Doing nothing earns $0. Each market is equally likely.', v: { payoffs: GETZ, nStates: 2, probs: [0.5, 0.5] }, expect: { best: 40000, bestIdx: 2, evwpi: 100000, evpi: 60000 } },
    { title: 'Three states', story: 'Alternatives A (50, 20, −10), B (35, 25, 5), C (10, 10, 10) with probabilities 0.3, 0.5, 0.2.', v: { payoffs: THREE, nStates: 3, probs: [0.3, 0.5, 0.2] }, expect: { best: 24, bestIdx: 2, evpi: 5.5 } },
  ],
  practice: { ask: ['best'], gen: (r) => ({ nStates: 2, sense: 'max', probs: [[0.6, 0.4], [0.5, 0.5], [0.7, 0.3], [0.3, 0.7]][Math.floor(r() * 4)], payoffs: [{ alt: 'Expand', s1: (10 + Math.floor(r() * 20)) * 10, s2: -(2 + Math.floor(r() * 15)) * 10, s3: 0, s4: 0 }, { alt: 'Stay small', s1: (3 + Math.floor(r() * 8)) * 10, s2: -(Math.floor(r() * 3)) * 10, s3: 0, s4: 0 }, { alt: 'Do nothing', s1: 0, s2: 0, s3: 0, s4: 0 }] }), prompt: (v) => `Payoffs (strong market, weak market): ${v.payoffs.map((p: any) => `${p.alt} (${p.s1}, ${p.s2})`).join('; ')}. The probability of a strong market is ${v.probs[0]}. What is the best expected monetary value?` },
  gen: genTable, uses: [],
  claim: 'The alternative with the best EMV earns the best average payoff over simulated repetitions.',
});

export const evpi: CalcDef = calc({
  id: 'evpi', name: 'Expected Value of Perfect Information (EVPI)', short: 'EVPI', cat: CAT,
  bq: 'How much is better information worth before I decide?',
  blurb: 'The most you should pay for a perfect forecast: expected value with perfect information minus the best expected value without it.',
  keywords: ['evpi', 'expected value of perfect information', 'value of information', 'evwpi', 'perfect information', 'market research value'],
  symptoms: ['should i pay for market research', 'what is a forecast worth', 'value of knowing in advance'],
  formula: () => `EVPI = EVwPI - \\max EMV`,
  inputs: [payoffIn(), nIn(), probIn(), senseIn()],
  outputs: [out('evpi', 'EVPI', { primary: true, dp: 2 }), out('evwpi', 'Expected value with perfect information', { dp: 2 }), out('best', 'Best EMV without information', { dp: 2 }), out('bestIdx', 'Best alternative number', { fmt: 'int' })],
  check: probCheck, compute: evCore,
  steps: (v, o, c) => [
    { title: 'Best expected value without information', tex: `${v.sense === 'min' ? '\\min' : '\\max'} EMV = ${c.f.t(o.best, 2)}`, why: 'This is what you can expect if you must decide before knowing which state will occur.', table: evTable(v, o, c) },
    { title: 'Expected value with perfect information', tex: `EVwPI = \\sum_j P_j \\times ${tx('best payoff in state ')} j = ${o.colBest.map((x: number, j: number) => `${c.f.t(v.probs[j])}(${c.f.t(x)})`).join(' + ')} = ${c.f.t(o.evwpi, 2)}`, why: 'If you knew the state in advance, you would pick the best alternative for that state every time. Average those best payoffs by how often each state happens.', eli: 'If you always knew tomorrow’s weather, you would always pack the right thing. How much better off would you be on average?' },
    { title: 'Subtract', tex: `EVPI = ${v.sense === 'min' ? `${c.f.t(o.best, 2)} - ${c.f.t(o.evwpi, 2)}` : `${c.f.t(o.evwpi, 2)} - ${c.f.t(o.best, 2)}`} = ${c.f.t(o.evpi, 2)}`, why: 'The improvement that perfect information would bring. No forecast, survey, or consultant is worth more than this.' },
  ],
  biz: (v, o, f) => ({ headline: `Never pay more than ${f.num(o.evpi, 0)} for information about this decision.`, meaning: [`Without extra information, your best expected ${v.sense === 'min' ? 'cost' : 'payoff'} is ${f.num(o.best, 0)} ("${altName(v, o.bestIdx - 1)}").`, `With a perfect forecast it would be ${f.num(o.evwpi, 0)}.`, 'Real research is imperfect, so it is worth less than this ceiling.'], actions: [o.evpi === 0 ? 'Information has no value here: one alternative is best in every state.' : 'Get quotes for research and compare them with this ceiling.', 'Cheap, quick information (a pilot, a pre-order page) often captures much of the value.'] }),
  viz: (v, o) => payoffViz(v, M(v), o.bestIdx - 1, o.emv.map((x: number) => 'EMV ' + Math.round(x * 100) / 100)),
  traps: ['EVwPI uses the best payoff in each column (state), not each row.', 'EVPI is never negative.', 'EVPI is the value of perfect information. Imperfect (sample) information is worth less.'],
  analogy: 'What you would pay a fortune teller who is always right, before placing a bet.',
  examples: [
    { title: 'New plant decision', story: 'Large plant: $200,000 or −$180,000. Small plant: $100,000 or −$20,000. Do nothing: $0. Favorable and unfavorable markets are equally likely.', v: { payoffs: GETZ, nStates: 2, probs: [0.5, 0.5] }, expect: { evwpi: 100000, best: 40000, evpi: 60000 } },
    { title: 'Three states', story: 'A (50, 20, −10), B (35, 25, 5), C (10, 10, 10) with probabilities 0.3, 0.5, 0.2.', v: { payoffs: THREE, nStates: 3, probs: [0.3, 0.5, 0.2] }, expect: { evwpi: 29.5, best: 24, evpi: 5.5 } },
  ],
  practice: { ask: ['evpi'], gen: (r) => ({ nStates: 2, sense: 'max', probs: [[0.6, 0.4], [0.5, 0.5], [0.7, 0.3]][Math.floor(r() * 3)], payoffs: [{ alt: 'Expand', s1: (10 + Math.floor(r() * 20)) * 10, s2: -(2 + Math.floor(r() * 15)) * 10, s3: 0, s4: 0 }, { alt: 'Stay small', s1: (3 + Math.floor(r() * 8)) * 10, s2: -(Math.floor(r() * 3)) * 10, s3: 0, s4: 0 }, { alt: 'Do nothing', s1: 0, s2: 0, s3: 0, s4: 0 }] }), prompt: (v) => `Payoffs (strong market, weak market): ${v.payoffs.map((p: any) => `${p.alt} (${p.s1}, ${p.s2})`).join('; ')}. The probability of a strong market is ${v.probs[0]}. What is the expected value of perfect information?` },
  gen: genTable, uses: ['expected-value'],
  claim: 'EVPI equals the average gain from knowing the state in advance, over simulated repetitions.',
});

export const decisionCriteria: CalcDef = calc({
  id: 'decision-criteria', name: 'Maximax, Maximin, and Minimax Regret', short: 'Decision criteria', cat: CAT,
  bq: 'What should I choose when I cannot put odds on the outcomes?',
  blurb: 'Decision rules for when probabilities are unknown: optimistic (maximax), pessimistic (maximin), equally likely, Hurwicz, and minimax regret.',
  keywords: ['maximax', 'maximin', 'minimax regret', 'decision under uncertainty', 'laplace', 'equally likely', 'hurwicz', 'opportunity loss', 'regret table', 'minimin', 'minimax'],
  symptoms: ['no idea of the probabilities', 'decide without odds', 'best case worst case', 'avoid regret'],
  formula: () => `${tx('Regret')}_{ij} = \\max_i(${tx('Payoff')}_{ij}) - ${tx('Payoff')}_{ij}`,
  inputs: [payoffIn(), nIn(), senseIn(), num('alpha', { sym: '\\alpha', label: 'Hurwicz coefficient of optimism', blabel: 'How optimistic you are (0 to 1)', def: 0.5, min: 0, max: 1, step: 0.05, adv: true, sens: true, cues: ['coefficient of realism', 'coefficient of optimism', 'alpha'] })],
  outputs: [out('regretIdx', 'Minimax regret choice', { fmt: 'int', primary: true }), out('regretVal', 'Its maximum regret', {}), out('maximaxIdx', 'Maximax (optimistic) choice', { fmt: 'int' }), out('maximaxVal', 'Its best payoff', {}), out('maximinIdx', 'Maximin (pessimistic) choice', { fmt: 'int' }), out('maximinVal', 'Its worst payoff', {}), out('laplaceIdx', 'Equally likely choice', { fmt: 'int' }), out('laplaceVal', 'Its average payoff', { dp: 2 }), out('hurwiczIdx', 'Hurwicz choice', { fmt: 'int' }), out('hurwiczVal', 'Its weighted payoff', { dp: 2 })],
  compute: (v) => {
    const m = M(v), s = sgn(v); const rowBest = m.map((r) => s * Math.max(...r.map((x) => s * x))), rowWorst = m.map((r) => s * Math.min(...r.map((x) => s * x))), avg = m.map((r) => sum(r) / r.length);
    const colBest = Array.from({ length: v.nStates }, (_, j) => s * Math.max(...m.map((r) => s * r[j]))); const regret = m.map((r) => r.map((x, j) => s * (colBest[j] - x))); const maxReg = regret.map((r) => Math.max(...r));
    const hur = rowBest.map((b, i) => v.alpha * b + (1 - v.alpha) * rowWorst[i]);
    const a = argBest(rowBest, s), b = argBest(rowWorst, s), l = argBest(avg, s), h = argBest(hur, s), g = argBest(maxReg, -1);
    return { rowBest, rowWorst, avg, maxReg, hur, regret, maximaxIdx: a + 1, maximaxVal: rowBest[a], maximinIdx: b + 1, maximinVal: rowWorst[b], laplaceIdx: l + 1, laplaceVal: avg[l], hurwiczIdx: h + 1, hurwiczVal: hur[h], regretIdx: g + 1, regretVal: maxReg[g] };
  },
  steps: (v, o, c) => { const m = M(v), cost = v.sense === 'min'; return [
    { title: cost ? 'Optimistic (minimin): best of the best outcomes' : 'Maximax: best of the best outcomes', why: `Find each alternative’s best ${cost ? 'cost' : 'payoff'}, then pick the best of those. This is the optimist’s rule.`, eli: 'Assume everything goes right and choose what pays most.', table: { columns: ['Alternative', cost ? 'Lowest cost' : 'Best payoff', cost ? 'Highest cost' : 'Worst payoff', 'Average', 'Hurwicz', 'Maximum regret'], rows: m.map((_, i) => [altName(v, i), c.f.num(o.rowBest[i]), c.f.num(o.rowWorst[i]), c.f.num(o.avg[i], 2), c.f.num(o.hur[i], 2), c.f.num(o.maxReg[i])]) } },
    { title: cost ? 'Pessimistic (minimax): best of the worst outcomes' : 'Maximin: best of the worst outcomes', tex: `${tx(altName(v, o.maximinIdx - 1))}: ${c.f.t(o.maximinVal)}`, why: `Find each alternative’s worst ${cost ? 'cost' : 'payoff'}, then pick the best of those. This is the pessimist’s rule.`, eli: 'Assume everything goes wrong and choose what hurts least.' },
    { title: 'Equally likely (Laplace) and Hurwicz', tex: `${tx(altName(v, o.laplaceIdx - 1))}: ${c.f.t(o.laplaceVal, 2)}, \\quad ${tx(altName(v, o.hurwiczIdx - 1))}: \\alpha(${tx('best')}) + (1-\\alpha)(${tx('worst')}) = ${c.f.t(o.hurwiczVal, 2)}`, why: 'Laplace treats every state as equally likely and averages. Hurwicz blends the best and worst outcomes with a coefficient of optimism α.' },
    { title: 'Minimax regret', tex: `${tx('Regret')}_{ij} = ${cost ? `${tx('Cost')}_{ij} - \\min_i ${tx('Cost')}_{ij}` : `\\max_i ${tx('Payoff')}_{ij} - ${tx('Payoff')}_{ij}`}`, why: 'Regret is how much worse an alternative is than the best choice for that state. Find each alternative’s largest regret and choose the smallest.', eli: 'Pick the option you would kick yourself least over, whatever happens.', table: { columns: ['Alternative', ...Array.from({ length: v.nStates }, (_, j) => `Regret, state ${j + 1}`), 'Maximum regret'], rows: m.map((_, i) => [altName(v, i), ...o.regret[i].map((x: number) => c.f.num(x)), c.f.num(o.maxReg[i])]), highlight: [o.regretIdx - 1] } },
  ]; },
  biz: (v, o, f) => { const picks = [o.maximaxIdx, o.maximinIdx, o.laplaceIdx, o.regretIdx]; const agree = picks.every((p) => p === picks[0]); return { headline: agree ? `Every rule points to "${altName(v, picks[0] - 1)}".` : `It depends on your attitude to risk: "${altName(v, o.regretIdx - 1)}" minimizes regret, "${altName(v, o.maximinIdx - 1)}" is the cautious choice, "${altName(v, o.maximaxIdx - 1)}" is the bold one.`, meaning: [`Optimistic: ${altName(v, o.maximaxIdx - 1)}. Cautious: ${altName(v, o.maximinIdx - 1)}. Equally likely: ${altName(v, o.laplaceIdx - 1)}. Least regret: ${altName(v, o.regretIdx - 1)}.`, agree ? 'When all rules agree, the decision is robust.' : 'The rules disagree, so the choice is really about how much risk you can afford.'], actions: ['If a bad outcome could sink the business, follow the cautious rule.', 'If you can estimate even rough probabilities, switch to the Expected Value calculator.', 'Minimax regret is a good default when you will be judged in hindsight.'] }; },
  viz: (v, o) => payoffViz(v, o.regret, o.regretIdx - 1, o.maxReg.map((x: number) => 'Max regret ' + Math.round(x * 100) / 100)),
  traps: ['Regret is computed column by column (per state), not row by row.', 'Maximin picks the best of the worst payoffs, not the worst of the best.', 'For cost tables every rule flips: minimin, minimax, and regret = cost − column minimum.'],
  analogy: 'Choosing whether to carry an umbrella with no forecast: the optimist leaves it, the pessimist takes it, and the regret-minimizer asks which mistake would annoy them more.',
  examples: [
    { title: 'New plant decision', story: 'Large plant: $200,000 or −$180,000. Small plant: $100,000 or −$20,000. Do nothing: $0 either way.', v: { payoffs: GETZ, nStates: 2 }, expect: { maximaxIdx: 1, maximaxVal: 200000, maximinIdx: 3, maximinVal: 0, laplaceIdx: 2, laplaceVal: 40000, regretIdx: 2, regretVal: 100000 } },
    { title: 'Three states', story: 'A (50, 20, −10), B (35, 25, 5), C (10, 10, 10).', v: { payoffs: THREE, nStates: 3 }, expect: { maximaxIdx: 1, maximinIdx: 3, maximinVal: 10, regretIdx: 2, regretVal: 15 } },
  ],
  practice: { ask: ['regretVal'], gen: (r) => ({ nStates: 2, sense: 'max', alpha: 0.5, payoffs: [{ alt: 'Expand', s1: (10 + Math.floor(r() * 20)) * 10, s2: -(2 + Math.floor(r() * 15)) * 10, s3: 0, s4: 0 }, { alt: 'Stay small', s1: (3 + Math.floor(r() * 8)) * 10, s2: -(Math.floor(r() * 3)) * 10, s3: 0, s4: 0 }, { alt: 'Do nothing', s1: 0, s2: 0, s3: 0, s4: 0 }] }), prompt: (v) => `Payoffs (strong market, weak market): ${v.payoffs.map((p: any) => `${p.alt} (${p.s1}, ${p.s2})`).join('; ')}. Using the minimax regret criterion, what is the maximum regret of the chosen alternative?` },
  gen: (r) => { const t = genTable(r); return { nStates: t.nStates, sense: t.sense, payoffs: t.payoffs, alpha: +r().toFixed(2) }; },
  uses: ['expected-value'],
});

export interface TreeNode { id: string; type: 'decision' | 'chance' | 'end'; label: string; prob?: number; payoff?: number; cost?: number; children?: TreeNode[] }
const leaf = (id: string, label: string, prob: number | undefined, payoff: number): TreeNode => ({ id, type: 'end', label, prob, payoff });
const GETZ_TREE: TreeNode = { id: 'root', type: 'decision', label: 'Build?', children: [
  { id: 'L', type: 'chance', label: 'Large plant', children: [leaf('L1', 'Favorable market', 0.5, 200000), leaf('L2', 'Unfavorable market', 0.5, -180000)] },
  { id: 'S', type: 'chance', label: 'Small plant', children: [leaf('S1', 'Favorable market', 0.5, 100000), leaf('S2', 'Unfavorable market', 0.5, -20000)] },
  leaf('N', 'Do nothing', undefined, 0)] };
const TEST_TREE: TreeNode = { id: 'root', type: 'decision', label: 'Launch plan', children: [
  { id: 'B', type: 'chance', label: 'Build now', children: [leaf('B1', 'Strong demand', 0.6, 100), leaf('B2', 'Weak demand', 0.4, -40)] },
  { id: 'T', type: 'chance', label: 'Test first', cost: 5, children: [
    { id: 'TP', type: 'decision', label: 'Positive test', prob: 0.7, children: [{ id: 'TPB', type: 'chance', label: 'Build', children: [leaf('TPB1', 'Strong demand', 0.8, 100), leaf('TPB2', 'Weak demand', 0.2, -40)] }, leaf('TPS', 'Stop', undefined, 0)] },
    { id: 'TN', type: 'decision', label: 'Negative test', prob: 0.3, children: [{ id: 'TNB', type: 'chance', label: 'Build', children: [leaf('TNB1', 'Strong demand', 0.2, 100), leaf('TNB2', 'Weak demand', 0.8, -40)] }, leaf('TNS', 'Stop', undefined, 0)] }] }] };
export function rollback(n: TreeNode, s = 1): { value: number; viz: TreeViz; rows: [string, string, number][] } {
  const cost = n.cost ?? 0;
  if (n.type === 'end' || !n.children?.length) { const value = (n.payoff ?? 0) - cost; return { value, viz: { id: n.id, type: 'end', label: n.label, value, prob: n.prob }, rows: [] }; }
  const kids = n.children.map((c) => rollback(c, s)); let value: number; let bestK = -1;
  if (n.type === 'chance') value = sum(kids.map((k, i) => (n.children![i].prob ?? 0) * k.value));
  else { bestK = kids.reduce((b, k, i) => (s * k.value > s * kids[b].value + 1e-12 ? i : b), 0); value = kids[bestK].value; }
  value -= cost;
  return { value, viz: { id: n.id, type: n.type, label: n.label, value, prob: n.prob, children: kids.map((k, i) => ({ ...k.viz, best: i === bestK })) }, rows: [...kids.flatMap((k) => k.rows), [n.label, n.type === 'chance' ? 'Chance: probability-weighted average' : `Decision: choose "${n.children[bestK].label}"`, value]] };
}
export function treeError(n: TreeNode, isRoot = true): string | null {
  if (!n || typeof n !== 'object' || !['decision', 'chance', 'end'].includes(n.type)) return isRoot ? 'The decision tree is empty. Add a decision or chance node to start.' : 'A branch of the tree is incomplete.';
  const name = n.label || 'This node';
  if (n.type === 'end') return typeof n.payoff !== 'number' || !Number.isFinite(n.payoff) ? `Outcome "${name}" needs a payoff.` : null;
  if (!n.children?.length) return `"${name}" needs at least one branch.`;
  if (n.type === 'chance') { const ps = n.children.map((c) => c.prob ?? NaN); if (ps.some((p) => !(p >= 0 && p <= 1))) return `Every branch of chance node "${name}" needs a probability between 0 and 1.`; const t = sum(ps); if (Math.abs(t - 1) > 1e-6) return `Probabilities at "${name}" must add to 1. They add to ${Number(t.toFixed(6))}.`; }
  for (const c of n.children) { const e = treeError(c, false); if (e) return e; }
  return null;
}
const genTree = (r: Rng, depth = 0, id = 'n'): TreeNode => {
  if (depth >= 3 || (depth > 0 && r() < 0.3)) return { id, type: 'end', label: id, payoff: Math.round((r() - 0.3) * 300) };
  const type = depth === 0 ? 'decision' : r() < 0.6 ? 'chance' : 'decision'; const k = 2 + Math.floor(r() * 2);
  const children = Array.from({ length: k }, (_, i) => genTree(r, depth + 1, `${id}${i}`));
  if (type === 'chance') { const raw = children.map(() => 0.1 + r()); const t = sum(raw); let acc = 0; children.forEach((c, i) => { c.prob = i === k - 1 ? +(1 - acc).toFixed(4) : +(raw[i] / t).toFixed(2); acc += c.prob!; }); }
  return { id, type, label: id, cost: r() < 0.2 ? Math.round(r() * 20) : 0, children };
};
export const decisionTree: CalcDef = calc({
  id: 'decision-tree', name: 'Decision Tree', short: 'Decision tree', cat: CAT,
  bq: 'What is the best sequence of decisions when outcomes are uncertain?',
  blurb: 'Build a tree of decisions and chance events, then roll it back to find the expected value and the best choice at every decision point.',
  keywords: ['decision tree', 'rollback', 'fold back', 'sequential decisions', 'chance node', 'decision node', 'expected value tree', 'evsi'],
  symptoms: ['multi-step decision', 'decide now or wait', 'test first or launch', 'sequence of choices'],
  formula: () => `EV(${tx('chance node')}) = \\sum_j P_j \\, EV_j, \\quad EV(${tx('decision node')}) = \\max_k EV_k`,
  inputs: [{ id: 'tree', kind: 'tree', label: 'Decision tree', def: GETZ_TREE, help: 'Squares are decisions (you choose), circles are chance events (probabilities must add to 1), and triangles are final outcomes with a payoff. Costs on a branch are subtracted.' } as InputDef, senseIn()],
  outputs: [out('emv', 'Expected value of the best strategy', { primary: true, dp: 2 }), out('bestIdx', 'Best first choice (branch number)', { fmt: 'int' }), out('nodes', 'Nodes in the tree', { fmt: 'int' })],
  check: (v) => treeError(v.tree),
  compute: (v) => { const s = sgn(v); const rb = rollback(v.tree, s); const count = (n: TreeNode): number => 1 + sum((n.children ?? []).map(count)); const kids = v.tree.type === 'decision' ? (v.tree.children as TreeNode[]).map((c2) => rollback(c2, s).value) : []; return { emv: rb.value, bestIdx: kids.length ? argBest(kids, s) + 1 : 0, nodes: count(v.tree) }; },
  steps: (v, o, c) => { const rb = rollback(v.tree, sgn(v)); return [
    { title: 'Start at the outcomes and work backward', why: 'Each end node has a known payoff. Roll the tree back from right to left.', eli: 'Plan a trip backward: work out the best move from each possible situation at the end, then step back one choice at a time.' },
    { title: 'At chance nodes take the expected value; at decision nodes take the best branch', tex: `EV(${tx('chance')}) = \\sum_j P_j \\, EV_j, \\quad EV(${tx('decision')}) = ${v.sense === 'min' ? '\\min' : '\\max'}_k EV_k`, why: 'You do not control chance nodes, so average their branches by probability. You do control decision nodes, so pick the best branch and prune the others. Branch costs are subtracted where they occur.', table: { columns: ['Node', 'Rule applied', 'Value'], rows: rb.rows.map(([a, b, x]) => [a, b, c.f.num(x, 2)]) } },
    { title: 'Read off the best strategy', tex: `EV = ${c.f.t(o.emv, 2)}`, why: o.bestIdx ? `The best first move is "${(v.tree.children as TreeNode[])[o.bestIdx - 1].label}". Follow the highlighted branches for the rest of the strategy.` : 'The root is a chance node, so its value is the probability-weighted average of its branches.' },
  ]; },
  biz: (v, o, f) => ({ headline: o.bestIdx ? `Start with "${(v.tree.children as TreeNode[])[o.bestIdx - 1].label}". That strategy is worth ${f.num(o.emv, 0)} on average.` : `This situation is worth ${f.num(o.emv, 0)} on average.`, meaning: ['The highlighted branches show what to do at each later decision point, depending on how events unfold.', 'The value is a long-run average, not a guarantee.'], actions: ['Check the worst path through the chosen strategy: could you absorb it?', 'Change the probabilities you are least sure of and see whether the first move changes.', 'If the first move is to gather information, the gain over deciding now is what that information is worth.'] }),
  viz: (v) => ({ kind: 'tree', root: rollback(v.tree, sgn(v)).viz }),
  traps: ['Work from right to left (rollback), not left to right.', 'Probabilities on the branches of each chance node must add to 1.', 'Subtract costs (such as a survey fee) at the branch where they are incurred.', 'Do not average at decision nodes. Choose the best branch.'],
  analogy: 'A choose-your-own-adventure book read backward: you find the best ending first, then trace which choices lead to it.',
  examples: [
    { title: 'New plant decision', story: 'Build a large plant (50% chance of $200,000, 50% chance of −$180,000), a small plant (50% chance of $100,000, 50% chance of −$20,000), or do nothing ($0).', v: { tree: GETZ_TREE }, expect: { emv: 40000, bestIdx: 2 } },
    { title: 'Test before launching', story: 'Build now (60% chance of 100, 40% chance of −40), or pay 5 to test first. A positive test (70%) makes strong demand 80% likely; a negative test (30%) makes it 20% likely. After the test you can build or stop.', v: { tree: TEST_TREE }, expect: { emv: 45.4, bestIdx: 2 } },
  ],
  practice: { ask: ['emv'], gen: (r) => { const p = [0.4, 0.5, 0.6, 0.7][Math.floor(r() * 4)]; const hi = (10 + Math.floor(r() * 20)) * 10, lo = -(2 + Math.floor(r() * 10)) * 10; const hi2 = (4 + Math.floor(r() * 6)) * 10; return { sense: 'max', tree: { id: 'root', type: 'decision', label: 'Choose', children: [{ id: 'a', type: 'chance', label: 'Big launch', children: [leaf('a1', 'High demand', p, hi), leaf('a2', 'Low demand', +(1 - p).toFixed(2), lo)] }, { id: 'b', type: 'chance', label: 'Small launch', children: [leaf('b1', 'High demand', p, hi2), leaf('b2', 'Low demand', +(1 - p).toFixed(2), 0)] }, leaf('c', 'Do nothing', undefined, 0)] } }; }, prompt: (v) => { const k = v.tree.children; return `A firm can do a big launch (${k[0].children[0].prob} chance of ${k[0].children[0].payoff}, otherwise ${k[0].children[1].payoff}), a small launch (${k[1].children[0].prob} chance of ${k[1].children[0].payoff}, otherwise 0), or do nothing (0). What is the expected value of the best decision?`; } },
  gen: (r) => ({ tree: genTree(r), sense: r() < 0.8 ? 'max' : 'min' }),
  uses: ['expected-value', 'evpi'],
  claim: 'The rollback value equals the average payoff of the optimal strategy over simulated paths through the tree.',
});

export default [expectedValue, decisionTree, evpi, decisionCriteria];
