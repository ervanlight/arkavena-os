/**
 * Variation (change order) domain types (ARCHITECTURE.md 4.3, ADR 0012).
 * Pure data -- no supabase, react, or next anywhere under domain/ (CLAUDE.md
 * law 2, enforced by ESLint), and no import from core/permissions either:
 * the actor's role arrives as a plain string, resolved by the repository/
 * action layer beforehand, never looked up by this pure function itself --
 * same reasoning modules/cash-gate/domain/types.ts's GateOverride already
 * documents for its own `byUserId` field.
 */

export type ChangeOrderStatus =
  | 'draft'
  | 'under_review'
  | 'awaiting_client_approval'
  | 'approved_unpaid'
  | 'approved_funded'
  | 'rejected'
  | 'completed';

export type ChangeOrderEvent =
  | 'submit_review'
  | 'send_to_client'
  | 'reject'
  | 'client_approve'
  | 'client_reject'
  | 'funding_received'
  | 'complete';

/**
 * Everything transition() needs to decide, besides the event and current
 * status. `actorRole` is deliberately a plain string (or null for an
 * external user with no org_role and no relevant project role) rather than
 * `core/permissions`'s `Role` type -- domain may not import core/permissions
 * (ARCHITECTURE.md 1.2).
 */
export type TransitionContext = {
  readonly actorRole: string | null;
  /** Present once QS/staff have filled in an estimate during under_review -- required before client_approve (ARCHITECTURE.md 4.3's guard). */
  readonly hasCostImpact: boolean;
  readonly hasScheduleImpact: boolean;
  /** Required for reject/client_reject/client_approve; ignored otherwise. */
  readonly reason?: string;
};

/**
 * Why a transition was refused. `kind` lets the action layer choose the
 * right ActionResult error code (VARIATION_INVALID_TRANSITION vs the
 * existing AUDIT_REASON_REQUIRED) without the domain layer knowing either
 * name -- core/errors is allowed here, but ERROR_CODES specifically is an
 * application-layer concern, not this pure function's.
 */
export type TransitionBlocked = {
  readonly kind: 'invalid_transition' | 'missing_reason';
  readonly reason: string;
};
