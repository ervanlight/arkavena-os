import 'server-only';
import type { ServerSupabase } from '@/core/db/client.server';
import { NotFoundError } from '@/core/errors/app-error';
import type { NewProgressEntry, ProgressEntry, ProgressEntryUpdate } from '../types';

/** All direct `progress_entries` table access lives here (ARCHITECTURE.md 1.2). */

export async function listProgressEntriesForDailyLog(
  supabase: ServerSupabase,
  dailyLogId: string,
): Promise<ProgressEntry[]> {
  const { data, error } = await supabase
    .from('progress_entries')
    .select('*')
    .eq('daily_log_id', dailyLogId)
    .is('deleted_at', null)
    .order('created_at');

  if (error !== null) throw error;
  return data;
}

export async function getProgressEntry(supabase: ServerSupabase, id: string): Promise<ProgressEntry> {
  const { data, error } = await supabase
    .from('progress_entries')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error !== null) throw error;
  if (data === null) {
    throw new NotFoundError(`Progress entry ${id} not found`, { meta: { progressEntryId: id } });
  }
  return data;
}

/** Upsert by id -- see daily-logs-repository.ts's comment; same offline-replay reasoning applies to every table in this module. */
export async function insertProgressEntry(supabase: ServerSupabase, input: NewProgressEntry): Promise<ProgressEntry> {
  const { data, error } = await supabase.from('progress_entries').upsert(input).select().single();

  if (error !== null) throw error;
  return data;
}

export async function updateProgressEntry(
  supabase: ServerSupabase,
  id: string,
  patch: ProgressEntryUpdate,
): Promise<ProgressEntry> {
  const { data, error } = await supabase
    .from('progress_entries')
    .update(patch)
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .maybeSingle();

  if (error !== null) throw error;
  if (data === null) {
    throw new NotFoundError(`Progress entry ${id} not found`, { meta: { progressEntryId: id } });
  }
  return data;
}
