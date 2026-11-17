import 'server-only';
import Stripe from 'stripe';
let stripe: Stripe | null = null;
export function stripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY; if (!key) return null;
  if (!stripe) stripe = new Stripe(key, { appInfo: { name: 'Lotwise' } });
  return stripe;
}
export const siteOrigin = (req: Request) => (process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin).replace(/\/$/, '');
