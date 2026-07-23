'use server';

import { z } from 'zod';
import { recordAudit } from '@/core/audit/audit';
import { createAuditGateway } from '@/core/audit/gateway.server';
import { getActionContext } from '@/core/auth/session';
import { safeAction } from '@/core/actions/safe-action';
import { createServerSupabase } from '@/core/db/client.server';
import { getHandoverItem, insertHandoverItem, listHandoverItemsForProject } from '../data/handover-items-repository';
import { createHandoverItemSchema } from '../schemas';
import type { HandoverItem } from '../types';

export const createHandoverItemAction = safeAction(
  {
    schema: createHandoverItemSchema,
    permission: { resource: 'handover_item', action: 'create' },
    loadContext: getActionContext,
    name: 'maintenanceEngine.createHandoverItem',
  },
  async (input, ctx): Promise<HandoverItem> => {
    const supabase = await createServerSupabase();
    const item = await insertHandoverItem(supabase, {
      organization_id: ctx.organizationId,
      project_id: input.projectId,
      zone_id: input.zoneId ?? null,
      item_type: input.itemType,
      description: input.description ?? null,
      handed_over_at: input.handedOverAt ?? null,
      handed_over_to: input.handedOverTo ?? null,
      recorded_by: ctx.userId,
      notes: input.notes ?? null,
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'handover_items',
      entityId: item.id,
      action: 'insert',
      newValue: item,
      projectId: input.projectId,
      requestId: ctx.requestId,
    });

    return item;
  },
);

export const listHandoverItemsForProjectAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'handover_item', action: 'view' },
    loadContext: getActionContext,
    name: 'maintenanceEngine.listHandoverItemsForProject',
  },
  async (projectId): Promise<HandoverItem[]> => {
    const supabase = await createServerSupabase();
    return listHandoverItemsForProject(supabase, projectId);
  },
);

export const getHandoverItemAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'handover_item', action: 'view' },
    loadContext: getActionContext,
    name: 'maintenanceEngine.getHandoverItem',
  },
  async (id): Promise<HandoverItem> => {
    const supabase = await createServerSupabase();
    return getHandoverItem(supabase, id);
  },
);
