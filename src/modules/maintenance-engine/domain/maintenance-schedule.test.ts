import { describe, expect, it } from 'vitest';
import { computeNextDueDate } from './maintenance-schedule';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const JAN_1_2026 = 1767225600000; // 2026-01-01T00:00:00.000Z, as epoch ms

describe('computeNextDueDate', () => {
  it('anchors on startsAtMs when the plan has never been completed', () => {
    const result = computeNextDueDate({
      intervalDays: 90,
      startsAtMs: JAN_1_2026,
      lastCompletedAtMs: null,
      nowMs: JAN_1_2026 + 14 * MS_PER_DAY,
    });

    expect(result.nextDueDateMs).toBe(JAN_1_2026 + 90 * MS_PER_DAY);
    expect(result.overdue).toBe(false);
  });

  it('anchors on lastCompletedAtMs once the plan has been completed at least once', () => {
    const completedAt = JAN_1_2026 + 60 * MS_PER_DAY;
    const result = computeNextDueDate({
      intervalDays: 90,
      startsAtMs: JAN_1_2026,
      lastCompletedAtMs: completedAt,
      nowMs: completedAt + 14 * MS_PER_DAY,
    });

    expect(result.nextDueDateMs).toBe(completedAt + 90 * MS_PER_DAY);
    expect(result.overdue).toBe(false);
  });

  it('is not overdue at the exact due instant', () => {
    const dueAt = JAN_1_2026 + 30 * MS_PER_DAY;
    const result = computeNextDueDate({
      intervalDays: 30,
      startsAtMs: JAN_1_2026,
      lastCompletedAtMs: null,
      nowMs: dueAt,
    });

    expect(result.overdue).toBe(false);
  });

  it('is overdue one millisecond past the due instant', () => {
    const dueAt = JAN_1_2026 + 30 * MS_PER_DAY;
    const result = computeNextDueDate({
      intervalDays: 30,
      startsAtMs: JAN_1_2026,
      lastCompletedAtMs: null,
      nowMs: dueAt + 1,
    });

    expect(result.overdue).toBe(true);
  });

  it('is overdue when the due date is well in the past', () => {
    const result = computeNextDueDate({
      intervalDays: 7,
      startsAtMs: JAN_1_2026,
      lastCompletedAtMs: null,
      nowMs: JAN_1_2026 + 150 * MS_PER_DAY,
    });

    expect(result.overdue).toBe(true);
  });
});
