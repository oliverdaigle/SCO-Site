'use client';
import { useEffect, useMemo, useState } from 'react';
import { byId, checkAnswer, makeProblem, run, F, type NotationId } from '@lotwise/engine';
import { useStore } from '@/lib/store';
import { track } from '@/lib/analytics';
import { Icon } from '../icons';
import { cx } from '../ui';
import { parseNum } from './Inputs';
import { LearnerResult } from './Results';
import { Viz } from '../viz/Viz';

const PRAISE = ['Nailed it.', 'Exactly right.', 'Clean work.', 'That is the one.', 'Spot on.'];
/** One practice problem: fresh numbers, tolerance-based checking, worked solution on demand. */
export function ProblemCard({ calcId, seed, pro, onResult, onNext, nextLabel = 'Next problem' }: { calcId: string; seed: number; pro: boolean; onResult?: (correct: boolean) => void; onNext?: () => void; nextLabel?: string }) {
  const def = byId[calcId]; const nota = useStore((s) => s.notation) as NotationId; const eli = useStore((s) => s.eli); const setEli = useStore((s) => s.setEli);
  const problem = useMemo(() => makeProblem(def, seed), [def, seed]);
  const [answers, setAnswers] = useState<Record<string, string>>({}); const [state, setState] = useState<'open' | 'correct' | 'wrong'>('open'); const [tries, setTries] = useState(0); const [show, setShow] = useState(false);
  useEffect(() => { setAnswers({}); setState('open'); setTries(0); setShow(false); }, [calcId, seed]);
  const sol = useMemo(() => run(def, problem.values, { nota }), [def, problem, nota]);
  const marks = problem.answers.map((a) => checkAnswer(a.value, parseNum(answers[a.id] ?? ''), a.fmt));
  const submit = () => { const ok = marks.every(Boolean); setTries(tries + 1); setState(ok ? 'correct' : 'wrong'); if (ok || tries >= 1) { onResult?.(ok); track('practice', { calc: calcId, correct: ok }); if (!ok) setShow(true); } };
  const done = state === 'correct' || (state === 'wrong' && tries >= 2);
  const fmt = (a: (typeof problem.answers)[number]) => (a.fmt === 'money' ? F.money(a.value, 2) : a.fmt === 'pct' ? F.pct(a.value, 2) : F.num(a.value, a.fmt === 'int' ? 0 : undefined) + (a.unit && a.unit !== '$' && a.unit !== '%' ? ' ' + a.unit : ''));
  return (
    <div className="space-y-5">
      <div className="card p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3"><p className="eyebrow">{def.name}</p><span className="text-xs text-faint">Answers within 1% count as correct</span></div>
        <p className="mt-3 text-lg leading-relaxed">{problem.prompt}</p>
        <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); if (!done) submit(); }}>
          {problem.answers.map((a, i) => (
            <label key={a.id} className="block">
              <span className="label">{a.label}{a.unit ? ` (${a.unit})` : ''}</span>
              <div className="relative mt-1.5">
                <input className={cx('input num h-12 text-lg', state !== 'open' && (marks[i] ? '!border-good' : '!border-bad'))} inputMode="decimal" autoComplete="off" placeholder="Your answer" value={answers[a.id] ?? ''} disabled={done} onChange={(e) => { setAnswers({ ...answers, [a.id]: e.target.value }); if (state === 'wrong') setState('open'); }} aria-invalid={state !== 'open' && !marks[i]} />
                {state !== 'open' && <Icon name={marks[i] ? 'check' : 'x'} className={cx('absolute right-3 top-1/2 -translate-y-1/2', marks[i] ? 'text-good' : 'text-bad')} />}
              </div>
            </label>))}
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            {!done && <button type="submit" className="btn btn-primary btn-lg" disabled={problem.answers.some((a) => !(answers[a.id] ?? '').trim())}>Check answer</button>}
            {!done && <button type="button" className="btn btn-ghost" onClick={() => { setShow(true); if (state === 'open') { setTries(2); setState('wrong'); onResult?.(false); } }}>Show me the solution</button>}
            {done && onNext && <button type="button" className="btn btn-primary btn-lg" onClick={onNext} autoFocus>{nextLabel}<Icon name="arrowRight" /></button>}
            {done && !show && <button type="button" className="btn" onClick={() => setShow(true)}>See the worked solution</button>}
          </div>
        </form>
        <div aria-live="polite" className="mt-4">
          {state === 'correct' && (<p className="animate-pop flex items-center gap-2 rounded-xl border border-good/40 bg-[color-mix(in_oklab,var(--good)_12%,transparent)] px-4 py-3 font-semibold text-good"><Icon name="check" strokeWidth={2.4} />{PRAISE[seed % PRAISE.length]} {problem.answers.map((a) => `${a.label}: ${fmt(a)}`).join(' · ')}</p>)}
          {state === 'wrong' && tries < 2 && (<p className="rounded-xl border border-warn/40 bg-[color-mix(in_oklab,var(--warn)_10%,transparent)] px-4 py-3 text-sm"><b>Not quite.</b> One more try. Check this first: {def.traps[seed % def.traps.length]}</p>)}
          {state === 'wrong' && tries >= 2 && (<p className="rounded-xl border border-bad/40 bg-[color-mix(in_oklab,var(--bad)_10%,transparent)] px-4 py-3 text-sm"><b>The answer is {problem.answers.map((a) => `${a.label.toLowerCase()} = ${fmt(a)}`).join(', ')}.</b> Walk through the solution below, then try a fresh one. This topic will come back in Exam Review.</p>)}
        </div>
      </div>
      {show && sol.ok && (<><LearnerResult def={def} r={sol} nota={nota} pro={pro} eli={eli} setEli={setEli} />{sol.viz && <section className="card p-4 sm:p-5" aria-label="Visual"><h3 className="mb-2 text-lg font-semibold">Visualize it</h3><Viz spec={sol.viz} /></section>}</>)}
    </div>
  );
}
