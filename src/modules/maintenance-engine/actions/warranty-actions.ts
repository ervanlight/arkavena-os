'use server';

import { z } from 'zod';
import { recordAudit } from '@/core/audit/audit';
import { createAuditGateway } from '@/core/audit/gateway.server';
import { getActionContext } from '@/core/auth/session';
import { safeAction } from '@/core/actions/safe-action';
import { createServerSupabase } from '@/core/db/client.server';
import { getWarranty, insertWarranty, listWarranties, listWarrantiesForProject, updateWarranty } from '../data/warranties-repository';
import { createWarrantySchema, updateWarrantySchema } from '../schemas';
import type { Warranty } from '../types';

/**
 * Most warranty rows are created by fn_projects_sync_warranties_on_completion
 * (ADR 0019 SS3), not this action -- this covers the standalone case (a
 * manufacturer's own warranty, logged without a specific handover item).
 */
export const createWarrantyAction = safeAction(
  {
    schema: createWarrantySchema,
    permission: { resource: 'warranty', action: 'create' },
    loadContext: getActionContext,
    name: 'maintenanceEngine.createWarranty',
  },
  async (input, ctx): Promise<Warranty> => {
    const supabase = await createServerSupabase();
    const warranty = await insertWarranty(supabase, {
      organization_id: ctx.organizationId,
      project_id: input.projectId,
      handover_item_id: input.handoverItemId ?? null,
      title: input.title,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      terms: input.terms ?? null,
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'warranties',
      entityId: warranty.id,
      action: 'insert',
      newValue: warranty,
      projectId: input.projectId,
      requestId: ctx.requestId,
    });

    return warranty;
  },
);

export const updateWarrantyAction = safeAction(
  {
    schema: updateWarrantySchema,
    permission: { resource: 'warranty', action: 'update' },
    loadContext: getActionContext,
    name: 'maintenanceEngine.updateWarranty',
  },
  async (input, ctx): Promise<Warranty> => {
    const supabase = await createServerSupabase();
    const before = await getWarranty(supabase, input.id);

    const after = await updateWarranty(supabase, input.id, {
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.endsAt !== undefined ? { ends_at: input.endsAt } : {}),
      ...(input.terms !== undefined ? { terms: input.terms } : {}),
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'warranties',
      entityId: after.id,
      action: 'update',
      previousValue: before,
      newValue: after,
      projectId: after.project_id,
      requestId: ctx.requestId,
    });

    return after;
  },
);

export const listWarrantiesForProjectAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'warranty', action: 'view' },
    loadContext: getActionContext,
    name: 'maintenanceEngine.listWarrantiesForProject',
  },
  async (projectId): Promise<Warranty[]> => {
    const supabase = await createServerSupabase();
    return listWarrantiesForProject(supabase, projectId);
  },
);

/** Phase 3 (F18): the org-wide business-development touchpoint -- which warranties, across every project, are approaching or past expiry (warrantyExpiryTier, computed at read time -- no scheduler exists in this stack, ADR 0019 SS5). */
export const listWarrantiesAction = safeAction(
  {
    schema: z.void(),
    permission: { resource: 'warranty', action: 'view' },
    loadContext: getActionContext,
    name: 'maintenanceEngine.listWarranties',
  },
  async (): Promise<Warranty[]> => {
    const supabase = await createServerSupabase();
    return listWarranties(supabase);
  },
);

export const getWarrantyAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'warranty', action: 'view' },
    loadContext: getActionContext,
    name: 'maintenanceEngine.getWarranty',
  },
  async (id): Promise<Warranty> => {
    const supabase = await createServerSupabase();
    return getWarranty(supabase, id);
  },
);
