import { DomainRuleError } from '@/core/errors/app-error';
import type { Inspection } from '../types';

export type ReviewResult = { ok: true } | { ok: false; error: DomainRuleError };

export function transitionInspection(
  current: Inspection,
  event: 'pass' | 'fail' | 'override',
  reason?: string
): ReviewResult {
  if (current.status !== 'pending') {
    return { ok: false, error: new DomainRuleError('VALIDATION_FAILED', 'Inspection is already decided.') };
  }

  if (event === 'override' && (!reason || reason.trim() === '')) {
    return { ok: false, error: new DomainRuleError('AUDIT_REASON_REQUIRED', 'Override must include a reason.') };
  }

  return { ok: true };
}
