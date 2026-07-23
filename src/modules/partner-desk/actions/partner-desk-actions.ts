'use server';

import { z } from 'zod';
import { getActionContext } from '@/core/auth/session';
import { safeAction } from '@/core/actions/safe-action';
import { createServerSupabase } from '@/core/db/client.server';
import {
  listPartnerDeliveriesForPurchaseOrder,
  listPartnerPurchaseOrders,
  listPartnerVendorQuotes,
} from '../data/partner-views-repository';
import type { PartnerDelivery, PartnerPurchaseOrder, PartnerVendorQuote } from '../types';

/**
 * These three read the vw_partner_* views (ADR 0024) with no `permission`
 * entry -- same "available to any signed-in user" shape as
 * client-portal-actions.ts's view reads: real access control is RLS on the
 * underlying tables (security_invoker views), scoped by
 * fn_has_project_role + vendor_users. A caller with no access to a
 * project/vendor simply gets an empty result back, never another
 * supplier's data -- there is nothing a matrix check here would add.
 */

export const listPartnerVendorQuotesAction = safeAction(
  {
    schema: z.string().uuid(),
    loadContext: getActionContext,
    name: 'partnerDesk.listPartnerVendorQuotes',
  },
  async (projectId): Promise<PartnerVendorQuote[]> => {
    const supabase = await createServerSupabase();
    return listPartnerVendorQuotes(supabase, projectId);
  },
);

export const listPartnerPurchaseOrdersAction = safeAction(
  {
    schema: z.string().uuid(),
    loadContext: getActionContext,
    name: 'partnerDesk.listPartnerPurchaseOrders',
  },
  async (projectId): Promise<PartnerPurchaseOrder[]> => {
    const supabase = await createServerSupabase();
    return listPartnerPurchaseOrders(supabase, projectId);
  },
);

export const listPartnerDeliveriesForPurchaseOrderAction = safeAction(
  {
    schema: z.string().uuid(),
    loadContext: getActionContext,
    name: 'partnerDesk.listPartnerDeliveriesForPurchaseOrder',
  },
  async (purchaseOrderId): Promise<PartnerDelivery[]> => {
    const supabase = await createServerSupabase();
    return listPartnerDeliveriesForPurchaseOrder(supabase, purchaseOrderId);
  },
);
