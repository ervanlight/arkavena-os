import { describe, expect, it } from 'vitest';
import { toRupiah } from '@/core/money/rupiah';
import { isErr, isOk } from '@/core/errors/result';
import {
  computeFundingCoverage,
  determineGateStatus,
  evaluateGateAction,
  OVERDUE_GRACE_DAYS,
  OVERRIDE_VALIDITY_MINUTES,
} from './funding-coverage';

/**
 * ARCHITECTURE.md 4.5's Definition of Done for Cash Gate, verbatim: "nilai
 * batas persis 11000/10999/10000/9999; pembagian nol (kebutuhan 14 hari = 0);
 * overdue menimpa status hijau; override tanpa reason -> error; semua nominal
 * bigint (test dengan angka > 2^53 rupiah untuk membuktikan tak ada float)."
 * Every one of those five is its own describe block below, by name, so this
 * file can be checked against the requirement line by line rather than
 * trusted to have covered it implicitly.
 */

const zero = toRupiah(0);

describe('computeFundingCoverage -- exact boundary values', () => {
  // committedCosts and riskReserve held at zero throughout this block so
  // clearedFunds and next14DayNeeds alone produce the exact ratio under test
  // -- isolating the boundary from every other input.

  it('11000: exactly at the green threshold is green, not yellow', () => {
    const result = computeFundingCoverage({
      clearedFunds: toRupiah(110_000),
      committedCosts: zero,
      next14DayNeeds: toRupiah(100_000),
      riskReserve: zero,
    });
    expect(result.ratioBp).toBe(11_000);
    expect(result.status).toBe('green');
  });

  it('10999: one basis point below green is yellow, not green', () => {
    const result = computeFundingCoverage({
      clearedFunds: toRupiah(109_990),
      committedCosts: zero,
      next14DayNeeds: toRupiah(100_000),
      riskReserve: zero,
    });
    expect(result.ratioBp).toBe(10_999);
    expect(result.status).toBe('yellow');
  });

  it('10000: exactly at the yellow floor is yellow, not red', () => {
    const result = computeFundingCoverage({
      clearedFunds: toRupiah(100_000),
      committedCosts: zero,
      next14DayNeeds: toRupiah(100_000),
      riskReserve: zero,
    });
    expect(result.ratioBp).toBe(10_000);
    expect(result.status).toBe('yellow');
  });

  it('9999: one basis point below the yellow floor is red', () => {
    const result = computeFundingCoverage({
      clearedFunds: toRupiah(99_990),
      committedCosts: zero,
      next14DayNeeds: toRupiah(100_000),
      riskReserve: zero,
    });
    expect(result.ratioBp).toBe(9_999);
    expect(result.status).toBe('red');
  });
});

describe('computeFundingCoverage -- division by zero (kebutuhan 14 hari = 0)', () => {
  it('is green with a null ratio when nothing is needed and no reserve is set', () => {
    const result = computeFundingCoverage({
      clearedFunds: toRupiah(50_000_000),
      committedCosts: zero,
      next14DayNeeds: zero,
      riskReserve: zero,
    });
    expect(result.ratioBp).toBeNull();
    expect(result.status).toBe('green');
  });

  it('is still green with zero need even when committed costs exceed cleared funds', () => {
    // Nothing is needed, so a negative net-available figure is irrelevant --
    // the zero-denominator branch short-circuits before that sign is ever
    // examined. Worth asserting explicitly: it would be easy to accidentally
    // write this branch as "green only if net available is also >= 0".
    const result = computeFundingCoverage({
      clearedFunds: toRupiah(1_000_000),
      committedCosts: toRupiah(5_000_000),
      next14DayNeeds: zero,
      riskReserve: zero,
    });
    expect(result.ratioBp).toBeNull();
    expect(result.status).toBe('green');
  });

  it('is not the zero-need case once a risk reserve alone makes total need positive', () => {
    const result = computeFundingCoverage({
      clearedFunds: toRupiah(50_000),
      committedCosts: zero,
      next14DayNeeds: zero,
      riskReserve: toRupiah(100_000),
    });
    expect(result.ratioBp).not.toBeNull();
    expect(result.status).toBe('red'); // 50000/100000 = 5000bp
  });
});

describe('computeFundingCoverage -- bigint precision above 2^53', () => {
  // 2^53 = 9_007_199_254_740_992. base sits an order of magnitude above it --
  // Number.isSafeInteger(base) is false -- and is exactly divisible by 10_000
  // so one basis point at this scale is itself a whole number.
  const base = 90_000_000_000_000_000n; // 10x 2^53, rounded for a clean bp step
  const oneBasisPointAtThisScale = base / 10_000n; // 9_000_000_000_000 -- itself far above 2^53

  it('reads the same exact boundary (10000bp) at huge scale as at small scale', () => {
    const result = computeFundingCoverage({
      clearedFunds: toRupiah(base),
      committedCosts: zero,
      next14DayNeeds: toRupiah(base),
      riskReserve: zero,
    });
    expect(result.ratioBp).toBe(10_000);
    expect(result.status).toBe('yellow'); // exactly at the floor -- see the boundary block above
  });

  it('moves by exactly one basis point for exactly one basis point of value, even though the step itself is above 2^53', () => {
    // If the ratio math coerced through a JS number anywhere, adding a value
    // this large to an already-huge base risks silently rounding to a
    // *different* nearby integer rather than landing on precisely 10_001.
    // bigint arithmetic has no such risk; this asserts the exact value, not
    // just "greater than baseline".
    const result = computeFundingCoverage({
      clearedFunds: toRupiah(base + oneBasisPointAtThisScale),
      committedCosts: zero,
      next14DayNeeds: toRupiah(base),
      riskReserve: zero,
    });
    expect(result.ratioBp).toBe(10_001);
    expect(result.status).toBe('yellow');
  });
});

describe('determineGateStatus -- overdue menimpa status hijau', () => {
  it('overrides a green coverage reading to overdue', () => {
    const state = determineGateStatus({
      coverage: { ratioBp: 15_000, status: 'green' },
      isOverdue: true,
    });
    expect(state.status).toBe('overdue');
    expect(state.ratioBp).toBe(15_000); // the ratio is preserved for the dashboard even though status is overdue
  });

  it('overrides yellow and red the same way -- overdue always wins', () => {
    expect(determineGateStatus({ coverage: { ratioBp: 10_500, status: 'yellow' }, isOverdue: true }).status).toBe(
      'overdue',
    );
    expect(determineGateStatus({ coverage: { ratioBp: 3_000, status: 'red' }, isOverdue: true }).status).toBe(
      'overdue',
    );
  });

  it('passes the coverage status through unchanged when not overdue', () => {
    expect(determineGateStatus({ coverage: { ratioBp: 15_000, status: 'green' }, isOverdue: false }).status).toBe(
      'green',
    );
    expect(determineGateStatus({ coverage: { ratioBp: null, status: 'green' }, isOverdue: false })).toEqual({
      status: 'green',
      ratioBp: null,
    });
  });
});

describe('evaluateGateAction -- green and yellow always allow, red and overdue block', () => {
  it('allows every action when green', () => {
    const result = evaluateGateAction({
      gate: { status: 'green', ratioBp: 15_000 },
      action: 'issue_po',
    });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toEqual({ status: 'green', overridden: false });
    }
  });

  it('allows every action when yellow -- a warning, never a block', () => {
    const result = evaluateGateAction({
      gate: { status: 'yellow', ratioBp: 10_500 },
      action: 'open_work_package',
    });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.overridden).toBe(false);
    }
  });

  it('blocks with no override when red', () => {
    const result = evaluateGateAction({
      gate: { status: 'red', ratioBp: 3_000 },
      action: 'issue_po',
    });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.status).toBe('red');
      expect(result.error.reason).toContain('Purchase order');
    }
  });

  it('blocks with no override when overdue, with a distinct message from red', () => {
    const result = evaluateGateAction({
      gate: { status: 'overdue', ratioBp: 15_000 }, // ratio itself looks healthy -- irrelevant, overdue still blocks
      action: 'open_work_package',
    });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.status).toBe('overdue');
      expect(result.error.reason).toContain(String(OVERDUE_GRACE_DAYS));
    }
  });

  it('gives a distinct, action-specific reason for each action', () => {
    const actions = ['issue_po', 'open_work_package', 'mobilize_sub', 'start_variation', 'order_material'] as const;
    const reasons = actions.map((action) => {
      const result = evaluateGateAction({ gate: { status: 'red', ratioBp: 0 }, action });
      return isErr(result) ? result.error.reason : null;
    });
    expect(new Set(reasons).size).toBe(actions.length); // all five distinct, none accidentally identical
  });
});

describe('evaluateGateAction -- override tanpa reason -> error', () => {
  it('rejects an override with an empty reason', () => {
    const result = evaluateGateAction({
      gate: { status: 'red', ratioBp: 3_000 },
      action: 'issue_po',
      override: { byUserId: 'user-1', reason: '' },
    });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.reason).toMatch(/alasan/i);
    }
  });

  it('rejects an override with a whitespace-only reason', () => {
    const result = evaluateGateAction({
      gate: { status: 'overdue', ratioBp: null },
      action: 'mobilize_sub',
      override: { byUserId: 'user-1', reason: '   ' },
    });
    expect(isErr(result)).toBe(true);
  });

  it('accepts an override with a real reason, on both red and overdue', () => {
    const validOverride = { byUserId: 'owner-1', reason: 'Dana konfirmasi cair besok, klien sudah transfer bukti.' };

    const redResult = evaluateGateAction({ gate: { status: 'red', ratioBp: 5_000 }, action: 'issue_po', override: validOverride });
    expect(isOk(redResult)).toBe(true);
    if (isOk(redResult)) expect(redResult.value).toEqual({ status: 'red', overridden: true });

    const overdueResult = evaluateGateAction({
      gate: { status: 'overdue', ratioBp: null },
      action: 'open_work_package',
      override: validOverride,
    });
    expect(isOk(overdueResult)).toBe(true);
    if (isOk(overdueResult)) expect(overdueResult.value).toEqual({ status: 'overdue', overridden: true });
  });

  it('does not require an override at all when green or yellow, even if one is (harmlessly) supplied', () => {
    const result = evaluateGateAction({
      gate: { status: 'green', ratioBp: 20_000 },
      action: 'issue_po',
      override: { byUserId: 'user-1', reason: '' }, // empty reason, but never inspected -- green never reaches the override branch
    });
    expect(isOk(result)).toBe(true);
  });
});

describe('named constants match what the SQL trigger and ADRs assume', () => {
  it('OVERDUE_GRACE_DAYS is 7 (ADR 0009 decision 3)', () => {
    expect(OVERDUE_GRACE_DAYS).toBe(7);
  });

  it('OVERRIDE_VALIDITY_MINUTES is 5 (ADR 0010)', () => {
    expect(OVERRIDE_VALIDITY_MINUTES).toBe(5);
  });
});
