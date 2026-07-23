import 'server-only';
import type { ServerSupabase } from '@/core/db/client.server';
import { NotFoundError } from '@/core/errors/app-error';
import type { NewPhoto, Photo, PhotoUpdate } from '../types';

/** All direct `photos` table access lives here (ARCHITECTURE.md 1.2). Uploading the actual bytes is core/storage's job, not this repository's. */

export async function listPhotosForProject(supabase: ServerSupabase, projectId: string): Promise<Photo[]> {
  const { data, error } = await supabase
    .from('photos')
    .select('*')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error !== null) throw error;
  return data;
}

export async function getPhoto(supabase: ServerSupabase, id: string): Promise<Photo> {
  const { data, error } = await supabase.from('photos').select('*').eq('id', id).is('deleted_at', null).maybeSingle();

  if (error !== null) throw error;
  if (data === null) {
    throw new NotFoundError(`Photo ${id} not found`, { meta: { photoId: id } });
  }
  return data;
}

/** Upsert by id -- see daily-logs-repository.ts's comment; same offline-replay reasoning applies to every table in this module. */
export async function insertPhoto(supabase: ServerSupabase, input: NewPhoto): Promise<Photo> {
  const { data, error } = await supabase.from('photos').upsert(input).select().single();

  if (error !== null) throw error;
  return data;
}

export async function updatePhoto(supabase: ServerSupabase, id: string, patch: PhotoUpdate): Promise<Photo> {
  const { data, error } = await supabase.from('photos').update(patch).eq('id', id).is('deleted_at', null).select().maybeSingle();

  if (error !== null) throw error;
  if (data === null) {
    throw new NotFoundError(`Photo ${id} not found`, { meta: { photoId: id } });
  }
  return data;
}
