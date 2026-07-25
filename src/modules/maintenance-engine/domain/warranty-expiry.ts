/**
 * Phase 3 (F18): warranty-expiry relationship-transition touchpoint.
 * WORKFLOW_REVIEW.md 8.4 frames this as a business-development moment
 * (referrals, repeat business, a maintenance contract offer) an Owner acts
 * on manually -- not a risk to flag, so the tiers read as "opportunity
 * windows," not severity levels the way invoiceAgingTier's are. Pure
 * function, same "time is always a parameter, never the Date global"
 * discipline as invoiceAgingTier/decisionClockTier.
 */

export type WarrantyExpiryTier = 'active' | 'expiring_soon' | 'expired';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const EXPIRING_SOON_WINDOW_DAYS = 30;

export function warrantyExpiryTier(endsAtMs: number, nowMs: number): WarrantyExpiryTier {
  const daysUntilExpiry = Math.floor((endsAtMs - nowMs) / MS_PER_DAY);
  if (daysUntilExpiry < 0) return 'expired';
  if (daysUntilExpiry <= EXPIRING_SOON_WINDOW_DAYS) return 'expiring_soon';
  return 'active';
}
