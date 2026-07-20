# BuildTrust OS

Controlled construction delivery system. Next.js App Router · TypeScript ·
Tailwind · Supabase (Postgres/Auth/Storage).

## Read these first

Two documents govern this repository. They are contracts, not suggestions.

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — the *why*: folder structure, migration
  waves, type flow, business-logic isolation, audit and permission model, build
  sequence, and the ten locked owner decisions in §9.
- [`CLAUDE.md`](CLAUDE.md) — the *rules*, in directly enforceable form. §0 is the
  list of laws that must never be broken.

The shortest version of both: money is `bigint` rupiah and never a float;
critical logic lives in `modules/*/domain/` as pure functions; every money,
approval, and override rule is enforced in the database as well as in code; and
no table ships without RLS.

## Current phase

**Fase 0 — Scaffold & Kernel.** Ends at CHECKPOINT #1 (`ARCHITECTURE.md` §7).
Later phases do not start until the previous phase's exit criteria are green in
CI.

## Setup

Development targets the shared Supabase Cloud dev project
(`buildtrust-os-dev`) directly — **not** a local Docker stack (see
[ADR 0006](docs/decisions/0006-cloud-dev-database-instead-of-local.md)). CI is
unaffected and still runs its own ephemeral local Supabase inside the GitHub
Actions runner.

```
corepack enable
pnpm install
cp .env.example .env.local   # fill in from the Supabase dashboard
pnpm db:push                 # apply migrations to the dev project (no login needed, uses --db-url)
pnpm db:types                # regenerate types (needs SUPABASE_ACCESS_TOKEN -- see ADR 0006 addendum)
pnpm dev
```

The dev project is shared, mutable state, not a fresh database per run — there
is no local reset to fall back on. `test:db` cleans up what it creates, but
treat the project as disposable, not as a source of truth for anything that
matters.

## Commands

```
pnpm dev            # Next.js dev server
pnpm db:push        # apply pending migrations, via --db-url (needs SUPABASE_DB_URL)
pnpm db:types       # regenerate core/db/database.types.ts, via the Management API
                    #   (needs SUPABASE_ACCESS_TOKEN -- see ADR 0006 addendum: --db-url
                    #   would try to run postgres-meta in a container instead)
pnpm gen:rls-check  # verify matrix.ts and pg_policies agree (needs SUPABASE_DB_URL)
pnpm test           # unit tests (Vitest) -- no database needed
pnpm test:db        # integration + RLS tests, against SUPABASE_DB_URL
pnpm test:e2e       # Playwright
pnpm lint           # ESLint, including import boundaries
pnpm typecheck      # tsc --noEmit
```

CI runs lint, typecheck, the `db:types` diff check, `gen:rls-check`, `test`, and
`test:db` — all against its own ephemeral local Supabase, unrelated to the
shared dev project above. All must be green before merge.
