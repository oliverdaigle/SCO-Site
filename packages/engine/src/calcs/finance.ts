// Supply chain finance and performance metrics.
import { calc, num, money, pct, sel, series, out, fr, tx } from '../dsl';
import { mean, stdev } from '../math/util';
import type { CalcDef, InputDef } from '../types';

const CAT = 'finance';
const m = (id: string, label: string, def: number, o: Partial<InputDef> = {}) => money(id, { label, def, min: 0, sens: true, ...o });
const daysIn = () => num('daysInYear', { label: 'Days in the period', def: 365, min: 1, max: 366, adv: true, help: 'Use 365 for a full year (some texts use 360), or 90 for a quarter with quarterly revenue and costs.' });

export const cashToCash: CalcDef = calc({
  id: 'cash-to-cash', name: 'Cash-to-Cash Cycle', short: 'Cash-to-cash', cat: CAT,
  bq: 'How long is my cash tied up between paying suppliers and getting paid?',
  blurb: 'Days from paying for inventory to collecting from customers: days of inventory plus days of receivables minus days of payables.',
  keywords: ['cash-to-cash', 'cash conversion cycle', 'c2c', 'ccc', 'dio + dso - dpo', 'working capital cycle', 'cash cycle'],
  symptoms: ['cash is always tight', 'profitable but no cash', 'working capital', 'cash tied up'],
  formula: () => `C2C = DIO + DSO - DPO`,
  inputs: [sel('mode', 'Enter', [['fin', 'Balance sheet figures'], ['days', 'Days directly']], 'fin'),
    m('inv', 'Average inventory', 150000, { rand: [20000, 900000, 10000], show: (v) => v.mode !== 'days', cues: ['inventory'] }), m('ar', 'Accounts receivable', 200000, { rand: [20000, 900000, 10000], show: (v) => v.mode !== 'days', cues: ['accounts receivable', 'receivables'] }), m('ap', 'Accounts payable', 100000, { rand: [20000, 900000, 10000], show: (v) => v.mode !== 'days', cues: ['accounts payable', 'payables'] }),
    m('revenue', 'Annual revenue', 2000000, { min: 0.0001, rand: [1000000, 9000000, 100000], show: (v) => v.mode !== 'days', cues: ['revenue', 'sales'] }), m('cogs', 'Annual cost of goods sold', 1200000, { min: 0.0001, rand: [500000, 6000000, 100000], show: (v) => v.mode !== 'days', cues: ['cost of goods sold', 'cogs'] }),
    num('dio', { label: 'Days of inventory (DIO)', def: 60, min: 0, rand: [5, 120, 5], show: (v) => v.mode === 'days', sens: true, cues: ['days of inventory', 'dio', 'days of supply'] }), num('dso', { label: 'Days sales outstanding (DSO)', def: 45, min: 0, rand: [0, 90, 5], show: (v) => v.mode === 'days', sens: true, cues: ['days sales outstanding', 'dso', 'days of receivables'] }), num('dpo', { label: 'Days payable outstanding (DPO)', def: 30, min: 0, rand: [0, 90, 5], show: (v) => v.mode === 'days', sens: true, cues: ['days payable', 'dpo', 'days of payables'] }), daysIn()],
  outputs: [out('c2c', 'Cash-to-cash cycle', { unit: 'days', primary: true, dp: 1 }), out('DIO', 'Days of inventory', { unit: 'days', dp: 1 }), out('DSO', 'Days sales outstanding', { unit: 'days', dp: 1 }), out('DPO', 'Days payable outstanding', { unit: 'days', dp: 1 }), out('cashTied', 'Cash tied up in the cycle', { fmt: 'money', show: (v) => v.mode !== 'days' })],
  compute: (v) => { const d = v.daysInYear ?? 365; const DIO = v.mode === 'days' ? v.dio : v.inv / (v.cogs / d), DSO = v.mode === 'days' ? v.dso : v.ar / (v.revenue / d), DPO = v.mode === 'days' ? v.dpo : v.ap / (v.cogs / d); return { DIO, DSO, DPO, c2c: DIO + DSO - DPO, cashTied: v.mode === 'days' ? 0 : v.inv + v.ar - v.ap }; },
  steps: (v, o, c) => [
    ...(v.mode !== 'days' ? [
      { title: 'Days of inventory', tex: `DIO = ${fr(tx('Inventory'), tx('COGS') + ' / ' + v.daysInYear)} = ${fr(c.f.t(v.inv), c.f.t(v.cogs / v.daysInYear))} = ${c.f.t(o.DIO, 1)}`, why: 'How long goods sit before they sell.' },
      { title: 'Days sales outstanding', tex: `DSO = ${fr(tx('Receivables'), tx('Revenue') + ' / ' + v.daysInYear)} = ${fr(c.f.t(v.ar), c.f.t(v.revenue / v.daysInYear))} = ${c.f.t(o.DSO, 1)}`, why: 'How long customers take to pay after the sale.' },
      { title: 'Days payable outstanding', tex: `DPO = ${fr(tx('Payables'), tx('COGS') + ' / ' + v.daysInYear)} = ${fr(c.f.t(v.ap), c.f.t(v.cogs / v.daysInYear))} = ${c.f.t(o.DPO, 1)}`, why: 'How long you take to pay suppliers.' },
    ] : []),
    { title: 'Combine', tex: `C2C = DIO + DSO - DPO = ${c.f.t(o.DIO, 1)} + ${c.f.t(o.DSO, 1)} - ${c.f.t(o.DPO, 1)} = ${c.f.t(o.c2c, 1)} ${tx(' days')}`, why: 'Cash leaves when you pay suppliers and returns when customers pay. Inventory and receivables lengthen the gap, payables shorten it.', eli: 'You buy lemons on day 0, sell lemonade on day 10, and get paid on day 15. If the lemon seller lets you pay on day 5, your own money is out for 10 days.' },
  ],
  biz: (v, o, f) => ({ headline: o.c2c < 0 ? `Customers pay you ${f.num(-o.c2c, 0)} days before you pay suppliers. Your supply chain funds itself.` : `Your cash is tied up for ${f.num(o.c2c, 0)} days on every sale.`, meaning: [`Inventory sits ${f.num(o.DIO, 0)} days, customers take ${f.num(o.DSO, 0)} days to pay, and you pay suppliers in ${f.num(o.DPO, 0)} days.`, ...(v.mode !== 'days' ? [`That is about ${f.money(o.cashTied)} of working capital, and each day you cut frees roughly ${f.money(v.cogs / (v.daysInYear ?? 365))}.`] : [])], actions: [o.DIO >= o.DSO ? 'Inventory is the biggest lever: cut slow stock and order smaller, more often.' : 'Receivables are the biggest lever: invoice faster, offer early-payment terms, chase overdue accounts.', 'Negotiate longer supplier terms, but not so long that you strain key suppliers.'] }),
  viz: (v, o) => ({ kind: 'timeline', unit: 'days', segs: [{ label: `Inventory ${o.DIO.toFixed(0)}d`, start: 0, end: o.DIO, tone: 'alt', row: 0 }, { label: `Receivables ${o.DSO.toFixed(0)}d`, start: o.DIO, end: o.DIO + o.DSO, tone: 'alt2', row: 0 }, { label: `Payables ${o.DPO.toFixed(0)}d`, start: 0, end: o.DPO, tone: 'good', row: 1 }, { label: `Cash gap ${o.c2c.toFixed(0)}d`, start: Math.min(o.DPO, o.DIO + o.DSO), end: Math.max(o.DPO, o.DIO + o.DSO), tone: o.c2c < 0 ? 'good' : 'accent', row: 2 }] }),
  traps: ['DIO and DPO use cost of goods sold. DSO uses revenue.', 'Payables are subtracted, not added.', 'A negative cycle is possible and good: customers pay before suppliers are paid.'],
  analogy: 'A relay race for your cash: it leaves your hands when you pay suppliers and comes back when customers pay. This is the lap time.',
  convention: 'DPO is computed on cost of goods sold. Some texts use purchases instead; the difference is small when inventory is stable.',
  examples: [
    { title: 'From the balance sheet', story: 'Inventory $150,000, receivables $200,000, payables $100,000, revenue $2,000,000, cost of goods sold $1,200,000.', v: { inv: 150000, ar: 200000, ap: 100000, revenue: 2000000, cogs: 1200000 }, expect: { DIO: 45.625, DSO: 36.5, DPO: 30.417, c2c: 51.708 } },
    { title: 'Negative cycle', story: 'A direct-to-consumer brand holds 5 days of inventory, collects in 30 days, and pays suppliers in 60 days.', v: { mode: 'days', dio: 5, dso: 30, dpo: 60 }, expect: { c2c: -25 } },
  ],
  practice: { ask: ['c2c'], gen: (r) => ({ mode: 'days', dio: 10 + Math.floor(r() * 20) * 5, dso: 10 + Math.floor(r() * 12) * 5, dpo: 10 + Math.floor(r() * 12) * 5 }), prompt: (v) => `A company has ${v.dio} days of inventory, ${v.dso} days sales outstanding, and ${v.dpo} days payable outstanding. What is its cash-to-cash cycle in days?` },
  uses: ['days-of-supply', 'dso', 'dpo'], mono: [['inv', 'c2c', 1], ['ap', 'c2c', -1]],
});

export const dso: CalcDef = calc({
  id: 'dso', name: 'Days Sales Outstanding (DSO)', short: 'DSO', cat: CAT,
  bq: 'How long do customers take to pay me?',
  blurb: 'Average number of days it takes to collect payment after a sale.',
  keywords: ['dso', 'days sales outstanding', 'days receivable', 'collection period', 'accounts receivable days'],
  symptoms: ['customers pay late', 'slow collections', 'receivables too high'],
  formula: () => `DSO = ${fr(tx('Accounts receivable'), tx('Revenue') + ' / 365')}`,
  inputs: [m('ar', 'Accounts receivable', 200000, { rand: [20000, 900000, 10000], cues: ['accounts receivable', 'receivables'] }), m('revenue', 'Annual revenue (credit sales)', 2000000, { min: 0.0001, rand: [1000000, 9000000, 100000], cues: ['revenue', 'sales', 'credit sales'] }), daysIn()],
  outputs: [out('DSO', 'Days sales outstanding', { unit: 'days', primary: true, dp: 1 }), out('daily', 'Revenue per day', { fmt: 'money' }), out('turns', 'Receivables turnover', { dp: 2 })],
  compute: (v) => { const daily = v.revenue / (v.daysInYear ?? 365); return { daily, DSO: v.ar / daily, turns: v.revenue / v.ar }; },
  steps: (v, o, c) => [
    { title: 'Revenue per day', tex: `${fr(c.f.t(v.revenue), v.daysInYear)} = ${c.f.money(o.daily, 2)}`, why: 'Spread revenue evenly over the period.' },
    { title: 'Days of revenue sitting in receivables', tex: `DSO = ${fr(c.f.t(v.ar), c.f.t(o.daily))} = ${c.f.t(o.DSO, 1)} ${tx(' days')}`, why: 'Receivables divided by a day’s sales tells you how many days of sales are still unpaid.', eli: 'If friends owe you $60 and you lend out $10 a day, they are about 6 days behind on paying you back.' },
  ],
  biz: (v, o, f) => ({ headline: `Customers take about ${f.num(o.DSO, 0)} days to pay you.`, meaning: [`${f.money(v.ar)} is owed to you right now.`, `Every day you shave off frees ${f.money(o.daily)} in cash.`, 'Compare with your stated terms: a DSO well above them means late payers.'], actions: ['Invoice the day you ship, not at month-end.', 'Offer a small early-payment discount or card and ACH options.', 'Review the oldest 10 accounts weekly.'] }),
  viz: (v, o) => ({ kind: 'timeline', unit: 'days', segs: [{ label: 'Waiting to be paid', start: 0, end: o.DSO, tone: 'accent', row: 0 }], marker: { x: 30, label: 'Net 30' } }),
  traps: ['Use credit sales if cash sales are significant.', 'Match the period: quarterly revenue goes with about 90 days, not 365.'],
  analogy: 'How long the average IOU sits in your drawer before it is paid.',
  examples: [
    { title: 'Wholesaler', story: 'Receivables are $200,000 on annual revenue of $2,000,000.', v: { ar: 200000, revenue: 2000000 }, expect: { DSO: 36.5 } },
    { title: 'Manufacturer', story: 'Receivables are $450,000 on annual revenue of $3,650,000.', v: { ar: 450000, revenue: 3650000 }, expect: { DSO: 45, daily: 10000 } },
  ],
  practice: { ask: ['DSO'], prompt: (v, f) => `A firm has accounts receivable of ${f.money(v.ar)} and annual revenue of ${f.money(v.revenue)}. What is its days sales outstanding (365-day year)?` },
  uses: [], mono: [['ar', 'DSO', 1], ['revenue', 'DSO', -1]],
});

export const dpo: CalcDef = calc({
  id: 'dpo', name: 'Days Payable Outstanding (DPO)', short: 'DPO', cat: CAT,
  bq: 'How long do I take to pay my suppliers?',
  blurb: 'Average number of days you take to pay suppliers.',
  keywords: ['dpo', 'days payable outstanding', 'payables days', 'accounts payable days', 'payment period'],
  symptoms: ['paying suppliers too fast', 'supplier payment terms', 'payables'],
  formula: () => `DPO = ${fr(tx('Accounts payable'), tx('COGS') + ' / 365')}`,
  inputs: [m('ap', 'Accounts payable', 100000, { rand: [20000, 900000, 10000], cues: ['accounts payable', 'payables'] }), m('cogs', 'Annual cost of goods sold', 1200000, { min: 0.0001, rand: [500000, 6000000, 100000], cues: ['cost of goods sold', 'cogs', 'purchases'] }), daysIn()],
  outputs: [out('DPO', 'Days payable outstanding', { unit: 'days', primary: true, dp: 1 }), out('daily', 'Cost of goods sold per day', { fmt: 'money' }), out('turns', 'Payables turnover', { dp: 2 })],
  compute: (v) => { const daily = v.cogs / (v.daysInYear ?? 365); return { daily, DPO: v.ap / daily, turns: v.cogs / v.ap }; },
  steps: (v, o, c) => [
    { title: 'Cost of goods sold per day', tex: `${fr(c.f.t(v.cogs), v.daysInYear)} = ${c.f.money(o.daily, 2)}`, why: 'What a day of purchases costs, approximated by cost of goods sold.' },
    { title: 'Days of purchases still unpaid', tex: `DPO = ${fr(c.f.t(v.ap), c.f.t(o.daily))} = ${c.f.t(o.DPO, 1)} ${tx(' days')}`, why: 'Payables divided by a day’s cost tells you how many days of supply you have not yet paid for.', eli: 'If you owe the grocer $70 and buy $10 a day, you are paying about a week after you buy.' },
  ],
  biz: (v, o, f) => ({ headline: `You pay suppliers in about ${f.num(o.DPO, 0)} days.`, meaning: [`You owe suppliers ${f.money(v.ap)} right now.`, `Each extra day of terms keeps ${f.money(o.daily)} in your account.`, 'A longer DPO helps your cash, up to the point it hurts supplier relationships or loses early-pay discounts.'], actions: ['Pay on the due date, not before, unless a discount beats your cost of cash.', 'Ask key suppliers for terms that match how fast you collect.', 'Do not stretch small suppliers who depend on you.'] }),
  viz: (v, o) => ({ kind: 'timeline', unit: 'days', segs: [{ label: 'Supplier credit', start: 0, end: o.DPO, tone: 'good', row: 0 }], marker: { x: 30, label: 'Net 30' } }),
  traps: ['Use cost of goods sold (or purchases), not revenue.', 'Higher DPO shortens the cash-to-cash cycle because it is subtracted.'],
  analogy: 'How long the bills sit on your desk before you pay them.',
  examples: [
    { title: 'Distributor', story: 'Payables are $100,000 on cost of goods sold of $1,200,000.', v: { ap: 100000, cogs: 1200000 }, expect: { DPO: 30.417 } },
    { title: 'Retail chain', story: 'Payables are $300,000 on cost of goods sold of $2,190,000.', v: { ap: 300000, cogs: 2190000 }, expect: { DPO: 50, daily: 6000 } },
  ],
  practice: { ask: ['DPO'], prompt: (v, f) => `A firm has accounts payable of ${f.money(v.ap)} and annual cost of goods sold of ${f.money(v.cogs)}. What is its days payable outstanding (365-day year)?` },
  uses: [], mono: [['ap', 'DPO', 1], ['cogs', 'DPO', -1]],
});

export const dupont: CalcDef = calc({
  id: 'dupont-roa', name: 'Supply Chain DuPont Model (ROA)', short: 'DuPont ROA', cat: CAT,
  bq: 'How do my supply chain decisions move return on assets?',
  blurb: 'Breaks return on assets into profit margin and asset turnover so you can see how inventory, receivables, and costs drive it.',
  keywords: ['dupont', 'strategic profit model', 'return on assets', 'roa', 'asset turnover', 'profit margin', 'supply chain finance'],
  symptoms: ['how does inventory affect profit', 'return on assets', 'impact of reducing inventory', 'make the financial case'],
  formula: () => `ROA = ${fr(tx('Profit'), tx('Sales'))} \\times ${fr(tx('Sales'), tx('Total assets'))}`,
  inputs: [m('sales', 'Sales', 2000000, { min: 0.0001, rand: [1000000, 9000000, 100000], cues: ['sales', 'revenue'] }), m('cogs', 'Cost of goods sold', 1200000, { rand: [300000, 600000, 50000], cues: ['cost of goods sold', 'cogs'] }), m('opex', 'Operating expenses', 600000, { rand: [100000, 300000, 50000], cues: ['operating expenses', 'sg&a', 'overhead'] }),
    m('inv', 'Inventory', 300000, { rand: [50000, 900000, 50000], cues: ['inventory'] }), m('ar', 'Accounts receivable', 250000, { rand: [50000, 900000, 50000], cues: ['receivables'] }), m('otherCA', 'Cash and other current assets', 150000, { rand: [0, 500000, 50000], cues: ['cash', 'other current assets'] }), m('fixed', 'Fixed assets', 800000, { rand: [100000, 3000000, 100000], cues: ['fixed assets', 'plant', 'equipment'] })],
  outputs: [out('roa', 'Return on assets', { fmt: 'pct', primary: true, dp: 2 }), out('margin', 'Net profit margin', { fmt: 'pct', dp: 2 }), out('turnover', 'Asset turnover', { dp: 3 }), out('profit', 'Net profit', { fmt: 'money' }), out('assets', 'Total assets', { fmt: 'money' })],
  compute: (v) => { const profit = v.sales - v.cogs - v.opex, assets = v.inv + v.ar + v.otherCA + v.fixed; return { profit, assets, margin: (profit / v.sales) * 100, turnover: v.sales / assets, roa: (profit / assets) * 100 }; },
  check: (v) => (v.inv + v.ar + v.otherCA + v.fixed <= 0 ? 'Total assets must be greater than zero.' : null),
  steps: (v, o, c) => [
    { title: 'Net profit and margin', tex: `${tx('Profit')} = ${c.f.t(v.sales)} - ${c.f.t(v.cogs)} - ${c.f.t(v.opex)} = ${c.f.money(o.profit)}, \\quad ${tx('Margin')} = ${fr(c.f.t(o.profit), c.f.t(v.sales))} = ${c.f.pct(o.margin, 2)}`, why: 'The income-statement side: how much of each sales dollar is kept.' },
    { title: 'Total assets and asset turnover', tex: `${tx('Assets')} = ${c.f.t(v.inv)} + ${c.f.t(v.ar)} + ${c.f.t(v.otherCA)} + ${c.f.t(v.fixed)} = ${c.f.money(o.assets)}, \\quad ${tx('Turnover')} = ${fr(c.f.t(v.sales), c.f.t(o.assets))} = ${c.f.t(o.turnover, 3)}`, why: 'The balance-sheet side: how many sales dollars each dollar of assets generates.' },
    { title: 'Return on assets', tex: `ROA = ${c.f.t(o.margin / 100, 4)} \\times ${c.f.t(o.turnover, 3)} = ${c.f.pct(o.roa, 2)}`, why: 'Margin times turnover. Supply chain improvements can lift both: lower costs raise margin, lower inventory raises turnover.', eli: 'A food truck earns more by keeping more of each sale (margin) or by serving more customers with the same truck (turnover).' },
  ],
  biz: (v, o, f) => ({ headline: `Your return on assets is ${f.pct(o.roa, 1)}.`, meaning: [`You keep ${f.pct(o.margin, 1)} of each sales dollar and generate ${f.money(o.turnover, 2)} of sales per $1 of assets.`, `Inventory is ${f.pct((v.inv / o.assets) * 100, 0)} of your assets. Cutting it by 20% would lift ROA to ${f.pct((o.profit / (o.assets - 0.2 * v.inv)) * 100, 1)}.`, `A 2% cut in cost of goods sold would lift ROA to ${f.pct(((o.profit + 0.02 * v.cogs) / o.assets) * 100, 1)}.`], actions: ['Use the sliders to test inventory, receivables, and cost changes before pitching a project.', 'Frame supply chain proposals in ROA terms: it is the language finance speaks.'] }),
  viz: (v, o) => { const d = (x: number) => '$' + Math.round(x).toLocaleString('en-US'); return { kind: 'kpitree', root: { label: 'Return on assets', value: o.roa.toFixed(1) + '%', op: '×', tone: 'accent', children: [{ label: 'Net profit margin', value: o.margin.toFixed(1) + '%', op: '÷', children: [{ label: 'Net profit', value: d(o.profit), op: '−', children: [{ label: 'Sales', value: d(v.sales) }, { label: 'COGS', value: d(v.cogs) }, { label: 'Operating expenses', value: d(v.opex) }] }, { label: 'Sales', value: d(v.sales) }] }, { label: 'Asset turnover', value: o.turnover.toFixed(2), op: '÷', children: [{ label: 'Sales', value: d(v.sales) }, { label: 'Total assets', value: d(o.assets), op: '+', children: [{ label: 'Inventory', value: d(v.inv), tone: 'alt' }, { label: 'Receivables', value: d(v.ar) }, { label: 'Other current', value: d(v.otherCA) }, { label: 'Fixed assets', value: d(v.fixed) }] }] }] } }; },
  traps: ['ROA = margin × turnover. The sales terms cancel, so it also equals profit ÷ assets.', 'Inventory reductions raise turnover and, through lower carrying cost, margin too.'],
  analogy: 'A food truck: profit depends on how much you keep per meal and how many meals the truck serves.',
  examples: [
    { title: 'Mid-size distributor', story: 'Sales $2,000,000, cost of goods sold $1,200,000, operating expenses $600,000. Inventory $300,000, receivables $250,000, other current assets $150,000, fixed assets $800,000.', v: { sales: 2000000, cogs: 1200000, opex: 600000, inv: 300000, ar: 250000, otherCA: 150000, fixed: 800000 }, expect: { margin: 10, turnover: 1.333, roa: 13.33 } },
    { title: 'Larger firm', story: 'Sales $5,000,000, cost of goods sold $3,500,000, operating expenses $1,100,000. Inventory $500,000, receivables $600,000, other current $400,000, fixed assets $1,000,000.', v: { sales: 5000000, cogs: 3500000, opex: 1100000, inv: 500000, ar: 600000, otherCA: 400000, fixed: 1000000 }, expect: { margin: 8, turnover: 2, roa: 16 } },
  ],
  practice: { ask: ['roa'], prompt: (v, f) => `A firm has sales of ${f.money(v.sales)}, cost of goods sold of ${f.money(v.cogs)}, and operating expenses of ${f.money(v.opex)}. Its assets are inventory ${f.money(v.inv)}, receivables ${f.money(v.ar)}, other current assets ${f.money(v.otherCA)}, and fixed assets ${f.money(v.fixed)}. What is its return on assets (in %)?` },
  uses: ['inventory-turnover', 'gmroi'], mono: [['inv', 'roa', -1], ['cogs', 'roa', -1]],
});

export const perfectOrder: CalcDef = calc({
  id: 'perfect-order', name: 'Perfect Order Rate', short: 'Perfect order', cat: CAT,
  bq: 'How many of my orders go out with nothing wrong?',
  blurb: 'Share of orders that are on time, complete, damage-free, and correctly documented: the product of the four rates.',
  keywords: ['perfect order', 'perfect order rate', 'perfect order index', 'perfect order fulfillment', 'scor'],
  symptoms: ['order errors', 'customers complain about orders', 'order accuracy'],
  formula: () => `${tx('Perfect order')} = ${tx('On time')} \\times ${tx('Complete')} \\times ${tx('Damage-free')} \\times ${tx('Accurate documents')}`,
  inputs: [pct('onTime', { label: 'Delivered on time', def: 95, rand: [80, 100, 1], sens: true, cues: ['on time', 'on-time'] }), pct('complete', { label: 'Shipped complete', def: 97, rand: [80, 100, 1], sens: true, cues: ['complete', 'in full'] }), pct('damageFree', { label: 'Damage-free', def: 99, rand: [90, 100, 0.5], sens: true, cues: ['damage', 'undamaged'] }), pct('docs', { label: 'Accurate documentation and invoice', def: 98, rand: [85, 100, 1], sens: true, cues: ['documentation', 'invoice', 'paperwork'] })],
  outputs: [out('perfect', 'Perfect order rate', { fmt: 'pct', primary: true, dp: 2 }), out('imperfect', 'Orders with at least one problem', { fmt: 'pct', dp: 2 }), out('weakest', 'Weakest component', { fmt: 'pct' })],
  compute: (v) => { const p = (v.onTime / 100) * (v.complete / 100) * (v.damageFree / 100) * (v.docs / 100); return { perfect: p * 100, imperfect: (1 - p) * 100, weakest: Math.min(v.onTime, v.complete, v.damageFree, v.docs) }; },
  steps: (v, o, c) => [{ title: 'Multiply the four component rates', tex: `${c.f.t(v.onTime / 100, 4)} \\times ${c.f.t(v.complete / 100, 4)} \\times ${c.f.t(v.damageFree / 100, 4)} \\times ${c.f.t(v.docs / 100, 4)} = ${c.f.t(o.perfect / 100, 4)} = ${c.f.pct(o.perfect, 2)}`, why: 'An order is perfect only if every component is right. Assuming the failures are independent, the probabilities multiply, so the result is always lower than the weakest component.', eli: 'Four hurdles in a row: clearing each one 95% of the time means clearing all four only about 81% of the time.' }],
  biz: (v, o, f) => ({ headline: `Only ${f.pct(o.perfect, 1)} of your orders are perfect.`, meaning: [`About 1 order in ${f.num(100 / Math.max(o.imperfect, 1e-9), 0)} has something wrong with it.`, `Your weakest link is at ${f.pct(o.weakest, 0)}. Because the rates multiply, good-looking individual numbers hide a much lower overall result.`], actions: ['Fix the weakest component first: it caps the whole number.', 'Measure at the order level, not the line level, to see what the customer sees.', 'Best-in-class is above 90%.'] }),
  viz: (v, o) => ({ kind: 'meters', chain: 'On time × Complete × Damage-free × Documents = Perfect order', items: [{ label: 'On time', value: v.onTime, max: 100, text: v.onTime + '%', tone: 'alt' }, { label: 'Complete', value: v.complete, max: 100, text: v.complete + '%', tone: 'alt' }, { label: 'Damage-free', value: v.damageFree, max: 100, text: v.damageFree + '%', tone: 'alt' }, { label: 'Documents', value: v.docs, max: 100, text: v.docs + '%', tone: 'alt' }, { label: 'Perfect order', value: o.perfect, max: 100, text: o.perfect.toFixed(1) + '%', tone: 'accent' }] }),
  traps: ['Multiply the rates. Do not average them.', 'Convert percentages to decimals before multiplying.'],
  analogy: 'A four-course meal: one cold dish and the dinner is no longer perfect, however good the rest.',
  examples: [
    { title: 'Strong components', story: 'On time 95%, complete 97%, damage-free 99%, accurate documents 98%.', v: { onTime: 95, complete: 97, damageFree: 99, docs: 98 }, expect: { perfect: 89.4 } },
    { title: 'All at 90%', story: 'Each of the four components is 90%.', v: { onTime: 90, complete: 90, damageFree: 90, docs: 90 }, expect: { perfect: 65.61 } },
  ],
  practice: { ask: ['perfect'], prompt: (v) => `A distributor delivers ${v.onTime}% of orders on time, ships ${v.complete}% complete, ${v.damageFree}% damage-free, and ${v.docs}% with accurate documentation. What is the perfect order rate (in %)?` },
  uses: ['otif', 'order-fill-rate'], mono: [['onTime', 'perfect', 1], ['docs', 'perfect', 1]],
});

export const otif: CalcDef = calc({
  id: 'otif', name: 'OTIF (On Time In Full)', short: 'OTIF', cat: CAT,
  bq: 'What share of orders arrive on time and complete?',
  blurb: 'Share of orders delivered both on time and in full, with the on-time and in-full rates behind it.',
  keywords: ['otif', 'on time in full', 'on-time in-full', 'delivery performance', 'on time delivery', 'difot'],
  symptoms: ['late deliveries', 'retailer otif fines', 'short shipments', 'delivery performance'],
  formula: () => `OTIF = ${fr(tx('Orders on time and in full'), tx('Total orders'))}`,
  inputs: [num('total', { label: 'Total orders', def: 1000, min: 0.0001, rand: [1000, 5000, 100], cues: ['total orders', 'orders shipped', 'orders'] }), num('onTime', { label: 'Orders delivered on time', def: 920, min: 0, rand: [800, 990, 10], sens: true, cues: ['on time'] }), num('inFull', { label: 'Orders delivered in full', def: 950, min: 0, rand: [800, 990, 10], sens: true, cues: ['in full', 'complete'] }), num('both', { label: 'Orders both on time and in full', def: 890, min: 0, rand: [600, 790, 10], sens: true, cues: ['both', 'on time and in full'] })],
  outputs: [out('otif', 'OTIF', { fmt: 'pct', primary: true, dp: 2 }), out('otPct', 'On-time rate', { fmt: 'pct', dp: 2 }), out('ifPct', 'In-full rate', { fmt: 'pct', dp: 2 }), out('failed', 'Orders that failed OTIF', { fmt: 'int' })],
  check: (v) => (v.both > Math.min(v.onTime, v.inFull) ? 'Orders that are both on time and in full cannot exceed either the on-time or the in-full count.' : Math.max(v.onTime, v.inFull) > v.total ? 'A count cannot exceed total orders.' : v.onTime + v.inFull - v.both > v.total ? 'These counts are inconsistent: on time + in full − both is more than total orders.' : null),
  compute: (v) => ({ otif: (v.both / v.total) * 100, otPct: (v.onTime / v.total) * 100, ifPct: (v.inFull / v.total) * 100, failed: v.total - v.both }),
  steps: (v, o, c) => [
    { title: 'On-time and in-full rates', tex: `${fr(c.f.t(v.onTime), c.f.t(v.total))} = ${c.f.pct(o.otPct, 2)}, \\quad ${fr(c.f.t(v.inFull), c.f.t(v.total))} = ${c.f.pct(o.ifPct, 2)}`, why: 'Each component on its own.' },
    { title: 'OTIF', tex: `${fr(c.f.t(v.both), c.f.t(v.total))} = ${c.f.pct(o.otif, 2)}`, why: 'Count only orders that pass both tests. OTIF can never be higher than the lower of the two component rates.', eli: 'A pizza that is hot but missing a topping, or complete but an hour late, does not count.' },
  ],
  biz: (v, o, f) => ({ headline: `${f.pct(o.otif, 1)} of your orders arrive on time and in full.`, meaning: [`${f.int(o.failed)} of ${f.int(v.total)} orders missed on at least one count.`, `On time: ${f.pct(o.otPct, 1)}. In full: ${f.pct(o.ifPct, 1)}.`, 'Large retailers typically require 95 to 98% and fine suppliers who fall short.'], actions: [o.otPct < o.ifPct ? 'Lateness is the bigger problem: look at carrier performance and order cut-off times.' : 'Short shipments are the bigger problem: look at stock availability and picking accuracy.', 'Agree the definition of "on time" (delivery window) with each customer.'] }),
  viz: (v, o) => ({ kind: 'meters', items: [{ label: 'On time', value: o.otPct, max: 100, text: o.otPct.toFixed(1) + '%', tone: 'alt' }, { label: 'In full', value: o.ifPct, max: 100, text: o.ifPct.toFixed(1) + '%', tone: 'alt2' }, { label: 'OTIF', value: o.otif, max: 100, text: o.otif.toFixed(1) + '%', tone: 'accent' }] }),
  traps: ['OTIF is not on-time % times in-full %, unless the two are independent. Count the orders that meet both.', 'Measure per order (or per line), consistently.'],
  analogy: 'A pizza delivery scored on two things at once: hot and on time, and with every topping you ordered.',
  examples: [
    { title: 'Monthly shipments', story: 'Of 1,000 orders, 920 were on time, 950 were in full, and 890 were both.', v: { total: 1000, onTime: 920, inFull: 950, both: 890 }, expect: { otif: 89, otPct: 92, ifPct: 95 } },
    { title: 'Smaller account', story: 'Of 480 orders, 450 were on time, 432 in full, and 420 both.', v: { total: 480, onTime: 450, inFull: 432, both: 420 }, expect: { otif: 87.5, otPct: 93.75, ifPct: 90 } },
  ],
  practice: { ask: ['otif'], prompt: (v, f) => `Out of ${f.int(v.total)} orders, ${f.int(v.onTime)} were on time, ${f.int(v.inFull)} were in full, and ${f.int(v.both)} were both on time and in full. What is the OTIF rate (in %)?` },
  uses: [], mono: [['both', 'otif', 1], ['total', 'otif', -1]],
});

export const orderFillRate: CalcDef = calc({
  id: 'order-fill-rate', name: 'Order, Line, and Unit Fill Rate', short: 'Order fill rate', cat: CAT,
  bq: 'How completely am I filling customer orders?',
  blurb: 'Fill rate measured three ways: complete orders, order lines, and units.',
  keywords: ['order fill rate', 'line fill rate', 'unit fill rate', 'case fill rate', 'fill rate', 'order completeness'],
  symptoms: ['incomplete orders', 'short ships', 'backorders', 'fill rate'],
  formula: () => `${tx('Fill rate')} = ${fr(tx('Filled'), tx('Ordered'))}`,
  inputs: [num('orders', { label: 'Orders received', def: 500, min: 0.0001, rand: [200, 2000, 50], cues: ['orders received', 'orders'] }), num('ordersFilled', { label: 'Orders shipped complete', def: 440, min: 0, rand: [100, 190, 10], sens: true, cues: ['shipped complete', 'filled completely'] }),
    num('lines', { label: 'Order lines', def: 2000, min: 0.0001, rand: [2000, 9000, 100], cues: ['lines', 'line items'] }), num('linesFilled', { label: 'Lines filled complete', def: 1880, min: 0, rand: [1000, 1900, 50], sens: true, cues: ['lines filled'] }),
    num('units', { label: 'Units ordered', def: 10000, min: 0.0001, rand: [10000, 90000, 1000], cues: ['units ordered', 'cases ordered'] }), num('unitsFilled', { label: 'Units shipped', def: 9700, min: 0, rand: [5000, 9900, 100], sens: true, cues: ['units shipped', 'cases shipped'] })],
  outputs: [out('orderFill', 'Order fill rate', { fmt: 'pct', primary: true, dp: 2 }), out('lineFill', 'Line fill rate', { fmt: 'pct', dp: 2 }), out('unitFill', 'Unit fill rate', { fmt: 'pct', dp: 2 })],
  check: (v) => (v.ordersFilled > v.orders || v.linesFilled > v.lines || v.unitsFilled > v.units ? 'Filled quantities cannot exceed what was ordered.' : null),
  compute: (v) => ({ orderFill: (v.ordersFilled / v.orders) * 100, lineFill: (v.linesFilled / v.lines) * 100, unitFill: (v.unitsFilled / v.units) * 100 }),
  steps: (v, o, c) => [
    { title: 'Unit fill rate', tex: `${fr(c.f.t(v.unitsFilled), c.f.t(v.units))} = ${c.f.pct(o.unitFill, 2)}`, why: 'Share of units shipped. The most forgiving measure.' },
    { title: 'Line fill rate', tex: `${fr(c.f.t(v.linesFilled), c.f.t(v.lines))} = ${c.f.pct(o.lineFill, 2)}`, why: 'Share of order lines shipped in full. One short unit fails the whole line.' },
    { title: 'Order fill rate', tex: `${fr(c.f.t(v.ordersFilled), c.f.t(v.orders))} = ${c.f.pct(o.orderFill, 2)}`, why: 'Share of orders shipped with every line complete. The strictest measure and the one customers feel.', eli: 'If one item is missing from your grocery delivery, the store filled most units but did not fill your order.' },
  ],
  biz: (v, o, f) => ({ headline: `${f.pct(o.orderFill, 0)} of orders ship complete, though you ship ${f.pct(o.unitFill, 0)} of the units.`, meaning: [`Line fill is ${f.pct(o.lineFill, 0)}.`, 'The gap between unit fill and order fill shows how a few missing items spoil many orders.'], actions: ['Find the SKUs that most often cause incomplete orders and raise their safety stock.', 'Report order fill to customers and unit fill internally: they answer different questions.'] }),
  viz: (v, o) => ({ kind: 'meters', items: [{ label: 'Unit fill', value: o.unitFill, max: 100, text: o.unitFill.toFixed(1) + '%', tone: 'alt' }, { label: 'Line fill', value: o.lineFill, max: 100, text: o.lineFill.toFixed(1) + '%', tone: 'alt2' }, { label: 'Order fill', value: o.orderFill, max: 100, text: o.orderFill.toFixed(1) + '%', tone: 'accent' }] }),
  traps: ['Order fill ≤ line fill ≤ unit fill in almost every real data set. If yours is reversed, check the counts.', 'State which fill rate you mean.'],
  analogy: 'A grocery delivery with 49 of 50 items: 98% unit fill, but the order was not filled.',
  examples: [
    { title: 'Weekly performance', story: '500 orders (440 complete), 2,000 lines (1,880 filled), 10,000 units ordered (9,700 shipped).', v: { orders: 500, ordersFilled: 440, lines: 2000, linesFilled: 1880, units: 10000, unitsFilled: 9700 }, expect: { orderFill: 88, lineFill: 94, unitFill: 97 } },
    { title: 'Smaller warehouse', story: '250 orders (200 complete), 1,200 lines (1,100 filled), 6,000 units (5,850 shipped).', v: { orders: 250, ordersFilled: 200, lines: 1200, linesFilled: 1100, units: 6000, unitsFilled: 5850 }, expect: { orderFill: 80, lineFill: 91.67, unitFill: 97.5 } },
  ],
  practice: { ask: ['orderFill', 'unitFill'], prompt: (v, f) => `A warehouse received ${f.int(v.orders)} orders and shipped ${f.int(v.ordersFilled)} of them complete. Those orders covered ${f.int(v.units)} units, of which ${f.int(v.unitsFilled)} shipped. Find the order fill rate and the unit fill rate (in %).` },
  uses: ['fill-rate'], mono: [['ordersFilled', 'orderFill', 1]],
});

export const bullwhip: CalcDef = calc({
  id: 'bullwhip-ratio', name: 'Bullwhip Ratio', short: 'Bullwhip ratio', cat: CAT,
  bq: 'Am I amplifying demand swings when I order from suppliers?',
  blurb: 'Variance of orders placed upstream divided by variance of demand received. Above 1 means variability is being amplified.',
  keywords: ['bullwhip', 'bullwhip effect', 'bullwhip ratio', 'demand amplification', 'order variance', 'variance ratio', 'forrester effect'],
  symptoms: ['orders swing more than sales', 'supplier complains about erratic orders', 'feast or famine ordering', 'demand amplification'],
  formula: () => `${tx('Bullwhip')} = ${fr('\\sigma^2_{orders}', '\\sigma^2_{demand}')}`,
  inputs: [series('demand', { label: 'Demand received each period', blabel: 'Customer demand each period', def: [100, 110, 90, 105, 95], minRows: 2, cues: ['demand', 'sales'] }), series('orders', { label: 'Orders placed each period', blabel: 'What you ordered from suppliers each period', def: [100, 130, 70, 115, 85], minRows: 2, cues: ['orders', 'orders placed'] })],
  outputs: [out('ratio', 'Bullwhip ratio (variance)', { primary: true, dp: 3 }), out('sdRatio', 'Ratio of standard deviations', { dp: 3 }), out('varD', 'Variance of demand', { dp: 2 }), out('varO', 'Variance of orders', { dp: 2 }), out('cvD', 'CV of demand', { dp: 3 }), out('cvO', 'CV of orders', { dp: 3 })],
  check: (v) => (stdev(v.demand) === 0 ? 'Demand does not vary at all, so the ratio cannot be computed (it would divide by zero). Any variation in orders is pure amplification.' : null),
  compute: (v) => { const sd = stdev(v.demand), so = stdev(v.orders); return { varD: sd * sd, varO: so * so, ratio: (so * so) / (sd * sd), sdRatio: so / sd, cvD: sd / mean(v.demand), cvO: so / mean(v.orders) }; },
  steps: (v, o, c) => [
    { title: 'Variance of demand', tex: `\\sigma^2_{demand} = ${fr('\\sum (D_t - \\bar{D})^2', 'n - 1')} = ${c.f.t(o.varD, 2)}`, why: 'Sample variance of what customers actually bought.' },
    { title: 'Variance of orders', tex: `\\sigma^2_{orders} = ${fr('\\sum (O_t - \\bar{O})^2', 'n - 1')} = ${c.f.t(o.varO, 2)}`, why: 'Sample variance of what was ordered upstream.' },
    { title: 'Bullwhip ratio', tex: `${fr(c.f.t(o.varO, 2), c.f.t(o.varD, 2))} = ${c.f.t(o.ratio, 3)}`, why: 'A ratio above 1 means orders swing more than demand: the bullwhip effect. Below 1 means orders are smoother than demand.', eli: 'A small flick of the wrist becomes a big crack at the end of a whip. Small changes in sales become big swings in orders.' },
  ],
  biz: (v, o, f) => ({ headline: o.ratio > 1.05 ? `Your orders swing ${f.num(o.sdRatio, 1)} times as much as your sales.` : o.ratio < 0.95 ? 'Your orders are smoother than your sales. You are damping variability, not amplifying it.' : 'Your orders track sales closely, with no amplification.', meaning: [`Bullwhip ratio (variance): ${f.num(o.ratio, 2)}.`, o.ratio > 1.05 ? 'Your suppliers see far more volatility than your customers create, which raises their costs and, eventually, your prices and lead times.' : 'This is what suppliers want to see.'], actions: ['Order smaller amounts more often instead of large, irregular batches.', 'Share actual sales data with suppliers so they are not guessing from your orders.', 'Avoid over-reacting to a single strong or weak period.'] }),
  viz: (v) => ({ kind: 'xy', x: { label: 'Period' }, y: { label: 'Units' }, series: [{ name: 'Demand', style: 'line', tone: 'muted', pts: (v.demand as number[]).map((y, i) => [i + 1, y] as [number, number]) }, { name: 'Orders', style: 'line', tone: 'accent', pts: (v.orders as number[]).map((y, i) => [i + 1, y] as [number, number]) }] }),
  traps: ['Use variances (or state clearly if you use standard deviations): the variance ratio is the square of the standard deviation ratio.', 'Use the same periods for demand and orders.'],
  analogy: 'A whip: a small motion at the handle becomes a large one at the tip.',
  convention: 'Ratio of sample variances (n − 1). Some sources report the ratio of standard deviations or of coefficients of variation; both are shown.',
  examples: [
    { title: 'Retailer and its supplier', story: 'Customer demand was 100, 110, 90, 105, 95. Orders to the supplier were 100, 130, 70, 115, 85.', v: { demand: [100, 110, 90, 105, 95], orders: [100, 130, 70, 115, 85] }, expect: { varD: 62.5, varO: 562.5, ratio: 9, sdRatio: 3 } },
    { title: 'Milder amplification', story: 'Demand 50, 52, 48, 51, 49. Orders 50, 54, 46, 52, 48.', v: { demand: [50, 52, 48, 51, 49], orders: [50, 54, 46, 52, 48] }, expect: { varD: 2.5, varO: 10, ratio: 4, sdRatio: 2 } },
  ],
  practice: { ask: ['ratio'], gen: (r) => { const b = 50 + Math.floor(r() * 10) * 10; const d = [0, 1, -1, 2, -2].map((k) => b + k * 5); const mlt = 2 + Math.floor(r() * 2); return { demand: d, orders: d.map((x) => b + (x - b) * mlt) }; }, prompt: (v) => `Demand over five periods was ${v.demand.join(', ')} and orders placed were ${v.orders.join(', ')}. What is the bullwhip ratio (variance of orders divided by variance of demand)?` },
  gen: (r) => { const n = 3 + Math.floor(r() * 20); const b = 50 + r() * 500; const demand = Array.from({ length: n }, () => Math.round(b + (r() - 0.5) * b * 0.4)); if (new Set(demand).size < 2) demand[0] += 7; return { demand, orders: Array.from({ length: n }, (_, i) => Math.max(0, Math.round(b + (demand[i] - b) * (0.5 + r() * 3) + (r() - 0.5) * 20))) }; },
  uses: [],
});

export default [cashToCash, dso, dpo, dupont, perfectOrder, otif, orderFillRate, bullwhip];
