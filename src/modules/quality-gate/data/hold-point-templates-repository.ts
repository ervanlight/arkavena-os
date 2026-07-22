import 'server-only';
import type { ServerSupabase } from '@/core/db/client.server';
import { InfraError, NotFoundError } from '@/core/errors/app-error';
import type { HoldPointTemplate, HoldPointTemplateUpdate, NewHoldPointTemplate } from '../types';

/** All direct `hold_point_templates` table access lives here (ARCHITECTURE.md 1.2). */

export async function listHoldPointTemplatesForWorkType(
  supabase: ServerSupabase,
  workType: string,
): Promise<HoldPointTemplate[]> {
  const { data, error } = await supabase
    .from('hold_point_templates')
    .select('*')
    .eq('work_type', workType)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('sort_order');

  if (error !== null) {
    throw new InfraError(`Failed to list hold point templates for work type ${workType}: ${error.message}`);
  }
  return data;
}

export async function listHoldPointTemplates(supabase: ServerSupabase): Promise<HoldPointTemplate[]> {
  const { data, error } = await supabase
    .from('hold_point_templates')
    .select('*')
    .is('deleted_at', null)
    .order('work_type')
    .order('sort_order');

  if (error !== null) {
    throw new InfraError(`Failed to list hold point templates: ${error.message}`);
  }
  return data;
}

export async function getHoldPointTemplate(supabase: ServerSupabase, id: string): Promise<HoldPointTemplate> {
  const { data, error } = await supabase
    .from('hold_point_templates')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error !== null) {
    throw new InfraError(`Failed to load hold point template ${id}: ${error.message}`);
  }
  if (data === null) {
    throw new NotFoundError(`Hold point template ${id} not found`, { meta: { holdPointTemplateId: id } });
  }
  return data;
}

export async function insertHoldPointTemplate(
  supabase: ServerSupabase,
  input: NewHoldPointTemplate,
): Promise<HoldPointTemplate> {
  const { data, error } = await supabase.from('hold_point_templates').insert(input).select().single();

  if (error !== null) {
    throw new InfraError(`Failed to create hold point template: ${error.message}`);
  }
  return data;
}

export async function updateHoldPointTemplate(
  supabase: ServerSupabase,
  id: string,
  patch: HoldPointTemplateUpdate,
): Promise<HoldPointTemplate> {
  const { data, error } = await supabase
    .from('hold_point_templates')
    .update(patch)
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .maybeSingle();

  if (error !== null) {
    throw new InfraError(`Failed to update hold point template ${id}: ${error.message}`);
  }
  if (data === null) {
    throw new NotFoundError(`Hold point template ${id} not found`, { meta: { holdPointTemplateId: id } });
  }
  return data;
}
