import type { Mode } from '@lotwise/engine';
export type PlanId = 'business_monthly' | 'learner_monthly' | 'learner_semester';
export interface PlanDef { id: PlanId; mode: Mode; name: string; cents: number; per: string; kind: 'subscription' | 'payment'; months?: number; blurb: string; priceEnv: string }
/** The three things Lotwise sells. Prices here drive the pricing page, checkout, and the admin revenue math. */
export const PLANS: Record<PlanId, PlanDef> = {
  business_monthly: { id: 'business_monthly', mode: 'business', name: 'Business Pro', cents: 1200, per: 'month', kind: 'subscription', blurb: 'Billed monthly. Cancel any time.', priceEnv: 'STRIPE_PRICE_BUSINESS_MONTHLY' },
  learner_monthly: { id: 'learner_monthly', mode: 'learner', name: 'Learner Pro', cents: 500, per: 'month', kind: 'subscription', blurb: 'Billed monthly. Cancel any time.', priceEnv: 'STRIPE_PRICE_LEARNER_MONTHLY' },
  learner_semester: { id: 'learner_semester', mode: 'learner', name: 'Learner Pro Semester Pass', cents: 1500, per: 'semester', kind: 'payment', months: 5, blurb: 'One payment covers 5 months. No renewal.', priceEnv: 'STRIPE_PRICE_LEARNER_SEMESTER' },
};
export const isPlanId = (x: unknown): x is PlanId => typeof x === 'string' && x in PLANS;
export const dollars = (cents: number) => `$${cents % 100 === 0 ? cents / 100 : (cents / 100).toFixed(2)}`;
/** Monthly recurring revenue in dollars. A semester pass counts as its price spread over its months. */
export const mrr = (c: { bizPro: number; learnPro: number; semester: number }) => c.bizPro * 12 + c.learnPro * 5 + c.semester * 3;
