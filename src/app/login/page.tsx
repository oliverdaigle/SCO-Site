import type { Metadata } from 'next';
import { LoginScreen } from '@/screens/AccountScreens';
export const metadata: Metadata = { title: 'Sign in', description: 'Sign in to Lotwise with a magic link or Google.', alternates: { canonical: '/login' }, robots: { index: false, follow: false } };
export default function Page() { return <LoginScreen />; }
