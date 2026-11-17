import type { Metadata } from 'next';
import { HubScreen } from '@/screens/HubScreen';
export const metadata: Metadata = { title: 'Supply chain calculators for business owners and managers', description: 'Start from your problem: running out of stock, how much to order, how many staff, which supplier, where to put a warehouse. 93 verified calculators with plain-language answers.', alternates: { canonical: '/business' } };
export default function Page() { return <HubScreen mode="business" />; }
