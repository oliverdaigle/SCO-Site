import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

const NAMES = new Set(['page', 'calc_view', 'calc_run', 'search', 'search_miss', 'wizard_done', 'signup', 'upgrade_view', 'checkout_start', 'subscribe', 'practice', 'plan_run', 'share', 'export', 'paste_parse', 'embed_copy']);
/** First-party analytics. Stores the event name, a few non-personal properties, and a random per-tab session id. No cookies, no IP address. */
export async function POST(req: Request) {
  const db = supabaseAdmin(); if (!db) return new NextResponse(null, { status: 204 });
  try {
    const raw = await req.text(); if (raw.length > 2000) return new NextResponse(null, { status: 413 });
    const b = JSON.parse(raw); if (!NAMES.has(b?.n)) return new NextResponse(null, { status: 400 });
    const props: Record<string, string | number | boolean> = {};
    for (const [k, v] of Object.entries(b.p ?? {}).slice(0, 8)) if (['string', 'number', 'boolean'].includes(typeof v)) props[k.slice(0, 24)] = typeof v === 'string' ? v.slice(0, 120) : (v as number | boolean);
    await db.from('events').insert({ name: b.n, props, mode: b.m === 'learner' ? 'learner' : b.m === 'business' ? 'business' : null, path: typeof b.path === 'string' ? b.path.slice(0, 200) : null, session: typeof b.s === 'string' ? b.s.slice(0, 24) : null });
  } catch { /* analytics must never break the page */ }
  return new NextResponse(null, { status: 204 });
}
