'use client';
// Navigation adapter for the standalone demo bundle. Same exports as nav.tsx, but routes live in the URL hash
// as a plain name (/business/eoq becomes #business--eoq) because the demo host only passes simple hashes through.
// Query strings and in-page anchors are kept in memory.
import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from 'react';
import { matchRoute } from '@/lib/routes';
import { SITE_URL } from './env';

interface Loc { path: string; query: URLSearchParams; anchor: string }
const toName = (path: string) => (path === '/' ? '' : path.replace(/^\//, '').replace(/\//g, '--'));
const fromName = (name: string) => (name ? '/' + name.replace(/--/g, '/') : '/');
function parse(href: string): Loc { const [rest, anchor = ''] = href.split('#'); const [path, qs = ''] = rest.split('?'); return { path: path || '/', query: new URLSearchParams(qs), anchor }; }
const readHash = () => { try { return decodeURIComponent(window.location.hash.replace(/^#/, '')); } catch { return ''; } };

let loc: Loc = typeof window === 'undefined' ? { path: '/', query: new URLSearchParams(), anchor: '' } : { path: fromName(readHash()), query: new URLSearchParams(), anchor: '' };
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
function settle() {
  // After the new screen renders: jump to the anchor (opening it if it is a collapsed section) or to the top.
  const { anchor } = loc;
  const go = (tries: number) => { const el = anchor ? document.getElementById(anchor) : null; if (anchor && !el && tries > 0) { setTimeout(() => go(tries - 1), 60); return; } if (el) { if (el instanceof HTMLDetailsElement) el.open = true; el.scrollIntoView({ block: 'start' }); } else window.scrollTo(0, 0); };
  setTimeout(() => go(8), 30);
}
function navigate(href: string, replace = false) {
  const next = parse(href); const samePath = next.path === loc.path; loc = next; const name = toName(next.path);
  if (readHash() !== name) { try { if (replace) window.location.replace('#' + name); else window.location.hash = name; } catch { /* hash unavailable: the in-memory route still works */ } }
  emit(); if (!samePath || next.anchor) settle();
}
if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    const name = readHash(); const path = fromName(name); if (path === loc.path) return;
    // A hash that is not a route (for example the skip link's #main) is an in-page anchor: scroll to it and stay put.
    if (!matchRoute(path) && document.getElementById(name)) { const el = document.getElementById(name)!; el.scrollIntoView(); (el as HTMLElement).focus?.(); try { history.replaceState(null, '', '#' + toName(loc.path)); } catch { /* ignore */ } return; }
    loc = { path, query: new URLSearchParams(), anchor: '' }; emit(); settle();
  });
}
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { href: string; children?: ReactNode; prefetch?: boolean };
export function Link({ href, children, prefetch: _p, onClick, ...rest }: LinkProps) {
  if (/^(https?:|mailto:)/.test(href)) return <a href={href} target="_blank" rel="noopener" {...rest}>{children}</a>;
  const click = (e: MouseEvent<HTMLAnchorElement>) => { onClick?.(e); if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); navigate(href.startsWith('#') ? loc.path + href : href); };
  return <a href={'#' + toName(parse(href.startsWith('#') ? loc.path : href).path)} onClick={click} {...rest}>{children}</a>;
}
export function useNav() { return { push: (href: string) => navigate(href), replace: (href: string) => navigate(href, true), back: () => window.history.back() }; }
export function usePath(): string { return useSyncExternalStore(subscribe, () => loc.path, () => '/'); }
export function useQuery(): URLSearchParams | null { return useSyncExternalStore(subscribe, () => loc.query, () => null); }
/** Links copied out of the demo point at the future live site. */
export function absoluteUrl(path: string): string { return SITE_URL + path; }
