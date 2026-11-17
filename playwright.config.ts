import { defineConfig, devices } from '@playwright/test';

// End-to-end tests run against a production build in demo mode (no keys), on a desktop and a phone profile.
const PORT = 3210;
export default defineConfig({
  testDir: 'tests/e2e', timeout: 60_000, expect: { timeout: 10_000 }, fullyParallel: true, workers: 3, retries: 0, reporter: [['list']],
  use: { baseURL: process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`, trace: 'off' },
  webServer: process.env.E2E_BASE_URL ? undefined : { command: `npm run build && npx next start -p ${PORT}`, url: `http://localhost:${PORT}`, reuseExistingServer: true, timeout: 600_000 },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'] } }, { name: 'mobile', use: { ...devices['Pixel 7'] } }],
});
