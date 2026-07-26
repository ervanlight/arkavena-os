/**
 * Decision Clock (ADR 0016): how long a client has been sitting on a
 * pending decision, in three tiers. Pure function -- time is always a
 * parameter, never read from the ambient clock (ARCHITECTURE.md 4.1).
 *
 * Times are epoch milliseconds (`number`), not `Date` -- domain/ forbids the
 * `Date` global entirely (ESLint `no-restricted-globals`, so that a
 * domain *test* file cannot quietly reintroduce non-determinism either);
 * the caller (an action, not domain) is where a real `Date` becomes a
 * number via `.getTime()`.
 */

export type DecisionClockTier = 'fresh' | 'aging' | 'overdue';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const AGING_AT_DAYS = 3;
const OVERDUE_AT_DAYS = 7;

/**
 * Days elapsed since `presentedAtMs`, floored to whole days. A
 * `presentedAtMs` in the future (clock skew, or a not-yet-visible row)
 * floors to 0 rather than a negative number -- there is no such thing as a
 * decision pending for negative time.
 */
function daysPending(presentedAtMs: number, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - presentedAtMs) / MS_PER_DAY));
}

/**
 * `fresh` for 0-2 days pending, `aging` for 3-6, `overdue` at 7+ -- a
 * one-week SLA for a construction client decision (ADR 0016 §3). A
 * first-draft threshold, not a final word: easy to change in this one
 * place if the owner wants a different SLA at CHECKPOINT #4.
 */
export function decisionClockTier(presentedAtMs: number, nowMs: number): DecisionClockTier {
  const days = daysPending(presentedAtMs, nowMs);
  if (days >= OVERDUE_AT_DAYS) return 'overdue';
  if (days >= AGING_AT_DAYS) return 'aging';
  return 'fresh';
}
