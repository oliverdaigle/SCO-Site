// Inventory under uncertainty: reorder points, safety stock, service levels, newsvendor, review policies, pooling.
import { calc, num, money, pct, int, sel, out, rate, dur, sdT, holdingInputs, getH, zModeInput, zLookupText, normalViz, sawtooth, fr, sq, tx } from '../dsl';
import { normCdf, normInv, lossG, lossInv, zFor } from '../math/normal';
import { periodsPerYear } from '../units';
import type { CalcDef, Ctx, InputDef, Step, Vals } from '../types';

const CAT = 'inv-service';
const dIn = (o: Partial<InputDef> = {}) => num('d', { sym: 'd', label: 'Average demand per period', blabel: 'Average sales per period', unit: 'units', def: 100, time: rate('day'), min: 0, rand: [10, 500, 5], sens: true, cues: ['average demand', 'mean demand', 'daily demand', 'weekly demand', 'demand averages', 'average daily', 'average weekly', 'sells an average', 'demand is'], help: 'Mean demand in one period (day, week, or month).', ...o });
const sdIn = (o: Partial<InputDef> = {}) => num('sd', { sym: 'sigd', label: 'Std. deviation of demand per period', blabel: 'How much sales swing per period (std. deviation)', unit: 'units', def: 20, time: sdT('day'), min: 0, rand: [2, 80, 1], sens: true, cues: ['standard deviation of demand', 'standard deviation of daily demand', 'standard deviation of weekly demand', 'standard deviation', 'std dev', 'sigma'], help: 'Standard deviation of demand in one period. If you only have a sales history, the Forecasting calculators or the Plan Builder can compute it.', ...o });
const LIn = (o: Partial<InputDef> = {}) => num('L', { sym: 'L', label: 'Lead time', blabel: 'Supplier lead time', def: 4, time: dur('day'), min: 0, rand: [1, 20, 1], sens: true, cues: ['lead time', 'takes', 'delivery time', 'arrives in', 'replenishment time'], help: 'Time between placing an order and receiving it.', ...o });
const slIn = (o: Partial<InputDef> = {}) => pct('SL', { sym: 'CSL', label: 'Cycle service level', blabel: 'How often you want to avoid a stockout', def: 95, min: 0.01, max: 99.999, rand: [80, 99.5, 0.5], sens: true, cues: ['service level', 'in-stock probability', 'probability of not stocking out', 'stockout risk', 'cycle service'], help: 'Probability of not running out during a replenishment cycle. 95% means a stockout in about 1 of every 20 cycles.', ...o });
const zStep = (c: Ctx, SL: number, z: number, mode: string): Step => ({
  title: 'Find the z-value for the service level', tex: `z = \\Phi^{-1}(${c.f.t(SL / 100, 4)}) = ${c.f.t(z, mode === 'exact' ? 4 : 2)}`, lookup: zLookupText(z, SL / 100),
  why: `z is the number of standard deviations of protection needed so that demand stays below the reorder point ${c.f.pct(SL)} of the time.${mode === 'roundup' ? ' Using the round-up rule: when the target falls between two table entries, take the larger z.' : mode === 'table' ? ' Using the nearest two-decimal table value.' : ''}`,
  eli: `A ${c.f.pct(SL)} service level means you are fine in ${c.f.num(SL, 1)} out of 100 cycles. z translates that promise into "how many typical swings of extra stock" you need.`,
});
const slCheck = (v: Vals) => (v.SL >= 100 ? 'A 100% service level needs infinite safety stock under a normal demand model. Try 99.9% instead.' : null);

export const reorderPoint: CalcDef = calc({
  id: 'reorder-point', name: 'Reorder Point (Constant Demand)', short: 'Reorder point', cat: CAT,
  bq: 'When should I place my next order?',
  blurb: 'The inventory level that triggers a new order when demand and lead time are steady: demand during lead time, plus any safety stock.',
  keywords: ['reorder point', 'rop', 'when to order', 'order point', 'demand during lead time', 'reorder level'],
  symptoms: ['when should i reorder', 'i keep running out of stock', 'orders arrive too late', 'when to place an order'],
  formula: (s) => `${s.ROP} = ${s.d} \\times ${s.L} + ${s.ss}`,
  basis: { from: 'd' },
  inputs: [dIn({ def: 32 }), LIn({ def: 3 }), num('ss', { sym: 'ss', label: 'Safety stock (optional)', blabel: 'Extra buffer stock (optional)', unit: 'units', def: 0, min: 0, rand: [0, 100, 5], cues: ['safety stock', 'buffer stock'] }),
    int('daysPerYear', { label: 'Operating days per year', def: 365, min: 1, max: 366, adv: true, cues: ['working days', 'operating days', 'days per year', 'day year', 'days a year'], help: 'Only matters when demand is annual and lead time is in days.' })],
  outputs: [out('ROP', 'Reorder point', { sym: 'ROP', blabel: 'Reorder when stock falls to', unit: 'units', primary: true }), out('dlt', 'Demand during lead time', { unit: 'units' })],
  compute: (v) => ({ dlt: v.d * v.L, ROP: v.d * v.L + (v.ss ?? 0) }),
  steps: (v, o, c) => [
    { title: 'Demand during lead time', tex: `${c.s.d} \\times ${c.s.L} = ${c.f.t(v.d, 4)} \\times ${c.f.t(v.L, 4)} = ${c.f.t(o.dlt)} ${tx(' units')}`, why: `While you wait for the order, you keep selling. Demand per ${c.u} times lead time in ${c.u}s is how much you will sell before the delivery lands.`, eli: 'If you eat 2 eggs a day and the store takes 3 days to deliver, order when you are down to 6 eggs.' },
    { title: 'Add safety stock', tex: `${c.s.ROP} = ${c.f.t(o.dlt)} + ${c.f.t(v.ss)} = ${c.f.t(o.ROP)} ${tx(' units')}`, why: v.ss > 0 ? 'Safety stock is a buffer on top of expected lead-time demand.' : 'With perfectly steady demand and lead time, no buffer is needed, so the reorder point equals lead-time demand.' },
  ],
  biz: (v, o, f) => ({ headline: `Reorder when stock drops to ${f.int(o.ROP)} units.`, meaning: [`You will sell about ${f.int(o.dlt)} units while waiting for the delivery.`, v.ss > 0 ? `${f.int(v.ss)} of those units are a safety buffer.` : 'This assumes sales and delivery times never vary. In practice, add safety stock.'], actions: ['Set a low-stock alert at this level in your inventory system.', 'If demand or lead time varies, use the Safety Stock calculator to add a buffer.', 'Review the reorder point each season.'] }),
  viz: (v, o) => sawtooth({ Q: Math.max(o.dlt * 3, o.ROP * 1.6, 1), d: v.d, L: v.L, rop: o.ROP, ss: v.ss, unit: v._basis ?? 'day' }),
  traps: ['Demand and lead time must use the same time unit. Annual demand with lead time in days needs a conversion to daily demand first.', 'Use working days per year when the problem gives them.', 'The reorder point is an inventory level, not a time.'],
  analogy: 'The fuel light in a car: it comes on when there is just enough left to reach a station.',
  examples: [
    { title: 'Phone distributor', story: 'Demand is 8,000 units a year over a 250-day working year. Delivery takes 3 working days.', v: { d: 8000, d_u: 'year', L: 3, L_u: 'day', daysPerYear: 250 }, expect: { ROP: 96 } },
    { title: 'Daily demand', story: 'A shop sells 40 units a day and the supplier takes 5 days. It keeps 25 units of safety stock.', v: { d: 40, L: 5, ss: 25 }, expect: { ROP: 225, dlt: 200 } },
  ],
  practice: { ask: ['ROP'], prompt: (v, f) => `Demand is ${f.int(v.d)} units per day and lead time is ${f.int(v.L)} days. Safety stock is ${f.int(v.ss)} units. What is the reorder point?` },
  uses: ['time-between-orders'], mono: [['d', 'ROP', 1], ['L', 'ROP', 1], ['ss', 'ROP', 1]],
});

const sigmaLT = (v: Vals) => (v.sdGiven === 'leadtime' ? v.sd : v.sd * Math.sqrt(v.L));
export const ssDemand: CalcDef = calc({
  id: 'safety-stock-demand', name: 'Safety Stock: Variable Demand', short: 'Safety stock (demand)', cat: CAT,
  bq: 'How much buffer stock do I need when sales are unpredictable?',
  blurb: 'Safety stock and reorder point when demand varies and lead time is constant.',
  keywords: ['safety stock', 'buffer stock', 'variable demand', 'z sigma sqrt L', 'reorder point with safety stock', 'ss', 'demand variability'],
  symptoms: ['i keep running out of stock', 'stockouts', 'sales are unpredictable', 'how much buffer', 'demand is variable'],
  formula: (s) => `${s.ss} = z \\, ${s.sigd} ${sq(s.L)}`,
  basis: { from: 'd' },
  inputs: [dIn({ def: 15 }), sdIn({ def: 5, time: { ...sdT('day'), unless: ['sdGiven', 'leadtime'] } }), LIn({ def: 2 }), slIn({ def: 90 }),
    sel('sdGiven', 'Standard deviation is for', [['period', 'One period (scale by √L)'], ['leadtime', 'The whole lead time (use as is)']], 'period', { adv: true, help: 'Some problems give σ of demand during the lead time directly. Then do not multiply by √L again.' }), zModeInput()],
  outputs: [out('ss', 'Safety stock', { sym: 'ss', unit: 'units', primary: true }), out('ROP', 'Reorder point', { sym: 'ROP', unit: 'units' }), out('z', 'z-value', { sym: 'z', dp: 4 }), out('sigLT', 'Std. dev. of demand during lead time', { sym: 'sigdLT', unit: 'units' }), out('dlt', 'Average demand during lead time', { unit: 'units' })],
  check: slCheck,
  compute: (v) => { const z = zFor(v.SL / 100, v.zMode); const sigLT = sigmaLT(v); const ss = z * sigLT; return { z, sigLT, ss, dlt: v.d * v.L, ROP: v.d * v.L + ss }; },
  steps: (v, o, c) => [
    zStep(c, v.SL, o.z, v.zMode),
    v.sdGiven === 'leadtime'
      ? { title: 'Standard deviation during lead time', tex: `${c.s.sigdLT} = ${c.f.t(o.sigLT)}`, why: 'The problem gives the standard deviation of demand over the whole lead time, so use it directly.' }
      : { title: 'Scale the standard deviation to the lead time', tex: `${c.s.sigdLT} = ${c.s.sigd} ${sq(c.s.L)} = ${c.f.t(v.sd, 4)} ${sq(c.f.t(v.L, 4))} = ${c.f.t(o.sigLT)}`, why: 'Variances add across independent periods, so standard deviation grows with the square root of time, not in proportion to it.', eli: 'Good days and bad days partly cancel out, so uncertainty over 4 days is only twice (not four times) the uncertainty of 1 day.' },
    { title: 'Safety stock', tex: `${c.s.ss} = z \\, ${c.s.sigdLT} = ${c.f.t(o.z, 4)} \\times ${c.f.t(o.sigLT)} = ${c.f.t(o.ss)} ${tx(' units')}`, why: 'Hold z standard deviations of lead-time demand as a buffer.', eli: 'Keep enough extra to cover an unusually busy stretch while you wait for the delivery.' },
    { title: 'Reorder point', tex: `${c.s.ROP} = ${c.s.d} \\times ${c.s.L} + ${c.s.ss} = ${c.f.t(o.dlt)} + ${c.f.t(o.ss)} = ${c.f.t(o.ROP)} ${tx(' units')}`, why: 'Expected demand during lead time plus the buffer.' },
  ],
  biz: (v, o, f) => ({ headline: `Keep ${f.int(Math.ceil(o.ss))} units of safety stock and reorder at ${f.int(Math.ceil(o.ROP))} units.`, meaning: [`That covers you in ${f.pct(v.SL)} of replenishment cycles.`, `You expect to sell ${f.int(o.dlt)} units during the lead time, give or take about ${f.int(o.sigLT)}.`, 'Going from 95% to 99% protection takes roughly 40% more safety stock, so pick the service level on purpose.'], actions: [`Set the reorder alert to ${f.int(Math.ceil(o.ROP))} units.`, 'Shorten lead time if you can: buffer stock falls with the square root of lead time.', 'Recompute when sales patterns change (new season, promotion, new channel).'] }),
  viz: (v, o) => normalViz(o.dlt, o.sigLT, o.ROP, { xlabel: 'Demand during lead time (units)', cutLabel: 'Reorder point', shadeLabel: `${v.SL}% of cycles covered` }),
  traps: ['Multiplying σ by L instead of √L.', 'Using a per-day σ with a lead time in weeks. Units must match.', 'Applying √L when the problem already gives σ of demand during lead time.', 'Service level is a probability over cycles, not the fraction of units filled (that is fill rate).'],
  analogy: 'Packing for a trip: you bring clothes for the expected days plus a few extra in case of delays. The less predictable the trip, the more extras.',
  convention: 'Demand is assumed normally distributed and independent between periods. z can be exact or read from a two-decimal table.',
  examples: [
    { title: 'Variable daily demand', story: 'Average daily demand is 15 with a standard deviation of 5. Lead time is a constant 2 days and the target service level is 90% (z = 1.28 from the table).', v: { d: 15, sd: 5, L: 2, SL: 90, zMode: 'table' }, expect: { ss: 9.051, ROP: 39.051 } },
    { title: 'Hospital supplies', story: 'Demand during the lead time averages 350 kits with a standard deviation of 10. Management accepts a 5% stockout risk (z = 1.65 from the table).', v: { d: 350, sd: 10, L: 1, SL: 95, sdGiven: 'leadtime', zMode: 'table' }, expect: { ss: 16.5, ROP: 366.5 } },
  ],
  practice: { ask: ['ss', 'ROP'], prompt: (v, f) => `Daily demand averages ${f.int(v.d)} units with a standard deviation of ${f.int(v.sd)} units. Lead time is ${f.int(v.L)} days. For a ${f.pct(v.SL)} cycle service level, find the safety stock and the reorder point (use the exact z-value).` },
  uses: ['reorder-point', 'mad', 'exponential-smoothing'], mono: [['SL', 'ss', 1], ['sd', 'ss', 1], ['L', 'ss', 1], ['d', 'ROP', 1]],
  claim: 'A reorder point of mean lead-time demand plus z·σ·√L avoids a stockout in the stated share of cycles.',
});

export const ssLeadTime: CalcDef = calc({
  id: 'safety-stock-lead-time', name: 'Safety Stock: Variable Lead Time', short: 'Safety stock (lead time)', cat: CAT,
  bq: 'How much buffer do I need when my supplier is unreliable?',
  blurb: 'Safety stock and reorder point when demand is steady but lead time varies.',
  keywords: ['safety stock', 'variable lead time', 'lead time variability', 'unreliable supplier', 'supplier variability'],
  symptoms: ['supplier is unreliable', 'deliveries arrive late', 'lead time varies', 'late shipments'],
  formula: (s) => `${s.ss} = z \\, ${s.d} \\, ${s.sigL}`,
  basis: { from: 'd' },
  inputs: [dIn({ def: 10 }), LIn({ def: 6, label: 'Average lead time' }), num('sL', { sym: 'sigL', label: 'Std. deviation of lead time', blabel: 'How much delivery time swings (std. deviation)', def: 3, time: dur('day'), min: 0, rand: [0.5, 6, 0.5], sens: true, cues: ['standard deviation of lead time', 'lead time standard deviation', 'std dev of lead time', 'standard deviation of'] }), slIn({ def: 98 }), zModeInput()],
  outputs: [out('ss', 'Safety stock', { sym: 'ss', unit: 'units', primary: true }), out('ROP', 'Reorder point', { sym: 'ROP', unit: 'units' }), out('z', 'z-value', { dp: 4 }), out('sigLT', 'Std. dev. of demand during lead time', { sym: 'sigdLT', unit: 'units' }), out('dlt', 'Average demand during lead time', { unit: 'units' })],
  check: slCheck,
  compute: (v) => { const z = zFor(v.SL / 100, v.zMode); const sigLT = v.d * v.sL; return { z, sigLT, ss: z * sigLT, dlt: v.d * v.L, ROP: v.d * v.L + z * sigLT }; },
  steps: (v, o, c) => [
    zStep(c, v.SL, o.z, v.zMode),
    { title: 'Standard deviation of demand during lead time', tex: `${c.s.sigdLT} = ${c.s.d} \\times ${c.s.sigL} = ${c.f.t(v.d, 4)} \\times ${c.f.t(v.sL, 4)} = ${c.f.t(o.sigLT)}`, why: 'Demand per period is constant, so every extra period of delay adds exactly d units of demand. The uncertainty in units is demand rate times the uncertainty in time.', eli: 'If you sell 10 a day and the truck might be 3 days late, you are exposed to about 30 units.' },
    { title: 'Safety stock', tex: `${c.s.ss} = z \\, ${c.s.d} \\, ${c.s.sigL} = ${c.f.t(o.z, 4)} \\times ${c.f.t(o.sigLT)} = ${c.f.t(o.ss)} ${tx(' units')}`, why: 'z standard deviations of lead-time demand.' },
    { title: 'Reorder point', tex: `${c.s.ROP} = ${c.s.d} \\times ${c.s.L} + ${c.s.ss} = ${c.f.t(o.dlt)} + ${c.f.t(o.ss)} = ${c.f.t(o.ROP)} ${tx(' units')}`, why: 'Average lead-time demand plus the buffer.' },
  ],
  biz: (v, o, f) => ({ headline: `Keep ${f.int(Math.ceil(o.ss))} units of safety stock and reorder at ${f.int(Math.ceil(o.ROP))} units.`, meaning: [`The buffer exists entirely because delivery time varies by about ${f.num(v.sL, 1)} ${v._basis}s.`, `It protects you in ${f.pct(v.SL)} of cycles.`], actions: ['Share this number with your supplier: every day of delivery variability they remove cuts your buffer directly.', 'Consider a second, more reliable source for critical items.', 'Track actual delivery times so the standard deviation stays current.'] }),
  viz: (v, o) => normalViz(o.dlt, o.sigLT, o.ROP, { xlabel: 'Demand during lead time (units)', cutLabel: 'Reorder point', shadeLabel: `${v.SL}% of cycles covered` }),
  traps: ['No square root here: safety stock is z × d × σ_LT.', 'σ_LT must be in the same time unit as demand (days with daily demand).'],
  analogy: 'Leaving early for the airport: the less predictable the traffic, the bigger the cushion, even though your walking speed never changes.',
  examples: [
    { title: 'Unreliable supplier', story: 'Daily demand is a steady 10 units. Lead time averages 6 days with a standard deviation of 3 days. Target service level is 98%.', v: { d: 10, L: 6, sL: 3, SL: 98 }, expect: { ss: 61.61, ROP: 121.61 } },
    { title: 'Weekly data', story: 'Demand is 50 a week. Lead time averages 2 weeks with a standard deviation of half a week. Target service level is 95%.', v: { d: 50, d_u: 'week', L: 2, L_u: 'week', sL: 0.5, sL_u: 'week', SL: 95 }, expect: { ss: 41.12, ROP: 141.12 } },
  ],
  practice: { ask: ['ss', 'ROP'], prompt: (v, f) => `Daily demand is constant at ${f.int(v.d)} units. Lead time averages ${f.int(v.L)} days with a standard deviation of ${f.num(v.sL, 1)} days. For a ${f.pct(v.SL)} service level, find the safety stock and reorder point (exact z).` },
  uses: ['reorder-point'], mono: [['SL', 'ss', 1], ['sL', 'ss', 1], ['d', 'ss', 1]],
  claim: 'With constant demand and normal lead times, ROP = d·L + z·d·σ_LT avoids a stockout in the stated share of cycles.',
});

export const ssCombined: CalcDef = calc({
  id: 'safety-stock-combined', name: 'Safety Stock: Variable Demand and Lead Time', short: 'Safety stock (combined)', cat: CAT,
  bq: 'How much buffer do I need when both sales and deliveries are unpredictable?',
  blurb: 'Safety stock and reorder point when both demand and lead time vary.',
  keywords: ['safety stock', 'combined variability', 'demand and lead time variability', 'both variable', 'sqrt(L sigma^2 + d^2 sigma^2)'],
  symptoms: ['i keep running out of stock', 'sales and deliveries are both unpredictable', 'everything varies'],
  formula: (s) => `${s.ss} = z ${sq(`${s.L} ${s.sigd}^2 + ${s.d}^2 ${s.sigL}^2`)}`,
  basis: { from: 'd' },
  inputs: [dIn({ def: 150 }), sdIn({ def: 16 }), LIn({ def: 5, label: 'Average lead time' }), num('sL', { sym: 'sigL', label: 'Std. deviation of lead time', blabel: 'How much delivery time swings (std. deviation)', def: 1, time: dur('day'), min: 0, rand: [0.5, 5, 0.5], sens: true, cues: ['standard deviation of lead time', 'lead time standard deviation', 'lead time std'] }), slIn(), zModeInput()],
  outputs: [out('ss', 'Safety stock', { sym: 'ss', unit: 'units', primary: true }), out('ROP', 'Reorder point', { sym: 'ROP', unit: 'units' }), out('z', 'z-value', { dp: 4 }), out('sigLT', 'Std. dev. of demand during lead time', { sym: 'sigdLT', unit: 'units' }), out('dlt', 'Average demand during lead time', { unit: 'units' }),
    out('shareDemand', 'Variance from demand swings', { fmt: 'pct' }), out('shareLead', 'Variance from lead-time swings', { fmt: 'pct' })],
  check: slCheck,
  compute: (v) => {
    const z = zFor(v.SL / 100, v.zMode); const vd = v.L * v.sd * v.sd, vl = v.d * v.d * v.sL * v.sL; const sigLT = Math.sqrt(vd + vl);
    return { z, varD: vd, varL: vl, sigLT, ss: z * sigLT, dlt: v.d * v.L, ROP: v.d * v.L + z * sigLT, shareDemand: vd + vl > 0 ? (vd / (vd + vl)) * 100 : 0, shareLead: vd + vl > 0 ? (vl / (vd + vl)) * 100 : 0 };
  },
  steps: (v, o, c) => [
    zStep(c, v.SL, o.z, v.zMode),
    { title: 'Variance from demand', tex: `${c.s.L} \\, ${c.s.sigd}^2 = ${c.f.t(v.L, 4)} \\times ${c.f.t(v.sd, 4)}^2 = ${c.f.t(o.varD)}`, why: 'Demand uncertainty accumulates over the average lead time: one period of variance for each period of lead time.' },
    { title: 'Variance from lead time', tex: `${c.s.d}^2 \\, ${c.s.sigL}^2 = ${c.f.t(v.d, 4)}^2 \\times ${c.f.t(v.sL, 4)}^2 = ${c.f.t(o.varL)}`, why: 'Each period of lead-time error is worth d units of demand, so the lead-time variance is scaled by d squared.' },
    { title: 'Combine into one standard deviation', tex: `${c.s.sigdLT} = ${sq(`${c.s.L}${c.s.sigd}^2 + ${c.s.d}^2${c.s.sigL}^2`)} = ${sq(`${c.f.t(o.varD)} + ${c.f.t(o.varL)}`)} = ${c.f.t(o.sigLT)}`, why: 'The two sources are independent, so their variances add. Take the square root at the end, never add the standard deviations themselves.', eli: 'Two separate things can go wrong: customers buy more than usual, or the truck is late. Combine both risks into one number before sizing the buffer.' },
    { title: 'Safety stock and reorder point', tex: `${c.s.ss} = ${c.f.t(o.z, 4)} \\times ${c.f.t(o.sigLT)} = ${c.f.t(o.ss)}, \\quad ${c.s.ROP} = ${c.f.t(o.dlt)} + ${c.f.t(o.ss)} = ${c.f.t(o.ROP)}`, why: 'Buffer equals z combined standard deviations. Reorder point adds the average lead-time demand.' },
  ],
  biz: (v, o, f) => ({ headline: `Keep ${f.int(Math.ceil(o.ss))} units of safety stock and reorder at ${f.int(Math.ceil(o.ROP))} units.`, meaning: [`${f.pct(o.shareLead, 0)} of your risk comes from delivery-time swings and ${f.pct(o.shareDemand, 0)} from sales swings.`, `This covers ${f.pct(v.SL)} of cycles.`], actions: [o.shareLead > 50 ? 'Your supplier is the bigger problem. Work on delivery reliability first.' : 'Sales variability is the bigger problem. Better forecasting will pay off most.', `Set the reorder alert at ${f.int(Math.ceil(o.ROP))} units.`, 'Re-run after any supplier change.'] }),
  viz: (v, o) => normalViz(o.dlt, o.sigLT, o.ROP, { xlabel: 'Demand during lead time (units)', cutLabel: 'Reorder point', shadeLabel: `${v.SL}% of cycles covered` }),
  traps: ['Adding standard deviations instead of variances.', 'Forgetting to square d in the lead-time term.', 'Units of L, d, and σ_d must match (all daily, or all weekly). σ_LT is in the same time unit.'],
  analogy: 'Planning a picnic with an unreliable caterer and an unknown guest count: both uncertainties stack, but not one-for-one.',
  convention: 'ss = z × √(L·σd² + d̄²·σL²). Demand and lead time are assumed independent. All inputs are converted to the same time unit first.',
  examples: [
    { title: 'Both vary', story: 'Daily demand averages 150 with standard deviation 16. Lead time averages 5 days with standard deviation 1 day. Service level 95% (z = 1.65 from the table).', v: { d: 150, sd: 16, L: 5, sL: 1, SL: 95, zMode: 'table' }, expect: { sigLT: 154.208, ss: 254.44, ROP: 1004.44 } },
    { title: 'Computer assembler', story: 'Daily demand averages 2,500 with standard deviation 500. Lead time averages 7 days with standard deviation 7 days. Cycle service level 90%.', v: { d: 2500, sd: 500, L: 7, sL: 7, SL: 90 }, expect: { sigLT: 17549.9, ss: 22491.1 } },
  ],
  practice: { ask: ['ss', 'ROP'], prompt: (v, f) => `Daily demand averages ${f.int(v.d)} units (standard deviation ${f.int(v.sd)}). Lead time averages ${f.int(v.L)} days (standard deviation ${f.num(v.sL, 1)} days). For a ${f.pct(v.SL)} service level, find the safety stock and reorder point (exact z).` },
  uses: ['safety-stock-demand', 'safety-stock-lead-time'], mono: [['SL', 'ss', 1], ['sd', 'ss', 1], ['sL', 'ss', 1]],
  claim: 'ROP = d·L + z·√(L·σd² + d²·σL²) avoids a stockout in the stated share of cycles when demand and lead time both vary.',
});

export const cycleServiceLevel: CalcDef = calc({
  id: 'cycle-service-level', name: 'Cycle Service Level', short: 'Cycle service level', cat: CAT,
  bq: 'How often will I run out with my current reorder point?',
  blurb: 'The probability of not stocking out in a replenishment cycle, given your reorder point and demand variability.',
  keywords: ['cycle service level', 'csl', 'service level', 'stockout probability', 'in-stock probability', 'probability of stockout'],
  symptoms: ['how often will i run out', 'chance of stockout', 'is my reorder point enough', 'what service level am i getting'],
  formula: (s) => `${s.CSL} = \\Phi\\left(${fr(`${s.ROP} - ${s.d}${s.L}`, s.sigdLT)}\\right)`,
  basis: { from: 'd' },
  inputs: [dIn({ def: 2500, time: rate('week'), rand: [50, 3000, 50] }), sdIn({ def: 500, time: sdT('week'), rand: [10, 600, 10] }), LIn({ def: 2, time: dur('week'), rand: [1, 8, 1] }), num('ROP', { sym: 'ROP', label: 'Reorder point', blabel: 'Stock level at which you reorder', unit: 'units', def: 6000, min: 0, rand: [100, 20000, 50], sens: true, cues: ['reorder point', 'reorders when', 'rop'] })],
  outputs: [out('CSL', 'Cycle service level', { sym: 'CSL', fmt: 'pct', primary: true, dp: 2 }), out('pOut', 'Stockout probability per cycle', { fmt: 'pct', dp: 2 }), out('ss', 'Implied safety stock', { sym: 'ss', unit: 'units' }), out('z', 'z-value', { dp: 4 }), out('sigLT', 'Std. dev. of demand during lead time', { sym: 'sigdLT' }), out('dlt', 'Average demand during lead time', {})],
  check: (v) => (v.sd === 0 || v.L === 0 ? null : null),
  compute: (v) => { const dlt = v.d * v.L, sigLT = v.sd * Math.sqrt(v.L), ss = v.ROP - dlt; const z = sigLT > 0 ? ss / sigLT : ss >= 0 ? Infinity : -Infinity; const p = sigLT > 0 ? normCdf(z) : ss >= 0 ? 1 : 0; return { dlt, sigLT, ss, z, CSL: p * 100, pOut: (1 - p) * 100 }; },
  steps: (v, o, c) => [
    { title: 'Demand during lead time: mean and standard deviation', tex: `${c.s.d}${c.s.L} = ${c.f.t(o.dlt)}, \\quad ${c.s.sigdLT} = ${c.s.sigd}${sq(c.s.L)} = ${c.f.t(v.sd, 4)}${sq(c.f.t(v.L, 4))} = ${c.f.t(o.sigLT)}`, why: 'Lead-time demand is the sum of demand over L periods: the mean scales with L and the standard deviation with √L.' },
    { title: 'Implied safety stock', tex: `${c.s.ss} = ${c.s.ROP} - ${c.s.d}${c.s.L} = ${c.f.t(v.ROP)} - ${c.f.t(o.dlt)} = ${c.f.t(o.ss)}`, why: 'Whatever the reorder point holds beyond expected lead-time demand is your buffer.' },
    { title: 'Convert to a z-value', tex: `z = ${fr(c.s.ss, c.s.sigdLT)} = ${fr(c.f.t(o.ss), c.f.t(o.sigLT))} = ${c.f.t(o.z, 4)}`, why: 'How many standard deviations of protection the buffer provides.' },
    { title: 'Look up the probability', tex: `${c.s.CSL} = \\Phi(${c.f.t(o.z, 4)}) = ${c.f.t(o.CSL / 100, 4)}`, lookup: zLookupText(o.z), why: 'The area under the normal curve to the left of z is the chance that lead-time demand stays at or below the reorder point.', eli: 'Out of 100 order cycles, this is how many end without running out.' },
  ],
  biz: (v, o, f) => ({ headline: `With a reorder point of ${f.int(v.ROP)}, you avoid a stockout in ${f.pct(o.CSL)} of cycles.`, meaning: [`You run out in roughly 1 of every ${o.pOut > 0 ? f.num(100 / o.pOut, 0) : '∞'} order cycles.`, `Your reorder point includes ${f.int(o.ss)} units of safety stock.`], actions: [o.CSL < 90 ? 'Raise the reorder point: most retailers target 90 to 98%.' : 'Your protection is in a healthy range. Check fill rate to see the customer-facing picture.', 'Use the Safety Stock calculator to find the reorder point for a specific target.'] }),
  viz: (v, o) => normalViz(o.dlt, o.sigLT, v.ROP, { xlabel: 'Demand during lead time (units)', cutLabel: 'Reorder point', shadeLabel: 'No stockout' }),
  traps: ['Cycle service level counts cycles without a stockout. It says nothing about how many units were short (use fill rate for that).', 'A reorder point below average lead-time demand gives a service level under 50%.'],
  analogy: 'An umbrella policy: it tells you how many rainy days you stay dry, not how wet you get when you do not.',
  examples: [
    { title: 'Weekly demand', story: 'Weekly demand averages 2,500 with standard deviation 500. Lead time is 2 weeks and the reorder point is 6,000.', v: { d: 2500, sd: 500, L: 2, ROP: 6000 }, expect: { ss: 1000, sigLT: 707.107, CSL: 92.135 } },
    { title: 'Daily demand', story: 'Daily demand averages 100 with standard deviation 20. Lead time is 4 days and the reorder point is 460.', v: { d: 100, d_u: 'day', sd: 20, sd_u: 'day', L: 4, L_u: 'day', ROP: 460 }, expect: { z: 1.5, CSL: 93.319 } },
  ],
  practice: { ask: ['CSL'], gen: (r) => { const d = 50 + Math.floor(r() * 40) * 50, L = 1 + Math.floor(r() * 6), sd = Math.round(d * (0.1 + r() * 0.3)); return { d, sd, L, ROP: Math.round(d * L + (0.3 + r() * 2) * sd * Math.sqrt(L)) }; }, prompt: (v, f) => `Weekly demand averages ${f.int(v.d)} units with a standard deviation of ${f.int(v.sd)}. Lead time is ${f.int(v.L)} weeks and the reorder point is ${f.int(v.ROP)} units. What cycle service level (in %) does this policy achieve?` },
  uses: ['reorder-point', 'safety-stock-demand'], mono: [['ROP', 'CSL', 1]],
  claim: 'The computed service level matches the share of simulated cycles that end without a stockout.',
});

export const fillRate: CalcDef = calc({
  id: 'fill-rate', name: 'Fill Rate and Expected Shortage per Cycle', short: 'Fill rate', cat: CAT,
  bq: 'What share of customer demand do I fill straight from stock?',
  blurb: 'Expected units short per cycle (using the unit normal loss function) and the resulting fill rate, or the safety stock needed for a target fill rate.',
  keywords: ['fill rate', 'expected shortage per cycle', 'esc', 'unit normal loss', 'loss function', 'product fill rate', 'type 2 service', 'L(z)'],
  symptoms: ['what percent of demand do i fill', 'lost sales', 'units short', 'how many sales am i missing'],
  formula: (s) => `${s.ESC} = ${s.sigdLT} \\, ${s.G}, \\quad ${s.fr} = 1 - ${fr(s.ESC, s.Q)}`,
  basis: { from: 'd' },
  inputs: [sel('solve', 'Solve for', [['fill', 'Fill rate from a reorder point'], ['ss', 'Safety stock for a target fill rate']], 'fill'),
    dIn({ def: 2500, time: rate('week'), rand: [50, 3000, 50] }), sdIn({ def: 500, time: sdT('week'), rand: [10, 600, 10] }), LIn({ def: 2, time: dur('week'), rand: [1, 8, 1] }),
    num('Q', { sym: 'Q', label: 'Order quantity', blabel: 'Units per replenishment order', unit: 'units', def: 10000, min: 0.0001, rand: [500, 20000, 100], sens: true, cues: ['order quantity', 'lot size', 'orders of', 'replenishment lot'] }),
    num('ROP', { sym: 'ROP', label: 'Reorder point', blabel: 'Stock level at which you reorder', unit: 'units', def: 6000, min: 0, rand: [100, 20000, 50], sens: true, show: (v) => v.solve !== 'ss', cues: ['reorder point', 'rop'] }),
    pct('target', { sym: 'fr', label: 'Target fill rate', blabel: 'Share of demand you want to fill from stock', def: 97.5, min: 0.01, max: 99.9999, rand: [90, 99.5, 0.5], show: (v) => v.solve === 'ss', cues: ['fill rate of', 'target fill rate', 'desired fill rate'] })],
  outputs: [out('fillRate', 'Fill rate', { sym: 'fr', fmt: 'pct', dp: 2, primary: true }), out('ESC', 'Expected shortage per cycle', { sym: 'ESC', unit: 'units' }), out('ss', 'Safety stock', { sym: 'ss', unit: 'units' }), out('ROPout', 'Reorder point', { sym: 'ROP', unit: 'units' }), out('z', 'z-value', { dp: 4 }), out('G', 'Unit normal loss', { sym: 'G', dp: 4 }), out('CSL', 'Cycle service level', { fmt: 'pct', dp: 2 }), out('sigLT', 'Std. dev. of demand during lead time', { sym: 'sigdLT' })],
  check: (v) => (v.sd * Math.sqrt(v.L) <= 0 ? 'Demand variability or lead time is zero, so there is nothing uncertain: the fill rate is 100% whenever the reorder point covers lead-time demand.' : null),
  compute: (v) => {
    const dlt = v.d * v.L, sigLT = v.sd * Math.sqrt(v.L);
    if (v.solve === 'ss') { const ESC = v.Q * (1 - v.target / 100); const G = ESC / sigLT; const z = lossInv(G); const ss = z * sigLT; return { dlt, sigLT, ESC, G, z, ss, ROPout: dlt + ss, fillRate: v.target, CSL: normCdf(z) * 100 }; }
    const ss = v.ROP - dlt, z = ss / sigLT, G = lossG(z), ESC = sigLT * G;
    return { dlt, sigLT, ss, z, G, ESC, ROPout: v.ROP, fillRate: Math.max(0, 1 - ESC / v.Q) * 100, CSL: normCdf(z) * 100 };
  },
  steps: (v, o, c) => v.solve === 'ss' ? [
    { title: 'Allowed shortage per cycle', tex: `${c.s.ESC} = (1 - ${c.s.fr}) ${c.s.Q} = (1 - ${c.f.t(v.target / 100, 4)})(${c.f.t(v.Q)}) = ${c.f.t(o.ESC)}`, why: 'A fill rate target says what fraction of each order cycle\'s demand may go unfilled.' },
    { title: 'Required loss-function value', tex: `${c.s.G} = ${fr(c.s.ESC, c.s.sigdLT)} = ${fr(c.f.t(o.ESC), c.f.t(o.sigLT))} = ${c.f.t(o.G, 4)}`, why: 'Divide by the standard deviation of lead-time demand to get a standardized shortage.' },
    { title: 'Find z from the loss table', tex: `z = ${c.f.t(o.z, 4)}`, lookup: `Unit normal loss table: find the z whose loss value is ${o.G.toFixed(4)}. That is z = ${o.z.toFixed(2)} (exact ${o.z.toFixed(4)}).`, why: 'The loss function is read in reverse: from the allowed shortage back to z.' },
    { title: 'Safety stock and reorder point', tex: `${c.s.ss} = z \\, ${c.s.sigdLT} = ${c.f.t(o.z, 4)} \\times ${c.f.t(o.sigLT)} = ${c.f.t(o.ss)}, \\quad ${c.s.ROP} = ${c.f.t(o.dlt)} + ${c.f.t(o.ss)} = ${c.f.t(o.ROPout)}`, why: 'Translate z back into units.' },
  ] : [
    { title: 'Standard deviation of demand during lead time', tex: `${c.s.sigdLT} = ${c.s.sigd}${sq(c.s.L)} = ${c.f.t(v.sd, 4)}${sq(c.f.t(v.L, 4))} = ${c.f.t(o.sigLT)}`, why: 'Uncertainty over the lead time grows with the square root of its length.' },
    { title: 'Safety stock and z', tex: `${c.s.ss} = ${c.s.ROP} - ${c.s.d}${c.s.L} = ${c.f.t(o.ss)}, \\quad z = ${fr(c.s.ss, c.s.sigdLT)} = ${c.f.t(o.z, 4)}`, why: 'Express the buffer in standard deviations.' },
    { title: 'Unit normal loss function', tex: `${c.s.G} = \\phi(z) - z\\,[1 - \\Phi(z)] = ${c.f.t(o.G, 4)}`, lookup: `Unit normal loss table: z = ${o.z.toFixed(2)} gives ${lossG(Math.round(o.z * 100) / 100).toFixed(4)} (exact z gives ${o.G.toFixed(4)}).`, why: 'The loss function gives the expected number of standard deviations by which demand exceeds the reorder point.', eli: 'This table answers: when I do run out, how badly, on average?' },
    { title: 'Expected shortage per cycle', tex: `${c.s.ESC} = ${c.s.sigdLT} \\, ${c.s.G} = ${c.f.t(o.sigLT)} \\times ${c.f.t(o.G, 4)} = ${c.f.t(o.ESC)} ${tx(' units')}`, why: 'Scale the standardized shortage back to units.' },
    { title: 'Fill rate', tex: `${c.s.fr} = 1 - ${fr(c.s.ESC, c.s.Q)} = 1 - ${fr(c.f.t(o.ESC), c.f.t(v.Q))} = ${c.f.t(o.fillRate / 100, 4)}`, why: `Each cycle serves Q units of demand on average. The fraction not short is the fill rate.${o.ESC > v.Q ? ' Here the expected shortage is larger than the order quantity, which means the reorder point is far below lead-time demand and almost nothing is filled from stock, so the fill rate is reported as 0%.' : ''}`, eli: 'Of every 100 units customers want, this many are on the shelf when they ask.' },
  ],
  biz: (v, o, f) => v.solve === 'ss'
    ? { headline: `To fill ${f.pct(v.target)} of demand from stock, keep ${f.int(Math.ceil(o.ss))} units of safety stock.`, meaning: [`Reorder at ${f.int(Math.ceil(o.ROPout))} units.`, `You will be short about ${f.num(o.ESC, 1)} units per order cycle on average.`, `Stockouts happen in ${f.pct(100 - o.CSL)} of cycles, but each one is small.`], actions: ['Use this reorder point if what you care about is units delivered, not the number of stockout events.', 'Larger order quantities raise fill rate for free, because there are fewer cycles to stock out in.'] }
    : { headline: `You fill ${f.pct(o.fillRate, 2)} of demand straight from stock.`, meaning: [`You are short about ${f.num(o.ESC, 1)} units in each order cycle of ${f.int(v.Q)}.`, `A stockout of some size happens in ${f.pct(100 - o.CSL)} of cycles.`], actions: [o.fillRate < 95 ? 'Raise the reorder point: most businesses target a 95 to 99% fill rate.' : 'Fill rate is healthy. You may be able to trim safety stock on slow items.', 'Track lost or backordered units to check this against reality.'] },
  viz: (v, o) => normalViz(o.dlt, o.sigLT, o.ROPout, { xlabel: 'Demand during lead time (units)', cutLabel: 'Reorder point', shadeLabel: 'Demand you cannot fill', side: 'right' }),
  traps: ['Fill rate is almost always higher than cycle service level. They answer different questions.', 'Divide expected shortage by the order quantity Q, not by lead-time demand.', 'Use the loss function table, not the cumulative normal table, for this step.'],
  analogy: 'Cycle service level asks "did it rain on my picnic?" Fill rate asks "how many sandwiches got wet?"',
  convention: 'ESC = σ_L × G(z) where G(z) = φ(z) − z[1 − Φ(z)] is the unit normal loss function; fill rate = 1 − ESC/Q.',
  examples: [
    { title: 'Fill rate from a reorder point', story: 'Weekly demand averages 2,500 (standard deviation 500). Lead time is 2 weeks, reorder point 6,000, and order quantity 10,000.', v: { d: 2500, sd: 500, L: 2, ROP: 6000, Q: 10000 }, expect: { ESC: 25.13, fillRate: 99.749 } },
    { title: 'Daily demand', story: 'Daily demand averages 100 (standard deviation 20), lead time 4 days, reorder point 460, order quantity 500.', v: { d: 100, d_u: 'day', sd: 20, sd_u: 'day', L: 4, L_u: 'day', ROP: 460, Q: 500 }, expect: { G: 0.0293, ESC: 1.172, fillRate: 99.766 } },
  ],
  practice: { ask: ['fillRate'], gen: (r) => { const d = 50 + Math.floor(r() * 40) * 50, L = 1 + Math.floor(r() * 6), sd = Math.round(d * (0.1 + r() * 0.3)); return { solve: 'fill', d, sd, L, ROP: Math.round(d * L + (0.2 + r() * 1.5) * sd * Math.sqrt(L)), Q: Math.round(d * (2 + r() * 4) / 10) * 10 }; }, prompt: (v, f) => `Weekly demand averages ${f.int(v.d)} units (standard deviation ${f.int(v.sd)}). Lead time is ${f.int(v.L)} weeks, the reorder point is ${f.int(v.ROP)}, and the order quantity is ${f.int(v.Q)}. What fill rate (in %) does this policy achieve?` },
  gen: (r) => { const d = 50 + Math.floor(r() * 60) * 50, L = 1 + Math.floor(r() * 8), sd = Math.round(d * (0.05 + r() * 0.4)); const solve = r() < 0.3 ? 'ss' : 'fill'; return { solve, d, sd, L, ROP: Math.round(d * L + (-0.5 + r() * 3) * sd * Math.sqrt(L)), Q: Math.round(d * (1 + r() * 6)), target: 90 + Math.floor(r() * 19) * 0.5 }; },
  uses: ['cycle-service-level', 'safety-stock-demand'], mono: [['ROP', 'fillRate', 1], ['Q', 'fillRate', 1]],
  claim: 'The computed fill rate matches the long-run share of demand filled from stock in simulation.',
});

export const newsvendor: CalcDef = calc({
  id: 'newsvendor', name: 'Newsvendor (Single-Period) Model', short: 'Newsvendor', cat: CAT,
  bq: 'How much should I buy for a one-time selling season?',
  blurb: 'The order quantity that maximizes expected profit when you get one chance to order before uncertain demand arrives.',
  keywords: ['newsvendor', 'newsboy', 'single period', 'critical ratio', 'critical fractile', 'overage', 'underage', 'one-time order', 'perishable', 'seasonal order'],
  symptoms: ['one-time order', 'seasonal product', 'perishable', 'how many to buy for an event', 'leftovers', 'fashion item'],
  formula: (s) => `\\Phi(z) = ${fr(s.Cu, `${s.Cu} + ${s.Co}`)}, \\quad ${s.Qopt} = \\mu + z\\sigma`,
  inputs: [sel('costMode', 'Costs given as', [['price', 'Price, cost, and salvage value'], ['direct', 'Underage and overage cost directly']], 'price'),
    money('price', { sym: 'p', label: 'Selling price', blabel: 'Selling price per unit', def: 1.25, min: 0, rand: [10, 200, 5], show: (v) => v.costMode !== 'direct', sens: true, cues: ['sells for', 'selling price', 'retail price', 'price of', 'sold for'] }),
    money('cost', { sym: 'c', label: 'Unit cost', blabel: 'What you pay per unit', def: 0.7, min: 0, rand: [2, 9, 1], show: (v) => v.costMode !== 'direct', sens: true, cues: ['costs', 'unit cost', 'purchase cost', 'buys', 'wholesale'] }),
    money('salvage', { sym: 's', label: 'Salvage value', blabel: 'What a leftover unit is worth', def: 0.3, min: -1e9, rand: [0, 1, 0.25], show: (v) => v.costMode !== 'direct', cues: ['salvage', 'scrap value', 'sold off for', 'buy back', 'marked down to'] }),
    money('Cu', { sym: 'Cu', label: 'Cost of underage (per unit short)', def: 0.55, min: 0.0001, rand: [1, 100, 1], show: (v) => v.costMode === 'direct', cues: ['underage', 'shortage cost', 'cost of understocking'] }),
    money('Co', { sym: 'Co', label: 'Cost of overage (per unit left over)', def: 0.4, min: 0.0001, rand: [1, 100, 1], show: (v) => v.costMode === 'direct', cues: ['overage', 'cost of overstocking'] }),
    num('mu', { sym: '\\mu', label: 'Mean demand', blabel: 'Expected demand', unit: 'units', def: 120, min: 0, rand: [100, 5000, 50], sens: true, cues: ['mean demand', 'average demand', 'mean of', 'expected demand', 'demand averages'] }),
    num('sigma', { sym: '\\sigma', label: 'Std. deviation of demand', blabel: 'How uncertain demand is (std. deviation)', unit: 'units', def: 15, min: 0, rand: [10, 900, 10], sens: true, cues: ['standard deviation', 'std dev', 'sigma'] }), zModeInput()],
  outputs: [out('Q', 'Optimal order quantity', { sym: 'Qopt', unit: 'units', primary: true }), out('CR', 'Critical ratio', { dp: 4 }), out('z', 'z-value', { dp: 4 }),
    out('profit', 'Expected profit', { fmt: 'money' }), out('sales', 'Expected sales', { unit: 'units' }), out('leftover', 'Expected leftover', { unit: 'units' }), out('lost', 'Expected lost sales', { unit: 'units' }), out('maxProfit', 'Profit with perfect foresight', { fmt: 'money' }), out('mismatch', 'Cost of uncertainty', { fmt: 'money' })],
  check: (v) => { if (v.costMode !== 'direct') { if (v.price <= v.cost) return 'Selling price must be higher than unit cost, otherwise every unit loses money and the best order is zero.'; if (v.salvage >= v.cost) return 'Salvage value must be below unit cost. If leftovers are worth more than you paid, you would order an unlimited amount.'; } return null; },
  compute: (v) => {
    const Cu = v.costMode === 'direct' ? v.Cu : v.price - v.cost, Co = v.costMode === 'direct' ? v.Co : v.cost - v.salvage;
    const CR = Cu / (Cu + Co); const z = zFor(CR, v.zMode); const Q = v.mu + z * v.sigma; const lost = v.sigma * lossG(z); const sales = v.mu - lost; const leftover = Q - sales;
    const profit = Cu * sales - Co * leftover; return { Cu, Co, CR, z, Q, lost, sales, leftover, profit, maxProfit: Cu * v.mu, mismatch: Cu * v.mu - profit };
  },
  steps: (v, o, c) => [
    ...(v.costMode !== 'direct' ? [{ title: 'Underage and overage costs', tex: `${c.s.Cu} = p - c = ${c.f.t(v.price)} - ${c.f.t(v.cost)} = ${c.f.t(o.Cu)}, \\quad ${c.s.Co} = c - s = ${c.f.t(v.cost)} - ${c.f.t(v.salvage)} = ${c.f.t(o.Co)}`, why: 'Underage cost is the profit lost on each unit you could have sold but did not stock. Overage cost is the loss on each unit left over.', eli: 'Too few: you miss a sale. Too many: you eat the loss on leftovers. Put a dollar figure on each mistake.' }] : []),
    { title: 'Critical ratio', tex: `CR = ${fr(c.s.Cu, `${c.s.Cu} + ${c.s.Co}`)} = ${fr(c.f.t(o.Cu), `${c.f.t(o.Cu)} + ${c.f.t(o.Co)}`)} = ${c.f.t(o.CR, 4)}`, why: 'Order up to the point where the chance of selling one more unit times its profit equals the chance of not selling it times its loss. That happens when the probability demand is at or below Q equals this ratio.', eli: 'If missing a sale hurts much more than a leftover, stock generously. The ratio says exactly how generously.' },
    { title: 'Find z for the critical ratio', tex: `z = \\Phi^{-1}(${c.f.t(o.CR, 4)}) = ${c.f.t(o.z, v.zMode === 'exact' ? 4 : 2)}`, lookup: zLookupText(o.z, o.CR), why: `Convert the target probability into standard deviations above (or below) the mean.${v.zMode === 'roundup' ? ' Round-up rule: take the next larger z in the table.' : ''}` },
    { title: 'Optimal order quantity', tex: `${c.s.Qopt} = \\mu + z\\sigma = ${c.f.t(v.mu)} + ${c.f.t(o.z, 4)}(${c.f.t(v.sigma)}) = ${c.f.t(o.Q)} ${tx(' units')}`, why: 'Shift from the mean by z standard deviations.' },
    { title: 'Expected lost sales', tex: `${c.s.ESC} = \\sigma \\, ${c.s.G} = ${c.f.t(v.sigma)} \\times ${c.f.t(lossG(o.z), 4)} = ${c.f.t(o.lost)}`, lookup: `Unit normal loss table: z = ${o.z.toFixed(2)} gives ${lossG(Math.round(o.z * 100) / 100).toFixed(4)}.`, why: 'The loss function gives the expected demand above Q, in standard deviations.' },
    { title: 'Expected sales and leftover', tex: `${tx('sales')} = \\mu - ${c.f.t(o.lost)} = ${c.f.t(o.sales)}, \\quad ${tx('leftover')} = ${c.s.Q} - ${tx('sales')} = ${c.f.t(o.leftover)}`, why: 'What you expect to sell is demand minus lost sales. Whatever you ordered but did not sell is leftover.' },
    { title: 'Expected profit', tex: `${c.s.Cu} \\times ${tx('sales')} - ${c.s.Co} \\times ${tx('leftover')} = ${c.f.t(o.Cu)}(${c.f.t(o.sales)}) - ${c.f.t(o.Co)}(${c.f.t(o.leftover)}) = ${c.f.money(o.profit, 2)}`, why: 'Earn the margin on every unit sold and take the overage loss on every unit left.' },
  ],
  biz: (v, o, f) => ({ headline: `Order ${f.int(Math.round(o.Q))} units.`, meaning: [`Expected profit is ${f.money(o.profit)}. You should expect to sell about ${f.int(o.sales)} and have ${f.int(o.leftover)} left over.`, `You will miss about ${f.int(o.lost)} units of demand on average, and that is intentional.`, `Uncertainty costs you ${f.money(o.mismatch)} compared with knowing demand exactly.`], actions: [o.CR > 0.5 ? 'Missing a sale costs more than a leftover, so ordering above the average forecast is correct.' : 'Leftovers cost more than a missed sale, so ordering below the average forecast is correct.', 'Negotiate a better return or markdown deal: a higher salvage value lifts both the order size and profit.', 'If a second order is possible mid-season, order less up front.'] }),
  viz: (v, o) => normalViz(v.mu, v.sigma, o.Q, { xlabel: 'Demand (units)', cutLabel: 'Order quantity', shadeLabel: `${(o.CR * 100).toFixed(1)}% chance demand is covered` }),
  traps: ['Swapping underage and overage costs.', 'Forgetting salvage value in the overage cost: Co = cost − salvage.', 'Assuming the best order equals mean demand. That is only true when the critical ratio is exactly 0.5.', 'Cachon & Terwiesch round z up to the next table value. Other books use the nearest or exact value.'],
  analogy: 'A baker deciding how many croissants to make before the doors open: each unsold one is wasted flour, each customer turned away is lost profit.',
  convention: 'Critical ratio = Cu / (Cu + Co). Demand is modeled as normal. Expected lost sales use the unit normal loss function.',
  examples: [
    { title: 'Newsstand', story: 'A paper sells for $1.25, costs $0.70, and unsold copies return $0.30. Daily demand averages 120 with standard deviation 15.', v: { price: 1.25, cost: 0.7, salvage: 0.3, mu: 120, sigma: 15 }, expect: { CR: 0.5789, Q: 122.99 } },
    { title: 'Wetsuit season', story: 'A wetsuit sells for $190, costs $110, and leftovers sell for $90. Demand is normal with mean 3,192 and standard deviation 1,181. Use the round-up rule.', v: { price: 190, cost: 110, salvage: 90, mu: 3192, sigma: 1181, zMode: 'roundup' }, expect: { CR: 0.8, z: 0.85, Q: 4195.85, lost: 129.88, profit: 222295.3 } },
  ],
  practice: { ask: ['Q'], gen: (r) => { const cost = 5 + Math.floor(r() * 40); const price = cost + 5 + Math.floor(r() * 60); const salvage = Math.floor(r() * cost * 0.8); const mu = 100 + Math.floor(r() * 40) * 50; return { costMode: 'price', price, cost, salvage, mu, sigma: Math.round(mu * (0.1 + r() * 0.3)), zMode: 'exact' }; }, prompt: (v, f) => `A seasonal item sells for ${f.money(v.price)}, costs ${f.money(v.cost)}, and leftovers are salvaged for ${f.money(v.salvage)}. Demand is normal with mean ${f.int(v.mu)} and standard deviation ${f.int(v.sigma)}. What is the optimal order quantity (exact z)?` },
  gen: (r) => { const direct = r() < 0.4; const cost = 2 + Math.floor(r() * 80); const price = cost + 1 + Math.floor(r() * 100); const salvage = Math.floor(r() * cost * 0.9 * 100) / 100; const mu = 50 + Math.floor(r() * 5000); return { costMode: direct ? 'direct' : 'price', price, cost, salvage, Cu: 1 + Math.floor(r() * 100), Co: 1 + Math.floor(r() * 100), mu, sigma: Math.round(mu * (0.05 + r() * 0.35)) + 1, zMode: 'exact' }; },
  uses: ['fill-rate'], mono: [['mu', 'Q', 1]],
  claim: 'The critical-ratio quantity earns the highest average profit of any order quantity in simulation.',
});

export const periodicReview: CalcDef = calc({
  id: 'periodic-review', name: 'Periodic Review (Order-Up-To Level)', short: 'Periodic review', cat: CAT,
  bq: 'I order on a fixed schedule. How much should I order each time?',
  blurb: 'The order-up-to level and order quantity for a system that reviews stock at fixed intervals.',
  keywords: ['periodic review', 'order up to level', 'fixed period', 'P system', 'base stock', 'target inventory level', 'review period', 'OUL'],
  symptoms: ['i order every week', 'fixed order schedule', 'supplier delivers on fixed days', 'how much to order each review'],
  formula: (s) => `OUL = ${s.d}(T + ${s.L}) + z \\, ${s.sigd} ${sq(`T + ${s.L}`)}`,
  basis: { from: 'd' },
  inputs: [dIn({ def: 10 }), sdIn({ def: 3 }), num('T', { sym: 'T', label: 'Review period', blabel: 'Time between your stock checks', def: 30, time: dur('day'), min: 0.0001, rand: [5, 30, 1], sens: true, cues: ['review period', 'reviews every', 'reviewed every', 'orders every', 'every'] }), LIn({ def: 14 }), slIn({ def: 98 }),
    num('onHand', { sym: 'I', label: 'Inventory on hand (plus on order)', blabel: 'Stock on hand plus already on order', unit: 'units', def: 150, min: 0, rand: [0, 300, 10], cues: ['on hand', 'in stock', 'currently has', 'inventory position'] }), zModeInput()],
  outputs: [out('OUL', 'Order-up-to level', { sym: 'OUL', unit: 'units', primary: true }), out('Q', 'Order quantity now', { sym: 'Q', unit: 'units' }), out('ss', 'Safety stock', { sym: 'ss', unit: 'units' }), out('z', 'z-value', { dp: 4 }), out('sigTL', 'Std. dev. over T + L', { unit: 'units' }), out('avgQ', 'Average order size', { unit: 'units' })],
  check: slCheck,
  compute: (v) => { const z = zFor(v.SL / 100, v.zMode); const sigTL = v.sd * Math.sqrt(v.T + v.L); const ss = z * sigTL; const OUL = v.d * (v.T + v.L) + ss; return { z, sigTL, ss, OUL, Q: Math.max(0, OUL - v.onHand), avgQ: v.d * v.T }; },
  steps: (v, o, c) => [
    zStep(c, v.SL, o.z, v.zMode),
    { title: 'Exposure period', tex: `T + ${c.s.L} = ${c.f.t(v.T, 4)} + ${c.f.t(v.L, 4)} = ${c.f.t(v.T + v.L, 4)} ${tx(` ${c.u}s`)}`, why: 'An order placed now must cover demand until the next order arrives: one review period plus one lead time.', eli: 'If you shop every Saturday and delivery takes 2 days, what you buy today has to last 9 days.' },
    { title: 'Safety stock', tex: `${c.s.ss} = z \\, ${c.s.sigd} ${sq(`T + ${c.s.L}`)} = ${c.f.t(o.z, 4)} \\times ${c.f.t(v.sd, 4)} ${sq(c.f.t(v.T + v.L, 4))} = ${c.f.t(o.ss)}`, why: 'Protection must cover variability over the whole exposure period, which is longer than in a continuous review system. That is why periodic systems need more safety stock.' },
    { title: 'Order-up-to level', tex: `OUL = ${c.s.d}(T + ${c.s.L}) + ${c.s.ss} = ${c.f.t(v.d, 4)}(${c.f.t(v.T + v.L, 4)}) + ${c.f.t(o.ss)} = ${c.f.t(o.OUL)}`, why: 'Expected demand over the exposure period plus safety stock.' },
    { title: 'Order quantity at this review', tex: `${c.s.Q} = OUL - I = ${c.f.t(o.OUL)} - ${c.f.t(v.onHand)} = ${c.f.t(o.Q)}`, why: 'Order whatever brings the inventory position (on hand plus on order) back up to the target.' },
  ],
  biz: (v, o, f) => ({ headline: `Order ${f.int(Math.round(o.Q))} units now to bring stock up to ${f.int(Math.round(o.OUL))}.`, meaning: [`At every review, top up to ${f.int(Math.round(o.OUL))} units (on hand plus on order).`, `${f.int(Math.round(o.ss))} of that is safety stock.`, `A typical order will be about ${f.int(o.avgQ)} units.`], actions: ['Review on schedule: a skipped review is the main way this system fails.', 'Shorter review periods cut safety stock. Weekly instead of monthly makes a real difference.', 'For expensive or critical items, consider continuous review instead.'] }),
  viz: (v, o) => { const s = sawtooth({ Q: Math.max(v.d * v.T, 1e-6), d: v.d, ss: Math.max(o.ss, 0), unit: v._basis ?? 'day' }); s.hlines.push({ y: o.OUL, label: 'Order-up-to level', tone: 'accent' as any }); return s; },
  traps: ['Using √L instead of √(T + L).', 'Forgetting to subtract inventory on hand and on order.', 'T and L must be in the same time unit as demand.'],
  analogy: 'Topping up a gas tank every Sunday: you do not know how far you will drive, so you always fill to the same line.',
  examples: [
    { title: 'Monthly review', story: 'Daily demand averages 10 (standard deviation 3). Stock is reviewed every 30 days, lead time is 14 days, and 150 units are on hand. Target 98% (z = 2.05 from the table).', v: { d: 10, sd: 3, T: 30, L: 14, SL: 98, onHand: 150, zMode: 'table' }, expect: { ss: 40.794, OUL: 480.794, Q: 330.794 } },
    { title: 'Weekly demand', story: 'Weekly demand averages 2,500 (standard deviation 500). Review every 4 weeks, lead time 2 weeks, 90% service level, nothing on hand.', v: { d: 2500, d_u: 'week', sd: 500, sd_u: 'week', T: 4, T_u: 'week', L: 2, L_u: 'week', SL: 90, onHand: 0 }, expect: { ss: 1569.6, OUL: 16569.6 } },
  ],
  practice: { ask: ['OUL', 'Q'], prompt: (v, f) => `Daily demand averages ${f.int(v.d)} units (standard deviation ${f.int(v.sd)}). Inventory is reviewed every ${f.int(v.T)} days and lead time is ${f.int(v.L)} days. With ${f.int(v.onHand)} units on hand and a ${f.pct(v.SL)} service level, find the order-up-to level and the order quantity (exact z).` },
  uses: ['safety-stock-demand'], mono: [['SL', 'OUL', 1], ['T', 'OUL', 1], ['L', 'OUL', 1], ['onHand', 'Q', -1]],
  claim: 'Ordering up to d(T+L) + z·σ·√(T+L) avoids a stockout in the stated share of review cycles.',
});

export const continuousReview: CalcDef = calc({
  id: 'continuous-review', name: 'Continuous Review (s, Q) Policy', short: '(s, Q) policy', cat: CAT,
  bq: 'What is my complete reorder policy: when and how much?',
  blurb: 'A full continuous-review policy: order Q (the EOQ) whenever stock falls to the reorder point s, with safety stock sized for your service level.',
  keywords: ['continuous review', 's Q policy', 'Q system', 'fixed order quantity system', 'reorder point policy', 'two-bin', '(s,Q)', '(Q,R)'],
  symptoms: ['i need a complete inventory policy', 'when and how much to order', 'set up reorder rules'],
  formula: (s) => `${s.Q} = ${sq(fr(`2${s.D}${s.S}`, s.H))}, \\quad s = ${s.d}${s.L} + z\\,${s.sigd}${sq(s.L)}`,
  basis: { from: 'd' },
  inputs: [dIn(), sdIn(), LIn(), money('S', { sym: 'S', label: 'Ordering cost per order', blabel: 'Cost to place one order', def: 50, min: 0.0001, rand: [10, 200, 5], sens: true, cues: ['ordering cost', 'order cost', 'cost per order', 'setup cost'] }),
    ...holdingInputs('year', 7.3), slIn(),
    int('daysPerYear', { label: 'Operating days per year', def: 365, min: 1, max: 366, adv: true, cues: ['working days', 'operating days', 'days per year'] }), zModeInput()],
  outputs: [out('s', 'Reorder point', { sym: 'ROP', blabel: 'Reorder when stock falls to', unit: 'units', primary: true }), out('Q', 'Order quantity', { sym: 'Qopt', unit: 'units', primary: true }), out('ss', 'Safety stock', { sym: 'ss', unit: 'units' }), out('z', 'z-value', { dp: 4 }),
    out('avgInv', 'Average inventory', { unit: 'units' }), out('annualCost', 'Annual ordering + holding cost', { fmt: 'money' }), out('fillRate', 'Resulting fill rate', { fmt: 'pct', dp: 2 }), out('N', 'Orders per year', {})],
  check: slCheck,
  compute: (v) => {
    const ppy = periodsPerYear(v._basis ?? 'day', v.daysPerYear ?? 365); const H = getH(v); const Q = Math.sqrt((2 * v.d * v.S) / H); const z = zFor(v.SL / 100, v.zMode); const sigLT = v.sd * Math.sqrt(v.L); const ss = z * sigLT;
    const avgInv = Q / 2 + ss; const N = (v.d / Q) * ppy; const annualCost = N * v.S + avgInv * H * ppy;
    return { Q, z, sigLT, ss, s: v.d * v.L + ss, avgInv, N, annualCost, annualD: v.d * ppy, annualH: H * ppy, fillRate: sigLT > 0 ? Math.max(0, 1 - (sigLT * lossG(z)) / Q) * 100 : 100 };
  },
  steps: (v, o, c) => [
    { title: 'Order quantity (EOQ)', tex: `${c.s.Q} = ${sq(fr(`2${c.s.D}${c.s.S}`, c.s.H))} = ${sq(fr(`2(${c.f.t(o.annualD)})(${c.f.t(v.S)})`, c.f.t(o.annualH, 4)))} = ${c.f.t(o.Q)}`, why: 'The order size comes from the EOQ, using annual demand and annual holding cost (any matching period gives the same answer).' },
    zStep(c, v.SL, o.z, v.zMode),
    { title: 'Safety stock', tex: `${c.s.ss} = z\\,${c.s.sigd}${sq(c.s.L)} = ${c.f.t(o.z, 4)} \\times ${c.f.t(v.sd, 4)} ${sq(c.f.t(v.L, 4))} = ${c.f.t(o.ss)}`, why: 'Buffer against demand variability during the lead time.' },
    { title: 'Reorder point', tex: `s = ${c.s.d}${c.s.L} + ${c.s.ss} = ${c.f.t(v.d * v.L)} + ${c.f.t(o.ss)} = ${c.f.t(o.s)}`, why: 'Trigger an order when the inventory position hits expected lead-time demand plus the buffer.' },
    { title: 'Average inventory and annual cost', tex: `${fr(c.s.Q, 2)} + ${c.s.ss} = ${c.f.t(o.avgInv)}, \\quad ${c.s.TC} = ${fr(c.s.D, c.s.Q)}${c.s.S} + \\left(${fr(c.s.Q, 2)} + ${c.s.ss}\\right)${c.s.H} = ${c.f.money(o.annualCost, 2)}`, why: 'Cycle stock averages Q/2 and safety stock is held all the time.' },
  ],
  biz: (v, o, f) => ({ headline: `When stock falls to ${f.int(Math.ceil(o.s))} units, order ${f.int(Math.round(o.Q))}.`, meaning: [`That is about ${f.num(o.N, 1)} orders a year, costing ${f.money(o.annualCost)} in ordering and holding.`, `${f.int(Math.ceil(o.ss))} units are safety stock. Average stock on hand: ${f.int(o.avgInv)} units.`, `Customers find the item in stock ${f.pct(o.fillRate, 1)} of the time by units.`], actions: ['Enter both numbers into your inventory system as min (reorder point) and order quantity.', 'Check the policy quarterly, or after any change in supplier or sales trend.', 'Use the Plan Builder to do this for every SKU at once.'] }),
  viz: (v, o) => sawtooth({ Q: o.Q, d: v.d, L: v.L, rop: o.s, ss: Math.max(o.ss, 0), unit: v._basis ?? 'day' }),
  traps: ['Holding cost is usually annual while demand is daily or weekly. Convert before using the EOQ.', 'Average inventory is Q/2 + safety stock, not Q/2.'],
  analogy: 'A two-bin system: when the first bin empties, open the reserve bin and order a refill of a standard size.',
  examples: [
    { title: 'Daily data, annual holding cost', story: 'Daily demand averages 100 (standard deviation 20). Lead time 4 days, ordering cost $50, holding cost $7.30 per unit per year, service level 95%.', v: { d: 100, sd: 20, L: 4, S: 50, H: 7.3, SL: 95 }, expect: { Q: 707.107, ss: 65.794, s: 465.794 } },
    { title: 'Weekly data', story: 'Weekly demand averages 2,500 (standard deviation 500). Lead time 2 weeks, ordering cost $200, holding cost $5.20 per unit per year, service level 90%.', v: { d: 2500, d_u: 'week', sd: 500, sd_u: 'week', L: 2, L_u: 'week', S: 200, H: 5.2, SL: 90 }, expect: { Q: 3162.278, ss: 906.19, s: 5906.19 } },
  ],
  practice: { ask: ['Q', 's'], prompt: (v, f) => `Daily demand averages ${f.int(v.d)} units (standard deviation ${f.int(v.sd)}), lead time is ${f.int(v.L)} days, ordering cost is ${f.money(v.S)}, and holding cost is ${f.money(v.H, 2)} per unit per year (365 days). For a ${f.pct(v.SL)} service level, find the order quantity and reorder point (exact z).` },
  uses: ['eoq', 'safety-stock-demand', 'reorder-point', 'fill-rate'], mono: [['SL', 's', 1], ['S', 'Q', 1]],
  claim: 'The (s, Q) policy achieves its stated cycle service level and fill rate in a simulated inventory system.',
});

export const riskPooling: CalcDef = calc({
  id: 'risk-pooling', name: 'Risk Pooling (Square-Root Law)', short: 'Risk pooling', cat: CAT,
  bq: 'How much stock do I save by consolidating locations?',
  blurb: 'Safety stock needed when inventory is held separately at n locations versus pooled in one place.',
  keywords: ['risk pooling', 'square root law', 'centralization', 'consolidation', 'inventory aggregation', 'pooling', 'centralized vs decentralized'],
  symptoms: ['should i consolidate warehouses', 'too many stocking locations', 'centralize inventory', 'adding a new warehouse'],
  formula: (s) => `${s.ss}_{pooled} = z\\,\\sigma ${sq('n + n(n-1)\\rho')} ${sq(s.L)}`,
  inputs: [int('n', { sym: 'n', label: 'Number of locations', blabel: 'Number of stocking locations', def: 4, min: 1, max: 10000, rand: [2, 25, 1], sens: true, cues: ['locations', 'warehouses', 'stores', 'regions', 'facilities', 'distribution centers'] }),
    num('sd', { sym: '\\sigma', label: 'Std. deviation of demand per location per period', blabel: 'Demand swing at each location (std. deviation)', unit: 'units', def: 50, min: 0, rand: [10, 200, 5], sens: true, cues: ['standard deviation', 'std dev'] }),
    num('L', { sym: 'L', label: 'Lead time (periods)', blabel: 'Lead time (in the same periods)', def: 1, min: 0, rand: [1, 9, 1], cues: ['lead time'] }), slIn(),
    num('rho', { sym: '\\rho', label: 'Correlation between locations', blabel: 'How similar demand is across locations (0 = independent)', def: 0, min: -1, max: 1, step: 0.05, rand: [0, 0.9, 0.1], adv: true, sens: true, cues: ['correlation', 'correlated'], help: '0 means locations are independent (the classic square-root law). 1 means they move together and pooling saves nothing.' }), zModeInput()],
  outputs: [out('saved', 'Safety stock saved by pooling', { unit: 'units', primary: true }), out('savedPct', 'Reduction', { fmt: 'pct' }), out('ssDec', 'Decentralized safety stock (total)', { unit: 'units' }), out('ssCen', 'Centralized safety stock', { unit: 'units' }), out('factor', 'Pooled σ as a multiple of one location', { dp: 3 }), out('z', 'z-value', { dp: 4 })],
  check: (v) => slCheck(v) ?? (v.n + v.n * (v.n - 1) * v.rho < 0 ? 'That correlation is not possible for this many locations (the combined variance would be negative).' : null),
  compute: (v) => { const z = zFor(v.SL / 100, v.zMode); const each = z * v.sd * Math.sqrt(v.L); const factor = Math.sqrt(v.n + v.n * (v.n - 1) * v.rho); const ssDec = v.n * each, ssCen = each * factor; return { z, each, factor, ssDec, ssCen, saved: ssDec - ssCen, savedPct: ssDec !== 0 ? ((ssDec - ssCen) / ssDec) * 100 : 0 }; },
  steps: (v, o, c) => [
    zStep(c, v.SL, o.z, v.zMode),
    { title: 'Safety stock at each separate location', tex: `${c.s.ss}_{each} = z\\,\\sigma${sq(c.s.L)} = ${c.f.t(o.z, 4)} \\times ${c.f.t(v.sd)} ${sq(c.f.t(v.L))} = ${c.f.t(o.each)}`, why: 'Each location buffers its own variability.' },
    { title: 'Total when decentralized', tex: `${c.s.ss}_{dec} = n \\times ${c.s.ss}_{each} = ${c.f.t(v.n)} \\times ${c.f.t(o.each)} = ${c.f.t(o.ssDec)}`, why: 'n independent buffers add up.' },
    { title: 'Pooled standard deviation', tex: `\\sigma_{pooled} = \\sigma${sq('n + n(n-1)\\rho')} = ${c.f.t(v.sd)}${sq(`${c.f.t(v.n)} + ${c.f.t(v.n * (v.n - 1))}(${c.f.t(v.rho)})`)} = ${c.f.t(v.sd * o.factor)}`, why: v.rho === 0 ? 'With independent locations, variances add, so the pooled standard deviation grows with √n rather than n. This is the square-root law.' : 'Variances add, plus a covariance term for each pair of locations. Positive correlation weakens the pooling benefit.', eli: 'A busy day in one store is often offset by a slow day in another, so one shared pile needs less padding than many separate piles.' },
    { title: 'Centralized safety stock and savings', tex: `${c.s.ss}_{cen} = z\\,\\sigma_{pooled}${sq(c.s.L)} = ${c.f.t(o.ssCen)}, \\quad ${tx('saved')} = ${c.f.t(o.ssDec)} - ${c.f.t(o.ssCen)} = ${c.f.t(o.saved)} \; (${c.f.pct(o.savedPct)})`, why: 'Same service level, less stock.' },
  ],
  biz: (v, o, f) => ({ headline: `Pooling ${f.int(v.n)} locations into one cuts safety stock by ${f.pct(o.savedPct, 0)} (${f.int(o.saved)} units).`, meaning: [`Separate locations need ${f.int(o.ssDec)} units of buffer in total. One pooled location needs ${f.int(o.ssCen)}.`, 'The service level stays the same.', v.rho > 0.3 ? 'Your locations move together, so the benefit is smaller than the classic square-root law suggests.' : 'The more independent your locations, the bigger the saving.'], actions: ['Weigh this saving against longer delivery distances and transport cost from a central site.', 'Consider pooling only slow movers, where the benefit is largest.', 'Virtual pooling (shared visibility and transshipments) captures part of the gain without moving stock.'] }),
  viz: (v, o) => ({ kind: 'xy', x: { label: '', cats: ['Separate locations', 'One pooled location'] }, y: { label: 'Safety stock (units)', zero: true }, series: [{ name: 'Safety stock', style: 'bars', tone: 'accent', pts: [[0, o.ssDec], [1, o.ssCen]] }] }),
  traps: ['The square-root law applies to safety stock, not cycle stock.', 'It assumes independent demand. Correlated locations pool less well.', 'σ here is per location. Do not use the total across locations.'],
  analogy: 'Insurance works the same way: many independent risks pooled together are far more predictable than each one alone.',
  examples: [
    { title: 'Four independent warehouses', story: 'Four regional warehouses each see demand with a standard deviation of 50 units per week. Lead time is 1 week and the service level is 95%.', v: { n: 4, sd: 50, L: 1, SL: 95, rho: 0 }, expect: { ssDec: 328.97, ssCen: 164.49, savedPct: 50 } },
    { title: 'Correlated stores', story: 'Nine stores, each with standard deviation 30 per period, lead time 4 periods, correlation 0.5, service level 97.5%.', v: { n: 9, sd: 30, L: 4, SL: 97.5, rho: 0.5 }, expect: { ssDec: 1058.38, ssCen: 788.87, savedPct: 25.46 } },
  ],
  practice: { ask: ['ssCen', 'savedPct'], prompt: (v, f) => `A company has ${f.int(v.n)} warehouses. Demand at each has a standard deviation of ${f.int(v.sd)} units per period, lead time is ${f.int(v.L)} period(s), and correlation between locations is ${f.num(v.rho, 1)}. For a ${f.pct(v.SL)} service level, what safety stock is needed if inventory is centralized, and what percentage is saved (exact z)?` },
  uses: ['safety-stock-demand'], mono: [['n', 'savedPct', 1], ['rho', 'ssCen', 1]],
  claim: 'Pooled safety stock sized by the square-root law achieves the same service level as separate buffers in simulation.',
});

export default [reorderPoint, ssDemand, ssLeadTime, ssCombined, cycleServiceLevel, fillRate, newsvendor, periodicReview, continuousReview, riskPooling];
