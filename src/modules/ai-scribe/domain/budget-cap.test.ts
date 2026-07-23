import { describe, expect, it } from 'vitest';
import { toRupiah } from '@/core/money/rupiah';
import { AI_MONTHLY_BUDGET_CAP, isOverBudget } from './budget-cap';

describe('isOverBudget', () => {
  it('is not over budget when spending is well under the cap', () => {
    expect(isOverBudget(toRupiah(1_000), toRupiah(300_000))).toBe(false);
  });

  it('is over budget at the exact cap -- >= not >', () => {
    expect(isOverBudget(toRupiah(300_000), toRupiah(300_000))).toBe(true);
  });

  it('is over budget one rupiah past the cap', () => {
    expect(isOverBudget(toRupiah(300_001), toRupiah(300_000))).toBe(true);
  });

  it('is not over budget at zero spend against any positive cap', () => {
    expect(isOverBudget(toRupiah(0), toRupiah(300_000))).toBe(false);
  });

  it('defaults to AI_MONTHLY_BUDGET_CAP when no cap is passed', () => {
    expect(isOverBudget(AI_MONTHLY_BUDGET_CAP)).toBe(true);
    expect(isOverBudget(toRupiah(0))).toBe(false);
  });
});
