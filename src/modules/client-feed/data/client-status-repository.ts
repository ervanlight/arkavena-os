import 'server-only';
import type { ServerSupabase } from '@/core/db/client.server';
import type { ClientStatusUpdate, NewClientStatusUpdate } from '../types';

/** All direct `client_status_updates` table access lives here (ARCHITECTURE.md 1.2). Append-only: no update/delete function exists on purpose. */

export async function insertClientStatusUpdate(
  supabase: ServerSupabase,
  input: NewClientStatusUpdate,
): Promise<ClientStatusUpdate> {
  const { data, error } = await supabase.from('client_status_updates').insert(input).select().single();

  if (error !== null) throw error;
  return data;
}

/** Newest first -- the Client Timeline's header is simply row 0, "Update Terbaru" reads the rest (ADR 0026 §4.1). */
export async function listClientStatusUpdatesForProject(
  supabase: ServerSupabase,
  projectId: string,
): Promise<ClientStatusUpdate[]> {
  const { data, error } = await supabase
    .from('client_status_updates')
    .select('*')
    .eq('project_id', projectId)
    .order('published_at', { ascending: false });

  if (error !== null) throw error;
  return data;
}
