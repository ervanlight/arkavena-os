import 'server-only';
import type { ServerSupabase } from '@/core/db/client.server';
import { InfraError, NotFoundError } from '@/core/errors/app-error';
import type { MaterialRequest, MaterialRequestUpdate, NewMaterialRequest } from '../types';

/** All direct `material_requests` table access lives here (ARCHITECTURE.md 1.2). */

export async function listMaterialRequestsForProject(
  supabase: ServerSupabase,
  projectId: string,
): Promise<MaterialRequest[]> {
  const { data, error } = await supabase
    .from('material_requests')
    .select('*')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error !== null) {
    throw new InfraError(`Failed to list material requests for project ${projectId}: ${error.message}`);
  }
  return data;
}

export async function getMaterialRequest(supabase: ServerSupabase, id: string): Promise<MaterialRequest> {
  const { data, error } = await supabase
    .from('material_requests')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error !== null) {
    throw new InfraError(`Failed to load material request ${id}: ${error.message}`);
  }
  if (data === null) {
    throw new NotFoundError(`Material request ${id} not found`, { meta: { materialRequestId: id } });
  }
  return data;
}

/** Upsert by id -- see daily-logs-repository.ts's comment; same offline-replay reasoning applies to every table in this module. */
export async function insertMaterialRequest(
  supabase: ServerSupabase,
  input: NewMaterialRequest,
): Promise<MaterialRequest> {
  const { data, error } = await supabase.from('material_requests').upsert(input).select().single();

  if (error !== null) {
    throw new InfraError(`Failed to create material request: ${error.message}`);
  }
  return data;
}

export async function updateMaterialRequest(
  supabase: ServerSupabase,
  id: string,
  patch: MaterialRequestUpdate,
): Promise<MaterialRequest> {
  const { data, error } = await supabase
    .from('material_requests')
    .update(patch)
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .maybeSingle();

  if (error !== null) {
    throw new InfraError(`Failed to update material request ${id}: ${error.message}`);
  }
  if (data === null) {
    throw new NotFoundError(`Material request ${id} not found`, { meta: { materialRequestId: id } });
  }
  return data;
}
