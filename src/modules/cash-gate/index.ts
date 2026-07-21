/**
 * Public API of modules/cash-gate. The only door other modules and app/ may
 * use to reach funding_receipts, cash_forecasts, cash_gate_overrides, or
 * project_risk_reserves (ARCHITECTURE.md 1.2) -- this module owns all four
 * tables (ARCHITECTURE.md 1.1). risk_reserve_amount moved here from
 * modules/projects by ADR 0011, closing a leak where a table `projects`
 * already let every project role read (including client-facing ones) was
 * carrying a money figure it should never have exposed to them.
 */

export type {
  CashGateAction,
  CashGateOverrideRow,
  CashGateStatus,
  CashForecast,
  FundingReceipt,
  GateAllowed,
  GateBlocked,
  GateOverride,
  GateState,
  NewCashForecast,
  NewCashGateOverride,
  NewFundingReceipt,
  ProjectRiskReserve,
} from './types';

export {
  createCashForecastSchema,
  createFundingReceiptSchema,
  markFundingReceiptClearedSchema,
  overrideOpenWorkPackageSchema,
  setRiskReserveSchema,
  type CreateCashForecastInput,
  type CreateFundingReceiptInput,
  type MarkFundingReceiptClearedInput,
  type OverrideOpenWorkPackageInput,
  type SetRiskReserveInput,
} from './schemas';

export { createCashForecastAction, listCashForecastsForProjectAction } from './actions/cash-forecast-actions';
export {
  createFundingReceiptAction,
  listFundingReceiptsForProjectAction,
  markFundingReceiptClearedAction,
} from './actions/funding-receipt-actions';
export { getGateStateAction, listOverridesForProjectAction, overrideOpenWorkPackageAction } from './actions/gate-actions';
export { getRiskReserveAction, setRiskReserveAction } from './actions/risk-reserve-actions';
