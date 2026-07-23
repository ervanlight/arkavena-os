import 'server-only';
import type { ServerSupabase } from '@/core/db/client.server';
import { NotFoundError } from '@/core/errors/app-error';
import type { NewWarranty, Warranty, WarrantyUpdate } from '../types';

/** All direct `warranties` table access lives here (ARCHITECTURE.md 1.2). */

export async function listWarrantiesForProject(supabase: ServerSupabase, projectId: string): Promise<Warranty[]> {
  const { data, error } = await supabase
    .from('warranties')
    .select('*')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .order('ends_at', { ascending: true });

  if (error !== null) throw error;
  return data;
}

export async function getWarranty(supabase: ServerSupabase, id: string): Promise<Warranty> {
  const { data, error } = await supabase.from('warranties').select('*').eq('id', id).is('deleted_at', null).maybeSingle();

  if (error !== null) throw error;
  if (data === null) {
    throw new NotFoundError(`Warranty ${id} not found`, { meta: { warrantyId: id } });
  }
  return data;
}

export async function insertWarranty(supabase: ServerSupabase, input: NewWarranty): Promise<Warranty> {
  const { data, error } = await supabase.from('warranties').insert(input).select().single();

  if (error !== null) throw error;
  return data;
}

export async function updateWarranty(supabase: ServerSupabase, id: string, patch: WarrantyUpdate): Promise<Warranty> {
  const { data, error } = await supabase
    .from('warranties')
    .update(patch)
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .maybeSingle();

  if (error !== null) throw error;
  if (data === null) {
    throw new NotFoundError(`Warranty ${id} not found`, { meta: { warrantyId: id } });
  }
  return data;
}
