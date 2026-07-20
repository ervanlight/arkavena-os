import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

/**
 * Two projects, deliberately separated:
 *
 *   unit -- pure logic. No database, no browser, no network. `pnpm test` runs
 *           only these, so the fast feedback loop stays fast and a broken
 *           Docker daemon can never make domain tests "fail".
 *   db   -- integration tests against local Supabase. Run by `pnpm test:db`.
 *           These prove the second enforcement layer (triggers, constraints,
 *           RLS) actually holds, which is the whole point of ARCHITECTURE.md 0.2.
 */
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    projects: [
      {
        plugins: [tsconfigPaths()],
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
        },
      },
      {
        plugins: [tsconfigPaths()],
        test: {
          name: 'db',
          environment: 'node',
          include: ['supabase/tests/**/*.test.ts'],
          // Migrations and RLS tests share one local database; running them in
          // parallel would let one suite see another's uncommitted state.
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
