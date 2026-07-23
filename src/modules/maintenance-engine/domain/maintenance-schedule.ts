/**
 * "Recurrence" as a computed-on-read value (ADR 0019 SS5) -- no scheduler or
 * cron job exists in this stack, so a plan's due date is never written by a
 * trigger, only derived at request time. Same "computed advisory number"
 * shape as computeFundingCoverage/Decision Clock/aging tiers.
 *
 * Time is always a parameter, in epoch milliseconds, never `Date`
 * (ARCHITECTURE.md 4.1; domain/ forbids the `Date` global entirely, ESLint
 * `no-restricted-globals` -- same pattern billing's invoice-aging.ts and
 * client-portal's Decision Clock already established).
 */

export type MaintenanceScheduleInput = {
  readonly intervalDays: number;
  readonly startsAtMs: number;
  readonly lastCompletedAtMs: number | null;
  readonly nowMs: number;
};

export type MaintenanceSchedule = {
  readonly nextDueDateMs: number;
  readonly overdue: boolean;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function computeNextDueDate(input: MaintenanceScheduleInput): MaintenanceSchedule {
  const anchorMs = input.lastCompletedAtMs ?? input.startsAtMs;
  const nextDueDateMs = anchorMs + input.intervalDays * MS_PER_DAY;

  return {
    nextDueDateMs,
    overdue: nextDueDateMs < input.nowMs,
  };
}
