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

```
corepack enable
pnpm install
supabase start          # needs a running Docker daemon
pnpm db:reset           # migrate + seed
pnpm dev
```

## Commands

```
pnpm dev            # Next.js dev server
pnpm db:types       # regenerate core/db/database.types.ts from the schema
pnpm db:migrate     # apply migrations locally
pnpm db:reset       # reset + migrate + seed
pnpm gen:rls-check  # verify matrix.ts and pg_policies agree
pnpm test           # unit tests (Vitest)
pnpm test:db        # integration + RLS tests
pnpm test:e2e       # Playwright
pnpm lint           # ESLint, including import boundaries
pnpm typecheck      # tsc --noEmit
```

CI runs lint, typecheck, the `db:types` diff check, `gen:rls-check`, `test`, and
`test:db`. All must be green before merge.
