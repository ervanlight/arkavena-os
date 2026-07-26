'use server';

import { getActionContext } from '@/core/auth/session';
import { safeAction } from '@/core/actions/safe-action';
import { createServerSupabase } from '@/core/db/client.server';
import { recordAudit } from '@/core/audit/audit';
import { createAuditGateway } from '@/core/audit/gateway.server';
import { clientAcceptHandoverSchema } from '../schemas';

/**
 * Phase 3 (F6): a client_approver's own handover sign-off, via
 * fn_client_accept_handover -- mirrors client-proposal-decision-actions.ts's
 * fn_client_decide_proposal call exactly, a named database RPC rather than
 * a TypeScript import (there is no other module to import from here in the
 * first place: client_decisions is client-portal's own table, and this is
 * the one row-shape it is allowed to write to directly per
 * client_decisions_update_client RLS).
 */
export const clientAcceptHandoverAction = safeAction(
  {
    schema: clientAcceptHandoverSchema,
    permission: { resource: 'client_decision', action: 'accept_handover' },
    loadContext: getActionContext,
    name: 'clientPortal.clientAcceptHandover',
    audience: 'external',
  },
  async (input, ctx): Promise<{ decision: 'approved' | 'rejected' }> => {
    const supabase = await createServerSupabase();
    // No `.single()` -- fn_client_accept_handover returns a bare
    // `client_decisions` row (not `setof`), same reasoning as
    // fn_client_decide_proposal's own call.
    const { data, error } = await supabase.rpc('fn_client_accept_handover', {
      p_client_decision_id: input.clientDecisionId,
      p_decision: input.decision,
      p_reason: input.reason,
    });

    if (error !== null) throw error;
    const projectId = data.project_id;

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'client_decisions',
      entityId: input.clientDecisionId,
      action: input.decision === 'approved' ? 'approve' : 'reject',
      reason: input.reason,
      previousValue: { decision: null },
      newValue: { decision: input.decision },
      projectId,
      requestId: ctx.requestId,
    });

    return { decision: input.decision };
  },
);
