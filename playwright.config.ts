import { defineConfig, devices } from '@playwright/test';

// Local runs read .env.local the same way `next dev` does (Node 20.6+'s
// built-in loader, no dotenv dependency needed); CI sets these as real
// workflow env vars instead, so a missing file there is expected, not an
// error.
try {
  process.loadEnvFile('.env.local');
} catch {
  // No .env.local -- CI's case, where the workflow already exported these.
}

/**
 * E2E harness for the 3 critical flows ARCHITECTURE.md 4.5 / CLAUDE.md 8
 * name explicitly. Runs against whichever Supabase project is configured
 * via .env.local (cloud dev, per ADR 0006) locally, or the local ephemeral
 * Supabase the CI runner starts (ci.yml's `e2e` job) -- e2e/support/db.ts
 * and factories.ts are the same files supabase/tests/ already uses, so
 * fixtures never depend on seed data or another test's leftovers.
 *
 * fullyParallel is false and workers is 1: specs share one database and
 * each cleans up its own organisation at the end, so two specs running at
 * once could see each other's half-built fixtures mid-test.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  timeout: 60_000,
  use: {
    baseURL: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm dev',
    url: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
