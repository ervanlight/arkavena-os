import { describe, expect, it } from 'vitest';
import { detectOverdueMilestones, type MilestoneDueInput } from './delay-detection';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const JAN_1_2026 = 1767225600000; // 2026-01-01T00:00:00.000Z, as epoch ms

describe('detectOverdueMilestones', () => {
  it('flags a pending milestone whose due date has passed', () => {
    const milestones: MilestoneDueInput[] = [
      { id: 'm1', name: 'Termin 1', dueDateMs: JAN_1_2026 - 10 * MS_PER_DAY, status: 'pending' },
    ];

    const result = detectOverdueMilestones(milestones, JAN_1_2026);

    expect(result).toEqual([{ id: 'm1', name: 'Termin 1', daysOverdue: 10 }]);
  });

  it('does not flag a milestone due exactly now', () => {
    const milestones: MilestoneDueInput[] = [
      { id: 'm1', name: 'Termin 1', dueDateMs: JAN_1_2026, status: 'pending' },
    ];

    expect(detectOverdueMilestones(milestones, JAN_1_2026)).toEqual([]);
  });

  it('does not flag a milestone due in the future', () => {
    const milestones: MilestoneDueInput[] = [
      { id: 'm1', name: 'Termin 1', dueDateMs: JAN_1_2026 + 5 * MS_PER_DAY, status: 'pending' },
    ];

    expect(detectOverdueMilestones(milestones, JAN_1_2026)).toEqual([]);
  });

  it('does not flag a completed milestone even if its due date has passed', () => {
    const milestones: MilestoneDueInput[] = [
      { id: 'm1', name: 'Termin 1', dueDateMs: JAN_1_2026 - 30 * MS_PER_DAY, status: 'completed' },
    ];

    expect(detectOverdueMilestones(milestones, JAN_1_2026)).toEqual([]);
  });

  it('does not flag a milestone with no due date at all', () => {
    const milestones: MilestoneDueInput[] = [{ id: 'm1', name: 'Termin 1', dueDateMs: null, status: 'pending' }];

    expect(detectOverdueMilestones(milestones, JAN_1_2026)).toEqual([]);
  });

  it('returns only the overdue ones out of a mixed list', () => {
    const milestones: MilestoneDueInput[] = [
      { id: 'm1', name: 'Overdue', dueDateMs: JAN_1_2026 - 1 * MS_PER_DAY, status: 'pending' },
      { id: 'm2', name: 'Completed', dueDateMs: JAN_1_2026 - 1 * MS_PER_DAY, status: 'completed' },
      { id: 'm3', name: 'Future', dueDateMs: JAN_1_2026 + 1 * MS_PER_DAY, status: 'pending' },
    ];

    const result = detectOverdueMilestones(milestones, JAN_1_2026);

    expect(result).toEqual([{ id: 'm1', name: 'Overdue', daysOverdue: 1 }]);
  });

  it('returns an empty list for an empty input', () => {
    expect(detectOverdueMilestones([], JAN_1_2026)).toEqual([]);
  });
});
