import type { Metadata } from 'next';
import { AdminScreen } from '@/screens/AdminScreen';
export const metadata: Metadata = { title: 'Owner dashboard', robots: { index: false, follow: false } };
export default function Page() { return <AdminScreen />; }
