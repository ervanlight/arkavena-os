/**
 * Fails if the committed database types no longer match the schema
 * (ARCHITECTURE.md 3, rule 5).
 *
 * The type chain runs one way: migrations produce the schema, the schema
 * produces `database.types.ts`, and every domain type derives from that. The
 * chain is only worth anything if the generated file is current. A stale one is
 * worse than none: it compiles, so a renamed column keeps type-checking against
 * a name the database no longer has, and the failure moves from compile time to
 * a user's screen.
 *
 * Requires a running local Supabase.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const TARGET = resolve(ROOT, 'src/core/db/database.types.ts');

function generate(): string {
  return execFileSync(
    'pnpm',
    ['exec', 'supabase', 'gen', 'types', 'typescript', '--local', '--schema', 'public'],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
  );
}

function main(): void {
  let committed: string;
  try {
    committed = readFileSync(TARGET, 'utf8');
  } catch {
    process.stderr.write(
      `${TARGET} is missing. Run: pnpm db:types\n`,
    );
    process.exitCode = 1;
    return;
  }

  const fresh = generate();

  // Normalise trailing whitespace only; any real difference should fail.
  if (fresh.trimEnd() === committed.trimEnd()) {
    process.stdout.write('database.types.ts is up to date with the schema.\n');
    return;
  }

  process.stderr.write(
    'database.types.ts does not match the current schema.\n\n' +
      'A migration changed the database without the generated types being\n' +
      'regenerated. Run:\n\n' +
      '    pnpm db:types\n\n' +
      'and commit the result. Do not edit the file by hand -- it is generated,\n' +
      'and hand-edits are overwritten the next time anyone runs the command.\n\n' +
      'First differing lines (committed vs freshly generated --local):\n\n' +
      diffPreview(committed, fresh) +
      '\n',
  );
  process.exitCode = 1;
}

/** A minimal line-by-line diff preview -- enough to tell a formatting quirk from a real schema drift without pulling in a diff library. */
function diffPreview(committed: string, fresh: string, maxLines = 40): string {
  const committedLines = committed.split('\n');
  const freshLines = fresh.split('\n');
  const out: string[] = [];
  const max = Math.max(committedLines.length, freshLines.length);

  for (let i = 0; i < max && out.length < maxLines; i++) {
    const a = committedLines[i];
    const b = freshLines[i];
    if (a !== b) {
      out.push(`  line ${i + 1}:`);
      out.push(`    committed: ${a === undefined ? '<missing>' : JSON.stringify(a)}`);
      out.push(`    fresh:     ${b === undefined ? '<missing>' : JSON.stringify(b)}`);
    }
  }

  if (out.length === 0) return '  (no line-level difference found -- likely a trailing-whitespace-only mismatch)\n';
  return out.join('\n') + '\n';
}

main();
