'use server';

import { z } from 'zod';
import { getActionContext } from '@/core/auth/session';
import { safeAction } from '@/core/actions/safe-action';
import { createServerSupabase } from '@/core/db/client.server';
import { insertClientStatusUpdate, listClientStatusUpdatesForProject, listAllClientStatusUpdates, type ClientStatusUpdateWithProject } from '../data/client-status-repository';
import { publishClientStatusSchema } from '../schemas';
import type { ClientStatusUpdate } from '../types';

/**
 * ADR 0026 §7 item 3: only owner/technical_director may publish. RLS
 * (client_status_updates_insert_publishers) enforces the same rule at the
 * DB layer -- CLAUDE.md law §0.3's two-layer requirement.
 */
export const publishClientStatusAction = safeAction(
  {
    schema: publishClientStatusSchema,
    permission: { resource: 'client_status', action: 'publish' },
    loadContext: getActionContext,
    name: 'clientPortal.publishClientStatus',
  },
  async (input, ctx): Promise<ClientStatusUpdate> => {
    const supabase = await createServerSupabase();
    return insertClientStatusUpdate(supabase, {
      organization_id: ctx.organizationId,
      project_id: input.projectId,
      status: input.status,
      headline: input.headline,
      detail: input.detail ?? null,
      published_by: ctx.userId,
    });
  },
);

/**
 * Newest-first history for a project -- the Client Timeline's header is
 * simply the first row, "Update Terbaru" reads the rest. `audience:
 * 'external'` matches listPendingClientDecisionsAction: called directly by
 * a signed-in client_approver/client_viewer, not only by staff.
 */
export const listClientStatusUpdatesForProjectAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'client_status', action: 'view' },
    loadContext: getActionContext,
    name: 'clientPortal.listClientStatusUpdatesForProject',
    audience: 'external',
  },
  async (projectId): Promise<ClientStatusUpdate[]> => {
    const supabase = await createServerSupabase();
    return listClientStatusUpdatesForProject(supabase, projectId);
  },
);

export const listAllClientStatusUpdatesAction = safeAction(
  {
    schema: z.void(),
    permission: { resource: 'client_status', action: 'view' },
    loadContext: getActionContext,
    name: 'clientPortal.listAllClientStatusUpdates',
  },
  async (): Promise<ClientStatusUpdateWithProject[]> => {
    const supabase = await createServerSupabase();
    return listAllClientStatusUpdates(supabase);
  },
);
