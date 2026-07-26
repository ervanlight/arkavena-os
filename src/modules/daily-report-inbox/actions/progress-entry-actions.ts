'use server';

import { z } from 'zod';
import { recordAudit } from '@/core/audit/audit';
import { createAuditGateway } from '@/core/audit/gateway.server';
import { getActionContext } from '@/core/auth/session';
import { safeAction } from '@/core/actions/safe-action';
import { createServerSupabase } from '@/core/db/client.server';
import {
  getProgressEntry,
  insertProgressEntry,
  listProgressEntriesForDailyLog,
  updateProgressEntry,
} from '../data/progress-entries-repository';
import { createProgressEntrySchema, updateProgressEntrySchema } from '../schemas';
import type { ProgressEntry } from '../types';

export const createProgressEntryAction = safeAction(
  {
    schema: createProgressEntrySchema,
    permission: { resource: 'progress_entry', action: 'create' },
    loadContext: getActionContext,
    name: 'fieldReporting.createProgressEntry',
  },
  async (input, ctx): Promise<ProgressEntry> => {
    const supabase = await createServerSupabase();
    const entry = await insertProgressEntry(supabase, {
      id: input.id,
      organization_id: ctx.organizationId,
      project_id: input.projectId,
      daily_log_id: input.dailyLogId,
      work_package_id: input.workPackageId,
      progress_percent: input.progressPercent,
      notes: input.notes ?? null,
      created_by: ctx.userId,
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'progress_entries',
      entityId: entry.id,
      action: 'insert',
      newValue: entry,
      projectId: entry.project_id,
      requestId: ctx.requestId,
    });

    return entry;
  },
);

export const updateProgressEntryAction = safeAction(
  {
    schema: updateProgressEntrySchema,
    permission: { resource: 'progress_entry', action: 'update' },
    loadContext: getActionContext,
    name: 'fieldReporting.updateProgressEntry',
  },
  async (input, ctx): Promise<ProgressEntry> => {
    const supabase = await createServerSupabase();
    const before = await getProgressEntry(supabase, input.id);

    const after = await updateProgressEntry(supabase, input.id, {
      ...(input.progressPercent !== undefined ? { progress_percent: input.progressPercent } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'progress_entries',
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

export const listProgressEntriesForDailyLogAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'progress_entry', action: 'view' },
    loadContext: getActionContext,
    name: 'fieldReporting.listProgressEntriesForDailyLog',
  },
  async (dailyLogId): Promise<ProgressEntry[]> => {
    const supabase = await createServerSupabase();
    return listProgressEntriesForDailyLog(supabase, dailyLogId);
  },
);
