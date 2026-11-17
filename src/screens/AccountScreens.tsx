'use client';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { CALCS, NOTATIONS, byId, type Mode, type NotationId } from '@lotwise/engine';
import { liveStreak, useStore } from '@/lib/store';
import { PLANS, dollars, isPlanId, type PlanId } from '@/lib/plans';
import { demoActivate, demoSignIn, googleSignIn, openPortal, refreshAccount, sendMagicLink, signOutAll, startCheckout } from '@/lib/auth';
import { calcHref } from '@/lib/routes';
import { encodeValues } from '@/lib/share';
import { DEMO_MODE, BRAND } from '@/platform/env';
import { Link, useNav, useQuery } from '@/platform/nav';
import { Icon, Wordmark } from '@/components/icons';
import { Confetti, Segmented, toast, cx } from '@/components/ui';
import { usePro } from '@/components/calc/Pro';

const FREE = ['All 93 calculators, in both modes', 'Answers, live charts, and worked examples', 'Guided wizards and instant search', 'Share links that restore your exact inputs', 'The Formula Map', 'Embeds for your own site'];
const BIZ = ['Plan Builder: upload sales history, get a policy for every SKU', 'Excel export where every number is a live formula', 'What-if sliders on every calculator', 'Save and compare scenarios', 'One-page PDF summaries to send to your team', 'Your Supply Chain, Wrapped'];
const LEARN = ['Every step, with each number substituted and explained', 'Table lookups shown (z and unit normal loss)', 'Unlimited practice problems with worked solutions', 'Exam Review that resurfaces what you missed', 'Paste Your Problem: paste homework, get the setup', 'Printable formula sheet for every chapter'];
const Check = ({ children }: { children: ReactNode }) => <li className="flex gap-2.5"><Icon name="check" size={16} className="mt-0.5 shrink-0 text-accent" /><span>{children}</span></li>;

export function PricingCards({ compact }: { compact?: boolean }) {
  const nav = useNav(); const bizPro = usePro('business'); const learnPro = usePro('learner'); const hydrated = useStore((s) => s.hydrated); const source = useStore((s) => s.plan.source);
  const [term, setTerm] = useState<'learner_semester' | 'learner_monthly'>('learner_semester'); const [busy, setBusy] = useState<PlanId | null>(null);
  const buy = async (id: PlanId) => { setBusy(id); const err = await startCheckout(id, nav.push); setBusy(null); if (err) toast(err); };
  // In demo mode Pro starts unlocked so everything can be explored; the buttons still walk through the checkout.
  const has = (pro: boolean) => hydrated && pro && source !== 'demo'; const lp = PLANS[term];
  return (
    <div className={cx('grid gap-5 lg:grid-cols-3', compact ? '' : 'mt-10')}>
      <section className="card flex flex-col p-6" aria-label="Free plan">
        <h3 className="text-xl font-semibold">Free</h3><p className="mt-1 text-sm text-muted">For everyone, forever.</p>
        <p className="mt-5"><span className="display text-5xl font-semibold">$0</span></p>
        <ul className="mt-6 flex-1 space-y-2.5 text-sm">{FREE.map((f) => <Check key={f}>{f}</Check>)}</ul>
        <Link href="/start" className="btn btn-lg mt-7 w-full">Start calculating</Link>
      </section>
      <section id="business" data-mode="business" className="card glow relative flex scroll-mt-24 flex-col border-accent-line p-6" aria-label="Business Pro plan">
        <h3 className="flex items-center gap-2 text-xl font-semibold"><Icon name="briefcase" size={18} className="text-accent" />Business Pro</h3><p className="mt-1 text-sm text-muted">Turn the math into a plan you can act on.</p>
        <p className="mt-5 flex items-baseline gap-1.5"><span className="display text-5xl font-semibold">{dollars(PLANS.business_monthly.cents)}</span><span className="text-muted">per month</span></p>
        <p className="mt-2 text-xs text-faint">Everything in Free, plus:</p>
        <ul className="mt-3 flex-1 space-y-2.5 text-sm">{BIZ.map((f) => <Check key={f}>{f}</Check>)}</ul>
        {has(bizPro) ? <Link href="/account" className="btn btn-lg mt-7 w-full"><Icon name="check" size={16} />You have Business Pro</Link> : <button type="button" className="btn btn-primary btn-lg mt-7 w-full" disabled={busy !== null} onClick={() => buy('business_monthly')}>{busy === 'business_monthly' ? 'Opening checkout…' : 'Get Business Pro'}</button>}
        <p className="mt-2 text-center text-xs text-faint">Cancel any time.</p>
      </section>
      <section id="learner" data-mode="learner" className="card glow relative flex scroll-mt-24 flex-col border-accent-line p-6" aria-label="Learner Pro plan">
        <h3 className="flex items-center gap-2 text-xl font-semibold"><Icon name="book" size={18} className="text-accent" />Learner Pro</h3><p className="mt-1 text-sm text-muted">Understand the method and walk into the exam ready.</p>
        <p className="mt-5 flex items-baseline gap-1.5"><span className="display text-5xl font-semibold">{dollars(lp.cents)}</span><span className="text-muted">{term === 'learner_semester' ? 'for the semester' : 'per month'}</span></p>
        <div className="mt-3"><Segmented label="Billing" size="sm" value={term} onChange={setTerm} options={[{ value: 'learner_semester', label: 'Semester pass' }, { value: 'learner_monthly', label: 'Monthly' }]} /></div>
        <p className="mt-2 text-xs text-faint">{term === 'learner_semester' ? 'One payment, 5 months, no renewal. Works out to $3 a month.' : 'Everything in Free, plus:'}</p>
        <ul className="mt-3 flex-1 space-y-2.5 text-sm">{LEARN.map((f) => <Check key={f}>{f}</Check>)}</ul>
        {has(learnPro) ? <Link href="/account" className="btn btn-lg mt-7 w-full"><Icon name="check" size={16} />You have Learner Pro</Link> : <button type="button" className="btn btn-primary btn-lg mt-7 w-full" disabled={busy !== null} onClick={() => buy(term)}>{busy === term ? 'Opening checkout…' : term === 'learner_semester' ? 'Get the semester pass' : 'Get Learner Pro'}</button>}
        <p className="mt-2 text-center text-xs text-faint">{term === 'learner_semester' ? 'Ends on its own. Nothing to cancel.' : 'Cancel any time.'}</p>
      </section>
    </div>
  );
}

const PRICING_FAQ = [
  { q: 'Is every calculator really free?', a: 'Yes. All 93 calculators give you the answer, the chart, and a share link without an account. Pro adds depth: the full worked solution and practice for learners, and planning tools and exports for businesses.' },
  { q: 'What is the semester pass?', a: 'A single $15 payment that unlocks Learner Pro for 5 months, enough for a full term including finals. It does not renew, so there is nothing to remember to cancel.' },
  { q: 'Can I have both Business Pro and Learner Pro?', a: 'Yes. They are separate, and you can hold either or both on one account. Most people only need the one that matches how they use Lotwise.' },
  { q: 'How do I cancel?', a: 'Open Account, choose Manage billing, and cancel in two clicks. You keep Pro until the end of the period you paid for.' },
  { q: 'Do you offer refunds?', a: 'If Pro is not what you expected, write to us within 7 days of your first payment and we will refund it.' },
  { q: 'Do you offer team or classroom pricing?', a: 'Not yet as a self-serve plan. If you teach a course or run a team, get in touch and we will set something up.' },
];
export function PricingScreen() {
  const q = useQuery();
  useEffect(() => { if (q?.get('canceled')) toast('Checkout canceled. Nothing was charged.'); }, [q]);
  return (
    <div className="wrap pb-24 pt-8 sm:pt-14">
      <header className="mx-auto max-w-3xl text-center"><p className="eyebrow">Pricing</p><h1 className="mt-2 text-4xl font-semibold sm:text-6xl">Every calculator is free.</h1><p className="mt-4 text-lg text-muted">Pro is for when the answer is not enough: when you need the whole plan, or the whole method.</p>{DEMO_MODE && <p className="mt-4 inline-flex items-center gap-2 text-sm text-faint"><span className="badge badge-neutral">Demo mode</span>Checkout is simulated. No card is needed and nothing is charged.</p>}</header>
      <h2 className="sr-only">Plans</h2>
      <PricingCards />
      <section className="mx-auto mt-16 max-w-3xl" aria-label="Pricing questions"><h2 className="text-2xl font-semibold">Questions about pricing</h2><dl className="mt-4 divide-y divide-line">{PRICING_FAQ.map((f) => <div key={f.q} className="py-4"><dt className="font-medium">{f.q}</dt><dd className="mt-1.5 text-muted">{f.a}</dd></div>)}</dl></section>
    </div>
  );
}

export function LoginScreen() {
  const nav = useNav(); const q = useQuery(); const user = useStore((s) => s.user); const hydrated = useStore((s) => s.hydrated);
  const [email, setEmail] = useState(''); const [step, setStep] = useState<'form' | 'sent'>('form'); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const nextRaw = q?.get('next') ?? '/account'; const next = nextRaw.startsWith('/') && !nextRaw.startsWith('//') ? nextRaw : '/account';
  useEffect(() => { if (q?.get('error')) setErr('That sign-in link has expired or was already used. Request a new one.'); }, [q]);
  useEffect(() => { if (hydrated && user && step === 'form') nav.replace(next); }, [hydrated, user, step, nav, next]);
  const submit = async (e: FormEvent) => { e.preventDefault(); setErr(null); if (!/^\S+@\S+\.\S+$/.test(email)) { setErr('Enter a valid email address.'); return; } setBusy(true); if (!DEMO_MODE) { const m = await sendMagicLink(email, next); if (m) { setErr(m); setBusy(false); return; } } setBusy(false); setStep('sent'); };
  const google = async () => { setErr(null); if (DEMO_MODE) { demoSignIn('demo.user@example.com'); toast('Signed in (demo)'); nav.push(next); return; } const m = await googleSignIn(next); if (m) setErr(m); };
  return (
    <div className="relative overflow-hidden"><div className="aurora" aria-hidden />
      <div className="wrap relative flex min-h-[70dvh] items-center justify-center py-14">
        <div className="card w-full max-w-md p-6 sm:p-8">
          <Wordmark size={30} />
          {step === 'form' ? (<>
            <h1 className="mt-6 text-3xl font-semibold">Sign in or create an account</h1>
            <p className="mt-2 text-muted">No password. We email you a link and you are in. An account saves your scenarios, streak, and settings across devices.</p>
            <button type="button" className="btn btn-lg mt-6 w-full" onClick={google}><svg width="18" height="18" viewBox="0 0 48 48" aria-hidden><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.4-.4-3.5z" /><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" /><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" /></svg>Continue with Google</button>
            <div className="my-5 flex items-center gap-3 text-xs text-faint"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
            <form onSubmit={submit} noValidate><label className="label block" htmlFor="login-email">Email</label><input id="login-email" type="email" autoComplete="email" inputMode="email" className="input" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!err} aria-describedby={err ? 'login-err' : undefined} />
              {err && <p id="login-err" role="alert" className="mt-2 text-sm text-bad">{err}</p>}
              <button type="submit" className="btn btn-primary btn-lg mt-4 w-full" disabled={busy}>{busy ? 'Sending…' : 'Email me a sign-in link'}</button></form>
            <p className="mt-5 text-xs text-faint">By continuing you agree to the <Link href="/terms" className="link">Terms</Link> and <Link href="/privacy" className="link">Privacy Policy</Link>.</p>
          </>) : (<>
            <span className="mt-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent"><Icon name="check" size={22} /></span>
            <h1 className="mt-4 text-3xl font-semibold">Check your inbox</h1>
            <p className="mt-2 text-muted">We sent a sign-in link to <b className="text-fg">{email}</b>. It works once and expires in an hour.</p>
            {DEMO_MODE ? (<div className="mt-5 rounded-xl border border-line bg-raised p-4 text-sm"><p className="text-muted"><span className="badge badge-neutral mr-2">Demo mode</span>No email is actually sent. Use the button to finish signing in.</p><button type="button" className="btn btn-primary mt-3 w-full" onClick={() => { demoSignIn(email); toast('Signed in (demo)'); nav.push(next); }}>Open the magic link</button></div>)
              : <button type="button" className="btn mt-5 w-full" onClick={() => setStep('form')}>Use a different email</button>}
          </>)}
        </div>
      </div>
    </div>
  );
}

export function CheckoutScreen() {
  const nav = useNav(); const q = useQuery(); const planId = q?.get('plan'); const status = q?.get('status'); const plan = isPlanId(planId) ? PLANS[planId] : null;
  const [done, setDone] = useState(false); const [busy, setBusy] = useState(false); const [fire, setFire] = useState(0); const pro = usePro(plan?.mode ?? 'business'); const [waited, setWaited] = useState(0);
  // Live mode: Stripe sends the customer back here. The webhook may land a moment later, so poll briefly.
  useEffect(() => { if (DEMO_MODE || status !== 'success') return; setDone(true); setFire((f) => f + 1); let n = 0; const id = setInterval(async () => { n++; await refreshAccount(); setWaited(n); if (n >= 8) clearInterval(id); }, 1500); return () => clearInterval(id); }, [status]);
  if (!q) return <div className="wrap py-24" />;
  if (!plan) return (<div className="wrap max-w-xl py-24 text-center"><h1 className="text-3xl font-semibold">Nothing to check out</h1><p className="mt-3 text-muted">Pick a plan on the pricing page to get started.</p><Link href="/pricing" className="btn btn-primary mt-6">See pricing</Link></div>);
  const biz = plan.mode === 'business';
  const pay = async () => { setBusy(true); await new Promise((r) => setTimeout(r, 900)); demoActivate(plan.id); setBusy(false); setDone(true); setFire((f) => f + 1); };
  if (done) return (
    <div data-mode={plan.mode} className="wrap max-w-xl py-20 text-center"><Confetti fire={fire} />
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-accent text-accent-fg"><Icon name="sparkles" size={28} /></span>
      <h1 className="mt-6 text-4xl font-semibold">{biz ? 'Business Pro is on.' : 'Learner Pro is on.'}</h1>
      <p className="mt-3 text-lg text-muted">{biz ? 'Your planning tools, exports, and what-if sliders are unlocked.' : plan.kind === 'payment' ? 'You are set for the semester: every step, unlimited practice, and Exam Review.' : 'Every step, unlimited practice, and Exam Review are unlocked.'}</p>
      {!DEMO_MODE && !pro && <p className="mt-3 text-sm text-faint">{waited < 8 ? 'Confirming your payment…' : 'Your payment went through but is still being confirmed. Refresh in a minute, and write to us if Pro has not appeared.'}</p>}
      <div className="mt-8 flex flex-wrap justify-center gap-3">{biz ? (<><Link href="/business/plan-builder" className="btn btn-primary btn-lg">Open the Plan Builder</Link><Link href="/business" className="btn btn-lg">Browse calculators</Link></>) : (<><Link href="/learn/practice" className="btn btn-primary btn-lg">Start practicing</Link><Link href="/learn/paste" className="btn btn-lg">Paste a problem</Link></>)}</div>
    </div>);
  if (!DEMO_MODE) return (<div className="wrap max-w-xl py-24 text-center"><h1 className="text-3xl font-semibold">Redirecting to secure checkout</h1><p className="mt-3 text-muted">If nothing happens, start again from the pricing page.</p><button type="button" className="btn btn-primary mt-6" onClick={async () => { const e = await startCheckout(plan.id, nav.push); if (e) toast(e); }}>Continue to checkout</button></div>);
  return (
    <div data-mode={plan.mode} className="wrap max-w-4xl pb-24 pt-8 sm:pt-14">
      <Link href="/pricing" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg"><Icon name="arrowLeft" size={14} />Back to pricing</Link>
      <div className="mt-5 grid gap-6 md:grid-cols-5">
        <section className="card p-6 md:col-span-2" aria-label="Order summary"><p className="eyebrow">Order summary</p><h1 className="mt-2 text-2xl font-semibold">{plan.name}</h1><p className="mt-1 text-sm text-muted">{plan.blurb}</p>
          <dl className="mt-6 space-y-2 border-t border-line pt-4 text-sm"><div className="flex justify-between"><dt className="text-muted">{plan.name}</dt><dd className="num">{dollars(plan.cents)}.00</dd></div><div className="flex justify-between"><dt className="text-muted">Tax</dt><dd className="num">$0.00</dd></div><div className="flex justify-between border-t border-line pt-3 text-base font-semibold"><dt>Due today</dt><dd className="num">{dollars(plan.cents)}.00</dd></div></dl>
          <p className="mt-4 text-xs text-faint">{plan.kind === 'subscription' ? `Then ${dollars(plan.cents)} each month until you cancel.` : 'One payment. Access ends after 5 months with no renewal.'}</p></section>
        <section className="card p-6 md:col-span-3" aria-label="Payment">
          <div className="rounded-xl border border-line bg-raised p-3 text-sm text-muted"><span className="badge badge-neutral mr-2">Demo mode</span>This is a simulated checkout. On the live site this step is Stripe’s secure payment page.</div>
          <div className="mt-5 space-y-4"><div><label className="label block" htmlFor="co-card">Card number</label><input id="co-card" className="input num" value="4242 4242 4242 4242" readOnly aria-readonly /></div>
            <div className="grid grid-cols-2 gap-4"><div><label className="label block" htmlFor="co-exp">Expires</label><input id="co-exp" className="input num" value="12 / 34" readOnly aria-readonly /></div><div><label className="label block" htmlFor="co-cvc">CVC</label><input id="co-cvc" className="input num" value="123" readOnly aria-readonly /></div></div></div>
          <button type="button" className="btn btn-primary btn-lg mt-6 w-full" disabled={busy} onClick={pay}>{busy ? 'Processing…' : `Pay ${dollars(plan.cents)} (simulated)`}</button>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-faint"><Icon name="lock" size={12} />Nothing is charged in demo mode.</p></section>
      </div>
    </div>
  );
}

export function AccountScreen() {
  const nav = useNav(); const s = useStore(); const bizPro = usePro('business'); const learnPro = usePro('learner'); const [busy, setBusy] = useState(false);
  if (!s.hydrated) return <div className="wrap py-24" />;
  if (!s.user) return (<div className="wrap max-w-xl py-24 text-center"><h1 className="text-3xl font-semibold">You are not signed in</h1><p className="mt-3 text-muted">Sign in to see your plan, saved scenarios, and practice history.</p><Link href="/login" className="btn btn-primary btn-lg mt-6">Sign in</Link></div>);
  const billing = async () => { if (DEMO_MODE) { s.setPlan({ businessPro: false, learnerPro: false, learnerUntil: null, source: 'none' }); toast('Demo: Pro turned off. Use the banner switch to turn it back on.'); return; } setBusy(true); const e = await openPortal(); setBusy(false); if (e) toast(e); };
  const practiced = Object.entries(s.practice); const attempts = practiced.reduce((a, [, v]) => a + v.attempts, 0); const correct = practiced.reduce((a, [, v]) => a + v.correct, 0);
  const planRow = (mode: Mode, on: boolean) => (<div data-mode={mode} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-raised p-4"><div><p className="flex items-center gap-2 font-semibold"><Icon name={mode === 'business' ? 'briefcase' : 'book'} size={16} className="text-accent" />{mode === 'business' ? 'Business Pro' : 'Learner Pro'}{on ? <span className="badge badge-good">Active</span> : <span className="badge badge-neutral">Not active</span>}</p><p className="mt-1 text-sm text-muted">{on ? (mode === 'learner' && s.plan.learnerUntil ? `Semester pass, through ${new Date(s.plan.learnerUntil).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.` : s.plan.source === 'demo' ? 'Unlocked for the demo.' : 'Renews monthly.') : mode === 'business' ? 'Plan Builder, exports, what-if sliders, scenarios.' : 'Full solutions, unlimited practice, Exam Review.'}</p></div>{!on && <Link href={`/pricing#${mode}`} className="btn btn-primary btn-sm">Upgrade</Link>}</div>);
  return (
    <div className="wrap max-w-4xl pb-24 pt-8 sm:pt-14">
      <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">Account</p><h1 className="mt-2 text-4xl font-semibold">Hi, {s.user.name}</h1><p className="mt-1 text-muted">{s.user.email}{s.user.demo && <span className="badge badge-neutral ml-2">Demo account</span>}</p></div>
        <div className="flex gap-2">{s.user.admin && <Link href="/admin" className="btn btn-sm"><Icon name="chart" size={14} />Owner dashboard</Link>}<button type="button" className="btn btn-sm" onClick={async () => { await signOutAll(); toast('Signed out'); nav.push('/'); }}><Icon name="logout" size={14} />Sign out</button></div></header>
      <section className="card mt-8 p-5 sm:p-6" aria-label="Plan"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">Your plan</h2>{(bizPro || learnPro) && <button type="button" className="btn btn-sm" disabled={busy} onClick={billing}>{busy ? 'Opening…' : DEMO_MODE ? 'Cancel Pro (demo)' : 'Manage billing'}</button>}</div><div className="mt-4 space-y-3">{planRow('business', bizPro)}{planRow('learner', learnPro)}</div></section>
      <section className="card mt-6 p-5 sm:p-6" aria-label="Preferences"><h2 className="text-xl font-semibold">Preferences</h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-3">
          <div><span className="label block">Default mode</span><Segmented label="Default mode" size="sm" value={s.mode ?? 'business'} onChange={(m) => s.setMode(m as Mode)} options={[{ value: 'business', label: 'Business' }, { value: 'learner', label: 'Learner' }]} /></div>
          <div><span className="label block">Theme</span><Segmented label="Theme" size="sm" value={s.theme} onChange={(t) => s.setTheme(t as 'dark' | 'light')} options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }]} /></div>
          <div><label className="label block" htmlFor="acc-nota">Textbook notation</label><select id="acc-nota" className="input h-9 text-sm" value={s.notation} onChange={(e) => s.setNotation(e.target.value as NotationId)}>{NOTATIONS.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}</select></div>
        </div></section>
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <section className="card p-5 sm:p-6" aria-label="Saved scenarios"><h2 className="text-xl font-semibold">Saved scenarios</h2>
          {s.scenarios.length === 0 ? <p className="mt-3 text-sm text-muted">Nothing saved yet. On any Business calculator, use “Save scenario” to keep a set of inputs and compare it later.</p>
            : <ul className="mt-3 divide-y divide-line">{s.scenarios.slice(0, 12).map((sc) => { const def = byId[sc.calcId]; if (!def) return null; return (<li key={sc.id} className="flex items-center justify-between gap-3 py-2.5"><Link href={`${calcHref('business', sc.calcId)}?v=${encodeValues(def, sc.values)}`} className="min-w-0"><span className="block truncate font-medium hover:text-accent">{sc.name}</span><span className="block truncate text-xs text-faint">{def.name}</span></Link><button type="button" className="btn btn-ghost btn-sm !px-2" aria-label={`Delete ${sc.name}`} onClick={() => s.removeScenario(sc.id)}><Icon name="trash" size={14} /></button></li>); })}</ul>}</section>
        <section className="card p-5 sm:p-6" aria-label="Practice"><h2 className="text-xl font-semibold">Practice</h2>
          <dl className="mt-3 grid grid-cols-3 gap-3 text-center">{[['Streak', `${liveStreak(s.streak)} d`], ['Accuracy', attempts ? `${Math.round((100 * correct) / attempts)}%` : 'n/a'], ['XP', String(s.xp)]].map(([k, v]) => <div key={k} className="rounded-xl border border-line bg-raised p-3"><dt className="text-xs text-faint">{k}</dt><dd className="num mt-1 text-xl font-semibold">{v}</dd></div>)}</dl>
          <p className="mt-3 text-sm text-muted">{attempts ? `${attempts} problems attempted across ${practiced.length} of ${CALCS.length} calculators. Best streak: ${s.streak.best} days.` : 'No practice yet. Ten minutes a day beats a long night before the exam.'}</p><Link href="/learn/practice" className="btn btn-sm mt-3">Go to practice</Link></section>
      </div>
      <p className="mt-8 text-xs text-faint">{BRAND.name} stores your settings and saved work so they follow you between devices. See the <Link href="/privacy" className="link">Privacy Policy</Link>.</p>
    </div>
  );
}
