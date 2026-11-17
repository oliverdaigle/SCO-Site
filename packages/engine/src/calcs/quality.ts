// Quality: control charts, capability, six sigma metrics, cost of quality, Taguchi loss.
import { calc, num, money, pct, int, sel, series, out, fr, tx, pts } from '../dsl';
import { normCdf, normInv } from '../math/normal';
import { mean, sum, type Rng } from '../math/util';
import type { CalcDef, VizSpec } from '../types';

const CAT = 'quality';
/** Control chart constants (ASTM / Montgomery) for subgroup sizes 2 to 25: [A2, D3, D4, d2]. */
export const CC: Record<number, [number, number, number, number]> = {
  2: [1.88, 0, 3.267, 1.128], 3: [1.023, 0, 2.574, 1.693], 4: [0.729, 0, 2.282, 2.059], 5: [0.577, 0, 2.114, 2.326], 6: [0.483, 0, 2.004, 2.534], 7: [0.419, 0.076, 1.924, 2.704],
  8: [0.373, 0.136, 1.864, 2.847], 9: [0.337, 0.184, 1.816, 2.97], 10: [0.308, 0.223, 1.777, 3.078], 11: [0.285, 0.256, 1.744, 3.173], 12: [0.266, 0.283, 1.717, 3.258], 13: [0.249, 0.307, 1.693, 3.336],
  14: [0.235, 0.328, 1.672, 3.407], 15: [0.223, 0.347, 1.653, 3.472], 16: [0.212, 0.363, 1.637, 3.532], 17: [0.203, 0.378, 1.622, 3.588], 18: [0.194, 0.391, 1.608, 3.64], 19: [0.187, 0.403, 1.597, 3.689],
  20: [0.18, 0.415, 1.585, 3.735], 21: [0.173, 0.425, 1.575, 3.778], 22: [0.167, 0.434, 1.566, 3.819], 23: [0.162, 0.443, 1.557, 3.858], 24: [0.157, 0.451, 1.548, 3.895], 25: [0.153, 0.459, 1.541, 3.931],
};
const chartViz = (vals: number[], cl: number, ucl: number, lcl: number, ylabel: string, flagged: number[]): VizSpec => ({
  kind: 'xy', x: { label: 'Sample' }, y: { label: ylabel }, series: [{ name: ylabel, style: 'line', tone: 'accent', pts: vals.map((y, i) => [i + 1, y] as [number, number]) }],
  hlines: [{ y: ucl, label: 'UCL', tone: 'bad' }, { y: cl, label: 'Center line', tone: 'muted' }, { y: lcl, label: 'LCL', tone: 'bad' }], flagged,
});
const flag = (vals: number[], ucl: number, lcl: number) => vals.map((x, i) => (x > ucl + 1e-12 || x < lcl - 1e-12 ? i : -1)).filter((i) => i >= 0);

export const xbarR: CalcDef = calc({
  id: 'xbar-r-chart', name: 'X-bar and R Control Charts', short: 'X̄ and R charts', cat: CAT,
  bq: 'Is my process staying consistent on a measured value?',
  blurb: 'Control limits for the sample mean (X-bar) and sample range (R) of a measured characteristic, with out-of-control samples flagged.',
  keywords: ['x-bar chart', 'xbar chart', 'r chart', 'control chart', 'control limits', 'ucl', 'lcl', 'A2', 'D3', 'D4', 'spc', 'statistical process control', 'variables chart'],
  symptoms: ['is my process in control', 'product measurements drifting', 'weights vary', 'quality is inconsistent'],
  formula: () => `UCL_{\\bar{x}} = \\bar{\\bar{x}} + A_2\\bar{R}, \\quad LCL_{\\bar{x}} = \\bar{\\bar{x}} - A_2\\bar{R}, \\quad UCL_R = D_4\\bar{R}, \\quad LCL_R = D_3\\bar{R}`,
  inputs: [sel('mode', 'Data entered as', [['raw', 'Raw measurements'], ['summary', 'Sample means and ranges']], 'raw'),
    series('obs', { label: 'Measurements (sample by sample)', blabel: 'Measurements, one sample after another', def: [10, 12, 11, 13, 9, 11, 10, 12, 11, 13, 12, 14, 10, 10, 12, 12], minRows: 2, show: (v) => v.mode !== 'summary', help: 'Paste a grid from a spreadsheet with one sample per row. Values are read row by row and grouped by the sample size.' }),
    series('means', { label: 'Sample means', def: [12.1, 11.9, 12, 12.05, 11.95], minRows: 1, show: (v) => v.mode === 'summary', cues: ['sample means', 'means'] }), series('ranges', { label: 'Sample ranges', def: [0.2, 0.3, 0.25, 0.3, 0.2], minRows: 1, show: (v) => v.mode === 'summary', cues: ['ranges'] }),
    int('n', { sym: 'n', label: 'Sample (subgroup) size', blabel: 'Items measured in each sample', def: 4, min: 2, max: 25, cues: ['sample size', 'samples of', 'observations each', 'subgroup'] })],
  outputs: [out('xbb', 'Grand mean', { sym: '\\bar{\\bar{x}}', dp: 4, primary: true }), out('rbar', 'Average range', { sym: '\\bar{R}', dp: 4 }), out('uclX', 'UCL for X-bar', { dp: 4 }), out('lclX', 'LCL for X-bar', { dp: 4 }), out('uclR', 'UCL for R', { dp: 4 }), out('lclR', 'LCL for R', { dp: 4 }), out('nOut', 'Samples out of control', { fmt: 'int' }), out('sigma', 'Estimated process σ (R̄ / d2)', { dp: 4 })],
  check: (v) => (v.mode === 'summary' ? (v.means.length !== v.ranges.length ? 'Enter the same number of sample means and sample ranges.' : v.ranges.some((r: number) => r < 0) ? 'Ranges cannot be negative.' : null) : v.obs.length % v.n !== 0 ? `The number of measurements (${v.obs.length}) must be a multiple of the sample size (${v.n}).` : v.obs.length < v.n ? 'Enter at least one full sample.' : null),
  compute: (v) => {
    let means: number[], ranges: number[];
    if (v.mode === 'summary') { means = v.means; ranges = v.ranges; } else { means = []; ranges = []; for (let i = 0; i < v.obs.length; i += v.n) { const s = (v.obs as number[]).slice(i, i + v.n); means.push(mean(s)); ranges.push(Math.max(...s) - Math.min(...s)); } }
    const [A2, D3, D4, d2] = CC[v.n]; const xbb = mean(means), rbar = mean(ranges);
    const uclX = xbb + A2 * rbar, lclX = xbb - A2 * rbar, uclR = D4 * rbar, lclR = D3 * rbar; const outX = flag(means, uclX, lclX), outR = flag(ranges, uclR, lclR);
    return { means, ranges, A2, D3, D4, d2, xbb, rbar, uclX, lclX, uclR, lclR, outX, outR, nOut: new Set([...outX, ...outR]).size, sigma: rbar / d2 };
  },
  steps: (v, o, c) => [
    { title: 'Mean and range of each sample', why: 'The mean tracks where the process is centered. The range (largest minus smallest) tracks how spread out it is.', table: { columns: ['Sample', 'Mean', 'Range', 'Status'], rows: o.means.map((m: number, i: number) => [i + 1, c.f.num(m, 4), c.f.num(o.ranges[i], 4), o.outX.includes(i) || o.outR.includes(i) ? 'Out of control' : 'OK']), highlight: [...new Set([...o.outX, ...o.outR])] as number[] } },
    { title: 'Grand mean and average range', tex: `\\bar{\\bar{x}} = ${c.f.t(o.xbb, 4)}, \\quad \\bar{R} = ${c.f.t(o.rbar, 4)}`, why: 'These become the center lines of the two charts.' },
    { title: 'Look up the control chart factors', tex: `n = ${v.n}: \\quad A_2 = ${o.A2}, \\quad D_3 = ${o.D3}, \\quad D_4 = ${o.D4}`, lookup: `Control chart factor table, row n = ${v.n}: A2 = ${o.A2}, D3 = ${o.D3}, D4 = ${o.D4}.`, why: 'The factors convert the average range into three-sigma limits for a given sample size.', eli: 'These are ready-made multipliers from a table. They save you from computing standard deviations by hand.' },
    { title: 'X-bar chart limits', tex: `UCL_{\\bar{x}} = \\bar{\\bar{x}} + A_2\\bar{R} = ${c.f.t(o.xbb, 4)} + ${o.A2}(${c.f.t(o.rbar, 4)}) = ${c.f.t(o.uclX, 4)}, \\quad LCL_{\\bar{x}} = ${c.f.t(o.xbb, 4)} - ${o.A2}(${c.f.t(o.rbar, 4)}) = ${c.f.t(o.lclX, 4)}`, why: 'Sample means should fall inside these limits 99.7% of the time if only natural variation is present.' },
    { title: 'R chart limits', tex: `UCL_R = D_4\\bar{R} = ${o.D4}(${c.f.t(o.rbar, 4)}) = ${c.f.t(o.uclR, 4)}, \\quad LCL_R = D_3\\bar{R} = ${o.D3}(${c.f.t(o.rbar, 4)}) = ${c.f.t(o.lclR, 4)}`, why: 'Read the R chart first: if spread is out of control, the X-bar limits are not reliable.' },
  ],
  biz: (v, o, f) => ({ headline: o.nOut === 0 ? 'Your process is in control: every sample falls inside its limits.' : `${f.int(o.nOut)} sample${o.nOut > 1 ? 's are' : ' is'} out of control. Something changed in the process.`, meaning: [`Sample averages should stay between ${f.num(o.lclX, 3)} and ${f.num(o.uclX, 3)}.`, `Sample ranges should stay below ${f.num(o.uclR, 3)}.`, 'In control means consistent, not necessarily within customer specs. Check capability separately.'], actions: [o.nOut > 0 ? 'Investigate what was different for the flagged samples: operator, material lot, machine setting, time of day.' : 'Keep sampling on the same schedule and plot new points against these limits.', 'Do not adjust the process for points inside the limits. That adds variation.', 'Use the Process Capability calculator to compare this process with your spec limits.'] }),
  viz: (v, o) => chartViz(o.means, o.xbb, o.uclX, o.lclX, 'Sample mean', o.outX),
  traps: ['Use the factor row for your sample size n (items per sample), not the number of samples.', 'D3 is 0 for n of 6 or less, so the R chart has a lower limit of zero.', 'Control limits are not specification limits.', 'Factor tables differ in the third decimal between textbooks (for example D4 = 2.114 or 2.115 for n = 5).'],
  analogy: 'Guard rails on a road: staying between them is normal driving. Hitting one means something happened and you should find out what.',
  convention: 'Three-sigma limits using range-based factors A2, D3, D4 (ASTM values).',
  examples: [
    { title: 'Bottling line from summaries', story: 'Five samples of 5 bottles each have means 12.10, 11.90, 12.00, 12.05, 11.95 ounces and ranges 0.20, 0.30, 0.25, 0.30, 0.20.', v: { mode: 'summary', means: [12.1, 11.9, 12, 12.05, 11.95], ranges: [0.2, 0.3, 0.25, 0.3, 0.2], n: 5 }, expect: { xbb: 12, rbar: 0.25, uclX: 12.144, lclX: 11.856, uclR: 0.5285, lclR: 0 } },
    { title: 'Raw measurements', story: 'Four samples of 4: (10, 12, 11, 13), (9, 11, 10, 12), (11, 13, 12, 14), (10, 10, 12, 12).', v: { mode: 'raw', obs: [10, 12, 11, 13, 9, 11, 10, 12, 11, 13, 12, 14, 10, 10, 12, 12], n: 4 }, expect: { xbb: 11.375, rbar: 2.75, uclX: 13.3798, lclX: 9.3703, uclR: 6.2755 } },
  ],
  practice: { ask: ['uclX', 'lclX'], gen: (r) => { const n = [4, 5, 6][Math.floor(r() * 3)], base = 20 + Math.floor(r() * 80); return { mode: 'summary', n, means: Array.from({ length: 5 }, () => +(base + (r() - 0.5) * 2).toFixed(1)), ranges: Array.from({ length: 5 }, () => +(1 + r() * 2).toFixed(1)) }; }, prompt: (v) => `Samples of size ${v.n} have means ${v.means.join(', ')} and ranges ${v.ranges.join(', ')}. Find the upper and lower control limits for the X-bar chart.` },
  gen: (r) => { const n = 2 + Math.floor(r() * 24), k = 2 + Math.floor(r() * 20), base = 5 + r() * 200, sd = 0.2 + r() * 5; if (r() < 0.5) return { mode: 'raw', n, obs: Array.from({ length: n * k }, () => +(base + (r() + r() + r() - 1.5) * sd * 2).toFixed(2)) }; return { mode: 'summary', n, means: Array.from({ length: k }, () => +(base + (r() - 0.5) * sd).toFixed(3)), ranges: Array.from({ length: k }, () => +(r() * sd * 3).toFixed(3)) }; },
  uses: [], claim: 'With an in-control normal process, about 0.27% of sample means fall outside the X-bar limits in simulation.',
});

export const pChart: CalcDef = calc({
  id: 'p-chart', name: 'p-Chart (Fraction Defective)', short: 'p-chart', cat: CAT,
  bq: 'Is my defect rate stable, or is something going wrong?',
  blurb: 'Control limits for the fraction of defective items in each sample.',
  keywords: ['p-chart', 'p chart', 'fraction defective', 'percent defective', 'attribute control chart', 'proportion defective'],
  symptoms: ['defect rate jumped', 'error rate', 'percent defective', 'too many returns'],
  formula: () => `UCL_p = \\bar{p} + z\\sqrt{${fr('\\bar{p}(1-\\bar{p})', 'n')}}, \\quad LCL_p = \\bar{p} - z\\sqrt{${fr('\\bar{p}(1-\\bar{p})', 'n')}}`,
  inputs: [series('defects', { label: 'Number of defectives in each sample', blabel: 'Defective items found in each sample', def: [6, 5, 0, 1, 4, 2, 5, 3, 3, 2, 6, 1, 8, 7, 5, 4, 11, 3, 0, 4], minRows: 2, cues: ['defectives', 'errors', 'defects'] }), int('n', { sym: 'n', label: 'Sample size', blabel: 'Items inspected in each sample', def: 100, min: 1, cues: ['sample size', 'samples of', 'each sample'] }),
    num('z', { sym: 'z', label: 'Number of standard deviations', blabel: 'Limit width in standard deviations', def: 3, min: 0.1, max: 6, adv: true, cues: ['sigma limits', 'standard deviations'] })],
  outputs: [out('pbar', 'Average fraction defective', { sym: '\\bar{p}', dp: 4, primary: true }), out('ucl', 'Upper control limit', { dp: 4 }), out('lcl', 'Lower control limit', { dp: 4 }), out('sp', 'Standard deviation of p', { sym: '\\sigma_p', dp: 4 }), out('nOut', 'Samples out of control', { fmt: 'int' })],
  check: (v) => ((v.defects as number[]).some((d) => d < 0 || d > v.n) ? 'Each sample’s defective count must be between 0 and the sample size.' : null),
  compute: (v) => { const d = v.defects as number[]; const p = d.map((x) => x / v.n); const pbar = sum(d) / (d.length * v.n); const sp = Math.sqrt((pbar * (1 - pbar)) / v.n); const ucl = Math.min(1, pbar + v.z * sp), lcl = Math.max(0, pbar - v.z * sp); const outIdx = flag(p, ucl, lcl); return { p, pbar, sp, ucl, lcl, outIdx, nOut: outIdx.length }; },
  steps: (v, o, c) => [
    { title: 'Average fraction defective', tex: `\\bar{p} = ${fr(tx('Total defectives'), tx('Total inspected'))} = ${fr(c.f.t(sum(v.defects)), `${v.defects.length} \\times ${v.n}`)} = ${c.f.t(o.pbar, 4)}`, why: 'Pool every sample to estimate the process’s long-run defect rate.' },
    { title: 'Standard deviation of the sample proportion', tex: `\\sigma_p = \\sqrt{${fr('\\bar{p}(1-\\bar{p})', 'n')}} = \\sqrt{${fr(`${c.f.t(o.pbar, 4)}(${c.f.t(1 - o.pbar, 4)})`, v.n)}} = ${c.f.t(o.sp, 4)}`, why: 'Each item is defective or not (binomial), so the variation in a sample proportion depends on p̄ and the sample size.' },
    { title: 'Control limits', tex: `UCL = ${c.f.t(o.pbar, 4)} + ${c.f.t(v.z)}(${c.f.t(o.sp, 4)}) = ${c.f.t(o.ucl, 4)}, \\quad LCL = ${c.f.t(o.pbar, 4)} - ${c.f.t(v.z)}(${c.f.t(o.sp, 4)}) = ${c.f.t(o.lcl, 4)}`, why: o.pbar - v.z * o.sp < 0 ? 'The lower limit works out negative. A proportion cannot be below zero, so it is set to 0.' : 'Sample proportions outside these limits signal a change in the process.', eli: 'A few bad items per batch is normal. The limits tell you how many is too many to be just bad luck.' },
    { title: 'Check each sample', why: 'Compare every sample’s fraction defective with the limits.', table: { columns: ['Sample', 'Defectives', 'Fraction', 'Status'], rows: (v.defects as number[]).map((d, i) => [i + 1, d, o.p[i].toFixed(4), o.outIdx.includes(i) ? 'Out of control' : 'OK']), highlight: o.outIdx } },
  ],
  biz: (v, o, f) => ({ headline: o.nOut === 0 ? `Your defect rate is stable at about ${f.pct(o.pbar * 100, 1)}.` : `${f.int(o.nOut)} sample${o.nOut > 1 ? 's' : ''} broke the limits. Your defect rate is not stable.`, meaning: [`The long-run defect rate is ${f.pct(o.pbar * 100, 1)}.`, `A sample of ${f.int(v.n)} with more than ${f.int(Math.floor(o.ucl * v.n))} defectives is a real signal, not chance.`], actions: [o.nOut > 0 ? 'Find out what happened on the flagged samples before the next run.' : 'To get the rate itself down, change the process: the chart only tells you it is consistent.', 'A point below the lower limit is good news worth investigating too.'] }),
  viz: (v, o) => chartViz(o.p, o.pbar, o.ucl, o.lcl, 'Fraction defective', o.outIdx),
  traps: ['p̄ is total defectives over total items inspected, not the average of rounded percentages.', 'A negative lower limit becomes 0.', 'Use n = items per sample in the square root, not the number of samples.'],
  analogy: 'A baseball batting average: slumps and streaks happen by chance, but beyond a certain point you know the player has changed.',
  examples: [
    { title: 'Data entry errors', story: 'Twenty clerks each had 100 records checked. Errors found: 6, 5, 0, 1, 4, 2, 5, 3, 3, 2, 6, 1, 8, 7, 5, 4, 11, 3, 0, 4.', v: { defects: [6, 5, 0, 1, 4, 2, 5, 3, 3, 2, 6, 1, 8, 7, 5, 4, 11, 3, 0, 4], n: 100, z: 3 }, expect: { pbar: 0.04, ucl: 0.0988, lcl: 0, nOut: 1 } },
    { title: 'Small samples', story: 'Ten samples of 50 had 2, 3, 1, 4, 2, 3, 5, 2, 1, 2 defectives.', v: { defects: [2, 3, 1, 4, 2, 3, 5, 2, 1, 2], n: 50, z: 3 }, expect: { pbar: 0.05, sp: 0.0308, ucl: 0.1425, lcl: 0 } },
  ],
  practice: { ask: ['ucl'], gen: (r) => { const n = [50, 100, 200][Math.floor(r() * 3)]; return { defects: Array.from({ length: 8 }, () => Math.floor(n * (0.02 + r() * 0.06))), n, z: 3 }; }, prompt: (v) => `Samples of ${v.n} items had ${v.defects.join(', ')} defectives. What is the upper control limit of the 3-sigma p-chart?` },
  gen: (r) => { const n = 10 + Math.floor(r() * 500), p = 0.005 + r() * 0.3; return { defects: Array.from({ length: 2 + Math.floor(r() * 25) }, () => Math.min(n, Math.floor(n * p * (0.3 + r() * 1.5)))), n, z: [2, 3, 3, 3][Math.floor(r() * 4)] }; },
  uses: [], claim: 'With a stable defect rate, sample proportions fall inside the 3-sigma limits at the rate the binomial distribution predicts.',
});

export const cChart: CalcDef = calc({
  id: 'c-chart', name: 'c-Chart (Count of Defects)', short: 'c-chart', cat: CAT,
  bq: 'Is the number of defects or complaints per period stable?',
  blurb: 'Control limits for the count of defects per unit or per period.',
  keywords: ['c-chart', 'c chart', 'defects per unit', 'count of defects', 'number of defects', 'poisson control chart', 'complaints per day'],
  symptoms: ['complaints per week', 'defects per unit', 'errors per day', 'blemishes'],
  formula: () => `UCL_c = \\bar{c} + 3\\sqrt{\\bar{c}}, \\quad LCL_c = \\bar{c} - 3\\sqrt{\\bar{c}}`,
  inputs: [series('counts', { label: 'Number of defects in each unit or period', blabel: 'Defects or complaints counted each period', def: [3, 0, 8, 9, 6, 7, 4, 9, 8], minRows: 2, cues: ['complaints', 'defects', 'flaws', 'errors'] }), num('z', { sym: 'z', label: 'Number of standard deviations', def: 3, min: 0.1, max: 6, adv: true })],
  outputs: [out('cbar', 'Average count', { sym: '\\bar{c}', dp: 4, primary: true }), out('ucl', 'Upper control limit', { dp: 4 }), out('lcl', 'Lower control limit', { dp: 4 }), out('nOut', 'Periods out of control', { fmt: 'int' })],
  check: (v) => ((v.counts as number[]).some((x) => x < 0) ? 'Counts cannot be negative.' : null),
  compute: (v) => { const cbar = mean(v.counts); const s = Math.sqrt(cbar); const ucl = cbar + v.z * s, lcl = Math.max(0, cbar - v.z * s); const outIdx = flag(v.counts, ucl, lcl); return { cbar, s, ucl, lcl, outIdx, nOut: outIdx.length }; },
  steps: (v, o, c) => [
    { title: 'Average number of defects', tex: `\\bar{c} = ${fr(c.f.t(sum(v.counts)), v.counts.length)} = ${c.f.t(o.cbar, 4)}`, why: 'The center line is the mean count per unit or period.' },
    { title: 'Control limits', tex: `UCL = \\bar{c} + ${c.f.t(v.z)}\\sqrt{\\bar{c}} = ${c.f.t(o.cbar, 4)} + ${c.f.t(v.z)}(${c.f.t(o.s, 4)}) = ${c.f.t(o.ucl, 4)}, \\quad LCL = ${c.f.t(o.lcl, 4)}`, why: 'Counts of rare events follow a Poisson distribution, whose standard deviation is the square root of its mean.' + (o.cbar - v.z * o.s < 0 ? ' The lower limit is negative, so it is set to 0.' : ''), eli: 'If you usually get 6 complaints a day, 9 is nothing special. The limit tells you when a bad day is too bad to be chance.' },
  ],
  biz: (v, o, f) => ({ headline: o.nOut === 0 ? `Counts are stable, averaging ${f.num(o.cbar, 1)} per period.` : `${f.int(o.nOut)} period${o.nOut > 1 ? 's' : ''} fell outside the limits. Look into what happened.`, meaning: [`Anything up to ${f.int(Math.floor(o.ucl))} in one period is ordinary variation.`, 'Reacting to every up-and-down inside the limits wastes effort.'], actions: [o.nOut > 0 ? 'Review the flagged periods for a special cause.' : 'To lower the average itself, change the underlying process.', 'Keep the unit of inspection the same size each period (one day, one unit, 100 square feet).'] }),
  viz: (v, o) => chartViz(v.counts, o.cbar, o.ucl, o.lcl, 'Defects', o.outIdx),
  traps: ['Use a c-chart for counts of defects (many possible per unit), a p-chart for defective items (each item good or bad).', 'A negative lower limit becomes 0.'],
  analogy: 'Typos per page: one page with a few more than usual is normal, a page covered in them means something went wrong.',
  examples: [
    { title: 'Cab complaints', story: 'A taxi company logged 3, 0, 8, 9, 6, 7, 4, 9, 8 complaints over nine days.', v: { counts: [3, 0, 8, 9, 6, 7, 4, 9, 8] }, expect: { cbar: 6, ucl: 13.35, lcl: 0 } },
    { title: 'Fabric flaws', story: 'Flaws per bolt of cloth: 12, 15, 9, 14, 10, 18, 13, 11, 16, 12.', v: { counts: [12, 15, 9, 14, 10, 18, 13, 11, 16, 12] }, expect: { cbar: 13, ucl: 23.817, lcl: 2.183 } },
  ],
  practice: { ask: ['ucl'], gen: (r) => ({ counts: Array.from({ length: 8 }, () => 2 + Math.floor(r() * 14)), z: 3 }), prompt: (v) => `The number of defects found in ${v.counts.length} units was ${v.counts.join(', ')}. What is the upper control limit of the 3-sigma c-chart?` },
  gen: (r) => ({ counts: Array.from({ length: 2 + Math.floor(r() * 25) }, () => Math.floor(r() * 40)), z: [2, 3, 3][Math.floor(r() * 3)] }),
  uses: [], claim: 'For Poisson counts, the share of points outside the 3-sigma limits matches the Poisson tail probabilities.',
});

export const capability: CalcDef = calc({
  id: 'process-capability', name: 'Process Capability (Cp and Cpk)', short: 'Cp and Cpk', cat: CAT,
  bq: 'Can my process reliably meet customer specifications?',
  blurb: 'Compares the natural spread of a process with its specification limits, with and without allowing for an off-center mean.',
  keywords: ['process capability', 'cp', 'cpk', 'capability index', 'capability ratio', 'specification limits', 'usl', 'lsl', 'six sigma'],
  symptoms: ['can we meet spec', 'too many out of spec', 'customer tolerance', 'is the process capable'],
  formula: () => `C_p = ${fr('USL - LSL', '6\\sigma')}, \\quad C_{pk} = \\min\\left(${fr('USL - \\mu', '3\\sigma')}, ${fr('\\mu - LSL', '3\\sigma')}\\right)`,
  inputs: [num('usl', { sym: 'USL', label: 'Upper specification limit', blabel: 'Largest acceptable value', def: 213, rand: [105, 130, 1], sens: true, cues: ['upper specification', 'upper spec', 'usl', 'maximum'] }), num('lsl', { sym: 'LSL', label: 'Lower specification limit', blabel: 'Smallest acceptable value', def: 207, rand: [70, 95, 1], sens: true, cues: ['lower specification', 'lower spec', 'lsl', 'minimum'] }),
    num('mean', { sym: '\\mu', label: 'Process mean', blabel: 'Average value the process produces', def: 210, rand: [96, 104, 0.5], sens: true, cues: ['process mean', 'mean of', 'average of', 'centered at'] }), num('sigma', { sym: '\\sigma', label: 'Process standard deviation', blabel: 'How much the process varies (std. deviation)', def: 0.516, min: 0.0000001, rand: [0.5, 6, 0.25], sens: true, cues: ['standard deviation', 'sigma'] })],
  outputs: [out('cpk', 'Cpk', { sym: 'C_{pk}', dp: 3, primary: true }), out('cp', 'Cp', { sym: 'C_p', dp: 3 }), out('cpu', 'Upper capability (Cpu)', { dp: 3 }), out('cpl', 'Lower capability (Cpl)', { dp: 3 }), out('ppm', 'Expected defects per million', { fmt: 'num', dp: 1 }), out('yieldPct', 'Expected yield', { fmt: 'pct', dp: 4 })],
  check: (v) => (v.usl <= v.lsl ? 'The upper specification limit must be greater than the lower one.' : null),
  compute: (v) => { const cp = (v.usl - v.lsl) / (6 * v.sigma), cpu = (v.usl - v.mean) / (3 * v.sigma), cpl = (v.mean - v.lsl) / (3 * v.sigma); const pOut = 1 - normCdf((v.usl - v.mean) / v.sigma) + normCdf((v.lsl - v.mean) / v.sigma); return { cp, cpu, cpl, cpk: Math.min(cpu, cpl), ppm: pOut * 1e6, yieldPct: (1 - pOut) * 100 }; },
  steps: (v, o, c) => [
    { title: 'Capability ratio Cp', tex: `C_p = ${fr('USL - LSL', '6\\sigma')} = ${fr(`${c.f.t(v.usl)} - ${c.f.t(v.lsl)}`, `6(${c.f.t(v.sigma, 4)})`)} = ${c.f.t(o.cp, 3)}`, why: 'Compares the width of the specification with the natural width of the process (six standard deviations). It ignores whether the process is centered.', eli: 'Is the car narrower than the garage door? Cp only checks widths, not whether you are driving straight at the opening.' },
    { title: 'One-sided capabilities', tex: `${fr('USL - \\mu', '3\\sigma')} = ${fr(`${c.f.t(v.usl)} - ${c.f.t(v.mean)}`, `3(${c.f.t(v.sigma, 4)})`)} = ${c.f.t(o.cpu, 3)}, \\quad ${fr('\\mu - LSL', '3\\sigma')} = ${fr(`${c.f.t(v.mean)} - ${c.f.t(v.lsl)}`, `3(${c.f.t(v.sigma, 4)})`)} = ${c.f.t(o.cpl, 3)}`, why: 'Distance from the mean to each limit, measured in units of three standard deviations.' },
    { title: 'Capability index Cpk', tex: `C_{pk} = \\min(${c.f.t(o.cpu, 3)}, ${c.f.t(o.cpl, 3)}) = ${c.f.t(o.cpk, 3)}`, why: 'The process is only as capable as its worse side. Cpk equals Cp when the process is perfectly centered and is smaller otherwise.', eli: 'Now check whether you are actually lined up with the garage door. The tighter side is what matters.' },
    { title: 'Expected defects', tex: `P(\\text{out of spec}) = 1 - \\Phi\\left(${fr('USL - \\mu', '\\sigma')}\\right) + \\Phi\\left(${fr('LSL - \\mu', '\\sigma')}\\right) = ${c.f.t(o.ppm, 1)} ${tx(' per million')}`, why: 'Assuming a normal process, the tails beyond each limit give the share of output out of spec.' },
  ],
  biz: (v, o, f) => ({ headline: o.cpk >= 1.33 ? `Your process comfortably meets spec (Cpk ${f.num(o.cpk, 2)}).` : o.cpk >= 1 ? `Your process just meets spec (Cpk ${f.num(o.cpk, 2)}), with little margin.` : `Your process cannot reliably meet spec (Cpk ${f.num(o.cpk, 2)}).`, meaning: [`Expect about ${f.num(o.ppm, 0)} out-of-spec units per million (${f.pct(o.yieldPct, 2)} yield).`, Math.abs(o.cp - o.cpk) > 0.1 ? `The process is off-center: centering it would lift Cpk to ${f.num(o.cp, 2)} for free.` : 'The process is well centered, so only reducing variation will improve it.', 'Common targets: 1.33 for existing processes, 1.67 for safety-critical ones, 2.0 for six sigma.'], actions: [Math.abs(o.cp - o.cpk) > 0.1 ? 'Adjust the process mean toward the middle of the spec range first.' : 'Reduce variation: tighter materials, maintenance, standard work.', 'If Cpk is below 1, inspect 100% until the process is fixed.'] }),
  viz: (v, o) => { const s = v.sigma; const lo = Math.min(v.lsl, v.mean - 4 * s) - s * 0.5, hi = Math.max(v.usl, v.mean + 4 * s) + s * 0.5; return { kind: 'xy', x: { label: 'Measured value' }, y: { label: 'Likelihood', zero: true }, series: [{ name: 'Process output', style: 'line', tone: 'accent', pts: pts((x) => Math.exp(-0.5 * ((x - v.mean) / s) ** 2) / (s * 2.5066282746310002), lo, hi, 140) }], shade: [{ x0: v.lsl, x1: v.usl, series: 0, tone: 'good', label: 'Within spec' }], vlines: [{ x: v.lsl, label: 'LSL', tone: 'bad' }, { x: v.usl, label: 'USL', tone: 'bad' }, { x: v.mean, label: 'Mean', tone: 'muted' }] }; },
  traps: ['Cp uses 6σ in the denominator, Cpk uses 3σ.', 'Cpk can never exceed Cp.', 'A capable process (high Cp) can still make defects if it is off-center (low Cpk).', 'Specification limits come from the customer. Control limits come from the process.'],
  analogy: 'Parking in a garage: Cp asks whether the car is narrower than the door. Cpk asks whether you are also lined up with it.',
  convention: 'Cp = (USL − LSL)/(6σ); Cpk = min((USL − μ)/(3σ), (μ − LSL)/(3σ)).',
  examples: [
    { title: 'Centered process', story: 'A claims process has a specification of 210 ± 3 minutes, a mean of 210 minutes, and a standard deviation of 0.516 minutes.', v: { usl: 213, lsl: 207, mean: 210, sigma: 0.516 }, expect: { cp: 1.938, cpk: 1.938 } },
    { title: 'Off-center process', story: 'Specification is 9.5 to 10.5. The process averages 10.2 with a standard deviation of 0.1.', v: { usl: 10.5, lsl: 9.5, mean: 10.2, sigma: 0.1 }, expect: { cp: 1.667, cpu: 1, cpl: 2.333, cpk: 1 } },
  ],
  practice: { ask: ['cp', 'cpk'], prompt: (v, f) => `A process has specification limits of ${f.num(v.lsl)} and ${f.num(v.usl)}, a mean of ${f.num(v.mean)}, and a standard deviation of ${f.num(v.sigma)}. Find Cp and Cpk.` },
  uses: ['xbar-r-chart'], mono: [['sigma', 'cp', -1], ['usl', 'cp', 1]],
  claim: 'The predicted out-of-spec rate matches the share of simulated normal output beyond the specification limits.',
});

export const dpmo: CalcDef = calc({
  id: 'dpmo-sigma', name: 'DPMO and Sigma Level', short: 'DPMO / sigma level', cat: CAT,
  bq: 'How good is my quality on the six sigma scale?',
  blurb: 'Defects per million opportunities, yield, and the corresponding sigma level.',
  keywords: ['dpmo', 'defects per million opportunities', 'sigma level', 'six sigma', 'dpu', 'yield', 'process sigma', '3.4 defects per million'],
  symptoms: ['how good is our quality', 'six sigma level', 'defect rate per million'],
  formula: () => `DPMO = ${fr(tx('Defects'), `${tx('Units')} \\times ${tx('Opportunities per unit')}`)} \\times 10^6`,
  inputs: [num('defects', { label: 'Number of defects', blabel: 'Defects found', def: 120, min: 0, rand: [1, 400, 1], sens: true, cues: ['defects', 'errors found'] }), num('units', { label: 'Number of units', blabel: 'Units checked', def: 2000, min: 0.0001, rand: [500, 20000, 100], cues: ['units', 'invoices', 'orders', 'items inspected'] }), num('opps', { label: 'Defect opportunities per unit', blabel: 'Ways each unit could be wrong', def: 5, min: 0.0001, rand: [1, 20, 1], cues: ['opportunities', 'opportunities per unit'] }),
    sel('shift', 'Sigma shift convention', [['1.5', 'Include the 1.5σ long-term shift (standard)'], ['0', 'No shift']], '1.5', { adv: true, help: 'Six sigma tables add 1.5σ to allow for long-term drift, which is why 3.4 DPMO is called "six sigma".' })],
  outputs: [out('dpmo', 'DPMO', { primary: true, dp: 1 }), out('sigma', 'Sigma level', { dp: 2 }), out('yieldPct', 'Yield', { fmt: 'pct', dp: 4 }), out('dpu', 'Defects per unit', { dp: 4 })],
  check: (v) => (v.defects > v.units * v.opps ? 'Defects cannot exceed total opportunities (units × opportunities per unit).' : null),
  compute: (v) => { const dpo = v.defects / (v.units * v.opps); return { dpo, dpmo: dpo * 1e6, dpu: v.defects / v.units, yieldPct: (1 - dpo) * 100, sigma: normInv(1 - dpo) + Number(v.shift ?? 1.5) }; },
  steps: (v, o, c) => [
    { title: 'Total opportunities', tex: `${c.f.t(v.units)} \\times ${c.f.t(v.opps)} = ${c.f.t(v.units * v.opps)}`, why: 'An opportunity is one chance for a defect. A form with 5 fields has 5 opportunities.' },
    { title: 'Defects per million opportunities', tex: `DPMO = ${fr(c.f.t(v.defects), c.f.t(v.units * v.opps))} \\times 10^6 = ${c.f.t(o.dpmo, 1)}`, why: 'Scaling to a million makes very small defect rates easy to compare.', eli: 'If you did this a million times, how many mistakes would there be?' },
    { title: 'Yield', tex: `1 - ${fr(tx('DPMO'), '10^6')} = ${c.f.pct(o.yieldPct, 4)}`, why: 'The share of opportunities with no defect.' },
    { title: 'Sigma level', tex: `\\Phi^{-1}(${c.f.t(o.yieldPct / 100, 6)}) + ${v.shift} = ${c.f.t(o.sigma, 2)}`, lookup: `Sigma conversion table: ${o.dpmo.toFixed(0)} DPMO is about ${o.sigma.toFixed(1)} sigma.`, why: `Convert the yield to a z-value${v.shift === '1.5' ? ' and add the conventional 1.5σ shift for long-term drift' : ''}.` },
  ],
  biz: (v, o, f) => ({ headline: `You are running at ${f.num(o.sigma, 1)} sigma: ${f.int(o.dpmo)} defects per million opportunities.`, meaning: [`Yield per opportunity is ${f.pct(o.yieldPct, 2)}.`, `Each unit carries ${f.num(o.dpu, 3)} defects on average.`, 'Reference points: 3 sigma is 66,807 DPMO, 4 sigma is 6,210, 5 sigma is 233, 6 sigma is 3.4.'], actions: ['Pareto the defect types: the top two usually account for most of the count.', 'Moving up one sigma level typically takes a tenfold reduction in defects, so set targets step by step.'] }),
  viz: (v, o) => ({ kind: 'meters', items: [{ label: 'Sigma level', value: Math.max(0, o.sigma), max: 6, text: o.sigma.toFixed(2) + 'σ', tone: 'accent' }, { label: 'Yield', value: o.yieldPct, max: 100, text: o.yieldPct.toFixed(2) + '%', tone: 'good' }] }),
  traps: ['Divide by opportunities, not just units.', 'The 1.5σ shift is a convention. Without it, 3.4 DPMO corresponds to about 4.5σ.', 'Do not inflate the number of opportunities to make quality look better.'],
  analogy: 'A golfer’s handicap for processes: one number that says how far you are from perfect.',
  convention: 'Sigma level = Φ⁻¹(1 − DPMO/10⁶) + 1.5 by default (the standard Motorola convention).',
  examples: [
    { title: 'Invoice errors', story: 'An audit of 2,000 invoices, each with 5 fields that could be wrong, found 120 errors.', v: { defects: 120, units: 2000, opps: 5 }, expect: { dpmo: 12000, sigma: 3.76, dpu: 0.06 } },
    { title: 'Six sigma benchmark', story: '34 defects in 1,000,000 units with 10 opportunities each.', v: { defects: 34, units: 1000000, opps: 10 }, expect: { dpmo: 3.4, sigma: 6 }, tol: 0.001 },
  ],
  practice: { ask: ['dpmo'], prompt: (v, f) => `An inspection of ${f.int(v.units)} units, each with ${f.int(v.opps)} defect opportunities, found ${f.int(v.defects)} defects. What is the DPMO?` },
  uses: ['process-capability'], mono: [['defects', 'dpmo', 1], ['units', 'dpmo', -1]],
});

export const costOfQuality: CalcDef = calc({
  id: 'cost-of-quality', name: 'Cost of Quality', short: 'Cost of quality', cat: CAT,
  bq: 'How much is poor quality costing me?',
  blurb: 'Adds up prevention, appraisal, internal failure, and external failure costs, and shows them as a share of sales.',
  keywords: ['cost of quality', 'coq', 'cost of poor quality', 'copq', 'prevention cost', 'appraisal cost', 'internal failure', 'external failure'],
  symptoms: ['what does poor quality cost', 'too much rework', 'warranty costs', 'returns are expensive'],
  formula: () => `COQ = ${tx('Prevention')} + ${tx('Appraisal')} + ${tx('Internal failure')} + ${tx('External failure')}`,
  inputs: [money('prevention', { label: 'Prevention costs', blabel: 'Training, process design, supplier qualification', def: 20000, rand: [5000, 80000, 5000], sens: true, cues: ['prevention', 'training'] }), money('appraisal', { label: 'Appraisal costs', blabel: 'Inspection, testing, audits', def: 30000, rand: [5000, 80000, 5000], sens: true, cues: ['appraisal', 'inspection', 'testing'] }),
    money('internal', { label: 'Internal failure costs', blabel: 'Scrap, rework, downtime (caught before shipping)', def: 60000, rand: [5000, 150000, 5000], sens: true, cues: ['internal failure', 'scrap', 'rework'] }), money('external', { label: 'External failure costs', blabel: 'Returns, warranty, complaints (caught by customers)', def: 90000, rand: [5000, 200000, 5000], sens: true, cues: ['external failure', 'warranty', 'returns'] }),
    money('sales', { label: 'Sales revenue', blabel: 'Sales for the same period', def: 2000000, min: 0.0001, rand: [500000, 5000000, 100000], cues: ['sales', 'revenue'] })],
  outputs: [out('total', 'Total cost of quality', { fmt: 'money', primary: true }), out('pctSales', 'As a share of sales', { fmt: 'pct' }), out('conformance', 'Cost of good quality (prevention + appraisal)', { fmt: 'money' }), out('failure', 'Cost of poor quality (failures)', { fmt: 'money' }), out('failShare', 'Failure share of total', { fmt: 'pct' })],
  compute: (v) => { const conformance = v.prevention + v.appraisal, failure = v.internal + v.external, total = conformance + failure; return { total, conformance, failure, pctSales: (total / v.sales) * 100, failShare: total > 0 ? (failure / total) * 100 : 0 }; },
  steps: (v, o, c) => [
    { title: 'Cost of good quality', tex: `${c.f.t(v.prevention)} + ${c.f.t(v.appraisal)} = ${c.f.money(o.conformance)}`, why: 'Money spent to prevent defects and to find them.', eli: 'What you spend to get it right.' },
    { title: 'Cost of poor quality', tex: `${c.f.t(v.internal)} + ${c.f.t(v.external)} = ${c.f.money(o.failure)}`, why: 'Money lost because defects happened, whether caught in-house or by customers.', eli: 'What you pay for getting it wrong.' },
    { title: 'Total and share of sales', tex: `COQ = ${c.f.money(o.total)}, \\quad ${fr(c.f.t(o.total), c.f.t(v.sales))} = ${c.f.pct(o.pctSales)}`, why: 'Expressing the total as a percent of sales makes it comparable over time and between companies.' },
  ],
  biz: (v, o, f) => ({ headline: `Quality costs you ${f.money(o.total)}, which is ${f.pct(o.pctSales, 1)} of sales.`, meaning: [`${f.pct(o.failShare, 0)} of that (${f.money(o.failure)}) is failure cost: money spent on things going wrong.`, v.external > v.internal ? 'Most failures reach customers, which is the most expensive place to find them.' : 'Most failures are caught in-house, which is cheaper than customers finding them.', 'Well-run operations sit near 5% of sales or less. 15 to 25% is common before any quality program.'], actions: [o.failShare > 60 ? 'Shift spending toward prevention: a dollar there typically saves several in failures.' : 'Your mix is balanced. Keep measuring it each quarter.', 'Attack the largest single failure category first.'] }),
  viz: (v) => ({ kind: 'stack', unit: '$', bars: [{ label: 'Cost of quality', parts: [{ name: 'Prevention', value: v.prevention, tone: 'good' }, { name: 'Appraisal', value: v.appraisal, tone: 'alt' }, { name: 'Internal failure', value: v.internal, tone: 'warn' }, { name: 'External failure', value: v.external, tone: 'bad' }] }] }),
  traps: ['Inspection is an appraisal cost, not prevention.', 'Rework found before shipping is internal failure. Warranty claims are external failure.'],
  analogy: 'Car maintenance: oil changes (prevention) and inspections (appraisal) cost a little. A seized engine on the highway (failure) costs a lot.',
  examples: [
    { title: 'Mid-size manufacturer', story: 'Prevention $20,000, appraisal $30,000, internal failure $60,000, external failure $90,000, on sales of $2,000,000.', v: { prevention: 20000, appraisal: 30000, internal: 60000, external: 90000, sales: 2000000 }, expect: { total: 200000, pctSales: 10, failShare: 75 } },
    { title: 'Service firm', story: 'Prevention $15,000, appraisal $25,000, internal failure $40,000, external failure $20,000, on sales of $1,000,000.', v: { prevention: 15000, appraisal: 25000, internal: 40000, external: 20000, sales: 1000000 }, expect: { total: 100000, pctSales: 10, failShare: 60 } },
  ],
  practice: { ask: ['total', 'pctSales'], prompt: (v, f) => `A firm reports prevention costs of ${f.money(v.prevention)}, appraisal costs of ${f.money(v.appraisal)}, internal failure costs of ${f.money(v.internal)}, and external failure costs of ${f.money(v.external)} on sales of ${f.money(v.sales)}. Find the total cost of quality and its percentage of sales.` },
  uses: [], mono: [['internal', 'total', 1], ['sales', 'pctSales', -1]],
});

export const taguchi: CalcDef = calc({
  id: 'taguchi-loss', name: 'Taguchi Loss Function', short: 'Taguchi loss', cat: CAT,
  bq: 'What does being off-target cost, even when I am within spec?',
  blurb: 'Quadratic quality loss: cost grows with the square of the distance from the target, for a single unit and on average for a process.',
  keywords: ['taguchi', 'taguchi loss function', 'quality loss function', 'L = k(x - T)^2', 'target value', 'loss to society'],
  symptoms: ['within spec but customers complain', 'cost of variation', 'off target'],
  formula: () => `L = k(x - T)^2, \\quad k = ${fr('C', '\\Delta^2')}`,
  inputs: [num('T', { sym: 'T', label: 'Target value', blabel: 'Ideal value', def: 10, rand: [10, 100, 5], cues: ['target', 'nominal'] }), num('tol', { sym: '\\Delta', label: 'Tolerance (± from target)', blabel: 'Allowed deviation (±)', def: 0.5, min: 0.0000001, rand: [0.5, 5, 0.5], cues: ['tolerance', 'plus or minus', '±'] }), money('C', { sym: 'C', label: 'Cost at the tolerance limit', blabel: 'Cost when a unit is right at the limit (repair, scrap, warranty)', def: 20, rand: [5, 200, 5], sens: true, cues: ['cost of', 'repair cost', 'scrap cost', 'warranty cost'] }),
    num('x', { sym: 'x', label: 'Actual value of a unit', blabel: 'Measured value of one unit', def: 10.2, rand: [8, 104, 0.1], sens: true, cues: ['actual', 'measures', 'measured'] }),
    num('mu', { sym: '\\mu', label: 'Process mean (optional)', blabel: 'Process average (for expected loss)', def: 10.1, rand: [9, 102, 0.1], adv: true, sens: true }), num('sigma', { sym: '\\sigma', label: 'Process standard deviation (optional)', blabel: 'Process std. deviation (for expected loss)', def: 0.2, min: 0, rand: [0.1, 3, 0.1], adv: true, sens: true })],
  outputs: [out('L', 'Loss for this unit', { sym: 'L', fmt: 'money', dp: 2, primary: true }), out('k', 'Loss coefficient', { sym: 'k', dp: 4 }), out('EL', 'Expected loss per unit for the process', { fmt: 'money', dp: 2 })],
  compute: (v) => { const k = v.C / (v.tol * v.tol); return { k, L: k * (v.x - v.T) ** 2, EL: k * (v.sigma * v.sigma + (v.mu - v.T) ** 2) }; },
  steps: (v, o, c) => [
    { title: 'Loss coefficient', tex: `k = ${fr('C', '\\Delta^2')} = ${fr(c.f.t(v.C), `${c.f.t(v.tol)}^2`)} = ${c.f.t(o.k, 4)}`, why: 'Calibrate the curve so that the loss equals the known cost when a unit sits exactly at the tolerance limit.' },
    { title: 'Loss for one unit', tex: `L = k(x - T)^2 = ${c.f.t(o.k, 4)}(${c.f.t(v.x)} - ${c.f.t(v.T)})^2 = ${c.f.money(o.L, 2)}`, why: 'Loss grows with the square of the deviation: twice as far off target costs four times as much. There is a loss even inside the spec limits.', eli: 'A shirt that is a little too tight is annoying. One that is twice as tight is far more than twice as annoying.' },
    { title: 'Expected loss for the process', tex: `E[L] = k\\left[\\sigma^2 + (\\mu - T)^2\\right] = ${c.f.t(o.k, 4)}\\left[${c.f.t(v.sigma)}^2 + (${c.f.t(v.mu)} - ${c.f.t(v.T)})^2\\right] = ${c.f.money(o.EL, 2)}`, why: 'Average loss per unit has two sources: variation around the mean and the mean being off target.' },
  ],
  biz: (v, o, f) => ({ headline: `A unit at ${f.num(v.x)} carries a hidden quality cost of ${f.money(o.L, 2)}, even if it passes inspection.`, meaning: [`Across the whole process, the average hidden cost is ${f.money(o.EL, 2)} per unit.`, 'Units near the edge of the spec cause more complaints, wear, and rework than units at the target, though both "pass".'], actions: ['Aim for the target, not just "within spec".', Math.abs(v.mu - v.T) > v.sigma ? 'Re-center the process first: the mean is the bigger problem.' : 'Reduce variation: the spread is the bigger problem.'] }),
  viz: (v, o) => ({ kind: 'xy', x: { label: 'Measured value' }, y: { label: 'Loss ($)', zero: true }, series: [{ name: 'Loss', style: 'line', tone: 'accent', pts: pts((x) => o.k * (x - v.T) ** 2, v.T - 1.6 * v.tol, v.T + 1.6 * v.tol, 80) }], vlines: [{ x: v.T - v.tol, label: 'LSL', tone: 'bad' }, { x: v.T + v.tol, label: 'USL', tone: 'bad' }, { x: v.T, label: 'Target', tone: 'muted' }], marks: [{ x: v.x, y: o.L, label: 'This unit', tone: 'accent' }] }),
  traps: ['k uses the tolerance squared.', 'The loss is not zero just because the unit is within spec. It is zero only at the target.'],
  analogy: 'A thermostat: 70° is perfect, 72° is fine but slightly off, 78° is technically "indoors" but nobody is happy.',
  examples: [
    { title: 'Shaft diameter', story: 'Target 10 mm, tolerance ±0.5 mm, and a part at the limit costs $20 to fix. A unit measures 10.2 mm. The process mean is 10.1 with standard deviation 0.2.', v: { T: 10, tol: 0.5, C: 20, x: 10.2, mu: 10.1, sigma: 0.2 }, expect: { k: 80, L: 3.2, EL: 4 } },
    { title: 'Fill weight', story: 'Target 50 g, tolerance ±2 g, cost at the limit $45. A unit weighs 51 g. The process mean is 50 with standard deviation 1.', v: { T: 50, tol: 2, C: 45, x: 51, mu: 50, sigma: 1 }, expect: { k: 11.25, L: 11.25, EL: 11.25 } },
  ],
  practice: { ask: ['L'], gen: (r) => { const T = 10 + Math.floor(r() * 18) * 5, tol = [0.5, 1, 2][Math.floor(r() * 3)]; return { T, tol, C: 10 + Math.floor(r() * 19) * 5, x: +(T + (r() - 0.5) * 2 * tol).toFixed(1), mu: T, sigma: tol / 3 }; }, prompt: (v, f) => `A part has a target of ${f.num(v.T)} and a tolerance of ±${f.num(v.tol)}. A unit at the tolerance limit costs ${f.money(v.C)} to correct. Using the Taguchi loss function, what is the loss for a unit measuring ${f.num(v.x)}?` },
  uses: ['process-capability'], mono: [['C', 'L', 1], ['sigma', 'EL', 1]],
  claim: 'The expected-loss formula matches the average loss over simulated normal output.',
});

export default [xbarR, pChart, cChart, capability, dpmo, costOfQuality, taguchi];
