import type { Metadata } from 'next';
import { byId, catById, run, symbols, F, type CalcDef, type Mode } from '@lotwise/engine';
import { BRAND, SITE_URL } from '@/platform/env';
import { texToPlain } from '@/components/Tex';

const path = (mode: Mode, id: string) => `/${mode === 'learner' ? 'learn' : 'business'}/${id}`;
/** Unique title and description for each calculator in each mode. */
export function calcMetadata(def: CalcDef, mode: Mode): Metadata {
  const title = mode === 'business' ? `${def.bq} ${def.short} calculator` : `${def.name} calculator with step-by-step solution`;
  const description = mode === 'business'
    ? `${def.blurb} Enter your numbers and get a plain-language answer, what it means in dollars and time, and what to do next. Free, verified.`
    : `${def.blurb} See the formula, every substitution, table lookups, and common exam traps. Supports Heizer, Chopra, Cachon, and Jacobs notation. Free, verified.`;
  return { title, description: description.slice(0, 300), alternates: { canonical: path(mode, def.id) }, openGraph: { title, description, url: path(mode, def.id), images: [{ url: `/api/og?c=${def.id}&m=${mode}`, width: 1200, height: 630, alt: def.name }] }, keywords: [...def.keywords, def.short, catById[def.cat].name] };
}
/** FAQ + HowTo + SoftwareApplication structured data for a calculator page. */
export function calcJsonLd(def: CalcDef, mode: Mode) {
  const url = SITE_URL + path(mode, def.id); const r = run(def, def.examples[0].v); const ex = def.examples[0];
  const faqs = [...(def.faq ?? []), { q: `What is the formula for ${def.short}?`, a: `${texToPlain(def.formula(symbols('heizer')))}. ${def.blurb}` }, { q: `What are common mistakes with ${def.short}?`, a: def.traps.join(' ') }, { q: `How is the ${def.short} calculator verified?`, a: 'It must pass textbook-style worked examples, thousands of randomized comparisons against an independent Python implementation, and (where applicable) a simulation.' }];
  return [
    { '@context': 'https://schema.org', '@type': 'WebApplication', name: `${def.name} Calculator`, url, applicationCategory: 'BusinessApplication', operatingSystem: 'Any', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, description: def.blurb, publisher: { '@type': 'Organization', name: BRAND.name, url: SITE_URL } },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    { '@context': 'https://schema.org', '@type': 'HowTo', name: `How to calculate ${def.short}`, description: `${ex.title}: ${ex.story}`, step: r.steps.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, name: s.title, text: [s.tex ? texToPlain(s.tex) : '', s.why ?? ''].filter(Boolean).join('. ') || s.title })) },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: mode === 'business' ? 'Business' : 'Learn', item: SITE_URL + (mode === 'business' ? '/business' : '/learn') }, { '@type': 'ListItem', position: 2, name: catById[def.cat].name, item: SITE_URL + (mode === 'business' ? '/business' : '/learn') + '#' + def.cat }, { '@type': 'ListItem', position: 3, name: def.name, item: url }] },
  ];
}
export function JsonLdText(data: unknown): string { return JSON.stringify(data).replace(/</g, '\\u003c'); }
export { byId, F };
