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
 * Only Wave 1 resources are listed. Later phases add their own entries as their
 * tables arrive; declaring permissions for tables that do not exist would be
 * building ahead of the sequence (CLAUDE.md law 7).
 */

/** Internal staff roles, held on users.org_role. Mirrors the org_role enum. */
export const ORG_ROLES = ['owner', 'technical_director', 'finance', 'qs', 'procurement'] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

/** Per-project roles, held in project_members from Wave 4. Mirrors project_role. */
export const PROJECT_ROLES = [
  'site_coordinator',
  'mandor',
  'client_approver',
  'client_viewer',
  'supplier',
  'subcontractor',
] as const;
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
