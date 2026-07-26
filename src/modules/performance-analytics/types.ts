import type { Tables } from '@/core/db/database.types';
import type { Rupiah } from '@/core/money/rupiah';

export type Vendor = Tables<'vendors'>;
export type VendorQuote = Tables<'vendor_quotes'>;
export type PurchaseOrder = Tables<'purchase_orders'>;

/**
 * Raw data fetched from the database, grouped by vendor.
 */
export type VendorRawData = {
  vendor: Vendor;
  quotes: VendorQuote[];
  purchaseOrders: PurchaseOrder[];
};

/**
 * Computed performance metrics for a single vendor.
 * Exposed to the UI by the server action.
 */
export type VendorPerformanceSummary = {
  vendorId: string;
  vendorName: string;
  totalQuotes: number;
  acceptedQuotes: number;
  quoteConversionRate: number; // 0-100 percentage
  totalContractValue: Rupiah;
};
