import 'server-only';
import type { ServerSupabase } from '@/core/db/client.server';
import { NotFoundError } from '@/core/errors/app-error';
import type { MaintenancePlan, MaintenancePlanUpdate, NewMaintenancePlan } from '../types';

/** All direct `maintenance_plans` table access lives here (ARCHITECTURE.md 1.2). */

export async function listMaintenancePlansForAsset(
  supabase: ServerSupabase,
  assetId: string,
): Promise<MaintenancePlan[]> {
  const { data, error } = await supabase
    .from('maintenance_plans')
    .select('*')
    .eq('asset_id', assetId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error !== null) throw error;
  return data;
}

export async function getMaintenancePlan(supabase: ServerSupabase, id: string): Promise<MaintenancePlan> {
  const { data, error } = await supabase
    .from('maintenance_plans')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error !== null) throw error;
  if (data === null) {
    throw new NotFoundError(`Maintenance plan ${id} not found`, { meta: { maintenancePlanId: id } });
  }
  return data;
}

export async function insertMaintenancePlan(
  supabase: ServerSupabase,
  input: NewMaintenancePlan,
): Promise<MaintenancePlan> {
  const { data, error } = await supabase.from('maintenance_plans').insert(input).select().single();

  if (error !== null) throw error;
  return data;
}

export async function updateMaintenancePlan(
  supabase: ServerSupabase,
  id: string,
  patch: MaintenancePlanUpdate,
): Promise<MaintenancePlan> {
  const { data, error } = await supabase
    .from('maintenance_plans')
    .update(patch)
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .maybeSingle();

  if (error !== null) throw error;
  if (data === null) {
    throw new NotFoundError(`Maintenance plan ${id} not found`, { meta: { maintenancePlanId: id } });
  }
  return data;
}
