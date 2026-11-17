import type { Metadata } from 'next';
import { WizardScreen } from '@/screens/WizardScreen';
export const metadata: Metadata = { title: 'Which operations model do I use? Diagnostic wizard', description: 'Known or uncertain demand? One-time or repeating order? Answer a few questions and see which model fits your homework problem, and why.', alternates: { canonical: '/learn/wizard' } };
export default function Page() { return <WizardScreen mode="learner" />; }
