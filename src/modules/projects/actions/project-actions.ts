'use server';

import { z } from 'zod';
import { rupiahToColumn, toRupiah } from '@/core/money/rupiah';
import { recordAudit } from '@/core/audit/audit';
import { createAuditGateway } from '@/core/audit/gateway.server';
import { getActionContext } from '@/core/auth/session';
import { safeAction } from '@/core/actions/safe-action';
import { createServerSupabase } from '@/core/db/client.server';
import { getProject, insertProject, listProjects, updateProject } from '../data/projects-repository';
import { createProjectSchema, setRiskReserveSchema, updateProjectSchema } from '../schemas';
import type { Project } from '../types';

export const createProjectAction = safeAction(
  {
    schema: createProjectSchema,
    permission: { resource: 'project', action: 'create' },
    loadContext: getActionContext,
    name: 'projects.createProject',
  },
  async (input, ctx): Promise<Project> => {
    const supabase = await createServerSupabase();
    const project = await insertProject(supabase, {
      organization_id: ctx.organizationId,
      client_id: input.clientId,
      site_id: input.siteId,
      name: input.name,
      ...(input.startDate !== undefined ? { start_date: input.startDate } : {}),
      ...(input.targetEndDate !== undefined ? { target_end_date: input.targetEndDate } : {}),
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'projects',
      entityId: project.id,
      action: 'insert',
      newValue: project,
      projectId: project.id,
      requestId: ctx.requestId,
    });

    return project;
  },
);

export const updateProjectAction = safeAction(
  {
    schema: updateProjectSchema,
    permission: { resource: 'project', action: 'update' },
    loadContext: getActionContext,
    name: 'projects.updateProject',
  },
  async (input, ctx): Promise<Project> => {
    const supabase = await createServerSupabase();
    const before = await getProject(supabase, input.id);

    const after = await updateProject(supabase, input.id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.startDate !== undefined ? { start_date: input.startDate } : {}),
      ...(input.targetEndDate !== undefined ? { target_end_date: input.targetEndDate } : {}),
      ...(input.actualEndDate !== undefined ? { actual_end_date: input.actualEndDate } : {}),
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'projects',
      entityId: after.id,
      action: before.status !== after.status ? 'status_change' : 'update',
      previousValue: before,
      newValue: after,
      projectId: after.id,
      requestId: ctx.requestId,
    });

    return after;
  },
);

export const listProjectsAction = safeAction(
  {
    schema: z.void(),
    permission: { resource: 'project', action: 'view' },
    loadContext: getActionContext,
    name: 'projects.listProjects',
  },
  async (): Promise<Project[]> => {
    const supabase = await createServerSupabase();
    return listProjects(supabase);
  },
);

export const getProjectAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'project', action: 'view' },
    loadContext: getActionContext,
    name: 'projects.getProject',
  },
  async (id): Promise<Project> => {
    const supabase = await createServerSupabase();
    return getProject(supabase, id);
  },
);

/**
 * Sets the Cash Gate risk buffer (ADR 0009 decision 4). Lives here, not in
 * modules/cash-gate, because risk_reserve_amount is a column on `projects` --
 * table ownership is exclusive (ARCHITECTURE.md 1.2) regardless of which
 * module the *concept* belongs to.
 */
export const setRiskReserveAction = safeAction(
  {
    schema: setRiskReserveSchema,
    permission: { resource: 'project', action: 'update' },
    loadContext: getActionContext,
    name: 'projects.setRiskReserve',
  },
  async (input, ctx): Promise<Project> => {
    const supabase = await createServerSupabase();
    const before = await getProject(supabase, input.projectId);

    const after = await updateProject(supabase, input.projectId, {
      risk_reserve_amount: rupiahToColumn(toRupiah(input.riskReserveAmount)),
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'projects',
      entityId: after.id,
      action: 'update',
      previousValue: { risk_reserve_amount: before.risk_reserve_amount },
      newValue: { risk_reserve_amount: after.risk_reserve_amount },
      projectId: after.id,
      requestId: ctx.requestId,
    });

    return after;
  },
);
