import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { byId, run } from '@lotwise/engine';
import { CalculatorView } from '@/components/calc/CalculatorView';
import { decodeValues } from '@/lib/share';

type P = { params: Promise<{ mode: string; slug: string }>; searchParams: Promise<{ v?: string }> };
/** A shared result. The link carries the exact inputs, and the preview image shows the answer. */
export async function generateMetadata({ params, searchParams }: P): Promise<Metadata> {
  const { mode, slug } = await params; const { v } = await searchParams; const def = byId[slug]; if (!def) return {};
  const m = mode === 'learn' ? 'learner' : 'business'; const vals = decodeValues(def.id, v); const r = vals ? run(def, vals) : null;
  const title = `${m === 'learner' ? def.name : def.bq} (shared result)`; const description = r?.ok && r.biz?.headline ? r.biz.headline.replace(/\*\*/g, '') : def.blurb;
  const img = `/api/og?c=${def.id}&m=${m}${v ? `&v=${encodeURIComponent(v)}` : ''}`;
  return { title, description, robots: { index: false, follow: true }, alternates: { canonical: `/${mode === 'learn' ? 'learn' : 'business'}/${def.id}` }, openGraph: { title, description, images: [{ url: img, width: 1200, height: 630, alt: def.name }] }, twitter: { card: 'summary_large_image', title, description, images: [img] } };
}
export default async function Page({ params, searchParams }: P) {
  const { mode, slug } = await params; const { v } = await searchParams; const def = byId[slug];
  if (!def || (mode !== 'learn' && mode !== 'business')) notFound();
  return <CalculatorView calcId={def.id} mode={mode === 'learn' ? 'learner' : 'business'} initial={decodeValues(def.id, v)} />;
}
