import { describe, expect, it } from 'vitest';
import { decisionClockTier } from './decision-clock';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_HOUR = 60 * 60 * 1000;
const presentedAt = 1767225600000; // 2026-01-01T00:00:00.000Z, as epoch ms

const at = (days: number, hours = 0): number => presentedAt + days * MS_PER_DAY + hours * MS_PER_HOUR;

describe('decisionClockTier', () => {
  it('is fresh at exactly 0 days pending', () => {
    expect(decisionClockTier(presentedAt, at(0))).toBe('fresh');
  });

  it('is fresh just before a full day has elapsed', () => {
    expect(decisionClockTier(presentedAt, at(0, 23))).toBe('fresh');
  });

  it('is fresh at exactly 2 days pending (the last fresh day)', () => {
    expect(decisionClockTier(presentedAt, at(2))).toBe('fresh');
  });

  it('becomes aging at exactly 3 days pending (the boundary)', () => {
    expect(decisionClockTier(presentedAt, at(3))).toBe('aging');
  });

  it('is aging just before the 3-day boundary is reached', () => {
    expect(decisionClockTier(presentedAt, at(2, 23))).toBe('fresh');
  });

  it('is aging at 6 days pending (the last aging day)', () => {
    expect(decisionClockTier(presentedAt, at(6))).toBe('aging');
  });

  it('becomes overdue at exactly 7 days pending (the boundary)', () => {
    expect(decisionClockTier(presentedAt, at(7))).toBe('overdue');
  });

  it('stays overdue arbitrarily far past the boundary', () => {
    expect(decisionClockTier(presentedAt, at(90))).toBe('overdue');
  });

  it('treats a presentedAt in the future (clock skew) as fresh, not negative days', () => {
    expect(decisionClockTier(presentedAt + MS_PER_HOUR, presentedAt)).toBe('fresh');
  });

  it('treats presentedAt === now as fresh', () => {
    expect(decisionClockTier(presentedAt, presentedAt)).toBe('fresh');
  });
});
