# ADR 0029 — Evidence domain: resolving the 3 remaining open decisions from ADR 0026

**Status:** PROPOSED — needs Owner approval before F5 (Client Timeline shell) is implemented. Do not build against this ADR until it is marked Accepted.
**Date:** 2026-07-25
**Trigger:** `IMPLEMENTATION_PLAN.md` Phase 2, F5's prerequisite check surfaced a real conflict — F5's full design (ADR 0026 §4) needs Evidence-backed content ("Hari Ini"/"Update Terbaru"), but 3 of ADR 0026 §7's 5 open decisions (all Evidence-related) were never resolved. ADR 0028 already resolved the other 2 (F8, F29). This ADR proposes resolutions for the remaining 3, each with a recommendation and explicit trade-offs, per the Owner's request — no implementation happens until this is Accepted.

---

## Decision 1 — Evidence-gating on completion: hard block from day one, or warning-first?

**The question** (ADR 0026 §3.4): should a DB trigger refuse `work_packages.status = 'completed'` without qualifying evidence, immediately and unconditionally (mirroring Cash Gate/Quality Gate's proven two-layer pattern), or should the system start by only warning (logging/flagging) while the team builds the evidence-capture habit, with hard enforcement following later?

### Option 1a — Hard block from day one, unconditional
- **Trade-off for:** Matches the exact precedent that already works (Cash Gate, Quality Gate) — "gates are literal, not policy" is `PRODUCT.md`'s own stated competitive advantage, and a "gate" that only warns isn't a gate. No transition period means no window where the discipline is optional and therefore, in practice, skipped.
- **Trade-off against:** The team has never used an evidence-capture workflow before. An unconditional block risks stopping real work on day one over a habit nobody has built yet, with no escape hatch unless one is built alongside it — which adds scope to something meant to be a quick decision.

### Option 1b — Warning-first, enforce later
- **Trade-off for:** Lets the team build the habit before the gate can actually stop anyone, avoiding operational disruption during rollout.
- **Trade-off against:** A warning with no consequence is exactly the "SOP that gets quietly ignored" failure mode this whole review cycle has been trying to move away from (see `ARCHITECTURE_REVIEW.md`'s framing of Cash Gate/Quality Gate as valuable *because* they're literal, not advisory). "Enforce later" also has no natural trigger — without a specific date or condition, "later" tends to never arrive.

### Recommendation
**Hard block, but scoped to exactly where it's load-bearing** — combine with Decision 2 below: enforce only for milestones already in client-facing scope (i.e., projects with an active signed contract, per ADR 0028's Decision 1), and pair the block with an **override path identical to Cash Gate's own pattern** (owner-only, reason required, logged to `audit_logs` like every other override in this system). This gets the best of both options: the gate is real (not advisory) exactly where it protects client trust, but nothing ever grinds to a permanent halt — a legitimate exception is always one documented override away, exactly like Cash Gate today. Internal-only, pre-contract projects are not gated at all (nothing to protect yet, per Decision 2).

---

## Decision 2 — Initial scope: every project, or only client-facing milestones?

**The question** (ADR 0026 §7 item 3): should Evidence-gating and visibility apply to every project from the start, or only to milestones that are actually going to be shown to a client?

### Option 2a — Every project, no special-casing
- **Trade-off for:** One rule for everyone is simpler to explain and audit — no "is this milestone flagged or not" ambiguity for staff to track.
- **Trade-off against:** Forces evidence discipline onto every work package, including ones with zero client-visibility need (because the project has no signed contract yet, or the milestone is purely internal), before the Client Timeline that would even consume that evidence exists. This is exactly the kind of cost-without-visible-payoff `IMPLEMENTATION_PRIORITIES.md` rejected elsewhere in this same review cycle (F14, F16, F31).

### Option 2b — Only client-facing milestones
- **Trade-off for:** Ties the cost (capturing evidence) directly to the benefit (a client can eventually see it) — the same reasoning already applied to Decision 1's recommendation.
- **Trade-off against:** Requires a concept of "which milestones are client-facing" to exist. Building a new flag/marker for this would itself be new scope.

### Recommendation
**Client-facing milestones only, defined without inventing a new flag:** reuse ADR 0028's already-settled definition — a milestone is in scope the moment its project has an active signed contract (`contracts.status = 'active'`), the exact same condition that activates Client Project Status and the Client Timeline. This means Evidence-gating and Decision 1's hard block both activate for a project at precisely the same moment the client-facing layer does — one condition, reused, not two separate concepts to keep in sync.

---

## Decision 3 — Relationship between `evidence` and `photos`: parallel tables, or absorption?

**The question** (ADR 0026 §3.3's own deferred note): does the new `evidence` table stay a separate index alongside `field-reporting`'s existing `photos` table, or does `evidence` eventually absorb `photos` entirely?

### Option 3a — Parallel tables (evidence indexes/references photos, doesn't replace it)
- **Trade-off for:** Zero migration risk to `field-reporting`'s existing table, RLS, tests, and SiteFlow upload flow — all untouched. Ships incrementally. Respects existing module ownership (`field-reporting` keeps `photos`, `evidence` is its own new module).
- **Trade-off against:** Two tables can describe overlapping things. If a photo is uploaded via SiteFlow but nobody also creates a matching `evidence` row, that photo can never become client-visible — a silent gap, not a loud failure, unless something structurally prevents it.

### Option 3b — Absorption (evidence replaces photos; field-reporting's upload flow writes evidence directly)
- **Trade-off for:** Single source of truth — no possibility of the two tables drifting out of sync.
- **Trade-off against:** A major migration touching `field-reporting`'s live upload flow (offline outbox included), and a real module-boundary question: either `field-reporting` starts writing into a table it doesn't own (violates CLAUDE.md's one-table-one-module rule), or ownership of photo capture itself would need to move to `evidence`, which is a much larger change than "add a new module." High risk, large rework, for a problem Option 3a can solve more cheaply (see recommendation).

### Recommendation
**Parallel tables (3a), with the sync-gap risk closed structurally rather than left to memory:** `modules/evidence` exposes a narrow action (e.g. `recordEvidenceFromPhotoAction`), and `field-reporting`'s existing photo-upload action calls it automatically every time a photo is saved — creating a matching `evidence` row (`internal_only` by default, per ADR 0026 §3.2's own default) in the same transaction. This is a small addition to an existing action, not a migration of `photos` itself, and it means "did someone remember to also create an evidence row" is never a real question — it happens automatically, every time, with the same one-table-one-module boundary fully intact (`field-reporting` still owns `photos`; it calls `evidence`'s public API exactly the way any other cross-module call in this system works).

---

## Summary of recommended resolutions

| Decision | Recommendation |
|---|---|
| 1. Gating strictness | Hard block, scoped to client-facing milestones only (ties to Decision 2), with a Cash-Gate-style owner override + reason |
| 2. Initial scope | Only milestones on projects with an active signed contract (reuses ADR 0028's Decision 1 condition, no new flag) |
| 3. `evidence` vs `photos` | Parallel tables; `field-reporting`'s photo upload automatically creates a matching `internal_only` evidence row via `evidence`'s own action, closing the sync-gap risk without a migration |

All three recommendations converge on the same principle already established in ADR 0028: reuse `contracts.status = 'active'` as the one condition that activates every client-facing mechanism, rather than inventing a new flag or a second concept to keep in sync with it.

**This ADR does not become Accepted, and no Evidence-domain code is written, until the Owner confirms or amends these three resolutions.**
