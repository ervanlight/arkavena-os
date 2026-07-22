import 'server-only';
import type { ServerSupabase } from '@/core/db/client.server';
import { InfraError, NotFoundError } from '@/core/errors/app-error';
import type { DailyLog, DailyLogUpdate, NewDailyLog } from '../types';

/** All direct `daily_logs` table access lives here (ARCHITECTURE.md 1.2). */

export async function listDailyLogsForProject(supabase: ServerSupabase, projectId: string): Promise<DailyLog[]> {
  const { data, error } = await supabase
    .from('daily_logs')
    .select('*')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .order('log_date', { ascending: false });

  if (error !== null) {
    throw new InfraError(`Failed to list daily logs for project ${projectId}: ${error.message}`);
  }
  return data;
}

export async function getDailyLog(supabase: ServerSupabase, id: string): Promise<DailyLog> {
  const { data, error } = await supabase.from('daily_logs').select('*').eq('id', id).is('deleted_at', null).maybeSingle();

  if (error !== null) {
    throw new InfraError(`Failed to load daily log ${id}: ${error.message}`);
  }
  if (data === null) {
    throw new NotFoundError(`Daily log ${id} not found`, { meta: { dailyLogId: id } });
  }
  return data;
}

/**
 * Upsert by id, not a blind insert -- `id` is always client-generated
 * (schemas.ts), so a create replayed after a dropped connection (offline
 * outbox, D3) lands on the same row instead of a duplicate.
 */
export async function insertDailyLog(supabase: ServerSupabase, input: NewDailyLog): Promise<DailyLog> {
  const { data, error } = await supabase.from('daily_logs').upsert(input).select().single();

  if (error !== null) {
    throw new InfraError(`Failed to create daily log: ${error.message}`);
  }
  return data;
}

export async function updateDailyLog(supabase: ServerSupabase, id: string, patch: DailyLogUpdate): Promise<DailyLog> {
  const { data, error } = await supabase
    .from('daily_logs')
    .update(patch)
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .maybeSingle();

  if (error !== null) {
    throw new InfraError(`Failed to update daily log ${id}: ${error.message}`);
  }
  if (data === null) {
    throw new NotFoundError(`Daily log ${id} not found`, { meta: { dailyLogId: id } });
  }
  return data;
}
