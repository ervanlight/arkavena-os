# ADR 0017 — Fase 7 (Billing & Collection) scope decisions

**Status:** Accepted
**Date:** 2026-07-22

## Context

ARCHITECTURE.md names Fase 7's scope precisely enough to know what's involved,
but leaves the same category of gap Fase 2/3/5/6 each needed an ADR for:

> FASE 7 — Billing & Collection [modules: billing]
> invoices, payments, billing pack (invoice + evidence + QC + variation
> summary), aging dashboard, hubungan otomatis overdue → Cash Gate.
> Exit: invoice hanya bisa terbit saat syarat (milestone + QC + variation
> approved + persetujuan TD) terpenuhi — integration test.

§2.1's wave list places `invoices → projects, milestones, change_orders?` in
Wave 8 and `payments → invoices` in Wave 9. §2.4 gives one illustrative
RLS-matrix row (`invoices | CRUD (org) owner/finance | ... | SELECT (proyeknya,
tanpa kolom margin) client_approver`) and §6.2 gives one illustrative
permission-matrix entry. Both are examples of the *pattern*, not the final
answer for every action this phase needs (e.g. neither mentions
`technical_director`, even though the exit criterion explicitly requires TD
approval before an invoice can issue).

Four things are genuinely undecided:

1. **Is "overdue" a stored invoice status, or computed?** Nothing in this
   codebase runs a scheduled job that could flip a status over time.
2. **What "hubungan otomatis overdue → Cash Gate" actually means mechanically.**
3. **What the issuance guard actually checks**, given "milestone" and "QC" are
   not directly the same entity -- `work_packages.milestone_id` is the only
   link between them.
4. **What "billing pack" is as data** -- a new table, or an assembly.

## Decision

### 1. Invoice status has no stored "overdue" -- it's computed, same as Cash Gate

`invoice_status` is `draft → issued → paid`, plus `cancelled` from `draft` or
`issued`. There is no `overdue` value in the enum. "Overdue" is a read-time
label (`modules/billing/domain`: `issued` AND `due_date` has passed AND not
fully paid) -- the exact same choice ARCHITECTURE.md 4.2 already made for Cash
Gate (`fn_cash_gate_status` recomputes on every read rather than a stored,
job-flipped status). Consistent, and needs no scheduler this project doesn't
have.

### 2. An issued invoice mirrors itself into `funding_receipts` via a trigger -- zero changes to Fase 2's Cash Gate

The cleanest mechanical answer, reusing code that is already built and
tested rather than adding a second overdue concept: when an invoice
transitions into `issued`, a new trigger (`fn_invoices_sync_funding_receipt`,
owned by billing, writing into cash-gate's `funding_receipts` -- the same
cross-module-via-SQL-trigger pattern `fn_work_packages_guard_hold_point`
(Fase 5) and `fn_change_orders_sync_client_decision` (Fase 6) already
established) inserts a `funding_receipts` row: `expected_date = due_date`,
`amount = invoices.amount`, `milestone_id = invoices.milestone_id`. When a
`payments` row fully covers the invoice (sum of payments >= amount), the same
trigger family sets that `funding_receipts` row's `cleared_at`.

`fn_cash_gate_status` (Fase 2) is not touched at all. An overdue, unpaid
invoice is now simply an overdue, uncleared funding receipt -- which already
forces the gate to `overdue` today. One mechanism, not two.

### 3. The issuance guard: four preconditions, one new trigger on `invoices`

`fn_invoices_guard_issuance`, firing on transition into `status = 'issued'`,
blocks unless all of:

- **Milestone**: `milestones.status = 'completed'` for `invoices.milestone_id`
  -- billing work that isn't done yet is not billed yet.
- **QC**: every `work_packages` row with `work_packages.milestone_id` equal to
  this invoice's milestone has no unmet required hold point -- the exact same
  per-work-package check `fn_work_packages_guard_hold_point` (Fase 5) already
  performs, run here across every work package under the milestone instead of
  one.
- **Variation** (only when `invoices.change_order_id` is not null): that
  `change_orders.status = 'approved_funded'` -- an invoice billing variation
  work cannot issue before the variation itself is approved and funded.
- **TD approval**: `invoices.approved_by` must resolve to a
  `technical_director` -- the same TD-only shape
  `fn_inspections_guard_td_only_override` (Fase 5) already established,
  applied here as a precondition for issuance rather than an override.

All four are checked in the one trigger (mirroring how
`fn_work_packages_guard_hold_point` and `fn_work_packages_guard_cash_gate`
are two independent triggers on work_packages, not one combined function --
here they're four conditions inside one function because they all gate the
exact same transition on the exact same row, not two separate transitions).

### 4. Billing pack is an assembly, not a table

No `billing_packs` table. `getBillingPackAction(invoiceId)` (modules/billing)
assembles, at request time, from each owning module's public API: the
invoice itself; `photos`/`progress_entries` for the milestone's work packages
(evidence, via `modules/field-reporting`); hold-point/inspection status for
those same work packages (QC, via `modules/quality-gate`); and, if
`change_order_id` is set, that change order's approval summary (via
`modules/scope-variation`). Same reasoning as ADR 0016's vw_client_* views:
one read path, no new table to keep in sync, no risk of the pack showing
stale data relative to the modules it summarizes.

## Consequences

**What this makes easy:** Cash Gate's existing, already-tested code is
completely untouched -- an overdue invoice is invisible to it as a concept,
only visible as the funding_receipts row it already knows how to read. A
future second billing document type (a credit note, say) reuses the same
funding_receipts-mirroring trigger pattern without new Cash Gate work.

**What this accepts as a cost:** `fn_invoices_guard_issuance` is a more
expensive check (aggregating every work package under a milestone) than
`fn_work_packages_guard_hold_point`'s single-row check -- acceptable at this
project's scale (a handful of work packages per milestone), revisit only if
it becomes a real performance problem.

**Reversal cost:** low. The funding_receipts mirror is additive (Fase 2's own
trigger and function are never edited); the issuance guard is a single new
trigger function that can be dropped without touching `invoices`' own schema.

## Alternatives considered

**Extend `fn_cash_gate_status` itself to also scan `invoices` directly.**
Rejected: this means editing and re-testing an already-shipped, CHECKPOINT
#2-signed-off function, doubling the maintenance surface for "what counts as
an overdue cash risk" across two code paths (funding_receipts' own overdue
check, plus a second invoices-specific one) instead of one.

**A stored, cron-flipped `overdue` invoice status.** Rejected: there is no
job scheduler in this project (client-portal's ADR 0016 already made the same
call for the same reason), and a computed label is exactly as correct at any
point in time with no infrastructure required.

**A `billing_packs` table populated at invoice-issue time.** Rejected: a
snapshot table would go stale the moment a photo is added or a hold point is
overridden after issuance, and ARCHITECTURE.md's billing pack is described as
something Finance *assembles to send*, not a permanent record distinct from
the invoice itself.
