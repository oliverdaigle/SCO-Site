import type { Metadata } from 'next';
import { WizardScreen } from '@/screens/WizardScreen';
export const metadata: Metadata = { title: 'Find the right supply chain calculator for your problem', description: 'Answer a couple of plain-language questions and get the exact calculator for your situation.', alternates: { canonical: '/business/wizard' } };
export default function Page() { return <WizardScreen mode="business" />; }
