import 'server-only';
import type { ServerSupabase } from '@/core/db/client.server';
import type { NewProjectCompletionSignoff, ProjectCompletionSignoff } from '../types';

/** All direct `project_completion_signoffs` table access lives here (ARCHITECTURE.md 1.2). Append-only -- no update/delete function. */

export async function getProjectCompletionSignoffForProject(
  supabase: ServerSupabase,
  projectId: string,
): Promise<ProjectCompletionSignoff | null> {
  const { data, error } = await supabase
    .from('project_completion_signoffs')
    .select('*')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error !== null) throw error;
  return data;
}

export async function insertProjectCompletionSignoff(
  supabase: ServerSupabase,
  input: NewProjectCompletionSignoff,
): Promise<ProjectCompletionSignoff> {
  const { data, error } = await supabase.from('project_completion_signoffs').insert(input).select().single();

  if (error !== null) throw error;
  return data;
}
