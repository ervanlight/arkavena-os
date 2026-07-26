import { err, ok, type Result } from '@/core/errors/result';
import type { Blocked, ChangeOrderState, HoldPointState, MilestoneState, Proceed } from './types';

/**
 * Advisory mirror of `fn_invoices_guard_issuance` (ADR 0017) -- the same
 * relationship `canProceed()` (Fase 5) has to
 * `fn_work_packages_guard_hold_point`. This is what a UI calls before
 * offering to issue an invoice; the trigger is what actually enforces it,
 * independently, in the database (CLAUDE.md 0.3).
 */
export function canIssueInvoice(input: {
  readonly milestone: MilestoneState;
  readonly holdPoints: readonly HoldPointState[];
  readonly changeOrder: ChangeOrderState;
  readonly approvedByTechnicalDirector: boolean;
}): Result<Proceed, Blocked> {
  const reasons: string[] = [];

  if (input.milestone.status !== 'completed') {
    reasons.push('Milestone belum selesai, invoice belum bisa terbit.');
  }

  for (const holdPoint of input.holdPoints) {
    if (!holdPoint.passed && !holdPoint.overridden) {
      reasons.push(`QC belum lulus: ${holdPoint.templateName} belum disetujui.`);
    }
  }

  if (input.changeOrder !== null && input.changeOrder.status !== 'approved_funded') {
    reasons.push('Variation terkait belum approved_funded, invoice belum bisa terbit.');
  }

  if (!input.approvedByTechnicalDirector) {
    reasons.push('Invoice wajib disetujui Technical Director sebelum terbit.');
  }

  if (reasons.length > 0) return err({ reasons });
  return ok({ allowed: true });
}
