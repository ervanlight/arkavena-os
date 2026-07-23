import { describe, expect, it } from 'vitest';
import { scoreLead } from './lead-scoring';

const noFactors = {
  budgetKnown: false,
  desiredStartWithin90Days: false,
  referredByExistingClient: false,
  estimatedValueAtLeastThreshold: false,
};

describe('scoreLead', () => {
  it('scores 0 when every factor is absent', () => {
    expect(scoreLead(noFactors)).toBe(0);
  });

  it('scores 100 when every factor is present', () => {
    expect(
      scoreLead({
        budgetKnown: true,
        desiredStartWithin90Days: true,
        referredByExistingClient: true,
        estimatedValueAtLeastThreshold: true,
      }),
    ).toBe(100);
  });

  it('adds 25 for budgetKnown alone', () => {
    expect(scoreLead({ ...noFactors, budgetKnown: true })).toBe(25);
  });

  it('adds 25 for desiredStartWithin90Days alone', () => {
    expect(scoreLead({ ...noFactors, desiredStartWithin90Days: true })).toBe(25);
  });

  it('adds 30 for referredByExistingClient alone', () => {
    expect(scoreLead({ ...noFactors, referredByExistingClient: true })).toBe(30);
  });

  it('adds 20 for estimatedValueAtLeastThreshold alone', () => {
    expect(scoreLead({ ...noFactors, estimatedValueAtLeastThreshold: true })).toBe(20);
  });

  it('sums independent factors rather than taking the max', () => {
    expect(scoreLead({ ...noFactors, budgetKnown: true, referredByExistingClient: true })).toBe(55);
  });
});
