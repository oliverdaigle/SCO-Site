import type { MetadataRoute } from 'next';
import { CALCS, CHAPTERS } from '@lotwise/engine';
import { SITE_URL } from '@/platform/env';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date(); const u = (path: string, priority: number, changeFrequency: 'weekly' | 'monthly' = 'monthly') => ({ url: SITE_URL + path, lastModified: now, changeFrequency, priority });
  return [
    u('/', 1, 'weekly'), u('/business', 0.9, 'weekly'), u('/learn', 0.9, 'weekly'), u('/business/wizard', 0.7), u('/learn/wizard', 0.7), u('/business/plan-builder', 0.8), u('/business/wrapped', 0.6), u('/learn/practice', 0.7), u('/learn/paste', 0.7),
    u('/map', 0.7), u('/verified', 0.8), u('/pricing', 0.8), u('/embed-builder', 0.6), u('/about', 0.5), u('/faq', 0.6), u('/terms', 0.2), u('/privacy', 0.2), u('/disclaimer', 0.2),
    ...CALCS.flatMap((c) => [u(`/business/${c.id}`, 0.8), u(`/learn/${c.id}`, 0.8), u(`/learn/practice/${c.id}`, 0.4)]),
    ...CHAPTERS.flatMap((ch) => [u(`/learn/formula-sheet/${ch.id}`, 0.5)]),
  ];
}
