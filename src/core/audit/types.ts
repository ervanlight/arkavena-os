/**
 * Audit types (ARCHITECTURE.md 5.2, CLAUDE.md 6).
 *
 * The interesting work here is done by the type system: an override or approval
 * that reaches this layer without a reason must not compile. Catching it at
 * runtime would mean the audit gap is discovered by whoever tries to explain,
 * six months later, why a Cash Gate override has no recorded justification.
 */

/**
 * Mirrors the Postgres `audit_action` enum. Kept as a literal union rather than
 * imported from generated types because core/audit must be usable before the
 * database types are generated, and a mismatch is caught by a db test that
 * compares this list against the enum in both directions.
 */
export type AuditAction =
  | 'insert'
  | 'update'
  | 'status_change'
  | 'delete'
  | 'approve'
  | 'reject'
  | 'override'
  | 'login';

/**
 * The actions that cannot be recorded without a reason.
 *
 * These are the three where "what changed" is not the interesting part -- the
 * interesting part is why a human decided to allow it. ARCHITECTURE.md 5.2
 * makes the reason mandatory; this is where that becomes a compiler rule.
 */
export const REASON_REQUIRED_ACTIONS = ['override', 'approve', 'reject'] as const;

export type ReasonRequiredAction = (typeof REASON_REQUIRED_ACTIONS)[number];

export function requiresReason(action: AuditAction): action is ReasonRequiredAction {
  return (REASON_REQUIRED_ACTIONS as readonly string[]).includes(action);
}

/** Fields common to every audit entry. */
type AuditEntryBase = {
  /** The table the change happened in, e.g. 'change_orders'. */
  entityTable: string;
  /** The row's id. */
  entityId: string;
  /** Only the columns that changed -- a diff, not the whole row. */
  previousValue?: Readonly<Record<string, unknown>>;
  newValue?: Readonly<Record<string, unknown>>;
  /** Set when the change belongs to a project, so the trail can be filtered by one. */
  projectId?: string;
  /** Ties this entry to the request that caused it, and to the structured log. */
  requestId?: string;
};

/**
 * An audit entry.
 *
 * The conditional type is the whole point: for 'override', 'approve' and
 * 'reject', `reason` is required and cannot be omitted. For everything else it
 * is optional.
 *
 *   recordAudit({ action: 'override', ... })                  // compile error
 *   recordAudit({ action: 'override', reason: 'kas ...', ...}) // fine
 */
export type AuditEntry<TAction extends AuditAction = AuditAction> = AuditEntryBase & {
  action: TAction;
} & (TAction extends ReasonRequiredAction ? { reason: string } : { reason?: string });

/**
 * The port core/audit writes through.
 *
 * Declared as an interface so the audit rules -- the reason requirement, the
 * diffing -- can be unit tested without a database, and so nothing in the
 * modules can reach the audit table by any other route.
 */
export interface AuditGateway {
  write(entry: {
    entityTable: string;
    entityId: string;
    action: AuditAction;
    previousValue: Record<string, unknown>;
    newValue: Record<string, unknown>;
    reason: string | null;
    requestId: string | null;
    projectId: string | null;
  }): Promise<string>;
}
