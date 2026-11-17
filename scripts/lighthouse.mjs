// Lighthouse audit of the landing page and calculator pages, on mobile and desktop settings.
// Usage: npm run lighthouse [baseUrl]   (default http://localhost:3210, which should be a production build: npm run build && npm start)
// Uses the Chromium that ships with Playwright unless CHROME_PATH is set.
// LH_PAGES=/,/map limits the pages; LH_FORM=mobile|desktop limits the form factor; LH_DETAILS=1 lists every audit that lost points.
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://localhost:3210';
const pages = process.env.LH_PAGES ? process.env.LH_PAGES.split(',') : ['/', '/business/eoq', '/learn/eoq', '/business/newsvendor', '/learn/safety-stock-combined', '/learn/mms', '/business', '/learn', '/map', '/pricing', '/verified'];
const chromePath = process.env.CHROME_PATH ?? chromium.executablePath();
const chrome = await chromeLauncher.launch({ chromePath, chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'] });
const cats = ['performance', 'accessibility', 'best-practices', 'seo'];
let failed = false; const rows = [];
for (const formFactor of process.env.LH_FORM ? [process.env.LH_FORM] : ['mobile', 'desktop']) for (const p of pages) {
  const config = formFactor === 'desktop'
    ? { extends: 'lighthouse:default', settings: { formFactor: 'desktop', screenEmulation: { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false }, throttling: { rttMs: 40, throughputKbps: 10240, cpuSlowdownMultiplier: 1 }, onlyCategories: cats } }
    : { extends: 'lighthouse:default', settings: { onlyCategories: cats } };
  const r = await lighthouse(base + p, { port: chrome.port, output: 'json', logLevel: 'error' }, config);
  const s = Object.fromEntries(cats.map((c) => [c, Math.round((r.lhr.categories[c]?.score ?? 0) * 100)]));
  const low = cats.filter((c) => s[c] < 90); if (low.length) failed = true;
  const fails = low.flatMap((c) => r.lhr.categories[c].auditRefs.filter((a) => a.weight > 0 && (r.lhr.audits[a.id].score ?? 1) < 0.9).slice(0, 4).map((a) => `${a.id} (${r.lhr.audits[a.id].displayValue ?? r.lhr.audits[a.id].score})`));
  rows.push(`${formFactor.padEnd(8)} ${p.padEnd(30)} perf ${String(s.performance).padStart(3)}  a11y ${String(s.accessibility).padStart(3)}  best ${String(s['best-practices']).padStart(3)}  seo ${String(s.seo).padStart(3)}${fails.length ? '   <- ' + fails.join(', ') : ''}`);
  console.log(rows.at(-1));
  if (process.env.LH_DETAILS) {
    for (const c of cats) for (const a of r.lhr.categories[c].auditRefs) { const au = r.lhr.audits[a.id]; if (a.weight > 0 && au.score !== null && au.score < 1) console.log(`    ${c}: ${a.id} score=${au.score} ${au.displayValue ?? ''} ${JSON.stringify((au.details?.items ?? []).slice(0, 3).map((i) => i.node?.selector ?? i.url ?? '')).slice(0, 300)}`); }
    for (const id of ['largest-contentful-paint-element', 'bootup-time', 'mainthread-work-breakdown']) { const au = r.lhr.audits[id]; console.log(`    # ${id} ${au?.displayValue ?? ''}: ${JSON.stringify((au?.details?.items ?? []).flatMap((i) => i.items ?? [i]).slice(0, 6).map((i) => (i.node?.snippet ?? i.url ?? i.groupLabel ?? '').toString().slice(-70) + ' ' + Math.round(i.total ?? i.duration ?? i.scripting ?? i.timing ?? 0))).slice(0, 600)}`); }
  }
}
await chrome.kill();
console.log(failed ? '\nSome scores are below 90.' : '\nAll pages score 90 or above in every category.');
process.exit(failed ? 1 : 0);
