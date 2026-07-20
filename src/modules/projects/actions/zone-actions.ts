'use server';

import { z } from 'zod';
import { recordAudit } from '@/core/audit/audit';
import { createAuditGateway } from '@/core/audit/gateway.server';
import { getActionContext } from '@/core/auth/session';
import { safeAction } from '@/core/actions/safe-action';
import { createServerSupabase } from '@/core/db/client.server';
import { getZone, insertZone, listZonesForProject, updateZone } from '../data/zones-repository';
import { createZoneSchema, updateZoneSchema } from '../schemas';
import type { Zone } from '../types';

export const createZoneAction = safeAction(
  {
    schema: createZoneSchema,
    permission: { resource: 'zone', action: 'create' },
    loadContext: getActionContext,
    name: 'projects.createZone',
  },
  async (input, ctx): Promise<Zone> => {
    const supabase = await createServerSupabase();
    const zone = await insertZone(supabase, {
      organization_id: ctx.organizationId,
      project_id: input.projectId,
      name: input.name,
      description: input.description ?? null,
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'zones',
      entityId: zone.id,
      action: 'insert',
      newValue: zone,
      projectId: zone.project_id,
      requestId: ctx.requestId,
    });

    return zone;
  },
);

export const updateZoneAction = safeAction(
  {
    schema: updateZoneSchema,
    permission: { resource: 'zone', action: 'update' },
    loadContext: getActionContext,
    name: 'projects.updateZone',
  },
  async (input, ctx): Promise<Zone> => {
    const supabase = await createServerSupabase();
    const before = await getZone(supabase, input.id);

    const after = await updateZone(supabase, input.id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'zones',
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

export const listZonesForProjectAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'zone', action: 'view' },
    loadContext: getActionContext,
    name: 'projects.listZonesForProject',
  },
  async (projectId): Promise<Zone[]> => {
    const supabase = await createServerSupabase();
    return listZonesForProject(supabase, projectId);
  },
);
