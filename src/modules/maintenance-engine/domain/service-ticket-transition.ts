import { err, ok, type Result } from '@/core/errors/result';

/**
 * The service ticket state machine (ARCHITECTURE.md 7, ADR 0019 SS6) --
 * the domain-layer half of the same two-layer split every other state
 * machine in this codebase uses (leads, change_orders): this pure function
 * lets the action turn an illegal move into an ActionResult before any
 * database write is attempted, while fn_service_tickets_guard_transition
 * mirrors the same graph as the real, unbypassable enforcement underneath.
 *
 * Deliberately small -- this is not Cash Gate or Variation-scale complexity
 * (ADR 0019 SS6): no role-gating, no cost/schedule impact, just the graph
 * shape itself.
 */

export type ServiceTicketStatus = 'open' | 'in_progress' | 'resolved' | 'cancelled';

export type ServiceTicketTransitionBlocked = {
  readonly reason: string;
};

const TRANSITIONS: Record<ServiceTicketStatus, readonly ServiceTicketStatus[]> = {
  open: ['in_progress', 'cancelled'],
  in_progress: ['resolved', 'cancelled'],
  resolved: [],
  cancelled: [],
};

export function transition(
  current: ServiceTicketStatus,
  next: ServiceTicketStatus,
): Result<ServiceTicketStatus, ServiceTicketTransitionBlocked> {
  if (!TRANSITIONS[current].includes(next)) {
    return err({
      reason: `Transisi status tiket servis dari "${current}" ke "${next}" tidak diperbolehkan.`,
    });
  }

  return ok(next);
}
