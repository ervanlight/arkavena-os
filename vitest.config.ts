import { defineConfig } from 'vitest/config';

/**
 * Two projects, deliberately separated:
 *
 *   unit -- pure logic. No database, no browser, no network. `pnpm test` runs
 *           only these, so the fast feedback loop stays fast and, more
 *           importantly, a stopped Docker daemon can never turn the domain
 *           suite red. A test that fails for environmental reasons teaches
 *           people to ignore red, which is how a test suite dies.
 *   db   -- integration tests against local Supabase, run by `pnpm test:db`.
 *           These prove the second enforcement layer -- triggers, constraints,
 *           RLS -- actually holds, which is the point of ARCHITECTURE.md 0.2.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    projects: [
      {
        resolve: { tsconfigPaths: true },
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
        },
      },
      {
        resolve: { tsconfigPaths: true },
        test: {
          name: 'db',
          environment: 'node',
          include: ['supabase/tests/**/*.test.ts'],
          // Migrations and RLS tests share one local database; running the
          // files in parallel would let one suite observe another's state.
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/core/**', 'src/modules/*/domain/**'],
      reporter: ['text', 'lcov'],
    },
  },
});
