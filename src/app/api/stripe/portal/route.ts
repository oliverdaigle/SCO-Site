import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/supabase/server';
import { siteOrigin, stripeClient } from '@/lib/stripeServer';

/** Opens the Stripe customer portal so a subscriber can update a card, download invoices, or cancel. */
export async function POST(req: Request) {
  const { user, supabase } = await currentUser();
  if (!user || !supabase) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const stripe = stripeClient(); if (!stripe) return NextResponse.json({ error: 'Payments are not switched on yet.' }, { status: 503 });
  const { data: profile } = await supabase.from('profiles').select('stripe_customer_id').eq('id', user.id).maybeSingle();
  if (!profile?.stripe_customer_id) return NextResponse.json({ error: 'No billing account yet. Upgrade first.' }, { status: 404 });
  try {
    const session = await stripe.billingPortal.sessions.create({ customer: profile.stripe_customer_id, return_url: `${siteOrigin(req)}/account` });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error('stripe portal', e);
    return NextResponse.json({ error: 'Could not open billing. In Stripe, check that the customer portal is activated.' }, { status: 502 });
  }
}
