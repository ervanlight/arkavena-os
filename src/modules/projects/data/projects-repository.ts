import 'server-only';
import type { ServerSupabase } from '@/core/db/client.server';
import { NotFoundError } from '@/core/errors/app-error';
import type { NewProject, Project, ProjectUpdate } from '../types';

/** All direct `projects` table access lives here (ARCHITECTURE.md 1.2). */

export async function listProjects(supabase: ServerSupabase): Promise<Project[]> {
  const { data, error } = await supabase.from('projects').select('*').is('deleted_at', null).order('name');

  if (error !== null) throw error;
  return data;
}

export async function getProject(supabase: ServerSupabase, id: string): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error !== null) throw error;
  if (data === null) {
    throw new NotFoundError(`Project ${id} not found`, { meta: { projectId: id } });
  }
  return data;
}

export async function insertProject(supabase: ServerSupabase, input: NewProject): Promise<Project> {
  const { data, error } = await supabase.from('projects').insert(input).select().single();

  if (error !== null) throw error;
  return data;
}

export async function updateProject(supabase: ServerSupabase, id: string, patch: ProjectUpdate): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .update(patch)
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .maybeSingle();

  if (error !== null) throw error;
  if (data === null) {
    throw new NotFoundError(`Project ${id} not found`, { meta: { projectId: id } });
  }
  return data;
}
