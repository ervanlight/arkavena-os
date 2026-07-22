import 'server-only';
import type { ServerSupabase } from '@/core/db/client.server';
import { InfraError, NotFoundError } from '@/core/errors/app-error';
import type { NewNonconformity, Nonconformity, NonconformityUpdate } from '../types';

/** All direct `nonconformities` table access lives here (ARCHITECTURE.md 1.2). */

export async function listNonconformitiesForInspection(
  supabase: ServerSupabase,
  inspectionId: string,
): Promise<Nonconformity[]> {
  const { data, error } = await supabase
    .from('nonconformities')
    .select('*')
    .eq('inspection_id', inspectionId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error !== null) {
    throw new InfraError(`Failed to list nonconformities for inspection ${inspectionId}: ${error.message}`);
  }
  return data;
}

export async function getNonconformity(supabase: ServerSupabase, id: string): Promise<Nonconformity> {
  const { data, error } = await supabase
    .from('nonconformities')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error !== null) {
    throw new InfraError(`Failed to load nonconformity ${id}: ${error.message}`);
  }
  if (data === null) {
    throw new NotFoundError(`Nonconformity ${id} not found`, { meta: { nonconformityId: id } });
  }
  return data;
}

export async function insertNonconformity(supabase: ServerSupabase, input: NewNonconformity): Promise<Nonconformity> {
  const { data, error } = await supabase.from('nonconformities').insert(input).select().single();

  if (error !== null) {
    throw new InfraError(`Failed to create nonconformity: ${error.message}`);
  }
  return data;
}

export async function updateNonconformity(
  supabase: ServerSupabase,
  id: string,
  patch: NonconformityUpdate,
): Promise<Nonconformity> {
  const { data, error } = await supabase
    .from('nonconformities')
    .update(patch)
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .maybeSingle();

  if (error !== null) {
    throw new InfraError(`Failed to update nonconformity ${id}: ${error.message}`);
  }
  if (data === null) {
    throw new NotFoundError(`Nonconformity ${id} not found`, { meta: { nonconformityId: id } });
  }
  return data;
}
