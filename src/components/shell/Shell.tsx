'use client';
import { useEffect, useState, type ReactNode } from 'react';
import type { Mode } from '@lotwise/engine';
import { liveStreak, useStore } from '@/lib/store';
import { modeFromPath, swapMode } from '@/lib/routes';
import { track } from '@/lib/analytics';
import { DEMO_MODE, HAS_SUPABASE, BRAND } from '@/platform/env';
import { Link, useNav, usePath } from '@/platform/nav';
import { Icon, Wordmark } from '../icons';
import { Switch, Toaster, cx } from '../ui';
import { CommandBar } from './CommandBar';

const NAV: Record<Mode, { href: string; label: string }[]> = {
  business: [{ href: '/business/wizard', label: 'Solve a problem' }, { href: '/business', label: 'Calculators' }, { href: '/business/plan-builder', label: 'Plan Builder' }, { href: '/map', label: 'Formula Map' }, { href: '/pricing', label: 'Pricing' }],
  learner: [{ href: '/learn', label: 'Chapters' }, { href: '/learn/wizard', label: 'Which model?' }, { href: '/learn/practice', label: 'Practice' }, { href: '/learn/paste', label: 'Paste a problem' }, { href: '/map', label: 'Formula Map' }],
};

export function useAppMode(): Mode { const path = usePath(); const stored = useStore((s) => s.mode); return modeFromPath(path) ?? stored ?? 'business'; }

export function Shell({ children }: { children: ReactNode }) {
  const path = usePath(); const nav = useNav(); const pathMode = modeFromPath(path); const storeMode = useStore((s) => s.mode); const mode: Mode = pathMode ?? storeMode ?? 'business';
  const setMode = useStore((s) => s.setMode); const theme = useStore((s) => s.theme); const setTheme = useStore((s) => s.setTheme); const hydrated = useStore((s) => s.hydrated); const user = useStore((s) => s.user); const plan = useStore((s) => s.plan); const setPlan = useStore((s) => s.setPlan); const streak = useStore((s) => s.streak);
  const [cmd, setCmd] = useState(false); const [menu, setMenu] = useState(false); const [mac, setMac] = useState(true);
  useEffect(() => { useStore.persist.rehydrate(); useStore.setState({ hydrated: true }); setMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)); }, []);
  useEffect(() => { if (!HAS_SUPABASE) return; let off: (() => void) | undefined; let dead = false; import('@/lib/auth').then((m) => m.initAuth()).then((f) => { if (dead) f(); else off = f; }); return () => { dead = true; off?.(); }; }, []);
  useEffect(() => { if (!hydrated) return; document.documentElement.dataset.theme = theme; }, [theme, hydrated]);
  useEffect(() => { if (pathMode) { document.documentElement.dataset.mode = pathMode; if (hydrated && storeMode !== pathMode) setMode(pathMode); } else if (hydrated && storeMode) document.documentElement.dataset.mode = storeMode; }, [pathMode, storeMode, hydrated, setMode]);
  useEffect(() => { const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setCmd((c) => !c); } else if (e.key === '/' && !/input|textarea|select/i.test((e.target as HTMLElement)?.tagName ?? '') && !(e.target as HTMLElement)?.isContentEditable) { e.preventDefault(); setCmd(true); } }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, []);
  useEffect(() => { setMenu(false); track('page', { path }); }, [path]);
  const embed = path.startsWith('/embed/'); if (embed) return <div data-mode={mode}>{children}<Toaster /></div>;
  const bare = path === '/start'; const landing = path === '/'; const links = NAV[mode]; const st = hydrated ? liveStreak(streak) : 0;
  const switchMode = (m: Mode) => { setMode(m); if (pathMode && pathMode !== m) nav.push(swapMode(path, m)); else if (!pathMode && (landing || bare)) nav.push(m === 'learner' ? '/learn' : '/business'); };

  return (
    <div data-mode={pathMode ?? undefined} className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[80] focus:rounded-lg focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-fg">Skip to content</a>
      {DEMO_MODE && hydrated && !bare && (
        <div className="no-print border-b border-line bg-raised text-xs">
          <div className="wrap flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-1.5">
            <span className="flex items-center gap-2 text-muted"><span className="badge badge-neutral">Demo mode</span><span className="hidden sm:inline">Sign-in and payments are simulated. Nothing is charged.</span></span>
            <label className="flex items-center gap-2 text-muted">Pro features<Switch checked={plan.businessPro && plan.learnerPro} onChange={(b) => setPlan({ businessPro: b, learnerPro: b, source: 'demo' })} label="Toggle Pro features in demo mode" /><span className="w-6 font-medium text-fg">{plan.businessPro && plan.learnerPro ? 'On' : 'Off'}</span></label>
          </div>
        </div>)}
      {!bare && (
        <header className="no-print sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur-xl">
          <div className="wrap flex h-14 items-center gap-3">
            <Link href="/" aria-label={`${BRAND.name} home`} className="shrink-0"><Wordmark size={26} /></Link>
            <div role="radiogroup" aria-label="Mode" className="ml-1 hidden rounded-[10px] border border-line bg-sunken p-0.5 sm:inline-flex">
              {(['business', 'learner'] as Mode[]).map((m) => (<button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => switchMode(m)} className={cx('flex items-center gap-1.5 rounded-lg px-3 py-1 text-sm font-medium transition-colors', mode === m ? 'bg-raised shadow-sm ring-1 ring-line-strong' : 'text-muted hover:text-fg')} style={mode === m ? { color: m === 'business' ? 'var(--accent-b)' : 'var(--accent-l)' } : undefined}><Icon name={m === 'business' ? 'briefcase' : 'book'} size={14} />{m === 'business' ? 'Business' : 'Learner'}</button>))}
            </div>
            <nav aria-label="Main" className="ml-2 hidden min-w-0 flex-1 items-center gap-0.5 lg:flex">
              {links.map((l) => (<Link key={l.href} href={l.href} aria-current={path === l.href ? 'page' : undefined} className={cx('rounded-lg px-2.5 py-1.5 text-sm transition-colors', path === l.href ? 'bg-raised text-fg' : 'text-muted hover:text-fg')}>{l.label}</Link>))}
            </nav>
            <div className="ml-auto flex items-center gap-1.5">
              {mode === 'learner' && st > 0 && <Link href="/learn/practice" className="badge hidden sm:inline-flex" title={`${st}-day practice streak`}><Icon name="flame" size={12} />{st}</Link>}
              <button type="button" onClick={() => setCmd(true)} className="flex h-9 items-center gap-2 rounded-[10px] border border-line bg-sunken px-2.5 text-sm text-muted transition-colors hover:border-line-strong hover:text-fg" aria-label="Search calculators" aria-keyshortcuts="Meta+K Control+K"><Icon name="search" size={15} /><span className="hidden md:inline">Search</span><kbd className="kbd hidden md:inline">{mac ? '⌘' : 'Ctrl '}K</kbd></button>
              <button type="button" className="btn btn-ghost btn-sm !px-2" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}><Icon name={hydrated && theme === 'light' ? 'moon' : 'sun'} size={16} /></button>
              <Link href={user ? '/account' : '/login'} className="btn btn-sm hidden sm:inline-flex">{hydrated && user ? <><Icon name="user" size={14} />Account</> : 'Sign in'}</Link>
              <button type="button" className="btn btn-ghost btn-sm !px-2 lg:hidden" aria-label="Menu" aria-expanded={menu} onClick={() => setMenu(!menu)}><Icon name={menu ? 'x' : 'menu'} size={18} /></button>
            </div>
          </div>
          {menu && (
            <div className="border-t border-line bg-bg lg:hidden">
              <div className="wrap space-y-1 py-3">
                <div role="radiogroup" aria-label="Mode" className="mb-2 grid grid-cols-2 gap-1 rounded-[10px] border border-line bg-sunken p-0.5 sm:hidden">
                  {(['business', 'learner'] as Mode[]).map((m) => (<button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => switchMode(m)} className={cx('rounded-lg py-2 text-sm font-medium', mode === m ? 'bg-raised ring-1 ring-line-strong' : 'text-muted')} style={mode === m ? { color: m === 'business' ? 'var(--accent-b)' : 'var(--accent-l)' } : undefined}>{m === 'business' ? 'Business' : 'Learner'}</button>))}
                </div>
                {links.map((l) => <Link key={l.href} href={l.href} className="block rounded-lg px-3 py-2.5 text-muted hover:bg-raised hover:text-fg">{l.label}</Link>)}
                <Link href="/verified" className="block rounded-lg px-3 py-2.5 text-muted hover:bg-raised hover:text-fg">Verified</Link>
                <Link href={user ? '/account' : '/login'} className="block rounded-lg px-3 py-2.5 text-muted hover:bg-raised hover:text-fg">{user ? 'Account' : 'Sign in'}</Link>
              </div>
            </div>)}
        </header>)}
      <main id="main" className="flex-1">{children}</main>
      {!bare && (
        <footer className="no-print border-t border-line">
          <div className="wrap grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div><Wordmark size={24} /><p className="mt-3 max-w-xs text-sm text-muted">{BRAND.tagline} 93 verified calculators for people who run operations and people who study them.</p><Link href="/verified" className="badge badge-good mt-4"><Icon name="shield" size={12} />93 of 93 calculators verified</Link></div>
            {[{ h: 'Product', l: [['/business', 'For business'], ['/learn', 'For learners'], ['/business/plan-builder', 'Plan Builder'], ['/map', 'Formula Map'], ['/embed-builder', 'Embed a calculator'], ['/pricing', 'Pricing']] }, { h: 'Trust', l: [['/verified', 'Verified'], ['/about', 'About'], ['/faq', 'FAQ']] }, { h: 'Legal', l: [['/terms', 'Terms'], ['/privacy', 'Privacy'], ['/disclaimer', 'Disclaimer']] }].map((c) => (<nav key={c.h} aria-label={c.h}><p className="text-xs font-medium uppercase tracking-wider text-faint">{c.h}</p><ul className="mt-3 space-y-2 text-sm">{c.l.map(([href, label]) => <li key={href}><Link href={href} className="text-muted hover:text-fg">{label}</Link></li>)}</ul></nav>))}
          </div>
          <div className="wrap border-t border-line py-5 text-xs text-faint">© {new Date().getFullYear()} {BRAND.name}. Results are for education and decision support and are not professional advice.</div>
        </footer>)}
      <CommandBar open={cmd} onClose={() => setCmd(false)} mode={mode} />
      <Toaster />
    </div>
  );
}
