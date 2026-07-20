'use server';

import { z } from 'zod';
import { recordAudit } from '@/core/audit/audit';
import { createAuditGateway } from '@/core/audit/gateway.server';
import { getActionContext } from '@/core/auth/session';
import { safeAction } from '@/core/actions/safe-action';
import { createServerSupabase } from '@/core/db/client.server';
import { getSite, insertSite, listSites, listSitesForClient, updateSite } from '../data/sites-repository';
import { createSiteSchema, updateSiteSchema } from '../schemas';
import type { Site } from '../types';

export const createSiteAction = safeAction(
  {
    schema: createSiteSchema,
    permission: { resource: 'site', action: 'create' },
    loadContext: getActionContext,
    name: 'crm.createSite',
  },
  async (input, ctx): Promise<Site> => {
    const supabase = await createServerSupabase();
    const site = await insertSite(supabase, {
      organization_id: ctx.organizationId,
      client_id: input.clientId,
      name: input.name,
      address: input.address ?? null,
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'sites',
      entityId: site.id,
      action: 'insert',
      newValue: site,
      requestId: ctx.requestId,
    });

    return site;
  },
);

export const updateSiteAction = safeAction(
  {
    schema: updateSiteSchema,
    permission: { resource: 'site', action: 'update' },
    loadContext: getActionContext,
    name: 'crm.updateSite',
  },
  async (input, ctx): Promise<Site> => {
    const supabase = await createServerSupabase();
    const before = await getSite(supabase, input.id);

    const after = await updateSite(supabase, input.id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.address !== undefined ? { address: input.address } : {}),
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'sites',
      entityId: after.id,
      action: 'update',
      previousValue: before,
      newValue: after,
      requestId: ctx.requestId,
    });

    return after;
  },
);

export const listSitesAction = safeAction(
  {
    schema: z.void(),
    permission: { resource: 'site', action: 'view' },
    loadContext: getActionContext,
    name: 'crm.listSites',
  },
  async (): Promise<Site[]> => {
    const supabase = await createServerSupabase();
    return listSites(supabase);
  },
);

export const listSitesForClientAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'site', action: 'view' },
    loadContext: getActionContext,
    name: 'crm.listSitesForClient',
  },
  async (clientId): Promise<Site[]> => {
    const supabase = await createServerSupabase();
    return listSitesForClient(supabase, clientId);
  },
);
