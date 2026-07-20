import type { Enums } from './database.types';

/**
 * Enum constants, mirrored from Postgres (ARCHITECTURE.md 3.2).
 *
 * The `satisfies Record<Enums<'...'>, Enums<'...'>>` on each object is the
 * point of this whole file: it makes the values derive from the generated
 * `Database` type rather than duplicate it. Rename a value in the enum
 * migration, regenerate types, and a mismatch here is a compile error --
 * not a runtime surprise discovered when someone tests the renamed path.
 *
 * Deliberately not every Postgres enum has an entry: only the ones
 * TypeScript code needs to reference by name rather than just pass through.
 * A table's `status` column, for instance, usually flows straight from a
 * Zod schema without any code needing to spell out its members here.
 */

export const ORG_ROLE = {
  OWNER: 'owner',
  TECHNICAL_DIRECTOR: 'technical_director',
  FINANCE: 'finance',
  QS: 'qs',
  PROCUREMENT: 'procurement',
} satisfies Record<string, Enums<'org_role'>>;

export const PROJECT_ROLE = {
  SITE_COORDINATOR: 'site_coordinator',
  MANDOR: 'mandor',
  CLIENT_APPROVER: 'client_approver',
  CLIENT_VIEWER: 'client_viewer',
  SUPPLIER: 'supplier',
  SUBCONTRACTOR: 'subcontractor',
} satisfies Record<string, Enums<'project_role'>>;

export const USER_STATUS = {
  INVITED: 'invited',
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
} satisfies Record<string, Enums<'user_status'>>;

export const ORGANIZATION_STATUS = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
} satisfies Record<string, Enums<'organization_status'>>;

export const AUDIT_ACTION = {
  INSERT: 'insert',
  UPDATE: 'update',
  STATUS_CHANGE: 'status_change',
  DELETE: 'delete',
  APPROVE: 'approve',
  REJECT: 'reject',
  OVERRIDE: 'override',
  LOGIN: 'login',
} satisfies Record<string, Enums<'audit_action'>>;

/** Actions that require a non-empty reason -- mirrors the check constraint on audit_logs. */
export const AUDIT_ACTIONS_REQUIRING_REASON = [
  AUDIT_ACTION.OVERRIDE,
  AUDIT_ACTION.APPROVE,
  AUDIT_ACTION.REJECT,
] as const;

export const NOTIFICATION_CHANNEL = {
  IN_APP: 'in_app',
  EMAIL: 'email',
} satisfies Record<string, Enums<'notification_channel'>>;

export const NOTIFICATION_STATUS = {
  PENDING: 'pending',
  SENT: 'sent',
  READ: 'read',
  FAILED: 'failed',
} satisfies Record<string, Enums<'notification_status'>>;

// ---------------------------------------------------------------------------
// Fase 1 (modules/crm, modules/projects)
// ---------------------------------------------------------------------------

export const PROJECT_STATUS = {
  PLANNING: 'planning',
  IN_PROGRESS: 'in_progress',
  ON_HOLD: 'on_hold',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} satisfies Record<string, Enums<'project_status'>>;

export const CONTRACT_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  TERMINATED: 'terminated',
} satisfies Record<string, Enums<'contract_status'>>;

export const MILESTONE_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
} satisfies Record<string, Enums<'milestone_status'>>;

export const WORK_PACKAGE_STATUS = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
} satisfies Record<string, Enums<'work_package_status'>>;
