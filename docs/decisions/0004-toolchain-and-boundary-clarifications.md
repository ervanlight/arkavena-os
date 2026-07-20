# ADR 0004 — Toolchain pins and two clarifications to the import rules

**Status:** Proposed
**Date:** 2026-07-20
**Needs owner confirmation:** **yes** — for §2 only. Everything else is routine.

## Context

Fase 0 required several small choices that ARCHITECTURE.md does not cover. None
of them touch money, audit, or permissions, so they were made rather than
escalated — except the two boundary clarifications in §2, which technically
*extend* the dependency rules in ARCHITECTURE.md §1.2 and therefore need the
owner's sign-off before they harden into habit.

## Decision

### 1. Toolchain pins

**TypeScript 5.9.3, not 7.0.** TypeScript 7 (the native port) is released, but
`typescript-eslint@8.64` declares `typescript >=4.8.4 <6.1.0`. Adopting TS 7 today
means giving up type-aware linting, which is what enforces our import boundaries.
The boundaries matter more than the compiler speed. Revisit once
`typescript-eslint` supports TS 7.

**Colima + QEMU as the local container runtime**, not Docker Desktop. Supabase's
local stack needs a Docker daemon. Colima installs from Homebrew with no GUI, no
licence, and no manual download step, so the environment is reproducible from a
command rather than from instructions. This is a developer-machine choice only —
it has no bearing on what runs in production or CI.

**Vitest is split into two projects, `unit` and `db`.** `pnpm test` runs only the
unit project. This keeps the domain-logic feedback loop fast, and — more
importantly — means a stopped Docker daemon cannot produce a red domain test
suite. A test that fails for environmental reasons teaches people to ignore red,
which is the beginning of the end for any test suite.

### 2. Two clarifications to ARCHITECTURE.md §1.2 — **needs owner confirmation**

The dependency table in §1.2 lists what each layer may import. Two cases it does
not mention came up immediately:

**(a) `lib/` is importable from everywhere.** §1.2 names `lib` explicitly only in
the `domain` row. Read strictly, `app/` and a module's `data/` could not use a
date helper, which cannot be the intent — `core` is already allowed to import
`lib`, and `lib` is by definition domain-free generic utility. Implemented as:
any layer may import `lib`; `lib` may import only `lib`.

**(b) `app/` may import `app/`.** A Next.js route group needs its own layout,
loading, and error files to import each other, and every page imports
`globals.css`. Read strictly, §1.2 forbids this. Implemented as: `app` may import
`app`.

Neither weakens the boundaries that matter: `domain/` stays sealed off from
infrastructure, `core` still cannot import a module, and a module's internals are
still unreachable from outside it.

## Consequences

The pins are all cheaply reversible — a version bump and a reinstall.

The §2 clarifications are worth confirming rather than absorbing silently. The
risk with (a) is drift in what `lib/` means: if domain logic starts accumulating
there, `lib` quietly becomes a second, unpoliced core. The mitigation is the
rule that `lib` may import only `lib` — anything needing money, errors, or
database types cannot live there, which is a structural limit rather than a
guideline.

## Alternatives considered

**Keep §1.2 literal and route every utility through `core`.** Rejected: it makes
`core` a dumping ground for things with no domain meaning, which is the outcome
`lib` exists to prevent.

**Docker Desktop instead of Colima.** Works, but requires a manual GUI download
and carries commercial licensing conditions. Neither is a good property for a
setup step meant to be reproducible from a script.
