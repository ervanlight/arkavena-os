/**
 * Cash Gate domain types (ARCHITECTURE.md 4.2). Pure data -- no supabase,
 * react, or next may appear anywhere under domain/ (CLAUDE.md law 2,
 * enforced by ESLint).
 */

/** computeFundingCoverage's own three-way read of the funding ratio. */
export type FundingCoverageStatus = 'green' | 'yellow' | 'red';

/**
 * The full gate status, including overdue -- a dimension computeFundingCoverage
 * does not and cannot know about (it has no concept of *when* a receipt was
 * expected, only aggregated totals). ARCHITECTURE.md 4.5: "overdue menimpa
 * status hijau" -- overdue overrides the ratio-derived status entirely,
 * regardless of how healthy the ratio looks.
 */
export type CashGateStatus = FundingCoverageStatus | 'overdue';

/** Matches evaluateGateAction's action union (ARCHITECTURE.md 4.2) exactly. */
export type CashGateAction =
  | 'issue_po'
  | 'open_work_package'
  | 'mobilize_sub'
  | 'start_variation'
  | 'order_material';

/**
 * The gate's current state for one project -- status plus overdue info,
 * exactly what ARCHITECTURE.md 4.2's GateState comment describes. Computed
 * fresh by the repository on every read; nothing about this is stored as its
 * own row.
 */
export type GateState = {
  readonly status: CashGateStatus;
  /**
   * null specifically means "nothing was needed at all" (division by zero in
   * computeFundingCoverage), not missing data. See computeFundingCoverage's
   * own docs for why this differs from ARCHITECTURE.md 4.2's example
   * signature, which shows `ratioBp: number`.
   */
  readonly ratioBp: number | null;
};

/**
 * An override attempt, exactly as ARCHITECTURE.md 4.2 shows it. Role
 * verification ("dan role Owner") is deliberately NOT this type's or
 * evaluateGateAction's job -- a pure function has no session or database to
 * check a role against. That check happens at two other layers instead:
 * requirePermission() before evaluateGateAction is ever called (ARCHITECTURE.md
 * 4.1's flow), and fn_cash_gate_overrides_guard_owner_only at the database
 * layer (ADR 0010), which holds even if the first is bypassed.
 */
export type GateOverride = {
  readonly byUserId: string;
  readonly reason: string;
};

export type GateAllowed = {
  readonly status: CashGateStatus;
  readonly overridden: boolean;
};

export type GateBlocked = {
  readonly status: CashGateStatus;
  readonly reason: string;
};
