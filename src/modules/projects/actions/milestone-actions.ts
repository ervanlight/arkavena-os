'use server';

import { z } from 'zod';
import { toRupiah } from '@/core/money/rupiah';
import { recordAudit } from '@/core/audit/audit';
import { createAuditGateway } from '@/core/audit/gateway.server';
import { getActionContext } from '@/core/auth/session';
import { safeAction } from '@/core/actions/safe-action';
import { createServerSupabase } from '@/core/db/client.server';
import { getContract } from '../data/contracts-repository';
import { getMilestone, insertMilestone, listMilestonesForContract, updateMilestone } from '../data/milestones-repository';
import { createMilestoneSchema, updateMilestoneSchema } from '../schemas';
import type { Milestone } from '../types';

export const createMilestoneAction = safeAction(
  {
    schema: createMilestoneSchema,
    permission: { resource: 'milestone', action: 'create' },
    loadContext: getActionContext,
    name: 'projects.createMilestone',
  },
  async (input, ctx): Promise<Milestone> => {
    const supabase = await createServerSupabase();
    // organization_id is not caller-supplied -- taken from the contract, so a
    // milestone can never be created against another organisation's contract
    // even if the client-side form were tampered with.
    const contract = await getContract(supabase, input.contractId);

    const milestone = await insertMilestone(supabase, {
      organization_id: contract.organization_id,
      contract_id: input.contractId,
      name: input.name,
      amount: toRupiah(input.amount),
      ...(input.dueDate !== undefined ? { due_date: input.dueDate } : {}),
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'milestones',
      entityId: milestone.id,
      action: 'insert',
      newValue: { ...milestone, amount: milestone.amount.toString() },
      requestId: ctx.requestId,
    });

    return milestone;
  },
);

export const updateMilestoneAction = safeAction(
  {
    schema: updateMilestoneSchema,
    permission: { resource: 'milestone', action: 'update' },
    loadContext: getActionContext,
    name: 'projects.updateMilestone',
  },
  async (input, ctx): Promise<Milestone> => {
    const supabase = await createServerSupabase();
    const before = await getMilestone(supabase, input.id);

    const after = await updateMilestone(supabase, input.id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.amount !== undefined ? { amount: toRupiah(input.amount) } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.dueDate !== undefined ? { due_date: input.dueDate } : {}),
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'milestones',
      entityId: after.id,
      action: before.status !== after.status ? 'status_change' : 'update',
      previousValue: { ...before, amount: before.amount.toString() },
      newValue: { ...after, amount: after.amount.toString() },
      requestId: ctx.requestId,
    });

    return after;
  },
);

export const listMilestonesForContractAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'milestone', action: 'view' },
    loadContext: getActionContext,
    name: 'projects.listMilestonesForContract',
  },
  async (contractId): Promise<Milestone[]> => {
    const supabase = await createServerSupabase();
    return listMilestonesForContract(supabase, contractId);
  },
);

/** modules/billing (Fase 7) needs a single milestone's status to assemble its own issuance-eligibility check (ADR 0017). */
export const getMilestoneAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'milestone', action: 'view' },
    loadContext: getActionContext,
    name: 'projects.getMilestone',
  },
  async (id): Promise<Milestone> => {
    const supabase = await createServerSupabase();
    return getMilestone(supabase, id);
  },
);
