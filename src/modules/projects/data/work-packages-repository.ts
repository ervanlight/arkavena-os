import 'server-only';
import type { ServerSupabase } from '@/core/db/client.server';
import { NotFoundError } from '@/core/errors/app-error';
import type { NewWorkPackage, WorkPackage, WorkPackageUpdate } from '../types';

/** All direct `work_packages` table access lives here (ARCHITECTURE.md 1.2). */

export async function listWorkPackagesForProject(supabase: ServerSupabase, projectId: string): Promise<WorkPackage[]> {
  const { data, error } = await supabase
    .from('work_packages')
    .select('*')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .order('name');

  if (error !== null) throw error;
  return data;
}

export async function getWorkPackage(supabase: ServerSupabase, id: string): Promise<WorkPackage> {
  const { data, error } = await supabase
    .from('work_packages')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error !== null) throw error;
  if (data === null) {
    throw new NotFoundError(`Work package ${id} not found`, { meta: { workPackageId: id } });
  }
  return data;
}

export async function insertWorkPackage(supabase: ServerSupabase, input: NewWorkPackage): Promise<WorkPackage> {
  const { data, error } = await supabase.from('work_packages').insert(input).select().single();

  if (error !== null) throw error;
  return data;
}

export async function updateWorkPackage(
  supabase: ServerSupabase,
  id: string,
  patch: WorkPackageUpdate,
): Promise<WorkPackage> {
  const { data, error } = await supabase
    .from('work_packages')
    .update(patch)
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .maybeSingle();

  if (error !== null) throw error;
  if (data === null) {
    throw new NotFoundError(`Work package ${id} not found`, { meta: { workPackageId: id } });
  }
  return data;
}
