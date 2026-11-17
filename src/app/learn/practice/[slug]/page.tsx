import { notFound } from 'next/navigation';
import { CALCS, byId } from '@lotwise/engine';
import { PracticeScreen } from '@/screens/PracticeScreens';
export const dynamicParams = false;
export function generateStaticParams() { return CALCS.map((c) => ({ slug: c.id })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; const d = byId[slug]; return d ? { title: `${d.short} practice problems with solutions`, description: `Fresh ${d.name} practice problems with realistic numbers, instant answer checking, and full worked solutions.`, alternates: { canonical: `/learn/practice/${slug}` } } : {}; }
export default async function Page({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; if (!byId[slug]) notFound(); return <PracticeScreen calcId={slug} />; }
