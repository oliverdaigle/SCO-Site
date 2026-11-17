'use client';
// Privacy-friendly first-party analytics. No cookies, no third parties, no personal data.
// Events go to our own database when it is configured; in demo mode they stay in this browser.
import { DEMO_MODE } from '@/platform/env';

export type EventName = 'page' | 'calc_view' | 'calc_run' | 'search' | 'search_miss' | 'wizard_done' | 'signup' | 'upgrade_view' | 'checkout_start' | 'subscribe' | 'practice' | 'plan_run' | 'share' | 'export' | 'paste_parse' | 'embed_copy';
export interface Ev { n: EventName; p?: Record<string, string | number | boolean>; t: number; m?: string }
const KEY = 'lotwise:events';
let sid = '';
function session(): string { if (sid) return sid; try { sid = sessionStorage.getItem('lotwise:sid') || Math.random().toString(36).slice(2); sessionStorage.setItem('lotwise:sid', sid); } catch { sid = 'x'; } return sid; }

export function localEvents(): Ev[] { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } }
export function track(n: EventName, p?: Ev['p']) {
  if (typeof window === 'undefined') return;
  const ev: Ev = { n, p, t: Date.now(), m: document.documentElement.dataset.mode };
  try { const all = localEvents(); all.push(ev); localStorage.setItem(KEY, JSON.stringify(all.slice(-600))); } catch { /* storage unavailable */ }
  if (!DEMO_MODE) { try { const body = JSON.stringify({ ...ev, s: session(), path: location.pathname }); if (!navigator.sendBeacon?.('/api/track', new Blob([body], { type: 'application/json' }))) fetch('/api/track', { method: 'POST', body, headers: { 'content-type': 'application/json' }, keepalive: true }).catch(() => {}); } catch { /* ignore */ } }
}
