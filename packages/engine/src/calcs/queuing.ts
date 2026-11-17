// Waiting-line models.
import { calc, num, money, int, sel, out, fr, tx } from '../dsl';
import { mms, mmsPn, md1, kingman } from '../math/queue';
import type { CalcDef, InputDef, Vals, VizSpec } from '../types';

const CAT = 'queue';
const tuIn = () => sel('tu', 'Time unit of the rates', [['hour', 'per hour'], ['minute', 'per minute'], ['day', 'per day']], 'hour', { adv: true });
const lamIn = (def = 2, o: Partial<InputDef> = {}) => num('lambda', { sym: 'lam', label: 'Arrival rate λ', blabel: 'Customers arriving per hour', def, min: 0.0001, rand: [1, 60, 1], sens: true, cues: ['arrival rate', 'arrive at a rate of', 'arrive at', 'arriving at', 'arrive', 'arrivals'], help: 'Average number of arrivals per time unit.', ...o });
const muIn = (def = 3, o: Partial<InputDef> = {}) => num('mu', { sym: 'mu', label: 'Service rate μ (per server)', blabel: 'Customers one server can handle per hour', def, min: 0.0001, rand: [61, 120, 1], sens: true, cues: ['service rate', 'can serve', 'can service', 'can handle', 'can process', 'serves', 'handles'], help: 'Average number of customers one server completes per time unit when busy. If you know the average service time, μ = 1 / service time.', ...o });
const stable = (v: Vals, s = 1) => (v.lambda >= v.mu * s ? `The line would grow without limit: arrivals (${v.lambda} per ${v.tu ?? 'hour'}) are not less than total service capacity (${+(v.mu * s).toFixed(4)} per ${v.tu ?? 'hour'}). Add servers or speed up service until utilization is below 100%.` : null);
const mins = (v: Vals, t: number) => (v.tu === 'minute' ? t : v.tu === 'day' ? t * 24 * 60 : t * 60);
const qViz = (v: Vals, o: any, servers: number, cvs: number): VizSpec => ({ kind: 'queue', lambda: v.lambda, mu: v.mu, servers, cva: 1, cvs, Lq: o.Lq, Wq: o.Wq, rho: o.rho, timeUnit: v.tu ?? 'hour' });
const qBiz = (v: Vals, o: any, f: any, servers: number) => ({
  headline: `Customers wait about ${f.num(mins(v, o.Wq), 1)} minutes in line, with ${f.num(o.Lq, 1)} people waiting on average.`,
  meaning: [`${servers > 1 ? 'Servers are' : 'The server is'} busy ${f.pct(o.rho * 100, 0)} of the time.`, `Total time per customer including service: ${f.num(mins(v, o.Ws), 1)} minutes.`, o.rho > 0.85 ? 'You are in the danger zone: above about 85% utilization, small increases in traffic cause large jumps in waiting.' : 'There is reasonable slack. Waits stay stable if traffic rises a little.'],
  actions: [o.rho > 0.85 ? 'Add a server at peak times or shave the service time: either one cuts waits sharply.' : 'Staffing looks adequate. Recheck with your peak-hour arrival rate, not the daily average.', 'Reducing variability (appointments, standard work) shortens lines without adding staff.', 'Use the M/M/s calculator to compare staffing levels and costs.'],
});
const outsQ = () => [out('Lq', 'Average number waiting in line', { sym: 'Lq', primary: true, dp: 4 }), out('Wq', 'Average time waiting in line', { sym: 'Wq', dp: 4 }), out('Ls', 'Average number in the system', { sym: 'Ls', dp: 4 }), out('Ws', 'Average time in the system', { sym: 'Ws', dp: 4 }), out('rho', 'Utilization', { sym: 'rho', dp: 4 }), out('P0', 'Probability the system is empty', { sym: 'P0', dp: 4 })];

export const mm1: CalcDef = calc({
  id: 'mm1', name: 'M/M/1 Queue (Single Server)', short: 'M/M/1', cat: CAT,
  bq: 'How long will customers wait with one server?',
  blurb: 'Waiting time, line length, and utilization for one server with random (Poisson) arrivals and exponential service times.',
  keywords: ['m/m/1', 'mm1', 'single server queue', 'single channel', 'waiting line', 'queue', 'poisson arrivals', 'exponential service'],
  symptoms: ['customers are waiting too long', 'long line', 'one cashier', 'how long is the wait'],
  formula: (s) => `${s.Lq} = ${fr('\\lambda^2', '\\mu(\\mu - \\lambda)')}, \\quad ${s.Wq} = ${fr('\\lambda', '\\mu(\\mu - \\lambda)')}`,
  inputs: [lamIn(2), muIn(3), tuIn()],
  outputs: outsQ(),
  check: (v) => stable(v),
  compute: (v) => { const q = mms(v.lambda, v.mu, 1); return { ...q }; },
  steps: (v, o, c) => [
    { title: 'Utilization', tex: `${c.s.rho} = ${fr('\\lambda', '\\mu')} = ${fr(c.f.t(v.lambda), c.f.t(v.mu))} = ${c.f.t(o.rho, 4)}`, why: 'The fraction of time the server is busy. It must be below 1 or the line never clears.', eli: 'If 2 people arrive each hour and you can serve 3, you are busy two thirds of the time.' },
    { title: 'Average number in the system', tex: `${c.s.Ls} = ${fr('\\lambda', '\\mu - \\lambda')} = ${fr(c.f.t(v.lambda), `${c.f.t(v.mu)} - ${c.f.t(v.lambda)}`)} = ${c.f.t(o.Ls, 4)}`, why: 'Customers waiting plus the one being served, on average.' },
    { title: 'Average time in the system', tex: `${c.s.Ws} = ${fr(1, '\\mu - \\lambda')} = ${fr(1, `${c.f.t(v.mu)} - ${c.f.t(v.lambda)}`)} = ${c.f.t(o.Ws, 4)} ${tx(` ${v.tu}s`)}`, why: 'Waiting plus service time for a typical customer.' },
    { title: 'Average number waiting', tex: `${c.s.Lq} = ${fr('\\lambda^2', '\\mu(\\mu - \\lambda)')} = ${fr(`${c.f.t(v.lambda)}^2`, `${c.f.t(v.mu)}(${c.f.t(v.mu)} - ${c.f.t(v.lambda)})`)} = ${c.f.t(o.Lq, 4)}`, why: 'The line itself, excluding the customer in service.' },
    { title: 'Average time waiting', tex: `${c.s.Wq} = ${fr('\\lambda', '\\mu(\\mu - \\lambda)')} = ${c.f.t(o.Wq, 4)} ${tx(` ${v.tu}s`)}`, why: `Equivalent to Lq / λ (Little's Law). Random arrivals bunch up, so customers wait even though the server has spare capacity on average.`, eli: 'Even if you are fast enough on average, people do not arrive evenly. Sometimes three show up at once, and a line forms.' },
    { title: 'Probability of an empty system', tex: `${c.s.P0} = 1 - ${c.s.rho} = ${c.f.t(o.P0, 4)}`, why: 'The share of time nobody is there.' },
  ],
  biz: (v, o, f) => qBiz(v, o, f, 1),
  viz: (v, o) => qViz(v, o, 1, 1),
  traps: ['λ and μ must be rates in the same time unit. A service time of 20 minutes is a rate of 3 per hour.', 'Wq is in the same time unit as the rates. Convert hours to minutes when asked.', 'L values count customers, W values measure time. Lq excludes the customer being served.'],
  analogy: 'A single-lane coffee drive-through: cars arrive at random, each takes a different time, and a line forms even if the barista is idle a third of the time.',
  convention: 'Cachon & Terwiesch write utilization as u, time in queue as Tq and inventory in queue as Iq. Heizer and Jacobs use ρ, Wq and Lq.',
  examples: [
    { title: 'Muffler shop', story: 'Cars arrive at 2 per hour and one mechanic can service 3 per hour.', v: { lambda: 2, mu: 3 }, expect: { Ls: 2, Ws: 1, Lq: 1.3333, Wq: 0.6667, rho: 0.6667, P0: 0.3333 } },
    { title: 'Help desk', story: 'Tickets arrive at 10 per hour and the agent closes 12 per hour.', v: { lambda: 10, mu: 12 }, expect: { Ls: 5, Lq: 4.1667, Ws: 0.5, Wq: 0.4167 } },
  ],
  practice: { ask: ['Lq', 'Wq'], gen: (r) => { const mu = 6 + Math.floor(r() * 30); return { lambda: Math.max(1, Math.floor(mu * (0.4 + r() * 0.5))), mu, tu: 'hour' }; }, prompt: (v) => `Customers arrive at a single-server counter at ${v.lambda} per hour (Poisson) and the server can handle ${v.mu} per hour (exponential). Find the average number waiting in line and the average wait in line in hours.` },
  gen: (r) => { const mu = +(1 + r() * 100).toFixed(2); return { lambda: +(mu * (0.05 + r() * 0.9)).toFixed(3), mu, tu: 'hour' }; },
  uses: ['littles-law', 'utilization'], mono: [['lambda', 'Lq', 1], ['mu', 'Lq', -1]],
  claim: 'M/M/1 formulas match the average line length and wait in a simulated single-server queue.',
});

export const mmsCalc: CalcDef = calc({
  id: 'mms', name: 'M/M/s Queue (Multiple Servers, Erlang C)', short: 'M/M/s', cat: CAT,
  bq: 'How many staff do I need to keep waits short?',
  blurb: 'Waiting time and line length with several identical servers sharing one line, plus the staffing level that minimizes total cost.',
  keywords: ['m/m/s', 'm/m/c', 'mms', 'multi-server queue', 'erlang c', 'multiple channel', 'staffing', 'how many servers', 'how many cashiers', 'call center'],
  symptoms: ['how many staff do i need', 'how many cashiers', 'how many agents', 'staffing for saturday', 'should i open another register'],
  formula: (s) => `${s.P0} = \\left[\\sum_{n=0}^{${s.M}-1} ${fr('(\\lambda/\\mu)^n', 'n!')} + ${fr(`(\\lambda/\\mu)^{${s.M}}`, `${s.M}!\\,(1-${s.rho})`)}\\right]^{-1}`,
  inputs: [lamIn(2), muIn(3), int('s', { sym: 'M', label: 'Number of servers', blabel: 'Number of staff serving', def: 2, min: 1, max: 200, rand: [1, 8, 1], sens: true, cues: ['servers', 'mechanics', 'cashiers', 'tellers', 'agents', 'clerks', 'channels', 'registers'] }),
    money('cw', { label: 'Waiting cost per customer per time unit (optional)', blabel: 'Cost of a customer waiting one hour (optional)', def: 0, rand: [0, 60, 5], adv: true, cues: ['waiting cost', 'cost of waiting', 'goodwill'] }), money('cs', { label: 'Cost per server per time unit (optional)', blabel: 'Cost of one staff member per hour (optional)', def: 0, rand: [10, 40, 1], adv: true, cues: ['per server', 'wage', 'paid'] }), tuIn()],
  outputs: [...outsQ(), out('Pw', 'Probability a customer waits', { dp: 4 }), out('cost', 'Total cost per time unit', { fmt: 'money', dp: 2, show: (v) => v.cw > 0 || v.cs > 0 }), out('sBest', 'Lowest-cost number of servers', { fmt: 'int', show: (v) => v.cw > 0 && v.cs > 0 })],
  check: (v) => stable(v, v.s),
  compute: (v) => {
    const q = mms(v.lambda, v.mu, v.s); const cw = v.cw ?? 0, cs = v.cs ?? 0; let sBest = v.s, best = Infinity;
    if (cw > 0 && cs > 0) { const s0 = Math.floor(v.lambda / v.mu) + 1; for (let s = s0; s <= s0 + 60; s++) { const c2 = cs * s + cw * mms(v.lambda, v.mu, s).Ls; if (c2 < best - 1e-12) { best = c2; sBest = s; } } }
    return { ...q, cost: cs * v.s + cw * q.Ls, sBest };
  },
  steps: (v, o, c) => [
    { title: 'Offered load and utilization', tex: `${fr('\\lambda', '\\mu')} = ${c.f.t(v.lambda / v.mu, 4)}, \\quad ${c.s.rho} = ${fr('\\lambda', `${c.s.M}\\mu`)} = ${fr(c.f.t(v.lambda), `${v.s}(${c.f.t(v.mu)})`)} = ${c.f.t(o.rho, 4)}`, why: 'λ/μ is the number of servers the workload would keep busy on average. Dividing by the number of servers gives utilization, which must be below 1.' },
    { title: 'Probability the system is empty', tex: `${c.s.P0} = \\left[\\sum_{n=0}^{${v.s - 1}} ${fr('(\\lambda/\\mu)^n', 'n!')} + ${fr(`(\\lambda/\\mu)^{${v.s}}`, `${v.s}!\\,(1-${c.s.rho})`)}\\right]^{-1} = ${c.f.t(o.P0, 4)}`, why: 'Every other result is built from P0. The sum covers the states where a server is free; the last term covers all the states with a line.', lookup: `Multi-server tables list P0 by λ/μ = ${(v.lambda / v.mu).toFixed(2)} and ${v.s} servers: ${o.P0.toFixed(4)}.` },
    { title: 'Probability a customer has to wait (Erlang C)', tex: `P_w = ${fr(`(\\lambda/\\mu)^{${v.s}}`, `${v.s}!\\,(1-${c.s.rho})`)} ${c.s.P0} = ${c.f.t(o.Pw, 4)}`, why: 'The chance that all servers are busy when a customer arrives.', eli: 'How often does someone walk in and find every register taken?' },
    { title: 'Average number waiting', tex: `${c.s.Lq} = P_w ${fr(c.s.rho, `1 - ${c.s.rho}`)} = ${c.f.t(o.Pw, 4)} \\times ${fr(c.f.t(o.rho, 4), c.f.t(1 - o.rho, 4))} = ${c.f.t(o.Lq, 4)}`, why: 'Given that a line exists, its length follows the same pattern as a single fast server.' },
    { title: 'Waiting time and totals', tex: `${c.s.Wq} = ${fr(c.s.Lq, '\\lambda')} = ${c.f.t(o.Wq, 4)}, \\quad ${c.s.Ws} = ${c.s.Wq} + ${fr(1, '\\mu')} = ${c.f.t(o.Ws, 4)}, \\quad ${c.s.Ls} = ${c.s.Lq} + ${fr('\\lambda', '\\mu')} = ${c.f.t(o.Ls, 4)}`, why: 'Little’s Law converts between numbers and times. Add the service time (or the customers in service) for system-wide figures.' },
    ...(v.cw > 0 || v.cs > 0 ? [{ title: 'Total cost', tex: `${tx('Cost')} = c_s ${c.s.M} + c_w ${c.s.Ls} = ${c.f.t(v.cs)}(${v.s}) + ${c.f.t(v.cw)}(${c.f.t(o.Ls, 4)}) = ${c.f.money(o.cost, 2)}`, why: 'Staffing cost rises with each server while waiting cost falls. The best staffing level minimizes the sum.' }] : []),
  ],
  biz: (v, o, f) => { const b = qBiz(v, o, f, v.s); return { headline: `With ${f.int(v.s)} staff, customers wait about ${f.num(mins(v, o.Wq), 1)} minutes and ${f.pct(o.Pw * 100, 0)} of them wait at all.`, meaning: [...b.meaning, ...(v.cw > 0 && v.cs > 0 ? [`Total cost is ${f.money(o.cost, 2)} per ${v.tu}. The cheapest staffing level is ${f.int(o.sBest)}.`] : [])], actions: [v.cw > 0 && v.cs > 0 && o.sBest !== v.s ? `Move to ${f.int(o.sBest)} staff to minimize combined wage and waiting cost.` : 'Try one more and one fewer server with the slider to see how sharply waits change.', 'One shared line feeding all servers beats separate lines.', 'Staff for the peak hour arrival rate, then scale down off-peak.'] }; },
  viz: (v, o) => qViz(v, o, v.s, 1),
  traps: ['Utilization is λ / (s × μ), not λ / μ.', 'μ is the rate for one server, not the whole team.', 'Lq includes only people in line. Ls adds those being served (λ/μ on average).'],
  analogy: 'A bank with one line and several tellers: you go to whichever teller frees up first.',
  examples: [
    { title: 'Two mechanics', story: 'Cars arrive at 2 per hour and each of 2 mechanics can service 3 per hour.', v: { lambda: 2, mu: 3, s: 2 }, expect: { P0: 0.5, Ls: 0.75, Ws: 0.375, Lq: 0.0833, Wq: 0.0417 } },
    { title: 'Bank tellers', story: 'Customers arrive at 40 per hour. Each of 3 tellers serves 15 per hour.', v: { lambda: 40, mu: 15, s: 3 }, expect: { rho: 0.8889, P0: 0.028, Lq: 6.38, Pw: 0.7975 } },
  ],
  practice: { ask: ['Lq', 'Wq'], gen: (r) => { const s = 2 + Math.floor(r() * 3), mu = 4 + Math.floor(r() * 12); return { lambda: Math.max(1, Math.floor(s * mu * (0.5 + r() * 0.4))), mu, s, cw: 0, cs: 0, tu: 'hour' }; }, prompt: (v) => `Customers arrive at ${v.lambda} per hour. There are ${v.s} servers, each able to serve ${v.mu} per hour (M/M/s). Find the average number waiting in line and the average wait in line in hours.` },
  gen: (r) => { const s = 1 + Math.floor(r() * 12), mu = +(1 + r() * 50).toFixed(2); return { lambda: +(s * mu * (0.05 + r() * 0.9)).toFixed(3), mu, s, cw: r() < 0.5 ? 0 : Math.floor(r() * 80), cs: r() < 0.5 ? 0 : 5 + Math.floor(r() * 50), tu: 'hour' }; },
  uses: ['mm1'], mono: [['s', 'Lq', -1], ['lambda', 'Lq', 1]],
  claim: 'M/M/s (Erlang C) results match the simulated wait, line length, and probability of waiting.',
});

export const md1Calc: CalcDef = calc({
  id: 'md1', name: 'M/D/1 Queue (Constant Service Time)', short: 'M/D/1', cat: CAT,
  bq: 'How long is the wait when every job takes exactly the same time?',
  blurb: 'Single-server queue with random arrivals and a fixed service time, such as an automated machine or car wash.',
  keywords: ['m/d/1', 'md1', 'constant service time', 'deterministic service', 'automatic car wash', 'automated machine queue'],
  symptoms: ['automated machine', 'fixed service time', 'car wash line', 'robot queue'],
  formula: (s) => `${s.Lq} = ${fr('\\lambda^2', '2\\mu(\\mu - \\lambda)')}, \\quad ${s.Wq} = ${fr('\\lambda', '2\\mu(\\mu - \\lambda)')}`,
  inputs: [lamIn(8), muIn(12), tuIn()],
  outputs: outsQ(),
  check: (v) => stable(v),
  compute: (v) => ({ ...md1(v.lambda, v.mu) }),
  steps: (v, o, c) => [
    { title: 'Average number waiting', tex: `${c.s.Lq} = ${fr('\\lambda^2', '2\\mu(\\mu - \\lambda)')} = ${fr(`${c.f.t(v.lambda)}^2`, `2(${c.f.t(v.mu)})(${c.f.t(v.mu)} - ${c.f.t(v.lambda)})`)} = ${c.f.t(o.Lq, 4)}`, why: 'With no variability in service time, the line is exactly half as long as in the M/M/1 model.', eli: 'A machine that always takes the same time causes fewer pile-ups than a person who is sometimes quick and sometimes slow.' },
    { title: 'Average time waiting', tex: `${c.s.Wq} = ${fr('\\lambda', '2\\mu(\\mu - \\lambda)')} = ${c.f.t(o.Wq, 4)} ${tx(` ${v.tu}s`)}`, why: 'Also half the M/M/1 wait.' },
    { title: 'System totals', tex: `${c.s.Ls} = ${c.s.Lq} + ${fr('\\lambda', '\\mu')} = ${c.f.t(o.Ls, 4)}, \\quad ${c.s.Ws} = ${c.s.Wq} + ${fr(1, '\\mu')} = ${c.f.t(o.Ws, 4)}`, why: 'Add the customer in service and the service time.' },
  ],
  biz: (v, o, f) => qBiz(v, o, f, 1),
  viz: (v, o) => qViz(v, o, 1, 0),
  traps: ['Do not use M/M/1 formulas here: constant service halves the queue.', 'Ls and Ws still add λ/μ and 1/μ.'],
  analogy: 'An automatic car wash: every wash takes exactly the same time, so the only randomness is when cars show up.',
  examples: [
    { title: 'Recycling compactor', story: 'Trucks arrive at 8 per hour and the compactor processes exactly 12 per hour.', v: { lambda: 8, mu: 12 }, expect: { Wq: 0.0833, Lq: 0.6667 } },
    { title: 'Car wash', story: 'Cars arrive at 10 per hour and the wash handles 15 per hour at a constant rate.', v: { lambda: 10, mu: 15 }, expect: { Lq: 0.6667, Wq: 0.0667, Ls: 1.3333, Ws: 0.1333 } },
  ],
  practice: { ask: ['Lq', 'Wq'], gen: (r) => { const mu = 6 + Math.floor(r() * 30); return { lambda: Math.max(1, Math.floor(mu * (0.4 + r() * 0.5))), mu, tu: 'hour' }; }, prompt: (v) => `Trucks arrive at an automated station at ${v.lambda} per hour (Poisson). The station processes exactly ${v.mu} per hour. Find the average number waiting and the average wait in hours.` },
  gen: (r) => { const mu = +(1 + r() * 100).toFixed(2); return { lambda: +(mu * (0.05 + r() * 0.9)).toFixed(3), mu, tu: 'hour' }; },
  uses: ['mm1'], mono: [['lambda', 'Lq', 1], ['mu', 'Lq', -1]],
  claim: 'M/D/1 results match a simulated queue with constant service times.',
});

export const kingmanCalc: CalcDef = calc({
  id: 'kingman', name: "Kingman's Approximation (VUT)", short: 'Kingman (VUT)', cat: CAT,
  bq: 'How much does variability add to my wait times?',
  blurb: 'Approximate waiting time for any arrival and service pattern: Variability × Utilization × Time, with one or more servers.',
  keywords: ['kingman', 'vut', 'vut equation', 'g/g/1', 'g/g/m', 'coefficient of variation', 'variability', 'waiting time formula', 'sakasegawa'],
  symptoms: ['wait times are unpredictable', 'variability causes delays', 'appointments run late', 'general queue'],
  formula: () => `T_q \\approx \\left(${fr('p', 'm')}\\right) \\left(${fr('u^{\\sqrt{2(m+1)}-1}', '1-u')}\\right) \\left(${fr('CV_a^2 + CV_p^2', 2)}\\right)`,
  inputs: [num('a', { sym: 'a', label: 'Average time between arrivals', blabel: 'Average minutes between arrivals', def: 5, min: 0.0001, rand: [11, 30, 1], sens: true, cues: ['interarrival', 'between arrivals', 'arrives every', 'one every'] }), num('p', { sym: 'p', label: 'Average service (processing) time', blabel: 'Average minutes to serve one customer', def: 4, min: 0.0001, rand: [2, 10, 1], sens: true, cues: ['processing time', 'service time', 'takes on average', 'activity time'] }),
    int('m', { sym: 'm', label: 'Number of servers', blabel: 'Number of staff serving', def: 1, min: 1, max: 200, rand: [1, 5, 1], sens: true, cues: ['servers', 'agents', 'operators', 'doctors'] }),
    num('cva', { sym: 'CV_a', label: 'Coefficient of variation of interarrival times', blabel: 'Arrival variability (1 = random walk-ins, 0 = perfect appointments)', def: 1, min: 0, max: 10, step: 0.1, rand: [0, 2, 0.25], sens: true, cues: ['cv of arrivals', 'coefficient of variation of the interarrival', 'cva'] }), num('cvp', { sym: 'CV_p', label: 'Coefficient of variation of service times', blabel: 'Service variability (1 = very uneven, 0 = always the same)', def: 1, min: 0, max: 10, step: 0.1, rand: [0, 2, 0.25], sens: true, cues: ['cv of service', 'coefficient of variation of the processing', 'cvp', 'cv of processing'] })],
  outputs: [out('Wq', 'Average time waiting', { sym: 'Wq', primary: true, dp: 3 }), out('u', 'Utilization', { sym: 'rho', dp: 4 }), out('Lq', 'Average number waiting', { sym: 'Lq', dp: 3 }), out('Ws', 'Average time in the system', { sym: 'Ws', dp: 3 }), out('V', 'Variability factor', { dp: 4 }), out('U', 'Utilization factor', { dp: 4 })],
  check: (v) => (v.p / (v.a * v.m) >= 1 ? `Utilization would be ${((v.p / (v.a * v.m)) * 100).toFixed(0)}%: work arrives faster than ${v.m} server(s) can handle it. Add servers, shorten the service time, or space out arrivals.` : null),
  compute: (v) => { const k = kingman(v.a, v.p, v.m, v.cva, v.cvp); return { ...k, rho: k.u, V: (v.cva ** 2 + v.cvp ** 2) / 2, U: Math.pow(k.u, Math.sqrt(2 * (v.m + 1)) - 1) / (1 - k.u) }; },
  steps: (v, o, c) => [
    { title: 'Utilization', tex: `u = ${fr('p', 'a \\times m')} = ${fr(c.f.t(v.p), `${c.f.t(v.a)} \\times ${v.m}`)} = ${c.f.t(o.u, 4)}`, why: 'Service time divided by the time between arrivals per server: the share of time servers are busy.' },
    { title: 'Variability factor (V)', tex: `${fr('CV_a^2 + CV_p^2', 2)} = ${fr(`${c.f.t(v.cva)}^2 + ${c.f.t(v.cvp)}^2`, 2)} = ${c.f.t(o.V, 4)}`, why: 'The average of the squared coefficients of variation of arrivals and service. With CV = 1 for both, this equals 1 and the result matches the M/M/1 model.', eli: 'How lumpy are arrivals and how uneven is service? More lumpiness means longer waits.' },
    { title: 'Utilization factor (U)', tex: `${fr('u^{\\sqrt{2(m+1)}-1}', '1-u')} = ${fr(`${c.f.t(o.u, 4)}^{${c.f.t(Math.sqrt(2 * (v.m + 1)) - 1, 4)}}`, `1 - ${c.f.t(o.u, 4)}`)} = ${c.f.t(o.U, 4)}`, why: 'This term explodes as utilization approaches 1. For one server it simplifies to u / (1 − u).' },
    { title: 'Time factor (T) and the wait', tex: `T_q = ${fr('p', 'm')} \\times U \\times V = ${fr(c.f.t(v.p), v.m)} \\times ${c.f.t(o.U, 4)} \\times ${c.f.t(o.V, 4)} = ${c.f.t(o.Wq, 3)}`, why: 'Scale by the service time per server. The wait is in the same time unit as a and p.' },
    { title: 'Number waiting and total time', tex: `I_q = ${fr('T_q', 'a')} = ${c.f.t(o.Lq, 3)}, \\quad T = T_q + p = ${c.f.t(o.Ws, 3)}`, why: 'Little’s Law gives the line length. Total time adds the service itself.' },
  ],
  biz: (v, o, f) => ({ headline: `Expect a wait of about ${f.num(o.Wq, 1)} minutes before service starts.`, meaning: [`Staff are busy ${f.pct(o.u * 100, 0)} of the time and about ${f.num(o.Lq, 1)} customers are waiting on average.`, `Variability multiplies your wait by ${f.num(o.V, 2)} compared with a fully random process${o.V < 1 ? ', which means your consistency is already helping' : ''}.`, 'Three levers: lower utilization, lower variability, or shorter service time.'], actions: [o.V > 0.8 ? 'Smooth arrivals with appointments or reservations: it cuts waits without adding staff.' : 'Variability is already low. The remaining lever is capacity.', o.u > 0.85 ? 'Utilization is high. Even one more server will cut the wait dramatically.' : 'Utilization is moderate, so waits are driven mostly by variability.', 'Standardize the service steps to reduce service-time variation.'] }),
  viz: (v, o) => ({ kind: 'queue', lambda: 1 / v.a, mu: 1 / v.p, servers: v.m, cva: v.cva, cvs: v.cvp, Lq: o.Lq, Wq: o.Wq, rho: o.u, timeUnit: 'minute' }),
  traps: ['a and p are times, not rates, and must share a unit.', 'CV is standard deviation divided by mean. Exponential times have CV = 1; constant times have CV = 0.', 'This is an approximation. It is most accurate at high utilization.'],
  analogy: 'A doctor’s office: the tighter the schedule and the more uneven the appointments, the longer the waiting room fills.',
  convention: 'Cachon & Terwiesch form with a = interarrival time, p = processing time, m servers. For m = 1 this is Kingman’s G/G/1 formula.',
  examples: [
    { title: 'One server, random arrivals', story: 'A customer arrives every 5 minutes on average and service takes 4 minutes on average. Both are highly variable (CV = 1).', v: { a: 5, p: 4, m: 1, cva: 1, cvp: 1 }, expect: { u: 0.8, Wq: 16, Lq: 3.2 } },
    { title: 'Call center', story: 'A call arrives every 35 seconds and takes 120 seconds to handle. Four agents work the phones. Both CVs are 1.', v: { a: 35, p: 120, m: 4, cva: 1, cvp: 1 }, expect: { u: 0.8571, Wq: 150.47 } },
  ],
  practice: { ask: ['Wq'], gen: (r) => { const p = 2 + Math.floor(r() * 8), m = 1 + Math.floor(r() * 3); const a = Math.ceil((p / m) / (0.6 + r() * 0.3) * 2) / 2; return { a, p, m, cva: [0.5, 1, 1.5][Math.floor(r() * 3)], cvp: [0.5, 1, 1.5][Math.floor(r() * 3)] }; }, prompt: (v) => `Customers arrive every ${v.a} minutes on average (CV = ${v.cva}). Service takes ${v.p} minutes on average (CV = ${v.cvp}) and there ${v.m === 1 ? 'is 1 server' : `are ${v.m} servers`}. Estimate the average time in the queue in minutes.` },
  gen: (r) => { const p = +(0.5 + r() * 30).toFixed(2), m = 1 + Math.floor(r() * 8); return { a: +((p / m) / (0.05 + r() * 0.9)).toFixed(4), p, m, cva: +(r() * 2.5).toFixed(2), cvp: +(r() * 2.5).toFixed(2) }; },
  uses: ['mm1', 'mms'], mono: [['cva', 'Wq', 1], ['cvp', 'Wq', 1], ['m', 'Wq', -1]],
  claim: 'Kingman’s approximation is within a stated tolerance of the simulated wait for general arrival and service distributions.',
});

export const queueProbabilities: CalcDef = calc({
  id: 'queue-probabilities', name: 'Queue Probabilities: Waiting and Number in System', short: 'Queue probabilities', cat: CAT,
  bq: 'What are the chances of a long line or a long wait?',
  blurb: 'Probability a customer has to wait, probability of exactly or more than k in the system, and probability the wait exceeds a target time.',
  keywords: ['probability of waiting', 'erlang c', 'probability of n in system', 'Pn', 'P(n > k)', 'probability wait exceeds', 'service level in queue', 'number in system'],
  symptoms: ['chance of a long line', 'probability of waiting', 'how often is the line longer than', 'answer calls within'],
  formula: (s) => `P_n = (1 - ${s.rho})${s.rho}^n, \\quad P(n > k) = ${s.rho}^{k+1} \;\; (M/M/1)`,
  inputs: [lamIn(2), muIn(3), int('s', { sym: 'M', label: 'Number of servers', blabel: 'Number of staff serving', def: 1, min: 1, max: 100, rand: [1, 6, 1], sens: true, cues: ['servers', 'cashiers', 'tellers', 'agents'] }),
    int('k', { sym: 'k', label: 'Number in system k', blabel: 'Number of customers in the shop (k)', def: 3, min: 0, max: 150, rand: [0, 10, 1], sens: true, cues: ['more than', 'exactly', 'customers in the system'] }), num('t', { sym: 't', label: 'Waiting-time threshold t', blabel: 'Wait you consider too long (same time unit)', def: 0.5, min: 0, rand: [0, 1, 0.05], sens: true, cues: ['wait more than', 'longer than', 'within'] }), tuIn()],
  outputs: [out('Pw', 'Probability a customer waits', { primary: true, dp: 4 }), out('P0', 'Probability of an empty system', { sym: 'P0', dp: 4 }), out('Pk', 'Probability of exactly k in system', { sym: 'P_k', dp: 4 }), out('PmoreK', 'Probability of more than k in system', { sym: 'P(n>k)', dp: 4 }), out('PwaitT', 'Probability the wait in line exceeds t', { sym: 'P(W_q>t)', dp: 4 }), out('rho', 'Utilization', { sym: 'rho', dp: 4 })],
  check: (v) => stable(v, v.s),
  compute: (v) => { const q = mms(v.lambda, v.mu, v.s); let cum = 0; for (let n = 0; n <= v.k; n++) cum += mmsPn(v.lambda, v.mu, v.s, n, q.P0); return { rho: q.rho, P0: q.P0, Pw: q.Pw, Pk: mmsPn(v.lambda, v.mu, v.s, v.k, q.P0), PmoreK: Math.max(0, 1 - cum), PwaitT: q.Pw * Math.exp(-(v.s * v.mu - v.lambda) * v.t), pn: Array.from({ length: Math.min(Math.max(v.k + 6, 12), 40) }, (_, n) => mmsPn(v.lambda, v.mu, v.s, n, q.P0)) }; },
  steps: (v, o, c) => [
    { title: 'Utilization and empty-system probability', tex: `${c.s.rho} = ${fr('\\lambda', `${c.s.M}\\mu`)} = ${c.f.t(o.rho, 4)}, \\quad ${c.s.P0} = ${c.f.t(o.P0, 4)}`, why: v.s === 1 ? 'For one server, P0 = 1 − ρ.' : 'P0 comes from the M/M/s formula and anchors every other probability.' },
    { title: 'Probability of exactly n in the system', tex: v.s === 1 ? `P_n = (1 - ${c.s.rho})${c.s.rho}^n \;\\Rightarrow\; P_{${v.k}} = ${c.f.t(o.Pk, 4)}` : `P_n = ${fr('(\\lambda/\\mu)^n', 'n!')}${c.s.P0} \; (n \\le ${c.s.M}), \\quad P_n = ${fr('(\\lambda/\\mu)^n', `${c.s.M}!\\,${c.s.M}^{n-${c.s.M}}`)}${c.s.P0} \; (n > ${c.s.M}) \;\\Rightarrow\; P_{${v.k}} = ${c.f.t(o.Pk, 4)}`, why: 'Each state’s probability falls off geometrically once all servers are busy.', table: { columns: ['n', 'P(n)', 'Cumulative'], rows: o.pn.slice(0, Math.min(o.pn.length, v.k + 3)).map((p: number, n: number) => [n, p.toFixed(4), o.pn.slice(0, n + 1).reduce((a: number, b: number) => a + b, 0).toFixed(4)]), highlight: [v.k] } },
    { title: 'Probability of more than k in the system', tex: v.s === 1 ? `P(n > ${v.k}) = ${c.s.rho}^{${v.k}+1} = ${c.f.t(o.rho, 4)}^{${v.k + 1}} = ${c.f.t(o.PmoreK, 4)}` : `P(n > ${v.k}) = 1 - \\sum_{n=0}^{${v.k}} P_n = ${c.f.t(o.PmoreK, 4)}`, why: 'One minus the chance of k or fewer.', eli: 'How often is the place more crowded than you are comfortable with?' },
    { title: 'Probability a customer waits', tex: `P_w = ${c.f.t(o.Pw, 4)}`, why: v.s === 1 ? 'With one server, an arrival waits whenever the server is busy, which is ρ of the time.' : 'The Erlang C probability that all servers are busy on arrival.' },
    { title: 'Probability the wait exceeds t', tex: `P(W_q > t) = P_w \\, e^{-(${c.s.M}\\mu - \\lambda)t} = ${c.f.t(o.Pw, 4)} \\, e^{-(${c.f.t(v.s * v.mu)} - ${c.f.t(v.lambda)})(${c.f.t(v.t)})} = ${c.f.t(o.PwaitT, 4)}`, why: 'Among customers who wait, the wait is exponentially distributed with rate sμ − λ.' },
  ],
  biz: (v, o, f) => ({ headline: `${f.pct(o.Pw * 100, 0)} of customers have to wait, and ${f.pct(o.PwaitT * 100, 0)} wait longer than ${f.num(v.t, 2)} ${v.tu}s.`, meaning: [`The place is empty ${f.pct(o.P0 * 100, 0)} of the time.`, `There are more than ${f.int(v.k)} customers present ${f.pct(o.PmoreK * 100, 1)} of the time.`], actions: ['Set a service target such as "90% served within 5 minutes" and add staff until this calculator meets it.', 'Size your waiting area for the number in system you exceed only 5% of the time.'] }),
  viz: (v, o) => ({ kind: 'xy', x: { label: 'Number in system', cats: o.pn.map((_: number, n: number) => String(n)) }, y: { label: 'Probability', zero: true }, series: [{ name: 'P(n)', style: 'bars', tone: 'accent', pts: o.pn.map((p: number, n: number) => [n, p] as [number, number]) }], vlines: [{ x: v.k, label: `k = ${v.k}`, tone: 'warn' }] }),
  traps: ['"More than k" uses the exponent k + 1 in the M/M/1 shortcut.', '"In the system" includes customers being served. "In line" does not.', 'The time threshold must be in the same time unit as λ and μ.'],
  analogy: 'A weather forecast for your line: not the average wait, but the chance of a really bad one.',
  examples: [
    { title: 'Single mechanic', story: 'Cars arrive at 2 per hour and the mechanic handles 3 per hour. What is the chance of more than 3 cars in the shop, and of waiting more than half an hour?', v: { lambda: 2, mu: 3, s: 1, k: 3, t: 0.5 }, expect: { PmoreK: 0.1975, Pk: 0.0988, Pw: 0.6667, PwaitT: 0.4044 } },
    { title: 'Two mechanics', story: 'Same shop with 2 mechanics. Find the chance a customer waits and the chance of more than 2 cars present.', v: { lambda: 2, mu: 3, s: 2, k: 2, t: 0.5 }, expect: { P0: 0.5, Pk: 0.1111, Pw: 0.1667, PmoreK: 0.0556 } },
  ],
  practice: { ask: ['PmoreK'], gen: (r) => { const mu = 6 + Math.floor(r() * 20); return { lambda: Math.max(1, Math.floor(mu * (0.4 + r() * 0.5))), mu, s: 1, k: 1 + Math.floor(r() * 4), t: 0.25, tu: 'hour' }; }, prompt: (v) => `Customers arrive at ${v.lambda} per hour to a single server that handles ${v.mu} per hour (M/M/1). What is the probability that more than ${v.k} customers are in the system?` },
  gen: (r) => { const s = 1 + Math.floor(r() * 8), mu = +(1 + r() * 40).toFixed(2); return { lambda: +(s * mu * (0.05 + r() * 0.9)).toFixed(3), mu, s, k: Math.floor(r() * 15), t: +(r() * 2).toFixed(3), tu: 'hour' }; },
  uses: ['mm1', 'mms'], mono: [['k', 'PmoreK', -1], ['t', 'PwaitT', -1]],
  claim: 'State probabilities and the probability of waiting match their long-run frequencies in simulation.',
});

export default [mm1, mmsCalc, md1Calc, kingmanCalc, queueProbabilities];
