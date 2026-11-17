import type { Metadata } from 'next';
import { MapScreen } from '@/screens/MapScreen';
export const metadata: Metadata = { title: 'Formula Map: how supply chain formulas connect', description: 'An interactive map of 93 supply chain and operations formulas and the dependencies between them. Filter by topic, follow a learning path, and open any calculator.', alternates: { canonical: '/map' } };
export default function Page() { return <MapScreen />; }
