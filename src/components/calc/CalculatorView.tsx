'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { byId, catById, defaults, run, symbols, NOTATIONS, type Mode, type NotationId, type Vals } from '@lotwise/engine';
import { useStore } from '@/lib/store';
import { decodeValues } from '@/lib/share';
import { track } from '@/lib/analytics';
import { calcHref, modeBase } from '@/lib/routes';
import { Link, useQuery } from '@/platform/nav';
import { Tex, texToPlain } from '../Tex';
import { Icon } from '../icons';
import { Disclosure } from '../ui';
import { Viz } from '../viz/Viz';
import { InputPanel } from './Inputs';
import { BusinessResult, LearnerResult, MathView } from './Results';
import { adjLabel, applyAdj, Related, Scenarios, Sensitivity, ShareBar, VerifiedBadge, WorkedExamples } from './Extras';
import { usePro } from './Pro';

export function CalculatorView({ calcId, mode, initial, embed }: { calcId: string; mode: Mode; initial?: Vals | null; embed?: boolean }) {
  const def = byId[calcId]; const storeNota = useStore((s) => s.notation); const setNotation = useStore((s) => s.setNotation); const eli = useStore((s) => s.eli); const setEli = useStore((s) => s.setEli); const visit = useStore((s) => s.visit);
  const nota: NotationId = mode === 'learner' ? storeNota : 'heizer'; const pro = usePro(mode);
  const [values, setValues] = useState<Vals>(() => initial ?? defaults(def)); const [adj, setAdj] = useState<Record<string, number>>({});
  const q = useQuery();
  useEffect(() => { const v = decodeValues(def.id, q?.get('v')); if (v) setValues(v); }, [q, def.id]);
  useEffect(() => { if (!embed) { visit(def.id); track('calc_view', { calc: def.id, mode }); } }, [def.id, mode, embed, visit]);
  const patch = useCallback((p: Vals) => setValues((v) => ({ ...v, ...p })), []);
  const r = useMemo(() => run(def, values, { nota }), [def, values, nota]);
  const active = mode === 'business' && Object.values(adj).some(Boolean);
  const w = useMemo(() => (active ? run(def, applyAdj(def, values, adj), { nota }) : null), [active, def, values, adj, nota]);
  const shown = w?.ok ? w : r; const cat = catById[def.cat];
  const onMapMove = useCallback((tableId: string, index: number, x: number, y: number) => setValues((v) => ({ ...v, [tableId]: (v[tableId] as any[]).map((row, i) => (i === index ? { ...row, x, y } : row)) })), []);

  const errors = !r.ok && (
    <div role="alert" className="card border-bad/40 p-5">
      <p className="flex items-center gap-2 font-semibold"><Icon name="alert" size={18} className="text-bad" />Check your inputs</p>
      <ul className="mt-2 space-y-1.5 text-sm text-muted">{r.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
    </div>);
  const viz = shown.ok && shown.viz && (
    <section aria-label="Live visual" className="card p-4 sm:p-5">
      <div className="mb-2 flex items-center justify-between gap-3"><h3 className="text-lg font-semibold">{mode === 'business' ? 'See it' : 'Visualize it'}</h3>{active && <span className="badge">What-if view</span>}</div>
      <Viz spec={shown.viz} onMapMove={onMapMove} />
    </section>);

  if (embed) return (
    <div className="space-y-4">
      <div className="card p-4"><InputPanel def={def} values={values} onChange={patch} mode={mode} nota={nota} /></div>
      {errors}
      {r.ok && (mode === 'business' ? <BusinessResult def={def} r={r} /> : <LearnerResult def={def} r={r} nota={nota} pro={false} eli={false} setEli={() => {}} />)}
      {viz}
    </div>);

  return (
    <article className="wrap pb-20 pt-6 sm:pt-10">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm text-faint">
        <Link href={modeBase(mode)} className="hover:text-fg">{mode === 'business' ? 'Business' : 'Learn'}</Link><Icon name="chevronRight" size={13} />
        <Link href={`${modeBase(mode)}#${def.cat}`} className="hover:text-fg">{mode === 'business' ? cat.bname : `Chapter ${cat.chapter}: ${cat.name}`}</Link>
      </nav>
      <header className="mt-3 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="max-w-3xl">
          {mode === 'business' ? (<><p className="eyebrow">{def.name}</p><h1 className="mt-2 text-3xl font-semibold sm:text-[2.6rem]">{def.bq}</h1></>) : (<><p className="eyebrow">Chapter {cat.chapter} · {cat.name}</p><h1 className="mt-2 text-3xl font-semibold sm:text-[2.6rem]">{def.name}</h1></>)}
          <p className="mt-3 text-base text-muted sm:text-lg">{def.blurb}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2"><VerifiedBadge id={def.id} /><ShareBar def={def} values={values} r={r} mode={mode} /></div>
      </header>

      {mode === 'learner' && (
        <div className="card mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 p-4">
          <div className="scroll-x min-w-0"><span className="mr-3 text-xs uppercase tracking-wider text-faint">Formula</span><Tex>{def.formula(symbols(nota))}</Tex></div>
          <label className="flex items-center gap-2 text-sm text-muted">Notation
            <select className="input h-9 w-auto text-sm" value={nota} onChange={(e) => setNotation(e.target.value as NotationId)} aria-label="Textbook notation">{NOTATIONS.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}</select>
          </label>
        </div>)}

      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <div className="card p-4 sm:p-5 lg:sticky lg:top-20">
            <h2 className="mb-4 text-lg font-semibold">{mode === 'business' ? 'Your numbers' : 'Given'}</h2>
            <InputPanel def={def} values={values} onChange={patch} mode={mode} nota={nota} />
            <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-sm">
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => { setValues(defaults(def)); setAdj({}); }}><Icon name="refresh" size={13} />Reset</button>
              {mode === 'learner' ? <Link href={`/learn/practice/${def.id}`} className="btn btn-sm"><Icon name="target" size={14} />Practice this</Link> : <Link href={calcHref('learner', def.id)} className="text-faint hover:text-fg">See the full method</Link>}
            </div>
          </div>
        </div>
        <div className="space-y-5 lg:col-span-7" aria-live="polite">
          {errors}
          {r.ok && mode === 'business' && (<>
            <BusinessResult def={def} r={r} whatIf={w?.ok ? { r: w, label: adjLabel(def, adj) } : null} />
            {viz}
            <Sensitivity def={def} values={values} adj={adj} setAdj={setAdj} />
            <Disclosure title="Show the math" badge={<span className="badge badge-neutral hidden max-w-[16rem] truncate sm:inline-block sm:leading-[20px]">{texToPlain(def.formula(symbols('heizer'))).slice(0, 34)}</span>}><MathView def={def} r={r} s={symbols('heizer')} /><p className="mt-4 text-sm text-muted">Want every step explained? <Link href={calcHref('learner', def.id)} className="link">Open this in Learner mode</Link>.</p></Disclosure>
            <Scenarios def={def} values={values} r={r} onLoad={setValues} />
          </>)}
          {r.ok && mode === 'learner' && (<>
            <LearnerResult def={def} r={r} nota={nota} pro={pro} eli={eli} setEli={setEli} />
            {viz}
          </>)}
        </div>
      </div>

      <div className="cv-auto mt-14 space-y-14" style={{ containIntrinsicSize: 'auto 1800px' }}>
        <WorkedExamples def={def} onLoad={(v) => { setValues(v); setAdj({}); }} mode={mode} />
        <section aria-label="About this calculator" className="grid gap-8 lg:grid-cols-2">
          <div>
            <h2 className="text-xl font-semibold">{mode === 'business' ? 'How this works' : 'When to use this model'}</h2>
            <p className="mt-3 text-muted">{def.blurb} {mode === 'business' ? `In textbooks this is called ${def.name}.` : `In practice it answers the question: ${def.bq.charAt(0).toLowerCase() + def.bq.slice(1)}`}</p>
            <p className="mt-3 rounded-xl border border-line bg-raised px-4 py-3 text-sm"><b>An everyday way to think about it.</b> {def.analogy}</p>
            {mode === 'business' && <><h3 className="mt-6 font-sans text-base font-semibold tracking-normal">Common mistakes</h3><ul className="mt-2 space-y-1.5 text-sm text-muted">{def.traps.slice(0, 3).map((t, i) => <li key={i} className="flex gap-2.5"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-warn" />{t}</li>)}</ul></>}
          </div>
          <div>
            <h2 className="text-xl font-semibold">Questions people ask</h2>
            <dl className="mt-3 divide-y divide-line">
              {[...(def.faq ?? []), { q: `How do I know the ${def.short} result is right?`, a: 'Every Lotwise calculator must pass three checks before it ships: textbook-style worked examples, thousands of randomized comparisons against a separately written Python implementation, and (where the formula makes a real-world claim) a simulation. The Verified page lists the results.' }, { q: 'Is this free?', a: 'Yes. Every calculator, answer, chart, and share link is free. Pro adds step-by-step solutions and practice for learners, and what-if analysis, exports, and the Plan Builder for businesses.' }].map((f, i) => (<div key={i} className="py-3"><dt className="font-medium">{f.q}</dt><dd className="mt-1 text-sm leading-relaxed text-muted">{f.a}</dd></div>))}
            </dl>
          </div>
        </section>
        <Related id={def.id} mode={mode} />
        <p className="text-xs text-faint">Lotwise results are decision support for education and planning. They are not professional advice. <Link href="/disclaimer" className="link">Read the disclaimer</Link>.</p>
      </div>
    </article>
  );
}
