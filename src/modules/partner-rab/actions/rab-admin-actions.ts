'use server';

import { z } from 'zod';
import { safeAction } from '@/core/actions/safe-action';
import { getActionContext } from '@/core/auth/session';
import { createServerSupabase } from '@/core/db/client.server';

export const rejectVendorRabAction = safeAction(
  {
    name: 'admin.rejectVendorRab',
    schema: z.object({ quoteId: z.string().uuid() }),
    loadContext: getActionContext,
  },
  async ({ quoteId }, _ctx) => {
    const supabase = await createServerSupabase();
    await supabase.from('vendor_quotes').update({ status: 'rejected' }).eq('id', quoteId);
    return { success: true };
  }
);

export const approveVendorRabAction = safeAction(
  {
    name: 'admin.approveVendorRab',
    schema: z.object({ quoteId: z.string().uuid(), projectId: z.string() }),
    loadContext: getActionContext,
  },
  async ({ quoteId, projectId }, ctx) => {
    const supabase = await createServerSupabase();

    // 1. Get vendor quote and items
    const { data: quote } = await supabase.from('vendor_quotes').select('*').eq('id', quoteId).single();
    if (!quote) throw new Error('Quote not found');

    const { data: items } = await supabase.from('vendor_quote_items').select('*').eq('vendor_quote_id', quoteId).is('deleted_at', null);
    if (!items || items.length === 0) throw new Error('Quote has no items');

    // 2. Create Estimate
    const { data: estimate, error: estError } = await supabase.from('estimates').insert({
      organization_id: ctx.organizationId,
      project_id: projectId,
      title: quote.description,
      status: 'draft',
      created_by: ctx.userId,
      is_baseline: false,
      version: 1,
    }).select().single();

    if (estError) throw estError;

    // 3. Copy Items
    const estimateItems = items.map(item => ({
      organization_id: ctx.organizationId,
      estimate_id: estimate.id,
      group_name: item.group_name,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unit_cost: item.unit_cost,
      unit_price: item.unit_cost,
    }));

    const { error: itemsError } = await supabase.from('estimate_items').insert(estimateItems);
    if (itemsError) throw itemsError;

    // 4. Update quote status
    await supabase.from('vendor_quotes').update({ status: 'accepted' }).eq('id', quoteId);

    return { success: true, estimateId: estimate.id };
  }
);

export const updateRabMarkupAction = safeAction(
  {
    name: 'admin.updateRabMarkup',
    schema: z.object({
      itemId: z.string().uuid(),
      unitPrice: z.number().min(0),
    }),
    loadContext: getActionContext,
  },
  async ({ itemId, unitPrice }, _ctx) => {
    const supabase = await createServerSupabase();
    await supabase.from('estimate_items').update({ unit_price: unitPrice }).eq('id', itemId);
    return { success: true };
  }
);

export const applyGlobalMarkupAction = safeAction(
  {
    name: 'admin.applyGlobalMarkup',
    schema: z.object({
      estimateId: z.string().uuid(),
      percentage: z.number(),
    }),
    loadContext: getActionContext,
  },
  async ({ estimateId, percentage }, _ctx) => {
    const supabase = await createServerSupabase();
    
    const { data: items } = await supabase.from('estimate_items').select('id, unit_cost').eq('estimate_id', estimateId).is('deleted_at', null);
    
    if (items) {
      const multiplier = 1 + (percentage / 100);
      for (const item of items) {
        const newPrice = Math.round(Number(item.unit_cost) * multiplier);
        await supabase.from('estimate_items').update({ unit_price: newPrice }).eq('id', item.id);
      }
    }
    
    return { success: true };
  }
);

export const submitRabToClientAction = safeAction(
  {
    name: 'admin.submitRabToClient',
    schema: z.object({ estimateId: z.string().uuid(), projectId: z.string() }),
    loadContext: getActionContext,
  },
  async ({ estimateId, projectId }, ctx) => {
    const supabase = await createServerSupabase();

    await supabase.from('estimates').update({ status: 'sent' }).eq('id', estimateId);

    await supabase.from('proposals').insert({
      organization_id: ctx.organizationId,
      project_id: projectId,
      estimate_id: estimateId,
      status: 'sent',
    });

    return { success: true };
  }
);
