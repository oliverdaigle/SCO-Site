import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { currentUser } from '@/lib/supabase/server';
import { siteOrigin, stripeClient } from '@/lib/stripeServer';
import { PLANS, isPlanId } from '@/lib/plans';

/** Starts a Stripe Checkout session for the chosen plan and returns its URL. */
export async function POST(req: Request) {
  const { user, supabase } = await currentUser();
  if (!user || !supabase) return NextResponse.json({ error: 'Sign in to upgrade.' }, { status: 401 });
  const stripe = stripeClient(); if (!stripe) return NextResponse.json({ error: 'Payments are not switched on yet.' }, { status: 503 });
  const body = await req.json().catch(() => null); const planId: unknown = body?.plan; if (!isPlanId(planId)) return NextResponse.json({ error: 'Unknown plan.' }, { status: 400 });
  const plan = PLANS[planId]; const origin = siteOrigin(req);
  const { data: profile } = await supabase.from('profiles').select('stripe_customer_id').eq('id', user.id).maybeSingle();
  const priceId = process.env[plan.priceEnv];
  // If the owner created Prices in Stripe, use them. Otherwise describe the price inline so no Stripe setup is needed.
  const line: Stripe.Checkout.SessionCreateParams.LineItem = priceId ? { price: priceId, quantity: 1 }
    : { quantity: 1, price_data: { currency: 'usd', unit_amount: plan.cents, product_data: { name: `Lotwise ${plan.name}` }, ...(plan.kind === 'subscription' ? { recurring: { interval: 'month' as const } } : {}) } };
  const meta = { plan: plan.id, user_id: user.id };
  try {
    const session = await stripe.checkout.sessions.create({
      mode: plan.kind, line_items: [line], client_reference_id: user.id, metadata: meta, allow_promotion_codes: true,
      success_url: `${origin}/checkout?status=success&plan=${plan.id}`, cancel_url: `${origin}/pricing?canceled=1`,
      ...(profile?.stripe_customer_id ? { customer: profile.stripe_customer_id } : { customer_email: user.email ?? undefined }),
      ...(plan.kind === 'subscription' ? { subscription_data: { metadata: meta } } : { payment_intent_data: { metadata: meta }, ...(profile?.stripe_customer_id ? {} : { customer_creation: 'always' as const }) }),
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error('stripe checkout', e);
    return NextResponse.json({ error: 'Could not start checkout. Please try again.' }, { status: 502 });
  }
}
