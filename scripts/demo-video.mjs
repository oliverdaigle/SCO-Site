// Records the launch demo video: real use of a running production build, with a visible cursor and captions.
// Usage: node scripts/demo-video.mjs [baseUrl]  -> launch-kit/demo-video.mp4 (needs ffmpeg)
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const base = process.argv[2] ?? 'http://localhost:3210';
const dir = mkdtempSync(path.join(tmpdir(), 'lotwise-video-'));
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir, size: { width: 1280, height: 720 } } });
await ctx.addInitScript(() => { try { localStorage.setItem('lotwise:v1', JSON.stringify({ state: { theme: 'dark', mode: 'business' }, version: 0 })); localStorage.setItem('lotwise:map', '3d'); } catch {} });
const page = await ctx.newPage();
const t0 = Date.now(); const marks = [];
let mouse = { x: 640, y: 360 };

async function overlay() {
  await page.addStyleTag({ content: `.no-print.border-b.border-line.bg-raised.text-xs{display:none!important}
    #lw-cur{position:fixed;left:0;top:0;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:rgba(255,255,255,.92);box-shadow:0 0 0 3px rgba(142,155,255,.55),0 4px 14px rgba(0,0,0,.5);z-index:2147483647;pointer-events:none;transition:left .09s linear,top .09s linear,transform .12s ease}
    #lw-cur.down{transform:scale(.7)}
    #lw-cap{position:fixed;left:50%;bottom:34px;transform:translateX(-50%);max-width:88%;padding:12px 22px;border-radius:999px;background:rgba(9,11,16,.86);border:1px solid rgba(255,255,255,.16);color:#edeff5;font:600 22px/1.3 "Geist Variable",system-ui,sans-serif;letter-spacing:-.01em;z-index:2147483646;pointer-events:none;box-shadow:0 12px 40px rgba(0,0,0,.45);transition:opacity .35s ease;text-align:center}` });
  await page.evaluate(({ x, y }) => {
    if (!document.getElementById('lw-cur')) { const c = document.createElement('div'); c.id = 'lw-cur'; document.body.appendChild(c); addEventListener('mousemove', (e) => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }, true); addEventListener('mousedown', () => c.classList.add('down'), true); addEventListener('mouseup', () => c.classList.remove('down'), true); }
    const c = document.getElementById('lw-cur'); c.style.left = x + 'px'; c.style.top = y + 'px';
    if (!document.getElementById('lw-cap')) { const k = document.createElement('div'); k.id = 'lw-cap'; k.style.opacity = '0'; document.body.appendChild(k); }
  }, mouse);
}
async function caption(text) { marks.push([(Date.now() - t0) / 1000, text]); await page.evaluate((t) => { const k = document.getElementById('lw-cap'); if (!k) return; k.style.opacity = '0'; setTimeout(() => { k.textContent = t; k.style.opacity = t ? '1' : '0'; }, 200); }, text); }
// Few real mouse steps (each one costs a full repaint while recording); CSS easing on the cursor fills in the motion.
async function glide(x, y, ms = 600) { const steps = Math.max(6, Math.round(ms / 55)); await page.mouse.move(x, y, { steps }); mouse = { x, y }; }
async function glideTo(locator, ms) { const b = await locator.boundingBox(); await glide(b.x + b.width / 2, b.y + b.height / 2, ms); return b; }
async function clickOn(locator, ms = 600) { await locator.scrollIntoViewIfNeeded(); await glideTo(locator, ms); await page.waitForTimeout(120); await page.mouse.down(); await page.waitForTimeout(90); await page.mouse.up(); }
async function scrollBy(dy, steps = 12) { for (let i = 0; i < steps; i++) { await page.mouse.wheel(0, dy / steps); await page.waitForTimeout(28); } }
async function go(url) { await page.goto(base + url, { waitUntil: 'networkidle' }); await overlay(); }
const wait = (ms) => page.waitForTimeout(ms);

// 1. Landing
await go('/'); const start = (Date.now() - t0) / 1000; await page.mouse.move(mouse.x, mouse.y);
await caption('93 supply chain calculators. Every formula verified.'); await wait(2900);
// 2. Plain-language search
await caption('Describe the problem in plain words');
await clickOn(page.getByRole('button', { name: /Try “I keep running out of stock”/ }), 700); await wait(400);
await page.keyboard.type('running out of stock', { delay: 35 }); await wait(500);
await clickOn(page.locator('#cmd-list [role="option"]', { hasText: /Variable Demand and Lead Time|both sales and delivery/i }).first(), 650);
await page.waitForURL(/safety-stock-combined/); await overlay(); await wait(500);
// 3. Business answer, live update, what-if
await caption('The answer comes first, with what it means and what to do'); await wait(3000);
await caption('Change a number and everything updates');
const demand = page.locator('#f-safety-stock-combined-d'); await clickOn(demand, 600); await page.keyboard.press('Control+A'); await page.keyboard.type('220', { delay: 140 }); await wait(1900);
await caption('Drag a slider to test what-ifs');
const slider = page.locator('section:has-text("What if things change?") input[type="range"]').first();
await slider.scrollIntoViewIfNeeded(); await wait(500); const sb = await slider.boundingBox();
await glide(sb.x + sb.width / 2, sb.y + sb.height / 2, 600); await page.mouse.down(); await glide(sb.x + sb.width * 0.82, sb.y + sb.height / 2, 1100); await page.mouse.up(); await wait(2000);
// 4. Learner mode
await caption('Learner mode shows every step, in your textbook’s notation');
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' })); await wait(700);
await clickOn(page.getByRole('radio', { name: 'Learner' }).first(), 600); await page.waitForURL(/\/learn\//); await overlay(); await wait(900);
await scrollBy(560, 18); await wait(1000); await scrollBy(380, 14); await wait(1900);
// 5. Plan Builder
await go('/business/plan-builder'); await caption('Upload sales history. Get a policy for every SKU.'); await wait(700);
await clickOn(page.getByRole('button', { name: /Sneaker resale store/ }), 650); await wait(1400);
const table = page.locator('table').first(); const tb = await table.boundingBox(); await scrollBy(tb.y - 130, 18); await wait(700);
await glideTo(page.locator('tbody tr').nth(2), 700); await wait(2200);
// 6. Formula Map
await go('/map'); await caption('See how all 93 formulas connect'); await wait(600);
await scrollBy(330, 12); await wait(2300);
await clickOn(page.getByRole('button', { name: /From forecast error to reorder point/ }), 700); await wait(2600);
// 7. Verified
await go('/verified'); await caption('Tested against independent code and 146 million simulated trials'); await wait(2500);
await scrollBy(520, 16); await wait(1600);
await caption('Free at lotwise.io'); await wait(2700);
const end = (Date.now() - t0) / 1000;

const video = page.video(); await ctx.close(); await browser.close();
const webm = await video.path();
const out = path.resolve('launch-kit/demo-video.mp4');
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(Math.max(0, start - 0.2)), '-to', String(end), '-i', webm, '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', out]);
rmSync(dir, { recursive: true, force: true });
console.log(`saved ${out}: ${(end - start).toFixed(1)} s`); for (const [t, c] of marks) console.log(`  ${(t - start).toFixed(1).padStart(5)} s  ${c}`);
