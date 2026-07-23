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

/**
 * `pnpm db:types` generates against Supabase Cloud dev (`--project-id`, ADR
 * 0006); this script generates against the CI-local ephemeral stack
 * (`--local`). The two code paths in the Supabase CLI are confirmed (by
 * running both and diffing) to differ in exactly one place regardless of
 * schema content: `--project-id` emits a two-line explanatory comment plus
 * a `__InternalSupabase: { PostgrestVersion: "..." }` block right after
 * `export type Database = {`; `--local` emits neither. Nothing in this
 * codebase reads that field (it exists only to let `createClient<Database>`
 * infer a PostgREST version), so the whole comment+block is stripped from
 * both sides before comparing -- a real schema drift still fails this
 * check; this specific, understood formatting difference no longer does.
 */
function stripInternalSupabaseBlock(source: string): string {
  return source.replace(
    /\n(\s*\/\/ Allows to automatically instantiate.*\n\s*\/\/ instead of createClient.*\n)?\s*__InternalSupabase:\s*\{[^}]*\}\n/,
    '\n',
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
  const committedNormalised = stripInternalSupabaseBlock(committed).trimEnd();
  const freshNormalised = stripInternalSupabaseBlock(fresh).trimEnd();

  if (freshNormalised === committedNormalised) {
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
      'First differing lines (committed vs freshly generated --local, both with the __InternalSupabase header stripped):\n\n' +
      diffPreview(committedNormalised, freshNormalised) +
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
