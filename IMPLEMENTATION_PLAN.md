# IMPLEMENTATION_PLAN.md — Arkavena OS

**Purpose:** Pure sequencing. `IMPLEMENTATION_PRIORITIES.md` already decided *what* to do and *why* — this document only decides the *order*, so nothing gets built twice and nothing gets built against a foundation that hasn't been decided yet. No priority is changed here. No new issue is introduced here. Every item below carries the exact verdict `IMPLEMENTATION_PRIORITIES.md` gave it; this document only adds prerequisites, blocking relationships, parallelizability, complexity, and a phase assignment.

**Complexity scale used below:** S (hours to a couple days), M (several days), L (a week-plus, touches multiple files/a new surface), XL (multi-week, new infrastructure category).

**How phases map to the priority verdicts** (unchanged from `IMPLEMENTATION_PRIORITIES.md`, just organized for sequencing):
- **Phase 1** = everything marked *Fix Before Implementation*.
- **Phase 2** = everything marked *Fix During Development*.
- **Phase 3** = everything marked *Fix After MVP*.
- **Not scheduled** = *Accept As-Is*, *Accept As-Is pending Owner input*, and *Reject* — no implementation sequence applies to these; listed at the end for completeness.

---

## Phase 1 — Foundational decisions & independent fixes

**Why this phase exists and must go first:** two items in this phase (F8, F29) are *decisions*, not code — and Phase 2's actual build (the Client Timeline, proposal acceptance, invoice visibility) cannot be designed correctly until both are answered. Building Phase 2 first and retroactively fixing these would mean redesigning Client Status and the permission model mid-build — the exact rework this plan exists to avoid. The other three items (F2, F25, F26) have no dependency on anything and no reason to wait — they ship as soon as someone picks them up.

**Phase 1 is complete when:** F8 and F29 have documented answers, and F2/F25/F26 are merged. Phase 2 does not start before this.

| ID | Item | Prerequisites | Blocks | Parallel? | Complexity | Milestone |
|---|---|---|---|---|---|---|
| F2 | Patch variation-approval page's raw-field leak | None | Nothing downstream — fully self-contained | Yes, with everything in this phase and in Phase 2 | S | 1.1 |
| F25 | Document "client-portal never imports cash-gate/estimating directly" | None | Nothing directly, but should land before Phase 2 dev starts writing Client Timeline code | Yes | S | 1.2 (bundle with F26) |
| F26 | Document "partner-desk and client-portal never communicate" | None | Same as F25 | Yes | S | 1.2 (bundle with F25) |
| F8 | Decide what `project` existence means relative to `contract` status | None | **Blocks Phase 2's Client Timeline design (2.1)** — Client Status cannot be built against `project_status` until this is answered | Yes, relative to F2/F25/F26/F29 | S (a decision + a short written note, not a build) | 1.3 |
| F29 | Decide whether "Management" tier is an enforced permission concept or a naming convention | None | **Blocks Phase 2's permission work on any client-visible or Internal+Management surface** (2.1, 2.3, 2.4) | Yes, relative to the other Phase 1 items | S (a decision; implementation cost only materializes in Phase 2 if the answer is "enforced") | 1.4 |

All four milestones in this phase are mutually independent and can be done by different people simultaneously — there is no ordering constraint *within* Phase 1, only between Phase 1 as a whole and Phase 2.

---

## Phase 2 — Fase 12 build (Fix During Development)

**Why this phase is sequenced this way:** F5 (the Client Timeline itself) is the umbrella F1 and F3 are built inside — building F1 or F3 before the Timeline shell exists would mean building throwaway UI now and re-platforming it later, which is exactly the rework this plan exists to prevent. F7, F10, F21, and F28 have no such constraint and can proceed independently, in parallel, from day one of this phase.

**Phase 2 is complete when:** the Client Timeline shell is live, a client can accept a proposal and see invoice status through it, and F28's companion doc reflects both new client-visible surfaces.

| ID | Item | Prerequisites | Blocks | Parallel? | Complexity | Milestone |
|---|---|---|---|---|---|---|
| F5 | Client Timeline shell (Today/This Week/Upcoming/Waiting For You/Recent Updates), replacing the old tab IA | **Phase 1 complete** (needs F8's and F29's answers to design against) | **Blocks F1 (2.3) and F3 (2.4)** — both are built as content types inside this shell | No — this is the foundation the next two milestones sit on | L | 2.1 |
| F7 | Add `contracts.proposal_id` FK | None | Nothing hard, but should land just before/alongside F1 so the accepted proposal can be linked from the new contract at creation time, not retrofitted | Yes, with 2.1 | S | 2.2 |
| F1 | Client-facing proposal acceptance path | **2.1 (Timeline shell)**; benefits from **2.2 (F7's FK)** existing so acceptance can link forward to the eventual contract | Nothing downstream in this document | With F3 (2.4) — different modules, share only the Timeline shell as a base | M | 2.3 |
| F3 | Client-facing invoice/payment-due visibility | **2.1 (Timeline shell)** | Nothing downstream | With F1 (2.3) — see above | M | 2.4 |
| F10 | Cash Gate `funding_receipt` reminder on the `/cc` Command Center dashboard | None — this is internal, in a different app area (Command Center, not client-portal) entirely | Nothing | Yes, with everything else in this phase, including 2.1 | S | 2.5 |
| F21 | `cash-gate/types.ts` — import `WorkPackage` instead of re-declaring | None | Nothing | Yes, with everything, including Phase 1 if convenient | Trivial/S | 2.6 |
| F28 | `docs/client-visibility-matrix.md` companion doc | None to start; **updated incrementally as 2.1, 2.3, 2.4 each ship** | Nothing, but staying current with it keeps the next review cycle cheap | Runs continuously alongside 2.1–2.4, not a discrete step | S per update | 2.7 (ongoing, not a one-time milestone) |

**Sequencing note inside Phase 2:** 2.1 must land first. 2.2, 2.5, 2.6 can start on day one of the phase, in parallel with 2.1's build. 2.3 and 2.4 start only once 2.1 is usable, and can then run side by side since they touch different owning modules (`estimating`/`scope-variation` vs. `billing`) and share nothing but the Timeline shell.

---

## Phase 3 — Post-MVP work (Fix After MVP)

**Why this phase waits:** every item here is either an extension of the Client Timeline (F4, F6) that only makes sense once the Timeline itself exists and has shipped to real clients, or fully independent internal-only work (F9, F15, F17, F27) with no reason to compete for attention against Phase 2's client-facing MVP. F11 is the one genuine new-infrastructure item in this phase and is sequenced to happen once Phase 2's UI has stabilized, so notification hooks aren't built against surfaces still being iterated on.

| ID | Item | Prerequisites | Blocks | Parallel? | Complexity | Milestone |
|---|---|---|---|---|---|---|
| F4 | Client-facing handover/warranty/service-ticket visibility | **Phase 2 complete** (extends the same Timeline shell into `maintenance-engine`, client-portal's first-ever coupling to that module) | Nothing downstream | With F6 — same area of the app, natural to bundle | L | 3.1 (bundle with F6) |
| F6 | Client sign-off/acceptance record at handover | **Phase 2 complete**; naturally bundled with F4 since both touch the handover moment | Nothing | With F4 | M | 3.1 (bundle with F4) |
| F11 | Push/notification infrastructure (aging decisions, overdue invoices, high-severity issues) | **Phase 2 complete** — sequenced after the UI it would notify about has stabilized | **Soft-blocks F18's automated version** (3.3) — F18 can ship manually without it | Yes, with F4/F6/F9/F15/F17/F27 — no shared code | L | 3.2 |
| F18 | Warranty-expiry relationship-transition touchpoint | None for a manual version; **F11 (3.2)** if an automated reminder is wanted instead | Nothing | Yes, can ship a manual version before F11 exists, or wait for F11 to automate it | S (manual) / M (automated) | 3.3 |
| F9 | Structural link between material request and procurement fulfillment | None | Nothing | Yes, fully independent of everything else in this document | M | 3.4 |
| F15 | Project-level final completion sign-off (distinct from per-package QC) | None | Nothing | Yes | M | 3.5 |
| F17 | Standard assessment checklist/template | None | Nothing | Yes | S | 3.6 |
| F27 | Formally name `projects` as the system's shared kernel in `ARCHITECTURE.md` | None | Nothing | Yes, could genuinely happen anytime, including Phase 1 — placed here to match its assigned priority bucket, not because it has to wait | Trivial/S | 3.7 |

**Sequencing note inside Phase 3:** 3.1 (F4+F6) and 3.2 (F11) are the two heavier items and should be staffed separately if capacity allows, since neither depends on the other. 3.4–3.7 are all independent, low-complexity, and can be picked up opportunistically by anyone with spare capacity at any point during this phase, in any order.

---

## Not scheduled — no implementation sequence applies

These carry no phase or milestone because `IMPLEMENTATION_PRIORITIES.md` already determined no action is the correct decision for them (or, for two items, that the decision isn't ready to be made yet). Listed here only so the full set of 31 findings is accounted for in one place.

### Accept As-Is — verified, no action needed
F19 (`billing`'s fan-out), F20 (estimate versioning), F22 (`crm` lead-scoring complexity), F23 (`maintenance-engine` size), F24 (`partner-desk` built ahead of volume — Owner's own conscious decision), F30 (no client-facing audit trail).

### Accept As-Is, pending Owner input — not yet answerable
F12 (permit/legal-compliance tracking), F13 (deposit/retention billing concept). **If the Owner later confirms either of these applies to Arkavena's real project mix, it re-enters this plan at that point** — likely as a Phase 1 or Phase 2 item depending on scope, decided fresh, not retrofitted into the sequence above.

### Reject — decided against
F14 (variation fast-lane), F16 (site-visit scheduling/calendar), F31 (portfolio-level multi-project rollup). No phase, no revisit trigger — these were rejected outright, not deferred.

---

## One-page sequence summary

```
Phase 1 (parallel, no ordering within it)
  1.1 F2  — patch variation-page leak
  1.2 F25+F26 — document two boundary rules
  1.3 F8  — decide project/contract status semantics
  1.4 F29 — decide Management-tier enforcement
        │
        ▼  (Phase 1 must fully close before Phase 2 starts)
Phase 2
  2.1 F5  — Client Timeline shell                    ─┐
  2.2 F7  — contracts→proposals FK        (parallel)  │
  2.5 F10 — Cash Gate reminder            (parallel)  │  all four run
  2.6 F21 — type cleanup                  (parallel)  │  from day one
  2.7 F28 — visibility-matrix doc (ongoing)           ─┘
        │
        ▼  (2.1 must land before 2.3/2.4 start)
  2.3 F1 — proposal acceptance     ─┐ parallel with each other
  2.4 F3 — invoice visibility      ─┘ (different modules)
        │
        ▼  (Phase 2 must ship before Phase 3 starts)
Phase 3
  3.1 F4+F6 — handover/warranty/sign-off      ─┐
  3.2 F11   — notification infrastructure      │  independent of
  3.4 F9    — material↔procurement link        │  each other,
  3.5 F15   — project completion sign-off      │  staff/schedule
  3.6 F17   — assessment checklist             │  opportunistically
  3.7 F27   — projects-as-kernel doc           ─┘
  3.3 F18   — warranty-expiry touchpoint (after 3.2 if automated, else anytime)
```
