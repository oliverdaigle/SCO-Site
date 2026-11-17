// Process analysis and capacity.
import { calc, num, money, pct, int, sel, table, col, out, fr, tx, pts } from '../dsl';
import { sum, type Rng } from '../math/util';
import type { CalcDef, Vals } from '../types';

const CAT = 'process';
const stepsTable = (def: any[]) => table('steps', 'Process steps', [col('name', 'Step', 'text'), col('time', 'Time per unit (min)'), col('n', 'Workers or machines')], def, { minRows: 1, help: 'One row per step, in order. Time is how long one worker or machine takes for one unit.' });
const stepCaps = (v: Vals) => (v.steps as any[]).map((s) => (s.n * 60) / s.time);
const stepsCheck = (v: Vals) => ((v.steps as any[]).some((s) => !(s.time > 0) || !(s.n > 0)) ? 'Every step needs a time greater than zero and at least one worker or machine.' : null);
const genSteps = (r: Rng) => Array.from({ length: 2 + Math.floor(r() * 5) }, (_, i) => ({ name: `Step ${i + 1}`, time: +(1 + r() * 14).toFixed(1), n: 1 + Math.floor(r() * 3) }));
const DEF_STEPS = [{ name: 'Prep', time: 4, n: 1 }, { name: 'Assemble', time: 10, n: 2 }, { name: 'Pack', time: 3, n: 1 }];

export const littlesLaw: CalcDef = calc({
  id: 'littles-law', name: "Little's Law", short: "Little's Law", cat: CAT,
  bq: 'How long does work sit in my process?',
  blurb: 'Links average inventory, throughput rate, and flow time: I = R × T. Enter any two to get the third.',
  keywords: ["little's law", 'littles law', 'wip', 'flow time', 'throughput', 'I = R T', 'WIP = TH x CT', 'L = lambda W'],
  symptoms: ['how long do orders take', 'too much work in progress', 'how long do customers spend', 'lead time is too long'],
  formula: (s) => `${s.WIP} = ${s.TH} \\times ${s.FT}`,
  inputs: [sel('solve', 'Solve for', [['I', 'Inventory (WIP)'], ['T', 'Flow time'], ['R', 'Throughput rate']], 'I'),
    num('R', { sym: 'TH', label: 'Throughput rate (units per period)', blabel: 'Units completed per period', def: 50, min: 0.0001, rand: [5, 200, 5], show: (v) => v.solve !== 'R', sens: true, cues: ['throughput', 'flow rate', 'arrive', 'per hour', 'per day', 'customers per', 'processes'] }),
    num('T', { sym: 'FT', label: 'Flow time (periods)', blabel: 'Time a unit spends in the process', def: 0.2, min: 0.0001, rand: [0.5, 12, 0.5], show: (v) => v.solve !== 'T', sens: true, cues: ['flow time', 'cycle time', 'spends', 'takes', 'throughput time', 'lead time'] }),
    num('I', { sym: 'WIP', label: 'Average inventory in the process (units)', blabel: 'Average units in the process', def: 10, min: 0, rand: [5, 500, 5], show: (v) => v.solve !== 'I', sens: true, cues: ['inventory', 'wip', 'work in process', 'in the system', 'in line', 'on average there are'] })],
  outputs: [out('I', 'Average inventory (WIP)', { sym: 'WIP', unit: 'units', primary: true, show: (v) => v.solve === 'I' }), out('T', 'Flow time', { sym: 'FT', unit: 'periods', primary: true, show: (v) => v.solve === 'T' }), out('R', 'Throughput rate', { sym: 'TH', unit: 'per period', primary: true, show: (v) => v.solve === 'R' }), out('turns', 'Inventory turns per period', {})],
  compute: (v) => { const I = v.solve === 'I' ? v.R * v.T : v.I, T = v.solve === 'T' ? v.I / v.R : v.T, R = v.solve === 'R' ? v.I / v.T : v.R; return { I, T, R, turns: 1 / T }; },
  steps: (v, o, c) => [
    v.solve === 'I' ? { title: 'Multiply throughput by flow time', tex: `${c.s.WIP} = ${c.s.TH} \\times ${c.s.FT} = ${c.f.t(v.R)} \\times ${c.f.t(v.T)} = ${c.f.t(o.I)}`, why: 'On average, the number of units inside a stable process equals the rate they flow through times how long each one stays.', eli: 'If 10 people enter a shop each hour and each stays half an hour, there are 5 people inside on average.' }
    : v.solve === 'T' ? { title: 'Divide inventory by throughput', tex: `${c.s.FT} = ${fr(c.s.WIP, c.s.TH)} = ${fr(c.f.t(v.I), c.f.t(v.R))} = ${c.f.t(o.T)}`, why: 'Rearranged Little’s Law: time in the process equals units in the process divided by the rate they leave.', eli: 'If 20 orders are open and you finish 5 a day, a new order waits about 4 days.' }
    : { title: 'Divide inventory by flow time', tex: `${c.s.TH} = ${fr(c.s.WIP, c.s.FT)} = ${fr(c.f.t(v.I), c.f.t(v.T))} = ${c.f.t(o.R)}`, why: 'Rearranged Little’s Law: flow rate equals inventory divided by time in the process.' },
    { title: 'Check the units', why: 'Flow time must use the same time unit as the throughput rate (hours with per hour, days with per day). The law holds for averages in a stable system, whatever the arrival pattern.' },
  ],
  biz: (v, o, f) => ({ headline: v.solve === 'I' ? `About ${f.num(o.I, 1)} units are in your process at any moment.` : v.solve === 'T' ? `A unit takes about ${f.num(o.T, 2)} periods to get through your process.` : `Your process completes about ${f.num(o.R, 1)} units per period.`, meaning: [`Throughput ${f.num(o.R, 1)} per period × flow time ${f.num(o.T, 2)} periods = ${f.num(o.I, 1)} units in process.`, 'To cut flow time without adding capacity, cut the work in process: the two move together.'], actions: ['Cap work in process (a simple kanban limit) to make lead times shorter and more predictable.', 'Quote customers a lead time of WIP divided by daily output.'] }),
  viz: (v, o) => ({ kind: 'meters', chain: 'I = R × T', items: [{ label: 'Inventory (I)', value: o.I, max: Math.max(o.I * 1.5, 1), text: o.I.toFixed(1), tone: 'accent' }, { label: 'Throughput (R)', value: o.R, max: Math.max(o.R * 1.5, 1), text: o.R.toFixed(1), tone: 'alt' }, { label: 'Flow time (T)', value: o.T, max: Math.max(o.T * 1.5, 1), text: o.T.toFixed(2), tone: 'alt2' }] }),
  traps: ['Mixing time units: a rate per hour with a flow time in minutes.', 'It applies to long-run averages of a stable process, not to a single moment.'],
  analogy: 'A theme park ride: if 600 guests board per hour and the queue plus ride takes half an hour, 300 guests are in the system.',
  convention: 'Cachon & Terwiesch write I = R × T; Hopp & Spearman write WIP = TH × CT; queuing texts write L = λW.',
  examples: [
    { title: 'Coffee shop', story: 'Customers arrive at 50 per hour and spend 0.2 hours (12 minutes) in the shop on average.', v: { solve: 'I', R: 50, T: 0.2 }, expect: { I: 10 } },
    { title: 'Order backlog', story: 'There are 20 open orders on average and the team completes 5 per day.', v: { solve: 'T', I: 20, R: 5 }, expect: { T: 4 } },
  ],
  practice: { ask: ['I'], gen: (r) => ({ solve: 'I', R: 5 + Math.floor(r() * 40) * 5, T: +(0.5 + Math.floor(r() * 20) * 0.5).toFixed(1) }), prompt: (v, f) => `A process completes ${f.int(v.R)} units per day and each unit spends ${f.num(v.T, 1)} days in the process. What is the average work in process?` },
  gen: (r) => ({ solve: ['I', 'T', 'R'][Math.floor(r() * 3)], R: +(1 + r() * 500).toFixed(2), T: +(0.05 + r() * 30).toFixed(2), I: +(1 + r() * 900).toFixed(1) }),
  uses: [], claim: 'Average inventory equals throughput times flow time in a simulated process.',
});

export const taktTime: CalcDef = calc({
  id: 'takt-time', name: 'Takt Time', short: 'Takt time', cat: CAT,
  bq: 'How fast do I need to produce to keep up with demand?',
  blurb: 'The pace of production needed to match customer demand: available work time divided by units required.',
  keywords: ['takt time', 'takt', 'pace of production', 'customer demand rate', 'lean'],
  symptoms: ['how fast must we produce', 'keep up with demand', 'production pace', 'units per shift'],
  formula: () => `${tx('Takt')} = ${fr(tx('Available work time'), tx('Units required'))}`,
  inputs: [num('shift', { label: 'Shift length (minutes)', blabel: 'Minutes in one shift', def: 480, min: 1, rand: [360, 600, 30], cues: ['minute shift', 'minutes per shift', 'hour shift'] }), num('breaks', { label: 'Breaks and planned stops per shift (minutes)', blabel: 'Break minutes per shift', def: 30, min: 0, rand: [0, 60, 10], cues: ['breaks', 'lunch', 'planned downtime'] }),
    int('shifts', { label: 'Shifts per day', def: 1, min: 1, max: 4, rand: [1, 3, 1], cues: ['shifts'] }), num('demand', { label: 'Units required per day', blabel: 'Units customers need per day', unit: 'units', def: 225, min: 0.0001, rand: [50, 1500, 25], sens: true, cues: ['demand', 'units per day', 'required', 'customers need'] })],
  outputs: [out('taktMin', 'Takt time', { unit: 'min/unit', primary: true, dp: 3 }), out('taktSec', 'Takt time', { unit: 'sec/unit', dp: 1 }), out('avail', 'Available time per day', { unit: 'min' }), out('rate', 'Required output rate', { unit: 'units/hr' })],
  check: (v) => (v.breaks >= v.shift ? 'Breaks cannot be as long as the whole shift.' : null),
  compute: (v) => { const avail = (v.shift - v.breaks) * v.shifts; const taktMin = avail / v.demand; return { avail, taktMin, taktSec: taktMin * 60, rate: 60 / taktMin }; },
  steps: (v, o, c) => [
    { title: 'Available work time per day', tex: `(${c.f.t(v.shift)} - ${c.f.t(v.breaks)}) \\times ${c.f.t(v.shifts)} = ${c.f.t(o.avail)} ${tx(' min')}`, why: 'Only count time when the line is scheduled to run: subtract breaks and planned stops.' },
    { title: 'Divide by required units', tex: `${tx('Takt')} = ${fr(c.f.t(o.avail), c.f.t(v.demand))} = ${c.f.t(o.taktMin, 3)} ${tx(' min/unit')} = ${c.f.t(o.taktSec, 1)} ${tx(' sec/unit')}`, why: 'Takt time is the drumbeat set by the customer: one unit must come off the line every takt interval.', eli: 'If guests arrive for 100 pancakes in 50 minutes, you must flip one every 30 seconds.' },
  ],
  biz: (v, o, f) => ({ headline: `You need to finish one unit every ${o.taktMin >= 1 ? f.num(o.taktMin, 2) + ' minutes' : f.num(o.taktSec, 0) + ' seconds'}.`, meaning: [`That is ${f.num(o.rate, 1)} units per hour across ${f.int(o.avail)} minutes of working time a day.`, 'If any step takes longer than this per unit, it cannot keep up without extra people, machines, or overtime.'], actions: ['Compare each station’s cycle time with takt. Anything slower is your bottleneck.', 'Use takt to size the crew: total work content divided by takt gives the minimum number of stations.'] }),
  viz: (v, o) => ({ kind: 'timeline', unit: 'min', segs: Array.from({ length: Math.min(8, Math.max(2, Math.round(Math.min(8, o.avail / o.taktMin)))) }, (_, i) => ({ label: `Unit ${i + 1}`, start: i * o.taktMin, end: (i + 1) * o.taktMin, tone: (i % 2 ? 'alt' : 'accent') as any, row: 0 })) }),
  traps: ['Using total shift time without removing breaks.', 'Confusing takt time (set by demand) with cycle time (what the process actually achieves).'],
  analogy: 'A metronome set by your customers: every tick, one finished unit should leave.',
  examples: [
    { title: 'Single shift', story: 'One 480-minute shift with 30 minutes of breaks must produce 225 units a day.', v: { shift: 480, breaks: 30, shifts: 1, demand: 225 }, expect: { taktMin: 2, taktSec: 120 } },
    { title: 'Two shifts', story: 'Two 480-minute shifts, each with 40 minutes of breaks, must produce 1,100 units a day.', v: { shift: 480, breaks: 40, shifts: 2, demand: 1100 }, expect: { taktMin: 0.8, taktSec: 48 } },
  ],
  practice: { ask: ['taktSec'], prompt: (v, f) => `A plant runs ${f.int(v.shifts)} shift(s) of ${f.int(v.shift)} minutes with ${f.int(v.breaks)} minutes of breaks per shift. Daily demand is ${f.int(v.demand)} units. What is the takt time in seconds per unit?` },
  uses: [], mono: [['demand', 'taktMin', -1], ['shift', 'taktMin', 1]],
});

export const cycleTime: CalcDef = calc({
  id: 'cycle-time', name: 'Process Cycle Time and Flow Time', short: 'Cycle time', cat: CAT,
  bq: 'How often does a finished unit come off my line?',
  blurb: 'Cycle time (time between finished units, set by the slowest step), total flow time through all steps, and hourly capacity.',
  keywords: ['cycle time', 'process cycle time', 'throughput time', 'flow time', 'bottleneck time', 'time between units'],
  symptoms: ['how long to make one unit', 'how often does a unit finish', 'time per unit'],
  formula: () => `${tx('Cycle time')} = \\max_i ${fr('t_i', 'n_i')}`,
  inputs: [stepsTable(DEF_STEPS)],
  outputs: [out('cycle', 'Cycle time', { unit: 'min/unit', primary: true, dp: 3 }), out('flow', 'Flow (throughput) time', { unit: 'min' }), out('capacity', 'Capacity', { unit: 'units/hr' }), out('slowest', 'Slowest step number', { fmt: 'int' })],
  check: stepsCheck,
  compute: (v) => { const eff = (v.steps as any[]).map((s) => s.time / s.n); const cycle = Math.max(...eff); return { eff, cycle, flow: sum((v.steps as any[]).map((s) => s.time)), capacity: 60 / cycle, slowest: eff.indexOf(cycle) + 1 }; },
  steps: (v, o, c) => [
    { title: 'Effective time per unit at each step', tex: `${fr('t_i', 'n_i')}`, why: 'With n parallel workers, a step releases a unit every t/n minutes.', table: { columns: ['Step', 'Time per unit', 'Workers', 'Effective time'], rows: (v.steps as any[]).map((s, i) => [s.name, c.f.num(s.time), s.n, c.f.num(o.eff[i], 3)]), highlight: [o.slowest - 1] } },
    { title: 'Cycle time is the slowest step', tex: `${tx('Cycle time')} = ${c.f.t(o.cycle, 3)} ${tx(' min/unit')}`, why: 'Units cannot leave the line faster than the slowest step lets them through.', eli: 'A convoy moves at the speed of its slowest truck.' },
    { title: 'Flow time and capacity', tex: `${tx('Flow time')} = \\sum t_i = ${c.f.t(o.flow)} ${tx(' min')}, \\quad ${tx('Capacity')} = ${fr(60, c.f.t(o.cycle, 3))} = ${c.f.t(o.capacity)} ${tx(' units/hr')}`, why: 'Flow time is how long one unit takes to pass through every step with no waiting. Capacity is the inverse of cycle time.' },
  ],
  biz: (v, o, f) => ({ headline: `A finished unit comes off the line every ${f.num(o.cycle, 2)} minutes (${f.num(o.capacity, 1)} per hour).`, meaning: [`One unit needs ${f.num(o.flow, 1)} minutes of hands-on time from start to finish.`, `The pace is set by "${(v.steps as any[])[o.slowest - 1].name}".`], actions: [`To go faster, add capacity only at "${(v.steps as any[])[o.slowest - 1].name}". Speeding up other steps changes nothing.`, 'Compare cycle time with takt time to see whether you can meet demand.'] }),
  viz: (v, o) => ({ kind: 'flow', unit: 'units/hr', flowRate: o.capacity, steps: (v.steps as any[]).map((s, i) => ({ name: s.name, cap: (s.n * 60) / s.time, util: o.capacity / ((s.n * 60) / s.time), bottleneck: i === o.slowest - 1, sub: `${(s.time / s.n).toFixed(1)} min/unit` })) }),
  traps: ['Cycle time is not the sum of step times. That sum is flow (throughput) time.', 'Parallel workers divide the effective step time, not the hands-on time per unit.'],
  analogy: 'A cafeteria line moves at the pace of the slowest server, even though each tray visits every station.',
  convention: 'Following Heizer: cycle (bottleneck) time is the slowest station’s time per unit; throughput time is the sum of all step times.',
  examples: [
    { title: 'Three-step line', story: 'Steps take 2, 4, and 3 minutes with one worker each.', v: { steps: [{ name: 'A', time: 2, n: 1 }, { name: 'B', time: 4, n: 1 }, { name: 'C', time: 3, n: 1 }] }, expect: { cycle: 4, flow: 9, capacity: 15 } },
    { title: 'Parallel workers', story: 'Step A takes 6 minutes with 2 workers, B takes 4 minutes with 1, C takes 10 minutes with 2.', v: { steps: [{ name: 'A', time: 6, n: 2 }, { name: 'B', time: 4, n: 1 }, { name: 'C', time: 10, n: 2 }] }, expect: { cycle: 5, flow: 20, capacity: 12 } },
  ],
  practice: { ask: ['cycle'], gen: (r) => ({ steps: Array.from({ length: 3 }, (_, i) => ({ name: 'ABC'[i], time: 2 + Math.floor(r() * 10), n: 1 + Math.floor(r() * 2) })) }), prompt: (v) => `A process has these steps: ${v.steps.map((s: any) => `${s.name} takes ${s.time} minutes with ${s.n} worker(s)`).join('; ')}. What is the process cycle time in minutes per unit?` },
  gen: (r) => ({ steps: genSteps(r) }), uses: ['takt-time'],
});

export const throughput: CalcDef = calc({
  id: 'throughput', name: 'Throughput Rate', short: 'Throughput', cat: CAT,
  bq: 'How many units can I actually get out the door?',
  blurb: 'Actual flow rate: the smaller of demand and capacity, adjusted for yield, with the implied utilization.',
  keywords: ['throughput', 'flow rate', 'output rate', 'process capacity', 'yield'],
  symptoms: ['how much can we produce', 'output per day', 'can we meet demand'],
  formula: () => `${tx('Throughput')} = \\min(${tx('Demand')}, ${tx('Capacity')})`,
  inputs: [num('capacity', { label: 'Process capacity (units per hour)', blabel: 'Most you can make per hour', def: 60, min: 0.0001, rand: [10, 200, 5], sens: true, cues: ['capacity'] }), num('demand', { label: 'Demand rate (units per hour)', blabel: 'Units customers want per hour', def: 45, min: 0, rand: [10, 200, 5], sens: true, cues: ['demand'] }),
    num('hours', { label: 'Operating hours per day', def: 8, min: 0.01, max: 24, rand: [4, 24, 1], cues: ['hours per day', 'hour day'] }), pct('yield', { label: 'Yield (good units)', blabel: 'Share of units that are good', def: 100, min: 0.01, rand: [80, 100, 1], sens: true, cues: ['yield', 'good units'] })],
  outputs: [out('rate', 'Throughput rate', { unit: 'units/hr', primary: true }), out('daily', 'Good output per day', { unit: 'units' }), out('util', 'Implied utilization', { fmt: 'pct' }), out('gap', 'Unmet demand per hour', { unit: 'units' })],
  compute: (v) => { const rate = Math.min(v.demand, v.capacity); return { rate, daily: rate * v.hours * (v.yield / 100), util: (rate / v.capacity) * 100, gap: Math.max(0, v.demand - v.capacity), capConstrained: v.demand > v.capacity ? 1 : 0 }; },
  steps: (v, o, c) => [
    { title: 'Throughput is the smaller of demand and capacity', tex: `\\min(${c.f.t(v.demand)}, ${c.f.t(v.capacity)}) = ${c.f.t(o.rate)} ${tx(' units/hr')}`, why: o.capConstrained ? 'Demand exceeds capacity, so the process is capacity-constrained: it produces at its limit.' : 'Capacity exceeds demand, so the process is demand-constrained: it only makes what is needed.', eli: 'You can only sell what people want, and only make what the line can handle. Output is whichever is smaller.' },
    { title: 'Utilization', tex: `${fr(tx('Throughput'), tx('Capacity'))} = ${fr(c.f.t(o.rate), c.f.t(v.capacity))} = ${c.f.pct(o.util)}`, why: 'The share of capacity actually used.' },
    { title: 'Good output per day', tex: `${c.f.t(o.rate)} \\times ${c.f.t(v.hours)} \\times ${c.f.t(v.yield / 100, 3)} = ${c.f.t(o.daily)} ${tx(' units')}`, why: 'Rate times hours, less the units lost to defects.' },
  ],
  biz: (v, o, f) => ({ headline: `You can ship about ${f.int(o.daily)} good units a day (${f.num(o.rate, 1)} per hour).`, meaning: [o.capConstrained ? `You are capacity-constrained and miss ${f.num(o.gap, 1)} units of demand every hour.` : `You have spare capacity: the line runs at ${f.pct(o.util, 0)}.`, v.yield < 100 ? `Defects cost you ${f.int(o.rate * v.hours * (1 - v.yield / 100))} units a day.` : 'No yield loss assumed.'], actions: [o.capConstrained ? 'Add capacity at the bottleneck, extend hours, or raise price.' : 'Look for more demand or redeploy the idle capacity.', 'Improving yield is free capacity: fix quality before buying equipment.'] }),
  viz: (v, o) => ({ kind: 'xy', x: { label: '', cats: ['Demand', 'Capacity', 'Throughput'] }, y: { label: 'Units per hour', zero: true }, series: [{ name: 'Rate', style: 'bars', tone: 'accent', pts: [[0, v.demand], [1, v.capacity], [2, o.rate]] }] }),
  traps: ['Throughput can never exceed capacity or demand.', 'Capacity is what the process could make. Throughput is what it does make.'],
  analogy: 'Water through a hose: flow is limited by either how far the tap is open (demand) or how wide the hose is (capacity).',
  examples: [
    { title: 'Demand-constrained', story: 'Capacity is 60 units per hour and demand is 45 per hour over an 8-hour day with no defects.', v: { capacity: 60, demand: 45, hours: 8, yield: 100 }, expect: { rate: 45, daily: 360, util: 75 } },
    { title: 'Capacity-constrained with scrap', story: 'Capacity is 30 per hour, demand 50 per hour, 16 hours a day, 95% yield.', v: { capacity: 30, demand: 50, hours: 16, yield: 95 }, expect: { rate: 30, daily: 456, util: 100, gap: 20 } },
  ],
  practice: { ask: ['daily'], prompt: (v, f) => `A process has capacity of ${f.int(v.capacity)} units per hour and faces demand of ${f.int(v.demand)} units per hour. It runs ${f.int(v.hours)} hours a day with a ${f.pct(v.yield, 0)} yield. How many good units does it produce per day?` },
  uses: ['bottleneck'], mono: [['capacity', 'rate', 1], ['demand', 'rate', 1]],
});

export const bottleneck: CalcDef = calc({
  id: 'bottleneck', name: 'Bottleneck Identification', short: 'Bottleneck', cat: CAT,
  bq: 'Which step is holding back my whole operation?',
  blurb: 'Capacity of each step in a multi-step process, the bottleneck, overall process capacity, and utilization of every step.',
  keywords: ['bottleneck', 'process capacity', 'constraint', 'capacity analysis', 'theory of constraints', 'implied utilization'],
  symptoms: ['what is slowing us down', 'where is the bottleneck', 'work piles up at one station', 'which step limits output'],
  formula: () => `${tx('Capacity')}_i = ${fr('n_i', 't_i')}, \\quad ${tx('Process capacity')} = \\min_i ${tx('Capacity')}_i`,
  inputs: [stepsTable(DEF_STEPS), num('demand', { label: 'Demand rate (units per hour)', blabel: 'Units customers want per hour', def: 10, min: 0, rand: [2, 40, 1], sens: true, cues: ['demand'] })],
  outputs: [out('capacity', 'Process capacity', { unit: 'units/hr', primary: true }), out('bn', 'Bottleneck step number', { fmt: 'int' }), out('flow', 'Flow rate', { unit: 'units/hr' }), out('bnUtil', 'Bottleneck utilization', { fmt: 'pct' })],
  check: stepsCheck,
  compute: (v) => { const caps = stepCaps(v); const capacity = Math.min(...caps); const flow = Math.min(v.demand, capacity); return { caps, capacity, bn: caps.indexOf(capacity) + 1, flow, utils: caps.map((c2) => (flow / c2) * 100), bnUtil: (flow / capacity) * 100, implied: caps.map((c2) => (v.demand / c2) * 100) }; },
  steps: (v, o, c) => [
    { title: 'Capacity of each step', tex: `${tx('Capacity')}_i = ${fr('n_i \\times 60', 't_i')}`, why: 'Each worker completes 60/t units per hour. Multiply by the number of workers at the step.', table: { columns: ['Step', 'Time (min)', 'Workers', 'Capacity (units/hr)', 'Utilization', 'Implied utilization'], rows: (v.steps as any[]).map((s, i) => [s.name, c.f.num(s.time), s.n, c.f.num(o.caps[i], 2), c.f.pct(o.utils[i]), c.f.pct(o.implied[i])]), highlight: [o.bn - 1] } },
    { title: 'The bottleneck is the step with the lowest capacity', tex: `${tx('Process capacity')} = \\min(${o.caps.map((x: number) => c.f.t(x, 2)).join(', ')}) = ${c.f.t(o.capacity, 2)} ${tx(' units/hr')}`, why: 'The whole process can go no faster than its slowest resource.', eli: 'In a relay race the team’s time depends on the slowest runner, however fast the others are.' },
    { title: 'Flow rate and utilization', tex: `${tx('Flow')} = \\min(${tx('Demand')}, ${tx('Capacity')}) = ${c.f.t(o.flow, 2)}, \\quad ${tx('Utilization')}_i = ${fr(tx('Flow'), `${tx('Capacity')}_i`)}`, why: 'Each step is busy for the fraction of its capacity that the flow uses. Implied utilization (demand over capacity) can exceed 100%, which flags a step that cannot keep up.' },
  ],
  biz: (v, o, f) => ({ headline: `"${(v.steps as any[])[o.bn - 1].name}" is your bottleneck. The whole process tops out at ${f.num(o.capacity, 1)} units per hour.`, meaning: [v.demand > o.capacity ? `Demand of ${f.num(v.demand, 1)} per hour is more than you can make. You fall short by ${f.num(v.demand - o.capacity, 1)} an hour.` : `You can cover demand of ${f.num(v.demand, 1)} per hour. The bottleneck runs at ${f.pct(o.bnUtil, 0)}.`, 'Every other step has spare time. Improving them will not raise output.'], actions: [`Add a worker or machine at "${(v.steps as any[])[o.bn - 1].name}", or move work away from it.`, 'Never let the bottleneck sit idle: stagger breaks and keep a small buffer of work in front of it.', 'After fixing it, re-run this: the bottleneck moves.'] }),
  viz: (v, o) => ({ kind: 'flow', unit: 'units/hr', flowRate: o.flow, steps: (v.steps as any[]).map((s, i) => ({ name: s.name, cap: o.caps[i], util: o.utils[i] / 100, bottleneck: i === o.bn - 1 })) }),
  traps: ['The bottleneck is the step with the lowest capacity, not necessarily the longest task time (parallel resources matter).', 'Utilization uses the actual flow rate. Implied utilization uses demand and can exceed 100%.'],
  analogy: 'The neck of a bottle: no matter how wide the rest is, liquid pours only as fast as the narrowest point allows.',
  examples: [
    { title: 'Three steps', story: 'Prep takes 4 minutes (1 worker), assembly 10 minutes (2 workers), packing 3 minutes (1 worker). Demand is 10 units per hour.', v: { steps: DEF_STEPS, demand: 10 }, expect: { capacity: 12, bn: 2, flow: 10, bnUtil: 83.333 } },
    { title: 'Four steps', story: 'Steps take 2, 6, 5, and 8 minutes with 1, 2, 1, and 3 workers. Demand is 15 units per hour.', v: { steps: [{ name: 'Cut', time: 2, n: 1 }, { name: 'Weld', time: 6, n: 2 }, { name: 'Paint', time: 5, n: 1 }, { name: 'Inspect', time: 8, n: 3 }], demand: 15 }, expect: { capacity: 12, bn: 3, flow: 12, bnUtil: 100 } },
  ],
  practice: { ask: ['capacity'], gen: (r) => ({ steps: Array.from({ length: 3 }, (_, i) => ({ name: ['Cut', 'Sew', 'Pack'][i], time: 2 + Math.floor(r() * 10), n: 1 + Math.floor(r() * 3) })), demand: 10 }), prompt: (v) => `A process has these steps: ${v.steps.map((s: any) => `${s.name}: ${s.time} minutes per unit with ${s.n} worker(s)`).join('; ')}. What is the process capacity in units per hour?` },
  gen: (r) => ({ steps: genSteps(r), demand: +(1 + r() * 60).toFixed(1) }), uses: ['cycle-time', 'utilization'],
});

export const utilization: CalcDef = calc({
  id: 'utilization', name: 'Capacity Utilization', short: 'Utilization', cat: CAT,
  bq: 'How much of my capacity am I really using?',
  blurb: 'Actual output as a percentage of design capacity.',
  keywords: ['utilization', 'capacity utilization', 'design capacity', 'actual output'],
  symptoms: ['are we using our capacity', 'idle capacity', 'how busy are we'],
  formula: () => `${tx('Utilization')} = ${fr(tx('Actual output'), tx('Design capacity'))}`,
  inputs: [num('actual', { label: 'Actual output', blabel: 'What you actually produced', def: 148000, min: 0, rand: [200, 900, 10], sens: true, cues: ['actual output', 'actual production', 'produced', 'actually'] }), num('design', { label: 'Design capacity', blabel: 'Most you could produce under ideal conditions', def: 201600, min: 0.0001, rand: [1000, 2000, 50], sens: true, cues: ['design capacity', 'designed to', 'maximum capacity'] })],
  outputs: [out('util', 'Utilization', { fmt: 'pct', primary: true }), out('idle', 'Unused design capacity', {})],
  compute: (v) => ({ util: (v.actual / v.design) * 100, idle: v.design - v.actual }),
  steps: (v, o, c) => [{ title: 'Divide actual output by design capacity', tex: `${fr(c.f.t(v.actual), c.f.t(v.design))} = ${c.f.pct(o.util)}`, why: 'Design capacity is the theoretical maximum under ideal conditions. Utilization shows how much of that maximum was achieved.', eli: 'If a 100-seat restaurant serves 70 guests, it is 70% utilized.' }],
  biz: (v, o, f) => ({ headline: `You are using ${f.pct(o.util, 0)} of your design capacity.`, meaning: [`${f.int(o.idle)} units of theoretical capacity went unused.`, o.util > 90 ? 'Above 90% leaves little room for breakdowns or demand spikes, and waits grow sharply.' : 'There is headroom before you need to add capacity.'], actions: ['Check efficiency too: low utilization can come from planned stops (fine) or from poor execution (fixable).', 'Target 80 to 90% for most operations.'] }),
  viz: (v, o) => ({ kind: 'meters', items: [{ label: 'Utilization', value: o.util, max: 100, text: o.util.toFixed(1) + '%', tone: o.util > 95 ? 'warn' : 'accent' }] }),
  traps: ['Utilization uses design capacity. Efficiency uses effective capacity. Do not swap them.'],
  analogy: 'A car that can do 120 mph cruising at 60: 50% utilization of its top speed.',
  examples: [
    { title: 'Bakery line', story: 'A bakery made 148,000 rolls last week on a line designed for 201,600.', v: { actual: 148000, design: 201600 }, expect: { util: 73.41 } },
    { title: 'Machine shop', story: 'Actual output 540 units against a design capacity of 720.', v: { actual: 540, design: 720 }, expect: { util: 75 } },
  ],
  practice: { ask: ['util'], prompt: (v, f) => `A facility has a design capacity of ${f.int(v.design)} units per week and actually produced ${f.int(v.actual)}. What is its utilization (in %)?` },
  uses: ['effective-capacity'], mono: [['actual', 'util', 1], ['design', 'util', -1]],
});

export const efficiency: CalcDef = calc({
  id: 'efficiency', name: 'Efficiency', short: 'Efficiency', cat: CAT,
  bq: 'How well am I running compared with what is realistic?',
  blurb: 'Actual output as a percentage of effective capacity (what the operation can realistically achieve).',
  keywords: ['efficiency', 'effective capacity', 'actual output', 'operating efficiency'],
  symptoms: ['are we running efficiently', 'output below plan', 'underperforming'],
  formula: () => `${tx('Efficiency')} = ${fr(tx('Actual output'), tx('Effective capacity'))}`,
  inputs: [num('actual', { label: 'Actual output', blabel: 'What you actually produced', def: 148000, min: 0, rand: [200, 900, 10], sens: true, cues: ['actual output', 'actual production', 'produced'] }), num('effective', { label: 'Effective capacity', blabel: 'What you realistically could produce', def: 175000, min: 0.0001, rand: [900, 1500, 50], sens: true, cues: ['effective capacity'] })],
  outputs: [out('eff', 'Efficiency', { fmt: 'pct', primary: true }), out('lost', 'Output lost to inefficiency', {})],
  compute: (v) => ({ eff: (v.actual / v.effective) * 100, lost: v.effective - v.actual }),
  steps: (v, o, c) => [{ title: 'Divide actual output by effective capacity', tex: `${fr(c.f.t(v.actual), c.f.t(v.effective))} = ${c.f.pct(o.eff)}`, why: 'Effective capacity already allows for planned maintenance, changeovers, and product mix. Efficiency measures how well the operation performed against that realistic target.', eli: 'If you planned to study 10 hours and managed 8, you were 80% efficient against your plan.' }],
  biz: (v, o, f) => ({ headline: `You are running at ${f.pct(o.eff, 0)} efficiency.`, meaning: [`${f.int(o.lost)} units of realistic capacity were lost to unplanned problems.`, 'This gap is the part you can attack: breakdowns, absenteeism, material shortages, rework.'], actions: ['Log the reasons for lost output for two weeks and fix the biggest one.', 'Use OEE for a more detailed breakdown of where time is lost.'] }),
  viz: (v, o) => ({ kind: 'meters', items: [{ label: 'Efficiency', value: o.eff, max: 100, text: o.eff.toFixed(1) + '%', tone: 'accent' }] }),
  traps: ['Efficiency can look good while utilization is poor if effective capacity is set low.'],
  analogy: 'Finishing 8 of the 10 tasks you realistically planned for the day: 80% efficient.',
  examples: [
    { title: 'Bakery line', story: 'Actual output 148,000 rolls against an effective capacity of 175,000.', v: { actual: 148000, effective: 175000 }, expect: { eff: 84.57 } },
    { title: 'Packing cell', story: 'Actual output 450 against an effective capacity of 500.', v: { actual: 450, effective: 500 }, expect: { eff: 90 } },
  ],
  practice: { ask: ['eff'], prompt: (v, f) => `A line has an effective capacity of ${f.int(v.effective)} units and actually produced ${f.int(v.actual)}. What is its efficiency (in %)?` },
  uses: ['effective-capacity'], mono: [['actual', 'eff', 1], ['effective', 'eff', -1]],
});

export const effectiveCapacity: CalcDef = calc({
  id: 'effective-capacity', name: 'Effective Capacity and Expected Output', short: 'Effective capacity', cat: CAT,
  bq: 'What output can I realistically plan on?',
  blurb: 'Design capacity less planned losses gives effective capacity. Multiply by efficiency for expected output.',
  keywords: ['effective capacity', 'expected output', 'design capacity', 'planned capacity', 'rated capacity'],
  symptoms: ['how much can we realistically make', 'plan production', 'expected output'],
  formula: () => `${tx('Expected output')} = ${tx('Effective capacity')} \\times ${tx('Efficiency')}`,
  inputs: [num('design', { label: 'Design capacity', blabel: 'Most you could produce under ideal conditions', def: 1200, min: 0, rand: [500, 5000, 100], sens: true, cues: ['design capacity'] }),
    sel('lossMode', 'Planned losses given as', [['pct', 'Percent of design capacity'], ['units', 'Units']], 'pct'),
    pct('lossPct', { label: 'Planned losses (maintenance, changeovers, breaks)', blabel: 'Planned downtime as % of capacity', def: 12.5, rand: [5, 30, 2.5], show: (v) => v.lossMode !== 'units', sens: true, cues: ['planned losses', 'allowances', 'maintenance'] }),
    num('lossUnits', { label: 'Planned losses (units)', def: 26600, min: 0, rand: [10, 400, 10], show: (v) => v.lossMode === 'units', cues: ['lost to'] }),
    pct('eff', { label: 'Efficiency', blabel: 'How well you usually run against plan', def: 80, max: 150, rand: [60, 100, 5], sens: true, cues: ['efficiency'] })],
  outputs: [out('expected', 'Expected output', { primary: true }), out('effective', 'Effective capacity', {}), out('util', 'Resulting utilization', { fmt: 'pct' })],
  check: (v) => (v.lossMode === 'units' && v.lossUnits > v.design ? 'Planned losses cannot exceed design capacity.' : null),
  compute: (v) => { const effective = v.lossMode === 'units' ? v.design - v.lossUnits : v.design * (1 - v.lossPct / 100); const expected = effective * (v.eff / 100); return { effective, expected, util: v.design > 0 ? (expected / v.design) * 100 : 0 }; },
  steps: (v, o, c) => [
    { title: 'Effective capacity', tex: v.lossMode === 'units' ? `${c.f.t(v.design)} - ${c.f.t(v.lossUnits)} = ${c.f.t(o.effective)}` : `${c.f.t(v.design)} \\times (1 - ${c.f.t(v.lossPct / 100, 4)}) = ${c.f.t(o.effective)}`, why: 'Remove the capacity you plan to give up to maintenance, changeovers, breaks, and product mix.', eli: 'A workday has 8 hours, but after lunch and meetings maybe 6.5 are really available.' },
    { title: 'Expected output', tex: `${c.f.t(o.effective)} \\times ${c.f.t(v.eff / 100, 3)} = ${c.f.t(o.expected)}`, why: 'Scale effective capacity by how efficiently the operation usually runs.' },
    { title: 'Resulting utilization', tex: `${fr(c.f.t(o.expected), c.f.t(v.design))} = ${c.f.pct(o.util)}`, why: 'Expected output as a share of design capacity.' },
  ],
  biz: (v, o, f) => ({ headline: `Plan on about ${f.int(o.expected)} units.`, meaning: [`Of ${f.int(v.design)} units of design capacity, ${f.int(o.effective)} are realistically available after planned stops.`, `At ${f.pct(v.eff, 0)} efficiency you get ${f.int(o.expected)}, which is ${f.pct(o.util, 0)} of design capacity.`], actions: ['Promise customers the expected output, not design capacity.', 'Each point of efficiency gained is worth ' + f.num(o.effective / 100, 1) + ' units.'] }),
  viz: (v, o) => ({ kind: 'xy', x: { label: '', cats: ['Design capacity', 'Effective capacity', 'Expected output'] }, y: { label: 'Units', zero: true }, series: [{ name: 'Units', style: 'bars', tone: 'accent', pts: [[0, v.design], [1, o.effective], [2, o.expected]] }] }),
  traps: ['Expected output uses effective capacity, not design capacity.', 'Efficiency is a decimal in the multiplication: 75% is 0.75.'],
  analogy: 'A road trip estimate: the car’s top range, minus planned stops, times how smoothly traffic usually flows.',
  examples: [
    { title: 'Percent allowances', story: 'Design capacity is 1,200 units a day, planned losses are 12.5%, and efficiency is 80%.', v: { design: 1200, lossPct: 12.5, eff: 80 }, expect: { effective: 1050, expected: 840, util: 70 } },
    { title: 'Bakery expansion', story: 'Design capacity 201,600 rolls a week with 26,600 lost to planned stops. The new line is expected to run at 75% efficiency.', v: { design: 201600, lossMode: 'units', lossUnits: 26600, eff: 75 }, expect: { effective: 175000, expected: 131250 } },
  ],
  practice: { ask: ['expected'], prompt: (v, f) => `A plant has a design capacity of ${f.int(v.design)} units. Planned losses are ${f.pct(v.lossPct)} of design capacity and efficiency is ${f.pct(v.eff, 0)}. What is the expected output?` },
  uses: [], mono: [['design', 'expected', 1], ['eff', 'expected', 1], ['lossPct', 'expected', -1]],
});

export const oee: CalcDef = calc({
  id: 'oee', name: 'Overall Equipment Effectiveness (OEE)', short: 'OEE', cat: CAT,
  bq: 'How much of my machine time turns into good product?',
  blurb: 'Availability × Performance × Quality: the share of planned production time that produces good units at full speed.',
  keywords: ['oee', 'overall equipment effectiveness', 'availability', 'performance', 'quality rate', 'tpm', 'six big losses'],
  symptoms: ['machine downtime', 'equipment not productive', 'line runs slow', 'where are we losing time'],
  formula: () => `OEE = ${tx('Availability')} \\times ${tx('Performance')} \\times ${tx('Quality')}`,
  inputs: [num('planned', { label: 'Planned production time (min)', blabel: 'Minutes the machine was scheduled to run', def: 420, min: 0.0001, rand: [300, 480, 10], cues: ['planned production time', 'scheduled'] }), num('down', { label: 'Downtime (min)', blabel: 'Minutes lost to stops and breakdowns', def: 47, min: 0, rand: [0, 90, 5], sens: true, cues: ['downtime', 'breakdown', 'stopped'] }),
    num('ideal', { label: 'Ideal cycle time (seconds per unit)', blabel: 'Fastest possible seconds per unit', def: 1, min: 0.0001, rand: [1, 1, 1], sens: true, cues: ['ideal cycle time', 'ideal run rate'] }), num('total', { label: 'Total units produced', def: 19271, min: 0, rand: [8000, 12000, 100], sens: true, cues: ['total count', 'total units', 'produced'] }), num('good', { label: 'Good units', def: 18848, min: 0, rand: [7000, 8000, 100], sens: true, cues: ['good units', 'good count', 'good parts'] })],
  outputs: [out('oee', 'OEE', { fmt: 'pct', primary: true }), out('A', 'Availability', { fmt: 'pct' }), out('P', 'Performance', { fmt: 'pct' }), out('Q', 'Quality', { fmt: 'pct' }), out('run', 'Run time', { unit: 'min' })],
  check: (v) => (v.down >= v.planned ? 'Downtime cannot be as long as the planned production time.' : v.good > v.total ? 'Good units cannot exceed total units.' : v.total <= 0 ? 'Total units must be greater than zero.' : null),
  compute: (v) => { const run = v.planned - v.down; const A = run / v.planned, P = (v.ideal * v.total) / (run * 60), Q = v.good / v.total; return { run, A: A * 100, P: P * 100, Q: Q * 100, oee: A * P * Q * 100 }; },
  steps: (v, o, c) => [
    { title: 'Availability', tex: `${fr(tx('Run time'), tx('Planned time'))} = ${fr(`${c.f.t(v.planned)} - ${c.f.t(v.down)}`, c.f.t(v.planned))} = ${c.f.pct(o.A, 2)}`, why: 'Share of scheduled time the equipment was actually running.', eli: 'Was the machine on when it was supposed to be?' },
    { title: 'Performance', tex: `${fr(`${tx('Ideal cycle time')} \\times ${tx('Total units')}`, tx('Run time'))} = ${fr(`${c.f.t(v.ideal)} \\times ${c.f.t(v.total)}`, `${c.f.t(o.run)} \\times 60`)} = ${c.f.pct(o.P, 2)}`, why: 'Compares what was produced with what would have been produced at ideal speed during the run time.', eli: 'While it was on, did it run at full speed?' },
    { title: 'Quality', tex: `${fr(tx('Good units'), tx('Total units'))} = ${fr(c.f.t(v.good), c.f.t(v.total))} = ${c.f.pct(o.Q, 2)}`, why: 'Share of output that needed no rework or scrap.', eli: 'Of what it made, how much was good?' },
    { title: 'Multiply the three', tex: `OEE = ${c.f.t(o.A / 100, 4)} \\times ${c.f.t(o.P / 100, 4)} \\times ${c.f.t(o.Q / 100, 4)} = ${c.f.pct(o.oee, 2)}`, why: 'The three losses compound: OEE is the fraction of planned time that produced good units at ideal speed.' },
  ],
  biz: (v, o, f) => { const worst = o.A <= o.P && o.A <= o.Q ? 'availability (stops and breakdowns)' : o.P <= o.Q ? 'performance (running slow and small stops)' : 'quality (scrap and rework)'; return { headline: `Your OEE is ${f.pct(o.oee, 0)}: only that share of scheduled time makes good product at full speed.`, meaning: [`Availability ${f.pct(o.A, 0)}, performance ${f.pct(o.P, 0)}, quality ${f.pct(o.Q, 0)}.`, `Your biggest loss is ${worst}.`, 'World-class is about 85%. Most plants run 40 to 60%.'], actions: [`Attack ${worst} first.`, 'Log every stop longer than a minute for two weeks: the top three causes usually explain most of the loss.', 'Do not buy a new machine until OEE on the current one is above 75%.'] }; },
  viz: (v, o) => ({ kind: 'meters', chain: 'Availability × Performance × Quality = OEE', items: [{ label: 'Availability', value: o.A, max: 100, text: o.A.toFixed(1) + '%', tone: 'alt' }, { label: 'Performance', value: o.P, max: 100, text: o.P.toFixed(1) + '%', tone: 'alt2' }, { label: 'Quality', value: o.Q, max: 100, text: o.Q.toFixed(1) + '%', tone: 'good' }, { label: 'OEE', value: o.oee, max: 100, text: o.oee.toFixed(1) + '%', tone: 'accent' }] }),
  traps: ['Planned production time excludes scheduled breaks. Downtime is unplanned stops inside it.', 'Ideal cycle time must be in the same unit as run time (convert minutes to seconds).', 'Performance uses total units, quality uses good units.'],
  analogy: 'A delivery driver: on the road only part of the shift (availability), sometimes stuck in traffic (performance), and a few parcels arrive damaged (quality).',
  examples: [
    { title: 'Packaging line', story: 'Planned production time is 420 minutes with 47 minutes of downtime. Ideal cycle time is 1 second. The line made 19,271 units of which 18,848 were good.', v: { planned: 420, down: 47, ideal: 1, total: 19271, good: 18848 }, expect: { A: 88.81, P: 86.11, Q: 97.8, oee: 74.79 } },
    { title: 'Molding press', story: 'Planned time 400 minutes, downtime 40 minutes, ideal cycle 30 seconds, 648 units made, 612 good.', v: { planned: 400, down: 40, ideal: 30, total: 648, good: 612 }, expect: { A: 90, P: 90, oee: 76.5 } },
  ],
  practice: { ask: ['oee'], gen: (r) => { const planned = 400 + Math.floor(r() * 9) * 10, down = 20 + Math.floor(r() * 7) * 10, ideal = [30, 60, 90][Math.floor(r() * 3)]; const total = Math.floor(((planned - down) * 60 / ideal) * (0.75 + r() * 0.2)); return { planned, down, ideal, total, good: Math.floor(total * (0.9 + r() * 0.09)) }; }, prompt: (v, f) => `A machine had ${f.int(v.planned)} minutes of planned production time and ${f.int(v.down)} minutes of downtime. Its ideal cycle time is ${f.int(v.ideal)} seconds per unit. It produced ${f.int(v.total)} units, ${f.int(v.good)} of them good. What is the OEE (in %)?` },
  gen: (r) => { const planned = 200 + Math.floor(r() * 800), down = Math.floor(r() * planned * 0.5), ideal = +(0.5 + r() * 120).toFixed(1); const total = Math.max(1, Math.floor(((planned - down) * 60 / ideal) * (0.4 + r() * 0.6))); return { planned, down, ideal, total, good: Math.floor(total * (0.5 + r() * 0.5)) }; },
  uses: ['utilization', 'efficiency'],
});

type Task = { id: string; time: number; preds: string[] };
export function parseTasks(rows: any[]): Task[] {
  return rows.map((r, i) => ({ id: String(r.id ?? '').trim() || `T${i + 1}`, time: Number(r.time), preds: String(r.preds ?? '').split(/[,;\s]+/).map((s) => s.trim()).filter((s) => s && s !== '-' && s !== '—' && s.toLowerCase() !== 'none') }));
}
/** Longest-task-time heuristic. Ties: more following tasks first, then input order. */
export function balanceLine(tasks: Task[], cycle: number) {
  const idx = new Map(tasks.map((t, i) => [t.id, i]));
  const succ: number[][] = tasks.map(() => []);
  tasks.forEach((t, i) => t.preds.forEach((p) => succ[idx.get(p)!].push(i)));
  const followers = tasks.map((_, i) => { const seen = new Set<number>(); const st = [...succ[i]]; while (st.length) { const k = st.pop()!; if (!seen.has(k)) { seen.add(k); st.push(...succ[k]); } } return seen.size; });
  const done = new Array(tasks.length).fill(false); const station: number[] = new Array(tasks.length).fill(0); const order: number[] = [];
  let st = 1, remaining = cycle, left = tasks.length;
  while (left > 0) {
    let pickI = -1;
    for (let i = 0; i < tasks.length; i++) {
      if (done[i] || tasks[i].time > remaining + 1e-9 || !tasks[i].preds.every((p) => done[idx.get(p)!])) continue;
      if (pickI < 0 || tasks[i].time > tasks[pickI].time + 1e-12 || (Math.abs(tasks[i].time - tasks[pickI].time) <= 1e-12 && followers[i] > followers[pickI])) pickI = i;
    }
    if (pickI < 0) { if (remaining >= cycle - 1e-12) throw new Error('A task is longer than the cycle time, so it cannot be assigned to any station.'); st++; remaining = cycle; continue; }
    done[pickI] = true; station[pickI] = st; order.push(pickI); remaining -= tasks[pickI].time; left--;
  }
  return { station, stations: st, order, followers };
}
const LB_DEF = [{ id: 'A', time: 10, preds: '' }, { id: 'B', time: 11, preds: 'A' }, { id: 'C', time: 5, preds: 'B' }, { id: 'D', time: 4, preds: 'B' }, { id: 'E', time: 11, preds: 'A' }, { id: 'F', time: 3, preds: 'C,D' }, { id: 'G', time: 7, preds: 'F' }, { id: 'H', time: 11, preds: 'E' }, { id: 'I', time: 3, preds: 'G,H' }];
const WAGON = [{ id: 'A', time: 45, preds: '' }, { id: 'B', time: 11, preds: 'A' }, { id: 'C', time: 9, preds: 'B' }, { id: 'D', time: 50, preds: '' }, { id: 'E', time: 15, preds: 'D' }, { id: 'F', time: 12, preds: 'C' }, { id: 'G', time: 12, preds: 'C' }, { id: 'H', time: 12, preds: 'E' }, { id: 'I', time: 12, preds: 'E' }, { id: 'J', time: 8, preds: 'F,G,H,I' }, { id: 'K', time: 9, preds: 'J' }];
export function tasksError(rows: any[]): string | null {
  const t = parseTasks(rows); const ids = new Set<string>();
  for (const x of t) { if (ids.has(x.id)) return `Task "${x.id}" appears more than once. Give every task a unique name.`; ids.add(x.id); if (!(x.time >= 0) || !Number.isFinite(x.time)) return `Task "${x.id}" needs a time of zero or more.`; }
  for (const x of t) for (const p of x.preds) { if (!ids.has(p)) return `Task "${x.id}" lists predecessor "${p}", which is not in the table.`; if (p === x.id) return `Task "${x.id}" cannot be its own predecessor.`; }
  // cycle detection
  const state = new Map<string, number>(); const by = new Map(t.map((x) => [x.id, x]));
  const visit = (id: string): boolean => { if (state.get(id) === 1) return true; if (state.get(id) === 2) return false; state.set(id, 1); for (const p of by.get(id)!.preds) if (visit(p)) return true; state.set(id, 2); return false; };
  for (const x of t) if (visit(x.id)) return 'The precedence relationships form a loop. A task cannot come both before and after another task.';
  return null;
}
export const lineBalancing: CalcDef = calc({
  id: 'line-balancing', name: 'Assembly Line Balancing', short: 'Line balancing', cat: CAT,
  bq: 'How many workstations do I need, and who does what?',
  blurb: 'Cycle time from demand, the theoretical minimum number of stations, a task assignment using the longest-task-time rule, and the line’s efficiency.',
  keywords: ['line balancing', 'assembly line', 'workstations', 'cycle time', 'balance delay', 'longest task time', 'precedence diagram', 'minimum number of workstations'],
  symptoms: ['how many stations', 'assign tasks to workers', 'set up an assembly line', 'workers are idle'],
  formula: () => `C = ${fr(tx('Available time'), tx('Required output'))}, \\quad N_{min} = \\left\\lceil ${fr('\\sum t_i', 'C')} \\right\\rceil, \\quad ${tx('Efficiency')} = ${fr('\\sum t_i', 'N \\times C')}`,
  inputs: [table('tasks', 'Tasks', [col('id', 'Task', 'text'), col('time', 'Time'), col('preds', 'Immediate predecessors', 'text')], LB_DEF, { minRows: 1, help: 'List predecessors separated by commas. Leave blank if a task has none.' }),
    num('avail', { label: 'Available production time per day', blabel: 'Working time per day (same unit as task times)', def: 480, min: 0.0001, cues: ['available', 'minutes per day', 'production time'] }), num('demand', { label: 'Required output per day', blabel: 'Units needed per day', unit: 'units', def: 40, min: 0.0001, sens: true, cues: ['units per day', 'demand', 'required output'] })],
  outputs: [out('N', 'Stations used', { primary: true, fmt: 'int' }), out('cycle', 'Cycle time', { dp: 3 }), out('Nmin', 'Theoretical minimum stations', { fmt: 'int' }), out('eff', 'Efficiency', { fmt: 'pct' }), out('delay', 'Balance delay', { fmt: 'pct' }), out('idle', 'Idle time per cycle', {})],
  check: (v) => { const e = tasksError(v.tasks); if (e) return e; const c = v.avail / v.demand; const big = parseTasks(v.tasks).find((t) => t.time > c + 1e-9); return big ? `Task "${big.id}" takes ${big.time}, longer than the cycle time of ${Number(c.toFixed(3))}. Split the task, run parallel stations, or lower the required output.` : null; },
  compute: (v) => { const tasks = parseTasks(v.tasks); const cycle = v.avail / v.demand; const total = sum(tasks.map((t) => t.time)); const b = balanceLine(tasks, cycle); const eff = total / (b.stations * cycle); return { cycle, total, Nmin: Math.ceil(total / cycle - 1e-9), N: b.stations, eff: eff * 100, delay: (1 - eff) * 100, idle: b.stations * cycle - total, station: b.station }; },
  steps: (v, o, c) => { const tasks = parseTasks(v.tasks); const st: Record<number, string[]> = {}; o.station.forEach((s: number, i: number) => (st[s] ??= []).push(tasks[i].id)); return [
    { title: 'Cycle time', tex: `C = ${fr(tx('Available time'), tx('Required output'))} = ${fr(c.f.t(v.avail), c.f.t(v.demand))} = ${c.f.t(o.cycle, 3)}`, why: 'The maximum time each station may spend on a unit if the line is to meet demand.' },
    { title: 'Theoretical minimum number of stations', tex: `N_{min} = \\left\\lceil ${fr('\\sum t_i', 'C')} \\right\\rceil = \\left\\lceil ${fr(c.f.t(o.total), c.f.t(o.cycle, 3))} \\right\\rceil = ${o.Nmin}`, why: 'Total work content divided by cycle time, rounded up. Precedence rules may force more stations than this.', eli: 'If the job has 65 minutes of work and each person gets 12 minutes per unit, you need at least 6 people.' },
    { title: 'Assign tasks with the longest-task-time rule', why: 'At each station, among tasks whose predecessors are done and that still fit in the remaining time, pick the longest. Ties go to the task with more following tasks. Open a new station when nothing fits.', table: { columns: ['Station', 'Tasks', 'Time used', 'Idle'], rows: Object.keys(st).map((k) => { const used = sum(st[+k].map((id) => tasks.find((t) => t.id === id)!.time)); return [k, st[+k].join(', '), c.f.num(used), c.f.num(o.cycle - used, 3)]; }) } },
    { title: 'Efficiency and balance delay', tex: `${tx('Efficiency')} = ${fr('\\sum t_i', 'N \\times C')} = ${fr(c.f.t(o.total), `${o.N} \\times ${c.f.t(o.cycle, 3)}`)} = ${c.f.pct(o.eff)}, \\quad ${tx('Balance delay')} = ${c.f.pct(o.delay)}`, why: 'Efficiency is productive time over paid time. Balance delay is the idle share.' },
  ]; },
  biz: (v, o, f) => ({ headline: `You need ${f.int(o.N)} workstations, each with ${f.num(o.cycle, 1)} time units per unit of product.`, meaning: [`The line will be ${f.pct(o.eff, 0)} efficient, with ${f.num(o.idle, 1)} time units idle per cycle across all stations.`, o.N > o.Nmin ? `That is ${o.N - o.Nmin} more than the theoretical minimum of ${o.Nmin}, because of task sequence constraints.` : 'That matches the theoretical minimum.'], actions: ['Use the station table in "Show the math" as your first-pass job assignments.', 'Give the idle time at light stations to material handling or quality checks.', 'Re-balance whenever demand (and so cycle time) changes.'] }),
  viz: (v, o) => { const tasks = parseTasks(v.tasks); return { kind: 'network', variant: 'line', nodes: tasks.map((t, i) => ({ id: t.id, label: t.id, dur: t.time, group: o.station[i] })), edges: tasks.flatMap((t) => t.preds.map((p) => [p, t.id] as [string, string])) }; },
  traps: ['Round the minimum number of stations up, never down.', 'A heuristic can use more stations than the theoretical minimum.', 'Different heuristics (longest task, most followers, ranked positional weight) can give different valid answers.', 'Efficiency uses the actual number of stations, not the theoretical minimum.'],
  analogy: 'Splitting chores among roommates so everyone finishes in the same hour and nobody starts a job before the one it depends on is done.',
  convention: 'Assignment uses the longest task time heuristic; ties go to the task with the most following tasks, then to list order.',
  examples: [
    { title: 'Wing component', story: 'Nine tasks totaling 65 minutes. The line runs 480 minutes a day and must make 40 units.', v: { tasks: LB_DEF, avail: 480, demand: 40 }, expect: { cycle: 12, Nmin: 6, N: 6, eff: 90.28 } },
    { title: 'Toy wagon', story: 'Eleven tasks totaling 195 seconds. The line runs 420 minutes (25,200 seconds) a day and must make 500 wagons.', v: { tasks: WAGON, avail: 25200, demand: 500 }, expect: { cycle: 50.4, Nmin: 4, N: 4, eff: 96.73 } },
  ],
  practice: { ask: ['Nmin'], gen: (r) => { const n = 5; const tasks = Array.from({ length: n }, (_, i) => ({ id: 'ABCDE'[i], time: 2 + Math.floor(r() * 8), preds: i === 0 ? '' : 'ABCDE'[Math.floor(r() * i)] })); return { tasks, avail: 480, demand: [40, 48, 60][Math.floor(r() * 3)] }; }, prompt: (v) => `An assembly line has tasks ${v.tasks.map((t: any) => `${t.id} (${t.time} min${t.preds ? ', after ' + t.preds : ''})`).join(', ')}. With ${v.avail} minutes available per day and required output of ${v.demand} units, what is the theoretical minimum number of workstations?` },
  gen: (r) => { const n = 3 + Math.floor(r() * 9); const tasks = Array.from({ length: n }, (_, i) => { const preds: string[] = []; for (let j = 0; j < i; j++) if (r() < 1.4 / Math.max(1, i)) preds.push(`T${j + 1}`); return { id: `T${i + 1}`, time: 1 + Math.floor(r() * 12), preds: preds.join(',') }; }); const maxT = Math.max(...tasks.map((t) => t.time)); const cyc = maxT + Math.floor(r() * 10); return { tasks, avail: 480, demand: +(480 / cyc).toFixed(6) }; },
  uses: ['takt-time', 'cycle-time'],
  claim: 'Every assignment respects precedence and cycle time, and matches the true minimum station count on small lines checked by exhaustive search.',
});

export const learningCurve: CalcDef = calc({
  id: 'learning-curve', name: 'Learning Curve', short: 'Learning curve', cat: CAT,
  bq: 'How much faster will we get as we make more?',
  blurb: 'Time for the nth unit and cumulative time for the first n units when each doubling of output cuts unit time by a fixed percentage.',
  keywords: ['learning curve', 'experience curve', 'learning rate', 'unit time', 'cumulative time', 'T_n = T_1 n^b', 'doubling'],
  symptoms: ['how long will the next batch take', 'quote a repeat job', 'workers get faster', 'cost of the nth unit'],
  formula: () => `T_n = T_1 \\, n^{b}, \\quad b = ${fr('\\ln(\\text{learning rate})', '\\ln 2')}`,
  inputs: [num('T1', { sym: 'T_1', label: 'Time (or cost) for the first unit', blabel: 'Time or cost of the first unit', def: 125000, min: 0, rand: [10, 1000, 10], sens: true, cues: ['first unit', 'first one took'] }), pct('rate', { label: 'Learning rate', blabel: 'Learning rate (80% = each doubling takes 80% as long)', def: 85, min: 1, max: 100, rand: [70, 95, 5], sens: true, cues: ['learning curve', 'learning rate', '% learning'] }), int('n', { sym: 'n', label: 'Unit number', blabel: 'Which unit (or how many units)', def: 4, min: 1, max: 100000, rand: [2, 64, 1], sens: true, cues: ['th unit', 'units', 'unit number'] })],
  outputs: [out('Tn', 'Time for unit n', { sym: 'T_n', primary: true }), out('total', 'Cumulative time for n units', {}), out('avg', 'Average time per unit', {}), out('b', 'Learning exponent', { sym: 'b', dp: 4 })],
  compute: (v) => { const b = Math.log(v.rate / 100) / Math.log(2); let total = 0; for (let i = 1; i <= v.n; i++) total += v.T1 * Math.pow(i, b); return { b, Tn: v.T1 * Math.pow(v.n, b), total, avg: total / v.n }; },
  steps: (v, o, c) => [
    { title: 'Learning exponent', tex: `b = ${fr(`\\ln(${c.f.t(v.rate / 100, 2)})`, '\\ln 2')} = ${c.f.t(o.b, 4)}`, why: 'The exponent converts "each doubling takes r% as long" into a power of the unit number.' },
    { title: 'Time for unit n', tex: `T_{${v.n}} = T_1 \\, n^{b} = ${c.f.t(v.T1)} \\times ${v.n}^{${c.f.t(o.b, 4)}} = ${c.f.t(o.Tn)}`, why: 'Every time cumulative output doubles, unit time falls to the learning rate times its previous value.', eli: 'The second time you assemble furniture is faster than the first, and the fourth is faster again by the same proportion.', lookup: `Learning-curve table: unit factor for unit ${v.n} at ${v.rate}% is ${Math.pow(v.n, o.b).toFixed(4)}; cumulative factor is ${(o.total / (v.T1 || 1)).toFixed(4)}.` },
    { title: 'Cumulative time for the first n units', tex: `\\sum_{i=1}^{${v.n}} T_1 \\, i^{b} = ${c.f.t(o.total)}`, why: 'Add the time of every unit from 1 to n. Printed tables give this as T1 times a cumulative factor.' },
    { title: 'Average time per unit', tex: `${fr(c.f.t(o.total), v.n)} = ${c.f.t(o.avg)}`, why: 'Useful for quoting a price per unit on a batch.' },
  ],
  biz: (v, o, f) => ({ headline: `Unit ${f.int(v.n)} should take about ${f.num(o.Tn, 1)}, down from ${f.num(v.T1, 1)} for the first.`, meaning: [`The first ${f.int(v.n)} units take ${f.num(o.total, 1)} in total, an average of ${f.num(o.avg, 1)} each.`, `Each time output doubles, time per unit falls by ${f.pct(100 - v.rate, 0)}.`], actions: ['Quote repeat orders on the cumulative average, not the first-unit time.', 'Learning is not automatic: it comes from training, better tooling, and stable crews.', 'Breaks in production cause forgetting. Expect a partial reset after a long gap.'] }),
  viz: (v, o) => ({ kind: 'xy', x: { label: 'Unit number' }, y: { label: 'Time per unit', zero: true }, series: [{ name: 'Unit time', style: 'line', tone: 'accent', pts: pts((x) => v.T1 * Math.pow(x, o.b), 1, Math.max(v.n * 1.5, 8), 80) }], marks: [{ x: v.n, y: o.Tn, label: `Unit ${v.n}`, tone: 'accent' }] }),
  traps: ['The learning rate applies to doublings of cumulative output, not to each additional unit.', 'An 80% curve means 20% improvement per doubling. A 90% curve learns more slowly than an 80% curve.', 'Unit time and cumulative time use different table columns.'],
  analogy: 'Folding paper cranes: the first takes five minutes, the second four, the fourth a little over three. You keep improving, but each gain takes twice as many cranes.',
  convention: 'Unit (Crawford) learning curve: T_n is the time for the nth unit. Cumulative time is the exact sum of unit times.',
  examples: [
    { title: 'Shipbuilding', story: 'The first boat took 125,000 labor-hours. With an 85% learning curve, how long will the fourth boat take?', v: { T1: 125000, rate: 85, n: 4 }, expect: { Tn: 90312.5, total: 418176.9 } },
    { title: 'Eight units at 80%', story: 'The first unit took 100 hours on an 80% curve. Find the time for unit 8 and the total for all eight.', v: { T1: 100, rate: 80, n: 8 }, expect: { Tn: 51.2, total: 534.59 } },
  ],
  practice: { ask: ['Tn'], prompt: (v, f) => `The first unit of a new product took ${f.int(v.T1)} hours. With a ${f.pct(v.rate, 0)} learning curve, how long will unit ${f.int(v.n)} take?` },
  uses: [], mono: [['T1', 'Tn', 1], ['n', 'Tn', -1], ['rate', 'Tn', 1]],
});

export const capacityBreakEven: CalcDef = calc({
  id: 'capacity-break-even', name: 'Break-Even Analysis for Capacity', short: 'Break-even', cat: CAT,
  bq: 'How much do I need to sell to cover this investment?',
  blurb: 'Break-even point in units and dollars, profit at your expected volume, and the crossover point between two capacity options.',
  keywords: ['break-even', 'breakeven', 'bep', 'fixed cost', 'variable cost', 'contribution margin', 'crossover', 'capacity decision'],
  symptoms: ['will this investment pay off', 'how many do i need to sell', 'should i buy the machine', 'cover my fixed costs'],
  formula: () => `BEP_x = ${fr('F', 'P - V')}, \\quad BEP_{\\$} = ${fr('F', '1 - V/P')}`,
  inputs: [money('F', { sym: 'F', label: 'Fixed cost', blabel: 'Fixed costs (rent, equipment, salaries)', def: 10000, rand: [5000, 200000, 5000], sens: true, cues: ['fixed cost', 'fixed costs'] }), money('P', { sym: 'P', label: 'Price per unit', blabel: 'Selling price per unit', def: 4, min: 0.0001, rand: [20, 100, 5], sens: true, cues: ['price', 'sells for', 'selling price'] }), money('V', { sym: 'V', label: 'Variable cost per unit', blabel: 'Cost to make one more unit', def: 2.25, rand: [2, 18, 1], sens: true, cues: ['variable cost', 'direct cost', 'cost per unit'] }),
    num('volume', { label: 'Expected volume', blabel: 'Units you expect to sell', unit: 'units', def: 8000, min: 0, rand: [1000, 20000, 500], sens: true, cues: ['expected volume', 'expects to sell', 'forecast'] }),
    sel('compare', 'Compare with a second option', [['no', 'No'], ['yes', 'Yes: find the crossover volume']], 'no', { adv: true }),
    money('F2', { label: 'Option B fixed cost', def: 20000, rand: [10000, 400000, 5000], show: (v) => v.compare === 'yes' }), money('V2', { label: 'Option B variable cost per unit', def: 1.5, rand: [1, 15, 0.5], show: (v) => v.compare === 'yes' })],
  outputs: [out('bepUnits', 'Break-even volume', { sym: 'BEP_x', unit: 'units', primary: true }), out('bepDollars', 'Break-even revenue', { sym: 'BEP_{\\$}', fmt: 'money' }), out('profit', 'Profit at expected volume', { fmt: 'money' }), out('margin', 'Contribution per unit', { fmt: 'money', dp: 2 }), out('safety', 'Margin of safety', { fmt: 'pct' }), out('crossover', 'Crossover volume (A vs B)', { unit: 'units', show: (v) => v.compare === 'yes' })],
  check: (v) => (v.P <= v.V ? 'Price must be higher than variable cost per unit. Otherwise every sale loses money and there is no break-even point.' : v.compare === 'yes' && v.V2 === v.V ? 'The two options have the same variable cost, so their cost lines never cross.' : null),
  compute: (v) => { const margin = v.P - v.V; const bepUnits = v.F / margin; return { margin, bepUnits, bepDollars: v.F / (1 - v.V / v.P), profit: margin * v.volume - v.F, safety: v.volume > 0 ? ((v.volume - bepUnits) / v.volume) * 100 : 0, crossover: v.compare === 'yes' ? (v.F2 - v.F) / (v.V - v.V2) : 0 }; },
  steps: (v, o, c) => [
    { title: 'Contribution per unit', tex: `P - V = ${c.f.t(v.P)} - ${c.f.t(v.V)} = ${c.f.money(o.margin, 2)}`, why: 'Each unit sold contributes this much toward covering fixed costs.' },
    { title: 'Break-even in units', tex: `BEP_x = ${fr('F', 'P - V')} = ${fr(c.f.t(v.F), c.f.t(o.margin))} = ${c.f.t(o.bepUnits)} ${tx(' units')}`, why: 'Fixed costs divided by the contribution of each unit.', eli: 'If the stall costs $100 to rent and you make $2 per lemonade, you need to sell 50 cups before you earn anything.' },
    { title: 'Break-even in dollars', tex: `BEP_{\\$} = ${fr('F', '1 - V/P')} = ${fr(c.f.t(v.F), `1 - ${c.f.t(v.V)}/${c.f.t(v.P)}`)} = ${c.f.money(o.bepDollars, 2)}`, why: 'The same point expressed as sales revenue.' },
    { title: 'Profit at expected volume', tex: `(P - V)x - F = ${c.f.t(o.margin)}(${c.f.t(v.volume)}) - ${c.f.t(v.F)} = ${c.f.money(o.profit, 2)}`, why: 'Total contribution minus fixed costs.' },
    ...(v.compare === 'yes' ? [{ title: 'Crossover between the two options', tex: `x = ${fr('F_B - F_A', 'V_A - V_B')} = ${fr(`${c.f.t(v.F2)} - ${c.f.t(v.F)}`, `${c.f.t(v.V)} - ${c.f.t(v.V2)}`)} = ${c.f.t(o.crossover)} ${tx(' units')}`, why: 'Set the two total cost lines equal and solve for volume. Below this volume the low-fixed-cost option is cheaper; above it the low-variable-cost option wins.' }] : []),
  ],
  biz: (v, o, f) => ({ headline: `You break even at ${f.int(Math.ceil(o.bepUnits))} units (${f.money(o.bepDollars)} in sales).`, meaning: [o.profit >= 0 ? `At ${f.int(v.volume)} units you make ${f.money(o.profit)}, with a ${f.pct(o.safety, 0)} cushion before losses start.` : `At ${f.int(v.volume)} units you lose ${f.money(-o.profit)}. You are ${f.int(Math.ceil(o.bepUnits - v.volume))} units short of break-even.`, `Each unit contributes ${f.money(o.margin, 2)} toward fixed costs.`, ...(v.compare === 'yes' ? [`Option B becomes cheaper than option A above ${f.int(o.crossover)} units.`] : [])], actions: [o.profit >= 0 ? 'The investment clears break-even. Stress-test it with 20% lower volume.' : 'Raise price, cut variable cost, or find a cheaper way to add capacity before committing.', 'Use the crossover comparison to choose between a cheap flexible option and an expensive efficient one.'] }),
  viz: (v, o) => { const hi = Math.max(o.bepUnits * 2, v.volume * 1.3, 10); return { kind: 'xy', x: { label: 'Volume (units)' }, y: { label: 'Dollars', zero: true }, series: [{ name: 'Revenue', style: 'line', tone: 'good', pts: [[0, 0], [hi, v.P * hi]] }, { name: 'Total cost', style: 'line', tone: 'bad', pts: [[0, v.F], [hi, v.F + v.V * hi]] }, ...(v.compare === 'yes' ? [{ name: 'Option B cost', style: 'dash' as const, tone: 'alt' as const, pts: [[0, v.F2], [hi, v.F2 + v.V2 * hi]] as [number, number][] }] : [])], marks: [{ x: o.bepUnits, y: v.P * o.bepUnits, label: 'Break-even', tone: 'accent' }], vlines: [{ x: v.volume, label: 'Expected volume', tone: 'muted' }] }; },
  traps: ['Use contribution (P − V), not price, in the denominator.', 'Break-even in dollars is not break-even units times variable cost. It is units times price.', 'Round break-even units up: you cannot sell a fraction of a unit.'],
  analogy: 'A lemonade stand: the table rental is the hole you start in, and each cup sold fills it by the price minus the cost of lemons and sugar.',
  examples: [
    { title: 'Small manufacturer', story: 'Fixed costs are $10,000, variable cost is $2.25 per unit, and the price is $4.00.', v: { F: 10000, P: 4, V: 2.25, volume: 8000 }, expect: { bepUnits: 5714.29, bepDollars: 22857.14, profit: 4000 } },
    { title: 'Two process options', story: 'Option A has fixed cost $30,000 and variable cost $75. Option B has fixed cost $60,000 and variable cost $45. Price is $120.', v: { F: 30000, P: 120, V: 75, volume: 1500, compare: 'yes', F2: 60000, V2: 45 }, expect: { crossover: 1000, bepUnits: 666.67 } },
  ],
  practice: { ask: ['bepUnits'], prompt: (v, f) => `A firm has fixed costs of ${f.money(v.F)}, a variable cost of ${f.money(v.V)} per unit, and a selling price of ${f.money(v.P)}. What is the break-even point in units?` },
  uses: [], mono: [['F', 'bepUnits', 1], ['P', 'bepUnits', -1], ['V', 'bepUnits', 1]],
});

export default [littlesLaw, taktTime, cycleTime, throughput, bottleneck, utilization, efficiency, effectiveCapacity, oee, lineBalancing, learningCurve, capacityBreakEven];
