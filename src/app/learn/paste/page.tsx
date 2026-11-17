import type { Metadata } from 'next';
import { PasteScreen } from '@/screens/PasteScreen';
export const metadata: Metadata = { title: 'Paste your operations homework problem and get it solved step by step', description: 'Paste a textbook problem. Lotwise identifies the model, extracts the numbers and units, lets you correct them, and shows the full worked solution.', alternates: { canonical: '/learn/paste' } };
export default function Page() { return <PasteScreen />; }
