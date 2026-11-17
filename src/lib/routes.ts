import type { Mode } from '@lotwise/engine';

export const modeBase = (m: Mode) => (m === 'learner' ? '/learn' : '/business');
export const calcHref = (m: Mode, id: string) => `${modeBase(m)}/${id}`;
export const modeFromPath = (path: string): Mode | null => (path.startsWith('/learn') ? 'learner' : path.startsWith('/business') ? 'business' : null);
/** Swap the mode of a mode-specific path, keeping the calculator when there is one. */
export function swapMode(path: string, to: Mode): string {
  const m = path.match(/^\/(business|learn)(?:\/([^/?#]+))?/);
  if (!m) return modeBase(to);
  const sub = m[2];
  const shared = !sub || ['wizard'].includes(sub) || !['plan-builder', 'wrapped', 'paste', 'practice', 'exam', 'formula-sheet'].includes(sub);
  return shared && sub ? `${modeBase(to)}/${sub}` : modeBase(to);
}

/** Route table shared by the Next.js app and the standalone demo router. */
export const ROUTES = [
  '/', '/start', '/business', '/business/wizard', '/business/plan-builder', '/business/wrapped', '/business/:slug',
  '/learn', '/learn/wizard', '/learn/paste', '/learn/practice', '/learn/practice/:slug', '/learn/exam/:chapter', '/learn/formula-sheet/:chapter', '/learn/:slug',
  '/s/:mode/:slug', '/map', '/verified', '/pricing', '/embed-builder', '/embed/:slug', '/about', '/faq', '/terms', '/privacy', '/disclaimer', '/login', '/account', '/admin', '/checkout',
] as const;
export function matchRoute(path: string): { route: string; params: Record<string, string> } | null {
  const segs = path.split('?')[0].split('/').filter(Boolean);
  for (const route of ROUTES) {
    const rs = route.split('/').filter(Boolean); if (rs.length !== segs.length) continue;
    const params: Record<string, string> = {}; let ok = true;
    for (let i = 0; i < rs.length; i++) { if (rs[i].startsWith(':')) params[rs[i].slice(1)] = decodeURIComponent(segs[i]); else if (rs[i] !== segs[i]) { ok = false; break; } }
    if (ok) return { route, params };
  }
  return null;
}
