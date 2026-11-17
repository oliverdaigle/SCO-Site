import type { Metadata } from 'next';
import { LandingScreen } from '@/screens/LandingScreen';
import { JsonLdText } from '@/lib/seo';
import { BRAND, SITE_URL } from '@/platform/env';

export const metadata: Metadata = { title: { absolute: `${BRAND.name}: ${BRAND.tagline}` }, description: '93 verified supply chain and operations calculators: EOQ, safety stock, reorder point, forecasting, queuing, quality, MRP, and more. Plain-language answers for businesses, step-by-step solutions for students.', alternates: { canonical: '/' } };
export default function Page() {
  const ld = [{ '@context': 'https://schema.org', '@type': 'Organization', name: BRAND.name, url: SITE_URL, logo: `${SITE_URL}/icon.svg`, slogan: BRAND.tagline }, { '@context': 'https://schema.org', '@type': 'WebSite', name: BRAND.name, url: SITE_URL }];
  return (<>{ld.map((d, i) => <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JsonLdText(d) }} />)}<LandingScreen /></>);
}
