import 'server-only';
import type { ServerSupabase } from '@/core/db/client.server';
import { NotFoundError } from '@/core/errors/app-error';
import type { Assessment, AssessmentUpdate, NewAssessment } from '../types';

/** All direct `assessments` table access lives here (ARCHITECTURE.md 1.2). */

export async function listAssessments(supabase: ServerSupabase): Promise<Assessment[]> {
  const { data, error } = await supabase
    .from('assessments')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error !== null) throw error;
  return data;
}

export async function listAssessmentsForSite(supabase: ServerSupabase, siteId: string): Promise<Assessment[]> {
  const { data, error } = await supabase
    .from('assessments')
    .select('*')
    .eq('site_id', siteId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error !== null) throw error;
  return data;
}

export async function getAssessment(supabase: ServerSupabase, id: string): Promise<Assessment> {
  const { data, error } = await supabase
    .from('assessments')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error !== null) throw error;
  if (data === null) {
    throw new NotFoundError(`Assessment ${id} not found`, { meta: { assessmentId: id } });
  }
  return data;
}

export async function insertAssessment(supabase: ServerSupabase, input: NewAssessment): Promise<Assessment> {
  const { data, error } = await supabase.from('assessments').insert(input).select().single();

  if (error !== null) throw error;
  return data;
}

export async function updateAssessment(
  supabase: ServerSupabase,
  id: string,
  patch: AssessmentUpdate,
): Promise<Assessment> {
  const { data, error } = await supabase
    .from('assessments')
    .update(patch)
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .maybeSingle();

  if (error !== null) throw error;
  if (data === null) {
    throw new NotFoundError(`Assessment ${id} not found`, { meta: { assessmentId: id } });
  }
  return data;
}
