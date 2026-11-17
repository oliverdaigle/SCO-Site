import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabase/server';
import { stripeClient } from '@/lib/stripeServer';
import { PLANS, isPlanId } from '@/lib/plans';

export const dynamic = 'force-dynamic';
const iso = (unix?: number | null) => (unix ? new Date(unix * 1000).toISOString() : null);
/** Newer Stripe API versions report the billing period on the subscription item, older ones on the subscription. */
const periodEnd = (sub: Stripe.Subscription) => iso((sub as any).current_period_end ?? (sub.items?.data?.[0] as any)?.current_period_end ?? null);
const idOf = (x: string | { id: string } | null | undefined) => (typeof x === 'string' ? x : x?.id ?? null);

/** Stripe calls this when a payment or subscription changes. It is the only place that grants or removes Pro. */
export async function POST(req: Request) {
  const stripe = stripeClient(); const db = supabaseAdmin(); const secret = process.env.STRIPE_WEBHOOK_SECRET; const sig = req.headers.get('stripe-signature');
  if (!stripe || !db || !secret) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  if (!sig) return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  let event: Stripe.Event;
  try { event = stripe.webhooks.constructEvent(await req.text(), sig, secret); } catch { return NextResponse.json({ error: 'Bad signature' }, { status: 400 }); }

  const upsertSub = async (sub: Stripe.Subscription, userId?: string | null, planId?: string | null) => {
    const user_id = userId ?? sub.metadata?.user_id ?? null; const plan = planId ?? sub.metadata?.plan ?? null;
    if (!user_id || !isPlanId(plan)) return;
    const { error } = await db.from('subscriptions').upsert({ id: sub.id, user_id, plan, status: sub.status, current_period_end: periodEnd(sub), cancel_at_period_end: !!sub.cancel_at_period_end, stripe_customer_id: idOf(sub.customer), updated_at: new Date().toISOString() });
    if (error) throw error;
  };
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object as Stripe.Checkout.Session; const userId = s.client_reference_id ?? s.metadata?.user_id ?? null; const plan = s.metadata?.plan ?? null; const customer = idOf(s.customer);
        if (!userId || !isPlanId(plan)) break;
        if (customer) await db.from('profiles').update({ stripe_customer_id: customer }).eq('id', userId);
        if (s.mode === 'subscription' && s.subscription) await upsertSub(await stripe.subscriptions.retrieve(idOf(s.subscription)!), userId, plan);
        else if (s.mode === 'payment' && s.payment_status === 'paid') {
          // Semester pass: one payment, fixed number of months, no renewal.
          const end = new Date(); end.setMonth(end.getMonth() + (PLANS[plan].months ?? 5));
          const { error } = await db.from('subscriptions').upsert({ id: s.id, user_id: userId, plan, status: 'active', current_period_end: end.toISOString(), cancel_at_period_end: true, stripe_customer_id: customer, updated_at: new Date().toISOString() });
          if (error) throw error;
        }
        await db.from('events').insert({ name: 'subscribe', props: { plan }, mode: PLANS[plan].mode });
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': await upsertSub(event.data.object as Stripe.Subscription); break;
      case 'charge.refunded': {
        // A refunded semester pass ends immediately.
        const pi = idOf((event.data.object as Stripe.Charge).payment_intent as any);
        if (pi) { const sessions = await stripe.checkout.sessions.list({ payment_intent: pi, limit: 1 }); const sid = sessions.data[0]?.id; if (sid) await db.from('subscriptions').update({ status: 'canceled', updated_at: new Date().toISOString() }).eq('id', sid); }
        break;
      }
      default: break;
    }
  } catch (e) {
    console.error('stripe webhook', event.type, e);
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 }); // Stripe retries on 5xx
  }
  return NextResponse.json({ received: true });
}
