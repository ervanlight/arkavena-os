import { URL, fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * `server-only` (imported at the top of every repository/action/session file,
 * per ARCHITECTURE.md's server/client boundary) resolves to a module that
 * unconditionally throws unless the `react-server` export condition is set --
 * Next's own webpack build sets it, Vitest's plain Node resolution does not.
 * Aliasing straight to the package's own `empty.js` (the same file that
 * condition would have picked) is the minimal fix: it does not touch how any
 * other package resolves, unlike flipping resolve.conditions globally, which
 * would also repoint React itself at its very different react-server build.
 */
const serverOnlyStub = fileURLToPath(
  new URL('./node_modules/server-only/empty.js', import.meta.url),
);

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
        resolve: { tsconfigPaths: true, alias: { 'server-only': serverOnlyStub } },
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
      include: ['src/core/**/*.ts', 'src/modules/*/domain/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.test.tsx'],
      reporter: ['text', 'lcov'],
    },
  },
});
