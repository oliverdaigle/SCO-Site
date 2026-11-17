// Planning and MRP: gross-to-net, lot sizing rules, aggregate planning.
import { calc, num, money, int, sel, series, out, fr, tx } from '../dsl';
import { planLots, releases, aggLevel, aggChase, aggHybrid, type LotRule } from '../math/mrp';
import { sum, mean, type Rng } from '../math/util';
import type { CalcDef, Ctx, Fmt, InputDef, Step, Vals, VizSpec } from '../types';

const CAT = 'mrp';
const KITS = [35, 30, 40, 0, 10, 40, 30, 0, 30, 55];
const WEEKS8 = [50, 60, 70, 60, 95, 75, 60, 55];
const grossIn = (def = KITS) => series('gross', { label: 'Gross requirements by period', blabel: 'Units needed each period', def, minRows: 1, cues: ['gross requirements', 'requirements', 'demand'], help: 'One number per period (week, day, or month), in order.' });
const onHandIn = (def = 35) => num('onHand', { label: 'On-hand inventory at start', blabel: 'Units in stock now', unit: 'units', def, min: 0, cues: ['on hand', 'on-hand', 'beginning inventory', 'in stock'] });
const sIn = (def = 100) => money('S', { sym: 'S', label: 'Setup (ordering) cost per order', blabel: 'Cost to place one order or do one setup', def, sens: true, cues: ['setup cost', 'ordering cost', 'cost per order'] });
const hIn = (def = 1) => money('h', { sym: 'H', label: 'Holding cost per unit per period', blabel: 'Cost to hold one unit for one period', def, sens: true, cues: ['holding cost', 'carrying cost', 'per unit per week', 'per unit per period'] });
const periods = (n: number) => Array.from({ length: n }, (_, i) => String(i + 1));
const grid = (v: Vals, o: any, extra: { label: string; vals: number[] }[] = []): VizSpec => ({ kind: 'grid', periods: periods(v.gross.length), rows: [{ label: 'Gross requirements', vals: v.gross }, ...extra, { label: 'Net requirements', vals: o.net }, { label: 'Planned order receipts', vals: o.receipts, tone: 'accent', bold: true }, { label: 'Projected on hand', vals: o.end, tone: 'alt' }] });
const genGross = (r: Rng) => Array.from({ length: 4 + Math.floor(r() * 9) }, () => (r() < 0.2 ? 0 : Math.floor(r() * 120)));
const allRules = (v: Vals) => { const p = { S: v.S, h: v.h }; const avg = mean(v.gross) || 1; const eoq = Math.sqrt((2 * avg * v.S) / Math.max(v.h, 1e-12)); return { l4l: planLots(v.gross, v.onHand, 'l4l', p).total, foq: planLots(v.gross, v.onHand, 'foq', { ...p, Q: Math.max(1, Math.round(eoq)) }).total, poq: planLots(v.gross, v.onHand, 'poq', { ...p, P: Math.max(1, Math.round(eoq / avg)) }).total, ppb: planLots(v.gross, v.onHand, 'ppb', p).total }; };
const compareLine = (v: Vals, f: Fmt) => { const a = allRules(v); return `For comparison on the same data: lot-for-lot ${f.money(a.l4l)}, fixed EOQ quantity ${f.money(a.foq)}, periodic order quantity ${f.money(a.poq)}, part-period balancing ${f.money(a.ppb)}.`; };
const costOuts = () => [out('total', 'Total cost', { fmt: 'money', primary: true }), out('orders', 'Number of orders', { fmt: 'int' }), out('setupCost', 'Total setup cost', { fmt: 'money' }), out('holdCost', 'Total holding cost', { fmt: 'money' })];
const planTable = (v: Vals, o: any, c: Ctx) => ({ columns: ['Period', 'Gross req.', 'Net req.', 'Planned receipt', 'Ending inventory'], rows: (v.gross as number[]).map((g, t) => [t + 1, c.f.num(g), c.f.num(o.net[t]), o.receipts[t] > 0 ? c.f.num(o.receipts[t]) : '', c.f.num(o.end[t])]) });
const costStep = (o: any, c: Ctx): Step => ({ title: 'Add up the costs', tex: `${tx('Setup')} = ${o.orders} \\times ${c.f.t(o.setupCost / Math.max(o.orders, 1))} = ${c.f.money(o.setupCost, 2)}, \\quad ${tx('Holding')} = \\sum ${tx('ending inventory')} \\times H = ${c.f.money(o.holdCost, 2)}, \\quad ${tx('Total')} = ${c.f.money(o.total, 2)}`, why: 'One setup cost for each period with an order, plus holding cost on whatever is left at the end of each period.' });
const lotBase = (rule: LotRule, extra: (v: Vals) => object) => (v: Vals) => { const pl = planLots(v.gross, v.onHand, rule, { S: v.S, h: v.h, ...extra(v) }); return { ...pl }; };

export const grossToNet: CalcDef = calc({
  id: 'mrp-gross-to-net', name: 'MRP Gross-to-Net Requirements', short: 'MRP gross-to-net', cat: CAT,
  bq: 'When do I need to order, and how much, to cover my schedule?',
  blurb: 'A full time-phased MRP record: net requirements, planned order receipts, and planned order releases offset by lead time.',
  keywords: ['mrp', 'material requirements planning', 'gross to net', 'net requirements', 'planned order release', 'planned order receipt', 'time-phased', 'mrp record', 'scheduled receipts'],
  symptoms: ['when do i need to order parts', 'plan component orders', 'parts arrive too late', 'material plan'],
  formula: () => `${tx('Net')}_t = ${tx('Gross')}_t + ${tx('Safety stock')} - (${tx('On hand')}_{t-1} + ${tx('Scheduled receipts')}_t)`,
  inputs: [grossIn([0, 0, 50, 0, 80, 0, 0, 120]), series('sched', { label: 'Scheduled receipts by period (optional)', blabel: 'Orders already on the way, by period (optional)', def: [], minRows: 0, cues: ['scheduled receipts', 'open orders'] }), onHandIn(60),
    num('ss', { label: 'Safety stock', blabel: 'Buffer stock to keep', unit: 'units', def: 0, min: 0, cues: ['safety stock'] }), int('lead', { sym: 'L', label: 'Lead time (periods)', blabel: 'Lead time in periods', def: 2, min: 0, max: 52, cues: ['lead time'] }),
    sel('rule', 'Lot-sizing rule', [['l4l', 'Lot-for-lot'], ['foq', 'Fixed order quantity'], ['poq', 'Periodic order quantity']], 'l4l'),
    num('Q', { sym: 'Q', label: 'Fixed order quantity', def: 100, min: 0.0001, show: (v) => v.rule === 'foq', cues: ['lot size', 'order quantity', 'multiples of'] }), int('P', { sym: 'P', label: 'Periods covered per order', def: 2, min: 1, max: 52, show: (v) => v.rule === 'poq', cues: ['periods of supply'] })],
  outputs: [out('totalNet', 'Total net requirements', { unit: 'units', primary: true }), out('orders', 'Planned orders', { fmt: 'int' }), out('firstRelease', 'First order release (period)', { fmt: 'int' }), out('pastDue', 'Units past due', { unit: 'units' }), out('ending', 'Ending inventory', { unit: 'units' })],
  check: (v) => ((v.gross as number[]).some((x) => x < 0) ? 'Gross requirements cannot be negative.' : v.sched.length > v.gross.length ? 'Scheduled receipts cover more periods than the gross requirements.' : null),
  compute: (v) => { const pl = planLots(v.gross, v.onHand, v.rule, { Q: v.Q, P: v.P, ss: v.ss, sched: v.sched }); const r = releases(pl.receipts, v.lead); return { net: pl.net, receipts: pl.receipts, end: pl.end, rel: r.rel, pastDue: r.pastDue, orders: pl.orders, totalNet: sum(pl.net), firstRelease: r.rel.findIndex((x) => x > 0) + 1, ending: pl.end[pl.end.length - 1] }; },
  steps: (v, o, c) => [
    { title: 'Net each period against available inventory', tex: `${tx('Net')}_t = \\max\\left(0,\; ${tx('Gross')}_t + ${tx('SS')} - ${tx('On hand')}_{t-1} - ${tx('Sched. receipts')}_t\\right)`, why: 'A net requirement appears only when what you need (plus safety stock) exceeds what you have and what is already on its way.', eli: 'Before buying more, check the pantry and what is already in the mail.',
      table: { columns: ['Period', 'Gross', 'Sched. receipts', 'Net', 'Planned receipt', 'Planned release', 'Projected on hand'], rows: (v.gross as number[]).map((g, t) => [t + 1, c.f.num(g), v.sched[t] ? c.f.num(v.sched[t]) : '', o.net[t] > 0 ? c.f.num(o.net[t]) : '', o.receipts[t] > 0 ? c.f.num(o.receipts[t]) : '', o.rel[t] > 0 ? c.f.num(o.rel[t]) : '', c.f.num(o.end[t])]) } },
    { title: 'Size each planned order receipt', why: v.rule === 'l4l' ? 'Lot-for-lot: order exactly the net requirement.' : v.rule === 'foq' ? `Fixed order quantity: order in multiples of ${c.f.num(v.Q)} until the net requirement is covered.` : `Periodic order quantity: each order covers the net requirements of the next ${v.P} periods.` },
    { title: 'Offset by the lead time', tex: `${tx('Release period')} = ${tx('Receipt period')} - ${c.s.L} = t - ${v.lead}`, why: 'An order must be released one lead time before it is needed.' + (o.pastDue > 0 ? ` ${c.f.num(o.pastDue)} units would have had to be released before period 1: they are past due and need expediting.` : ''), eli: 'If delivery takes two weeks, order two weeks before you need it.' },
  ],
  biz: (v, o, f) => ({ headline: o.orders === 0 ? 'No orders needed: current stock and open orders cover the whole schedule.' : o.pastDue > 0 ? `You are already late: ${f.int(o.pastDue)} units should have been ordered before period 1.` : `Release your first order in period ${f.int(o.firstRelease)}. The plan needs ${f.int(o.orders)} order${o.orders > 1 ? 's' : ''} in total.`, meaning: [`Net requirements over the horizon total ${f.int(o.totalNet)} units.`, `Planned releases by period: ${o.rel.map((x: number, t: number) => (x > 0 ? `P${t + 1}: ${f.int(x)}` : '')).filter(Boolean).join(', ') || 'none'}.`, `You end the horizon with ${f.int(o.ending)} units.`], actions: [o.pastDue > 0 ? 'Expedite the late quantity or renegotiate the due date.' : 'Put the release dates on your purchasing calendar.', 'Try another lot-sizing rule to trade off setups against inventory.', 'Re-run whenever the schedule or stock on hand changes.'] }),
  viz: (v, o) => ({ kind: 'grid', periods: periods(v.gross.length), rows: [{ label: 'Gross requirements', vals: v.gross }, { label: 'Scheduled receipts', vals: (v.gross as number[]).map((_, i) => v.sched[i] ?? 0) }, { label: 'Projected on hand', vals: o.end, tone: 'alt' }, { label: 'Net requirements', vals: o.net }, { label: 'Planned order receipts', vals: o.receipts, tone: 'accent' }, { label: 'Planned order releases', vals: o.rel, tone: 'accent', bold: true }] }),
  traps: ['Projected on hand is the balance at the end of the period.', 'Releases are offset backward by the lead time, not forward.', 'Scheduled receipts are orders already released. Planned receipts are ones MRP is proposing.', 'Safety stock raises the net requirement: inventory may not drop below it.'],
  analogy: 'Planning a dinner party backward from the serving time: what you need, minus what is in the fridge, ordered early enough to arrive.',
  examples: [
    { title: 'Lot-for-lot record', story: 'Gross requirements are 50 in week 3, 80 in week 5, and 120 in week 8. There are 60 on hand and lead time is 2 weeks.', v: { gross: [0, 0, 50, 0, 80, 0, 0, 120], sched: [], onHand: 60, ss: 0, lead: 2, rule: 'l4l' }, expect: { totalNet: 190, orders: 2, firstRelease: 3, pastDue: 0 } },
    { title: 'Fixed lots with safety stock', story: 'Gross requirements 40, 30, 50, 60, 20, 70. A receipt of 50 is scheduled in week 2. 60 on hand, safety stock 10, lead time 1 week, lots of 100.', v: { gross: [40, 30, 50, 60, 20, 70], sched: [0, 50], onHand: 60, ss: 10, lead: 1, rule: 'foq', Q: 100 }, expect: { totalNet: 90, orders: 2, firstRelease: 2, ending: 40 } },
  ],
  practice: { ask: ['totalNet'], gen: (r) => ({ gross: Array.from({ length: 6 }, () => Math.floor(r() * 8) * 10), sched: [], onHand: 20 + Math.floor(r() * 6) * 10, ss: 0, lead: 1 + Math.floor(r() * 2), rule: 'l4l' }), prompt: (v) => `Gross requirements for the next ${v.gross.length} weeks are ${v.gross.join(', ')}. There are ${v.onHand} units on hand, no scheduled receipts, and lead time is ${v.lead} week(s). Using lot-for-lot, what are the total net requirements?` },
  gen: (r) => { const gross = genGross(r); return { gross, sched: r() < 0.5 ? [] : gross.map(() => (r() < 0.15 ? Math.floor(r() * 80) : 0)), onHand: Math.floor(r() * 150), ss: r() < 0.5 ? 0 : Math.floor(r() * 30), lead: Math.floor(r() * 4), rule: ['l4l', 'foq', 'poq'][Math.floor(r() * 3)], Q: 10 + Math.floor(r() * 150), P: 1 + Math.floor(r() * 4) }; },
  uses: ['lot-for-lot', 'fixed-order-quantity', 'poq-lot-sizing'],
  claim: 'Every period satisfies the inventory balance equation and inventory never falls below safety stock.',
});

const lotCommon = { cat: CAT, check: (v: Vals) => ((v.gross as number[]).some((x) => x < 0) ? 'Gross requirements cannot be negative.' : null) };

export const lotForLot: CalcDef = calc({
  ...lotCommon, id: 'lot-for-lot', name: 'Lot-for-Lot Lot Sizing', short: 'Lot-for-lot',
  bq: 'What does ordering exactly what I need each period cost?',
  blurb: 'Orders exactly the net requirement every period: no inventory carried, but a setup every time.',
  keywords: ['lot-for-lot', 'l4l', 'lot for lot', 'lot sizing', 'just in time ordering'],
  symptoms: ['order exactly what is needed', 'minimize inventory', 'jit ordering'],
  formula: () => `${tx('Order')}_t = ${tx('Net requirement')}_t`,
  inputs: [grossIn(), onHandIn(), sIn(), hIn()], outputs: costOuts(),
  compute: lotBase('l4l', () => ({})),
  steps: (v, o, c) => [{ title: 'Order each period’s net requirement', why: 'Lot-for-lot matches supply to demand period by period, so ending inventory is zero whenever an order is placed.', eli: 'Buy only today’s groceries, every day. Nothing spoils, but you make a lot of trips.', table: planTable(v, o, c) }, costStep(o, c)],
  biz: (v, o, f) => ({ headline: `Ordering exactly what you need each period costs ${f.money(o.total)} over this horizon.`, meaning: [`That is ${f.int(o.orders)} orders (${f.money(o.setupCost)} in setups) and ${f.money(o.holdCost)} in holding.`, compareLine(v, f)], actions: ['Lot-for-lot is best when setups are cheap or the item is expensive to hold.', 'If setup cost dominates, compare the POQ and part-period balancing calculators.'] }),
  viz: (v, o) => grid(v, o),
  traps: ['Lot-for-lot has no holding cost only when starting inventory is used up before the first order.', 'Count a setup for every period with a net requirement.'],
  analogy: 'Buying a coffee every morning instead of a bag of beans: no stock at home, but a trip every day.',
  examples: [
    { title: 'Speaker kits', story: 'Weekly gross requirements are 35, 30, 40, 0, 10, 40, 30, 0, 30, 55 with 35 on hand. Setup cost is $100 and holding is $1 per unit per week.', v: { gross: KITS, onHand: 35, S: 100, h: 1 }, expect: { orders: 7, total: 700, holdCost: 0 } },
    { title: 'Eight-week schedule', story: 'Requirements are 50, 60, 70, 60, 95, 75, 60, 55 with nothing on hand. Setup cost is $47 and holding is $0.05 per unit per week.', v: { gross: WEEKS8, onHand: 0, S: 47, h: 0.05 }, expect: { orders: 8, total: 376 } },
  ],
  practice: { ask: ['total'], gen: (r) => ({ gross: Array.from({ length: 6 }, () => Math.floor(r() * 8) * 10), onHand: 0, S: 50 + Math.floor(r() * 6) * 10, h: 1 }), prompt: (v, f) => `Requirements over ${v.gross.length} weeks are ${v.gross.join(', ')} with nothing on hand. Setup cost is ${f.money(v.S)} and holding cost is ${f.money(v.h)} per unit per week. What is the total cost under lot-for-lot?` },
  gen: (r) => ({ gross: genGross(r), onHand: Math.floor(r() * 100), S: 10 + Math.floor(r() * 300), h: +(0.05 + r() * 4).toFixed(2) }),
  uses: [], claim: 'Costs equal an independent period-by-period recomputation from the inventory balance.',
});

export const fixedOrderQty: CalcDef = calc({
  ...lotCommon, id: 'fixed-order-quantity', name: 'Fixed Order Quantity (EOQ) Lot Sizing', short: 'Fixed order quantity',
  bq: 'What does ordering a standard lot size cost against my schedule?',
  blurb: 'Orders a fixed quantity (the EOQ by default) whenever a net requirement appears.',
  keywords: ['fixed order quantity', 'foq', 'eoq lot sizing', 'fixed lot size', 'standard lot', 'lot sizing'],
  symptoms: ['supplier requires a fixed pack size', 'standard lot size', 'order in multiples'],
  formula: (s) => `${s.Q} = ${tx('fixed lot')} \\quad (\\text{default } \\sqrt{2\\bar{D}S/H})`,
  inputs: [grossIn(), onHandIn(), sIn(), hIn(), sel('qMode', 'Lot size', [['eoq', 'Use the EOQ from average demand'], ['given', 'Enter a lot size']], 'eoq'), num('Q', { sym: 'Q', label: 'Fixed lot size', def: 73, min: 0.0001, show: (v) => v.qMode === 'given', sens: true, cues: ['lot size', 'order quantity', 'multiples of'] })],
  outputs: [...costOuts(), out('Qused', 'Lot size used', { unit: 'units' })],
  compute: (v) => { const avg = mean(v.gross); const Q = v.qMode === 'given' ? v.Q : Math.max(1, Math.round(Math.sqrt((2 * avg * v.S) / Math.max(v.h, 1e-12)))); return { ...planLots(v.gross, v.onHand, 'foq', { S: v.S, h: v.h, Q }), Qused: Q }; },
  steps: (v, o, c) => [
    v.qMode === 'given' ? { title: 'Lot size', tex: `${c.s.Q} = ${c.f.t(o.Qused)}`, why: 'The lot size is given.' } : { title: 'EOQ from average period demand', tex: `${c.s.Q} = \\sqrt{${fr(`2\\bar{D}${c.s.S}`, c.s.H)}} = \\sqrt{${fr(`2(${c.f.t(mean(v.gross), 2)})(${c.f.t(v.S)})`, c.f.t(v.h))}} = ${c.f.t(Math.sqrt((2 * mean(v.gross) * v.S) / v.h), 2)} \\approx ${c.f.t(o.Qused)}`, why: 'Use average demand per period with holding cost per period (matching time units), then round to a whole lot.' },
    { title: 'Order a lot whenever inventory would run short', why: 'Each time a net requirement appears, a full lot arrives. The remainder is carried forward.', eli: 'Always buy the same size pack. Leftovers go back on the shelf.', table: planTable(v, o, c) }, costStep(o, c)],
  biz: (v, o, f) => ({ headline: `Ordering in lots of ${f.int(o.Qused)} costs ${f.money(o.total)} over this horizon.`, meaning: [`${f.int(o.orders)} orders (${f.money(o.setupCost)}) plus ${f.money(o.holdCost)} in holding.`, compareLine(v, f)], actions: ['Fixed lots suit suppliers with pack sizes or minimums.', 'When demand is lumpy, fixed lots leave odd remnants in stock. POQ usually does better.'] }),
  viz: (v, o) => grid(v, o),
  traps: ['EOQ assumes steady demand. With lumpy requirements it can carry a lot of leftover stock.', 'Match time units: average demand per week with holding cost per week.'],
  analogy: 'Buying eggs by the dozen no matter what the recipe calls for.',
  examples: [
    { title: 'Speaker kits with the EOQ', story: 'Requirements 35, 30, 40, 0, 10, 40, 30, 0, 30, 55; 35 on hand; setup $100; holding $1 per unit per week. Average demand is 27 a week, so the EOQ is 73.', v: { gross: KITS, onHand: 35, S: 100, h: 1 }, expect: { Qused: 73, orders: 4, holdCost: 375, total: 775 } },
    { title: 'Eight weeks with a lot of 351', story: 'Requirements 50, 60, 70, 60, 95, 75, 60, 55; nothing on hand; setup $47; holding $0.05 per unit per week; lot size 351.', v: { gross: WEEKS8, onHand: 0, S: 47, h: 0.05, qMode: 'given', Q: 351 }, expect: { orders: 2, total: 171.05 } },
  ],
  practice: { ask: ['total'], gen: (r) => ({ gross: Array.from({ length: 6 }, () => 10 + Math.floor(r() * 7) * 10), onHand: 0, S: 100, h: 1, qMode: 'given', Q: [80, 100, 120][Math.floor(r() * 3)] }), prompt: (v, f) => `Requirements over ${v.gross.length} weeks are ${v.gross.join(', ')} with nothing on hand. Setup cost is ${f.money(v.S)} and holding cost is ${f.money(v.h)} per unit per week. Using a fixed order quantity of ${v.Q}, what is the total cost?` },
  gen: (r) => ({ gross: genGross(r), onHand: Math.floor(r() * 100), S: 10 + Math.floor(r() * 300), h: +(0.05 + r() * 4).toFixed(2), qMode: r() < 0.5 ? 'eoq' : 'given', Q: 5 + Math.floor(r() * 200) }),
  uses: ['eoq'], claim: 'Costs equal an independent period-by-period recomputation from the inventory balance.',
});

export const poqLot: CalcDef = calc({
  ...lotCommon, id: 'poq-lot-sizing', name: 'Periodic Order Quantity (POQ) Lot Sizing', short: 'POQ lot sizing',
  bq: 'What if I order every few periods and cover exactly what is needed?',
  blurb: 'Orders at a fixed interval, each order covering exactly the requirements of the periods until the next one.',
  keywords: ['periodic order quantity', 'poq', 'poq lot sizing', 'fixed period requirements', 'periods of supply'],
  symptoms: ['order every few weeks', 'regular ordering interval', 'cover several periods per order'],
  formula: (s) => `P = ${fr('EOQ', '\\bar{D}')} \; (\\text{rounded}), \\quad ${tx('Order')} = \\sum ${tx('net requirements over P periods')}`,
  inputs: [grossIn(), onHandIn(), sIn(), hIn(), sel('pMode', 'Order interval', [['eoq', 'Derive from the EOQ'], ['given', 'Enter the interval']], 'eoq'), int('P', { sym: 'P', label: 'Periods covered per order', def: 3, min: 1, max: 52, show: (v) => v.pMode === 'given', sens: true, cues: ['every', 'periods of supply', 'interval'] })],
  outputs: [...costOuts(), out('Pused', 'Order interval used', { unit: 'periods', fmt: 'int' })],
  compute: (v) => { const avg = mean(v.gross); const eoq = Math.sqrt((2 * avg * v.S) / Math.max(v.h, 1e-12)); const P = v.pMode === 'given' ? v.P : Math.max(1, Math.round(eoq / Math.max(avg, 1e-12))); return { ...planLots(v.gross, v.onHand, 'poq', { S: v.S, h: v.h, P }), Pused: P, eoq }; },
  steps: (v, o, c) => [
    v.pMode === 'given' ? { title: 'Order interval', tex: `P = ${o.Pused}`, why: 'The interval is given.' } : { title: 'Order interval from the EOQ', tex: `P = ${fr('EOQ', '\\bar{D}')} = ${fr(c.f.t(o.eoq, 2), c.f.t(mean(v.gross), 2))} = ${c.f.t(o.eoq / mean(v.gross), 2)} \\approx ${o.Pused} ${tx(' periods')}`, why: 'The EOQ divided by average period demand says how many periods one economic order should last. Round to a whole number of periods.' },
    { title: 'Each order covers exactly P periods of net requirements', why: 'An order is placed when a net requirement appears and covers that period plus the next P − 1. Because each order is sized to actual requirements, no remnants are left over.', eli: 'Shop every third week and buy exactly what those three weeks need.', table: planTable(v, o, c) }, costStep(o, c)],
  biz: (v, o, f) => ({ headline: `Ordering every ${f.int(o.Pused)} periods costs ${f.money(o.total)} over this horizon.`, meaning: [`${f.int(o.orders)} orders (${f.money(o.setupCost)}) plus ${f.money(o.holdCost)} in holding.`, compareLine(v, f)], actions: ['POQ gives a predictable ordering rhythm, which suppliers like.', 'Recompute the interval if average demand changes a lot.'] }),
  viz: (v, o) => grid(v, o),
  traps: ['The interval is in periods, so round EOQ / average demand to a whole number.', 'Order quantities vary under POQ. Only the timing is fixed.', 'Start counting the interval from a period with a net requirement.'],
  analogy: 'A grocery run every third week, with a list built from the actual meal plan for those weeks.',
  examples: [
    { title: 'Speaker kits', story: 'Requirements 35, 30, 40, 0, 10, 40, 30, 0, 30, 55; 35 on hand; setup $100; holding $1 per unit per week. EOQ is 73 and average demand 27, so order every 3 weeks.', v: { gross: KITS, onHand: 35, S: 100, h: 1 }, expect: { Pused: 3, orders: 3, holdCost: 195, total: 495 } },
    { title: 'Eight-week schedule', story: 'Requirements 50, 60, 70, 60, 95, 75, 60, 55; nothing on hand; setup $47; holding $0.05 per unit per week.', v: { gross: WEEKS8, onHand: 0, S: 47, h: 0.05 }, expect: { Pused: 5, orders: 2, total: 140.5 } },
  ],
  practice: { ask: ['total'], gen: (r) => ({ gross: Array.from({ length: 6 }, () => 10 + Math.floor(r() * 7) * 10), onHand: 0, S: 100, h: 1, pMode: 'given', P: 2 + Math.floor(r() * 2) }), prompt: (v, f) => `Requirements over ${v.gross.length} weeks are ${v.gross.join(', ')} with nothing on hand. Setup cost is ${f.money(v.S)} and holding cost is ${f.money(v.h)} per unit per week. Using a periodic order quantity covering ${v.P} weeks per order, what is the total cost?` },
  gen: (r) => ({ gross: genGross(r).map((x) => x + 1), onHand: Math.floor(r() * 100), S: 10 + Math.floor(r() * 300), h: +(0.05 + r() * 4).toFixed(2), pMode: r() < 0.5 ? 'eoq' : 'given', P: 1 + Math.floor(r() * 5) }),
  uses: ['eoq', 'lot-for-lot'], claim: 'Costs equal an independent period-by-period recomputation from the inventory balance.',
});

export const ppb: CalcDef = calc({
  ...lotCommon, id: 'part-period-balancing', name: 'Part-Period Balancing', short: 'Part-period balancing',
  bq: 'Which combination of periods per order balances setup and holding cost?',
  blurb: 'Combines requirements into each order until the holding cost (in part-periods) is as close as possible to the setup cost.',
  keywords: ['part-period balancing', 'ppb', 'part period', 'economic part period', 'epp', 'least total cost', 'ltc', 'lot sizing heuristic'],
  symptoms: ['balance setup and holding', 'lumpy demand lot sizing', 'best lot sizing rule'],
  formula: (s) => `EPP = ${fr(s.S, s.H)}`,
  inputs: [grossIn(), onHandIn(), sIn(), hIn()], outputs: [...costOuts(), out('epp', 'Economic part-period', { dp: 1 })],
  compute: (v) => ({ ...planLots(v.gross, v.onHand, 'ppb', { S: v.S, h: v.h }), epp: v.S / Math.max(v.h, 1e-12) }),
  steps: (v, o, c) => [
    { title: 'Economic part-period', tex: `EPP = ${fr(c.s.S, c.s.H)} = ${fr(c.f.t(v.S), c.f.t(v.h))} = ${c.f.t(o.epp, 1)} ${tx(' part-periods')}`, why: 'One part-period is one unit held for one period. EPP is the number of part-periods whose holding cost equals one setup.', eli: 'How many "unit-weeks" of storage cost the same as one more order?' },
    { title: 'Add periods to each order until part-periods are closest to EPP', why: 'Starting from a period with a net requirement, add later requirements one at a time. Each adds (units × periods carried) part-periods. Stop at the combination whose cumulative part-periods are closest to EPP.', table: planTable(v, o, c) }, costStep(o, c)],
  biz: (v, o, f) => ({ headline: `Part-period balancing costs ${f.money(o.total)} over this horizon with ${f.int(o.orders)} orders.`, meaning: [`${f.money(o.setupCost)} in setups plus ${f.money(o.holdCost)} in holding: the method tries to keep those two roughly equal per order.`, compareLine(v, f)], actions: ['Use this rule when demand is lumpy: it adapts order sizes to the schedule.', 'It is a heuristic, usually near the minimum but not guaranteed to be optimal.'] }),
  viz: (v, o) => grid(v, o),
  traps: ['Part-periods count units carried times the number of periods carried. The first period’s units carry zero.', 'Textbooks differ: some stop before exceeding EPP, others pick the closest. This calculator picks the closest.'],
  analogy: 'Deciding how many weeks of groceries to buy at once by stopping when the fridge cost roughly equals the cost of another trip.',
  convention: 'Each order covers the set of periods whose cumulative part-periods are closest to EPP = S/H (ties go to the shorter coverage).',
  examples: [
    { title: 'Speaker kits', story: 'Requirements 35, 30, 40, 0, 10, 40, 30, 0, 30, 55; 35 on hand; setup $100; holding $1 per unit per week.', v: { gross: KITS, onHand: 35, S: 100, h: 1 }, expect: { epp: 100, orders: 3, holdCost: 190, total: 490 } },
    { title: 'Eight-week schedule', story: 'Requirements 50, 60, 70, 60, 95, 75, 60, 55; nothing on hand; setup $47; holding $0.05 per unit per week.', v: { gross: WEEKS8, onHand: 0, S: 47, h: 0.05 }, expect: { epp: 940, orders: 2, total: 140.5 } },
  ],
  practice: { ask: ['total'], gen: (r) => ({ gross: Array.from({ length: 6 }, () => 10 + Math.floor(r() * 7) * 10), onHand: 0, S: [80, 100, 150][Math.floor(r() * 3)], h: 1 }), prompt: (v, f) => `Requirements over ${v.gross.length} weeks are ${v.gross.join(', ')} with nothing on hand. Setup cost is ${f.money(v.S)} and holding cost is ${f.money(v.h)} per unit per week. Using part-period balancing (closest to EPP), what is the total cost?` },
  gen: (r) => ({ gross: genGross(r), onHand: Math.floor(r() * 100), S: 10 + Math.floor(r() * 300), h: +(0.05 + r() * 4).toFixed(2) }),
  uses: ['lot-for-lot', 'poq-lot-sizing'], claim: 'Costs equal an independent recomputation and are compared with the optimal plan from Wagner-Whitin dynamic programming (the rule is a heuristic, so the report shows the average gap).',
});

const ROOF = { demand: [900, 700, 800, 1200, 1500, 1100], days: [22, 18, 21, 21, 22, 20] };
const aggArgs = (v: Vals) => ({ demand: v.demand as number[], days: (v.demand as number[]).map((_, i) => (v.days?.[i] > 0 ? v.days[i] : 1)), hrs: v.hrs, wage: v.wage, hire: v.hire, fire: v.fire, hold: v.hold, back: v.back ?? 0, subCost: v.subCost, begInv: v.begInv ?? 0, round: v.roundRates !== 'no' });
export const aggregatePlanning: CalcDef = calc({
  id: 'aggregate-planning', name: 'Aggregate Planning: Chase vs Level vs Hybrid', short: 'Aggregate planning', cat: CAT,
  bq: 'Should I hire and lay off with demand, hold inventory, or subcontract?',
  blurb: 'Compares the cost of three classic production strategies over a planning horizon.',
  keywords: ['aggregate planning', 'chase strategy', 'level strategy', 'mixed strategy', 'hybrid strategy', 'sales and operations planning', 's&op', 'production plan', 'hire and fire', 'subcontracting'],
  symptoms: ['seasonal staffing', 'should i hire for peak season', 'build inventory ahead', 'production plan for the year', 'overtime or subcontract'],
  formula: () => `${tx('Cost')} = ${tx('Labor')} + ${tx('Inventory')} + ${tx('Hire/layoff')} + ${tx('Subcontract')}`,
  inputs: [series('demand', { label: 'Demand forecast by period', blabel: 'Expected demand each period', def: ROOF.demand, minRows: 2, cues: ['demand', 'forecast'] }), series('days', { label: 'Production days in each period (optional)', blabel: 'Working days each period (optional)', def: ROOF.days, minRows: 0, help: 'Leave empty to treat every period as one unit of time.', cues: ['production days', 'working days'] }),
    num('hrs', { label: 'Labor hours per unit', def: 1.6, min: 0, sens: true, cues: ['labor-hours', 'hours to produce', 'hours per unit'] }), money('wage', { label: 'Regular wage per hour', def: 10, sens: true, cues: ['per hour', 'wage', 'labor cost'] }),
    money('hire', { label: 'Cost to increase daily output by one unit (hiring)', blabel: 'Hiring and training cost per unit of added daily output', def: 300, sens: true, cues: ['hiring', 'increasing daily production', 'hire'] }), money('fire', { label: 'Cost to decrease daily output by one unit (layoffs)', blabel: 'Layoff cost per unit of reduced daily output', def: 600, sens: true, cues: ['layoff', 'decreasing daily production', 'firing'] }),
    money('hold', { label: 'Holding cost per unit per period', blabel: 'Cost to hold one unit for one period', def: 5, sens: true, cues: ['carrying cost', 'holding cost'] }), money('subCost', { label: 'Subcontracting cost per unit', blabel: 'Cost per unit bought from a subcontractor', def: 20, sens: true, cues: ['subcontract', 'subcontracting'] }),
    money('back', { label: 'Backorder cost per unit per period (0 = shortages not allowed)', blabel: 'Cost of making a customer wait, per unit per period (0 = never run short)', def: 0, adv: true, cues: ['backorder', 'stockout cost'], help: 'Leave at 0 and the level plan produces fast enough to never run short. Enter a cost and the level plan produces at the average rate and pays this for every unit owed at the end of a period.' }), num('begInv', { label: 'Beginning inventory', def: 0, min: 0, adv: true, cues: ['beginning inventory'] }),
    sel('roundRates', 'Daily production rates', [['yes', 'Rounded to whole units (textbook style)'], ['no', 'Exact']], 'yes', { adv: true })],
  outputs: [out('best', 'Lowest-cost plan cost', { fmt: 'money', primary: true }), out('level', 'Level production (hold inventory)', { fmt: 'money' }), out('chase', 'Chase demand (hire and lay off)', { fmt: 'money' }), out('hybrid', 'Hybrid (steady base + subcontract)', { fmt: 'money' }), out('bestIdx', 'Best plan (1 level, 2 chase, 3 hybrid)', { fmt: 'int' })],
  check: (v) => (v.days.length && v.days.length !== v.demand.length ? 'Enter the same number of production-day values as demand periods, or leave production days empty.' : (v.demand as number[]).some((x) => x < 0) ? 'Demand cannot be negative.' : null),
  compute: (v) => { const a = aggArgs(v); const L = aggLevel(a), C = aggChase(a), H = aggHybrid(a); const costs = [L.cost, C.cost, H.cost]; const bestIdx = costs.indexOf(Math.min(...costs)) + 1; return { level: L.cost, chase: C.cost, hybrid: H.cost, best: Math.min(...costs), bestIdx, levelHold: L.holding, levelBack: L.backorder, levelLabor: L.labor, chaseChange: C.change, chaseLabor: C.labor, hybridSub: H.sub, hybridLabor: H.labor, hybridHold: H.holding, levelInv: L.inv, levelProd: L.prod, hybridProd: H.prod, levelRate: L.rate ?? 0 }; },
  steps: (v, o, c) => { const a = aggArgs(v); return [
    (() => { const avg = (sum(a.demand) - a.begInv) / sum(a.days); const raised = o.levelRate > avg + 1e-9; const short = a.back > 0;
      return { title: short ? 'Level strategy: constant output at the average rate, with backorders' : raised ? 'Level strategy: constant output, fast enough to never run short' : 'Level strategy: constant output, inventory absorbs the swings',
        tex: raised ? `${tx('Rate')} = \\max_t ${fr(tx('Cumulative demand'), tx('Cumulative days'))} = ${c.f.t(o.levelRate, 2)} ${tx(' per day')}` : `${tx('Rate')} = ${fr(tx('Total demand'), tx('Total days'))} = ${fr(c.f.t(sum(a.demand) - a.begInv), c.f.t(sum(a.days)))} = ${c.f.t(o.levelRate, 2)} ${tx(' per day')}`,
        why: `${short ? 'Produce at the average rate every day. Units owed at the end of a period are charged the backorder cost.' : raised ? `The average rate (${c.f.num(avg, 2)} per day) would run out early because demand is front-loaded, and no backorder cost was given, so shortages are not allowed. The rate is raised to the lowest constant rate that covers cumulative demand in every period.` : 'Produce at the average rate every day. Inventory built in slow periods covers the busy ones.'} Labor ${c.f.money(o.levelLabor)} + holding ${c.f.money(o.levelHold)}${o.levelBack > 0 ? ` + backorders ${c.f.money(o.levelBack)}` : ''} = ${c.f.money(o.level)}.`,
        eli: 'Make the same amount every month and stockpile during slow months to cover busy ones.', table: { columns: ['Period', 'Demand', 'Production', 'Ending inventory'], rows: a.demand.map((d, t) => [t + 1, c.f.num(d), c.f.num(o.levelProd[t], 1), c.f.num(o.levelInv[t], 1)]) } }; })(),
    { title: 'Chase strategy: output follows demand', why: `Produce exactly what is needed each period, hiring and laying off as the daily rate changes. Labor ${c.f.money(o.chaseLabor)} + hiring and layoffs ${c.f.money(o.chaseChange)} = ${c.f.money(o.chase)}.`, eli: 'Staff up for the rush and down for the lull. No stockpile, but lots of hiring and letting go.' },
    { title: 'Hybrid strategy: steady base plus subcontracting', why: `Keep a constant workforce sized for the lowest-demand period and subcontract the rest. Labor ${c.f.money(o.hybridLabor)} + subcontracting ${c.f.money(o.hybridSub)}${o.hybridHold > 0 ? ` + holding ${c.f.money(o.hybridHold)}` : ''} = ${c.f.money(o.hybrid)}.`, eli: 'Keep a small permanent crew and call in outside help when it gets busy.' },
    { title: 'Compare', tex: `${tx('Level')} = ${c.f.money(o.level)}, \\quad ${tx('Chase')} = ${c.f.money(o.chase)}, \\quad ${tx('Hybrid')} = ${c.f.money(o.hybrid)}`, why: 'Pick the lowest total, then weigh the things cost does not capture: morale, quality, and supplier reliability.' },
  ]; },
  biz: (v, o, f) => { const names = ['Level production', 'Chasing demand', 'A steady base plus subcontracting']; return { headline: `${names[o.bestIdx - 1]} is the cheapest plan at ${f.money(o.best)}.`, meaning: [`Level: ${f.money(o.level)}. Chase: ${f.money(o.chase)}. Hybrid: ${f.money(o.hybrid)}.`, `The most expensive plan costs ${f.money(Math.max(o.level, o.chase, o.hybrid) - o.best)} more than the cheapest.`], actions: ['Check the cheapest plan against practical limits: storage space, hiring market, subcontractor capacity.', 'Stress-test with a 10% higher peak: plans that rely on inventory or subcontracting react differently.', 'Revisit monthly as part of sales and operations planning.'] }; },
  viz: (v, o) => ({ kind: 'stack', unit: '$', bars: [{ label: 'Level', best: o.bestIdx === 1, parts: [{ name: 'Labor', value: o.levelLabor, tone: 'alt' }, { name: 'Inventory', value: o.levelHold + o.levelBack, tone: 'warn' }] }, { label: 'Chase', best: o.bestIdx === 2, parts: [{ name: 'Labor', value: o.chaseLabor, tone: 'alt' }, { name: 'Hire / layoff', value: o.chaseChange, tone: 'bad' }] }, { label: 'Hybrid', best: o.bestIdx === 3, parts: [{ name: 'Labor', value: o.hybridLabor, tone: 'alt' }, { name: 'Subcontract', value: o.hybridSub, tone: 'accent' }, { name: 'Inventory', value: o.hybridHold, tone: 'warn' }] }] }),
  traps: ['Level plans charge holding on end-of-period inventory, summed over every period.', 'A level plan at the average rate can run short when demand is front-loaded. Either raise the rate so cumulative production always covers cumulative demand, or price the shortage with a backorder cost. Negative inventory is never free.', 'Chase plans charge hiring on increases and layoffs on decreases in the production rate, not on the level itself.', 'Subcontracting cost here is the full cost per subcontracted unit.'],
  analogy: 'A ski shop: keep the same staff year-round and stockpile tuned skis in summer, hire seasonal help each winter, or keep a small crew and send overflow to another shop.',
  convention: 'Level rate = total demand ÷ total production days. If that rate would run short in an early period and no backorder cost is given, the rate is raised to the lowest constant rate that never runs short (shortages are not allowed). Enter a backorder cost to allow shortages at the average rate instead. Hybrid base rate = the lowest period’s daily demand. Daily rates are rounded to whole units by default, as in textbook solutions.',
  examples: [
    { title: 'Roofing supplier', story: 'Six months of demand: 900, 700, 800, 1,200, 1,500, 1,100 with 22, 18, 21, 21, 22, 20 production days. 1.6 labor-hours per unit at $10 an hour. Holding $5 per unit per month, subcontracting $20 per unit, $300 to raise and $600 to lower daily output by one unit.', v: { demand: ROOF.demand, days: ROOF.days, hrs: 1.6, wage: 10, hire: 300, fire: 600, hold: 5, subCost: 20 }, expect: { level: 108450, chase: 117800, hybrid: 105152, bestIdx: 3 } },
    { title: 'Four quarters', story: 'Demand 100, 150, 200, 150. One labor hour per unit at $10. Hiring $5 and layoff $8 per unit of rate change, holding $2, subcontracting $15.', v: { demand: [100, 150, 200, 150], days: [], hrs: 1, wage: 10, hire: 5, fire: 8, hold: 2, subCost: 15 }, expect: { level: 6200, chase: 6900, hybrid: 7000, bestIdx: 1 } },
  ],
  practice: { ask: ['level', 'chase'], gen: (r) => ({ demand: Array.from({ length: 4 }, () => 100 + Math.floor(r() * 5) * 50), days: [], hrs: 1, wage: 10, hire: 5 + Math.floor(r() * 3) * 5, fire: 10, hold: 1 + Math.floor(r() * 3), subCost: 15, back: 0, begInv: 0, roundRates: 'no' }), prompt: (v, f) => `Quarterly demand is ${v.demand.join(', ')}. Each unit takes 1 labor hour at ${f.money(v.wage)} per hour. Raising output costs ${f.money(v.hire)} per unit and lowering it costs ${f.money(v.fire)} per unit. Holding cost is ${f.money(v.hold)} per unit per quarter. Find the total cost of a level plan with no shortages allowed, and of a chase plan (no cost for the first quarter's rate).` },
  gen: (r) => { const n = 3 + Math.floor(r() * 10); const withDays = r() < 0.5; return { demand: Array.from({ length: n }, () => 200 + Math.floor(r() * 2000)), days: withDays ? Array.from({ length: n }, () => 15 + Math.floor(r() * 10)) : [], hrs: +(0.5 + r() * 4).toFixed(1), wage: 8 + Math.floor(r() * 30), hire: Math.floor(r() * 500), fire: Math.floor(r() * 800), hold: +(0.5 + r() * 10).toFixed(1), subCost: 10 + Math.floor(r() * 150), back: Math.floor(r() * 20), begInv: r() < 0.5 ? 0 : Math.floor(r() * 150), roundRates: r() < 0.5 ? 'yes' : 'no' }; },
  uses: ['capacity-break-even'], claim: 'The chase and hybrid plans meet demand in every period, the level plan never runs short unless a backorder cost is given, and each cost equals an independent recomputation from the period-by-period inventory balance.',
});

export default [grossToNet, lotForLot, fixedOrderQty, poqLot, ppb, aggregatePlanning];
