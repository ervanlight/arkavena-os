import 'server-only';
import type { ServerSupabase } from '@/core/db/client.server';
import type { Enums } from '@/core/db/database.types';
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

/**
 * A narrow, purpose-built read for another module -- ARCHITECTURE.md 1.2's
 * own example ("panggil projects.getMilestoneFunding(projectId)"). Used by
 * modules/scope-variation to resolve a client_approver's role on a specific
 * project, since ActionContext.orgRole only ever carries an org_role and is
 * always null for project-role-only users (a known gap, tracked separately
 * -- see the flagged follow-up task). RLS's own project_members_select_self
 * policy already scopes a non-staff caller to their own row, so passing the
 * caller's own userId here needs no elevated client.
 */
export async function getMyProjectRole(
  supabase: ServerSupabase,
  projectId: string,
  userId: string,
): Promise<Enums<'project_role'> | null> {
  const { data, error } = await supabase
    .from('project_members')
    .select('project_role')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error !== null) {
    throw new InfraError(`Failed to load project role for user ${userId} on project ${projectId}: ${error.message}`);
  }
  return data?.project_role ?? null;
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
