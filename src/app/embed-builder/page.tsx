import type { Metadata } from 'next';
import { EmbedBuilderScreen } from '@/screens/EmbedScreens';
export const metadata: Metadata = { title: 'Embed a supply chain calculator on your site', description: 'Add any of 93 verified supply chain and operations calculators to your blog, course page, or help center with one snippet. Themeable and free.', alternates: { canonical: '/embed-builder' } };
export default function Page() { return <EmbedBuilderScreen />; }
