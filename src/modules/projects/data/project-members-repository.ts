import 'server-only';
import type { ServerSupabase } from '@/core/db/client.server';
import type { Enums } from '@/core/db/database.types';
import { NotFoundError } from '@/core/errors/app-error';
import type { NewProjectMember, ProjectMember } from '../types';

/** All direct `project_members` table access lives here (ARCHITECTURE.md 1.2). */

export async function listProjectMembers(supabase: ServerSupabase, projectId: string): Promise<ProjectMember[]> {
  const { data, error } = await supabase
    .from('project_members')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at');

  if (error !== null) throw error;
  return data;
}

export async function getProjectMember(supabase: ServerSupabase, id: string): Promise<ProjectMember> {
  const { data, error } = await supabase.from('project_members').select('*').eq('id', id).maybeSingle();

  if (error !== null) throw error;
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

  if (error !== null) throw error;
  return data?.project_role ?? null;
}

/**
 * Every project_role the caller holds, across every project -- used to
 * decide where a bare magic link (no explicit `next`) should land, since
 * ActionContext.orgRole is null for every project-role-only user and there
 * is otherwise no way to tell a site_coordinator/mandor apart from a
 * client_approver at that point. RLS's project_members_select_self policy
 * already scopes this to the caller's own rows.
 */
export async function listMyProjectRoles(supabase: ServerSupabase, userId: string): Promise<Enums<'project_role'>[]> {
  const { data, error } = await supabase.from('project_members').select('project_role').eq('user_id', userId);

  if (error !== null) throw error;
  return data.map((row) => row.project_role);
}

/**
 * The projects a site_coordinator/mandor actually works on, with names --
 * SiteFlow's home page needs this to decide whether to show a project
 * picker at all (D3 assumes one coordinator per site, but nothing stops a
 * mandor from holding a role on more than one project) or go straight to
 * the six-button menu for the single project they hold. RLS's own
 * project_members_select_self policy scopes this to the caller's own rows,
 * same as listMyProjectRoles.
 */
export async function listMyFieldProjects(
  supabase: ServerSupabase,
  userId: string,
): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase
    .from('project_members')
    .select('project:projects(id, name)')
    .eq('user_id', userId)
    .in('project_role', ['site_coordinator', 'mandor', 'photo_uploader']);

  if (error !== null) throw error;
  return data.flatMap((row) => (row.project === null ? [] : [row.project]));
}

/**
 * The projects a client_approver/client_viewer actually has access to, with
 * names -- the client portal (Fase 6) needs this to build its project
 * picker/nav the same way SiteFlow's home page uses listMyFieldProjects.
 * Same RLS scoping (project_members_select_self), same shape.
 */
export async function listMyClientProjects(
  supabase: ServerSupabase,
  userId: string,
): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase
    .from('project_members')
    .select('project:projects(id, name)')
    .eq('user_id', userId)
    .in('project_role', ['client_approver', 'client_viewer']);

  if (error !== null) throw error;
  return data.flatMap((row) => (row.project === null ? [] : [row.project]));
}

/**
 * The projects a supplier actually has access to, with names -- Partner
 * Desk (Fase 11) needs this for its own project picker, same shape as
 * listMyClientProjects. Subcontractor is deliberately not included here yet
 * (ADR 0024 SS1): no subcontractor-facing feature exists to link to.
 */
export async function listMyPartnerProjects(
  supabase: ServerSupabase,
  userId: string,
): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase
    .from('project_members')
    .select('project:projects(id, name)')
    .eq('user_id', userId)
    .in('project_role', ['supplier']);

  if (error !== null) throw error;
  return data.flatMap((row) => (row.project === null ? [] : [row.project]));
}

export async function insertProjectMember(
  supabase: ServerSupabase,
  input: NewProjectMember,
): Promise<ProjectMember> {
  const { data, error } = await supabase.from('project_members').insert(input).select().single();

  if (error !== null) throw error;
  return data;
}

export async function deleteProjectMember(supabase: ServerSupabase, id: string): Promise<void> {
  const { error } = await supabase.from('project_members').delete().eq('id', id);

  if (error !== null) throw error;
}
