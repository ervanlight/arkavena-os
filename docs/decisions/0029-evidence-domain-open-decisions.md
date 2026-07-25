# ADR 0029 — Evidence domain: resolving the 3 remaining open decisions from ADR 0026

**Status:** Accepted
**Date:** 2026-07-25
**Trigger:** `IMPLEMENTATION_PLAN.md` Phase 2, F5's prerequisite check surfaced a real conflict — F5's full design (ADR 0026 §4) needs Evidence-backed content ("Hari Ini"/"Update Terbaru"), but 3 of ADR 0026 §7's 5 open decisions (all Evidence-related) were never resolved. ADR 0028 already resolved the other 2 (F8, F29). This ADR proposes resolutions for the remaining 3, each with a recommendation and explicit trade-offs.

**Revision note:** an adversarial design review (requested by the Owner before acceptance) found the original recommendations sound in substance but incomplete in three specific ways. All three are folded in below as accepted amendments — no other part of the original recommendations changed. This is the Owner's final quality gate for the Evidence domain: once Accepted, all three decisions below are locked, per the Owner's own instruction — further design discussion on these three points only reopens if implementation surfaces a genuine, unresolvable conflict.

---

## Decision 1 — Evidence-gating on completion: hard block from day one, or warning-first?

**The question** (ADR 0026 §3.4): should a DB trigger refuse `work_packages.status = 'completed'` without qualifying evidence, immediately and unconditionally (mirroring Cash Gate/Quality Gate's proven two-layer pattern), or should the system start by only warning (logging/flagging) while the team builds the evidence-capture habit, with hard enforcement following later?

### Option 1a — Hard block from day one, unconditional
- **Trade-off for:** Matches the exact precedent that already works (Cash Gate, Quality Gate) — "gates are literal, not policy" is `PRODUCT.md`'s own stated competitive advantage, and a "gate" that only warns isn't a gate. No transition period means no window where the discipline is optional and therefore, in practice, skipped.
- **Trade-off against:** The team has never used an evidence-capture workflow before. An unconditional block risks stopping real work on day one over a habit nobody has built yet, with no escape hatch unless one is built alongside it — which adds scope to something meant to be a quick decision.

### Option 1b — Warning-first, enforce later
- **Trade-off for:** Lets the team build the habit before the gate can actually stop anyone, avoiding operational disruption during rollout.
- **Trade-off against:** A warning with no consequence is exactly the "SOP that gets quietly ignored" failure mode this whole review cycle has been trying to move away from (see `ARCHITECTURE_REVIEW.md`'s framing of Cash Gate/Quality Gate as valuable *because* they're literal, not advisory). "Enforce later" also has no natural trigger — without a specific date or condition, "later" tends to never arrive.

### Decision
**Hard block, scoped to exactly where it's load-bearing** (see Decision 2), paired with a documented override — **amended to Technical Director authority, not Owner-only.** The original recommendation borrowed Cash Gate's exact override shape (owner-only). The design review found a better precedent: Evidence-gating is a documentation/verification control — closer in kind to Quality Gate (TD-authorized override) than to Cash Gate (a financial control, correctly Owner-only because it protects the org's money). Evidence-gating protects whether work is properly documented before being called done, which is exactly TD's domain (the same person who already overrides failed Quality Gate hold points).

**Final shape:** `modules/evidence` exposes an override action, TD-only (`roleCan(orgRole, 'evidence_override', 'create')` restricted to `technical_director`), mandatory `reason` (compile-time enforced the same way every other override in this system is — `withAudit({ requiresReason: true })`), written to `audit_logs` like every Cash Gate/Quality Gate override before it. Nothing about the *shape* of the override changes from the original recommendation (reason required, audited, one clean escape hatch) — only *who* holds it.

---

## Decision 2 — Initial scope: every project, or only client-facing milestones?

**The question** (ADR 0026 §7 item 3): should Evidence-gating and visibility apply to every project from the start, or only to milestones that are actually going to be shown to a client?

### Option 2a — Every project, no special-casing
- **Trade-off for:** One rule for everyone is simpler to explain and audit — no "is this milestone flagged or not" ambiguity for staff to track.
- **Trade-off against:** Forces evidence discipline onto every work package, including ones with zero client-visibility need (because the project has no signed contract yet, or the milestone is purely internal), before the Client Timeline that would even consume that evidence exists. This is exactly the kind of cost-without-visible-payoff `IMPLEMENTATION_PRIORITIES.md` rejected elsewhere in this same review cycle (F14, F16, F31).

### Option 2b — Only client-facing milestones
- **Trade-off for:** Ties the cost (capturing evidence) directly to the benefit (a client can eventually see it) — the same reasoning already applied to Decision 1's recommendation.
- **Trade-off against:** Requires a concept of "which milestones are client-facing" to exist. Building a new flag/marker for this would itself be new scope.

### Decision
**Client-facing milestones only, defined without inventing a new flag** — reuse ADR 0028's already-settled condition (a project has an active signed contract, `contracts.status = 'active'`). **Amended:** rather than informally "reusing" that check in two unrelated places (F5's Client Timeline and Evidence-gating), it is named as one explicit, shared business rule so the coupling is visible in code, not incidental:

```ts
// modules/projects/domain/client-facing.ts
export function isProjectClientFacing(project: Project, contracts: Contract[]): boolean {
  return contracts.some((c) => c.status === 'active');
}
```

Owned by `modules/projects` (it operates purely on `projects`/`contracts` data, which that module already owns), exported from its public API, and called identically by `modules/client-portal` (to gate Client Project Status / Client Timeline, ADR 0028) and by `modules/evidence` (to gate completion-evidence enforcement, this ADR). One named rule, two callers — a future change to either concern edits a call site, not a re-derivation of the underlying condition.

---

## Decision 3 — Relationship between `evidence` and `photos`: parallel tables, or absorption?

**The question** (ADR 0026 §3.3's own deferred note): does the new `evidence` table stay a separate index alongside `field-reporting`'s existing `photos` table, or does `evidence` eventually absorb `photos` entirely?

### Option 3a — Parallel tables (evidence indexes/references photos, doesn't replace it)
- **Trade-off for:** Zero migration risk to `field-reporting`'s existing table, RLS, tests, and SiteFlow upload flow — all untouched. Ships incrementally. Respects existing module ownership (`field-reporting` keeps `photos`, `evidence` is its own new module).
- **Trade-off against:** Two tables can describe overlapping things. If a photo is uploaded via SiteFlow but nobody also creates a matching `evidence` row, that photo can never become client-visible — a silent gap, not a loud failure, unless something structurally prevents it.

### Option 3b — Absorption (evidence replaces photos; field-reporting's upload flow writes evidence directly)
- **Trade-off for:** Single source of truth — no possibility of the two tables drifting out of sync.
- **Trade-off against:** A major migration touching `field-reporting`'s live upload flow (offline outbox included), and a real module-boundary question: either `field-reporting` starts writing into a table it doesn't own (violates CLAUDE.md's one-table-one-module rule), or ownership of photo capture itself would need to move to `evidence`, which is a much larger change than "add a new module." High risk, large rework, for a problem Option 3a can solve more cheaply (see recommendation).

### Decision
**Parallel tables (3a), with the sync-gap risk closed structurally**: `modules/evidence` exposes a narrow action (`recordEvidenceFromPhotoAction`), and `field-reporting`'s existing photo-upload action calls it automatically every time a photo is saved — creating a matching `evidence` row (`internal_only` by default, per ADR 0026 §3.2) in the same transaction.

**Amendment — explicit `photos` → `evidence` activity-mapping rule** (the design review's finding: `photos` has four nullable FKs — `work_package_id`, `daily_log_id`, `handover_item_id`, `zone_id` — but `evidence.activity_table`/`activity_id` requires exactly one polymorphic reference; the original recommendation didn't say which wins). Priority order, first match wins:

1. `work_package_id` set → `activity_table = 'work_packages'`
2. else `daily_log_id` set → `activity_table = 'daily_logs'`
3. else `handover_item_id` set → `activity_table = 'handover_items'`
4. else (only `zone_id`, no specific activity) → **no evidence row is created.** A general zone progress photo isn't tied to a specific unit of work; it has nothing for Evidence-gating (Decision 1) to attach to, and that's correct, not a gap — Evidence-gating only cares about photos that document a specific activity's completion.

---

## Summary of accepted decisions

| Decision | Resolution |
|---|---|
| 1. Gating strictness | Hard block, scoped to client-facing milestones (Decision 2), override by **Technical Director** (amended from Owner), reason required, audited |
| 2. Initial scope | Only milestones on projects where `isProjectClientFacing()` (new named shared rule in `modules/projects`) is true — one function, called by both `client-portal` and `evidence` |
| 3. `evidence` vs `photos` | Parallel tables; photo upload auto-creates a matching `internal_only` evidence row via priority-ordered FK mapping (work_package → daily_log → handover_item → skip if none) |

All three decisions converge on the same principle ADR 0028 established: one named, shared condition activates every client-facing and gating mechanism, rather than several independent concepts that must be kept in sync by convention.

**This ADR is now Accepted. Evidence domain design is locked** — `modules/evidence`, the `isProjectClientFacing()` shared rule, and the photo-mapping priority order above are the specification implementation proceeds against. Further design discussion on these three points reopens only if implementation surfaces a genuine, unresolvable conflict, per the Owner's standing instruction.
