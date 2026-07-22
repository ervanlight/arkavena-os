# ADR 0016 — Fase 6 (Client Trust Portal) scope decisions

**Status:** Accepted
**Date:** 2026-07-22

## Context

ARCHITECTURE.md names Fase 6's scope precisely enough to know what tables and
concepts are involved, but leaves several things undecided the way Fase 5 did
before ADR 0014:

> FASE 6 — Client Trust Portal v1 (read-only dulu) [modules: client-portal]
> Views klien (2.6), Overview, ZoneMap klien, timeline, progress evidence,
> Decisions (client_decisions + Decision Clock), approval variation pindah
> ke portal. Weekly report otomatis (halaman privat/PDF — sesuai roadmap hemat).
> Exit: klien demo hanya melihat yang halal (dibuktikan RLS test);
> weekly report tergenerate dari data nyata tanpa tulis ulang.

§2.1's wave list places `client_decisions → projects, zones?, change_orders?`
in Wave 8 (already-built tables: `client_decisions`, `inspections`,
`nonconformities`, `photos`, `issues` were all listed together; Fase 5 built
the quality-gate three, this ADR covers the last one). §1.1's folder comment
says client-portal "tidak punya banyak tabel sendiri" (doesn't own many
tables of its own) and reads other modules' data through their public APIs —
`client_decisions` is the one table it does own.

Four things are genuinely undecided:

1. **What `client_decisions` actually records**, given `change_orders`
   already has its own full approval state machine (Fase 3: `status`,
   `fn_change_orders_guard_transition`, a `client_approver` UPDATE policy).
   A second table tracking "decisions" risks either duplicating that state
   machine or being redundant with it.
2. **The exact `vw_client_*` view set and columns** — ARCHITECTURE.md 2.6
   names the pattern and one example view name
   (`vw_client_project_overview`) but not the full list Fase 6 needs
   (overview, zones, timeline, progress evidence, decisions).
3. **What "Decision Clock" means.** The term appears exactly once, with no
   elaboration anywhere else in the document.
4. **How the weekly report is generated and stored** — "halaman privat/PDF"
   is presented as an either/or with no further detail.

## Decision

### 1. `client_decisions` is a presentation/timeline log, not a second state machine

`client_decisions` does not replace or duplicate `change_orders.status`. It
is a lightweight record client-portal owns, answering exactly one question
for the portal UI: "what is this client currently being asked to decide, and
since when." One row per decision request:

```
client_decisions
  id, organization_id, project_id, change_order_id (nullable, the only
  decision source Fase 6 has -- deliberately nullable so a later decision
  type doesn't need a schema change, mirroring how photos.work_package_id
  is nullable for the same "not every source applies" reason),
  presented_at (when the client was first asked),
  decided_at (nullable; when they responded),
  decision (nullable enum: approved / rejected),
  created_at, updated_at, deleted_at
```

A new trigger on `change_orders` (owned by scope-variation, the same
cross-module-via-SQL-trigger pattern `fn_work_packages_guard_hold_point`
already established in Fase 5 -- module ownership boundaries are an
application-layer/ESLint rule, not a SQL-trigger rule) does the writing:

- On transition **into** `awaiting_client_approval`: insert a
  `client_decisions` row with `presented_at = now()`.
- On transition **out of** `awaiting_client_approval` (to
  `approved_pending_funding` or `rejected`): update that row's `decided_at`
  and `decision`.

This keeps scope-variation's state machine the single source of truth for
what actually happened, and gives client-portal a table it can query without
interpreting another module's status enum or transition graph. It also means
a future second decision type (e.g. a material substitution choice) only
needs its own module to insert/update `client_decisions` the same way --
`client_decisions` itself does not change shape.

### 2. Four views, matching the four listed portal sections, one per section

Per ARCHITECTURE.md 2.6's rule ("klien tidak pernah diberi akses tabel mentah
internal... daftar view + RLS-nya" is the auditable list of what a client can
see), naming each view after what it answers rather than after a table:

- `vw_client_project_overview` — one row per project: name, status, start/
  target/actual end dates, contract title + `contract_amount` (the contract
  value is already client-safe per 2.6's own example: contracts/milestones
  are explicitly the client-visible half, separate from internal
  `estimates`/`cost_library`). No `risk_reserve_amount`, no internal notes.
- `vw_client_zone_progress` — one row per zone: name, and an aggregate
  progress figure computed from `progress_entries` (latest
  `progress_percent` per work package in that zone, averaged) -- feeds
  "ZoneMap klien". No `work_packages.work_type`, no hold-point detail (a
  failed inspection is not something a client needs to see the internals
  of; they see progress move when it's ready to move).
  Note: `estimates`/`cost_library` stay published nowhere; showing project cost.
- `vw_client_timeline_event` — a union of milestone due/completed dates and
  decided `client_decisions` rows, ordered by date, giving "timeline" a
  single queryable source instead of the portal UI joining three tables
  itself.
- `vw_client_progress_photo` — `photos` filtered to non-deleted rows with
  `storage_path`/`thumbnail_path`/`caption`/`created_at`/`zone_id`, i.e.
  "progress evidence." `uploaded_by` is exposed as the uploader's
  `full_name` only (never a raw `users.id` join a client has no other
  access to resolve).

Every view is `security_invoker = true` (so RLS on the underlying tables is
what actually gates access, not the view owner's privileges) and filters
`deleted_at is null` itself, so callers never have to remember to.

### 3. Decision Clock: a three-tier pending-decision age indicator

Given the term has no other definition anywhere in the document, and this is
a client-facing, non-technical concept (the one place ARCHITECTURE.md
explicitly asks the owner to review "content, language, and what does NOT
show" at CHECKPOINT #4), the simplest honest interpretation is chosen now as
a starting point for that review, not as a final word: how long a decision
has been waiting, in three tiers.

```ts
// modules/client-portal/domain/decision-clock.ts
type DecisionClockTier = 'fresh' | 'aging' | 'overdue';

function decisionClockTier(presentedAt: Date, now: Date): DecisionClockTier
```

Boundaries: `fresh` for 0–2 days pending, `aging` for 3–6 days, `overdue` at
7+ days — a one-week SLA is a reasonable, easily-explained default for a
construction client decision (a variation approval), and easy to change in
one place if the owner wants a different threshold at CHECKPOINT #4. Pure
function per ARCHITECTURE.md 4.1 (no ambient clock — `now` is a parameter).

### 4. Weekly report: a private, tokenless page rendered from the same views, no PDF library

"Halaman privat/PDF — sesuai roadmap hemat" (the frugal roadmap) already
signals a preference for the cheaper option. A PDF means a rendering
dependency (e.g. `@react-pdf/renderer` or a headless-browser print step) —
real cost and real maintenance for a v1 that ARCHITECTURE.md itself calls
"read-only dulu" (read-only for now). The weekly report is therefore a page
at `/laporan-mingguan` inside the same client-portal route group, generated
on request (not on a cron/schedule -- there is no job scheduler in this
project yet, and Fase 6 doesn't need one) directly from
`vw_client_project_overview` / `vw_client_zone_progress` /
`vw_client_progress_photo` for the current week, protected by the same RLS
+ magic-link session as every other portal page. "Tanpa tulis ulang" (exit
criterion) is satisfied because it queries the same views the rest of the
portal already uses -- no separate report-specific table or hand-entered
content. A PDF export button can be added later (e.g. print-to-PDF via the
browser, which costs nothing) if the owner asks for one at CHECKPOINT #4;
not built now since ARCHITECTURE.md doesn't require it and the frugal
default is to not build what wasn't asked for.

## Consequences

**What this makes easy:** the portal's four sections and the weekly report
all read from the same four views, so there is exactly one place per section
to audit for a data leak, and exactly one place to add a column if the
client-facing surface ever needs to grow. A new decision type in a later
phase reuses `client_decisions` without a schema change.

**What this accepts as a cost:** `vw_client_zone_progress`'s "aggregate
progress from the latest progress_entries per work package" is a real
computation inside a view rather than a stored value — acceptable for v1's
data volumes, revisit only if it becomes a real performance problem.

**Reversal cost:** low for all four decisions — none of them touch another
module's owned tables or existing triggers (the new `change_orders` trigger
is additive, alongside its existing transition guard, not a replacement of
it), and the views can be dropped/redefined without touching table data.

## Alternatives considered

**`client_decisions` mirrors/duplicates `change_orders.status` with its own
parallel state machine.** Rejected: two sources of truth for "is this
decided yet" is exactly the kind of drift ARCHITECTURE.md's audit/RLS
conventions exist to prevent elsewhere; a trigger-fed timeline log avoids it
for the cost of one small trigger.

**One flat `vw_client_dashboard` view joining everything.** Rejected: a
single wide view is harder to audit column-by-column against 2.6's "no
margin, no internal notes" rule, and forces every portal page to select
columns it doesn't need. Four narrow views, one per concern, keeps the
audit trivial (read one `CREATE VIEW` statement, know exactly what a client
can see for that concern).

**PDF generation via a rendering library.** Rejected for v1, per "sesuai
roadmap hemat" and because ARCHITECTURE.md itself defers this ("read-only
dulu"); revisit only on explicit owner request.
