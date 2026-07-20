/**
 * Proves the import boundaries in eslint.config.mjs actually reject what they
 * claim to reject.
 *
 * ARCHITECTURE.md 1.2 and CLAUDE.md law 2 are only real if the linter enforces
 * them. A config that silently stopped matching -- a renamed folder, a plugin
 * upgrade changing selector semantics -- would look exactly like a clean lint
 * run. So this script writes files that break each rule on purpose, asserts
 * ESLint flags every one, and removes them again.
 *
 * The fixtures live at real paths under src/ because that is how the plugin
 * classifies files. They are written and deleted within this process; the
 * cleanup runs even if an assertion throws.
 */
import { ESLint } from 'eslint';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const MODULE_A = 'src/modules/zz-fixture-a';
const MODULE_B = 'src/modules/zz-fixture-b';

type Fixture = {
  /** What architectural rule this proves. Printed in the report. */
  name: string;
  path: string;
  content: string;
  /** Rule that must fire. `null` means the file must produce no errors at all. */
  expect: string | null;
};

const BOUNDARIES = 'boundaries/dependencies';

const fixtures: Fixture[] = [
  // --- Support files the violations import. Must themselves be clean. ---
  {
    name: 'support: fixture module B public API',
    path: `${MODULE_B}/index.ts`,
    content: `export const bPublic = 'b';\n`,
    expect: null,
  },
  {
    name: 'support: fixture module B internal repository',
    path: `${MODULE_B}/data/repo.ts`,
    content: `export const bInternal = 'b-internal';\n`,
    expect: null,
  },

  // --- domain/ must stay pure (CLAUDE.md 0.2) ---
  {
    name: 'domain/ may not import Supabase',
    path: `${MODULE_A}/domain/uses-supabase.ts`,
    content: `import { createClient } from '@supabase/supabase-js';\nexport const c = createClient;\n`,
    expect: BOUNDARIES,
  },
  {
    name: 'domain/ may not import React',
    path: `${MODULE_A}/domain/uses-react.ts`,
    content: `import { useState } from 'react';\nexport const s = useState;\n`,
    expect: BOUNDARIES,
  },
  {
    name: 'domain/ may not import Next',
    path: `${MODULE_A}/domain/uses-next.ts`,
    content: `import { redirect } from 'next/navigation';\nexport const r = redirect;\n`,
    expect: BOUNDARIES,
  },
  {
    name: 'domain/ may not import node builtins',
    path: `${MODULE_A}/domain/uses-node-fs.ts`,
    content: `import { readFileSync } from 'node:fs';\nexport const f = readFileSync;\n`,
    expect: BOUNDARIES,
  },
  {
    name: 'domain/ may not reach into core beyond money and errors',
    path: `${MODULE_A}/domain/uses-core-db.ts`,
    content: `import { ERROR_CODES } from '@/core/db/enums';\nexport const e = ERROR_CODES;\n`,
    expect: BOUNDARIES,
  },
  {
    name: 'domain/ must be deterministic: no ambient clock',
    path: `${MODULE_A}/domain/uses-clock.ts`,
    content: `export function stamp(): number {\n  return Date.now();\n}\n`,
    expect: 'no-restricted-properties',
  },

  // --- Module ownership (ARCHITECTURE.md 1.2) ---
  {
    name: "a module may not import another module's internals",
    path: `${MODULE_A}/data/cross-module.ts`,
    content: `import { bInternal } from '@/modules/zz-fixture-b/data/repo';\nexport const x = bInternal;\n`,
    expect: BOUNDARIES,
  },
  {
    name: "app/ may not import a module's internals",
    path: `src/app/zz-fixture/page.tsx`,
    content: `import { bInternal } from '@/modules/zz-fixture-b/data/repo';\nexport default function P() {\n  return null as unknown as JSX.Element & typeof bInternal;\n}\n`,
    expect: BOUNDARIES,
  },
  {
    name: 'core may not import a domain module',
    path: `src/core/zz-fixture-bad.ts`,
    content: `import { bPublic } from '@/modules/zz-fixture-b';\nexport const x = bPublic;\n`,
    expect: BOUNDARIES,
  },

  // --- Money stays bigint (CLAUDE.md 0.1) ---
  {
    name: 'a rupiah amount may not be widened to Number',
    path: `${MODULE_A}/data/widen-money.ts`,
    content: `export function bad(contractAmount: bigint): number {\n  return Number(contractAmount);\n}\n`,
    expect: 'no-restricted-syntax',
  },

  // --- Positive control: the allowed path must stay allowed. ---
  {
    name: 'control: domain/ may import core/money',
    path: `${MODULE_A}/domain/ok.ts`,
    content: `import { addRp, toRupiah } from '@/core/money/rupiah';\nexport const sum = addRp(toRupiah(1n), toRupiah(2n));\n`,
    expect: null,
  },
  {
    name: "control: app/ may import a module's public index.ts",
    path: `src/app/zz-fixture-ok/page.tsx`,
    // A genuine value import, not a type-only one -- consistent-type-imports
    // would flag a type-only import and be mistaken for a boundaries failure.
    content: `import { bPublic } from '@/modules/zz-fixture-b';\nexport default function P() {\n  console.log(bPublic);\n  return null;\n}\n`,
    expect: null,
  },
];

function write(fixture: Fixture): string {
  const full = join(ROOT, fixture.path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, fixture.content, 'utf8');
  return full;
}

function cleanup(): void {
  for (const dir of [
    join(ROOT, MODULE_A),
    join(ROOT, MODULE_B),
    join(ROOT, 'src/app/zz-fixture'),
    join(ROOT, 'src/app/zz-fixture-ok'),
    join(ROOT, 'src/core/zz-fixture-bad.ts'),
  ]) {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  const paths = fixtures.map(write);
  const eslint = new ESLint({ cwd: ROOT });
  const results = await eslint.lintFiles(paths);

  const byPath = new Map(results.map((r) => [r.filePath, r]));
  const failures: string[] = [];

  fixtures.forEach((fixture, i) => {
    const result = byPath.get(paths[i]!);
    const messages = result?.messages ?? [];
    const ruleIds = messages.filter((m) => m.severity === 2).map((m) => m.ruleId);

    if (fixture.expect === null) {
      if (ruleIds.length > 0) {
        failures.push(
          `  ${fixture.name}\n    expected no errors, got: ${ruleIds.join(', ')}\n` +
            messages.map((m) => `      ${m.ruleId}: ${m.message}`).join('\n'),
        );
      } else {
        process.stdout.write(`  ok    ${fixture.name}\n`);
      }
      return;
    }

    if (ruleIds.includes(fixture.expect)) {
      process.stdout.write(`  ok    ${fixture.name}\n`);
    } else {
      failures.push(
        `  ${fixture.name}\n    expected rule "${fixture.expect}" to fire, got: ` +
          `${ruleIds.length > 0 ? ruleIds.join(', ') : '(no errors at all)'}`,
      );
    }
  });

  if (failures.length > 0) {
    process.stderr.write(
      `\nBoundary enforcement is not doing its job. ${failures.length} of ${fixtures.length} checks failed:\n\n` +
        failures.join('\n\n') +
        '\n\nThese rules are what keep ARCHITECTURE.md true. Fix eslint.config.mjs\n' +
        'rather than adjusting this script to match the broken behaviour.\n',
    );
    process.exitCode = 1;
    return;
  }

  process.stdout.write(`\nAll ${fixtures.length} boundary checks hold.\n`);
}

try {
  await main();
} finally {
  cleanup();
}
