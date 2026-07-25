import { z } from 'zod';

export const publishClientStatusSchema = z.object({
  projectId: z.string().uuid(),
  status: z.enum(['on_track', 'waiting_client_decision', 'external_dependency', 'schedule_adjustment', 'completed']),
  headline: z.string().trim().min(1, 'Ringkasan wajib diisi').max(300),
  detail: z.string().trim().max(2000).optional(),
});
export type PublishClientStatusInput = z.infer<typeof publishClientStatusSchema>;

/**
 * Post-implementation review fix (C1, ADR 0026 §7 item 7): shaped identically
 * to modules/estimating's own decideProposalSchema, but defined locally
 * rather than imported -- client-portal must never import from
 * `@/modules/estimating` at all (ARCHITECTURE.md 1.2, F25). A four-line Zod
 * shape duplicated once is the accepted cost of that boundary, the same
 * trade-off modules/evidence/domain already made for EvidenceActivityTable.
 */
export const clientDecideProposalSchema = z.object({
  proposalId: z.string().uuid(),
  decision: z.enum(['accepted', 'rejected']),
  reason: z.string().trim().min(1, 'Alasan wajib diisi').max(2000),
});
export type ClientDecideProposalInput = z.infer<typeof clientDecideProposalSchema>;

/** Phase 3 (F6): a client_approver's own handover accept/reject, via fn_client_accept_handover. */
export const clientAcceptHandoverSchema = z.object({
  clientDecisionId: z.string().uuid(),
  decision: z.enum(['approved', 'rejected']),
  reason: z.string().trim().min(1, 'Alasan wajib diisi').max(2000),
});
export type ClientAcceptHandoverInput = z.infer<typeof clientAcceptHandoverSchema>;
