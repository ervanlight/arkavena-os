import 'server-only';
import type { ServerSupabase } from '@/core/db/client.server';
import { InfraError, NotFoundError } from '@/core/errors/app-error';
import type { NewProjectMember, ProjectMember } from '../types';

/** All direct `project_members` table access lives here (ARCHITECTURE.md 1.2). */

export async function listProjectMembers(supabase: ServerSupabase, projectId: string): Promise<ProjectMember[]> {
  const { data, error } = await supabase
    .from('project_members')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at');

  if (error !== null) {
    throw new InfraError(`Failed to list members for project ${projectId}: ${error.message}`);
  }
  return data;
}

export async function getProjectMember(supabase: ServerSupabase, id: string): Promise<ProjectMember> {
  const { data, error } = await supabase.from('project_members').select('*').eq('id', id).maybeSingle();

  if (error !== null) {
    throw new InfraError(`Failed to load project member ${id}: ${error.message}`);
  }
  if (data === null) {
    throw new NotFoundError(`Project member ${id} not found`, { meta: { projectMemberId: id } });
  }
  return data;
}

export async function insertProjectMember(
  supabase: ServerSupabase,
  input: NewProjectMember,
): Promise<ProjectMember> {
  const { data, error } = await supabase.from('project_members').insert(input).select().single();

  if (error !== null) {
    throw new InfraError(`Failed to add project member: ${error.message}`);
  }
  return data;
}

export async function deleteProjectMember(supabase: ServerSupabase, id: string): Promise<void> {
  const { error } = await supabase.from('project_members').delete().eq('id', id);

  if (error !== null) {
    throw new InfraError(`Failed to remove project member ${id}: ${error.message}`);
  }
}
