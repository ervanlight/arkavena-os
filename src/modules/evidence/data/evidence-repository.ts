import 'server-only';
import type { ServerSupabase } from '@/core/db/client.server';
import { NotFoundError } from '@/core/errors/app-error';
import type { Evidence, NewEvidence } from '../types';

/** All direct `evidence` table access lives here (ARCHITECTURE.md 1.2). */

export async function insertEvidence(supabase: ServerSupabase, input: NewEvidence): Promise<Evidence> {
  const { data, error } = await supabase.from('evidence').insert(input).select().single();

  if (error !== null) throw error;
  return data;
}

export async function listEvidenceForActivity(
  supabase: ServerSupabase,
  activityTable: string,
  activityId: string,
): Promise<Evidence[]> {
  const { data, error } = await supabase
    .from('evidence')
    .select('*')
    .eq('activity_table', activityTable)
    .eq('activity_id', activityId)
    .is('deleted_at', null)
    .order('captured_at', { ascending: false });

  if (error !== null) throw error;
  return data;
}

/** The Client Timeline's own read: this project's client-visible evidence, newest first (idx_evidence_project_visibility_captured backs this exactly). */
export async function listClientVisibleEvidenceForProject(supabase: ServerSupabase, projectId: string): Promise<Evidence[]> {
  const { data, error } = await supabase
    .from('evidence')
    .select('*')
    .eq('project_id', projectId)
    .eq('visibility', 'client_visible')
    .is('deleted_at', null)
    .order('captured_at', { ascending: false });

  if (error !== null) throw error;
  return data;
}

/** ADR 0026 §3.3: promotes a held-back row to client_visible, the side effect of another module's own approval action. */
export async function releaseEvidence(supabase: ServerSupabase, evidenceId: string): Promise<Evidence> {
  const { data, error } = await supabase
    .from('evidence')
    .update({ visibility: 'client_visible' })
    .eq('id', evidenceId)
    .eq('visibility', 'visible_after_approval')
    .select()
    .maybeSingle();

  if (error !== null) throw error;
  if (data === null) {
    throw new NotFoundError(`Evidence ${evidenceId} not found, or not awaiting approval`, { meta: { evidenceId } });
  }
  return data;
}
