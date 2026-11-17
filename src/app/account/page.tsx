import type { Metadata } from 'next';
import { AccountScreen } from '@/screens/AccountScreens';
export const metadata: Metadata = { title: 'Your account', description: 'Your Lotwise plan, preferences, and saved work.', alternates: { canonical: '/account' }, robots: { index: false, follow: false } };
export default function Page() { return <AccountScreen />; }
