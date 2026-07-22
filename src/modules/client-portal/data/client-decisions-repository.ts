import 'server-only';
import type { ServerSupabase } from '@/core/db/client.server';
import type { ClientDecision } from '../types';

/** All direct `client_decisions` table access lives here (ARCHITECTURE.md 1.2). Read-only from this module's side -- the only writer is fn_change_orders_sync_client_decision (ADR 0016). */

export async function listClientDecisionsForProject(
  supabase: ServerSupabase,
  projectId: string,
): Promise<ClientDecision[]> {
  const { data, error } = await supabase
    .from('client_decisions')
    .select('*')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .order('presented_at', { ascending: false });

  if (error !== null) throw error;
  return data;
}

export async function listPendingClientDecisionsForProject(
  supabase: ServerSupabase,
  projectId: string,
): Promise<ClientDecision[]> {
  const { data, error } = await supabase
    .from('client_decisions')
    .select('*')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .is('decided_at', null)
    .order('presented_at', { ascending: true });

  if (error !== null) throw error;
  return data;
}
