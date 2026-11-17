'use client';
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useMotionValueEvent, useScroll, useSpring, useTransform, type MotionValue } from 'motion/react';
import { CALCS, CATEGORIES, byId, defaults, run, type Mode, type Vals } from '@lotwise/engine';
import summary from '@/data/verified-summary.json';
import { SOCIAL_PROOF } from '@/data/socialProof';
import { useStore } from '@/lib/store';
import { calcHref, modeBase } from '@/lib/routes';
import { BRAND } from '@/platform/env';
import { Link } from '@/platform/nav';
import { Icon } from '@/components/icons';
import { Slider, cx, useInView, useReducedMotion } from '@/components/ui';
// Chart code loads only when the first mini calculator scrolls near, keeping the first screen light.
const Viz = lazy(() => import('@/components/viz/Viz').then((m) => ({ default: m.Viz })));
import { ModeChoice } from './StartScreen';
import { PricingCards } from './AccountScreens';

type StageId = 'forecast' | 'supplier' | 'factory' | 'warehouse' | 'store' | 'customer';
interface Stage { id: StageId; label: string; icon: string; title: string; body: string; calc: string; base?: Vals; sliders: { id: string; label: string; min: number; max: number; step: number; fmt: (x: number) => string }[] }
const STAGES: Stage[] = [
  { id: 'forecast', label: 'Forecast', icon: 'forecast', title: 'It starts with a guess about next month.', body: 'Every plan begins with a forecast, and every forecast is wrong. What matters is how wrong, and how fast it learns. Drag the dial and watch the forecast chase the sales history.', calc: 'exponential-smoothing', sliders: [{ id: 'alpha', label: 'How quickly the forecast reacts', min: 0.05, max: 0.95, step: 0.05, fmt: (x) => x.toFixed(2) }] },
  { id: 'supplier', label: 'Supplier', icon: 'handshake', title: 'The quoted price is never the real price.', body: 'Freight, duty, insurance, and fees ride along with every unit. Landed cost tells you what the box actually costs by the time it reaches your door.', calc: 'landed-cost', sliders: [{ id: 'freight', label: 'Freight for the shipment', min: 0, max: 6000, step: 100, fmt: (x) => '$' + x.toLocaleString('en-US') }, { id: 'duty', label: 'Import duty', min: 0, max: 30, step: 1, fmt: (x) => x + '%' }] },
  { id: 'factory', label: 'Factory', icon: 'factory', title: 'A line moves at the pace of its slowest step.', body: 'Speeding up anything except the bottleneck changes nothing. Raise demand and see which step turns red first.', calc: 'bottleneck', sliders: [{ id: 'demand', label: 'Units needed per hour', min: 4, max: 20, step: 1, fmt: (x) => String(x) }] },
  { id: 'warehouse', label: 'Warehouse', icon: 'box', title: 'How much to order, and when to pull the trigger.', body: 'Order too much and cash sits on a shelf. Too little and the shelf is empty. The reorder point and order quantity balance the two, and safety stock pays for the service level you choose.', calc: 'continuous-review', sliders: [{ id: 'SL', label: 'How often you want to avoid a stockout', min: 80, max: 99.5, step: 0.5, fmt: (x) => x + '%' }, { id: 'sd', label: 'How much daily sales swing', min: 0, max: 60, step: 2, fmt: (x) => '±' + x + ' units' }] },
  { id: 'store', label: 'Store', icon: 'store', title: 'Lines explode long before you are fully busy.', body: 'Waiting grows slowly, then all at once. Add a second person at the counter, or let a few more customers arrive each hour, and watch the line.', calc: 'mms', base: { lambda: 2.6, mu: 3, s: 1 }, sliders: [{ id: 's', label: 'Staff at the counter', min: 1, max: 4, step: 1, fmt: (x) => String(x) }, { id: 'lambda', label: 'Customers arriving per hour', min: 1, max: 2.9, step: 0.1, fmt: (x) => x.toFixed(1) }] },
  { id: 'customer', label: 'Customer', icon: 'smile', title: 'Then it either arrives right, or it does not.', body: 'On time, complete, undamaged, with the right paperwork. Four good numbers multiply into one that is worse than any of them, and that is the one your customer feels.', calc: 'perfect-order', sliders: [{ id: 'onTime', label: 'Delivered on time', min: 80, max: 100, step: 0.5, fmt: (x) => x + '%' }, { id: 'complete', label: 'Delivered complete', min: 80, max: 100, step: 0.5, fmt: (x) => x + '%' }] },
];

/** A real calculator, cut down to one or two sliders. Uses the same engine as the full page. */
function MiniCalc({ stage, mode }: { stage: Stage; mode: Mode }) {
  const def = byId[stage.calc]; const [ref, seen] = useInView<HTMLDivElement>('200px'); const [vals, setVals] = useState<Vals>(() => ({ ...defaults(def), ...stage.base }));
  const r = useMemo(() => run(def, vals), [def, vals]);
  return (
    <div ref={ref} className="card glow relative mt-6 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 text-xs text-faint"><span className="truncate">{def.name}</span><span className="badge badge-good shrink-0"><Icon name="shield" size={11} />Verified</span></div>
      <p className="display mt-3 min-h-[3.5rem] text-xl font-semibold leading-snug sm:text-2xl" aria-live="polite">{r.ok ? (r.biz?.headline ?? '').replace(/\*\*/g, '') : r.errors[0]}</p>
      <div className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">{stage.sliders.map((s) => (<div key={s.id}><div className="flex items-baseline justify-between gap-3 text-sm"><label htmlFor={`mini-${stage.id}-${s.id}`} className="text-muted">{s.label}</label><span className="num font-semibold text-accent">{s.fmt(Number(vals[s.id]))}</span></div><Slider id={`mini-${stage.id}-${s.id}`} label={s.label} min={s.min} max={s.max} step={s.step} value={Number(vals[s.id])} onChange={(x) => setVals((v) => ({ ...v, [s.id]: x }))} /></div>))}</div>
      <div className="mt-3 min-h-[200px]">{seen && r.ok && r.viz && <Suspense fallback={<div className="h-[210px]" />}><Viz spec={r.viz} height={210} /></Suspense>}</div>
      <Link href={calcHref(mode, def.id)} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-accent">Open the full calculator<Icon name="arrowRight" size={14} /></Link>
    </div>
  );
}

function Box({ size = 34 }: { size?: number }) {
  return (<span className="flex items-center justify-center rounded-[10px] bg-accent text-accent-fg shadow-[0_6px_24px_-4px_var(--accent)]" style={{ width: size, height: size }}><Icon name="box" size={size * 0.55} /></span>);
}
function Rail({ pos, active, vertical }: { pos: MotionValue<number>; active: number; vertical: boolean }) {
  const ref = useRef<HTMLDivElement>(null); const [len, setLen] = useState(0); const B = vertical ? 34 : 28;
  useEffect(() => { const el = ref.current; if (!el) return; const m = () => setLen(vertical ? el.clientHeight : el.clientWidth); m(); const ro = new ResizeObserver(m); ro.observe(el); return () => ro.disconnect(); }, [vertical]);
  const d = useTransform(pos, (v) => v * Math.max(0, len - B));
  return (
    <div ref={ref} className={cx('relative', vertical ? 'h-full w-full' : 'h-7 w-full')} aria-hidden>
      <div className={cx('absolute rounded-full bg-line-strong', vertical ? 'bottom-4 left-[16px] top-4 w-0.5' : 'left-3 right-3 top-[13px] h-0.5')} />
      <div className={cx('absolute inset-0 flex justify-between', vertical ? 'flex-col' : 'flex-row')}>
        {STAGES.map((s, i) => (<div key={s.id} className={cx('flex items-center gap-3', vertical ? '' : 'flex-col')}><span className={cx('flex shrink-0 items-center justify-center rounded-[10px] border bg-bg transition-colors duration-300', i <= active ? 'border-accent-line text-accent' : 'border-line text-faint')} style={{ width: B, height: B }}><Icon name={s.icon} size={B * 0.5} /></span>{vertical && <span className={cx('text-sm font-medium transition-colors duration-300', i === active ? 'text-fg' : 'text-faint')}>{s.label}</span>}</div>))}
      </div>
      <motion.div className="absolute left-0 top-0" style={vertical ? { y: d } : { x: d }}><Box size={B} /></motion.div>
    </div>
  );
}

function Story({ mode }: { mode: Mode }) {
  const ref = useRef<HTMLDivElement>(null); const reduced = useReducedMotion(); const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start center', 'end center'] });
  const raw = useTransform(scrollYProgress, (v) => Math.max(0, Math.min(1, (v * STAGES.length - 0.5) / (STAGES.length - 1))));
  const smooth = useSpring(raw, { stiffness: 140, damping: 26, mass: 0.6 }); const pos = reduced ? raw : smooth;
  useMotionValueEvent(scrollYProgress, 'change', (v) => { const i = Math.max(0, Math.min(STAGES.length - 1, Math.floor(v * STAGES.length))); setActive((a) => (a === i ? a : i)); });
  return (
    <section aria-labelledby="story-h" className="relative">
      <div className="wrap pt-20 sm:pt-28"><p className="eyebrow">Follow one box</p><h2 id="story-h" className="mt-2 max-w-3xl text-4xl font-semibold sm:text-5xl">From a forecast to a customer’s hands, there is a formula for every step.</h2><p className="mt-4 max-w-2xl text-lg text-muted">Scroll to send a box down the chain. Each stop is a live calculator, running the same verified engine as the full site.</p></div>
      <div className="sticky top-14 z-20 border-b border-line bg-bg/85 px-4 py-2.5 backdrop-blur-lg lg:hidden"><Rail pos={pos} active={active} vertical={false} /><p className="mt-1 text-center text-xs font-medium text-muted">{active + 1} of {STAGES.length} · {STAGES[active].label}</p></div>
      <div ref={ref} className="wrap grid gap-x-12 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <div className="hidden lg:block"><div className="sticky top-28 h-[min(30rem,calc(100dvh-10rem))] py-2"><Rail pos={pos} active={active} vertical /></div></div>
        <div>{STAGES.map((s, i) => { const cats = CATEGORIES.filter((c) => c.stage === s.id); return (
          <article key={s.id} id={`stage-${s.id}`} className="flex min-h-[86vh] max-w-3xl flex-col justify-center py-12 lg:min-h-[92vh]">
            <p className="eyebrow">Stop {i + 1} · {s.label}</p>
            <h3 className="mt-2 text-3xl font-semibold sm:text-4xl">{s.title}</h3>
            <p className="mt-3 text-lg text-muted">{s.body}</p>
            <MiniCalc stage={s} mode={mode} />
            <ul className="mt-5 flex flex-wrap gap-2">{cats.map((c) => { const n = CALCS.filter((d) => d.cat === c.id).length; return (<li key={c.id}><Link href={`${modeBase(mode)}#${c.id}`} className="btn btn-sm"><Icon name={c.icon} size={14} />{mode === 'business' ? c.bname : c.name}<span className="num text-faint">{n}</span></Link></li>); })}</ul>
          </article>); })}</div>
      </div>
    </section>
  );
}

const FEATURES: { icon: string; title: string; body: string; href: string; cta: string; mode?: Mode }[] = [
  { icon: 'layers', title: 'Plan Builder', body: 'Upload a sales history. Get a forecast, safety stock, reorder point, and order size for every product, then export it to Excel with live formulas.', href: '/business/plan-builder', cta: 'Build a plan', mode: 'business' },
  { icon: 'wand', title: 'Paste Your Problem', body: 'Paste a homework problem. Lotwise picks the model, pulls out the numbers and units, and walks through the solution step by step.', href: '/learn/paste', cta: 'Paste a problem', mode: 'learner' },
  { icon: 'network', title: 'Formula Map', body: 'See all 93 formulas as one connected map. Follow a learning path from forecast error to reorder point.', href: '/map', cta: 'Explore the map' },
  { icon: 'target', title: 'Practice and Exam Review', body: 'Fresh problems for every calculator, a streak to keep, and review sessions that bring back what you missed.', href: '/learn/practice', cta: 'Start practicing', mode: 'learner' },
  { icon: 'sparkles', title: 'Your Supply Chain, Wrapped', body: 'Your year of inventory told as a set of shareable cards: fastest mover, cash on the shelf, and what to fix first.', href: '/business/wrapped', cta: 'See it', mode: 'business' },
  { icon: 'code', title: 'Embeds', body: 'Put any calculator on your own site, course page, or help center with one snippet, themed to match.', href: '/embed-builder', cta: 'Get the code' },
];
const big = (x: number) => (x >= 1e6 ? (x / 1e6).toFixed(x >= 1e8 ? 0 : 1) + 'M' : x.toLocaleString('en-US'));

export function LandingScreen() {
  const stored = useStore((s) => s.mode); const hydrated = useStore((s) => s.hydrated); const mode: Mode = hydrated && stored ? stored : 'business'; const S = summary.summary;
  const openSearch = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
  return (
    <div>
      <section className="relative overflow-hidden border-b border-line" aria-labelledby="hero-h">
        <div className="aurora" aria-hidden /><div className="gridlines" aria-hidden />
        <div className="wrap relative pb-20 pt-16 text-center sm:pb-28 sm:pt-24">
          <Link href="/verified" className="badge badge-good"><Icon name="shield" size={12} />{S.passed} of {S.calculators} calculators verified three ways</Link>
          <h1 id="hero-h" className="mx-auto mt-6 max-w-4xl text-5xl font-semibold leading-[1.02] sm:text-7xl">Supply chain math, <span className="bg-gradient-to-r from-[var(--accent-b)] to-[var(--accent-l)] bg-clip-text text-transparent">made obvious.</span></h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted sm:text-xl">Say what you are trying to decide. {BRAND.name} finds the right formula, runs it on your numbers, and gives you the answer first. Built for people who run operations and people who study them.</p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/business" data-mode="business" className="btn btn-primary btn-lg w-full sm:w-auto"><Icon name="briefcase" size={18} />I’m running a business</Link>
            <Link href="/learn" data-mode="learner" className="btn btn-primary btn-lg w-full sm:w-auto"><Icon name="book" size={18} />I’m learning</Link>
          </div>
          <button type="button" onClick={openSearch} className="mx-auto mt-8 flex w-full max-w-xl items-center gap-3 rounded-2xl border border-line-strong bg-surface/80 px-4 py-3.5 text-left text-muted shadow-2xl backdrop-blur transition-colors hover:border-accent-line"><Icon name="search" size={18} /><span className="flex-1 truncate">Try “I keep running out of stock” or “EOQ”</span><kbd className="kbd hidden sm:inline">⌘K</kbd></button>
          <ul className="mt-4 flex flex-wrap justify-center gap-2 text-sm">{[['How much should I order?', 'eoq'], ['How much safety stock do I need?', 'safety-stock-demand'], ['How many staff do I need?', 'mms'], ['Is the bulk discount worth it?', 'quantity-discount']].map(([q, id]) => <li key={id}><Link href={calcHref(mode, id)} className="inline-flex rounded-full border border-line bg-surface/60 px-3 py-1.5 text-muted transition-colors hover:border-accent-line hover:text-fg">{q}</Link></li>)}</ul>
        </div>
      </section>

      <Story mode={mode} />

      <section className="cv-auto border-t border-line" aria-labelledby="modes-h"><div className="wrap py-20 sm:py-28"><div className="mx-auto max-w-2xl text-center"><p className="eyebrow">Two ways in</p><h2 id="modes-h" className="mt-2 text-4xl font-semibold sm:text-5xl">Same math. Your language.</h2><p className="mt-4 text-lg text-muted">Business mode gives you the answer, what it means in dollars, and what to do. Learner mode shows every step in your textbook’s notation. Switch any time.</p></div><div className="mt-10"><ModeChoice compact /></div></div></section>

      <section className="cv-auto border-t border-line bg-surface/40" aria-labelledby="feat-h"><div className="wrap py-20 sm:py-28"><p className="eyebrow">More than calculators</p><h2 id="feat-h" className="mt-2 max-w-2xl text-4xl font-semibold sm:text-5xl">When one answer is not enough.</h2>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{FEATURES.map((f) => (<li key={f.title} data-mode={f.mode}><Link href={f.href} className="card group flex h-full flex-col p-6 transition-all hover:-translate-y-0.5 hover:border-accent-line"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent"><Icon name={f.icon} size={20} /></span><h3 className="mt-5 text-xl font-semibold">{f.title}</h3><p className="mt-2 flex-1 text-muted">{f.body}</p><span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-accent">{f.cta}<Icon name="arrowRight" size={14} className="transition-transform group-hover:translate-x-0.5" /></span></Link></li>))}</ul></div></section>

      <section className="cv-auto border-t border-line" aria-labelledby="ver-h"><div className="wrap grid items-center gap-10 py-20 sm:py-28 lg:grid-cols-2">
        <div><p className="eyebrow">Verified</p><h2 id="ver-h" className="mt-2 text-4xl font-semibold sm:text-5xl">A calculator you cannot trust is worse than none.</h2><p className="mt-4 text-lg text-muted">Every formula has to reproduce textbook examples, agree with a second implementation written separately in Python, and survive a simulation of the real-world claim it makes. The results are public, and regenerated on every test run.</p><Link href="/verified" className="btn btn-lg mt-7"><Icon name="shield" size={16} />See how every calculator was tested</Link></div>
        <dl className="grid grid-cols-2 gap-4">{[[`${S.passed}/${S.calculators}`, 'calculators passing every layer'], [big(S.crossComparisons), 'randomized comparisons against independent code'], [big(S.simulatedTrials), 'simulated trials testing real-world claims'], [String(S.examples), 'textbook-style worked examples reproduced']].map(([v, k]) => (<div key={k} className="card flex flex-col-reverse p-5"><dt className="mt-1 text-sm text-muted">{k}</dt><dd className="num display text-4xl font-semibold text-accent sm:text-5xl">{v}</dd></div>))}</dl>
      </div></section>

      <section className="cv-auto border-t border-line bg-surface/40" aria-labelledby="proof-h"><div className="wrap py-20 sm:py-24"><p className="eyebrow">In their words</p><h2 id="proof-h" className="mt-2 text-3xl font-semibold sm:text-4xl">What people say</h2>
        <ul className="mt-8 grid gap-4 md:grid-cols-3">{SOCIAL_PROOF.map((p) => (<li key={p.name} className={cx('card flex flex-col p-6', p.placeholder && 'border-dashed')}><Icon name="star" size={18} className="text-accent" /><blockquote className={cx('mt-4 flex-1 text-lg leading-relaxed', p.placeholder && 'text-faint')}>{p.placeholder ? p.quote : `“${p.quote}”`}</blockquote><p className="mt-5 text-sm"><span className="font-semibold">{p.name}</span><span className="block text-muted">{p.role}</span></p>{p.placeholder && <span className="badge badge-neutral mt-3 self-start">Placeholder</span>}</li>))}</ul></div></section>

      <section className="cv-auto border-t border-line" aria-labelledby="price-h"><div className="wrap py-20 sm:py-28"><div className="mx-auto max-w-2xl text-center"><p className="eyebrow">Pricing</p><h2 id="price-h" className="mt-2 text-4xl font-semibold sm:text-5xl">Every calculator is free.</h2><p className="mt-4 text-lg text-muted">Pro is for when you need the whole plan, or the whole method.</p></div><div className="mt-10"><PricingCards compact /></div></div></section>

      <section className="relative overflow-hidden border-t border-line"><div className="aurora" aria-hidden /><div className="wrap relative py-24 text-center"><h2 className="mx-auto max-w-3xl text-4xl font-semibold sm:text-6xl">What are you trying to decide?</h2><div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"><Link href="/business/wizard" data-mode="business" className="btn btn-primary btn-lg w-full sm:w-auto">Solve a business problem</Link><Link href="/learn/wizard" data-mode="learner" className="btn btn-primary btn-lg w-full sm:w-auto">Find the right model</Link></div></div></section>
    </div>
  );
}
