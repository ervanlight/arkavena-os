import { err, ok, type Result } from '@/core/errors/result';
import type { ChangeOrderEvent, ChangeOrderStatus, TransitionBlocked, TransitionContext } from './types';

/**
 * The Variation state machine (ARCHITECTURE.md 4.3, ADR 0012).
 *
 * Declared as data, not scattered if-else, per ARCHITECTURE.md 4.3's own
 * instruction -- extended from its example shape
 * (`Record<Status, Partial<Record<Event, Status>>>`) to carry each edge's
 * guard requirements alongside the destination status, since "who may do
 * this" and "what must already be true" are exactly the things ARCHITECTURE.md
 * 4.5 asks the unit tests to cover.
 */

/**
 * "Any staff" for submit_review -- listed explicitly rather than as a null
 * sentinel. A null/skipped check would have let an external actor (no
 * org_role, e.g. a client_approver) submit a draft for review, which is
 * exactly the "wrong role" case ARCHITECTURE.md 4.5's unit tests exist to
 * catch. core/permissions' ORG_ROLES can't be imported here (domain
 * boundary), so this list is repeated rather than derived -- same tradeoff
 * ADR 0012 already accepts for actorRole being a plain string.
 */
const ANY_STAFF_ROLES = ['owner', 'technical_director', 'finance', 'qs', 'procurement'] as const;
const REVIEW_ROLES = ['owner', 'technical_director', 'qs'] as const;
const COMPLETE_ROLES = ['owner', 'technical_director', 'qs', 'procurement'] as const;
const FUNDING_ROLES = ['owner', 'finance'] as const;
const CLIENT_APPROVER_ONLY = ['client_approver'] as const;

type TransitionRule = {
  readonly next: ChangeOrderStatus;
  readonly allowedRoles: readonly string[];
  readonly requiresReason: boolean;
  readonly requiresImpact: boolean;
};

const TRANSITIONS: Record<ChangeOrderStatus, Partial<Record<ChangeOrderEvent, TransitionRule>>> = {
  draft: {
    submit_review: { next: 'under_review', allowedRoles: ANY_STAFF_ROLES, requiresReason: false, requiresImpact: false },
  },
  under_review: {
    send_to_client: {
      next: 'awaiting_client_approval',
      allowedRoles: REVIEW_ROLES,
      requiresReason: false,
      requiresImpact: false,
    },
    reject: { next: 'rejected', allowedRoles: REVIEW_ROLES, requiresReason: true, requiresImpact: false },
  },
  awaiting_client_approval: {
    client_approve: {
      next: 'approved_unpaid',
      allowedRoles: CLIENT_APPROVER_ONLY,
      requiresReason: true,
      requiresImpact: true,
    },
    client_reject: {
      next: 'rejected',
      allowedRoles: CLIENT_APPROVER_ONLY,
      requiresReason: true,
      requiresImpact: false,
    },
  },
  approved_unpaid: {
    funding_received: {
      next: 'approved_funded',
      allowedRoles: FUNDING_ROLES,
      requiresReason: false,
      requiresImpact: false,
    },
  },
  approved_funded: {
    complete: { next: 'completed', allowedRoles: COMPLETE_ROLES, requiresReason: false, requiresImpact: false },
  },
  rejected: {},
  completed: {},
};

/**
 * Decide the next status for one event, or refuse with a reason.
 *
 * Guard order matters for the message a user sees: an unauthorised role
 * hears about that first, before being told to fill in an estimate they may
 * not even be allowed to see the effect of; a missing reason is checked last
 * since every other precondition already held by that point.
 */
export function transition(
  current: ChangeOrderStatus,
  event: ChangeOrderEvent,
  ctx: TransitionContext,
): Result<ChangeOrderStatus, TransitionBlocked> {
  const rule = TRANSITIONS[current][event];

  if (rule === undefined) {
    return err({
      kind: 'invalid_transition',
      reason: `Variation berstatus "${current}" tidak bisa menerima aksi "${event}".`,
    });
  }

  if (ctx.actorRole === null || !rule.allowedRoles.includes(ctx.actorRole)) {
    return err({
      kind: 'invalid_transition',
      reason: `Peran Anda tidak berwenang melakukan aksi "${event}" pada variation ini.`,
    });
  }

  if (rule.requiresImpact && (!ctx.hasCostImpact || !ctx.hasScheduleImpact)) {
    return err({
      kind: 'invalid_transition',
      reason: 'Dampak biaya dan dampak jadwal harus diisi sebelum klien bisa menyetujui variation ini.',
    });
  }

  if (rule.requiresReason && (ctx.reason === undefined || ctx.reason.trim() === '')) {
    return err({
      kind: 'missing_reason',
      reason: 'Alasan wajib diisi untuk tindakan ini.',
    });
  }

  return ok(rule.next);
}
