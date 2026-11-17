import type { Metadata } from 'next';
import { CheckoutScreen } from '@/screens/AccountScreens';
export const metadata: Metadata = { title: 'Checkout', description: 'Upgrade to Lotwise Pro.', alternates: { canonical: '/checkout' }, robots: { index: false, follow: false } };
export default function Page() { return <CheckoutScreen />; }
