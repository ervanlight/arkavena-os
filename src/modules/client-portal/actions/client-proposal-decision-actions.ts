'use server';

import { getActionContext } from '@/core/auth/session';
import { safeAction } from '@/core/actions/safe-action';
import { createServerSupabase } from '@/core/db/client.server';
import { recordAudit } from '@/core/audit/audit';
import { createAuditGateway } from '@/core/audit/gateway.server';
import { clientDecideProposalSchema } from '../schemas';

/**
 * Post-implementation review fix (C1, ADR 0026 §7 item 7): F1 originally had
 * this action living in modules/estimating, imported directly by
 * client-portal's decide page -- exactly the "client-portal tidak boleh
 * mengimpor... estimating secara langsung" ARCHITECTURE.md 1.2 (F25)
 * forbids. `fn_client_decide_proposal` is a named database RPC, not a
 * TypeScript import across the boundary -- the same reasoning
 * modules/evidence's own fn_override_evidence_gate already established for
 * a cross-cutting mutation.
 *
 * The RPC itself is deliberately plain (security invoker): proposals_update_client
 * RLS and trg_proposals_guard_transition/trg_proposals_guard_client_columns
 * (all built for F1, unchanged) are what actually decide whether this
 * specific client_approver may decide this specific proposal -- this action
 * grants no privilege of its own, and the return value is narrowed to a
 * plain decision echo rather than the full `proposals` row, so no
 * estimating-shaped row type ever reaches client-facing code.
 */
export const clientDecideProposalAction = safeAction(
  {
    schema: clientDecideProposalSchema,
    permission: { resource: 'proposal', action: 'client_decide' },
    loadContext: getActionContext,
    name: 'clientPortal.clientDecideProposal',
    audience: 'external',
  },
  async (input, ctx): Promise<{ decision: 'accepted' | 'rejected' }> => {
    const supabase = await createServerSupabase();
    // The RPC's return type is the full `proposals` row (needed internally,
    // e.g. project_id for the audit entry below) -- never returned from
    // this action itself, which only ever exposes the narrow `{ decision }`
    // shape to client-facing code.
    // No `.single()` -- fn_client_decide_proposal returns a bare `proposals`
    // row (not `setof`), so PostgREST/supabase-js already returns one object,
    // not an array. Chaining `.single()` onto that (as
    // evidence-overrides-repository.ts's fn_override_evidence_gate call
    // also does) types the result as `never` the moment any field is read
    // off it -- a latent quirk that only surfaces when a caller accesses a
    // property instead of returning the whole object untouched.
    const { data, error } = await supabase.rpc('fn_client_decide_proposal', {
      p_proposal_id: input.proposalId,
      p_decision: input.decision,
      p_reason: input.reason,
    });

    if (error !== null) throw error;
    const projectId = data.project_id;

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'proposals',
      entityId: input.proposalId,
      action: input.decision === 'accepted' ? 'approve' : 'reject',
      reason: input.reason,
      previousValue: { status: 'sent' },
      newValue: { status: input.decision },
      projectId,
      requestId: ctx.requestId,
    });

    return { decision: input.decision };
  },
);
