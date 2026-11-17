'use client';
import { useEffect, useMemo, useState } from 'react';
import { CALCS, byId } from '@lotwise/engine';
import { useStore } from '@/lib/store';
import { localEvents } from '@/lib/analytics';
import { mrr } from '@/lib/plans';
import { DEMO_MODE } from '@/platform/env';
import { Link } from '@/platform/nav';
import { Icon } from '@/components/icons';

interface Stats { source: 'demo' | 'live'; days: number; signups: { day: string; n: number }[]; totals: { signups: number; signups30: number; active7: number; active30: number; bizPro: number; learnPro: number; semester: number; mrr: number }; topCalcs: { id: string; n: number }[]; misses: { q: string; n: number }[]; funnel: { step: string; n: number }[]; modes: { business: number; learner: number } }

/** Sample numbers for demo mode, blended with the real events recorded in this browser so the dashboard reacts to use. */
function demoStats(): Stats {
  let seed = 20261117; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const today = new Date(); const signups = Array.from({ length: 30 }, (_, i) => { const d = new Date(today.getTime() - (29 - i) * 864e5); const wk = d.getDay() === 0 || d.getDay() === 6 ? 0.6 : 1; return { day: d.toISOString().slice(0, 10), n: Math.round((6 + i * 0.55 + rnd() * 9) * wk) }; });
  const ev = localEvents(); const count = (name: string, key: string) => { const m = new Map<string, number>(); ev.filter((e) => e.n === name && e.p?.[key]).forEach((e) => m.set(String(e.p![key]), (m.get(String(e.p![key])) ?? 0) + 1)); return m; };
  const mine = count('calc_view', 'calc'); const base = ['eoq', 'safety-stock-demand', 'reorder-point', 'newsvendor', 'exponential-smoothing', 'inventory-turnover', 'mm1', 'cpm', 'safety-stock-combined', 'takt-time', 'landed-cost', 'process-capability'];
  const top = new Map<string, number>(base.map((id, i) => [id, Math.round(940 * Math.pow(0.82, i) + rnd() * 40)])); mine.forEach((n, id) => { if (byId[id]) top.set(id, (top.get(id) ?? 0) + n); });
  const missSample: [string, number][] = [['safety stock for seasonal items', 14], ['incoterms calculator', 11], ['warehouse slotting', 9], ['carbon footprint per shipment', 7], ['kanban card count', 6], ['vendor managed inventory', 4]];
  const misses = new Map<string, number>(missSample); count('search_miss', 'q').forEach((n, q) => misses.set(q, (misses.get(q) ?? 0) + n));
  const sessions = 8420 + ev.filter((e) => e.n === 'page').length; const subs = { bizPro: 61, learnPro: 143, semester: 212 };
  const totals = { signups: 2317 + (useStore.getState().user ? 1 : 0), signups30: signups.reduce((a, b) => a + b.n, 0), active7: 2960, active30: sessions, ...subs, mrr: mrr(subs) };
  const funnel = [{ step: 'Visited', n: sessions }, { step: 'Used a calculator', n: 6105 + mine.size }, { step: 'Saw an upgrade prompt', n: 1480 + ev.filter((e) => e.n === 'upgrade_view').length }, { step: 'Started checkout', n: 388 + ev.filter((e) => e.n === 'checkout_start').length }, { step: 'Subscribed', n: 127 + ev.filter((e) => e.n === 'subscribe').length }];
  return { source: 'demo', days: 30, signups, totals, topCalcs: [...top].map(([id, n]) => ({ id, n })).sort((a, b) => b.n - a.n).slice(0, 12), misses: [...misses].map(([q, n]) => ({ q, n })).sort((a, b) => b.n - a.n).slice(0, 12), funnel, modes: { business: 5210, learner: 7380 } };
}
const num = (n: number) => n.toLocaleString('en-US');

export function AdminScreen() {
  const hydrated = useStore((s) => s.hydrated); const user = useStore((s) => s.user); const [stats, setStats] = useState<Stats | null>(null); const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!hydrated) return;
    if (DEMO_MODE) { setStats(demoStats()); return; }
    fetch('/api/admin/stats', { cache: 'no-store' }).then(async (r) => { const j = await r.json(); if (!r.ok) setErr(j.error ?? 'Could not load the dashboard.'); else setStats(j); }).catch(() => setErr('Could not reach the server.'));
  }, [hydrated, user]);
  const maxSign = useMemo(() => Math.max(1, ...(stats?.signups ?? []).map((d) => d.n)), [stats]);
  if (err) return (<div className="wrap max-w-xl py-24 text-center"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-raised text-muted"><Icon name="lock" size={20} /></span><h1 className="mt-5 text-3xl font-semibold">Owner dashboard</h1><p className="mt-3 text-muted">{err}</p><Link href="/login?next=/admin" className="btn btn-primary mt-6">Sign in</Link></div>);
  if (!stats) return <div className="wrap py-24 text-center text-muted">Loading the dashboard…</div>;
  const t = stats.totals; const pro = t.bizPro + t.learnPro + t.semester; const f0 = Math.max(1, stats.funnel[0]?.n ?? 1); const topMax = Math.max(1, ...stats.topCalcs.map((c) => c.n)); const modeTotal = Math.max(1, stats.modes.business + stats.modes.learner);
  const kpis = [{ k: 'Signups', v: num(t.signups), d: `+${num(t.signups30)} in the last ${stats.days} days`, icon: 'user' }, { k: 'Active visitors', v: num(t.active7), d: `last 7 days · ${num(t.active30)} in 30`, icon: 'zap' }, { k: 'Pro subscribers', v: num(pro), d: `${t.bizPro} Business · ${t.learnPro} Learner · ${t.semester} semester`, icon: 'sparkles' }, { k: 'Monthly recurring revenue', v: `$${num(t.mrr)}`, d: 'semester passes spread over 5 months', icon: 'chart' }];
  return (
    <div className="wrap pb-24 pt-8 sm:pt-12">
      <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">Owner dashboard</p><h1 className="mt-2 text-4xl font-semibold">How Lotwise is doing</h1></div>
        {stats.source === 'demo' ? <p className="max-w-md text-sm text-muted"><span className="badge badge-neutral mr-2">Demo mode</span>Sample numbers, blended with what you do in this browser. Open a calculator or search for something that does not exist, then come back.</p> : <p className="text-sm text-muted"><span className="badge badge-good mr-2">Live</span>From your own database. No third-party trackers.</p>}</header>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{kpis.map((k) => (<li key={k.k} className="card p-5"><p className="flex items-center justify-between text-sm text-muted">{k.k}<Icon name={k.icon} size={16} className="text-accent" /></p><p className="num display mt-2 text-4xl font-semibold">{k.v}</p><p className="mt-1 text-xs text-faint">{k.d}</p></li>))}</ul>
      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <section className="card p-5 lg:col-span-7" aria-label="Signups per day"><h2 className="text-lg font-semibold">Signups per day</h2><p className="text-sm text-muted">Last {stats.days} days</p>
          <div className="mt-5 flex h-44 items-end gap-[3px]" role="img" aria-label={`Daily signups, from ${stats.signups[0]?.n ?? 0} to ${stats.signups.at(-1)?.n ?? 0}`}>{stats.signups.map((d) => <div key={d.day} title={`${d.day}: ${d.n}`} className="flex-1 rounded-t bg-accent/80 transition-colors hover:bg-accent" style={{ height: `${Math.max(2, (100 * d.n) / maxSign)}%` }} />)}</div>
          <div className="num mt-2 flex justify-between text-xs text-faint"><span>{stats.signups[0]?.day.slice(5)}</span><span>{stats.signups.at(-1)?.day.slice(5)}</span></div></section>
        <section className="card p-5 lg:col-span-5" aria-label="Conversion funnel"><h2 className="text-lg font-semibold">Conversion funnel</h2><p className="text-sm text-muted">Visitors in the last {stats.days} days</p>
          <ol className="mt-4 space-y-3">{stats.funnel.map((s, i) => { const prev = i ? Math.max(1, stats.funnel[i - 1].n) : s.n; return (<li key={s.step}><div className="flex items-baseline justify-between gap-3 text-sm"><span>{s.step}</span><span className="num text-muted">{num(s.n)}{i > 0 && <span className="ml-2 text-xs text-faint">{((100 * s.n) / prev).toFixed(1)}% of previous</span>}</span></div><div className="mt-1.5 h-2 rounded-full bg-raised"><div className="h-2 rounded-full bg-accent" style={{ width: `${Math.max(1.5, (100 * s.n) / f0)}%` }} /></div></li>); })}</ol></section>
        <section className="card p-5 lg:col-span-7" aria-label="Most used calculators"><h2 className="text-lg font-semibold">Most used calculators</h2>
          <ol className="mt-4 space-y-2.5">{stats.topCalcs.map((c) => (<li key={c.id} className="grid grid-cols-[minmax(0,11rem)_1fr_3.5rem] items-center gap-3 text-sm sm:grid-cols-[minmax(0,15rem)_1fr_3.5rem]"><Link href={`/business/${c.id}`} className="truncate hover:text-accent">{byId[c.id]?.name ?? c.id}</Link><div className="h-2 rounded-full bg-raised"><div className="h-2 rounded-full bg-accent/80" style={{ width: `${(100 * c.n) / topMax}%` }} /></div><span className="num text-right text-muted">{num(c.n)}</span></li>))}</ol>
          <p className="mt-4 text-xs text-faint">{CALCS.length} calculators in total.</p></section>
        <div className="space-y-6 lg:col-span-5">
          <section className="card p-5" aria-label="Searches with no match"><h2 className="text-lg font-semibold">Searches with no match</h2><p className="text-sm text-muted">What people looked for and did not find. Your roadmap, ranked.</p>
            {stats.misses.length === 0 ? <p className="mt-4 text-sm text-faint">No missed searches yet.</p> : <ul className="mt-3 divide-y divide-line text-sm">{stats.misses.map((m) => <li key={m.q} className="flex justify-between gap-3 py-2"><span className="truncate">{m.q}</span><span className="num text-muted">{m.n}</span></li>)}</ul>}</section>
          <section className="card p-5" aria-label="Mode split"><h2 className="text-lg font-semibold">Business vs Learner</h2><p className="text-sm text-muted">Share of calculator views</p>
            <div className="mt-4 flex h-3 overflow-hidden rounded-full"><div style={{ width: `${(100 * stats.modes.business) / modeTotal}%`, background: 'var(--accent-b)' }} /><div className="flex-1" style={{ background: 'var(--accent-l)' }} /></div>
            <div className="mt-2 flex justify-between text-sm"><span style={{ color: 'var(--accent-b)' }}>Business {Math.round((100 * stats.modes.business) / modeTotal)}%</span><span style={{ color: 'var(--accent-l)' }}>Learner {Math.round((100 * stats.modes.learner) / modeTotal)}%</span></div></section>
        </div>
      </div>
    </div>
  );
}
