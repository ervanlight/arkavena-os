# IMPLEMENTATION_PRIORITIES.md — Arkavena OS

**Purpose:** A decision report, not an architecture document. `ARCHITECTURE_REVIEW.md` and `WORKFLOW_REVIEW.md` produced 31 distinct findings between them. Not all of them deserve action, and not all that deserve action deserve it *now*. This document scores every finding and assigns exactly one verdict, so implementation work can start from a prioritized list instead of a pile of observations.

**Scope note:** this reviews findings *from those two documents only* — it does not re-open ADR 0026's own five listed open decisions (management-tier definition, evidence default visibility, etc.), which already have their own decision process. Where a finding here touches one of those, it's cross-referenced, not duplicated.

**Verdict definitions** (choose exactly one per finding):
- **Fix Before Implementation** — must be resolved before Fase 12 (or whatever comes next) starts being built; blocks development.
- **Fix During Development** — address it as part of building the next feature; not a prerequisite to starting.
- **Fix After MVP** — real, but scheduled for later; doesn't block anything now.
- **Accept As-Is** — no action needed; explained why below.
- **Reject** — explicitly decided against, not just deprioritized; explained why below.

---

## Executive summary table

| ID | Finding | Severity | Verdict |
|---|---|---|---|
| F1 | No client-facing path to accept a proposal | Critical | Fix During Development |
| F2 | Variation-approval page leaks raw internal fields to client | High | **Fix Before Implementation** |
| F3 | No client-facing invoice/payment-due visibility | High | Fix During Development |
| F4 | No client-facing handover/warranty/service-ticket visibility | Medium | Fix After MVP |
| F5 | No systematic client communication cadence (Client Timeline itself) | Critical | Fix During Development |
| F6 | No client sign-off/acceptance record at handover | Medium | Fix After MVP |
| F7 | No FK from `contracts` to the `proposals` they came from | Medium | Fix During Development |
| F8 | `project` row created at "qualified" lead stage, before any contract | High | **Fix Before Implementation** |
| F9 | No structural link between material request and procurement fulfillment | Low | Fix After MVP |
| F10 | Cash Gate accuracy depends on unprompted manual `funding_receipt` entry | High | Fix During Development |
| F11 | No push/notification for aging decisions, overdue invoices, high-severity issues | Low | Fix After MVP |
| F12 | No permit/legal-compliance tracking | Unknown (assumption-based) | Accept As-Is, pending Owner input |
| F13 | No deposit/retention-specific billing concept | Unknown (assumption-based) | Accept As-Is, pending Owner input |
| F14 | Variation approval chain has no fast lane for trivial changes | Low | **Reject** |
| F15 | No project-level final completion sign-off distinct from per-package QC | Medium | Fix After MVP |
| F16 | No site-visit scheduling/calendar concept | Low | **Reject** |
| F17 | No standard assessment checklist/template | Low | Fix After MVP |
| F18 | No warranty-expiry relationship-transition touchpoint | Low | Fix After MVP |
| F19 | `billing`'s 4-module import fan-out for billing-pack assembly | Low | Accept As-Is |
| F20 | Estimate versioning (V1/V2/V3) complexity vs. actual usage | Low | Accept As-Is (verify usage informally) |
| F21 | `cash-gate/types.ts` re-declares `WorkPackage` instead of importing it | Trivial | Fix During Development |
| F22 | `crm` lead-pipeline scoring complexity vs. actual usage | Low | Accept As-Is |
| F23 | `maintenance-engine` size (1292 LOC) vs. actual post-handover volume | Low | Accept As-Is (monitor) |
| F24 | `partner-desk` built ahead of proven supplier volume | Medium | Accept As-Is (Owner's own conscious decision) |
| F25 | Rule "client-portal must never import cash-gate/estimating directly" undocumented | Medium | **Fix Before Implementation** |
| F26 | Rule "partner-desk and client-portal must never communicate" undocumented | Low | **Fix Before Implementation** |
| F27 | `projects` not formally named as the system's shared kernel in `ARCHITECTURE.md` | Low | Fix After MVP |
| F28 | No `docs/client-visibility-matrix.md` companion to `rls-matrix.md` | Medium | Fix During Development |
| F29 | Client-visibility tiers (Internal Only/etc.) have no representation in the permission matrix | High | **Fix Before Implementation** |
| F30 | No client-facing audit trail | Low | Accept As-Is |
| F31 | No portfolio-level multi-project rollup for management | Low | **Reject** (for now) |

**Six items block Fase 12 from starting** (F2, F8, F25, F26, F29, and by extension the ADR 0026 open decisions they touch). **Everything else is scheduled, not blocking.**

---

## Detailed findings register

### F1 — No client-facing path to accept a proposal
- **Business Impact:** High — this is the moment a prospect becomes a paying client; it currently happens entirely outside the system.
- **Operational Impact:** Staff manually re-key the outcome after an out-of-system conversation — duplicate administrative work, no system record of *why* the client said yes.
- **Technical Risk:** Low — needs a new client-facing RLS policy + a simple accept/decline screen, not a new domain concept.
- **User Impact:** High — first real interaction a client has (or should have) with the product.
- **Cost to Fix:** Medium — one new client-visible surface, a curated client-facing summary field, RLS policy work.
- **Cost of Doing Nothing:** High, compounding — every day this isn't built is another prospect whose "trust relationship" started with zero system presence.
- **Recommendation:** **Fix During Development.** This is not a blocker to starting Fase 12 — it *is* Fase 12's first meaningful deliverable, per `PRODUCT.md`'s own "first trust touchpoint" language. Build it as the opening milestone of the Client Timeline work, not before it.

### F2 — Variation-approval page leaks raw internal fields to client
- **Business Impact:** High — this is the one place a client already interacts with real data today, and it currently contradicts the stated philosophy live, in production.
- **Operational Impact:** None — this is a display-layer fix, doesn't touch any workflow.
- **Technical Risk:** Very low — no schema change, no new domain logic, just translate existing fields (title/description/status) into client-appropriate copy in the existing page.
- **User Impact:** High — every client currently going through a variation decision sees this.
- **Cost to Fix:** Low — a few hours of UI copy work, reusing patterns already established elsewhere in the app.
- **Cost of Doing Nothing:** High relative to cost — this is the cheapest fix on the entire list with real, live client exposure.
- **Recommendation:** **Fix Before Implementation.** Specifically: fix it *now*, independently of Fase 12, because it needs none of Fase 12's architecture decisions (Evidence visibility, Client Status design) to be resolved first. Waiting for the full Client Timeline rebuild to fix an already-shipped, already-live philosophy violation is not justified by the fix's cost.

### F3 — No client-facing invoice/payment-due visibility
- **Business Impact:** Medium-High — Finance is likely doing manual reconciliation between an out-of-system invoice notice and in-system payment records.
- **Operational Impact:** Duplicate bookkeeping (confirmed reasoning in `WORKFLOW_REVIEW.md` 5.3).
- **Technical Risk:** Low — a narrow, deliberately simple "invoice ready/due" notice, per ADR 0026 §5's own scoping (not the aging dashboard).
- **User Impact:** Medium — matters at each billing milestone, not daily.
- **Cost to Fix:** Medium — needs a new client-visible read path into `billing`, carefully scoped to avoid the aging/DSO analytics that must stay internal.
- **Cost of Doing Nothing:** Medium — annoying, not urgent; Finance is presumably still collecting money today through the existing (manual) channel.
- **Recommendation:** **Fix During Development**, as part of the Client Timeline's "Menunggu Anda"/billing-notice surface — same reasoning as F1, this is Fase 12 scope, not a prerequisite to it.

### F4 — No client-facing handover/warranty/service-ticket visibility
- **Business Impact:** Medium — post-handover trust matters (repeat business, referrals) but affects fewer active relationships at any given time than pre-handover ones.
- **Operational Impact:** Same duplicate-entry pattern as F1 (client reports service issue informally, staff re-keys it) — but lower frequency than proposal/variation/invoice interactions.
- **Technical Risk:** Low-Medium — needs `client-portal` to import `maintenance-engine` for the first time (currently zero coupling), a new but not risky dependency.
- **User Impact:** Medium — high-emotion moment (something's wrong post-handover) but affects a smaller, later-lifecycle subset of clients at any given time.
- **Cost to Fix:** Medium.
- **Cost of Doing Nothing:** Medium — real, but the pre-handover client experience (proposal, variation, invoice) affects every single active client relationship, right now; this affects only projects that have already reached handover.
- **Recommendation:** **Fix After MVP.** Real gap, correctly identified, but sequenced behind F1/F3 because it serves fewer concurrent relationships at current project volume — matches the general principle that Fase 12's first release should nail the *most common* client moments first.

### F5 — No systematic client communication cadence (the Client Timeline itself)
- **Business Impact:** Critical — this is the core deliverable `PRODUCT.md` and `ADR 0026` exist to build; without it, the "Trust OS" positioning has no product behind it yet.
- **Operational Impact:** Every touchpoint currently defaults to manual/informal channels (confirmed across nearly every Phase 1-8 step in `WORKFLOW_REVIEW.md`).
- **Technical Risk:** Medium — genuinely new domain work (Client Project Status, Evidence visibility), but already designed in ADR 0026, not unknown territory.
- **User Impact:** Critical — this is the entire client-facing product.
- **Cost to Fix:** High — this is Fase 12 in its entirety, not a small patch.
- **Cost of Doing Nothing:** Critical and compounding — every week without it is a week of client relationships running on informal channels the founder's own stated philosophy says should be systematized.
- **Recommendation:** **Fix During Development** — this finding *is* the development, not a prerequisite to it. Listed here for completeness since it was the umbrella finding both review documents kept surfacing pieces of (F1, F3, F4 are its instances).

### F6 — No client sign-off/acceptance record at handover
- **Business Impact:** Medium — a real legal/dispute exposure (no digital record of client acceptance), but likely mitigated today by a paper process.
- **Operational Impact:** Low — doesn't slow anything down operationally, it's an absence, not friction.
- **Technical Risk:** Low.
- **User Impact:** Low day-to-day; high only in the rare event of a dispute.
- **Cost to Fix:** Medium — a new `client_decisions`-style record type for handover acceptance.
- **Cost of Doing Nothing:** Low-Medium, and only realized in a dispute scenario, which is rare by nature.
- **Recommendation:** **Fix After MVP.** Real, worth doing eventually, but a paper-based handover acceptance process is a legitimate stopgap and this doesn't block or improve the day-to-day client experience the way F1/F2/F3 do.

### F7 — No FK from `contracts` to the `proposals` they came from
- **Business Impact:** Low day-to-day; matters only if a client later disputes "that's not what I agreed to."
- **Operational Impact:** None currently felt — nobody is blocked by this today.
- **Technical Risk:** Very low — one nullable FK column addition.
- **User Impact:** None directly (this is an internal audit-trail concern).
- **Cost to Fix:** Low.
- **Cost of Doing Nothing:** Low now, but grows each month the audit chain stays broken and a dispute becomes more likely to eventually occur.
- **Recommendation:** **Fix During Development** — cheap enough to do opportunistically whenever `contracts` or `proposals` is next touched for an unrelated reason (e.g., while building F1). Not worth a dedicated migration on its own.

### F8 — `project` row created at "qualified" lead stage, before any contract
- **Business Impact:** High — this directly determines what "Client Visible" and "Client Project Status" (ADR 0026's central new concept) actually attach to. If Fase 12 builds Client Status against `project_status` without addressing this, an unconfirmed opportunity could show a client-facing "On Track" status before a contract even exists.
- **Operational Impact:** Currently low (nobody's confused yet, per this review's own findings) but this is exactly the kind of ambiguity that becomes expensive once client-facing status is layered on top of it.
- **Technical Risk:** Low to decide, but the decision shapes Fase 12's design — this is a sequencing risk, not a coding risk.
- **User Impact:** None today; potentially high once Client Status ships, if unresolved.
- **Cost to Fix:** Very low — this is a decision (should Client Timeline gate itself on `contracts.status = 'active'` rather than `project` existing at all?), not new code.
- **Cost of Doing Nothing:** High specifically *for Fase 12* — retrofitting this after Client Status is built and shipped is much more expensive than deciding it now.
- **Recommendation:** **Fix Before Implementation.** This is a cheap decision with an expensive-if-ignored consequence, and it must be settled before Client Status (ADR 0026 §2) is designed in detail, not after.

### F9 — No structural link between material request and procurement fulfillment
- **Business Impact:** Low — internal efficiency only, no client-facing consequence.
- **Operational Impact:** Medium — potential for duplicate ordering or a dropped request, per `WORKFLOW_REVIEW.md` 3.4's reasoning.
- **Technical Risk:** Low.
- **User Impact:** None (client never sees this).
- **Cost to Fix:** Medium — needs a genuine cross-module link (`field-reporting` ↔ `procurement`), the two modules with zero coupling today.
- **Cost of Doing Nothing:** Low-Medium — an occasional inefficiency, not a trust or safety issue.
- **Recommendation:** **Fix After MVP.** Real, but purely an internal efficiency gain with no bearing on the "Trust OS" mission this whole review cycle is organized around. Doesn't compete for priority against anything client-facing.

### F10 — Cash Gate accuracy depends on unprompted manual `funding_receipt` entry
- **Business Impact:** High — this is the system's single most trust-critical mechanism (per `PRODUCT.md`'s own competitive-advantage claim), and its accuracy has an unmonitored manual dependency.
- **Operational Impact:** High — if a deposit/payment is received but not promptly logged, Cash Gate could show red/yellow when the project is actually funded, causing an unnecessary work stoppage or override.
- **Technical Risk:** Low — the fix is a reminder/nudge, not a change to the gate mechanism itself.
- **User Impact:** Indirect but real — a false-red gate delays real client work.
- **Cost to Fix:** Low — a simple staff-facing reminder (e.g., "payment received via bank notification, has it been logged?" prompt), not a new domain.
- **Cost of Doing Nothing:** Medium-High — this is a silent risk to the system's core credibility claim, and it's currently invisible until it causes a real delay.
- **Recommendation:** **Fix During Development.** Not urgent enough to block Fase 12 from starting, but cheap enough that it should be bundled into the next touch of the `/cc` Command Center dashboard (a reminder card, following the exact pattern the "Perlu perhatian" strip already uses) rather than deferred indefinitely.

### F11 — No push/notification for aging decisions, overdue invoices, high-severity issues
- **Business Impact:** Low-Medium — the data already exists and is ranked (Decision Clock, aging dashboard, issue severity); this is about surfacing it faster, not creating new capability.
- **Operational Impact:** Medium — relies on staff remembering to check a dashboard rather than being told.
- **Technical Risk:** Medium — genuine notification infrastructure (email/WhatsApp/push) doesn't exist yet in this system at all; this would be new infrastructure, not a UI tweak.
- **User Impact:** None directly (internal-facing).
- **Cost to Fix:** Medium-High — notification infrastructure is a real build, not a small patch.
- **Cost of Doing Nothing:** Low-Medium — the dashboard-only visibility already built in Pillar 2 is a working, if passive, mitigation.
- **Recommendation:** **Fix After MVP.** The passive dashboard mitigation is genuinely adequate at current scale; active notifications are a legitimate later investment once dashboard-checking habits prove insufficient in practice, not before.

### F12 — No permit/legal-compliance tracking
- **Business Impact:** Unknown — entirely depends on whether Arkavena's actual project mix includes structural/permit-requiring work, which this review has no evidence about either way.
- **Operational Impact:** Unknown, same reason.
- **Technical Risk:** N/A until scoped.
- **User Impact:** N/A until scoped.
- **Cost to Fix:** Unknown until the Owner confirms the need exists at all.
- **Cost of Doing Nothing:** Unknown — could be zero (if most work is cosmetic/non-permit) or real (if structural work is common).
- **Recommendation:** **Accept As-Is, pending Owner input.** This is explicitly not a "fix" decision yet — it's a question that needs answering before it can even be classified. Do not build anything speculative here; ask first.

### F13 — No deposit/retention-specific billing concept
- **Business Impact/Operational Impact:** Same reasoning as F12 — depends entirely on whether Arkavena's actual contracts use a distinct deposit or retention clause, which this review could not confirm.
- **Recommendation:** **Accept As-Is, pending Owner input.** Same reasoning as F12 — a question, not a confirmed gap.

### F14 — Variation approval chain has no fast lane for trivial changes
- **Business Impact:** Low — this review has no data showing trivial variations are common enough to be a real friction point.
- **Operational Impact:** Low-Unknown.
- **Technical Risk:** Medium — a "fast lane" means a second approval pathway to design, test, and maintain alongside the existing one.
- **User Impact:** None directly.
- **Cost to Fix:** Medium — a second workflow path is real, ongoing complexity.
- **Cost of Doing Nothing:** Very low — worst case, a trivial variation takes the same six steps a large one does, which costs a few extra minutes of process, not money or trust.
- **Recommendation:** **Reject.** This is exactly the kind of speculative feature the founder's own instructions warn against building ahead of evidence ("do not invent features," "our biggest risk is over-engineering"). If real usage data later shows trivial variations are frequent and the six-gate chain is a genuine daily friction point, revisit — but don't build a second approval pathway on a hypothesis.

### F15 — No project-level final completion sign-off distinct from per-package QC
- **Business Impact:** Medium — a whole-project walkthrough catching issues invisible at the per-package level is standard, valuable practice.
- **Operational Impact:** Medium.
- **Technical Risk:** Low — likely a lightweight new record, not a new domain.
- **User Impact:** Medium — this is the moment right before handover, which matters to the client's final impression.
- **Cost to Fix:** Low-Medium.
- **Cost of Doing Nothing:** Medium — the risk (issues only visible once everything's assembled together) is real but not urgent for every project.
- **Recommendation:** **Fix After MVP.** Legitimate, but Fase 12's priority should be the client communication gap (F1/F3/F5), not this internal QC refinement.

### F16 — No site-visit scheduling/calendar concept
- **Business Impact:** Very low.
- **Operational Impact:** Low — phone/WhatsApp scheduling works fine at small scale; this is genuinely outside the product's core mission.
- **Technical Risk:** N/A.
- **User Impact:** None.
- **Cost to Fix:** Medium (calendaring is its own real feature category).
- **Cost of Doing Nothing:** Very low.
- **Recommendation:** **Reject.** Per the founder's own principle ("software must adapt to operations, operations must never adapt to software") — operations already handle this fine informally, and building calendar infrastructure would be solving a problem nobody has reported having. This is squarely outside the Trust OS mission.

### F17 — No standard assessment checklist/template
- **Business Impact:** Low at current scale (one or few assessors); grows in value only once there's more than one person doing assessments and consistency starts to matter.
- **Operational Impact:** Low now.
- **Technical Risk:** Low.
- **User Impact:** None directly.
- **Cost to Fix:** Low-Medium.
- **Cost of Doing Nothing:** Low now, grows slowly.
- **Recommendation:** **Fix After MVP.** Cheap and eventually useful, but there's no evidence of a current consistency problem to justify prioritizing it now.

### F18 — No warranty-expiry relationship-transition touchpoint
- **Business Impact:** Medium (business development — referrals, repeat business, maintenance contracts) but not part of the core Trust OS mission (reducing client anxiety during an active project).
- **Operational Impact:** Low.
- **Technical Risk:** Low.
- **User Impact:** Low-Medium, and positive rather than anxiety-reducing (this is an opportunity, not a risk).
- **Cost to Fix:** Low.
- **Cost of Doing Nothing:** Low-Medium, purely opportunity cost, not a risk.
- **Recommendation:** **Fix After MVP.** A good idea, explicitly a business-development opportunity rather than an operational or trust problem — schedule it, don't prioritize it alongside client-facing trust gaps.

### F19 — `billing`'s 4-module fan-out for billing-pack assembly
- **Business Impact:** None — this is invisible to any user, purely a code-structure question.
- **Operational Impact:** None.
- **Technical Risk:** Low — already verified proportionate to genuine need (assembling 4 real signals for one invoice bundle) in `ARCHITECTURE_REVIEW.md`.
- **User Impact:** None.
- **Cost to Fix:** Medium (would mean restructuring where billing-pack assembly lives).
- **Cost of Doing Nothing:** None currently.
- **Recommendation:** **Accept As-Is.** `ARCHITECTURE_REVIEW.md` already concluded this is earned complexity, not accidental — revisit only if the fan-out grows to a 5th/6th module, per that review's own recommendation. No new information here changes that conclusion.

### F20 — Estimate versioning (V1/V2/V3) complexity vs. actual usage
- **Business Impact:** None confirmed either way — depends on whether estimates actually get revised multiple times in practice.
- **Recommendation:** **Accept As-Is**, with an informal ask: next time anyone is in the estimating flow, check whether `version` ever goes past 1 in practice. Not worth a dedicated investigation task — just a thing to notice in passing.

### F21 — `cash-gate/types.ts` re-declares `WorkPackage` instead of importing it
- **Business Impact/Operational Impact/User Impact:** None — this is a pure code-cleanliness nitpick, already confirmed harmless (both declarations derive from the same generated type, cannot diverge).
- **Technical Risk:** None.
- **Cost to Fix:** Trivial (one import line change).
- **Cost of Doing Nothing:** None.
- **Recommendation:** **Fix During Development** — free to fix next time `cash-gate/types.ts` is opened for any other reason. Not worth its own change.

### F22 — `crm` lead-pipeline scoring complexity vs. actual usage
- **Recommendation:** **Accept As-Is** — same reasoning pattern as F20: a "notice in passing" item, not a task. `ARCHITECTURE_REVIEW.md` already flagged this as proportionate *if* the pipeline stages are genuinely used; no evidence either way currently justifies action.

### F23 — `maintenance-engine` size (1292 LOC) vs. actual post-handover volume
- **Business Impact:** None immediately — the module works; the question is only whether its size is earning its keep.
- **Recommendation:** **Accept As-Is (monitor).** This becomes actionable only if/when it's confirmed the module's actual usage (number of completed projects reaching handover) is far below what 1292 LOC of functionality implies it was built for — not something to act on speculatively.

### F24 — `partner-desk` built ahead of proven supplier volume
- **Business Impact:** Already named and owned — ADR 0022/0023 record the Owner consciously overriding the volume gate.
- **Recommendation:** **Accept As-Is.** This isn't a new finding requiring a new decision — it's a decision the Owner already made, deliberately, with the trade-off already documented. Re-litigating it here would be second-guessing a decision that was made with full information. The only live action item is the one already in `PRE-LAUNCH-CHECKLIST.md`: keep it open until real supplier adoption is validated.

### F25 — Rule "client-portal must never import cash-gate/estimating directly" undocumented
- **Business Impact:** High if violated — a direct import would be exactly the kind of margin/cash leak the whole architecture (D2.6) exists to prevent.
- **Operational Impact:** None today (no violation exists), but Fase 12's Client Timeline work is precisely the kind of change most likely to be tempted to add "just one more field" via a direct import.
- **Technical Risk:** None to document; the risk is in *not* documenting it before Fase 12 starts.
- **User Impact:** None directly, but a violation would eventually become a client-facing data leak.
- **Cost to Fix:** Trivial — one paragraph added to `ARCHITECTURE.md`'s boundary rules.
- **Cost of Doing Nothing:** Low probability, high severity if it happens, and cheap enough to prevent that there's no reason not to.
- **Recommendation:** **Fix Before Implementation.** This is a documentation-only change that costs minutes and specifically protects the exact module boundary Fase 12 is most likely to stress. Do it before Client Timeline work starts, not after.

### F26 — Rule "partner-desk and client-portal must never communicate" undocumented
- **Business Impact:** Medium — mixing supplier-facing and client-facing data would be a real confidentiality problem if it ever happened, though lower likelihood than F25 since these modules serve entirely different UI surfaces.
- **Cost to Fix:** Trivial, same as F25.
- **Recommendation:** **Fix Before Implementation.** Bundle with F25 — same one-paragraph documentation update, same reasoning.

### F27 — `projects` not formally named as the system's shared kernel
- **Business Impact:** Low — this is about contributor awareness (don't casually break `projects`' public API, 7 other modules depend on it), not user-facing risk.
- **Cost to Fix:** Trivial.
- **Cost of Doing Nothing:** Low — the risk only materializes if someone changes `projects`' API carelessly, which good code review would likely catch anyway.
- **Recommendation:** **Fix After MVP.** A good documentation improvement, but lower urgency than F25/F26 since it's about contributor hygiene, not an active architectural risk to Fase 12 specifically.

### F28 — No `docs/client-visibility-matrix.md` companion to `rls-matrix.md`
- **Business Impact:** Medium — without this, confirming "does this view leak anything it shouldn't" requires reading migration SQL directly each time, as both prior reviews had to do.
- **Operational Impact:** Low today, grows as more `vw_client_*` views and Evidence visibility rules are added in Fase 12.
- **Technical Risk:** None — pure documentation.
- **Cost to Fix:** Low-Medium — needs to be written accurately, which takes real review time, but no code risk.
- **Cost of Doing Nothing:** Medium and growing — this exact gap is what made the F2 violation hard to notice before this review process existed.
- **Recommendation:** **Fix During Development.** Write it *as* Fase 12 is built (each new `vw_client_*` view or Evidence visibility rule gets documented in it immediately), rather than as a separate upfront task — this keeps it accurate by construction instead of becoming stale documentation written once and forgotten.

### F29 — Client-visibility tiers have no representation in the permission matrix
- **Business Impact:** High — this is a genuine architectural question that directly determines how "Internal + Management" (a new concept from ADR 0026) gets enforced: is it a real, checked role tier, or just a documentation convention nobody actually verifies?
- **Operational Impact:** None yet, but every module classified "Internal + Management" in `ARCHITECTURE_REVIEW.md`'s table (cash-gate, quality-gate, projects) currently has no code-level distinction between "any staff" and "management staff" — the matrix today only has one internal tier.
- **Technical Risk:** Medium — this could mean adding a new permission-matrix concept, which touches `core/permissions`, a load-bearing piece of the whole system.
- **User Impact:** None directly, but if left undecided, "Internal + Management" classification becomes decorative rather than enforced.
- **Cost to Fix:** Low to *decide* (is it a new enforced tier, or a documentation-only convention?); higher to *implement* if the answer is "enforced tier."
- **Cost of Doing Nothing:** High specifically for Fase 12 — building Client Timeline and Evidence visibility without first deciding this means guessing at enforcement semantics mid-build.
- **Recommendation:** **Fix Before Implementation.** This is a design decision, not a large implementation — decide *now* whether "Management" tier is enforced in code or just a naming convention, so Fase 12's permission work has a clear target instead of an ambiguous one. This directly overlaps with ADR 0026 §7's already-open "define Management tier" decision — resolving it here also resolves that.

### F30 — No client-facing audit trail
- **Business Impact:** Low — already reasoned in `ARCHITECTURE_REVIEW.md` as likely the *correct* trade-off (clients shouldn't need an audit trail; Arkavena's word plus the Client Timeline's dated history should be enough).
- **Recommendation:** **Accept As-Is.** This was explicitly evaluated and found to be a conscious, defensible design choice, not an oversight — no action changes that conclusion.

### F31 — No portfolio-level multi-project rollup for management
- **Business Impact:** Low at current scale (per this review's own stated assumption of a small operation with a handful of concurrent projects); the existing `/cc` dashboard's flat "Perlu perhatian" list already covers the same need reasonably well at this scale.
- **Operational Impact:** Low now, would grow only with significantly more concurrent projects.
- **Technical Risk:** N/A.
- **Cost to Fix:** Medium-High — genuine new reporting/rollup views.
- **Cost of Doing Nothing:** Very low right now.
- **Recommendation:** **Reject (for now).** This is precisely the kind of forward-looking feature the founder's instructions warn against building ahead of need — there's no evidence current project volume justifies it. Revisit if/when concurrent project count grows enough that the flat dashboard list genuinely becomes hard to scan — not before.

---

## The roadmap this document produces

### Fix Before Implementation (blocks Fase 12 from starting) — 6 items
1. **F2** — Patch the variation-approval page's raw-field leak (cheap, live now, independent of Fase 12's architecture).
2. **F8** — Decide what `project` existence should mean relative to contract status, before Client Status is designed around it.
3. **F25** — Document the "client-portal never imports cash-gate/estimating directly" rule.
4. **F26** — Document the "partner-desk and client-portal never communicate" rule.
5. **F29** — Decide whether "Management" tier is an enforced permission concept or a naming convention, before building Evidence/Client Status permission checks.
6. *(Cross-referenced, not new here)* — ADR 0026 §7's five listed open decisions still gate the same work; F8 and F29 above resolve two of them directly.

### Fix During Development (build these as part of Fase 12 itself)
F1 (proposal acceptance), F3 (invoice visibility), F5 (Client Timeline, the umbrella), F7 (contracts→proposals FK), F10 (Cash Gate reminder), F21 (trivial type cleanup), F28 (client-visibility-matrix.md, written incrementally).

### Fix After MVP (real, scheduled for later, not blocking)
F4 (handover/warranty/service-ticket visibility), F6 (handover sign-off record), F9 (material-request↔procurement link), F11 (push notifications), F15 (project-level completion sign-off), F17 (assessment checklist), F18 (warranty-expiry touchpoint), F27 (name `projects` as shared kernel in docs).

### Accept As-Is (no action; reasoning stated above for each)
F19, F20, F22, F23, F24, F30 — either already verified as earned complexity/correct trade-offs, or "notice in passing" items with no current evidence of a real problem.

### Accept As-Is, pending Owner input (not yet classifiable)
F12 (permit tracking), F13 (deposit/retention concept) — genuine open questions about Arkavena's actual project mix and contract terms, not findings this review can resolve alone.

### Reject (decided against, not just deprioritized)
F14 (variation fast-lane), F16 (scheduling/calendar), F31 (portfolio rollup) — each is a plausible-sounding feature with no current evidence of real pain, and building any of them now would be exactly the over-engineering risk the founder's own instructions named explicitly.
