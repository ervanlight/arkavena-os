import 'server-only';
import type { ServerSupabase } from '@/core/db/client.server';
import type { EvidenceOverrideRow } from '../types';
import type { WorkPackage } from '@/modules/projects';

export async function listOverridesForProject(supabase: ServerSupabase, projectId: string): Promise<EvidenceOverrideRow[]> {
  const { data, error } = await supabase
    .from('evidence_overrides')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error !== null) throw error;
  return data;
}

/**
 * The one write path for an override that actually unblocks something --
 * ADR 0029 Decision 1's atomic RPC (fn_override_evidence_gate), same shape
 * as ADR 0010's fn_override_and_open_work_package. Records the override and
 * completes the work package in a single transaction; RLS and
 * trg_evidence_overrides_guard_td_only both still apply to the calling
 * user, so this grants no privilege the database itself does not also check.
 */
export async function overrideEvidenceGate(supabase: ServerSupabase, workPackageId: string, reason: string): Promise<WorkPackage> {
  const { data, error } = await supabase
    .rpc('fn_override_evidence_gate', { p_work_package_id: workPackageId, p_reason: reason })
    .single();

  if (error !== null) throw error;
  return data;
}
