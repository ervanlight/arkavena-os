# ADR 0019 — Fase 9 (Maintenance Engine) scope decisions

**Status:** Accepted
**Date:** 2026-07-23
**Needs owner confirmation:** no (confirmed 2026-07-23)

## Context

Fase 8 is done (migration, RLS, domain, actions, Command Center UI, and an
E2E test proving its own exit criteria end to end — F8-9 through F8-11).
CLAUDE.md law 0.7 blocks starting Fase 9 until Fase 8's exit criteria is
green, which it now is, so Fase 9 (Maintenance Engine) is next in the Build
Sequence (ARCHITECTURE.md §7).

Unlike Fase 8, which arrived with ADR 0018 already resolving every table's
shape before any code was written, Fase 9 has **no ADR yet** and
`src/modules/maintenance-engine/` is an empty scaffold (four `.gitkeep`
files, nothing else). ARCHITECTURE.md's own wave-dependency list (§2.1)
names the five tables and marks several relationships with a bare `?` —
`warranties → projects, handover_items?` and
`service_tickets → assets, warranties?, clients` — meaning even the
document that lists them treats the relationship as undecided, not just
unwritten. The exit criterion itself (§7) is a sentence, not a spec:

> "Exit: proyek selesai otomatis membentuk warranty register + galeri
> before–after; tiket servis jalan."

Three concrete things that sentence implies do not exist anywhere in the
codebase today and would have to be designed from scratch, not reused:

1. **No automatic trigger exists on `projects.status`.** `updateProjectAction`
   already allows setting `status = 'completed'` freely (a plain field
   update, no domain gate) but nothing in any migration reads or reacts to
   that transition — "otomatis membentuk warranty register" needs a new
   `AFTER UPDATE OF status` trigger, the same shape as
   `fn_leads_sync_assessment_project` (Fase 8) or
   `fn_invoices_sync_funding_receipt` (Fase 7), just triggered by a column
   this codebase has never hooked anything to before.
2. **No before/after concept exists on `photos`.** The table has
   `caption text` (free text) and links to `project_id`/`zone_id` (required)
   plus optional `work_package_id`/`daily_log_id` — nothing distinguishes a
   "before" shot from an "after" shot, structurally or by convention.
   ARCHITECTURE.md's own footnote (§2.1) planned a `photos → inspections`
   FK "as a separate ALTER once inspections exists" (Fase 5) — that ALTER
   was never done either, three phases later.
3. **No recurrence concept exists anywhere.** `inspections` (Fase 5) is
   strictly one row per `work_package_id`, no schedule, no next-due-date.
   "Recurring inspection" (Wave 10's own heading: "Recurring") has nothing
   to extend — it is new mechanism, not reuse.

Given the number of genuinely open questions and that this is a whole new
module's data model (not a follow-on to an already-scoped phase), this ADR
proposes concrete first-draft answers to each — the same "give it a
concrete definition, flag it for the owner to adjust" treatment ADR 0018
gave lead scoring and ADR 0016/0017 gave Decision Clock and aging tiers —
rather than deciding silently (CLAUDE.md §12).

## Decision

### 1. One phase, two migration waves — Wave 9 then Wave 10, no change to that split

ARCHITECTURE.md's wave list puts `handover_items`/`warranties`/`assets` in
Wave 9 ("Penyelesaian") and `maintenance_plans`/`service_tickets` in Wave 10
("Recurring"), both under the single Fase 9. Kept as two migrations, not
merged into one: Wave 10's two tables depend on Wave 9's `assets` table
(`maintenance_plans → assets`, `service_tickets → assets`), so building them
in the documented order is both correct dependency-wise and gives two
natural commit boundaries (mirrors Fase 8's own F8-9/F8-10 split by table
group, not by arbitrary line count).

### 2. `handover_items`: one row per zone, staff-entered, not auto-generated from nothing

A handover item represents one deliverable checked off at project
handover — a key, an as-built drawing, a certificate, a warranty card
physically given to the client — not an automatically-derived record (there
is no source data to derive it *from*; a human hands over a physical key,
the software cannot know that happened on its own). Staff record these
during the handover process, before or as the project reaches `completed`.

```
handover_items
  id, organization_id, project_id, zone_id (nullable — some items are
    whole-project, e.g. "as-built drawing set", not per-zone),
  item_type (text — "key", "as_built_drawing", "warranty_card",
    "operation_manual", "certificate", free text with a few common values
    suggested in the UI, not a closed enum: a lookup table would be
    over-engineering for something staff can just type, same reasoning
    ADR 0018 gave leads.source),
  description, handed_over_at (timestamptz), handed_over_to (text — the
  client-side recipient's name; not a `client_users` FK, since the person
  physically receiving a key is routinely not the portal user),
  recorded_by (uuid, users), notes,
  created_at, updated_at, deleted_at
```

### 3. `warranties`: auto-created from `handover_items` when the project completes, one row per item that needs one

The trigger ARCHITECTURE.md's exit criterion asks for:
`fn_projects_sync_warranties_on_completion`, `AFTER UPDATE OF status ON
projects WHEN (new.status = 'completed' and old.status is distinct from
'completed')`, inserting one `warranties` row per `handover_items` row on
that project that has `item_type` in a short fixed set implying a warranty
exists (`'key'` and `'as_built_drawing'` do not need one; a physical
installation does) — **not every handover item gets a warranty row**, so
the trigger filters rather than blindly fanning out 1:1. Default warranty
duration is a single organization-level constant for v1
(`DEFAULT_WARRANTY_MONTHS = 12`, mirroring the "give it a concrete
first-draft number, no config UI yet" treatment margin floor and aging
tiers already got) — real construction contracts differentiate
structural/waterproofing/general warranty periods, which this v1
deliberately defers (see Consequences) rather than building a whole
warranty-terms configuration screen nobody asked for yet.

```
warranties
  id, organization_id, project_id, handover_item_id (nullable — a
    warranty can also be logged without a specific handover item, e.g. a
    manufacturer's own warranty on installed equipment),
  title, starts_at (date, = handover date), ends_at (date, computed from
  DEFAULT_WARRANTY_MONTHS at insert time, editable after — staff can
  correct a specific warranty's real term), terms (text, nullable),
  status (warranty_status enum: 'active', 'expired', 'claimed' — 'expired'
    is a computed-on-read state in the UI, not a trigger-flipped column;
    no scheduled job flips it, same "computed advisory number, not a
    stored staleness-prone column" shape as Decision Clock/aging tiers),
  created_at, updated_at, deleted_at
```

### 4. `assets` (Facility Passport): per-site equipment register, client-visible eventually but not in v1

An asset is a piece of installed equipment or a system at a client's site
that will need future maintenance — an AC unit, a water pump, a septic
system, an electrical panel — tracked so `maintenance_plans` and
`service_tickets` have something concrete to attach to. Scoped to
`site_id` (not `project_id`): a site can accumulate assets across multiple
projects over its lifetime (a renovation adds a new AC unit to a site that
already has an old water pump from the original build), matching
`assets → sites, clients` in ARCHITECTURE.md's own wave list.

```
assets
  id, organization_id, site_id, client_id (denormalized from site_id for
    the same reason `assessments`/`leads` already carry direct FKs rather
    than forcing every read through a join — CLAUDE.md 2's own convention),
  name, category (text, same free-text-not-enum reasoning as
  handover_items.item_type), manufacturer, model, serial_number, install_date,
  warranty_id (nullable FK to warranties — an asset installed under a
  project's handover may itself be the thing a warranty row is about),
  notes, created_at, updated_at, deleted_at
```

No client-portal view (`vw_client_assets`) in this phase — Facility
Passport as something a client browses themselves is a real feature but a
separate UI decision or wait for the Later Waves timeline (Fase 11 mentions
nothing about this either); v1 is a staff-side register only, same "ship
the mechanism internally first" sequencing Fase 6 already used for Decision
Clock before Fase 6 gave clients their own read of it.

### 5. `maintenance_plans`: a fixed-interval recurrence per asset, computed `next_due_date`, no cron job

A maintenance plan says "service this asset every N days." No background
scheduler exists in this stack (no queue, no cron worker — a Next.js app on
Supabase has nowhere to run one without adding new infrastructure this
phase doesn't need to justify), so recurrence is **computed on read**, the
same "computed advisory number" shape as everything else Decision Clock/
aging tiers/margin already established: `next_due_date` is derived from
`last_completed_at + interval_days` (or `starts_at` if never completed),
not written by a trigger and not requiring a live process to stay correct.

```
maintenance_plans
  id, organization_id, asset_id, title, interval_days (integer, > 0),
  starts_at (date), last_completed_at (date, nullable), is_active
  (boolean, default true), notes, created_at, updated_at, deleted_at
```

`getMaintenancePlansDueAction`-style read computes `next_due_date` and a
derived `overdue` boolean at request time from `interval_days` +
`last_completed_at`/`starts_at` — mirrors `computeFundingCoverage`/
`isBelowMarginFloor`'s own "pure function over plain data" shape exactly.

### 6. `service_tickets`: its own small state machine, always tied to an asset, optionally to a warranty

A service ticket is the actual work order — client reports a problem, or a
`maintenance_plan` comes due and staff opens one. State machine deliberately
small (this is not Cash Gate or Variation-scale complexity):

```
'open' -> 'in_progress' -> 'resolved'
'open' | 'in_progress' -> 'cancelled'
```
Pure domain function `transition()` in
`modules/maintenance-engine/domain/service-ticket-transition.ts`, mirrored
by a DB trigger — the same two-layer split as every other state machine in
this codebase (lead pipeline, change_orders), not a new pattern to justify.

```
service_tickets
  id, organization_id, asset_id, client_id (denormalized, same reasoning as
    assets.client_id), warranty_id (nullable — set when the ticket is a
    warranty claim; determines whether the visit is chargeable, though
    billing for service visits is explicitly out of scope this phase, see
    Consequences), maintenance_plan_id (nullable — set when a plan's
    recurrence is what opened this ticket, null when a client reported an
    ad-hoc problem), status (service_ticket_status enum), title,
    description, reported_by (uuid, users, nullable — null when opened
    from a maintenance_plan rather than a person), assigned_to (uuid,
    users, nullable), resolved_at, resolution_notes,
  created_at, updated_at, deleted_at
```

`warranty_id`'s presence only *flags* a claim; it does not itself gate or
compute anything (no automatic "is this covered" check) — that judgment
stays a human one, reviewed against `warranties.ends_at`/`terms` by
whoever assigns the ticket. Same non-blocking-advisory treatment as margin
warnings.

### 7. "Recurring inspection" = a `service_tickets` row opened from a due `maintenance_plans` row, not a new inspection mechanism

Re-reading the exit criterion's phrase "recurring inspection" against
`quality-gate`'s existing, unrelated `inspections` table (strictly 1:1 with
a `work_package_id`, no schedule): the two are **not the same
mechanism** — "recurring inspection" in Wave 10's own heading ("Recurring")
describes what a due `maintenance_plans` row produces: a periodic
check-in visit, which is exactly what a `service_tickets` row already
models (asset, notes, resolution). No separate `recurring_inspections`
table. A UI action ("Buka tiket dari jadwal ini") on an overdue
`maintenance_plans` row creates a `service_tickets` row with
`maintenance_plan_id` set — the read side already computes which plans are
due (Decision 5), so this is a thin action on top of data that already
exists, not new domain complexity.

### 8. "Galeri before-after" = two new nullable columns on `photos`, not a new table

`photos` already carries everything else this needs (`project_id`,
`zone_id`, `storage_path`, `caption`) — a parallel table would duplicate
all of it for two columns' worth of new information. Add, in a Wave-9
migration (expand, not a destructive change, so no 3-migration dance
needed — CLAUDE.md 2's expand→migrate→contract rule is for drops/renames,
not additive nullable columns):

```
alter table photos add column handover_item_id uuid references handover_items (id) on delete restrict;
alter table photos add column photo_stage photo_stage_enum; -- 'before' | 'after', nullable
```
Both nullable: the overwhelming majority of Fase 4's existing photos are
neither before nor after a handover and must stay valid unchanged.
`handover_item_id` is deliberately **not** used to derive `photo_stage`
(e.g., "any photo on a handover item is implicitly 'after'") — a site
coordinator photographing damage *before* repair, tagged to the same
handover item once repaired, is exactly the case this phase's exit
criterion asks for, and collapsing the two columns into one would make
that case unrepresentable.

The `photos → inspections` FK ARCHITECTURE.md's Fase 5 footnote promised
and never delivered stays undone — out of scope for Fase 9, a Fase 5 gap
this ADR does not adopt responsibility for.

## Consequences

**What this makes easy:** every mechanism here reuses a shape this codebase
has already validated at least once — computed-on-read derived values
(margin, aging, Decision Clock, now `next_due_date`/`overdue`), a small
trigger-mirrored state machine (leads, change_orders, now service_tickets),
a sync trigger off a status transition (invoices↔funding_receipts,
leads↔assessments, now projects↔warranties), and additive nullable columns
on an existing table (this ADR's own `photos` change). Nothing here is a
new *kind* of mechanism.

**What this accepts as a cost, explicitly deferred past this phase:**

- **A single, org-wide default warranty duration** (Decision 3), not
  per-trade terms (structural vs. waterproofing vs. finishes commonly carry
  different legal warranty periods in real construction contracts). Staff
  can edit `ends_at` per warranty after the trigger creates it, so this is
  a defaults problem, not a hard limitation — but it means the first real
  use will need that correction done manually, every time, until a
  configuration screen is worth building.
- **No billing integration.** `service_tickets` has no money column and
  raises no invoice — a chargeable (non-warranty) service visit is tracked
  as a ticket with no financial consequence in this phase. Wiring that into
  `modules/billing` is a real feature, deliberately not this ADR's scope
  (would need its own decision on whether a service visit becomes a
  `milestones`-like billable line or something new).
- **No client-facing Facility Passport UI.** Clients cannot see their own
  assets, warranties, or maintenance history yet — staff-only, same as
  every other Fase 8/9 table until a portal decision is made.
- **No scheduled/background job.** A due maintenance plan is only visible
  when someone looks (Decision 5) — nothing proactively notifies staff a
  plan is overdue. Acceptable for v1 the same way Decision Clock shipped
  without proactive notifications first.

**Reversal cost:** low for most of this (added columns, a new module's own
tables) — the one expensive-to-reverse piece is the default warranty
duration once real warranties exist with real `ends_at` dates computed
from a wrong default; correcting those retroactively means a manual data
pass, not a schema change, so getting the org-wide default right early
matters more than the rest of this ADR.

## Alternatives considered

- **A `recurring_inspections` table separate from `service_tickets`**:
  rejected (Decision 7) — would duplicate nearly every column
  `service_tickets` already needs (asset, notes, who/when) for no
  behavioral difference; the "recurring" part is entirely in
  `maintenance_plans`, not in what a resulting ticket needs to record.
- **A cron/scheduled job to auto-open tickets when a plan comes due**:
  rejected for this phase — no job infrastructure exists in this stack yet,
  and computed-on-read `overdue` (Decision 5) gives the same visible signal
  without needing one; revisit if/when Fase 10's AI Scribe or another
  feature justifies adding a scheduler for other reasons too.
- **A `warranty_terms` lookup table per trade/category, configurable per
  org**: rejected for v1 (Decision 3) — real configurability here is a
  legitimate future feature, but building a settings screen for it now
  before any real warranty data exists to prove out the shape would be
  designing ahead of use, the same restraint ADR 0018 applied to lead
  scoring weights.
- **Deriving `photo_stage` from `handover_item_id`'s mere presence** instead
  of a separate column: rejected (Decision 8) — collapses "before" and
  "after" photos on the same handover item into one bit of information,
  making the literal "before-after gallery" the exit criterion asks for
  unrepresentable.
- **Scoping `assets` to `project_id` instead of `site_id`**: rejected
  (Decision 4) — ARCHITECTURE.md's own wave list already says
  `assets → sites, clients`, and a site outlives any single project
  (renovations, repeat work), so project-scoping would orphan an asset's
  maintenance history every time a new project touches the same site.
