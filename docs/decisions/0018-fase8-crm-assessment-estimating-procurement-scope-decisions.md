# ADR 0018 — Fase 8 (CRM penuh, Assessment, Estimating, Procurement) scope decisions

**Status:** Accepted
**Date:** 2026-07-23

## Context

ARCHITECTURE.md names Fase 8's scope precisely enough to know what's involved
across four modules, but leaves the same category of gap every prior phase
needed an ADR for:

> FASE 8 — CRM penuh, Assessment, Estimating, Procurement
> leads + lead scoring + pipeline; assessment report;
> cost library, estimates versi (V1/V2/V3/baseline), margin warning;
> RFQ → quote comparison → PO (terikat Cash Gate) → deliveries.
> Exit: alur lead → assessment → proposal → kontrak → baseline jalan;
> margin di bawah floor memicu warning.

§2.1's wave list places these tables earlier than Fase 8 itself
(`vendors`/`cost_library` in Wave 2, `leads` in Wave 3, `assessments` in
Wave 4, `estimates` in Wave 5, `estimate_items`/`proposals` in Wave 6,
`vendor_quotes` in Wave 7, `purchase_orders` in Wave 8, `deliveries` in
Wave 9) — the same "wave number is FK depth, not build order" situation
every prior phase's tables have also been in; nothing else has claimed
these tables yet, so this phase claims all of them now.

One thing is *not* ambiguous and needs no decision here: §4.2 already
names the Cash Gate/purchase_orders trigger explicitly ("trigger `BEFORE
INSERT` pada `purchase_orders` ... memanggil `fn_cash_gate_status`"), and
Fase 2's own `cash_gate_action` enum already anticipated it
(`'issue_po'` has existed since CG1, unused until now). This ADR mirrors
`fn_work_packages_guard_cash_gate` exactly rather than inventing a new
mechanism.

Five things are genuinely undecided:

1. **Lead pipeline stages and what "scoring" means.**
2. **How a lead becomes a project** (the wave chain has `estimates →
   projects`, so a project must exist before an estimate does — well
   before any contract).
3. **What an assessment is, structurally**, given it can reference a
   lead *or* a site and happens before a project necessarily exists.
4. **Estimate versioning and "baseline"**, and where the margin floor
   lives.
5. **Whether proposals are their own table or an estimate's status**
   (the wave list says the former).

## Decision

### 1. Leads: a six-stage pipeline, and a transparent, adjustable point score

```
lead_status: 'new' → 'contacted' → 'qualified' → 'assessment_scheduled'
             → 'proposal_sent' → 'won' | 'lost'
```

`'lost'` is reachable from any stage before `'won'` (a lead can die at
any point) — mirrored as a trigger-enforced graph exactly the way
`fn_change_orders_guard_transition` (Fase 3) mirrors
`modules/scope-variation/domain/transition.ts`'s own graph, same
two-layer split (CLAUDE.md 0.3).

Score is a simple, named, additive point sum (`modules/crm/domain/lead-scoring.ts`),
not a black box — the same "give it a concrete first-draft definition,
flag it for the owner to adjust" treatment Decision Clock (ADR 0016) and
the aging tiers (ADR 0017) already got, since nothing in ARCHITECTURE.md
specifies actual weights:

| Factor | Points |
| --- | --- |
| Budget range stated | +25 |
| Timeline stated (wants to start within 90 days) | +25 |
| Referred by an existing client | +30 |
| Estimated project value ≥ Rp 500.000.000 | +20 |

0-100, recomputed on read (not a stored, staleness-prone column) from
`leads`' own fields — same "computed advisory number" shape as the
aging tiers and Decision Clock.

### 2. A lead is converted to a project the moment it's marked `qualified`

Not at `'won'` — a project in `planning` status (the enum value
`projects.status` already has, unused until now) is exactly what lets
an assessment and estimate exist *before* a deal is closed, which the
wave chain's `estimates → projects` dependency requires. Concretely:
`convertLeadToProjectAction` (modules/crm), callable once a lead reaches
`'qualified'`, creates (or attaches to an existing) `client` + `site` +
a `projects` row in `planning` status, and stores the resulting
`project_id` back on the lead (`leads.project_id`, nullable, set once).
Reuses `modules/projects`' own creation functions rather than
duplicating them — client-portal (ADR 0016) and billing (ADR 0017)
already established that pattern for reaching into another module's
data.

The project's status moves to `in_progress` only once a contract is
actually signed (already true today — nothing here changes that).

### 3. Assessments are site-level, not project-level, and stay pre-project when a project doesn't exist yet

`assessments.site_id` (not null) + `assessments.lead_id` (nullable, for
lineage back to whichever lead triggered it) + `assessments.project_id`
(nullable, filled in once the lead has been converted). No photo
attachment in v1: `photos` (Fase 4) requires a non-null `project_id` +
`zone_id` by its own path convention and RLS, and a real project/zone
frequently doesn't exist yet at assessment time — wiring photos in here
would mean a second storage path convention, which is more than this
exit criterion asks for. Findings are structured text fields (site
conditions, recommended scope, notes) an assessor fills in; the "report
generator" is a rendered read view assembling assessment + lead + site
data (same "request-time assembly, no separate stored document" shape
as billing's own pack, ADR 0017 §4) — explicitly *not* an AI-generated
document: `ai-scribe` stays frozen per D7, and nothing here calls it.

### 4. Estimates: integer version numbers, exactly one baseline per project (partial unique index), org-level margin floor

```
estimates.version        integer not null          -- 1, 2, 3, ... per project
estimates.is_baseline    boolean not null default false
estimates.status         estimate_status ('draft','sent','accepted','rejected','superseded')
```

`create unique index uq_estimates_one_baseline_per_project on estimates
(project_id) where is_baseline and deleted_at is null` — the database
itself makes "exactly one baseline" true, not application discipline
alone (CLAUDE.md 0.3). Setting a new baseline unsets the previous one in
the same transaction (`setBaselineEstimateAction`), the same
one-flag-flip-at-a-time shape already used for e.g. a single active
gate override window.

Margin floor is one org-wide setting (`organizations.margin_floor_bp`,
basis points, additive column — same "small ALTER on an
already-shipped table" shape ADR 0017 used for `funding_receipts.invoice_id`),
not per-estimate: simpler, and nothing in the exit criterion asks for
per-estimate floors. `estimate_items` carries both `unit_cost` (internal,
harga beli/upah — never shown to a client, ARCHITECTURE.md 2.6) and
`unit_price` (what the client is charged); margin is computed, not
stored (`modules/estimating/domain/margin.ts`), and "below floor" is a
**warning banner in the UI, not a blocking trigger** — the exit
criterion's own words are "memicu warning", not "menolak" (refuses).
This is one of the few money rules in this codebase enforced only at
the domain/UI layer, not the database, precisely because it is
explicitly a warning rather than a rule (CLAUDE.md 0.3's two-layer
requirement applies to *rules*, not advisory numbers — the same reason
Decision Clock and the aging tiers are UI-only too).

### 5. Proposals are their own table, one per sent estimate

```
proposals: project_id, estimate_id, status ('draft','sent','accepted','rejected'),
           sent_at, decided_at, decided_by, decision_reason
```

Matches the wave list's own `proposals → projects, estimates` (a
separate table, not just a status flag on `estimates`) because a
proposal is a *communication event* about an estimate (when it was
sent, when and how the client decided), while the estimate itself keeps
existing as the numbers regardless of how many times it's proposed.
`decided_by`/`decision_reason` mirror `change_orders`' own
client-decision columns (Fase 3) rather than reusing client-portal's
`client_decisions` table -- that table is deliberately scoped to
`change_orders` only (ADR 0016), and a proposal is not a variation.

### 6. Procurement: vendors, vendor_quotes (the RFQ artifact), purchase_orders (Cash-Gate-guarded), deliveries

No separate `rfqs` table: "RFQ → quote comparison" is the *process* of
asking several vendors for a price on the same need and comparing what
comes back — `vendor_quotes` (one row per vendor's response, already
the wave-listed table) is the concrete artifact that process produces;
a `material_requests` link (Fase 4, already built) is what a quote can
optionally be requested against (`vendor_quotes.material_request_id`,
nullable). Selecting a quote and issuing a PO from it is
`purchase_orders.vendor_quote_id` (nullable — a PO can also be issued
without ever going through a quote, for a simple/known-price purchase).

`fn_purchase_orders_guard_cash_gate` mirrors
`fn_work_packages_guard_cash_gate` exactly: `BEFORE INSERT on
purchase_orders`, checks `fn_cash_gate_status(project_id)`, blocks on
red/overdue unless a `cash_gate_overrides` row with
`action = 'issue_po'` exists from the last 5 minutes — the enum value
Fase 2 already reserved for this. Zero changes to
`fn_cash_gate_status` or the overrides table/trigger; the owner-only
override guard (`fn_cash_gate_overrides_guard_owner_only`) already
applies uniformly to every `cash_gate_action`, `issue_po` included.

`deliveries` is a simple receipt record against a PO: `purchase_order_id`,
`delivered_at`, `notes`, `received_by` — no partial-delivery quantity
tracking in v1 (ARCHITECTURE.md doesn't ask for it; a PO is either
undelivered or has one or more delivery records against it).

## Consequences

**What this makes easy:** every one of these five decisions reuses a
pattern this codebase has already validated at least once (computed
advisory numbers, partial unique indexes for "exactly one X", trigger-
mirrored transition graphs, cross-module reads through public APIs,
DB-first Cash Gate enforcement) — nothing here is a new kind of
mechanism, only new tables using kinds this project already trusts.

**What this accepts as a cost:** assessments carry no photo evidence in
v1 (see §3); a future phase wiring that in needs its own storage path
convention decision, not a retrofit of Fase 4's project/zone-scoped one.

**Reversal cost:** low across all five — the lead status graph, the
baseline uniqueness index, and the PO Cash Gate trigger are each a
single, independently-droppable trigger/index; `organizations.margin_floor_bp`
is an additive column with a sane default (0).

## Alternatives considered

**A numeric/ML lead-scoring model.** Rejected: nothing in
ARCHITECTURE.md asks for one, and an opaque score would be harder to
explain to a non-technical owner than four named, addable factors —
same reasoning ADR 0016 used to reject anything fancier than a 3-tier
Decision Clock.

**`estimates.is_baseline` enforced only by application code, no partial
unique index.** Rejected outright — this is exactly the class of rule
CLAUDE.md 0.3 requires at the database layer, and a partial unique
index is a one-line, zero-maintenance way to make it actually
unbypassable.

**A separate `rfqs` table distinct from `vendor_quotes`.** Rejected:
would only ever hold "we asked" with no content of its own; the request
side is adequately represented by however many `vendor_quotes` rows
exist for a given `material_request_id`/project, and adding a table
that exists purely to record an event with no data of consequence
duplicates what `vendor_quotes.created_at` already tells you.
