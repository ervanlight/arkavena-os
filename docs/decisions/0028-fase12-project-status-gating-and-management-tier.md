# ADR 0028 — Fase 12 prerequisite decisions: project/contract status gating, and the "Management" tier

**Status:** Accepted
**Date:** 2026-07-25
**Trigger:** `IMPLEMENTATION_PLAN.md` Phase 1, items F8 and F29 — two of ADR 0026 §7's five open decisions, resolved here so Fase 12's Client Timeline work can start designing against a settled answer instead of an open question.

## Decision 1 (F8) — What must be true before a project shows anything client-facing

**Context:** `ARCHITECTURE_REVIEW.md` and `WORKFLOW_REVIEW.md` both verified that `convertLeadToProjectAction` creates a real `project` row once a lead is merely `qualified` — the third of six pipeline stages, well before assessment, proposal, or contract. `project_status` (`planning/in_progress/on_hold/completed/cancelled`) has no state distinguishing "a qualified opportunity with no contract yet" from "a confirmed, contracted build." Client Project Status (ADR 0026 §2) cannot be designed correctly without deciding what this means for client-facing surfaces.

**Decision:** A project's Client Project Status, and everything under the Client Timeline (ADR 0026 §4), is only computed and shown once that project has an **active, signed contract** (`contracts.status = 'active'` for at least one contract row, per `modules/projects`' existing `contracts` table — no new column or enum value). A project that exists only because a lead was qualified and converted, with no active contract yet, has no Client Project Status, no Client Timeline, and is not client-visible in any form.

**Why this, not a new `project_status` value:** adding a "prospective"/"unconfirmed" state to `project_status` would touch every existing consumer of that enum (the Command Center dashboard, permission checks, every place `PROJECT_STATUS_LABEL`-style maps already exist) for a distinction that, in practice, only matters to one thing: whether the client-facing layer should activate. Gating on `contracts.status` — a check Fase 12's Client Timeline code needs to perform anyway to find the active contract's milestones — costs nothing extra and doesn't touch anything outside the new client-facing code path.

**What this does not change:** `project_status` keeps its five existing values, unchanged. The Command Center dashboard (Pillar 2) continues to treat `planning`/`in_progress`/`on_hold` as "active" for staff purposes, exactly as it does today — a pre-contract "project" still appears on staff's own dashboard, which is correct (staff legitimately track a qualified opportunity as work-in-progress before signature). Only the *client-facing* layer additionally requires an active contract to exist.

## Decision 2 (F29) — Is "Internal + Management" an enforced permission tier, or a documentation convention?

**Context:** ADR 0026 §5 classifies `cash-gate`, `quality-gate`, and `projects` (among others) as "Internal + Management" — stated there as "dibatasi ke tier manajemen (owner, technical_director, finance) bahkan di antara staf." Checked directly against `src/core/permissions/matrix.ts`: today, `funding_receipt.view`, `cash_forecast.view`, `project_risk_reserve.view`, `inspection.view`, and `nonconformity.view` are all `[...ORG_ROLES]` — every internal role (owner, technical_director, finance, qs, procurement) already has equal view access. No enforced narrower tier exists anywhere in the system today.

**Decision:** "Internal + Management" is a **client-visibility documentation label, not an enforced internal permission tier.** It exists to distinguish, in `docs/client-visibility-matrix.md` (Fase 12, F28), what should never reach a client from what any staff member may see internally — it does **not** mean QS or Procurement should be newly restricted from data they can see today. **No change to `core/permissions/matrix.ts` is made or planned as a result of this ADR.**

**Why not enforce it:** narrowing `funding_receipt.view`/`inspection.view`/etc. from all org roles to owner/TD/finance only would be a real, load-bearing change to `core/permissions` — the one module every RLS policy, every `requirePermission()` call, and `gen:rls-check` all depend on being stable. There is no evidence anywhere in this review cycle that QS or Procurement seeing cash-gate or quality-gate data has caused, or risks causing, any actual problem — the concern ADR 0026 was written to address is client exposure, not internal-staff over-sharing. Restricting internal roles further would be solving a problem nobody has reported, which is exactly the over-engineering risk `IMPLEMENTATION_PRIORITIES.md` warned against elsewhere in this same review cycle (see its F14/F16/F31 rejections).

**What "Management" means when used in documentation going forward:** owner, technical_director, finance — named for clarity in `docs/client-visibility-matrix.md` and any future writing, but carrying no code enforcement beyond what `core/permissions/matrix.ts` already does today.

## Consequence

Fase 12 (Phase 2 of `IMPLEMENTATION_PLAN.md`) can now proceed: the Client Timeline shell (2.1) gates on `contracts.status = 'active'`, not merely `project` existing, and no new permission-matrix work is required to honor the "Internal + Management" classification — it is satisfied by leaving `core/permissions/matrix.ts` exactly as it is today.

This closes 2 of ADR 0026 §7's 5 open decisions. The remaining 3 (evidence default visibility confirmation, who may publish Client Status, evidence-gating timing) are unaffected by this ADR and remain open.
