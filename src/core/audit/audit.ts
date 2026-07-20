import { AuditReasonRequiredError } from '@/core/errors/app-error';
import { requiresReason, type AuditAction, type AuditEntry, type AuditGateway } from './types';

/**
 * The application audit channel (ARCHITECTURE.md 5.2, channel 2).
 *
 * The database trigger already records that a row changed. This records what a
 * human meant by it: the reason, the request it belonged to, and a verb like
 * 'override' instead of a generic 'update'.
 *
 * CLAUDE.md law 5: modules never insert into audit_logs directly. They call
 * this. The database backs that up by having no INSERT policy on audit_logs at
 * all, so the rule is structural rather than merely agreed.
 */

/**
 * Compute the diff between two versions of a row.
 *
 * Only changed keys are kept. Storing whole rows would multiply the audit table
 * by the number of edits and bury the one field that moved among fifty that did
 * not -- and owner decision D9 puts us on a 500MB database.
 *
 * `updated_at` is dropped because its trigger changes it on every write, so
 * including it would make every update look like a change.
 */
export function diffRows(
  previous: Readonly<Record<string, unknown>> | undefined,
  next: Readonly<Record<string, unknown>> | undefined,
): { previousValue: Record<string, unknown>; newValue: Record<string, unknown> } {
  const before = previous ?? {};
  const after = next ?? {};

  const previousValue: Record<string, unknown> = {};
  const newValue: Record<string, unknown> = {};

  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (key === 'updated_at') continue;
    if (!Object.is(before[key], after[key]) && JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      previousValue[key] = before[key];
      newValue[key] = after[key];
    }
  }

  return { previousValue, newValue };
}

/**
 * Record an audit entry.
 *
 * The reason requirement is enforced three times, on purpose:
 *
 *   1. In the type of AuditEntry -- an override without a reason does not compile.
 *   2. Here at runtime -- catching a reason that is present but blank, which the
 *      type system cannot see.
 *   3. In fn_record_audit and a check constraint -- which holds even for a psql
 *      session that bypasses this code entirely.
 *
 * Three layers for one rule is not over-engineering here. This is the record
 * that explains, after the fact, why someone was allowed to spend money.
 */
export async function recordAudit<TAction extends AuditAction>(
  gateway: AuditGateway,
  entry: AuditEntry<TAction>,
): Promise<string> {
  const reason = 'reason' in entry ? (entry.reason as string | undefined) : undefined;

  if (requiresReason(entry.action) && (reason === undefined || reason.trim() === '')) {
    throw new AuditReasonRequiredError(
      `Audit action "${entry.action}" on ${entry.entityTable}/${entry.entityId} was given no reason`,
      { meta: { entityTable: entry.entityTable, entityId: entry.entityId, action: entry.action } },
    );
  }

  const { previousValue, newValue } = diffRows(entry.previousValue, entry.newValue);

  return gateway.write({
    entityTable: entry.entityTable,
    entityId: entry.entityId,
    action: entry.action,
    previousValue,
    newValue,
    reason: reason !== undefined && reason.trim() !== '' ? reason.trim() : null,
    requestId: entry.requestId ?? null,
    projectId: entry.projectId ?? null,
  });
}

/**
 * Run an operation and audit it, as one step.
 *
 * The value over calling recordAudit separately is that the audit call cannot
 * be forgotten and cannot be skipped by an early return -- the mutation and its
 * record are the same expression.
 *
 * Note what this deliberately does *not* do: if the operation succeeds and the
 * audit write then fails, the error propagates. A mutation that happened
 * without a trail is a problem to surface loudly, not to swallow. The database
 * trigger is still the safety net underneath.
 */
export async function withAudit<TResult, TAction extends AuditAction>(
  gateway: AuditGateway,
  entry: AuditEntry<TAction>,
  operation: () => Promise<TResult>,
): Promise<TResult> {
  const result = await operation();
  await recordAudit(gateway, entry);
  return result;
}
