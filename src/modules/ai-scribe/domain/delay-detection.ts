/**
 * "Delay detection" (ADR 0020 SS6) is mostly deterministic, not something
 * that needs Claude at all: a milestone is overdue or it isn't. This is the
 * pure, testable half -- the action layer only calls Claude to narrate the
 * result this function already computed, and skips the API call entirely
 * when nothing is overdue (no draft to write, no cost to spend).
 *
 * Time is always a parameter, in epoch milliseconds, never `Date`
 * (ARCHITECTURE.md 4.1; domain/ forbids the `Date` global entirely).
 */

export type MilestoneDueInput = {
  readonly id: string;
  readonly name: string;
  readonly dueDateMs: number | null;
  readonly status: 'pending' | 'completed';
};

export type OverdueMilestone = {
  readonly id: string;
  readonly name: string;
  readonly daysOverdue: number;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function detectOverdueMilestones(
  milestones: readonly MilestoneDueInput[],
  nowMs: number,
): readonly OverdueMilestone[] {
  const overdue: OverdueMilestone[] = [];

  for (const milestone of milestones) {
    if (milestone.status !== 'pending' || milestone.dueDateMs === null) continue;
    if (milestone.dueDateMs >= nowMs) continue;

    overdue.push({
      id: milestone.id,
      name: milestone.name,
      daysOverdue: Math.floor((nowMs - milestone.dueDateMs) / MS_PER_DAY),
    });
  }

  return overdue;
}
