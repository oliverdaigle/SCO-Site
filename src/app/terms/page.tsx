import type { Metadata } from 'next';
import { TermsScreen } from '@/screens/StaticScreens';
export const metadata: Metadata = { title: 'Terms of Service', description: 'The terms that cover your use of Lotwise.', alternates: { canonical: '/terms' } };
export default function Page() { return <TermsScreen />; }
