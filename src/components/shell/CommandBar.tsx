'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { byId, catById, isMiss, search, type Mode } from '@lotwise/engine';
import { useStore } from '@/lib/store';
import { calcHref } from '@/lib/routes';
import { track } from '@/lib/analytics';
import { useNav } from '@/platform/nav';
import { Icon } from '../icons';
import { Modal, cx } from '../ui';

interface Item { key: string; title: string; sub: string; icon: string; go: () => void; group: string }
const PAGES: { title: string; sub: string; href: string; icon: string; words: string }[] = [
  { title: 'Plan Builder', sub: 'Upload sales history, get an inventory policy for every SKU', href: '/business/plan-builder', icon: 'layers', words: 'plan builder csv upload sku inventory policy excel' },
  { title: 'Your Supply Chain, Wrapped', sub: 'Shareable story cards from your own data', href: '/business/wrapped', icon: 'sparkles', words: 'wrapped story cards share linkedin' },
  { title: 'Paste Your Problem', sub: 'Paste a homework problem and get it set up and solved', href: '/learn/paste', icon: 'clipboard', words: 'paste problem homework textbook parse' },
  { title: 'Practice and streaks', sub: 'Fresh problems, instant checking, exam review', href: '/learn/practice', icon: 'target', words: 'practice streak exam review quiz problems' },
  { title: 'Formula Map', sub: 'See how every calculator connects', href: '/map', icon: 'network', words: 'formula map graph 3d network connections' },
  { title: 'Problem wizard (Business)', sub: 'Start from a problem in plain language', href: '/business/wizard', icon: 'wand', words: 'wizard guide help me choose problem' },
  { title: 'Diagnostic wizard (Learner)', sub: 'Find the right model for a homework problem', href: '/learn/wizard', icon: 'wand', words: 'wizard diagnostic which model homework' },
  { title: 'Verified', sub: 'Test results for every calculator', href: '/verified', icon: 'shield', words: 'verified tests accuracy proof simulation' },
  { title: 'Pricing', sub: 'Free calculators, Pro for more', href: '/pricing', icon: 'star', words: 'pricing pro upgrade plans cost subscribe' },
  { title: 'Embed a calculator', sub: 'Put any calculator on your own site', href: '/embed-builder', icon: 'code', words: 'embed widget iframe snippet' },
  { title: 'Formula sheets', sub: 'One printable page per chapter', href: '/learn#sheets', icon: 'file', words: 'formula sheet cheat sheet pdf print' },
  { title: 'Account', sub: 'Sign in, plan, saved scenarios', href: '/account', icon: 'user', words: 'account sign in login profile' },
];

export function CommandBar({ open, onClose, mode }: { open: boolean; onClose: () => void; mode: Mode }) {
  const [q, setQ] = useState(''); const [sel, setSel] = useState(0); const nav = useNav(); const list = useRef<HTMLUListElement>(null);
  const recent = useStore((s) => s.recent); const setMode = useStore((s) => s.setMode); const theme = useStore((s) => s.theme); const setTheme = useStore((s) => s.setTheme);
  useEffect(() => { if (open) { setQ(''); setSel(0); } }, [open]);
  const go = (href: string) => { onClose(); nav.push(href); };
  const { items, miss } = useMemo(() => {
    const out: Item[] = []; const t = q.trim().toLowerCase();
    const calcItem = (id: string, group: string, matched?: string): Item => { const c = byId[id]; return { key: 'c-' + id, group, icon: catById[c.cat]?.icon ?? 'chart', title: mode === 'business' ? c.bq : c.name, sub: mode === 'business' ? c.name : matched && matched !== c.name && matched !== c.short ? `${catById[c.cat].name} · matches “${matched}”` : `${catById[c.cat].name} · ${c.blurb}`, go: () => go(calcHref(mode, id)) }; };
    if (!t) {
      recent.filter((id) => byId[id]).slice(0, 4).forEach((id) => out.push(calcItem(id, 'Recent')));
      (mode === 'business' ? ['eoq', 'safety-stock-demand', 'mms', 'total-cost-of-ownership', 'center-of-gravity', 'exponential-smoothing'] : ['eoq', 'safety-stock-combined', 'newsvendor', 'mm1', 'cpm', 'process-capability']).filter((id) => !recent.slice(0, 4).includes(id)).forEach((id) => out.push(calcItem(id, 'Popular')));
      PAGES.slice(0, 5).forEach((p) => out.push({ key: 'p-' + p.href, group: 'Go to', icon: p.icon, title: p.title, sub: p.sub, go: () => go(p.href) }));
      return { items: out, miss: false };
    }
    const hits = search(q, { limit: 8, mode }); hits.forEach((h) => out.push(calcItem(h.id, 'Calculators', h.matched)));
    PAGES.filter((p) => (p.title + ' ' + p.words).toLowerCase().includes(t) || t.split(/\s+/).every((w) => p.words.includes(w))).slice(0, 4).forEach((p) => out.push({ key: 'p-' + p.href, group: 'Go to', icon: p.icon, title: p.title, sub: p.sub, go: () => go(p.href) }));
    if ('business mode owner manager'.includes(t) || t.includes('business')) out.push({ key: 'a-biz', group: 'Actions', icon: 'briefcase', title: 'Switch to Business mode', sub: 'Plain-language answers and what to do next', go: () => { setMode('business'); go('/business'); } });
    if ('learner mode student learn study'.includes(t) || t.includes('learn')) out.push({ key: 'a-learn', group: 'Actions', icon: 'book', title: 'Switch to Learner mode', sub: 'Step-by-step solutions and practice', go: () => { setMode('learner'); go('/learn'); } });
    if ('theme dark light mode appearance'.includes(t) || t.includes('theme') || t.includes('dark') || t.includes('light')) out.push({ key: 'a-theme', group: 'Actions', icon: theme === 'dark' ? 'sun' : 'moon', title: `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`, sub: 'Change the appearance', go: () => { setTheme(theme === 'dark' ? 'light' : 'dark'); onClose(); } });
    return { items: out, miss: isMiss(hits) && out.length <= hits.length };
  }, [q, mode, recent, theme]); // eslint-disable-line
  useEffect(() => { setSel(0); }, [q]);
  useEffect(() => { if (!open || q.trim().length < 3) return; const t = setTimeout(() => track(miss ? 'search_miss' : 'search', { q: q.trim().toLowerCase().slice(0, 60) }), 900); return () => clearTimeout(t); }, [q, miss, open]);
  useEffect(() => { list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }); }, [sel]);
  const onKey = (e: React.KeyboardEvent) => { if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(items.length - 1, s + 1)); } else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); } else if (e.key === 'Enter') { e.preventDefault(); items[sel]?.go(); } };
  let lastGroup = '';
  return (
    <Modal open={open} onClose={onClose} title="Search calculators" wide>
      <div className="flex items-center gap-3 border-b border-line px-4">
        <Icon name="search" className="shrink-0 text-faint" />
        <input data-autofocus role="combobox" aria-expanded="true" aria-controls="cmd-list" aria-activedescendant={items[sel] ? 'cmd-' + items[sel].key : undefined} aria-label="Search by name, symptom, or symbol" className="h-14 w-full bg-transparent text-base outline-none placeholder:text-faint" placeholder={mode === 'business' ? 'Try “running out of stock” or “how many cashiers”' : 'Try “EOQ”, “sigma”, or “critical path”'} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} autoComplete="off" spellCheck={false} />
        <kbd className="kbd shrink-0">esc</kbd>
      </div>
      <ul ref={list} id="cmd-list" role="listbox" aria-label="Results" className="max-h-[52vh] overflow-y-auto p-2">
        {items.length === 0 && <li className="px-3 py-8 text-center text-sm text-muted">Nothing matches “{q}” yet. We log searches like this to decide which calculator to build next.</li>}
        {items.map((it, i) => { const head = it.group !== lastGroup; lastGroup = it.group; return (
          <li key={it.key} role="presentation">
            {head && <div className="px-3 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wider text-faint">{it.group}</div>}
            <div id={'cmd-' + it.key} role="option" aria-selected={i === sel} onMouseMove={() => setSel(i)} onClick={it.go} className={cx('flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5', i === sel && 'bg-accent-soft')}>
              <span className={cx('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border', i === sel ? 'border-accent-line text-accent' : 'border-line text-muted')}><Icon name={it.icon} size={16} /></span>
              <span className="min-w-0 flex-1"><span className="block truncate font-medium">{it.title}</span><span className="block truncate text-xs text-muted">{it.sub}</span></span>
              {i === sel && <Icon name="arrowRight" size={15} className="shrink-0 text-accent" />}
            </div>
          </li>); })}
      </ul>
      <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5 text-xs text-faint"><span className="flex items-center gap-1.5"><kbd className="kbd">↑</kbd><kbd className="kbd">↓</kbd> move <kbd className="kbd ml-2">↵</kbd> open</span><span>Searches names, symptoms, and symbols</span></div>
    </Modal>
  );
}
