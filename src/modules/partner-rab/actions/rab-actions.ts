'use server';

import { z } from 'zod';
import { safeAction } from '@/core/actions/safe-action';
import { getVendorQuoteItems, saveVendorQuoteItem, deleteVendorQuoteItem, updateVendorQuoteTotalAmount } from '../data/rab-repository';
import type { VendorQuoteItemInsert } from '../data/rab-repository';


const rabItemSchema = z.object({
  id: z.string().optional(),
  vendor_quote_id: z.string().uuid(),
  group_name: z.string().optional(),
  description: z.string().min(1, 'Uraian pekerjaan wajib diisi'),
  quantity: z.number().min(0.01),
  unit: z.string().min(1),
  unit_cost: z.number().min(0),
});

import { getActionContext } from '@/core/auth/session';

export const listVendorRabItemsAction = safeAction(
  {
    name: 'partner.listVendorRabItems',
    schema: z.object({ quoteId: z.string().uuid() }),
    loadContext: getActionContext,
    audience: 'external',
  },
  async ({ quoteId }, _ctx) => {
    // Just fetch it
    return await getVendorQuoteItems(quoteId);
  }
);

export const saveVendorRabItemAction = safeAction(
  {
    name: 'partner.saveVendorRabItem',
    schema: rabItemSchema,
    loadContext: getActionContext,
    audience: 'external',
  },
  async (input, ctx) => {
    const { id, ...restInput } = input;

    // Look up the actual project_id from the parent vendor_quote
    const supabase = (await import('@/core/db/client.server')).createServerSupabase;
    const sb = await supabase();
    const { data: quote, error: quoteError } = await sb
      .from('vendor_quotes')
      .select('project_id')
      .eq('id', input.vendor_quote_id)
      .single();
    if (quoteError || !quote) throw new Error('Vendor quote not found');

    const insertData: VendorQuoteItemInsert = {
      ...restInput,
      ...(id ? { id } : {}),
      group_name: input.group_name ?? null,
      organization_id: ctx.organizationId,
      project_id: quote.project_id,
    };
    
    const data = await saveVendorQuoteItem(insertData);
    
    await updateVendorQuoteTotalAmount(input.vendor_quote_id);
    return data;
  }
);

export const deleteVendorRabItemAction = safeAction(
  {
    name: 'partner.deleteVendorRabItem',
    schema: z.object({ id: z.string().uuid(), quoteId: z.string().uuid() }),
    loadContext: getActionContext,
    audience: 'external',
  },
  async (input, _ctx) => {
    await deleteVendorQuoteItem(input.id);
    await updateVendorQuoteTotalAmount(input.quoteId);
    return { success: true };
  }
);
