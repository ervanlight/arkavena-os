# ADR 0001 — Organise source by domain module, not by technical layer

**Status:** Accepted
**Date:** 2026-07-20
**Needs owner confirmation:** no (ratifies ARCHITECTURE.md §1)

## Context

The two common layouts for an application this size are technical layers
(`components/`, `utils/`, `hooks/`, `pages/`) and domain modules (`cash-gate/`,
`quality-gate/`, …). The choice is hard to reverse once a few hundred files
exist, so it is settled before the first module is written.

The deciding constraint is not aesthetics. Three pieces of logic in this system
control money and liability: the Cash Gate, the variation state machine, and the
quality hold points. They must be unit-testable without a database and without a
browser. That is only achievable if there is a folder the linter can forbid from
importing infrastructure — which means logic has to be grouped by what it is
about, not by what technology it uses.

## Decision

Source is organised as `src/modules/<domain>/`, each containing `domain/`,
`data/`, `actions/`, `components/`, `schemas.ts`, `types.ts`, and `index.ts`.

Each database table is owned by exactly one module. Other modules reach it by
calling a function exported from the owner's `index.ts` — never by querying the
table directly.

Import boundaries are enforced by `eslint-plugin-boundaries` in CI, and the
enforcement itself is proven by `pnpm verify:boundaries`, which writes
deliberate violations and asserts each one is rejected.

## Consequences

Easy: a bug in the Cash Gate has all its code — logic, queries, UI, types — in
one folder. Pure logic is genuinely unit-testable, because `domain/` cannot
import Supabase, React, or Next. Build progress is visible, since the phase order
in ARCHITECTURE.md §7 maps one-to-one onto folders.

Hard: entities touched by several modules (`work_packages` is read by cash-gate,
quality-gate, and billing) need an explicit public function rather than an ad-hoc
join. This is more boilerplate, and it is the cost we are paying on purpose — the
alternative is four modules writing to the same table with four different sets of
assumptions.

Reversal cost: high. Changing this later means moving every file. That is why it
is decided now rather than discovered later.

## Alternatives considered

**Technical layers.** Familiar, and fine for CRUD. Rejected because it offers no
place to put logic that must be infrastructure-free: with `utils/` and
`services/` there is no folder the linter can meaningfully police, so the
money logic ends up entangled with I/O and stops being testable in isolation.

**A single `src/` with no enforced structure.** Fastest to start. Rejected
because the failure mode is silent: nothing breaks the day a component starts
doing money arithmetic, it just becomes untestable and stays that way.
