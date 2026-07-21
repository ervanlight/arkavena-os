# ADR 0013 — `roleCan(null, ...)` defers to RLS for project-scoped resources

**Status:** Accepted
**Date:** 2026-07-21
**Needs owner confirmation:** no (a bug fix restoring already-intended behaviour, not a new decision)

## Context

Found while building Fase 3's client-approval flow (modules/scope-variation):
`client_approve`/`client_reject` need to work for a `client_approver`, who
holds no `org_role` at all -- only a row in `project_members`.
`ActionContext.orgRole` (`core/auth/session.ts`) is sourced from
`users.org_role` and is therefore always `null` for every project-role-only
user (`mandor`, `site_coordinator`, `client_approver`, `client_viewer`,
`supplier`, `subcontractor`). `roleCan()` denied unconditionally whenever
`role` was `null`, regardless of what `core/permissions/matrix.ts` listed
for the resource/action.

This was not new to Fase 3. `core/permissions/matrix.ts`'s own file-level
comment already documented the *intended* behaviour for Fase 1's
project-scoped resources (`project`, `project_member`, `zone`,
`work_package`): "roleCan() has no project id to check against, so it
cannot and does not decide whether a given mandor may see a given project.
That instance-level decision is fn_has_project_role()'s alone, enforced in
the database." The code never actually implemented that deferral --
`roleCan(null, ...)` returned `false` outright instead of returning `true`
and letting RLS decide the real, per-project question. The practical effect:
every project-scoped Fase 1 server action (`listWorkPackagesForProjectAction`,
`listZonesForProjectAction`, `listProjectMembersAction`, and so on) silently
refused every project-role user, even though RLS in the database already
correctly scoped their access. Nothing had ever exercised this end-to-end
(existing tests either called the domain layer directly or hit RLS through
raw SQL via `supabase/tests/db.ts`'s `asUser()`, never through an actual
exported server action), so the gap went unnoticed until Fase 3's
client-approval feature needed a project-role user to succeed at calling one.

## Decision

`roleCan()` now matches its own documented intent: when `role` is `null` or
`undefined`, look at whether the matrix's `allowed` list for that
resource/action contains *any* project role at all.

- If it does (e.g. `project.view`, `work_package.view`,
  `change_order.client_approve`), return `true`. This is not a claim that
  *this specific* user may reach *this specific* project -- `roleCan()` has
  no project id to make that claim with. It is only "this class of action is
  in the right ballpark for a project role", exactly as the pre-existing
  comment already said. `fn_has_project_role()`, enforced by RLS, remains the
  sole authority on the real per-project answer (ARCHITECTURE.md 6.2,
  enforcer 1) -- nothing about the security boundary moved, only the
  application-layer usability check that sits in front of it.
- If it does not (e.g. `contract.view`, `milestone.view`,
  `organization.view`, every staff-only/money resource), `null` is still
  denied outright, unchanged from before.

## Consequences

**Fase 1's existing project-role-facing actions now actually work** for
`mandor`/`site_coordinator`/etc., not just at the RLS layer but through the
application's own server actions -- closing a gap that predates Fase 3 and
would otherwise have surfaced the first time any field or client role tried
to use the running app rather than just the database directly.

**Fase 3's `client_approve`/`client_reject` actions call `requirePermission()`
normally**, like every other action in the codebase, rather than needing a
module-local bypass. `modules/scope-variation` still resolves the caller's
actual project role via a narrow read (`modules/projects`'
`getMyProjectRole`) for a different reason that this fix does not remove:
`transition()`'s domain guard needs to know *which* role the caller is
acting as (to tell a `client_approver` apart from an `owner`), and
`requirePermission()` only ever returns a boolean, never the resolved
identity.

**Regression coverage:** `core/permissions/matrix.test.ts` asserts
`roleCan(null, ...)` against every resource/action in the matrix
mechanically (deferring wherever a project role is listed, still denying
wherever none is), so a future resource added without thinking about this
gets the right answer by construction rather than by remembering to ask.
`modules/projects/actions/work-package-actions.test.ts` calls the real
exported `listWorkPackagesForProjectAction` end-to-end (mocking only the two
seams that need a live request: cookies and the Supabase client
construction) to prove a `mandor` now succeeds, and that a staff-only
resource (`milestones`) still correctly refuses the same caller.

**Reversal cost: low.** The change is four lines in `roleCan()`'s body; the
matrix and RLS policies are unchanged.

## Alternatives considered

**Resolve a per-project role into `ActionContext` itself**, so `orgRole`
(or a new field) could carry the real project role for whichever project an
action targets. Rejected as unnecessarily invasive for what turned out to be
a smaller fix: `ActionContext` is built once per request, before any action
knows which project (if any) it will touch, and a user can hold different
project roles on different projects -- there is no single "the" role to put
there. `roleCan()` deferring to RLS, and individual modules resolving a
specific project role only where the domain logic actually needs the
identity (not just a yes/no), matches how `fn_has_project_role()` already
works: an instance-level question answered at the point where the instance
is known, not carried speculatively through the whole request.
