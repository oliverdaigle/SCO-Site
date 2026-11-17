import type { Metadata } from 'next';
import { PracticeHubScreen } from '@/screens/PracticeScreens';
export const metadata: Metadata = { title: 'Operations management practice problems with instant checking', description: 'Unlimited randomized practice problems for every operations and supply chain formula, with worked solutions, streaks, and exam review.', alternates: { canonical: '/learn/practice' } };
export default function Page() { return <PracticeHubScreen />; }
