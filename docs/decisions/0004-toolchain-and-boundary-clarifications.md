# ADR 0004 — Toolchain pins and two clarifications to the import rules

**Status:** Accepted — owner approved §2 on 2026-07-20
**Date:** 2026-07-20
**Needs owner confirmation:** no (was: yes, for §2)

> **Owner's approval, 2026-07-20.** Both clarifications in §2 are approved:
> `lib/` may be imported from anywhere provided `lib` imports only `lib`, and
> `app/` may import `app/` for Next.js layout, page, and error files. The
> owner's stated priority: **`domain/` stays sealed** — that is the boundary
> these clarifications must never be read as loosening.

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

**Any Docker-compatible daemon for local development.** Supabase's local stack
needs one; which one is a developer-machine choice with no bearing on production
or CI, where the Supabase CLI action provides its own.

Colima was proposed first, because it installs from Homebrew with no GUI step.
On this machine that turned out to be expensive: macOS 12 on Intel cannot use
the `vz` backend, so Colima needs QEMU, and Homebrew no longer ships a bottle
for macOS 12 — QEMU builds from source through OpenSSL, Python, and GLib, well
over an hour. The owner already had Docker Desktop installed, so that is what we
use. Recorded because the next person on an older Mac will hit the same wall.

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
