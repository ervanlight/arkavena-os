# ADR 0011 — `risk_reserve_amount` moves off `projects` into its own staff-only table

**Status:** Accepted — owner approved on 2026-07-21
**Date:** 2026-07-21
**Needs owner confirmation:** no (this ADR records the owner's own decision)

## Context

While writing Fase 2's integration/RLS tests (CG7), re-checking `projects`'s
existing policies before asserting anything about `risk_reserve_amount`
surfaced a real leak, not a hypothetical one.

ADR 0009 decision 4 added `risk_reserve_amount bigint` directly onto the
`projects` table (Wave 7,`20260721000600_wave7_cash_gate.sql`), because that
table already existed and the column needed a home. But Wave 4
(`20260721000200_wave4_projects.sql`) had already given `projects` a second
SELECT policy, `projects_select_member`, granting every project role —
including `client_viewer`, `client_approver`, `supplier`, and
`subcontractor`, all of which are external, client-facing roles with no
`org_role` at all — full-row read access to any project they belong to.

RLS in Postgres is row-level, not column-level. `projects_select_member`
does not, and cannot, distinguish "let a client see the project's name and
dates" from "let a client see the project's name and dates and its owner's
internal cash risk buffer." Once `risk_reserve_amount` landed on `projects`,
every one of those four external roles could read it for their own project,
in direct conflict with CLAUDE.md §2 ("Data sensitif ... tidak di tabel yang
dibaca klien") and the exact reasoning Fase 1 already used to keep
`contracts` and `milestones` off the project-role SELECT list entirely.

No app code shipped this leak to a real user — Fase 2 has not been reviewed
or deployed, and no client-portal users exist yet (that is Fase 6). But the
column has been live on the shared cloud dev database since Wave 7 landed,
and the gap would have shipped unnoticed had CG7's RLS test-writing not
required rereading the policy it would need to assert against.

## Decision

`risk_reserve_amount` moves to a new table, `project_risk_reserves`
(one row per project, `project_id unique`), owned outright by
modules/cash-gate — not modules/projects. RLS is staff-only select/insert/
update, identical in shape to `funding_receipts`/`cash_forecasts`: no
project-role policy of any kind, the same pattern that already protects
`contracts`/`milestones`.

This also resolves the split-ownership awkwardness ADR 0009 decision 4 left
behind (the column conceptually belonged to Cash Gate but had to live on a
table modules/projects owns). With its own table, `project_risk_reserves` is
cash-gate's outright — `getProjectRiskReserve`/`setRiskReserveAction` move
from modules/projects into modules/cash-gate, and the cross-module read that
`gate-state-repository.ts` needed (`projects.getProjectRiskReserve`) goes
away entirely.

Migration is two files, expand then contract (CLAUDE.md §2):
`20260721000800` creates `project_risk_reserves` and backfills one row per
existing project from `projects.risk_reserve_amount` (all currently `0`, no
Owner/Finance user has had a UI to set one yet); `20260721000900` drops the
column and its two CHECK constraints from `projects`. Both run back-to-back
in this same session — the "migrate" window that justifies three separate
migrations for a live cutover does not apply here, since no application code
reads or writes the old column outside this same commit.

## Consequences

**Reversal cost: low, same as ADR 0009 assessed for the column itself.**
Moving a single bigint between a project-scoped table and its own satellite
table is an additive/subtractive pair of migrations either direction, not a
domain or type-shape change — `Rupiah` stays `Rupiah` throughout.

**One more table for CG7 and docs/rls-matrix.md to cover**, but a smaller
surface than leaving the column in place would have needed: no column-grant
mechanism, no view-based read split, nothing the codebase has not already
done twice for `funding_receipts` and `cash_forecasts`.

**The gap existed in the pushed cloud dev database for one session's
duration.** Nothing reads that dev project except this session's own code
and ad-hoc SQL, so there is no cleanup beyond the two migrations below.

## Alternatives considered

**Column-level `REVOKE SELECT (risk_reserve_amount)` from the roles
`projects_select_member` serves, keeping the column on `projects`.** Rejected
by the owner: no other table in this codebase relies on column-level grants,
`gen:rls-check` only ever compares row-level policies against the matrix, so
a future `ALTER TABLE` could silently re-expose the column with nothing to
catch it. A dedicated table is the pattern already used twice this phase and
is what `docs/rls-matrix.md` already knows how to describe.

**Leave it and revisit before Fase 6 (client portal) ships.** Rejected by
the owner for money data specifically — the same instinct that made ADR
0009's placeholders named and commented rather than silently `0` forever
applies here: a known money leak is not something to schedule around, even
one that has not been exploited by a real external user yet.
