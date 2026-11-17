import { NextResponse } from 'next/server';
import { currentUser, isAdminEmail, supabaseAdmin } from '@/lib/supabase/server';
import { mrr } from '@/lib/plans';

export const dynamic = 'force-dynamic';
/** Owner dashboard numbers. Only emails listed in ADMIN_EMAILS get an answer. */
export async function GET() {
  const { user } = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: 'This account is not an admin.' }, { status: 403 });
  const db = supabaseAdmin(); if (!db) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not set.' }, { status: 503 });
  const { data, error } = await db.rpc('admin_stats', { days: 30 });
  if (error || !data) return NextResponse.json({ error: 'Could not load stats. Has the database migration been run?' }, { status: 500 });
  const t = data.totals ?? {};
  return NextResponse.json({ ...data, source: 'live', totals: { ...t, mrr: mrr({ bizPro: t.bizPro ?? 0, learnPro: t.learnPro ?? 0, semester: t.semester ?? 0 }) } });
}
