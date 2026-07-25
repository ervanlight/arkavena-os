# WORKFLOW_REVIEW.md — Arkavena OS

**Role:** Senior Construction Operations Consultant review (not a software architecture review — see `ARCHITECTURE_REVIEW.md` for that).
**Date:** 2026-07-25
**Mandate:** Map the complete client lifecycle — first contact through warranty completion — and validate whether Arkavena OS's module ownership actually matches how a construction operation runs, or whether the software is quietly forcing operations to bend around it. Challenge every step. Do not assume the existing workflow is correct.

## How to read this document

Every step below carries a **Basis** tag, per instruction — no conclusion is presented as fact unless it is:

- **[Verified]** — confirmed directly from the repository (schema, RLS matrix, permission matrix, or actual rendered code) this session or the prior architecture review.
- **[Documented]** — stated in an existing ADR or `ARCHITECTURE.md`, not independently re-verified against running code.
- **[Reasoning]** — standard construction-operations practice, applied to this business; not specific to Arkavena, but a reasonable operational inference.
- **[Assumption]** — explicitly labeled guesswork, because Arkavena OS's actual scale, project type mix, and day-to-day habits are not something this review has direct access to.

**One assumption used throughout, stated once rather than repeated on every step:** **[Assumption]** Arkavena appears to run primarily small-to-mid residential construction/renovation projects (kitchens, waterproofing, single-building work) with a small internal team, not large multi-building commercial developments. This shapes several judgments below (e.g., how many approval layers are proportionate). If this is wrong, several "this seems like enough gates" conclusions should be re-checked against a larger operation's real risk profile.

---

## Phase 0 — First Contact & Qualification

### Step 0.1 — Lead Capture
- **Objective:** Record a prospect's interest before any resource (site visit, estimator time) is spent on them.
- **Role:** Whoever answers inbound inquiries — [Assumption] likely Owner or a small sales/admin function, given the operation's apparent size.
- **Inputs:** Contact name, phone/email, project interest, source (referral/ad/website).
- **Outputs:** A `leads` row, status `new`.
- **Decision(s):** None yet — pure capture.
- **Module:** `crm` — **[Verified]** owns `leads`, `clients`, `sites`, `client_users`.
- **Ownership correct?** Yes.
- **Should this step exist?** Yes — every real sales process needs an intake point.
- **Missing?** No `source` breakdown reporting exists (which channel converts best) — **[Reasoning]** this is a normal thing a growing sales operation eventually wants, but absence today is not a blocker, just a future question.
- **Unnecessary work?** No.

### Step 0.2 — Lead Qualification
- **Objective:** Decide whether a lead is worth a technical site visit — filters out inquiries with no real budget/timeline/fit.
- **Role:** Sales/Owner.
- **Inputs:** `budget_known` flag, `estimated_value`, `desired_start_date` — **[Verified]**, these are real columns on `leads`.
- **Outputs:** Status moves `new→contacted→qualified`, or `lost` (with `lost_reason` — **[Verified]**, `ck_leads_lost_reason_requires_lost` constraint enforces this isn't skipped).
- **Decision(s):** Proceed to assessment, or decline.
- **Module:** `crm`.
- **Ownership correct?** Yes.
- **Should this step exist?** Yes — skipping qualification means every inquiry gets a full site visit, which doesn't scale.
- **Missing?** Nothing structural.
- **Unnecessary work?** No — this is the cheapest possible filter before spending an estimator's time.

**Phase 0 finding — a genuine sequencing question, not a software bug:** **[Verified]** `convertLeadToProjectAction` only requires a lead be `qualified` — the *third* of six pipeline stages (`new→contacted→qualified→assessment_scheduled→proposal_sent→won`) — to create a real `project` row. That means a "project" can exist in the system, on the Owner's Command Center dashboard, **before a site assessment has even happened and long before any contract is signed.** `project_status` (`planning/in_progress/on_hold/completed/cancelled`) has no state for "this is still just a qualified opportunity, nothing is confirmed." **[Reasoning]** In real construction operations, calling something a "project" before a contract exists is operationally risky — staff may start treating a maybe-deal as a real one (allocating attention, mentioning it to a subcontractor, etc.) before money has actually changed hands. **This is worth flagging to the Owner as a genuine operational ambiguity, not a hypothetical one** — it's a direct, verified consequence of when `convertLeadToProjectAction` is allowed to run.

---

## Phase 1 — Assessment & Proposal

### Step 1.1 — Site Visit Scheduling
- **Objective:** Get a qualified prospect's actual site in front of someone technical, so the estimate is based on reality, not the prospect's description.
- **Role:** Assessor/QS.
- **Inputs:** Lead contact info, `sites` record.
- **Outputs:** Lead status → `assessment_scheduled`; an `assessments` row created (status presumably `scheduled` or similar).
- **Decision(s):** When/who visits.
- **Module:** `assessment`.
- **Ownership correct?** Yes, though the module is very thin (**[Verified]**, from `ARCHITECTURE_REVIEW.md`: 336 LOC, zero domain logic) — appropriate for what this step actually needs.
- **Should this step exist?** Yes, non-negotiable in construction — no responsible contractor prices work sight-unseen.
- **Missing?** No scheduling/calendar concept exists in the system at all — **[Verified]**, `assessments` has no `scheduled_at` field, only `assessed_at` (when it was *completed*). **[Reasoning]** scheduling is very likely happening by phone/WhatsApp outside the system today, which is fine at small scale but means there's no system record of "when did we say we'd show up" if a client disputes timeline later.
- **Unnecessary work?** No.

### Step 1.2 — Technical Assessment / Findings
- **Objective:** Determine what's actually buildable, existing-condition constraints, and a recommended scope.
- **Role:** QS/technical assessor.
- **Inputs:** Site visit observations.
- **Outputs:** `assessments.site_conditions`, `recommended_scope`, `assessed_by`/`assessed_at` — **[Verified]** these columns exist and a DB constraint (`ck_assessments_completed_requires_assessor`) forces both to be set before status can be `completed`.
- **Decision(s):** Is this feasible at all? What's the recommended scope?
- **Module:** `assessment`.
- **Ownership correct?** Yes.
- **Should this step exist?** Yes.
- **Missing?** No standard checklist/template concept — every assessment is a free-text `notes`/`site_conditions` field. **[Reasoning]** for a small operation this is probably fine (an experienced QS knows what to check); it becomes a real gap only once there's more than one assessor and consistency across their reports starts to matter.
- **Unnecessary work?** No.

**Positive finding, worth stating plainly:** **[Verified]** `estimates.assessment_id` is a real foreign key — the cost estimate is structurally linked back to the assessment that justified it. This means the "does the estimator actually see what the assessor found" information-gap risk that a consultant would normally flag **does not exist here** — it's already wired correctly at the schema level.

### Step 1.3 — Cost Estimation
- **Objective:** Turn the assessed scope into priced line items.
- **Role:** QS/Estimator.
- **Inputs:** `assessment_id`, `cost_library` items.
- **Outputs:** `estimates` + `estimate_items` rows, versioned (**[Verified]**, `estimates.version` + `is_baseline` columns).
- **Decision(s):** What to include, at what price.
- **Module:** `estimating`.
- **Ownership correct?** Yes — margin-sensitive data correctly isolated (D2.6, already verified in the prior architecture review).
- **Should this step exist?** Yes.
- **Missing?** Nothing structural.
- **Unnecessary work?** Possibly, per `ARCHITECTURE_REVIEW.md`'s prior finding: version history (V1/V2/V3) is real complexity that's only earned if estimates genuinely get revised multiple times pre-signature in practice — **[Reasoning]**, unverified either way, restated here because it directly affects this step's actual day-to-day burden.

### Step 1.4 — Margin / Pricing Review
- **Objective:** Make sure the price protects the business before it's shown to a client.
- **Role:** Owner (or whoever holds margin authority).
- **Inputs:** Estimate total, `organizations.margin_floor_bp`.
- **Outputs:** Warning if under floor (per `ARCHITECTURE.md`'s estimating domain), estimate approved for proposal.
- **Decision(s):** Approve, adjust, or reject pricing.
- **Module:** `estimating`.
- **Ownership correct?** Yes.
- **Should this step exist?** Yes — skipping this is how contractors go broke on "we'll figure out the margin later" jobs.
- **Missing?** Nothing.
- **Unnecessary work?** No.

### Step 1.5 — Proposal Presentation
- **Objective:** Give the prospect a concrete, signable document.
- **Role:** Owner/Sales.
- **Inputs:** Approved estimate.
- **Outputs:** `proposals` row (draft → sent).
- **Decision(s):** Send now, or hold for more internal review.
- **Module:** `estimating` (owns `proposals`).
- **Ownership correct?** Structurally yes — but see the critical gap below.
- **Should this step exist?** Yes.
- **Missing? — Real, high-severity gap, verified twice over:**
  1. **[Verified]** `docs/rls-matrix.md` states plainly, for the entire Fase 8 table set including `proposals`: *"no project role, field, or client-facing policy exists for any table in this section."* There is **no way for a client to log into Arkavena OS and view or accept a proposal today.**
  2. **[Verified]** `permission-matrix.ts`'s `proposal` resource lists only `view/create/send/decide`, all restricted to `[...ORG_ROLES]` — i.e., **staff record the client's decision on the client's behalf** (presumably after a verbal/email/PDF exchange happens entirely outside the system).
  - **[Reasoning]:** this means the single most important moment in the entire client relationship — *"do you want to become our client"* — happens completely outside the system that's supposed to be the trust relationship's home. Whatever "Arkavena OS" experience the client eventually gets starts only *after* this step, with zero continuity from how they were treated during the sale.
- **Unnecessary work? — Yes, a real one:** because there's no in-system client decision path, staff must be manually re-keying the outcome ("client said yes over the phone") into `decide` — this is duplicate administrative work layered on top of whatever the actual sales conversation already was (email thread, verbal agreement, signed PDF), with no single system of record for *why* the client said yes or what exactly they agreed to see.

### Step 1.6 — Client Decision on Proposal
- **Objective:** Get to a real yes/no/negotiate.
- **Role:** Client (external) / Owner (recording it).
- **Inputs:** Presented proposal.
- **Outputs:** `won`/`lost` on the lead, `accepted`/`rejected` on the proposal.
- **Decision(s):** Accept as-is, negotiate, or walk away.
- **Module:** `estimating` + `crm` (lead status).
- **Ownership correct?** See 1.5 — the *recording* is correctly owned, the *client's actual participation* is not owned by anything.
- **Should this step exist?** Yes, obviously.
- **Missing?** Same gap as 1.5.
- **Unnecessary work?** Same as 1.5 — negotiation rounds, if they happen, are presumably tracked nowhere but a new estimate version or someone's inbox.

---

## Phase 2 — Contracting & Mobilization

### Step 2.1 — Contract Execution
- **Objective:** Formal, legally binding agreement on scope, price, and terms.
- **Role:** Owner + Client (signature).
- **Inputs:** Accepted proposal.
- **Outputs:** `contracts` row (`status: draft→active`, `contract_amount`, `signed_date`).
- **Decision(s):** Final terms.
- **Module:** `projects` — **[Verified]**, `contracts` is owned by `modules/projects`, not `estimating` or `crm`.
- **Ownership correct?** Debatable, worth naming. `contracts` living in `projects` rather than alongside the proposal that produced it (`estimating`) is a real seam: the artifact a client signs is disconnected, at the module-ownership level, from the proposal it was negotiated from. **[Verified]** there is no FK from `contracts` to `proposals` in the schema at all — nothing links a signed contract back to the specific proposal version the client actually agreed to. **[Reasoning]:** if a client later disputes "that's not what I agreed to," there is no structural trail from contract → proposal → estimate → assessment; the chain breaks exactly at the contract/proposal boundary.
- **Should this step exist?** Yes, obviously — no construction work should start without a signed contract.
- **Missing?** The `contracts.proposal_id` link described above.
- **Unnecessary work?** No.

### Step 2.2 — Deposit / Initial Payment Collection
- **Objective:** Collect the deposit before committing crew/materials.
- **Role:** Finance.
- **Inputs:** Contract terms.
- **Outputs:** **[Assumption]** — this review could not verify a specific "deposit" concept distinct from milestone billing. `billing`'s `invoices`/`payments` presumably handle this as milestone #1, but nothing in the schema names a deposit specifically.
- **Decision(s):** Deposit amount/terms (presumably set in the contract, not the system).
- **Module:** `billing` (assumed).
- **Ownership correct?** Unclear — flagged as a gap below rather than asserted as correct or wrong.
- **Should this step exist?** Yes — nearly universal in construction (no responsible contractor self-funds mobilization).
- **Missing? — Real gap:** **[Reasoning]** if deposit collection is just "the first milestone invoice," that's fine; if it's handled entirely outside the system (bank transfer confirmed by screenshot in a chat), then **cash-gate's entire funding-coverage calculation is only as good as whether that deposit was correctly, promptly recorded as a `funding_receipt`** — a manual step with no system nudge to remind Finance to log it same-day. This is exactly the kind of high-risk handoff the review was asked to look for: **the entire Cash Gate mechanism (the system's most trust-critical feature) depends on a human remembering to type in a number after money arrives in a bank account, with nothing in the system creating urgency around that specific action.**
- **Unnecessary work?** No, but see above.

### Step 2.3 — Project Setup (Zones, Milestones, Work Packages)
- **Objective:** Break the contracted scope into schedulable, trackable, billable, gateable units.
- **Role:** PM/Owner.
- **Inputs:** Signed contract, assessment findings.
- **Outputs:** `zones`, `milestones`, `work_packages` rows.
- **Decision(s):** How to decompose the work.
- **Module:** `projects`.
- **Ownership correct?** Yes.
- **Should this step exist?** Yes.
- **Missing?** Nothing structural.
- **Unnecessary work?** No — this decomposition is exactly what later lets Cash Gate, Quality Gate, and Billing each gate the right unit of work.

### Step 2.4 — Permit / Legal Compliance Check
- **Objective:** **[Assumption]** In Indonesian construction, depending on scope (structural work, new construction vs. cosmetic renovation), a building permit (PBG, formerly IMB) or at minimum a notification to the local RT/RW may be legally or practically required before work begins.
- **Role:** **[Assumption]** Owner/PM, possibly outsourced to a permit-processing agent.
- **Inputs/Outputs/Decisions:** Unknown — **[Verified]** there is no `permits`, `izin`, or equivalent table anywhere in the schema, and no mention of permits in any ADR reviewed.
- **Module:** None. No module owns this.
- **Ownership correct?** N/A — nothing owns it.
- **Should this step exist?** **[Reasoning]** — very likely yes, for at least some project types Arkavena handles (structural renovation, new builds). For purely cosmetic work (kitchen refresh, painting), it may genuinely not apply. This review cannot determine which is the common case for Arkavena's actual project mix — **flagged as a real question for the Owner, not asserted as a gap that must be filled.**
- **Missing?** If permit-dependent projects are common, this is a real gap: there is no way to see, from inside the system, whether a project is legally clear to start, and no gate preventing mobilization before it is. **[Reasoning, not verified as an actual incident]** — this is the kind of gap that causes real damage only once (a stop-work order, a neighbor complaint) but is invisible until it does.
- **Unnecessary work?** N/A.

### Step 2.5 — Pre-Mobilization Cash Gate Check
- **Objective:** Confirm the project is actually funded before crew/materials commit.
- **Role:** System (automatic) + Finance/Owner (override, if needed).
- **Inputs:** `funding_receipts`, `cash_forecasts`, `project_risk_reserves`.
- **Outputs:** Gate status (green/yellow/red/overdue).
- **Decision(s):** Proceed, wait, or override with a documented reason.
- **Module:** `cash-gate`.
- **Ownership correct?** Yes — this is the module's whole reason for existing, and it's the system's most mature part.
- **Should this step exist?** Yes, unambiguously — this is the mechanism the entire "gates are literal, not just policy" trust claim (from `PRODUCT.md`) rests on.
- **Missing?** Nothing, other than the upstream data-entry dependency noted in 2.2.
- **Unnecessary work?** No.

### Step 2.6 — Initial Procurement
- **Objective:** Order the materials needed to start (or long-lead items).
- **Role:** Procurement staff.
- **Inputs:** Work package scope.
- **Outputs:** `vendor_quotes` → `purchase_orders` (Cash-Gate-gated) → `deliveries`.
- **Decision(s):** Which vendor, at what price.
- **Module:** `procurement`.
- **Ownership correct?** Yes.
- **Should this step exist?** Yes.
- **Missing?** Nothing structural.
- **Unnecessary work?** No.

---

## Phase 3 — Execution (Daily Operations)

### Step 3.1 — Site Mobilization
- **Objective:** Crew and initial materials physically arrive; work actually begins.
- **Role:** Site coordinator/mandor.
- **Inputs:** Open work packages.
- **Outputs:** First daily log.
- **Decision(s):** None structural — this is a physical event, not a system decision.
- **Module:** `field-reporting` (records it, doesn't gate it).
- **Ownership correct?** Yes.
- **Should this step exist?** Yes.
- **Missing?** Nothing.
- **Unnecessary work?** No.

### Step 3.2 — Daily Reporting Loop
- **Objective:** Create a same-day record of what happened on site.
- **Role:** Site coordinator/mandor.
- **Inputs:** Weather, manpower count, notes.
- **Outputs:** `daily_logs` row.
- **Decision(s):** None.
- **Module:** `field-reporting`.
- **Ownership correct?** Yes.
- **Should this step exist?** Yes.
- **Missing?** Nothing structural — this is the exact evidence factory the whole trust model depends on.
- **Unnecessary work? — Real risk, not a fact:** **[Reasoning]** a 6-tile mobile form (built in Pillar 1) is about as low-friction as this kind of daily admin gets, but *any* daily logging requirement competes with a mandor's actual job. **This is the single most likely place in the whole system for staff to bypass the system** — if the app is slow, offline, or the mandor is simply busy, the fallback is a WhatsApp photo to the office instead of a logged entry, and nothing in the system would ever know the gap exists. **[Assumption]** the offline outbox (built in an earlier fase) mitigates the connectivity excuse specifically, but not the "too busy to open the app" excuse.

### Step 3.3 — Progress Tracking
- **Objective:** Quantify how much of each work package is actually done.
- **Role:** Site coordinator/mandor.
- **Module:** `field-reporting` (`progress_entries`).
- **Ownership correct?** Yes.
- **Should this step exist?** Yes.
- **Missing?** Nothing structural. **[Reasoning]** progress percentage is inherently subjective (mandor's own estimate of "60% done") with no independent verification step other than the eventual Quality Gate inspection — this is normal in construction (nobody expects a laser scan of completion %), just worth naming as an inherent limitation, not a system flaw.
- **Unnecessary work?** No.

### Step 3.4 — Material Request Fulfillment
- **Objective:** Site requests materials it's running low on or wasn't provisioned initially.
- **Role:** Site coordinator (request) → Procurement (fulfill).
- **Module:** `field-reporting` owns the request; `procurement` presumably fulfills it — **[Verified]** these are two different modules with no direct coupling found in the import graph (from the prior architecture review).
- **Ownership correct?** This is a real seam worth naming: a `material_requests` row in `field-reporting` has no verified structural link to a `purchase_orders`/`vendor_quotes` row in `procurement`. **[Verified, via the import graph in `ARCHITECTURE_REVIEW.md`]** `procurement` does not import `field-reporting`, and vice versa.
- **Should this step exist?** Yes.
- **Missing? — Real gap:** if there's no link between "site asked for X" and "office ordered X," a material request could be silently dropped, or the office could order the same thing twice because they didn't check whether a request already covers it. **[Reasoning]** — this is exactly the kind of information gap that causes either duplicate procurement or a site waiting on materials nobody realized were requested.
- **Unnecessary work?** Potentially — if procurement is re-triaging requests manually via a different channel (phone call, WhatsApp) because the system doesn't connect the two sides, that's duplicate coordination work.

### Step 3.5 — Field Issue Reporting & Resolution
- **Objective:** Surface problems (damage, unexpected conditions, safety concerns) as they happen.
- **Role:** Site coordinator/mandor (report) → whoever's responsible (resolve).
- **Module:** `field-reporting` (`issues`).
- **Ownership correct?** Yes.
- **Should this step exist?** Yes.
- **Missing?** No severity-based escalation/notification found — an `issue` with `severity: high` sits in the list the same as any other until someone happens to look. **[Verified]** the Command Center dashboard (Pillar 2) does surface high-severity open issues in the "Perlu perhatian" strip — so this is *partially* mitigated, but only for staff who visit that dashboard; there's no push/notification.
- **Unnecessary work?** No.

### Step 3.6 — Quality Hold-Point Inspection
- **Objective:** Independent verification before work becomes hard/impossible to inspect later (e.g., before closing a wall over waterproofing).
- **Role:** TD/QS (inspector).
- **Module:** `quality-gate`.
- **Ownership correct?** Yes — and this is correctly gated at the DB layer (work package can't proceed without a passed inspection), per the prior architecture review.
- **Should this step exist?** Yes, unambiguously — this is real construction risk management, not bureaucracy.
- **Missing?** Nothing structural.
- **Unnecessary work?** No — **[Reasoning]** hold points exist specifically because *not* inspecting before closing work is how expensive rework and warranty disputes happen; this is the opposite of unnecessary administration.

### Step 3.7 — Nonconformity Resolution
- **Objective:** Fix what failed inspection, then re-verify.
- **Role:** Site team (fix) → TD/QS (re-inspect).
- **Module:** `quality-gate` (`nonconformities`).
- **Ownership correct?** Yes.
- **Should this step exist?** Yes.
- **Missing?** Nothing structural.
- **Unnecessary work?** No.

---

## Phase 4 — Scope Change Handling

### Step 4.1 — Variation Request Origination
- **Objective:** Capture a client- or site-originated change to the contracted scope.
- **Role:** Anyone who spots the need (client asks, or site discovers a condition requiring a change) — **[Verified]** `change_order.create` permission is `[...ORG_ROLES]`, any staff role.
- **Module:** `scope-variation`.
- **Ownership correct?** Yes.
- **Should this step exist?** Yes.
- **Missing?** Nothing structural.
- **Unnecessary work?** No.

### Step 4.2 — Cost/Schedule Impact Assessment
- **Objective:** Price the change before anyone commits to it.
- **Role:** QS.
- **Module:** `scope-variation` (`setChangeOrderImpactAction`).
- **Ownership correct?** Yes.
- **Should this step exist?** Yes.
- **Missing?** Nothing.
- **Unnecessary work?** No.

### Step 4.3 — Internal Review
- **Role:** Owner/TD/QS — **[Verified]**, `change_order.review` is restricted to exactly these three roles.
- **Module:** `scope-variation`.
- **Ownership correct?** Yes.
- **Should this step exist?** Yes — a variation shouldn't reach the client before someone senior has sanity-checked the costing.
- **Missing?** Nothing.
- **Unnecessary work? — Worth a genuine question, not a conclusion:** the full chain for one variation is: create → set impact → submit for review → internal review → client approve/reject → mark funded → complete. **[Reasoning]** For a large, expensive structural change, six gates is proportionate. For a small, cheap variation (e.g., swapping a tile color at no cost difference), the *same* six-gate chain applies — **[Assumption]** there is no "fast lane" for trivial, zero-cost-impact variations, and this could be real unnecessary process weight for small changes, though this review has no data on how often trivial variations actually occur at Arkavena.

### Step 4.4 — Client Approval
- **Role:** Client.
- **Module:** `client-portal` reads `scope-variation`'s data directly.
- **Ownership correct?** Yes, structurally — but **[Verified, restated from `ARCHITECTURE_REVIEW.md`]** the actual client-facing screen shows the raw `title`/`description` fields and, if already decided, the raw internal status enum verbatim. This is a real, already-flagged UI issue, not a new finding — restated here because it directly affects this operational step: the client is being asked to make a real decision using system copy that wasn't written for them.
- **Should this step exist?** Yes — this is one of the few moments the client genuinely must decide something.
- **Missing?** The `client_summary` plain-language field proposed in ADR 0026 §4 — not yet built.
- **Unnecessary work?** No, the decision itself is necessary; the friction is in how it's presented, not whether it should exist.

### Step 4.5 — Funding Confirmation
- **Role:** Owner/Finance.
- **Module:** `scope-variation` (`mark_funded`).
- **Ownership correct?** Yes.
- **Should this step exist?** Yes — a variation shouldn't unlock new work before its own extra funding is confirmed, mirroring Cash Gate's own logic.
- **Missing?** Nothing.
- **Unnecessary work?** No.

### Step 4.6 — New Work Package Activation
- **Role:** System (once funded).
- **Module:** `scope-variation` creates the `work_package`, owned by `projects`.
- **Ownership correct?** Yes — correctly cross-module, and per the prior review's boundary check, this exact kind of hand-off already works.
- **Should this step exist?** Yes.
- **Missing?** Nothing.
- **Unnecessary work?** No.

---

## Phase 5 — Billing & Collection

### Step 5.1 — Milestone Completion Verification
- **Objective:** Confirm a billable milestone is genuinely done before invoicing it.
- **Role:** PM/TD.
- **Module:** `projects` (milestone status) + `quality-gate` (QC state) + `scope-variation` (no unresolved variation blocking it).
- **Ownership correct?** Yes — correctly cross-referenced by `billing`'s issuance gate.
- **Should this step exist?** Yes.
- **Missing?** Nothing.
- **Unnecessary work?** No.

### Step 5.2 — Invoice Issuance Gate
- **Objective:** Block invoicing until milestone + QC + variation + TD approval are all genuinely satisfied.
- **Role:** TD (final approval).
- **Module:** `billing`.
- **Ownership correct?** Yes.
- **Should this step exist?** Yes — this is exactly the "billing pack" mechanism `PRODUCT.md` calls out as already-correct.
- **Missing?** Nothing.
- **Unnecessary work?** No — **[Reasoning]** this is one of the few places in the whole workflow where more gates is clearly better, not worse: an invoice issued for incomplete/unverified work is a direct trust failure, not administrative overhead.

### Step 5.3 — Invoice Presentation to Client
- **Objective:** The client actually receives and understands the invoice.
- **Role:** Finance.
- **Module:** None currently — **[Verified, restated from `ARCHITECTURE_REVIEW.md`]** `client-portal` does not import `billing`; there is no in-system path for a client to see an invoice today.
- **Ownership correct?** N/A — unbuilt.
- **Should this step exist?** Yes.
- **Missing?** A client-visible "invoice ready, due by X" surface — already identified in `ARCHITECTURE_REVIEW.md`, restated here as an operational (not just architectural) gap: **[Reasoning]** whatever channel is currently used (email, WhatsApp, PDF) to tell a client "please pay this" is disconnected from the system that tracks whether they actually did.
- **Unnecessary work?** Likely yes — Finance is probably manually cross-referencing "did they pay the thing I sent them outside the system" against `payments` records, which is duplicate bookkeeping.

### Step 5.4 — Payment Collection
- **Objective:** Money actually arrives.
- **Role:** Finance (recording), Client (paying).
- **Module:** `billing` (`payments`).
- **Ownership correct?** Yes.
- **Should this step exist?** Yes.
- **Missing?** Nothing structural, but see 2.2's finding — this is the same "does someone remember to log it promptly" dependency, now for milestone payments instead of the deposit.
- **Unnecessary work?** No.

### Step 5.5 — Overdue Handling
- **Objective:** Escalate unpaid invoices before they become a real cash problem.
- **Role:** Finance.
- **Module:** `billing` (`listAgingDashboardAction`), feeding `cash-gate` indirectly (overdue invoices affect funding coverage).
- **Ownership correct?** Yes.
- **Should this step exist?** Yes.
- **Missing?** No client-facing reminder mechanism (a polite "your invoice is due" nudge) — currently, if it exists at all, it's a manual phone call/message, disconnected from the aging data the system already computes.
- **Unnecessary work?** Yes, mildly — Finance is doing from-memory follow-up on data the system already has computed and ranked (the aging dashboard), just not surfaced as an actionable reminder.

---

## Phase 6 — Ongoing Client Communication (cross-cutting)

This phase runs in parallel with Phases 2–5, not after them — but it's the area the founder has most recently redirected the product toward, so it's treated as its own phase here rather than buried inside each execution step.

### Step 6.1 — Status Communication Cadence
- **Objective:** The client always knows, without asking, whether things are on track.
- **Role:** Staff (curator) + AI (drafts, per ADR 0026).
- **Inputs:** Whatever's happening internally (delays, QC results, cash status) that's judged relevant.
- **Outputs:** A published `client_status_updates` entry (proposed, ADR 0026 — **not yet built**).
- **Decision(s):** What's relevant enough to tell the client, and when.
- **Module:** `client-portal` (proposed).
- **Ownership correct?** N/A — doesn't exist yet.
- **Should this step exist?** Yes, unambiguously — this is the actual product mission (`PRODUCT.md`: reduce client anxiety).
- **Missing? — The central gap of this entire review:** there is currently **no systematic communication cadence at all.** Every prior phase's "how does the client find out" question (proposal decision, variation, invoice, delay) currently resolves to "outside the system" or "not yet built." **[Reasoning]** Until this exists, Arkavena OS's actual day-to-day client experience is not "calm and informed" — it's simply *absent*, and the real communication is happening entirely through whatever informal channel staff already use (calls, WhatsApp), which is fine operationally but means the trust-relationship value the whole product is meant to deliver has no system behind it yet.
- **Unnecessary work?** N/A — nothing built to create work.

### Step 6.2 — Client Decision-Point Facilitation
- **Objective:** Make sure a client never has an unanswered decision sitting for days without anyone noticing.
- **Role:** Staff.
- **Module:** `client-portal` (Decision Clock, **[Verified]** already built — `fresh/aging/overdue` tiers).
- **Ownership correct?** Yes, and this is one of the more mature pieces of the client-facing system.
- **Should this step exist?** Yes.
- **Missing?** No staff-facing reminder/nudge tied to an aging decision beyond the dashboard's "Perlu perhatian" strip (built Pillar 2) — same limitation as 5.5: the data exists, ranked, but nothing pushes it to a human at the moment it starts mattering.
- **Unnecessary work?** No.

---

## Phase 7 — Completion & Handover

### Step 7.1 — Final Inspection / Practical Completion
- **Objective:** Confirm every work package genuinely meets the contracted scope.
- **Role:** TD/QS.
- **Module:** `quality-gate` (per-package) — **[Reasoning]** there is no verified "final project-wide sign-off" concept distinct from the last individual work package's own inspection; a whole-project completion inspection, if it exists operationally, isn't a separate schema concept.
- **Ownership correct?** Partially — the per-package mechanism is solid; a project-level "are we actually, holistically done" step doesn't have its own record.
- **Should this step exist?** Yes, and **[Reasoning]** a final walkthrough that looks at the *whole* finished result (not just each package in isolation) is standard practice — small issues sometimes only become visible once everything is assembled together (e.g., two individually-passed finishes that don't match once seen side by side).
- **Missing?** A project-level completion checklist/sign-off distinct from work-package-level inspections.
- **Unnecessary work?** No.

### Step 7.2 — Handover Walkthrough & Item Recording
- **Objective:** Formally transfer the completed work, keys, manuals, and warranty terms to the client.
- **Role:** PM/TD.
- **Module:** `maintenance-engine` (`handover_items`).
- **Ownership correct?** Yes.
- **Should this step exist?** Yes — this is the single highest-trust moment post-construction, per `PRODUCT.md`.
- **Missing?** **[Verified]** no client-facing surface exists for this yet (`client-portal` does not import `maintenance-engine` — restated from `ARCHITECTURE_REVIEW.md`). The client's own handover record — keys received, warranty terms, what was actually handed over — currently lives somewhere only staff can see.
- **Unnecessary work?** No, but the client not having their own copy of this record is a real service gap, not just a software one — **[Reasoning]** a client should be able to independently check "what warranty terms did we agree to" without calling the office.

### Step 7.3 — Final Payment / Retention Release
- **Objective:** Collect any remaining balance, release any retention held against defects.
- **Role:** Finance.
- **Module:** `billing`.
- **Ownership correct?** Yes structurally, though **[Assumption]** this review found no explicit "retention" concept distinct from a regular milestone invoice — if Arkavena's contracts include a retention clause (common in construction, holding back e.g. 5% until the warranty period confirms no defects), it isn't a distinct, trackable thing in the schema today.
- **Should this step exist?** Yes, if retention is actually part of Arkavena's contract terms.
- **Missing?** A retention-specific tracking mechanism, if applicable — flagged as a question, not asserted as a confirmed gap.
- **Unnecessary work?** N/A.

### Step 7.4 — Client Sign-off
- **Objective:** Client formally acknowledges completion and acceptance.
- **Role:** Client.
- **Module:** None found — **[Verified]** no `client_decisions` type exists for "accept handover," only for change-order approval.
- **Ownership correct?** N/A — unbuilt.
- **Should this step exist?** Yes — a construction handover without a client's formal acceptance is a real legal/dispute exposure.
- **Missing?** Real gap: there's no in-system equivalent of a signed handover/acceptance document.
- **Unnecessary work?** N/A — likely handled on paper today, which is fine, but means it's the one part of the entire lifecycle with zero digital record at all.

---

## Phase 8 — Post-Handover & Warranty

### Step 8.1 — Warranty Period Activation
- **Objective:** Start the clock on defect-liability coverage.
- **Role:** System (automatic, per ARCHITECTURE.md's Fase 9 exit criterion: "proyek selesai otomatis membentuk warranty register").
- **Module:** `maintenance-engine` (`warranties`).
- **Ownership correct?** Yes.
- **Should this step exist?** Yes.
- **Missing?** Client can't see their own warranty terms/expiry yet (same gap as 7.2).
- **Unnecessary work?** No.

### Step 8.2 — Warranty Claim / Service Ticket Intake
- **Objective:** Client reports a problem; it's captured and triaged.
- **Role:** Client (report) → Ops (triage).
- **Module:** `maintenance-engine` (`service_tickets`) — **[Verified]** `service_tickets.reported_by` is nullable and `client_id` is required, suggesting the schema anticipates a client-originated report, but there is no verified client-facing UI for creating one (client-portal doesn't import maintenance-engine).
- **Ownership correct?** Structurally yes; the client-facing entry point is unbuilt.
- **Should this step exist?** Yes.
- **Missing?** A way for a client to actually raise a ticket without calling/messaging the office directly — **[Reasoning]** this is precisely the kind of moment (something's wrong, post-handover) where a client's anxiety is highest and an easy, calm reporting path matters most, per the product's own stated mission.
- **Unnecessary work?** Whatever informal channel exists today (phone call) requires staff to manually re-key the report into the system — duplicate entry, same pattern as the proposal-decision gap in Phase 1.

### Step 8.3 — Service Ticket Resolution
- **Objective:** Fix the reported problem, document it.
- **Role:** Whoever's assigned (`assigned_to`).
- **Module:** `maintenance-engine`.
- **Ownership correct?** Yes.
- **Should this step exist?** Yes.
- **Missing?** No client-visible resolution status ("your service ticket is scheduled for Tuesday") — same information-gap pattern as elsewhere: the data exists (`status`, `resolution_notes`) but nothing shows it to the person who actually needs it, the client.
- **Unnecessary work?** No.

### Step 8.4 — Warranty Expiry & Relationship Transition
- **Objective:** Formally close the warranty period; open the door to a maintenance contract, referral, or repeat business.
- **Role:** Owner.
- **Module:** None — **[Assumption]** likely handled informally today (or not handled at all, simply lapsing silently).
- **Should this step exist?** **[Reasoning]** yes, in the sense that a deliberate "your warranty is ending, here's what that means, and here's how we can keep helping" touchpoint is a genuine business opportunity (repeat business, referral, ongoing maintenance revenue) that a silent expiry wastes.
- **Missing?** A real gap, though a business-development one more than a pure operations one — flagged for completeness since the mandate was "warranty period completed," not just "warranty period exists."
- **Unnecessary work?** N/A.

---

## Cross-cutting findings

Synthesized across all 8 phases, as requested.

### Duplicate work
1. **Proposal decisions** (Phase 1.5–1.6) are negotiated outside the system, then manually re-keyed in.
2. **Service ticket intake** (Phase 8.2) — same pattern: client reports informally, staff re-enters it.
3. **Material request fulfillment** (Phase 3.4) — potential duplicate procurement if a request and an order aren't structurally linked and someone forgets to check.

### Repeated approvals — one candidate worth naming
Variation handling (Phase 4) runs a full six-gate chain regardless of the variation's size. **[Assumption, not verified]** a fast-lane for genuinely trivial, zero-cost changes may not exist — worth confirming with real variation-size data before concluding it's actually a problem.

### Unnecessary administration
Finance manually cross-referencing "did the client pay the invoice I sent by email" against system `payments` records (5.3) is close to pure duplicate bookkeeping, entirely because there's no in-system invoice presentation.

### Missing approvals
None found that constitute an actual gate being skipped — every money/quality/scope decision in the system that *is* built has a real approval attached to it. The gaps found are about **visibility and presentation to the client**, not missing internal controls.

### Missing documents
1. No FK from `contracts` to the `proposals` they were negotiated from (2.1) — breaks the audit chain from signed contract back to what was actually agreed.
2. No in-system handover acceptance / client sign-off record (7.4).
3. No permit/legal-compliance tracking, if applicable to Arkavena's project mix (2.4, flagged as a question, not a confirmed gap).
4. No retention-tracking mechanism, if applicable (7.3, same caveat).

### Operational bottlenecks
The Owner/TD role cluster is the approver for cash-gate override, change-order review, invoice issuance, quality inspection override, and margin approval. **[Reasoning]** in a small operation this concentration is normal and probably intentional (these genuinely are the highest-trust decisions), but it does mean **a single person's availability gates almost every high-stakes decision in the entire lifecycle** — worth naming as a structural single point of failure, not a flaw to fix immediately.

### High-risk handoffs
1. **Deposit/payment receipt → Cash Gate data entry** (2.2, 5.4): the entire Cash Gate mechanism's accuracy depends on a human promptly logging a `funding_receipt` after money arrives, with no system prompt tied to that specific moment.
2. **Site material request → procurement fulfillment** (3.4): no verified structural link between the two sides.
3. **Contract signing → project setup** (2.1→2.3): relies on whoever sets up zones/milestones/work packages correctly reading the signed contract, with no structural check that the setup matches what was actually contracted.

### Information gaps
1. Client-side: proposal status, invoice status, handover terms, warranty terms, and service-ticket status are all currently invisible to the person who most needs them — the client. This is the single largest, most consistent pattern in this entire review.
2. Staff-side: no notification/push mechanism for anything — every "the system knows something is overdue/high-severity/aging" fact requires a human to proactively open a dashboard and look.

### Communication gaps
Directly addressed in Phase 6 — there is currently no systematic client communication mechanism anywhere in the lifecycle. Every touchpoint that should reassure a client (proposal outcome, variation decision, invoice, delay, handover, warranty status) is either fully manual today or not yet built.

### Places users are likely to bypass the system
1. **Daily field reporting** (3.2) under time pressure — WhatsApp to the office is the natural fallback.
2. **Proposal negotiation** (1.5–1.6) — likely already fully outside the system, by necessity (nothing exists to do it inside).
3. **Client-to-office communication generally** — every phase where the client-facing side is unbuilt (invoices, handover, service tickets) forces phone/WhatsApp as the *only* option, not a bypass of a working alternative, which is a more urgent problem than "staff prefer texting" — there is no system path to bypass yet.

---

## Summary judgment

The **internal operational spine** of Arkavena OS — lead qualification → assessment → estimating → contracting → Cash Gate → execution → Quality Gate → variation handling → billing — is coherent, correctly gated, and matches how a disciplined construction operation should actually run. Nearly every "should this step exist" answer in this review was yes, and nearly every module ownership question checked out.

The **client-facing spine**, by contrast, has a real hole running through nearly its entire length: the client is structurally present only at the variation-approval step (Phase 4.4) and, even there, sees unpolished internal language. Every other moment a real construction client cares about — did I get accepted, is my invoice fair, what did we agree to at handover, is my warranty claim being handled — currently has **no system presence at all**, not a bad one. This matches, almost exactly, the gap `PRODUCT.md` and `ADR 0026` were written to close — this review's contribution is confirming, with direct evidence, that the gap is real and specific, not just a general "the client experience could be better" impression.
