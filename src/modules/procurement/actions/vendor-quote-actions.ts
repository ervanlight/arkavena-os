'use server';

import { z } from 'zod';
import { toRupiah } from '@/core/money/rupiah';
import { recordAudit } from '@/core/audit/audit';
import { createAuditGateway } from '@/core/audit/gateway.server';
import { getActionContext } from '@/core/auth/session';
import { safeAction } from '@/core/actions/safe-action';
import { createServerSupabase } from '@/core/db/client.server';
import {
  getVendorQuote,
  insertVendorQuote,
  listVendorQuotesForProject,
  updateVendorQuote,
} from '../data/vendor-quotes-repository';
import { createVendorQuoteSchema, updateVendorQuoteSchema } from '../schemas';
import type { VendorQuote } from '../types';

export const createVendorQuoteAction = safeAction(
  {
    schema: createVendorQuoteSchema,
    permission: { resource: 'vendor_quote', action: 'create' },
    loadContext: getActionContext,
    name: 'procurement.createVendorQuote',
  },
  async (input, ctx): Promise<VendorQuote> => {
    const supabase = await createServerSupabase();
    const quote = await insertVendorQuote(supabase, {
      organization_id: ctx.organizationId,
      project_id: input.projectId,
      vendor_id: input.vendorId,
      material_request_id: input.materialRequestId ?? null,
      description: input.description,
      amount: toRupiah(input.amount),
      valid_until: input.validUntil ?? null,
      notes: input.notes ?? null,
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'vendor_quotes',
      entityId: quote.id,
      action: 'insert',
      newValue: quote,
      projectId: input.projectId,
      requestId: ctx.requestId,
    });

    return quote;
  },
);

export const updateVendorQuoteAction = safeAction(
  {
    schema: updateVendorQuoteSchema,
    permission: { resource: 'vendor_quote', action: 'update' },
    loadContext: getActionContext,
    name: 'procurement.updateVendorQuote',
  },
  async (input, ctx): Promise<VendorQuote> => {
    const supabase = await createServerSupabase();
    const before = await getVendorQuote(supabase, input.id);

    const after = await updateVendorQuote(supabase, input.id, {
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    });

    await recordAudit(createAuditGateway(supabase), {
      entityTable: 'vendor_quotes',
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

export const listVendorQuotesForProjectAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'vendor_quote', action: 'view' },
    loadContext: getActionContext,
    name: 'procurement.listVendorQuotesForProject',
  },
  async (projectId): Promise<VendorQuote[]> => {
    const supabase = await createServerSupabase();
    return listVendorQuotesForProject(supabase, projectId);
  },
);

export const getVendorQuoteAction = safeAction(
  {
    schema: z.string().uuid(),
    permission: { resource: 'vendor_quote', action: 'view' },
    loadContext: getActionContext,
    name: 'procurement.getVendorQuote',
  },
  async (id): Promise<VendorQuote> => {
    const supabase = await createServerSupabase();
    return getVendorQuote(supabase, id);
  },
);
