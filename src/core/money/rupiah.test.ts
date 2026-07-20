import { describe, expect, it } from 'vitest';
import {
  BP_SCALE,
  CASH_GATE_GREEN_BP,
  CASH_GATE_YELLOW_FLOOR_BP,
  addRp,
  applyBp,
  compareRp,
  formatBp,
  formatRp,
  mulRp,
  ratioBp,
  serialiseRp,
  splitRp,
  subRp,
  sumRp,
  toRupiah,
} from './rupiah';

/**
 * The Fase 0 exit criterion is one test proving money arithmetic stays exact at
 * large nominal values (ARCHITECTURE.md 7).
 *
 * These tests are written to *demonstrate* the failure they prevent, not just
 * to assert the happy path. Several of them compute the float equivalent
 * alongside the bigint one and show the two disagreeing -- so the reason for
 * CLAUDE.md law 1 stays visible to whoever reads this file in a year, rather
 * than being an assertion in a document nobody opens.
 */

describe('rupiah stays exact where floating point does not', () => {
  it('adds amounts beyond 2^53 without losing a single rupiah', () => {
    // Number.MAX_SAFE_INTEGER is 9_007_199_254_740_991. Above it, consecutive
    // integers stop being distinguishable as doubles.
    const huge = toRupiah('9007199254740993'); // 2^53 + 1
    const one = toRupiah(1);

    const sum = addRp(huge, one);

    expect(sum).toBe(9_007_199_254_740_994n);
    expect(serialiseRp(sum)).toBe('9007199254740994');

    // The same arithmetic in floating point. 2^53 + 1 is not representable, so
    // it silently becomes 2^53, and adding one lands on the wrong value.
    // Written as an expression because the literal 9007199254740993 cannot even
    // be typed in source without the compiler rounding it -- which is the point.
    const floatVersion = 2 ** 53 + 1 + 1;
    expect(floatVersion).toBe(9_007_199_254_740_992); // not ...994
    expect(BigInt(floatVersion)).not.toBe(sum);
  });

  it('keeps a portfolio-scale sum exact', () => {
    // Fifty projects at 2.5 trillion rupiah each: 125 trillion. Individually
    // fine as doubles; the failure appears once the odd rupiah are added.
    const amounts = Array.from({ length: 50 }, () => toRupiah('2500000000001'));

    const total = sumRp(amounts);

    expect(total).toBe(125_000_000_000_050n);
    // Every single trailing rupiah survived.
    expect(total % 50n).toBe(0n);
    expect(subRp(total, toRupiah('125000000000000'))).toBe(50n);
  });

  it('multiplies without drifting, where the float result is visibly wrong', () => {
    const unitPrice = toRupiah('1234567890123');
    const quantity = 9_999;

    const exact = mulRp(unitPrice, quantity);

    // 1234567890123 * 9999, computed exactly.
    expect(exact).toBe(12_344_444_333_339_877n);
    expect(serialiseRp(exact)).toBe('12344444333339877');

    // The same product as doubles exceeds 2^53 and rounds to a different value.
    const floatVersion = 1234567890123 * 9999;
    expect(Number.isSafeInteger(floatVersion)).toBe(false);
    expect(BigInt(floatVersion)).not.toBe(exact);
  });

  it('refuses a number that has already lost precision instead of laundering it', () => {
    // 2^53 + 1 cannot be written as a JS number literal without becoming 2^53.
    // Accepting it would convert a wrong value into an exact-looking Rupiah.
    expect(() => toRupiah(2 ** 53 + 1)).toThrow(/lost precision/);
  });

  it('refuses a fractional amount rather than quietly truncating it', () => {
    expect(() => toRupiah(1500.75)).toThrow(/whole number/);
  });

  it('will not let a rupiah amount be mixed with a plain number', () => {
    const amount = toRupiah(1000);

    // The compiler refuses this. The directive itself is the assertion: if
    // Rupiah ever stopped being a bigint, @ts-expect-error would report an
    // unused suppression and typecheck would fail.
    function typeLevelCheck(): void {
      // @ts-expect-error -- bigint and number cannot be added; that is the point.
      void (amount + 1);
    }
    void typeLevelCheck;

    // And the runtime agrees, so the rule holds even where types are erased --
    // a value crossing a JSON boundary, for instance.
    expect(() => (amount as unknown as number) + 1).toThrow(TypeError);
  });
});

describe('ratioBp -- the shape of the Funding Coverage Ratio', () => {
  it('computes coverage in basis points without an intermediate float', () => {
    const cleared = toRupiah('1100000000');
    const needed = toRupiah('1000000000');

    expect(ratioBp(cleared, needed)).toBe(11_000);
  });

  it('stays exact at portfolio scale', () => {
    const cleared = toRupiah('123456789012345');
    const needed = toRupiah('100000000000000');

    // Multiplication happens in bigint before the division, so nothing rounds.
    expect(ratioBp(cleared, needed)).toBe(12_345);
  });

  it('returns null when nothing is needed, rather than zero', () => {
    // ARCHITECTURE.md 4.5 requires this case explicitly. A project with no
    // 14-day need has no coverage ratio; reporting 0 would read as "no funding"
    // and turn the gate red for a project that is fine.
    expect(ratioBp(toRupiah('500000000'), toRupiah(0))).toBeNull();
    expect(ratioBp(toRupiah(0), toRupiah(0))).toBeNull();
  });

  it('holds at the exact Cash Gate boundaries', () => {
    const needed = toRupiah('10000');

    // The four values ARCHITECTURE.md 4.5 names by hand.
    expect(ratioBp(toRupiah('11000'), needed)).toBe(11_000);
    expect(ratioBp(toRupiah('10999'), needed)).toBe(10_999);
    expect(ratioBp(toRupiah('10000'), needed)).toBe(10_000);
    expect(ratioBp(toRupiah('9999'), needed)).toBe(9_999);

    expect(CASH_GATE_GREEN_BP).toBe(11_000);
    expect(CASH_GATE_YELLOW_FLOOR_BP).toBe(10_000);
    expect(BP_SCALE).toBe(10_000);
  });
});

describe('applyBp -- rounding is always stated, never assumed', () => {
  it('rounds each way as asked when the result is fractional', () => {
    const amount = toRupiah(1_000);
    const oneThirdIsh = 3_333; // 33.33%

    expect(applyBp(amount, oneThirdIsh, 'floor')).toBe(333n);
    expect(applyBp(amount, oneThirdIsh, 'ceil')).toBe(334n);
    expect(applyBp(amount, oneThirdIsh, 'half-up')).toBe(333n);
  });

  it('rounds half away from zero for half-up', () => {
    expect(applyBp(toRupiah(1_000), 5_005, 'half-up')).toBe(501n); // 500.5
  });

  it('rounds negative amounts away from zero rather than toward it', () => {
    // bigint division truncates toward zero, which would make floor() of a
    // negative value behave like ceil(). These assert the correction works.
    expect(applyBp(toRupiah(-1_000), 3_333, 'floor')).toBe(-334n);
    expect(applyBp(toRupiah(-1_000), 3_333, 'ceil')).toBe(-333n);
  });

  it('is exact when the rate divides cleanly', () => {
    expect(applyBp(toRupiah('1000000000000000'), 1_100, 'floor')).toBe(110_000_000_000_000n);
  });
});

describe('splitRp -- the parts must reconstruct the whole', () => {
  it('distributes the remainder so the shares sum back exactly', () => {
    const total = toRupiah(1_000);
    const shares = splitRp(total, 3);

    expect(shares).toEqual([334n, 333n, 333n]);
    expect(sumRp(shares)).toBe(total);
  });

  it('reconstructs exactly for awkward splits at scale', () => {
    const total = toRupiah('987654321098765');

    for (const parts of [2, 3, 7, 11, 365]) {
      const shares = splitRp(total, parts);
      expect(shares).toHaveLength(parts);
      // The property that matters: no rupiah created, none lost.
      expect(sumRp(shares)).toBe(total);
      // And no share differs from another by more than one rupiah.
      const spread = shares[0]! - shares[shares.length - 1]!;
      expect(spread === 0n || spread === 1n).toBe(true);
    }
  });

  it('reconstructs exactly for negative totals too', () => {
    const total = toRupiah(-1_000);
    expect(sumRp(splitRp(total, 3))).toBe(total);
  });
});

describe('formatting', () => {
  it('formats with Indonesian thousand separators', () => {
    expect(formatRp(toRupiah(1_250_000))).toBe('Rp 1.250.000');
    expect(formatRp(toRupiah(0))).toBe('Rp 0');
    expect(formatRp(toRupiah(999))).toBe('Rp 999');
    expect(formatRp(toRupiah(-1_500_000))).toBe('-Rp 1.500.000');
    expect(formatRp(toRupiah(1_250_000), { withSymbol: false })).toBe('1.250.000');
  });

  it('formats amounts far beyond float range correctly', () => {
    expect(formatRp(toRupiah('9007199254740993'))).toBe('Rp 9.007.199.254.740.993');
  });

  it('formats basis points as Indonesian percent', () => {
    expect(formatBp(11_000)).toBe('110,00%');
    expect(formatBp(10_000)).toBe('100,00%');
    expect(formatBp(9_999)).toBe('99,99%');
  });
});

describe('comparison', () => {
  it('orders amounts correctly across the float boundary', () => {
    const a = toRupiah('9007199254740993');
    const b = toRupiah('9007199254740992');

    expect(compareRp(a, b)).toBe(1);
    expect(compareRp(b, a)).toBe(-1);
    expect(compareRp(a, a)).toBe(0);

    // As doubles these two are the same value, so a float comparison cannot
    // tell them apart at all.
    expect(Number(a) === Number(b)).toBe(true);
  });
});
