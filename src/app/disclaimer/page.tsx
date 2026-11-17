import type { Metadata } from 'next';
import { DisclaimerScreen } from '@/screens/StaticScreens';
export const metadata: Metadata = { title: 'Disclaimer', description: 'Lotwise is a decision-support and learning tool, not professional advice.', alternates: { canonical: '/disclaimer' } };
export default function Page() { return <DisclaimerScreen />; }
