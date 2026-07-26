'use server';

import { z } from 'zod';
import { recordAudit } from '@/core/audit/audit';
import { createAuditGateway } from '@/core/audit/gateway.server';
import { getActionContext } from '@/core/auth/session';
import { safeAction } from '@/core/actions/safe-action';
import { createServerSupabase } from '@/core/db/client.server';
import { getDailyLog, insertDailyLog, listDailyLogsForProject, updateDailyLog, listPendingDailyLogs, type PendingDailyLog } from '../data/daily-logs-repository';
import { createDailyLogSchema, updateDailyLogSchema } from '../schemas';
import type { DailyLog } from '../types';
import { updateEvidenceVisibilityForActivity } from '@/modules/evidence/data/evidence-repository';
import { insertClientStatusUpdate } from '@/modules/client-feed/data/client-status-repository';

export const createDailyLogAction = safeAction(
  {
    schema: createDailyLogSchema,
    permission: { resource: 'daily_log', action: 'create' },
    loadContext: getActionContext,
    name: 'fieldReporting.createDailyLog',
  },
  async (input, ctx): Promise<DailyLog> => {
    const supabase = await createServerSupabase();
    const dailyLog = await insertDailyLog(supabase, {
      id: input.id,
      organization_id: ctx.organizationId,
      project_id: input.projectId,
      log_date: input.logDate,
      reported_by: ctx.userId,
      weather: input.weather ?? null,
      manpower_count: input.manpowerCount ?? null,
      notes: input.notes ?? null,
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'daily_logs',
      entityId: dailyLog.id,
      action: 'insert',
      newValue: dailyLog,
      projectId: dailyLog.project_id,
      requestId: ctx.requestId,
    });

    return dailyLog;
  },
);

export const updateDailyLogAction = safeAction(
  {
    schema: updateDailyLogSchema,
    permission: { resource: 'daily_log', action: 'update' },
    loadContext: getActionContext,
    name: 'fieldReporting.updateDailyLog',
  },
  async (input, ctx): Promise<DailyLog> => {
    const supabase = await createServerSupabase();
    const before = await getDailyLog(supabase, input.id);

    const after = await updateDailyLog(supabase, input.id, {
      ...(input.weather !== undefined ? { weather: input.weather } : {}),
      ...(input.manpowerCount !== undefined ? { manpower_count: input.manpowerCount } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'daily_logs',
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

export const listDailyLogsForProjectAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'daily_log', action: 'view' },
    loadContext: getActionContext,
    name: 'fieldReporting.listDailyLogsForProject',
  },
  async (projectId): Promise<DailyLog[]> => {
    const supabase = await createServerSupabase();
    return listDailyLogsForProject(supabase, projectId);
  },
);

export const reviewDailyLogAction = safeAction(
  {
    schema: z.object({
      id: z.string().uuid(),
      decision: z.enum(['publish', 'reject']),
      rejectionReason: z.string().optional(),
    }),
    permission: { resource: 'daily_log', action: 'update' },
    loadContext: getActionContext,
    name: 'fieldReporting.reviewDailyLog',
  },
  async (input, ctx): Promise<DailyLog> => {
    const supabase = await createServerSupabase();
    const before = await getDailyLog(supabase, input.id);

    if (before.status === 'published') {
      throw new Error('Daily log has already been published.');
    }

    const newStatus = input.decision === 'publish' ? 'published' : 'rejected';

    const after = await updateDailyLog(supabase, input.id, {
      status: newStatus,
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'daily_logs',
      entityId: after.id,
      action: 'update',
      previousValue: before,
      newValue: after,
      projectId: after.project_id,
      requestId: ctx.requestId,
    });

    if (input.decision === 'publish') {
      // 1. Publish all evidence
      await updateEvidenceVisibilityForActivity(supabase, 'daily_logs', after.id, 'client_visible');
      
      // 2. Create client status update
      await insertClientStatusUpdate(supabase, {
        organization_id: ctx.organizationId,
        project_id: after.project_id,
        status: 'on_track',
        headline: `Progress Harian: ${new Date(after.log_date).toLocaleDateString('id-ID')}`,
        detail: after.notes ?? 'Pekerjaan berjalan sesuai rencana.',
        published_by: ctx.userId,
      });
    }

    return after;
  },
);

export const listPendingDailyLogsAction = safeAction(
  {
    schema: z.void(),
    permission: { resource: 'daily_log', action: 'view' },
    loadContext: getActionContext,
    name: 'fieldReporting.listPendingDailyLogs',
  },
  async (): Promise<PendingDailyLog[]> => {
    const supabase = await createServerSupabase();
    return listPendingDailyLogs(supabase);
  },
);
