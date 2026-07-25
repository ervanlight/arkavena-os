import type { Rupiah } from '@/core/money/rupiah';
import type { Tables, TablesInsert } from '@/core/db/database.types';
import type { WorkPackage } from '@/modules/projects';

export type { CashGateAction, CashGateStatus, GateAllowed, GateBlocked, GateOverride, GateState } from './domain/types';

/**
 * `amount`/`needed_amount` overridden to `Rupiah` (ARCHITECTURE.md 3.1's
 * Omit-and-compose pattern), same reasoning as modules/projects' Contract
 * and Milestone: the generated type says `number` because that is
 * PostgREST's wire format (ADR 0008), not because it is safe to treat as one.
 */
export type FundingReceipt = Omit<Tables<'funding_receipts'>, 'amount'> & { amount: Rupiah };
export type NewFundingReceipt = Omit<TablesInsert<'funding_receipts'>, 'amount'> & { amount: Rupiah };

export type CashForecast = Omit<Tables<'cash_forecasts'>, 'needed_amount'> & { needed_amount: Rupiah };
export type NewCashForecast = Omit<TablesInsert<'cash_forecasts'>, 'needed_amount'> & { needed_amount: Rupiah };

/** No money field of its own -- a record of who overrode what, when, and why. */
export type CashGateOverrideRow = Tables<'cash_gate_overrides'>;
export type NewCashGateOverride = TablesInsert<'cash_gate_overrides'>;

/** Moved off `projects` by ADR 0011 -- one row per project, staff-only RLS. */
export type ProjectRiskReserve = Omit<Tables<'project_risk_reserves'>, 'risk_reserve_amount'> & {
  risk_reserve_amount: Rupiah;
};

export type { WorkPackage };
