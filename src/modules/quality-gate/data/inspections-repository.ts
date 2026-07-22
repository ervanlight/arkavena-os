import 'server-only';
import type { ServerSupabase } from '@/core/db/client.server';
import { InfraError, NotFoundError } from '@/core/errors/app-error';
import type { HoldPointTemplate, Inspection, InspectionUpdate, NewInspection } from '../types';

/** All direct `inspections` table access lives here (ARCHITECTURE.md 1.2). */

export async function listInspectionsForWorkPackage(
  supabase: ServerSupabase,
  workPackageId: string,
): Promise<Inspection[]> {
  const { data, error } = await supabase
    .from('inspections')
    .select('*')
    .eq('work_package_id', workPackageId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error !== null) {
    throw new InfraError(`Failed to list inspections for work package ${workPackageId}: ${error.message}`);
  }
  return data;
}

export async function getInspection(supabase: ServerSupabase, id: string): Promise<Inspection> {
  const { data, error } = await supabase.from('inspections').select('*').eq('id', id).is('deleted_at', null).maybeSingle();

  if (error !== null) {
    throw new InfraError(`Failed to load inspection ${id}: ${error.message}`);
  }
  if (data === null) {
    throw new NotFoundError(`Inspection ${id} not found`, { meta: { inspectionId: id } });
  }
  return data;
}

/**
 * The set of hold points canProceed() needs for one work package: every
 * active template for that work package's own work_type, joined against
 * whether a passing/overridden inspection already exists for it. Read-only
 * projection -- the domain function (canProceed) is what actually decides,
 * this just assembles its input from the database.
 */
export async function listHoldPointStatesForWorkPackage(
  supabase: ServerSupabase,
  workPackageId: string,
): Promise<{ templateId: string; templateName: string; required: boolean; passed: boolean; overridden: boolean }[]> {
  const { data: workPackage, error: workPackageError } = await supabase
    .from('work_packages')
    .select('organization_id, work_type')
    .eq('id', workPackageId)
    .maybeSingle();

  if (workPackageError !== null) {
    throw new InfraError(`Failed to load work package ${workPackageId}: ${workPackageError.message}`);
  }
  if (workPackage === null) {
    throw new NotFoundError(`Work package ${workPackageId} not found`, { meta: { workPackageId } });
  }
  if (workPackage.work_type === null) {
    return [];
  }

  const { data: templates, error: templatesError } = await supabase
    .from('hold_point_templates')
    .select('id, name')
    .eq('organization_id', workPackage.organization_id)
    .eq('work_type', workPackage.work_type)
    .eq('is_active', true)
    .is('deleted_at', null);

  if (templatesError !== null) {
    throw new InfraError(`Failed to load hold point templates for work package ${workPackageId}: ${templatesError.message}`);
  }

  const { data: inspections, error: inspectionsError } = await supabase
    .from('inspections')
    .select('hold_point_template_id, status, overridden_by')
    .eq('work_package_id', workPackageId)
    .is('deleted_at', null);

  if (inspectionsError !== null) {
    throw new InfraError(`Failed to load inspections for work package ${workPackageId}: ${inspectionsError.message}`);
  }

  return templates.map((template) => {
    const matching = inspections.filter((i) => i.hold_point_template_id === template.id);
    const passed = matching.some((i) => i.status === 'passed');
    const overridden = matching.some((i) => i.overridden_by !== null);
    return { templateId: template.id, templateName: template.name, required: true, passed, overridden };
  });
}

/**
 * Same join as listHoldPointStatesForWorkPackage, but for the Command Center
 * UI rather than canProceed(): a UI needs the actual `inspection.id` (to call
 * recordInspectionResultAction/overrideInspectionAction on a specific row),
 * not just booleans. When more than one inspection exists for a template
 * (nothing in the schema forbids re-inspecting after a failed attempt), the
 * most recently created one is what represents "current status".
 */
export async function listHoldPointStatusForWorkPackage(
  supabase: ServerSupabase,
  workPackageId: string,
): Promise<{ template: HoldPointTemplate; inspection: Inspection | null }[]> {
  const { data: workPackage, error: workPackageError } = await supabase
    .from('work_packages')
    .select('organization_id, work_type')
    .eq('id', workPackageId)
    .maybeSingle();

  if (workPackageError !== null) {
    throw new InfraError(`Failed to load work package ${workPackageId}: ${workPackageError.message}`);
  }
  if (workPackage === null) {
    throw new NotFoundError(`Work package ${workPackageId} not found`, { meta: { workPackageId } });
  }
  if (workPackage.work_type === null) {
    return [];
  }

  const { data: templates, error: templatesError } = await supabase
    .from('hold_point_templates')
    .select('*')
    .eq('organization_id', workPackage.organization_id)
    .eq('work_type', workPackage.work_type)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true });

  if (templatesError !== null) {
    throw new InfraError(`Failed to load hold point templates for work package ${workPackageId}: ${templatesError.message}`);
  }

  const { data: inspections, error: inspectionsError } = await supabase
    .from('inspections')
    .select('*')
    .eq('work_package_id', workPackageId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (inspectionsError !== null) {
    throw new InfraError(`Failed to load inspections for work package ${workPackageId}: ${inspectionsError.message}`);
  }

  return templates.map((template) => ({
    template,
    inspection: inspections.find((i) => i.hold_point_template_id === template.id) ?? null,
  }));
}

export async function insertInspection(supabase: ServerSupabase, input: NewInspection): Promise<Inspection> {
  const { data, error } = await supabase.from('inspections').insert(input).select().single();

  if (error !== null) {
    throw new InfraError(`Failed to create inspection: ${error.message}`);
  }
  return data;
}

export async function updateInspection(
  supabase: ServerSupabase,
  id: string,
  patch: InspectionUpdate,
): Promise<Inspection> {
  const { data, error } = await supabase
    .from('inspections')
    .update(patch)
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .maybeSingle();

  if (error !== null) {
    throw new InfraError(`Failed to update inspection ${id}: ${error.message}`);
  }
  if (data === null) {
    throw new NotFoundError(`Inspection ${id} not found`, { meta: { inspectionId: id } });
  }
  return data;
}
