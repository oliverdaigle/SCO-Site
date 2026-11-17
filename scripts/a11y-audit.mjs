// Accessibility audit: runs axe-core (WCAG 2.1 A and AA rules) on the main pages in both themes and both modes.
// Usage: node scripts/a11y-audit.mjs [baseUrl]   (default http://localhost:3210, a production build)
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const base = process.argv[2] ?? 'http://localhost:3210';
const pages = ['/', '/start', '/business', '/learn', '/business/eoq', '/learn/eoq', '/business/safety-stock-combined', '/learn/safety-stock-combined', '/business/mms', '/learn/decision-tree', '/business/wizard', '/learn/wizard', '/business/plan-builder', '/business/wrapped', '/learn/paste', '/learn/practice', '/learn/practice/newsvendor', '/learn/exam/inv-service', '/learn/formula-sheet/forecast', '/map', '/verified', '/pricing', '/login', '/admin', '/embed-builder', '/embed/eoq', '/about', '/faq', '/privacy'];
const browser = await chromium.launch(); let total = 0; const summary = new Map();
for (const theme of ['dark', 'light']) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript((t) => { try { localStorage.setItem('lotwise:v1', JSON.stringify({ state: { theme: t, mode: 'business' }, version: 0 })); } catch {} }, theme);
  const page = await ctx.newPage();
  for (const p of pages) {
    await page.goto(base + p, { waitUntil: 'networkidle' }); await page.waitForTimeout(400);
    await page.evaluate(axeSource);
    const res = await page.evaluate(async () => (window).axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, resultTypes: ['violations'] }));
    for (const v of res.violations) { total += v.nodes.length; const key = `${v.id} (${v.impact})`; const e = summary.get(key) ?? { help: v.help, where: [] }; e.where.push(`${theme} ${p}: ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}${v.nodes[0]?.failureSummary ? ' :: ' + v.nodes[0].failureSummary.split('\n').slice(1, 2).join(' ').slice(0, 140) : ''}`); summary.set(key, e); }
  }
  await ctx.close();
}
await browser.close();
if (!summary.size) console.log(`No WCAG 2.1 A/AA violations on ${pages.length} pages in dark and light themes.`);
for (const [k, v] of summary) { console.log(`\n${k}: ${v.help}`); for (const w of v.where.slice(0, Number(process.env.AXE_MAX ?? 6))) console.log('  ' + w); if (v.where.length > Number(process.env.AXE_MAX ?? 6)) console.log(`  ...and ${v.where.length - Number(process.env.AXE_MAX ?? 6)} more pages`); }
process.exit(summary.size ? 1 : 0);
