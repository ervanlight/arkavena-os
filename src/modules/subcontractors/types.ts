import type { Rupiah } from '@/core/money/rupiah';
import type { Tables } from '@/core/db/database.types';

/**
 * Row types always derive from the generated schema (ARCHITECTURE.md 3.1).
 * Supabase's generator marks every VIEW column nullable regardless of what
 * the view's own SQL guarantees (same note as modules/client-portal/types.ts) --
 * narrowed back here to what `vw_partner_*`'s migration (ADR 0024 SS5)
 * actually selects. `material_request_id`/`vendor_quote_id`/`valid_until`
 * stay nullable -- genuinely optional on the underlying tables.
 */

export type PartnerVendorQuote = Omit<
  Tables<'vw_partner_vendor_quotes'>,
  'id' | 'project_id' | 'vendor_id' | 'description' | 'amount' | 'status' | 'created_at'
> & {
  id: string;
  project_id: string;
  vendor_id: string;
  description: string;
  amount: Rupiah;
  status: NonNullable<Tables<'vw_partner_vendor_quotes'>['status']>;
  created_at: string;
};

export type PartnerPurchaseOrder = Omit<
  Tables<'vw_partner_purchase_orders'>,
  'id' | 'project_id' | 'vendor_id' | 'description' | 'amount' | 'created_at'
> & {
  id: string;
  project_id: string;
  vendor_id: string;
  description: string;
  amount: Rupiah;
  created_at: string;
};

export type PartnerDelivery = Omit<Tables<'vw_partner_deliveries'>, 'id' | 'purchase_order_id' | 'delivered_at' | 'created_at'> & {
  id: string;
  purchase_order_id: string;
  delivered_at: string;
  created_at: string;
};
