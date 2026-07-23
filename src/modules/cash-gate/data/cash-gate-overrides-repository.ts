import 'server-only';
import type { ServerSupabase } from '@/core/db/client.server';
import type { CashGateOverrideRow, WorkPackage } from '../types';

/** All direct `cash_gate_overrides` table access lives here (ARCHITECTURE.md 1.2). */

export async function listOverridesForProject(
  supabase: ServerSupabase,
  projectId: string,
): Promise<CashGateOverrideRow[]> {
  const { data, error } = await supabase
    .from('cash_gate_overrides')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error !== null) throw error;
  return data;
}

/**
 * The one write path for an override that actually unblocks something --
 * ADR 0010's atomic RPC (20260721000700). Records the override and opens the
 * work package in a single transaction; RLS and
 * trg_cash_gate_overrides_guard_owner_only both still apply to the calling
 * user, so this grants no privilege the database itself does not also check.
 */
export async function overrideAndOpenWorkPackage(
  supabase: ServerSupabase,
  workPackageId: string,
  reason: string,
): Promise<WorkPackage> {
  const { data, error } = await supabase
    .rpc('fn_override_and_open_work_package', { p_work_package_id: workPackageId, p_reason: reason })
    .single();

  if (error !== null) throw error;
  return data;
}
