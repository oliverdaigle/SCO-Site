import type { Metadata } from 'next';
import { StartScreen } from '@/screens/StartScreen';
export const metadata: Metadata = { title: 'Choose your mode', description: 'Business mode for owners and managers. Learner mode for students. Same verified math.', alternates: { canonical: '/start' } };
export default function Page() { return <StartScreen />; }
