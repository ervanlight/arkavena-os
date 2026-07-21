# RLS matrix

Who can do what, per table. This is the audit-friendly view of the policies in
`supabase/migrations/` (ARCHITECTURE.md §2.4, layer 2).

**This file must be updated in the same pull request as any policy change.** It
is not documentation that trails behind the code — `supabase/tests/rls.test.ts`
signs in as each role and asserts the behaviour described below, so a policy
that stops matching this table fails CI.

## How to read it

- **CRUD** — all four operations, within the stated scope.
- **(org)** — restricted to the signer's own organisation, via
  `fn_current_org_id()`.
- **(self)** — restricted to the signer's own row.
- **—** — no access at all. Not "no UI for it": the database refuses.
- **migration only** — no policy exists for any role; the data changes only when
  a migration runs.

"Staff" means a user holding any `org_role`: owner, technical_director, finance,
qs, procurement. "External" means client_approver, client_viewer, supplier,
subcontractor — these hold no `org_role`, so `fn_current_org_role()` returns
NULL for them and any policy testing it excludes them.

## Wave 1 — identity and kernel

| Table | Owner | Technical Director | Finance | QS | Procurement | External (client / partner) |
| --- | --- | --- | --- | --- | --- | --- |
| `organizations` | SELECT, UPDATE (own org) | SELECT (org) | SELECT (org) | SELECT (org) | SELECT (org) | — |
| `roles` | SELECT | SELECT | SELECT | SELECT | SELECT | SELECT |
| `users` | SELECT (org), UPDATE (org) | SELECT (org), UPDATE (self) | SELECT (org), UPDATE (self) | SELECT (org), UPDATE (self) | SELECT (org), UPDATE (self) | — |
| `audit_logs` | SELECT (org) | SELECT (org) | SELECT (org) | SELECT (org) | SELECT (org) | — |
| `notifications` | SELECT, UPDATE (self) | SELECT, UPDATE (self) | SELECT, UPDATE (self) | SELECT, UPDATE (self) | SELECT, UPDATE (self) | SELECT, UPDATE (self) |

### What is deliberately absent

Several gaps below are decisions, not omissions. They are listed so a reviewer
can tell the difference.

**No INSERT policy on `users`.** Provisioning happens with the service role. If
a signed-in user could insert a row here, they could mint a colleague — or
themselves in another organisation. There is also no self-signup: joining an
organisation is an act of provisioning, not registration.

**No INSERT, UPDATE or DELETE policy on `audit_logs`, for anyone.** Both audit
channels write through `SECURITY DEFINER` functions (`fn_audit_row_change`,
`fn_record_audit`), so no direct write path is needed and none exists. UPDATE
and DELETE are additionally revoked at the grant level. Append-only here means
structurally impossible, not "we agreed not to".

**No INSERT or DELETE policy on `organizations`.** Creating and removing tenants
is an operator action.

**`roles` is writable by nobody** — reference data, changed by migration only.

**External roles cannot read `audit_logs`.** The trail records internal
decisions. Once the client portal exists (Fase 6), clients read purpose-built
`vw_client_*` views, never internal tables (ARCHITECTURE.md §2.6).

### Column-level rules RLS cannot express

RLS grants or denies whole rows. Two rules here are narrower than a row, so they
are enforced by triggers instead:

| Rule | Enforced by |
| --- | --- |
| Only an owner may change `users.org_role`, `organization_id` or `status` — otherwise `users_update_self` would let anyone make themselves owner | `trg_users_guard_privileged_columns` |
| A user can never be moved between organisations at all, owner or not | `trg_users_guard_privileged_columns` |
| A notification recipient may only mark it read, not rewrite its content | `trg_notifications_guard_recipient_edits` |

`trg_users_guard_privileged_columns` exempts `current_user in ('postgres',
'service_role')` -- migrations and trusted backend code, not the
application-facing `anon`/`authenticated` roles this guard actually targets.
This is deliberately **not** `security definer`: that property makes
`current_user` reflect the function's owner rather than the caller, which
silently disabled the whole guard the first time it was tried
(`20260720000300` → `20260720000400`, found by `pnpm test:db` against the real
database, not by review).

### The failure mode this is built around

`fn_current_org_id()` returns NULL when the signer is unauthenticated,
soft-deleted, or has no profile row. Every org-scoped policy is written as
`organization_id = fn_current_org_id()`, and in SQL `x = NULL` evaluates to NULL
rather than true — so a broken session matches no rows anywhere.

The system fails closed by construction. That is a property of how the policies
are written, and `supabase/tests/rls.test.ts` asserts it directly rather than
assuming it.

## Fase 1 — crm(dasar), projects (Wave 2-6)

"External (project member)" here is narrower than Wave 1's "External": it
means specifically a user holding a `project_role` **on that project**, via
`fn_has_project_role()` -- not merely an external user in general. All six
project roles (site_coordinator, mandor, client_approver, client_viewer,
supplier, subcontractor) get identical access in Fase 1; nothing yet
distinguishes between them at the row level.

| Table | Owner | Technical Director | Finance | QS | Procurement | External (project member) |
| --- | --- | --- | --- | --- | --- | --- |
| `clients` | CRUD (org) | CRUD (org) | CRUD (org) | CRUD (org) | CRUD (org) | — |
| `sites` | CRUD (org) | CRUD (org) | CRUD (org) | CRUD (org) | CRUD (org) | — |
| `client_users` | SELECT, INSERT, DELETE (org) | SELECT, INSERT, DELETE (org) | SELECT, INSERT, DELETE (org) | SELECT, INSERT, DELETE (org) | SELECT, INSERT, DELETE (org) | SELECT (self only) |
| `projects` | CRUD (org) | CRUD (org) | CRUD (org) | CRUD (org) | CRUD (org) | SELECT (own project) |
| `project_members` | SELECT, INSERT, UPDATE, DELETE (org) | SELECT, INSERT, UPDATE, DELETE (org) | SELECT, INSERT, UPDATE, DELETE (org) | SELECT, INSERT, UPDATE, DELETE (org) | SELECT, INSERT, UPDATE, DELETE (org) | SELECT (own row only, not the whole roster) |
| `zones` | CRUD (org) | CRUD (org) | CRUD (org) | CRUD (org) | CRUD (org) | SELECT (own project) |
| `contracts` | CRUD (org) | CRUD (org) | CRUD (org) | CRUD (org) | CRUD (org) | — |
| `milestones` | CRUD (org) | CRUD (org) | CRUD (org) | CRUD (org) | CRUD (org) | — |
| `work_packages` | CRUD (org) | CRUD (org) | CRUD (org) | CRUD (org) | CRUD (org) | SELECT (own project) |

"CRUD" in this section means SELECT, INSERT, UPDATE for staff -- none of these
nine tables has a DELETE policy for anyone but `project_members`. Soft delete
(`deleted_at`) is the removal path everywhere else; `on delete restrict`
foreign keys throughout this wave mean a hard delete fails loudly rather than
cascading through project history.

### What is deliberately absent

**No table in this wave lets a project role write anything.** Every INSERT and
UPDATE policy here is staff-only. A mandor's own progress reporting is
Fase 4 (field-reporting) territory and does not exist yet -- there is
nothing for a project role to write to in Fase 1.

**`contracts` and `milestones` have no project-role SELECT at all**, unlike
`projects`, `zones`, and `work_packages`. Both carry a money figure
(`contract_amount`, `amount`) that ARCHITECTURE.md 2.6 keeps away from
client-facing reads. The client portal (Fase 6) will read a purpose-built
`vw_client_*` view instead of these tables directly, the same pattern
`audit_logs` already established in Wave 1.

**`project_members` gives a project role only their own row, not the project
roster.** `project_members_select_self` scopes strictly to `user_id =
auth.uid()` -- a mandor can confirm their own membership but cannot enumerate
who else is on the project. Staff see the full roster.

### The kernel piece this wave completes

`fn_has_project_role()` was a Wave 0 placeholder that always returned false --
correct at the time, since `project_members` did not exist yet to check
against, and a placeholder that denies fails closed rather than handing out
access nobody had granted. Wave 4 (`20260721000200_wave4_projects.sql`)
replaces it with the real check, in the same migration that creates the table
it reads.

## Fase 2 — cash-gate (Wave 7)

All three tables are money or a fact about a money decision (ADR 0009, ADR
0010), so the pattern matches `contracts`/`milestones`: staff only, no
project-role row at all. `projects.risk_reserve_amount` (a new column, not a
new table) follows the existing `projects` policies below it — no separate
row here.

| Table | Owner | Technical Director | Finance | QS | Procurement | External (project member) |
| --- | --- | --- | --- | --- | --- | --- |
| `funding_receipts` | SELECT, INSERT, UPDATE (org) | SELECT, INSERT, UPDATE (org) | SELECT, INSERT, UPDATE (org) | SELECT, INSERT, UPDATE (org) | SELECT, INSERT, UPDATE (org) | — |
| `cash_forecasts` | SELECT, INSERT, UPDATE (org) | SELECT, INSERT, UPDATE (org) | SELECT, INSERT, UPDATE (org) | SELECT, INSERT, UPDATE (org) | SELECT, INSERT, UPDATE (org) | — |
| `cash_gate_overrides` | SELECT, INSERT (org) | SELECT, INSERT (org) | SELECT, INSERT (org) | SELECT, INSERT (org) | SELECT, INSERT (org) | — |

### What is deliberately absent

**No UPDATE or DELETE policy on `cash_gate_overrides`, for anyone.** An
override is a fact about what happened, at the moment it happened — the same
append-only reasoning as `audit_logs`. Unlike `audit_logs`, this one *is*
insertable directly by staff (not only through a `SECURITY DEFINER`
function): the row-level policy is deliberately the coarse half of a
two-layer check, not the whole one (see below).

**`funding_receipts` and `cash_forecasts` have no project-role SELECT at
all**, same reasoning as `contracts`/`milestones` in Fase 1: both carry a
money figure kept away from client-facing reads.

### Column-level and cross-row rules RLS cannot express

| Rule | Enforced by |
| --- | --- |
| Only an `owner` may insert a `cash_gate_overrides` row — RLS above lets any staff member's INSERT through; this is the precise check underneath | `trg_cash_gate_overrides_guard_owner_only` |
| A `work_package` cannot move into `in_progress` while its project's Cash Gate is red or overdue, unless a matching override exists and is still within its 5-minute validity window (`OVERRIDE_VALIDITY_MINUTES`) | `trg_work_packages_guard_cash_gate` (`fn_work_packages_guard_cash_gate`, reading `fn_cash_gate_status`) |

Both triggers fire on the table whose row is actually changing
(`cash_gate_overrides`, `work_packages`), not on a table owned by another
module — `fn_cash_gate_status` is a plain (non-`security definer`) `stable`
function so it evaluates under the calling user's own row visibility, the
same lesson `trg_users_guard_privileged_columns` established in Wave 1: a
`security definer` function would make `current_user`/session checks reflect
the function owner, not the caller.

`requirePermission()` in `cashGate.overrideOpenWorkPackageAction` (the
application layer, `core/permissions/matrix.ts`'s `cash_gate_override.create
-> ['owner']`) rejects a non-owner before the request ever reaches
`trg_cash_gate_overrides_guard_owner_only` — a friendlier Indonesian message
first, the same trigger as the real authority underneath either way
(CLAUDE.md law 0.3's two independent layers).

## Later waves

Added as their tables land. A table may not reach main without a row here, its
policies, and its tests — CLAUDE.md law 6.
