import { expect, test } from '@playwright/test';
import { noSideScroll, watchErrors } from './helpers';

test('Plan Builder: sample data to a policy for every SKU, with Excel export', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/business/plan-builder');
  await page.getByRole('button', { name: /Coffee shop/ }).click();
  await expect(page.getByRole('button', { name: /Export to Excel/ })).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('table').first()).toContainText(/Reorder|ROP/i);
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Export to Excel/ }).click()]);
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  await noSideScroll(page);
  expect(errors).toEqual([]);
});

test('Wrapped shows story cards for a sample dataset', async ({ page }) => {
  await page.goto('/business/wrapped');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Wrapped');
  await noSideScroll(page);
});

test('Paste Your Problem reads a problem, shows what it found, and solves it', async ({ page }) => {
  await page.goto('/learn/paste');
  await page.locator('#problem').fill('A hospital uses 1,000 boxes of gloves per year. The ordering cost is $10 per order and the holding cost is $0.50 per box per year. What is the economic order quantity?');
  await page.getByRole('button', { name: 'Read my problem' }).click();
  await expect(page.getByText('This looks like')).toBeVisible();
  await expect(page.locator('main')).toContainText('Economic Order Quantity');
  await expect(page.locator('main')).toContainText('1,000');
});

test('practice: a wrong answer gets feedback and a worked solution', async ({ page }) => {
  await page.goto('/learn/practice/eoq');
  await page.locator('input[inputmode="decimal"]').first().fill('1');
  await page.getByRole('button', { name: 'Check answer' }).click();
  await expect(page.locator('main')).toContainText(/Not quite|try|close|incorrect|again/i);
  await page.getByRole('button', { name: /Show me the sol/ }).click();
  await expect(page.locator('section[aria-label="Step-by-step solution"]')).toBeVisible();
});

test('exam review and formula sheet load for a chapter', async ({ page }) => {
  await page.goto('/learn/exam/inv-order');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Exam review');
  await page.goto('/learn/formula-sheet/inv-service');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Formula sheet');
});

test('Formula Map lists every calculator and has a 2D fallback', async ({ page }) => {
  await page.goto('/map');
  await page.getByRole('radio', { name: '2D' }).click();
  await expect(page.locator('svg[aria-label^="Formula Map"]')).toBeVisible();
  await page.getByText(/All 93 calculators as a list/).click();
  await expect(page.locator('details a[href^="/"]')).toHaveCount(93);
  await page.getByRole('button', { name: /How much to order/ }).click();
  await expect(page.locator('main ol')).toContainText('Economic Order Quantity');
});

test('upgrade flow in demo mode: pricing, simulated checkout, account', async ({ page }) => {
  await page.goto('/pricing');
  await page.getByRole('button', { name: 'Get Business Pro' }).click();
  await expect(page).toHaveURL(/\/checkout\?plan=business_monthly/);
  await page.getByRole('button', { name: /Pay \$12/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Business Pro is on');
  await page.goto('/account');
  await expect(page.locator('main')).toContainText('Active');
});

test('free tier shows upgrade prompts where Pro features would be', async ({ page }) => {
  await page.goto('/learn/eoq');
  await page.getByRole('switch', { name: /Toggle Pro features/ }).click();
  await expect(page.locator('main')).toContainText(/Learner Pro/);
  await page.goto('/business/eoq');
  await expect(page.locator('main')).toContainText(/Business Pro/);
});

test('sign-in is simulated in demo mode', async ({ page }) => {
  await page.goto('/login');
  await page.locator('#login-email').fill('pat@example.com');
  await page.getByRole('button', { name: 'Email me a sign-in link' }).click();
  await page.getByRole('button', { name: 'Open the magic link' }).click();
  await expect(page).toHaveURL(/\/account/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Hi, Pat');
});

test('Verified page is generated from the test run and opens the linked calculator', async ({ page }) => {
  await page.goto('/verified#eoq');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('93 calculators pass');
  await expect(page.locator('details#eoq')).toHaveAttribute('open', '');
  await expect(page.locator('details')).toHaveCount(93);
});

test('embed renders a themed widget with a backlink', async ({ page }) => {
  await page.goto('/embed/eoq?theme=light&mode=learner&accent=34d3be');
  await expect(page.getByRole('link', { name: /Powered by Lotwise/ })).toHaveAttribute('href', /\/learn\/eoq/);
  await expect(page.locator('[data-theme="light"]')).toBeVisible();
  await page.goto('/embed-builder?calc=newsvendor');
  await expect(page.locator('pre')).toContainText('/embed/newsvendor');
});

test('owner dashboard shows the funnel in demo mode', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.locator('main')).toContainText('Conversion funnel');
  await expect(page.locator('main')).toContainText('Searches with no match');
  await noSideScroll(page);
});
