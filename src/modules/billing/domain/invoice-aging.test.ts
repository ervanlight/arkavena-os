import { describe, expect, it } from 'vitest';
import { invoiceAgingTier } from './invoice-aging';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const dueDate = 1767225600000; // 2026-01-01T00:00:00.000Z, as epoch ms
const at = (days: number): number => dueDate + days * MS_PER_DAY;

describe('invoiceAgingTier', () => {
  it('is current on the due date itself', () => {
    expect(invoiceAgingTier(dueDate, at(0))).toBe('current');
  });

  it('is current before the due date (a future due date, negative days)', () => {
    expect(invoiceAgingTier(dueDate, at(-5))).toBe('current');
  });

  it('is overdue_1_30 the day after the due date', () => {
    expect(invoiceAgingTier(dueDate, at(1))).toBe('overdue_1_30');
  });

  it('is overdue_1_30 at exactly 30 days (the last day of that bucket)', () => {
    expect(invoiceAgingTier(dueDate, at(30))).toBe('overdue_1_30');
  });

  it('becomes overdue_31_60 at exactly 31 days (the boundary)', () => {
    expect(invoiceAgingTier(dueDate, at(31))).toBe('overdue_31_60');
  });

  it('is overdue_31_60 at exactly 60 days (the last day of that bucket)', () => {
    expect(invoiceAgingTier(dueDate, at(60))).toBe('overdue_31_60');
  });

  it('becomes overdue_61_90 at exactly 61 days (the boundary)', () => {
    expect(invoiceAgingTier(dueDate, at(61))).toBe('overdue_61_90');
  });

  it('is overdue_61_90 at exactly 90 days (the last day of that bucket)', () => {
    expect(invoiceAgingTier(dueDate, at(90))).toBe('overdue_61_90');
  });

  it('becomes overdue_90_plus at exactly 91 days (the boundary)', () => {
    expect(invoiceAgingTier(dueDate, at(91))).toBe('overdue_90_plus');
  });

  it('stays overdue_90_plus arbitrarily far past the boundary', () => {
    expect(invoiceAgingTier(dueDate, at(400))).toBe('overdue_90_plus');
  });
});
