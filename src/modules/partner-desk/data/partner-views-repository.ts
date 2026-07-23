import 'server-only';
import { rupiahFromColumn } from '@/core/money/rupiah';
import type { ServerSupabase } from '@/core/db/client.server';
import type { PartnerDelivery, PartnerPurchaseOrder, PartnerVendorQuote } from '../types';

/**
 * All direct access to the vw_partner_* views (ARCHITECTURE.md 2.6, ADR 0024)
 * lives here -- the only surface Partner Desk reads. Every view is
 * `security_invoker = true`, so RLS on the underlying tables (the
 * *_select_supplier policies, Wave 11) is what actually gates a row showing
 * up here, not this file. Same shape as
 * modules/client-portal/data/client-views-repository.ts.
 */

export async function listPartnerVendorQuotes(
  supabase: ServerSupabase,
  projectId: string,
): Promise<PartnerVendorQuote[]> {
  const { data, error } = await supabase
    .from('vw_partner_vendor_quotes')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error !== null) throw error;
  return (data as (Omit<PartnerVendorQuote, 'amount'> & { amount: number })[]).map((row) => ({
    ...row,
    amount: rupiahFromColumn(row.amount),
  }));
}

export async function listPartnerPurchaseOrders(
  supabase: ServerSupabase,
  projectId: string,
): Promise<PartnerPurchaseOrder[]> {
  const { data, error } = await supabase
    .from('vw_partner_purchase_orders')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error !== null) throw error;
  return (data as (Omit<PartnerPurchaseOrder, 'amount'> & { amount: number })[]).map((row) => ({
    ...row,
    amount: rupiahFromColumn(row.amount),
  }));
}

export async function listPartnerDeliveriesForPurchaseOrder(
  supabase: ServerSupabase,
  purchaseOrderId: string,
): Promise<PartnerDelivery[]> {
  const { data, error } = await supabase
    .from('vw_partner_deliveries')
    .select('*')
    .eq('purchase_order_id', purchaseOrderId)
    .order('delivered_at', { ascending: false });

  if (error !== null) throw error;
  return data as PartnerDelivery[];
}
