// Inventory: order quantity models.
import { calc, sel, num, money, pct, int, table, col, out, rate, holdingInputs, getH, fr, sq, tx, sawtooth, costCurves, pts } from '../dsl';
import { randStep, pick } from '../math/util';
import type { CalcDef, Vals } from '../types';

const CAT = 'inv-order';
const dpyInput = (def = 365) => int('daysPerYear', { label: 'Operating days per year', blabel: 'Days you operate per year', def, min: 1, max: 366, adv: true, cues: ['working days', 'operating days', 'days per year', 'day year', 'days a year'], help: 'Textbook problems often state 250 or 300 working days. Use 365 if the problem does not say.' });
const D = (o: Partial<Parameters<typeof num>[1]> = {}) => num('D', { sym: 'D', label: 'Annual demand', blabel: 'Units sold or used per year', unit: 'units', def: 1000, time: rate('year'), min: 0.0001, rand: [500, 20000, 100], sens: true, cues: ['annual demand', 'demand', 'sells', 'uses', 'requires', 'usage'], help: 'Total units needed over the planning period (usually one year).', ...o });
const S = () => money('S', { sym: 'S', label: 'Ordering (setup) cost per order', blabel: 'Cost to place one order', def: 10, min: 0.0001, rand: [5, 250, 5], sens: true, cues: ['ordering cost', 'order cost', 'setup cost', 'cost per order', 'cost to place', 'to place an order', 'per setup'], help: 'Fixed cost each time you order or set up: paperwork, freight minimums, receiving, machine setup.' });
const hStep = (v: Vals, c: any) => v.hMode === 'percent' ? [{ title: 'Convert the holding rate to dollars', tex: `${c.s.H} = ${c.s.I} \\times ${c.s.C} = ${c.f.t(v.I / 100, 4)} \\times ${c.f.t(v.C)} = ${c.f.t(getH(v), 4)}`, why: 'Holding cost was given as a percentage of unit cost, so multiply the rate by the unit cost to get dollars per unit per year.', eli: `Keeping an item on the shelf costs about ${c.f.pct(v.I)} of what you paid for it each year. On a ${c.f.money(v.C)} item that is ${c.f.money(getH(v), 2)} a year.` }] : [];

export const eoq: CalcDef = calc({
  id: 'eoq', name: 'Economic Order Quantity (EOQ)', short: 'EOQ', cat: CAT,
  bq: 'How much should I order each time?',
  blurb: 'The order size that minimizes the combined cost of placing orders and holding stock when demand is steady.',
  keywords: ['eoq', 'economic order quantity', 'optimal order quantity', 'order size', 'lot size', 'wilson formula', 'Q*', 'how much to order'],
  symptoms: ['how much should i order', 'ordering too often', 'too much inventory', 'what order size', 'best order quantity'],
  formula: (s) => `${s.Qopt} = ${sq(fr(`2${s.D}${s.S}`, s.H))}`,
  basis: 'year',
  inputs: [D(), S(), ...holdingInputs('year', 0.5), dpyInput()],
  outputs: [
    out('Q', 'Economic order quantity', { sym: 'Qopt', blabel: 'Best order size', unit: 'units', primary: true }),
    out('N', 'Orders per year', { sym: 'N', unit: 'orders' }),
    out('Tdays', 'Time between orders', { sym: 'T', unit: 'days' }),
    out('TC', 'Total annual ordering + holding cost', { sym: 'TC', blabel: 'Yearly ordering + holding cost', fmt: 'money' }),
    out('orderCost', 'Annual ordering cost', { fmt: 'money' }),
    out('holdCost', 'Annual holding cost', { fmt: 'money' }),
    out('avgInv', 'Average inventory', { unit: 'units' }),
  ],
  compute: (v) => {
    const H = getH(v); const Q = Math.sqrt((2 * v.D * v.S) / H); const N = v.D / Q;
    return { H, Q, N, T: Q / v.D, Tdays: (Q / v.D) * (v.daysPerYear ?? 365), orderCost: N * v.S, holdCost: (Q / 2) * H, TC: N * v.S + (Q / 2) * H, avgInv: Q / 2 };
  },
  steps: (v, o, c) => [
    ...hStep(v, c),
    { title: 'Apply the EOQ formula', tex: `${c.s.Qopt} = ${sq(fr(`2${c.s.D}${c.s.S}`, c.s.H))} = ${sq(fr(`2(${c.f.t(v.D)})(${c.f.t(v.S)})`, c.f.t(o.H, 4)))} = ${c.f.t(o.Q)} ${tx(' units')}`,
      why: 'EOQ balances two costs that pull in opposite directions. Bigger orders mean fewer orders (lower ordering cost) but more stock sitting around (higher holding cost). The total is lowest where annual ordering cost equals annual holding cost.',
      eli: 'Think of buying groceries. Shop every day and you waste time on trips. Shop once a year and food spoils in a giant pantry. EOQ finds the trip size where the cost of trips and the cost of storage are equal.' },
    { title: 'Orders per year', tex: `${c.s.N} = ${fr(c.s.D, c.s.Qopt)} = ${fr(c.f.t(v.D), c.f.t(o.Q))} = ${c.f.t(o.N)}`, why: 'Annual demand divided by the order size gives how many orders you place in a year.', eli: 'If you need 1,000 a year and buy 200 at a time, you buy 5 times.' },
    { title: 'Time between orders', tex: `${c.s.T} = ${fr(tx('days per year'), c.s.N)} = ${fr(c.f.t(v.daysPerYear), c.f.t(o.N))} = ${c.f.t(o.Tdays)} ${tx(' days')}`, why: 'Spread the orders evenly over the operating days in the year.', eli: 'Divide the year into equal slices, one slice per order.' },
    { title: 'Total annual cost', tex: `${c.s.TC} = ${fr(c.s.D, c.s.Q)}${c.s.S} + ${fr(c.s.Q, 2)}${c.s.H} = ${c.f.t(o.orderCost)} + ${c.f.t(o.holdCost)} = ${c.f.money(o.TC, 2)}`, why: 'Ordering cost is orders per year times cost per order. Holding cost is average inventory (Q/2) times holding cost per unit. At the EOQ the two parts are equal, which is a quick way to check your work.', eli: 'Add up what the trips cost and what the storage costs. At the best order size these two bills match.' },
  ],
  biz: (v, o, f) => ({
    headline: `Order ${f.int(o.Q)} units at a time, about every ${f.int(o.Tdays)} days.`,
    meaning: [`That is roughly ${f.num(o.N, 1)} orders a year.`, `Ordering and holding will cost about ${f.money(o.TC)} a year, split evenly: ${f.money(o.orderCost)} to place orders and ${f.money(o.holdCost)} to hold stock.`, `You will carry ${f.int(o.avgInv)} units on average.`],
    actions: [`Set your standard purchase order to ${f.int(o.Q)} units (round to the nearest case or pallet; cost barely changes within 10 to 20% of this number).`, 'Add a reorder point so each order is triggered at the right time.', 'If your supplier offers price breaks, compare them with the Quantity Discount calculator before committing.'],
  }),
  viz: (v, o) => costCurves(v.D, v.S, o.H, o.Q),
  traps: ['Mixing time units: annual demand with a monthly or weekly holding cost. Convert everything to the same period first.', 'Using the unit price as the holding cost. If holding is given as a percent, H = rate × unit cost.', 'Forgetting that total cost here excludes the purchase cost D × P. Add it only if the question asks for total cost including purchases.', 'Rounding Q too early. Keep decimals until the final answer.'],
  analogy: 'EOQ is like deciding how often to do laundry. Tiny loads waste trips, giant loads need a huge hamper. The best load size makes trip cost and hamper cost equal.',
  convention: 'Total cost shown is ordering plus holding. Purchase cost (D × unit price) does not change the EOQ and is left out unless price breaks apply.',
  examples: [
    { title: 'Hypodermic needles', story: 'A medical supplier sells 1,000 needles a year. Each order costs $10 to place and holding a needle for a year costs $0.50. The firm operates 250 days a year.', v: { D: 1000, S: 10, H: 0.5, daysPerYear: 250 }, expect: { Q: 200, N: 5, Tdays: 50, TC: 100 } },
    { title: 'Holding cost as a percentage', story: 'A distributor moves 12,000 units a year of a $25 part. Orders cost $50 each and holding runs 20% of unit cost per year.', v: { D: 12000, S: 50, hMode: 'percent', I: 20, C: 25 }, expect: { Q: 489.898, TC: 2449.49 } },
  ],
  practice: { ask: ['Q'], prompt: (v, f) => `A retailer sells ${f.int(v.D)} units of an item per year. Placing an order costs ${f.money(v.S)} and holding one unit for a year costs ${f.money(v.H, 2)}. What is the economic order quantity?` },
  uses: ['holding-cost'],
  mono: [['D', 'Q', 1], ['S', 'Q', 1], ['H', 'Q', -1], ['D', 'TC', 1]],
  claim: 'EOQ gives the lowest total annual cost of any order quantity.',
  faq: [{ q: 'What if my demand is not constant?', a: 'EOQ still gives a good order size when demand varies moderately. Add safety stock and a reorder point to cover the variability.' }, { q: 'How sensitive is EOQ to bad inputs?', a: 'Not very. Ordering 20% more or less than the EOQ raises total cost by only about 2%, because the cost curve is flat near the minimum.' }],
});

export const totalCost: CalcDef = calc({
  id: 'total-inventory-cost', name: 'Total Annual Inventory Cost', short: 'Total cost', cat: CAT,
  bq: 'What does my current order size cost me per year?',
  blurb: 'Annual ordering plus holding cost (and optional purchase cost) for any order quantity, compared against the EOQ.',
  keywords: ['total cost', 'annual inventory cost', 'TC', 'ordering cost', 'holding cost', 'setup cost', 'total annual cost'],
  symptoms: ['what is my inventory costing', 'cost of current order size', 'compare order quantities', 'am i ordering the right amount'],
  formula: (s) => `${s.TC} = ${fr(s.D, s.Q)}${s.S} + ${fr(s.Q, 2)}${s.H}`,
  basis: 'year',
  inputs: [D(), S(), ...holdingInputs('year', 0.5), num('Q', { sym: 'Q', label: 'Order quantity', blabel: 'Units you order each time', unit: 'units', def: 100, min: 0.0001, rand: [50, 3000, 10], sens: true, cues: ['order quantity', 'orders of', 'lot size', 'per order', 'batches of', 'at a time'] }),
    money('P', { sym: 'C', label: 'Unit price (optional)', blabel: 'Price per unit (optional)', def: 0, rand: [0, 50, 1], adv: true, help: 'Leave at 0 to exclude purchase cost. Purchase cost does not depend on Q unless there are price breaks.' })],
  outputs: [
    out('TC', 'Total annual cost (ordering + holding)', { sym: 'TC', blabel: 'Yearly ordering + holding cost', fmt: 'money', primary: true }),
    out('orderCost', 'Annual ordering cost', { fmt: 'money' }), out('holdCost', 'Annual holding cost', { fmt: 'money' }),
    out('TCP', 'Total including purchase cost', { fmt: 'money', show: (v) => v.P > 0 }),
    out('Qstar', 'EOQ for comparison', { sym: 'Qopt', unit: 'units' }), out('TCstar', 'Cost at the EOQ', { fmt: 'money' }),
    out('penalty', 'Extra cost vs EOQ', { blabel: 'Money left on the table each year', fmt: 'money' }), out('penaltyPct', 'Extra cost vs EOQ', { fmt: 'pct' }),
  ],
  compute: (v) => {
    const H = getH(v); const orderCost = (v.D / v.Q) * v.S, holdCost = (v.Q / 2) * H; const TC = orderCost + holdCost;
    const Qstar = Math.sqrt((2 * v.D * v.S) / H); const TCstar = Math.sqrt(2 * v.D * v.S * H);
    return { H, orderCost, holdCost, TC, TCP: TC + v.D * (v.P ?? 0), Qstar, TCstar, penalty: TC - TCstar, penaltyPct: ((TC - TCstar) / TCstar) * 100 };
  },
  steps: (v, o, c) => [
    ...hStep(v, c),
    { title: 'Annual ordering cost', tex: `${fr(c.s.D, c.s.Q)}${c.s.S} = ${fr(c.f.t(v.D), c.f.t(v.Q))}(${c.f.t(v.S)}) = ${c.f.money(o.orderCost, 2)}`, why: 'Orders per year (D/Q) times the cost of each order.', eli: 'Count how many times you order in a year and multiply by what each order costs.' },
    { title: 'Annual holding cost', tex: `${fr(c.s.Q, 2)}${c.s.H} = ${fr(c.f.t(v.Q), 2)}(${c.f.t(o.H, 4)}) = ${c.f.money(o.holdCost, 2)}`, why: 'Inventory falls steadily from Q to 0, so on average you hold Q/2 units. Multiply by the cost to hold one unit for a year.', eli: 'Your shelf goes from full to empty over and over, so on average it is half full. You pay storage on that half.' },
    { title: 'Total cost', tex: `${c.s.TC} = ${c.f.t(o.orderCost)} + ${c.f.t(o.holdCost)} = ${c.f.money(o.TC, 2)}`, why: 'Add the two parts.' },
    { title: 'Compare with the EOQ', tex: `${c.s.Qopt} = ${sq(fr(`2${c.s.D}${c.s.S}`, c.s.H))} = ${c.f.t(o.Qstar)}, \\quad ${c.s.TC}^* = ${sq(`2${c.s.D}${c.s.S}${c.s.H}`)} = ${c.f.money(o.TCstar, 2)}`, why: `The lowest possible cost is at the EOQ. Your order size costs ${c.f.money(o.penalty, 2)} (${c.f.pct(o.penaltyPct)}) more than that.`, eli: 'This shows how far your current habit is from the cheapest possible habit.' },
    ...(v.P > 0 ? [{ title: 'Add purchase cost', tex: `${c.s.TC} + ${c.s.D}${c.s.C} = ${c.f.t(o.TC)} + ${c.f.t(v.D)}(${c.f.t(v.P)}) = ${c.f.money(o.TCP, 2)}`, why: 'Purchase cost is demand times unit price. It is the same for every order size unless there are quantity discounts.' }] : []),
  ],
  biz: (v, o, f) => ({
    headline: o.penaltyPct < 2 ? `Ordering ${f.int(v.Q)} at a time costs ${f.money(o.TC)} a year, which is about as low as it gets.` : `Ordering ${f.int(v.Q)} at a time costs ${f.money(o.TC)} a year, ${f.money(o.penalty)} more than necessary.`,
    meaning: [`${f.money(o.orderCost)} goes to placing orders and ${f.money(o.holdCost)} to holding stock.`, `The cheapest order size is ${f.int(o.Qstar)} units, costing ${f.money(o.TCstar)} a year.`, v.Q > o.Qstar ? 'You are ordering too much at once, so holding cost dominates.' : v.Q < o.Qstar ? 'You are ordering too little at once, so ordering cost dominates.' : 'You are right at the optimum.'],
    actions: [o.penaltyPct < 2 ? 'Keep your current order size.' : `Move your order size toward ${f.int(o.Qstar)} units.`, 'Recheck this whenever demand or freight costs shift by more than 20%.', 'If storage space is the real constraint, use the smaller of the EOQ and what fits.'],
  }),
  viz: (v, o) => costCurves(v.D, v.S, o.H, o.Qstar, { Q: v.Q, label: 'Your Q' }),
  traps: ['Using Q instead of Q/2 for average inventory.', 'Including purchase cost when the question only asks for ordering and holding cost (or the reverse).', 'If ordering and holding costs are equal, you are at the EOQ. If they are not, you are not.'],
  analogy: 'It is a two-part bill: delivery fees (more when you order often) and rent for shelf space (more when you order a lot). This adds the two.',
  examples: [
    { title: 'Ordering at the EOQ', story: 'Demand is 1,000 units a year, ordering cost $10, holding cost $0.50 per unit per year, order size 200.', v: { D: 1000, S: 10, H: 0.5, Q: 200 }, expect: { TC: 100, orderCost: 50, holdCost: 50, penalty: 0 } },
    { title: 'Ordering half the EOQ', story: 'Same item, but the buyer orders only 100 at a time.', v: { D: 1000, S: 10, H: 0.5, Q: 100 }, expect: { TC: 125, orderCost: 100, holdCost: 25, penalty: 25, penaltyPct: 25 } },
  ],
  practice: { ask: ['TC'], prompt: (v, f) => `Annual demand is ${f.int(v.D)} units, ordering cost is ${f.money(v.S)} per order, and holding cost is ${f.money(v.H, 2)} per unit per year. If the firm orders ${f.int(v.Q)} units at a time, what is the total annual ordering plus holding cost?` },
  uses: ['eoq', 'holding-cost'],
  mono: [['D', 'orderCost', 1], ['Q', 'holdCost', 1], ['Q', 'orderCost', -1]],
});

export const epq: CalcDef = calc({
  id: 'epq', name: 'Production Order Quantity (EPQ / POQ)', short: 'EPQ', cat: CAT,
  bq: 'How big should each production run be?',
  blurb: 'The batch size that minimizes setup plus holding cost when units are produced (and used) gradually instead of arriving all at once.',
  keywords: ['epq', 'poq', 'production order quantity', 'economic production quantity', 'production run', 'batch size', 'run size', 'economic production lot'],
  symptoms: ['how big should a production run be', 'batch size', 'how many to make per run', 'setup takes too long'],
  formula: (s) => `Q_p^* = ${sq(fr(`2${s.D}${s.S}`, `${s.H}(1 - d/p)`))}`,
  basis: 'year',
  inputs: [D(), money('S', { sym: 'S', label: 'Setup cost per run', blabel: 'Cost to set up one production run', def: 10, min: 0.0001, rand: [10, 500, 10], sens: true, cues: ['setup cost', 'set-up cost', 'cost per setup', 'cost per run'] }), ...holdingInputs('year', 0.5),
    num('P', { sym: 'p', label: 'Production rate', blabel: 'How fast you can produce', unit: 'units', def: 2000, time: rate('year'), min: 0.0001, rand: [25000, 90000, 1000], sens: true, cues: ['production rate', 'can produce', 'produces', 'capacity of', 'manufactured at'], help: 'Output rate while the line is running. Must be greater than the demand rate, otherwise you can never build inventory.' }),
    dpyInput()],
  outputs: [
    out('Q', 'Production order quantity', { sym: 'Q_p^*', blabel: 'Best run size', unit: 'units', primary: true }),
    out('Imax', 'Maximum inventory', { sym: 'I_{max}', unit: 'units' }), out('runDays', 'Length of each production run', { unit: 'days' }),
    out('N', 'Runs per year', { sym: 'N', unit: 'runs' }), out('Tdays', 'Time between run starts', { unit: 'days' }),
    out('TC', 'Total annual setup + holding cost', { fmt: 'money' }), out('setupCost', 'Annual setup cost', { fmt: 'money' }), out('holdCost', 'Annual holding cost', { fmt: 'money' }),
  ],
  check: (v) => (v.P <= v.D ? 'The production rate must be greater than the demand rate. If you cannot make units faster than you use them, inventory never builds up and the model does not apply.' : null),
  compute: (v) => {
    const H = getH(v); const k = 1 - v.D / v.P; const Q = Math.sqrt((2 * v.D * v.S) / (H * k)); const dpy = v.daysPerYear ?? 365;
    return { H, k, Q, Imax: Q * k, runDays: (Q / v.P) * dpy, N: v.D / Q, Tdays: (Q / v.D) * dpy, setupCost: (v.D / Q) * v.S, holdCost: ((Q * k) / 2) * H, TC: (v.D / Q) * v.S + ((Q * k) / 2) * H };
  },
  steps: (v, o, c) => [
    ...hStep(v, c),
    { title: 'Share of production that builds inventory', tex: `1 - ${fr('d', 'p')} = 1 - ${fr(c.f.t(v.D), c.f.t(v.P))} = ${c.f.t(o.k, 4)}`, why: 'While the line runs, part of the output is consumed right away. Only the fraction (1 − d/p) piles up as inventory. Demand and production must be in the same time unit.', eli: 'Imagine filling a bathtub with the drain open. Only the difference between the tap and the drain raises the water level.' },
    { title: 'Apply the production order quantity formula', tex: `Q_p^* = ${sq(fr(`2${c.s.D}${c.s.S}`, `${c.s.H}(1 - d/p)`))} = ${sq(fr(`2(${c.f.t(v.D)})(${c.f.t(v.S)})`, `${c.f.t(o.H, 4)}(${c.f.t(o.k, 4)})`))} = ${c.f.t(o.Q)} ${tx(' units')}`, why: 'Same trade-off as EOQ, but inventory peaks lower because units are used during the run, so holding is cheaper and the best batch is larger than the EOQ.', eli: 'Because some of the batch is used while it is being made, less piles up, so you can afford bigger batches.' },
    { title: 'Maximum inventory', tex: `I_{max} = Q_p^*\\left(1 - ${fr('d', 'p')}\\right) = ${c.f.t(o.Q)}(${c.f.t(o.k, 4)}) = ${c.f.t(o.Imax)} ${tx(' units')}`, why: 'Inventory never reaches the full batch size, because demand drains it during production.' },
    { title: 'Total annual cost', tex: `${c.s.TC} = ${fr(c.s.D, 'Q')}${c.s.S} + ${fr('I_{max}', 2)}${c.s.H} = ${c.f.t(o.setupCost)} + ${c.f.t(o.holdCost)} = ${c.f.money(o.TC, 2)}`, why: 'Setup cost per year plus holding cost on the average inventory, which is half the maximum.' },
  ],
  biz: (v, o, f) => ({
    headline: `Make ${f.int(o.Q)} units per production run.`,
    meaning: [`Each run lasts about ${f.num(o.runDays, 1)} days and you start a new one every ${f.num(o.Tdays, 1)} days (${f.num(o.N, 1)} runs a year).`, `Inventory peaks at ${f.int(o.Imax)} units, not ${f.int(o.Q)}, because you sell while you produce.`, `Setup plus holding cost comes to ${f.money(o.TC)} a year.`],
    actions: [`Schedule runs of ${f.int(o.Q)} units.`, 'If setups are painful, invest in faster changeovers: cutting setup cost by half cuts the best batch size by about 30%.', 'Check that storage can take the peak inventory.'],
  }),
  viz: (v, o) => sawtooth({ Q: o.Q, d: v.D / (v.daysPerYear ?? 365), unit: 'day', ramp: { p: v.P / (v.daysPerYear ?? 365) } }),
  traps: ['Demand rate d and production rate p must use the same time unit (both per day or both per year).', 'Maximum inventory is Q(1 − d/p), not Q.', 'If p is not greater than d the model breaks: the denominator hits zero or goes negative.'],
  analogy: 'Filling a bathtub with the drain open: the water rises at the tap rate minus the drain rate, so the tub never holds everything the tap delivered.',
  examples: [
    { title: 'Hubcap production', story: 'Annual demand is 1,000 units, setup cost $10, holding cost $0.50 per unit per year. The plant makes 8 units a day and uses 4 a day over a 250-day year.', v: { D: 1000, S: 10, H: 0.5, P: 8, P_u: 'day', daysPerYear: 250 }, expect: { Q: 282.843, Imax: 141.421, TC: 70.711 } },
    { title: 'Annual rates', story: 'A bottler sells 20,000 cases a year and can fill 50,000 a year. Setup costs $200 and holding costs $4 per case per year.', v: { D: 20000, S: 200, H: 4, P: 50000 }, expect: { Q: 1825.742, Imax: 1095.445, TC: 4381.78 } },
  ],
  practice: { ask: ['Q'], prompt: (v, f) => `A plant has annual demand of ${f.int(v.D)} units and can produce ${f.int(v.P)} units per year. Setup cost is ${f.money(v.S)} per run and holding cost is ${f.money(v.H, 2)} per unit per year. What is the optimal production run size?` },
  uses: ['eoq'],
  mono: [['S', 'Q', 1], ['H', 'Q', -1]],
  claim: 'The production order quantity gives the lowest total setup plus holding cost of any batch size.',
});

const defaultBreaks = [{ min: 0, price: 5 }, { min: 1000, price: 4.8 }, { min: 2000, price: 4.75 }];
export const quantityDiscount: CalcDef = calc({
  id: 'quantity-discount', name: 'Quantity Discount Model (All-Units)', short: 'Quantity discount', cat: CAT,
  bq: 'Should I order more to get the volume discount?',
  blurb: 'Finds the order quantity with the lowest total annual cost (purchase + ordering + holding) when the supplier offers all-units price breaks.',
  keywords: ['quantity discount', 'price break', 'all-units discount', 'volume discount', 'bulk discount', 'discount schedule'],
  symptoms: ['supplier offers a discount', 'should i buy in bulk', 'is the bulk discount worth it', 'price breaks'],
  formula: (s) => `${s.TC} = ${s.D}${s.C} + ${fr(s.D, s.Q)}${s.S} + ${fr(s.Q, 2)}${s.I}${s.C}`,
  basis: 'year',
  inputs: [D({ def: 5000 }), money('S', { sym: 'S', label: 'Ordering cost per order', blabel: 'Cost to place one order', def: 49, min: 0.0001, rand: [10, 200, 1], cues: ['ordering cost', 'order cost', 'cost per order'] }),
    sel('hMode', 'Holding cost given as', [['percent', '% of unit price (changes with each price)'], ['amount', '$ per unit per year (same at every price)']], 'percent', { blabel: 'How do you know your holding cost?', help: 'Most discount problems give holding cost as a percentage of price, so it falls as the price falls. Some give a fixed dollar amount per unit.' }),
    pct('I', { sym: 'I', label: 'Holding rate (% of unit price per year)', blabel: 'Holding cost as % of item price', def: 20, min: 0.0001, max: 1000, time: rate('year'), rand: [10, 35, 1], show: (v) => v.hMode !== 'amount', cues: ['holding cost', 'carrying cost', 'carrying charge', 'percent of'] }),
    money('H', { sym: 'H', label: 'Holding cost per unit per year', blabel: 'Cost to hold one unit for a year', def: 1, min: 0.0001, time: rate('year'), rand: [0.5, 20, 0.5], show: (v) => v.hMode === 'amount', cues: ['holding cost per unit', 'carrying cost per unit'] }),
    table('breaks', 'Price schedule', [col('min', 'Minimum order quantity'), col('price', 'Unit price ($)')], defaultBreaks, { minRows: 1, help: 'One row per price tier: the smallest quantity that earns the price, and the price. The first tier normally starts at 0.' })],
  outputs: [
    out('Q', 'Best order quantity', { sym: 'Qopt', unit: 'units', primary: true }), out('price', 'Unit price paid', { fmt: 'money', dp: 2 }),
    out('TC', 'Total annual cost (incl. purchases)', { sym: 'TC', fmt: 'money' }), out('savings', 'Savings vs the best order at the base price', { fmt: 'money' }),
  ],
  check: (v) => { const b = v.breaks as any[]; if (!Array.isArray(b) || !b.length) return 'Add at least one price tier.'; if (b.some((r) => !(r.price > 0))) return 'Every tier needs a price greater than zero.'; return null; },
  compute: (v) => {
    const tiers = [...(v.breaks as { min: number; price: number }[])].map((t) => ({ min: Math.max(0, Number(t.min) || 0), price: Number(t.price) })).sort((a, b) => a.min - b.min);
    const rows = tiers.map((t, i) => {
      const hi = i + 1 < tiers.length ? tiers[i + 1].min : Infinity;
      const h = v.hMode === 'amount' ? v.H : (v.I / 100) * t.price; const qs = Math.sqrt((2 * v.D * v.S) / h);
      let q = qs, status = 'feasible';
      if (qs < t.min) { q = t.min; status = 'adjusted up'; } else if (qs >= hi) { status = 'infeasible'; }
      q = Math.max(q, 1e-9);
      const tc = status === 'infeasible' ? Infinity : v.D * t.price + (v.D / q) * v.S + (q / 2) * h;
      return { min: t.min, price: t.price, h, qs, q, status, tc };
    });
    let best = 0; rows.forEach((r, i) => { if (r.tc < rows[best].tc) best = i; });
    // Savings are measured against the best you could do without any discount: the first tier's price, ordering its EOQ or, if that EOQ would already earn the next price, the largest whole quantity that still pays the base price.
    const r0 = rows[0]; const hi0 = rows.length > 1 ? rows[1].min : Infinity; const q0 = Math.max(r0.qs < hi0 ? Math.max(r0.qs, r0.min) : Math.max(r0.min, hi0 - 1), 1e-9);
    const baseTC = v.D * r0.price + (v.D / q0) * v.S + (q0 / 2) * r0.h;
    return { Q: rows[best].q, price: rows[best].price, TC: rows[best].tc, tier: best, savings: Math.max(0, baseTC - rows[best].tc), baseQ: q0, baseTC, tierQ: rows.map((r) => r.q), tierTC: rows.map((r) => (Number.isFinite(r.tc) ? r.tc : -1)), tierQs: rows.map((r) => r.qs), tierStatus: rows.map((r) => r.status) };
  },
  steps: (v, o, c) => {
    const tiers = [...(v.breaks as any[])].sort((a, b) => a.min - b.min);
    return [
      { title: 'Compute an EOQ at each price', tex: `Q^* = ${sq(fr(`2${c.s.D}${c.s.S}`, `${c.s.I}${c.s.C}`))}`, why: v.hMode === 'amount' ? 'Holding cost is a fixed amount per unit here, so the EOQ is the same at every price. What changes is which tier that quantity qualifies for.' : 'Holding cost depends on the price paid (H = I × price), so each price tier has its own EOQ. Cheaper tiers have slightly larger EOQs.',
        table: { columns: ['Tier', 'Min qty', 'Price', 'EOQ at this price', 'Status', 'Order qty used'], rows: tiers.map((t, i) => [i + 1, c.f.int(t.min), c.f.money(t.price, 2), c.f.num(o.tierQs[i], 1), o.tierStatus[i], o.tierStatus[i] === 'infeasible' ? 'n/a' : c.f.num(o.tierQ[i], 1)]), highlight: [o.tier] },
        eli: 'For each price the supplier offers, work out the ideal order size as if that were the only price.' },
      { title: 'Adjust each EOQ to qualify for its price', why: 'If the EOQ is below the minimum for the tier, raise it to the minimum (the cheapest quantity that earns the discount). If the EOQ is above the tier range, that tier is not the best place to be, since a lower price already applies.', eli: 'If the ideal size is too small to get that price, bump it up to the smallest order that earns it.' },
      { title: 'Total annual cost for each candidate', tex: `${c.s.TC} = ${c.s.D}${c.s.C} + ${fr(c.s.D, c.s.Q)}${c.s.S} + ${fr(c.s.Q, 2)}${c.s.I}${c.s.C}`, why: 'With price breaks the purchase cost changes with Q, so it must be included in the comparison.',
        table: { columns: ['Tier', 'Order qty', 'Purchase', 'Ordering', 'Holding', 'Total'], rows: tiers.map((t, i) => o.tierStatus[i] === 'infeasible' ? [i + 1, 'n/a', '', '', '', 'not feasible'] : [i + 1, c.f.num(o.tierQ[i], 1), c.f.money(v.D * t.price), c.f.money((v.D / o.tierQ[i]) * v.S, 2), c.f.money((o.tierQ[i] / 2) * (v.hMode === 'amount' ? v.H : (v.I / 100) * t.price), 2), c.f.money(o.tierTC[i], 2)]), highlight: [o.tier] } },
      { title: 'Pick the lowest total cost', tex: `${c.s.Qopt} = ${c.f.t(o.Q)} ${tx(' units at ')} ${c.f.money(o.price, 2)}, \\quad ${c.s.TC} = ${c.f.money(o.TC, 2)}`, why: 'The best quantity is whichever candidate has the smallest total annual cost.', eli: 'Compare the yearly bills and take the cheapest.' },
    ];
  },
  biz: (v, o, f) => ({
    headline: `Order ${f.int(o.Q)} units at a time at ${f.money(o.price, 2)} each.`,
    meaning: [`Total yearly cost including purchases is ${f.money(o.TC)}.`, o.savings > 0.005 ? `That saves ${f.money(o.savings)} a year compared with the best you could do at the base price (ordering ${f.int(o.baseQ)} at a time).` : 'The discount tiers are not worth the extra stock: the base price tier is already cheapest.', `You will place about ${f.num(v.D / o.Q, 1)} orders a year.`],
    actions: [o.tier > 0 ? 'Take the discount, and confirm you have the space and cash for the larger order.' : 'Skip the larger order unless the supplier improves the discount.', 'Ask the supplier whether the next tier threshold is negotiable.', 'Recheck if demand drops: discounts stop paying off quickly when volume falls.'],
  }),
  viz: (v, o) => {
    const tiers = [...(v.breaks as any[])].sort((a, b) => a.min - b.min);
    const hi = Math.max(o.Q * 1.6, tiers[tiers.length - 1].min * 1.4, 10);
    const series = tiers.map((t, i) => {
      const a = Math.max(t.min, hi * 0.04), b = i + 1 < tiers.length ? tiers[i + 1].min : hi;
      return { name: `${t.price.toFixed(2)} per unit`, style: 'line' as const, tone: (['alt', 'alt2', 'accent', 'good', 'warn'] as const)[i % 5], pts: b > a ? pts((q) => v.D * t.price + (v.D / q) * v.S + (q / 2) * (v.I / 100) * t.price, a, b - 1e-6, 40) : [] };
    });
    return { kind: 'xy', x: { label: 'Order quantity (units)' }, y: { label: 'Total annual cost ($)' }, series, marks: [{ x: o.Q, y: o.TC, label: 'Lowest total cost', tone: 'accent' }], vlines: tiers.slice(1).map((t) => ({ x: t.min, label: `Break at ${t.min}`, tone: 'muted' as const })) };
  },
  traps: ['Leaving out purchase cost. With price breaks, D × price must be in the total.', 'Using an EOQ that does not qualify for its price. Adjust it up to the tier minimum.', 'Assuming the lowest price always wins. Extra holding cost can outweigh the discount.'],
  analogy: 'A warehouse club deal: the 48-pack is cheaper per roll, but only worth it if the savings beat the cost of storing rolls for months.',
  convention: 'All-units discount: the lower price applies to every unit in the order once the threshold is reached. Holding cost is a percentage of the price paid.',
  examples: [
    { title: 'Toy race cars', story: 'A discount store sells 5,000 toy cars a year. Ordering costs $49 and holding is 20% of price. Price is $5.00 for under 1,000, $4.80 for 1,000 to 1,999, and $4.75 for 2,000 or more.', v: { D: 5000, S: 49, I: 20, breaks: defaultBreaks }, expect: { Q: 1000, TC: 24725, price: 4.8 } },
    { title: 'Discount beats the EOQ', story: 'Demand is 2,400 a year, ordering cost $100, holding 25% of price. Prices: $20.00 base, $19.50 at 300, $19.00 at 600.', v: { D: 2400, S: 100, I: 25, breaks: [{ min: 0, price: 20 }, { min: 300, price: 19.5 }, { min: 600, price: 19 }] }, expect: { Q: 600, TC: 47425, price: 19 } },
  ],
  practice: { ask: ['Q'], gen: (r) => { const p = randStep(r, 4, 60, 1); const b1 = pick(r, [200, 500, 1000]); return { D: randStep(r, 2000, 12000, 500), S: randStep(r, 20, 120, 5), I: randStep(r, 15, 30, 5), breaks: [{ min: 0, price: p }, { min: b1, price: +(p * 0.97).toFixed(2) }, { min: b1 * 2, price: +(p * 0.95).toFixed(2) }] }; },
    prompt: (v, f) => `Annual demand is ${f.int(v.D)} units, ordering cost is ${f.money(v.S)}, and holding cost is ${f.pct(v.I)} of unit price per year. The supplier charges ${v.breaks.map((b: any, i: number) => `${f.money(b.price, 2)} for orders of ${f.int(b.min)}${i + 1 < v.breaks.length ? ' to ' + f.int(v.breaks[i + 1].min - 1) : ' or more'}`).join(', ')}. What order quantity minimizes total annual cost?` },
  gen: (r) => { const p = randStep(r, 2, 80, 0.5); const b1 = pick(r, [100, 250, 500, 1000, 2000]); const n = pick(r, [1, 2, 3]); const breaks = [{ min: 0, price: p }]; for (let i = 1; i <= n; i++) breaks.push({ min: b1 * i, price: +(p * (1 - 0.02 * i - r() * 0.02)).toFixed(3) }); return { D: randStep(r, 500, 20000, 100), S: randStep(r, 5, 300, 1), I: randStep(r, 5, 40, 1), breaks }; },
  uses: ['eoq', 'total-inventory-cost'],
  claim: 'The chosen quantity has the lowest total annual cost of any quantity on the price schedule.',
});

export const backorderEoq: CalcDef = calc({
  id: 'backorder-eoq', name: 'EOQ with Planned Backorders', short: 'Backorder EOQ', cat: CAT,
  bq: 'How much should I order if customers will wait for stock?',
  blurb: 'EOQ extended to allow planned shortages that are backordered at a cost, giving the best order size and the best maximum backorder level.',
  keywords: ['backorder', 'planned shortage', 'shortage model', 'eoq with backorders', 'backordering', 'stockout cost'],
  symptoms: ['customers will wait', 'allow backorders', 'planned stockouts', 'cost of being out of stock'],
  formula: (s) => `${s.Qopt} = ${sq(fr(`2${s.D}${s.S}`, s.H))} ${sq(fr(`${s.H} + B`, 'B'))}`,
  basis: 'year',
  inputs: [D(), S(), ...holdingInputs('year', 0.5), money('B', { sym: 'B', label: 'Backorder cost per unit per year', blabel: 'Yearly cost of making a customer wait for one unit', def: 2, min: 0.0001, time: rate('year'), rand: [1, 60, 1], sens: true, cues: ['backorder cost', 'shortage cost', 'stockout cost', 'back order cost', 'backordering cost'], help: 'Cost of one unit being on backorder for a year: goodwill, expediting, discounts offered for the wait.' })],
  outputs: [
    out('Q', 'Order quantity', { sym: 'Qopt', unit: 'units', primary: true }), out('b', 'Maximum backorders', { sym: 'b^*', unit: 'units' }), out('Imax', 'Maximum inventory', { unit: 'units' }),
    out('TC', 'Total annual cost', { fmt: 'money' }), out('orderCost', 'Annual ordering cost', { fmt: 'money' }), out('holdCost', 'Annual holding cost', { fmt: 'money' }), out('backCost', 'Annual backorder cost', { fmt: 'money' }),
    out('shortPct', 'Share of each cycle spent out of stock', { fmt: 'pct' }),
  ],
  compute: (v) => {
    const H = getH(v); const Q = Math.sqrt((2 * v.D * v.S) / H) * Math.sqrt((H + v.B) / v.B); const b = (Q * H) / (H + v.B); const Imax = Q - b;
    const orderCost = (v.D / Q) * v.S, holdCost = ((Imax * Imax) / (2 * Q)) * H, backCost = ((b * b) / (2 * Q)) * v.B;
    return { H, Q, b, Imax, orderCost, holdCost, backCost, TC: orderCost + holdCost + backCost, shortPct: (b / Q) * 100 };
  },
  steps: (v, o, c) => [
    ...hStep(v, c),
    { title: 'Order quantity with backorders', tex: `${c.s.Qopt} = ${sq(fr(`2${c.s.D}${c.s.S}`, c.s.H))} ${sq(fr(`${c.s.H} + B`, 'B'))} = ${sq(fr(`2(${c.f.t(v.D)})(${c.f.t(v.S)})`, c.f.t(o.H, 4)))} ${sq(fr(`${c.f.t(o.H, 4)} + ${c.f.t(v.B)}`, c.f.t(v.B)))} = ${c.f.t(o.Q)}`, why: 'Start from the EOQ and scale it up. Letting some demand wait means less stock is held, so larger, less frequent orders become cheaper.', eli: 'If customers do not mind waiting a little, you can order less often and let the shelf run empty for a while.' },
    { title: 'Maximum backorder level', tex: `b^* = ${c.s.Qopt} ${fr(c.s.H, `${c.s.H} + B`)} = ${c.f.t(o.Q)} \\times ${fr(c.f.t(o.H, 4), c.f.t(o.H + v.B, 4))} = ${c.f.t(o.b)}`, why: 'The cheaper it is to backorder relative to holding, the more shortage you plan for.', eli: 'This is how deep the waiting list gets right before the next delivery.' },
    { title: 'Maximum inventory', tex: `I_{max} = ${c.s.Qopt} - b^* = ${c.f.t(o.Q)} - ${c.f.t(o.b)} = ${c.f.t(o.Imax)}`, why: 'When the order arrives, backorders are filled first. What is left goes on the shelf.' },
    { title: 'Total annual cost', tex: `${c.s.TC} = ${fr(c.s.D, c.s.Q)}${c.s.S} + ${fr('(Q - b)^2', '2Q')}${c.s.H} + ${fr('b^2', '2Q')}B = ${c.f.t(o.orderCost)} + ${c.f.t(o.holdCost)} + ${c.f.t(o.backCost)} = ${c.f.money(o.TC, 2)}`, why: 'Three parts: ordering, holding on the positive inventory triangle, and backorder cost on the shortage triangle.' },
  ],
  biz: (v, o, f) => ({
    headline: `Order ${f.int(o.Q)} units at a time and let backorders build to about ${f.int(o.b)} units before each delivery.`,
    meaning: [`You will be out of stock about ${f.pct(o.shortPct)} of the time, by design.`, `Total yearly cost is ${f.money(o.TC)}: ${f.money(o.orderCost)} ordering, ${f.money(o.holdCost)} holding, ${f.money(o.backCost)} backorders.`, `Shelf stock peaks at ${f.int(o.Imax)} units.`],
    actions: ['Only use this policy if customers genuinely accept waiting.', 'Tell customers the expected wait when the item is backordered.', 'If the backorder cost is a guess, test a higher value: the plan shifts toward holding more stock.'],
  }),
  viz: (v, o) => sawtooth({ Q: o.Q, d: v.D / 365, unit: 'day', back: o.b }),
  traps: ['Backorder cost must be per unit per year, the same time basis as holding cost.', 'As backorder cost becomes very large, the answer approaches the plain EOQ.', 'Maximum inventory is Q − b, not Q.'],
  analogy: 'A popular bakery that lets a short pre-order list build up instead of baking extra loaves that might go stale.',
  examples: [
    { title: 'Cheap backorders', story: 'Demand 1,000 a year, ordering cost $10, holding $0.50, backorder cost $2 per unit per year.', v: { D: 1000, S: 10, H: 0.5, B: 2 }, expect: { Q: 223.607, b: 44.721, TC: 89.443 } },
    { title: 'Radio components', story: 'Demand 2,000 a year, ordering cost $25, holding $10, backorder cost $30 per unit per year.', v: { D: 2000, S: 25, H: 10, B: 30 }, expect: { Q: 115.47, b: 28.868, TC: 866.025 } },
  ],
  practice: { ask: ['Q', 'b'], prompt: (v, f) => `Annual demand is ${f.int(v.D)} units, ordering cost ${f.money(v.S)}, holding cost ${f.money(v.H, 2)} per unit per year, and backorder cost ${f.money(v.B, 2)} per unit per year. Find the optimal order quantity and the maximum backorder level.` },
  uses: ['eoq'],
  mono: [['B', 'Q', -1], ['B', 'b', -1], ['D', 'Q', 1]],
  claim: 'The (Q, b) pair gives the lowest total cost of any order size and backorder level.',
});

export const ordersPerYear: CalcDef = calc({
  id: 'orders-per-year', name: 'Number of Orders per Year', short: 'Orders per year', cat: CAT,
  bq: 'How many orders will I place in a year?',
  blurb: 'Expected number of orders per year for a given order size, with the annual ordering cost.',
  keywords: ['orders per year', 'number of orders', 'order frequency', 'N', 'how often to order'],
  symptoms: ['how many orders a year', 'how often will i order', 'order frequency'],
  formula: (s) => `${s.N} = ${fr(s.D, s.Q)}`,
  basis: 'year',
  inputs: [D(), num('Q', { sym: 'Q', label: 'Order quantity', blabel: 'Units per order', unit: 'units', def: 200, min: 0.0001, rand: [50, 2000, 10], sens: true, cues: ['order quantity', 'order size', 'per order', 'eoq of', 'orders of'] }),
    money('S', { sym: 'S', label: 'Ordering cost per order (optional)', blabel: 'Cost per order (optional)', def: 10, rand: [5, 200, 5], adv: true, cues: ['ordering cost', 'order cost', 'cost per order'] })],
  outputs: [out('N', 'Orders per year', { sym: 'N', unit: 'orders', primary: true }), out('orderCost', 'Annual ordering cost', { fmt: 'money' }), out('Tdays', 'Days between orders (365-day year)', { unit: 'days' })],
  compute: (v) => ({ N: v.D / v.Q, orderCost: (v.D / v.Q) * (v.S ?? 0), Tdays: (v.Q / v.D) * 365 }),
  steps: (v, o, c) => [
    { title: 'Divide annual demand by order size', tex: `${c.s.N} = ${fr(c.s.D, c.s.Q)} = ${fr(c.f.t(v.D), c.f.t(v.Q))} = ${c.f.t(o.N)} ${tx(' orders per year')}`, why: 'Every order brings in Q units, so covering D units takes D/Q orders.', eli: 'If you need 1,000 a year and each delivery brings 200, you need 5 deliveries.' },
    { title: 'Annual ordering cost', tex: `${c.s.N} \\times ${c.s.S} = ${c.f.t(o.N)} \\times ${c.f.t(v.S)} = ${c.f.money(o.orderCost, 2)}`, why: 'Each order carries a fixed cost, so the yearly bill is orders times cost per order.' },
  ],
  biz: (v, o, f) => ({ headline: `You will place about ${f.num(o.N, 1)} orders a year.`, meaning: [`That is one order roughly every ${f.int(o.Tdays)} days.`, `At ${f.money(v.S)} an order, ordering costs about ${f.money(o.orderCost)} a year.`], actions: ['If that feels like too much admin, compare a larger order size with the EOQ calculator.', 'Put the orders on a calendar so they do not slip.'] }),
  viz: (v, o) => sawtooth({ Q: v.Q, d: v.D / 365, unit: 'day', cycles: Math.min(6, Math.max(2, Math.round(o.N))) }),
  traps: ['A fractional answer is fine: 4.5 orders a year means 9 orders every 2 years.', 'D and N must cover the same period (usually one year).'],
  analogy: 'If a family drinks 52 cartons of milk a year and buys 4 at a time, they shop for milk 13 times a year.',
  examples: [
    { title: 'Needles', story: 'Annual demand 1,000 units, order size 200.', v: { D: 1000, Q: 200, S: 10 }, expect: { N: 5, orderCost: 50 } },
    { title: 'Weekly seller', story: 'Annual demand 5,200 units, order size 400, $30 per order.', v: { D: 5200, Q: 400, S: 30 }, expect: { N: 13, orderCost: 390 } },
  ],
  practice: { ask: ['N'], prompt: (v, f) => `Annual demand is ${f.int(v.D)} units and the firm orders ${f.int(v.Q)} units at a time. How many orders are placed per year?` },
  uses: ['eoq'],
  mono: [['D', 'N', 1], ['Q', 'N', -1]],
});

export const timeBetweenOrders: CalcDef = calc({
  id: 'time-between-orders', name: 'Time Between Orders', short: 'Time between orders', cat: CAT,
  bq: 'How often should I reorder?',
  blurb: 'Expected time between orders (the order cycle) for a given order size and demand.',
  keywords: ['time between orders', 'order cycle', 'cycle time', 'order interval', 'T', 'days between orders', 'TBO'],
  symptoms: ['how often should i order', 'how long does an order last', 'order interval'],
  formula: (s) => `${s.T} = ${fr(s.Q, s.D)} \\times ${tx('days per year')}`,
  basis: 'year',
  inputs: [D(), num('Q', { sym: 'Q', label: 'Order quantity', blabel: 'Units per order', unit: 'units', def: 200, min: 0.0001, rand: [50, 2000, 10], sens: true, cues: ['order quantity', 'order size', 'per order', 'eoq of', 'orders of'] }), { ...dpyInput(365), adv: false }],
  outputs: [out('Tdays', 'Time between orders', { sym: 'T', unit: 'days', primary: true }), out('Tweeks', 'Time between orders', { unit: 'weeks' }), out('N', 'Orders per year', { sym: 'N', unit: 'orders' })],
  compute: (v) => { const N = v.D / v.Q; const Tdays = v.daysPerYear / N; return { N, Tdays, Tweeks: (v.Q / v.D) * 52 }; },
  steps: (v, o, c) => [
    { title: 'Orders per year', tex: `${c.s.N} = ${fr(c.s.D, c.s.Q)} = ${fr(c.f.t(v.D), c.f.t(v.Q))} = ${c.f.t(o.N)}`, why: 'First find how many orders are needed to cover annual demand.' },
    { title: 'Spread them over the operating year', tex: `${c.s.T} = ${fr(tx('days per year'), c.s.N)} = ${fr(c.f.t(v.daysPerYear), c.f.t(o.N))} = ${c.f.t(o.Tdays)} ${tx(' days')}`, why: 'Use working days if the problem gives them (for example 250), otherwise 365. This is the same as (Q/D) × days per year.', eli: 'Cut the year into as many equal pieces as you have orders. Each piece is the gap between orders.' },
  ],
  biz: (v, o, f) => ({ headline: `Reorder about every ${f.int(o.Tdays)} operating days.`, meaning: [`That is roughly every ${f.num(o.Tweeks, 1)} weeks, or ${f.num(o.N, 1)} orders a year.`, `Each order of ${f.int(v.Q)} units lasts that long at your current sales rate.`], actions: ['Set a recurring reminder at this interval, then fine-tune with a reorder point.', 'If the interval is shorter than your supplier lead time, you will have more than one order in transit at once. Plan for that.'] }),
  viz: (v, o) => sawtooth({ Q: v.Q, d: v.D / v.daysPerYear, unit: 'day', cycles: 3 }),
  traps: ['Use the number of working days stated in the problem, not always 365.', 'Time between orders is not the lead time. Lead time is how long the supplier takes; this is how long an order lasts.'],
  analogy: 'If a tank of gas lasts you 10 days, you visit the pump every 10 days. Order size is the tank, demand is your driving.',
  examples: [
    { title: 'Needles, 250-day year', story: 'Annual demand 1,000, order size 200, 250 working days.', v: { D: 1000, Q: 200, daysPerYear: 250 }, expect: { Tdays: 50, N: 5 } },
    { title: 'Calendar year', story: 'Annual demand 5,200, order size 400, 365 days.', v: { D: 5200, Q: 400, daysPerYear: 365 }, expect: { Tdays: 28.0769, Tweeks: 4 } },
  ],
  practice: { ask: ['Tdays'], prompt: (v, f) => `Annual demand is ${f.int(v.D)} units and the order quantity is ${f.int(v.Q)} units. With ${f.int(v.daysPerYear)} working days per year, what is the expected time between orders in days?` },
  uses: ['orders-per-year', 'eoq'],
  mono: [['Q', 'Tdays', 1], ['D', 'Tdays', -1]],
});

export default [eoq, totalCost, epq, quantityDiscount, backorderEoq, ordersPerYear, timeBetweenOrders];
