import type { DecisionClockTier } from '@/modules/client-portal';
import { StatusBadge } from '@/core/ui';

const TIER_LABEL_ID: Record<DecisionClockTier, string> = {
  fresh: 'Baru',
  aging: 'Menunggu',
  overdue: 'Terlambat',
};

const TIER_TONE: Record<DecisionClockTier, 'success' | 'warning' | 'danger'> = {
  fresh: 'success',
  aging: 'warning',
  overdue: 'danger',
};

export function DecisionClockBadge({ tier }: { tier: DecisionClockTier }) {
  return <StatusBadge tone={TIER_TONE[tier]}>{TIER_LABEL_ID[tier]}</StatusBadge>;
}
