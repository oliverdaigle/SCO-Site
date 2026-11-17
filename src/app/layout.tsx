import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import '@fontsource-variable/bricolage-grotesque';
import './globals.css';
import { Shell } from '@/components/shell/Shell';
import { BRAND, SITE_URL } from '@/platform/env';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${BRAND.name}: every supply chain and operations calculator, verified`, template: `%s | ${BRAND.name}` },
  description: '93 supply chain and operations calculators (EOQ, safety stock, forecasting, queuing, quality, MRP, CPM and more) with plain-language answers for businesses and step-by-step solutions for students. Every formula verified three ways.',
  applicationName: BRAND.name,
  openGraph: { type: 'website', siteName: BRAND.name, images: [{ url: '/api/og', width: 1200, height: 630 }] },
  twitter: { card: 'summary_large_image' },
  icons: { icon: '/icon.svg' },
  alternates: { canonical: '/' },
};
export const viewport: Viewport = { themeColor: [{ media: '(prefers-color-scheme: dark)', color: '#090b10' }, { media: '(prefers-color-scheme: light)', color: '#f6f7fb' }], width: 'device-width', initialScale: 1 };

// Runs before first paint so the saved theme and mode apply without a flash.
const boot = `(function(){try{var s=(JSON.parse(localStorage.getItem('lotwise:v1')||'{}').state)||{};var d=document.documentElement;d.dataset.theme=s.theme==='light'?'light':'dark';if(s.mode)d.dataset.mode=s.mode;}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: boot }} /></head>
      <body><Shell>{children}</Shell></body>
    </html>
  );
}
