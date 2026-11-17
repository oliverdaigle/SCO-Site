import { NextResponse } from 'next/server';
import { currentUser, isAdminEmail, planFromSubs } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
/** Who is signed in, what they have unlocked, and their saved preferences. */
export async function GET() {
  const { user, supabase } = await currentUser(); if (!user || !supabase) return NextResponse.json({ user: null });
  const [{ data: profile }, { data: subs }] = await Promise.all([supabase.from('profiles').select('name, mode, notation, state').eq('id', user.id).maybeSingle(), supabase.from('subscriptions').select('plan, status, current_period_end').eq('user_id', user.id)]);
  supabase.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', user.id).then(() => {}, () => {});
  return NextResponse.json({ user: { email: user.email, name: profile?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'You', admin: isAdminEmail(user.email) }, plan: planFromSubs(subs ?? []), prefs: { mode: profile?.mode ?? null, notation: profile?.notation ?? null }, state: profile?.state ?? null });
}
/** Save preferences and synced state (scenarios, practice progress) to the profile. */
export async function PATCH(req: Request) {
  const { user, supabase } = await currentUser(); if (!user || !supabase) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const raw = await req.text(); if (raw.length > 400_000) return NextResponse.json({ error: 'Too large' }, { status: 413 });
  let b: any; try { b = JSON.parse(raw); } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400 }); }
  const patch: Record<string, unknown> = {};
  if (b.mode === 'business' || b.mode === 'learner') patch.mode = b.mode;
  if (['heizer', 'chopra', 'cachon', 'jacobs'].includes(b.notation)) patch.notation = b.notation;
  if (typeof b.name === 'string') patch.name = b.name.slice(0, 80);
  if (b.state && typeof b.state === 'object' && !Array.isArray(b.state)) patch.state = b.state;
  if (Object.keys(patch).length) { const { error } = await supabase.from('profiles').update(patch).eq('id', user.id); if (error) return NextResponse.json({ error: 'Could not save' }, { status: 500 }); }
  return NextResponse.json({ ok: true });
}
