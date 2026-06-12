import { defineConfig } from '@playwright/test';

// baseURL is overridable so generated specs can run against any app, not just
// the bundled sample-shop. `argus generate --run [--base-url …]` sets this.
const baseURL = process.env.ARGUS_BASE_URL ?? 'http://localhost:3100';
const isSampleShop = baseURL === 'http://localhost:3100';

export default defineConfig({
  testDir: 'tests',
  use: { baseURL },
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
