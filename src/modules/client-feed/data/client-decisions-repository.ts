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

/**
 * Post-implementation review fix (C1): the /proposals/[id]/decide page's own
 * read. Looks up by proposal_id (the route's [id]) rather than the
 * client_decisions row's own id, mirroring how a client_decisions row is
 * keyed by change_order_id for /variations/[id]/approve's equivalent
 * lookup. client-portal never queries `proposals` itself for this --
 * fn_proposals_sync_client_decision (proposals' own migration) is the only
 * writer.
 */
export async function getClientDecisionForProposal(
  supabase: ServerSupabase,
  proposalId: string,
): Promise<ClientDecision | null> {
  const { data, error } = await supabase
    .from('client_decisions')
    .select('*')
    .eq('proposal_id', proposalId)
    .is('deleted_at', null)
    .order('presented_at', { ascending: false })
    .maybeSingle();

  if (error !== null) throw error;
  return data;
}

/**
 * Phase 3 (F6): the /handover/[id]/accept page's own read. Keyed by the
 * client_decisions row's own id, not a separate source id -- unlike
 * change_order_id/proposal_id, a handover sign-off has no single source row
 * to key by (a project-level decision, not a per-row one).
 */
export async function getClientDecision(supabase: ServerSupabase, id: string): Promise<ClientDecision | null> {
  const { data, error } = await supabase.from('client_decisions').select('*').eq('id', id).is('deleted_at', null).maybeSingle();

  if (error !== null) throw error;
  return data;
}
