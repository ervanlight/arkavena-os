'use server';

import { z } from 'zod';
import { toRupiah } from '@/core/money/rupiah';
import { recordAudit } from '@/core/audit/audit';
import { createAuditGateway } from '@/core/audit/gateway.server';
import { getActionContext } from '@/core/auth/session';
import { safeAction } from '@/core/actions/safe-action';
import { createServerSupabase } from '@/core/db/client.server';
import {
  getCostLibraryItem,
  insertCostLibraryItem,
  listCostLibraryItems,
  updateCostLibraryItem,
} from '../data/cost-library-repository';
import { createCostLibraryItemSchema, updateCostLibraryItemSchema } from '../schemas';
import type { CostLibraryItem } from '../types';

export const createCostLibraryItemAction = safeAction(
  {
    schema: createCostLibraryItemSchema,
    permission: { resource: 'cost_library', action: 'create' },
    loadContext: getActionContext,
    name: 'estimating.createCostLibraryItem',
  },
  async (input, ctx): Promise<CostLibraryItem> => {
    const supabase = await createServerSupabase();
    const item = await insertCostLibraryItem(supabase, {
      organization_id: ctx.organizationId,
      name: input.name,
      unit: input.unit,
      default_unit_cost: toRupiah(input.defaultUnitCost),
      category: input.category ?? null,
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'cost_library',
      entityId: item.id,
      action: 'insert',
      newValue: item,
      requestId: ctx.requestId,
    });

    return item;
  },
);

export const updateCostLibraryItemAction = safeAction(
  {
    schema: updateCostLibraryItemSchema,
    permission: { resource: 'cost_library', action: 'update' },
    loadContext: getActionContext,
    name: 'estimating.updateCostLibraryItem',
  },
  async (input, ctx): Promise<CostLibraryItem> => {
    const supabase = await createServerSupabase();
    const before = await getCostLibraryItem(supabase, input.id);

    const after = await updateCostLibraryItem(supabase, input.id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.unit !== undefined ? { unit: input.unit } : {}),
      ...(input.defaultUnitCost !== undefined ? { default_unit_cost: toRupiah(input.defaultUnitCost) } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'cost_library',
      entityId: after.id,
      action: 'update',
      previousValue: before,
      newValue: after,
      requestId: ctx.requestId,
    });

    return after;
  },
);

export const listCostLibraryItemsAction = safeAction(
  {
    schema: z.void(),
    permission: { resource: 'cost_library', action: 'view' },
    loadContext: getActionContext,
    name: 'estimating.listCostLibraryItems',
  },
  async (): Promise<CostLibraryItem[]> => {
    const supabase = await createServerSupabase();
    return listCostLibraryItems(supabase);
  },
);

export const getCostLibraryItemAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'cost_library', action: 'view' },
    loadContext: getActionContext,
    name: 'estimating.getCostLibraryItem',
  },
  async (id): Promise<CostLibraryItem> => {
    const supabase = await createServerSupabase();
    return getCostLibraryItem(supabase, id);
  },
);
