import type { Metadata } from 'next';
import { WrappedScreen } from '@/screens/WrappedScreen';
export const metadata: Metadata = { title: 'Your Supply Chain, Wrapped', description: 'Bold, shareable story cards made from your own sales data: top sellers, forecast accuracy, excess stock, and more.', alternates: { canonical: '/business/wrapped' } };
export default function Page() { return <WrappedScreen />; }
