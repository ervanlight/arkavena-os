'use server';

import { z } from 'zod';
import { recordAudit } from '@/core/audit/audit';
import { createAuditGateway } from '@/core/audit/gateway.server';
import { getActionContext } from '@/core/auth/session';
import { safeAction } from '@/core/actions/safe-action';
import { createServerSupabase } from '@/core/db/client.server';
import {
  getProjectCompletionSignoffForProject,
  insertProjectCompletionSignoff,
} from '../data/project-completion-signoffs-repository';
import { createProjectCompletionSignoffSchema } from '../schemas';
import type { ProjectCompletionSignoff } from '../types';

/**
 * ARCHITECTURE.md 4.4's TD-only authority, exercised once at the whole-project
 * level (F15). requirePermission() gives the friendly refusal for every other
 * role; fn_project_completion_signoffs_guard_td_only (the migration) is the
 * real, unbypassable check -- same two-layer split as overrideInspectionAction.
 */
export const createProjectCompletionSignoffAction = safeAction(
  {
    schema: createProjectCompletionSignoffSchema,
    permission: { resource: 'project_completion_signoff', action: 'create' },
    loadContext: getActionContext,
    name: 'qualityGate.createProjectCompletionSignoff',
  },
  async (input, ctx): Promise<ProjectCompletionSignoff> => {
    const supabase = await createServerSupabase();
    const signoff = await insertProjectCompletionSignoff(supabase, {
      organization_id: ctx.organizationId,
      project_id: input.projectId,
      signed_off_by: ctx.userId,
      notes: input.notes ?? null,
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'project_completion_signoffs',
      entityId: signoff.id,
      action: 'insert',
      newValue: signoff,
      projectId: signoff.project_id,
      requestId: ctx.requestId,
    });

    return signoff;
  },
);

export const getProjectCompletionSignoffForProjectAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'project_completion_signoff', action: 'view' },
    loadContext: getActionContext,
    name: 'qualityGate.getProjectCompletionSignoffForProject',
  },
  async (projectId): Promise<ProjectCompletionSignoff | null> => {
    const supabase = await createServerSupabase();
    return getProjectCompletionSignoffForProject(supabase, projectId);
  },
);
