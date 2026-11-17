import type { Metadata } from 'next';
import { PlanBuilderScreen } from '@/screens/PlanBuilderScreen';
export const metadata: Metadata = { title: 'Supply Chain Plan Builder: an inventory policy for every SKU from your sales history', description: 'Upload a CSV of sales. Get a fitted forecast, safety stock, reorder point, and order quantity for every product, ABC analysis, and an Excel export where every number is a live formula.', alternates: { canonical: '/business/plan-builder' } };
export default function Page() { return <PlanBuilderScreen />; }
