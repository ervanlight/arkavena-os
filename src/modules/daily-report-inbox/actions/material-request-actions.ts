'use server';

import { z } from 'zod';
import { recordAudit } from '@/core/audit/audit';
import { createAuditGateway } from '@/core/audit/gateway.server';
import { getActionContext } from '@/core/auth/session';
import { safeAction } from '@/core/actions/safe-action';
import { createServerSupabase } from '@/core/db/client.server';
import {
  getMaterialRequest,
  insertMaterialRequest,
  listMaterialRequestsForProject,
  updateMaterialRequest,
} from '../data/material-requests-repository';
import { createMaterialRequestSchema, updateMaterialRequestStatusSchema } from '../schemas';
import type { MaterialRequest } from '../types';

export const createMaterialRequestAction = safeAction(
  {
    schema: createMaterialRequestSchema,
    permission: { resource: 'material_request', action: 'create' },
    loadContext: getActionContext,
    name: 'fieldReporting.createMaterialRequest',
  },
  async (input, ctx): Promise<MaterialRequest> => {
    const supabase = await createServerSupabase();
    const request = await insertMaterialRequest(supabase, {
      id: input.id,
      organization_id: ctx.organizationId,
      project_id: input.projectId,
      zone_id: input.zoneId ?? null,
      work_package_id: input.workPackageId ?? null,
      item_description: input.itemDescription,
      quantity: input.quantity,
      unit: input.unit,
      needed_by_date: input.neededByDate ?? null,
      notes: input.notes ?? null,
      requested_by: ctx.userId,
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'material_requests',
      entityId: request.id,
      action: 'insert',
      newValue: request,
      projectId: request.project_id,
      requestId: ctx.requestId,
    });

    return request;
  },
);

export const updateMaterialRequestStatusAction = safeAction(
  {
    schema: updateMaterialRequestStatusSchema,
    permission: { resource: 'material_request', action: 'update_status' },
    loadContext: getActionContext,
    name: 'fieldReporting.updateMaterialRequestStatus',
  },
  async (input, ctx): Promise<MaterialRequest> => {
    const supabase = await createServerSupabase();
    const before = await getMaterialRequest(supabase, input.id);

    const after = await updateMaterialRequest(supabase, input.id, { status: input.status });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'material_requests',
      entityId: after.id,
      action: 'status_change',
      previousValue: before,
      newValue: after,
      projectId: after.project_id,
      requestId: ctx.requestId,
    });

    return after;
  },
);

export const listMaterialRequestsForProjectAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'material_request', action: 'view' },
    loadContext: getActionContext,
    name: 'fieldReporting.listMaterialRequestsForProject',
  },
  async (projectId): Promise<MaterialRequest[]> => {
    const supabase = await createServerSupabase();
    return listMaterialRequestsForProject(supabase, projectId);
  },
);
