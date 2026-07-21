'use server';

import { z } from 'zod';
import { toRupiah } from '@/core/money/rupiah';
import { AuditReasonRequiredError, DomainRuleError } from '@/core/errors/app-error';
import { ERROR_CODES } from '@/core/errors/codes';
import { recordAudit } from '@/core/audit/audit';
import { createAuditGateway } from '@/core/audit/gateway.server';
import { getActionContext } from '@/core/auth/session';
import { safeAction } from '@/core/actions/safe-action';
import { createServerSupabase } from '@/core/db/client.server';
import type { ActionContext } from '@/core/permissions/guard';
import { transition } from '../domain/transition';
import type { TransitionBlocked } from '../domain/types';
import {
  getChangeOrder,
  insertChangeOrder,
  listChangeOrdersForProject,
  updateChangeOrder,
} from '../data/change-orders-repository';
import { changeOrderReasonSchema, createChangeOrderSchema, setChangeOrderImpactSchema } from '../schemas';
import type { ChangeOrder } from '../types';

/**
 * Maps a refused transition() to the right ActionResult error (ARCHITECTURE.md
 * 4.1's intended flow: the domain decides *before* any write is attempted,
 * rather than the database trigger's raised exception being the first thing
 * a user sees -- the gap noted in docs/error-codes.md that Fase 2's own
 * override path never closed).
 */
function throwTransitionBlocked(blocked: TransitionBlocked): never {
  if (blocked.kind === 'missing_reason') {
    throw new AuditReasonRequiredError(blocked.reason, { userMessage: blocked.reason });
  }
  throw new DomainRuleError(ERROR_CODES.VARIATION_INVALID_TRANSITION, blocked.reason, { userMessage: blocked.reason });
}

export const createChangeOrderAction = safeAction(
  {
    schema: createChangeOrderSchema,
    permission: { resource: 'change_order', action: 'create' },
    loadContext: getActionContext,
    name: 'scopeVariation.createChangeOrder',
  },
  async (input, ctx): Promise<ChangeOrder> => {
    const supabase = await createServerSupabase();
    const changeOrder = await insertChangeOrder(supabase, {
      organization_id: ctx.organizationId,
      project_id: input.projectId,
      zone_id: input.zoneId ?? null,
      title: input.title,
      description: input.description ?? null,
      requested_by: ctx.userId,
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'change_orders',
      entityId: changeOrder.id,
      action: 'insert',
      newValue: { ...changeOrder, cost_impact_amount: changeOrder.cost_impact_amount?.toString() ?? null },
      projectId: changeOrder.project_id,
      requestId: ctx.requestId,
    });

    return changeOrder;
  },
);

/** QS/staff filling in the cost and schedule estimate -- an ordinary data update, not a state-machine event. */
export const setChangeOrderImpactAction = safeAction(
  {
    schema: setChangeOrderImpactSchema,
    permission: { resource: 'change_order', action: 'update' },
    loadContext: getActionContext,
    name: 'scopeVariation.setChangeOrderImpact',
  },
  async (input, ctx): Promise<ChangeOrder> => {
    const supabase = await createServerSupabase();
    const before = await getChangeOrder(supabase, input.id);

    const after = await updateChangeOrder(supabase, input.id, {
      cost_impact_amount: toRupiah(input.costImpactAmount),
      schedule_impact_days: input.scheduleImpactDays,
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'change_orders',
      entityId: after.id,
      action: 'update',
      previousValue: {
        cost_impact_amount: before.cost_impact_amount?.toString() ?? null,
        schedule_impact_days: before.schedule_impact_days,
      },
      newValue: {
        cost_impact_amount: after.cost_impact_amount?.toString() ?? null,
        schedule_impact_days: after.schedule_impact_days,
      },
      projectId: after.project_id,
      requestId: ctx.requestId,
    });

    return after;
  },
);

async function runStaffTransition(
  ctx: ActionContext,
  id: string,
  event: Parameters<typeof transition>[1],
  options: { reason?: string; patch?: Record<string, unknown> } = {},
): Promise<ChangeOrder> {
  const supabase = await createServerSupabase();
  const before = await getChangeOrder(supabase, id);

  const decision = transition(before.status, event, {
    actorRole: ctx.orgRole,
    hasCostImpact: before.cost_impact_amount !== null,
    hasScheduleImpact: before.schedule_impact_days !== null,
    ...(options.reason !== undefined ? { reason: options.reason } : {}),
  });

  if (!decision.ok) throwTransitionBlocked(decision.error);

  const after = await updateChangeOrder(supabase, id, { status: decision.value, ...options.patch });

  await recordAudit(createAuditGateway(supabase), {
    entityTable: 'change_orders',
    entityId: after.id,
    action: options.reason !== undefined ? 'reject' : 'status_change',
    ...(options.reason !== undefined ? { reason: options.reason } : {}),
    previousValue: { status: before.status },
    newValue: { status: after.status },
    projectId: after.project_id,
    requestId: ctx.requestId,
  });

  return after;
}

export const submitChangeOrderForReviewAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'change_order', action: 'submit_review' },
    loadContext: getActionContext,
    name: 'scopeVariation.submitChangeOrderForReview',
  },
  async (id, ctx): Promise<ChangeOrder> => runStaffTransition(ctx, id, 'submit_review'),
);

export const sendChangeOrderToClientAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'change_order', action: 'review' },
    loadContext: getActionContext,
    name: 'scopeVariation.sendChangeOrderToClient',
  },
  async (id, ctx): Promise<ChangeOrder> =>
    runStaffTransition(ctx, id, 'send_to_client', { patch: { reviewed_by: ctx.userId, reviewed_at: new Date().toISOString() } }),
);

export const rejectChangeOrderAction = safeAction(
  {
    schema: changeOrderReasonSchema,
    permission: { resource: 'change_order', action: 'review' },
    loadContext: getActionContext,
    name: 'scopeVariation.rejectChangeOrder',
  },
  async (input, ctx): Promise<ChangeOrder> =>
    runStaffTransition(ctx, input.id, 'reject', {
      reason: input.reason,
      patch: { rejected_by: ctx.userId, rejected_at: new Date().toISOString(), rejected_reason: input.reason },
    }),
);

/** Finance/Owner confirming the variation's own extra funding has cleared (ADR 0012 decision 1 -- manual, like Cash Gate's D5). */
export const markChangeOrderFundedAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'change_order', action: 'mark_funded' },
    loadContext: getActionContext,
    name: 'scopeVariation.markChangeOrderFunded',
  },
  async (id, ctx): Promise<ChangeOrder> =>
    runStaffTransition(ctx, id, 'funding_received', { patch: { funded_by: ctx.userId, funded_at: new Date().toISOString() } }),
);

export const completeChangeOrderAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'change_order', action: 'complete' },
    loadContext: getActionContext,
    name: 'scopeVariation.completeChangeOrder',
  },
  async (id, ctx): Promise<ChangeOrder> =>
    runStaffTransition(ctx, id, 'complete', { patch: { completed_by: ctx.userId, completed_at: new Date().toISOString() } }),
);

/** Reachable by staff and by a client_approver alike (roleCan()'s null-role deferral, ADR 0013). RLS still scopes what each actually sees. */
export const listChangeOrdersForProjectAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'change_order', action: 'view' },
    loadContext: getActionContext,
    name: 'scopeVariation.listChangeOrdersForProject',
  },
  async (projectId): Promise<ChangeOrder[]> => {
    const supabase = await createServerSupabase();
    return listChangeOrdersForProject(supabase, projectId);
  },
);

export const getChangeOrderAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'change_order', action: 'view' },
    loadContext: getActionContext,
    name: 'scopeVariation.getChangeOrder',
  },
  async (id): Promise<ChangeOrder> => {
    const supabase = await createServerSupabase();
    return getChangeOrder(supabase, id);
  },
);
