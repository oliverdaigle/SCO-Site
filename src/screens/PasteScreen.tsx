'use client';
import { useEffect, useMemo, useState } from 'react';
import { byId, coerceAi, parseProblem, run, catById, type ParseResult, type Vals, type NotationId } from '@lotwise/engine';
import { useStore } from '@/lib/store';
import { calcHref } from '@/lib/routes';
import { encodeValues } from '@/lib/share';
import { track } from '@/lib/analytics';
import { IS_ARTIFACT } from '@/platform/env';
import { Link } from '@/platform/nav';
import { Icon } from '@/components/icons';
import { cx } from '@/components/ui';
import { InputPanel } from '@/components/calc/Inputs';
import { LearnerResult } from '@/components/calc/Results';
import { Viz } from '@/components/viz/Viz';
import { usePro, UpgradeCard } from '@/components/calc/Pro';

const EXAMPLES = [
  'Daily demand for a product averages 150 units with a standard deviation of demand of 16 units. Lead time averages 5 days with a standard deviation of lead time of 1 day. The company wants a 95% service level. What safety stock and reorder point should it use?',
  'A hospital uses 1,000 boxes of gloves per year. The ordering cost is $10 per order and the holding cost is $0.50 per box per year. What is the economic order quantity, and how many orders are placed per year?',
  'Customers arrive at a rate of 40 per hour. There are three tellers and each can serve 15 customers per hour. Find the average number waiting in line and the average wait.',
  'A newspaper sells for $1.25 and costs $0.70. Unsold copies have a salvage value of $0.30. Mean demand is 120 with a standard deviation of 15. How many papers should be stocked?',
  'Actual demand was 90, 95, 115, 100, 125, 140 and forecast demand was 100, 100, 100, 110, 110, 110. Compute the MAD and the tracking signal.',
];

export function PasteScreen() {
  const pro = usePro('learner'); const nota = useStore((s) => s.notation) as NotationId; const eli = useStore((s) => s.eli); const setEli = useStore((s) => s.setEli);
  const [text, setText] = useState(''); const [res, setRes] = useState<ParseResult | null>(null); const [values, setValues] = useState<Vals>({}); const [busy, setBusy] = useState(false); const [ai, setAi] = useState(false); const [solved, setSolved] = useState(false);
  useEffect(() => { if (IS_ARTIFACT) return; fetch('/api/parse-problem').then((r) => r.json()).then((j) => setAi(!!j.ai)).catch(() => {}); }, []);
  const read = async (t = text, force?: string) => {
    if (!t.trim()) return; setBusy(true); setSolved(false); let out: ParseResult | null = null;
    if (ai && !force) { try { const r = await fetch('/api/parse-problem', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: t.slice(0, 4000) }) }); if (r.ok) out = coerceAi(await r.json(), t); } catch { /* fall back to the built-in reader */ } }
    if (!out) out = parseProblem(t, force);
    setRes(out); setValues(out.values); setBusy(false); track('paste_parse', { calc: out.calcId ?? 'none', source: out.source });
  };
  const def = res?.calcId ? byId[res.calcId] : null; const r = useMemo(() => (def ? run(def, values, { nota }) : null), [def, values, nota]);
  const showVal = (v: any) => (Array.isArray(v) ? (typeof v[0] === 'object' ? `${v.length} rows` : v.join(', ')) : String(v));
  return (
    <div className="wrap max-w-5xl pb-20 pt-8 sm:pt-12">
      <header className="max-w-3xl"><p className="eyebrow">Learner Pro</p><h1 className="mt-2 text-4xl font-semibold sm:text-5xl">Paste your problem</h1><p className="mt-3 text-lg text-muted">Paste a homework or textbook problem. Lotwise finds the right model, pulls out the numbers and units, shows you what it found so you can fix anything, then walks through the solution.</p></header>
      <div className="card mt-7 p-4 sm:p-5">
        <label htmlFor="problem" className="label">Your problem</label>
        <textarea id="problem" className="input mt-1.5 min-h-[150px] resize-y text-[0.95rem] leading-relaxed" placeholder="Paste the full problem text here, including the numbers…" value={text} onChange={(e) => setText(e.target.value)} maxLength={4000} />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <button type="button" className="btn btn-primary btn-lg" disabled={busy || !text.trim()} onClick={() => read()}><Icon name="wand" />{busy ? 'Reading…' : 'Read my problem'}</button>
          <span className="text-xs text-faint">{ai ? 'Read by Claude, with a built-in reader as backup.' : 'Using the built-in reader (keywords, numbers, and units).'} Nothing is stored.</span>
        </div>
        <div className="mt-4 border-t border-line pt-3"><p className="text-xs uppercase tracking-wider text-faint">Or try one</p><ul className="mt-2 flex flex-wrap gap-2">{EXAMPLES.map((e, i) => <li key={i}><button type="button" className="btn btn-sm" onClick={() => { setText(e); read(e); }}>{['Safety stock', 'EOQ', 'Bank tellers', 'Newsvendor', 'Tracking signal'][i]}</button></li>)}</ul></div>
      </div>

      {res && !def && (<div className="card mt-6 p-5" role="status"><p className="flex items-center gap-2 font-semibold"><Icon name="info" className="text-warn" />We could not tell which model this is</p><p className="mt-2 text-sm text-muted">{res.notes[0]}</p>{res.alternatives.length > 0 && <ul className="mt-3 flex flex-wrap gap-2">{res.alternatives.filter((a) => byId[a.id]).map((a) => <li key={a.id}><button type="button" className="btn btn-sm" onClick={() => read(text, a.id)}>{byId[a.id].short}</button></li>)}</ul>}<p className="mt-3 text-sm text-muted">Or use the <Link href="/learn/wizard" className="link">diagnostic wizard</Link>.</p></div>)}

      {res && def && (
        <div className="mt-6 space-y-5">
          <section className="card glow p-5" aria-label="What we found">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="eyebrow">This looks like</p><h2 className="mt-1 text-2xl font-semibold">{def.name}</h2><p className="mt-1 text-sm text-muted">{catById[def.cat].name}. {def.blurb}</p></div>
              <span className={cx('badge', res.confidence < 0.6 && 'badge-neutral')}>{res.source === 'ai' ? 'Read by Claude' : 'Built-in reader'} · {Math.round(res.confidence * 100)}% sure</span>
            </div>
            {res.alternatives.length > 0 && (<p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">Not right? Try:{res.alternatives.filter((a) => byId[a.id]).slice(0, 4).map((a) => <button key={a.id} type="button" className="btn btn-sm" onClick={() => read(text, a.id)}>{byId[a.id].short}</button>)}</p>)}
            <h3 className="mt-5 font-sans text-sm font-semibold uppercase tracking-wider text-faint">What we pulled from the text</h3>
            {res.extracted.length ? (<ul className="mt-2 divide-y divide-line">{res.extracted.map((e) => (<li key={e.inputId} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2 text-sm"><span className="text-muted">{e.label}</span><span className="flex items-baseline gap-3"><span className="num font-semibold text-accent">{showVal(e.value)}{e.unit && !Array.isArray(e.value) ? ` ${e.unit === '$' ? '' : e.unit}` : ''}</span>{e.snippet && <span className="hidden max-w-[20rem] truncate text-xs italic text-faint sm:inline">“{e.snippet}”</span>}</span></li>))}</ul>) : <p className="mt-2 text-sm text-muted">No numbers were matched automatically. Enter them below.</p>}
            {res.notes.map((n, i) => <p key={i} className="mt-3 flex gap-2 text-sm text-muted"><Icon name="info" size={15} className="mt-0.5 shrink-0 text-warn" />{n}</p>)}
          </section>
          <section className="card p-5" aria-label="Check the inputs"><h3 className="text-lg font-semibold">Check and correct</h3><p className="mb-4 mt-1 text-sm text-muted">Fix anything we got wrong before solving. The answer updates as you type.</p><InputPanel def={def} values={values} onChange={(p) => setValues((v) => ({ ...v, ...p }))} mode="learner" nota={nota} />
            <div className="mt-5 flex flex-wrap gap-3 border-t border-line pt-4">{pro ? <button type="button" className="btn btn-primary btn-lg" onClick={() => setSolved(true)}><Icon name="play" />Solve it step by step</button> : null}<Link href={`${calcHref('learner', def.id)}?v=${encodeValues(def, values)}`} className="btn btn-lg">Open in the full calculator<Icon name="arrowRight" /></Link></div>
            {!pro && <div className="mt-4"><UpgradeCard mode="learner" feature="paste">Solve pasted problems right here with every step shown. You can still open the calculator with these numbers for free.</UpgradeCard></div>}
          </section>
          {solved && pro && r && (r.ok ? (<><LearnerResult def={def} r={r} nota={nota} pro={pro} eli={eli} setEli={setEli} />{r.viz && <section className="card p-4 sm:p-5" aria-label="Visual"><h3 className="mb-2 text-lg font-semibold">Visualize it</h3><Viz spec={r.viz} /></section>}</>) : (<div role="alert" className="card border-bad/40 p-5"><p className="flex items-center gap-2 font-semibold"><Icon name="alert" className="text-bad" />Check your inputs</p><ul className="mt-2 space-y-1 text-sm text-muted">{r.errors.map((e, i) => <li key={i}>{e}</li>)}</ul></div>))}
        </div>)}
    </div>
  );
}
