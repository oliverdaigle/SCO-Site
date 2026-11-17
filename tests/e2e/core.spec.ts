import { expect, test } from '@playwright/test';
import { isMobile, noSideScroll, watchErrors } from './helpers';

test('landing page tells the story and routes into a mode', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Supply chain math');
  await noSideScroll(page);
  // A live mini calculator reacts to its slider
  const mini = page.locator('#stage-warehouse');
  await mini.scrollIntoViewIfNeeded();
  const headline = mini.locator('[aria-live="polite"]').first();
  const before = await headline.textContent();
  await mini.getByRole('slider').first().fill('99');
  await expect(headline).not.toHaveText(before!);
  await page.getByRole('link', { name: 'I’m running a business' }).first().click();
  await expect(page).toHaveURL(/\/business$/);
  expect(errors).toEqual([]);
});

test('first-visit mode choice remembers the mode', async ({ page }) => {
  await page.goto('/start');
  await page.getByRole('button', { name: /I’m learning/ }).click();
  await expect(page).toHaveURL(/\/learn$/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('lotwise:v1')!).state.mode)).toBe('learner');
});

test('business calculator: answer first, live update, math on demand', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/business/eoq');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('How much should I order each time?');
  await expect(page.getByText(/Order 200 units/).first()).toBeVisible();
  await page.locator('#f-eoq-D').fill('4000');
  await expect(page.getByText(/Order 400 units/).first()).toBeVisible();
  await expect(page.getByText('Your answer')).toBeVisible();
  await page.getByText('Show the math').click();
  await expect(page.getByText(/Want every step explained/)).toBeVisible();
  await expect(page.getByRole('link', { name: /Verified/ }).first()).toHaveAttribute('href', '/verified#eoq');
  await noSideScroll(page);
  expect(errors).toEqual([]);
});

test('business calculator rejects bad input with a helpful message', async ({ page }) => {
  await page.goto('/business/eoq');
  await page.locator('#f-eoq-D').fill('-5');
  await expect(page.locator('main [role="alert"]')).toContainText('Check your inputs');
});

test('learner calculator: steps, notation switch, unit mismatch, exam traps', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/learn/safety-stock-combined');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Safety Stock');
  await expect(page.getByText('Common exam traps').first()).toBeVisible();
  const steps = page.locator('section[aria-label="Step-by-step solution"] ol > li');
  expect(await steps.count()).toBeGreaterThanOrEqual(3);
  // Switch the lead time to weeks: the engine converts and explains the mismatch
  await page.locator('#f-safety-stock-combined-L-unit').selectOption('week');
  await expect(page.getByText(/Unit mismatch/).first()).toBeVisible();
  // Notation follows the chosen textbook
  await page.getByLabel('Textbook notation').selectOption('chopra');
  await expect(page.getByLabel('Textbook notation')).toHaveValue('chopra');
  await noSideScroll(page);
  expect(errors).toEqual([]);
});

test('search finds a calculator from a symptom', async ({ page }) => {
  await page.goto('/business');
  await page.getByRole('button', { name: /Search/ }).click();
  const box = page.getByRole('combobox');
  await box.fill('i keep running out of stock');
  await expect(page.locator('#cmd-list')).toContainText(/Safety Stock|buffer stock/i);
  await box.press('Enter');
  await expect(page).toHaveURL(/\/business\/(safety-stock|reorder-point|continuous-review|cycle-service|fill-rate)/);
});

test('keyboard shortcut opens search', async ({ page }) => {
  test.skip(isMobile(page), 'keyboard shortcut is a desktop feature');
  await page.goto('/learn');
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('combobox')).toBeFocused();
  await page.keyboard.type('EOQ');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/learn\/eoq/);
});

test('guided wizard reaches a calculator in both modes', async ({ page }) => {
  for (const base of ['/business', '/learn']) {
    await page.goto(`${base}/wizard`);
    for (let i = 0; i < 6; i++) {
      const open = page.getByRole('link', { name: /Open|Use this|calculator/i }).first();
      const option = page.locator('main ul button.card').first();
      if (await option.count()) await option.click(); else { await open.click(); break; }
      await page.waitForTimeout(150);
    }
    await expect(page.locator('main')).toContainText(/calculator|model|Open/i);
  }
});

test('header mode toggle keeps the calculator', async ({ page }) => {
  await page.goto('/business/newsvendor');
  if (isMobile(page)) await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('radio', { name: 'Learner' }).first().click();
  await expect(page).toHaveURL(/\/learn\/newsvendor/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Newsvendor');
});

test('theme toggle switches to light and persists', async ({ page }) => {
  await page.goto('/business');
  await page.getByRole('button', { name: /Switch to light theme/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('share link restores the exact inputs', async ({ page }) => {
  const v = Buffer.from(JSON.stringify({ D: 4000 })).toString('base64url');
  await page.goto(`/s/business/eoq?v=${v}`);
  await expect(page.locator('#f-eoq-D')).toHaveValue('4000');
  await expect(page.getByText(/Order 400 units/).first()).toBeVisible();
});
