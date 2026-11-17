import type { Metadata } from 'next';
import { FAQS, FaqScreen } from '@/screens/StaticScreens';
import { JsonLdText } from '@/lib/seo';
export const metadata: Metadata = { title: 'FAQ', description: 'Answers to common questions about Lotwise: pricing, accuracy, textbook notation, the Plan Builder, embeds, and privacy.', alternates: { canonical: '/faq' } };
export default function Page() {
  const ld = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQS.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) };
  return (<><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JsonLdText(ld) }} /><FaqScreen /></>);
}
