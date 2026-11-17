import { expect, type Page } from '@playwright/test';

/** Fails the test on any uncaught error or console error while it runs. */
export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  return errors;
}
export async function noSideScroll(page: Page) {
  const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  expect(sw, 'page must not scroll sideways').toBeLessThanOrEqual(cw + 1);
}
export const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1280) < 700;
