import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export const supabaseConfigured = () => !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
/** Supabase client bound to the visitor's session cookies. Row Level Security applies. */
export async function supabaseServer(): Promise<SupabaseClient> {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll: () => store.getAll(), setAll: (list) => { try { list.forEach(({ name, value, options }) => store.set(name, value, options)); } catch { /* called from a place that cannot set cookies */ } } },
  });
}
/** Service-role client for trusted server code only (webhooks, analytics inserts, admin stats). Bypasses RLS. */
export function supabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
}
export async function currentUser(): Promise<{ user: User | null; supabase: SupabaseClient | null }> {
  if (!supabaseConfigured()) return { user: null, supabase: null };
  const supabase = await supabaseServer(); const { data } = await supabase.auth.getUser();
  return { user: data.user ?? null, supabase };
}
export const isAdminEmail = (email?: string | null) => !!email && (process.env.ADMIN_EMAILS ?? '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean).includes(email.toLowerCase());

export interface SubRow { plan: string; status: string; current_period_end: string | null }
const LIVE = ['active', 'trialing', 'past_due'];
/** Turn subscription rows into what the app unlocks. */
export function planFromSubs(rows: SubRow[]) {
  const now = Date.now(); const live = (r: SubRow) => LIVE.includes(r.status) && (!r.current_period_end || new Date(r.current_period_end).getTime() > now - 3 * 864e5);
  const businessPro = rows.some((r) => r.plan === 'business_monthly' && live(r));
  const monthly = rows.some((r) => r.plan === 'learner_monthly' && live(r));
  const pass = rows.filter((r) => r.plan === 'learner_semester' && r.status === 'active' && r.current_period_end && new Date(r.current_period_end).getTime() > now).map((r) => r.current_period_end!).sort().pop() ?? null;
  return { businessPro, learnerPro: monthly || !!pass, learnerUntil: monthly ? null : pass, source: businessPro || monthly || pass ? ('stripe' as const) : ('none' as const) };
}
