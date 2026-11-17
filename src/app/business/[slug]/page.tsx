import { notFound } from 'next/navigation';
import { CALCS, byId } from '@lotwise/engine';
import { CalculatorView } from '@/components/calc/CalculatorView';
import { calcJsonLd, calcMetadata, JsonLdText } from '@/lib/seo';

export const dynamicParams = false;
export function generateStaticParams() { return CALCS.map((c) => ({ slug: c.id })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; const def = byId[slug]; return def ? calcMetadata(def, 'business') : {}; }

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const def = byId[slug]; if (!def) notFound();
  return (<>
    {calcJsonLd(def, 'business').map((d, i) => <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JsonLdText(d) }} />)}
    <CalculatorView calcId={def.id} mode="business" />
  </>);
}
