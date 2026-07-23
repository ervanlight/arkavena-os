'use server';

import { z } from 'zod';
import { recordAudit } from '@/core/audit/audit';
import { createAuditGateway } from '@/core/audit/gateway.server';
import { getActionContext } from '@/core/auth/session';
import { safeAction } from '@/core/actions/safe-action';
import { createServerSupabase } from '@/core/db/client.server';
import { computeNextDueDate } from '../domain/maintenance-schedule';
import {
  getMaintenancePlan,
  insertMaintenancePlan,
  listMaintenancePlansForAsset,
  updateMaintenancePlan,
} from '../data/maintenance-plans-repository';
import {
  createMaintenancePlanSchema,
  markMaintenancePlanCompletedSchema,
  updateMaintenancePlanSchema,
} from '../schemas';
import type { MaintenancePlan } from '../types';

export const createMaintenancePlanAction = safeAction(
  {
    schema: createMaintenancePlanSchema,
    permission: { resource: 'maintenance_plan', action: 'create' },
    loadContext: getActionContext,
    name: 'maintenanceEngine.createMaintenancePlan',
  },
  async (input, ctx): Promise<MaintenancePlan> => {
    const supabase = await createServerSupabase();
    const plan = await insertMaintenancePlan(supabase, {
      organization_id: ctx.organizationId,
      asset_id: input.assetId,
      title: input.title,
      interval_days: input.intervalDays,
      starts_at: input.startsAt,
      notes: input.notes ?? null,
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'maintenance_plans',
      entityId: plan.id,
      action: 'insert',
      newValue: plan,
      requestId: ctx.requestId,
    });

    return plan;
  },
);

export const updateMaintenancePlanAction = safeAction(
  {
    schema: updateMaintenancePlanSchema,
    permission: { resource: 'maintenance_plan', action: 'update' },
    loadContext: getActionContext,
    name: 'maintenanceEngine.updateMaintenancePlan',
  },
  async (input, ctx): Promise<MaintenancePlan> => {
    const supabase = await createServerSupabase();
    const before = await getMaintenancePlan(supabase, input.id);

    const after = await updateMaintenancePlan(supabase, input.id, {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.intervalDays !== undefined ? { interval_days: input.intervalDays } : {}),
      ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'maintenance_plans',
      entityId: after.id,
      action: 'update',
      previousValue: before,
      newValue: after,
      requestId: ctx.requestId,
    });

    return after;
  },
);

/** Sets last_completed_at from the server clock, never client input (same "server sets what the trail must trust" reasoning as completeAssessmentAction). */
export const markMaintenancePlanCompletedAction = safeAction(
  {
    schema: markMaintenancePlanCompletedSchema,
    permission: { resource: 'maintenance_plan', action: 'update' },
    loadContext: getActionContext,
    name: 'maintenanceEngine.markMaintenancePlanCompleted',
  },
  async (input, ctx): Promise<MaintenancePlan> => {
    const supabase = await createServerSupabase();
    const before = await getMaintenancePlan(supabase, input.id);

    const after = await updateMaintenancePlan(supabase, input.id, {
      last_completed_at: new Date().toISOString().slice(0, 10),
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'maintenance_plans',
      entityId: after.id,
      action: 'update',
      previousValue: before,
      newValue: after,
      requestId: ctx.requestId,
    });

    return after;
  },
);

export const listMaintenancePlansForAssetAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'maintenance_plan', action: 'view' },
    loadContext: getActionContext,
    name: 'maintenanceEngine.listMaintenancePlansForAsset',
  },
  async (assetId): Promise<MaintenancePlan[]> => {
    const supabase = await createServerSupabase();
    return listMaintenancePlansForAsset(supabase, assetId);
  },
);

export const getMaintenancePlanAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'maintenance_plan', action: 'view' },
    loadContext: getActionContext,
    name: 'maintenanceEngine.getMaintenancePlan',
  },
  async (id): Promise<MaintenancePlan> => {
    const supabase = await createServerSupabase();
    return getMaintenancePlan(supabase, id);
  },
);

export type MaintenancePlanWithSchedule = {
  readonly plan: MaintenancePlan;
  readonly nextDueDate: string;
  readonly overdue: boolean;
};

/** Assembles a plan with its computed next_due_date/overdue (ADR 0019 SS5) -- request-time only, nothing stored. Date<->epoch-ms conversion happens here, at the boundary; the domain function itself only ever sees numbers (ARCHITECTURE.md 4.1). */
export const getMaintenancePlanWithScheduleAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'maintenance_plan', action: 'view' },
    loadContext: getActionContext,
    name: 'maintenanceEngine.getMaintenancePlanWithSchedule',
  },
  async (id): Promise<MaintenancePlanWithSchedule> => {
    const supabase = await createServerSupabase();
    const plan = await getMaintenancePlan(supabase, id);
    const schedule = computeNextDueDate({
      intervalDays: plan.interval_days,
      startsAtMs: Date.parse(plan.starts_at),
      lastCompletedAtMs: plan.last_completed_at !== null ? Date.parse(plan.last_completed_at) : null,
      nowMs: Date.now(),
    });

    return {
      plan,
      nextDueDate: new Date(schedule.nextDueDateMs).toISOString().slice(0, 10),
      overdue: schedule.overdue,
    };
  },
);
