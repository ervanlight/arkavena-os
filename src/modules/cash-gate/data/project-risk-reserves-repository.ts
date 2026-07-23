import 'server-only';
import { rupiahFromColumn, rupiahToColumn, ZERO_RP, type Rupiah } from '@/core/money/rupiah';
import type { ServerSupabase } from '@/core/db/client.server';
import type { Tables } from '@/core/db/database.types';
import type { ProjectRiskReserve } from '../types';

/**
 * All direct `project_risk_reserves` table access lives here (ARCHITECTURE.md
 * 1.2). Moved off `projects` by ADR 0011: that table's `projects_select_member`
 * policy gives every project role -- including client-facing ones -- full-row
 * read access, which leaked this money figure to them. This table has no
 * project-role policy at all, same as funding_receipts/cash_forecasts.
 */

function toProjectRiskReserve(row: Tables<'project_risk_reserves'>): ProjectRiskReserve {
  return { ...row, risk_reserve_amount: rupiahFromColumn(row.risk_reserve_amount) };
}

/**
 * A project with no row here yet has never had a buffer configured -- `0`,
 * the same meaning the column's own default carried before ADR 0011, not an
 * error.
 */
export async function getProjectRiskReserve(supabase: ServerSupabase, projectId: string): Promise<Rupiah> {
  const { data, error } = await supabase
    .from('project_risk_reserves')
    .select('risk_reserve_amount')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error !== null) throw error;
  return data === null ? ZERO_RP : rupiahFromColumn(data.risk_reserve_amount);
}

export async function getProjectRiskReserveRow(
  supabase: ServerSupabase,
  projectId: string,
): Promise<ProjectRiskReserve | null> {
  const { data, error } = await supabase
    .from('project_risk_reserves')
    .select('*')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error !== null) throw error;
  return data === null ? null : toProjectRiskReserve(data);
}

/** Owner/Finance setting the buffer -- an upsert, since there is at most one row per project. */
export async function upsertProjectRiskReserve(
  supabase: ServerSupabase,
  organizationId: string,
  projectId: string,
  amount: Rupiah,
): Promise<ProjectRiskReserve> {
  const { data, error } = await supabase
    .from('project_risk_reserves')
    .upsert(
      { organization_id: organizationId, project_id: projectId, risk_reserve_amount: rupiahToColumn(amount) },
      { onConflict: 'project_id' },
    )
    .select('*')
    .single();

  if (error !== null) throw error;
  return toProjectRiskReserve(data);
}
