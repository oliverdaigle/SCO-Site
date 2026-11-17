// Forecasting methods and forecast-accuracy measures.
import { calc, num, pct, int, sel, series, out, fr, tx } from '../dsl';
import { sma, wma, ses, holt, holtWinters, linreg, errors, optimizeAlpha } from '../math/forecast';
import { mean, sum, type Rng } from '../math/util';
import type { CalcDef, Fmt, InputDef, OutputDef, TableSpec, Vals, VizSpec } from '../types';

const CAT = 'forecast';
const PORT = [180, 168, 159, 175, 190, 205, 180, 182];
const dataIn = (def: number[], o: Partial<InputDef> = {}) => series('data', { sym: 'At', label: 'Actual demand (oldest first)', blabel: 'Past sales, oldest first', def, minRows: 3, help: 'Paste a column from a spreadsheet or type numbers separated by commas or spaces.', cues: ['demand', 'sales', 'actual'], ...o });
const accOuts = (): OutputDef[] => [out('MAD', 'MAD', { dp: 3 }), out('MSE', 'MSE', { dp: 3 }), out('MAPE', 'MAPE', { fmt: 'pct', dp: 2 })];
const randSeries = (r: Rng, n: number, base: number, trend = 0, noise = 0.15) => Array.from({ length: n }, (_, i) => Math.max(1, Math.round(base + trend * i + (r() - 0.5) * 2 * noise * base)));

function fcViz(a: number[], fc: number[], next: number, mad: number, extra: number[] = []): VizSpec {
  const act = a.map((y, i) => [i + 1, y] as [number, number]);
  const f = fc.map((y, i) => [i + 1, y] as [number, number]).filter((p) => Number.isFinite(p[1]));
  const ahead = [next, ...extra].map((y, k) => [a.length + 1 + k, y] as [number, number]);
  const all = [...f, ...ahead];
  return {
    kind: 'xy', x: { label: 'Period' }, y: { label: 'Units' },
    series: [{ name: 'Actual', style: 'line', tone: 'muted', pts: act }, { name: 'Forecast', style: 'dash', tone: 'accent', pts: all }, { name: 'Next forecast', style: 'dots', tone: 'accent', pts: ahead }],
    ribbon: Number.isFinite(mad) && mad > 0 ? { upper: all.map(([x, y]) => [x, y + mad]), lower: all.map(([x, y]) => [x, y - mad]), label: '± 1 MAD', tone: 'accent' } : undefined,
  };
}
function fcTable(a: number[], fc: number[], f: Fmt, extraCols: { name: string; vals: number[] }[] = []): TableSpec {
  return { columns: ['Period', 'Actual', ...extraCols.map((c) => c.name), 'Forecast', 'Error', '|Error|'], rows: a.map((y, i) => [i + 1, f.num(y), ...extraCols.map((c) => (Number.isFinite(c.vals[i]) ? f.num(c.vals[i], 3) : '')), Number.isFinite(fc[i]) ? f.num(fc[i], 3) : '', Number.isFinite(fc[i]) ? f.num(y - fc[i], 3) : '', Number.isFinite(fc[i]) ? f.num(Math.abs(y - fc[i]), 3) : '']) };
}
const accStep = (o: any, c: any) => ({ title: 'Measure forecast accuracy', tex: `MAD = ${fr('\\sum |A_t - F_t|', 'n')} = ${c.f.t(o.MAD, 3)}, \\quad MSE = ${c.f.t(o.MSE, 3)}, \\quad MAPE = ${c.f.t(o.MAPE, 2)}\\%`, why: `Errors are measured over the ${o.nErr} periods that have both an actual and a forecast. MAD is the average miss in units, MSE punishes big misses, and MAPE expresses the miss as a percentage of demand.`, eli: 'On average, how far off was the forecast? That is MAD. The other two are different ways of scoring the same misses.' });
const accBiz = (o: any, f: Fmt) => `Looking back, this method missed by about ${f.num(o.MAD, 1)} units per period on average (${f.pct(o.MAPE, 1)} of demand).`;

export const movingAverage: CalcDef = calc({
  id: 'moving-average', name: 'Simple Moving Average', short: 'Moving average', cat: CAT,
  bq: 'What will I sell next period, based on recent sales?',
  blurb: 'Forecasts the next period as the average of the last n periods.',
  keywords: ['moving average', 'simple moving average', 'sma', 'n-period average', 'forecast'],
  symptoms: ['forecast next month', 'predict sales', 'smooth out sales data', 'what will i sell'],
  formula: (s) => `F_{t+1} = ${fr(`${s.At} + A_{t-1} + \\dots + A_{t-n+1}`, 'n')}`,
  inputs: [dataIn([10, 12, 13, 16, 19, 23, 26, 30, 28, 18, 16, 14]), int('n', { sym: 'n', label: 'Number of periods to average', blabel: 'How many recent periods to average', def: 3, min: 1, max: 60, sens: true, cues: ['-month moving average', '-period moving average', '-week moving average', 'period moving', 'month moving', 'week moving'] })],
  outputs: [out('next', 'Forecast for next period', { sym: 'F_{t+1}', unit: 'units', primary: true }), ...accOuts()],
  check: (v) => (v.n >= v.data.length ? `You need more data than the averaging window: ${v.n} periods to average requires at least ${v.n + 1} data points.` : null),
  compute: (v) => { const fit = sma(v.data, v.n); const e = errors(v.data, fit.fc, fit.start); return { next: fit.next, fc: fit.fc.slice(fit.start), MAD: e.mad, MSE: e.mse, MAPE: e.mape, nErr: e.n }; },
  steps: (v, o, c) => { const a = v.data as number[]; const last = a.slice(-v.n); return [
    { title: `Average the last ${v.n} periods`, tex: `F_{t+1} = ${fr(last.map((x) => c.f.t(x)).join(' + '), v.n)} = ${c.f.t(o.next, 3)}`, why: 'Each of the last n periods gets equal weight. Older data is ignored entirely.', eli: 'Guess next month by averaging the last few months. Simple and steady.' },
    { title: 'Back-test: forecast every earlier period the same way', why: 'Rolling the window through history shows how the method would have performed.', table: fcTable(a, sma(a, v.n).fc, c.f) },
    accStep(o, c),
  ]; },
  biz: (v, o, f) => ({ headline: `Expect to sell about ${f.int(Math.round(o.next))} units next period.`, meaning: [`That is the average of your last ${v.n} periods.`, accBiz(o, f), 'A moving average lags behind trends: if sales are rising, it will forecast low.'], actions: ['Use a shorter window if sales change quickly, a longer one if they are noisy.', 'If you see a steady climb or seasonality, switch to the trend or seasonal calculators.', 'Add about one MAD of buffer if a miss would be costly.'] }),
  viz: (v, o) => fcViz(v.data, sma(v.data, v.n).fc, o.next, o.MAD),
  traps: ['The forecast for period t uses data up to t − 1, never period t itself.', 'More periods smooth more but react slower.', 'You cannot compute errors for the first n periods: there is no forecast for them.'],
  analogy: 'Guessing tomorrow’s commute time by averaging the last three days.',
  examples: [
    { title: 'Garden shed sales', story: 'Monthly shed sales for the year were 10, 12, 13, 16, 19, 23, 26, 30, 28, 18, 16, 14. Forecast next January with a 3-month moving average.', v: { data: [10, 12, 13, 16, 19, 23, 26, 30, 28, 18, 16, 14], n: 3 }, expect: { next: 16, MAD: 6.481 } },
    { title: 'Short history', story: 'Weekly demand was 42, 40, 43, 40, 41, 39. Use a 3-week moving average.', v: { data: [42, 40, 43, 40, 41, 39], n: 3 }, expect: { next: 40, MAD: 1.333 } },
  ],
  practice: { ask: ['next'], gen: (r) => ({ data: randSeries(r, 6 + Math.floor(r() * 3), 80 + Math.floor(r() * 200)), n: 2 + Math.floor(r() * 3) }), prompt: (v) => `Demand for the last ${v.data.length} periods was ${v.data.join(', ')}. Using a ${v.n}-period simple moving average, what is the forecast for the next period?` },
  gen: (r) => { const n = 1 + Math.floor(r() * 5); return { data: randSeries(r, n + 2 + Math.floor(r() * 20), 20 + Math.floor(r() * 900), (r() - 0.5) * 10, 0.3), n }; },
  uses: [],
});

export const weightedMovingAverage: CalcDef = calc({
  id: 'weighted-moving-average', name: 'Weighted Moving Average', short: 'Weighted moving average', cat: CAT,
  bq: 'What will I sell next period if recent months matter more?',
  blurb: 'A moving average where recent periods can carry more weight than older ones.',
  keywords: ['weighted moving average', 'wma', 'weights', 'forecast'],
  symptoms: ['recent sales matter more', 'forecast with weights'],
  formula: () => `F_{t+1} = ${fr('\\sum w_i A_{t-i+1}', '\\sum w_i')}`,
  inputs: [dataIn([10, 12, 13, 16, 19, 23, 26, 30, 28, 18, 16, 14]), series('weights', { sym: 'w', label: 'Weights (most recent period first)', blabel: 'Weights, most recent period first', def: [3, 2, 1], minRows: 1, help: 'The first weight applies to the latest period. Weights do not need to add to 1: they are divided by their sum.', cues: ['weights of', 'weights', 'weighted'] })],
  outputs: [out('next', 'Forecast for next period', { sym: 'F_{t+1}', unit: 'units', primary: true }), out('wsum', 'Sum of weights', {}), ...accOuts()],
  check: (v) => (v.weights.length >= v.data.length ? 'You need more data points than weights.' : sum(v.weights) <= 0 ? 'Weights must add up to more than zero.' : v.weights.some((w: number) => w < 0) ? 'Weights cannot be negative.' : null),
  compute: (v) => { const fit = wma(v.data, v.weights); const e = errors(v.data, fit.fc, fit.start); return { next: fit.next, wsum: sum(v.weights), fc: fit.fc.slice(fit.start), MAD: e.mad, MSE: e.mse, MAPE: e.mape, nErr: e.n }; },
  steps: (v, o, c) => { const a = v.data as number[], w = v.weights as number[]; const terms = w.map((wi, k) => `${c.f.t(wi)}(${c.f.t(a[a.length - 1 - k])})`); return [
    { title: 'Multiply each recent period by its weight', tex: `${terms.join(' + ')} = ${c.f.t(w.reduce((s, wi, k) => s + wi * a[a.length - 1 - k], 0), 3)}`, why: 'The first weight goes with the most recent period, the second with the one before, and so on.', eli: 'Like grading where the final exam counts more than the first quiz: recent months count more.' },
    { title: 'Divide by the sum of the weights', tex: `F_{t+1} = ${fr(c.f.t(w.reduce((s, wi, k) => s + wi * a[a.length - 1 - k], 0), 3), c.f.t(o.wsum, 3))} = ${c.f.t(o.next, 3)}`, why: 'Dividing by the total weight keeps the forecast on the same scale as demand. If the weights already add to 1 this changes nothing.' },
    { title: 'Back-test over history', why: 'Apply the same weights to every earlier window.', table: fcTable(a, wma(a, w).fc, c.f) },
    accStep(o, c),
  ]; },
  biz: (v, o, f) => ({ headline: `Expect to sell about ${f.int(Math.round(o.next))} units next period.`, meaning: [`Based on your last ${v.weights.length} periods, with the latest weighted most.`, accBiz(o, f)], actions: ['Heavier recent weights react faster to change but also to one-off blips.', 'Try a few weight sets and keep the one with the lowest MAD.'] }),
  viz: (v, o) => fcViz(v.data, wma(v.data, v.weights).fc, o.next, o.MAD),
  traps: ['Matching the largest weight to the oldest period. The largest weight normally goes to the most recent period.', 'Forgetting to divide by the sum of the weights when they do not add to 1.'],
  analogy: 'A course grade where the final exam counts triple: the latest result moves the average most.',
  examples: [
    { title: 'Weights 3, 2, 1', story: 'Monthly sales were 10, 12, 13, 16, 19, 23, 26, 30, 28, 18, 16, 14. Weight last month 3, two months ago 2, three months ago 1.', v: { data: [10, 12, 13, 16, 19, 23, 26, 30, 28, 18, 16, 14], weights: [3, 2, 1] }, expect: { next: 15.333 } },
    { title: 'Weights adding to 1', story: 'Demand was 100, 90, 105, 95. Weights are 0.4, 0.3, 0.2, 0.1 from most recent to oldest. A fifth value of 97 is observed afterward.', v: { data: [100, 90, 105, 95, 97], weights: [0.4, 0.3, 0.2, 0.1] }, expect: { next: 97.3 } },
  ],
  practice: { ask: ['next'], gen: (r) => ({ data: randSeries(r, 6, 60 + Math.floor(r() * 300)), weights: [[3, 2, 1], [0.5, 0.3, 0.2], [4, 3, 2, 1], [0.6, 0.4]][Math.floor(r() * 4)] }), prompt: (v) => `Demand for the last ${v.data.length} periods was ${v.data.join(', ')}. Using weights ${v.weights.join(', ')} (most recent period first), what is the weighted moving average forecast for the next period?` },
  gen: (r) => { const k = 1 + Math.floor(r() * 4); return { data: randSeries(r, k + 2 + Math.floor(r() * 15), 20 + Math.floor(r() * 900), 0, 0.3), weights: Array.from({ length: k }, () => +(0.1 + r() * 5).toFixed(2)) }; },
  uses: ['moving-average'],
});

const f1Of = (v: Vals) => (v.init === 'given' ? v.f1 : v.init === 'average' ? mean(v.data) : v.data[0]);
const startOf = (v: Vals) => (v.init === 'first' ? 1 : 0);
export const expSmoothing: CalcDef = calc({
  id: 'exponential-smoothing', name: 'Exponential Smoothing', short: 'Exponential smoothing', cat: CAT,
  bq: 'What will I sell next period, giving more weight to recent sales?',
  blurb: 'Updates the forecast each period by a fraction α of the last error, with an option to find the α that minimizes MAD or MSE.',
  keywords: ['exponential smoothing', 'simple exponential smoothing', 'ses', 'alpha', 'smoothing constant', 'optimize alpha'],
  symptoms: ['forecast next month', 'predict demand', 'best smoothing constant', 'which alpha'],
  formula: (s) => `F_{t+1} = ${s.Ft} + ${s.alpha}(${s.At} - ${s.Ft})`,
  inputs: [dataIn(PORT), num('alpha', { sym: 'alpha', label: 'Smoothing constant α', blabel: 'Responsiveness (0 = steady, 1 = chase the latest number)', def: 0.1, min: 0, max: 1, step: 0.05, sens: true, show: (v) => v.optimize === 'none' || !v.optimize, cues: ['alpha', 'smoothing constant', 'α'] }),
    sel('init', 'First forecast', [['first', 'Equal to the first actual'], ['given', 'Given in the problem'], ['average', 'Average of all actuals']], 'given', { help: 'Exponential smoothing needs a starting forecast. Textbook problems usually state it; otherwise the first actual is the common choice.' }),
    num('f1', { sym: 'F_1', label: 'Initial forecast', blabel: 'Starting forecast for the first period', def: 175, show: (v) => v.init === 'given', cues: ['initial forecast', 'forecast for the first', 'first forecast', 'forecast was'] }),
    sel('optimize', 'Optimize α', [['none', 'No, use my α'], ['mad', 'Find α that minimizes MAD'], ['mse', 'Find α that minimizes MSE']], 'none', { help: 'Searches α from 0.01 to 0.99 in steps of 0.01.' })],
  outputs: [out('next', 'Forecast for next period', { sym: 'F_{t+1}', unit: 'units', primary: true }), out('alphaUsed', 'α used', { sym: 'alpha', dp: 2 }), ...accOuts()],
  compute: (v) => {
    const f1 = f1Of(v), start = startOf(v); const alpha = v.optimize && v.optimize !== 'none' ? optimizeAlpha(v.data, f1, start, v.optimize).alpha : v.alpha;
    const fit = ses(v.data, alpha, f1); const e = errors(v.data, fit.fc, start);
    return { next: fit.next, alphaUsed: alpha, f1, fc: fit.fc, MAD: e.mad, MSE: e.mse, MAPE: e.mape, nErr: e.n };
  },
  steps: (v, o, c) => { const a = v.data as number[]; const fit = ses(a, o.alphaUsed, o.f1); const n = a.length; return [
    ...(v.optimize && v.optimize !== 'none' ? [{ title: `Search for the best α`, tex: `${c.s.alpha}^* = ${c.f.t(o.alphaUsed, 2)}`, why: `Every α from 0.01 to 0.99 was tried and the one with the lowest ${v.optimize.toUpperCase()} over the history was kept.`, eli: 'Try every setting of the dial and keep the one that would have guessed the past best.' }] : []),
    { title: 'Start from the initial forecast', tex: `F_1 = ${c.f.t(o.f1, 3)}`, why: v.init === 'first' ? 'With no forecast given, the first actual is used as the first forecast. Errors are counted from period 2.' : v.init === 'average' ? 'The average of all actuals is used as the starting forecast.' : 'The problem supplies the starting forecast.' },
    { title: 'Update the forecast each period', tex: `F_{t+1} = ${c.s.Ft} + ${c.s.alpha}(${c.s.At} - ${c.s.Ft}), \\quad F_2 = ${c.f.t(fit.fc[0], 3)} + ${c.f.t(o.alphaUsed, 2)}(${c.f.t(a[0])} - ${c.f.t(fit.fc[0], 3)}) = ${c.f.t(fit.fc[1] ?? o.next, 3)}`, why: 'New forecast = old forecast plus a fraction α of the last error. A small α changes slowly; a large α chases the most recent actual.', eli: 'You guessed 100, the real number was 120. You were 20 low, so nudge your next guess up by part of that 20.', table: fcTable(a, fit.fc, c.f) },
    { title: 'Forecast for the next period', tex: `F_{${n + 1}} = ${c.f.t(fit.fc[n - 1], 3)} + ${c.f.t(o.alphaUsed, 2)}(${c.f.t(a[n - 1])} - ${c.f.t(fit.fc[n - 1], 3)}) = ${c.f.t(o.next, 3)}`, why: 'Apply the same update once more using the latest actual.' },
    accStep(o, c),
  ]; },
  biz: (v, o, f) => ({ headline: `Expect to sell about ${f.int(Math.round(o.next))} units next period.`, meaning: [v.optimize && v.optimize !== 'none' ? `The best responsiveness setting for your history is α = ${f.num(o.alphaUsed, 2)}.` : `Using responsiveness α = ${f.num(o.alphaUsed, 2)}.`, accBiz(o, f)], actions: ['Turn on "Optimize α" to let your own history pick the setting.', 'If the best α is above 0.5, demand is probably trending. Try trend-adjusted smoothing.', 'Re-run monthly with the newest sales figure.'] }),
  viz: (v, o) => fcViz(v.data, o.fc, o.next, o.MAD),
  traps: ['Using the wrong period’s actual: F(t+1) uses A(t) and F(t).', 'Forgetting the initial forecast. If the problem does not give one, state your assumption.', 'A higher α is not better. It just reacts faster, to noise as well as to real change.'],
  analogy: 'Adjusting a shower: turn the tap part of the way toward the temperature you want instead of over-correcting.',
  convention: 'Forecast error is actual minus forecast. When the first forecast equals the first actual, accuracy is measured from period 2 onward.',
  examples: [
    { title: 'Port unloading, α = 0.10', story: 'Tons of grain unloaded in eight quarters: 180, 168, 159, 175, 190, 205, 180, 182. The first-quarter forecast was 175 and α = 0.10.', v: { data: PORT, alpha: 0.1, init: 'given', f1: 175 }, expect: { next: 178.6, MAD: 10.31, MSE: 190.82, MAPE: 5.59 } },
    { title: 'Port unloading, α = 0.50', story: 'Same data with α = 0.50.', v: { data: PORT, alpha: 0.5, init: 'given', f1: 175 }, expect: { MAD: 12.33 } },
  ],
  practice: { ask: ['next'], gen: (r) => { const data = randSeries(r, 5, 100 + Math.floor(r() * 300)); return { data, alpha: [0.1, 0.2, 0.3, 0.4, 0.5][Math.floor(r() * 5)], init: 'given', f1: data[0] + Math.round((r() - 0.5) * 20), optimize: 'none' }; }, prompt: (v) => `Demand for the last ${v.data.length} periods was ${v.data.join(', ')}. The forecast for the first period was ${v.f1} and α = ${v.alpha}. Using exponential smoothing, what is the forecast for period ${v.data.length + 1}?` },
  gen: (r) => { const data = randSeries(r, 4 + Math.floor(r() * 20), 20 + Math.floor(r() * 900), (r() - 0.5) * 10, 0.3); const init = ['first', 'given', 'average'][Math.floor(r() * 3)]; return { data, alpha: +(0.05 + r() * 0.9).toFixed(2), init, f1: data[0] + Math.round((r() - 0.5) * 30), optimize: ['none', 'none', 'mad', 'mse'][Math.floor(r() * 4)] }; },
  uses: ['mad', 'mse'],
  claim: 'The optimized α has the lowest error of any α on the search grid (confirmed by brute force).',
});

export const holtCalc: CalcDef = calc({
  id: 'holt', name: 'Trend-Adjusted Exponential Smoothing (Holt)', short: 'Holt (trend)', cat: CAT,
  bq: 'My sales are trending. What should I expect next period?',
  blurb: 'Exponential smoothing with a second smoothed term for trend, so forecasts keep up with steady growth or decline.',
  keywords: ['holt', 'trend adjusted exponential smoothing', 'double exponential smoothing', 'FIT', 'forecast including trend', 'beta'],
  symptoms: ['sales are growing', 'sales are declining', 'forecast with a trend', 'forecast keeps lagging'],
  formula: (s) => `F_t = ${s.alpha}A_{t-1} + (1-${s.alpha})(F_{t-1} + T_{t-1}), \\quad T_t = ${s.beta}(F_t - F_{t-1}) + (1-${s.beta})T_{t-1}`,
  inputs: [dataIn([12, 17, 20, 19, 24, 21, 31, 28, 36]), num('alpha', { sym: 'alpha', label: 'Smoothing constant α (level)', blabel: 'Responsiveness of the level', def: 0.2, min: 0, max: 1, step: 0.05, sens: true, cues: ['alpha', 'α'] }), num('beta', { sym: 'beta', label: 'Smoothing constant β (trend)', blabel: 'Responsiveness of the trend', def: 0.4, min: 0, max: 1, step: 0.05, sens: true, cues: ['beta', 'β', 'delta'] }),
    sel('init', 'Starting values', [['given', 'Given in the problem'], ['auto', 'Estimate from the data']], 'given'),
    num('f1', { sym: 'F_1', label: 'Initial smoothed forecast', def: 11, show: (v) => v.init === 'given', cues: ['initial forecast', 'forecast for month 1', 'forecast for period 1'] }), num('t1', { sym: 'T_1', label: 'Initial trend', def: 2, show: (v) => v.init === 'given', cues: ['initial trend', 'trend of', 'trend for'] }),
    int('ahead', { label: 'Periods ahead to forecast', def: 1, min: 1, max: 24, adv: true })],
  outputs: [out('next', 'Forecast including trend', { sym: 'FIT', unit: 'units', primary: true }), out('level', 'Final smoothed level', { dp: 3 }), out('trend', 'Final trend per period', { dp: 3 }), ...accOuts()],
  compute: (v) => {
    const a = v.data as number[]; const t1 = v.init === 'auto' ? (a[a.length - 1] - a[0]) / (a.length - 1) : v.t1; const f1 = v.init === 'auto' ? a[0] - t1 : v.f1;
    const fit = holt(a, v.alpha, v.beta, f1, t1, v.ahead ?? 1); const e = errors(a, fit.fc, v.init === 'auto' ? 1 : 0);
    return { next: fit.next, level: fit.level[a.length], trend: fit.trend[a.length], f1, t1, fc: fit.fc, lv: fit.level, tr: fit.trend, MAD: e.mad, MSE: e.mse, MAPE: e.mape, nErr: e.n };
  },
  steps: (v, o, c) => { const a = v.data as number[]; const n = a.length; return [
    { title: 'Starting values', tex: `F_1 = ${c.f.t(o.f1, 3)}, \\quad T_1 = ${c.f.t(o.t1, 3)}, \\quad FIT_1 = F_1 + T_1 = ${c.f.t(o.f1 + o.t1, 3)}`, why: v.init === 'auto' ? 'No starting values were given, so the trend is set to the average change per period and the level is set so the first forecast equals the first actual. Errors are counted from period 2.' : 'The problem supplies the starting forecast and trend.' },
    { title: 'Smooth the level', tex: `F_t = ${c.s.alpha}A_{t-1} + (1-${c.s.alpha})(F_{t-1} + T_{t-1}), \\quad F_2 = ${c.f.t(v.alpha)}(${c.f.t(a[0])}) + ${c.f.t(1 - v.alpha)}(${c.f.t(o.f1 + o.t1, 3)}) = ${c.f.t(o.lv[1], 3)}`, why: 'Blend the latest actual with the previous forecast that already included trend.', eli: 'Where are sales right now? Mix the newest number with where you expected to be.' },
    { title: 'Smooth the trend', tex: `T_t = ${c.s.beta}(F_t - F_{t-1}) + (1-${c.s.beta})T_{t-1}, \\quad T_2 = ${c.f.t(v.beta)}(${c.f.t(o.lv[1], 3)} - ${c.f.t(o.f1, 3)}) + ${c.f.t(1 - v.beta)}(${c.f.t(o.t1, 3)}) = ${c.f.t(o.tr[1], 3)}`, why: 'Blend the latest change in level with the previous trend estimate.', eli: 'How fast are sales climbing? Mix the newest jump with the pace you believed before.' },
    { title: 'Forecast including trend, period by period', tex: `FIT_t = F_t + T_t`, why: 'Add the trend to the level to project forward.', table: fcTable(a, o.fc, c.f, [{ name: 'Level F', vals: o.lv }, { name: 'Trend T', vals: o.tr }]) },
    { title: `Forecast for period ${n + (v.ahead ?? 1)}`, tex: `FIT = F_{${n + 1}} + ${v.ahead ?? 1} \\times T_{${n + 1}} = ${c.f.t(o.level, 3)} + ${v.ahead ?? 1}(${c.f.t(o.trend, 3)}) = ${c.f.t(o.next, 3)}`, why: 'Project the final level forward by the final trend.' },
    accStep(o, c),
  ]; },
  biz: (v, o, f) => ({ headline: `Expect about ${f.int(Math.round(o.next))} units next period, ${o.trend >= 0 ? 'growing' : 'shrinking'} by roughly ${f.num(Math.abs(o.trend), 1)} per period.`, meaning: [accBiz(o, f), 'Unlike a plain average, this forecast keeps pace with a steady trend instead of lagging behind it.'], actions: ['Plan purchasing and staffing for the trend, not just the current level.', 'If sales also follow a calendar pattern, use Holt-Winters.', 'Trends do not last forever: recheck monthly.'] }),
  viz: (v, o) => fcViz(v.data, o.fc, o.next, o.MAD),
  traps: ['The forecast is FIT = F + T, not F alone.', 'Update F before T: the trend formula uses the new F.', 'Textbooks index this differently (Chopra updates level with the current period). The numbers match after shifting the index.'],
  analogy: 'Catching a moving bus: you aim not at where it is but at where it will be, based on its speed.',
  convention: 'Heizer form: F is the smoothed forecast, T the smoothed trend, FIT = F + T. Jacobs & Chase write the trend constant as δ.',
  examples: [
    { title: 'Pollution-control equipment', story: 'Demand over 9 months: 12, 17, 20, 19, 24, 21, 31, 28, 36. α = 0.2, β = 0.4, initial forecast 11, initial trend 2.', v: { data: [12, 17, 20, 19, 24, 21, 31, 28, 36], alpha: 0.2, beta: 0.4, init: 'given', f1: 11, t1: 2 }, expect: { next: 35.16, level: 32.48, trend: 2.68 } },
    { title: 'First three months only', story: 'Using only the first three months (12, 17, 20) with the same settings, forecast month 4.', v: { data: [12, 17, 20], alpha: 0.2, beta: 0.4, init: 'given', f1: 11, t1: 2 }, expect: { next: 20.14, level: 17.82, trend: 2.32 } },
  ],
  practice: { ask: ['next'], gen: (r) => { const b = 50 + Math.floor(r() * 100), t = 3 + Math.floor(r() * 8); const data = randSeries(r, 4, b, t, 0.05); return { data, alpha: [0.2, 0.3, 0.4][Math.floor(r() * 3)], beta: [0.2, 0.3, 0.4, 0.5][Math.floor(r() * 4)], init: 'given', f1: data[0] - 2, t1: t, ahead: 1 }; }, prompt: (v) => `Demand for ${v.data.length} periods was ${v.data.join(', ')}. With α = ${v.alpha}, β = ${v.beta}, an initial smoothed forecast of ${v.f1} and initial trend of ${v.t1}, what is the forecast including trend for period ${v.data.length + 1}?` },
  gen: (r) => { const data = randSeries(r, 3 + Math.floor(r() * 20), 20 + Math.floor(r() * 900), (r() - 0.3) * 20, 0.2); const init = r() < 0.5 ? 'given' : 'auto'; return { data, alpha: +(0.05 + r() * 0.9).toFixed(2), beta: +(0.05 + r() * 0.9).toFixed(2), init, f1: data[0] + Math.round((r() - 0.5) * 20), t1: Math.round((r() - 0.3) * 20), ahead: 1 + Math.floor(r() * 4) }; },
  uses: ['exponential-smoothing'],
});

export const seasonalIndices: CalcDef = calc({
  id: 'seasonal-indices', name: 'Seasonal Indices', short: 'Seasonal indices', cat: CAT,
  bq: 'How strong is my seasonality, and what does next year look like by season?',
  blurb: 'Computes a seasonal index for each period of the year and spreads next year’s total demand across the seasons.',
  keywords: ['seasonal index', 'seasonal indices', 'seasonality', 'seasonal factor', 'multiplicative seasonal', 'deseasonalize'],
  symptoms: ['sales are seasonal', 'holiday peak', 'summer rush', 'plan by quarter'],
  formula: () => `${tx('Index')} = ${fr(tx('Average demand for the season'), tx('Average demand over all seasons'))}`,
  inputs: [dataIn([100, 150, 200, 150, 120, 170, 230, 160], { label: 'Demand by season (oldest first, whole years)', minRows: 2 }), int('m', { sym: 'm', label: 'Seasons per year', blabel: 'Periods in one cycle (4 = quarters, 12 = months)', def: 4, min: 2, max: 52, cues: ['seasons', 'quarters', 'quarterly', 'monthly'] }),
    num('nextTotal', { label: 'Total demand forecast for next year', blabel: 'Total you expect to sell next year', def: 720, min: 0, sens: true, cues: ['next year', 'annual demand of', 'total demand', 'forecast annual'] })],
  outputs: [out('peak', 'Highest seasonal index', { primary: true, dp: 3 }), out('low', 'Lowest seasonal index', { dp: 3 }), out('overall', 'Average demand per season', {}), out('peakSeason', 'Peak season number', { fmt: 'int' })],
  check: (v) => (v.data.length < v.m ? `Enter at least one full year (${v.m} values).` : v.data.length % v.m !== 0 ? `The data must cover whole years: ${v.data.length} values is not a multiple of ${v.m}.` : mean(v.data) === 0 ? 'Average demand is zero, so seasonal indices cannot be computed.' : null),
  compute: (v) => {
    const a = v.data as number[], m = v.m, years = a.length / m; const avg = Array.from({ length: m }, (_, s) => mean(Array.from({ length: years }, (_, y) => a[y * m + s]))); const overall = mean(a); const idx = avg.map((x) => x / overall); const base = v.nextTotal / m;
    let pk = 0; idx.forEach((x, i) => { if (x > idx[pk]) pk = i; });
    return { seasonAvg: avg, overall, idx, forecast: idx.map((x) => x * base), peak: Math.max(...idx), low: Math.min(...idx), peakSeason: pk + 1 };
  },
  steps: (v, o, c) => [
    { title: 'Average demand for each season across the years', why: 'Line up the same season from each year and average them.', table: { columns: ['Season', ...Array.from({ length: v.data.length / v.m }, (_, y) => `Year ${y + 1}`), 'Season average'], rows: o.seasonAvg.map((x: number, s: number) => [s + 1, ...Array.from({ length: v.data.length / v.m }, (_, y) => c.f.num(v.data[y * v.m + s])), c.f.num(x, 3)]) } },
    { title: 'Overall average per season', tex: `\\bar{A} = ${fr(tx('Total demand'), tx('Number of periods'))} = ${fr(c.f.t(sum(v.data)), v.data.length)} = ${c.f.t(o.overall, 3)}`, why: 'The benchmark for a "normal" season.' },
    { title: 'Seasonal index for each season', tex: `${tx('Index')}_s = ${fr(tx('Season average'), '\\bar{A}')}`, why: 'An index of 1.25 means that season runs 25% above an average season. The indices average to 1.', eli: 'If ice cream sells 40% more in summer than in a typical quarter, summer’s index is 1.4.', table: { columns: ['Season', 'Season average', 'Index', 'Forecast next year'], rows: o.idx.map((x: number, s: number) => [s + 1, c.f.num(o.seasonAvg[s], 3), c.f.num(x, 4), c.f.num(o.forecast[s], 2)]), highlight: [o.peakSeason - 1] } },
    { title: 'Spread next year’s total across the seasons', tex: `${tx('Forecast')}_s = ${fr(c.f.t(v.nextTotal), v.m)} \\times ${tx('Index')}_s`, why: 'Start with an even split of the annual forecast, then scale each season by its index.' },
  ],
  biz: (v, o, f) => ({ headline: `Your peak season (season ${o.peakSeason}) runs ${f.pct((o.peak - 1) * 100, 0)} above an average season.`, meaning: [`Your slowest season runs ${f.pct((1 - o.low) * 100, 0)} below average.`, `Next year by season: ${o.forecast.map((x: number) => f.int(x)).join(', ')} units.`], actions: ['Build stock and schedule staff ahead of the peak, not during it.', 'Run promotions in the low season to smooth the load.', 'Recompute once a year as new data arrives.'] }),
  viz: (v, o) => ({ kind: 'xy', x: { label: 'Season', cats: o.idx.map((_: number, i: number) => `S${i + 1}`) }, y: { label: 'Seasonal index', zero: true }, series: [{ name: 'Index', style: 'bars', tone: 'accent', pts: o.idx.map((x: number, i: number) => [i, x] as [number, number]) }], hlines: [{ y: 1, label: 'Average season', tone: 'muted' }] }),
  traps: ['Divide by the overall average per season, not the annual total.', 'Indices should average 1 (or sum to the number of seasons). If they do not, recheck the arithmetic.', 'Use whole years of data so every season is counted equally.'],
  analogy: 'A gym in January: same members, but that month always runs well above a normal month. The index is the size of that bump.',
  examples: [
    { title: 'Two years of quarters', story: 'Quarterly demand: year 1 was 100, 150, 200, 150; year 2 was 120, 170, 230, 160. Next year’s total is forecast at 720.', v: { data: [100, 150, 200, 150, 120, 170, 230, 160], m: 4, nextTotal: 720 }, expect: { overall: 160, peak: 1.34375, low: 0.6875 } },
    { title: 'Three-season business', story: 'Three seasons a year: year 1 was 30, 60, 90; year 2 was 50, 60, 70.', v: { data: [30, 60, 90, 50, 60, 70], m: 3, nextTotal: 180 }, expect: { overall: 60, peak: 1.3333, low: 0.6667 } },
  ],
  practice: { ask: ['peak'], gen: (r) => { const b = 80 + Math.floor(r() * 100); const pat = [0.7, 1, 1.4, 0.9]; return { data: [0, 1].flatMap((y) => pat.map((p) => Math.round(b * p * (1 + y * 0.1) + (r() - 0.5) * 10))), m: 4, nextTotal: b * 4 }; }, prompt: (v) => `Quarterly demand over two years was ${v.data.slice(0, 4).join(', ')} (year 1) and ${v.data.slice(4).join(', ')} (year 2). What is the largest seasonal index?` },
  gen: (r) => { const m = [2, 3, 4, 6, 12][Math.floor(r() * 5)], y = 1 + Math.floor(r() * 4); return { data: Array.from({ length: m * y }, () => 10 + Math.floor(r() * 500)), m, nextTotal: 100 + Math.floor(r() * 9000) }; },
  uses: [],
});

const HW = [10, 20, 30, 20, 12, 24, 36, 24];
export const holtWintersCalc: CalcDef = calc({
  id: 'holt-winters', name: 'Holt-Winters (Trend and Seasonality)', short: 'Holt-Winters', cat: CAT,
  bq: 'My sales trend and follow the calendar. What should I expect?',
  blurb: 'Triple exponential smoothing with level, trend, and multiplicative seasonal factors.',
  keywords: ['holt-winters', 'winters model', 'triple exponential smoothing', 'trend and seasonality', 'gamma'],
  symptoms: ['seasonal and growing', 'forecast with seasonality and trend', 'holiday sales growing each year'],
  formula: (s) => `F_{t+1} = (L_t + T_t)\\,S_{t+1-m}`,
  inputs: [dataIn(HW, { minRows: 4 }), int('m', { sym: 'm', label: 'Seasons per cycle', blabel: 'Periods in one cycle (4 = quarters, 12 = months)', def: 4, min: 2, max: 52, cues: ['seasons', 'quarters', 'periods per year'] }),
    num('alpha', { sym: 'alpha', label: 'α (level)', blabel: 'Responsiveness of the level', def: 0.5, min: 0, max: 1, step: 0.05, sens: true, cues: ['alpha'] }), num('beta', { sym: 'beta', label: 'β (trend)', blabel: 'Responsiveness of the trend', def: 0.5, min: 0, max: 1, step: 0.05, sens: true, cues: ['beta'] }), num('gamma', { sym: 'gamma', label: 'γ (seasonality)', blabel: 'Responsiveness of the seasonal pattern', def: 0.5, min: 0, max: 1, step: 0.05, sens: true, cues: ['gamma'] })],
  outputs: [out('next', 'Forecast for next period', { sym: 'F_{t+1}', unit: 'units', primary: true }), out('level', 'Final level', { dp: 3 }), out('trend', 'Final trend', { dp: 3 }), ...accOuts()],
  check: (v) => (v.data.length < 2 * v.m ? `Holt-Winters needs at least two full cycles to start (${2 * v.m} values for ${v.m} seasons).` : (v.data as number[]).slice(0, v.m).some((x) => x <= 0) || mean((v.data as number[]).slice(0, v.m)) <= 0 ? 'The first cycle must have positive demand to initialize the seasonal factors.' : null),
  compute: (v) => { const a = v.data as number[]; const fit = holtWinters(a, v.m, v.alpha, v.beta, v.gamma); const e = errors(a, fit.fc, fit.start); return { next: fit.next, level: fit.level[a.length - 1], trend: fit.trend[a.length - 1], ahead: fit.ahead, fc: fit.fc.slice(fit.start), lv: fit.level, tr: fit.trend, se: fit.season, MAD: e.mad, MSE: e.mse, MAPE: e.mape, nErr: e.n }; },
  steps: (v, o, c) => { const a = v.data as number[], m = v.m; const fit = holtWinters(a, m, v.alpha, v.beta, v.gamma); return [
    { title: 'Initialize from the first two cycles', tex: `L_0 = ${tx('mean of cycle 1')} = ${c.f.t(mean(a.slice(0, m)), 3)}, \\quad T_0 = ${fr(`${tx('mean of cycle 2')} - ${tx('mean of cycle 1')}`, 'm')} = ${c.f.t((mean(a.slice(m, 2 * m)) - mean(a.slice(0, m))) / m, 3)}, \\quad S_i = ${fr('A_i', 'L_0')}`, why: 'Level starts at the first cycle’s average, trend at the average per-period change between the first two cycles, and each seasonal factor at that period’s demand relative to the level.', eli: 'Use the first year to learn the typical size and the shape of the year, and the second year to see how fast things are growing.' },
    { title: 'Forecast, then update level, trend, and seasonal factor', tex: `F_t = (L_{t-1} + T_{t-1})S_{t-m}, \; L_t = ${c.s.alpha}${fr('A_t', 'S_{t-m}')} + (1-${c.s.alpha})(L_{t-1}+T_{t-1}), \; T_t = ${c.s.beta}(L_t - L_{t-1}) + (1-${c.s.beta})T_{t-1}, \; S_t = ${c.s.gamma}${fr('A_t', 'L_t')} + (1-${c.s.gamma})S_{t-m}`, why: 'Remove seasonality from the new actual to update the level, compare levels to update the trend, and compare the actual to the level to update that season’s factor.', table: { columns: ['Period', 'Actual', 'Level', 'Trend', 'Seasonal', 'Forecast', 'Error'], rows: a.map((y, i) => [i + 1, c.f.num(y), Number.isFinite(fit.level[i]) ? c.f.num(fit.level[i], 3) : '', Number.isFinite(fit.trend[i]) ? c.f.num(fit.trend[i], 3) : '', c.f.num(fit.season[i], 4), Number.isFinite(fit.fc[i]) ? c.f.num(fit.fc[i], 3) : '', Number.isFinite(fit.fc[i]) ? c.f.num(y - fit.fc[i], 3) : '']) } },
    { title: 'Forecast ahead', tex: `F_{t+h} = (L_t + h\\,T_t)\\,S_{t+h-m} \;\\Rightarrow\; F_{${a.length + 1}} = (${c.f.t(o.level, 3)} + ${c.f.t(o.trend, 3)}) \\times ${c.f.t(fit.season[a.length - m], 4)} = ${c.f.t(o.next, 3)}`, why: 'Extend the level by the trend and multiply by the seasonal factor for that position in the cycle.' },
    accStep(o, c),
  ]; },
  biz: (v, o, f) => ({ headline: `Expect about ${f.int(Math.round(o.next))} units next period.`, meaning: [`The next full cycle looks like: ${o.ahead.map((x: number) => f.int(x)).join(', ')} units.`, `Underlying demand is ${o.trend >= 0 ? 'growing' : 'shrinking'} by about ${f.num(Math.abs(o.trend), 1)} units per period once seasonality is removed.`, accBiz(o, f)], actions: ['Use the cycle forecast to pre-build stock for the peak.', 'With less than three cycles of history, treat the seasonal pattern as a rough guide.', 'The Plan Builder tunes these settings automatically for every SKU.'] }),
  viz: (v, o) => { const fit = holtWinters(v.data, v.m, v.alpha, v.beta, v.gamma); return fcViz(v.data, fit.fc, o.next, o.MAD, o.ahead.slice(1)); },
  traps: ['Use the seasonal factor from one cycle ago (t − m), not the most recent one.', 'You need at least two full cycles to initialize.', 'Initialization methods differ between textbooks and software, so early forecasts can differ slightly.'],
  analogy: 'Forecasting a beach town’s visitors: a growing town (trend) that always spikes in July (season).',
  convention: 'Multiplicative seasonality. Initialization: L from the first cycle’s mean, T from the change in cycle means, S from first-cycle ratios. Updates begin in the second cycle.',
  examples: [
    { title: 'Two quarterly cycles, responsive settings', story: 'Quarterly demand: 10, 20, 30, 20, then 12, 24, 36, 24. α = β = γ = 0.5.', v: { data: HW, m: 4, alpha: 0.5, beta: 0.5, gamma: 0.5 }, expect: { next: 13.314, MAD: 1.6523, level: 25.0703 } },
    { title: 'Same data, calmer settings', story: 'Same demand with α = 0.2, β = 0.1, γ = 0.3.', v: { data: HW, m: 4, alpha: 0.2, beta: 0.1, gamma: 0.3 }, expect: { next: 13.404, level: 24.8787 } },
  ],
  practice: { ask: ['next'], gen: (r) => { const b = 20 + Math.floor(r() * 30); return { data: [1, 1.2].flatMap((g) => [0.5, 1, 1.5, 1].map((p) => Math.round(b * p * g))), m: 4, alpha: 0.5, beta: 0.5, gamma: 0.5 }; }, prompt: (v) => `Quarterly demand was ${v.data.slice(0, 4).join(', ')} in year 1 and ${v.data.slice(4).join(', ')} in year 2. Using Holt-Winters (multiplicative) with α = β = γ = 0.5, initialized from the two years as described on this page, what is the forecast for the first quarter of year 3?` },
  gen: (r) => { const m = [2, 3, 4, 6][Math.floor(r() * 4)], cycles = 2 + Math.floor(r() * 3); const pat = Array.from({ length: m }, () => 0.5 + r()); const b = 50 + Math.floor(r() * 500); return { data: Array.from({ length: m * cycles }, (_, i) => Math.max(1, Math.round(b * pat[i % m] * (1 + 0.02 * i) + (r() - 0.5) * 0.1 * b))), m, alpha: +(0.05 + r() * 0.9).toFixed(2), beta: +(0.05 + r() * 0.9).toFixed(2), gamma: +(0.05 + r() * 0.9).toFixed(2) }; },
  uses: ['holt', 'seasonal-indices'],
});

export const linearRegression: CalcDef = calc({
  id: 'linear-regression', name: 'Linear Regression / Trend Projection', short: 'Trend projection', cat: CAT,
  bq: 'Where is my sales trend line heading?',
  blurb: 'Fits a least-squares line through the data and projects it forward. Works for a time trend or any single predictor.',
  keywords: ['linear regression', 'trend projection', 'least squares', 'trend line', 'slope', 'intercept', 'causal forecasting', 'correlation', 'r squared'],
  symptoms: ['project the trend', 'long-term forecast', 'sales vs advertising', 'does x drive y'],
  formula: () => `\\hat{y} = a + bx, \\quad b = ${fr('\\sum xy - n\\bar{x}\\bar{y}', '\\sum x^2 - n\\bar{x}^2')}, \\quad a = \\bar{y} - b\\bar{x}`,
  inputs: [series('data', { sym: 'y', label: 'Demand values y (oldest first)', blabel: 'Past sales, oldest first', def: [74, 79, 80, 90, 105, 142, 122], minRows: 3, cues: ['demand', 'sales'] }),
    series('xs', { sym: 'x', label: 'x values (leave empty for periods 1, 2, 3, …)', blabel: 'Driver values (leave empty to use time)', def: [], minRows: 0, adv: true, help: 'For a causal model, enter the predictor for each observation (advertising, price, temperature).' }),
    num('xNew', { sym: 'x', label: 'x value to forecast (0 = next period)', blabel: 'Period (or driver value) to forecast; 0 = next period', def: 0, cues: ['forecast for period', 'forecast for year', 'predict for'] })],
  outputs: [out('forecast', 'Forecast', { sym: '\\hat{y}', primary: true, dp: 2 }), out('b', 'Slope', { sym: 'b', dp: 4 }), out('a', 'Intercept', { sym: 'a', dp: 4 }), out('r', 'Correlation coefficient', { sym: 'r', dp: 4 }), out('r2', 'Coefficient of determination', { sym: 'r^2', dp: 4 }), out('syx', 'Standard error of the estimate', { sym: 'S_{y,x}', dp: 3 })],
  check: (v) => (v.xs.length && v.xs.length !== v.data.length ? `x and y must have the same number of values (x has ${v.xs.length}, y has ${v.data.length}).` : v.xs.length && new Set(v.xs).size < 2 ? 'x values are all the same, so no line can be fitted.' : null),
  compute: (v) => { const y = v.data as number[]; const x = v.xs.length ? (v.xs as number[]) : y.map((_, i) => i + 1); const g = linreg(x, y); const xNew = v.xNew === 0 && !v.xs.length ? y.length + 1 : v.xNew; return { ...g, xNew, forecast: g.a + g.b * xNew, xbar: mean(x), ybar: mean(y), sxy: sum(x.map((xi, i) => xi * y[i])), sxx: sum(x.map((xi) => xi * xi)) }; },
  steps: (v, o, c) => { const y = v.data as number[]; const x = v.xs.length ? (v.xs as number[]) : y.map((_, i) => i + 1); const n = y.length; return [
    { title: 'Build the sums', why: 'Least squares needs the means of x and y, the sum of x·y, and the sum of x².', table: { columns: ['x', 'y', 'x²', 'xy'], rows: [...x.map((xi, i) => [c.f.num(xi), c.f.num(y[i]), c.f.num(xi * xi), c.f.num(xi * y[i])]), ['Σ ' + c.f.num(sum(x)), 'Σ ' + c.f.num(sum(y)), 'Σ ' + c.f.num(o.sxx), 'Σ ' + c.f.num(o.sxy)]] } },
    { title: 'Slope', tex: `b = ${fr('\\sum xy - n\\bar{x}\\bar{y}', '\\sum x^2 - n\\bar{x}^2')} = ${fr(`${c.f.t(o.sxy)} - ${n}(${c.f.t(o.xbar, 3)})(${c.f.t(o.ybar, 3)})`, `${c.f.t(o.sxx)} - ${n}(${c.f.t(o.xbar, 3)})^2`)} = ${c.f.t(o.b, 4)}`, why: 'The slope is how much y changes for each one-unit increase in x.', eli: 'How many more units do you sell each period, on average?' },
    { title: 'Intercept', tex: `a = \\bar{y} - b\\bar{x} = ${c.f.t(o.ybar, 3)} - ${c.f.t(o.b, 4)}(${c.f.t(o.xbar, 3)}) = ${c.f.t(o.a, 4)}`, why: 'The line always passes through the point of means.' },
    { title: 'Project', tex: `\\hat{y} = a + bx = ${c.f.t(o.a, 4)} + ${c.f.t(o.b, 4)}(${c.f.t(o.xNew)}) = ${c.f.t(o.forecast, 3)}`, why: 'Plug the future x into the fitted line.' },
    { title: 'Strength of the relationship', tex: `r = ${c.f.t(o.r, 4)}, \\quad r^2 = ${c.f.t(o.r2, 4)}, \\quad S_{y,x} = ${c.f.t(o.syx, 3)}`, why: `r² says the line explains ${c.f.pct(o.r2 * 100, 1)} of the variation in y. The standard error is the typical distance of a point from the line.`, eli: 'r² near 1 means the dots hug the line. Near 0 means the line is not telling you much.' },
  ]; },
  biz: (v, o, f) => ({ headline: `The trend line points to about ${f.int(Math.round(o.forecast))} ${v.xs.length ? `when the driver is ${f.num(o.xNew)}` : `in period ${f.int(o.xNew)}`}.`, meaning: [`${v.xs.length ? 'Each one-unit increase in the driver' : 'Each period'} ${o.b >= 0 ? 'adds' : 'removes'} about ${f.num(Math.abs(o.b), 1)} units.`, `The line explains ${f.pct(o.r2 * 100, 0)} of the ups and downs in your data.`, `Typical miss: about ${f.num(o.syx, 1)} units either way.`], actions: [o.r2 < 0.5 ? 'The fit is weak. Do not lean on this line alone.' : 'The fit is solid enough to plan around for the near term.', 'Do not project far beyond your data: trends bend.', 'Check for seasonality hiding inside the scatter.'] }),
  viz: (v, o) => { const y = v.data as number[]; const x = v.xs.length ? (v.xs as number[]) : y.map((_, i) => i + 1); const lo = Math.min(...x, o.xNew), hi = Math.max(...x, o.xNew); return { kind: 'xy', x: { label: v.xs.length ? 'x' : 'Period' }, y: { label: 'y' }, series: [{ name: 'Data', style: 'dots', tone: 'muted', pts: x.map((xi, i) => [xi, y[i]] as [number, number]) }, { name: 'Trend line', style: 'line', tone: 'accent', pts: [[lo, o.a + o.b * lo], [hi, o.a + o.b * hi]] }], marks: [{ x: o.xNew, y: o.forecast, label: 'Forecast', tone: 'accent' }] }; },
  traps: ['Forgetting n in the slope formula, or squaring the sum instead of summing the squares.', 'Correlation is not causation.', 'Extrapolating far beyond the data range.'],
  analogy: 'Laying a ruler through a scatter of dots so it sits as close as possible to all of them, then following the ruler forward.',
  examples: [
    { title: 'Electrical power demand', story: 'Demand over seven years was 74, 79, 80, 90, 105, 142, 122 megawatts. Project year 8.', v: { data: [74, 79, 80, 90, 105, 142, 122] }, expect: { b: 10.536, a: 56.714, forecast: 141, r: 0.895 } },
    { title: 'Sales against advertising', story: 'Advertising of 1, 2, 3, 4, 5 (thousand $) produced sales of 2, 4, 5, 4, 5 (thousand units). Predict sales at advertising of 6.', v: { data: [2, 4, 5, 4, 5], xs: [1, 2, 3, 4, 5], xNew: 6 }, expect: { b: 0.6, a: 2.2, forecast: 5.8, r2: 0.6 } },
  ],
  practice: { ask: ['forecast'], gen: (r) => { const b = 5 + Math.floor(r() * 15); return { data: randSeries(r, 5, 50 + Math.floor(r() * 100), b, 0.05), xs: [], xNew: 0 }; }, prompt: (v) => `Demand over ${v.data.length} periods was ${v.data.join(', ')}. Fit a least-squares trend line and forecast period ${v.data.length + 1}.` },
  gen: (r) => { const n = 3 + Math.floor(r() * 15); const causal = r() < 0.4; return { data: randSeries(r, n, 20 + Math.floor(r() * 500), (r() - 0.4) * 30, 0.2), xs: causal ? Array.from({ length: n }, (_, i) => +(i * (1 + r()) + r() * 3).toFixed(2)) : [], xNew: causal ? +(r() * 40).toFixed(1) : r() < 0.5 ? 0 : n + 1 + Math.floor(r() * 5) }; },
  uses: [],
});

// ---- Forecast accuracy family ---------------------------------------------------------------
const accIns = (withSign = false, withLimit = false): InputDef[] => [
  series('actual', { sym: 'At', label: 'Actual demand', blabel: 'What actually happened', def: [90, 95, 115, 100, 125, 140], minRows: 1, cues: ['actual', 'demand', 'sales'] }),
  series('forecast', { sym: 'Ft', label: 'Forecast demand', blabel: 'What you forecast', def: [100, 100, 100, 110, 110, 110], minRows: 1, cues: ['forecast', 'forecasts', 'predicted'] }),
  ...(withSign ? [sel('errSign', 'Error defined as', [['AF', 'Actual − Forecast (Heizer, Jacobs)'], ['FA', 'Forecast − Actual (Chopra)']], 'AF', { learnerOnly: true, help: 'Textbooks disagree on the sign. With Actual − Forecast, a positive bias means you under-forecast.' })] : []),
  ...(withLimit ? [num('limit', { label: 'Control limit (± MADs)', blabel: 'Alarm threshold (± MADs)', def: 4, min: 0.1, max: 20, adv: true, cues: ['control limits of', 'limits of'] })] : []),
];
const accCheck = (v: Vals) => (v.actual.length !== v.forecast.length ? `Actual and forecast must have the same number of values (actual has ${v.actual.length}, forecast has ${v.forecast.length}).` : null);
const accCompute = (v: Vals) => { const e = errors(v.actual, v.forecast, 0, v.errSign ?? 'AF'); return { MAD: e.mad, MSE: e.mse, MAPE: e.mape, bias: e.bias, RSFE: e.rsfe, TS: e.ts, RMSE: Math.sqrt(e.mse), n: e.n, e: e.e, runTs: e.runTs, sigma: 1.25 * e.mad }; };
const accTable = (v: Vals, o: any, f: Fmt): TableSpec => ({ columns: ['Period', 'Actual', 'Forecast', 'Error', '|Error|', 'Error²', '|Error| / Actual'], rows: [...(v.actual as number[]).map((a, i) => [i + 1, f.num(a), f.num(v.forecast[i]), f.num(o.e[i], 3), f.num(Math.abs(o.e[i]), 3), f.num(o.e[i] ** 2, 3), a !== 0 ? f.pct(Math.abs(o.e[i] / a) * 100, 2) : 'n/a']), ['Total', '', '', f.num(o.RSFE, 3), f.num(o.MAD * o.n, 3), f.num(o.MSE * o.n, 3), '']] });
const accViz = (v: Vals, o: any): VizSpec => fcViz(v.actual, v.forecast, NaN, o.MAD);
const accGen = (r: Rng) => { const n = 3 + Math.floor(r() * 15); const actual = randSeries(r, n, 30 + Math.floor(r() * 800), 0, 0.3); return { actual, forecast: actual.map((a) => Math.max(1, Math.round(a * (0.75 + r() * 0.5)))), errSign: r() < 0.7 ? 'AF' : 'FA', limit: 4 }; };
const accPractice = (label: string, ask: string) => ({ ask: [ask], gen: (r: Rng) => { const actual = randSeries(r, 5, 80 + Math.floor(r() * 200)); return { actual, forecast: actual.map((a) => Math.round(a * (0.85 + r() * 0.3))), errSign: 'AF', limit: 4 }; }, prompt: (v: Vals) => `Actual demand was ${v.actual.join(', ')} and the forecasts were ${v.forecast.join(', ')}. Compute the ${label}${ask === 'bias' || ask === 'TS' ? ' (error = actual − forecast)' : ''}.` });
const BAKERY = { actual: [90, 95, 115, 100, 125, 140], forecast: [100, 100, 100, 110, 110, 110] };
const PORTF = { actual: PORT, forecast: [175, 175.5, 174.75, 173.18, 173.36, 175.02, 178.02, 178.22] };

export const mad: CalcDef = calc({
  id: 'mad', name: 'Mean Absolute Deviation (MAD)', short: 'MAD', cat: CAT,
  bq: 'How far off are my forecasts, on average?',
  blurb: 'The average size of the forecast error in units, ignoring direction.',
  keywords: ['mad', 'mean absolute deviation', 'mean absolute error', 'mae', 'forecast error', 'forecast accuracy'],
  symptoms: ['how accurate is my forecast', 'forecast error', 'how wrong are my forecasts'],
  formula: (s) => `MAD = ${fr(`\\sum |${s.At} - ${s.Ft}|`, 'n')}`,
  inputs: accIns(), outputs: [out('MAD', 'MAD', { primary: true, dp: 3, unit: 'units' }), out('sigma', 'Approx. std. deviation of error (1.25 × MAD)', { dp: 3 }), out('MSE', 'MSE', { dp: 3 }), out('MAPE', 'MAPE', { fmt: 'pct', dp: 2 })],
  check: accCheck, compute: accCompute,
  steps: (v, o, c) => [
    { title: 'Compute the error and its absolute value each period', why: 'Error is actual minus forecast. Taking the absolute value stops over- and under-forecasts from cancelling.', table: accTable(v, o, c.f), eli: 'Count every miss as a miss, whether you guessed too high or too low.' },
    { title: 'Average the absolute errors', tex: `MAD = ${fr(`\\sum |${c.s.At} - ${c.s.Ft}|`, 'n')} = ${fr(c.f.t(o.MAD * o.n, 3), o.n)} = ${c.f.t(o.MAD, 3)}`, why: 'MAD is in the same units as demand, which makes it easy to interpret.' },
    { title: 'Link to safety stock', tex: `\\sigma \\approx 1.25 \\times MAD = ${c.f.t(o.sigma, 3)}`, why: 'For roughly normal errors, the standard deviation of forecast error is about 1.25 times MAD. That σ is what safety stock formulas need.' },
  ],
  biz: (v, o, f) => ({ headline: `Your forecasts miss by about ${f.num(o.MAD, 1)} units per period on average.`, meaning: [`That is ${f.pct(o.MAPE, 1)} of demand.`, `For safety stock, treat forecast error as having a standard deviation of about ${f.num(o.sigma, 1)} units.`], actions: ['Compare MAD across forecasting methods and keep the lowest.', 'Feed the σ estimate into the Safety Stock calculator.', 'Track MAD monthly: a rising MAD means the method is losing its grip.'] }),
  viz: accViz,
  traps: ['Taking the absolute value after summing instead of before.', 'Dividing by the wrong n: count only periods with both an actual and a forecast.'],
  analogy: 'A dart player’s average distance from the bullseye, regardless of direction.',
  examples: [
    { title: 'Bakery forecasts', story: 'Forecasts were 100, 100, 100, 110, 110, 110 and actual sales were 90, 95, 115, 100, 125, 140.', v: BAKERY, expect: { MAD: 14.167 } },
    { title: 'Port unloading', story: 'Actual tonnage 180, 168, 159, 175, 190, 205, 180, 182 against forecasts 175, 175.5, 174.75, 173.18, 173.36, 175.02, 178.02, 178.22.', v: PORTF, expect: { MAD: 10.31 } },
  ],
  practice: accPractice('MAD', 'MAD'), gen: accGen, uses: [],
});

export const mse: CalcDef = calc({
  id: 'mse', name: 'Mean Squared Error (MSE)', short: 'MSE', cat: CAT,
  bq: 'How bad are my big forecast misses?',
  blurb: 'The average squared forecast error, which penalizes large misses much more than small ones.',
  keywords: ['mse', 'mean squared error', 'rmse', 'root mean squared error', 'squared error'],
  symptoms: ['large forecast errors', 'penalize big misses'],
  formula: (s) => `MSE = ${fr(`\\sum (${s.At} - ${s.Ft})^2`, 'n')}`,
  inputs: accIns(), outputs: [out('MSE', 'MSE', { primary: true, dp: 3 }), out('RMSE', 'RMSE', { dp: 3, unit: 'units' }), out('MAD', 'MAD', { dp: 3 })],
  check: accCheck, compute: accCompute,
  steps: (v, o, c) => [
    { title: 'Square each period’s error', why: 'Squaring makes every error positive and makes a miss of 20 count four times as much as a miss of 10.', table: accTable(v, o, c.f), eli: 'Small misses are forgiven, big misses hurt a lot.' },
    { title: 'Average the squared errors', tex: `MSE = ${fr(`\\sum (${c.s.At} - ${c.s.Ft})^2`, 'n')} = ${fr(c.f.t(o.MSE * o.n, 3), o.n)} = ${c.f.t(o.MSE, 3)}`, why: 'Divide by the number of periods.' },
    { title: 'Root mean squared error', tex: `RMSE = \\sqrt{MSE} = ${c.f.t(o.RMSE, 3)}`, why: 'Taking the square root returns the measure to units of demand.' },
  ],
  biz: (v, o, f) => ({ headline: `Your typical forecast miss, weighting big misses heavily, is about ${f.num(o.RMSE, 1)} units.`, meaning: [`MSE is ${f.num(o.MSE, 1)} (in squared units), so RMSE is the easier number to read.`, o.RMSE > o.MAD * 1.4 ? 'RMSE is well above MAD, which means a few large misses are doing most of the damage.' : 'RMSE is close to MAD, so your errors are fairly even in size.'], actions: ['Use MSE to choose a method when large misses are especially costly (stockouts of key items).', 'Look at the largest errors individually: one-off events often explain them.'] }),
  viz: accViz,
  traps: ['MSE is in squared units. Report RMSE if you want units of demand.', 'Some texts divide by n − 1 or n − 2. This calculator divides by n.'],
  analogy: 'A strict teacher who takes off four points for a mistake twice as big.',
  convention: 'MSE divides the sum of squared errors by n, the number of forecast periods.',
  examples: [
    { title: 'Port unloading', story: 'Actual tonnage 180, 168, 159, 175, 190, 205, 180, 182 against forecasts 175, 175.5, 174.75, 173.18, 173.36, 175.02, 178.02, 178.22.', v: PORTF, expect: { MSE: 190.82 } },
    { title: 'Bakery forecasts', story: 'Forecasts 100, 100, 100, 110, 110, 110; actuals 90, 95, 115, 100, 125, 140.', v: BAKERY, expect: { MSE: 262.5, RMSE: 16.202 } },
  ],
  practice: accPractice('MSE', 'MSE'), gen: accGen, uses: [],
});

export const mape: CalcDef = calc({
  id: 'mape', name: 'Mean Absolute Percent Error (MAPE)', short: 'MAPE', cat: CAT,
  bq: 'What percent are my forecasts off by?',
  blurb: 'The average forecast error as a percentage of actual demand, comparable across products of different sizes.',
  keywords: ['mape', 'mean absolute percent error', 'percentage error', 'forecast accuracy percent'],
  symptoms: ['forecast accuracy percentage', 'compare forecast accuracy across products', 'how accurate in percent'],
  formula: (s) => `MAPE = ${fr(`100`, 'n')} \\sum ${fr(`|${s.At} - ${s.Ft}|`, s.At)}`,
  inputs: accIns(), outputs: [out('MAPE', 'MAPE', { primary: true, fmt: 'pct', dp: 2 }), out('accuracy', 'Forecast accuracy (100% − MAPE)', { fmt: 'pct', dp: 2 }), out('MAD', 'MAD', { dp: 3 })],
  check: (v) => accCheck(v) ?? ((v.actual as number[]).some((a) => a === 0) ? 'MAPE divides by actual demand, so it cannot be computed when a period has zero actual demand. Remove that period or use MAD instead.' : null),
  compute: (v) => { const o = accCompute(v); return { ...o, accuracy: 100 - o.MAPE }; },
  steps: (v, o, c) => [
    { title: 'Absolute percent error for each period', why: 'Divide each absolute error by that period’s actual demand.', table: accTable(v, o, c.f), eli: 'Being off by 10 matters a lot if you sell 20, and barely at all if you sell 2,000. Percentages make that fair.' },
    { title: 'Average the percentages', tex: `MAPE = ${fr(100, 'n')} \\sum ${fr(`|${c.s.At} - ${c.s.Ft}|`, c.s.At)} = ${c.f.t(o.MAPE, 2)}\\%`, why: 'The mean of the period-by-period percent errors.' },
  ],
  biz: (v, o, f) => ({ headline: `Your forecasts are off by ${f.pct(o.MAPE, 1)} on average.`, meaning: [`Put another way, forecast accuracy is about ${f.pct(o.accuracy, 1)}.`, o.MAPE < 10 ? 'Under 10% is excellent for most products.' : o.MAPE < 25 ? '10 to 25% is typical for SKU-level retail forecasts.' : 'Above 25% usually means volatile demand or the wrong forecasting method.'], actions: ['Compare MAPE across products to find where forecasting needs work.', 'Low-volume items naturally have high MAPE. Judge them by MAD or by service level instead.'] }),
  viz: accViz,
  traps: ['Divide by actual demand, not by the forecast.', 'MAPE explodes when actual demand is near zero.', 'Average the percentages. Do not divide total error by total demand (that is a different measure, WAPE).'],
  analogy: 'Saying a recipe estimate was "off by 5%" instead of "off by 2 tablespoons": it works for any batch size.',
  examples: [
    { title: 'Port unloading', story: 'Actual tonnage 180, 168, 159, 175, 190, 205, 180, 182 against forecasts 175, 175.5, 174.75, 173.18, 173.36, 175.02, 178.02, 178.22.', v: PORTF, expect: { MAPE: 5.59 } },
    { title: 'Bakery forecasts', story: 'Forecasts 100, 100, 100, 110, 110, 110; actuals 90, 95, 115, 100, 125, 140.', v: BAKERY, expect: { MAPE: 12.14 } },
  ],
  practice: accPractice('MAPE (in %)', 'MAPE'), gen: accGen, uses: [],
});

export const forecastBias: CalcDef = calc({
  id: 'forecast-bias', name: 'Forecast Bias', short: 'Bias', cat: CAT,
  bq: 'Do my forecasts lean too high or too low?',
  blurb: 'The average signed forecast error and its running sum (RSFE), showing whether forecasts are consistently high or low.',
  keywords: ['bias', 'forecast bias', 'mean error', 'mean forecast error', 'rsfe', 'running sum of forecast errors', 'cfe'],
  symptoms: ['always over-forecast', 'always under-forecast', 'forecasts consistently too high', 'forecasts consistently too low'],
  formula: (s) => `${tx('Bias')} = ${fr(`\\sum (${s.At} - ${s.Ft})`, 'n')}`,
  inputs: accIns(true), outputs: [out('bias', 'Bias (mean error)', { primary: true, dp: 3, unit: 'units' }), out('RSFE', 'Running sum of forecast errors', { dp: 3 }), out('MAD', 'MAD', { dp: 3 })],
  check: accCheck, compute: accCompute,
  steps: (v, o, c) => [
    { title: 'Signed error each period', tex: v.errSign === 'FA' ? `e_t = ${c.s.Ft} - ${c.s.At}` : `e_t = ${c.s.At} - ${c.s.Ft}`, why: v.errSign === 'FA' ? 'Using forecast minus actual (Chopra & Meindl): a positive error means the forecast was too high.' : 'Using actual minus forecast (Heizer, Jacobs): a positive error means the forecast was too low.', table: accTable(v, o, c.f) },
    { title: 'Sum the errors (RSFE)', tex: `RSFE = \\sum e_t = ${c.f.t(o.RSFE, 3)}`, why: 'Unlike MAD, positives and negatives are allowed to cancel. A sum far from zero reveals a consistent lean.' },
    { title: 'Average to get the bias', tex: `${tx('Bias')} = ${fr('RSFE', 'n')} = ${fr(c.f.t(o.RSFE, 3), o.n)} = ${c.f.t(o.bias, 3)}`, why: 'The average signed miss per period.', eli: 'If a scale always reads 2 pounds heavy, that is bias. It is a consistent lean, not random scatter.' },
  ],
  biz: (v, o, f) => { const under = (v.errSign === 'FA' ? -o.bias : o.bias) > 0; return { headline: Math.abs(o.bias) < 0.05 * Math.max(o.MAD, 1e-9) ? 'Your forecasts show no meaningful lean high or low.' : `Your forecasts run ${under ? 'low' : 'high'} by about ${f.num(Math.abs(o.bias), 1)} units per period.`, meaning: [under ? 'Demand keeps beating the forecast, so you are likely to run short.' : 'The forecast keeps beating demand, so you are likely building excess stock.', `The typical miss in either direction (MAD) is ${f.num(o.MAD, 1)} units.`], actions: [under ? 'Raise the forecast or check for a growth trend your method is missing.' : 'Trim the forecast or check for a decline or a lost customer.', 'Use the Tracking Signal calculator to decide when bias is large enough to act on.'] }; },
  viz: (v, o) => ({ kind: 'xy', x: { label: 'Period' }, y: { label: 'Forecast error' }, series: [{ name: 'Error', style: 'bars', tone: 'accent', pts: o.e.map((x: number, i: number) => [i + 1, x] as [number, number]) }], hlines: [{ y: 0, label: 'No error', tone: 'muted' }, { y: o.bias, label: 'Bias', tone: 'warn' }] }),
  traps: ['Sign conventions differ between textbooks. Always state which you use.', 'A bias near zero does not mean the forecast is accurate. Large errors can cancel.'],
  analogy: 'A bathroom scale that always reads two pounds heavy.',
  convention: 'Default error is actual − forecast (positive = under-forecast). Chopra & Meindl use forecast − actual; Learner mode can switch.',
  examples: [
    { title: 'Bakery forecasts', story: 'Forecasts 100, 100, 100, 110, 110, 110; actuals 90, 95, 115, 100, 125, 140.', v: BAKERY, expect: { RSFE: 35, bias: 5.833 } },
    { title: 'Forecast minus actual', story: 'Same data using the Chopra convention, error = forecast − actual.', v: { ...BAKERY, errSign: 'FA' }, expect: { RSFE: -35, bias: -5.833 } },
  ],
  practice: accPractice('bias (mean error)', 'bias'), gen: accGen, uses: [],
});

export const trackingSignal: CalcDef = calc({
  id: 'tracking-signal', name: 'Tracking Signal', short: 'Tracking signal', cat: CAT,
  bq: 'Is my forecast drifting out of control?',
  blurb: 'Running sum of forecast errors divided by MAD: an alarm that tells you when a forecast has become biased.',
  keywords: ['tracking signal', 'rsfe / mad', 'forecast control', 'bias detection', 'control limits'],
  symptoms: ['is my forecast still working', 'forecast drifting', 'when to change forecasting method'],
  formula: () => `TS = ${fr('RSFE', 'MAD')}`,
  inputs: accIns(true, true), outputs: [out('TS', 'Tracking signal', { primary: true, dp: 3, unit: 'MADs' }), out('RSFE', 'RSFE', { dp: 3 }), out('MAD', 'MAD', { dp: 3 })],
  check: accCheck, compute: accCompute,
  steps: (v, o, c) => [
    { title: 'Running sum of forecast errors', tex: `RSFE = \\sum (${v.errSign === 'FA' ? `${c.s.Ft} - ${c.s.At}` : `${c.s.At} - ${c.s.Ft}`}) = ${c.f.t(o.RSFE, 3)}`, why: `Signed errors are added so that a consistent lean accumulates. Sign convention: error = ${v.errSign === 'FA' ? 'forecast − actual' : 'actual − forecast'}.`, table: accTable(v, o, c.f) },
    { title: 'Mean absolute deviation', tex: `MAD = ${fr('\\sum |e_t|', 'n')} = ${c.f.t(o.MAD, 3)}`, why: 'MAD is the yardstick: the typical size of one period’s error.' },
    { title: 'Tracking signal', tex: `TS = ${fr('RSFE', 'MAD')} = ${fr(c.f.t(o.RSFE, 3), c.f.t(o.MAD, 3))} = ${c.f.t(o.TS, 3)}`, why: `The cumulative error measured in MADs. Within ±${v.limit} MADs the forecast is considered in control.`, eli: 'Small misses in both directions are fine. But if the misses keep piling up on one side, the alarm should ring.' },
  ],
  biz: (v, o, f) => { const out = Math.abs(o.TS) > v.limit; const under = (v.errSign === 'FA' ? -o.TS : o.TS) > 0; return { headline: out ? `Alarm: your forecast is biased ${under ? 'low' : 'high'} (tracking signal ${f.num(o.TS, 1)}).` : `Your forecast is in control (tracking signal ${f.num(o.TS, 1)}, limit ±${f.num(v.limit, 0)}).`, meaning: [`Cumulative error is ${f.num(Math.abs(o.TS), 1)} times the typical miss.`, under ? 'Positive drift: demand has been running above forecast.' : 'Negative drift: demand has been running below forecast.'], actions: [out ? 'Re-fit the forecast now: check for a new trend, a lost or gained customer, or a price change.' : 'No action needed. Keep monitoring each period.', 'Use tighter limits (±3) for A items and looser (±6 to 8) for C items.'] }; },
  viz: (v, o) => ({ kind: 'xy', x: { label: 'Period' }, y: { label: 'Tracking signal (MADs)' }, series: [{ name: 'Tracking signal', style: 'line', tone: 'accent', pts: o.runTs.map((x: number, i: number) => [i + 1, x] as [number, number]) }], hlines: [{ y: v.limit, label: `Upper limit +${v.limit}`, tone: 'bad' }, { y: -v.limit, label: `Lower limit −${v.limit}`, tone: 'bad' }, { y: 0, label: '', tone: 'muted' }], flagged: o.runTs.map((x: number, i: number) => (Math.abs(x) > v.limit ? i : -1)).filter((i: number) => i >= 0) }),
  traps: ['Use the signed running sum on top and MAD (absolute errors) on the bottom.', 'State the sign convention: the sign of the tracking signal flips with it.', 'A tracking signal is unitless. It counts MADs.'],
  analogy: 'A car’s lane-departure warning: a little weaving is fine, but a steady drift to one side sets it off.',
  convention: 'Tracking signal = RSFE / MAD with error = actual − forecast by default, so a positive signal means demand exceeds forecast. Limits of ±4 MADs are a common default.',
  examples: [
    { title: 'Bakery forecasts', story: 'Forecasts 100, 100, 100, 110, 110, 110; actuals 90, 95, 115, 100, 125, 140. Is the forecast in control?', v: BAKERY, expect: { RSFE: 35, MAD: 14.167, TS: 2.471 } },
    { title: 'Persistent under-forecast', story: 'Forecast 50 every period; actuals 54, 56, 53, 58, 57.', v: { actual: [54, 56, 53, 58, 57], forecast: [50, 50, 50, 50, 50] }, expect: { RSFE: 28, MAD: 5.6, TS: 5 } },
  ],
  practice: accPractice('tracking signal', 'TS'), gen: accGen, uses: ['mad', 'forecast-bias'],
});

export default [movingAverage, weightedMovingAverage, expSmoothing, holtCalc, seasonalIndices, holtWintersCalc, linearRegression, mad, mse, mape, forecastBias, trackingSignal];
