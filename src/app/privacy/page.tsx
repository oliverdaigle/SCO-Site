import type { Metadata } from 'next';
import { PrivacyScreen } from '@/screens/StaticScreens';
export const metadata: Metadata = { title: 'Privacy Policy', description: 'What Lotwise collects, what it does not, and your choices.', alternates: { canonical: '/privacy' } };
export default function Page() { return <PrivacyScreen />; }
