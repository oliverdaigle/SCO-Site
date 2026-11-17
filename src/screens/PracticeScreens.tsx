'use client';
import { useMemo, useRef, useState } from 'react';
import { CALCS, CHAPTERS, byId, calcsIn, catById, symbols, sym as resolveSym, NOTATIONS, type NotationId } from '@lotwise/engine';
import { liveStreak, practiceLeft, useStore } from '@/lib/store';
import { calcHref } from '@/lib/routes';
import { exportPdf } from '@/lib/export';
import { track } from '@/lib/analytics';
import { Link } from '@/platform/nav';
import { BRAND } from '@/platform/env';
import { Icon, LogoMark } from '@/components/icons';
import { Confetti, Empty, toast, cx } from '@/components/ui';
import { Tex } from '@/components/Tex';
import { ProblemCard } from '@/components/calc/Problem';
import { usePro, UpgradeCard } from '@/components/calc/Pro';

const newSeed = () => Math.floor(Math.random() * 2 ** 30) + 1;
function StreakBar() {
  const streak = useStore((s) => s.streak); const xp = useStore((s) => s.xp); const hydrated = useStore((s) => s.hydrated); const st = hydrated ? liveStreak(streak) : 0;
  return (<div className="flex flex-wrap items-center gap-2 text-sm"><span className="badge" title="Daily practice streak"><Icon name="flame" size={12} />{st}-day streak</span><span className="badge badge-neutral"><Icon name="star" size={12} />{hydrated ? xp : 0} XP</span>{hydrated && streak.best > 1 && <span className="badge badge-neutral"><Icon name="trophy" size={12} />Best {streak.best}</span>}</div>);
}

export function PracticeHubScreen() {
  const practice = useStore((s) => s.practice); const hydrated = useStore((s) => s.hydrated);
  const missed = hydrated ? Object.entries(practice).filter(([id, p]) => p.lastWrong && byId[id]).map(([id]) => byId[id]) : [];
  const acc = (id: string) => { const p = practice[id]; return p?.attempts ? Math.round((p.correct / p.attempts) * 100) : null; };
  return (
    <div className="wrap pb-20 pt-8 sm:pt-12">
      <header className="flex flex-wrap items-end justify-between gap-4"><div className="max-w-2xl"><p className="eyebrow">Practice</p><h1 className="mt-2 text-4xl font-semibold sm:text-5xl">Fresh problems, every time</h1><p className="mt-3 text-lg text-muted">Every calculator can write you a new problem with realistic numbers, check your answer, and walk through the solution.</p></div><StreakBar /></header>
      <div className="mt-8 flex flex-wrap gap-3"><Link href={`/learn/practice/${CALCS[Math.floor((hydrated ? Date.now() : 0) / 6e4) % CALCS.length].id}`} className="btn btn-primary btn-lg"><Icon name="zap" />Surprise me</Link>{missed.length > 0 && <Link href={`/learn/practice/${missed[0].id}`} className="btn btn-lg"><Icon name="refresh" />Retry a missed topic ({missed.length})</Link>}</div>
      {missed.length > 0 && (<section className="mt-8" aria-label="Topics to revisit"><h2 className="text-sm font-medium uppercase tracking-wider text-faint">Come back to these</h2><ul className="mt-3 flex flex-wrap gap-2">{missed.map((c) => <li key={c.id}><Link href={`/learn/practice/${c.id}`} className="btn btn-sm"><Icon name="alert" size={13} className="text-warn" />{c.short}</Link></li>)}</ul></section>)}
      <div className="mt-10 space-y-6">
        {CHAPTERS.map((ch) => (
          <section key={ch.id} aria-labelledby={`p-${ch.id}`}>
            <div className="flex flex-wrap items-center justify-between gap-3"><h2 id={`p-${ch.id}`} className="text-xl font-semibold"><span className="num mr-2 text-accent">{ch.chapter}</span>{ch.name}</h2><Link href={`/learn/exam/${ch.id}`} className="btn btn-sm"><Icon name="target" size={13} />Exam review</Link></div>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{calcsIn(ch.id).map((c) => { const a = hydrated ? acc(c.id) : null; return (<li key={c.id}><Link href={`/learn/practice/${c.id}`} className="card flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:border-accent-line"><span className="min-w-0 truncate font-medium">{c.short}</span>{a === null ? <span className="text-xs text-faint">New</span> : <span className={cx('num text-xs font-semibold', a >= 80 ? 'text-good' : a >= 50 ? 'text-warn' : 'text-bad')}>{a}%</span>}</Link></li>); })}</ul>
          </section>))}
      </div>
    </div>
  );
}

export function PracticeScreen({ calcId }: { calcId: string }) {
  const def = byId[calcId]; const pro = usePro('learner'); const record = useStore((s) => s.recordAnswer); const left = useStore((s) => practiceLeft(s)); const hydrated = useStore((s) => s.hydrated); const stat = useStore((s) => s.practice[calcId]);
  const [seed, setSeed] = useState(1); const [fire, setFire] = useState(0); const [msg, setMsg] = useState<string | null>(null); const [count, setCount] = useState(0);
  const blocked = hydrated && !pro && left <= 0 && count === 0;
  const onResult = (ok: boolean) => { const r = record(calcId, ok); setCount(count + 1); if (ok) { setFire(Date.now()); setMsg(r.newDay ? `Streak: ${r.streak} day${r.streak > 1 ? 's' : ''}. +10 XP` : '+10 XP'); } else setMsg(null); };
  return (
    <div className="wrap max-w-4xl pb-20 pt-8 sm:pt-12">
      <Confetti fire={fire} />
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm text-faint"><Link href="/learn/practice" className="hover:text-fg">Practice</Link><Icon name="chevronRight" size={13} /><span>{catById[def.cat].name}</span></nav>
      <header className="mt-3 flex flex-wrap items-end justify-between gap-4"><h1 className="text-3xl font-semibold sm:text-4xl">Practice: {def.short}</h1><StreakBar /></header>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">{hydrated && stat && <span>{stat.correct} of {stat.attempts} correct on this topic</span>}{msg && <span className="animate-pop font-semibold text-accent" aria-live="polite">{msg}</span>}<Link href={calcHref('learner', def.id)} className="link">Open the calculator</Link>{hydrated && !pro && <span className="text-faint">{Math.max(0, left)} free problem{left === 1 ? '' : 's'} left today</span>}</div>
      <div className="mt-6">
        {blocked ? <UpgradeCard mode="learner" feature="practice">You have used today’s 3 free practice problems. Go unlimited and unlock Exam Review.</UpgradeCard>
          : <ProblemCard calcId={calcId} seed={seed} pro={pro} onResult={onResult} onNext={() => { if (!pro && left <= 0) { setCount(0); setSeed(seed); } setSeed(newSeed()); }} />}
      </div>
    </div>
  );
}

interface Q { calcId: string; seed: number; result?: boolean }
export function ExamScreen({ chapter }: { chapter: string }) {
  const ch = catById[chapter]; const pro = usePro('learner'); const practice = useStore((s) => s.practice); const record = useStore((s) => s.recordAnswer);
  const build = (only?: string[]): Q[] => {
    const pool = only ?? calcsIn(chapter).map((c) => c.id);
    // Missed topics first, then ones never tried, then the rest: weak spots resurface.
    const score = (id: string) => { const p = practice[id]; return (p?.lastWrong ? 0 : !p ? 1 : 2) + Math.random() * 0.9; };
    const ordered = [...pool].sort((a, b) => score(a) - score(b)); const n = only ? only.length : Math.min(10, Math.max(5, pool.length));
    return Array.from({ length: n }, (_, i) => ({ calcId: ordered[i % ordered.length], seed: newSeed() }));
  };
  const [qs, setQs] = useState<Q[] | null>(null); const [i, setI] = useState(0); const [fire, setFire] = useState(0); const [round, setRound] = useState(1);
  if (!ch) return <div className="wrap py-20"><Empty title="Chapter not found"><Link href="/learn" className="link">Back to chapters</Link></Empty></div>;
  const start = (only?: string[]) => { setQs(build(only)); setI(0); };
  const done = qs && i >= qs.length; const correct = qs?.filter((q) => q.result).length ?? 0; const missed = qs ? [...new Set(qs.filter((q) => q.result === false).map((q) => q.calcId))] : [];
  return (
    <div className="wrap max-w-4xl pb-20 pt-8 sm:pt-12">
      <Confetti fire={fire} />
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm text-faint"><Link href="/learn" className="hover:text-fg">Chapters</Link><Icon name="chevronRight" size={13} /><span>Chapter {ch.chapter}</span></nav>
      <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Exam review: {ch.name}</h1>
      {!pro ? <div className="mt-6"><UpgradeCard mode="learner" feature="exam">Mixed problems across the whole chapter, accuracy tracking, and missed topics that come back until you get them.</UpgradeCard><p className="mt-4 text-sm text-muted">You can still practice any single topic for free: <Link href="/learn/practice" className="link">go to practice</Link>.</p></div>
        : !qs ? (
          <div className="card mt-6 p-6 sm:p-8">
            <p className="text-lg">A mixed set of {Math.min(10, Math.max(5, calcsIn(chapter).length))} problems from across the chapter. Topics you missed before come first.</p>
            <ul className="mt-4 flex flex-wrap gap-2">{calcsIn(chapter).map((c) => <li key={c.id} className={cx('badge', practice[c.id]?.lastWrong ? '' : 'badge-neutral')}>{practice[c.id]?.lastWrong && <Icon name="alert" size={11} />}{c.short}</li>)}</ul>
            <button type="button" className="btn btn-primary btn-lg mt-6" onClick={() => start()}><Icon name="play" />Start review</button>
          </div>)
        : done ? (
          <div className="card animate-pop mt-6 p-6 text-center sm:p-10">
            <Icon name="trophy" size={34} className="mx-auto text-accent" />
            <p className="num mt-3 text-6xl font-semibold tracking-tight text-accent">{correct}/{qs.length}</p>
            <p className="mt-2 text-lg">{correct === qs.length ? 'Perfect round. You are ready for this chapter.' : correct / qs.length >= 0.7 ? 'Solid. Tighten up the topics below and you are there.' : 'Good start. The topics below need another pass.'}</p>
            {missed.length > 0 && (<div className="mx-auto mt-6 max-w-md text-left"><p className="text-sm font-medium uppercase tracking-wider text-faint">Missed topics</p><ul className="mt-2 space-y-1.5">{missed.map((id) => <li key={id} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2"><span>{byId[id].name}</span><Link href={calcHref('learner', id)} className="link shrink-0 text-sm">Review method</Link></li>)}</ul></div>)}
            <div className="mt-7 flex flex-wrap justify-center gap-3">{missed.length > 0 && <button type="button" className="btn btn-primary btn-lg" onClick={() => { setRound(round + 1); start(missed); }}><Icon name="refresh" />Retry the {missed.length} missed topic{missed.length > 1 ? 's' : ''}</button>}<button type="button" className="btn btn-lg" onClick={() => { setRound(1); start(); }}>New mixed set</button><Link href={`/learn/formula-sheet/${chapter}`} className="btn btn-lg"><Icon name="file" />Formula sheet</Link></div>
          </div>)
        : (<>
          <div className="mt-5 flex items-center gap-3"><div className="h-2 flex-1 overflow-hidden rounded-full bg-sunken ring-1 ring-line" role="progressbar" aria-valuenow={i} aria-valuemin={0} aria-valuemax={qs.length} aria-label="Progress"><div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${(i / qs.length) * 100}%` }} /></div><span className="num text-sm text-muted">{i + 1}/{qs.length}{round > 1 ? ` · round ${round}` : ''}</span><span className="num text-sm text-good">{correct} right</span></div>
          <div className="mt-5"><ProblemCard key={`${qs[i].calcId}-${qs[i].seed}`} calcId={qs[i].calcId} seed={qs[i].seed} pro={pro} nextLabel={i === qs.length - 1 ? 'See my results' : 'Next problem'} onResult={(ok) => { record(qs[i].calcId, ok); if (ok) setFire(Date.now()); setQs(qs.map((q, k) => (k === i ? { ...q, result: ok } : q))); }} onNext={() => setI(i + 1)} /></div>
        </>)}
    </div>
  );
}

export function FormulaSheetScreen({ chapter }: { chapter: string }) {
  const ch = catById[chapter]; const pro = usePro('learner'); const nota = useStore((s) => s.notation) as NotationId; const setNotation = useStore((s) => s.setNotation); const sheet = useRef<HTMLDivElement>(null); const [busy, setBusy] = useState(false);
  const list = useMemo(() => (ch ? calcsIn(chapter) : []), [ch, chapter]);
  if (!ch) return <div className="wrap py-20"><Empty title="Chapter not found"><Link href="/learn" className="link">Back to chapters</Link></Empty></div>;
  const s = symbols(nota);
  const legend = [...new Map(list.flatMap((c) => c.inputs.filter((i) => i.sym && ['number', 'money', 'percent', 'int'].includes(i.kind)).map((i) => [resolveSym(i.sym, nota), i.label] as [string, string]))).entries()].slice(0, 22);
  const pdf = async () => { if (!sheet.current) return; setBusy(true); try { await exportPdf(sheet.current, `lotwise-formula-sheet-ch${ch.chapter}-${chapter}.pdf`); track('export', { kind: 'formula-sheet', chapter }); toast('Formula sheet saved'); } catch { toast('Could not create the PDF. Try again.'); } setBusy(false); };
  return (
    <div className="wrap pb-20 pt-8 sm:pt-12">
      <div className="no-print flex flex-wrap items-end justify-between gap-4">
        <div><nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm text-faint"><Link href="/learn" className="hover:text-fg">Chapters</Link><Icon name="chevronRight" size={13} /><span>Chapter {ch.chapter}</span></nav><h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Formula sheet: {ch.name}</h1></div>
        <div className="flex flex-wrap items-center gap-2">
          <select className="input h-10 w-auto text-sm" value={nota} onChange={(e) => setNotation(e.target.value as NotationId)} aria-label="Textbook notation">{NOTATIONS.map((n) => <option key={n.id} value={n.id}>{n.short} notation</option>)}</select>
          {pro ? <button type="button" className="btn btn-primary" onClick={pdf} disabled={busy}><Icon name="download" size={15} />{busy ? 'Building PDF…' : 'Download PDF'}</button> : <Link href="/pricing#learner" className="btn"><Icon name="lock" size={14} />Download PDF</Link>}
        </div>
      </div>
      {!pro && <div className="no-print mt-5"><UpgradeCard mode="learner" feature="formula-sheet">Get the one-page PDF for every chapter, in your textbook’s notation.</UpgradeCard></div>}
      <div className="scroll-x mt-6 rounded-2xl border border-line bg-white shadow-2xl">
        <div ref={sheet} data-theme="light" data-mode="learner" className={cx(!pro && 'pointer-events-none select-none')} style={{ width: 1000, padding: '30px 34px', background: '#fff', color: '#0e1118', fontFamily: 'var(--font-sans)', filter: pro ? undefined : 'blur(0px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid #0e1118', paddingBottom: 10 }}>
            <div><div style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: '#b8480a', fontFamily: 'var(--font-mono)' }}>Chapter {ch.chapter} formula sheet</div><div style={{ fontSize: 26, fontWeight: 700, fontFamily: 'var(--font-display)', letterSpacing: '-.02em' }}>{ch.name}</div></div>
            <div style={{ textAlign: 'right', fontSize: 11, color: '#4a5264' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 14, color: '#0e1118' }}><LogoMark size={20} />{BRAND.name}</span><div>{NOTATIONS.find((n) => n.id === nota)!.name} notation</div><div>{BRAND.domain}</div></div>
          </div>
          <div style={{ columnCount: 2, columnGap: 22, marginTop: 14 }}>
            {list.map((c, k) => (
              <div key={c.id} style={{ breakInside: 'avoid', border: '1px solid #d8dbe4', borderRadius: 8, padding: '8px 10px', marginBottom: 9, position: 'relative', overflow: 'hidden' }}>
                {!pro && k > 1 && <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,.72)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)', zIndex: 2 }} />}
                <div style={{ fontSize: 12.5, fontWeight: 700 }}>{c.name}</div>
                <div style={{ margin: '5px 0 4px', fontSize: 13.5, overflow: 'hidden' }}><Tex>{c.formula(s)}</Tex></div>
                <div style={{ fontSize: 10.5, color: '#4a5264', lineHeight: 1.35 }}><b style={{ color: '#0e1118' }}>Watch for:</b> {c.traps[0]}</div>
              </div>))}
          </div>
          <div style={{ marginTop: 6, borderTop: '1px solid #d8dbe4', paddingTop: 8, fontSize: 10.5, color: '#4a5264', display: 'flex', flexWrap: 'wrap', gap: '3px 16px' }}>{legend.map(([sy, label]) => <span key={sy + label}><span style={{ color: '#0e1118' }}><Tex>{sy}</Tex></span> = {label.toLowerCase()}</span>)}</div>
        </div>
      </div>
    </div>
  );
}
