import {
  addRp,
  CASH_GATE_GREEN_BP,
  CASH_GATE_YELLOW_FLOOR_BP,
  ratioBp,
  subRp,
  type Rupiah,
} from '@/core/money/rupiah';
import { err, ok, type Result } from '@/core/errors/result';
import type {
  CashGateAction,
  CashGateStatus,
  FundingCoverageStatus,
  GateAllowed,
  GateBlocked,
  GateOverride,
  GateState,
} from './types';

/**
 * The Cash Gate domain (ARCHITECTURE.md 4.2). Pure functions only: input
 * plain data, output a decision. No I/O, no ambient clock, no import of
 * supabase/react/next -- ESLint enforces all three under domain/.
 *
 * The database mirrors this exactly (fn_cash_gate_status in
 * 20260721000600_wave7_cash_gate.sql): same thresholds, same
 * multiply-before-divide integer math, same "zero need is green" rule. That
 * duplication is deliberate (ARCHITECTURE.md 0.2) -- a bug in this file must
 * not be the only thing standing between a red gate and a purchase order.
 *
 * ADR 0009 records four scope decisions this module assumes: committedCosts
 * is a caller-supplied number with its real source (purchase order
 * aggregation) not existing until Fase 8; the purchase_orders trigger is
 * deferred to Fase 8 (only work_packages is wired at the DB layer for Fase
 * 2); overdue means 7 days past a funding receipt's expected date with no
 * cleared_at; riskReserve comes from projects.risk_reserve_amount. None of
 * that changes what this file computes -- it only affects where the numbers
 * going into it come from.
 */

/** ADR 0009 decision 3. Mirrored in SQL (fn_cash_gate_status) -- a db test asserts the two never drift. */
export const OVERDUE_GRACE_DAYS = 7;

/** ADR 0010. Mirrored in SQL (fn_work_packages_guard_cash_gate) -- a db test asserts the two never drift. */
export const OVERRIDE_VALIDITY_MINUTES = 5;

/**
 * The Funding Coverage Ratio (ARCHITECTURE.md 4.2).
 *
 * ```
 * net available = clearedFunds - committedCosts
 * total need    = next14DayNeeds + riskReserve
 * ratio         = net available / total need, in basis points
 * ```
 *
 * Two things deliberately differ from ARCHITECTURE.md 4.2's example
 * signature (explicitly labelled "contoh signature, bukan implementasi"):
 *
 * `ratioBp` is `number | null`, not `number`. When total need is zero --
 * nothing is needed in the next 14 days and no risk reserve is configured --
 * there is no meaningful ratio to report, only "trivially covered". `null`
 * says that directly rather than smuggling an arbitrary sentinel (some very
 * large number) into a field a dashboard will otherwise try to render as a
 * percentage. This mirrors `core/money/rupiah.ts`'s own `ratioBp` helper,
 * which returns `null` for the identical reason and requires the caller to
 * decide what it means -- here, it means green.
 *
 * `status` never includes `'overdue'` -- this function has no notion of
 * *when* a receipt was expected, only aggregated totals, so it structurally
 * cannot detect overdue. `determineGateStatus` below is what folds that
 * dimension in.
 */
export function computeFundingCoverage(input: {
  readonly clearedFunds: Rupiah;
  readonly committedCosts: Rupiah;
  readonly next14DayNeeds: Rupiah;
  readonly riskReserve: Rupiah;
}): { ratioBp: number | null; status: FundingCoverageStatus } {
  const netAvailable = subRp(input.clearedFunds, input.committedCosts);
  const totalNeed = addRp(input.next14DayNeeds, input.riskReserve);

  const bp = ratioBp(netAvailable, totalNeed);

  if (bp === null) {
    // total need is zero: nothing to cover, so trivially green rather than an
    // error or an arbitrary "infinite" number.
    return { ratioBp: null, status: 'green' };
  }

  if (bp >= CASH_GATE_GREEN_BP) {
    return { ratioBp: bp, status: 'green' };
  }
  if (bp >= CASH_GATE_YELLOW_FLOOR_BP) {
    return { ratioBp: bp, status: 'yellow' };
  }
  return { ratioBp: bp, status: 'red' };
}

/**
 * Folds the overdue dimension into a funding-coverage reading, producing the
 * full GateState. Kept separate from computeFundingCoverage because overdue
 * is not a ratio question -- the repository determines it by checking
 * funding_receipts for a row past OVERDUE_GRACE_DAYS with no cleared_at,
 * the exact same check fn_cash_gate_status makes in SQL.
 */
export function determineGateStatus(input: {
  readonly coverage: { readonly ratioBp: number | null; readonly status: FundingCoverageStatus };
  readonly isOverdue: boolean;
}): GateState {
  if (input.isOverdue) {
    return { status: 'overdue', ratioBp: input.coverage.ratioBp };
  }
  return { status: input.coverage.status, ratioBp: input.coverage.ratioBp };
}

const ACTION_LABEL_ID: Record<CashGateAction, string> = {
  issue_po: 'Purchase order tidak bisa diterbitkan',
  open_work_package: 'Pekerjaan tidak bisa dibuka',
  mobilize_sub: 'Subkontraktor tidak bisa dimobilisasi',
  start_variation: 'Variation tidak bisa dimulai',
  order_material: 'Material tidak bisa dipesan',
};

function blockedReason(status: CashGateStatus, action: CashGateAction): string {
  const prefix = ACTION_LABEL_ID[action];
  if (status === 'overdue') {
    return `${prefix}: ada termin yang seharusnya sudah cair tapi belum, lebih dari ${OVERDUE_GRACE_DAYS} hari.`;
  }
  return `${prefix}: dana yang tersedia belum mencukupi kebutuhan kas 14 hari ke depan.`;
}

/**
 * Decide whether an action may proceed under the current gate (ARCHITECTURE.md
 * 4.2).
 *
 * green and yellow always allow every action -- yellow is a warning shown on
 * the dashboard, never a block (ARCHITECTURE.md 7's own wording: hijau/
 * kuning/merah/overdue, with only the last two described as blocking).
 *
 * red and overdue block unless `override` is given with a non-empty reason.
 * This function does **not** verify the override's role -- see GateOverride's
 * own docs for exactly why, and where that check actually happens instead.
 * Passing an override here is a structural "an override was offered";
 * whether it was legitimately offered by an Owner is enforced twice more,
 * upstream (requirePermission) and downstream (the database trigger), and
 * this function trusts neither of those layers to have already run -- it
 * just does the one check that is actually its to do.
 */
export function evaluateGateAction(input: {
  readonly gate: GateState;
  readonly action: CashGateAction;
  readonly override?: GateOverride;
}): Result<GateAllowed, GateBlocked> {
  if (input.gate.status === 'green' || input.gate.status === 'yellow') {
    return ok({ status: input.gate.status, overridden: false });
  }

  if (input.override !== undefined) {
    if (input.override.reason.trim() === '') {
      return err({
        status: input.gate.status,
        reason: 'Alasan override wajib diisi -- tidak boleh kosong.',
      });
    }
    return ok({ status: input.gate.status, overridden: true });
  }

  return err({ status: input.gate.status, reason: blockedReason(input.gate.status, input.action) });
}
