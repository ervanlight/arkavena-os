/**
 * Public API of modules/cash-gate. The only door other modules and app/ may
 * use to reach funding_receipts, cash_forecasts, or cash_gate_overrides
 * (ARCHITECTURE.md 1.2) -- this module owns all three tables (ARCHITECTURE.md
 * 1.1). The Cash Gate's own risk buffer (`projects.risk_reserve_amount`) is
 * not among them: that column belongs to modules/projects, which is why
 * `setRiskReserveAction` lives in that module's public API, not this one.
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
} from './types';

export {
  createCashForecastSchema,
  createFundingReceiptSchema,
  markFundingReceiptClearedSchema,
  overrideOpenWorkPackageSchema,
  type CreateCashForecastInput,
  type CreateFundingReceiptInput,
  type MarkFundingReceiptClearedInput,
  type OverrideOpenWorkPackageInput,
} from './schemas';

export { createCashForecastAction, listCashForecastsForProjectAction } from './actions/cash-forecast-actions';
export {
  createFundingReceiptAction,
  listFundingReceiptsForProjectAction,
  markFundingReceiptClearedAction,
} from './actions/funding-receipt-actions';
export { getGateStateAction, listOverridesForProjectAction, overrideOpenWorkPackageAction } from './actions/gate-actions';
