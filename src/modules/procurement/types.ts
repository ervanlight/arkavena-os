import type { Rupiah } from '@/core/money/rupiah';
import type { Tables, TablesInsert, TablesUpdate } from '@/core/db/database.types';

/** Row types always derive from the generated schema (ARCHITECTURE.md 3.1). */

export type Vendor = Tables<'vendors'>;
export type NewVendor = TablesInsert<'vendors'>;
export type VendorUpdate = TablesUpdate<'vendors'>;

export type VendorQuote = Omit<Tables<'vendor_quotes'>, 'amount'> & { amount: Rupiah };
export type NewVendorQuote = Omit<TablesInsert<'vendor_quotes'>, 'amount'> & { amount: Rupiah };
export type VendorQuoteUpdate = Omit<TablesUpdate<'vendor_quotes'>, 'amount'> & { amount?: Rupiah };

/** No status column to transition -- a PO row IS the issuance (ADR 0018 SS6). */
export type PurchaseOrder = Omit<Tables<'purchase_orders'>, 'amount'> & { amount: Rupiah };
export type NewPurchaseOrder = Omit<TablesInsert<'purchase_orders'>, 'amount'> & { amount: Rupiah };

export type Delivery = Tables<'deliveries'>;
export type NewDelivery = TablesInsert<'deliveries'>;

export type VendorUser = Tables<'vendor_users'>;
