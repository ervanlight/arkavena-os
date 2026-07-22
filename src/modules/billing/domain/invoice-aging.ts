/**
 * Aging buckets for the Billing dashboard (ARCHITECTURE.md 7). Pure
 * function -- time is always a parameter (epoch milliseconds, not `Date`;
 * domain/ forbids the `Date` global entirely, ESLint `no-restricted-globals`
 * -- same pattern client-portal's Decision Clock already established).
 * Callers only invoke this for an issued, not-yet-fully-paid invoice; a
 * draft, cancelled, or paid invoice has no aging tier at all, which is a
 * decision left to the caller rather than encoded here.
 */

export type InvoiceAgingTier = 'current' | 'overdue_1_30' | 'overdue_31_60' | 'overdue_61_90' | 'overdue_90_plus';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysPastDue(dueDateMs: number, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - dueDateMs) / MS_PER_DAY));
}

export function invoiceAgingTier(dueDateMs: number, nowMs: number): InvoiceAgingTier {
  const days = daysPastDue(dueDateMs, nowMs);
  if (days > 90) return 'overdue_90_plus';
  if (days > 60) return 'overdue_61_90';
  if (days > 30) return 'overdue_31_60';
  if (days > 0) return 'overdue_1_30';
  return 'current';
}
