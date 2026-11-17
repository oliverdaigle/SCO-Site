// Entry point for the standalone demo: the whole app as one client-side bundle with hash routing.
// The Next.js app in src/app is the real product; this exists so the demo can be hosted as a single page.
import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { byId, catById } from '@lotwise/engine';
import { Shell } from '@/components/shell/Shell';
import { CalculatorView } from '@/components/calc/CalculatorView';
import { toast } from '@/components/ui';
import { matchRoute } from '@/lib/routes';
import { decodeValues } from '@/lib/share';
import { setSaver } from '@/lib/files';
import { useStore } from '@/lib/store';
import { Link, usePath, useQuery } from '@/platform/nav';
import { LandingScreen } from '@/screens/LandingScreen';
import { StartScreen } from '@/screens/StartScreen';
import { HubScreen } from '@/screens/HubScreen';
import { WizardScreen } from '@/screens/WizardScreen';
import { PlanBuilderScreen } from '@/screens/PlanBuilderScreen';
import { WrappedScreen } from '@/screens/WrappedScreen';
import { PasteScreen } from '@/screens/PasteScreen';
import { ExamScreen, FormulaSheetScreen, PracticeHubScreen, PracticeScreen } from '@/screens/PracticeScreens';
import { MapScreen } from '@/screens/MapScreen';
import { VerifiedScreen } from '@/screens/VerifiedScreen';
import { AccountScreen, CheckoutScreen, LoginScreen, PricingScreen } from '@/screens/AccountScreens';
import { AdminScreen } from '@/screens/AdminScreen';
import { EmbedBuilderScreen, EmbedFrame } from '@/screens/EmbedScreens';
import { AboutScreen, DisclaimerScreen, FaqScreen, PrivacyScreen, TermsScreen } from '@/screens/StaticScreens';

function NotFound() { return (<div className="wrap max-w-xl py-24 text-center"><p className="eyebrow">Not found</p><h1 className="mt-2 text-4xl font-semibold">That page does not exist.</h1><p className="mt-3 text-muted">Try the search, or head back to the start.</p><Link href="/" className="btn btn-primary mt-6">Go home</Link></div>); }

function Screen(): ReactNode {
  const path = usePath(); const q = useQuery(); const m = matchRoute(path); const p = m?.params ?? {};
  const calc = (mode: 'business' | 'learner', initial = false) => (byId[p.slug] ? <CalculatorView key={mode + p.slug} calcId={p.slug} mode={mode} initial={initial ? decodeValues(p.slug, q?.get('v')) : undefined} /> : <NotFound />);
  switch (m?.route) {
    case '/': return <LandingScreen />;
    case '/start': return <StartScreen />;
    case '/business': return <HubScreen mode="business" />;
    case '/learn': return <HubScreen mode="learner" />;
    case '/business/wizard': return <WizardScreen mode="business" />;
    case '/learn/wizard': return <WizardScreen mode="learner" />;
    case '/business/plan-builder': return <PlanBuilderScreen />;
    case '/business/wrapped': return <WrappedScreen />;
    case '/business/:slug': return calc('business');
    case '/learn/paste': return <PasteScreen />;
    case '/learn/practice': return <PracticeHubScreen />;
    case '/learn/practice/:slug': return byId[p.slug] ? <PracticeScreen key={p.slug} calcId={p.slug} /> : <NotFound />;
    case '/learn/exam/:chapter': return catById[p.chapter] ? <ExamScreen key={p.chapter} chapter={p.chapter} /> : <NotFound />;
    case '/learn/formula-sheet/:chapter': return catById[p.chapter] ? <FormulaSheetScreen key={p.chapter} chapter={p.chapter} /> : <NotFound />;
    case '/learn/:slug': return calc('learner');
    case '/s/:mode/:slug': return calc(p.mode === 'learn' ? 'learner' : 'business', true);
    case '/map': return <MapScreen />;
    case '/verified': return <VerifiedScreen />;
    case '/pricing': return <PricingScreen />;
    case '/embed-builder': return <EmbedBuilderScreen />;
    case '/embed/:slug': return <EmbedFrame slug={p.slug} />;
    case '/about': return <AboutScreen />;
    case '/faq': return <FaqScreen />;
    case '/terms': return <TermsScreen />;
    case '/privacy': return <PrivacyScreen />;
    case '/disclaimer': return <DisclaimerScreen />;
    case '/login': return <LoginScreen />;
    case '/account': return <AccountScreen />;
    case '/admin': return <AdminScreen />;
    case '/checkout': return <CheckoutScreen />;
    default: return <NotFound />;
  }
}

// Files are handed to the host page's save dialog, since a sandboxed demo cannot start downloads itself.
setSaver(async (blob, filename) => {
  const claude = (window as any).claude; const dl = claude?.use ? await claude.use('downloads') : null;
  if (!dl) { toast('Saving files is not available in this view. On the live site this downloads the file.'); return; }
  try { await dl.save({ filename, data: blob }); } catch (e: any) { if (e?.code !== 'declined') toast('The file could not be saved here.'); }
});

// Theme: a saved choice wins, then the host page's theme, then the system setting.
const root = document.documentElement;
let saved: string | null = null; try { saved = JSON.parse(localStorage.getItem('lotwise:v1') || 'null')?.state?.theme ?? null; } catch { /* storage unavailable */ }
const initial = saved ?? root.dataset.theme ?? (window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
if (!saved) useStore.setState({ theme: initial === 'light' ? 'light' : 'dark' });
root.dataset.theme = initial === 'light' ? 'light' : 'dark';
new MutationObserver(() => { const t = root.dataset.theme; if ((t === 'light' || t === 'dark') && t !== useStore.getState().theme) useStore.getState().setTheme(t); }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });

createRoot(document.getElementById('lotwise-root')!).render(<StrictMode><Shell><Screen /></Shell></StrictMode>);
