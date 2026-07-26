import { rupiahFromColumn } from '@/core/money/rupiah';
import type { VendorPerformanceSummary, VendorRawData } from '../types';

/**
 * Calculates performance metrics for a single vendor based on their raw data.
 * Pure function -- no database access here (ARCHITECTURE.md 1.1).
 */
export function calculateVendorPerformance(data: VendorRawData): VendorPerformanceSummary {
  const totalQuotes = data.quotes.length;
  const acceptedQuotes = data.quotes.filter((q) => q.status === 'accepted').length;

  const quoteConversionRate = totalQuotes > 0 ? (acceptedQuotes / totalQuotes) * 100 : 0;

  const totalContractValueRaw = data.purchaseOrders.reduce((sum, po) => sum + po.amount, 0);

  return {
    vendorId: data.vendor.id,
    vendorName: data.vendor.name,
    totalQuotes,
    acceptedQuotes,
    quoteConversionRate,
    totalContractValue: rupiahFromColumn(totalContractValueRaw),
  };
}
