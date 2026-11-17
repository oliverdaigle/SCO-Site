// Logistics, network design, and sourcing.
import { calc, num, money, pct, int, sel, table, col, out, fr, tx } from '../dsl';
import { sum, type Rng } from '../math/util';
import type { CalcDef, Vals } from '../types';

const CAT = 'logistics';

export const landedCost: CalcDef = calc({
  id: 'landed-cost', name: 'Landed Cost', short: 'Landed cost', cat: CAT,
  bq: 'What does an imported product really cost me per unit?',
  blurb: 'Total cost to get a product to your door: purchase price plus freight, insurance, duties, and fees.',
  keywords: ['landed cost', 'total landed cost', 'import cost', 'duty', 'tariff', 'customs', 'freight', 'cif', 'fob', 'cost per unit delivered'],
  symptoms: ['what does importing really cost', 'true cost per unit', 'tariff impact', 'is the overseas supplier actually cheaper'],
  formula: () => `${tx('Landed cost')} = ${tx('Product')} + ${tx('Freight')} + ${tx('Insurance')} + ${tx('Duty')} + ${tx('Fees')}`,
  inputs: [money('price', { label: 'Unit price (FOB)', blabel: 'Price per unit from the supplier', def: 12, rand: [2, 200, 1], sens: true, cues: ['unit price', 'fob price', 'price per unit', 'costs'] }), num('units', { label: 'Units in the shipment', blabel: 'Units in this shipment', unit: 'units', def: 1000, min: 0.0001, rand: [100, 5000, 100], sens: true, cues: ['units', 'shipment of'] }),
    money('freight', { label: 'Freight (total)', blabel: 'Shipping cost for the whole shipment', def: 1500, rand: [200, 8000, 100], sens: true, cues: ['freight', 'shipping'] }), money('insurance', { label: 'Insurance (total)', def: 100, rand: [0, 500, 50], cues: ['insurance'] }),
    pct('duty', { label: 'Duty rate', blabel: 'Import duty / tariff rate', def: 5, max: 500, rand: [0, 30, 2.5], sens: true, cues: ['duty', 'tariff'] }), sel('dutyBase', 'Duty is charged on', [['fob', 'Product value only (FOB, US practice)'], ['cif', 'Product + freight + insurance (CIF)']], 'fob', { adv: true }),
    money('fees', { label: 'Customs, brokerage, and port fees (total)', blabel: 'Broker and port fees', def: 250, rand: [0, 1000, 50], cues: ['brokerage', 'customs fees', 'port fees'] }), money('other', { label: 'Other costs (total)', blabel: 'Anything else: inland trucking, handling, bank fees', def: 150, rand: [0, 1500, 50], cues: ['handling', 'inland', 'other'] })],
  outputs: [out('perUnit', 'Landed cost per unit', { fmt: 'money', dp: 2, primary: true }), out('total', 'Total landed cost', { fmt: 'money' }), out('dutyAmt', 'Duty paid', { fmt: 'money' }), out('uplift', 'Added on top of the unit price', { fmt: 'pct' })],
  compute: (v) => { const product = v.price * v.units; const dutyAmt = (v.duty / 100) * (v.dutyBase === 'cif' ? product + v.freight + v.insurance : product); const total = product + v.freight + v.insurance + dutyAmt + v.fees + v.other; return { product, dutyAmt, total, perUnit: total / v.units, uplift: product > 0 ? ((total - product) / product) * 100 : 0 }; },
  steps: (v, o, c) => [
    { title: 'Product cost', tex: `${c.f.t(v.price)} \\times ${c.f.t(v.units)} = ${c.f.money(o.product)}`, why: 'Start with what you pay the supplier.' },
    { title: 'Duty', tex: `${c.f.t(v.duty / 100, 4)} \\times ${c.f.t(v.dutyBase === 'cif' ? o.product + v.freight + v.insurance : o.product)} = ${c.f.money(o.dutyAmt, 2)}`, why: v.dutyBase === 'cif' ? 'Duty is assessed on the CIF value: product plus freight plus insurance.' : 'Duty is assessed on the product (FOB) value.' },
    { title: 'Add everything it takes to land the goods', tex: `${c.f.t(o.product)} + ${c.f.t(v.freight)} + ${c.f.t(v.insurance)} + ${c.f.t(o.dutyAmt)} + ${c.f.t(v.fees)} + ${c.f.t(v.other)} = ${c.f.money(o.total, 2)}`, why: 'Landed cost includes every cost up to the point the goods are in your building.', eli: 'The sticker price is not what you pay. Add delivery, insurance, taxes, and paperwork.' },
    { title: 'Per unit', tex: `${fr(c.f.t(o.total), c.f.t(v.units))} = ${c.f.money(o.perUnit, 2)}`, why: 'Spread the total over the units received. This, not the supplier price, is your true unit cost.' },
  ],
  biz: (v, o, f) => ({ headline: `Each unit really costs you ${f.money(o.perUnit, 2)}, not ${f.money(v.price, 2)}.`, meaning: [`Shipping, duty, and fees add ${f.pct(o.uplift, 0)} on top of the supplier price.`, `Duty alone is ${f.money(o.dutyAmt)} on this shipment.`, `Total for the shipment: ${f.money(o.total)}.`], actions: ['Price your product from the landed cost, not the supplier quote.', 'Compare suppliers on landed cost: a cheaper quote from farther away can lose.', 'Larger shipments spread fixed fees over more units. Check the trade-off with holding cost.'] }),
  viz: (v, o) => ({ kind: 'stack', unit: '$', bars: [{ label: 'Per unit', parts: [{ name: 'Product', value: v.price, tone: 'accent' }, { name: 'Freight', value: v.freight / v.units, tone: 'alt' }, { name: 'Insurance', value: v.insurance / v.units, tone: 'alt2' }, { name: 'Duty', value: o.dutyAmt / v.units, tone: 'warn' }, { name: 'Fees & other', value: (v.fees + v.other) / v.units, tone: 'muted' }] }] }),
  traps: ['Duty base differs by country: FOB value in the US, CIF value in most other places.', 'Freight and fees are usually per shipment. Divide by units to get the per-unit effect.'],
  analogy: 'Buying a couch online: the price tag, plus delivery, plus tax, plus the fee to carry it upstairs.',
  examples: [
    { title: 'Container of housewares', story: '1,000 units at $12 each. Freight $1,500, insurance $100, duty 5% on product value, broker fees $250, other costs $150.', v: { price: 12, units: 1000, freight: 1500, insurance: 100, duty: 5, fees: 250, other: 150 }, expect: { total: 14600, perUnit: 14.6, dutyAmt: 600 } },
    { title: 'Duty on CIF value', story: '500 units at $40. Freight $2,000, insurance $200, duty 10% on CIF value, fees $300.', v: { price: 40, units: 500, freight: 2000, insurance: 200, duty: 10, dutyBase: 'cif', fees: 300, other: 0 }, expect: { dutyAmt: 2220, total: 24720, perUnit: 49.44 } },
  ],
  practice: { ask: ['perUnit'], prompt: (v, f) => `A shipment of ${f.int(v.units)} units costs ${f.money(v.price)} per unit. Freight is ${f.money(v.freight)}, insurance ${f.money(v.insurance)}, duty is ${f.pct(v.duty)} of product value, brokerage fees are ${f.money(v.fees)}, and other costs are ${f.money(v.other)}. What is the landed cost per unit?` },
  uses: ['freight-cost'], mono: [['duty', 'perUnit', 1], ['freight', 'perUnit', 1]],
});

const COG = [{ name: 'Chicago', x: 30, y: 120, w: 2000 }, { name: 'Pittsburgh', x: 90, y: 110, w: 1000 }, { name: 'New York', x: 130, y: 130, w: 1000 }, { name: 'Atlanta', x: 60, y: 40, w: 2000 }];
const ptsTable = (def: any[]) => table('points', 'Locations served', [col('name', 'Location', 'text'), col('x', 'X coordinate'), col('y', 'Y coordinate'), col('w', 'Volume (load)')], def, { minRows: 1, help: 'Coordinates can be map grid positions, miles, or latitude/longitude. Drag the points on the chart to move them.' });
const genPts = (r: Rng) => Array.from({ length: 2 + Math.floor(r() * 8) }, (_, i) => ({ name: `P${i + 1}`, x: Math.floor(r() * 200), y: Math.floor(r() * 200), w: 1 + Math.floor(r() * 3000) }));
export const centerOfGravity: CalcDef = calc({
  id: 'center-of-gravity', name: 'Center of Gravity Method', short: 'Center of gravity', cat: CAT,
  bq: 'Where should my warehouse go?',
  blurb: 'The volume-weighted average location of the points a facility must serve: a starting point for siting a warehouse.',
  keywords: ['center of gravity', 'centroid method', 'warehouse location', 'facility location', 'distribution center location', 'weighted average location'],
  symptoms: ['where should my warehouse go', 'best location for a distribution center', 'where to locate', 'new facility location'],
  formula: () => `C_x = ${fr('\\sum x_i Q_i', '\\sum Q_i')}, \\quad C_y = ${fr('\\sum y_i Q_i', '\\sum Q_i')}`,
  inputs: [ptsTable(COG)],
  outputs: [out('cx', 'X coordinate', { sym: 'C_x', dp: 2, primary: true }), out('cy', 'Y coordinate', { sym: 'C_y', dp: 2, primary: true }), out('totalW', 'Total volume', {}), out('ld', 'Load-distance at this point (straight-line)', {})],
  check: (v) => ((v.points as any[]).some((p) => p.w < 0) ? 'Volumes cannot be negative.' : sum((v.points as any[]).map((p) => p.w)) <= 0 ? 'Total volume must be greater than zero.' : null),
  compute: (v) => { const P = v.points as any[]; const W = sum(P.map((p) => p.w)); const cx = sum(P.map((p) => p.x * p.w)) / W, cy = sum(P.map((p) => p.y * p.w)) / W; return { cx, cy, totalW: W, ld: sum(P.map((p) => p.w * Math.hypot(p.x - cx, p.y - cy))) }; },
  steps: (v, o, c) => { const P = v.points as any[]; return [
    { title: 'Weight each coordinate by its volume', why: 'Locations that ship more pull the answer toward themselves.', table: { columns: ['Location', 'x', 'y', 'Volume Q', 'x × Q', 'y × Q'], rows: [...P.map((p) => [p.name, c.f.num(p.x), c.f.num(p.y), c.f.num(p.w), c.f.num(p.x * p.w), c.f.num(p.y * p.w)]), ['Total', '', '', c.f.num(o.totalW), c.f.num(sum(P.map((p) => p.x * p.w))), c.f.num(sum(P.map((p) => p.y * p.w)))]] }, eli: 'Imagine each city as a weight on a map-shaped tray. The center of gravity is where the tray balances on a fingertip.' },
    { title: 'X coordinate', tex: `C_x = ${fr('\\sum x_i Q_i', '\\sum Q_i')} = ${fr(c.f.t(sum(P.map((p) => p.x * p.w))), c.f.t(o.totalW))} = ${c.f.t(o.cx, 2)}`, why: 'Volume-weighted average of the x coordinates.' },
    { title: 'Y coordinate', tex: `C_y = ${fr('\\sum y_i Q_i', '\\sum Q_i')} = ${fr(c.f.t(sum(P.map((p) => p.y * p.w))), c.f.t(o.totalW))} = ${c.f.t(o.cy, 2)}`, why: 'Volume-weighted average of the y coordinates.' },
  ]; },
  biz: (v, o, f) => ({ headline: `The balance point of your shipping volume is at (${f.num(o.cx, 1)}, ${f.num(o.cy, 1)}).`, meaning: ['A facility near this point keeps volume-weighted travel low.', `It serves a total volume of ${f.int(o.totalW)}.`, 'This is a starting point: it ignores roads, rent, labor, and taxes.'], actions: ['Shortlist real sites within reach of this point and compare them with the Load-Distance and Factor Rating calculators.', 'Drag the points on the map to test what happens if a customer grows or moves.', 'Re-run with next year’s forecast volumes, not just last year’s.'] }),
  viz: (v, o) => ({ kind: 'map', tableId: 'points', points: (v.points as any[]).map((p) => ({ name: String(p.name), x: p.x, y: p.y, w: p.w })), center: { x: o.cx, y: o.cy, label: 'Center of gravity' } }),
  traps: ['Weight by volume shipped, not by the number of locations.', 'The center of gravity minimizes weighted squared distance. It is close to, but not exactly, the point of minimum travel.'],
  analogy: 'Balancing a tray with different weights on it: the balance point sits closer to the heavier ones.',
  examples: [
    { title: 'Four retail stores', story: 'Stores at Chicago (30, 120), Pittsburgh (90, 110), New York (130, 130), and Atlanta (60, 40) receive 2,000, 1,000, 1,000, and 2,000 containers a month.', v: { points: COG }, expect: { cx: 66.67, cy: 93.33 } },
    { title: 'Three plants', story: 'Plants at (2, 2), (3, 5), and (5, 4) ship 5, 10, and 15 truckloads.', v: { points: [{ name: 'A', x: 2, y: 2, w: 5 }, { name: 'B', x: 3, y: 5, w: 10 }, { name: 'C', x: 5, y: 4, w: 15 }] }, expect: { cx: 3.8333, cy: 4 } },
  ],
  practice: { ask: ['cx', 'cy'], gen: (r) => ({ points: Array.from({ length: 3 }, (_, i) => ({ name: 'ABC'[i], x: Math.floor(r() * 10) * 10, y: Math.floor(r() * 10) * 10, w: (1 + Math.floor(r() * 9)) * 100 })) }), prompt: (v) => `A distribution center will serve ${v.points.map((p: any) => `${p.name} at (${p.x}, ${p.y}) with volume ${p.w}`).join('; ')}. Find the center-of-gravity coordinates.` },
  gen: (r) => ({ points: genPts(r) }), uses: [],
  claim: 'The center of gravity minimizes the volume-weighted sum of squared distances (confirmed by brute-force search).',
});

const dist = (m: string, x1: number, y1: number, x2: number, y2: number) => (m === 'euclid' ? Math.hypot(x1 - x2, y1 - y2) : Math.abs(x1 - x2) + Math.abs(y1 - y2));
const LD_P = [{ name: 'P1', x: 2, y: 2, w: 5 }, { name: 'P2', x: 3, y: 5, w: 10 }, { name: 'P3', x: 5, y: 4, w: 15 }];
const LD_S = [{ name: 'Site X', x: 3, y: 4 }, { name: 'Site Y', x: 4, y: 3 }];
export const loadDistance: CalcDef = calc({
  id: 'load-distance', name: 'Load-Distance Method', short: 'Load-distance', cat: CAT,
  bq: 'Which of my candidate sites means the least total travel?',
  blurb: 'Scores each candidate site by the sum of load times distance to every point it serves. Lowest score wins.',
  keywords: ['load-distance', 'load distance', 'ld score', 'rectilinear distance', 'euclidean distance', 'site comparison', 'location evaluation'],
  symptoms: ['compare candidate locations', 'which site is closest to customers', 'minimize travel'],
  formula: () => `LD = \\sum_i l_i d_i`,
  inputs: [ptsTable(LD_P), table('sites', 'Candidate sites', [col('name', 'Site', 'text'), col('x', 'X coordinate'), col('y', 'Y coordinate')], LD_S, { minRows: 1 }), sel('metric', 'Distance measure', [['rect', 'Rectilinear (city blocks)'], ['euclid', 'Euclidean (straight line)']], 'rect')],
  outputs: [out('bestScore', 'Lowest load-distance score', { primary: true }), out('bestIdx', 'Best site number', { fmt: 'int' }), out('worstScore', 'Highest score', {})],
  check: (v) => ((v.points as any[]).some((p) => p.w < 0) ? 'Loads cannot be negative.' : null),
  compute: (v) => { const scores = (v.sites as any[]).map((s) => sum((v.points as any[]).map((p) => p.w * dist(v.metric, p.x, p.y, s.x, s.y)))); const bestScore = Math.min(...scores); return { scores, bestScore, bestIdx: scores.indexOf(bestScore) + 1, worstScore: Math.max(...scores) }; },
  steps: (v, o, c) => [
    { title: 'Distance from each site to each point', tex: v.metric === 'euclid' ? `d = \\sqrt{(x_1 - x_2)^2 + (y_1 - y_2)^2}` : `d = |x_1 - x_2| + |y_1 - y_2|`, why: v.metric === 'euclid' ? 'Straight-line distance, appropriate for air or open-country travel.' : 'Rectilinear distance, appropriate for travel along a street grid or warehouse aisles.' },
    { title: 'Multiply by the load and add up', tex: `LD = \\sum l_i d_i`, why: 'Heavier flows count for more, so the score reflects total movement.', eli: 'Add up how far everything has to travel, counting busy routes more.', table: { columns: ['Point', 'Load', ...(v.sites as any[]).map((s) => `${s.name}: d`), ...(v.sites as any[]).map((s) => `${s.name}: l × d`)], rows: [...(v.points as any[]).map((p) => [p.name, c.f.num(p.w), ...(v.sites as any[]).map((s) => c.f.num(dist(v.metric, p.x, p.y, s.x, s.y), 3)), ...(v.sites as any[]).map((s) => c.f.num(p.w * dist(v.metric, p.x, p.y, s.x, s.y), 2))]), ['Total', '', ...(v.sites as any[]).map(() => ''), ...o.scores.map((x: number) => c.f.num(x, 2))]] } },
    { title: 'Choose the lowest score', tex: `${tx(String((v.sites as any[])[o.bestIdx - 1].name))}: \; LD = ${c.f.t(o.bestScore, 2)}`, why: 'The smallest load-distance total means the least movement.' },
  ],
  biz: (v, o, f) => ({ headline: `${(v.sites as any[])[o.bestIdx - 1].name} is the best site, with the least total load-distance (${f.num(o.bestScore, 1)}).`, meaning: [`Scores: ${(v.sites as any[]).map((s, i) => `${s.name} ${f.num(o.scores[i], 1)}`).join(', ')}.`, o.scores.length > 1 ? `The worst site means ${f.pct(((o.worstScore - o.bestScore) / o.bestScore) * 100, 0)} more travel.` : 'Add more candidate sites to compare.'], actions: ['Convert the difference to dollars using your cost per unit-distance.', 'Combine with rent, labor, and service factors in the Factor Rating calculator.'] }),
  viz: (v, o) => ({ kind: 'map', tableId: 'points', points: (v.points as any[]).map((p) => ({ name: String(p.name), x: p.x, y: p.y, w: p.w })), candidates: (v.sites as any[]).map((s, i) => ({ name: String(s.name), x: s.x, y: s.y, score: o.scores[i], best: i === o.bestIdx - 1 })) }),
  traps: ['Use the same distance measure for every site.', 'Rectilinear distance adds the x and y differences. It does not use the Pythagorean theorem.'],
  analogy: 'Choosing where to meet friends: add up everyone’s travel, giving extra weight to the friend who brings the most stuff.',
  examples: [
    { title: 'Rectilinear distances', story: 'Demand points P1 (2, 2) load 5, P2 (3, 5) load 10, P3 (5, 4) load 15. Candidate sites X (3, 4) and Y (4, 3).', v: { points: LD_P, sites: LD_S, metric: 'rect' }, expect: { bestScore: 55, bestIdx: 1, worstScore: 75 } },
    { title: 'Straight-line distances', story: 'Same points and sites using Euclidean distance.', v: { points: LD_P, sites: LD_S, metric: 'euclid' }, expect: { bestScore: 51.18, bestIdx: 1, worstScore: 54.754 } },
  ],
  practice: { ask: ['bestScore'], gen: (r) => ({ points: Array.from({ length: 3 }, (_, i) => ({ name: `P${i + 1}`, x: Math.floor(r() * 9) + 1, y: Math.floor(r() * 9) + 1, w: (1 + Math.floor(r() * 9)) * 5 })), sites: [{ name: 'Site X', x: Math.floor(r() * 9) + 1, y: Math.floor(r() * 9) + 1 }, { name: 'Site Y', x: Math.floor(r() * 9) + 1, y: Math.floor(r() * 9) + 1 }], metric: 'rect' }), prompt: (v) => `Demand points: ${v.points.map((p: any) => `${p.name} at (${p.x}, ${p.y}) with load ${p.w}`).join('; ')}. Candidate sites: ${v.sites.map((s: any) => `${s.name} at (${s.x}, ${s.y})`).join(' and ')}. Using rectilinear distance, what is the lower of the two load-distance scores?` },
  gen: (r) => ({ points: genPts(r), sites: Array.from({ length: 1 + Math.floor(r() * 4) }, (_, i) => ({ name: `S${i + 1}`, x: Math.floor(r() * 200), y: Math.floor(r() * 200) })), metric: r() < 0.5 ? 'rect' : 'euclid' }),
  uses: ['center-of-gravity'],
});

const FACTORS = [{ factor: 'Labor availability', weight: 0.25, a: 70, b: 60, c: 0 }, { factor: 'People-to-car ratio', weight: 0.05, a: 50, b: 60, c: 0 }, { factor: 'Per capita income', weight: 0.1, a: 85, b: 80, c: 0 }, { factor: 'Tax structure', weight: 0.39, a: 75, b: 70, c: 0 }, { factor: 'Education and health', weight: 0.21, a: 60, b: 70, c: 0 }];
const ratingCompute = (rows: any[]) => { const W = sum(rows.map((r) => r.weight)); const useC = rows.some((r) => r.c !== 0 && r.c !== undefined); const sc = (k: string) => sum(rows.map((r) => r.weight * (r[k] ?? 0))); const scores = [sc('a'), sc('b'), ...(useC ? [sc('c')] : [])]; const best = Math.max(...scores); return { scoreA: scores[0], scoreB: scores[1], scoreC: useC ? scores[2] : 0, W, normA: scores[0] / W, normB: scores[1] / W, normC: useC ? scores[2] / W : 0, best, bestIdx: scores.indexOf(best) + 1, nOpt: scores.length }; };
const ratingCheck = (rows: any[]) => (rows.some((r) => r.weight < 0) ? 'Weights cannot be negative.' : sum(rows.map((r) => r.weight)) <= 0 ? 'Weights must add up to more than zero.' : null);
const ratingTable = (rows: any[], o: any, c: any, label: string) => ({ columns: [label, 'Weight', 'A', 'B', ...(o.nOpt > 2 ? ['C'] : []), 'A × w', 'B × w', ...(o.nOpt > 2 ? ['C × w'] : [])], rows: [...rows.map((r) => [r.factor, c.f.num(r.weight), c.f.num(r.a), c.f.num(r.b), ...(o.nOpt > 2 ? [c.f.num(r.c)] : []), c.f.num(r.weight * r.a, 2), c.f.num(r.weight * r.b, 2), ...(o.nOpt > 2 ? [c.f.num(r.weight * r.c, 2)] : [])]), ['Total', c.f.num(o.W), '', '', ...(o.nOpt > 2 ? [''] : []), c.f.num(o.scoreA, 2), c.f.num(o.scoreB, 2), ...(o.nOpt > 2 ? [c.f.num(o.scoreC, 2)] : [])]] });
const ratingGen = (r: Rng) => { const n = 2 + Math.floor(r() * 6); const three = r() < 0.5; return { rows: Array.from({ length: n }, (_, i) => ({ factor: `F${i + 1}`, weight: +(0.05 + r()).toFixed(2), a: Math.floor(r() * 100), b: Math.floor(r() * 100), c: three ? 1 + Math.floor(r() * 99) : 0 })) }; };
const ratingViz = (rows: any[], o: any) => ({ kind: 'matrix' as const, rows: rows.map((r) => String(r.factor)), cols: ['Option A', 'Option B', ...(o.nOpt > 2 ? ['Option C'] : [])], cells: rows.map((r) => [r.weight * r.a, r.weight * r.b, ...(o.nOpt > 2 ? [r.weight * r.c] : [])]), colNote: [o.scoreA, o.scoreB, ...(o.nOpt > 2 ? [o.scoreC] : [])].map((x: number) => 'Total ' + x.toFixed(2)), best: rows.map((_, i) => [i, o.bestIdx - 1] as [number, number]), fmt: 'num' as const });
const optName = (i: number) => 'Option ' + 'ABC'[i - 1];

export const factorRating: CalcDef = calc({
  id: 'factor-rating', name: 'Factor Rating Method', short: 'Factor rating', cat: CAT,
  bq: 'Which location is best when I care about more than cost?',
  blurb: 'Scores each option on weighted factors and ranks them by total weighted score.',
  keywords: ['factor rating', 'weighted score', 'factor weighting', 'location factor rating', 'weighted scoring model', 'qualitative factors'],
  symptoms: ['compare locations on several criteria', 'choose a site', 'many factors to consider'],
  formula: () => `${tx('Score')}_j = \\sum_i w_i \\, s_{ij}`,
  inputs: [table('rows', 'Factors and scores', [col('factor', 'Factor', 'text'), col('weight', 'Weight'), col('a', 'Option A score'), col('b', 'Option B score'), col('c', 'Option C score (optional)')], FACTORS, { minRows: 1, help: 'Weights can add to 1 or to 100. Leave Option C at 0 to compare only two.' })],
  outputs: [out('best', 'Highest weighted score', { primary: true, dp: 2 }), out('bestIdx', 'Best option (1 = A, 2 = B, 3 = C)', { fmt: 'int' }), out('scoreA', 'Option A', { dp: 2 }), out('scoreB', 'Option B', { dp: 2 }), out('scoreC', 'Option C', { dp: 2, show: (v) => (v.rows as any[]).some((r) => r.c) })],
  check: (v) => ratingCheck(v.rows),
  compute: (v) => ratingCompute(v.rows),
  steps: (v, o, c) => [
    { title: 'Multiply each score by its factor weight', tex: `w_i \\times s_{ij}`, why: 'Weights express how much each factor matters. Scores express how well each option does on it.', eli: 'Like a grade: each assignment has a weight, each gets a mark, and the weighted total is the final grade.', table: ratingTable(v.rows, o, c, 'Factor') },
    { title: 'Add the weighted scores', tex: `A = ${c.f.t(o.scoreA, 2)}, \\quad B = ${c.f.t(o.scoreB, 2)}${o.nOpt > 2 ? `, \\quad C = ${c.f.t(o.scoreC, 2)}` : ''}`, why: `The option with the highest total is preferred.${Math.abs(o.W - 1) > 1e-9 ? ` Weights add to ${c.f.num(o.W)}, so divide by that to get scores on the original scale.` : ''}` },
  ],
  biz: (v, o, f) => ({ headline: `${optName(o.bestIdx)} scores highest (${f.num(o.best, 1)}).`, meaning: [`A: ${f.num(o.scoreA, 1)}, B: ${f.num(o.scoreB, 1)}${o.nOpt > 2 ? `, C: ${f.num(o.scoreC, 1)}` : ''}.`, 'A small gap means the decision is sensitive to your weights.'], actions: ['Change the top two weights by a few points and see whether the winner flips.', 'Agree the weights with your team before scoring, so nobody tunes them to a favorite.'] }),
  viz: (v, o) => ratingViz(v.rows, o),
  traps: ['Check that weights add to 1 (or 100) as the problem states.', 'Score every option on the same scale for a given factor.'],
  analogy: 'Choosing an apartment with a scorecard: rent counts double, commute counts once, the view barely at all.',
  examples: [
    { title: 'Theme park site', story: 'Five factors with weights 0.25, 0.05, 0.10, 0.39, 0.21. France scores 70, 50, 85, 75, 60 and Denmark scores 60, 70, 80, 70, 70.', v: { rows: FACTORS }, expect: { scoreA: 70.35, scoreB: 68, bestIdx: 1 } },
    { title: 'Three sites, weights out of 10', story: 'Factors weighted 5, 3, 2. Site A scores 8, 6, 9; site B scores 7, 9, 6; site C scores 9, 5, 5.', v: { rows: [{ factor: 'Cost', weight: 5, a: 8, b: 7, c: 9 }, { factor: 'Market', weight: 3, a: 6, b: 9, c: 5 }, { factor: 'Labor', weight: 2, a: 9, b: 6, c: 5 }] }, expect: { scoreA: 76, scoreB: 74, scoreC: 70, bestIdx: 1 } },
  ],
  practice: { ask: ['scoreA', 'scoreB'], gen: (r) => ({ rows: [['Cost', 0.4], ['Access', 0.35], ['Labor', 0.25]].map(([f, w]) => ({ factor: f, weight: w, a: 50 + Math.floor(r() * 10) * 5, b: 50 + Math.floor(r() * 10) * 5, c: 0 })) }), prompt: (v) => `Factors and weights: ${v.rows.map((x: any) => `${x.factor} (${x.weight})`).join(', ')}. Site A scores ${v.rows.map((x: any) => x.a).join(', ')} and Site B scores ${v.rows.map((x: any) => x.b).join(', ')}. Compute the weighted score of each site.` },
  gen: ratingGen, uses: [],
});

const LBE = [{ name: 'Athens', fixed: 30000, variable: 75 }, { name: 'Brussels', fixed: 60000, variable: 45 }, { name: 'Lisbon', fixed: 110000, variable: 25 }];
export const locationBreakEven: CalcDef = calc({
  id: 'location-break-even', name: 'Location Break-Even Analysis', short: 'Location break-even', cat: CAT,
  bq: 'Which location is cheapest at my expected volume?',
  blurb: 'Compares total cost (fixed plus variable) of several locations across volumes, with the crossover points between them.',
  keywords: ['location break-even', 'locational cost-volume analysis', 'crossover', 'cost-volume', 'fixed and variable cost by location'],
  symptoms: ['compare locations by cost', 'which site is cheapest at my volume', 'fixed vs variable cost trade-off'],
  formula: () => `TC = F + V \\times ${tx('volume')}`,
  inputs: [table('sites', 'Locations', [col('name', 'Location', 'text'), col('fixed', 'Fixed cost per year ($)'), col('variable', 'Variable cost per unit ($)')], LBE, { minRows: 2 }), num('volume', { label: 'Expected annual volume', blabel: 'Units you expect to produce per year', unit: 'units', def: 2000, min: 0, sens: true, cues: ['expected volume', 'units per year', 'volume of'] })],
  outputs: [out('bestCost', 'Lowest total cost', { fmt: 'money', primary: true }), out('bestIdx', 'Best location number', { fmt: 'int' }), out('worstCost', 'Highest total cost', { fmt: 'money' })],
  check: (v) => ((v.sites as any[]).some((s) => s.fixed < 0 || s.variable < 0) ? 'Costs cannot be negative.' : null),
  compute: (v) => { const S = v.sites as any[]; const costs = S.map((s) => s.fixed + s.variable * v.volume); const bestCost = Math.min(...costs); const cross: number[] = []; const pairs: number[] = []; for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) { const dv = S[i].variable - S[j].variable; const x = dv !== 0 ? (S[j].fixed - S[i].fixed) / dv : -1; cross.push(x > 0 ? x : -1); pairs.push(i * 100 + j); } return { costs, bestCost, bestIdx: costs.indexOf(bestCost) + 1, worstCost: Math.max(...costs), cross, pairs }; },
  steps: (v, o, c) => { const S = v.sites as any[]; return [
    { title: 'Total cost at the expected volume', tex: `TC = F + V \\times ${c.f.t(v.volume)}`, why: 'Fixed cost is paid regardless of volume. Variable cost scales with each unit.', table: { columns: ['Location', 'Fixed', 'Variable / unit', 'Total cost'], rows: S.map((s, i) => [s.name, c.f.money(s.fixed), c.f.money(s.variable, 2), c.f.money(o.costs[i])]), highlight: [o.bestIdx - 1] } },
    { title: 'Crossover volumes', tex: `F_1 + V_1 x = F_2 + V_2 x \;\\Rightarrow\; x = ${fr('F_2 - F_1', 'V_1 - V_2')}`, why: 'Where two cost lines cross, the cheaper location changes.', eli: 'A cheap-to-open, expensive-to-run site wins at low volume. An expensive-to-open, cheap-to-run site wins at high volume. The crossover is where they tie.', table: { columns: ['Pair', 'Crossover volume'], rows: o.pairs.map((p: number, k: number) => [`${S[Math.floor(p / 100)].name} vs ${S[p % 100].name}`, o.cross[k] > 0 ? c.f.num(o.cross[k], 1) : 'never cross']) } },
  ]; },
  biz: (v, o, f) => { const S = v.sites as any[]; return { headline: `${S[o.bestIdx - 1].name} is cheapest at ${f.int(v.volume)} units: ${f.money(o.bestCost)} a year.`, meaning: [`Costs: ${S.map((s, i) => `${s.name} ${f.money(o.costs[i])}`).join(', ')}.`, `Choosing the worst option would cost ${f.money(o.worstCost - o.bestCost)} more per year.`, ...o.cross.map((x: number, k: number) => (x > 0 ? `${S[Math.floor(o.pairs[k] / 100)].name} and ${S[o.pairs[k] % 100].name} cost the same at ${f.int(x)} units.` : '')).filter(Boolean).slice(0, 2)], actions: ['If your volume forecast is near a crossover, the decision is fragile: firm up the forecast first.', 'High-fixed-cost sites are a bet on growth. Low-fixed-cost sites are safer if demand is uncertain.'] }; },
  viz: (v, o) => { const S = v.sites as any[]; const hi = Math.max(v.volume * 1.6, ...o.cross.map((x: number) => x * 1.3), 10); return { kind: 'xy', x: { label: 'Annual volume (units)' }, y: { label: 'Total annual cost ($)', zero: true }, series: S.map((s, i) => ({ name: String(s.name), style: 'line' as const, tone: (['accent', 'alt', 'alt2', 'good', 'warn'] as const)[i % 5], pts: [[0, s.fixed], [hi, s.fixed + s.variable * hi]] as [number, number][] })), vlines: [{ x: v.volume, label: 'Expected volume', tone: 'muted' }], marks: [{ x: v.volume, y: o.bestCost, label: 'Cheapest', tone: 'accent' }] }; },
  traps: ['Compare total cost, not fixed or variable cost alone.', 'A location can be best only over a range of volumes. State the range.'],
  analogy: 'Phone plans: a low monthly fee with high per-minute charges, or a high fee with unlimited calls. Which is cheaper depends on how much you talk.',
  examples: [
    { title: 'Three European sites', story: 'Athens: fixed $30,000, variable $75. Brussels: fixed $60,000, variable $45. Lisbon: fixed $110,000, variable $25. Expected volume 2,000 units.', v: { sites: LBE, volume: 2000 }, expect: { bestCost: 150000, bestIdx: 2, worstCost: 180000 } },
    { title: 'Two sites at low volume', story: 'Site 1: fixed $20,000, variable $30. Site 2: fixed $50,000, variable $18. Expected volume 1,500 units.', v: { sites: [{ name: 'Site 1', fixed: 20000, variable: 30 }, { name: 'Site 2', fixed: 50000, variable: 18 }], volume: 1500 }, expect: { bestCost: 65000, bestIdx: 1, worstCost: 77000 } },
  ],
  practice: { ask: ['bestCost'], gen: (r) => { const f1 = (2 + Math.floor(r() * 6)) * 10000, v1 = 40 + Math.floor(r() * 8) * 5; return { sites: [{ name: 'Site 1', fixed: f1, variable: v1 }, { name: 'Site 2', fixed: f1 + (1 + Math.floor(r() * 5)) * 10000, variable: v1 - 10 - Math.floor(r() * 4) * 5 }], volume: (1 + Math.floor(r() * 8)) * 500 }; }, prompt: (v, f) => `${v.sites.map((s: any) => `${s.name} has fixed costs of ${f.money(s.fixed)} and variable costs of ${f.money(s.variable)} per unit`).join('. ')}. At an expected volume of ${f.int(v.volume)} units, what is the total cost of the cheaper site?` },
  gen: (r) => ({ sites: Array.from({ length: 2 + Math.floor(r() * 4) }, (_, i) => ({ name: `L${i + 1}`, fixed: Math.floor(r() * 200) * 1000, variable: +(1 + r() * 120).toFixed(2) })), volume: Math.floor(r() * 10000) }),
  uses: ['capacity-break-even'],
});

export const freightCost: CalcDef = calc({
  id: 'freight-cost', name: 'Freight Cost per Unit and per CWT', short: 'Freight cost', cat: CAT,
  bq: 'What does shipping cost me per unit?',
  blurb: 'Freight charge from a rate per hundredweight (CWT), with minimum charge, fuel surcharge, and accessorials, expressed per unit, per pound, and per CWT.',
  keywords: ['freight cost', 'cwt', 'hundredweight', 'per cwt', 'ltl rate', 'freight rate', 'shipping cost per unit', 'fuel surcharge'],
  symptoms: ['shipping cost per unit', 'freight bill', 'ltl quote', 'what does shipping add'],
  formula: () => `${tx('Freight')} = \\max\\left(${tx('Minimum')},\; ${fr(tx('Weight'), 100)} \\times ${tx('Rate per CWT')}\\right)`,
  inputs: [num('weight', { label: 'Shipment weight (lb)', blabel: 'Shipment weight in pounds', unit: 'lb', def: 4500, min: 0.0001, rand: [200, 40000, 100], sens: true, cues: ['pounds', 'lbs', 'weighs', 'weight'] }), money('rate', { label: 'Rate per CWT (per 100 lb)', blabel: 'Carrier rate per 100 lb', def: 18.5, rand: [5, 60, 0.5], sens: true, cues: ['per cwt', 'per hundredweight', 'per 100'] }), num('units', { label: 'Units in the shipment', unit: 'units', def: 900, min: 0.0001, rand: [10, 5000, 10], cues: ['units', 'cases'] }),
    money('minCharge', { label: 'Minimum charge', def: 150, rand: [0, 300, 25], adv: true, cues: ['minimum charge'] }), pct('fuel', { label: 'Fuel surcharge', def: 0, max: 200, rand: [0, 35, 1], adv: true, cues: ['fuel surcharge'] }), money('acc', { label: 'Accessorial charges (liftgate, residential, etc.)', def: 0, rand: [0, 200, 5], adv: true, cues: ['accessorial', 'liftgate'] })],
  outputs: [out('perUnit', 'Freight cost per unit', { fmt: 'money', dp: 3, primary: true }), out('total', 'Total freight charge', { fmt: 'money', dp: 2 }), out('perCwt', 'Effective cost per CWT', { fmt: 'money', dp: 2 }), out('perLb', 'Cost per pound', { fmt: 'money', dp: 4 }), out('minApplied', 'Minimum charge applied (1 = yes)', { fmt: 'int' })],
  compute: (v) => { const base = (v.weight / 100) * v.rate; const line = Math.max(v.minCharge ?? 0, base); const total = line * (1 + (v.fuel ?? 0) / 100) + (v.acc ?? 0); return { base, line, total, perUnit: total / v.units, perCwt: total / (v.weight / 100), perLb: total / v.weight, minApplied: (v.minCharge ?? 0) > base ? 1 : 0 }; },
  steps: (v, o, c) => [
    { title: 'Convert weight to hundredweight and apply the rate', tex: `${fr(c.f.t(v.weight), 100)} \\times ${c.f.t(v.rate)} = ${c.f.t(v.weight / 100, 2)} ${tx(' CWT')} \\times ${c.f.t(v.rate)} = ${c.f.money(o.base, 2)}`, why: 'CWT means "hundredweight": 100 pounds. Carriers quote less-than-truckload freight per CWT.', eli: 'The rate is per 100 pounds, so first count how many 100-pound blocks you are shipping.' },
    { title: 'Apply the minimum, fuel surcharge, and extras', tex: `\\max(${c.f.t(v.minCharge)}, ${c.f.t(o.base)}) \\times (1 + ${c.f.t(v.fuel / 100, 3)}) + ${c.f.t(v.acc)} = ${c.f.money(o.total, 2)}`, why: o.minApplied ? 'The calculated charge is below the carrier’s minimum, so the minimum applies.' : 'Fuel surcharge is a percentage of the linehaul charge. Accessorials are flat fees.' },
    { title: 'Per unit, per CWT, per pound', tex: `${fr(c.f.t(o.total), c.f.t(v.units))} = ${c.f.money(o.perUnit, 3)} ${tx(' per unit')}, \\quad ${c.f.money(o.perCwt, 2)} ${tx(' per CWT')}, \\quad ${c.f.money(o.perLb, 4)} ${tx(' per lb')}`, why: 'Spread the bill over what was shipped to compare with other quotes or to add to product cost.' },
  ],
  biz: (v, o, f) => ({ headline: `Shipping adds ${f.money(o.perUnit, 2)} to every unit.`, meaning: [`The freight bill is ${f.money(o.total, 2)} for ${f.int(v.weight)} lb.`, `That works out to ${f.money(o.perCwt, 2)} per 100 lb.`, o.minApplied ? 'You are paying the carrier’s minimum charge: this shipment is too small for the rate to matter.' : 'You are above the minimum charge.'], actions: [o.minApplied ? 'Consolidate small shipments to get out from under the minimum.' : 'Ask for the next weight break: heavier shipments often get a lower rate per CWT.', 'Add this per-unit figure to the Landed Cost calculator.'] }),
  viz: (v, o) => ({ kind: 'stack', unit: '$', bars: [{ label: 'Freight bill', parts: [{ name: 'Linehaul', value: o.line, tone: 'accent' }, { name: 'Fuel surcharge', value: o.line * (v.fuel / 100), tone: 'warn' }, { name: 'Accessorials', value: v.acc, tone: 'alt' }] }] }),
  traps: ['CWT is per 100 pounds: divide the weight by 100 before multiplying by the rate.', 'Fuel surcharge applies to the linehaul charge, not to accessorials.'],
  analogy: 'A taxi fare: a meter rate, a minimum fare, a surcharge, and the odd extra fee.',
  examples: [
    { title: 'LTL shipment', story: 'A 4,500 lb shipment of 900 units moves at $18.50 per CWT with a $150 minimum.', v: { weight: 4500, rate: 18.5, units: 900, minCharge: 150, fuel: 0, acc: 0 }, expect: { total: 832.5, perUnit: 0.925, perCwt: 18.5 } },
    { title: 'With surcharges', story: 'An 800 lb shipment of 200 units at $22 per CWT, 20% fuel surcharge, and a $35 liftgate fee.', v: { weight: 800, rate: 22, units: 200, minCharge: 150, fuel: 20, acc: 35 }, expect: { total: 246.2, perUnit: 1.231, perCwt: 30.775 } },
  ],
  practice: { ask: ['perUnit'], prompt: (v, f) => `A shipment of ${f.int(v.units)} units weighs ${f.int(v.weight)} lb and moves at ${f.money(v.rate, 2)} per CWT with a ${f.pct(v.fuel, 0)} fuel surcharge, ${f.money(v.acc)} in accessorial fees, and a ${f.money(v.minCharge)} minimum charge. What is the freight cost per unit?` },
  uses: [], mono: [['rate', 'total', 1], ['units', 'perUnit', -1]],
});

export const cubeUtilization: CalcDef = calc({
  id: 'cube-utilization', name: 'Cube and Weight Utilization', short: 'Cube utilization', cat: CAT,
  bq: 'How many cartons fit, and am I shipping air?',
  blurb: 'How many cartons fit in a trailer or container by space and by weight, and which limit you hit first.',
  keywords: ['cube utilization', 'weight utilization', 'trailer utilization', 'container loading', 'cube out', 'weigh out', 'load planning', 'how many fit'],
  symptoms: ['how many cartons fit in a truck', 'shipping air', 'trailer not full', 'container loading'],
  formula: () => `${tx('Cartons')} = \\min\\left(\\left\\lfloor ${fr('L', 'l')} \\right\\rfloor \\left\\lfloor ${fr('W', 'w')} \\right\\rfloor \\left\\lfloor ${fr('H', 'h')} \\right\\rfloor,\; \\left\\lfloor ${fr(tx('Weight limit'), tx('Carton weight'))} \\right\\rfloor\\right)`,
  inputs: [num('L', { label: 'Trailer / container length (in)', def: 240, min: 0.0001, rand: [200, 640, 20], cues: ['length'] }), num('W', { label: 'Trailer / container width (in)', def: 96, min: 0.0001, rand: [90, 102, 2], cues: ['width'] }), num('H', { label: 'Trailer / container height (in)', def: 96, min: 0.0001, rand: [90, 110, 2], cues: ['height'] }), num('limit', { label: 'Weight limit (lb)', def: 40000, min: 0.0001, rand: [20000, 45000, 1000], sens: true, cues: ['weight limit', 'payload', 'capacity of'] }),
    num('l', { label: 'Carton length (in)', def: 24, min: 0.0001, rand: [8, 48, 2], sens: true, cues: ['carton', 'box'] }), num('w', { label: 'Carton width (in)', def: 16, min: 0.0001, rand: [8, 40, 2], sens: true }), num('h', { label: 'Carton height (in)', def: 12, min: 0.0001, rand: [6, 36, 2], sens: true }), num('cw', { label: 'Carton weight (lb)', def: 30, min: 0.0001, rand: [5, 300, 5], sens: true, cues: ['each weighs', 'carton weight', 'pounds each'] })],
  outputs: [out('loaded', 'Cartons you can load', { fmt: 'int', primary: true }), out('cubePct', 'Cube utilization', { fmt: 'pct' }), out('weightPct', 'Weight utilization', { fmt: 'pct' }), out('bySpace', 'Cartons that fit by space', { fmt: 'int' }), out('byWeight', 'Cartons allowed by weight', { fmt: 'int' })],
  compute: (v) => { const bySpace = Math.floor(v.L / v.l + 1e-9) * Math.floor(v.W / v.w + 1e-9) * Math.floor(v.H / v.h + 1e-9); const byWeight = Math.floor(v.limit / v.cw + 1e-9); const loaded = Math.min(bySpace, byWeight); return { bySpace, byWeight, loaded, cubePct: ((loaded * v.l * v.w * v.h) / (v.L * v.W * v.H)) * 100, weightPct: ((loaded * v.cw) / v.limit) * 100, cubesOut: bySpace <= byWeight ? 1 : 0 }; },
  steps: (v, o, c) => [
    { title: 'Cartons that fit by space', tex: `\\left\\lfloor ${fr(c.f.t(v.L), c.f.t(v.l))} \\right\\rfloor \\times \\left\\lfloor ${fr(c.f.t(v.W), c.f.t(v.w))} \\right\\rfloor \\times \\left\\lfloor ${fr(c.f.t(v.H), c.f.t(v.h))} \\right\\rfloor = ${Math.floor(v.L / v.l + 1e-9)} \\times ${Math.floor(v.W / v.w + 1e-9)} \\times ${Math.floor(v.H / v.h + 1e-9)} = ${c.f.t(o.bySpace)}`, why: 'Count whole cartons along each dimension (rounding down), in the orientation given.', eli: 'How many boxes fit in a row, how many rows, how many layers?' },
    { title: 'Cartons allowed by weight', tex: `\\left\\lfloor ${fr(c.f.t(v.limit), c.f.t(v.cw))} \\right\\rfloor = ${c.f.t(o.byWeight)}`, why: 'The legal or rated weight limit caps the load regardless of space.' },
    { title: 'Load and utilization', tex: `${tx('Load')} = \\min(${c.f.t(o.bySpace)}, ${c.f.t(o.byWeight)}) = ${c.f.t(o.loaded)}, \\quad ${tx('Cube')} = ${c.f.pct(o.cubePct)}, \\quad ${tx('Weight')} = ${c.f.pct(o.weightPct)}`, why: o.cubesOut ? 'The trailer fills up before it reaches its weight limit: it "cubes out".' : 'The trailer hits its weight limit before it is full: it "weighs out".' },
  ],
  biz: (v, o, f) => ({ headline: `You can load ${f.int(o.loaded)} cartons. The trailer ${o.cubesOut ? 'fills up before it gets heavy' : 'hits its weight limit before it is full'}.`, meaning: [`Space used: ${f.pct(o.cubePct, 0)}. Weight used: ${f.pct(o.weightPct, 0)}.`, o.cubesOut ? `You are paying to haul ${f.pct(100 - o.weightPct, 0)} unused weight capacity. Denser packaging would help.` : `You are shipping ${f.pct(100 - o.cubePct, 0)} air. Lighter products could share this trailer.`], actions: [o.cubesOut ? 'Shrink the carton or pack more per carton: packaging redesign is often the cheapest freight saving.' : 'Mix in a light, bulky product to fill the empty space at no extra weight.', 'Try rotating the carton dimensions to see whether more fit.'] }),
  viz: (v, o) => ({ kind: 'container', cubePct: o.cubePct, weightPct: o.weightPct, units: o.loaded, limiting: o.cubesOut ? 'space' : 'weight' }),
  traps: ['Round down along each dimension separately. Dividing total volumes overstates what fits.', 'Check both limits: light freight cubes out, dense freight weighs out.'],
  analogy: 'Packing a suitcase: sometimes it is full before it is heavy (sweaters), sometimes heavy before it is full (books).',
  examples: [
    { title: 'Light cartons in a 20-foot container', story: 'Container 240 × 96 × 96 inches with a 40,000 lb limit. Cartons are 24 × 16 × 12 inches and weigh 30 lb.', v: { L: 240, W: 96, H: 96, limit: 40000, l: 24, w: 16, h: 12, cw: 30 }, expect: { bySpace: 480, loaded: 480, cubePct: 100, weightPct: 36 } },
    { title: 'Dense cartons', story: 'Same container. Cartons are 20 × 20 × 10 inches and weigh 250 lb.', v: { L: 240, W: 96, H: 96, limit: 40000, l: 20, w: 20, h: 10, cw: 250 }, expect: { bySpace: 432, byWeight: 160, loaded: 160, cubePct: 28.94, weightPct: 100 } },
  ],
  practice: { ask: ['loaded'], prompt: (v, f) => `A trailer measures ${f.int(v.L)} × ${f.int(v.W)} × ${f.int(v.H)} inches inside with a ${f.int(v.limit)} lb weight limit. Cartons measure ${f.int(v.l)} × ${f.int(v.w)} × ${f.int(v.h)} inches and weigh ${f.int(v.cw)} lb each. How many cartons can be loaded (same orientation)?` },
  uses: ['freight-cost'],
});

export const inTransit: CalcDef = calc({
  id: 'in-transit-inventory', name: 'In-Transit Inventory and Mode Trade-Off', short: 'Mode trade-off', cat: CAT,
  bq: 'Is the faster, pricier shipping mode actually cheaper overall?',
  blurb: 'Total annual cost of two transport modes: freight plus the cost of inventory tied up in transit and in larger shipments.',
  keywords: ['in-transit inventory', 'pipeline inventory', 'transportation mode', 'mode selection', 'air vs ocean', 'truck vs rail', 'transit time cost', 'total logistics cost'],
  symptoms: ['air or ocean', 'truck or rail', 'is faster shipping worth it', 'cost of slow shipping'],
  formula: (s) => `${tx('Total')} = r${s.D} + iC${s.D}${fr('t', 365)} + iC${fr(s.Q, 2)}`,
  inputs: [num('D', { sym: 'D', label: 'Annual demand', blabel: 'Units shipped per year', unit: 'units', def: 10000, min: 0, rand: [1000, 100000, 1000], sens: true, cues: ['annual demand', 'units per year'] }), money('C', { sym: 'C', label: 'Unit value', blabel: 'Value of one unit', def: 200, rand: [10, 2000, 10], sens: true, cues: ['unit value', 'value of', 'worth'] }), pct('i', { sym: 'I', label: 'Annual holding rate', blabel: 'Annual holding cost as % of value', def: 25, max: 1000, rand: [10, 40, 5], sens: true, cues: ['holding cost', 'carrying cost'] }),
    money('rA', { label: 'Mode A: freight cost per unit', def: 8, rand: [1, 80, 1], sens: true, cues: ['truck', 'air'] }), num('tA', { label: 'Mode A: transit time (days)', def: 4, min: 0, rand: [1, 10, 1], sens: true }), num('qA', { label: 'Mode A: shipment size (units)', def: 500, min: 0, rand: [50, 1000, 50] }),
    money('rB', { label: 'Mode B: freight cost per unit', def: 5, rand: [0.5, 40, 0.5], sens: true, cues: ['rail', 'ocean'] }), num('tB', { label: 'Mode B: transit time (days)', def: 12, min: 0, rand: [5, 45, 1], sens: true }), num('qB', { label: 'Mode B: shipment size (units)', def: 2000, min: 0, rand: [500, 5000, 100] })],
  outputs: [out('best', 'Lowest total annual cost', { fmt: 'money', primary: true }), out('bestIdx', 'Cheaper mode (1 = A, 2 = B)', { fmt: 'int' }), out('totalA', 'Mode A total', { fmt: 'money' }), out('totalB', 'Mode B total', { fmt: 'money' }), out('savings', 'Savings from the cheaper mode', { fmt: 'money' }), out('pipeA', 'Mode A units in transit', {}), out('pipeB', 'Mode B units in transit', {})],
  compute: (v) => { const h = (v.i / 100) * v.C; const m = (r: number, t: number, q: number) => ({ freight: r * v.D, transit: h * v.D * (t / 365), cycle: (h * q) / 2 }); const A = m(v.rA, v.tA, v.qA), B = m(v.rB, v.tB, v.qB); const totalA = A.freight + A.transit + A.cycle, totalB = B.freight + B.transit + B.cycle; return { h, freightA: A.freight, transitA: A.transit, cycleA: A.cycle, freightB: B.freight, transitB: B.transit, cycleB: B.cycle, totalA, totalB, best: Math.min(totalA, totalB), bestIdx: totalA <= totalB ? 1 : 2, savings: Math.abs(totalA - totalB), pipeA: (v.D * v.tA) / 365, pipeB: (v.D * v.tB) / 365 }; },
  steps: (v, o, c) => [
    { title: 'Holding cost per unit per year', tex: `${c.s.I} \\times ${c.s.C} = ${c.f.t(v.i / 100, 3)} \\times ${c.f.t(v.C)} = ${c.f.money(o.h, 2)}`, why: 'Inventory costs money to hold whether it is in a warehouse or on a ship.' },
    { title: 'In-transit (pipeline) inventory cost', tex: `iC${c.s.D}${fr('t', 365)}: \\quad A = ${c.f.money(o.transitA, 2)}, \\quad B = ${c.f.money(o.transitB, 2)}`, why: 'On average D × t / 365 units are in transit. Slower modes tie up more.', eli: 'Goods on a slow boat are money you have spent but cannot sell yet.' },
    { title: 'Cycle inventory cost from shipment size', tex: `iC${fr(c.s.Q, 2)}: \\quad A = ${c.f.money(o.cycleA, 2)}, \\quad B = ${c.f.money(o.cycleB, 2)}`, why: 'Modes with bigger minimum shipments leave more stock sitting at the destination, Q/2 on average.' },
    { title: 'Total annual cost of each mode', why: 'Add freight, in-transit inventory, and cycle inventory.', table: { columns: ['Cost', 'Mode A', 'Mode B'], rows: [['Freight', c.f.money(o.freightA), c.f.money(o.freightB)], ['In-transit inventory', c.f.money(o.transitA), c.f.money(o.transitB)], ['Cycle inventory', c.f.money(o.cycleA), c.f.money(o.cycleB)], ['Total', c.f.money(o.totalA), c.f.money(o.totalB)]], highlight: [3] } },
  ],
  biz: (v, o, f) => ({ headline: `Mode ${o.bestIdx === 1 ? 'A' : 'B'} is cheaper overall by ${f.money(o.savings)} a year.`, meaning: [`Mode A totals ${f.money(o.totalA)}; mode B totals ${f.money(o.totalB)}.`, `The slower mode keeps about ${f.int(Math.max(o.pipeA, o.pipeB))} units in transit at any time, versus ${f.int(Math.min(o.pipeA, o.pipeB))} for the faster one.`, 'Faster modes also need less safety stock, which this comparison does not count. That favors speed even more.'], actions: ['High-value products favor fast modes. Low-value, bulky products favor slow ones.', 'Recheck when fuel prices or interest rates change.'] }),
  viz: (v, o) => ({ kind: 'stack', unit: '$', bars: [{ label: 'Mode A', best: o.bestIdx === 1, parts: [{ name: 'Freight', value: o.freightA, tone: 'accent' }, { name: 'In-transit inventory', value: o.transitA, tone: 'warn' }, { name: 'Cycle inventory', value: o.cycleA, tone: 'alt' }] }, { label: 'Mode B', best: o.bestIdx === 2, parts: [{ name: 'Freight', value: o.freightB, tone: 'accent' }, { name: 'In-transit inventory', value: o.transitB, tone: 'warn' }, { name: 'Cycle inventory', value: o.cycleB, tone: 'alt' }] }] }),
  traps: ['Transit time must be converted to a fraction of a year (days / 365).', 'Comparing freight rates alone ignores inventory cost, which often decides the answer.'],
  analogy: 'Mailing a check by regular post or overnight courier: the slower option is cheaper to send, but your money is stuck in the mail longer.',
  examples: [
    { title: 'Truck versus rail', story: 'Demand 10,000 units a year worth $200 each, holding rate 25%. Truck: $8 per unit, 4 days, shipments of 500. Rail: $5 per unit, 12 days, shipments of 2,000.', v: { D: 10000, C: 200, i: 25, rA: 8, tA: 4, qA: 500, rB: 5, tB: 12, qB: 2000 }, expect: { totalA: 97979.45, totalB: 116438.36, bestIdx: 1 } },
    { title: 'Air versus ocean', story: 'Demand 2,000 units worth $1,500 each, holding rate 20%. Air: $60 per unit, 3 days, shipments of 100. Ocean: $15 per unit, 35 days, shipments of 500.', v: { D: 2000, C: 1500, i: 20, rA: 60, tA: 3, qA: 100, rB: 15, tB: 35, qB: 500 }, expect: { totalA: 139931.51, totalB: 162534.25, bestIdx: 1 } },
  ],
  practice: { ask: ['totalA', 'totalB'], prompt: (v, f) => `Annual demand is ${f.int(v.D)} units valued at ${f.money(v.C)} each, with a ${f.pct(v.i, 0)} annual holding rate. Mode A costs ${f.money(v.rA)} per unit, takes ${f.int(v.tA)} days, and ships ${f.int(v.qA)} units at a time. Mode B costs ${f.money(v.rB, 2)} per unit, takes ${f.int(v.tB)} days, and ships ${f.int(v.qB)} units at a time. Find the total annual cost (freight + in-transit inventory + cycle inventory) of each mode.` },
  uses: ['holding-cost', 'freight-cost'], mono: [['tA', 'totalA', 1], ['rB', 'totalB', 1]],
});

// ---- Sourcing -----------------------------------------------------------------------------------
const SRC = 'sourcing';
const TCO_DEF = [{ name: 'Local supplier', price: 10, freight: 0.5, duty: 0, defect: 1, defectCost: 50, lead: 10, admin: 2000 }, { name: 'Offshore supplier', price: 8.5, freight: 1.2, duty: 5, defect: 3, defectCost: 50, lead: 45, admin: 5000 }];
export const tco: CalcDef = calc({
  id: 'total-cost-of-ownership', name: 'Total Cost of Ownership (TCO)', short: 'TCO', cat: SRC,
  bq: 'Is this supplier actually cheaper?',
  blurb: 'Compares suppliers on everything they cost you: price, freight, duty, quality failures, inventory in the pipeline, and overhead.',
  keywords: ['total cost of ownership', 'tco', 'supplier comparison', 'true cost', 'offshore vs local', 'supplier cost analysis', 'cost of poor quality supplier'],
  symptoms: ['is this supplier actually cheaper', 'compare suppliers', 'cheap supplier with quality problems', 'offshore or local', 'switch suppliers'],
  formula: () => `TCO = ${tx('Purchase')} + ${tx('Freight')} + ${tx('Duty')} + ${tx('Quality')} + ${tx('Pipeline inventory')} + ${tx('Admin')}`,
  inputs: [num('volume', { label: 'Annual volume', blabel: 'Units you buy per year', unit: 'units', def: 10000, min: 0.0001, rand: [1000, 100000, 1000], sens: true, cues: ['annual volume', 'units per year'] }), pct('hold', { label: 'Annual holding rate', blabel: 'Annual holding cost as % of value', def: 20, max: 1000, rand: [10, 35, 5], cues: ['holding', 'carrying'] }),
    table('suppliers', 'Suppliers', [col('name', 'Supplier', 'text'), col('price', 'Unit price ($)'), col('freight', 'Freight per unit ($)'), col('duty', 'Duty %'), col('defect', 'Defect rate %'), col('defectCost', 'Cost per defect ($)'), col('lead', 'Lead time (days)'), col('admin', 'Annual admin / tooling ($)')], TCO_DEF, { minRows: 1 })],
  outputs: [out('bestTco', 'Lowest total cost of ownership', { fmt: 'money', primary: true }), out('bestIdx', 'Best supplier number', { fmt: 'int' }), out('bestPerUnit', 'Best supplier: true cost per unit', { fmt: 'money', dp: 2 }), out('gap', 'Gap to the most expensive supplier', { fmt: 'money' })],
  check: (v) => ((v.suppliers as any[]).some((s) => s.price < 0 || s.defect < 0 || s.defect > 100) ? 'Prices cannot be negative and defect rates must be between 0 and 100%.' : null),
  compute: (v) => { const rows = (v.suppliers as any[]).map((s) => { const purchase = s.price * v.volume, freight = s.freight * v.volume, duty = (s.duty / 100) * purchase, quality = (s.defect / 100) * v.volume * s.defectCost, pipeline = (v.hold / 100) * s.price * v.volume * (s.lead / 365); return { purchase, freight, duty, quality, pipeline, admin: s.admin, total: purchase + freight + duty + quality + pipeline + s.admin }; }); const totals = rows.map((r) => r.total); const bestTco = Math.min(...totals); return { totals, bestTco, bestIdx: totals.indexOf(bestTco) + 1, bestPerUnit: bestTco / v.volume, gap: Math.max(...totals) - bestTco, perUnit: totals.map((t) => t / v.volume), purchase: rows.map((r) => r.purchase), freight: rows.map((r) => r.freight), dutyAmt: rows.map((r) => r.duty), quality: rows.map((r) => r.quality), pipeline: rows.map((r) => r.pipeline), admin: rows.map((r) => r.admin) }; },
  steps: (v, o, c) => { const S = v.suppliers as any[]; return [
    { title: 'Cost components for each supplier', why: 'Purchase = price × volume. Duty = rate × purchase. Quality = defect rate × volume × cost per defect. Pipeline inventory = holding rate × price × volume × lead time / 365.', eli: 'The cheapest price tag is not the cheapest supplier once you count shipping, returns, and waiting.', table: { columns: ['Cost', ...S.map((s) => String(s.name))], rows: [['Purchase', ...o.purchase.map((x: number) => c.f.money(x))], ['Freight', ...o.freight.map((x: number) => c.f.money(x))], ['Duty', ...o.dutyAmt.map((x: number) => c.f.money(x))], ['Quality failures', ...o.quality.map((x: number) => c.f.money(x))], ['Pipeline inventory', ...o.pipeline.map((x: number) => c.f.money(x, 2))], ['Admin / tooling', ...o.admin.map((x: number) => c.f.money(x))], ['Total', ...o.totals.map((x: number) => c.f.money(x, 2))], ['Per unit', ...o.perUnit.map((x: number) => c.f.money(x, 2))]], highlight: [6] } },
    { title: 'Compare totals', tex: `${tx(String(S[o.bestIdx - 1].name))}: \; TCO = ${c.f.money(o.bestTco, 2)}`, why: 'The supplier with the lowest total cost of ownership is the cheaper one, whatever the quoted price says.' },
  ]; },
  biz: (v, o, f) => { const S = v.suppliers as any[]; const cheapestPrice = S.reduce((b, s, i) => (s.price < S[b].price ? i : b), 0); return { headline: `${S[o.bestIdx - 1].name} is the cheaper supplier overall: ${f.money(o.bestPerUnit, 2)} per unit all-in.`, meaning: [`Total yearly cost: ${S.map((s, i) => `${s.name} ${f.money(o.totals[i])}`).join(', ')}.`, cheapestPrice !== o.bestIdx - 1 ? `${S[cheapestPrice].name} quotes the lowest price but loses once freight, duty, quality, and lead time are counted.` : 'The lowest quoted price also wins on total cost here.', `The gap is ${f.money(o.gap)} a year.`], actions: ['Negotiate on the biggest non-price line in the table.', 'Ask the losing supplier what they could change (quality guarantee, consignment stock, freight terms) to close the gap.', 'Add risk you cannot price easily (currency, disruption) as a judgment call on top.'] }; },
  viz: (v, o) => ({ kind: 'stack', unit: '$', bars: (v.suppliers as any[]).map((s, i) => ({ label: String(s.name), best: i === o.bestIdx - 1, parts: [{ name: 'Purchase', value: o.purchase[i], tone: 'accent' as const }, { name: 'Freight', value: o.freight[i], tone: 'alt' as const }, { name: 'Duty', value: o.dutyAmt[i], tone: 'alt2' as const }, { name: 'Quality', value: o.quality[i], tone: 'bad' as const }, { name: 'Pipeline', value: o.pipeline[i], tone: 'warn' as const }, { name: 'Admin', value: o.admin[i], tone: 'muted' as const }] })) }),
  traps: ['Comparing unit price only.', 'Quality cost is per defective unit, so multiply by the defect rate and the volume.'],
  analogy: 'A cheap printer with expensive ink: the purchase price is the smallest part of what you end up paying.',
  examples: [
    { title: 'Local versus offshore', story: 'Annual volume 10,000 units, holding rate 20%. Local: $10.00, freight $0.50, no duty, 1% defects at $50 each, 10-day lead time, $2,000 admin. Offshore: $8.50, freight $1.20, 5% duty, 3% defects at $50 each, 45-day lead time, $5,000 admin.', v: { volume: 10000, hold: 20, suppliers: TCO_DEF }, expect: { bestTco: 112547.95, bestIdx: 1, gap: 10797.95 } },
    { title: 'Three bids', story: 'Volume 5,000, holding rate 25%. A: $20, freight $1, 0% duty, 2% defects at $100, 14 days, $1,000. B: $18, freight $2, 10% duty, 2% defects at $100, 30 days, $3,000. C: $22, freight $0.50, 0%, 0.5% defects at $100, 7 days, $0.', v: { volume: 5000, hold: 25, suppliers: [{ name: 'A', price: 20, freight: 1, duty: 0, defect: 2, defectCost: 100, lead: 14, admin: 1000 }, { name: 'B', price: 18, freight: 2, duty: 10, defect: 2, defectCost: 100, lead: 30, admin: 3000 }, { name: 'C', price: 22, freight: 0.5, duty: 0, defect: 0.5, defectCost: 100, lead: 7, admin: 0 }] }, expect: { bestIdx: 3, bestTco: 115527.4 } },
  ],
  practice: { ask: ['bestTco'], gen: (r) => ({ volume: (2 + Math.floor(r() * 8)) * 1000, hold: 20, suppliers: [{ name: 'Supplier A', price: 10 + Math.floor(r() * 10), freight: 1, duty: 0, defect: 1, defectCost: 40, lead: 0, admin: 1000 }, { name: 'Supplier B', price: 8 + Math.floor(r() * 8), freight: 2, duty: 5, defect: 4, defectCost: 40, lead: 0, admin: 3000 }] }), prompt: (v, f) => `You buy ${f.int(v.volume)} units a year. ${v.suppliers.map((s: any) => `${s.name}: price ${f.money(s.price)}, freight ${f.money(s.freight)} per unit, duty ${s.duty}%, defect rate ${s.defect}% at ${f.money(s.defectCost)} per defect, annual admin ${f.money(s.admin)}`).join('. ')}. Ignoring pipeline inventory, what is the lower total cost of ownership?` },
  gen: (r) => ({ volume: 500 + Math.floor(r() * 100000), hold: 5 + Math.floor(r() * 35), suppliers: Array.from({ length: 1 + Math.floor(r() * 4) }, (_, i) => ({ name: `S${i + 1}`, price: +(1 + r() * 200).toFixed(2), freight: +(r() * 10).toFixed(2), duty: Math.floor(r() * 25), defect: +(r() * 8).toFixed(1), defectCost: Math.floor(r() * 200), lead: Math.floor(r() * 90), admin: Math.floor(r() * 20) * 500 })) }),
  uses: ['landed-cost', 'holding-cost'],
});

const SCORE = [{ factor: 'Quality', weight: 40, a: 9, b: 7, c: 8 }, { factor: 'Delivery', weight: 30, a: 7, b: 9, c: 7 }, { factor: 'Price', weight: 20, a: 6, b: 9, c: 7 }, { factor: 'Service', weight: 10, a: 8, b: 6, c: 9 }];
export const supplierScorecard: CalcDef = calc({
  id: 'supplier-scorecard', name: 'Weighted Supplier Scorecard', short: 'Supplier scorecard', cat: SRC,
  bq: 'Which supplier is best across quality, delivery, price, and service?',
  blurb: 'Rates suppliers on weighted criteria and ranks them by total weighted score.',
  keywords: ['supplier scorecard', 'weighted scorecard', 'supplier evaluation', 'vendor rating', 'supplier selection', 'weighted point method'],
  symptoms: ['choose a supplier', 'rate my vendors', 'supplier performance review', 'which vendor is best'],
  formula: () => `${tx('Score')}_j = ${fr('\\sum_i w_i \\, s_{ij}', '\\sum_i w_i')}`,
  inputs: [table('rows', 'Criteria and ratings', [col('factor', 'Criterion', 'text'), col('weight', 'Weight'), col('a', 'Supplier A rating'), col('b', 'Supplier B rating'), col('c', 'Supplier C rating (optional)')], SCORE, { minRows: 1, help: 'Rate every supplier on the same scale (for example 1 to 10). Leave Supplier C at 0 to compare two.' })],
  outputs: [out('bestNorm', 'Highest weighted rating', { primary: true, dp: 2 }), out('bestIdx', 'Best supplier (1 = A, 2 = B, 3 = C)', { fmt: 'int' }), out('normA', 'Supplier A', { dp: 2 }), out('normB', 'Supplier B', { dp: 2 }), out('normC', 'Supplier C', { dp: 2, show: (v) => (v.rows as any[]).some((r) => r.c) })],
  check: (v) => ratingCheck(v.rows),
  compute: (v) => { const o = ratingCompute(v.rows); return { ...o, bestNorm: o.best / o.W }; },
  steps: (v, o, c) => [
    { title: 'Multiply each rating by its criterion weight', why: 'Weights reflect what matters most to you. Ratings reflect how each supplier performs.', eli: 'A report card where some subjects count more than others.', table: ratingTable(v.rows, o, c, 'Criterion') },
    { title: 'Divide by total weight to get a rating on the original scale', tex: `A = ${fr(c.f.t(o.scoreA, 2), c.f.t(o.W))} = ${c.f.t(o.normA, 2)}, \\quad B = ${fr(c.f.t(o.scoreB, 2), c.f.t(o.W))} = ${c.f.t(o.normB, 2)}${o.nOpt > 2 ? `, \\quad C = ${c.f.t(o.normC, 2)}` : ''}`, why: 'Dividing by the sum of the weights turns the total into a weighted average rating.' },
  ],
  biz: (v, o, f) => ({ headline: `Supplier ${'ABC'[o.bestIdx - 1]} comes out on top with a weighted rating of ${f.num(o.bestNorm, 2)}.`, meaning: [`A: ${f.num(o.normA, 2)}, B: ${f.num(o.normB, 2)}${o.nOpt > 2 ? `, C: ${f.num(o.normC, 2)}` : ''}.`, 'If two suppliers are within a few percent, treat it as a tie and decide on risk or relationship.'], actions: ['Share the scorecard with suppliers: it tells them exactly what to improve.', 'Re-score quarterly using actual delivery and quality data, not impressions.', 'Pair this with the TCO calculator so price is counted in dollars, not just as a rating.'] }),
  viz: (v, o) => ratingViz(v.rows, o),
  traps: ['Use the same rating scale for every supplier and criterion.', 'If weights do not add to 1, divide by their total to compare on the rating scale.'],
  analogy: 'Judging a talent show with a scoring sheet where "performance" counts more than "costume".',
  examples: [
    { title: 'Three suppliers', story: 'Criteria weights: quality 40, delivery 30, price 20, service 10. A rates 9, 7, 6, 8; B rates 7, 9, 9, 6; C rates 8, 7, 7, 9.', v: { rows: SCORE }, expect: { normA: 7.7, normB: 7.9, normC: 7.6, bestIdx: 2 } },
    { title: 'Two suppliers', story: 'Weights 0.5, 0.3, 0.2. Supplier A rates 80, 70, 90; supplier B rates 75, 90, 60.', v: { rows: [{ factor: 'Quality', weight: 0.5, a: 80, b: 75, c: 0 }, { factor: 'Delivery', weight: 0.3, a: 70, b: 90, c: 0 }, { factor: 'Price', weight: 0.2, a: 90, b: 60, c: 0 }] }, expect: { normA: 79, normB: 76.5, bestIdx: 1 } },
  ],
  practice: { ask: ['normA', 'normB'], gen: (r) => ({ rows: [['Quality', 50], ['Delivery', 30], ['Price', 20]].map(([f, w]) => ({ factor: f, weight: w, a: 5 + Math.floor(r() * 5), b: 5 + Math.floor(r() * 5), c: 0 })) }), prompt: (v) => `Criteria and weights: ${v.rows.map((x: any) => `${x.factor} (${x.weight})`).join(', ')}. Supplier A is rated ${v.rows.map((x: any) => x.a).join(', ')} and Supplier B ${v.rows.map((x: any) => x.b).join(', ')}. Compute each supplier's weighted average rating.` },
  gen: ratingGen, uses: ['factor-rating'],
});

export const makeVsBuy: CalcDef = calc({
  id: 'make-vs-buy', name: 'Make vs Buy', short: 'Make vs buy', cat: SRC,
  bq: 'Should I make this in-house or buy it?',
  blurb: 'Compares the total cost of making and buying at your volume and finds the volume where the two are equal.',
  keywords: ['make vs buy', 'make or buy', 'outsourcing', 'insourcing', 'indifference point', 'outsource decision'],
  symptoms: ['should i outsource', 'make it ourselves or buy it', 'bring production in-house'],
  formula: () => `x^* = ${fr('F_{make} - F_{buy}', 'P_{buy} - V_{make}')}`,
  inputs: [money('Fm', { label: 'Make: fixed cost per year', blabel: 'Yearly fixed cost to make it yourself (equipment, space, staff)', def: 50000, rand: [10000, 300000, 10000], sens: true, cues: ['fixed cost', 'equipment', 'investment'] }), money('Vm', { label: 'Make: variable cost per unit', blabel: 'Cost per unit to make it yourself', def: 12, rand: [2, 40, 1], sens: true, cues: ['variable cost', 'to make', 'in-house'] }),
    money('Pb', { label: 'Buy: price per unit', blabel: 'Price per unit from the supplier', def: 17, rand: [45, 120, 1], sens: true, cues: ['buy', 'purchase price', 'supplier quotes', 'outsource'] }), money('Fb', { label: 'Buy: fixed cost per year', blabel: 'Yearly fixed cost of buying (supplier management, tooling)', def: 0, rand: [0, 9000, 1000], adv: true, cues: [] }),
    num('volume', { label: 'Annual volume', blabel: 'Units needed per year', unit: 'units', def: 8000, min: 0, rand: [500, 30000, 500], sens: true, cues: ['annual volume', 'units per year', 'needs'] })],
  outputs: [out('best', 'Lower total cost', { fmt: 'money', primary: true }), out('decision', 'Decision (1 = make, 2 = buy)', { fmt: 'int' }), out('make', 'Cost to make', { fmt: 'money' }), out('buy', 'Cost to buy', { fmt: 'money' }), out('indiff', 'Indifference volume', { unit: 'units' }), out('savings', 'Savings from the better option', { fmt: 'money' })],
  check: (v) => (v.Pb === v.Vm ? 'Buying price equals the variable cost of making, so the lines never cross: choose whichever has lower fixed cost.' : null),
  compute: (v) => { const make = v.Fm + v.Vm * v.volume, buy = (v.Fb ?? 0) + v.Pb * v.volume; return { make, buy, best: Math.min(make, buy), decision: make <= buy ? 1 : 2, indiff: (v.Fm - (v.Fb ?? 0)) / (v.Pb - v.Vm), savings: Math.abs(make - buy) }; },
  steps: (v, o, c) => [
    { title: 'Cost to make', tex: `F_{make} + V_{make} \\times x = ${c.f.t(v.Fm)} + ${c.f.t(v.Vm)}(${c.f.t(v.volume)}) = ${c.f.money(o.make)}`, why: 'Making has a fixed cost to set up and a lower cost per unit.' },
    { title: 'Cost to buy', tex: `F_{buy} + P_{buy} \\times x = ${c.f.t(v.Fb)} + ${c.f.t(v.Pb)}(${c.f.t(v.volume)}) = ${c.f.money(o.buy)}`, why: 'Buying has little or no fixed cost but a higher cost per unit.' },
    { title: 'Indifference volume', tex: `x^* = ${fr('F_{make} - F_{buy}', 'P_{buy} - V_{make}')} = ${fr(`${c.f.t(v.Fm)} - ${c.f.t(v.Fb)}`, `${c.f.t(v.Pb)} - ${c.f.t(v.Vm)}`)} = ${c.f.t(o.indiff)} ${tx(' units')}`, why: 'Above this volume the fixed cost of making is spread over enough units to beat the supplier’s price. Below it, buying is cheaper.', eli: 'A home espresso machine only pays off if you drink enough coffee. This is the number of cups where it breaks even with the café.' },
  ],
  biz: (v, o, f) => ({ headline: `${o.decision === 1 ? 'Make it in-house' : 'Buy it'}: you save ${f.money(o.savings)} a year at ${f.int(v.volume)} units.`, meaning: [`Making costs ${f.money(o.make)}; buying costs ${f.money(o.buy)}.`, o.indiff > 0 ? `The two options cost the same at ${f.int(o.indiff)} units a year. ${v.volume > o.indiff ? 'You are above that, which favors making.' : 'You are below that, which favors buying.'}` : 'Making is cheaper at every volume with these costs.'], actions: [Math.abs(v.volume - o.indiff) / Math.max(o.indiff, 1) < 0.2 ? 'You are close to the indifference point. Let strategy decide: control and know-how versus flexibility.' : 'The cost gap is clear. Check capacity, quality, and supply risk before committing.', 'Re-run with your three-year volume forecast, not just this year’s.'] }),
  viz: (v, o) => { const hi = Math.max(v.volume * 1.6, o.indiff * 1.6, 10); return { kind: 'xy', x: { label: 'Annual volume (units)' }, y: { label: 'Total annual cost ($)', zero: true }, series: [{ name: 'Make', style: 'line', tone: 'accent', pts: [[0, v.Fm], [hi, v.Fm + v.Vm * hi]] }, { name: 'Buy', style: 'line', tone: 'alt', pts: [[0, v.Fb], [hi, v.Fb + v.Pb * hi]] }], vlines: [{ x: v.volume, label: 'Your volume', tone: 'muted' }], marks: o.indiff > 0 ? [{ x: o.indiff, y: v.Fm + v.Vm * o.indiff, label: 'Indifference point', tone: 'accent' }] : [] }; },
  traps: ['Only include fixed costs that actually change with the decision (avoidable costs).', 'The indifference point is in units, not dollars.'],
  analogy: 'Buying an espresso machine versus going to the café: the machine costs a lot up front, but each cup at home is cheap.',
  examples: [
    { title: 'Below the indifference point', story: 'Making costs $50,000 a year plus $12 per unit. A supplier charges $17 per unit. Annual volume is 8,000 units.', v: { Fm: 50000, Vm: 12, Pb: 17, Fb: 0, volume: 8000 }, expect: { make: 146000, buy: 136000, decision: 2, indiff: 10000 } },
    { title: 'Above the indifference point', story: 'Making costs $120,000 a year plus $30 per unit. Buying costs $45 per unit plus $15,000 a year in supplier management. Volume is 9,000 units.', v: { Fm: 120000, Vm: 30, Pb: 45, Fb: 15000, volume: 9000 }, expect: { make: 390000, buy: 420000, decision: 1, indiff: 7000 } },
  ],
  practice: { ask: ['indiff'], prompt: (v, f) => `A firm can make a part for a fixed cost of ${f.money(v.Fm)} per year plus ${f.money(v.Vm)} per unit, or buy it for ${f.money(v.Pb)} per unit with fixed buying costs of ${f.money(v.Fb)}. At what annual volume is the firm indifferent between making and buying?` },
  uses: ['capacity-break-even'], mono: [['Fm', 'indiff', 1], ['Pb', 'buy', 1]],
});

export const priceBreak: CalcDef = calc({
  id: 'price-break-analysis', name: 'Price Break Analysis', short: 'Price break analysis', cat: SRC,
  bq: 'Should I buy more than I need to reach the next price break?',
  blurb: 'For a given requirement, compares buying exactly what you need with rounding up to each price break.',
  keywords: ['price break', 'price break analysis', 'order up', 'quantity break', 'break-even quantity', 'buy more to save'],
  symptoms: ['should i round up my order', 'next price break', 'buy more to get the discount', 'supplier price tiers'],
  formula: () => `${tx('Order-up point')} = ${fr(`Q_{break} \\times P_{break}`, 'P_{current}')}`,
  inputs: [num('need', { label: 'Quantity required', blabel: 'Units you actually need', unit: 'units', def: 900, min: 0.0001, sens: true, cues: ['need', 'requires', 'requirement of'] }), table('breaks', 'Price schedule', [col('min', 'Minimum quantity'), col('price', 'Unit price ($)')], [{ min: 0, price: 5 }, { min: 1000, price: 4.4 }], { minRows: 1 }),
    pct('leftover', { label: 'Value of leftover units (% of price paid)', blabel: 'What extra units are worth to you (% of price)', def: 0, max: 100, adv: true, sens: true, help: 'Use 100% if you will certainly use the extras later, 0% if they would be wasted.' })],
  outputs: [out('bestCost', 'Lowest net cost', { fmt: 'money', dp: 2, primary: true }), out('buyQty', 'Quantity to buy', { unit: 'units' }), out('exactCost', 'Cost of buying exactly what you need', { fmt: 'money', dp: 2 }), out('savings', 'Savings from rounding up', { fmt: 'money', dp: 2 }), out('orderUp', 'Order-up point for the next break', { unit: 'units' })],
  check: (v) => ((v.breaks as any[]).some((b) => !(b.price > 0)) ? 'Every tier needs a price greater than zero.' : null),
  compute: (v) => {
    const tiers = [...(v.breaks as any[])].map((b) => ({ min: Math.max(0, b.min), price: b.price })).sort((a, b) => a.min - b.min);
    let cur = 0; tiers.forEach((t, i) => { if (v.need >= t.min) cur = i; });
    const exactCost = v.need * tiers[cur].price; const opts = [{ qty: v.need, cost: exactCost, net: exactCost }];
    for (let i = cur + 1; i < tiers.length; i++) { const cost = tiers[i].min * tiers[i].price; opts.push({ qty: tiers[i].min, cost, net: cost - (tiers[i].min - v.need) * tiers[i].price * ((v.leftover ?? 0) / 100) }); }
    let b = 0; opts.forEach((o2, i) => { if (o2.net < opts[b].net - 1e-9) b = i; });
    return { exactCost, bestCost: opts[b].net, buyQty: opts[b].qty, savings: exactCost - opts[b].net, orderUp: cur + 1 < tiers.length ? (tiers[cur + 1].min * tiers[cur + 1].price) / tiers[cur].price : 0, optQty: opts.map((x) => x.qty), optCost: opts.map((x) => x.cost), optNet: opts.map((x) => x.net), curTier: cur + 1 };
  },
  steps: (v, o, c) => [
    { title: 'Cost of buying exactly what you need', tex: `${c.f.t(v.need)} \\times ${c.f.t(o.exactCost / v.need, 2)} = ${c.f.money(o.exactCost, 2)}`, why: 'Use the price for the tier your requirement falls in.' },
    { title: 'Cost of rounding up to each higher break', why: 'Buying the minimum quantity of a higher tier costs minimum × lower price. Any value you place on the extra units is subtracted.', table: { columns: ['Buy', 'Cash cost', 'Net of leftover value'], rows: o.optQty.map((q: number, i: number) => [c.f.num(q), c.f.money(o.optCost[i], 2), c.f.money(o.optNet[i], 2)]), highlight: [o.optNet.indexOf(Math.min(...o.optNet))] }, eli: 'Sometimes 12 donuts cost less than 11. Check before you order.' },
    ...(o.orderUp > 0 ? [{ title: 'Order-up point', tex: `${fr('Q_{break} \\times P_{break}', 'P_{current}')} = ${c.f.t(o.orderUp, 1)} ${tx(' units')}`, why: 'Whenever you need more than this many units, it is cheaper to buy the full break quantity instead.' }] : []),
  ],
  biz: (v, o, f) => ({ headline: o.buyQty > v.need ? `Buy ${f.int(o.buyQty)} instead of ${f.int(v.need)}: it costs ${f.money(o.savings, 2)} less.` : `Buy exactly ${f.int(v.need)} units. Rounding up to a price break does not pay.`, meaning: [`Buying exactly what you need costs ${f.money(o.exactCost, 2)}.`, o.orderUp > 0 ? `Rule of thumb for this price list: any time you need more than ${f.int(Math.ceil(o.orderUp))} units, order the full break quantity.` : 'You are already in the top price tier.'], actions: [o.buyQty > v.need ? 'Take the larger quantity, provided the extra units will not expire or go obsolete.' : 'Stay with the exact quantity, or ask the supplier to lower the break threshold.', 'Add holding cost for extras you will carry a long time (see the Quantity Discount calculator).'] }),
  viz: (v, o) => ({ kind: 'xy', x: { label: '', cats: o.optQty.map((q: number) => `Buy ${Math.round(q).toLocaleString('en-US')}`) }, y: { label: 'Net cost ($)', zero: true }, series: [{ name: 'Net cost', style: 'bars', tone: 'accent', pts: o.optNet.map((x: number, i: number) => [i, x] as [number, number]) }] }),
  traps: ['Compare total cost, not unit price.', 'This ignores the cost of holding the extra units. For recurring purchases use the Quantity Discount model.'],
  analogy: 'A coffee card where the 10-pack costs less than 9 single cups: buy the 10-pack even if you only wanted 9.',
  examples: [
    { title: 'Just below a break', story: 'You need 900 units. The price is $5.00 below 1,000 units and $4.40 for 1,000 or more.', v: { need: 900, breaks: [{ min: 0, price: 5 }, { min: 1000, price: 4.4 }], leftover: 0 }, expect: { exactCost: 4500, bestCost: 4400, buyQty: 1000, savings: 100, orderUp: 880 } },
    { title: 'Not worth rounding up', story: 'You need 400 units. Prices are $12 base, $11 at 500, and $10 at 1,000.', v: { need: 400, breaks: [{ min: 0, price: 12 }, { min: 500, price: 11 }, { min: 1000, price: 10 }], leftover: 0 }, expect: { exactCost: 4800, bestCost: 4800, buyQty: 400, orderUp: 458.33 } },
  ],
  practice: { ask: ['buyQty'], gen: (r) => { const p = 5 + Math.floor(r() * 20); const brk = [500, 1000][Math.floor(r() * 2)]; return { need: brk - (1 + Math.floor(r() * 6)) * brk / 20, breaks: [{ min: 0, price: p }, { min: brk, price: +(p * (0.85 + r() * 0.1)).toFixed(2) }], leftover: 0 }; }, prompt: (v, f) => `You need ${f.int(v.need)} units. The supplier charges ${f.money(v.breaks[0].price, 2)} each below ${f.int(v.breaks[1].min)} units and ${f.money(v.breaks[1].price, 2)} each for ${f.int(v.breaks[1].min)} or more. Leftover units have no value. How many units should you buy to minimize cost?` },
  gen: (r) => { const p = +(1 + r() * 100).toFixed(2); const b1 = 100 + Math.floor(r() * 20) * 100; const n = 1 + Math.floor(r() * 3); const breaks = [{ min: 0, price: p }]; for (let i = 1; i <= n; i++) breaks.push({ min: b1 * i, price: +(p * (1 - 0.04 * i - r() * 0.05)).toFixed(3) }); return { need: 10 + Math.floor(r() * b1 * (n + 0.5)), breaks, leftover: [0, 0, 50, 100][Math.floor(r() * 4)] }; },
  uses: ['quantity-discount'],
});

export default [landedCost, centerOfGravity, loadDistance, factorRating, locationBreakEven, freightCost, cubeUtilization, inTransit, tco, supplierScorecard, makeVsBuy, priceBreak];
