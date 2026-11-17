import type { Metadata } from 'next';
import { AboutScreen } from '@/screens/StaticScreens';
export const metadata: Metadata = { title: 'About Lotwise', description: 'Why Lotwise exists: 93 verified supply chain and operations calculators for people who run businesses and people who study them.', alternates: { canonical: '/about' } };
export default function Page() { return <AboutScreen />; }
