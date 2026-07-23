'use server';

import { z } from 'zod';
import { toRupiah } from '@/core/money/rupiah';
import { recordAudit } from '@/core/audit/audit';
import { createAuditGateway } from '@/core/audit/gateway.server';
import { getActionContext } from '@/core/auth/session';
import { safeAction } from '@/core/actions/safe-action';
import { createServerSupabase } from '@/core/db/client.server';
import {
  getEstimateItem,
  insertEstimateItem,
  listEstimateItemsForEstimate,
  updateEstimateItem,
} from '../data/estimate-items-repository';
import { createEstimateItemSchema, updateEstimateItemSchema } from '../schemas';
import type { EstimateItem } from '../types';

export const createEstimateItemAction = safeAction(
  {
    schema: createEstimateItemSchema,
    permission: { resource: 'estimate_item', action: 'create' },
    loadContext: getActionContext,
    name: 'estimating.createEstimateItem',
  },
  async (input, ctx): Promise<EstimateItem> => {
    const supabase = await createServerSupabase();
    const item = await insertEstimateItem(supabase, {
      organization_id: ctx.organizationId,
      estimate_id: input.estimateId,
      cost_library_id: input.costLibraryId ?? null,
      zone_id: input.zoneId ?? null,
      description: input.description,
      unit: input.unit,
      quantity: input.quantity,
      unit_cost: toRupiah(input.unitCost),
      unit_price: toRupiah(input.unitPrice),
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'estimate_items',
      entityId: item.id,
      action: 'insert',
      newValue: item,
      requestId: ctx.requestId,
    });

    return item;
  },
);

export const updateEstimateItemAction = safeAction(
  {
    schema: updateEstimateItemSchema,
    permission: { resource: 'estimate_item', action: 'update' },
    loadContext: getActionContext,
    name: 'estimating.updateEstimateItem',
  },
  async (input, ctx): Promise<EstimateItem> => {
    const supabase = await createServerSupabase();
    const before = await getEstimateItem(supabase, input.id);

    const after = await updateEstimateItem(supabase, input.id, {
      ...(input.costLibraryId !== undefined ? { cost_library_id: input.costLibraryId } : {}),
      ...(input.zoneId !== undefined ? { zone_id: input.zoneId } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.unit !== undefined ? { unit: input.unit } : {}),
      ...(input.quantity !== undefined ? { quantity: input.quantity } : {}),
      ...(input.unitCost !== undefined ? { unit_cost: toRupiah(input.unitCost) } : {}),
      ...(input.unitPrice !== undefined ? { unit_price: toRupiah(input.unitPrice) } : {}),
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'estimate_items',
      entityId: after.id,
      action: 'update',
      previousValue: before,
      newValue: after,
      requestId: ctx.requestId,
    });

    return after;
  },
);

export const listEstimateItemsForEstimateAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'estimate_item', action: 'view' },
    loadContext: getActionContext,
    name: 'estimating.listEstimateItemsForEstimate',
  },
  async (estimateId): Promise<EstimateItem[]> => {
    const supabase = await createServerSupabase();
    return listEstimateItemsForEstimate(supabase, estimateId);
  },
);

export const getEstimateItemAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'estimate_item', action: 'view' },
    loadContext: getActionContext,
    name: 'estimating.getEstimateItem',
  },
  async (id): Promise<EstimateItem> => {
    const supabase = await createServerSupabase();
    return getEstimateItem(supabase, id);
  },
);
