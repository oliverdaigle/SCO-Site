'use client';
import { useState } from 'react';
import { BUSINESS_WIZARD, LEARNER_WIZARD, byId, catById, wizardNode, type Mode, type WizOption } from '@lotwise/engine';
import { calcHref, modeBase } from '@/lib/routes';
import { track } from '@/lib/analytics';
import { Link } from '@/platform/nav';
import { Icon } from '@/components/icons';
import { Tex } from '@/components/Tex';
import { symbols } from '@lotwise/engine';
import { VerifiedBadge } from '@/components/calc/Extras';

export function WizardScreen({ mode }: { mode: Mode }) {
  const tree = mode === 'business' ? BUSINESS_WIZARD : LEARNER_WIZARD;
  const [trail, setTrail] = useState<{ node: string; label: string; next: string }[]>([]); const [leaf, setLeaf] = useState<WizOption | null>(null);
  const current = wizardNode(tree, trail.length ? trail[trail.length - 1].next : 'root')!;
  const pick = (o: WizOption) => { if (o.calc) { setLeaf(o); track('wizard_done', { calc: o.calc, mode, steps: trail.length + 1 }); } else if (o.next) setTrail([...trail, { node: current.id, label: o.label, next: o.next }]); };
  const back = () => { if (leaf) setLeaf(null); else setTrail(trail.slice(0, -1)); };
  const restart = () => { setTrail([]); setLeaf(null); };
  const def = leaf?.calc ? byId[leaf.calc] : null; const stepNo = trail.length + 1;
  return (
    <div className="relative min-h-[80dvh] overflow-hidden">
      <div className="aurora" aria-hidden />
      <div className="wrap relative max-w-3xl py-10 sm:py-16">
        <div className="flex items-center justify-between gap-3">
          <p className="eyebrow">{mode === 'business' ? 'Problem finder' : 'Model diagnostic'}</p>
          {(trail.length > 0 || leaf) && <div className="flex gap-2"><button type="button" className="btn btn-sm btn-ghost" onClick={back}><Icon name="arrowLeft" size={14} />Back</button><button type="button" className="btn btn-sm btn-ghost" onClick={restart}><Icon name="refresh" size={13} />Start over</button></div>}
        </div>
        {trail.length > 0 && (<ol className="mt-4 flex flex-wrap items-center gap-1.5 text-sm text-muted" aria-label="Your answers">{trail.map((t, i) => (<li key={i} className="flex items-center gap-1.5"><span className="rounded-full border border-line bg-raised px-2.5 py-0.5">{t.label}</span>{(i < trail.length - 1 || leaf) && <Icon name="chevronRight" size={13} className="text-faint" />}</li>))}{leaf && <li className="rounded-full border border-accent-line bg-accent-soft px-2.5 py-0.5 text-accent">{leaf.label}</li>}</ol>)}
        {!def ? (
          <div className="animate-rise mt-6" key={current.id}>
            <h1 className="text-3xl font-semibold sm:text-5xl">{current.q}</h1>
            {current.help && <p className="mt-3 text-muted">{current.help}</p>}
            <ul className={`mt-8 grid gap-3 ${current.options.length > 6 ? 'sm:grid-cols-2' : ''}`} aria-label={`Step ${stepNo} options`}>
              {current.options.map((o, i) => (<li key={i}><button type="button" onClick={() => pick(o)} className="card group flex h-full w-full items-center gap-4 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-accent-line sm:p-5"><span className="num flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-sunken text-sm text-muted group-hover:border-accent-line group-hover:text-accent">{i + 1}</span><span className="min-w-0 flex-1"><span className="block text-[1.05rem] font-medium">{o.label}</span>{o.hint && <span className="block text-sm text-muted">{o.hint}</span>}</span><Icon name={o.calc ? 'check' : 'arrowRight'} size={17} className="shrink-0 text-faint group-hover:text-accent" /></button></li>))}
            </ul>
          </div>
        ) : (
          <div className="animate-pop mt-6">
            <p className="text-muted">{mode === 'business' ? 'This is the tool for that.' : 'Use this model.'}</p>
            <div className="card glow mt-3 p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-2"><span className="badge badge-neutral">{catById[def.cat].name}</span><VerifiedBadge id={def.id} compact /></div>
              <h1 className="mt-4 text-3xl font-semibold sm:text-4xl">{mode === 'business' ? def.bq : def.name}</h1>
              <p className="mt-3 text-lg text-muted">{def.blurb}</p>
              {mode === 'learner' && leaf?.why && (<div className="mt-5 rounded-xl border border-accent-line bg-accent-soft p-4"><p className="flex items-center gap-2 font-semibold"><Icon name="bulb" size={16} className="text-accent" />Why this model</p><p className="mt-1.5 text-[0.95rem] leading-relaxed">{leaf.why}</p></div>)}
              {mode === 'learner' && <div className="scroll-x mt-5 rounded-lg bg-sunken px-4 py-3 ring-1 ring-line"><Tex>{def.formula(symbols('heizer'))}</Tex></div>}
              <div className="mt-6 flex flex-wrap gap-3"><Link href={calcHref(mode, def.id)} className="btn btn-primary btn-lg">Open the calculator<Icon name="arrowRight" /></Link>{mode === 'learner' && <Link href={`/learn/practice/${def.id}`} className="btn btn-lg"><Icon name="target" />Practice it</Link>}</div>
            </div>
            <p className="mt-5 text-sm text-muted">Not quite right? <button type="button" className="link" onClick={back}>Go back one step</button> or <Link className="link" href={modeBase(mode)}>browse everything</Link>.</p>
          </div>
        )}
      </div>
    </div>
  );
}
