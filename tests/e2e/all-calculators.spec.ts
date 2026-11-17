import { expect, test } from '@playwright/test';
import { CALCS } from '../../packages/engine/src/index';
import { watchErrors } from './helpers';

// Every calculator page, in both modes, is server-rendered with its own title, description, and structured data.
test('all calculators are served in both modes with unique SEO metadata', async ({ request }) => {
  test.setTimeout(240_000);
  const titles = new Set<string>();
  for (const c of CALCS) for (const base of ['business', 'learn']) {
    const res = await request.get(`/${base}/${c.id}`); expect(res.status(), `${base}/${c.id}`).toBe(200);
    const html = await res.text(); const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
    expect(title.length, `${base}/${c.id} title`).toBeGreaterThan(10); expect(titles.has(title), `duplicate title: ${title}`).toBe(false); titles.add(title);
    expect(html).toContain('application/ld+json'); expect(html).toContain('FAQPage'); expect(html).toContain('HowTo'); expect(html).toMatch(/<link rel="canonical"/);
    expect(html).toMatch(/<h1/);
  }
  expect(titles.size).toBe(CALCS.length * 2);
});

// A spread of calculators with every kind of visual, opened in a real browser in each mode.
const SAMPLE = ['eoq', 'quantity-discount', 'safety-stock-combined', 'newsvendor', 'abc-classification', 'holt-winters', 'bottleneck', 'line-balancing', 'mms', 'xbar-r-chart', 'mrp-gross-to-net', 'aggregate-planning', 'center-of-gravity', 'supplier-scorecard', 'dupont-roa', 'cpm', 'crashing', 'decision-tree'];
for (const id of SAMPLE) {
  test(`renders without errors: ${id}`, async ({ page }) => {
    const errors = watchErrors(page);
    for (const base of ['business', 'learn']) {
      await page.goto(`/${base}/${id}`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.locator('main [role="alert"]')).toHaveCount(0); // Next's route announcer also uses role=alert, outside main
      await expect(page.locator('section[aria-label="Live visual"]')).toBeVisible();
      const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
      expect(sw, `${base}/${id} must not scroll sideways`).toBeLessThanOrEqual(cw + 1);
    }
    expect(errors).toEqual([]);
  });
}

test('sitemap and robots are served', async ({ request }) => {
  const sm = await (await request.get('/sitemap.xml')).text();
  expect((sm.match(/<loc>/g) ?? []).length).toBeGreaterThan(CALCS.length * 2);
  expect(await (await request.get('/robots.txt')).text()).toContain('Sitemap:');
  expect((await request.get('/api/og?c=eoq&m=business')).headers()['content-type']).toContain('image/png');
});

// Every calculator in both modes at phone width: no sideways scrolling, no input errors on the default values.
test('every calculator fits a phone screen in both modes', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 1280) > 700, 'phone layout check');
  test.setTimeout(300_000); const bad: string[] = [];
  for (const c of CALCS) for (const base of ['business', 'learn']) {
    await page.goto(`/${base}/${c.id}`, { waitUntil: 'load' });
    await page.getByRole('heading', { level: 1 }).waitFor();
    const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    if (sw > cw + 1) bad.push(`${base}/${c.id}: ${sw}px wide on a ${cw}px screen`);
    if (await page.locator('main [role="alert"]').count()) bad.push(`${base}/${c.id}: default inputs show an error`);
  }
  expect(bad).toEqual([]);
});
