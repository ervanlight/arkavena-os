import type { Rupiah } from '@/core/money/rupiah';
import type { Tables, TablesInsert, TablesUpdate } from '@/core/db/database.types';

export type { ChangeOrderEvent, ChangeOrderStatus } from './domain/types';

/**
 * `cost_impact_amount` overridden to `Rupiah | null` (ARCHITECTURE.md 3.1's
 * Omit-and-compose pattern) -- nullable because ARCHITECTURE.md 4.3's
 * client_approve guard only makes sense if the figure can be absent earlier
 * in the lifecycle (ADR 0012).
 */
export type ChangeOrder = Omit<Tables<'change_orders'>, 'cost_impact_amount'> & {
  cost_impact_amount: Rupiah | null;
};
export type NewChangeOrder = Omit<TablesInsert<'change_orders'>, 'cost_impact_amount'>;
export type ChangeOrderUpdate = Omit<TablesUpdate<'change_orders'>, 'cost_impact_amount'> & {
  cost_impact_amount?: Rupiah | null;
};
