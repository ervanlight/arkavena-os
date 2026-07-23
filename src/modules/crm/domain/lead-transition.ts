import { err, ok, type Result } from '@/core/errors/result';

/**
 * The lead pipeline state machine (ARCHITECTURE.md 8, ADR 0018 SS1) --
 * the domain-layer half of the same two-layer split already used for the
 * Variation state machine (modules/scope-variation/domain/transition.ts):
 * this pure function lets updateLeadStatusAction turn an illegal move into
 * an ActionResult before any database write is attempted, while
 * fn_leads_guard_transition (supabase/migrations/20260723010000_...) stays
 * the real, unbypassable enforcement underneath it.
 *
 * Unlike change_orders, a lead's next status arrives directly as a target
 * status (updateLeadStatusSchema's `status` field), not a named event --
 * there is no role-gating or cost/schedule-impact guard on this graph, only
 * the graph shape itself plus "lost requires a reason", so a plain
 * `Record<LeadStatus, readonly LeadStatus[]>` of legal destinations is
 * enough; an event-keyed table would be extra shape this graph doesn't need.
 */

export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'assessment_scheduled'
  | 'proposal_sent'
  | 'won'
  | 'lost';

export type LeadTransitionContext = {
  /** Required when `next` is `'lost'`; ignored otherwise. */
  readonly lostReason?: string;
};

export type LeadTransitionBlocked = {
  readonly kind: 'invalid_transition' | 'missing_reason';
  readonly reason: string;
};

const FORWARD_STAGES: readonly LeadStatus[] = [
  'new',
  'contacted',
  'qualified',
  'assessment_scheduled',
  'proposal_sent',
  'won',
];

/** Every stage before `won` can also die as `lost` (ADR 0018 SS1). */
const LOSABLE_FROM: readonly LeadStatus[] = [
  'new',
  'contacted',
  'qualified',
  'assessment_scheduled',
  'proposal_sent',
];

function legalNextStatuses(current: LeadStatus): readonly LeadStatus[] {
  const forwardIndex = FORWARD_STAGES.indexOf(current);
  const next: LeadStatus[] = [];

  if (forwardIndex !== -1 && forwardIndex + 1 < FORWARD_STAGES.length) {
    next.push(FORWARD_STAGES[forwardIndex + 1]!);
  }
  if (LOSABLE_FROM.includes(current)) {
    next.push('lost');
  }

  return next;
}

export function transition(
  current: LeadStatus,
  next: LeadStatus,
  ctx: LeadTransitionContext,
): Result<LeadStatus, LeadTransitionBlocked> {
  if (!legalNextStatuses(current).includes(next)) {
    return err({
      kind: 'invalid_transition',
      reason: `Transisi status lead dari "${current}" ke "${next}" tidak diperbolehkan.`,
    });
  }

  if (next === 'lost' && (ctx.lostReason === undefined || ctx.lostReason.trim() === '')) {
    return err({
      kind: 'missing_reason',
      reason: 'Alasan wajib diisi saat menandai lead sebagai hilang.',
    });
  }

  return ok(next);
}
