'use client';
// Client-side account actions. In demo mode (no keys) everything is simulated locally; with keys it talks to Supabase and Stripe.
import { DEMO_MODE, HAS_SUPABASE } from '@/platform/env';
import { useStore, type Scenario, type PracticeStat } from './store';
import { track } from './analytics';
import { PLANS, type PlanId } from './plans';

const none = { businessPro: false, learnerPro: false, learnerUntil: null, source: 'none' as const };
let applying = false; let timer: ReturnType<typeof setTimeout> | null = null;

/** Merge what the server has with what this browser has, so nothing saved on either side is lost. */
function mergeState(remote: any) {
  if (!remote || typeof remote !== 'object') return; const s = useStore.getState();
  const scen: Scenario[] = [...s.scenarios]; for (const r of Array.isArray(remote.scenarios) ? remote.scenarios : []) if (r?.id && !scen.some((x) => x.id === r.id)) scen.push(r);
  const practice: Record<string, PracticeStat> = { ...s.practice }; for (const [k, v] of Object.entries((remote.practice ?? {}) as Record<string, PracticeStat>)) if (!practice[k] || v.attempts > practice[k].attempts) practice[k] = v;
  const streak = remote.streak?.lastDay && remote.streak.lastDay > s.streak.lastDay ? remote.streak : s.streak;
  useStore.setState({ scenarios: scen.slice(0, 100), practice, streak, xp: Math.max(s.xp, Number(remote.xp) || 0) });
}
async function refresh() {
  try {
    const j = await fetch('/api/me', { cache: 'no-store' }).then((r) => r.json()); const st = useStore.getState(); applying = true;
    if (j.user) { const fresh = !st.user; st.signIn({ email: j.user.email, name: j.user.name, admin: !!j.user.admin, demo: false }); st.setPlan(j.plan); if (fresh) { mergeState(j.state); if (j.prefs?.notation) st.setNotation(j.prefs.notation); if (!st.mode && j.prefs?.mode) st.setMode(j.prefs.mode); } }
    else { if (st.user) st.signOut(); st.setPlan(none); }
  } catch { /* offline: keep what we have */ } finally { applying = false; }
}
/** Live mode only: keep the store in step with the Supabase session and sync saved work to the profile. */
export async function initAuth(): Promise<() => void> {
  if (!HAS_SUPABASE) return () => {};
  const { supabaseBrowser } = await import('./supabase/client'); const sb = supabaseBrowser();
  const { data } = sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_IN' || ev === 'SIGNED_OUT' || ev === 'USER_UPDATED') { if (ev === 'SIGNED_IN' && !useStore.getState().user) track('signup'); refresh(); } });
  await refresh();
  const unsub = useStore.subscribe((s, p) => {
    if (applying || !s.user || s.user.demo) return;
    if (s.scenarios === p.scenarios && s.practice === p.practice && s.mode === p.mode && s.notation === p.notation) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { const c = useStore.getState(); fetch('/api/me', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: c.mode, notation: c.notation, state: { scenarios: c.scenarios, practice: c.practice, streak: c.streak, xp: c.xp } }) }).catch(() => {}); }, 1500);
  });
  return () => { data.subscription.unsubscribe(); unsub(); };
}
const callback = (next: string) => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
export async function sendMagicLink(email: string, next: string): Promise<string | null> {
  const { supabaseBrowser } = await import('./supabase/client');
  const { error } = await supabaseBrowser().auth.signInWithOtp({ email, options: { emailRedirectTo: callback(next) } });
  return error ? error.message : null;
}
export async function googleSignIn(next: string): Promise<string | null> {
  const { supabaseBrowser } = await import('./supabase/client');
  const { error } = await supabaseBrowser().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: callback(next) } });
  return error ? error.message : null;
}
export function demoSignIn(email: string) {
  const name = email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || 'Demo User';
  useStore.getState().signIn({ email, name, demo: true, admin: true }); track('signup', { demo: true });
}
export async function signOutAll() {
  if (HAS_SUPABASE) { try { const { supabaseBrowser } = await import('./supabase/client'); await supabaseBrowser().auth.signOut(); } catch { /* ignore */ } useStore.getState().setPlan(none); }
  useStore.getState().signOut();
}
/** Begin an upgrade. Returns a message when something needs the user's attention. */
export async function startCheckout(plan: PlanId, go: (href: string) => void): Promise<string | null> {
  track('checkout_start', { plan });
  if (DEMO_MODE) { go(`/checkout?plan=${plan}`); return null; }
  if (!useStore.getState().user) { go(`/login?next=${encodeURIComponent('/pricing#' + PLANS[plan].mode)}`); return null; }
  try {
    const r = await fetch('/api/stripe/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ plan }) }); const j = await r.json();
    if (r.status === 401) { go(`/login?next=${encodeURIComponent('/pricing#' + PLANS[plan].mode)}`); return null; }
    if (!r.ok || !j.url) return j.error ?? 'Could not start checkout.';
    window.location.href = j.url; return null;
  } catch { return 'Could not reach the server. Check your connection and try again.'; }
}
export async function openPortal(): Promise<string | null> {
  try { const r = await fetch('/api/stripe/portal', { method: 'POST' }); const j = await r.json(); if (!r.ok || !j.url) return j.error ?? 'Could not open billing.'; window.location.href = j.url; return null; } catch { return 'Could not reach the server.'; }
}
/** Demo checkout: unlock the plan locally. */
export function demoActivate(plan: PlanId) {
  const p = PLANS[plan]; const st = useStore.getState(); if (!st.user) demoSignIn('demo@example.com');
  if (p.mode === 'business') st.setPlan({ businessPro: true, source: 'demo' });
  else { const end = new Date(); end.setMonth(end.getMonth() + (p.months ?? 0)); st.setPlan({ learnerPro: true, learnerUntil: p.kind === 'payment' ? end.toISOString() : null, source: 'demo' }); }
  track('subscribe', { plan, demo: true });
}
export { refresh as refreshAccount };
