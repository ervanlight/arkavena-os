import { describe, expect, it } from 'vitest';
import { toRupiah } from '@/core/money/rupiah';
import { computeMargin, isBelowMarginFloor, type EstimateLine } from './margin';

describe('computeMargin -- sums lines into cost, price, and margin', () => {
  it('sums a single line correctly', () => {
    const lines: EstimateLine[] = [{ quantity: 100, unitCost: toRupiah(150_000), unitPrice: toRupiah(220_000) }];
    const result = computeMargin(lines);

    expect(result.totalCost).toBe(15_000_000n);
    expect(result.totalPrice).toBe(22_000_000n);
    expect(result.marginAmount).toBe(7_000_000n);
    // margin = 7,000,000 / 22,000,000 = 0.318181... -> 3181 bp (ratioBp truncates)
    expect(result.marginBp).toBe(3_181);
  });

  it('sums multiple lines', () => {
    const lines: EstimateLine[] = [
      { quantity: 10, unitCost: toRupiah(100_000), unitPrice: toRupiah(150_000) },
      { quantity: 5, unitCost: toRupiah(200_000), unitPrice: toRupiah(250_000) },
    ];
    const result = computeMargin(lines);

    expect(result.totalCost).toBe(2_000_000n); // 1,000,000 + 1,000,000
    expect(result.totalPrice).toBe(2_750_000n); // 1,500,000 + 1,250,000
    expect(result.marginAmount).toBe(750_000n);
  });

  it('handles a fractional quantity without floating-point drift', () => {
    const lines: EstimateLine[] = [{ quantity: 3.333, unitCost: toRupiah(7), unitPrice: toRupiah(10) }];
    const result = computeMargin(lines);

    // cost rounds toward the company's favour: ceil(7 * 3.333) = ceil(23.331) = 24
    expect(result.totalCost).toBe(24n);
    // price rounds toward the company's favour: floor(10 * 3.333) = floor(33.33) = 33
    expect(result.totalPrice).toBe(33n);
    expect(result.marginAmount).toBe(9n);
  });

  it('returns zero cost/price/margin and null marginBp for no lines at all', () => {
    const result = computeMargin([]);

    expect(result.totalCost).toBe(0n);
    expect(result.totalPrice).toBe(0n);
    expect(result.marginAmount).toBe(0n);
    expect(result.marginBp).toBeNull();
  });

  it('returns null marginBp when every line prices at zero', () => {
    const lines: EstimateLine[] = [{ quantity: 10, unitCost: toRupiah(0), unitPrice: toRupiah(0) }];
    const result = computeMargin(lines);

    expect(result.totalPrice).toBe(0n);
    expect(result.marginBp).toBeNull();
  });

  it('reports a negative margin when cost exceeds price (selling at a loss)', () => {
    const lines: EstimateLine[] = [{ quantity: 1, unitCost: toRupiah(150_000), unitPrice: toRupiah(100_000) }];
    const result = computeMargin(lines);

    expect(result.marginAmount).toBe(-50_000n);
    expect(result.marginBp).toBeLessThan(0);
  });

  it('stays exact at a nominal value above 2^53', () => {
    const lines: EstimateLine[] = [
      { quantity: 1, unitCost: toRupiah('9007199254740993'), unitPrice: toRupiah('9007199254740994') },
    ];
    const result = computeMargin(lines);

    // A float would collapse these two adjacent bigints to the same value;
    // the exact 1-rupiah margin proves it did not.
    expect(result.marginAmount).toBe(1n);
  });
});

describe('isBelowMarginFloor', () => {
  it('flags a margin strictly below the floor', () => {
    expect(isBelowMarginFloor(1_000, 1_500)).toBe(true);
  });

  it('does not flag a margin exactly at the floor', () => {
    expect(isBelowMarginFloor(1_500, 1_500)).toBe(false);
  });

  it('does not flag a margin above the floor', () => {
    expect(isBelowMarginFloor(2_000, 1_500)).toBe(false);
  });

  it('does not flag a null margin (nothing priced yet), regardless of floor', () => {
    expect(isBelowMarginFloor(null, 1_500)).toBe(false);
    expect(isBelowMarginFloor(null, 0)).toBe(false);
  });

  it('flags a negative margin against any positive floor', () => {
    expect(isBelowMarginFloor(-500, 0)).toBe(true);
  });

  it('a floor of zero only flags a genuinely negative margin', () => {
    expect(isBelowMarginFloor(0, 0)).toBe(false);
    expect(isBelowMarginFloor(-1, 0)).toBe(true);
  });
});
