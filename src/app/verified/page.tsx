import type { Metadata } from 'next';
import { VerifiedScreen } from '@/screens/VerifiedScreen';
import { HashOpen } from '@/components/HashOpen';
export const metadata: Metadata = { title: 'Verified: how every calculator is tested', description: 'Every Lotwise calculator passes textbook worked examples, millions of randomized comparisons against an independent Python implementation, and simulation proofs. See the results for each one.', alternates: { canonical: '/verified' } };
export default function Page() { return (<><VerifiedScreen /><HashOpen /></>); }
