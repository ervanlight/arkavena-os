import { err, ok, type Result } from '@/core/errors/result';
import type { Blocked, CashGateStatus, HoldPointState, Proceed, WorkPackageState } from './types';

/**
 * The Quality Hold Point decision (ARCHITECTURE.md 4.4). Pure function: input
 * plain data, output a decision. No I/O, no ambient clock.
 *
 * Two independent gates, not one combined check (ADR 0014, Bab 4.5's own
 * testing requirement: "cash gate merah tetap memblokir walau semua QC
 * lulus"). This function checks both and collects every reason either gate
 * produces -- a red/overdue Cash Gate blocks even when every hold point has
 * passed, and every hold point passing does not open a red Cash Gate. The
 * database mirrors this with two separate triggers
 * (trg_work_packages_guard_cash_gate, trg_work_packages_guard_hold_point)
 * for the identical reason: either one can independently reject the same
 * UPDATE, with no shared logic between them to drift apart.
 *
 * Only `required` hold points can block -- an optional one left unpassed
 * never appears in `reasons`. `overridden` lets a required-but-unpassed hold
 * point through without needing `passed` to also be true; whether that
 * override was legitimately granted by a Technical Director is enforced
 * upstream (requirePermission) and downstream (fn_inspections_guard_td_
 * only_override), the same two-more-layers pattern Cash Gate's own
 * `evaluateGateAction` documents for its own override parameter -- this
 * function trusts neither of those layers to have already run.
 */
export function canProceed(input: {
  readonly workPackage: WorkPackageState;
  readonly holdPoints: readonly HoldPointState[];
  readonly cashGate: CashGateStatus;
}): Result<Proceed, Blocked> {
  const reasons: string[] = [];

  if (input.cashGate === 'red' || input.cashGate === 'overdue') {
    reasons.push(
      `Cash Gate ${input.cashGate}: kas belum mencukupi untuk memulai "${input.workPackage.name}".`,
    );
  }

  for (const holdPoint of input.holdPoints) {
    if (holdPoint.required && !holdPoint.passed && !holdPoint.overridden) {
      reasons.push(`Tidak bisa lanjut: ${holdPoint.templateName} belum disetujui.`);
    }
  }

  if (reasons.length > 0) {
    return err({ reasons });
  }
  return ok({ allowed: true });
}
