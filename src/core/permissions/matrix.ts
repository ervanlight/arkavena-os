/**
 * The permission matrix -- the single source of truth for who may do what
 * (ARCHITECTURE.md 6.2, CLAUDE.md 7).
 *
 * Three enforcers read this one file:
 *
 *   1. RLS policies in the database. The real enforcement. `pnpm gen:rls-check`
 *      compares this matrix against pg_policies and fails CI if they diverge,
 *      so the two cannot drift apart unnoticed.
 *   2. requirePermission() in every server action. This layer exists to produce
 *      a friendly Indonesian error rather than a bare RLS refusal.
 *   3. can() in the UI, to hide buttons. Cosmetic only -- never security.
 *
 * Adding a role means editing this file and running gen:rls-check, not hunting
 * for `if (role === ...)` across forty components.
 *
 * Wave 1 and Fase 1 (ARCHITECTURE.md 7) resources are listed. Later phases add
 * their own entries as their tables arrive; declaring permissions for tables
 * that do not exist would be building ahead of the sequence (CLAUDE.md law 7).
 *
 * Fase 1's project-scoped resources (project, project_member, zone,
 * work_package) list PROJECT_ROLES alongside ORG_ROLES for `view`, but that is
 * only ever "this role type is in the right ballpark" -- roleCan() has no
 * project id to check against, so it cannot and does not decide whether a
 * given mandor may see a given project. That instance-level decision is
 * fn_has_project_role()'s alone, enforced in the database. This matrix's
 * `view` entry existing at all is what lets the UI show a "Projects" nav item
 * to a project role without every entry point special-casing it -- cosmetic,
 * same as every other UI use of this matrix.
 *
 * That paragraph describes the intent; roleCan() below is what actually
 * carries it out. ActionContext.orgRole (core/auth/session.ts) is sourced
 * from users.org_role and is NULL for every external/project-role-only user
 * (mandor, site_coordinator, client_approver, client_viewer, supplier,
 * subcontractor) -- they hold no org role at all, only rows in
 * project_members. When roleCan() sees a null role, it does not have a
 * project id to decide the instance-level question with, so it defers to
 * whatever this matrix says about project roles in general: if ANY project
 * role is listed for the resource/action, that is this matrix's own
 * statement that project roles are "in the right ballpark" for it, and
 * roleCan() returns true and leaves the real per-project answer to RLS
 * (fn_has_project_role(), enforcer 1). If NO project role is listed --
 * contract, milestone, audit_log, and the other staff-only resources -- a
 * null role is still denied outright, same as before. See ADR 0013.
 */

import type { Enums } from '@/core/db/database.types';

/**
 * Internal staff roles, held on users.org_role. `satisfies readonly
 * Enums<'org_role'>[]` is what ARCHITECTURE.md 3.2 means by deriving from the
 * generated type rather than duplicating it: a role renamed in the enum
 * migration makes this a compile error rather than a role that silently stops
 * matching anything in the database. `satisfies` catches a wrong or
 * misspelled value here; it cannot catch a value missing from this list
 * entirely -- that direction is asserted at the database level, by the seed
 * test that checks these keys against the enum in both directions.
 */
export const ORG_ROLES = [
  'owner',
  'technical_director',
  'finance',
  'qs',
  'procurement',
] as const satisfies readonly Enums<'org_role'>[];
export type OrgRole = (typeof ORG_ROLES)[number];

/** Per-project roles, held in project_members from Wave 4. Mirrors project_role. */
export const PROJECT_ROLES = [
  'site_coordinator',
  'mandor',
  'client_approver',
  'client_viewer',
  'supplier',
  'subcontractor',
] as const satisfies readonly Enums<'project_role'>[];
export type ProjectRole = (typeof PROJECT_ROLES)[number];

export type Role = OrgRole | ProjectRole;

export const ALL_ROLES: readonly Role[] = [...ORG_ROLES, ...PROJECT_ROLES];

/**
 * The matrix. Resource -> action -> the roles allowed.
 *
 * An empty array is meaningful and different from a missing entry: it means the
 * action exists but no role may perform it through the application. `roles` is
 * the example -- it changes only by migration.
 */
export const PERMISSIONS = {
  organization: {
    view: ['owner', 'technical_director', 'finance', 'qs', 'procurement'],
    update: ['owner'],
  },

  user: {
    view: ['owner', 'technical_director', 'finance', 'qs', 'procurement'],
    /** Anyone may edit their own profile; this covers editing someone else's. */
    update: ['owner'],
    /** Changing a role is privilege escalation, so it is owner-only and audited. */
    change_role: ['owner'],
    invite: ['owner'],
  },

  role: {
    view: [...ORG_ROLES, ...PROJECT_ROLES],
    // Deliberately empty. Roles are reference data; they change by migration.
    manage: [],
  },

  audit_log: {
    /**
     * Internal staff only. External roles are absent on purpose: the audit
     * trail records internal decisions and is not part of what a client sees.
     */
    view: ['owner', 'technical_director', 'finance', 'qs', 'procurement'],
  },

  notification: {
    /** Everyone reads their own; the RLS policy scopes it to the recipient. */
    view: [...ORG_ROLES, ...PROJECT_ROLES],
    mark_read: [...ORG_ROLES, ...PROJECT_ROLES],
  },

  // -------------------------------------------------------------------------
  // Fase 1 (modules/crm, modules/projects)
  // -------------------------------------------------------------------------

  client: {
    /** Any staff role -- clients_{select,insert,update}_staff make no further distinction. */
    view: [...ORG_ROLES],
    create: [...ORG_ROLES],
    update: [...ORG_ROLES],
  },

  site: {
    view: [...ORG_ROLES],
    create: [...ORG_ROLES],
    update: [...ORG_ROLES],
  },

  project: {
    /** Staff see every project in their organisation; a project role sees only their own (fn_has_project_role). */
    view: [...ORG_ROLES, ...PROJECT_ROLES],
    create: [...ORG_ROLES],
    update: [...ORG_ROLES],
  },

  project_member: {
    view: [...ORG_ROLES, ...PROJECT_ROLES],
    /**
     * Named `add`, not `invite` -- this assigns an existing user a role on a
     * project, unlike user.invite (provisioning a brand new person into the
     * organisation), and the two need different ACTION_COMMANDS treatment in
     * gen:rls-check: user.invite deliberately has no policy, this one does.
     */
    add: [...ORG_ROLES],
    update: [...ORG_ROLES],
    remove: [...ORG_ROLES],
  },

  zone: {
    view: [...ORG_ROLES, ...PROJECT_ROLES],
    create: [...ORG_ROLES],
    update: [...ORG_ROLES],
  },

  contract: {
    /**
     * Staff only -- no project-role entry. contract_amount is money
     * ARCHITECTURE.md 2.6 keeps away from client-facing reads; the client
     * portal (Fase 6) reads a vw_client_* view, never this table.
     */
    view: [...ORG_ROLES],
    create: [...ORG_ROLES],
    update: [...ORG_ROLES],
  },

  milestone: {
    /** Same reasoning as contract: amount is money, staff only. */
    view: [...ORG_ROLES],
    create: [...ORG_ROLES],
    update: [...ORG_ROLES],
  },

  work_package: {
    /** No money figure here, unlike contract/milestone -- a project role reading their own assignment is safe. */
    view: [...ORG_ROLES, ...PROJECT_ROLES],
    create: [...ORG_ROLES],
    update: [...ORG_ROLES],
  },

  // -------------------------------------------------------------------------
  // Fase 2 (modules/cash-gate)
  // -------------------------------------------------------------------------

  funding_receipt: {
    /** Same reasoning as contract/milestone: money, staff only. */
    view: [...ORG_ROLES],
    create: [...ORG_ROLES],
    /** Finance marking a receipt cleared (owner decision D5) is an update. */
    update: [...ORG_ROLES],
  },

  cash_forecast: {
    view: [...ORG_ROLES],
    create: [...ORG_ROLES],
  },

  cash_gate_override: {
    /** Any staff may read the override history -- see the RLS policy comment. */
    view: [...ORG_ROLES],
    /**
     * RLS lets any staff member's insert attempt through; the real
     * restriction is trg_cash_gate_overrides_guard_owner_only, which raises
     * unless the caller is an owner (ADR 0010). Listing only 'owner' here is
     * what lets requirePermission() give a friendly Indonesian refusal instead
     * of a bare Postgres exception -- the trigger stays the actual authority
     * either way (CLAUDE.md 0.3's two layers), so this is not a case of the
     * matrix and the policy disagreeing about who is *allowed*, only about
     * which layer produces the error first.
     */
    create: ['owner'],
  },

  /** Moved off `projects` by ADR 0011 -- see that ADR for why it could not stay a `projects` column. */
  project_risk_reserve: {
    view: [...ORG_ROLES],
    update: [...ORG_ROLES],
  },

  // -------------------------------------------------------------------------
  // Fase 3 (modules/scope-variation)
  // -------------------------------------------------------------------------

  /**
   * `client_approve`/`client_reject` are reachable by a `client_approver`,
   * who holds no org_role -- roleCan()'s null-role deferral (ADR 0013) is
   * what makes requirePermission() actually pass for them here, rather than
   * this module needing its own bypass. RLS
   * (change_orders_select_client_approver /
   * change_orders_update_client_approver) and transition()'s own role guard
   * are still what decide the real per-project, per-event question.
   */
  change_order: {
    view: [...ORG_ROLES, 'client_approver'],
    create: [...ORG_ROLES],
    /** setChangeOrderImpactAction -- filling in the cost/schedule estimate. */
    update: [...ORG_ROLES],
    submit_review: [...ORG_ROLES],
    /** send_to_client and the staff-side reject -- ARCHITECTURE.md 6.2's own example name. */
    review: ['owner', 'technical_director', 'qs'],
    mark_funded: ['owner', 'finance'],
    complete: ['owner', 'technical_director', 'qs', 'procurement'],
    client_approve: ['client_approver'],
    client_reject: ['client_approver'],
  },

  // -------------------------------------------------------------------------
  // Fase 4 (modules/field-reporting)
  //
  // Only site_coordinator/mandor among project roles ever pass RLS on these
  // five tables (CLAUDE.md 7: "Role eksternal tidak pernah akses tabel
  // internal") -- client_approver, client_viewer, supplier, and
  // subcontractor see nothing here. That is why only the two field roles
  // are named below, not the full PROJECT_ROLES spread every Fase 1
  // resource above uses. roleCan()'s null-role deferral (ADR 0013) still
  // lets any project-role-only caller through the *matrix* layer
  // regardless of which specific roles are named here -- naming just these
  // two does not tighten what requirePermission() actually allows, only
  // what this file documents as the intended grant. The real per-role
  // filtering is RLS's alone, same as everywhere else in this matrix.
  // -------------------------------------------------------------------------

  daily_log: {
    view: [...ORG_ROLES, 'site_coordinator', 'mandor'],
    create: [...ORG_ROLES, 'site_coordinator', 'mandor'],
    update: [...ORG_ROLES, 'site_coordinator', 'mandor'],
  },

  progress_entry: {
    view: [...ORG_ROLES, 'site_coordinator', 'mandor'],
    create: [...ORG_ROLES, 'site_coordinator', 'mandor'],
    update: [...ORG_ROLES, 'site_coordinator', 'mandor'],
  },

  photo: {
    view: [...ORG_ROLES, 'site_coordinator', 'mandor'],
    create: [...ORG_ROLES, 'site_coordinator', 'mandor'],
    update: [...ORG_ROLES, 'site_coordinator', 'mandor'],
  },

  material_request: {
    view: [...ORG_ROLES, 'site_coordinator', 'mandor'],
    create: [...ORG_ROLES, 'site_coordinator', 'mandor'],
    /** requested -> fulfilled/cancelled. Named for the specific transition, not a free-form field update -- an already-submitted request's content does not change, only its status. */
    update_status: [...ORG_ROLES, 'site_coordinator', 'mandor'],
  },

  issue: {
    view: [...ORG_ROLES, 'site_coordinator', 'mandor'],
    create: [...ORG_ROLES, 'site_coordinator', 'mandor'],
    /** open -> resolved, stamping resolved_by/resolved_at. */
    resolve: [...ORG_ROLES, 'site_coordinator', 'mandor'],
  },

  // -------------------------------------------------------------------------
  // Fase 5 (modules/quality-gate)
  //
  // Staff-only, like contracts/milestones (Fase 1) -- no project role
  // appears anywhere in this section. This is an internal QC mechanism
  // QS/Technical Director operate, not something a field or client role
  // ever reaches.
  // -------------------------------------------------------------------------

  hold_point_template: {
    view: [...ORG_ROLES],
    create: [...ORG_ROLES],
    update: [...ORG_ROLES],
  },

  inspection: {
    view: [...ORG_ROLES],
    create: [...ORG_ROLES],
    update: [...ORG_ROLES],
    /**
     * ARCHITECTURE.md 4.4: "Override teknis hanya oleh Technical Director".
     * fn_inspections_guard_td_only_override (ADR 0014's migration) is the
     * real, unbypassable check; this is only the friendly Indonesian
     * refusal for everyone else, same two-layer split as
     * cash_gate_override.create/owner.
     */
    override: ['technical_director'],
  },

  nonconformity: {
    view: [...ORG_ROLES],
    create: [...ORG_ROLES],
    resolve: [...ORG_ROLES],
  },

  // -------------------------------------------------------------------------
  // Fase 6 (modules/client-portal)
  //
  // client_decisions is the only table this module owns (ADR 0016) -- staff
  // can see the full decision log, client_approver/client_viewer see their
  // own project's rows (RLS: client_decisions_select_client). The four
  // vw_client_* views the portal also reads have no resource entry here:
  // they carry no permission-matrix-checkable action of their own (a plain
  // SELECT with no create/update/delete), same "available to any signed-in
  // user, RLS on the underlying tables is what actually gates it" shape as
  // listMyFieldProjectsAction/getMyProjectRolesAction.
  // -------------------------------------------------------------------------

  client_decision: {
    view: [...ORG_ROLES, 'client_approver', 'client_viewer'],
  },

  // -------------------------------------------------------------------------
  // Fase 7 (modules/billing)
  //
  // ARCHITECTURE.md 6.2's own illustrative example for this resource lists
  // `approve: ['owner']` -- written before Fase 7's real design existed.
  // ADR 0017 requires Technical Director approval specifically (the exit
  // criterion's literal "persetujuan TD"), mirroring
  // fn_inspections_guard_td_only_override's shape (Fase 5) -- `issue` here
  // is that approval and the status transition together, done by a TD in
  // one action, so `issue` lists only `technical_director`, superseding the
  // doc's placeholder rather than the other way around.
  // -------------------------------------------------------------------------

  invoice: {
    view: [...ORG_ROLES, 'client_approver', 'client_viewer'],
    create: ['owner', 'finance'],
    issue: ['technical_director'],
    cancel: ['owner', 'finance'],
  },

  payment: {
    view: [...ORG_ROLES, 'client_approver', 'client_viewer'],
    create: ['owner', 'finance'],
  },

  // -------------------------------------------------------------------------
  // Fase 8 (modules/crm, modules/assessment, modules/estimating, modules/procurement)
  //
  // Staff-only across the board, no project role appears anywhere in this
  // section -- these are internal sales/estimating/procurement tools, the
  // same shape quality-gate (Fase 5) already established for "an internal
  // mechanism, not something a field or client role ever reaches."
  // `lead.convert` lists the same roles as `project.create` deliberately
  // (convertLeadToProjectAction calls createProjectAction, ADR 0018 SS2) --
  // anyone who can convert a lead can also create the project it produces,
  // so the nested action's own permission check never surprises the caller.
  // -------------------------------------------------------------------------

  lead: {
    view: [...ORG_ROLES],
    create: [...ORG_ROLES],
    update: [...ORG_ROLES],
    convert: [...ORG_ROLES],
  },

  vendor: {
    view: [...ORG_ROLES],
    create: [...ORG_ROLES],
    update: [...ORG_ROLES],
  },

  cost_library: {
    view: [...ORG_ROLES],
    create: [...ORG_ROLES],
    update: [...ORG_ROLES],
  },

  assessment: {
    view: [...ORG_ROLES],
    create: [...ORG_ROLES],
    update: [...ORG_ROLES],
    complete: [...ORG_ROLES],
  },

  estimate: {
    view: [...ORG_ROLES],
    create: [...ORG_ROLES],
    update: [...ORG_ROLES],
    set_baseline: [...ORG_ROLES],
  },

  estimate_item: {
    view: [...ORG_ROLES],
    create: [...ORG_ROLES],
    update: [...ORG_ROLES],
  },

  proposal: {
    view: [...ORG_ROLES],
    create: [...ORG_ROLES],
    send: [...ORG_ROLES],
    decide: [...ORG_ROLES],
  },
} as const satisfies PermissionMatrix;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PermissionMatrix = Record<string, Record<string, readonly Role[]>>;

export type Resource = keyof typeof PERMISSIONS;
export type ActionFor<TResource extends Resource> = keyof (typeof PERMISSIONS)[TResource];

/**
 * Can this role perform this action?
 *
 * Pure and synchronous, so both the server guard and the UI hook ask the same
 * function rather than each re-deriving the answer.
 *
 * A role of `null` -- a project-role-only user, who holds no org role --
 * cannot be checked against `allowed` directly, because `allowed` names
 * *specific* roles and this function has no project id to know which one, if
 * any, this caller holds on the project actually being touched. Two cases:
 *
 *   - No project role appears in `allowed` at all (contract, milestone,
 *     audit_log, ...): nothing here is ever reachable by a project role, so
 *     null is denied outright, same as before this deferred branch existed.
 *   - At least one project role appears in `allowed` (project, work_package,
 *     change_order, ...): this matrix has already said project roles belong
 *     in the right ballpark for this resource/action, so roleCan() returns
 *     true and steps back. The actual per-project answer -- does *this* user
 *     hold *that* role on *that* project -- is fn_has_project_role()'s alone,
 *     enforced by RLS underneath. See the file-level comment and ADR 0013.
 */
export function roleCan<TResource extends Resource>(
  role: Role | null | undefined,
  resource: TResource,
  action: ActionFor<TResource>,
): boolean {
  const actions = PERMISSIONS[resource] as Record<string, readonly Role[]>;
  const allowed = actions[action as string];
  if (allowed === undefined) return false;

  if (role === null || role === undefined) {
    return allowed.some((candidate) => isProjectRole(candidate));
  }

  return allowed.includes(role);
}

/** Every role permitted to perform an action. Used by gen:rls-check. */
export function rolesAllowedTo<TResource extends Resource>(
  resource: TResource,
  action: ActionFor<TResource>,
): readonly Role[] {
  const actions = PERMISSIONS[resource] as Record<string, readonly Role[]>;
  return actions[action as string] ?? [];
}

export function isOrgRole(role: string): role is OrgRole {
  return (ORG_ROLES as readonly string[]).includes(role);
}

export function isProjectRole(role: string): role is ProjectRole {
  return (PROJECT_ROLES as readonly string[]).includes(role);
}
