# ARCHITECTURE_REVIEW.md — Arkavena OS

**Date:** 2026-07-25
**Scope:** Design review only — no code changed, no migrations run. This document validates the *existing, shipped* architecture (Fase 0–11, all merged) against the revised product philosophy in `PRODUCT.md` and `ADR 0026`.

**Method:** Every claim below is grounded in something actually read from the codebase this session — import graphs, table ownership, RLS matrix entries, line counts, and in three cases the literal rendered page content — not restated from prior ADRs. Where a finding is speculative rather than verified, it says so explicitly. Numbers referenced (LOC, fan-in/fan-out, table counts) come from a direct pass over `src/modules/*`, `src/core/permissions/matrix.ts`, `docs/rls-matrix.md`, and `supabase/migrations/*`.

**Posture:** This is a critical review, not a defense. Where something should be removed, simplified, or flagged as a live risk, it says so plainly.

---

## A. Module-by-module validation

Fourteen modules exist. For each: purpose, primary user, whether its current responsibility is correct, its visibility classification (per ADR 0026), whether it currently violates the new philosophy, and whether it creates unnecessary burden or unnecessary client expectations.

### `crm`
**Purpose:** lead capture/scoring/pipeline; owns `clients`, `client_users`, `sites`, `leads`.
**Primary user:** sales/Owner.
**Responsibility correct?** Yes — genuinely distinct from `assessment` (technical evaluation) and `estimating` (pricing).
**Classification:** Internal Only.
**Violates philosophy?** No.
**Unnecessary burden?** *Watch item, not confirmed.* `lead-transition.ts` (91 lines) implements a 6-stage pipeline state machine (`new→contacted→qualified→assessment_scheduled→proposal_sent→won`, `lost` from anywhere). This is proportionate complexity *if* the sales pipeline actually has this many meaningfully distinct stages in practice at current deal volume — worth a real usage check, not an architecture change.
**Unnecessary client expectations?** No — nothing here is client-facing, correctly.

### `assessment`
**Purpose:** structured pre-contract site assessment (findings, completion sign-off).
**Primary user:** QS/technical assessor.
**Responsibility correct?** Marginal. This is the thinnest module in the system (336 LOC, zero `domain/` files — just `.gitkeep`, one action file, one repository). It exists as a separate module from `crm` purely because ADR 0018 said so, not because it has outgrown being a sub-resource of the lead lifecycle. Its only cross-module dependency is `crm` (one-directional, correctly).
**Classification:** Internal Only for the process. The *report* it produces is genuinely Client Decision Required — but nothing today makes that report a first-class client artifact (see Missing Pieces, Client Communication).
**Violates philosophy?** No, but it under-serves PRODUCT.md's "first trust touchpoint" idea by having zero client-facing surface at all.
**Unnecessary burden?** No — if anything it's under-built, not over-built.
**Unnecessary client expectations?** No, because nothing is exposed yet.

### `estimating`
**Purpose:** versioned cost estimates (V1/V2/V3/baseline), margin-floor checks, client proposals, baseline lock at contract signing. Owns `cost_library`, `estimates`, `estimate_items`, `proposals`.
**Primary user:** QS/Estimator (cost data), Owner (margin/baseline approval).
**Responsibility correct?** Mostly yes — margin isolation from client-visible data (D2.6) is a real, load-bearing boundary and it holds.
**Classification:** Internal Only for `cost_library`/`estimates`/`estimate_items` (correct, protects margin). `proposals` is the one client-decision artifact — see Boundary Review §B for a concrete concern about it sitting in the same module/RLS-blast-radius as margin data.
**Violates philosophy?** Not directly, but see the verified gap below: `proposals` currently has **no client-facing RLS policy at all** (confirmed in `docs/rls-matrix.md` — "no project role, field, or client-facing policy exists for any table in this section"). The client cannot see or decide on a proposal through the system today; this must be happening out-of-band (PDF/email). This is a real gap, covered in Missing Pieces.
**Unnecessary burden?** Estimate versioning (multiple estimate rows + a `baseline` flag) is 1223 LOC for what's conceptually "line items + margin math + a document." Versioning genuinely reflects how real estimates get revised before signing — this is likely earned complexity, but worth a usage check: are V1/V2/V3 revisions actually happening in practice, or is only `baseline` ever used?
**Unnecessary client expectations?** No.

### `procurement`
**Purpose:** RFQ/vendor-quote comparison, Cash-Gate-gated PO issuance, delivery tracking. Owns `vendors`, `vendor_users`, `vendor_quotes`, `purchase_orders`, `deliveries`.
**Primary user:** Procurement staff, TD (override).
**Responsibility correct?** Yes, single cohesive concern.
**Classification:** Internal Only, confirmed.
**Violates philosophy?** No.
**Unnecessary burden?** No — this is real contractor-side complexity independent of the client relationship; removing any of it wouldn't reduce client anxiety, it would just make Arkavena worse at buying materials.
**Unnecessary client expectations?** No — correctly, nothing here has ever been client-facing.

### `projects`
**Purpose:** project/contract/zone/milestone/work-package registry — the record every other module reads.
**Primary user:** effectively everyone internal.
**Responsibility correct?** Yes, and it is already, structurally, the system's shared kernel: **imported by 7 of the other 13 modules** (crm, procurement, cash-gate, scope-variation, quality-gate, billing, ai-scribe) — the highest fan-in by a wide margin. See Boundary Review §B for why this should be named explicitly rather than left implicit.
**Classification:** Internal + Management for raw data; client sees only translated fragments through the Client Timeline layer, never `projects` itself.
**Violates philosophy?** No.
**Unnecessary burden?** No — worth noting positively: `projects` has **zero `domain/` files** (just `.gitkeep`) despite owning 6 tables and being the most-depended-on module. This is correct, not a gap: the business rules that touch its data (when a work package may open, when it may complete, when a zone's variation is legal) live in the specialist modules that gate those transitions (`cash-gate`, `quality-gate`, `scope-variation`), not in `projects` itself. `projects` staying "boringly CRUD" is a sign the boundary is drawn correctly, not a missing feature.
**Unnecessary client expectations?** No.

### `cash-gate`
**Purpose:** block work-package opening / PO issuance when funding coverage is insufficient; one authorized override path.
**Primary user:** Finance, Owner, TD.
**Responsibility correct?** Yes — the most mature, most carefully specified module in the system.
**Classification:** Internal + Management.
**Violates philosophy?** No — verified directly: `vw_client_project_overview` (the client-portal's own project-overview view) contains only `project_name`, `status`, dates, and `contract_title`/`contract_amount`. No cash reserve, no funding ratio, no margin. The view's own SQL comment states this explicitly: *"no risk_reserve_amount, no internal notes, no estimates/cost_library."* This boundary was already correct before this conversation started.
**Unnecessary burden?** No — this is the module the entire "gates are literal, not just SOP" competitive advantage rests on.
**Unnecessary client expectations?** No today. Worth noting: Revision 1 of ADR 0026 (the now-cancelled Confidence Score) would have created exactly this violation by surfacing a derived cash-health number to clients — correctly caught and reversed before any code was written.

### `scope-variation`
**Purpose:** change-order state machine (draft → review → client approval → funded → complete).
**Primary user:** QS/TD (costing, review), Owner/Finance (mark funded), **client** (approve/reject).
**Responsibility correct?** Yes.
**Classification:** Client Decision Required at the approval step (correctly already built this way) / Internal + Management for the state machine mechanics.
**Violates philosophy? — Yes, verified, concretely.** Reading `src/app/(client-portal)/variations/[id]/approve/page.tsx` directly: the client approval screen shows the raw internal `title` and `description` fields verbatim, the exact Rupiah `cost_impact_amount`, `schedule_impact_days`, and — when the variation was already decided — the **raw internal enum value** interpolated directly into a sentence: *"Variation ini sudah diputuskan sebelumnya (status saat ini: {changeOrder.status})"*, which would literally render `awaiting_client_approval` or `submitted_for_review` to a client. This predates the philosophy pivot and is the single clearest concrete instance of "internal kosakata leaking to client" found in this review.

  One nuance worth naming: **the cost-impact amount itself is arguably legitimate to show** — a client deciding whether to approve a cost change needs to know the cost, unlike a cash-gate ratio which is about the company's own money management, not theirs. The `title`/`description`/raw `status` are the clear-cut problems; the cost figure is a judgment call, not an obvious violation.
**Unnecessary burden?** No — the 9-action permission-matrix entry for `change_order` (the most actions of any resource in the system) was checked directly against the actual state machine transitions (create/update/submit_review/review/mark_funded/complete/client_approve/client_reject) and maps one-to-one. This *looks* like the most complex permission entry in the system, but it is proportionate, not over-engineered.
**Unnecessary client expectations?** No — this module already correctly involves the client only where a real decision exists.

### `field-reporting`
**Purpose:** daily logs, progress %, photos, material requests, field issues — SiteFlow's entire data plane.
**Primary user:** Site coordinator/mandor (write), internal staff (read, via the Aktivitas/Foto/Laporan surfaces built in Pillar 1).
**Responsibility correct?** Yes.
**Classification:** Internal Only, confirmed — this is the raw evidence factory, not a client surface.
**Violates philosophy?** No.
**Unnecessary burden?** No.
**Unnecessary client expectations?** No — and importantly, `photos` currently has **no visibility concept at all** (any authorized staff role sees any photo; there is no client read-path into `photos` today). This is the correct current state — it becomes a gap only once the Evidence domain's `visibility` levels are actually built (Missing Pieces, Documentation).

### `quality-gate`
**Purpose:** hold-point inspections gating work-package completion, nonconformity tracking, TD override.
**Primary user:** TD, QS.
**Responsibility correct?** Yes.
**Classification:** Internal + Management.
**Violates philosophy?** No — nothing here is client-facing today.
**Unnecessary burden?** No — this is genuine safety/quality gating, not decorative process.
**Unnecessary client expectations?** No.

### `client-portal`
**Purpose:** the client-facing surface — owns `client_decisions` and all `vw_client_*` views.
**Primary user:** Client.
**Responsibility correct?** Its *data ownership* is correct and, per the spot-checks above, already reasonably disciplined at the SQL-view layer. Its *presentation* is the problem: 8 separate `page.tsx` routes (Ringkasan/Zona/Foto/Keputusan/Timeline/Laporan Mingguan) mirror internal module structure — exactly the tab-per-module IA that ADR 0026 §4 flags as needing to become one Timeline.
**Classification:** Client Visible / Client Decision Required by definition.
**Violates philosophy?** Partially, and concretely: the variation-approval page (above) leaks raw status/cost fields. The rest of the portal's read surfaces (`vw_client_*`) were independently verified to already be appropriately narrow — the violation found is localized to one page, not systemic.
**Unnecessary burden?** No — smallest module by domain footprint (429 LOC total), appropriately thin.
**Unnecessary client expectations?** Possibly, low-confidence: a portal with a dedicated "Zona" tab and a dedicated "Foto" tab (structured like an admin dashboard) may already be training clients to browse module-by-module rather than read one narrative — this is the exact shift ADR 0026 §4 proposes to fix, not a new finding.

### `billing`
**Purpose:** invoice issuance (gated by milestone + QC + variation + TD approval), payments, aging/collections.
**Primary user:** Finance, TD (issuance approval).
**Responsibility correct?** Yes.
**Classification:** Internal + Management for aging/DSO; a narrow Client Visible slice ("an invoice is due") is proposed but **not built** — confirmed by the import graph: `client-portal` does not import `billing`, and nothing in `client-portal`'s routes reads invoice data. No violation exists today because nothing is exposed yet.
**Unnecessary burden?** *Real finding.* `billing` imports from **4 other modules** (`field-reporting`, `projects`, `quality-gate`, `scope-variation`) — the highest fan-out of any module, to assemble the "billing pack" (invoice + evidence + QC result + variation summary) before an invoice may issue. See Simplicity Review §C for whether this belongs inside the module at all.
**Unnecessary client expectations?** No, nothing built yet to create any.

### `maintenance-engine`
**Purpose:** post-handover warranty registry, asset/facility "passport," maintenance plans, service tickets.
**Primary user:** Owner/Ops (planning); client for warranty/service-ticket status (proposed, not built).
**Responsibility correct?** Conceptually yes — post-handover trust is explicitly one of the highest-value moments in PRODUCT.md. But it is the **second-largest module in the entire system by LOC (1292)**, for functionality that only activates after a project reaches handover.
**Classification:** Internal + Management for planning; Client Visible (warranty status, their own service tickets) and Client Decision Required (scheduling a service visit) are proposed in ADR 0026 but **not built** — `client-portal` does not import `maintenance-engine` today, confirmed by the import graph.
**Violates philosophy?** Not yet — nothing client-facing exists to violate.
**Unnecessary burden?** *Real, worth checking, not asserting.* Unlike `partner-desk` (below), no ADR ever gated this module's build against actual completed-project volume. Given the size of this module relative to how many projects in the organization have actually reached handover, this is worth a direct usage check before any more investment here — this review does not have the data to say whether it's overbuilt, only that it's large enough to be worth checking.
**Unnecessary client expectations?** No, not yet.

### `partner-desk`
**Purpose:** read-only views + a narrow response action for suppliers/subcontractors to see their own quotes/POs/deliveries.
**Primary user:** External vendor/subcontractor — **not** the client; a different external party entirely.
**Responsibility correct?** Yes, and cleanly so — no `domain/` folder at all (correctly, it has no state machine of its own), 3 views, 184 total LOC, the smallest and cleanest module in the system.
**Classification:** N/A on the client-visibility axis — this is a different relationship entirely (supplier, not client). Confirmed: zero coupling exists today between `partner-desk` and `client-portal` in either direction; this should be an explicit rule, not an accident (see Boundary Review §B).
**Violates philosophy?** No — the architecture itself is fine.
**Unnecessary burden? — Named plainly, as requested.** This is the **one module in the entire system that was built ahead of proven need.** ADR 0022 stated the volume gate for building this ("bila volume sudah tinggi") was not met; ADR 0023 records the Owner overriding that gate consciously, with `PRE-LAUNCH-CHECKLIST.md` still holding items open specifically because real supplier adoption hasn't been validated. The code itself is not the risk (it's small and clean) — the risk is that it exists and is maintained before anyone has confirmed a real supplier will use it. This was already an explicit, conscious Owner decision, not an oversight — but a critical review should still name it as the system's clearest instance of built-ahead-of-need.
**Unnecessary client expectations?** N/A — not client-facing.

### `ai-scribe`
**Purpose:** staff-facing AI drafting — issue classification, delay detection, quote summary, assessment-scope draft. Server-side only, budget-capped, every output is a draft a human must save.
**Primary user:** whichever staff member handles the issue/quote/assessment being drafted.
**Responsibility correct?** Yes.
**Classification:** Internal Only, confirmed — never a client surface itself; its output becomes client content only after a human explicitly re-saves it through another module's own action.
**Violates philosophy?** No — this module is, today, **the best-aligned module in the system with the new philosophy**, not despite but because of its restraint: ADR 0020's "AI never writes to another module's business tables" is structurally the exact same discipline ADR 0026 §6 now asks of AI everywhere else (draft only, human decides, no fabricated certainty). This module already proves the pattern works; it doesn't need to change, it needs to be pointed to as the template.
**Unnecessary burden?** No.
**Unnecessary client expectations?** No.

---

## B. Boundary review

### Overlapping responsibilities

- **`crm` / `assessment`** — `assessment` is, functionally, "stage two of the same prospect relationship" that lives in a separate module purely by ADR 0018's decision, not because it has outgrown being a lead sub-resource. The dependency direction is correct (assessment → crm, one-way) and there's a real cross-module DB trigger already handling the handoff cleanly (`fn_leads_sync_assessment_project`, confirmed in `docs/rls-matrix.md`). **Not urgent** — this isn't causing pain today, but if `assessment` never grows its own domain logic, merging it into `crm` as a sub-resource would be a legitimate simplification later.

### Tight coupling — one justified, one worth re-examining

- **`cash-gate` ↔ `projects` via `fn_override_and_open_work_package`** (verified in `src/modules/cash-gate/data/cash-gate-overrides-repository.ts`): this is an atomic Postgres RPC, documented in ADR 0010, that records the override *and* opens the work package in a single transaction. This is tight coupling, and it is **correct** — the alternative (two separate calls, one to `cash-gate` and one to `projects`) would create a window where an override is recorded but the work package isn't actually opened, or vice versa. Naming this explicitly: **not every case of tight coupling in this system is a mistake** — this one is deliberate and DB-enforced, not accidental. One small, low-risk untidiness: `cash-gate/types.ts` independently re-declares `export type WorkPackage = Tables<'work_packages'>` instead of importing the type `projects` already exports — harmless (both derive from the same generated schema so they cannot structurally diverge) but worth a one-line cleanup to import instead of redeclare.
- **`billing` → 4 modules** (`field-reporting`, `projects`, `quality-gate`, `scope-variation`) to assemble the billing pack — this is the fan-out outlier in the whole graph and deserves scrutiny (see Simplicity Review §C below).

### Modules that should never communicate directly

- **`partner-desk` ↔ `client-portal`** — different external relationships (supplier vs. client). Zero coupling exists today; this should be written down as an explicit rule for Fase 12+, not left as an accident of build order, since a future "just add one field" change could otherwise blur supplier data into the client's view or vice versa.
- **`client-portal` ↔ `estimating`/`cash-gate` directly** — today `client-portal` imports *nothing* (it reads exclusively through its own `vw_client_*` views, built at the SQL layer). This is the correct pattern and should be stated as a hard rule going forward: the new Client Timeline (ADR 0026 §4) will be tempted to reach into `cash-gate` or `estimating`'s public API directly for "just one more translated field" — it must not. Every client-facing read should go through a narrow view or an explicit translation layer, never a direct module-to-module call into margin- or cash-sensitive modules.

### Modules that should become shared services

- **`projects`** already functions as the system's de facto shared kernel (fan-in of 7, the highest by a wide margin) — this should be *named* as such in `ARCHITECTURE.md`, not left implicit. Practically: any change to `projects`' public API needs to be reviewed as if it were a `core/` change, because 7 other modules depend on its shape, even though structurally it's still a normal module.
- **The proposed `evidence` domain** (ADR 0026 §3) will very likely become a second shared-kernel-like module once built, since almost every module (`field-reporting`, `quality-gate`, `scope-variation`, `maintenance-engine`) has activities that could reasonably attach evidence. Its public API should be designed defensively from day one for that reason — this is a forward-looking note for whenever Fase 12 actually starts, not a criticism of anything built today.
- No existing module belongs in `core/` — `core/` is domain-free by rule (CLAUDE.md §1), and all 14 modules carry real domain concepts. "Shared service" here means "stable public API other modules can lean on," not "move into core."

---

## C. Simplicity review

For each candidate: current design, a simpler alternative, the trade-off, and a recommendation.

### 1. Billing pack assembly lives inside `billing` itself

**Current design:** `modules/billing` imports `field-reporting`, `projects`, `quality-gate`, and `scope-variation` directly (4 modules — the highest fan-out in the system) to assemble the "billing pack" (invoice + evidence + QC result + variation summary) before an invoice may issue.

**Simpler alternative:** Keep `billing` itself thin (own only `invoices`/`payments` + the issuance-eligibility domain rule), and move the *cross-module assembly* of the billing pack to the `app/` page layer — exactly the pattern already used by the `/cc` Command Center dashboard (built in Pillar 2), which composes `cash-gate` + `client-portal` + `field-reporting` signals directly in the page component rather than inside any one module.

**Trade-off:** Assembling inside the module means the "what goes in a billing pack" rule is defined once, testable in isolation, and reusable anywhere (not just one page). Assembling at the page layer means less import fan-out per module, but the composition logic becomes page-specific and harder to reuse if a second surface (e.g., a future client-facing invoice view) needs the same bundle.

**Recommendation:** Not urgent, and probably fine as-is — a billing pack genuinely needs signals from 4 places, and that's real complexity, not accidental complexity. Worth revisiting only if `billing`'s fan-out grows to a 5th or 6th module; at that point the assembly should move to a page-layer composition (or a dedicated read-model action, following the pattern in `/cc/page.tsx`) rather than adding more module-to-module imports.

### 2. Estimate versioning (V1/V2/V3/baseline)

**Current design:** `estimating` supports multiple estimate rows per project with a `baseline` flag, implying a full version-history model.

**Simpler alternative:** A single mutable `estimates` row per project (no versioning), with change history captured only by the existing append-only `audit_logs` (which already tracks every UPDATE via the DB trigger channel).

**Trade-off:** Losing explicit versioning means losing the ability to compare "estimate V1 vs V2 side by side" as a first-class UI feature — you'd have to reconstruct that from audit log diffs, which is possible but much less ergonomic. Versioning as built is genuinely how real construction estimating works (multiple full revisions before signing, not incremental edits) — this is likely earned complexity.

**Recommendation:** Verify usage before touching anything: check whether estimates in practice actually accumulate multiple versions, or whether `baseline` is the only state ever reached. If the latter, this is dormant complexity worth simplifying later; if the former, leave it exactly as built.

### 3. `cash-gate/types.ts` re-derives `WorkPackage` instead of importing it

**Current design:** `export type WorkPackage = Tables<'work_packages'>` is declared independently in both `modules/projects/types.ts` and `modules/cash-gate/types.ts`.

**Simpler alternative:** `cash-gate` imports `WorkPackage` from `@/modules/projects` instead of re-deriving it.

**Trade-off:** None meaningful — both declarations derive from the same generated DB type, so they cannot structurally diverge; this is purely a DRY nitpick, not a correctness risk.

**Recommendation:** Fix opportunistically next time `cash-gate/types.ts` is touched for an unrelated reason. Not worth a dedicated change.

### 4. Eight modules have zero `domain/` logic (just `.gitkeep`)

**Current design:** `assessment`, `procurement`, `projects`, `field-reporting`, and `partner-desk` all have empty `domain/` directories — pure CRUD-and-repository modules with no pure business-rule layer of their own.

**Is this over-engineering?** The opposite question is more interesting: is the *scaffolding requirement* (every module gets a `domain/` folder whether or not it needs one) itself a small tax worth questioning? **No** — this is the correct shape. A module owning data with no independent business rule (e.g., `field-reporting`'s daily logs are just facts being recorded, not a state machine) *should* have an empty domain layer; forcing pure logic into modules that don't need any would be the actual over-engineering. Listed here only to make explicit that this was checked and found correct, not overlooked.

---

## D. Missing pieces (verified gaps, not proposed features)

Scoped to the six areas requested. Only gaps with concrete evidence are listed.

### Construction operations
No gap found that rises to "architectural" — the Cash Gate → Variation → Quality Gate → Billing chain is coherent and already covers the core operational risk surface (money, scope change, quality, invoicing). Nothing missing here changes the architecture; any gaps here are feature-completeness questions (e.g., does every trade/work-type have a hold-point template), not structural ones.

### Multi-project management
**Real gap, verified:** there is no cross-project reporting or comparison surface for Owner/Management beyond the `/cc` dashboard's per-card view (built in Pillar 2). If Arkavena runs more than a handful of concurrent projects, there is currently no view answering "which of my projects need the most attention this week, ranked" beyond the "Perlu perhatian" strip's flat list — no portfolio-level rollup (e.g., total cash exposure across all active projects, aggregate schedule variance). Not urgent at current scale (per project count implied by demo/seed data), but worth flagging now rather than after it becomes painful, since ADR 0026's Client Confidence Score removal correctly killed the *client-facing* version of this — the *internal, staff-facing* portfolio view was never built and is a legitimate, separate need.

### Client communication
**Real gap, verified twice over:**
1. `proposals` — the artifact a prospective client must decide on to become a client at all — has **no client-facing RLS policy whatsoever** (confirmed directly in `docs/rls-matrix.md`). There is no code path today for a client to view or accept a proposal through the system.
2. The variation-approval page (verified above) is the one place a client currently *does* interact with real data, and it already leaks raw internal fields (`title`, `description`, raw status enum) — meaning the one existing client-decision surface predates, and does not yet meet, the translation principle ADR 0026 asks for.

Both are concrete, not hypothetical — this is the area of the whole system furthest from the target state described in PRODUCT.md and ADR 0026.

### Documentation
**Real gap:** `docs/rls-matrix.md` is thorough for *internal* RLS boundaries but has no equivalent single document enumerating exactly what each `vw_client_*` view exposes and why, in one place, cross-referenced against the module classification table in ADR 0026 §5. Today, confirming "does this view leak anything it shouldn't" requires reading migration SQL directly (as this review did) rather than checking one authoritative document. Worth a lightweight `docs/client-visibility-matrix.md` companion to `rls-matrix.md`, specifically because ADR 0026 makes client-visibility classification a first-class architectural concern going forward, not just an RLS afterthought.

### Permissions
No structural gap found. `core/permissions/matrix.ts` (585 lines, 45 resources) was checked for its most complex entry (`change_order`, 9 actions) and it maps proportionately to the real state machine, not over-granularity. The one soft gap: **the client-visibility classification from ADR 0026 §5 (Internal Only / Internal + Management / Client Visible / Client Decision Required) has no representation in the permission matrix itself** — today the matrix only encodes *who can call an action*, not *what tier of information a resource belongs to*. This will need to be reconciled once the classification work becomes real code (e.g., should "Internal + Management" become an actual enforced role tier distinct from "any org role," or does it stay a documentation-only convention?) — an open question, not a gap that blocks anything today.

### Auditability
No gap found in the *mechanism* — `audit_logs` is append-only, dual-channel, already proven (this session's own dashboard work relies on it directly). The one real gap: **there is no client-facing audit surface at all**, by design (correctly, since `audit_logs_select_staff` is staff-only) — but this means if a client ever disputes "you told me X and now it's Y," there is no system-of-record view *they* can point to, only an internal one Arkavena controls. This is very likely the *correct* trade-off given the new philosophy (clients shouldn't need an audit trail — Arkavena's word plus the Client Timeline's dated history should be enough), but it's worth naming as a conscious choice rather than an oversight: if a dispute ever escalates, the audit trail that would resolve it exists only on Arkavena's side.

---

## Summary of what this review found, in one place

- **One concrete philosophy violation already shipped:** the variation-approval client page leaks raw internal fields, most clearly the raw status enum.
- **One concrete, high-value gap:** `proposals` has no client-facing access path at all — the first real client decision in the relationship currently happens outside the system.
- **One conscious risk already owned by the Owner:** `partner-desk` was built ahead of proven supplier volume (ADR 0022/0023) — not a new finding, but the clearest instance in the system of "built before need," worth keeping an eye on.
- **One module worth a real usage check, not a redesign:** `maintenance-engine`'s size (1292 LOC) relative to actual post-handover project volume.
- **Two examples of complexity that looks alarming but is actually correct:** `change_order`'s 9-action permission entry, and the `cash-gate`↔`projects` atomic-RPC coupling — both verified proportionate to real, necessary business rules, included here so the record shows they were checked, not assumed safe.
- **Zero structural violations of D1–D10, zero modules with the wrong table ownership, zero accidental cross-module writes** — the module-boundary discipline this system was built with is, on inspection, actually holding.
