'use server';

import { z } from 'zod';
import { toRupiah } from '@/core/money/rupiah';
import { recordAudit } from '@/core/audit/audit';
import { createAuditGateway } from '@/core/audit/gateway.server';
import { getActionContext } from '@/core/auth/session';
import { safeAction } from '@/core/actions/safe-action';
import { createServerSupabase } from '@/core/db/client.server';
import {
  getFundingReceipt,
  insertFundingReceipt,
  listFundingReceiptsForProject,
  markFundingReceiptCleared,
} from '../data/funding-receipts-repository';
import { createFundingReceiptSchema, markFundingReceiptClearedSchema } from '../schemas';
import type { FundingReceipt } from '../types';

export const createFundingReceiptAction = safeAction(
  {
    schema: createFundingReceiptSchema,
    permission: { resource: 'funding_receipt', action: 'create' },
    loadContext: getActionContext,
    name: 'cashGate.createFundingReceipt',
  },
  async (input, ctx): Promise<FundingReceipt> => {
    const supabase = await createServerSupabase();
    const receipt = await insertFundingReceipt(supabase, {
      organization_id: ctx.organizationId,
      project_id: input.projectId,
      milestone_id: input.milestoneId ?? null,
      amount: toRupiah(input.amount),
      expected_date: input.expectedDate,
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'funding_receipts',
      entityId: receipt.id,
      action: 'insert',
      newValue: { ...receipt, amount: receipt.amount.toString() },
      projectId: receipt.project_id,
      requestId: ctx.requestId,
    });

    return receipt;
  },
);

/** Finance's manual confirmation that a receipt has actually arrived (owner decision D5). */
export const markFundingReceiptClearedAction = safeAction(
  {
    schema: markFundingReceiptClearedSchema,
    permission: { resource: 'funding_receipt', action: 'update' },
    loadContext: getActionContext,
    name: 'cashGate.markFundingReceiptCleared',
  },
  async (input, ctx): Promise<FundingReceipt> => {
    const supabase = await createServerSupabase();
    const before = await getFundingReceipt(supabase, input.id);
    const after = await markFundingReceiptCleared(supabase, input.id, input.proofPath ?? null);

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'funding_receipts',
      entityId: after.id,
      action: 'update',
      previousValue: { ...before, amount: before.amount.toString() },
      newValue: { ...after, amount: after.amount.toString() },
      projectId: after.project_id,
      requestId: ctx.requestId,
    });

    return after;
  },
);

export const listFundingReceiptsForProjectAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'funding_receipt', action: 'view' },
    loadContext: getActionContext,
    name: 'cashGate.listFundingReceiptsForProject',
  },
  async (projectId): Promise<FundingReceipt[]> => {
    const supabase = await createServerSupabase();
    return listFundingReceiptsForProject(supabase, projectId);
  },
);
