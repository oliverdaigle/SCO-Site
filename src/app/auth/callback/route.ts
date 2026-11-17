import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { supabaseConfigured, supabaseServer } from '@/lib/supabase/server';

/** Lands here from a magic link or Google sign-in, turns the code into a session cookie, and sends the visitor on. */
export async function GET(req: Request) {
  const url = new URL(req.url); const nextRaw = url.searchParams.get('next') ?? '/account'; const next = nextRaw.startsWith('/') && !nextRaw.startsWith('//') ? nextRaw : '/account';
  if (!supabaseConfigured()) return NextResponse.redirect(new URL('/login', url.origin));
  const supabase = await supabaseServer(); const code = url.searchParams.get('code'); const tokenHash = url.searchParams.get('token_hash'); const type = url.searchParams.get('type') as EmailOtpType | null;
  let ok = false;
  if (code) { const { error } = await supabase.auth.exchangeCodeForSession(code); ok = !error; }
  else if (tokenHash && type) { const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash }); ok = !error; }
  return NextResponse.redirect(new URL(ok ? next : '/login?error=link', url.origin));
}
