// Inventory performance metrics.
import { calc, num, money, pct, sel, table, col, out, fr, tx } from '../dsl';
import type { CalcDef } from '../types';

const CAT = 'inv-perf';
const cogsIn = (def = 1200000) => money('cogs', { label: 'Cost of goods sold (annual)', blabel: 'Cost of goods sold per year', def, min: 0.0001, rand: [200000, 5000000, 50000], sens: true, cues: ['cost of goods sold', 'cogs', 'cost of sales'] });
const invIn = (def = 150000) => money('inv', { label: 'Average inventory (at cost)', blabel: 'Average inventory value', def, min: 0.0001, rand: [20000, 800000, 10000], sens: true, cues: ['average inventory', 'inventory investment', 'inventory value', 'average aggregate inventory'] });

export const turnover: CalcDef = calc({
  id: 'inventory-turnover', name: 'Inventory Turnover', short: 'Inventory turns', cat: CAT,
  bq: 'How fast is my inventory selling?',
  blurb: 'How many times per year inventory is sold and replaced: cost of goods sold divided by average inventory.',
  keywords: ['inventory turnover', 'inventory turns', 'stock turn', 'turnover ratio', 'turns'],
  symptoms: ['is my inventory moving fast enough', 'too much cash tied up in stock', 'slow moving inventory'],
  formula: () => `${tx('Turns')} = ${fr(tx('COGS'), tx('Average inventory'))}`,
  inputs: [cogsIn(), invIn()],
  outputs: [out('turns', 'Inventory turnover', { unit: 'turns/yr', primary: true }), out('days', 'Days of supply', { unit: 'days' }), out('weeks', 'Weeks of supply', { unit: 'weeks' })],
  compute: (v) => { const turns = v.cogs / v.inv; return { turns, days: 365 / turns, weeks: 52 / turns }; },
  steps: (v, o, c) => [
    { title: 'Divide cost of goods sold by average inventory', tex: `${tx('Turns')} = ${fr(tx('COGS'), tx('Avg inventory'))} = ${fr(c.f.t(v.cogs), c.f.t(v.inv))} = ${c.f.t(o.turns)}`, why: 'Both numbers are measured at cost, so the ratio counts how many times the average stock was sold through in the year.', eli: 'If you keep 10 bikes in the shop and sell 80 a year, your stock turned over 8 times.' },
    { title: 'Convert to days of supply', tex: `${fr(365, tx('Turns'))} = ${fr(365, c.f.t(o.turns))} = ${c.f.t(o.days)} ${tx(' days')}`, why: 'The inverse view: how long the average unit sits before it sells.' },
  ],
  biz: (v, o, f) => ({ headline: `Your inventory turns ${f.num(o.turns, 1)} times a year.`, meaning: [`On average, stock sits for ${f.int(o.days)} days before it sells.`, `You have ${f.money(v.inv)} tied up to support ${f.money(v.cogs)} of annual cost of sales.`, 'Grocery turns 12 to 20 times a year, general retail 4 to 8, industrial distribution 3 to 6.'], actions: ['Compare against your industry and your own trend, not a universal target.', 'Find the slowest 20% of SKUs with the ABC calculator and cut their order sizes.', 'One extra turn frees up cash equal to average inventory divided by current turns.'] }),
  viz: (v, o) => ({ kind: 'meters', items: [{ label: 'Turns per year', value: o.turns, max: Math.max(12, o.turns * 1.3), text: o.turns.toFixed(1), tone: 'accent' }, { label: 'Days of supply', value: o.days, max: Math.max(120, o.days * 1.3), text: `${o.days.toFixed(0)} days`, tone: 'alt' }] }),
  traps: ['Use cost of goods sold, not sales revenue. Revenue includes margin and overstates turns.', 'Use average inventory, not the year-end figure, when both are available.'],
  analogy: 'A restaurant table that seats four parties a night turns four times. More turns means the same asset earns more.',
  examples: [
    { title: 'Distributor', story: 'Annual cost of goods sold is $1,200,000 and average inventory is $150,000.', v: { cogs: 1200000, inv: 150000 }, expect: { turns: 8, days: 45.625 } },
    { title: 'Retailer', story: 'Cost of goods sold is $650,000 and average inventory is $100,000.', v: { cogs: 650000, inv: 100000 }, expect: { turns: 6.5, weeks: 8 } },
  ],
  practice: { ask: ['turns'], prompt: (v, f) => `A firm reports cost of goods sold of ${f.money(v.cogs)} and average inventory of ${f.money(v.inv)}. What is its inventory turnover?` },
  uses: ['average-inventory'], mono: [['cogs', 'turns', 1], ['inv', 'turns', -1]],
});

export const daysOfSupply: CalcDef = calc({
  id: 'days-of-supply', name: 'Days of Supply (DIO)', short: 'Days of supply', cat: CAT,
  bq: 'How many days will my current stock last?',
  blurb: 'Days of inventory on hand, either from financials (average inventory over daily cost of goods sold) or from units on hand over daily usage.',
  keywords: ['days of supply', 'dio', 'days inventory outstanding', 'days on hand', 'weeks of supply', 'days sales of inventory', 'inventory days'],
  symptoms: ['how long will my stock last', 'days of inventory', 'how many weeks of stock do i have'],
  formula: () => `${tx('DIO')} = ${fr(tx('Average inventory'), tx('COGS') + ' / 365')}`,
  inputs: [sel('basis', 'Measure using', [['value', 'Dollars (inventory and COGS)'], ['units', 'Units on hand and usage']], 'value'),
    { ...invIn(), show: (v) => v.basis !== 'units' }, { ...cogsIn(), show: (v) => v.basis !== 'units' },
    num('onHand', { label: 'Units on hand', blabel: 'Units in stock right now', unit: 'units', def: 600, min: 0, rand: [100, 5000, 50], show: (v) => v.basis === 'units', sens: true, cues: ['on hand', 'in stock'] }),
    num('usage', { label: 'Average daily usage', blabel: 'Units sold or used per day', unit: 'units', def: 40, min: 0.0001, rand: [5, 300, 5], show: (v) => v.basis === 'units', sens: true, cues: ['daily demand', 'daily usage', 'per day', 'sells'] })],
  outputs: [out('days', 'Days of supply', { unit: 'days', primary: true }), out('weeks', 'Weeks of supply', { unit: 'weeks' }), out('turns', 'Equivalent turns per year', {})],
  compute: (v) => { const days = v.basis === 'units' ? v.onHand / v.usage : v.inv / (v.cogs / 365); return { days, weeks: days / 7, turns: days > 0 ? 365 / days : Infinity }; },
  steps: (v, o, c) => v.basis === 'units' ? [
    { title: 'Divide units on hand by daily usage', tex: `${fr(tx('On hand'), tx('Daily usage'))} = ${fr(c.f.t(v.onHand), c.f.t(v.usage))} = ${c.f.t(o.days)} ${tx(' days')}`, why: 'At the current rate of use, this is how long the stock lasts.', eli: 'If the pantry holds 30 cans and you eat 2 a day, you have 15 days of food.' },
  ] : [
    { title: 'Daily cost of goods sold', tex: `${fr(tx('COGS'), 365)} = ${fr(c.f.t(v.cogs), 365)} = ${c.f.t(v.cogs / 365)}`, why: 'Spread annual cost of sales evenly over the year to get what a day of sales costs.' },
    { title: 'Days of inventory', tex: `${tx('DIO')} = ${fr(tx('Avg inventory'), tx('Daily COGS'))} = ${fr(c.f.t(v.inv), c.f.t(v.cogs / 365))} = ${c.f.t(o.days)} ${tx(' days')}`, why: 'Inventory value divided by the value sold per day. This is 365 divided by inventory turnover.', eli: 'How many days of sales are sitting on your shelves right now.' },
  ],
  biz: (v, o, f) => ({ headline: `You are holding about ${f.int(o.days)} days of supply.`, meaning: [`That is ${f.num(o.weeks, 1)} weeks, or ${f.num(o.turns, 1)} inventory turns a year.`, 'Every day of supply you remove frees up one day of cost of sales in cash.'], actions: ['Compare with your supplier lead time: days of supply well above lead time plus a buffer is excess.', 'Track this monthly. A rising trend is an early warning of overbuying or slowing sales.'] }),
  viz: (v, o) => ({ kind: 'timeline', unit: 'days', segs: [{ label: 'Stock lasts', start: 0, end: o.days, tone: 'accent', row: 0 }], marker: { x: 30, label: '30 days' } }),
  traps: ['Some books use 360 days. State which you use.', 'Use cost of goods sold with inventory at cost. Mixing in sales revenue understates the days.'],
  analogy: 'A phone battery readout that says "about 6 hours left" at current usage.',
  examples: [
    { title: 'From financials', story: 'Average inventory is $150,000 and annual cost of goods sold is $1,200,000.', v: { inv: 150000, cogs: 1200000 }, expect: { days: 45.625 } },
    { title: 'From units', story: 'There are 600 units on hand and the shop uses 40 a day.', v: { basis: 'units', onHand: 600, usage: 40 }, expect: { days: 15 } },
  ],
  practice: { ask: ['days'], prompt: (v, f) => `Average inventory is ${f.money(v.inv)} and annual cost of goods sold is ${f.money(v.cogs)}. How many days of supply does the firm hold (365-day year)?` },
  uses: ['inventory-turnover'], mono: [['inv', 'days', 1], ['cogs', 'days', -1]],
});

export const averageInventory: CalcDef = calc({
  id: 'average-inventory', name: 'Average Inventory', short: 'Average inventory', cat: CAT,
  bq: 'How much inventory do I carry on average?',
  blurb: 'Average inventory from beginning and ending balances, or from an order policy (half the order quantity plus safety stock).',
  keywords: ['average inventory', 'cycle stock', 'average aggregate inventory', 'Q/2', 'beginning and ending inventory'],
  symptoms: ['how much stock do i hold on average', 'average stock level'],
  formula: (s) => `\\bar{I} = ${fr(s.Q, 2)} + ${s.ss}`,
  inputs: [sel('method', 'Calculate from', [['policy', 'Order quantity and safety stock'], ['balances', 'Beginning and ending inventory']], 'policy'),
    num('Q', { sym: 'Q', label: 'Order quantity', blabel: 'Units per order', unit: 'units', def: 200, min: 0, rand: [50, 2000, 10], show: (v) => v.method !== 'balances', sens: true, cues: ['order quantity', 'lot size', 'orders of'] }),
    num('ss', { sym: 'ss', label: 'Safety stock', blabel: 'Buffer stock', unit: 'units', def: 30, min: 0, rand: [0, 300, 10], show: (v) => v.method !== 'balances', sens: true, cues: ['safety stock', 'buffer'] }),
    num('begin', { label: 'Beginning inventory', def: 80000, min: 0, rand: [10000, 500000, 5000], show: (v) => v.method === 'balances', cues: ['beginning inventory', 'opening inventory', 'start of'] }),
    num('end', { label: 'Ending inventory', def: 120000, min: 0, rand: [10000, 500000, 5000], show: (v) => v.method === 'balances', cues: ['ending inventory', 'closing inventory', 'end of'] }),
    money('unitCost', { sym: 'C', label: 'Unit cost (optional)', blabel: 'Cost per unit (optional)', def: 0, rand: [0, 80, 1], adv: true, show: (v) => v.method !== 'balances', cues: ['unit cost', 'cost per unit'] })],
  outputs: [out('avg', 'Average inventory', { primary: true }), out('value', 'Average inventory value', { fmt: 'money', show: (v) => v.method !== 'balances' && v.unitCost > 0 })],
  compute: (v) => { const avg = v.method === 'balances' ? (v.begin + v.end) / 2 : v.Q / 2 + v.ss; return { avg, value: avg * (v.unitCost ?? 0), cycle: v.Q / 2 }; },
  steps: (v, o, c) => v.method === 'balances' ? [
    { title: 'Average the two balances', tex: `\\bar{I} = ${fr(`${tx('Beginning')} + ${tx('Ending')}`, 2)} = ${fr(`${c.f.t(v.begin)} + ${c.f.t(v.end)}`, 2)} = ${c.f.t(o.avg)}`, why: 'With only two snapshots, the midpoint is the best estimate of the typical level.', eli: 'If the tank was a quarter full on Monday and three quarters full on Friday, call it half full on average.' },
  ] : [
    { title: 'Cycle stock', tex: `${fr(c.s.Q, 2)} = ${fr(c.f.t(v.Q), 2)} = ${c.f.t(o.cycle)}`, why: 'Stock falls steadily from Q to 0 between deliveries, so the average of that sawtooth is half of Q.', eli: 'A shelf that goes from full to empty again and again is half full on average.' },
    { title: 'Add safety stock', tex: `\\bar{I} = ${fr(c.s.Q, 2)} + ${c.s.ss} = ${c.f.t(o.cycle)} + ${c.f.t(v.ss)} = ${c.f.t(o.avg)}`, why: 'Safety stock sits underneath the sawtooth all the time, so all of it counts.' },
    ...(v.unitCost > 0 ? [{ title: 'Value at cost', tex: `${c.f.t(o.avg)} \\times ${c.f.t(v.unitCost)} = ${c.f.money(o.value, 2)}`, why: 'Multiply units by unit cost to see the cash tied up.' }] : []),
  ],
  biz: (v, o, f) => ({ headline: `You carry about ${f.int(o.avg)} ${v.method === 'balances' ? '' : 'units '}on average.`.replace('  ', ' '), meaning: v.method === 'balances' ? ['This is the midpoint of your opening and closing balances.'] : [`${f.int(o.cycle)} units are cycle stock (half an order) and ${f.int(v.ss)} are safety stock.`, ...(v.unitCost > 0 ? [`That is ${f.money(o.value)} of cash sitting on the shelf.`] : [])], actions: ['Smaller, more frequent orders cut cycle stock. Shorter or more reliable lead times cut safety stock.', 'Feed this number into the turnover and holding cost calculators.'] }),
  viz: (v, o) => v.method === 'balances'
    ? { kind: 'xy', x: { label: '', cats: ['Beginning', 'Average', 'Ending'] }, y: { label: 'Inventory', zero: true }, series: [{ name: 'Inventory', style: 'bars', tone: 'accent', pts: [[0, v.begin], [1, o.avg], [2, v.end]] }] }
    : { kind: 'xy', x: { label: 'Time' }, y: { label: 'Units on hand', zero: true }, series: [{ name: 'Inventory', style: 'area', tone: 'accent', pts: [[0, v.ss + v.Q], [1, v.ss], [1, v.ss + v.Q], [2, v.ss], [2, v.ss + v.Q], [3, v.ss]] }], hlines: [{ y: o.avg, label: 'Average', tone: 'accent' }, ...(v.ss > 0 ? [{ y: v.ss, label: 'Safety stock', tone: 'good' as const }] : [])] },
  traps: ['Average cycle stock is Q/2, not Q.', 'Safety stock is added in full, not halved.'],
  analogy: 'Your bank balance between paydays: it swings from high to low, but what matters for interest is the average.',
  examples: [
    { title: 'From an order policy', story: 'The order quantity is 200 units and safety stock is 30 units.', v: { Q: 200, ss: 30 }, expect: { avg: 130 } },
    { title: 'From balances', story: 'Inventory was $80,000 at the start of the year and $120,000 at the end.', v: { method: 'balances', begin: 80000, end: 120000 }, expect: { avg: 100000 } },
  ],
  practice: { ask: ['avg'], prompt: (v, f) => `A firm orders ${f.int(v.Q)} units at a time and keeps ${f.int(v.ss)} units of safety stock. What is its average inventory in units?` },
  uses: ['eoq', 'safety-stock-demand'], mono: [['Q', 'avg', 1], ['ss', 'avg', 1]],
});

export const holdingCost: CalcDef = calc({
  id: 'holding-cost', name: 'Holding (Carrying) Cost', short: 'Holding cost', cat: CAT,
  bq: 'What does it really cost me to hold inventory?',
  blurb: 'Builds the annual carrying cost rate from its components and converts it to dollars per unit and per year.',
  keywords: ['holding cost', 'carrying cost', 'carrying cost percentage', 'inventory carrying rate', 'cost of capital', 'H', 'storage cost'],
  symptoms: ['what does inventory cost me', 'cost of carrying stock', 'what holding cost should i use'],
  formula: (s) => `${s.H} = ${s.I} \\times ${s.C}`,
  inputs: [pct('capital', { label: 'Cost of capital', blabel: 'Interest or return you give up on cash tied in stock', def: 10, max: 1000, rand: [4, 15, 1], sens: true, cues: ['cost of capital', 'interest', 'opportunity cost'] }),
    pct('storage', { label: 'Storage and handling', blabel: 'Warehouse space and handling', def: 6, max: 1000, rand: [1, 8, 1], sens: true, cues: ['storage', 'warehousing', 'handling'] }),
    pct('insurance', { label: 'Insurance and taxes', def: 3, max: 1000, rand: [1, 4, 0.5], cues: ['insurance', 'taxes'] }),
    pct('risk', { label: 'Obsolescence, damage, shrinkage', blabel: 'Spoilage, damage, theft, going out of date', def: 5, max: 1000, rand: [1, 10, 1], sens: true, cues: ['obsolescence', 'shrinkage', 'spoilage', 'damage', 'pilferage'] }),
    money('C', { sym: 'C', label: 'Unit cost', blabel: 'What one unit costs you', def: 50, min: 0, rand: [5, 200, 5], sens: true, cues: ['unit cost', 'cost per unit', 'item cost'] }),
    num('avgInv', { label: 'Average inventory (units)', blabel: 'Average units in stock', unit: 'units', def: 400, min: 0, rand: [50, 2000, 50], sens: true, cues: ['average inventory'] })],
  outputs: [out('H', 'Holding cost per unit per year', { sym: 'H', fmt: 'money', dp: 2, primary: true }), out('rate', 'Carrying cost rate', { sym: 'I', fmt: 'pct' }), out('annual', 'Annual holding cost', { fmt: 'money' }), out('invValue', 'Average inventory value', { fmt: 'money' })],
  compute: (v) => { const rate = v.capital + v.storage + v.insurance + v.risk; const H = (rate / 100) * v.C; return { rate, H, invValue: v.avgInv * v.C, annual: v.avgInv * H }; },
  steps: (v, o, c) => [
    { title: 'Add the components of the carrying rate', tex: `${c.s.I} = ${c.f.t(v.capital)}\\% + ${c.f.t(v.storage)}\\% + ${c.f.t(v.insurance)}\\% + ${c.f.t(v.risk)}\\% = ${c.f.t(o.rate)}\\%`, why: 'Holding stock costs money in four ways: cash tied up, space and handling, insurance and taxes, and the risk the stock loses value.', eli: 'Owning a car is not just the price. It is also parking, insurance, and the fact that it loses value while it sits.' },
    { title: 'Holding cost per unit per year', tex: `${c.s.H} = ${c.s.I} \\times ${c.s.C} = ${c.f.t(o.rate / 100, 4)} \\times ${c.f.t(v.C)} = ${c.f.money(o.H, 2)}`, why: 'Apply the annual rate to what one unit cost you.' },
    { title: 'Annual holding cost', tex: `${tx('Average inventory')} \\times ${c.s.H} = ${c.f.t(v.avgInv)} \\times ${c.f.t(o.H)} = ${c.f.money(o.annual, 2)}`, why: 'Average units on hand times the yearly cost of holding each one.' },
  ],
  biz: (v, o, f) => ({ headline: `Holding one unit for a year costs you ${f.money(o.H, 2)} (${f.pct(o.rate, 0)} of its cost).`, meaning: [`With ${f.int(v.avgInv)} units on hand on average, that is ${f.money(o.annual)} a year.`, `Your ${f.money(o.invValue)} of inventory quietly costs ${f.pct(o.rate, 0)} a year to keep.`, 'Most businesses land between 20% and 30%. Perishable or fast-changing products run higher.'], actions: ['Use this H in the EOQ and safety stock calculators.', 'If the rate surprised you, review slow movers first: they carry the same cost per dollar but earn nothing.'] }),
  viz: (v, o) => ({ kind: 'stack', unit: '%', bars: [{ label: 'Carrying cost rate', parts: [{ name: 'Capital', value: v.capital, tone: 'accent' }, { name: 'Storage', value: v.storage, tone: 'alt' }, { name: 'Insurance & taxes', value: v.insurance, tone: 'alt2' }, { name: 'Risk', value: v.risk, tone: 'warn' }] }] }),
  traps: ['Apply the rate to unit cost (what you paid), not selling price.', 'A rate is annual unless stated. Match it to the time unit of demand.'],
  analogy: 'Rent, insurance, and depreciation on a storage unit full of stuff you have not sold yet.',
  examples: [
    { title: 'Building the rate', story: 'Capital 10%, storage 6%, insurance and taxes 3%, risk 5%. Unit cost $50, average inventory 400 units.', v: { capital: 10, storage: 6, insurance: 3, risk: 5, C: 50, avgInv: 400 }, expect: { rate: 24, H: 12, annual: 4800 } },
    { title: 'Low-cost item', story: 'Capital 8%, storage 4%, insurance 2%, risk 6%. Unit cost $12.50, average inventory 1,000 units.', v: { capital: 8, storage: 4, insurance: 2, risk: 6, C: 12.5, avgInv: 1000 }, expect: { rate: 20, H: 2.5, annual: 2500 } },
  ],
  practice: { ask: ['H'], prompt: (v, f) => `A firm estimates cost of capital at ${f.pct(v.capital)}, storage at ${f.pct(v.storage)}, insurance and taxes at ${f.pct(v.insurance)}, and obsolescence at ${f.pct(v.risk)} of inventory value per year. For an item costing ${f.money(v.C)}, what is the annual holding cost per unit?` },
  uses: [], mono: [['capital', 'H', 1], ['C', 'H', 1]],
});

const abcDefault = [
  { item: '#10286', units: 1000, cost: 90 }, { item: '#11526', units: 500, cost: 154 }, { item: '#12760', units: 1550, cost: 17 }, { item: '#10867', units: 350, cost: 42.86 }, { item: '#10500', units: 1000, cost: 12.5 },
  { item: '#12572', units: 600, cost: 14.17 }, { item: '#14075', units: 2000, cost: 0.6 }, { item: '#01036', units: 100, cost: 8.5 }, { item: '#01307', units: 1200, cost: 0.42 }, { item: '#10572', units: 250, cost: 0.6 },
];
export const abc: CalcDef = calc({
  id: 'abc-classification', name: 'ABC Classification', short: 'ABC analysis', cat: CAT,
  bq: 'Which products deserve most of my attention?',
  blurb: 'Ranks items by annual dollar volume and sorts them into A, B, and C classes so you can focus control where the money is.',
  keywords: ['abc analysis', 'abc classification', 'pareto', '80/20', 'annual dollar volume', 'inventory classification'],
  symptoms: ['too many skus to manage', 'which products matter most', 'where should i focus', 'prioritize inventory'],
  formula: () => `${tx('Annual dollar volume')} = ${tx('Annual units')} \\times ${tx('Unit cost')}`,
  inputs: [table('items', 'Items', [col('item', 'Item', 'text'), col('units', 'Annual units'), col('cost', 'Unit cost ($)')], abcDefault, { minRows: 2, help: 'Paste from a spreadsheet (item, annual units, unit cost) or upload a CSV.' }),
    pct('cutA', { label: 'A class covers the first', blabel: 'A items: top share of dollar volume', def: 80, min: 1, max: 99, adv: true, cues: [] }),
    pct('cutB', { label: 'A + B classes cover the first', blabel: 'A + B items: share of dollar volume', def: 95, min: 2, max: 100, adv: true, cues: [] })],
  outputs: [out('nA', 'A items', { primary: true, fmt: 'int' }), out('nB', 'B items', { fmt: 'int' }), out('nC', 'C items', { fmt: 'int' }), out('shareA', 'A share of dollar volume', { fmt: 'pct' }), out('shareB', 'B share of dollar volume', { fmt: 'pct' }), out('shareC', 'C share of dollar volume', { fmt: 'pct' }), out('total', 'Total annual dollar volume', { fmt: 'money' })],
  check: (v) => (v.cutB <= v.cutA ? 'The A + B cutoff must be larger than the A cutoff.' : (v.items as any[]).some((r) => r.units < 0 || r.cost < 0) ? 'Units and unit cost cannot be negative.' : (v.items as any[]).every((r) => r.units * r.cost === 0) ? 'Every item has zero dollar volume, so there is nothing to rank.' : null),
  compute: (v) => {
    const rows = (v.items as any[]).map((r, i) => ({ i, item: String(r.item ?? i + 1), vol: r.units * r.cost })).sort((a, b) => b.vol - a.vol || a.i - b.i);
    const total = rows.reduce((s, r) => s + r.vol, 0); let cum = 0;
    const cls: string[] = [], cumPct: number[] = [], vols: number[] = [], order: number[] = [];
    for (const r of rows) { const before = (cum / total) * 100; cum += r.vol; cls.push(before < v.cutA - 1e-9 ? 'A' : before < v.cutB - 1e-9 ? 'B' : 'C'); cumPct.push((cum / total) * 100); vols.push(r.vol); order.push(r.i); }
    const share = (k: string) => (rows.reduce((s, r, j) => s + (cls[j] === k ? r.vol : 0), 0) / total) * 100;
    return { total, nA: cls.filter((x) => x === 'A').length, nB: cls.filter((x) => x === 'B').length, nC: cls.filter((x) => x === 'C').length, shareA: share('A'), shareB: share('B'), shareC: share('C'), order, vols, cumPct, cls };
  },
  steps: (v, o, c) => [
    { title: 'Compute annual dollar volume for each item', tex: `${tx('Volume')} = ${tx('Annual units')} \\times ${tx('Unit cost')}`, why: 'Dollar volume, not unit count, shows where the money flows.', eli: 'A few expensive, fast-selling items usually matter far more than lots of cheap, slow ones.' },
    { title: 'Rank from largest to smallest and accumulate', why: `Items are class A until the running total reaches ${c.f.pct(v.cutA, 0)} of dollar volume, class B until it reaches ${c.f.pct(v.cutB, 0)}, and class C after that. The item that crosses a cutoff belongs to the higher class.`,
      table: { columns: ['Rank', 'Item', 'Annual $ volume', '% of total', 'Cumulative %', 'Class'], rows: o.order.map((idx: number, j: number) => [j + 1, String((v.items as any[])[idx].item ?? idx + 1), c.f.money(o.vols[j]), c.f.pct((o.vols[j] / o.total) * 100), c.f.pct(o.cumPct[j]), o.cls[j]]) } },
    { title: 'Summarize the classes', tex: `A: ${o.nA} ${tx(' items, ')} ${c.f.pct(o.shareA)} \\quad B: ${o.nB} ${tx(' items, ')} ${c.f.pct(o.shareB)} \\quad C: ${o.nC} ${tx(' items, ')} ${c.f.pct(o.shareC)}`, why: 'A items get tight control and frequent review, C items get simple rules and bulk orders.' },
  ],
  biz: (v, o, f) => ({ headline: `${f.int(o.nA)} of your ${f.int(o.order.length)} items drive ${f.pct(o.shareA, 0)} of your inventory dollars.`, meaning: [`A items: ${f.int(o.nA)} (${f.pct(o.shareA, 0)} of volume). B items: ${f.int(o.nB)} (${f.pct(o.shareB, 0)}). C items: ${f.int(o.nC)} (${f.pct(o.shareC, 0)}).`, `Total annual volume is ${f.money(o.total)}.`], actions: ['A items: forecast carefully, count often, negotiate hard with suppliers.', 'B items: standard reorder points, review monthly.', 'C items: order in bulk a few times a year and stop spending time on them.'] }),
  viz: (v, o) => ({ kind: 'xy', x: { label: 'Items ranked by dollar volume', cats: o.order.map((idx: number) => String((v.items as any[])[idx].item ?? idx + 1)) }, y: { label: 'Cumulative % of dollar volume', zero: true }, series: [{ name: '% of total', style: 'bars', tone: 'accent', pts: o.vols.map((x: number, j: number) => [j, (x / o.total) * 100] as [number, number]) }, { name: 'Cumulative %', style: 'line', tone: 'alt', pts: o.cumPct.map((x: number, j: number) => [j, x] as [number, number]) }], hlines: [{ y: v.cutA, label: `A cutoff ${v.cutA}%`, tone: 'muted' }, { y: v.cutB, label: `B cutoff ${v.cutB}%`, tone: 'muted' }] }),
  traps: ['Rank by annual dollar volume (units × cost), not by units or by unit cost alone.', 'Class boundaries are judgment calls. State the cutoffs you used.'],
  analogy: 'Packing for a move: you wrap the TV and laptop carefully and toss the socks in a bag.',
  convention: 'Default cutoffs: A covers the first 80% of dollar volume, B the next 15%, C the last 5%. The item that crosses a cutoff is placed in the higher class.',
  examples: [
    { title: 'Ten stock items', story: 'A chip maker lists ten items with annual volume and unit cost. Classes are cut at 70% and 95% of dollar volume.', v: { items: abcDefault, cutA: 70, cutB: 95 }, expect: { nA: 2, nB: 3, nC: 5, total: 232057 } },
    { title: 'Four-item shop', story: 'Items: P (100 units at $60), Q (50 at $20), R (400 at $2), S (30 at $5). Default 80/95 cutoffs.', v: { items: [{ item: 'P', units: 100, cost: 60 }, { item: 'Q', units: 50, cost: 20 }, { item: 'R', units: 400, cost: 2 }, { item: 'S', units: 30, cost: 5 }] }, expect: { total: 7950, nA: 2, nB: 1, nC: 1 } },
  ],
  practice: { ask: ['nA'], gen: (r) => ({ items: Array.from({ length: 6 }, (_, i) => ({ item: `Item ${i + 1}`, units: 50 + Math.floor(r() * 40) * 50, cost: +(1 + Math.pow(r(), 3) * 150).toFixed(2) })) }), prompt: (v, f) => `Classify these items with A covering the first 80% of annual dollar volume and B the next 15%: ${v.items.map((x: any) => `${x.item} (${f.int(x.units)} units at ${f.money(x.cost, 2)})`).join('; ')}. How many items are class A?` },
  gen: (r) => ({ items: Array.from({ length: 3 + Math.floor(r() * 12) }, (_, i) => ({ item: `SKU${i + 1}`, units: 1 + Math.floor(r() * 5000), cost: +(0.1 + Math.pow(r(), 3) * 500).toFixed(2) })), cutA: 60 + Math.floor(r() * 25), cutB: 90 + Math.floor(r() * 9) }),
  uses: [],
});

export const gmroi: CalcDef = calc({
  id: 'gmroi', name: 'GMROI (Gross Margin Return on Inventory)', short: 'GMROI', cat: CAT,
  bq: 'How much profit does each dollar of inventory earn?',
  blurb: 'Gross margin dollars earned per dollar invested in inventory.',
  keywords: ['gmroi', 'gross margin return on inventory', 'gmroii', 'return on inventory investment', 'margin return'],
  symptoms: ['is my inventory earning its keep', 'which products are worth stocking', 'return on inventory'],
  formula: () => `${tx('GMROI')} = ${fr(tx('Gross margin'), tx('Average inventory at cost'))}`,
  inputs: [money('sales', { label: 'Net sales', blabel: 'Sales revenue per year', def: 500000, min: 0.0001, rand: [100000, 5000000, 50000], sens: true, cues: ['sales', 'revenue', 'net sales'] }),
    money('cogs', { label: 'Cost of goods sold', blabel: 'Cost of goods sold per year', def: 300000, min: 0, rand: [50000, 90000, 5000], sens: true, cues: ['cost of goods sold', 'cogs'] }),
    money('inv', { label: 'Average inventory (at cost)', blabel: 'Average inventory value', def: 80000, min: 0.0001, rand: [10000, 80000, 5000], sens: true, cues: ['average inventory', 'inventory investment'] })],
  outputs: [out('gmroi', 'GMROI', { primary: true, dp: 2 }), out('gm', 'Gross margin', { fmt: 'money' }), out('gmPct', 'Gross margin %', { fmt: 'pct' }), out('turns', 'Inventory turnover', {})],
  compute: (v) => { const gm = v.sales - v.cogs; return { gm, gmPct: (gm / v.sales) * 100, gmroi: gm / v.inv, turns: v.cogs / v.inv }; },
  steps: (v, o, c) => [
    { title: 'Gross margin', tex: `${tx('Sales')} - ${tx('COGS')} = ${c.f.t(v.sales)} - ${c.f.t(v.cogs)} = ${c.f.money(o.gm)}`, why: 'Gross margin is what is left from sales after paying for the goods themselves.' },
    { title: 'Divide by average inventory at cost', tex: `${tx('GMROI')} = ${fr(c.f.t(o.gm), c.f.t(v.inv))} = ${c.f.t(o.gmroi, 2)}`, why: 'This is margin dollars earned for every dollar parked in inventory. It equals gross margin % divided by (1 − margin %) times turnover.', eli: 'If you keep $1 of stock on the shelf all year, how many dollars of profit does it bring back?' },
  ],
  biz: (v, o, f) => ({ headline: `Every $1 of inventory earns ${f.money(o.gmroi, 2)} of gross margin a year.`, meaning: [`Gross margin is ${f.money(o.gm)} (${f.pct(o.gmPct, 0)} of sales) on ${f.money(v.inv)} of average inventory.`, o.gmroi < 1 ? 'Below 1.0 means the inventory does not even earn back its own cost in margin each year.' : 'Above 1.0 means the inventory pays for itself in margin within the year.', `Inventory turns ${f.num(o.turns, 1)} times a year.`], actions: ['Compute this by category: low-margin items need fast turns to justify shelf space.', 'Raise GMROI by lifting margin, speeding turns, or cutting slow stock.'] }),
  viz: (v, o) => ({ kind: 'kpitree', root: { label: 'GMROI', value: o.gmroi.toFixed(2), op: '÷', tone: 'accent', children: [{ label: 'Gross margin', value: '$' + Math.round(o.gm).toLocaleString('en-US'), op: '−', children: [{ label: 'Sales', value: '$' + Math.round(v.sales).toLocaleString('en-US') }, { label: 'COGS', value: '$' + Math.round(v.cogs).toLocaleString('en-US') }] }, { label: 'Average inventory', value: '$' + Math.round(v.inv).toLocaleString('en-US') }] } }),
  traps: ['Inventory must be at cost, not retail value.', 'GMROI is a ratio of dollars, often quoted as a number (2.5) or as a percentage (250%).'],
  analogy: 'A vending machine: what matters is how much profit each dollar of snacks inside it produces per year.',
  examples: [
    { title: 'Specialty retailer', story: 'Sales $500,000, cost of goods sold $300,000, average inventory at cost $80,000.', v: { sales: 500000, cogs: 300000, inv: 80000 }, expect: { gm: 200000, gmroi: 2.5 } },
    { title: 'Hardware store', story: 'Sales $1,200,000, cost of goods sold $840,000, average inventory $150,000.', v: { sales: 1200000, cogs: 840000, inv: 150000 }, expect: { gmroi: 2.4, gmPct: 30, turns: 5.6 } },
  ],
  practice: { ask: ['gmroi'], prompt: (v, f) => `A store has net sales of ${f.money(v.sales)}, cost of goods sold of ${f.money(v.cogs)}, and average inventory at cost of ${f.money(v.inv)}. What is its GMROI?` },
  uses: ['inventory-turnover'], mono: [['sales', 'gmroi', 1], ['inv', 'gmroi', -1]],
});

export default [turnover, daysOfSupply, averageInventory, holdingCost, abc, gmroi];
