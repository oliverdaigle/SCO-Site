'use client';
import { CALCS, CATEGORIES, CHAPTERS, calcsIn, byId, type Mode } from '@lotwise/engine';
import { liveStreak, useStore } from '@/lib/store';
import { calcHref } from '@/lib/routes';
import { Link } from '@/platform/nav';
import { Icon } from '@/components/icons';
import { VerifiedBadge } from '@/components/calc/Extras';

const QUICK = [
  { q: 'I keep running out of stock', to: '/business/safety-stock-demand', icon: 'shield' }, { q: 'How much should I order?', to: '/business/eoq', icon: 'box' }, { q: 'How many staff do I need on Saturday?', to: '/business/mms', icon: 'queue' },
  { q: 'Is this supplier actually cheaper?', to: '/business/total-cost-of-ownership', icon: 'handshake' }, { q: 'Where should my warehouse go?', to: '/business/center-of-gravity', icon: 'map' }, { q: 'What will I sell next month?', to: '/business/exponential-smoothing', icon: 'forecast' },
];

function BusinessHub() {
  const recent = useStore((s) => s.recent); const hydrated = useStore((s) => s.hydrated);
  return (
    <div className="pb-20">
      <section className="relative overflow-hidden border-b border-line">
        <div className="aurora" aria-hidden /><div className="gridlines absolute inset-0" aria-hidden />
        <div className="wrap relative py-14 sm:py-20">
          <p className="eyebrow">Business mode</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold sm:text-6xl">What do you need to figure out?</h1>
          <p className="mt-4 max-w-2xl text-lg text-muted">Start from the problem, not the formula. You get one clear answer, what it means in dollars and time, and what to do next.</p>
          <div className="mt-7 flex flex-wrap gap-3"><Link href="/business/wizard" className="btn btn-primary btn-lg"><Icon name="wand" />Help me find the right tool</Link><Link href="/business/plan-builder" className="btn btn-lg"><Icon name="layers" />Build a plan from my sales data</Link></div>
          <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {QUICK.map((x) => (<li key={x.q}><Link href={x.to} className="card group flex items-center gap-3 p-4 transition-all hover:-translate-y-0.5 hover:border-accent-line"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent"><Icon name={x.icon} /></span><span className="font-medium">“{x.q}”</span><Icon name="arrowRight" size={16} className="ml-auto shrink-0 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-accent" /></Link></li>))}
          </ul>
        </div>
      </section>
      <div className="wrap">
        {hydrated && recent.length > 0 && (<section className="pt-10" aria-label="Recently used"><h2 className="text-sm font-medium uppercase tracking-wider text-faint">Pick up where you left off</h2><ul className="mt-3 flex flex-wrap gap-2">{recent.filter((id) => byId[id]).slice(0, 6).map((id) => <li key={id}><Link href={calcHref('business', id)} className="btn btn-sm">{byId[id].short}</Link></li>)}</ul></section>)}
        <section className="grid gap-4 pt-10 md:grid-cols-2" aria-label="Pro tools">
          <Link href="/business/plan-builder" className="card glow group relative overflow-hidden p-6"><span className="badge"><Icon name="sparkles" size={11} />Business Pro</span><h2 className="mt-3 text-2xl font-semibold">Supply Chain Plan Builder</h2><p className="mt-2 text-muted">Upload a CSV of sales history. Get a forecast, safety stock, reorder point, and order quantity for every SKU, with a live-formula Excel export.</p><span className="mt-4 inline-flex items-center gap-1.5 font-medium text-accent">Try it with sample data<Icon name="arrowRight" size={16} /></span></Link>
          <Link href="/business/wrapped" className="card glow group relative overflow-hidden p-6"><span className="badge"><Icon name="sparkles" size={11} />Business Pro</span><h2 className="mt-3 text-2xl font-semibold">Your Supply Chain, Wrapped</h2><p className="mt-2 text-muted">Bold story cards made from your own numbers: your top sellers, your forecast accuracy, the cash sitting in excess stock. Ready to share.</p><span className="mt-4 inline-flex items-center gap-1.5 font-medium text-accent">See yours<Icon name="arrowRight" size={16} /></span></Link>
        </section>
        <h2 className="pt-14 text-2xl font-semibold sm:text-3xl">All {CALCS.length} calculators, by what they help you do</h2>
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          {CATEGORIES.map((cat) => (
            <section key={cat.id} id={cat.id} className="card scroll-mt-24 p-5" aria-labelledby={`h-${cat.id}`}>
              <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent"><Icon name={cat.icon} size={18} /></span><div><h3 id={`h-${cat.id}`} className="text-lg font-semibold">{cat.bname}</h3><p className="text-xs text-faint">{cat.name}</p></div></div>
              <ul className="mt-4 divide-y divide-line">{calcsIn(cat.id).map((c) => (<li key={c.id}><Link href={calcHref('business', c.id)} className="group flex items-center justify-between gap-3 py-2.5"><span className="min-w-0"><span className="block font-medium group-hover:text-accent">{c.bq}</span><span className="block truncate text-sm text-muted">{c.name}</span></span><Icon name="chevronRight" size={15} className="shrink-0 text-faint group-hover:text-accent" /></Link></li>))}</ul>
            </section>))}
        </div>
      </div>
    </div>
  );
}

function LearnerHub() {
  const practice = useStore((s) => s.practice); const streak = useStore((s) => s.streak); const xp = useStore((s) => s.xp); const hydrated = useStore((s) => s.hydrated);
  const st = hydrated ? liveStreak(streak) : 0;
  return (
    <div className="pb-20">
      <section className="relative overflow-hidden border-b border-line">
        <div className="aurora" aria-hidden /><div className="gridlines absolute inset-0" aria-hidden />
        <div className="wrap relative grid gap-8 py-14 sm:py-20 lg:grid-cols-[1.5fr_1fr] lg:items-end">
          <div>
            <p className="eyebrow">Learner mode</p>
            <h1 className="mt-3 max-w-3xl text-4xl font-semibold sm:text-6xl">Understand the method. Then ace the exam.</h1>
            <p className="mt-4 max-w-2xl text-lg text-muted">Every operations and supply chain formula with full substitutions, table lookups, exam traps, and unlimited practice. In your textbook’s notation.</p>
            <div className="mt-7 flex flex-wrap gap-3"><Link href="/learn/wizard" className="btn btn-primary btn-lg"><Icon name="wand" />Which model do I use?</Link><Link href="/learn/paste" className="btn btn-lg"><Icon name="clipboard" />Paste a homework problem</Link></div>
          </div>
          <div className="card p-5">
            <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Your progress</h2><Link href="/learn/practice" className="link text-sm">Practice</Link></div>
            <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div className="panel py-3"><dt className="text-xs text-muted">Streak</dt><dd className="num mt-1 flex items-center justify-center gap-1 text-2xl font-semibold text-accent"><Icon name="flame" size={18} />{st}</dd></div>
              <div className="panel py-3"><dt className="text-xs text-muted">XP</dt><dd className="num mt-1 text-2xl font-semibold">{hydrated ? xp : 0}</dd></div>
              <div className="panel py-3"><dt className="text-xs text-muted">Topics tried</dt><dd className="num mt-1 text-2xl font-semibold">{hydrated ? Object.keys(practice).length : 0}<span className="text-sm text-faint">/{CALCS.length}</span></dd></div>
            </dl>
            <p className="mt-3 text-sm text-muted">{st > 0 ? `You are on a ${st}-day streak. One correct answer today keeps it alive.` : 'Answer one practice problem correctly to start a streak.'}</p>
          </div>
        </div>
      </section>
      <div className="wrap">
        <h2 className="pt-12 text-2xl font-semibold sm:text-3xl">The course</h2>
        <p className="mt-2 text-muted">Thirteen chapters, in the order most operations courses teach them.</p>
        <ol className="mt-6 space-y-4" id="sheets">
          {CHAPTERS.map((ch) => { const list = calcsIn(ch.id); const tried = hydrated ? list.filter((c) => practice[c.id]?.correct).length : 0; return (
            <li key={ch.id} id={ch.id} className="card scroll-mt-24 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-line bg-raised/50 px-5 py-4">
                <div className="flex items-center gap-4"><span className="num flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-lg font-bold text-accent-fg">{ch.chapter}</span><div><h3 className="text-xl font-semibold">{ch.name}</h3><p className="text-sm text-muted">{ch.blurb}</p></div></div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="mr-2 flex items-center gap-2 text-xs text-faint" title={`${tried} of ${list.length} topics answered correctly in practice`}><div className="h-1.5 w-20 overflow-hidden rounded-full bg-sunken ring-1 ring-line"><div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${(tried / list.length) * 100}%` }} /></div>{tried}/{list.length}</div>
                  <Link href={`/learn/exam/${ch.id}`} className="btn btn-sm"><Icon name="target" size={13} />Exam review</Link>
                  <Link href={`/learn/formula-sheet/${ch.id}`} className="btn btn-sm"><Icon name="file" size={13} />Formula sheet</Link>
                </div>
              </div>
              <ul className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-3">{list.map((c) => (<li key={c.id} className="bg-surface"><Link href={calcHref('learner', c.id)} className="group flex h-full items-start justify-between gap-3 px-5 py-3.5 hover:bg-raised"><span className="min-w-0"><span className="block font-medium group-hover:text-accent">{c.name}</span><span className="mt-0.5 line-clamp-1 block text-sm text-muted">{c.blurb}</span></span>{hydrated && practice[c.id]?.correct ? <Icon name="check" size={15} className="mt-1 shrink-0 text-good" /> : <Icon name="chevronRight" size={15} className="mt-1 shrink-0 text-faint" />}</Link></li>))}</ul>
            </li>); })}
        </ol>
        <p className="mt-8 flex flex-wrap items-center gap-2 text-sm text-muted"><VerifiedBadge id="eoq" compact />Every calculator is checked against worked examples, an independent implementation, and simulation. <Link href="/verified" className="link">See the results</Link>.</p>
      </div>
    </div>
  );
}
export function HubScreen({ mode }: { mode: Mode }) { return mode === 'business' ? <BusinessHub /> : <LearnerHub />; }
