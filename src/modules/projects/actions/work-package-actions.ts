'use server';

import { z } from 'zod';
import { recordAudit } from '@/core/audit/audit';
import { createAuditGateway } from '@/core/audit/gateway.server';
import { getActionContext } from '@/core/auth/session';
import { safeAction } from '@/core/actions/safe-action';
import { createServerSupabase } from '@/core/db/client.server';
import {
  getWorkPackage,
  insertWorkPackage,
  listWorkPackagesForProject,
  updateWorkPackage,
} from '../data/work-packages-repository';
import { createWorkPackageSchema, updateWorkPackageSchema } from '../schemas';
import type { WorkPackage } from '../types';

export const createWorkPackageAction = safeAction(
  {
    schema: createWorkPackageSchema,
    permission: { resource: 'work_package', action: 'create' },
    loadContext: getActionContext,
    name: 'projects.createWorkPackage',
  },
  async (input, ctx): Promise<WorkPackage> => {
    const supabase = await createServerSupabase();
    const workPackage = await insertWorkPackage(supabase, {
      organization_id: ctx.organizationId,
      project_id: input.projectId,
      name: input.name,
      zone_id: input.zoneId ?? null,
      milestone_id: input.milestoneId ?? null,
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'work_packages',
      entityId: workPackage.id,
      action: 'insert',
      newValue: workPackage,
      projectId: workPackage.project_id,
      requestId: ctx.requestId,
    });

    return workPackage;
  },
);

export const updateWorkPackageAction = safeAction(
  {
    schema: updateWorkPackageSchema,
    permission: { resource: 'work_package', action: 'update' },
    loadContext: getActionContext,
    name: 'projects.updateWorkPackage',
  },
  async (input, ctx): Promise<WorkPackage> => {
    const supabase = await createServerSupabase();
    const before = await getWorkPackage(supabase, input.id);

    const after = await updateWorkPackage(supabase, input.id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.zoneId !== undefined ? { zone_id: input.zoneId } : {}),
      ...(input.milestoneId !== undefined ? { milestone_id: input.milestoneId } : {}),
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'work_packages',
      entityId: after.id,
      action: before.status !== after.status ? 'status_change' : 'update',
      previousValue: before,
      newValue: after,
      projectId: after.project_id,
      requestId: ctx.requestId,
    });

    return after;
  },
);

export const listWorkPackagesForProjectAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'work_package', action: 'view' },
    loadContext: getActionContext,
    name: 'projects.listWorkPackagesForProject',
  },
  async (projectId): Promise<WorkPackage[]> => {
    const supabase = await createServerSupabase();
    return listWorkPackagesForProject(supabase, projectId);
  },
);
