import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { CALCS, byId } from '@lotwise/engine';
import { EmbedFrame } from '@/screens/EmbedScreens';

export const dynamicParams = false;
export function generateStaticParams() { return CALCS.map((c) => ({ slug: c.id })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> { const { slug } = await params; const def = byId[slug]; return { title: def ? `${def.name} (embed)` : 'Embed', robots: { index: false, follow: true }, alternates: { canonical: `/business/${slug}` } }; }
export default async function Page({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; if (!byId[slug]) notFound(); return <EmbedFrame slug={slug} />; }
