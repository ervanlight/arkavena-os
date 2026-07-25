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

All four tables are money or a fact about a money decision (ADR 0009, ADR
0010, ADR 0011), so the pattern matches `contracts`/`milestones`: staff only,
no project-role row at all.

`project_risk_reserves` did not start this way. ADR 0009 decision 4
originally put `risk_reserve_amount` directly on `projects`, reusing that
table's existing policies below it — which turned out to be the bug ADR
0011 fixes: `projects` also carries `projects_select_member` (Fase 1),
granting every project role, including the external client-facing ones,
full-row SELECT. RLS cannot express "this column, but not that one" on a
single table, so the fix is the same one already used twice in this phase: a
dedicated table with no project-role policy at all.

| Table | Owner | Technical Director | Finance | QS | Procurement | External (project member) |
| --- | --- | --- | --- | --- | --- | --- |
| `funding_receipts` | SELECT, INSERT, UPDATE (org) | SELECT, INSERT, UPDATE (org) | SELECT, INSERT, UPDATE (org) | SELECT, INSERT, UPDATE (org) | SELECT, INSERT, UPDATE (org) | — |
| `cash_forecasts` | SELECT, INSERT, UPDATE (org) | SELECT, INSERT, UPDATE (org) | SELECT, INSERT, UPDATE (org) | SELECT, INSERT, UPDATE (org) | SELECT, INSERT, UPDATE (org) | — |
| `cash_gate_overrides` | SELECT, INSERT (org) | SELECT, INSERT (org) | SELECT, INSERT (org) | SELECT, INSERT (org) | SELECT, INSERT (org) | — |
| `project_risk_reserves` | SELECT, INSERT, UPDATE (org) | SELECT, INSERT, UPDATE (org) | SELECT, INSERT, UPDATE (org) | SELECT, INSERT, UPDATE (org) | SELECT, INSERT, UPDATE (org) | — |

### What is deliberately absent

**No UPDATE or DELETE policy on `cash_gate_overrides`, for anyone.** An
override is a fact about what happened, at the moment it happened — the same
append-only reasoning as `audit_logs`. Unlike `audit_logs`, this one *is*
insertable directly by staff (not only through a `SECURITY DEFINER`
function): the row-level policy is deliberately the coarse half of a
two-layer check, not the whole one (see below).

**`funding_receipts`, `cash_forecasts`, and `project_risk_reserves` have no
project-role SELECT at all**, same reasoning as `contracts`/`milestones` in
Fase 1: all three carry a money figure kept away from client-facing reads.
`projects` itself is not in this list — its risk reserve moved out (ADR
0011) precisely because `projects` cannot make that same promise once
`projects_select_member` exists.

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

## Fase 3 — scope-variation (Wave 7)

`change_orders` is the one table so far that a project role reads *and*
writes despite carrying money (`cost_impact_amount`) — every earlier
money-bearing table (`contracts`, `milestones`, `funding_receipts`,
`cash_forecasts`, `project_risk_reserves`) picked "staff only, no project
role at all" instead. This is deliberate, not a relaxation of that rule:
`client_approver` is specifically the role a variation is *for* — the whole
point of ARCHITECTURE.md 4.3's client-approval step is that a client sees
the cost/schedule impact and decides. RLS is row-level, so it cannot hide
`cost_impact_amount` from a `client_approver` while showing them everything
else on the row (the ADR 0011 lesson) — the column-level protection here is
instead about what a `client_approver` may *write*, not read.

| Table | Owner | Technical Director | Finance | QS | Procurement | External (client_approver) | External (other project roles) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `change_orders` | CRUD\* (org) | CRUD\* (org) | CRUD\* (org) | CRUD\* (org) | CRUD\* (org) | SELECT + UPDATE† (own project, non-draft) | — |

\* "CRUD" here means SELECT/INSERT/UPDATE — no DELETE policy exists for
anyone, same as every other table in this document; soft delete
(`deleted_at`) is the removal path.

† A `client_approver`'s UPDATE is real (needed so they can record their own
decision) but is narrowed to the `status` + `client_approved_*`/`rejected_*`
columns by `trg_change_orders_guard_client_columns`, not by this policy —
RLS cannot express "this column but not that one" on one row, so a trigger
does the part RLS structurally cannot.

### What is deliberately absent

**`client_approver` cannot see a `draft` or `under_review` change order at
all.** `change_orders_select_client_approver`'s policy excludes both
statuses explicitly — internal estimation and review is not something a
client is shown mid-process, only once officially sent to them
(`awaiting_client_approval` onward).

**No project role other than `client_approver` can read `change_orders` at
all** — `mandor`, `site_coordinator`, `client_viewer`, `supplier`, and
`subcontractor` get nothing, the same reasoning as `contracts`/`milestones`:
this is money, and only the one role a variation is actually *for* gets to
see it.

### Column-level and cross-row rules RLS cannot express

| Rule | Enforced by |
| --- | --- |
| A `change_orders.status` transition must be a legal edge in the Variation state machine (ARCHITECTURE.md 4.3) — applies to staff and `client_approver` alike | `trg_change_orders_guard_transition` |
| A `client_approver`'s UPDATE may only touch `status` and their own decision columns, never `cost_impact_amount`, `title`, or any other field | `trg_change_orders_guard_client_columns` |
| A `work_package` cannot get a non-null `change_order_id` unless that change order is `approved_funded` (ARCHITECTURE.md 4.3's literal rule) | `trg_work_packages_guard_change_order_funded` |

`requirePermission()` for `change_order.client_approve`/`client_reject` now
passes for a `client_approver` (`roleCan()`'s null-role deferral to RLS, ADR
0013) — before that fix, every project-role-only user was denied by the
application layer regardless of what this matrix listed, a gap found while
building this exact feature. The two triggers above are what actually
enforce the fine-grained rules either way, matching CLAUDE.md law 0.3's two
independent layers.

## Fase 4 — field-reporting (Wave 7-8)

The first tables scoped to **only** `site_coordinator`/`mandor` among project
roles, not the full six (CLAUDE.md 7: "Role eksternal tidak pernah akses tabel
internal"). Every earlier project-scoped table (`project`, `zone`,
`work_package`) grants some form of read access to the whole `PROJECT_ROLES`
set; these five do not; `client_approver`, `client_viewer`, `supplier`, and
`subcontractor` get nothing at all, on any of the five tables below —
correctly, since this is internal field operations data, not something any
client or partner is shown.

| Table | Owner/TD/Finance/QS/Procurement | site_coordinator / mandor (own project) | External (all six) |
| --- | --- | --- | --- |
| `daily_logs` | CRUD\* (org) | SELECT, INSERT, UPDATE | — |
| `progress_entries` | CRUD\* (org) | SELECT, INSERT, UPDATE | — |
| `photos` (table) | CRUD\* (org) | SELECT, INSERT, UPDATE | — |
| `material_requests` | CRUD\* (org) | SELECT, INSERT, UPDATE | — |
| `issues` | CRUD\* (org) | SELECT, INSERT, UPDATE | — |

\* "CRUD" here means SELECT/INSERT/UPDATE — no DELETE policy exists for
anyone, same as every other table in this document; soft delete
(`deleted_at`) is the removal path.

### Storage, not just the table

`photos.storage_path`/`thumbnail_path` point into the `photos` Storage
bucket (private, 5MB limit), which has its **own** RLS on `storage.objects`
— separate policies from the ones above, since Storage objects are a
different resource than table rows. `storage.foldername(name)` parses the
`{orgId}/{projectId}/{zoneId}/{date}/{photoId}.jpg` path convention
(`core/storage/paths.ts`) to apply the identical staff-org-wide /
site_coordinator-mandor-per-project split. No UPDATE or DELETE policy on
`storage.objects` at all — photos are immutable once uploaded; removing one
is the `photos` table's own soft delete, not a Storage mutation.

### What is deliberately absent

**No project role beyond `site_coordinator`/`mandor` can read any of these
five tables.** Unlike `change_orders` (Fase 3), where `client_approver` is
specifically who a variation is *for*, nothing here is information any
client, supplier, or subcontractor role should see — daily field operations,
not something the client-facing side of the business (Fase 6) will ever
surface even indirectly.

**`material_requests`/`issues` have no free-form UPDATE action in the
permission matrix** — only `update_status` (`requested` → `fulfilled`/
`cancelled`) and `resolve` (`open` → `resolved`, stamping
`resolved_by`/`resolved_at`). The RLS UPDATE policy itself is not narrowed to
just those columns (unlike `change_orders`' client-column trigger guard) —
the application layer simply never exposes a path to edit anything else,
since an already-submitted request or reported issue's own content is not
expected to change, only its status.

### Column-level and cross-row rules RLS cannot express

| Rule | Enforced by |
| --- | --- |
| `progress_percent` must be 0-100 | `ck_progress_entries_percent_range` |
| `quantity` on a material request must be positive | `ck_material_requests_quantity_positive` |
| `file_size_bytes` on a photo must be positive | `ck_photos_file_size_positive` |
| One `daily_logs` row per project per day | `uq_daily_logs_project_id_log_date` |
| A photo is always tied to a `project_id` **and** a `zone_id` (both `NOT NULL`) — the literal Fase 4 exit criterion | column constraints, not a trigger |

## Fase 5 — quality-gate (Wave 8)

Staff-only, like `contracts`/`milestones` (Fase 1) — no project role, field
or client-facing, appears anywhere in this section at all. Unlike Fase 4's
field-reporting tables (`site_coordinator`/`mandor` get real SELECT/INSERT/
UPDATE access), inspections are something QS/Technical Director record
about the field, not something the field records about itself.

| Table | Owner/TD/Finance/QS/Procurement | Any project role |
| --- | --- | --- |
| `hold_point_templates` | CRUD\* (org) | — |
| `inspections` | CRUD\* (org) | — |
| `nonconformities` | CRUD\* (org) | — |

\* "CRUD" here means SELECT/INSERT/UPDATE — no DELETE policy exists for
anyone, same as every other table in this document; soft delete
(`deleted_at`) is the removal path.

### What is deliberately absent

**No project role at all — not even `site_coordinator`/`mandor`.** ADR
0014's own reasoning: recording whether a hold point passed is a QS
judgment call about the field, not something the field reports about
itself the way a daily log or a photo is. A mandor sees the *consequence*
(a blocked work package, surfaced through `getWorkPackageProceedStatusAction`
in the Command Center UI they'd need to ask about), never the `inspections`
row directly.

### Column-level and cross-row rules RLS cannot express

| Rule | Enforced by |
| --- | --- |
| A required hold point must have a passing or overridden inspection before its own work package may move to `in_progress` | `trg_work_packages_guard_hold_point` |
| That check is independent of Cash Gate's own — either can block the same transition on its own, and neither's passing opens the other | `trg_work_packages_guard_hold_point` + the pre-existing `trg_work_packages_guard_cash_gate` (Fase 2), two separate triggers on the same event |
| `inspections.overridden_by` must belong to a `technical_director` | `fn_inspections_guard_td_only_override` |

`requirePermission()` for `inspection.override` lists only
`technical_director` — the friendly Indonesian refusal for everyone else.
`fn_inspections_guard_td_only_override` is what actually holds regardless of
what the application layer decided (CLAUDE.md law 0.3's two independent
layers), the identical split ADR 0010 already established for
`cash_gate_overrides`.

## Fase 6 — client-portal (Wave 8)

`client_decisions` (ADR 0016) is the only table this module owns. Staff see
every decision across their org; `client_approver`/`client_viewer` see only
their own project's rows. No INSERT/UPDATE/DELETE policy exists for anyone —
same "append-only, written only by a trigger" shape as `audit_logs`: the
sole writer is `fn_change_orders_sync_client_decision`, which runs
`security definer` on `change_orders` (owned by scope-variation).

| Table | Owner/TD/Finance/QS/Procurement | `client_approver` / `client_viewer` |
| --- | --- | --- |
| `client_decisions` | SELECT (org) | SELECT (own project only) |

### vw_client_* views

The four views this module reads from (`vw_client_project_overview`,
`vw_client_zone_progress`, `vw_client_timeline_event`,
`vw_client_progress_photo`) have no RLS policies of their own — views
cannot have policies. Each is declared `security_invoker = true`, so access
is gated entirely by RLS on the tables underneath, checked as the calling
user:

| View | Gated by (underlying table policy) |
| --- | --- |
| `vw_client_project_overview` | `projects_select_member`, `contracts_select_client` (new this wave — `contracts` had no client-facing SELECT policy until Fase 6 needed the contract value) |
| `vw_client_zone_progress` | `zones_select_member` (progress_entries/work_packages joined in are not filtered by role — the view only ever surfaces an aggregate number, never a raw row) |
| `vw_client_timeline_event` | `milestones_select_client` (new this wave, same reason as `contracts_select_client`) + `client_decisions_select_client` |
| `vw_client_progress_photo` | `photos_select_client` (new this wave — `photos` previously only had staff/field-role SELECT policies) |

### Column-level and cross-row rules RLS cannot express

| Rule | Enforced by |
| --- | --- |
| `client_decisions.decision` is set if and only if `decided_at` is set | `ck_client_decisions_decision_requires_decided_at` |
| `client_decisions` stays in sync with `change_orders.status` without a second state machine | `fn_change_orders_sync_client_decision` |
| Exactly one of `change_order_id`/`proposal_id`/`handover_signoff` is set — never more than one, never none | `ck_client_decisions_exactly_one_source` (post-implementation review fix, C1; extended to 3-way, Phase 3 F6) |
| `client_decisions` stays in sync with `proposals.status` the same way it mirrors `change_orders.status` | `fn_proposals_sync_client_decision` (post-implementation review fix, C1 — see Fase 8 below) |
| A pending handover sign-off opens the moment a project first reaches `status = 'completed'` | `fn_projects_sync_handover_signoff_decision` (Phase 3, F6 — fires on the same event `fn_projects_sync_warranties_on_completion` already does) |
| A client_approver's UPDATE of a `handover_signoff` row may only touch `decision`/`decided_at`/`decided_by`/`decision_reason` | `fn_client_decisions_guard_client_columns` (Phase 3, F6) |

### Post-implementation review fix — proposal decisions also mirror through `client_decisions` (C1, ADR 0026 §7 item 7)

F1 originally had client-portal's app routes import `@/modules/estimating` directly (`getProposalAction`, `listProposalsForProjectAction`, `clientDecideProposalAction`) — a direct violation of ARCHITECTURE.md 1.2's F25 rule ("client-portal tidak boleh mengimpor cash-gate atau estimating secara langsung"), found in a post-implementation review. `client_decisions.proposal_id` (nullable FK, mirroring `change_order_id` exactly — Wave 8's own comment on that column anticipated this) plus `fn_proposals_sync_client_decision` (mirroring `fn_change_orders_sync_client_decision`) close the read side: client-portal now only ever reads `client_decisions`, never `proposals`.

For the one write client-portal must still cause (a client's own accept/reject), `fn_client_decide_proposal` (Fase 8, see below) is a plain (non-`security definer`) RPC — a named database procedure called by string identifier, not a TypeScript import across the boundary. `proposals_update_client` RLS and `trg_proposals_guard_transition`/`trg_proposals_guard_client_columns` (all built for F1) keep enforcing exactly as before, checked against the calling client's own session, completely unchanged.

### Phase 3 (F6) — handover sign-off, `client_decisions`' first client-writable row shape

A handover has no single source row the way `change_order_id`/`proposal_id`
point to one (a project's handover is one moment, not one row per
`handover_items` entry) — `handover_signoff` is a boolean discriminator
against the row's own `project_id` instead of a fourth nullable FK.
`decided_by`/`decision_reason` are new columns on `client_decisions` itself
(populated only for `handover_signoff` rows) because, unlike change_order/
proposal decisions, there is no source table already storing who decided
and why.

`client_decisions_update_client` is `client_decisions`' first-ever
client-writable RLS policy — every other row is closed by a source-table
sync trigger, never by a direct client UPDATE of `client_decisions` itself.
Scoped narrowly: `handover_signoff` rows only, `client_approver` only.
`fn_client_decisions_guard_client_columns` is the column-level restriction
underneath (same "coarse RLS + precise trigger" split as
`fn_proposals_guard_client_columns`). `fn_client_accept_handover` is the
plain (non-`security definer`) RPC `modules/client-portal`'s own action
calls — mirroring `fn_client_decide_proposal` exactly, since
`client_decisions` is already owned by `client-portal`, there is no other
module to avoid importing here; the RPC exists purely so the action never
issues a raw `.from('client_decisions').update(...)` for a row shape this
narrow and security-sensitive.

## Fase 7 — billing (Wave 8/9)

| Table | Owner/Finance | Other org roles | `client_approver` / `client_viewer` |
| --- | --- | --- | --- |
| `invoices` | CRUD\* (org) | SELECT (org) | SELECT (own project, `status <> 'draft'` only) |
| `payments` | SELECT/INSERT (org) | SELECT (org) | SELECT (via own project's non-draft invoices) |

\* "CRUD" here means SELECT/INSERT/UPDATE — no DELETE policy exists for
anyone, same as every other table in this document; soft delete
(`deleted_at`) is the removal path. `payments` additionally has no UPDATE
policy for anyone — a recorded payment is a fact, corrected (if ever
needed) by a new row, not an edit.

No margin/cost-breakdown columns exist on either table at all, so
ARCHITECTURE.md 2.4's "tanpa kolom margin" requirement for the client-visible
row is satisfied trivially, not by a separate view.

### Column-level and cross-row rules RLS cannot express

| Rule | Enforced by |
| --- | --- |
| An invoice may transition to `issued` only when its milestone is `completed`, every required hold point across the milestone's work packages has passed or been overridden, its linked variation (if any) is `approved_funded`, and it carries a Technical Director's approval | `fn_invoices_guard_issuance` |
| `invoices.approved_by` must belong to a `technical_director` | `fn_invoices_guard_issuance` (checked the same way `fn_inspections_guard_td_only_override`, Fase 5, checks `overridden_by`) |
| An issued invoice mirrors itself into `funding_receipts` (so an overdue unpaid invoice is simply an overdue uncleared funding receipt to the existing, unmodified Fase 2 Cash Gate) | `fn_invoices_sync_funding_receipt` |
| Once payments against an invoice reach its full amount, the invoice is marked `paid` and its mirrored `funding_receipts` row is cleared | `fn_payments_sync_invoice_paid` |

`requirePermission()` for `invoice.issue` lists only `technical_director` —
the friendly Indonesian refusal for everyone else. `fn_invoices_guard_issuance`
is what actually holds regardless of what the application layer decided
(CLAUDE.md law 0.3's two independent layers).

## Fase 8 — crm/assessment (Wave 2-4, ADR 0018)

Staff-only, like Fase 5's quality-gate tables — no project role, field or
client-facing policy exists for any table in this section. Leads,
procurement master data, and pre-sale assessments are internal/sales
concerns, not something a client portal or SiteFlow role reaches.

| Table | Owner/TD/Finance/QS/Procurement | Any project role | Client |
| --- | --- | --- | --- |
| `leads` | CRUD\* (org) | — | — |
| `vendors` | CRUD\* (org) | — | — |
| `cost_library` | CRUD\* (org) | — | — |
| `assessments` | CRUD\* (org) | — | — |

\* "CRUD" here means SELECT/INSERT/UPDATE — no DELETE policy exists for
anyone, same as every other table in this document; soft delete
(`deleted_at`) is the removal path.

### Column-level and cross-row rules RLS cannot express

| Rule | Enforced by |
| --- | --- |
| A lead's status may only follow the pipeline graph (`new -> contacted -> qualified -> assessment_scheduled -> proposal_sent -> won`, `lost` reachable from any stage before `won`) | `fn_leads_guard_transition`, mirrored by `modules/crm/domain/lead-transition.ts`'s `transition()` |
| `leads.lost_reason` must be set whenever `status = 'lost'` | `ck_leads_lost_reason_requires_lost` |
| `assessments.status = 'completed'` requires both `assessed_by` and `assessed_at` to be set | `ck_assessments_completed_requires_assessor` |
| An assessment linked to a lead has its `project_id` backfilled once, automatically, the moment that lead's own `project_id` is first set by `convertLeadToProjectAction` | `fn_leads_sync_assessment_project` (an `AFTER UPDATE OF project_id` trigger on `leads`, writing into `assessments` -- the fourth instance of the cross-module-via-SQL-trigger pattern, after `work_packages`/`change_orders`, `change_orders`/`client_decisions`, and `invoices`/`funding_receipts`) |
| `organizations.margin_floor_bp` (added this wave, additive column) has no RLS implication of its own -- it is read wherever `organizations` already is, gated by the existing `organizations_select_member` policy | n/a |

`requirePermission()` for `lead.convert` and `assessment.complete` list
every org role (`[...ORG_ROLES]`) -- neither is role-restricted the way
`invoice.issue` (Fase 7) is, since converting a lead or completing an
assessment is a workflow-progress action available to any staff member, not
a money/approval gate.

## Fase 8 — estimating (Wave 5-6, ADR 0018)

Staff-only, same treatment as the rest of Fase 8 — no project role, field, or
client-facing policy exists for `estimates`/`estimate_items`. **`proposals` is
the one exception, added in Fase 12** (ADR 0026 §5 amendment, F1) — see below.

| Table | Owner/TD/Finance/QS/Procurement | Any project role | Client |
| --- | --- | --- | --- |
| `estimates` | CRUD\* (org) | — | — |
| `estimate_items` | CRUD\* (org) | — | — |
| `proposals` | CRUD\* (org) | — | `client_approver`/`client_viewer`: SELECT once `status <> 'draft'`; `client_approver` also UPDATE, restricted to their own decision columns (Fase 12, see below) |

\* "CRUD" here means SELECT/INSERT/UPDATE — no DELETE policy exists for
anyone, same as every other table in this document; soft delete
(`deleted_at`) is the removal path.

### Column-level and cross-row rules RLS cannot express

| Rule | Enforced by |
| --- | --- |
| At most one estimate per `(project_id, version)` | `uq_estimates_project_version` |
| At most one baseline estimate per project — a database fact, not application discipline | `uq_estimates_one_baseline_per_project` (partial unique index on `is_baseline where true`) |
| Swapping which estimate is the baseline is atomic (unset the old one, set the new one, in one transaction) | `fn_set_baseline_estimate` — an RPC, not a plain PostgREST update, but it carries no security definer, so `estimates_update_staff` is still the policy actually gating who may call it |
| At most one proposal per estimate | `uq_proposals_estimate_id` |
| A non-draft proposal must have `sent_at` set | `ck_proposals_sent_requires_sent_at` |
| A decided proposal (`accepted`/`rejected`) must have its decision tracking columns set | `ck_proposals_decision_requires_decided_at` |

`requirePermission()` for `estimate.set_baseline`, `proposal.send`, and
`proposal.decide` all list every org role (`[...ORG_ROLES]`) — none of these
is a money/approval gate the way `invoice.issue` is; they are workflow-progress
actions available to any staff member.

### Fase 12 amendment — `proposals` client accept/decline (F1, ADR 0026 §5)

`proposals_select_client` (SELECT, `client_approver`/`client_viewer`, scoped
to `status <> 'draft'`) and `proposals_update_client` (UPDATE,
`client_approver` only) mirror `change_orders`' own client-facing pair
exactly (Wave 7). Two DB-layer guards underneath, same two-layer enforcement
as every other approval in this system (CLAUDE.md law §0.3):

| Rule | Enforced by |
| --- | --- |
| Status only ever moves draft→sent→accepted/rejected, for staff and a client_approver alike | `fn_proposals_guard_transition` (added this phase — proposals had no DB-layer transition guard at all before a client could reach this table) |
| A client_approver's UPDATE may only touch `status`/`decided_at`/`decided_by`/`decision_reason`, never `client_summary`, `estimate_id`, or any other field | `fn_proposals_guard_client_columns` |

`proposal.client_decide` (`requirePermission`, `client_approver` only) is the
application-layer check for the client's own accept/reject action, distinct
from staff-side `proposal.decide` (records a decision made outside the
system on the client's behalf) — same split as `change_order`'s `decide` vs
`client_approve`/`client_reject`.

### Post-implementation review fix — `fn_client_decide_proposal` + `fn_proposals_sync_estimate_status` (C1, ADR 0026 §7 item 7)

F1's `clientDecideProposalAction` originally lived in `modules/estimating`,
imported directly by client-portal — a boundary violation (ARCHITECTURE.md
1.2, F25). Replaced by:

- **`fn_client_decide_proposal(p_proposal_id, p_decision, p_reason)`** —
  a plain (non-`security definer`) RPC, called from `modules/client-portal`'s
  own action via `supabase.rpc(...)`, never a TypeScript import. Does exactly
  what the removed TS action did (an `UPDATE ... RETURNING`), so
  `proposals_update_client` RLS and both guard triggers above still enforce
  everything, unchanged, checked against the calling client_approver's own
  session. Raises `no_data_found` if its own UPDATE affects zero rows
  (RLS-invisible row, or a transition the guard trigger would refuse) rather
  than the silent no-op a raw filtered UPDATE gives — this RPC is now the
  only path a client_approver has to attempt a decision, so an explicit
  refusal is better UX than a quiet no-op.
- **`fn_proposals_sync_estimate_status`** — an `AFTER UPDATE OF status` trigger
  on `proposals`, `security definer`. `sendProposalAction`/`decideProposalAction`
  (staff) already called `updateEstimate()` explicitly to keep `estimates.status`
  in sync (ADR 0018 SS4-SS5); a client_approver has no write access to
  `estimates` at all, so this trigger is what keeps that sync working
  regardless of which path changed `proposals.status`.

## Fase 8 — procurement (Wave 2-3, 7-9, ADR 0018 SS6)

Staff-only, same treatment as the rest of Fase 8. `vendors` already appears
in the crm/assessment section above (it shipped in the same wave as
`leads`/`cost_library`); the three tables below are what procurement itself
owns on top of that master data.

| Table | Owner/TD/Finance/QS/Procurement | Any project role | Client |
| --- | --- | --- | --- |
| `vendor_quotes` | CRUD\* (org) | — | — |
| `purchase_orders` | SELECT, INSERT (org) | — | — |
| `deliveries` | CRUD\* (org) | — | — |

\* "CRUD" here means SELECT/INSERT/UPDATE — no DELETE policy exists for
anyone, same as every other table in this document; soft delete
(`deleted_at`) is the removal path. `purchase_orders` has no application-level
`update` action (a PO is the issuance itself, ADR 0018 SS6, no status to
transition) even though its RLS policy set includes UPDATE like every other
table here — the matrix being stricter than the policy is the safe direction
(CLAUDE.md law 0.3).

### Column-level and cross-row rules RLS cannot express

| Rule | Enforced by |
| --- | --- |
| A `purchase_orders` INSERT is blocked outright under a red/overdue Cash Gate unless a matching `cash_gate_overrides` row (`action = 'issue_po'`) exists from the last 5 minutes | `fn_purchase_orders_guard_cash_gate`, a `BEFORE INSERT` trigger mirroring `fn_work_packages_guard_cash_gate` (Wave 7) exactly |
| Recording the override and issuing the PO happens atomically, in one transaction | `fn_override_and_issue_purchase_order` — no security definer, so RLS and `trg_cash_gate_overrides_guard_owner_only` both still apply to the calling user |

`requirePermission()` for `purchase_order.create` lists every org role
(`[...ORG_ROLES]`) — the DB trigger is what actually enforces the gate
regardless of role (CLAUDE.md law 0.3's two independent layers), the same
"coarse matrix, precise trigger" split as `work_package`. Issuing under a
red/overdue gate goes through `cash_gate_override.create` instead (owner
only), not a separate `purchase_order` action — identical to how
`overrideOpenWorkPackageAction` is gated in modules/cash-gate.

## Fase 9 — maintenance-engine (Wave 9-10, ADR 0019)

Staff-only through Fase 9 itself (no Facility Passport client view in that
phase, ADR 0019 SS4). **Phase 3 milestone 3.1 (F4) adds client policies to
four of the five tables** — see the amendment below.

| Table | Owner/TD/Finance/QS/Procurement | Any project role | Client |
| --- | --- | --- | --- |
| `handover_items` | SELECT, INSERT (org) | — | `client_approver`/`client_viewer`: SELECT (own project, Phase 3) |
| `warranties` | CRUD\* (org) | — | `client_approver`/`client_viewer`: SELECT (own project, Phase 3) |
| `assets` | CRUD\* (org) | — | `client_approver`/`client_viewer`: SELECT (own client, Phase 3) |
| `maintenance_plans` | CRUD\* (org) | — | — |
| `service_tickets` | CRUD\* (org) | — | `client_approver`/`client_viewer`: SELECT (own client); `client_approver` also INSERT (Phase 3) |

\* "CRUD" here means SELECT/INSERT/UPDATE — no DELETE policy exists for
anyone, same as every other table in this document; soft delete
(`deleted_at`) is the removal path. `handover_items` has no application-level
`update` action (staff correct a mistaken entry by adding a new one, not
editing history) even though its RLS policy set includes UPDATE like every
other table here — the matrix being stricter than the policy is the safe
direction (CLAUDE.md law 0.3).

### Column-level and cross-row rules RLS cannot express

| Rule | Enforced by |
| --- | --- |
| The moment a project first reaches `status = 'completed'`, one `warranties` row is inserted per `handover_items` row on that project that plausibly needs one (`'key'`/`'as_built_drawing'` excluded) | `fn_projects_sync_warranties_on_completion`, an `AFTER UPDATE OF status` trigger on `projects` — the fifth instance of the cross-module-sync-trigger pattern (after `work_packages`/`change_orders`, `change_orders`/`client_decisions`, `invoices`/`funding_receipts`, `leads`/`assessments`) |
| A service ticket's status may only follow `open -> in_progress -> resolved`, cancellable from `open` or `in_progress` | `fn_service_tickets_guard_transition`, mirrored by `modules/maintenance-engine/domain/service-ticket-transition.ts`'s `transition()` |
| `service_tickets.status = 'resolved'` requires `resolved_at` to be set | `ck_service_tickets_resolved_requires_resolved_at` |
| `warranties.ends_at` must not be before `starts_at` | `ck_warranties_ends_after_starts` |
| `photos.handover_item_id`/`photos.photo_stage` (added this wave, additive nullable columns, ADR 0019 SS8) have no RLS implication of their own — read wherever `photos` already is, gated by Fase 4's existing policies | n/a |

`requirePermission()` for every action in this section lists every org role
(`[...ORG_ROLES]`) — none of this phase's mechanisms are money/approval
gates the way Cash Gate or invoice issuance are; `next_due_date`/`overdue`
(ADR 0019 SS5) are computed advisory values, not something RLS or a trigger
enforces.

### Phase 3 amendment — client visibility + client-originated service tickets (F4)

`warranties`/`handover_items` carry `project_id` — their client policies
(`warranties_select_client`, `handover_items_select_client`) mirror
`proposals_select_client` exactly. `assets`/`service_tickets` carry no
`project_id` at all (Facility Passport deliberately outlives a single
project, Wave 9's own header comment) — `fn_client_has_role_for_client(client_id,
roles)` is the client_id-scoped equivalent of `fn_has_project_role`, checking
`project_members` joined through `projects.client_id` instead of a project a
client is a member of directly.

`service_tickets_insert_client`'s `with check` is the column-level
restriction RLS alone cannot express for an INSERT: a client-reported ticket
must land `status = 'open'`, `reported_by = auth.uid()`, and
`assigned_to`/`maintenance_plan_id`/`warranty_id` all null — a client can
never claim their own ticket is already assigned, scheduled, or linked to a
warranty at creation time. `service_ticket.client_create` (`requirePermission`,
`client_approver` only) is the matching application-layer check —
`client_viewer` may read but not report.

None of these four tables needed a `client_decisions`-style mirror table the
way `proposals`/`change_orders` did — `maintenance-engine` is not one of the
two modules ARCHITECTURE.md 1.2 (F25) forbids client-portal from importing
directly (only `cash-gate`/`estimating` are), so client-portal reads these
through `modules/maintenance-engine`'s own public API directly, the same
shape `modules/billing`'s invoice visibility (F3) already uses.

## Fase 10 — ai-scribe (Wave 10, ADR 0020)

Staff-only. No project role or client surface reaches `ai_generations` --
same reasoning as every other Fase 8/9 table (no external-facing feature
exists yet), plus this table specifically is a cost ledger, not something
any UI outside the Command Center has a reason to read.

| Table | Owner/TD/Finance/QS/Procurement | Any project role | Client |
| --- | --- | --- | --- |
| `ai_generations` | SELECT, INSERT (org) | — | — |

No DELETE or UPDATE policy for anyone — append-only, same shape as
`audit_logs` (a generation is never edited after the fact; a wrong cost
estimate is a bug to fix in `claude-client.ts`'s pricing table, not a row to
correct).

### Column-level and cross-row rules RLS cannot express

| Rule | Enforced by |
| --- | --- |
| An organization's total `ai_generations.cost_amount` this calendar month must be under `AI_MONTHLY_BUDGET_CAP` before a new Claude API call is made | `isOverBudget()` (`modules/ai-scribe/domain/budget-cap.ts`), checked in the action layer before the call — not a DB constraint, since the cap is a soft, correctable-later placeholder number (ADR 0020 SS4), not a money/approval rule needing CLAUDE.md law 0.3's two-layer enforcement |
| Neither `generateIssueClassificationAction` nor `generateDelayDetectionAction` writes to `issues`, `milestones`, or any table this module does not itself own | Architectural, not RLS-enforced: `modules/ai-scribe`'s own `data/` layer only ever calls `.from('ai_generations')` — see `supabase/tests/ai-scribe.test.ts`'s explicit before/after row-count assertion, the "(dites eksplisit)" ARCHITECTURE.md §7's exit criterion itself asks for |

`requirePermission()` for `ai_generation.create` lists every org role
(`[...ORG_ROLES]`) — running a generation is a workflow-assist action
available to any staff member, not a money/approval gate; the budget cap
above is what actually limits spend, not the permission matrix.

## Fase 11 — partner-desk (Wave 11, ADR 0024)

Adds `vendor_users` (owned by modules/procurement — it links users to
vendors, the same "owning module" reasoning as `clients` owning
`client_users`) and additive supplier-scoped SELECT policies on
`vendor_quotes`/`purchase_orders`/`deliveries` (Fase 8's tables, unchanged
otherwise). Subcontractor gets nothing this phase — no `subcontractors`
business entity or work-assignment column exists anywhere in the schema, and
Fase 11's own feature line names only supplier-shaped data (ADR 0024 SS1).

| Table | Owner/TD/Finance/QS/Procurement | Supplier | Other project roles | Client |
| --- | --- | --- | --- | --- |
| `vendor_users` | SELECT, INSERT, DELETE (org) | SELECT (self only) | — | — |
| `vendor_quotes` | CRUD\* (org, unchanged) | SELECT (own `vendor_id` only) | — | — |
| `purchase_orders` | SELECT, INSERT (org, unchanged) | SELECT (own `vendor_id` only) | — | — |
| `deliveries` | CRUD\* (org, unchanged) | SELECT (own `vendor_id`, via `purchase_order_id`) | — | — |

A supplier's SELECT additionally requires
`fn_has_project_role(project_id, ARRAY['supplier'])` — being linked to a
vendor is not, by itself, enough to see that vendor's rows on a project the
supplier isn't a member of. The three `vw_partner_*` views
(`vw_partner_vendor_quotes`, `vw_partner_purchase_orders`,
`vw_partner_deliveries`) are `security_invoker = true`, same as every
`vw_client_*` view — these SELECT policies are the real gate, not the views.

Partner Desk's own read actions
(`modules/partner-desk/actions/partner-desk-actions.ts`) carry no
`permission` entry, the same "RLS on a security_invoker view is the real
gate, a matrix check here would add nothing" shape `client-portal-actions.ts`
already established (ADR 0016).

### Column-level and cross-row rules RLS cannot express

| Rule | Enforced by |
| --- | --- |
| A supplier never sees another vendor's `vendor_quotes`/`purchase_orders`/`deliveries`, even on a project where both are `supplier` members | The `vendor_users` join inside each `*_select_supplier` policy — `fn_has_project_role` alone only proves project membership, not which vendor a given supplier represents |
| `vw_partner_*` views never expose `notes`, `issued_by`, or `received_by` | Column list is hand-picked in each view's `SELECT`, not `SELECT *` (ARCHITECTURE.md 2.6) |

`inviteVendorUserAction` (modules/procurement) is the only way a
`vendor_users` row gets created outside a test factory; it uses the
service-role client (`core/auth/provision-external-user.ts`) to create the
`auth.users`/`users` rows first if they don't already exist, since Supabase
Auth requires a profile row to exist before a magic link can sign someone in
(`shouldCreateUser: false`, `core/auth/magic-link.ts`).

## Fase 12 — evidence + client_status (ADR 0026 Rev 2, ADR 0029)

Adds `modules/evidence` (`evidence`, `evidence_overrides`) and the Client
Project Status mechanism (`client_status_updates`, owned by
`modules/client-portal`).

| Table | Owner/TD/Finance/QS/Procurement | site_coordinator / mandor (own project) | `client_approver` / `client_viewer` |
| --- | --- | --- | --- |
| `evidence` | SELECT, INSERT, UPDATE (org) | SELECT, INSERT (own project) | SELECT, scoped to `visibility = 'client_visible'` (own project) |
| `evidence_overrides` | SELECT (org); INSERT restricted to `technical_director` only (ADR 0029 Decision 1, amended from Owner-only) | — | — |
| `client_status_updates` | SELECT (org); INSERT restricted to `owner`/`technical_director` (publish authority, ADR 0026 §7 item 3) | — | SELECT (own project, via `fn_has_project_role`) |

`evidence_overrides_guard_td_only` (a BEFORE INSERT trigger on
`evidence_overrides`) is a second, DB-layer enforcement of the
`technical_director`-only rule — CLAUDE.md law §0.3, mirroring the two-layer
pattern already used for Cash Gate and Quality Gate. `fn_override_evidence_gate`
is the only path that can insert into `evidence_overrides`; it also flips the
target `work_packages.status` to `completed` in the same transaction.

`fn_work_packages_guard_evidence` (BEFORE INSERT OR UPDATE on `work_packages`)
blocks a transition into `status = 'completed'` unless: the project isn't
client-facing yet (`isProjectClientFacing`, ADR 0029 Decision 2 — no active
contract), qualifying evidence already exists for that work package, or an
`evidence_overrides` row exists. `fn_photos_sync_evidence` (AFTER INSERT on
`photos`) auto-creates a matching `internal_only` evidence row, mapped by
priority `work_package_id > daily_log_id > handover_item_id`, skipped entirely
when only `zone_id` is set (ADR 0029 Decision 3).

### Column-level and cross-row rules RLS cannot express

| Rule | Enforced by |
| --- | --- |
| A `client_approver`/`client_viewer` never sees `evidence` rows below `visibility = 'client_visible'`, even on their own project | The `visibility` filter inside `evidence_select_client`, not a separate view |
| An override can only ever be attempted by a `technical_director` | Two layers: `core/permissions/matrix.ts`'s `evidence_override` resource (UI/action layer) and `fn_evidence_overrides_guard_td_only` (DB trigger layer) — CLAUDE.md law §0.3 |

## Later waves

Added as their tables land. A table may not reach main without a row here, its
policies, and its tests — CLAUDE.md law 6.
