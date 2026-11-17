import type { Metadata } from 'next';
import { HubScreen } from '@/screens/HubScreen';
export const metadata: Metadata = { title: 'Operations and supply chain formulas with step-by-step solutions', description: 'Thirteen chapters covering every operations management formula: EOQ, safety stock, forecasting, queuing, quality, MRP, CPM, decision analysis. Step-by-step solutions, practice problems, and formula sheets.', alternates: { canonical: '/learn' } };
export default function Page() { return <HubScreen mode="learner" />; }
