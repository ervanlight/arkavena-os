import 'server-only';
import type { ServerSupabase } from '@/core/db/client.server';
import { InfraError, NotFoundError } from '@/core/errors/app-error';
import type { Issue, IssueUpdate, NewIssue } from '../types';

/** All direct `issues` table access lives here (ARCHITECTURE.md 1.2). */

export async function listIssuesForProject(supabase: ServerSupabase, projectId: string): Promise<Issue[]> {
  const { data, error } = await supabase
    .from('issues')
    .select('*')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error !== null) {
    throw new InfraError(`Failed to list issues for project ${projectId}: ${error.message}`);
  }
  return data;
}

export async function getIssue(supabase: ServerSupabase, id: string): Promise<Issue> {
  const { data, error } = await supabase.from('issues').select('*').eq('id', id).is('deleted_at', null).maybeSingle();

  if (error !== null) {
    throw new InfraError(`Failed to load issue ${id}: ${error.message}`);
  }
  if (data === null) {
    throw new NotFoundError(`Issue ${id} not found`, { meta: { issueId: id } });
  }
  return data;
}

/** Upsert by id -- see daily-logs-repository.ts's comment; same offline-replay reasoning applies to every table in this module. */
export async function insertIssue(supabase: ServerSupabase, input: NewIssue): Promise<Issue> {
  const { data, error } = await supabase.from('issues').upsert(input).select().single();

  if (error !== null) {
    throw new InfraError(`Failed to create issue: ${error.message}`);
  }
  return data;
}

export async function updateIssue(supabase: ServerSupabase, id: string, patch: IssueUpdate): Promise<Issue> {
  const { data, error } = await supabase.from('issues').update(patch).eq('id', id).is('deleted_at', null).select().maybeSingle();

  if (error !== null) {
    throw new InfraError(`Failed to update issue ${id}: ${error.message}`);
  }
  if (data === null) {
    throw new NotFoundError(`Issue ${id} not found`, { meta: { issueId: id } });
  }
  return data;
}
