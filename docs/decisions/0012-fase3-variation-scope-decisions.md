# ADR 0012 — Fase 3 Variation: four owner decisions, plus the guard/audit design they imply

**Status:** Accepted — owner approved on 2026-07-21
**Date:** 2026-07-21
**Needs owner confirmation:** no (this ADR records the owner's own decisions)

## Context

ARCHITECTURE.md 4.3 specifies the Variation state machine's transition graph
precisely (`TRANSITIONS`, the `client_approve` guard, the
`approved_funded`-only work package rule) but leaves four things unsaid --
all money- or approval-adjacent, none safe to resolve silently (CLAUDE.md
11), matching the exact discipline ADR 0009 used for Fase 2.

## Decisions

**1. `funding_received` is a manual action, not a computed link to
`funding_receipts`.** ARCHITECTURE.md names the event but not its trigger.
Wiring it to `funding_receipts` would need a new `change_order_id` column on
that table and a rule for which receipt "counts" for which variation --
real complexity for a case Wave 8's billing/invoice module (`invoices ->
..., change_orders?`) is the eventual real answer to. Until then: a
Finance/Owner action, `markChangeOrderFunded`, the same shape as
`markFundingReceiptCleared` from Fase 2 (owner decision D5's manual-cash
philosophy applied consistently).

**2. A variation's `cost_impact_amount` does NOT feed into Cash Gate's
`committedCosts` in Fase 3.** `computeFundingCoverage`'s `committedCosts`
input stays the ADR 0009 decision 2 placeholder (`0`) until Fase 8's
procurement module gives it a real source. Wiring variation cost into it now
would reopen money logic CHECKPOINT #2 just froze. "Keterkaitan ke Cash
Gate" for Fase 3 means something narrower and already true for free: a
variation's resulting work package is an ordinary `work_packages` row, so
`trg_work_packages_guard_cash_gate` (Fase 2) already applies to it
unmodified -- if the gate is red, a variation's work package cannot start
either, exactly like any other. No new trigger needed for this part.

**3. `complete` is staff-only: `owner`, `technical_director`, `qs`,
`procurement`.** Same reasoning as ordinary project CRUD (Fase 1) --
finishing a variation's work is an internal record-keeping act, not a
client- or field-role decision. `finance` is deliberately excluded: closing
out physical work isn't a money decision the way `funding_received` is.

**4. `cost_impact_amount` may be negative.** A variation can remove scope
(client asks to drop something), which is a cost reduction. This is a
deliberate, named exception to ADR 0008's blanket "`*_amount` columns are
non-negative" convention that every other money column in this codebase
follows (`funding_receipts.amount`, `milestones.amount`, `contracts
.contract_amount`, ...) -- `change_orders.cost_impact_amount` gets **no**
`ck_..._non_negative` constraint, only the safe-integer ceiling, mirrored in
both directions (`-999999999999999` to `999999999999999`). `schedule_impact
_days` (a plain `integer`, not money) was already going to allow negative
values for schedule acceleration; this decision makes the money column
consistent with that same "impact can go either way" shape.

## Guard and audit design this implies

ARCHITECTURE.md 4.5 requires unit tests for "guard approver salah role" at
the **domain** layer, unlike Cash Gate's `evaluateGateAction`, which
deliberately keeps role verification out of the pure function (no session to
check a role against). Variation's `transition()` is different: ARCHITECTURE
4.3's own prose folds the role check into `client_approve`'s guard
("approver adalah `client_approver` proyek tsb"), so `transition()` takes the
actor's role as a plain string **input** (resolved by the repository layer
from `project_members`/`users.org_role` beforehand, never looked up by the
pure function itself) and validates it as ordinary guard logic -- fully
unit-testable with no database, same as any other input validation.

Role guard per event:

| Event | Allowed actor role(s) |
| --- | --- |
| `submit_review` | any staff (`ORG_ROLES`) |
| `send_to_client` | `owner`, `technical_director`, `qs` (ARCHITECTURE.md 6.2's own `review` example) |
| `reject` (staff, from `under_review`) | `owner`, `technical_director`, `qs` |
| `client_approve` | `client_approver` only, and only when `costImpact`/`scheduleImpact` are both present (ARCHITECTURE.md 4.3's guard, decision 4 above is what makes a *negative* cost impact still count as "present") |
| `client_reject` | `client_approver` only |
| `funding_received` | `owner`, `finance` (decision 1) |
| `complete` | `owner`, `technical_director`, `qs`, `procurement` (decision 3) |

Audit action per event -- `core/audit`'s `AuditAction` already distinguishes
"what changed" from "why a human allowed it"
(`REASON_REQUIRED_ACTIONS = ['override', 'approve', 'reject']`), so this
maps directly rather than needing a new taxonomy:

| Event | `AuditAction` | Reason required? |
| --- | --- | --- |
| `submit_review`, `send_to_client`, `funding_received`, `complete` | `status_change` | no |
| `reject` (staff) | `reject` | yes |
| `client_approve` | `approve` | yes (a short note, not optional -- `core/audit`'s type already forces this for every `approve`) |
| `client_reject` | `reject` | yes |

## Database enforcement (two layers, CLAUDE.md 0.3)

Two triggers, mirroring the domain exactly, the same pattern Cash Gate
established:

1. `fn_change_orders_guard_transition()` -- a `BEFORE UPDATE OF status`
   trigger on `change_orders` re-implementing the same `TRANSITIONS` edge
   list in SQL, rejecting any `OLD.status -> NEW.status` pair that isn't in
   it. This is the part Fase 2 didn't need for `cash_gate_status` (a computed
   read, not a stored state machine) but Variation's `change_orders.status`
   *is* stored, so it needs its own transition guard the way nothing in
   Fase 2 did.
2. `fn_work_packages_guard_change_order_funded()` -- a `BEFORE INSERT OR
   UPDATE OF change_order_id` trigger on `work_packages`, rejecting a
   non-null `change_order_id` unless that change order's `status =
   'approved_funded'` -- the literal DB-layer rule ARCHITECTURE.md 4.3 names.

## Client approval mechanism

"Link aman, belum perlu portal penuh" (ARCHITECTURE.md §7) is read as: the
`client_approver` signs in through the *same* magic-link auth every role
already uses (owner decision D4 -- there is no second, token-based auth path
in this system), and lands on one purpose-built page
(`/cc/variations/[id]/approve`) rather than a navigable portal with menus.
RLS/`fn_has_project_role` already scopes what they can reach to their own
project, the same mechanism Fase 1 built for every other project role. No
new security mechanism is introduced by this decision; it reuses D4 and
Fase 1's project-role RLS as-is.

## Consequences

**Reversal cost: low**, matching every other placeholder this project has
recorded so far. `markChangeOrderFunded` becomes a real `funding_receipts`
link in Fase 8 by adding a column and a repository change, not a domain or
schema rewrite. Wiring `cost_impact_amount` into `committedCosts` later is a
one-line change to `gate-state-repository.ts`'s aggregation, not a
`computeFundingCoverage` signature change.

## Alternatives considered

**Auto-detect `funding_received` from a matching `funding_receipts` row.**
Rejected by the owner: needs a `change_order_id` column on
`funding_receipts` and a matching rule (amount? milestone? date window?)
that doesn't have a real answer until Wave 8's invoicing exists to be that
rule. A manual action is honest about what Fase 3 actually knows.

**Let variation cost immediately count toward Cash Gate's ratio.** Rejected
by the owner: CHECKPOINT #2 froze that logic on purpose, specifically so a
later phase's changes wouldn't need to re-litigate thresholds the owner
already validated against real operations.
