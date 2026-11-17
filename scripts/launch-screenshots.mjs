// Takes the five launch-kit screenshots at 2x from a running production build.
// Usage: node scripts/launch-screenshots.mjs [baseUrl]   (default http://localhost:3210)
import { chromium } from 'playwright';
const base = process.argv[2] ?? 'http://localhost:3210'; const out = 'launch-kit/screenshots';
const browser = await chromium.launch();
async function shot(name, { theme = 'dark', mode = 'business', path, prep, clip, width = 1440, height = 900, map }) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, reducedMotion: 'no-preference' });
  await ctx.addInitScript(([t, m, mp]) => { try { localStorage.setItem('lotwise:v1', JSON.stringify({ state: { theme: t, mode: m }, version: 0 })); if (mp) localStorage.setItem('lotwise:map', mp); } catch {} }, [theme, mode, map ?? null]);
  const page = await ctx.newPage(); await page.goto(base + path, { waitUntil: 'networkidle' }); await page.waitForTimeout(700);
  // Launch screenshots show the product as visitors will see it once it is live, so the demo-mode banner is hidden.
  await page.addStyleTag({ content: '.no-print.border-b.border-line.bg-raised.text-xs { display: none !important; }' });
  if (prep) await prep(page);
  await page.screenshot({ path: `${out}/${name}.png`, clip: clip ? await clip(page) : undefined }); await ctx.close(); console.log('saved', name);
}
const below = (sel, pad = 24, h = 900) => async (page) => { const b = await page.locator(sel).first().boundingBox(); const y = Math.max(0, b.y + (await page.evaluate(() => window.scrollY)) - pad); await page.evaluate((yy) => window.scrollTo(0, yy), y); await page.waitForTimeout(600); return { x: 0, y: 0, width: 1440, height: h }; };

await shot('1-landing', { path: '/', prep: async (p) => p.waitForTimeout(800) });
await shot('2-business-answer', { path: '/business/continuous-review', clip: below('h1', 150, 900) });
await shot('3-learner-steps', { path: '/learn/safety-stock-combined', theme: 'light', mode: 'learner', clip: below('section[aria-label="Step-by-step solution"]', 120, 900) });
await shot('4-plan-builder', { path: '/business/plan-builder', prep: async (p) => { await p.getByRole('button', { name: /Sneaker resale store/ }).click(); await p.waitForTimeout(1200); }, clip: below('table', 175, 820) });
await shot('5-formula-map', { path: '/map', map: '3d', prep: async (p) => { await p.waitForTimeout(4500); }, clip: below('canvas', 150, 900) });
await browser.close();
