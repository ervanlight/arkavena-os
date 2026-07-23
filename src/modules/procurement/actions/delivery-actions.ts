'use server';

import { z } from 'zod';
import { recordAudit } from '@/core/audit/audit';
import { createAuditGateway } from '@/core/audit/gateway.server';
import { getActionContext } from '@/core/auth/session';
import { safeAction } from '@/core/actions/safe-action';
import { createServerSupabase } from '@/core/db/client.server';
import { getDelivery, insertDelivery, listDeliveriesForPurchaseOrder } from '../data/deliveries-repository';
import { createDeliverySchema } from '../schemas';
import type { Delivery } from '../types';

export const createDeliveryAction = safeAction(
  {
    schema: createDeliverySchema,
    permission: { resource: 'delivery', action: 'create' },
    loadContext: getActionContext,
    name: 'procurement.createDelivery',
  },
  async (input, ctx): Promise<Delivery> => {
    const supabase = await createServerSupabase();
    const delivery = await insertDelivery(supabase, {
      organization_id: ctx.organizationId,
      purchase_order_id: input.purchaseOrderId,
      received_by: ctx.userId,
      ...(input.deliveredAt !== undefined ? { delivered_at: input.deliveredAt } : {}),
      notes: input.notes ?? null,
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'deliveries',
      entityId: delivery.id,
      action: 'insert',
      newValue: delivery,
      requestId: ctx.requestId,
    });

    return delivery;
  },
);

export const listDeliveriesForPurchaseOrderAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'delivery', action: 'view' },
    loadContext: getActionContext,
    name: 'procurement.listDeliveriesForPurchaseOrder',
  },
  async (purchaseOrderId): Promise<Delivery[]> => {
    const supabase = await createServerSupabase();
    return listDeliveriesForPurchaseOrder(supabase, purchaseOrderId);
  },
);

export const getDeliveryAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'delivery', action: 'view' },
    loadContext: getActionContext,
    name: 'procurement.getDelivery',
  },
  async (id): Promise<Delivery> => {
    const supabase = await createServerSupabase();
    return getDelivery(supabase, id);
  },
);

