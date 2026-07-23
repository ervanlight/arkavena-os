import 'server-only';
import type { ServerSupabase } from '@/core/db/client.server';
import { NotFoundError } from '@/core/errors/app-error';
import type { Estimate, EstimateUpdate, NewEstimate } from '../types';

/** All direct `estimates` table access lives here (ARCHITECTURE.md 1.2). */

export async function listEstimatesForProject(supabase: ServerSupabase, projectId: string): Promise<Estimate[]> {
  const { data, error } = await supabase
    .from('estimates')
    .select('*')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .order('version', { ascending: false });

  if (error !== null) throw error;
  return data;
}

export async function getEstimate(supabase: ServerSupabase, id: string): Promise<Estimate> {
  const { data, error } = await supabase
    .from('estimates')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error !== null) throw error;
  if (data === null) {
    throw new NotFoundError(`Estimate ${id} not found`, { meta: { estimateId: id } });
  }
  return data;
}

export async function insertEstimate(supabase: ServerSupabase, input: NewEstimate): Promise<Estimate> {
  const { data, error } = await supabase.from('estimates').insert(input).select().single();

  if (error !== null) throw error;
  return data;
}

export async function updateEstimate(supabase: ServerSupabase, id: string, patch: EstimateUpdate): Promise<Estimate> {
  const { data, error } = await supabase
    .from('estimates')
    .update(patch)
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .maybeSingle();

  if (error !== null) throw error;
  if (data === null) {
    throw new NotFoundError(`Estimate ${id} not found`, { meta: { estimateId: id } });
  }
  return data;
}

/**
 * `organizations` predates the module system (Wave 1) and is not owned by
 * any single business module -- the same reason `core/auth/session.ts`
 * already queries it directly rather than through a repository of its own.
 * `margin_floor_bp` is a plain basis-points integer, no Rupiah conversion.
 */
export async function getOrganizationMarginFloorBp(supabase: ServerSupabase, organizationId: string): Promise<number> {
  const { data, error } = await supabase
    .from('organizations')
    .select('margin_floor_bp')
    .eq('id', organizationId)
    .single();

  if (error !== null) throw error;
  return data.margin_floor_bp;
}

/**
 * The one write path that ever sets `is_baseline` (ADR 0018 SS4) --
 * fn_set_baseline_estimate (20260723040000) unsets the project's previous
 * baseline and sets the new one in a single transaction, mirroring
 * overrideAndOpenWorkPackage's own RPC pattern (Fase 2, ADR 0010).
 */
export async function setBaselineEstimate(supabase: ServerSupabase, id: string): Promise<Estimate> {
  const { data, error } = await supabase.rpc('fn_set_baseline_estimate', { p_estimate_id: id }).single();

  if (error !== null) throw error;
  return data;
}
