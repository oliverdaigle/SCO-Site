// "Paste Your Problem": rule-based parser (keywords + regex + unit detection). Works with no API key.
import { CALCS, byId } from './registry';
import { defaults } from './run';
import type { CalcDef, InputDef, TimeUnit, Vals } from './types';

export interface Extracted { inputId: string; label: string; value: any; unit?: string; snippet: string }
export interface ParseResult { calcId: string | null; confidence: number; alternatives: { id: string; score: number }[]; values: Vals; extracted: Extracted[]; leftovers: number[]; notes: string[]; source: 'rules' | 'ai' }

const lc = (s: string) => s.toLowerCase().replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/−|–|—/g, '-');
const has = (t: string, re: RegExp) => re.test(t);

/** Disambiguation rules: phrase patterns that point strongly at one calculator. */
const RULES: [RegExp, string, number][] = [
  [/economic order quantity|\beoq\b|optimal order (quantity|size)/, 'eoq', 4], [/quantity discount|price break|discount schedule|all-units|for orders of|or more units/, 'quantity-discount', 5],
  [/production (rate|run)|economic production|production order quantity|can (produce|make) \d|produces? (at|up to)/, 'epq', 5], [/back-?order(s|ed|ing)? cost|planned shortage|shortages? (are|is) (allowed|permitted)|backordering/, 'backorder-eoq', 6],
  [/number of orders|orders (per|a|each) year|how many orders/, 'orders-per-year', 3], [/time between orders|days between orders|order cycle|how often (should|will)/, 'time-between-orders', 3], [/total (annual )?(inventory )?cost.*(order(s|ing)? (of|in)|lot size of|batches of)|if (it|the firm|they) orders? \d/, 'total-inventory-cost', 3],
  [/newsvendor|newsboy|single[- ]period|salvage|critical ratio|unsold|overage|underage|one[- ]time order|leftover/, 'newsvendor', 6],
  [/review(ed|s)? every|review period|order[- ]up[- ]to|periodic review|fixed[- ]period/, 'periodic-review', 6], [/fill rate|expected shortage|units short|unit normal loss/, 'fill-rate', 6],
  [/(square[- ]root law|risk pooling|centraliz|consolidat(e|ing) .*(warehouse|location))/, 'risk-pooling', 6],
  [/weighted moving average|weights? of/, 'weighted-moving-average', 6], [/moving average/, 'moving-average', 4], [/exponential smoothing|smoothing constant|alpha/, 'exponential-smoothing', 4], [/trend[- ]adjusted|with trend|\bbeta\b|\bholt\b|\bfit\b/, 'holt', 5],
  [/seasonal (index|indices|factor)/, 'seasonal-indices', 6], [/holt-?winters|winters|gamma/, 'holt-winters', 7], [/regression|least squares|trend (line|projection|equation)/, 'linear-regression', 6],
  [/\bmad\b|mean absolute deviation/, 'mad', 5], [/\bmse\b|mean squared error/, 'mse', 6], [/\bmape\b|mean absolute percent/, 'mape', 6], [/tracking signal/, 'tracking-signal', 8], [/\bbias\b|running sum of forecast errors|\brsfe\b/, 'forecast-bias', 5],
  [/little'?s law|flow time|work[- ]in[- ]process|\bwip\b|throughput time/, 'littles-law', 5], [/takt/, 'takt-time', 8], [/bottleneck|process capacity/, 'bottleneck', 6], [/design capacity/, 'utilization', 4], [/effective capacity/, 'efficiency', 4], [/expected output/, 'effective-capacity', 6],
  [/\boee\b|overall equipment/, 'oee', 8], [/workstation|line balanc|assembly line|balance delay/, 'line-balancing', 7], [/learning (curve|rate)|experience curve/, 'learning-curve', 8], [/break-?even/, 'capacity-break-even', 5],
  [/coefficient of variation|\bcva?\b|\bvut\b|kingman/, 'kingman', 7], [/constant (service|rate|time)|exactly \d+ (per|every)|automat(ed|ic)/, 'md1', 3],
  [/x-?bar|r-?chart|range chart|sample means?/, 'xbar-r-chart', 7], [/p-?chart|(fraction|percent|proportion) defective|defectives?/, 'p-chart', 5], [/c-?chart|(number of )?(defects|flaws|complaints|blemishes) per/, 'c-chart', 6],
  [/\bcpk?\b|capability|specification limit|\busl\b|\blsl\b/, 'process-capability', 7], [/dpmo|opportunit(y|ies)|sigma level/, 'dpmo-sigma', 7], [/prevention|appraisal|cost of quality|external failure/, 'cost-of-quality', 6], [/taguchi|quality loss/, 'taguchi-loss', 8],
  [/gross requirement|\bmrp\b|planned order|net requirement/, 'mrp-gross-to-net', 7], [/lot[- ]for[- ]lot|\bl4l\b/, 'lot-for-lot', 8], [/periodic order quantity|\bpoq\b/, 'poq-lot-sizing', 6], [/part[- ]period|\bppb\b/, 'part-period-balancing', 9], [/chase|level (strategy|plan|production)|aggregate plan|subcontract/, 'aggregate-planning', 7],
  [/center[- ]of[- ]gravity/, 'center-of-gravity', 9], [/load[- ]distance/, 'load-distance', 9], [/factor[- ]rating/, 'factor-rating', 9], [/landed cost|\bduty\b|tariff/, 'landed-cost', 6], [/\bcwt\b|hundredweight/, 'freight-cost', 8], [/trailer|container|cartons? (fit|can be loaded)|cube/, 'cube-utilization', 5],
  [/transit time|in[- ]transit|(rail|truck|air|ocean) .*(rail|truck|air|ocean)/, 'in-transit-inventory', 6], [/total cost of ownership|\btco\b/, 'total-cost-of-ownership', 9], [/scorecard|supplier (rating|evaluation)|weighted[- ]point/, 'supplier-scorecard', 7], [/make[- ](or|vs\.?|versus)[- ]buy|outsourc|in-house or/, 'make-vs-buy', 8],
  [/cash[- ]to[- ]cash|cash conversion/, 'cash-to-cash', 9], [/days sales outstanding|\bdso\b/, 'dso', 8], [/days payable|\bdpo\b/, 'dpo', 8], [/return on assets|\broa\b|dupont|strategic profit/, 'dupont-roa', 8], [/perfect order/, 'perfect-order', 9], [/\botif\b|on[- ]time (and )?in[- ]full/, 'otif', 9],
  [/(orders|lines) (shipped|filled) complete|line fill|order fill/, 'order-fill-rate', 8], [/bullwhip/, 'bullwhip-ratio', 9], [/inventory turn|turnover/, 'inventory-turnover', 5], [/(days|weeks) of supply|days of inventory/, 'days-of-supply', 6], [/\babc\b (analysis|classification)|annual dollar volume/, 'abc-classification', 8], [/gmroi|gross margin return/, 'gmroi', 9],
  [/critical path|\bcpm\b|slack|earl(y|iest) start/, 'cpm', 7], [/optimistic|pessimistic|most likely/, 'pert', 8], [/probability .*(complet|finish)|(complet|finish)\w* (in|within|by) .*probab/, 'pert-probability', 7], [/crash/, 'crashing', 9],
  [/expected (monetary )?value|\bemv\b/, 'expected-value', 6], [/perfect information|\bevpi\b/, 'evpi', 9], [/maximax|maximin|minimax|regret|equally likely/, 'decision-criteria', 9], [/decision tree/, 'decision-tree', 8],
];

export function detectCalculator(text: string): { id: string; score: number }[] {
  const t = lc(text); const score: Record<string, number> = {};
  const add = (id: string, s: number) => { score[id] = (score[id] ?? 0) + s; };
  for (const def of CALCS) {
    for (const kw of [def.short, def.name, ...def.keywords]) { const k = lc(kw); if (k.length >= 3 && t.includes(k)) add(def.id, 0.8 + 0.5 * (k.split(' ').length - 1)); }
    let cueHits = 0; for (const i of def.inputs) if (i.cues?.some((cu) => cu.length >= 4 && t.includes(lc(cu)))) cueHits++;
    if (cueHits) add(def.id, 0.35 * cueHits);
  }
  for (const [re, id, w] of RULES) if (has(t, re)) add(id, w);
  // Context-dependent disambiguation
  const sdLead = has(t, /(standard deviation|std\.? ?dev\w*|sigma) (of|in|for) (the )?(lead|delivery) time|lead time[^.]{0,50}standard deviation of \d|lead time (is|has|averages)[^.]{0,40}(with a |and a )?standard deviation/);
  const sdDemand = has(t, /(standard deviation|std\.? ?dev\w*) (of|in|for) (the )?(\w+ )?(demand|sales|usage)|(demand|sales|usage)[^.]{0,70}standard deviation/);
  const wantsSS = has(t, /safety stock|reorder point|service level|stock-?out/);
  if (wantsSS) { if (sdLead && sdDemand) add('safety-stock-combined', 9); else if (sdLead) add('safety-stock-lead-time', 9); else if (sdDemand) add('safety-stock-demand', 8); else if (has(t, /reorder point/)) add('reorder-point', 5); }
  if (has(t, /what (cycle )?service level|probability of (a )?stock-?out|chance of (a )?stock-?out/) && has(t, /reorder point (is|of|at)/)) add('cycle-service-level', 9);
  const arrivals = has(t, /arriv/), serves = has(t, /serv|handle|process/);
  if (arrivals && serves) { const m = t.match(/(\d+|two|three|four|five|six) (servers?|tellers?|cashiers?|mechanics?|agents?|clerks?|channels?|registers?|barbers?|doctors?|operators?)/); const k = m ? ({ two: 2, three: 3, four: 4, five: 5, six: 6 } as any)[m[1]] ?? Number(m[1]) : 1; add(k >= 2 ? 'mms' : 'mm1', 6); if (has(t, /probability|chance|likelihood/)) add('queue-probabilities', 4); }
  if (has(t, /break-?even/) && has(t, /(site|location|city|cities)/)) add('location-break-even', 6);
  if (has(t, /continuous review|order quantity and (the )?reorder point|\(q, ?r\)|\(s, ?q\)/)) add('continuous-review', 8);
  return Object.entries(score).map(([id, s]) => ({ id, score: s })).sort((a, b) => b.score - a.score);
}

interface Num { value: number; start: number; end: number; money: boolean; pct: boolean; used: boolean; inList: boolean }
function findNumbers(text: string): Num[] {
  const out: Num[] = []; const re = /(\$\s?)?(-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\d+(?:\.\d+)?|-?\.\d+)(\s?(?:%|percent\b))?/g; let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const before = text.slice(Math.max(0, m.index - 2), m.index); if (/[a-zA-Z/]$/.test(before) && !m[1]) continue; // part of a word like M/M/1 or SKU12
    let value = Number(m[2].replace(/,/g, '')); if (!Number.isFinite(value)) continue;
    const tail = text.slice(m.index + m[0].length, m.index + m[0].length + 10).toLowerCase(); if (/^\s?(million|mm)\b/.test(tail)) value *= 1e6; else if (/^\s?(thousand|k)\b/.test(tail)) value *= 1e3;
    out.push({ value, start: m.index, end: m.index + m[0].length, money: !!m[1], pct: !!m[3], used: false, inList: false });
  }
  return out;
}
function findLists(text: string, nums: Num[]): { values: number[]; start: number; end: number }[] {
  const lists: { values: number[]; start: number; end: number }[] = []; let cur: Num[] = [];
  const flush = () => { if (cur.length >= 3) { cur.forEach((n) => (n.inList = true)); lists.push({ values: cur.map((n) => n.value), start: cur[0].start, end: cur[cur.length - 1].end }); } cur = []; };
  for (let i = 0; i < nums.length; i++) { if (!cur.length) { cur = [nums[i]]; continue; } const gap = text.slice(cur[cur.length - 1].end, nums[i].start); if (/^\s*(,|;|and|,\s*and)?\s*$/.test(gap) && gap.length <= 6 && !nums[i].pct && !nums[i].money) cur.push(nums[i]); else { flush(); cur = [nums[i]]; } }
  flush(); return lists;
}
const UNIT_RE: [RegExp, TimeUnit][] = [[/\b(per|a|each|every|\/)\s?(day)\b|\bdaily\b|\bdays?\b/, 'day'], [/\b(per|a|each|every|\/)\s?(week|wk)\b|\bweekly\b|\bweeks?\b/, 'week'], [/\b(per|a|each|every|\/)\s?(month|mo)\b|\bmonthly\b|\bmonths?\b/, 'month'], [/\b(per|a|each|every|\/)\s?(year|yr)\b|\bannual(ly)?\b|\byearly\b|\byears?\b/, 'year']];
function unitNear(text: string, n: Num, cueText: string): TimeUnit | undefined {
  const after = text.slice(n.end, n.end + 28).toLowerCase(); let best: [number, TimeUnit] | undefined;
  for (const [re, u] of UNIT_RE) { const m = after.match(re); if (m && (best === undefined || m.index! < best[0])) best = [m.index!, u]; }
  if (best) return best[1];
  const c = cueText.toLowerCase(); if (/annual|yearly|per year/.test(c)) return 'year'; if (/daily|per day/.test(c)) return 'day'; if (/weekly|per week/.test(c)) return 'week'; if (/monthly|per month/.test(c)) return 'month';
  return undefined;
}

export function extractInputs(def: CalcDef, text: string): { values: Vals; extracted: Extracted[]; leftovers: number[]; notes: string[] } {
  const t = lc(text); const nums = findNumbers(t); const lists = findLists(t, nums); const values: Vals = defaults(def); const extracted: Extracted[] = []; const notes: string[] = [];
  // Mode selects that change which inputs apply
  if (def.inputs.some((i) => i.id === 'hMode')) { const m = t.match(/(\d+(?:\.\d+)?)\s?(?:%|percent) of (?:the |its )?(?:unit |item |purchase |product )?(?:cost|price|value)/); if (m) { values.hMode = 'percent'; values.I = Number(m[1]); const n = nums.find((x) => x.value === Number(m[1]) && x.pct); if (n) n.used = true; extracted.push({ inputId: 'I', label: 'Holding rate (% of unit cost)', value: Number(m[1]), unit: '%', snippet: m[0] }); } }
  if (def.id === 'newsvendor') values.costMode = /underage|overage|cost of (under|over)stock/.test(t) && !/sell(s|ing)? (for|price)/.test(t) ? 'direct' : 'price';
  if (def.id === 'mms' || def.id === 'queue-probabilities') { const m = t.match(/\b(two|three|four|five|six)\b (servers?|tellers?|cashiers?|mechanics?|agents?|clerks?|channels?)/); if (m) { values.s = ({ two: 2, three: 3, four: 4, five: 5, six: 6 } as any)[m[1]]; extracted.push({ inputId: 's', label: 'Number of servers', value: values.s, snippet: m[0] }); } }
  const visible = (i: InputDef) => !i.show || i.show(values);
  // Series inputs: take number lists in order, preferring the one that follows a cue
  const seriesInputs = def.inputs.filter((i) => i.kind === 'series' && visible(i)); const usedLists = new Set<number>();
  for (const i of seriesInputs) {
    let pickIdx = -1; let bestD = Infinity;
    for (const cu of i.cues ?? []) { let p = t.indexOf(lc(cu)); while (p >= 0) { lists.forEach((l, k) => { if (usedLists.has(k)) return; const d = l.start - p; if (d >= 0 && d < 120 && d < bestD) { bestD = d; pickIdx = k; } }); p = t.indexOf(lc(cu), p + 1); } }
    if (pickIdx < 0) pickIdx = lists.findIndex((_, k) => !usedLists.has(k));
    if (pickIdx >= 0) { usedLists.add(pickIdx); values[i.id] = lists[pickIdx].values; extracted.push({ inputId: i.id, label: i.label, value: lists[pickIdx].values, snippet: text.slice(lists[pickIdx].start, lists[pickIdx].end) }); }
  }
  lists.forEach((l, k) => { if (!usedLists.has(k)) nums.forEach((n) => { if (n.start >= l.start && n.end <= l.end) n.inList = false; }); });
  // Scalar inputs: score every (input, number) pair by cue proximity and type, then assign greedily
  const cands: { inp: InputDef; n: Num; score: number; cue: string }[] = [];
  for (const inp of def.inputs) {
    if (!visible(inp) || !['number', 'money', 'percent', 'int'].includes(inp.kind) || extracted.some((e) => e.inputId === inp.id)) continue;
    for (const cu of inp.cues ?? []) {
      const c = lc(cu); let p = t.indexOf(c);
      while (p >= 0) {
        const e = p + c.length;
        for (const n of nums) {
          if (n.used || n.inList) continue; let d: number; let after = false;
          if (n.start >= e && n.start - e <= 70) { d = n.start - e; after = true; if (/[.?!;]\s/.test(t.slice(e, n.start))) continue; } else if (n.end <= p && p - n.end <= 45) { d = (p - n.end) * 1.4 + 6; if (/[.?!;]\s/.test(t.slice(n.end, p))) continue; } else continue;
          let s = 2 + c.length / 12 - d / 28 + (after ? 0.2 : 0);
          if (inp.kind === 'percent') s += n.pct ? 1.2 : -1.2; else if (n.pct) s -= 1.5;
          if (inp.kind === 'money') s += n.money ? 0.8 : -0.3; else if (n.money) s -= 0.9;
          if (inp.kind === 'int' && !Number.isInteger(n.value)) s -= 1;
          if (inp.min !== undefined && n.value < inp.min) s -= 2; if (inp.max !== undefined && n.value > inp.max) s -= 2;
          cands.push({ inp, n, score: s, cue: cu });
        }
        p = t.indexOf(c, p + 1);
      }
    }
  }
  cands.sort((a, b) => b.score - a.score); const doneInputs = new Set<string>();
  for (const cd of cands) {
    if (cd.score < 0.6 || cd.n.used || doneInputs.has(cd.inp.id)) continue;
    cd.n.used = true; doneInputs.add(cd.inp.id); values[cd.inp.id] = cd.n.value; let unit: string | undefined = cd.inp.unit;
    if (cd.inp.time) { const u = unitNear(t, cd.n, cd.cue); if (u) { values[cd.inp.id + '_u'] = u; unit = cd.inp.time.role === 'dur' ? u + 's' : 'per ' + u; } else unit = cd.inp.time.role === 'dur' ? cd.inp.time.unit + 's' : 'per ' + cd.inp.time.unit; }
    extracted.push({ inputId: cd.inp.id, label: cd.inp.label, value: cd.n.value, unit, snippet: text.slice(Math.max(0, Math.min(cd.n.start, t.indexOf(lc(cd.cue))) - 4), Math.min(text.length, cd.n.end + 14)).trim() });
  }
  if (def.inputs.some((i) => (i.kind === 'table' || i.kind === 'tree') && visible(i))) notes.push('This calculator uses a table. Tables are not read automatically yet, so enter the rows below.');
  const missing = def.inputs.filter((i) => visible(i) && !i.adv && ['number', 'money', 'percent', 'int', 'series'].includes(i.kind) && !extracted.some((e) => e.inputId === i.id));
  if (missing.length) notes.push(`Not found in the text (defaults shown, please check): ${missing.map((i) => i.label).join('; ')}.`);
  return { values, extracted, leftovers: nums.filter((n) => !n.used && !n.inList).map((n) => n.value), notes };
}

export function parseProblem(text: string, forceCalc?: string): ParseResult {
  const ranked = detectCalculator(text); const top = forceCalc ? { id: forceCalc, score: 99 } : ranked[0];
  if (!top || !byId[top.id] || top.score < 1.5) return { calcId: null, confidence: 0, alternatives: ranked.slice(0, 5), values: {}, extracted: [], leftovers: [], notes: ['Could not tell which calculator fits. Pick one below or add more of the problem text.'], source: 'rules' };
  const second = ranked.find((r) => r.id !== top.id)?.score ?? 0; const ex = extractInputs(byId[top.id], text);
  const confidence = forceCalc ? 1 : Math.max(0.2, Math.min(0.97, 0.45 + 0.07 * (top.score - second) + 0.04 * ex.extracted.length));
  return { calcId: top.id, confidence, alternatives: ranked.filter((r) => r.id !== top.id).slice(0, 4), ...ex, source: 'rules' };
}

/** Compact catalog for the AI parser prompt. */
export function aiCatalog(): string {
  return CALCS.map((d) => `${d.id} | ${d.name} | inputs: ${d.inputs.filter((i) => i.kind !== 'tree').map((i) => `${i.id}${i.kind === 'select' ? '{' + i.options!.map((o) => o.value).join(',') + '}' : i.kind === 'series' ? '[]' : i.kind === 'table' ? '[{' + i.columns!.map((c) => c.id).join(',') + '}]' : ''}${i.time ? '(+' + i.id + '_u: day|week|month|year)' : ''}=${i.label}`).join('; ')}`).join('\n');
}
/** Validate and coerce an AI response into a ParseResult. Unknown ids and malformed values are dropped. */
export function coerceAi(json: any, text: string): ParseResult | null {
  if (!json || typeof json.calcId !== 'string' || !byId[json.calcId]) return null;
  const def = byId[json.calcId]; const values: Vals = defaults(def); const extracted: Extracted[] = [];
  for (const [k, raw] of Object.entries(json.values ?? {})) {
    const unitKey = k.endsWith('_u'); const inp = def.inputs.find((i) => i.id === (unitKey ? k.slice(0, -2) : k)); if (!inp) continue;
    if (unitKey) { if (inp.time && ['day', 'week', 'month', 'year'].includes(String(raw))) values[k] = raw; continue; }
    let val: any = raw;
    if (['number', 'money', 'percent', 'int'].includes(inp.kind)) { val = Number(raw); if (!Number.isFinite(val)) continue; }
    else if (inp.kind === 'series') { if (!Array.isArray(raw)) continue; val = raw.map(Number).filter((x) => Number.isFinite(x)); }
    else if (inp.kind === 'select') { if (!inp.options!.some((o) => o.value === raw)) continue; }
    else if (inp.kind === 'table') { if (!Array.isArray(raw)) continue; val = raw.map((r: any) => Object.fromEntries(inp.columns!.map((c) => [c.id, c.kind === 'number' ? Number(r?.[c.id]) || 0 : String(r?.[c.id] ?? '')]))); }
    else continue;
    values[k] = val; extracted.push({ inputId: inp.id, label: inp.label, value: val, unit: inp.unit, snippet: typeof json.evidence?.[k] === 'string' ? json.evidence[k].slice(0, 120) : '' });
  }
  return { calcId: def.id, confidence: Math.max(0, Math.min(1, Number(json.confidence) || 0.8)), alternatives: detectCalculator(text).filter((r) => r.id !== def.id).slice(0, 4), values, extracted, leftovers: [], notes: typeof json.note === 'string' && json.note ? [json.note.slice(0, 300)] : [], source: 'ai' };
}
