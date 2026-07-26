import 'server-only';
import type { ServerSupabase } from '@/core/db/client.server';
import type { VendorPerformanceSummary, VendorRawData, Vendor, VendorQuote, PurchaseOrder } from '../types';
import { calculateVendorPerformance } from '../domain/performance-metrics';

/**
 * All database queries for the Performance Analytics module (ARCHITECTURE.md 1.2).
 */
export async function listVendorPerformanceSummary(
  supabase: ServerSupabase,
  organizationId: string,
): Promise<VendorPerformanceSummary[]> {
  // Query vendors for the organization
  const { data: vendors, error: vendorsError } = await supabase
    .from('vendors')
    .select('*')
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .order('name');

  if (vendorsError !== null) throw vendorsError;
  if (vendors === null || vendors.length === 0) return [];

  const vendorIds = vendors.map((v) => v.id);

  // Query all quotes for these vendors
  // We query by organization_id to ensure RLS doesn't block if we have access,
  // and we filter by vendor_id IN (...) for safety and performance.
  const { data: quotes, error: quotesError } = await supabase
    .from('vendor_quotes')
    .select('*')
    .eq('organization_id', organizationId)
    .in('vendor_id', vendorIds)
    .is('deleted_at', null);

  if (quotesError !== null) throw quotesError;

  // Query all purchase orders for these vendors
  const { data: pos, error: posError } = await supabase
    .from('purchase_orders')
    .select('*')
    .eq('organization_id', organizationId)
    .in('vendor_id', vendorIds)
    .is('deleted_at', null);

  if (posError !== null) throw posError;

  // Group data in JS (since complex joins require RPC or views which aren't strictly necessary here)
  const quotesByVendor = (quotes as VendorQuote[]).reduce<Record<string, VendorQuote[]>>((acc, q) => {
    const list = acc[q.vendor_id] ?? [];
    list.push(q);
    acc[q.vendor_id] = list;
    return acc;
  }, {});

  const posByVendor = (pos as PurchaseOrder[]).reduce<Record<string, PurchaseOrder[]>>((acc, po) => {
    const list = acc[po.vendor_id] ?? [];
    list.push(po);
    acc[po.vendor_id] = list;
    return acc;
  }, {});

  // Map each vendor to its raw data and calculate performance
  return (vendors as Vendor[]).map((vendor) => {
    const rawData: VendorRawData = {
      vendor,
      quotes: quotesByVendor[vendor.id] ?? [],
      purchaseOrders: posByVendor[vendor.id] ?? [],
    };
    return calculateVendorPerformance(rawData);
  });
}
