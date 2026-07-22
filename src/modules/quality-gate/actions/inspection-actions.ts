'use server';

import { z } from 'zod';
import { recordAudit } from '@/core/audit/audit';
import { createAuditGateway } from '@/core/audit/gateway.server';
import { getActionContext } from '@/core/auth/session';
import { safeAction } from '@/core/actions/safe-action';
import { createServerSupabase } from '@/core/db/client.server';
import { getGateStateAction } from '@/modules/cash-gate';
import { getWorkPackage } from '@/modules/projects/server';
import { canProceed } from '../domain/hold-point';
import type { Blocked, Proceed } from '../domain/types';
import {
  getInspection,
  insertInspection,
  listHoldPointStatesForWorkPackage,
  listHoldPointStatusForWorkPackage,
  listInspectionsForWorkPackage,
  updateInspection,
} from '../data/inspections-repository';
import { createInspectionSchema, overrideInspectionSchema, recordInspectionResultSchema } from '../schemas';
import type { HoldPointTemplate, Inspection } from '../types';
import { err, type Result } from '@/core/errors/result';

export const createInspectionAction = safeAction(
  {
    schema: createInspectionSchema,
    permission: { resource: 'inspection', action: 'create' },
    loadContext: getActionContext,
    name: 'qualityGate.createInspection',
  },
  async (input, ctx): Promise<Inspection> => {
    const supabase = await createServerSupabase();
    const inspection = await insertInspection(supabase, {
      organization_id: ctx.organizationId,
      project_id: input.projectId,
      work_package_id: input.workPackageId,
      zone_id: input.zoneId,
      hold_point_template_id: input.holdPointTemplateId,
      notes: input.notes ?? null,
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'inspections',
      entityId: inspection.id,
      action: 'insert',
      newValue: inspection,
      projectId: inspection.project_id,
      requestId: ctx.requestId,
    });

    return inspection;
  },
);

export const recordInspectionResultAction = safeAction(
  {
    schema: recordInspectionResultSchema,
    permission: { resource: 'inspection', action: 'update' },
    loadContext: getActionContext,
    name: 'qualityGate.recordInspectionResult',
  },
  async (input, ctx): Promise<Inspection> => {
    const supabase = await createServerSupabase();
    const before = await getInspection(supabase, input.id);

    const after = await updateInspection(supabase, input.id, {
      status: input.status,
      inspected_by: ctx.userId,
      inspected_at: new Date().toISOString(),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'inspections',
      entityId: after.id,
      action: 'status_change',
      previousValue: before,
      newValue: after,
      projectId: after.project_id,
      requestId: ctx.requestId,
    });

    return after;
  },
);

/**
 * ARCHITECTURE.md 4.4: "Override teknis hanya oleh Technical Director +
 * reason + audit." requirePermission() gives the friendly refusal for
 * every other role; fn_inspections_guard_td_only_override (the migration)
 * is the real, unbypassable check -- this action trusts neither layer to
 * have already run and still requires a non-empty reason at the Zod
 * boundary before either one is reached.
 */
export const overrideInspectionAction = safeAction(
  {
    schema: overrideInspectionSchema,
    permission: { resource: 'inspection', action: 'override' },
    loadContext: getActionContext,
    name: 'qualityGate.overrideInspection',
  },
  async (input, ctx): Promise<Inspection> => {
    const supabase = await createServerSupabase();
    const before = await getInspection(supabase, input.id);

    const after = await updateInspection(supabase, input.id, {
      overridden_by: ctx.userId,
      override_reason: input.reason,
      overridden_at: new Date().toISOString(),
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'inspections',
      entityId: after.id,
      action: 'override',
      reason: input.reason,
      previousValue: before,
      newValue: after,
      projectId: after.project_id,
      requestId: ctx.requestId,
    });

    return after;
  },
);

export const listInspectionsForWorkPackageAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'inspection', action: 'view' },
    loadContext: getActionContext,
    name: 'qualityGate.listInspectionsForWorkPackage',
  },
  async (workPackageId): Promise<Inspection[]> => {
    const supabase = await createServerSupabase();
    return listInspectionsForWorkPackage(supabase, workPackageId);
  },
);

/**
 * The read-only "why is this work package blocked" check a UI calls before
 * offering to start a work package -- assembles canProceed()'s input from
 * this module's own hold-point state plus modules/cash-gate's public
 * getGateStateAction (ARCHITECTURE.md 1.2: another module's data only
 * through its public API), then hands the decision to the pure domain
 * function. This is advisory for the UI only -- trg_work_packages_guard_
 * hold_point and trg_work_packages_guard_cash_gate are what actually
 * enforce it (CLAUDE.md 0.3), independently of whatever this read says.
 */
export const getWorkPackageProceedStatusAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'inspection', action: 'view' },
    loadContext: getActionContext,
    name: 'qualityGate.getWorkPackageProceedStatus',
  },
  async (workPackageId): Promise<Result<Proceed, Blocked>> => {
    const supabase = await createServerSupabase();
    const workPackage = await getWorkPackage(supabase, workPackageId);
    const holdPoints = await listHoldPointStatesForWorkPackage(supabase, workPackageId);
    const gateResult = await getGateStateAction(workPackage.project_id);

    if (!gateResult.ok) {
      return err({ reasons: [gateResult.error.message] });
    }

    return canProceed({
      workPackage: { id: workPackage.id, name: workPackage.name },
      holdPoints,
      cashGate: gateResult.data.status,
    });
  },
);

/**
 * Command Center's view of a work package's hold points: unlike
 * getWorkPackageProceedStatusAction (a yes/no advisory), this exposes the
 * actual Inspection row (or null) behind each template so the UI has an id
 * to call recordInspectionResultAction/overrideInspectionAction on.
 */
export const listHoldPointStatusForWorkPackageAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'inspection', action: 'view' },
    loadContext: getActionContext,
    name: 'qualityGate.listHoldPointStatusForWorkPackage',
  },
  async (workPackageId): Promise<{ template: HoldPointTemplate; inspection: Inspection | null }[]> => {
    const supabase = await createServerSupabase();
    return listHoldPointStatusForWorkPackage(supabase, workPackageId);
  },
);
