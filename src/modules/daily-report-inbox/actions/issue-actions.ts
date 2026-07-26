'use server';

import { z } from 'zod';
import { recordAudit } from '@/core/audit/audit';
import { createAuditGateway } from '@/core/audit/gateway.server';
import { getActionContext } from '@/core/auth/session';
import { safeAction } from '@/core/actions/safe-action';
import { createServerSupabase } from '@/core/db/client.server';
import { getIssue, insertIssue, listIssuesForProject, updateIssue } from '../data/issues-repository';
import { createIssueSchema, resolveIssueSchema } from '../schemas';
import type { Issue } from '../types';

export const createIssueAction = safeAction(
  {
    schema: createIssueSchema,
    permission: { resource: 'issue', action: 'create' },
    loadContext: getActionContext,
    name: 'fieldReporting.createIssue',
  },
  async (input, ctx): Promise<Issue> => {
    const supabase = await createServerSupabase();
    const issue = await insertIssue(supabase, {
      id: input.id,
      organization_id: ctx.organizationId,
      project_id: input.projectId,
      zone_id: input.zoneId ?? null,
      work_package_id: input.workPackageId ?? null,
      title: input.title,
      description: input.description ?? null,
      severity: input.severity ?? 'medium',
      reported_by: ctx.userId,
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'issues',
      entityId: issue.id,
      action: 'insert',
      newValue: issue,
      projectId: issue.project_id,
      requestId: ctx.requestId,
    });

    return issue;
  },
);

export const resolveIssueAction = safeAction(
  {
    schema: resolveIssueSchema,
    permission: { resource: 'issue', action: 'resolve' },
    loadContext: getActionContext,
    name: 'fieldReporting.resolveIssue',
  },
  async (input, ctx): Promise<Issue> => {
    const supabase = await createServerSupabase();
    const before = await getIssue(supabase, input.id);

    const after = await updateIssue(supabase, input.id, {
      status: 'resolved',
      resolved_by: ctx.userId,
      resolved_at: new Date().toISOString(),
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'issues',
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

export const listIssuesForProjectAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'issue', action: 'view' },
    loadContext: getActionContext,
    name: 'fieldReporting.listIssuesForProject',
  },
  async (projectId): Promise<Issue[]> => {
    const supabase = await createServerSupabase();
    return listIssuesForProject(supabase, projectId);
  },
);
