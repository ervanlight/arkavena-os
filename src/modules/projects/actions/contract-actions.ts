'use server';

import { z } from 'zod';
import { toRupiah } from '@/core/money/rupiah';
import { recordAudit } from '@/core/audit/audit';
import { createAuditGateway } from '@/core/audit/gateway.server';
import { getActionContext } from '@/core/auth/session';
import { safeAction } from '@/core/actions/safe-action';
import { createServerSupabase } from '@/core/db/client.server';
import { getContract, insertContract, listContractsForProject, updateContract } from '../data/contracts-repository';
import { createContractSchema, updateContractSchema } from '../schemas';
import type { Contract } from '../types';

export const createContractAction = safeAction(
  {
    schema: createContractSchema,
    permission: { resource: 'contract', action: 'create' },
    loadContext: getActionContext,
    name: 'projects.createContract',
  },
  async (input, ctx): Promise<Contract> => {
    const supabase = await createServerSupabase();
    const contract = await insertContract(supabase, {
      organization_id: ctx.organizationId,
      project_id: input.projectId,
      title: input.title,
      contract_amount: toRupiah(input.contractAmount),
      ...(input.signedDate !== undefined ? { signed_date: input.signedDate } : {}),
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'contracts',
      entityId: contract.id,
      action: 'insert',
      newValue: { ...contract, contract_amount: contract.contract_amount.toString() },
      projectId: contract.project_id,
      requestId: ctx.requestId,
    });

    return contract;
  },
);

export const updateContractAction = safeAction(
  {
    schema: updateContractSchema,
    permission: { resource: 'contract', action: 'update' },
    loadContext: getActionContext,
    name: 'projects.updateContract',
  },
  async (input, ctx): Promise<Contract> => {
    const supabase = await createServerSupabase();
    const before = await getContract(supabase, input.id);

    const after = await updateContract(supabase, input.id, {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.contractAmount !== undefined ? { contract_amount: toRupiah(input.contractAmount) } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.signedDate !== undefined ? { signed_date: input.signedDate } : {}),
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'contracts',
      entityId: after.id,
      action: before.status !== after.status ? 'status_change' : 'update',
      // Rupiah is a branded bigint -- diffRows/JSON-serialising it directly
      // would throw ("Do not know how to serialize a BigInt"). Stringify
      // explicitly at this one boundary rather than teach diffRows about
      // money.
      previousValue: { ...before, contract_amount: before.contract_amount.toString() },
      newValue: { ...after, contract_amount: after.contract_amount.toString() },
      projectId: after.project_id,
      requestId: ctx.requestId,
    });

    return after;
  },
);

export const listContractsForProjectAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'contract', action: 'view' },
    loadContext: getActionContext,
    name: 'projects.listContractsForProject',
  },
  async (projectId): Promise<Contract[]> => {
    const supabase = await createServerSupabase();
    return listContractsForProject(supabase, projectId);
  },
);
