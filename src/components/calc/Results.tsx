'use client';
import { useState } from 'react';
import { F, sym as resolveSym, type CalcDef, type Mode, type NotationId, type OutputDef, type RunResult, type Step, type TableSpec } from '@lotwise/engine';
import { Tex } from '../Tex';
import { Icon } from '../icons';
import { cx, Switch } from '../ui';
import { UpgradeCard } from './Pro';

export function fmtOut(o: OutputDef, x: any): string {
  if (typeof x !== 'number') return String(x ?? ''); if (o.fmt === 'money') return F.money(x, o.dp); if (o.fmt === 'pct') return F.pct(x, o.dp); if (o.fmt === 'int') return F.int(x);
  return F.num(x, o.dp) + (o.unit && o.unit !== '$' && o.unit !== '%' ? ' ' + o.unit : '');
}
export const visibleOutputs = (def: CalcDef, r: RunResult) => def.outputs.filter((o) => (!o.show || o.show(r.v, r.o)) && typeof r.o[o.id] === 'number');

export function StepTable({ t }: { t: TableSpec }) {
  return (
    <div className="scroll-x mt-3 rounded-lg border border-line">
      <table className="tbl"><thead><tr>{t.columns.map((c, i) => <th key={i} scope="col">{c}</th>)}</tr></thead>
        <tbody>{t.rows.map((r, i) => <tr key={i} className={t.highlight?.includes(i) ? 'hl' : ''}>{r.map((c, j) => <td key={j} className={typeof c === 'number' || /^[-$\d.,%]+$/.test(String(c)) ? 'num' : ''}>{c}</td>)}</tr>)}</tbody></table>
    </div>
  );
}

function StepCard({ s, i, eli }: { s: Step; i: number; eli: boolean }) {
  // Later steps skip layout until they scroll near; long solutions stay quick on phones.
  return (
    <li className={cx('relative pl-11', i >= 2 && 'cv-auto')} style={i >= 2 ? { containIntrinsicSize: 'auto 220px' } : undefined}>
      <span className="num absolute left-0 top-0 flex h-7 w-7 items-center justify-center rounded-full border border-accent-line bg-accent-soft text-xs font-semibold text-accent">{i + 1}</span>
      <h4 className="font-sans text-[0.95rem] font-semibold leading-7 tracking-normal">{s.title}</h4>
      {s.tex && <div className="scroll-x mt-1.5 rounded-lg bg-sunken px-3 py-2.5 ring-1 ring-line"><Tex>{s.tex}</Tex></div>}
      {(eli && s.eli ? s.eli : s.why) && <p className={cx('mt-2 text-sm leading-relaxed text-muted', eli && s.eli && 'rounded-lg border border-accent-line bg-accent-soft px-3 py-2 text-fg')}>{eli && s.eli && <Icon name="bulb" size={14} className="mr-1.5 inline -translate-y-px text-accent" />}{eli && s.eli ? s.eli : s.why}</p>}
      {s.lookup && <p className="mt-2 flex gap-2 rounded-lg border border-dashed border-line-strong px-3 py-2 text-xs leading-relaxed text-muted"><Icon name="grid" size={14} className="mt-0.5 shrink-0 text-faint" /><span><b className="text-fg">Table lookup.</b> {s.lookup}</span></p>}
      {s.table && <StepTable t={s.table} />}
    </li>
  );
}

/** Learner view: answer, then every step with substitutions, lookups, and reasoning. */
export function LearnerResult({ def, r, nota, pro, eli, setEli }: { def: CalcDef; r: RunResult; nota: NotationId; pro: boolean; eli: boolean; setEli: (b: boolean) => void }) {
  const outs = visibleOutputs(def, r); const primary = outs.filter((o) => o.primary); const rest = outs.filter((o) => !o.primary);
  const steps = pro ? r.steps : r.steps.slice(0, 1);
  return (
    <div className="space-y-5">
      <section aria-label="Answer" className="card glow p-4 sm:p-5">
        <p className="eyebrow">Answer</p>
        <div className="mt-2 flex flex-wrap gap-x-8 gap-y-3">
          {primary.map((o) => (<div key={o.id}><div className="flex items-center gap-2 text-sm text-muted">{o.sym && <Tex>{resolveSym(o.sym, nota)}</Tex>}<span>{o.label}</span></div><div className="num animate-pop text-3xl font-semibold tracking-tight text-accent sm:text-4xl" key={String(r.o[o.id])}>{fmtOut(o, r.o[o.id])}</div></div>))}
        </div>
        {rest.length > 0 && (<dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 border-t border-line pt-4 text-sm sm:grid-cols-3">{rest.map((o) => (<div key={o.id} className="min-w-0"><dt className="truncate text-xs text-faint" title={o.label}>{o.sym && <span className="mr-1 text-muted"><Tex>{resolveSym(o.sym, nota)}</Tex></span>}{o.label}</dt><dd className="num font-medium">{fmtOut(o, r.o[o.id])}</dd></div>))}</dl>)}
      </section>
      {r.warnings.map((w, i) => /^Unit mismatch/.test(w)
        ? (<div key={i} role="status" className="flex gap-2.5 rounded-xl border border-warn/50 bg-[color-mix(in_oklab,var(--warn)_10%,transparent)] px-4 py-3 text-sm"><Icon name="alert" size={17} className="mt-0.5 shrink-0 text-warn" /><span>{w}</span></div>)
        : (<p key={i} role="note" className="flex gap-2.5 rounded-xl border border-line bg-raised px-4 py-3 text-sm text-muted"><Icon name="info" size={17} className="mt-0.5 shrink-0 text-faint" /><span>{w}</span></p>))}
      <section aria-label="Step-by-step solution" className="card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">Step-by-step solution</h3>
          <label className="flex items-center gap-2 text-sm text-muted"><Switch checked={eli} onChange={setEli} label="Explain like I'm new" />Explain like I’m new</label>
        </div>
        {eli && <p className="mt-3 rounded-lg bg-raised px-3 py-2.5 text-sm"><b>Think of it this way.</b> {def.analogy}</p>}
        <ol className="mt-4 space-y-5">{steps.map((s, i) => <StepCard key={i} s={s} i={i} eli={eli} />)}</ol>
        {!pro && r.steps.length > 1 && (<div className="mt-5"><UpgradeCard mode="learner" feature="steps">See the remaining {r.steps.length - 1} step{r.steps.length > 2 ? 's' : ''} with every substitution and table lookup.</UpgradeCard></div>)}
      </section>
      <section aria-label="Common exam traps" className="card p-4 sm:p-5">
        <h3 className="flex items-center gap-2 text-lg font-semibold"><Icon name="alert" size={18} className="text-warn" />Common exam traps</h3>
        <ul className="mt-3 space-y-2 text-sm text-muted">{def.traps.map((t, i) => <li key={i} className="flex gap-2.5"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-warn" />{t}</li>)}</ul>
        {def.convention && <p className="mt-4 border-t border-line pt-3 text-sm text-muted"><b className="text-fg">Convention used.</b> {def.convention}</p>}
      </section>
    </div>
  );
}

/** Business view: one bold sentence, what it means, what to do, then the math on request. */
export function BusinessResult({ def, r, whatIf }: { def: CalcDef; r: RunResult; whatIf?: { r: RunResult; label: string } | null }) {
  const b = r.biz!; const [done, setDone] = useState<Record<number, boolean>>({}); const outs = visibleOutputs(def, r).filter((o) => o.primary);
  return (
    <section aria-label="Answer" className="card glow overflow-hidden">
      <div className="p-5 sm:p-6">
        <p className="eyebrow">Your answer</p>
        <p className="display animate-rise mt-2 text-2xl font-semibold leading-tight sm:text-[1.9rem]" key={b.headline}>{b.headline}</p>
        {whatIf && (<div className="mt-4 rounded-xl border border-accent-line bg-accent-soft p-3 text-sm"><p className="mb-1.5 font-medium text-accent">What if: {whatIf.label}</p><p className="font-medium">{whatIf.r.biz?.headline}</p>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1">{outs.map((o) => { const a = r.o[o.id], c = whatIf.r.o[o.id]; const d = a ? ((c - a) / Math.abs(a)) * 100 : 0; return (<span key={o.id} className="text-muted">{o.blabel ?? o.label}: <span className="num text-fg">{fmtOut(o, a)}</span> → <span className="num font-semibold text-fg">{fmtOut(o, c)}</span> <span className={cx('num', Math.abs(d) < 0.05 ? 'text-faint' : 'text-accent')}>({d >= 0 ? '+' : ''}{d.toFixed(1)}%)</span></span>); })}</div></div>)}
        <h3 className="mt-6 font-sans text-sm font-semibold uppercase tracking-wider text-faint">What it means</h3>
        <ul className="mt-2 space-y-2">{b.meaning.map((m, i) => <li key={i} className="flex gap-2.5 text-[0.95rem]"><Icon name="chevronRight" size={16} className="mt-1 shrink-0 text-accent" /><span>{m}</span></li>)}</ul>
      </div>
      <div className="border-t border-line bg-raised/50 p-5 sm:p-6">
        <h3 className="font-sans text-sm font-semibold uppercase tracking-wider text-faint">What to do next</h3>
        <ul className="mt-3 space-y-2.5">{b.actions.map((a, i) => (<li key={i}><label className="flex cursor-pointer items-start gap-3 text-[0.95rem]"><input type="checkbox" className="peer sr-only" checked={!!done[i]} onChange={() => setDone({ ...done, [i]: !done[i] })} /><span className={cx('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-accent', done[i] ? 'border-transparent bg-accent text-accent-fg' : 'border-line-strong')}>{done[i] && <Icon name="check" size={13} strokeWidth={2.6} />}</span><span className={cx(done[i] && 'text-faint line-through')}>{a}</span></label></li>))}</ul>
      </div>
    </section>
  );
}

/** "Show the math" for Business mode: the formula, the numbers that went in, and the numbers that came out. */
export function MathView({ def, r, s }: { def: CalcDef; r: RunResult; s: Record<string, string> }) {
  const outs = visibleOutputs(def, r);
  return (
    <div className="space-y-4">
      <div className="scroll-x rounded-lg bg-sunken px-3 py-3 ring-1 ring-line"><Tex>{def.formula(s)}</Tex></div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">{outs.map((o) => (<div key={o.id}><dt className="text-xs text-faint">{o.label}</dt><dd className="num font-medium">{fmtOut(o, r.o[o.id])}</dd></div>))}</dl>
      <ol className="space-y-2.5 border-t border-line pt-3">{r.steps.filter((x) => x.tex).map((x, i) => (<li key={i} className="text-sm"><span className="text-muted">{x.title}</span><div className="scroll-x mt-1 rounded-md bg-sunken px-2.5 py-2 ring-1 ring-line"><Tex>{x.tex!}</Tex></div></li>))}</ol>
      {def.convention && <p className="text-sm text-muted"><b className="text-fg">Convention.</b> {def.convention}</p>}
      {r.warnings.map((w, i) => <p key={i} className="text-sm text-muted"><b className="text-fg">Units.</b> {w.replace(/^Unit mismatch: y/, 'Y').replace(/^Units converted: t/, 'T')}</p>)}
    </div>
  );
}
export type { Mode };
