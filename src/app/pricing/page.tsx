import type { Metadata } from 'next';
import { PricingScreen } from '@/screens/AccountScreens';
export const metadata: Metadata = { title: 'Pricing', description: ' free calculators, Pro for depth:Every Lotwise calculator is free. Business Pro is $12 a month for the Plan Builder, exports, and what-if tools. Learner Pro is $5 a month or $15 for the semester.', alternates: { canonical: '/pricing' } };
export default function Page() { return <PricingScreen />; }
