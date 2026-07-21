# ADR 0009 — Fase 2 Cash Gate: four gaps ARCHITECTURE.md leaves open, resolved before writing code

**Status:** Accepted — owner approved on 2026-07-21
**Date:** 2026-07-21
**Needs owner confirmation:** no (this ADR records the owner's own decisions)

## Context

ARCHITECTURE.md 4.2 and 7 specify Cash Gate's domain signatures and exit
criteria in enough detail to build against, but re-reading them closely
before writing any code (per the owner's explicit request this session)
surfaced four gaps -- all money-adjacent, none safe to resolve silently
(CLAUDE.md 11).

## Decisions

**1. The `purchase_orders` trigger is deferred to Fase 8; `work_packages` is
the real, provable trigger for Fase 2.** ARCHITECTURE.md 4.2 asks for
`BEFORE INSERT` on `purchase_orders` and `BEFORE UPDATE status -> in_progress`
on `work_packages`, both calling `fn_cash_gate_status(project_id)`.
`purchase_orders` belongs to the procurement module, which is Fase 8 scope
(CLAUDE.md law 7 -- do not build ahead of the phase) and does not exist.
`work_packages` already exists (Fase 1). Fase 2 builds `fn_cash_gate_status`
once and attaches it to `work_packages` now, fully tested; Fase 8's
procurement migration attaches the same function to `purchase_orders` when
that table is created, not a rewritten copy of the logic. CHECKPOINT #2 still
freezes the money logic itself (the function), not which tables call it yet.

**2. `committedCosts` is a fully-tested pure-function parameter now, and a
literal `0` placeholder in the Fase 2 repository.** The value's real source
is aggregated purchase order amounts, which do not exist until Fase 8. Unit
tests for `computeFundingCoverage` exercise this input with synthetic values
regardless -- the domain function does not care where a number came from,
which is the entire point of it being pure. The *repository* that feeds the
dashboard and the real DB trigger passes `0`, with a comment naming this ADR,
rather than silently pretending the figure is complete. Fase 8 replaces the
placeholder with a real aggregation query, not a rewritten formula.

**3. Overdue means a `funding_receipts` row whose `expected_date` is more
than 7 days in the past with `cleared_at` still null.** ARCHITECTURE.md
names "overdue" as a gate-suspending condition without defining the
threshold. 7 days is a named constant (`OVERDUE_GRACE_DAYS`), mirrored in SQL
the same way the 11000/10000 basis-point thresholds already are --
changeable in one place, not a magic number buried in a query.

**4. `riskReserve` is a new column, `projects.risk_reserve_amount bigint not
null default 0`, not a new table.** ARCHITECTURE.md's Cash Gate signature
names `riskReserve: Rupiah` as an input with no source anywhere else in the
document -- a genuine gap, not an oversight to paper over. Wave 7 alters the
existing `projects` table (Fase 1) to add it. Default `0` means no hidden
buffer applies until an Owner or Finance user sets one explicitly for a
project -- the same "fail toward showing the true number, not a comforting
guess" instinct as `committedCosts`' placeholder.

## Consequences

**Fase 2's demo of "gate merah memblokir PO" is a work_package status
transition, not a purchase order.** This is a substitution of subject, not a
weaker proof: the same trigger, the same function, the same threshold
constants block a `work_packages` `UPDATE status -> in_progress` exactly as
specified, and the browser verification proves it against the real database
the same way Fase 1's did. Anyone reading "PO blocked" literally in the Fase
2 report should read `work_packages` in its place until Fase 8 lands.

**The dashboard will show a coverage ratio computed from real cleared funds
and real forecasted needs, but a `committedCosts` of `0` until Fase 8.** In
practice this means the ratio is somewhat more generous than the eventual
real number will be, once open purchase orders start counting against it.
This is visible in the code (the placeholder is named and commented, not
hidden inside an aggregation query that looks complete) and worth knowing
before trusting a Fase 2 dashboard reading as the final word once Fase 8's
procurement volume becomes material.

**Reversal cost for all four: low.** Wiring `purchase_orders` to the shared
function is an additive trigger in Fase 8's own migration. Replacing the
`committedCosts` placeholder is a repository change, not a domain or schema
change -- the pure function's signature does not move. The overdue grace
period is one constant. `risk_reserve_amount` already has a home and a
default; nothing about widening its use later requires touching this
decision again.

## Alternatives considered

**Build a minimal `purchase_orders` table now, scoped outside the
procurement module, just to demo the trigger literally.** Rejected: this is
exactly the "sekalian" CLAUDE.md law 7 warns against. A table built to prove
one demo scenario would need significant rework -- likely a different shape
entirely -- once Fase 8 builds the real procurement flow around vendor
quotes and deliveries.

**Treat `committedCosts` and `riskReserve` as always `0` forever, with no
named placeholder or comment.** Rejected: a silent `0` is indistinguishable
from "this organisation genuinely has no committed costs" the day someone
reads the dashboard without knowing the codebase's history. A named,
commented placeholder tied to this ADR is what keeps that distinction
visible to the next person -- including a future session of this same
assistant.
