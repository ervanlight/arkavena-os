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

// ---------------------------------------------------------------------------
// Fase 2 (modules/cash-gate)
// ---------------------------------------------------------------------------

/** Mirrors fn_cash_gate_status's return type exactly -- see ADR 0009. */
export const CASH_GATE_STATUS = {
  GREEN: 'green',
  YELLOW: 'yellow',
  RED: 'red',
  OVERDUE: 'overdue',
} satisfies Record<string, Enums<'cash_gate_status'>>;

/** Mirrors evaluateGateAction's action union (ARCHITECTURE.md 4.2). */
export const CASH_GATE_ACTION = {
  ISSUE_PO: 'issue_po',
  OPEN_WORK_PACKAGE: 'open_work_package',
  MOBILIZE_SUB: 'mobilize_sub',
  START_VARIATION: 'start_variation',
  ORDER_MATERIAL: 'order_material',
} satisfies Record<string, Enums<'cash_gate_action'>>;

// ---------------------------------------------------------------------------
// Fase 3 (modules/scope-variation)
// ---------------------------------------------------------------------------

/** Mirrors the TRANSITIONS graph in modules/scope-variation/domain/transition.ts (ARCHITECTURE.md 4.3, ADR 0012). */
export const CHANGE_ORDER_STATUS = {
  DRAFT: 'draft',
  UNDER_REVIEW: 'under_review',
  AWAITING_CLIENT_APPROVAL: 'awaiting_client_approval',
  APPROVED_UNPAID: 'approved_unpaid',
  APPROVED_FUNDED: 'approved_funded',
  REJECTED: 'rejected',
  COMPLETED: 'completed',
} satisfies Record<string, Enums<'change_order_status'>>;

// ---------------------------------------------------------------------------
// Fase 4 (modules/field-reporting)
// ---------------------------------------------------------------------------

export const MATERIAL_REQUEST_STATUS = {
  REQUESTED: 'requested',
  FULFILLED: 'fulfilled',
  CANCELLED: 'cancelled',
} satisfies Record<string, Enums<'material_request_status'>>;

export const ISSUE_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
} satisfies Record<string, Enums<'issue_severity'>>;

export const ISSUE_STATUS = {
  OPEN: 'open',
  RESOLVED: 'resolved',
} satisfies Record<string, Enums<'issue_status'>>;

// ---------------------------------------------------------------------------
// Fase 5 (modules/quality-gate)
// ---------------------------------------------------------------------------

export const INSPECTION_STATUS = {
  PENDING: 'pending',
  PASSED: 'passed',
  FAILED: 'failed',
} satisfies Record<string, Enums<'inspection_status'>>;

// ---------------------------------------------------------------------------
// Fase 6 (modules/client-portal)
// ---------------------------------------------------------------------------

export const CLIENT_DECISION_OUTCOME = {
  APPROVED: 'approved',
  REJECTED: 'rejected',
} satisfies Record<string, Enums<'client_decision_outcome'>>;

// ---------------------------------------------------------------------------
// Fase 7 (modules/billing)
// ---------------------------------------------------------------------------

/** No "overdue" member -- computed at read time, not stored (ADR 0017 SS1). */
export const INVOICE_STATUS = {
  DRAFT: 'draft',
  ISSUED: 'issued',
  PAID: 'paid',
  CANCELLED: 'cancelled',
} satisfies Record<string, Enums<'invoice_status'>>;

// ---------------------------------------------------------------------------
// Fase 8 (modules/crm, modules/assessment, modules/estimating, modules/procurement)
// ---------------------------------------------------------------------------

/** Mirrors the TRANSITIONS graph in modules/crm/domain/lead-transition.ts (ADR 0018). */
export const LEAD_STATUS = {
  NEW: 'new',
  CONTACTED: 'contacted',
  QUALIFIED: 'qualified',
  ASSESSMENT_SCHEDULED: 'assessment_scheduled',
  PROPOSAL_SENT: 'proposal_sent',
  WON: 'won',
  LOST: 'lost',
} satisfies Record<string, Enums<'lead_status'>>;
