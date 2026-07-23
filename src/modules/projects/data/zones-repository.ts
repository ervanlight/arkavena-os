import 'server-only';
import type { ServerSupabase } from '@/core/db/client.server';
import { NotFoundError } from '@/core/errors/app-error';
import type { NewZone, Zone, ZoneUpdate } from '../types';

/** All direct `zones` table access lives here (ARCHITECTURE.md 1.2). */

export async function listZonesForProject(supabase: ServerSupabase, projectId: string): Promise<Zone[]> {
  const { data, error } = await supabase
    .from('zones')
    .select('*')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .order('name');

  if (error !== null) throw error;
  return data;
}

export async function getZone(supabase: ServerSupabase, id: string): Promise<Zone> {
  const { data, error } = await supabase.from('zones').select('*').eq('id', id).is('deleted_at', null).maybeSingle();

  if (error !== null) throw error;
  if (data === null) {
    throw new NotFoundError(`Zone ${id} not found`, { meta: { zoneId: id } });
  }
  return data;
}

export async function insertZone(supabase: ServerSupabase, input: NewZone): Promise<Zone> {
  const { data, error } = await supabase.from('zones').insert(input).select().single();

  if (error !== null) throw error;
  return data;
}

export async function updateZone(supabase: ServerSupabase, id: string, patch: ZoneUpdate): Promise<Zone> {
  const { data, error } = await supabase
    .from('zones')
    .update(patch)
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .maybeSingle();

  if (error !== null) throw error;
  if (data === null) {
    throw new NotFoundError(`Zone ${id} not found`, { meta: { zoneId: id } });
  }
  return data;
}
