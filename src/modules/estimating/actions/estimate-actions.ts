'use server';

import { z } from 'zod';
import type { BasisPoints } from '@/core/money/rupiah';
import { recordAudit } from '@/core/audit/audit';
import { createAuditGateway } from '@/core/audit/gateway.server';
import { getActionContext } from '@/core/auth/session';
import { safeAction } from '@/core/actions/safe-action';
import { createServerSupabase } from '@/core/db/client.server';
import { computeMargin, isBelowMarginFloor, type MarginResult } from '../domain/margin';
import {
  getEstimate,
  getOrganizationMarginFloorBp,
  insertEstimate,
  listEstimatesForProject,
  setBaselineEstimate,
  updateEstimate,
} from '../data/estimates-repository';
import { listEstimateItemsForEstimate } from '../data/estimate-items-repository';
import { createEstimateSchema, setBaselineEstimateSchema, updateEstimateSchema } from '../schemas';
import type { Estimate, EstimateItem } from '../types';

export const createEstimateAction = safeAction(
  {
    schema: createEstimateSchema,
    permission: { resource: 'estimate', action: 'create' },
    loadContext: getActionContext,
    name: 'estimating.createEstimate',
  },
  async (input, ctx): Promise<Estimate> => {
    const supabase = await createServerSupabase();

    // version is an integer sequence per project (ADR 0018 SS4) -- the next
    // one is simply one past whatever already exists, 1 for the first.
    const existing = await listEstimatesForProject(supabase, input.projectId);
    const nextVersion = existing.reduce((max, e) => Math.max(max, e.version), 0) + 1;

    const estimate = await insertEstimate(supabase, {
      organization_id: ctx.organizationId,
      project_id: input.projectId,
      assessment_id: input.assessmentId ?? null,
      version: nextVersion,
      title: input.title,
      notes: input.notes ?? null,
      created_by: ctx.userId,
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'estimates',
      entityId: estimate.id,
      action: 'insert',
      newValue: estimate,
      projectId: estimate.project_id,
      requestId: ctx.requestId,
    });

    return estimate;
  },
);

export const updateEstimateAction = safeAction(
  {
    schema: updateEstimateSchema,
    permission: { resource: 'estimate', action: 'update' },
    loadContext: getActionContext,
    name: 'estimating.updateEstimate',
  },
  async (input, ctx): Promise<Estimate> => {
    const supabase = await createServerSupabase();
    const before = await getEstimate(supabase, input.id);

    const after = await updateEstimate(supabase, input.id, {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'estimates',
      entityId: after.id,
      action: 'update',
      previousValue: before,
      newValue: after,
      projectId: after.project_id,
      requestId: ctx.requestId,
    });

    return after;
  },
);

/**
 * `uq_estimates_one_baseline_per_project` makes "exactly one" a database
 * fact; this just calls the atomic RPC (fn_set_baseline_estimate) that
 * unsets whichever estimate held it before, in the same transaction (ADR
 * 0018 SS4).
 */
export const setBaselineEstimateAction = safeAction(
  {
    schema: setBaselineEstimateSchema,
    permission: { resource: 'estimate', action: 'set_baseline' },
    loadContext: getActionContext,
    name: 'estimating.setBaselineEstimate',
  },
  async (input, ctx): Promise<Estimate> => {
    const supabase = await createServerSupabase();
    const before = await getEstimate(supabase, input.id);
    const after = await setBaselineEstimate(supabase, input.id);

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'estimates',
      entityId: after.id,
      action: 'update',
      previousValue: { is_baseline: before.is_baseline },
      newValue: { is_baseline: after.is_baseline },
      projectId: after.project_id,
      requestId: ctx.requestId,
    });

    return after;
  },
);

export const listEstimatesForProjectAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'estimate', action: 'view' },
    loadContext: getActionContext,
    name: 'estimating.listEstimatesForProject',
  },
  async (projectId): Promise<Estimate[]> => {
    const supabase = await createServerSupabase();
    return listEstimatesForProject(supabase, projectId);
  },
);

export const getEstimateAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'estimate', action: 'view' },
    loadContext: getActionContext,
    name: 'estimating.getEstimate',
  },
  async (id): Promise<Estimate> => {
    const supabase = await createServerSupabase();
    return getEstimate(supabase, id);
  },
);

export type EstimateWithMargin = {
  readonly estimate: Estimate;
  readonly items: EstimateItem[];
  readonly margin: MarginResult;
  readonly marginFloorBp: BasisPoints;
  readonly belowMarginFloor: boolean;
};

/**
 * Assembles an estimate with its computed margin and the org's floor
 * (ADR 0018 SS4) -- request-time, nothing here is stored. `belowMarginFloor`
 * is what the UI renders as a warning banner, never a blocking condition.
 */
export const getEstimateWithMarginAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'estimate', action: 'view' },
    loadContext: getActionContext,
    name: 'estimating.getEstimateWithMargin',
  },
  async (id, ctx): Promise<EstimateWithMargin> => {
    const supabase = await createServerSupabase();
    const estimate = await getEstimate(supabase, id);
    const items = await listEstimateItemsForEstimate(supabase, id);
    const marginFloorBp = await getOrganizationMarginFloorBp(supabase, ctx.organizationId);

    const margin = computeMargin(items.map((item) => ({ quantity: item.quantity, unitCost: item.unit_cost, unitPrice: item.unit_price })));
    const belowMarginFloor = isBelowMarginFloor(margin.marginBp, marginFloorBp);

    return { estimate, items, margin, marginFloorBp, belowMarginFloor };
  },
);
