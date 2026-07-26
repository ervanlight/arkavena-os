import { StatusBadge } from '@/core/ui';

export function MetricBadge({ conversionRate }: { conversionRate: number }) {
  if (conversionRate === 0) {
    return <StatusBadge tone="neutral">Belum Ada Data</StatusBadge>;
  }
  
  if (conversionRate >= 70) {
    return <StatusBadge tone="success">{conversionRate.toFixed(1)}%</StatusBadge>;
  }
  
  if (conversionRate >= 40) {
    return <StatusBadge tone="warning">{conversionRate.toFixed(1)}%</StatusBadge>;
  }
  
  return <StatusBadge tone="danger">{conversionRate.toFixed(1)}%</StatusBadge>;
}
