import 'server-only';
import type { ServerSupabase } from '@/core/db/client.server';
import { NotFoundError } from '@/core/errors/app-error';
import type { HandoverItem, NewHandoverItem } from '../types';

/** All direct `handover_items` table access lives here (ARCHITECTURE.md 1.2). */

export async function listHandoverItemsForProject(
  supabase: ServerSupabase,
  projectId: string,
): Promise<HandoverItem[]> {
  const { data, error } = await supabase
    .from('handover_items')
    .select('*')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error !== null) throw error;
  return data;
}

export async function getHandoverItem(supabase: ServerSupabase, id: string): Promise<HandoverItem> {
  const { data, error } = await supabase
    .from('handover_items')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error !== null) throw error;
  if (data === null) {
    throw new NotFoundError(`Handover item ${id} not found`, { meta: { handoverItemId: id } });
  }
  return data;
}

export async function insertHandoverItem(supabase: ServerSupabase, input: NewHandoverItem): Promise<HandoverItem> {
  const { data, error } = await supabase.from('handover_items').insert(input).select().single();

  if (error !== null) throw error;
  return data;
}
