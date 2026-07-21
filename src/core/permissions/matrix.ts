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
 * A role of `null` -- an external user with no organisation role -- is denied
 * everything here. That is correct: their access comes from project membership,
 * which arrives in Wave 4 and is checked separately.
 */
export function roleCan<TResource extends Resource>(
  role: Role | null | undefined,
  resource: TResource,
  action: ActionFor<TResource>,
): boolean {
  if (role === null || role === undefined) return false;

  const actions = PERMISSIONS[resource] as Record<string, readonly Role[]>;
  const allowed = actions[action as string];
  if (allowed === undefined) return false;

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
