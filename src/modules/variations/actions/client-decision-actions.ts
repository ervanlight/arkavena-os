'use server';

import { AuditReasonRequiredError, DomainRuleError } from '@/core/errors/app-error';
import { ERROR_CODES } from '@/core/errors/codes';
import { recordAudit } from '@/core/audit/audit';
import { createAuditGateway } from '@/core/audit/gateway.server';
import { getActionContext } from '@/core/auth/session';
import { safeAction } from '@/core/actions/safe-action';
import { createServerSupabase, type ServerSupabase } from '@/core/db/client.server';
import type { ActionContext } from '@/core/permissions/guard';
import { getMyProjectRole } from '@/modules/projects/server';
import { transition } from '../domain/transition';
import type { TransitionBlocked } from '../domain/types';
import { getChangeOrder, updateChangeOrder } from '../data/change-orders-repository';
import { changeOrderReasonSchema } from '../schemas';
import type { ChangeOrder } from '../types';

/**
 * requirePermission() below now passes for a client_approver thanks to
 * roleCan()'s null-role deferral to RLS (ADR 0013) -- it did not when this
 * module was first written, which is why resolveActorRole still exists here
 * rather than being removed: requirePermission() only ever returns a
 * boolean ("is this call allowed"), never *which* role the caller is acting
 * as, and transition()'s own guard needs that actual role string to decide
 * between e.g. a client_approver and an owner. RLS
 * (change_orders_select_client_approver / change_orders_update_client_approver)
 * and trg_change_orders_guard_client_columns remain the real enforcement
 * underneath both checks.
 */
async function resolveActorRole(supabase: ServerSupabase, ctx: ActionContext, projectId: string): Promise<string | null> {
  if (ctx.orgRole !== null) return ctx.orgRole;
  return getMyProjectRole(supabase, projectId, ctx.userId);
}

function throwTransitionBlocked(blocked: TransitionBlocked): never {
  if (blocked.kind === 'missing_reason') {
    throw new AuditReasonRequiredError(blocked.reason, { userMessage: blocked.reason });
  }
  throw new DomainRuleError(ERROR_CODES.VARIATION_INVALID_TRANSITION, blocked.reason, { userMessage: blocked.reason });
}

export const clientApproveChangeOrderAction = safeAction(
  {
    schema: changeOrderReasonSchema,
    permission: { resource: 'change_order', action: 'client_approve' },
    loadContext: getActionContext,
    name: 'scopeVariation.clientApproveChangeOrder',
    audience: 'external',
  },
  async (input, ctx): Promise<ChangeOrder> => {
    const supabase = await createServerSupabase();
    const before = await getChangeOrder(supabase, input.id);
    const actorRole = await resolveActorRole(supabase, ctx, before.project_id);

    const decision = transition(before.status, 'client_approve', {
      actorRole,
      hasCostImpact: before.cost_impact_amount !== null,
      hasScheduleImpact: before.schedule_impact_days !== null,
      reason: input.reason,
    });
    if (!decision.ok) throwTransitionBlocked(decision.error);

    const after = await updateChangeOrder(supabase, input.id, {
      status: decision.value,
      client_approved_by: ctx.userId,
      client_approved_at: new Date().toISOString(),
      client_approved_reason: input.reason,
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'change_orders',
      entityId: after.id,
      action: 'approve',
      reason: input.reason,
      previousValue: { status: before.status },
      newValue: { status: after.status },
      projectId: after.project_id,
      requestId: ctx.requestId,
    });

    return after;
  },
);

export const clientRejectChangeOrderAction = safeAction(
  {
    schema: changeOrderReasonSchema,
    permission: { resource: 'change_order', action: 'client_reject' },
    loadContext: getActionContext,
    name: 'scopeVariation.clientRejectChangeOrder',
    audience: 'external',
  },
  async (input, ctx): Promise<ChangeOrder> => {
    const supabase = await createServerSupabase();
    const before = await getChangeOrder(supabase, input.id);
    const actorRole = await resolveActorRole(supabase, ctx, before.project_id);

    const decision = transition(before.status, 'client_reject', {
      actorRole,
      hasCostImpact: before.cost_impact_amount !== null,
      hasScheduleImpact: before.schedule_impact_days !== null,
      reason: input.reason,
    });
    if (!decision.ok) throwTransitionBlocked(decision.error);

    const after = await updateChangeOrder(supabase, input.id, {
      status: decision.value,
      rejected_by: ctx.userId,
      rejected_at: new Date().toISOString(),
      rejected_reason: input.reason,
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'change_orders',
      entityId: after.id,
      action: 'reject',
      reason: input.reason,
      previousValue: { status: before.status },
      newValue: { status: after.status },
      projectId: after.project_id,
      requestId: ctx.requestId,
    });

    return after;
  },
);
