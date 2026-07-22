# ADR 0014 — Fase 5 Quality Gate: schema shape and the two-independent-gates design

**Status:** Accepted
**Date:** 2026-07-22
**Needs owner confirmation:** no (technical design filling gaps ARCHITECTURE.md leaves open by name — §7's Fase 5 entry and §4.4 describe the business rule and the pure-function signature, but no table names, columns, or FK wiring exist anywhere in the document; this is the same kind of gap ADR 0007/0011 resolved for earlier phases)

## Context

ARCHITECTURE.md §4.4 specifies `canProceed()`'s signature and the business
rule precisely ("hold point template per jenis pekerjaan... data di DB, bukan
hardcode"; "override teknis hanya oleh Technical Director + reason + audit").
§2.1's Wave 8 dependency chain places `inspections -> work_packages, zones`
and `nonconformities -> inspections`, and notes `photos -> inspections` as an
FK to be added later via separate `ALTER`. None of this says what
`hold_point_templates` (never even named as a literal table anywhere) looks
like, how a `work_package` knows which templates apply to it, or how an
override is recorded. Four things need deciding before any migration can be
written.

## Decisions

**1. `hold_point_templates` is an org-scoped lookup table keyed by
`work_type` (free text, not a Postgres ENUM).** CLAUDE.md §1's own rule
("Enum terkontrol-kode -> ENUM. Nilai yang mungkin ditambah admin lewat UI ->
lookup table") already points here, and ARCHITECTURE.md §4.4 says the
quiet part out loud: "supaya nambah jenis pekerjaan tidak ubah kode" (so
adding a work type doesn't need a code change). An ENUM would need a
migration for every new category (waterproofing, plumbing, struktur, ...);
free-text `work_type` on an admin-manageable table does not.

**2. `work_packages` gets a new nullable `work_type text` column (a Wave 8
`ALTER`, additive, per CLAUDE.md §2's expand pattern).** This is what lets a
work package know which hold point templates apply to it: an inspection is
created against *the same work package* whose `work_type` matches a
template's `work_type`. Read literally, Bab 4.5's own trigger description --
"UPDATE work_package -> in_progress saat hold point belum lulus" -- blocks
*that same row's* transition, not a different, later work package's. A
tiling work package that is conceptually "waterproofing's hold point" is
modeled as the tiling work package itself carrying `work_type =
'waterproofing_cover'` (or whatever the QS names it) and needing its own
passed/overridden inspection before it can start -- not a cross-work-package
dependency graph, which nothing in the architecture doc asks for and which
would be real, unrequested complexity.

**3. Override is columns on `inspections` itself
(`overridden_by`/`override_reason`/`overridden_at`), not a separate table.**
This mirrors Scope Variation's `client_approved_by`/`client_approved_reason`
precedent (one decision, 1:1 with one row) rather than Cash Gate's
`cash_gate_overrides` table (many override *events* against a
project-level, repeatedly-evaluated status with no natural single row to
attach to). An inspection is a single, one-time fact -- "did this pass" --
so a TD override of it is naturally a mutation of that same row, not an
independent append-only log.

**4. `photos -> inspections` FK is deferred, exactly as ARCHITECTURE.md
already names as the option.** No `inspection_id` column added to `photos`
in this phase. The literal Fase 5 exit criterion ("foto sebelum ditutup ->
approval -> lanjut") is satisfiable without it: a photo already carries
`project_id` + `zone_id` + `daily_log_id`/`work_package_id` (Fase 4), which
is enough to show "photos taken before this hold point closed" by querying
on `work_package_id` and date, without a dedicated FK. Wiring the FK is a
later, additive `ALTER` (CLAUDE.md §2), not blocking anything in this phase.

## Schema

```
hold_point_templates
  id, organization_id, work_type (text), name (text),
  description (text, nullable), sort_order (int, default 0),
  is_active (bool, default true), + standard audit/soft-delete columns

inspections
  id, organization_id, project_id, work_package_id, zone_id,
  hold_point_template_id, status (inspection_status: pending/passed/failed,
  default pending), inspected_by (nullable), inspected_at (nullable),
  notes (nullable),
  overridden_by (nullable), override_reason (nullable), overridden_at (nullable),
  + standard audit/soft-delete columns

nonconformities
  id, organization_id, inspection_id, description, severity (reusing the
  existing issue_severity enum from Fase 4 -- same low/medium/high meaning,
  no reason to duplicate the type), resolved_at (nullable),
  resolved_by (nullable), + standard audit/soft-delete columns
```

`project_id` on `inspections`/`nonconformities` is the same denormalization
`progress_entries` already uses (Fase 4) for RLS simplicity, even though it
is derivable through `work_package_id` -- consistent with existing
convention, not a new pattern.

## The two independent gates (Bab 4.5's core testing requirement)

`trg_work_packages_guard_hold_point()` is a **separate, independent**
`BEFORE UPDATE OF status` trigger on `work_packages`, alongside the existing
Fase 2 `trg_work_packages_guard_cash_gate`. Postgres fires every matching
trigger and aborts on the first one that raises -- this is what makes "cash
gate merah tetap memblokir walau semua QC lulus" (and the mirror case: hold
point clear does not open a red cash gate) true by construction, with no
change to the existing Cash Gate trigger. The domain layer mirrors this
exactly: `canProceed()` takes `cashGate` and `holdPoints` as separate inputs
and can reject on either, independently, matching ARCHITECTURE.md §4.4's
signature verbatim.

## Consequences

**Reversal cost: low.** `work_type` on `work_packages` is an additive
nullable column; the `photos -> inspections` FK is deferred exactly as the
architecture doc already anticipated; override-as-columns can be split into
a separate table later the same way ADR 0011 moved a column off `projects`
if a future phase needs a many-overrides-per-inspection history (nothing
in Fase 5 asks for that).

## Alternatives considered

**A `work_package_hold_points` junction table (explicit per-work-package
assignment) instead of `work_type` string-matching.** More explicit, but
real unrequested complexity: nothing in ARCHITECTURE.md's §4.4 or the Bab
4.5 test list asks for a work package to carry more than one hold point
template, or for that assignment to be anything other than "this work
package's type." `work_type` matching is the simpler design that still
satisfies every stated requirement.

**A separate `quality_hold_point_overrides` table, matching Cash Gate's
pattern.** Rejected: Cash Gate's separate table exists because a cash gate
status is re-evaluated continuously and overridden potentially more than
once over a project's life; an inspection's pass/fail is a single fact
recorded once. Variation's own precedent (decision columns on the row) is
the closer match.
