'use client';
import { useEffect, type ReactNode } from 'react';
import type { Mode } from '@lotwise/engine';
import { useStore } from '@/lib/store';
import { DEMO_MODE } from '@/platform/env';
import { Link } from '@/platform/nav';
import { track } from '@/lib/analytics';
import { Icon } from '../icons';

/** Whether the current user has Pro for a mode. Before the store loads we assume the demo default to avoid a flash. */
export function usePro(mode: Mode): boolean {
  const plan = useStore((s) => s.plan); const hydrated = useStore((s) => s.hydrated);
  if (!hydrated) return DEMO_MODE;
  if (mode === 'business') return plan.businessPro;
  return plan.learnerPro && (!plan.learnerUntil || new Date(plan.learnerUntil) > new Date());
}

const COPY: Record<Mode, { name: string; price: string; cta: string }> = {
  business: { name: 'Business Pro', price: '$12 a month', cta: 'See Business Pro' },
  learner: { name: 'Learner Pro', price: '$5 a month or $15 for the semester', cta: 'See Learner Pro' },
};
/** An upgrade prompt in the mode's own voice. Shown where the feature would be, never as a pop-up. */
export function UpgradeCard({ mode, feature, children }: { mode: Mode; feature: string; children: ReactNode }) {
  useEffect(() => { track('upgrade_view', { feature, mode }); }, [feature, mode]);
  const c = COPY[mode];
  return (
    <div className="glow relative overflow-hidden rounded-xl border border-accent-line bg-accent-soft p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-fg"><Icon name="lock" size={15} /></span>
        <div className="min-w-0">
          <p className="font-semibold">{children}</p>
          <p className="mt-1 text-sm text-muted">{c.name} is {c.price}. Every calculator stays free.</p>
          <Link href={`/pricing#${mode}`} className="btn btn-primary btn-sm mt-3">{c.cta}<Icon name="arrowRight" size={14} /></Link>
        </div>
      </div>
    </div>
  );
}
export function ProGate({ mode, feature, prompt, children }: { mode: Mode; feature: string; prompt: ReactNode; children: ReactNode }) {
  const pro = usePro(mode);
  return pro ? <>{children}</> : <UpgradeCard mode={mode} feature={feature}>{prompt}</UpgradeCard>;
}
export function ProBadge() { return <span className="badge"><Icon name="sparkles" size={11} />Pro</span>; }
