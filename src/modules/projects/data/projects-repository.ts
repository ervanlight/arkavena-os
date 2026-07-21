import 'server-only';
import { rupiahFromColumn, type Rupiah } from '@/core/money/rupiah';
import type { ServerSupabase } from '@/core/db/client.server';
import { InfraError, NotFoundError } from '@/core/errors/app-error';
import type { NewProject, Project, ProjectUpdate } from '../types';

/** All direct `projects` table access lives here (ARCHITECTURE.md 1.2). */

export async function listProjects(supabase: ServerSupabase): Promise<Project[]> {
  const { data, error } = await supabase.from('projects').select('*').is('deleted_at', null).order('name');

  if (error !== null) {
    throw new InfraError(`Failed to list projects: ${error.message}`);
  }
  return data;
}

export async function getProject(supabase: ServerSupabase, id: string): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error !== null) {
    throw new InfraError(`Failed to load project ${id}: ${error.message}`);
  }
  if (data === null) {
    throw new NotFoundError(`Project ${id} not found`, { meta: { projectId: id } });
  }
  return data;
}

/**
 * A narrow, purpose-built read for another module -- ARCHITECTURE.md 1.2's own
 * example is exactly this shape ("panggil projects.getMilestoneFunding(projectId),
 * bukan supabase.from('milestones') sendiri"). modules/cash-gate calls this
 * rather than querying `projects` directly, even though risk_reserve_amount
 * conceptually belongs to Cash Gate -- the column lives on a table
 * modules/projects owns, and table ownership is exclusive regardless of which
 * module's *concept* a column represents.
 */
export async function getProjectRiskReserve(supabase: ServerSupabase, projectId: string): Promise<Rupiah> {
  const { data, error } = await supabase
    .from('projects')
    .select('risk_reserve_amount')
    .eq('id', projectId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error !== null) {
    throw new InfraError(`Failed to load risk reserve for project ${projectId}: ${error.message}`);
  }
  if (data === null) {
    throw new NotFoundError(`Project ${projectId} not found`, { meta: { projectId } });
  }
  return rupiahFromColumn(data.risk_reserve_amount);
}

export async function insertProject(supabase: ServerSupabase, input: NewProject): Promise<Project> {
  const { data, error } = await supabase.from('projects').insert(input).select().single();

  if (error !== null) {
    throw new InfraError(`Failed to create project: ${error.message}`);
  }
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

  if (error !== null) {
    throw new InfraError(`Failed to update project ${id}: ${error.message}`);
  }
  if (data === null) {
    throw new NotFoundError(`Project ${id} not found`, { meta: { projectId: id } });
  }
  return data;
}
