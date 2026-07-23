import type { Rupiah } from '@/core/money/rupiah';
import type { Tables, TablesInsert, TablesUpdate } from '@/core/db/database.types';

/**
 * Row types always derive from the generated schema (ARCHITECTURE.md 3.1),
 * with money columns re-branded as `Rupiah` at the boundary (same
 * Omit-and-compose pattern every other money column in this codebase uses).
 */

export type CostLibraryItem = Omit<Tables<'cost_library'>, 'default_unit_cost'> & { default_unit_cost: Rupiah };
export type NewCostLibraryItem = Omit<TablesInsert<'cost_library'>, 'default_unit_cost'> & {
  default_unit_cost: Rupiah;
};
export type CostLibraryItemUpdate = Omit<TablesUpdate<'cost_library'>, 'default_unit_cost'> & {
  default_unit_cost?: Rupiah;
};

/** No money column of its own -- estimates only aggregate estimate_items at read time (ADR 0018 SS4). */
export type Estimate = Tables<'estimates'>;
export type NewEstimate = TablesInsert<'estimates'>;
export type EstimateUpdate = TablesUpdate<'estimates'>;

export type EstimateItem = Omit<Tables<'estimate_items'>, 'unit_cost' | 'unit_price'> & {
  unit_cost: Rupiah;
  unit_price: Rupiah;
};
export type NewEstimateItem = Omit<TablesInsert<'estimate_items'>, 'unit_cost' | 'unit_price'> & {
  unit_cost: Rupiah;
  unit_price: Rupiah;
};
export type EstimateItemUpdate = Omit<TablesUpdate<'estimate_items'>, 'unit_cost' | 'unit_price'> & {
  unit_cost?: Rupiah;
  unit_price?: Rupiah;
};

export type Proposal = Tables<'proposals'>;
export type NewProposal = TablesInsert<'proposals'>;
export type ProposalUpdate = TablesUpdate<'proposals'>;
