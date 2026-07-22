import type { DecisionClockTier } from '@/modules/client-portal';

const TIER_LABEL_ID: Record<DecisionClockTier, string> = {
  fresh: 'Baru',
  aging: 'Menunggu',
  overdue: 'Terlambat',
};

const TIER_BADGE_CLASS: Record<DecisionClockTier, string> = {
  fresh: 'bg-emerald-100 text-emerald-800',
  aging: 'bg-amber-100 text-amber-800',
  overdue: 'bg-red-100 text-red-800',
};

export function DecisionClockBadge({ tier }: { tier: DecisionClockTier }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TIER_BADGE_CLASS[tier]}`}>
      {TIER_LABEL_ID[tier]}
    </span>
  );
}
