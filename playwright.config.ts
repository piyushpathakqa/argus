import { defineConfig } from '@playwright/test';

// baseURL is overridable so generated specs can run against any app, not just
// the bundled sample-shop. `argus generate --run [--base-url …]` sets this.
const baseURL = process.env.ARGUS_BASE_URL ?? 'http://localhost:3100';
const isSampleShop = baseURL === 'http://localhost:3100';
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: 'tests',
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    // Artifacts for the Triage behavior (M3) — captured on failure / first retry.
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  // Only auto-start the bundled sample-shop when we're actually targeting it.
  ...(isSampleShop
    ? {
        webServer: {
          command: 'pnpm --filter @argus/sample-shop dev',
          url: 'http://localhost:3100',
          reuseExistingServer: true,
          timeout: 120_000,
        },
      }
    : {}),
});
